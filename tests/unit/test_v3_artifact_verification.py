"""Schema-3 bundle serialization, independent derivation, and stored-replay contracts."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from tests.unit.test_evidence_schema_v3_models import _metrics_v3_payload

import hermes.evidence.verification as verification_module
import hermes.runtime.orchestrator as orchestrator_module
from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.adas.decision import AdasLongitudinalDecisionKernel
from hermes.adas.interfaces import AdasControllerConfig
from hermes.adas.policy import AdasLongitudinalPolicy
from hermes.domain.enums import (
    BrakeSource,
    EvidenceAvailability,
    FindingStatus,
    IntegrityStatus,
    TerminationReason,
    Verdict,
)
from hermes.domain.models import (
    ArtifactManifestV3,
    ComponentContext,
    ControlFaultEvidence,
    ExecutionContext,
    ExecutionContextV2,
    ExecutionContextV3,
    FindingsDocumentV3,
    GateResult,
    Measurement,
    Observation,
    ObservationFaultEvidence,
    RunContextV3,
    RunMetrics,
    RunMetricsV3,
    ScenarioDefinition,
    TraceEventV3,
    VehicleState,
)
from hermes.evidence.artifacts import (
    REQUIRED_ARTIFACT_FILES,
    ArtifactError,
    bundle_digest,
    config_digest,
    write_bundle,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.metrics import compute_metrics
from hermes.evidence.schema_registry import (
    ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA,
    EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA,
    FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA,
    RUN_METRICS_BY_EVIDENCE_SCHEMA,
)
from hermes.evidence.trace import GENESIS_HASH, create_trace_event_v3
from hermes.evidence.verification import inspect_artifact
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.gates.config import GateConfig, gate_config_digest, load_gate_config
from hermes.gates.release import apply_release_gate, select_verifier_profile
from hermes.scenarios.loader import scenario_digest
from hermes.shields.config import ShieldConfig
from hermes.shields.deterministic import DeterministicSafetyShield
from hermes.shields.noop import NoOpShield
from hermes.verifiers import (
    _trace_integrity,
    run_verifiers_for_profile,
    verifier_identities_for_profile,
)


def _scenario(*, faulted: bool) -> ScenarioDefinition:
    payload: dict[str, object] = {
        "schema_version": "4.0",
        "name": "wp4_synthetic_v3",
        "version": "1.0",
        "description": "Simulator-neutral inactive V3 serialization and replay probe.",
        "adapter": "fake",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": 3,
            "target_speed_mps": 10.0,
            "max_braking_mps2": 12.982444763183452,
        },
        "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 100.0, "boundary_tolerance_m": 1.5},
        "adas": {
            "enabled": ("fcw", "aeb"),
            "expected_fcw": {"kind": "none"},
            "expected_aeb": {"kind": "forbidden"},
        },
    }
    if faulted:
        payload["faults"] = {
            "schema_version": "1.0",
            "name": "wp4_observation_control_delay",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            "observation_delay_steps": 1,
            "control_delay_steps": 1,
            "max_brake": 0.4,
        }
    return ScenarioDefinition.model_validate(payload)


def _shield_config() -> ShieldConfig:
    return ShieldConfig(
        schema_version="1.0",
        name="phase3_deterministic",
        version="1.0",
        label="illustrative_simulation_only_not_real_vehicle_limits",
        ttc_threshold_s=2.0,
        speed_cap_mps=30.0,
        max_observation_age_s=0.5,
        boundary_margin_m=0.5,
        actuation_delay_compensation_s=0.0,
        emergency_stop_active=False,
        full_brake_command=1.0,
        boundary_steering_command=0.2,
    )


def _observation(sequence: int) -> Observation:
    return Observation(
        sequence=sequence,
        simulation_time_s=sequence / 10.0,
        vehicle_state=VehicleState(
            position_m=float(sequence),
            speed_mps=float(sequence),
            acceleration_mps2=0.0 if sequence == 0 else 10.0,
            lateral_offset_m=0.0,
            route_progress_pct=float(sequence * 10),
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
        observation_age_s=0.0,
    )


def _summary(observation: Observation) -> dict[str, object]:
    return {
        "input_sequence": observation.sequence,
        "input_simulation_time_s": observation.simulation_time_s,
        "speed_mps": observation.vehicle_state.speed_mps,
        "lateral_offset_m": observation.vehicle_state.lateral_offset_m,
        "route_progress_pct": observation.vehicle_state.route_progress_pct,
        "observation_age_s": observation.observation_age_s,
    }


def _available_control_latency(
    *, execution_time_s: float, source_time_s: float | None
) -> Measurement:
    if source_time_s is None:
        return Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            unit="ms",
            reason="control-delay startup fill has no originating candidate",
        )
    return Measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=(execution_time_s - source_time_s) * 1000.0,
        unit="ms",
    )


def _context(
    scenario: ScenarioDefinition,
    gate_config: GateConfig,
    *,
    deterministic_shield: bool,
) -> tuple[ExecutionContextV3, ShieldConfig | None]:
    adapter_config = {"model": "deterministic_architectural_test_double_v1"}
    controller = AdasControllerConfig()
    policy_config = {
        **controller.model_dump(mode="json"),
        "target_speed_mps": scenario.control.target_speed_mps,
        "simulated_policy_latency_ms": scenario.control.simulated_policy_latency_ms,
    }
    selected_shield_config = _shield_config() if deterministic_shield else None
    shield_config: dict[str, object] = (
        selected_shield_config.model_dump(mode="json")
        if selected_shield_config is not None
        else {}
    )
    verifier_suite = verifier_identities_for_profile(
        select_verifier_profile(scenario),
        evidence_schema_version="3.0",
    )
    suite_payload = [item.model_dump(mode="json") for item in verifier_suite]
    fault_config = (
        scenario.faults.model_dump(mode="json") if scenario.faults is not None else None
    )
    run_context = RunContextV3(
        scenario_digest=scenario_digest(scenario),
        gate_config_digest=gate_config_digest(gate_config),
        adapter_name="fake",
        adapter_version="1.0",
        adapter_config_digest=config_digest(adapter_config),
        policy_name="adas-longitudinal",
        policy_version="1.0",
        policy_config_digest=config_digest(policy_config),
        shield_name="deterministic" if deterministic_shield else "noop",
        shield_version="1.0",
        shield_config_digest=config_digest(shield_config),
        verifier_suite_digest=config_digest(suite_payload),
        fault_name="deterministic-faults" if fault_config is not None else None,
        fault_version="1.0" if fault_config is not None else None,
        fault_config_digest=(
            config_digest(fault_config) if fault_config is not None else None
        ),
        seed=7,
        control_frequency_hz=scenario.control.frequency_hz,
        horizon_steps=scenario.control.horizon_steps,
    )
    return (
        ExecutionContextV3(
            run_context=run_context,
            adapter=ComponentContext(
                name="fake",
                version="1.0",
                config=adapter_config,
                config_digest=run_context.adapter_config_digest,
            ),
            policy=ComponentContext(
                name="adas-longitudinal",
                version="1.0",
                config=policy_config,
                config_digest=run_context.policy_config_digest,
            ),
            shield=ComponentContext(
                name=run_context.shield_name,
                version="1.0",
                config=shield_config,
                config_digest=run_context.shield_config_digest,
            ),
            verifier_suite=verifier_suite,
            faults=(
                ComponentContext(
                    name="deterministic-faults",
                    version="1.0",
                    config=fault_config,
                    config_digest=run_context.fault_config_digest,
                )
                if fault_config is not None
                else None
            ),
        ),
        selected_shield_config,
    )


def _events(
    scenario: ScenarioDefinition,
    context: ExecutionContextV3,
    shield_config: ShieldConfig | None,
) -> tuple[TraceEventV3, ...]:
    kernel = AdasLongitudinalDecisionKernel(AdasControllerConfig())
    kernel.reset(scenario)
    shield = (
        DeterministicSafetyShield(shield_config)
        if shield_config is not None
        else NoOpShield()
    )
    shield.reset(scenario, context.run_context.seed)
    fault_injector = (
        DeterministicFaultInjector(scenario.faults)
        if scenario.faults is not None
        else None
    )
    if fault_injector is not None:
        fault_injector.reset(scenario, context.run_context.seed)
    observations = tuple(_observation(sequence) for sequence in range(4))
    events: list[TraceEventV3] = []
    for sequence in range(scenario.control.horizon_steps):
        raw = observations[sequence]
        if fault_injector is None:
            delivered = raw
            observation_evidence = ObservationFaultEvidence(
                raw_observation=raw,
                delivered_observation=raw,
                delivered_from_sequence=sequence,
                delivered_from_time_s=raw.simulation_time_s,
                delivery_time_s=raw.simulation_time_s,
                applied_faults=(),
                speed_noise_delta_mps=0.0,
                lateral_noise_delta_m=0.0,
            )
        else:
            faulted_observation = fault_injector.process_observation(raw)
            delivered = faulted_observation.observation
            observation_evidence = ObservationFaultEvidence(
                raw_observation=raw,
                delivered_observation=delivered,
                delivered_from_sequence=faulted_observation.source_sequence,
                delivered_from_time_s=faulted_observation.source_simulation_time_s,
                delivery_time_s=faulted_observation.delivery_time_s,
                applied_faults=faulted_observation.reason_codes,
                speed_noise_delta_mps=faulted_observation.noise_deltas.speed_mps,
                lateral_noise_delta_m=faulted_observation.noise_deltas.lateral_offset_m,
            )
        candidate, decision_evidence = kernel.step(delivered)
        permitted, override_reasons = shield.apply(delivered, candidate)
        if fault_injector is None:
            executed = permitted
            control_evidence = ControlFaultEvidence(
                candidate_time_s=raw.simulation_time_s,
                executed_from_sequence=sequence,
                executed_from_candidate_time_s=raw.simulation_time_s,
                execution_time_s=raw.simulation_time_s,
                pre_saturation_action=permitted,
                applied_faults=(),
                control_latency_ms=_available_control_latency(
                    execution_time_s=raw.simulation_time_s,
                    source_time_s=raw.simulation_time_s,
                ),
                latency_source="simulated",
            )
        else:
            faulted_action = fault_injector.process_action(
                permitted,
                sequence=sequence,
                simulation_time_s=raw.simulation_time_s,
            )
            executed = faulted_action.action
            control_evidence = ControlFaultEvidence(
                candidate_time_s=raw.simulation_time_s,
                executed_from_sequence=faulted_action.source_sequence,
                executed_from_candidate_time_s=faulted_action.source_simulation_time_s,
                execution_time_s=faulted_action.execution_time_s,
                pre_saturation_action=faulted_action.pre_saturation_action,
                applied_faults=faulted_action.reason_codes,
                control_latency_ms=_available_control_latency(
                    execution_time_s=raw.simulation_time_s,
                    source_time_s=faulted_action.source_simulation_time_s,
                ),
                latency_source="simulated",
            )
        result = observations[sequence + 1]
        is_last = sequence == scenario.control.horizon_steps - 1
        events.append(
            create_trace_event_v3(
                sequence=sequence,
                simulation_time_s=result.simulation_time_s,
                run_context=context.run_context,
                observation_summary=_summary(delivered),
                candidate_action=candidate,
                permitted_action=permitted,
                executed_action=executed,
                override_reasons=override_reasons,
                observation_fault_evidence=observation_evidence,
                control_fault_evidence=control_evidence,
                result_observation=result,
                adas_decision_evidence=decision_evidence,
                vehicle_state=result.vehicle_state,
                policy_latency_ms=scenario.control.simulated_policy_latency_ms,
                latency_source="simulated",
                terminated=False,
                truncated=is_last,
                termination_reason=(
                    TerminationReason.HORIZON if is_last else TerminationReason.NONE
                ),
                raw_facts={
                    "collision": False,
                    "collision_count": 0,
                    "offroad": False,
                    "destination_reached": False,
                    "route_progress_available": True,
                    "route_progress_pct": result.vehicle_state.route_progress_pct,
                },
                previous_hash=events[-1].current_hash if events else GENESIS_HASH,
                scenario=scenario,
                shield_config=shield_config,
                prior_events=tuple(events),
            )
        )
    return tuple(events)


def _verdict() -> GateResult:
    return GateResult(
        gate_name="adas_p0",
        gate_version="1.0",
        verdict=Verdict.INVALID_EVIDENCE,
        rationale=("WP-5 derivation intentionally unavailable",),
        supporting_finding_ids=(),
        hard_failures=(),
        soft_failures=(),
        residual_limitations=("simulation only",),
        findings=(),
    )


def _bundle(
    repository_root: Path,
    tmp_path: Path,
    *,
    faulted: bool,
    deterministic_shield: bool = False,
) -> tuple[Path, ScenarioDefinition, GateConfig, ExecutionContextV3, tuple[TraceEventV3, ...]]:
    scenario = _scenario(faulted=faulted)
    gate_config = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    context, shield_config = _context(
        scenario,
        gate_config,
        deterministic_shield=deterministic_shield,
    )
    events = _events(scenario, context, shield_config)
    metrics = compute_metrics(events, scenario=scenario, gate_config=gate_config)
    profile = select_verifier_profile(scenario)
    findings = run_verifiers_for_profile(
        profile,
        events,
        scenario,
        gate_config,
        shield_config=shield_config,
    )
    verdict = apply_release_gate(
        findings,
        gate_config,
        expected_profile=profile,
        adapter_name=context.adapter.name,
        evidence_schema_version=context.evidence_schema_version,
    )
    directory = tmp_path / (
        "v3-fault" if faulted else "v3-shield" if deterministic_shield else "v3-no-fault"
    )
    directory.mkdir()
    write_bundle(
        directory,
        run_id=directory.name,
        scenario=scenario,
        gate_config=gate_config,
        execution_context=context,
        events=events,
        metrics=metrics,
        findings=findings,
        verdict=verdict,
        repository_commit="9e8787ad3ece61f4df4d55b9f91874b88133985e",
        repository_dirty=False,
        repository_provenance_reason=None,
    )
    return directory, scenario, gate_config, context, events


def _wp5_closed_bundle(
    repository_root: Path,
    tmp_path: Path,
) -> Path:
    directory, _, _, _, _ = _bundle(
        repository_root,
        tmp_path,
        faulted=False,
    )
    return directory


def _decoded(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _write_json(path: Path, payload: object) -> None:
    path.write_bytes(canonical_json_bytes(payload) + b"\n")


def _refresh_bundle(bundle: Path) -> None:
    manifest_path = bundle / "manifest.json"
    manifest = _decoded(manifest_path)
    file_digests = manifest["file_digests"]
    assert isinstance(file_digests, dict)
    for filename in file_digests:
        file_digests[filename] = sha256_hex((bundle / filename).read_bytes())
    _write_json(manifest_path, manifest)
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
    previous_hash = GENESIS_HASH
    for event in events:
        event["previous_hash"] = previous_hash
        material = dict(event)
        material.pop("current_hash", None)
        event["current_hash"] = sha256_hex(canonical_json_bytes(material))
        previous_hash = event["current_hash"]
    (bundle / "events.jsonl").write_bytes(
        b"".join(canonical_json_bytes(event) + b"\n" for event in events)
    )
    (bundle / "trace.sha256").write_text(previous_hash + "\n", encoding="ascii")
    manifest = _decoded(bundle / "manifest.json")
    manifest["trace_digest"] = previous_hash
    _write_json(bundle / "manifest.json", manifest)
    _refresh_bundle(bundle)


def _event_payloads(bundle: Path) -> list[dict[str, object]]:
    return [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]


def _assert_seam_rejected(bundle: Path, seam: str) -> None:
    inspection = inspect_artifact(bundle)
    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    errors = " | ".join(inspection.verification.errors)
    assert seam in errors


@pytest.mark.parametrize("faulted", [False, True], ids=("no-fault", "faulted"))
def test_v3_writer_round_trips_exact_six_families_and_ten_file_inventory(
    repository_root: Path,
    tmp_path: Path,
    faulted: bool,
) -> None:
    bundle, _, _, _, events = _bundle(
        repository_root,
        tmp_path,
        faulted=faulted,
    )

    assert tuple(sorted(path.name for path in bundle.iterdir())) == tuple(
        sorted(REQUIRED_ARTIFACT_FILES)
    )
    parsed_manifest = verification_module._parse_versioned_model(
        (bundle / "manifest.json").read_bytes(),
        "manifest.json",
        dict(ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA),
    )
    parsed_context = verification_module._parse_versioned_model(
        (bundle / "execution-context.json").read_bytes(),
        "execution-context.json",
        dict(EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA),
    )
    parsed_metrics = verification_module._parse_versioned_model(
        (bundle / "metrics.json").read_bytes(),
        "metrics.json",
        dict(RUN_METRICS_BY_EVIDENCE_SCHEMA),
    )
    parsed_findings = verification_module._parse_versioned_model(
        (bundle / "findings.json").read_bytes(),
        "findings.json",
        dict(FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA),
    )
    parsed_events = verification_module._parse_events((bundle / "events.jsonl").read_bytes())

    assert type(parsed_manifest) is ArtifactManifestV3
    assert type(parsed_context) is ExecutionContextV3
    assert type(parsed_context.run_context) is RunContextV3
    assert type(parsed_metrics) is RunMetricsV3
    assert type(parsed_findings) is FindingsDocumentV3
    assert tuple(type(event) for event in parsed_events) == (TraceEventV3,) * len(events)
    assert parsed_manifest.required_files == REQUIRED_ARTIFACT_FILES
    assert (parsed_manifest.fault_name is not None) is faulted
    inspection = inspect_artifact(bundle)
    assert inspection.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert inspection.verification.errors == ()
    assert inspection.snapshot is not None
    assert type(inspection.snapshot.metrics) is RunMetricsV3
    assert type(inspection.snapshot.findings) is FindingsDocumentV3


def test_v3_event_parser_rejects_unknown_and_cross_version_nested_schemas(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    event = _event_payloads(bundle)[0]
    unknown = {**event, "evidence_schema_version": "9.0"}
    with pytest.raises(ValueError, match=r"supported versions: 1\.0, 2\.0, 3\.0"):
        verification_module._parse_events(canonical_json_bytes(unknown) + b"\n")

    nested = dict(event)
    run_context = dict(nested["run_context"])
    run_context["evidence_schema_version"] = "2.0"
    nested["run_context"] = run_context
    with pytest.raises(ValueError, match="run_context evidence schema differs from the event"):
        verification_module._parse_events(canonical_json_bytes(nested) + b"\n")


@pytest.mark.parametrize(
    "version",
    (["3.0"], {"declared": "3.0"}),
    ids=("list", "object"),
)
def test_v3_event_parser_rejects_non_string_declared_versions(
    repository_root: Path,
    tmp_path: Path,
    version: object,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    event = _event_payloads(bundle)[0]
    event["evidence_schema_version"] = version
    run_context = dict(event["run_context"])
    run_context["evidence_schema_version"] = version
    event["run_context"] = run_context

    with pytest.raises(ValueError, match="evidence_schema_version.*unsupported"):
        verification_module._parse_events(canonical_json_bytes(event) + b"\n")


@pytest.mark.parametrize(
    "version",
    (["3.0"], {"declared": "3.0"}),
    ids=("list", "object"),
)
def test_v3_inspection_quarantines_coherently_rebound_non_string_event_versions(
    repository_root: Path,
    tmp_path: Path,
    version: object,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    events = _event_payloads(bundle)
    events[0]["evidence_schema_version"] = version
    run_context = dict(events[0]["run_context"])
    run_context["evidence_schema_version"] = version
    events[0]["run_context"] = run_context
    _rehash_events(bundle, events)

    _assert_seam_rejected(
        bundle,
        "events.jsonl line 1 evidence_schema_version",
    )


@pytest.mark.parametrize(
    ("mutation", "expected_seam"),
    (
        (
            "initial-position",
            "no-fault V3 raw initial observation contradicts the scenario",
        ),
        (
            "initial-front-geometry",
            "no-fault V3 raw observation contradicts the scenario challenge at sequence 0",
        ),
        (
            "prior-result-chain",
            "no-fault V3 raw observation disagrees with prior result at sequence 1",
        ),
        (
            "result-state",
            "no-fault V3 result observation disagrees with event state at sequence 0",
        ),
        (
            "result-timing",
            "no-fault V3 result observation timing disagrees at sequence 0",
        ),
        (
            "result-front-geometry",
            "no-fault V3 result observation contradicts the scenario challenge at sequence 0",
        ),
    ),
)
def test_stored_no_fault_v3_binds_complete_typed_observation_continuity(
    repository_root: Path,
    tmp_path: Path,
    mutation: str,
    expected_seam: str,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    events = _event_payloads(bundle)

    if mutation in {"initial-position", "initial-front-geometry"}:
        evidence = dict(events[0]["observation_fault_evidence"])
        for field_name in ("raw_observation", "delivered_observation"):
            observation = dict(evidence[field_name])
            if mutation == "initial-position":
                vehicle_state = dict(observation["vehicle_state"])
                vehicle_state["position_m"] = 99.0
                observation["vehicle_state"] = vehicle_state
            else:
                observation["front_distance_m"] = 1000.0
            evidence[field_name] = observation
        events[0]["observation_fault_evidence"] = evidence
    elif mutation == "prior-result-chain":
        evidence = dict(events[1]["observation_fault_evidence"])
        for field_name in ("raw_observation", "delivered_observation"):
            observation = dict(evidence[field_name])
            vehicle_state = dict(observation["vehicle_state"])
            vehicle_state["position_m"] = 99.0
            observation["vehicle_state"] = vehicle_state
            evidence[field_name] = observation
        events[1]["observation_fault_evidence"] = evidence
    else:
        result = dict(events[0]["result_observation"])
        if mutation == "result-state":
            vehicle_state = dict(result["vehicle_state"])
            vehicle_state["position_m"] = 99.0
            result["vehicle_state"] = vehicle_state
        elif mutation == "result-timing":
            result["sequence"] = 99
        else:
            result["front_distance_m"] = 1000.0
        events[0]["result_observation"] = result
    _rehash_events(bundle, events)

    _assert_seam_rejected(bundle, expected_seam)


def test_v3_writer_rejects_a_mixed_exact_document_family(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    scenario = _scenario(faulted=False)
    gate_config = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    context, shield_config = _context(
        scenario,
        gate_config,
        deterministic_shield=False,
    )
    events = _events(scenario, context, shield_config)
    directory = tmp_path / "mixed-family"
    directory.mkdir()

    with pytest.raises(ArtifactError, match="exact schema-3 metrics model"):
        write_bundle(
            directory,
            run_id="mixed-family",
            scenario=scenario,
            gate_config=gate_config,
            execution_context=context,
            events=events,
            metrics=RunMetrics.model_validate(
                {
                    key: value
                    for key, value in _metrics_v3_payload().items()
                    if key in RunMetrics.model_fields
                }
                | {"evidence_schema_version": "1.0"}
            ),
            findings=(),
            verdict=_verdict(),
            repository_commit="9e8787ad3ece61f4df4d55b9f91874b88133985e",
            repository_dirty=False,
            repository_provenance_reason=None,
        )


def test_stored_v3_replays_full_stateful_policy_from_strict_bound_config(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    events = _event_payloads(bundle)
    event = events[1]
    neutral_action = {"steering": 0.0, "throttle": 0.0, "brake": 0.0}
    event["adas_decision"] = {
        "warning": "NO_WARNING",
        "intervention": "NO_INTERVENTION",
        "mode": "ACTIVE",
        "brake_source": "none",
        "throttle": 0.0,
        "brake": 0.0,
        "time_to_collision_s": None,
        "required_deceleration_mps2": None,
        "reasons": [],
    }
    event["candidate_action"] = neutral_action
    event["permitted_action"] = neutral_action
    event["executed_action"] = neutral_action
    event["candidate_brake_source"] = BrakeSource.NONE.value
    event["permitted_brake_source"] = BrakeSource.NONE.value
    event["executed_brake_source"] = BrakeSource.NONE.value
    control = dict(event["control_fault_evidence"])
    control["pre_saturation_action"] = neutral_action
    event["control_fault_evidence"] = control
    _rehash_events(bundle, events)

    _assert_seam_rejected(bundle, "stored ADAS policy replay mismatch at sequence 1")


def test_stored_v3_rejects_unknown_controller_config_even_when_digest_bound(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    context = _decoded(bundle / "execution-context.json")
    policy = dict(context["policy"])
    policy_config = dict(policy["config"])
    policy_config["unreviewed_controller_field"] = True
    policy_digest = config_digest(policy_config)
    policy["config"] = policy_config
    policy["config_digest"] = policy_digest
    context["policy"] = policy
    run_context = dict(context["run_context"])
    run_context["policy_config_digest"] = policy_digest
    context["run_context"] = run_context
    _write_json(bundle / "execution-context.json", context)
    manifest = _decoded(bundle / "manifest.json")
    manifest["policy_config_digest"] = policy_digest
    _write_json(bundle / "manifest.json", manifest)
    events = _event_payloads(bundle)
    for event in events:
        event_context = dict(event["run_context"])
        event_context["policy_config_digest"] = policy_digest
        event["run_context"] = event_context
    _rehash_events(bundle, events)

    _assert_seam_rejected(
        bundle,
        "execution-context.json ADAS policy configuration is unsupported",
    )


def test_stored_v3_independently_replays_complete_observation_fault_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=True)
    events = _event_payloads(bundle)
    observation_evidence = dict(events[1]["observation_fault_evidence"])
    observation_evidence["applied_faults"] = []
    events[1]["observation_fault_evidence"] = observation_evidence
    _rehash_events(bundle, events)

    _assert_seam_rejected(
        bundle,
        "stored deterministic fault observation mismatch at sequence 1",
    )


def test_stored_v3_rejects_coherently_rehashed_control_fault_tampering(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=True)
    events = _event_payloads(bundle)
    control_evidence = dict(events[1]["control_fault_evidence"])
    control_evidence["applied_faults"] = []
    events[1]["control_fault_evidence"] = control_evidence
    _rehash_events(bundle, events)

    _assert_seam_rejected(bundle, "control fault replay does not match")


def test_stored_v3_threads_exact_shield_config_through_outer_trace_and_verifier(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, scenario, _, context, _ = _bundle(
        repository_root,
        tmp_path,
        faulted=False,
        deterministic_shield=True,
    )
    inspection = inspect_artifact(bundle)
    assert inspection.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert inspection.verification.errors == ()
    assert inspection.snapshot is not None
    parsed_events = verification_module._parse_events((bundle / "events.jsonl").read_bytes())
    shield_config = ShieldConfig.model_validate(context.shield.config)

    finding = _trace_integrity(
        parsed_events,
        scenario,
        shield_config=shield_config,
    )
    assert finding.finding_id == "trace.integrity"
    assert finding.verifier_version == "1.1"
    assert finding.status is FindingStatus.PASS

    broken = parsed_events[0].model_copy(update={"current_hash": "0" * 64})
    failed = _trace_integrity(
        (broken, *parsed_events[1:]),
        scenario,
        shield_config=shield_config,
    )
    assert failed.finding_id == "trace.integrity"
    assert failed.verifier_version == "1.1"
    assert failed.status is FindingStatus.FAIL


def test_v3_suite_selects_exact_trace_integrity_v1_1_and_binds_its_digest(
    repository_root: Path,
) -> None:
    scenario = _scenario(faulted=False)
    gate_config = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    context, _ = _context(
        scenario,
        gate_config,
        deterministic_shield=False,
    )
    expected_suite = verifier_identities_for_profile(
        select_verifier_profile(scenario),
        evidence_schema_version="3.0",
    )

    assert context.verifier_suite == expected_suite
    assert context.verifier_suite[0].model_dump(mode="json") == {
        "name": "TraceIntegrityVerifier",
        "version": "1.1",
        "finding_id": "trace.integrity",
    }
    assert context.verifier_suite[-3].model_dump(mode="json") == {
        "name": "AdasBrakeOnsetVerifier",
        "version": "1.1",
        "finding_id": "adas.aeb.brake_onset_margin",
    }
    assert context.run_context.verifier_suite_digest == config_digest(
        [identity.model_dump(mode="json") for identity in expected_suite]
    )


def test_stored_v3_rejects_a_coherently_rebound_shield_config(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(
        repository_root,
        tmp_path,
        faulted=False,
        deterministic_shield=True,
    )
    context = _decoded(bundle / "execution-context.json")
    shield = dict(context["shield"])
    shield_config = dict(shield["config"])
    shield_config["emergency_stop_active"] = True
    shield_digest = config_digest(shield_config)
    shield["config"] = shield_config
    shield["config_digest"] = shield_digest
    context["shield"] = shield
    run_context = dict(context["run_context"])
    run_context["shield_config_digest"] = shield_digest
    context["run_context"] = run_context
    _write_json(bundle / "execution-context.json", context)
    manifest = _decoded(bundle / "manifest.json")
    manifest["shield_config_digest"] = shield_digest
    _write_json(bundle / "manifest.json", manifest)
    events = _event_payloads(bundle)
    for event in events:
        event_context = dict(event["run_context"])
        event_context["shield_config_digest"] = shield_digest
        event["run_context"] = event_context
    _rehash_events(bundle, events)

    _assert_seam_rejected(bundle, "shield transition does not match deterministic replay")


def test_stored_v3_binds_optional_fault_identity_into_manifest(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=True)
    manifest = _decoded(bundle / "manifest.json")
    manifest["fault_config_digest"] = "0" * 64
    _write_json(bundle / "manifest.json", manifest)
    _refresh_bundle(bundle)

    _assert_seam_rejected(
        bundle,
        "manifest.json fault_config_digest does not match execution context",
    )


def test_stored_v3_binds_exact_schema_aware_verifier_suite(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle, _, _, _, _ = _bundle(repository_root, tmp_path, faulted=False)
    context = _decoded(bundle / "execution-context.json")
    suite = list(context["verifier_suite"])
    first = dict(suite[0])
    first["version"] = "9.9"
    suite[0] = first
    suite_digest = config_digest(suite)
    context["verifier_suite"] = suite
    run_context = dict(context["run_context"])
    run_context["verifier_suite_digest"] = suite_digest
    context["run_context"] = run_context
    _write_json(bundle / "execution-context.json", context)
    manifest = _decoded(bundle / "manifest.json")
    manifest["verifier_suite_digest"] = suite_digest
    _write_json(bundle / "manifest.json", manifest)
    events = _event_payloads(bundle)
    for event in events:
        event_context = dict(event["run_context"])
        event_context["verifier_suite_digest"] = suite_digest
        event["run_context"] = event_context
    _rehash_events(bundle, events)

    _assert_seam_rejected(
        bundle,
        "execution-context.json contains an unsupported verifier suite",
    )


@pytest.mark.parametrize("faulted", [False, True], ids=("legacy-v1", "fault-v2"))
def test_wp4_does_not_activate_v3_runtime_production(
    repository_root: Path,
    faulted: bool,
) -> None:
    scenario = _scenario(faulted=faulted)
    gate_config = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    adapter = FakeSimulatorAdapter()
    policy = AdasLongitudinalPolicy(AdasControllerConfig())
    policy.reset(scenario, 7)
    shield = NoOpShield()
    shield.reset(scenario, 7)
    fault_injector = (
        DeterministicFaultInjector(scenario.faults)
        if scenario.faults is not None
        else None
    )
    if fault_injector is not None:
        fault_injector.reset(scenario, 7)

    context = orchestrator_module._build_execution_context(
        scenario=scenario,
        gate_config=gate_config,
        seed=7,
        adapter=adapter,
        policy=policy,
        shield=shield,
        fault_injector=fault_injector,
    )

    assert type(context) is (ExecutionContextV2 if faulted else ExecutionContext)


def test_wp5_closes_the_same_synthetic_bundle_with_exact_v3_snapshot_classes(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _wp5_closed_bundle(repository_root, tmp_path)

    inspection = inspect_artifact(bundle)

    assert inspection.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert inspection.snapshot is not None
    assert type(inspection.snapshot.context) is ExecutionContextV3
    assert type(inspection.snapshot.events[0]) is TraceEventV3
    assert type(inspection.snapshot.metrics) is RunMetricsV3
    assert type(inspection.snapshot.findings) is FindingsDocumentV3

    snapshot = inspection.snapshot
    recomputed_metrics = compute_metrics(
        snapshot.events,
        scenario=snapshot.scenario,
        gate_config=snapshot.gate_config,
    )
    recomputed_findings = run_verifiers_for_profile(
        snapshot.verifier_profile,
        snapshot.events,
        snapshot.scenario,
        snapshot.gate_config,
        shield_config=(
            ShieldConfig.model_validate(snapshot.context.shield.config)
            if snapshot.context.shield.name == "deterministic"
            else None
        ),
    )
    recomputed_verdict = apply_release_gate(
        recomputed_findings,
        snapshot.gate_config,
        adapter_name=snapshot.context.adapter.name,
        expected_profile=snapshot.verifier_profile,
        evidence_schema_version=snapshot.context.evidence_schema_version,
    )

    assert (bundle / "metrics.json").read_bytes() == (
        canonical_json_bytes(recomputed_metrics.model_dump(mode="json")) + b"\n"
    )
    assert (bundle / "findings.json").read_bytes() == (
        canonical_json_bytes(
            FindingsDocumentV3(findings=recomputed_findings).model_dump(mode="json")
        )
        + b"\n"
    )
    assert (bundle / "verdict.json").read_bytes() == (
        canonical_json_bytes(recomputed_verdict.model_dump(mode="json")) + b"\n"
    )


def test_wp5_rejects_coherently_rehashed_metrics_findings_and_verdict(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _wp5_closed_bundle(repository_root, tmp_path)
    metrics = _decoded(bundle / "metrics.json")
    metrics["collision_count"] = 1
    collision_occurred = dict(metrics["collision_occurred"])
    collision_occurred["value"] = True
    metrics["collision_occurred"] = collision_occurred
    _write_json(bundle / "metrics.json", metrics)

    findings = _decoded(bundle / "findings.json")
    finding_items = list(findings["findings"])
    progress = dict(finding_items[3])
    progress["message"] = "coherently rewritten stored finding"
    finding_items[3] = progress
    findings["findings"] = finding_items
    _write_json(bundle / "findings.json", findings)
    verdict = _decoded(bundle / "verdict.json")
    verdict["findings"] = finding_items
    _write_json(bundle / "verdict.json", verdict)
    _refresh_bundle(bundle)

    inspection = inspect_artifact(bundle)

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert "metrics.json does not match metrics recomputed from stored events" in (
        inspection.verification.errors
    )
    assert "findings.json does not match verifiers rerun from stored events" in (
        inspection.verification.errors
    )
    assert "verdict.json does not match the recomputed release gate" in (
        inspection.verification.errors
    )
