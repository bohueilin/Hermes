from __future__ import annotations

import importlib
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

import hermes.domain.enums as domain_enums
import hermes.domain.models as domain_models
from hermes.evidence.verification import inspect_artifact

_FUNCTION_NOT_IMPLEMENTED = "function not implemented in this phase"
_WINDOW_NOT_REPRESENTED = (
    "required/forbidden evaluation window is not represented in scenario schema 4.0"
)
_CHATTER_NOT_DEFINED = "FCW chatter window/formula is not defined in this phase"
_SENSOR_INVALID_NOT_REPRESENTED = (
    "invalid-sensor evidence is not represented in evidence schema 3.0"
)
_RUNTIME_ERRORS_NOT_RETAINED = (
    "runtime errors abort the run and are not retained in successful bundle evidence"
)


def _model(name: str):
    return getattr(domain_models, name)


def _enum(name: str):
    return getattr(domain_enums, name)


def _registry_module():
    return importlib.import_module("hermes.evidence.schema_registry")


def _available(value: object, unit: str | None = None) -> dict[str, object]:
    return {
        "availability": domain_enums.EvidenceAvailability.AVAILABLE,
        "value": value,
        "unit": unit,
        "reason": None,
    }


def _unavailable(reason: str, unit: str | None = None) -> dict[str, object]:
    return {
        "availability": domain_enums.EvidenceAvailability.NOT_AVAILABLE,
        "value": None,
        "unit": unit,
        "reason": reason,
    }


def _fcw_payload() -> dict[str, object]:
    return {
        "warning_count": _available(0, "warnings"),
        "first_warning_time_s": _unavailable("no FCW warning was emitted", "s"),
        "false_warning_count": _available(0, "warnings"),
        "missed_warning": _unavailable(_WINDOW_NOT_REPRESENTED),
        "warning_chatter_count": _unavailable(_CHATTER_NOT_DEFINED, "transitions"),
    }


def _aeb_payload() -> dict[str, object]:
    return {
        "intervention_count": _available(0, "interventions"),
        "first_intervention_time_s": _unavailable("no AEB intervention was executed", "s"),
        "max_deceleration_mps2": _unavailable("no AEB execution interval", "m/s^2"),
        "max_jerk_mps3": _unavailable("no AEB execution interval", "m/s^3"),
        "false_intervention_count": _available(0, "interventions"),
        "missed_intervention": _unavailable(_WINDOW_NOT_REPRESENTED),
        "required_decel_at_onset_mps2": _unavailable(
            "no AEB-attributed brake onset",
            "m/s^2",
        ),
    }


def _acc_payload() -> dict[str, object]:
    return {
        "headway_target_s": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "s"),
        "headway_minimum_s": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "s"),
        "headway_mae_s": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "s"),
        "speed_error_mae_mps": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m/s"),
        "cut_in_recovery_s": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "s"),
        "max_acceleration_mps2": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m/s^2"),
        "max_deceleration_mps2": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m/s^2"),
        "max_jerk_mps3": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m/s^3"),
    }


def _lka_payload() -> dict[str, object]:
    return {
        "lateral_error_mae_m": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m"),
        "lateral_error_max_m": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m"),
        "lane_crossing_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "crossings"),
        "steering_oscillation_count": _unavailable(
            _FUNCTION_NOT_IMPLEMENTED,
            "oscillations",
        ),
        "max_lateral_accel_mps2": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m/s^2"),
        "max_lateral_jerk_mps3": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m/s^3"),
        "degraded_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "transitions"),
        "curve_steady_state_error_m": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "m"),
    }


def _assist_payload() -> dict[str, object]:
    return {
        "mode_transition_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "transitions"),
        "degraded_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "transitions"),
        "takeover_request_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "requests"),
        "disengagement_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "transitions"),
        "route_completion_pct": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "%"),
        "constraint_violation_count": _unavailable(_FUNCTION_NOT_IMPLEMENTED, "violations"),
    }


def _metrics_v3_payload() -> dict[str, object]:
    return {
        "evidence_schema_version": "3.0",
        "event_count": 1,
        "simulation_duration_s": 0.1,
        "collision_count": 0,
        "max_abs_lateral_offset_m": 0.0,
        "offroad_duration_s": 0.0,
        "route_completion_pct": _available(1.0, "%"),
        "minimum_ttc_s": _unavailable("no paired closing front-object evidence", "s"),
        "max_abs_acceleration_mps2": _available(0.0, "m/s^2"),
        "max_abs_jerk_mps3": _unavailable("fewer than two result samples", "m/s^3"),
        "p95_policy_latency_ms": _available(10.0, "ms"),
        "shield_override_count": 0,
        "shield_override_reasons": {},
        "termination_reason": domain_enums.TerminationReason.HORIZON,
        "fault_application_counts": {},
        "max_observation_age_s": _available(0.0, "s"),
        "p95_control_latency_ms": _available(0.0, "ms"),
        "control_fill_count": 0,
        "steering_saturation_count": 0,
        "brake_saturation_count": 0,
        "collision_occurred": _available(False),
        "ttc_at_warning_s": _unavailable("no FCW warning was emitted", "s"),
        "ttc_at_brake_onset_s": _unavailable("no AEB-attributed brake onset", "s"),
        "impact_residual_speed_mps": _unavailable("no collision occurred", "m/s"),
        "minimum_lead_distance_m": _unavailable("no in-path lead was observed", "m"),
        "p95_observation_age_s": _available(0.0, "s"),
        "sensor_invalid_count": _unavailable(_SENSOR_INVALID_NOT_REPRESENTED, "events"),
        "runtime_error_count": _unavailable(_RUNTIME_ERRORS_NOT_RETAINED, "errors"),
        "adas": {
            "fcw": _fcw_payload(),
            "aeb": _aeb_payload(),
            "acc": _acc_payload(),
            "lka": _lka_payload(),
            "assist": _assist_payload(),
        },
    }


def _run_context_payload(*, fault: bool = False) -> dict[str, object]:
    payload: dict[str, object] = {
        "evidence_schema_version": "3.0",
        "scenario_digest": "a" * 64,
        "gate_config_digest": "b" * 64,
        "adapter_name": "fake",
        "adapter_version": "1.0",
        "adapter_config_digest": "c" * 64,
        "policy_name": "adas-longitudinal",
        "policy_version": "1.0",
        "policy_config_digest": "d" * 64,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": "e" * 64,
        "verifier_suite_digest": "f" * 64,
        "seed": 7,
        "control_frequency_hz": 10,
        "horizon_steps": 20,
        "fault_name": None,
        "fault_version": None,
        "fault_config_digest": None,
    }
    if fault:
        payload.update(
            fault_name="deterministic-faults",
            fault_version="1.0",
            fault_config_digest="1" * 64,
        )
    return payload


def _component(name: str, digest: str) -> dict[str, object]:
    return {"name": name, "version": "1.0", "config": {}, "config_digest": digest}


def _execution_context_payload(*, fault: bool = False) -> dict[str, object]:
    return {
        "evidence_schema_version": "3.0",
        "run_context": _run_context_payload(fault=fault),
        "adapter": _component("fake", "c" * 64),
        "policy": _component("adas-longitudinal", "d" * 64),
        "shield": _component("noop", "e" * 64),
        "verifier_suite": (),
        "faults": _component("deterministic-faults", "1" * 64) if fault else None,
    }


def _manifest_payload(*, fault: bool = False) -> dict[str, object]:
    payload: dict[str, object] = {
        "evidence_schema_version": "3.0",
        "hermes_version": "0.1.0",
        "run_id": "unit-v3",
        "created_at_utc": datetime(2026, 8, 25, tzinfo=UTC),
        "repository_commit": None,
        "repository_dirty": None,
        "repository_provenance_reason": "unit fixture has no repository provenance",
        "adapter_name": "fake",
        "adapter_version": "1.0",
        "adapter_config_digest": "c" * 64,
        "simulator_name": None,
        "simulator_version": None,
        "simulator_commit": None,
        "scenario_name": "unit_v3",
        "scenario_version": "1.0",
        "scenario_schema_version": "4.0",
        "scenario_digest": "a" * 64,
        "policy_name": "adas-longitudinal",
        "policy_version": "1.0",
        "policy_config_digest": "d" * 64,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": "e" * 64,
        "gate_name": "adas",
        "gate_version": "1.0",
        "gate_config_digest": "b" * 64,
        "verifier_suite_digest": "f" * 64,
        "seed": 7,
        "control_frequency_hz": 10,
        "horizon_steps": 20,
        "python_version": "3.11.15",
        "platform": "unit",
        "architecture": "arm64",
        "trace_digest": "2" * 64,
        "required_files": (),
        "file_digests": {},
        "integrity_limitation": "local hashes are not authenticated",
        "fault_name": None,
        "fault_version": None,
        "fault_config_digest": None,
    }
    if fault:
        payload.update(
            fault_name="deterministic-faults",
            fault_version="1.0",
            fault_config_digest="1" * 64,
        )
    return payload


def _vehicle_state() -> dict[str, object]:
    return {
        "position_m": 0.0,
        "speed_mps": 0.0,
        "acceleration_mps2": 0.0,
        "lateral_offset_m": 0.0,
        "route_progress_pct": 0.0,
        "collision_count": 0,
        "offroad": False,
        "destination_reached": False,
    }


def _observation(sequence: int, time_s: float) -> dict[str, object]:
    return {
        "sequence": sequence,
        "simulation_time_s": time_s,
        "vehicle_state": _vehicle_state(),
        "front_distance_m": None,
        "front_relative_speed_mps": None,
        "observation_age_s": 0.0,
        "challenge_actor_longitudinal_m": None,
        "challenge_actor_lateral_offset_m": None,
        "challenge_actor_speed_mps": None,
        "challenge_phase": None,
    }


def _trace_event_payload(*, fault: bool = False) -> dict[str, object]:
    action = {"steering": 0.0, "throttle": 0.0, "brake": 0.0}
    observation = _observation(0, 0.0)
    fault_reasons = ("OBSERVATION_DELAY_WARMUP",) if fault else ()
    return {
        "evidence_schema_version": "3.0",
        "sequence": 0,
        "simulation_time_s": 0.1,
        "run_context": _run_context_payload(fault=fault),
        "observation_summary": {
            "input_sequence": 0,
            "input_simulation_time_s": 0.0,
            "speed_mps": 0.0,
            "lateral_offset_m": 0.0,
            "route_progress_pct": 0.0,
            "observation_age_s": 0.0,
        },
        "candidate_action": action,
        "permitted_action": action,
        "executed_action": action,
        "override_reasons": (),
        "observation_fault_evidence": {
            "raw_observation": observation,
            "delivered_observation": observation,
            "delivered_from_sequence": 0,
            "delivered_from_time_s": 0.0,
            "delivery_time_s": 0.0,
            "applied_faults": fault_reasons,
            "speed_noise_delta_mps": 0.0,
            "lateral_noise_delta_m": 0.0,
        },
        "control_fault_evidence": {
            "candidate_time_s": 0.0,
            "executed_from_sequence": 0,
            "executed_from_candidate_time_s": 0.0,
            "execution_time_s": 0.0,
            "pre_saturation_action": action,
            "applied_faults": (),
            "control_latency_ms": _available(0.0, "ms"),
            "latency_source": "simulated",
        },
        "result_observation": _observation(1, 0.1),
        "adas_decision_input_sequence": 0,
        "adas_decision_input_time_s": 0.0,
        "adas_decision": {
            "warning": _enum("WarningLevel").NO_WARNING,
            "intervention": _enum("InterventionLevel").NO_INTERVENTION,
            "mode": _enum("AdasMode").ACTIVE,
            "brake_source": _enum("BrakeSource").NONE,
            "throttle": 0.0,
            "brake": 0.0,
            "time_to_collision_s": None,
            "required_deceleration_mps2": None,
            "reasons": (),
        },
        "candidate_brake_source": _enum("BrakeSource").NONE,
        "permitted_brake_source": _enum("BrakeSource").NONE,
        "executed_brake_source": _enum("BrakeSource").NONE,
        "vehicle_state": _vehicle_state(),
        "policy_latency_ms": 10.0,
        "latency_source": "simulated",
        "terminated": False,
        "truncated": False,
        "termination_reason": domain_enums.TerminationReason.NONE,
        "raw_facts": {
            "collision": False,
            "collision_count": 0,
            "offroad": False,
            "destination_reached": False,
            "route_progress_available": True,
            "route_progress_pct": 0.0,
        },
        "previous_hash": "0" * 64,
        "current_hash": "3" * 64,
    }


def _findings_payload() -> dict[str, object]:
    return {"evidence_schema_version": "3.0", "findings": ()}


def test_adas_public_types_are_compatibility_reexports_from_the_domain_seam() -> None:
    interfaces = importlib.import_module("hermes.adas.interfaces")

    assert interfaces.WarningLevel is _enum("WarningLevel")
    assert interfaces.InterventionLevel is _enum("InterventionLevel")
    assert interfaces.BrakeSource is _enum("BrakeSource")
    assert interfaces.AdasMode is _enum("AdasMode")
    assert interfaces.AdasDecision is _model("AdasDecision")


def test_run_metrics_v3_has_exactly_46_display_rows_and_61_review_leaves() -> None:
    top_level = set(_model("RunMetricsV3").model_fields)
    expected_top_level = {
        "evidence_schema_version",
        "event_count",
        "simulation_duration_s",
        "collision_count",
        "max_abs_lateral_offset_m",
        "offroad_duration_s",
        "route_completion_pct",
        "minimum_ttc_s",
        "max_abs_acceleration_mps2",
        "max_abs_jerk_mps3",
        "p95_policy_latency_ms",
        "shield_override_count",
        "shield_override_reasons",
        "termination_reason",
        "fault_application_counts",
        "max_observation_age_s",
        "p95_control_latency_ms",
        "control_fill_count",
        "steering_saturation_count",
        "brake_saturation_count",
        "collision_occurred",
        "ttc_at_warning_s",
        "ttc_at_brake_onset_s",
        "impact_residual_speed_mps",
        "minimum_lead_distance_m",
        "p95_observation_age_s",
        "sensor_invalid_count",
        "runtime_error_count",
        "adas",
    }
    nested_fields = {
        "FcwMetricsV3": {
            "warning_count",
            "first_warning_time_s",
            "false_warning_count",
            "missed_warning",
            "warning_chatter_count",
        },
        "AebMetricsV3": {
            "intervention_count",
            "first_intervention_time_s",
            "max_deceleration_mps2",
            "max_jerk_mps3",
            "false_intervention_count",
            "missed_intervention",
            "required_decel_at_onset_mps2",
        },
        "AccMetricsV3": {
            "headway_target_s",
            "headway_minimum_s",
            "headway_mae_s",
            "speed_error_mae_mps",
            "cut_in_recovery_s",
            "max_acceleration_mps2",
            "max_deceleration_mps2",
            "max_jerk_mps3",
        },
        "LkaMetricsV3": {
            "lateral_error_mae_m",
            "lateral_error_max_m",
            "lane_crossing_count",
            "steering_oscillation_count",
            "max_lateral_accel_mps2",
            "max_lateral_jerk_mps3",
            "degraded_count",
            "curve_steady_state_error_m",
        },
        "AssistMetricsV3": {
            "mode_transition_count",
            "degraded_count",
            "takeover_request_count",
            "disengagement_count",
            "route_completion_pct",
            "constraint_violation_count",
        },
    }

    assert top_level == expected_top_level
    for model_name, field_names in nested_fields.items():
        assert set(_model(model_name).model_fields) == field_names
    assert len(top_level - {"evidence_schema_version", "adas"}) + sum(
        len(fields) for fields in nested_fields.values()
    ) == 61
    assert 7 + 5 + 7 + 8 + 8 + 6 + 5 == 46
    assert not any(
        "approach" in name
        for name in top_level | set().union(*nested_fields.values())
    )

    metrics = _model("RunMetricsV3").model_validate(_metrics_v3_payload())
    assert type(metrics) is _model("RunMetricsV3")
    assert metrics.evidence_schema_version == "3.0"


_DEFERRED_FIELDS = (
    (("adas", "fcw", "missed_warning"), _WINDOW_NOT_REPRESENTED),
    (("adas", "fcw", "warning_chatter_count"), _CHATTER_NOT_DEFINED),
    (("adas", "aeb", "missed_intervention"), _WINDOW_NOT_REPRESENTED),
    *(
        (("adas", "acc", name), _FUNCTION_NOT_IMPLEMENTED)
        for name in _acc_payload()
    ),
    *(
        (("adas", "lka", name), _FUNCTION_NOT_IMPLEMENTED)
        for name in _lka_payload()
    ),
    *(
        (("adas", "assist", name), _FUNCTION_NOT_IMPLEMENTED)
        for name in _assist_payload()
    ),
    (("sensor_invalid_count",), _SENSOR_INVALID_NOT_REPRESENTED),
    (("runtime_error_count",), _RUNTIME_ERRORS_NOT_RETAINED),
)


def _at_path(payload: dict[str, object], path: tuple[str, ...]) -> dict[str, object]:
    current = payload
    for part in path:
        value = current[part]
        assert isinstance(value, dict)
        current = value
    return current


@pytest.mark.parametrize(("path", "reason"), _DEFERRED_FIELDS)
def test_all_27_owner_deferred_v3_rows_are_permanently_typed_unavailable(
    path: tuple[str, ...],
    reason: str,
) -> None:
    payload = _metrics_v3_payload()
    measurement = _at_path(payload, path)
    assert measurement["availability"] is domain_enums.EvidenceAvailability.NOT_AVAILABLE
    assert measurement["reason"] == reason
    measurement.update(
        availability=domain_enums.EvidenceAvailability.AVAILABLE,
        value=False if path[-1] in {"missed_warning", "missed_intervention"} else 0,
        reason=None,
    )

    with pytest.raises(ValidationError, match="permanently NOT_AVAILABLE"):
        _model("RunMetricsV3").model_validate(payload)


def test_owner_deferred_v3_rows_require_the_exact_frozen_reason() -> None:
    payload = _metrics_v3_payload()
    _at_path(payload, ("adas", "acc", "headway_target_s"))["reason"] = "not implemented"

    with pytest.raises(ValidationError, match="function not implemented in this phase"):
        _model("RunMetricsV3").model_validate(payload)


@pytest.mark.parametrize("missing", ("fault_name", "fault_version", "fault_config_digest"))
def test_run_context_v3_fault_identity_is_all_or_none(missing: str) -> None:
    no_fault = _model("RunContextV3").model_validate(_run_context_payload())
    assert type(no_fault) is _model("RunContextV3")
    assert no_fault.fault_name is None

    incomplete = _run_context_payload(fault=True)
    incomplete[missing] = None
    with pytest.raises(ValidationError, match="fault identity must be all present or all absent"):
        _model("RunContextV3").model_validate(incomplete)


@pytest.mark.parametrize("missing", ("fault_name", "fault_version", "fault_config_digest"))
def test_artifact_manifest_v3_fault_identity_is_all_or_none(missing: str) -> None:
    no_fault = _model("ArtifactManifestV3").model_validate(_manifest_payload())
    assert type(no_fault) is _model("ArtifactManifestV3")
    assert no_fault.fault_name is None

    incomplete = _manifest_payload(fault=True)
    incomplete[missing] = None
    with pytest.raises(ValidationError, match="fault identity must be all present or all absent"):
        _model("ArtifactManifestV3").model_validate(incomplete)


def test_execution_context_v3_requires_exact_internal_fault_identity_match() -> None:
    no_fault = _model("ExecutionContextV3").model_validate(
        _execution_context_payload(fault=False)
    )
    faulted = _model("ExecutionContextV3").model_validate(
        _execution_context_payload(fault=True)
    )
    assert type(no_fault) is _model("ExecutionContextV3")
    assert no_fault.faults is None
    assert faulted.faults is not None

    missing_component = _execution_context_payload(fault=True)
    missing_component["faults"] = None
    with pytest.raises(ValidationError, match="must match run_context fault identity"):
        _model("ExecutionContextV3").model_validate(missing_component)

    fabricated_component = _execution_context_payload(fault=False)
    fabricated_component["faults"] = _component("deterministic-faults", "1" * 64)
    with pytest.raises(ValidationError, match="must match run_context fault identity"):
        _model("ExecutionContextV3").model_validate(fabricated_component)

    wrong_identity = _execution_context_payload(fault=True)
    assert isinstance(wrong_identity["faults"], dict)
    wrong_identity["faults"]["version"] = "2.0"
    with pytest.raises(ValidationError, match="must exactly match run_context"):
        _model("ExecutionContextV3").model_validate(wrong_identity)


def test_v3_fault_identity_fields_reject_coercion() -> None:
    context = _run_context_payload(fault=True)
    context["fault_name"] = 7
    manifest = _manifest_payload(fault=True)
    manifest["fault_version"] = 1

    with pytest.raises(ValidationError):
        _model("RunContextV3").model_validate(context)
    with pytest.raises(ValidationError):
        _model("ArtifactManifestV3").model_validate(manifest)


def test_trace_event_v3_has_unified_typed_no_fault_pass_through_evidence() -> None:
    event = _model("TraceEventV3").model_validate(_trace_event_payload(fault=False))

    assert type(event) is _model("TraceEventV3")
    assert event.run_context.fault_name is None
    assert event.observation_fault_evidence.raw_observation == (
        event.observation_fault_evidence.delivered_observation
    )
    assert event.candidate_action == event.permitted_action == event.executed_action
    assert event.observation_fault_evidence.applied_faults == ()
    assert event.control_fault_evidence.applied_faults == ()
    assert event.adas_decision.warning is _enum("WarningLevel").NO_WARNING
    assert event.adas_decision.intervention is _enum("InterventionLevel").NO_INTERVENTION
    assert event.adas_decision.mode is _enum("AdasMode").ACTIVE
    assert event.executed_brake_source is _enum("BrakeSource").NONE


def test_trace_event_v3_supports_the_same_typed_shape_with_fault_identity() -> None:
    event = _model("TraceEventV3").model_validate(_trace_event_payload(fault=True))

    assert type(event) is _model("TraceEventV3")
    assert event.run_context.fault_name == "deterministic-faults"
    assert event.observation_fault_evidence.applied_faults == (
        "OBSERVATION_DELAY_WARMUP",
    )


def _legacy_payload(bundle: Path, family: str) -> dict[str, object]:
    snapshot = inspect_artifact(bundle).snapshot
    assert snapshot is not None
    model = {
        "run_metrics": snapshot.metrics,
        "run_context": snapshot.context.run_context,
        "execution_context": snapshot.context,
        "trace_event": snapshot.events[0],
        "artifact_manifest": snapshot.manifest,
        "findings_document": snapshot.findings,
    }[family]
    return model.model_dump()


def _v3_payload(family: str) -> dict[str, object]:
    return {
        "run_metrics": _metrics_v3_payload,
        "run_context": _run_context_payload,
        "execution_context": _execution_context_payload,
        "trace_event": _trace_event_payload,
        "artifact_manifest": _manifest_payload,
        "findings_document": _findings_payload,
    }[family]()


_REGISTRIES = {
    "run_metrics": "RUN_METRICS_BY_EVIDENCE_SCHEMA",
    "run_context": "RUN_CONTEXT_BY_EVIDENCE_SCHEMA",
    "execution_context": "EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA",
    "trace_event": "TRACE_EVENT_BY_EVIDENCE_SCHEMA",
    "artifact_manifest": "ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA",
    "findings_document": "FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA",
}


@pytest.mark.parametrize("family", tuple(_REGISTRIES))
def test_declared_version_registries_dispatch_to_exact_v1_v2_v3_classes(
    repository_root: Path,
    family: str,
) -> None:
    registry_module = _registry_module()
    registry = getattr(registry_module, _REGISTRIES[family])
    expected_classes = {
        "run_metrics": ("RunMetrics", "RunMetricsV2", "RunMetricsV3"),
        "run_context": ("RunContext", "RunContextV2", "RunContextV3"),
        "execution_context": ("ExecutionContext", "ExecutionContextV2", "ExecutionContextV3"),
        "trace_event": ("TraceEvent", "TraceEventV2", "TraceEventV3"),
        "artifact_manifest": ("ArtifactManifest", "ArtifactManifestV2", "ArtifactManifestV3"),
        "findings_document": ("FindingsDocument", "FindingsDocumentV2", "FindingsDocumentV3"),
    }[family]
    payloads = (
        _legacy_payload(repository_root / "artifacts" / "phase1-nominal", family),
        _legacy_payload(repository_root / "artifacts" / "handoff-p4-fault", family),
        _v3_payload(family),
    )

    assert tuple(registry) == ("1.0", "2.0", "3.0")
    assert tuple(model.__name__ for model in registry.values()) == expected_classes
    for payload, expected_class in zip(payloads, expected_classes, strict=True):
        parsed = registry_module.validate_declared_evidence_model(
            payload,
            registry=registry,
            document_name=family,
        )
        assert type(parsed) is _model(expected_class)


def test_v3_models_are_standalone_and_do_not_inherit_from_v1_or_v2() -> None:
    for base_name, v2_name, v3_name in (
        ("RunMetrics", "RunMetricsV2", "RunMetricsV3"),
        ("RunContext", "RunContextV2", "RunContextV3"),
        ("ExecutionContext", "ExecutionContextV2", "ExecutionContextV3"),
        ("TraceEvent", "TraceEventV2", "TraceEventV3"),
        ("ArtifactManifest", "ArtifactManifestV2", "ArtifactManifestV3"),
        ("FindingsDocument", "FindingsDocumentV2", "FindingsDocumentV3"),
    ):
        assert not issubclass(_model(v3_name), _model(base_name))
        assert not issubclass(_model(v3_name), _model(v2_name))


@pytest.mark.parametrize("family", tuple(_REGISTRIES))
def test_declared_version_registries_reject_unknown_versions_fail_closed(family: str) -> None:
    registry_module = _registry_module()
    registry = getattr(registry_module, _REGISTRIES[family])
    payload = _v3_payload(family)
    payload["evidence_schema_version"] = "9.9"

    with pytest.raises(
        registry_module.EvidenceSchemaRegistryError,
        match="unsupported.*1.0, 2.0, 3.0",
    ):
        registry_module.validate_declared_evidence_model(
            payload,
            registry=registry,
            document_name=family,
        )


@pytest.mark.parametrize("family", ("execution_context", "trace_event"))
def test_declared_version_registries_reject_mixed_nested_versions_fail_closed(
    family: str,
) -> None:
    registry_module = _registry_module()
    registry = getattr(registry_module, _REGISTRIES[family])
    payload = _v3_payload(family)
    assert isinstance(payload["run_context"], dict)
    payload["run_context"]["evidence_schema_version"] = "2.0"

    with pytest.raises(
        registry_module.EvidenceSchemaRegistryError,
        match="schema validation failed",
    ):
        registry_module.validate_declared_evidence_model(
            payload,
            registry=registry,
            document_name=family,
        )


@pytest.mark.parametrize("family", tuple(_REGISTRIES))
def test_v3_schema_literal_is_exact_for_every_family(family: str) -> None:
    registry_module = _registry_module()
    registry = getattr(registry_module, _REGISTRIES[family])
    payload = deepcopy(_v3_payload(family))
    payload["evidence_schema_version"] = "2.0"

    with pytest.raises(registry_module.EvidenceSchemaRegistryError):
        registry_module.validate_declared_evidence_model(
            payload,
            registry={"2.0": registry["3.0"]},
            document_name=family,
        )
