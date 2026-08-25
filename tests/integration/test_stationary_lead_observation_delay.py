"""Causal evidence for the committed stationary-lead observation-delay environment defect."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from hermes.domain.enums import FindingStatus, IntegrityStatus
from hermes.domain.models import HazardConfig
from hermes.evidence.artifacts import bundle_digest, config_digest
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.gates.release import VerifierProfile, select_verifier_profile
from hermes.scenarios.loader import load_scenario, resolved_scenario_yaml

SCENARIO = (
    Path("scenarios") / "adas" / "aeb_stationary_lead_observation_delay.yaml"
)


def test_committed_delay_scenario_selects_combined_adas_fault_profile(
    repository_root: Path,
) -> None:
    scenario_path = repository_root / SCENARIO
    assert scenario_path.is_file(), "the committed delayed stationary-lead scenario is absent"

    scenario = load_scenario(scenario_path)

    assert scenario.schema_version == "4.0"
    assert scenario.name == "aeb_stationary_lead_observation_delay"
    assert scenario.adapter == "metadrive"
    assert scenario.challenge is not None
    assert scenario.challenge.kind == "stationary_lead"
    assert scenario.challenge.initial_gap_m == 100.0
    assert scenario.initial_state.speed_mps == 20.0
    assert scenario.control.frequency_hz == 10
    assert scenario.control.horizon_steps == 40
    assert scenario.control.max_braking_mps2 == 12.982444763183452
    assert scenario.faults is not None
    assert scenario.faults.observation_delay_steps == 6
    assert (
        select_verifier_profile(scenario)
        is VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT
    )


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _findings(bundle: Path) -> dict[str, dict]:
    document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    return {item["finding_id"]: item for item in document["findings"]}


def _events(bundle: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]


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
        bundle_digest(payloads) + "\n", encoding="ascii"
    )


def _rewrite_policy_stale_threshold(bundle: Path, threshold_s: float) -> None:
    context_path = bundle / "execution-context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))
    context["policy"]["config"]["aeb"]["stale_observation_s"] = threshold_s
    policy_digest = config_digest(context["policy"]["config"])
    context["policy"]["config_digest"] = policy_digest
    context["run_context"]["policy_config_digest"] = policy_digest
    _write_canonical(context_path, context)

    events = _events(bundle)
    previous = "0" * 64
    for event in events:
        event["run_context"]["policy_config_digest"] = policy_digest
        event["previous_hash"] = previous
        material = dict(event)
        material.pop("current_hash", None)
        event["current_hash"] = sha256_hex(canonical_json_bytes(material))
        previous = event["current_hash"]
    (bundle / "events.jsonl").write_bytes(
        b"".join(canonical_json_bytes(event) + b"\n" for event in events)
    )
    (bundle / "trace.sha256").write_text(previous + "\n", encoding="ascii")

    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["policy_config_digest"] = policy_digest
    manifest["trace_digest"] = previous
    _write_canonical(manifest_path, manifest)
    _refresh_envelope(bundle)


def _run_real_adas(
    repository_root: Path,
    artifact_root: Path,
    run_id: str,
    scenario_path: Path,
) -> Path:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    config = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
    return execute_metadrive_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(config),
    ).artifact_path


def _timely_control_path(repository_root: Path, tmp_path: Path) -> Path:
    delayed = load_scenario(repository_root / SCENARIO)
    control = delayed.model_copy(update={"faults": None})
    path = tmp_path / "stationary-lead-timely-control.yaml"
    path.write_text(resolved_scenario_yaml(control), encoding="utf-8")
    return path


def test_non_adas_schema_two_run_does_not_expose_an_adas_threshold(
    repository_root: Path,
) -> None:
    from hermes.agents import ToolContext
    from hermes.agents.tools import query_run

    result = query_run(
        ToolContext(
            repository_root=repository_root,
            artifact_root=repository_root / "artifacts",
        ),
        run_id="handoff-p4-fault",
    )

    assert result.ok
    assert result.data["integrity"] == "INTERNALLY_CONSISTENT"
    assert result.data["policy_name"] == "baseline"
    assert "aeb_stale_observation_s" not in result.data
    assert all(
        citation.artifact_file != "execution-context.json"
        for citation in result.citations
    )


@pytest.mark.metadrive
def test_timely_to_delayed_pair_has_the_named_causal_degradation(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "causal-artifacts"
    artifact_root.mkdir()
    timely = _run_real_adas(
        repository_root,
        artifact_root,
        "stationary-timely",
        _timely_control_path(repository_root, tmp_path),
    )
    delayed = _run_real_adas(
        repository_root,
        artifact_root,
        "stationary-delayed",
        repository_root / SCENARIO,
    )

    timely_findings = _findings(timely)
    delayed_findings = _findings(delayed)
    timely_events = _events(timely)
    delayed_events = _events(delayed)

    assert any(event["executed_action"]["brake"] > 0.0 for event in timely_events)
    assert (
        timely_findings["adas.aeb.threat_response"]["status"]
        == FindingStatus.PASS.value
    )
    assert all(event["executed_action"]["brake"] == 0.0 for event in delayed_events)
    assert (
        delayed_findings["adas.aeb.threat_response"]["status"]
        == FindingStatus.FAIL.value
    )
    assert delayed_findings["fault.coverage.required"]["status"] == "PASS"
    assert any(
        "OBSERVATION_DELAY"
        in event["observation_fault_evidence"]["applied_faults"]
        for event in delayed_events[6:]
    )
    assert all(event["vehicle_state"]["collision_count"] == 0 for event in timely_events)
    assert all(event["vehicle_state"]["collision_count"] == 0 for event in delayed_events)

    from hermes.evidence.verification import verify_artifact

    assert verify_artifact(timely).integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert verify_artifact(delayed).integrity is IntegrityStatus.INTERNALLY_CONSISTENT


@pytest.mark.metadrive
def test_delayed_source_provenance_offline_replay_and_review_tracks(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "provenance-artifacts"
    artifact_root.mkdir()
    bundle = _run_real_adas(
        repository_root,
        artifact_root,
        "stationary-delay-provenance",
        repository_root / SCENARIO,
    )
    events = _events(bundle)

    warmup = events[5]["observation_fault_evidence"]
    steady = events[6]["observation_fault_evidence"]
    assert warmup["raw_observation"]["sequence"] == 5
    assert warmup["raw_observation"]["simulation_time_s"] == 0.5
    assert warmup["delivered_from_sequence"] == 0
    assert warmup["delivered_from_time_s"] == 0.0
    assert warmup["delivery_time_s"] == 0.5
    assert warmup["delivered_observation"]["observation_age_s"] == 0.5
    assert "OBSERVATION_DELAY_WARMUP" in warmup["applied_faults"]

    assert steady["raw_observation"] == events[5]["result_observation"]
    assert steady["raw_observation"]["sequence"] == 6
    assert steady["raw_observation"]["simulation_time_s"] == pytest.approx(0.6)
    assert steady["delivered_from_sequence"] == 0
    assert steady["delivered_from_time_s"] == 0.0
    assert steady["delivery_time_s"] == pytest.approx(0.6)
    assert steady["delivered_observation"]["observation_age_s"] == pytest.approx(0.6)
    assert steady["applied_faults"] == ["OBSERVATION_DELAY"]

    def forbid_execution(*args, **kwargs):
        del args, kwargs
        raise AssertionError("offline verification attempted simulator or policy execution")

    from hermes.adapters.metadrive import MetaDriveAdapter
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.agents import ToolContext
    from hermes.agents.tools import query_run
    from hermes.evidence.verification import verify_artifact
    from hermes.review.facade import review_artifact

    monkeypatch.setattr(MetaDriveAdapter, "reset", forbid_execution)
    monkeypatch.setattr(MetaDriveAdapter, "step", forbid_execution)
    monkeypatch.setattr(AdasLongitudinalPolicy, "reset", forbid_execution)
    monkeypatch.setattr(AdasLongitudinalPolicy, "act", forbid_execution)

    replay = verify_artifact(bundle)
    envelope = review_artifact(artifact_root, "stationary-delay-provenance")
    identity = query_run(
        ToolContext(repository_root=repository_root, artifact_root=artifact_root),
        run_id="stationary-delay-provenance",
    )
    stored_verdict = json.loads((bundle / "verdict.json").read_text(encoding="utf-8"))
    assert replay.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert replay.errors == ()
    assert replay.verdict.value == stored_verdict["verdict"]
    assert replay.supporting_finding_ids == tuple(
        stored_verdict["supporting_finding_ids"]
    )
    assert identity.data["aeb_stale_observation_s"] == 0.5
    assert "policy_config" not in identity.data
    assert any(
        citation.artifact_file == "execution-context.json"
        and citation.locator == "/policy/config/aeb/stale_observation_s"
        and citation.quoted_value == 0.5
        for citation in identity.citations
    )
    assert envelope.evidence_sufficiency.profile_name == "adas_p0_longitudinal_fault"
    tracks = {track.track_id: track for track in envelope.timeline.tracks}
    for track_id in (
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "observation_fault_reasons",
    ):
        assert tracks[track_id].availability == "AVAILABLE"
        assert len(tracks[track_id].points) == len(events)
    assert tracks["raw_observation"].points[6].observation_value is not None
    assert tracks["delivered_observation"].points[6].observation_value is not None
    assert tracks["result_observation"].points[6].observation_value is not None
    assert (
        tracks["observation_fault_reasons"].points[6].string_list_value.values
        == ("OBSERVATION_DELAY",)
    )


@pytest.mark.metadrive
def test_query_run_omits_a_schema_two_adas_threshold_that_is_out_of_bounds(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "invalid-threshold-artifacts"
    artifact_root.mkdir()
    bundle = _run_real_adas(
        repository_root,
        artifact_root,
        "invalid-stored-threshold",
        repository_root / SCENARIO,
    )
    _rewrite_policy_stale_threshold(bundle, 6.0)

    from hermes.agents import ToolContext
    from hermes.agents.tools import query_run
    from hermes.evidence.verification import verify_artifact

    verification = verify_artifact(bundle)
    assert verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT

    result = query_run(
        ToolContext(repository_root=repository_root, artifact_root=artifact_root),
        run_id="invalid-stored-threshold",
    )

    assert result.ok
    assert "aeb_stale_observation_s" not in result.data
    assert all(
        citation.artifact_file != "execution-context.json"
        for citation in result.citations
    )


def test_coverage_is_not_pass_before_any_real_delay_event(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_fake_run

    source = load_scenario(repository_root / SCENARIO)
    bounded = source.model_copy(
        update={
            "name": "bounded_observation_delay_probe",
            "description": "Synthetic early termination before real delay coverage.",
            "adapter": "fake",
            "challenge": None,
            "hazards": HazardConfig(collision_at_step=1),
        }
    )
    scenario_path = tmp_path / "bounded-delay.yaml"
    scenario_path.write_text(resolved_scenario_yaml(bounded), encoding="utf-8")
    artifact_root = tmp_path / "bounded-artifacts"
    artifact_root.mkdir()
    config = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
    bundle = execute_fake_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id="bounded-delay",
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda: AdasLongitudinalPolicy(config),
    ).artifact_path

    coverage = _findings(bundle)["fault.coverage.required"]
    events = _events(bundle)

    assert coverage["status"] == FindingStatus.NOT_AVAILABLE.value
    assert all(
        "OBSERVATION_DELAY" not in event["observation_fault_evidence"]["applied_faults"]
        for event in events
    )
