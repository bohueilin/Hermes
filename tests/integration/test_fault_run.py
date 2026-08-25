from __future__ import annotations

import json
import shutil
from collections.abc import Callable
from pathlib import Path

import pytest

from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.evidence.artifacts import bundle_digest
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.verification import verify_artifact
from hermes.runtime.orchestrator import (
    RunConfigurationError,
    RunOutcome,
    execute_metadrive_run,
)

DETERMINISTIC_FILES = (
    "execution-context.json",
    "events.jsonl",
    "scenario.resolved.yaml",
    "gate-config.resolved.yaml",
    "metrics.json",
    "findings.json",
    "verdict.json",
    "trace.sha256",
)


def _write_canonical(path: Path, payload: object) -> None:
    path.write_bytes(canonical_json_bytes(payload) + b"\n")


def _refresh_envelope(bundle: Path) -> None:
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for filename in manifest["file_digests"]:
        manifest["file_digests"][filename] = sha256_hex((bundle / filename).read_bytes())
    _write_canonical(manifest_path, manifest)
    payloads = {
        path.name: path.read_bytes()
        for path in bundle.iterdir()
        if path.name != "bundle.sha256"
    }
    (bundle / "bundle.sha256").write_text(
        bundle_digest(payloads) + "\n",
        encoding="ascii",
    )


def _rehash_events(bundle: Path, events: list[dict[str, object]]) -> None:
    previous = "0" * 64
    for event in events:
        event["previous_hash"] = previous
        material = dict(event)
        material.pop("current_hash", None)
        event["current_hash"] = sha256_hex(canonical_json_bytes(material))
        previous = str(event["current_hash"])
    (bundle / "events.jsonl").write_bytes(
        b"".join(canonical_json_bytes(event) + b"\n" for event in events)
    )
    (bundle / "trace.sha256").write_text(previous + "\n", encoding="ascii")
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["trace_digest"] = previous
    _write_canonical(manifest_path, manifest)
    _refresh_envelope(bundle)


def _fault_run(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    *,
    run_id: str,
    scenario_path: Path | None = None,
) -> RunOutcome:
    return fake_artifact_factory(
        scenario_path=scenario_path
        or repository_root / "scenarios" / "fake_fault_injection.yaml",
        run_id=run_id,
    )


def test_fault_run_publishes_schema_v2_with_distinct_action_and_fault_provenance(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
) -> None:
    outcome = _fault_run(
        fake_artifact_factory,
        repository_root,
        run_id="fault-evidence",
    )
    bundle = outcome.artifact_path
    verification = verify_artifact(bundle)
    manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
    context = json.loads(
        (bundle / "execution-context.json").read_text(encoding="utf-8")
    )
    metrics = json.loads((bundle / "metrics.json").read_text(encoding="utf-8"))
    findings = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    events = [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]

    assert outcome.verdict is Verdict.HOLD
    assert verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert verification.verdict is Verdict.HOLD
    assert manifest["evidence_schema_version"] == "2.0"
    assert context["evidence_schema_version"] == "2.0"
    assert context["run_context"]["evidence_schema_version"] == "2.0"
    assert metrics["evidence_schema_version"] == "2.0"
    assert findings["evidence_schema_version"] == "2.0"
    assert manifest["fault_name"] == "deterministic-faults"
    assert len(manifest["fault_config_digest"]) == 64
    assert all(event["evidence_schema_version"] == "2.0" for event in events)
    assert all(
        event["run_context"]["evidence_schema_version"] == "2.0"
        for event in events
    )
    assert events[0]["candidate_action"] == events[0]["permitted_action"]
    assert events[0]["executed_action"] != events[0]["permitted_action"]
    assert events[0]["control_fault_evidence"]["applied_faults"] == [
        "CONTROL_DELAY_FILL"
    ]
    assert events[1]["candidate_action"] == events[1]["permitted_action"]
    assert events[1]["executed_action"] != events[1]["permitted_action"]
    assert metrics["shield_override_count"] == 0
    assert metrics["control_fill_count"] == 1
    assert metrics["fault_application_counts"]["OBSERVATION_DROPOUT_HOLD_LAST"] == 1
    coverage = next(
        item for item in findings["findings"] if item["finding_id"] == "fault.coverage.required"
    )
    assert coverage["status"] == "PASS"


def test_fault_run_deterministic_companion_files_are_byte_identical(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
) -> None:
    first = _fault_run(fake_artifact_factory, repository_root, run_id="fault-repeat-one")
    second = _fault_run(fake_artifact_factory, repository_root, run_id="fault-repeat-two")

    for filename in DETERMINISTIC_FILES:
        assert (first.artifact_path / filename).read_bytes() == (
            second.artifact_path / filename
        ).read_bytes()


def test_early_terminal_fault_run_holds_when_configured_faults_are_unexercised(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    scenario_path = tmp_path / "early-terminal-fault.yaml"
    scenario_path.write_text(
        (repository_root / "scenarios" / "fake_fault_injection.yaml")
        .read_text(encoding="utf-8")
        .replace("name: fake_fault_injection", "name: early_terminal_fault")
        .replace("hazards: {}", "hazards:\n  collision_at_step: 1"),
        encoding="utf-8",
    )

    outcome = _fault_run(
        fake_artifact_factory,
        repository_root,
        run_id="fault-early-terminal",
        scenario_path=scenario_path,
    )
    findings = json.loads(
        (outcome.artifact_path / "findings.json").read_text(encoding="utf-8")
    )["findings"]
    coverage = next(item for item in findings if item["finding_id"] == "fault.coverage.required")

    assert outcome.verdict is Verdict.HOLD
    assert coverage["status"] == "NOT_AVAILABLE"
    assert "not exercised" in coverage["message"]
    assert verify_artifact(outcome.artifact_path).integrity is IntegrityStatus.INTERNALLY_CONSISTENT


def test_fault_coverage_requires_every_scheduled_step_not_only_reason_membership(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    scenario_path = tmp_path / "partial-dropout-schedule.yaml"
    scenario_path.write_text(
        """\
schema_version: "3.0"
name: partial_dropout_schedule
version: "1.0"
description: Early destination after one of two scheduled observation dropouts.
adapter: fake
control:
  frequency_hz: 10
  horizon_steps: 20
  target_speed_mps: 0.0
initial_state:
  speed_mps: 8.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 1.0
  boundary_tolerance_m: 1.5
hazards: {}
faults:
  schema_version: "1.0"
  name: partial_dropout_faults
  version: "1.0"
  label: illustrative_simulation_faults_not_real_vehicle_limits
  dropped_observation_steps:
    - 1
    - 10
""",
        encoding="utf-8",
    )

    outcome = _fault_run(
        fake_artifact_factory,
        repository_root,
        run_id="fault-partial-schedule",
        scenario_path=scenario_path,
    )
    findings = json.loads(
        (outcome.artifact_path / "findings.json").read_text(encoding="utf-8")
    )["findings"]
    coverage = next(item for item in findings if item["finding_id"] == "fault.coverage.required")

    assert outcome.verdict is Verdict.HOLD
    assert coverage["status"] == "NOT_AVAILABLE"
    assert "OBSERVATION_DROPOUT_HOLD_LAST@10" in coverage["message"]


def test_metadrive_observation_fault_profile_is_rejected_before_adapter_construction(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    scenario_path = tmp_path / "unsupported-metadrive-observation-fault.yaml"
    scenario_path.write_text(
        (repository_root / "scenarios" / "fake_fault_injection.yaml")
        .read_text(encoding="utf-8")
        .replace("name: fake_fault_injection", "name: unsupported_metadrive_fault")
        .replace("adapter: fake", "adapter: metadrive"),
        encoding="utf-8",
    )

    def adapter_factory():
        raise AssertionError("adapter must not be constructed")

    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    with pytest.raises(RunConfigurationError, match="would not truthfully affect"):
        execute_metadrive_run(
            scenario_path=scenario_path,
            gate_config_path=repository_root / "config" / "gates.phase2.yaml",
            seed=7,
            run_id="unsupported-metadrive-fault",
            artifact_root=artifact_root,
            repository_root=repository_root,
            adapter_factory=adapter_factory,
        )


@pytest.mark.parametrize("mutation", ["action", "source", "reason", "permitted-chain"])
def test_exact_offline_fault_replay_rejects_coherently_rehashed_tampering(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
    mutation: str,
) -> None:
    source = _fault_run(fake_artifact_factory, repository_root, run_id=f"fault-source-{mutation}")
    tampered = tmp_path / f"fault-tampered-{mutation}"
    shutil.copytree(source.artifact_path, tampered)
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    if mutation == "action":
        events[1]["executed_action"] = {
            "steering": 0.0,
            "throttle": 0.0,
            "brake": 0.0,
        }
    elif mutation == "source":
        control = events[1]["control_fault_evidence"]
        control["executed_from_sequence"] = 1
        control["executed_from_candidate_time_s"] = 0.1
        control["control_latency_ms"] = {
            "availability": "AVAILABLE",
            "value": 0.0,
            "unit": "ms",
            "reason": None,
        }
    elif mutation == "reason":
        events[0]["observation_fault_evidence"]["applied_faults"].remove(
            "OBSERVATION_NOISE"
        )
    else:
        neutral = {"steering": 0.0, "throttle": 0.0, "brake": 0.0}
        events[0]["candidate_action"] = neutral
        events[0]["permitted_action"] = neutral
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "stored deterministic fault decision mismatch" in " ".join(result.errors)


def test_fault_artifact_verification_never_calls_adapter_or_simulator(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle = _fault_run(
        fake_artifact_factory,
        repository_root,
        run_id="fault-offline-only",
    ).artifact_path

    def bomb(*args, **kwargs):
        del args, kwargs
        raise AssertionError("stored verification attempted simulator execution")

    monkeypatch.setattr(FakeSimulatorAdapter, "reset", bomb)
    monkeypatch.setattr(FakeSimulatorAdapter, "step", bomb)

    assert verify_artifact(bundle).integrity is IntegrityStatus.INTERNALLY_CONSISTENT


def test_mixed_schema_trace_returns_invalid_evidence_instead_of_raising(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _fault_run(fake_artifact_factory, repository_root, run_id="fault-mixed-source")
    tampered = tmp_path / "fault-mixed-schema"
    shutil.copytree(source.artifact_path, tampered)
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    mixed = events[1]
    mixed["evidence_schema_version"] = "1.0"
    mixed["run_context"]["evidence_schema_version"] = "1.0"
    for field_name in ("fault_name", "fault_version", "fault_config_digest"):
        mixed["run_context"].pop(field_name)
    for field_name in (
        "permitted_action",
        "observation_fault_evidence",
        "control_fault_evidence",
        "result_observation",
    ):
        mixed.pop(field_name)
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    errors = " ".join(result.errors)
    assert "sequence 1" in errors
    assert "mixed evidence_schema_version" in errors


def test_result_observation_sequence_time_and_freshness_are_bound_by_trace_verification(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _fault_run(fake_artifact_factory, repository_root, run_id="fault-result-source")
    tampered = tmp_path / "fault-result-observation"
    shutil.copytree(source.artifact_path, tampered)
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    result_observation = events[-1]["result_observation"]
    result_observation["sequence"] = 999
    result_observation["simulation_time_s"] = 999.0
    result_observation["observation_age_s"] = 1.0
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "fault result observation timing disagrees" in " ".join(result.errors)


def test_initial_raw_observation_freshness_is_bound_by_trace_verification(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _fault_run(fake_artifact_factory, repository_root, run_id="fault-raw-age-source")
    tampered = tmp_path / "fault-raw-observation-age"
    shutil.copytree(source.artifact_path, tampered)
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    events[0]["observation_fault_evidence"]["raw_observation"][
        "observation_age_s"
    ] = 1.0
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "fault raw observation must be fresh" in " ".join(result.errors)


def test_rehashed_delivered_observation_must_match_its_declared_raw_source(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _fault_run(
        fake_artifact_factory,
        repository_root,
        run_id="fault-delivered-source-binding",
    )
    tampered = tmp_path / "fault-delivered-source-tamper"
    shutil.copytree(source.artifact_path, tampered)
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    events[1]["observation_fault_evidence"]["delivered_observation"][
        "vehicle_state"
    ]["position_m"] = 999.0
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "fault delivered observation is not derived from declared raw source" in " ".join(
        result.errors
    )


def test_rehashed_delivery_source_time_must_match_the_declared_raw_packet(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _fault_run(
        fake_artifact_factory,
        repository_root,
        run_id="fault-delivered-source-time",
    )
    tampered = tmp_path / "fault-delivered-source-time-tamper"
    shutil.copytree(source.artifact_path, tampered)
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    evidence = events[1]["observation_fault_evidence"]
    evidence["delivered_from_time_s"] = 0.05
    evidence["delivered_observation"]["observation_age_s"] = 0.05
    events[1]["observation_summary"]["observation_age_s"] = 0.05
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "fault observation source time disagrees" in " ".join(result.errors)
