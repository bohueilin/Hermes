"""Deterministic regeneration of the evidence bundles the test suite depends on.

Eight Phase 6 test modules read bundles by name out of ``artifacts/``, but ``artifacts/*``
is gitignored, so a fresh clone cannot run them (see ``PHASE8_BASELINE_AUDIT.md`` §1.3).
Nothing in the repository described how those bundles were produced.

This module makes the fixture set reproducible from committed inputs: a strict registry
binds each fixture's run ID to the exact scenario, gate configuration, policy, shield and
seed that generate it, so the suite can be restored on any machine that has the simulator
the fixture requires.

This is a developer tool. It writes nothing that a normal run does not write, and it never
weakens verification: a regenerated bundle is self-verified by the same runtime path as any
other run.
"""

from __future__ import annotations

import json
import shutil
from collections.abc import Iterable
from pathlib import Path
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

from hermes.evidence.artifacts import RUN_ID_PATTERN
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_REGISTRY_BYTES = 1_048_576

#: The only corruption this tool knows how to apply, used by ``phase1-tampered``.
#:
#: The stored trace's first executed action is rewritten while every digest file is left
#: untouched, so the bundle fails hash-chain verification exactly as an unrehashed tamper
#: would. Keeping the recipe here means the negative fixture is reproducible rather than a
#: hand-edited artifact nobody can rebuild.
TamperKind = Literal["executed_throttle_downshift"]


class FixtureRegistryError(ValueError):
    """Actionable fixture-registry parsing, validation, or regeneration failure."""


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class FixtureRecipe(_StrictModel):
    """One reproducible evidence bundle, described entirely by committed inputs."""

    run_id: Annotated[str, Field(pattern=RUN_ID_PATTERN.pattern)]
    description: Annotated[str, Field(min_length=1, max_length=200)]
    scenario: str | None = None
    gate_config: str | None = None
    simulator: Literal["fake", "metadrive"] | None = None
    policy: str | None = None
    shield: Literal["noop", "deterministic"] = "noop"
    shield_config: str | None = None
    seed: Annotated[int, Field(ge=-(2**31), lt=2**31)] | None = None
    derived_from: str | None = None
    tamper: TamperKind | None = None

    @model_validator(mode="after")
    def require_exactly_one_generation_mode(self) -> FixtureRecipe:
        generated_fields = (self.scenario, self.gate_config, self.simulator, self.policy, self.seed)
        derived_fields = (self.derived_from, self.tamper)
        is_generated = all(value is not None for value in generated_fields)
        is_derived = all(value is not None for value in derived_fields)
        if is_generated == is_derived:
            raise ValueError(
                "a fixture is either fully generated (scenario, gate_config, simulator, "
                "policy, seed) or fully derived (derived_from, tamper), never both or neither"
            )
        if is_derived and any(
            value is not None for value in (*generated_fields, self.shield_config)
        ):
            raise ValueError("a derived fixture cannot declare generation inputs")
        if self.shield == "noop" and self.shield_config is not None:
            raise ValueError("shield_config requires the deterministic shield")
        if is_generated and self.shield == "deterministic" and self.shield_config is None:
            raise ValueError("the deterministic shield requires shield_config")
        return self

    @property
    def requires_simulator(self) -> bool:
        """Whether regenerating this fixture needs a real local MetaDrive installation."""
        return self.simulator == "metadrive"


class FixtureRegistry(_StrictModel):
    """The complete, versioned set of reproducible test fixtures."""

    schema_version: Literal["1.0"]
    label: Literal["illustrative_simulation_fixtures_not_real_vehicle_evidence"]
    fixtures: tuple[FixtureRecipe, ...]

    @field_validator("fixtures", mode="before")
    @classmethod
    def normalize_yaml_fixture_list(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    @model_validator(mode="after")
    def require_resolvable_unique_fixtures(self) -> FixtureRegistry:
        run_ids = [recipe.run_id for recipe in self.fixtures]
        if len(set(run_ids)) != len(run_ids):
            raise ValueError("fixture run IDs must be unique")
        known = set(run_ids)
        for recipe in self.fixtures:
            if recipe.derived_from is not None and recipe.derived_from not in known:
                raise ValueError(
                    f"fixture {recipe.run_id!r} derives from unknown fixture "
                    f"{recipe.derived_from!r}"
                )
            if recipe.derived_from == recipe.run_id:
                raise ValueError(f"fixture {recipe.run_id!r} cannot derive from itself")
        return self

    def by_run_id(self, run_id: str) -> FixtureRecipe:
        for recipe in self.fixtures:
            if recipe.run_id == run_id:
                return recipe
        raise FixtureRegistryError(f"unknown fixture: {run_id}")

    @property
    def run_ids(self) -> tuple[str, ...]:
        return tuple(recipe.run_id for recipe in self.fixtures)


def parse_fixture_registry_yaml(text: str) -> FixtureRegistry:
    """Parse one already-bounded UTF-8 fixture-registry snapshot."""
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise FixtureRegistryError(f"fixture registry YAML is malformed: {exc}") from exc
    try:
        return FixtureRegistry.model_validate(payload)
    except ValidationError as exc:
        raise FixtureRegistryError(f"fixture registry validation failed: {exc}") from exc


def load_fixture_registry(path: Path) -> FixtureRegistry:
    """Load a bounded, strict fixture-registry document."""
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise FixtureRegistryError(f"fixture registry is unreadable: {exc}") from exc
    if len(raw) > MAX_REGISTRY_BYTES:
        raise FixtureRegistryError("fixture registry exceeds the supported size")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise FixtureRegistryError(f"fixture registry is not valid UTF-8: {exc}") from exc
    return parse_fixture_registry_yaml(text)


def repository_worktree_is_dirty(repository_root: Path) -> bool | None:
    """Whether the worktree would make generated bundles carry dirty provenance.

    Reuses the runtime's own provenance probe rather than re-deriving the git invocation,
    so this answer cannot drift from the ``repository_dirty`` value the manifest records.
    """
    from hermes.runtime.orchestrator import _repository_provenance

    _, dirty, _ = _repository_provenance(repository_root)
    return dirty


def _apply_tamper(bundle: Path, kind: TamperKind) -> None:
    """Corrupt a stored trace without rehashing, producing a detectable tamper."""
    if kind != "executed_throttle_downshift":  # pragma: no cover - Literal is exhaustive
        raise FixtureRegistryError(f"unsupported tamper kind: {kind}")
    events_path = bundle / "events.jsonl"
    lines = events_path.read_text(encoding="utf-8").splitlines()
    if not lines:
        raise FixtureRegistryError("cannot tamper an empty trace")
    first = json.loads(lines[0])
    executed = first.get("executed_action")
    if not isinstance(executed, dict) or "throttle" not in executed:
        raise FixtureRegistryError("trace does not expose an executed throttle to tamper")
    executed["throttle"] = round(float(executed["throttle"]) - 0.1, 10)
    lines[0] = json.dumps(first, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    events_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _resolve(repository_root: Path, relative: str) -> Path:
    """Resolve a registry-declared path inside the repository, refusing escape."""
    root = repository_root.resolve()
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root):
        raise FixtureRegistryError(f"fixture path escapes the repository: {relative}")
    if not candidate.is_file():
        raise FixtureRegistryError(f"fixture input is missing: {relative}")
    return candidate


def regenerate_fixture(
    recipe: FixtureRecipe,
    *,
    registry: FixtureRegistry,
    artifact_root: Path,
    repository_root: Path,
    force: bool = False,
) -> Path:
    """Rebuild one fixture bundle from committed inputs and return its directory."""
    from hermes.runtime.orchestrator import (
        RunConfigurationError,
        RunOperationalError,
        execute_fake_run,
        execute_metadrive_run,
    )
    from hermes.shields.config import ShieldConfigError, load_shield_config
    from hermes.shields.deterministic import DeterministicSafetyShield
    from hermes.shields.noop import NoOpShield

    destination = artifact_root / recipe.run_id
    if destination.exists():
        if not force:
            raise FixtureRegistryError(
                f"fixture already exists: {destination} (pass force to replace it)"
            )
        shutil.rmtree(destination)

    if recipe.derived_from is not None:
        source = artifact_root / recipe.derived_from
        if not source.is_dir():
            raise FixtureRegistryError(
                f"fixture {recipe.run_id!r} requires {recipe.derived_from!r} to exist first"
            )
        shutil.copytree(source, destination)
        assert recipe.tamper is not None
        _apply_tamper(destination, recipe.tamper)
        return destination

    assert recipe.scenario is not None
    assert recipe.gate_config is not None
    assert recipe.seed is not None
    scenario_path = _resolve(repository_root, recipe.scenario)
    gate_config_path = _resolve(repository_root, recipe.gate_config)

    shield_factory = NoOpShield
    if recipe.shield == "deterministic":
        assert recipe.shield_config is not None
        try:
            shield_config = load_shield_config(_resolve(repository_root, recipe.shield_config))
        except ShieldConfigError as exc:
            raise FixtureRegistryError(f"fixture shield configuration is invalid: {exc}") from exc

        def shield_factory() -> DeterministicSafetyShield:  # type: ignore[misc]
            return DeterministicSafetyShield(shield_config)

    runner = execute_fake_run if recipe.simulator == "fake" else execute_metadrive_run
    try:
        runner(
            scenario_path=scenario_path,
            gate_config_path=gate_config_path,
            seed=recipe.seed,
            run_id=recipe.run_id,
            artifact_root=artifact_root,
            repository_root=repository_root,
            shield_factory=shield_factory,
        )
    except (RunConfigurationError, RunOperationalError) as exc:
        raise FixtureRegistryError(
            f"regenerating fixture {recipe.run_id!r} failed: {exc}"
        ) from exc
    del registry
    return destination


def regeneration_order(registry: FixtureRegistry) -> tuple[FixtureRecipe, ...]:
    """Order recipes so every derived fixture follows the fixture it derives from."""
    generated = [recipe for recipe in registry.fixtures if recipe.derived_from is None]
    derived = [recipe for recipe in registry.fixtures if recipe.derived_from is not None]
    return (*generated, *derived)


def missing_fixtures(registry: FixtureRegistry, artifact_root: Path) -> tuple[str, ...]:
    """Return the registry run IDs that are not present under ``artifact_root``."""
    return tuple(
        recipe.run_id
        for recipe in registry.fixtures
        if not (artifact_root / recipe.run_id).is_dir()
    )


def select_recipes(
    registry: FixtureRegistry,
    *,
    only: Iterable[str] | None = None,
    include_simulator: bool = True,
) -> tuple[FixtureRecipe, ...]:
    """Choose which recipes to regenerate, preserving dependency order."""
    ordered = regeneration_order(registry)
    if only is not None:
        wanted = tuple(only)
        for run_id in wanted:
            registry.by_run_id(run_id)
        ordered = tuple(recipe for recipe in ordered if recipe.run_id in set(wanted))
    if not include_simulator:
        excluded = {recipe.run_id for recipe in ordered if recipe.requires_simulator}
        ordered = tuple(
            recipe
            for recipe in ordered
            if recipe.run_id not in excluded and recipe.derived_from not in excluded
        )
    return ordered
