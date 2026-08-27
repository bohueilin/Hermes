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


def _rewrite_policy_config(bundle: Path, mutation: str) -> None:
    context_path = bundle / "execution-context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))
    policy_config = context["policy"]["config"]
    if mutation == "out-of-bounds-threshold":
        policy_config["aeb"]["stale_observation_s"] = 6.0
    elif mutation == "unknown-extra-key":
        policy_config["unrecognized_controller_surface"] = "must-not-be-projected-away"
    elif mutation == "omitted-driver":
        del policy_config["driver"]
    elif mutation == "omitted-driver-tunable":
        del policy_config["driver"]["speed_deadband_mps"]
    else:
        raise AssertionError(f"unsupported test mutation: {mutation}")
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
    policy_config_path: Path | None = None,
) -> Path:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    config = load_adas_config(
        policy_config_path
        or repository_root / "config" / "adas" / "baseline.yaml"
    )
    return execute_metadrive_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(config),
    ).artifact_path


def _pin_test_producer_to_legacy_adas_v2(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keep the historical schema-2 consumer-defense probes on their source schema."""
    import hermes.runtime.orchestrator as orchestrator

    original = orchestrator._evidence_schema_for_verifier_profile

    def legacy_adas_v2(profile: object) -> str:
        if profile is VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT:
            return "2.0"
        return original(profile)

    monkeypatch.setattr(
        orchestrator,
        "_evidence_schema_for_verifier_profile",
        legacy_adas_v2,
    )


def _assert_exact_v2_bundle(bundle: Path) -> None:
    from hermes.domain.models import (
        ArtifactManifestV2,
        ExecutionContextV2,
        FindingsDocumentV2,
        RunContextV2,
        RunMetricsV2,
        TraceEventV2,
    )
    from hermes.evidence.verification import inspect_artifact

    snapshot = inspect_artifact(bundle).snapshot
    assert snapshot is not None
    assert type(snapshot.manifest) is ArtifactManifestV2
    assert type(snapshot.context) is ExecutionContextV2
    assert type(snapshot.context.run_context) is RunContextV2
    assert all(type(event) is TraceEventV2 for event in snapshot.events)
    assert type(snapshot.metrics) is RunMetricsV2
    assert type(snapshot.findings) is FindingsDocumentV2


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
def test_stale_triage_requires_a_policy_bound_raw_stream_counterfactual(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Delay is causal only when raw replay restores an AEB action the run missed."""
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "counterfactual-artifacts"
    artifact_root.mkdir()
    baseline = _run_real_adas(
        repository_root,
        artifact_root,
        "stationary-delay-baseline",
        repository_root / SCENARIO,
    )
    no_aeb = _run_real_adas(
        repository_root,
        artifact_root,
        "stationary-delay-no-aeb",
        repository_root / SCENARIO,
        repository_root / "config" / "adas" / "defect_no_aeb.yaml",
    )

    from hermes.agents import ToolContext, triage_run
    from hermes.agents.citations import all_valid, check_citations
    from hermes.agents.contracts import FailureCategory
    from hermes.agents.tools import query_run

    context = ToolContext(repository_root=repository_root, artifact_root=artifact_root)
    baseline_identity = query_run(context, run_id=baseline.name)
    baseline_proposal = triage_run(context, baseline.name)
    proof = baseline_identity.data["aeb_stale_observation_counterfactual"]
    assert set(proof) == {
        "sequence",
        "delivered_from_sequence",
        "raw_replay_brake",
        "stored_candidate_brake",
    }
    assert proof["delivered_from_sequence"] < proof["sequence"]
    assert proof["raw_replay_brake"] > 0.0
    assert proof["stored_candidate_brake"] == 0.0
    proof_event = _events(baseline)[proof["sequence"]]
    assert proof_event["candidate_action"]["brake"] == 0.0
    assert (
        proof_event["observation_fault_evidence"]["delivered_from_sequence"]
        == proof["delivered_from_sequence"]
    )
    assert baseline_proposal.deterministic_category is FailureCategory.STALE_OBSERVATION
    assert baseline_proposal.category is FailureCategory.STALE_OBSERVATION
    assert baseline_proposal.agrees_with_deterministic_classifier is True
    baseline_citations = {
        (citation.artifact_file, citation.locator)
        for citation in baseline_proposal.citations
    }
    event_prefix = f"sequence:{proof['sequence']}"
    for locator in (
        f"{event_prefix}/candidate_action/brake",
        (
            f"{event_prefix}/observation_fault_evidence/"
            "delivered_observation/observation_age_s"
        ),
        f"{event_prefix}/observation_fault_evidence/applied_faults",
        f"{event_prefix}/observation_fault_evidence/delivered_from_sequence",
        f"{event_prefix}/observation_fault_evidence/raw_observation/front_distance_m",
        (
            f"{event_prefix}/observation_fault_evidence/"
            "raw_observation/front_relative_speed_mps"
        ),
    ):
        assert ("events.jsonl", locator) in baseline_citations
    assert all_valid(check_citations(baseline_proposal.citations, artifact_root))

    no_aeb_identity = query_run(context, run_id=no_aeb.name)
    no_aeb_proposal = triage_run(context, no_aeb.name)
    no_aeb_metrics = json.loads((no_aeb / "metrics.json").read_text(encoding="utf-8"))
    no_aeb_findings = _findings(no_aeb)
    assert no_aeb_identity.data["aeb_stale_observation_s"] == 0.5
    assert "aeb_stale_observation_counterfactual" not in no_aeb_identity.data
    assert no_aeb_metrics["max_observation_age_s"]["value"] > 0.5
    assert no_aeb_metrics["fault_application_counts"]["OBSERVATION_DELAY"] > 0
    assert no_aeb_findings["adas.aeb.threat_response"]["status"] == "FAIL"
    assert no_aeb_proposal.deterministic_category is FailureCategory.MISSED_INTERVENTION
    assert no_aeb_proposal.category is FailureCategory.MISSED_INTERVENTION
    assert no_aeb_proposal.agrees_with_deterministic_classifier is True

    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.domain.models import Action

    monkeypatch.setattr(
        AdasLongitudinalPolicy,
        "act",
        lambda _policy, _observation: Action(
            steering=0.0,
            throttle=0.0,
            brake=0.0,
        ),
    )
    mismatched_identity = query_run(context, run_id=baseline.name)
    mismatched_proposal = triage_run(context, baseline.name)
    assert mismatched_identity.data["aeb_stale_observation_s"] == 0.5
    assert "aeb_stale_observation_counterfactual" not in mismatched_identity.data
    assert (
        mismatched_proposal.deterministic_category
        is FailureCategory.MISSED_INTERVENTION
    )
    assert mismatched_proposal.category is FailureCategory.MISSED_INTERVENTION


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

    identity = query_run(
        ToolContext(repository_root=repository_root, artifact_root=artifact_root),
        run_id="stationary-delay-provenance",
    )
    monkeypatch.setattr(MetaDriveAdapter, "reset", forbid_execution)
    monkeypatch.setattr(MetaDriveAdapter, "step", forbid_execution)
    monkeypatch.setattr(AdasLongitudinalPolicy, "reset", forbid_execution)
    monkeypatch.setattr(AdasLongitudinalPolicy, "act", forbid_execution)

    replay = verify_artifact(bundle)
    envelope = review_artifact(artifact_root, "stationary-delay-provenance")
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
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _requires_metadrive(repository_root)
    _pin_test_producer_to_legacy_adas_v2(monkeypatch)
    artifact_root = tmp_path / "invalid-threshold-artifacts"
    artifact_root.mkdir()
    bundle = _run_real_adas(
        repository_root,
        artifact_root,
        "invalid-stored-threshold",
        repository_root / SCENARIO,
    )
    _assert_exact_v2_bundle(bundle)
    _rewrite_policy_config(bundle, "out-of-bounds-threshold")

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


@pytest.mark.metadrive
@pytest.mark.parametrize(
    "mutation",
    ("unknown-extra-key", "omitted-driver", "omitted-driver-tunable"),
)
def test_query_and_triage_reject_incomplete_or_extended_stored_adas_config(
    repository_root: Path,
    tmp_path: Path,
    mutation: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Projection or Pydantic defaults must not legitimize undeclared stored identity."""
    _requires_metadrive(repository_root)
    _pin_test_producer_to_legacy_adas_v2(monkeypatch)
    artifact_root = tmp_path / f"invalid-{mutation}-artifacts"
    artifact_root.mkdir()
    run_id = f"invalid-{mutation}"
    bundle = _run_real_adas(
        repository_root,
        artifact_root,
        run_id,
        repository_root / SCENARIO,
    )
    _assert_exact_v2_bundle(bundle)
    _rewrite_policy_config(bundle, mutation)

    from hermes.agents import ToolContext, triage_run
    from hermes.agents.contracts import FailureCategory
    from hermes.agents.tools import query_run
    from hermes.evidence.verification import verify_artifact

    verification = verify_artifact(bundle)
    assert verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    context = ToolContext(repository_root=repository_root, artifact_root=artifact_root)

    result = query_run(context, run_id=run_id)
    proposal = triage_run(context, run_id)

    assert result.ok
    assert "aeb_stale_observation_s" not in result.data
    assert proposal.deterministic_category is FailureCategory.MISSED_INTERVENTION
    assert proposal.category is FailureCategory.MISSED_INTERVENTION
    assert all(
        citation.artifact_file != "execution-context.json"
        for citation in proposal.citations
    )


@pytest.mark.metadrive
@pytest.mark.parametrize(
    "mutation",
    (
        "out-of-bounds-threshold",
        "unknown-extra-key",
    ),
)
def test_v3_strict_replay_rejects_rebound_or_incomplete_stored_adas_config(
    repository_root: Path,
    tmp_path: Path,
    mutation: str,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / f"v3-invalid-{mutation}-artifacts"
    artifact_root.mkdir()
    bundle = _run_real_adas(
        repository_root,
        artifact_root,
        f"v3-invalid-{mutation}",
        repository_root / SCENARIO,
    )

    from hermes.domain.models import ArtifactManifestV3
    from hermes.evidence.verification import inspect_artifact, verify_artifact

    snapshot = inspect_artifact(bundle).snapshot
    assert snapshot is not None
    assert type(snapshot.manifest) is ArtifactManifestV3
    _rewrite_policy_config(bundle, mutation)

    verification = verify_artifact(bundle)
    assert verification.integrity is IntegrityStatus.INVALID
    assert verification.errors


@pytest.mark.metadrive
def test_committed_observation_delay_is_reproducible_across_three_real_runs(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """Same-host N=3 excludes only manifest time and bundle-root identity."""
    _requires_metadrive(repository_root)
    bundles: list[Path] = []
    for index in range(3):
        artifact_root = tmp_path / f"n3-root-{index}"
        artifact_root.mkdir()
        bundles.append(
            _run_real_adas(
                repository_root,
                artifact_root,
                "stationary-delay-n3",
                repository_root / SCENARIO,
            )
        )

    manifests = [
        json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        for bundle in bundles
    ]
    assert {manifest["run_id"] for manifest in manifests} == {"stationary-delay-n3"}
    assert {manifest["seed"] for manifest in manifests} == {7}
    assert manifests[0]["trace_digest"] == manifests[1]["trace_digest"] == manifests[2][
        "trace_digest"
    ]
    manifest_projections = []
    for manifest in manifests:
        projection = dict(manifest)
        del projection["created_at_utc"]
        manifest_projections.append(projection)
    assert manifest_projections[0] == manifest_projections[1] == manifest_projections[2]

    for filename in (
        "events.jsonl",
        "trace.sha256",
        "execution-context.json",
        "metrics.json",
        "findings.json",
        "verdict.json",
        "scenario.resolved.yaml",
        "gate-config.resolved.yaml",
    ):
        payloads = [(bundle / filename).read_bytes() for bundle in bundles]
        assert payloads[0] == payloads[1] == payloads[2], filename


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
