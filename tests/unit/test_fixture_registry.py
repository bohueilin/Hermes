"""The evidence fixtures the suite depends on must be reproducible from committed inputs."""

from __future__ import annotations

import hashlib
import json
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
_REGISTRY_SHA256 = "b65bf23690a4aeaefc170905b0d196be937203fe3266a69059fea0123855a19b"
_BUNDLE_FILE_INVENTORY = (
    "bundle.sha256",
    "events.jsonl",
    "execution-context.json",
    "findings.json",
    "gate-config.resolved.yaml",
    "manifest.json",
    "metrics.json",
    "scenario.resolved.yaml",
    "trace.sha256",
    "verdict.json",
)
_REGISTERED_FIXTURE_IDENTITIES = {
    "phase1-nominal": (
        "1.0",
        "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e",
        "6660b3903cc1c05e7c329f6339af61e0ed0dd1aff926e7574e92246975a05081",
        "50e5cf7a1a82dc9e3a2f5b2a2185093faac99884a54ba02c98a2f60e92941daa",
    ),
    "handoff-p1-nominal": (
        "1.0",
        "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e",
        "2ec51e4ca3b476565550a919e17a5dfbbafada609ac24226529a4e96cca9652b",
        "50e5cf7a1a82dc9e3a2f5b2a2185093faac99884a54ba02c98a2f60e92941daa",
    ),
    "handoff-p1-collision": (
        "1.0",
        "ecaa3b9222612044349b643c44406c2088cfb335b07f7bf4da56ac587bb76a24",
        "b37ac5439a371b63aa65053e80264d8fb9bc5d6e5bb10865c90db495d080399b",
        "d5d1e12d737a92a99d43a02105ed9b9f96197007dd76a35f39cb470fffd5366e",
    ),
    "handoff-p1-boundary": (
        "1.0",
        "19cdf5e895c06d5bee9a250a9c236039543a1b17d503bd9a31547f9ec101e694",
        "23e6c4dedca83bb9d5f52fcb1a36bfbe297cc0813f85a1541852c2b73bafd0db",
        "a7db9f6458445c9489384fcfe8f2fc09b4aed314c5cb9138a231bd9a9f46e0e0",
    ),
    "handoff-p1-conditional": (
        "1.0",
        "dfd8cc47423f8b93e70da1f5bcac00d21f363aec4a435da8ca9518b111704158",
        "68e34d7a0b3ff6e261c15a5afd068b44f368eba5357b1a0665f605855a3e3a25",
        "d01b5e6bf2b29afafbb28d93d2866fcad962a65739470bf2d0f8e3dd246a55e2",
    ),
    "handoff-phase5-demo": (
        "1.0",
        "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e",
        "62720d9a554311023ec1affa4a1313672ee0001fd919bed1db3bc9675ba4eaa0",
        "50e5cf7a1a82dc9e3a2f5b2a2185093faac99884a54ba02c98a2f60e92941daa",
    ),
    "handoff-p4-fault": (
        "2.0",
        "c365813d9ebda590299830a68d1683e3d8f413bc7b4b43da13ea77c5678552af",
        "a430af8eeb7e4bffefd8256027f3b2e3736bd7420b071d3cf2637881df9c51ee",
        "335e76905dd53cf3ed53092295f304c8bee7a6196be6dfbdcfb87f4247bfadfc",
    ),
    "handoff-p2-metadrive": (
        "1.0",
        "2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987",
        "bc3e89f71dc44e9f18dbb322189de804a53b92843aca238224f75bd22a249a0f",
        "d13cc59dc2ddcdd49846b3b30d3d7dedc00f23a4d7b4ca8887c1b1361f77e71f",
    ),
    "handoff-p3-lead-baseline": (
        "1.0",
        "504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1",
        "456f689572f312135aee6bbb812a90f742d37d79bd73c36838f792a946505fbc",
        "84e09054edc131ff0c3da62c1dcebd020b9bbf5180a064b19ee5fbeccff0bb6f",
    ),
    "handoff-p3-lead-shielded": (
        "1.0",
        "7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380",
        "86c006b57f0213ad5660f7cd3bceec88400f3727662e101dd7e245b203348477",
        "ed15ea7e7bc46ec3ea3611e41c44add6a31641cb27ee777e3e31e8f5dd310cf6",
    ),
    "handoff-p3-cutin-baseline": (
        "1.0",
        "00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5",
        "ac64afc20ee5c602da8b71a85553a197ffdf937bbc130b0a7c8dd07b96489428",
        "89520fd75720a1199724a5da9bc25823d3079674e2a571a810ea23f0312b2b64",
    ),
    "handoff-p3-cutin-shielded": (
        "1.0",
        "7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae",
        "e5129be2b0fd789ea2e724637965b39903cb75a6b7b2551d4c8fc3915b71d7cf",
        "ffb2eaea8a272241fc1e5f15f1bab0a42725ce962d2c33dd985269651f031e88",
    ),
    "phase1-tampered": (
        "1.0",
        "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e",
        "6660b3903cc1c05e7c329f6339af61e0ed0dd1aff926e7574e92246975a05081",
        "357d4e978c28ca79ab7da4cf6440408d59ed938677f8b71e089fbace7cc253bc",
    ),
}

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


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def test_registered_fixture_recipe_and_stored_identities_are_immutable(
    repository_root: Path,
) -> None:
    registry_path = repository_root / REGISTRY_RELATIVE
    registry = _registry(repository_root)

    assert _sha256(registry_path.read_bytes()) == _REGISTRY_SHA256
    assert registry.run_ids == tuple(_REGISTERED_FIXTURE_IDENTITIES)
    for run_id, expected in _REGISTERED_FIXTURE_IDENTITIES.items():
        bundle = repository_root / "artifacts" / run_id
        manifest = json.loads((bundle / "manifest.json").read_bytes())
        actual = (
            manifest["evidence_schema_version"],
            manifest["trace_digest"],
            (bundle / "bundle.sha256").read_text(encoding="ascii").strip(),
            _sha256((bundle / "events.jsonl").read_bytes()),
        )

        assert actual == expected, run_id
        assert tuple(sorted(path.name for path in bundle.iterdir())) == _BUNDLE_FILE_INVENTORY


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
