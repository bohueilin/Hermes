"""End-to-end schema-4.0 runs against the real simulator.

Every other test in this repository is simulator-free: `tests/integration/test_metadrive_run.py`
drives the adapter through a hand-written environment double. That leaves the real
MetaDrive path with no coverage at all, which is where Phase 8's ADAS work lives.

These tests carry the `metadrive` marker declared in ``pyproject.toml`` — previously
declared but applied to nothing — so `pytest -m "not metadrive"`, the selection CI runs,
still skips them on machines without a vendored simulator.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from hermes.domain.enums import IntegrityStatus, Verdict

pytestmark = pytest.mark.metadrive


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _schema_4_lead_brake(repository_root: Path, tmp_path: Path) -> Path:
    """A schema-4.0 copy of the committed lead-brake scenario."""
    source = repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
    text = source.read_text(encoding="utf-8")
    text = text.replace('schema_version: "2.0"', 'schema_version: "4.0"')
    text = text.replace("name: lead_vehicle_hard_brake", "name: adas_v4_lead_hard_brake")
    text += "tags:\n  - aeb\n  - longitudinal\n"
    destination = tmp_path / "adas_v4_lead_hard_brake.yaml"
    destination.write_text(text, encoding="utf-8")
    return destination


def test_schema_4_challenge_scenario_publishes_verified_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """A schema-4.0 challenge scenario must produce a self-verified bundle.

    This is the combination that failed before the trace-layer version gates were widened:
    the adapter emits challenge observation fields, and the exact-equality field-set check
    rejected them for any scenario version other than 2.0.
    """
    _requires_metadrive(repository_root)
    from hermes.evidence.verification import verify_artifact
    from hermes.runtime.orchestrator import execute_metadrive_run

    scenario_path = _schema_4_lead_brake(repository_root, tmp_path)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    outcome = execute_metadrive_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.phase2.yaml",
        seed=7,
        run_id="adas-v4-lead-brake",
        artifact_root=artifact_root,
        repository_root=repository_root,
    )
    result = verify_artifact(artifact_root / "adas-v4-lead-brake")

    assert outcome.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert result.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert result.verdict is not Verdict.INVALID_EVIDENCE


def test_schema_4_run_is_bitwise_repeatable(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """N = 2 repeats of the determinism contract, on the real simulator.

    The full contract is N = 3 identical repeats; two are run here because each is a real
    physics episode. Cross-platform identity is an explicit non-goal, so this asserts
    same-host reproducibility only.
    """
    _requires_metadrive(repository_root)
    from hermes.runtime.orchestrator import execute_metadrive_run

    scenario_path = _schema_4_lead_brake(repository_root, tmp_path)
    digests: list[str] = []
    for index in range(2):
        artifact_root = tmp_path / f"repeat-{index}"
        artifact_root.mkdir()
        outcome = execute_metadrive_run(
            scenario_path=scenario_path,
            gate_config_path=repository_root / "config" / "gates.phase2.yaml",
            seed=7,
            run_id="adas-v4-repeat",
            artifact_root=artifact_root,
            repository_root=repository_root,
        )
        digests.append(outcome.verification.trace_digest)
        events = (artifact_root / "adas-v4-repeat" / "events.jsonl").read_bytes()
        (tmp_path / f"events-{index}.jsonl").write_bytes(events)

    assert digests[0] == digests[1]
    assert (tmp_path / "events-0.jsonl").read_bytes() == (
        tmp_path / "events-1.jsonl"
    ).read_bytes()
    shutil.rmtree(tmp_path / "repeat-0")


def test_schema_4_scenario_can_spawn_the_ego_already_moving(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """ADAS threat scenarios need a moving start.

    Below schema 4.0 the adapter refuses any nonzero ``initial_state.speed_mps``, so an AEB
    case at 20 m/s would spend most of its horizon accelerating from rest. Schema 4.0 sets
    MetaDrive's car-frame spawn velocity instead; the adapter's own reset validation - which
    compares the observed speed to the scenario at 1e-9 - is what proves it took effect.
    """
    _requires_metadrive(repository_root)
    from hermes.evidence.verification import verify_artifact
    from hermes.runtime.orchestrator import execute_metadrive_run

    scenario_path = _schema_4_lead_brake(repository_root, tmp_path)
    text = scenario_path.read_text(encoding="utf-8").replace(
        "  speed_mps: 0.0", "  speed_mps: 20.0"
    )
    scenario_path.write_text(text, encoding="utf-8")
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    execute_metadrive_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.phase2.yaml",
        seed=7,
        run_id="adas-v4-moving-start",
        artifact_root=artifact_root,
        repository_root=repository_root,
    )
    bundle = artifact_root / "adas-v4-moving-start"
    result = verify_artifact(bundle)
    import json

    context = json.loads((bundle / "execution-context.json").read_text(encoding="utf-8"))
    vehicle_config = context["adapter"]["config"]["metadrive_config"]["vehicle_config"]

    assert result.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert vehicle_config["spawn_velocity"] == [20.0, 0.0]
    assert vehicle_config["spawn_velocity_car_frame"] is True


def test_stationary_schema_4_scenario_keeps_the_pre_v4_adapter_configuration(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """A stationary 4.0 scenario must not acquire spawn-velocity keys.

    Keeping the configuration identical to its schema-2.0 equivalent keeps
    ``adapter_config_digest`` stable across a schema migration, which the fail-closed
    comparison compatibility check depends on.
    """
    _requires_metadrive(repository_root)
    from hermes.runtime.orchestrator import execute_metadrive_run

    scenario_path = _schema_4_lead_brake(repository_root, tmp_path)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    execute_metadrive_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.phase2.yaml",
        seed=7,
        run_id="adas-v4-stationary",
        artifact_root=artifact_root,
        repository_root=repository_root,
    )
    import json

    context = json.loads(
        (artifact_root / "adas-v4-stationary" / "execution-context.json").read_text(
            encoding="utf-8"
        )
    )
    vehicle_config = context["adapter"]["config"]["metadrive_config"]["vehicle_config"]

    assert "spawn_velocity" not in vehicle_config
    assert "spawn_velocity_car_frame" not in vehicle_config


@pytest.mark.parametrize(
    ("scenario_name", "expect_braking"),
    [("aeb_lead_hard_brake", True), ("adas_nominal_no_lead", False)],
)
def test_committed_adas_scenarios_pass_every_hard_adas_finding(
    repository_root: Path,
    tmp_path: Path,
    scenario_name: str,
    expect_braking: bool,
) -> None:
    """The P0 pair: a threat that must be braked, and nominal exposure that must not be.

    A suite made only of threat scenarios rewards a controller for braking and nothing else,
    so an over-braking candidate looks perfect. The nominal case is what makes the
    false-intervention invariant able to fail.
    """
    _requires_metadrive(repository_root)
    import json

    from hermes.domain.enums import FindingStatus
    from hermes.runtime.orchestrator import execute_metadrive_run

    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    run_id = f"adas-{scenario_name.replace('_', '-')}"

    execute_metadrive_run(
        scenario_path=repository_root / "scenarios" / "adas" / f"{scenario_name}.yaml",
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: _adas_policy(),
    )
    bundle = artifact_root / run_id
    findings = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    items = findings["findings"] if isinstance(findings, dict) else findings
    adas = {item["finding_id"]: item for item in items if item["finding_id"].startswith("adas")}
    events = [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    braking_steps = [event for event in events if event["executed_action"]["brake"] > 0.0]

    assert len(adas) == 4
    for finding_id, item in adas.items():
        if item["hard_invariant"]:
            assert item["status"] == FindingStatus.PASS.value, finding_id
    assert bool(braking_steps) is expect_braking
    assert max(event["vehicle_state"]["collision_count"] for event in events) == 0


def _adas_policy():
    from hermes.adas.policy import AdasLongitudinalPolicy

    return AdasLongitudinalPolicy()
