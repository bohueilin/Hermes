"""The evidence fixtures the suite depends on must be reproducible from committed inputs."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.evidence.verification import verify_artifact
from hermes.fixtures import (
    FixtureRegistryError,
    load_fixture_registry,
    missing_fixtures,
    regenerate_fixture,
    select_recipes,
)
from hermes.fixtures.registry import parse_fixture_registry_yaml

REGISTRY_RELATIVE = Path("config") / "phase8-fixture-registry.yaml"
_FIXTURE_REFERENCE = re.compile(r"\"((?:handoff|phase1)-[a-z0-9-]+)\"")

MINIMAL_REGISTRY = """\
schema_version: "1.0"
label: illustrative_simulation_fixtures_not_real_vehicle_evidence
fixtures:
  - run_id: unit-nominal
    description: Unit nominal fixture.
    scenario: scenarios/fake_nominal.yaml
    gate_config: config/gates.phase1.yaml
    simulator: fake
    policy: baseline
    shield: noop
    seed: 7
"""


def _registry(repository_root: Path):
    return load_fixture_registry(repository_root / REGISTRY_RELATIVE)


def test_registry_covers_every_fixture_the_test_suite_references(
    repository_root: Path,
) -> None:
    """Any bundle a test reads by name must have a committed regeneration recipe.

    Without this the suite silently reacquires a dependency on unreproducible local state,
    which is the exact defect this registry exists to close.
    """
    referenced: set[str] = set()
    for path in sorted((repository_root / "tests").rglob("*.py")):
        referenced.update(_FIXTURE_REFERENCE.findall(path.read_text(encoding="utf-8")))

    known = set(_registry(repository_root).run_ids)

    assert referenced, "fixture-reference scan found nothing; the guard would be vacuous"
    assert referenced <= known, (
        "these fixtures are read by tests but have no regeneration recipe: "
        f"{sorted(referenced - known)}"
    )


def test_registry_inputs_all_exist(repository_root: Path) -> None:
    for recipe in _registry(repository_root).fixtures:
        for relative in (recipe.scenario, recipe.gate_config, recipe.shield_config):
            if relative is not None:
                assert (repository_root / relative).is_file(), relative


def test_registry_is_satisfied_by_the_current_working_tree(repository_root: Path) -> None:
    """A working tree that can run the suite has every registered fixture present."""
    absent = missing_fixtures(_registry(repository_root), repository_root / "artifacts")

    assert absent == (), (
        f"missing fixtures: {list(absent)}; "
        "run `python -m hermes fixtures regenerate --force` to restore them"
    )


def test_registry_rejects_a_recipe_that_is_both_generated_and_derived() -> None:
    text = MINIMAL_REGISTRY.replace(
        "    seed: 7\n",
        "    seed: 7\n    derived_from: unit-nominal\n    tamper: executed_throttle_downshift\n",
    )

    with pytest.raises(FixtureRegistryError, match="either fully generated"):
        parse_fixture_registry_yaml(text)


def test_registry_rejects_a_derived_fixture_with_an_unknown_source() -> None:
    text = MINIMAL_REGISTRY + (
        "  - run_id: unit-tampered\n"
        "    description: Derived from a fixture that does not exist.\n"
        "    derived_from: unit-absent\n"
        "    tamper: executed_throttle_downshift\n"
    )

    with pytest.raises(FixtureRegistryError, match="derives from unknown fixture"):
        parse_fixture_registry_yaml(text)


def test_registry_rejects_duplicate_run_ids() -> None:
    with pytest.raises(FixtureRegistryError, match="must be unique"):
        parse_fixture_registry_yaml(MINIMAL_REGISTRY + MINIMAL_REGISTRY.split("fixtures:\n")[1])


def test_registry_rejects_a_shield_config_without_the_deterministic_shield() -> None:
    text = MINIMAL_REGISTRY.replace(
        "    shield: noop\n", "    shield: noop\n    shield_config: config/shield.phase3.yaml\n"
    )

    with pytest.raises(FixtureRegistryError, match="requires the deterministic shield"):
        parse_fixture_registry_yaml(text)


def test_excluding_simulator_fixtures_also_excludes_what_derives_from_them(
    repository_root: Path,
) -> None:
    registry = _registry(repository_root)

    offline = select_recipes(registry, include_simulator=False)

    assert offline, "at least the fake-adapter fixtures must remain selectable offline"
    assert not any(recipe.requires_simulator for recipe in offline)
    offline_ids = {recipe.run_id for recipe in offline}
    for recipe in offline:
        if recipe.derived_from is not None:
            assert recipe.derived_from in offline_ids


def test_regeneration_order_places_derived_fixtures_last(repository_root: Path) -> None:
    ordered = select_recipes(_registry(repository_root))

    seen: set[str] = set()
    for recipe in ordered:
        if recipe.derived_from is not None:
            assert recipe.derived_from in seen
        seen.add(recipe.run_id)


@pytest.mark.parametrize(
    "run_id",
    ["handoff-p1-nominal", "handoff-p1-collision", "handoff-p1-conditional", "handoff-p4-fault"],
)
def test_regeneration_reproduces_the_stored_fixture(
    repository_root: Path,
    tmp_path: Path,
    run_id: str,
) -> None:
    """A regenerated fixture must be usable in place of the one it replaces.

    Bundles are not byte-identical across regenerations - the manifest records a creation
    time and the repository commit - so fidelity is asserted where the suite actually
    depends on it: integrity, gate verdict, and the recomputed trace digest.
    """
    registry = _registry(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    bundle = regenerate_fixture(
        registry.by_run_id(run_id),
        registry=registry,
        artifact_root=artifact_root,
        repository_root=repository_root,
    )
    regenerated = verify_artifact(bundle)
    stored = verify_artifact(repository_root / "artifacts" / run_id)

    assert regenerated.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert regenerated.integrity is stored.integrity
    assert regenerated.verdict is stored.verdict
    assert regenerated.trace_digest == stored.trace_digest


def test_regenerated_tampered_fixture_is_invalid_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """The negative fixture must be reproducible, not a hand-edited artifact."""
    registry = _registry(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    for run_id in ("phase1-nominal", "phase1-tampered"):
        bundle = regenerate_fixture(
            registry.by_run_id(run_id),
            registry=registry,
            artifact_root=artifact_root,
            repository_root=repository_root,
        )

    result = verify_artifact(bundle)

    assert result.integrity is IntegrityStatus.INVALID
    assert result.verdict is Verdict.INVALID_EVIDENCE


def test_regeneration_refuses_to_replace_an_existing_fixture_without_force(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    registry = _registry(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    recipe = registry.by_run_id("handoff-p1-nominal")
    regenerate_fixture(
        recipe,
        registry=registry,
        artifact_root=artifact_root,
        repository_root=repository_root,
    )

    with pytest.raises(FixtureRegistryError, match="already exists"):
        regenerate_fixture(
            recipe,
            registry=registry,
            artifact_root=artifact_root,
            repository_root=repository_root,
        )
