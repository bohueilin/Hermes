"""Evidence-schema-3 ADAS summary and metric derivation contracts."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from importlib import import_module
from pathlib import Path

import pytest
from tests.unit.test_evidence_schema_v3_models import _DEFERRED_FIELDS
from tests.unit.test_v3_artifact_verification import (
    _context,
    _events,
    _scenario,
)

from hermes.domain.enums import (
    BrakeSource,
    EvidenceAvailability,
    InterventionLevel,
    WarningLevel,
)
from hermes.domain.models import (
    Action,
    BooleanMeasurement,
    CountMeasurement,
    Measurement,
    RunMetricsV3,
    TraceEventV3,
)
from hermes.evidence.metrics import compute_metrics
from hermes.gates.config import GateConfig, load_gate_config

_FCW_DISABLED = "FCW is not enabled by the scenario"
_AEB_DISABLED = "AEB is not enabled by the scenario"


def _at_path(value: object, path: tuple[str, ...]) -> object:
    current = value
    for part in path:
        current = getattr(current, part)
    return current


def _typed_fact_events(
    repository_root: Path,
) -> tuple[tuple[TraceEventV3, ...], object, GateConfig]:
    """Create typed facts whose delivered, result, and execution views deliberately differ."""
    scenario = _scenario(faulted=True)
    gate = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    context, shield_config = _context(
        scenario,
        gate,
        deterministic_shield=False,
    )
    events = list(_events(scenario, context, shield_config))
    ages = (0.01, 0.02, 0.99)
    result_geometry = ((30.0, -5.0), (8.0, -4.0), (6.0, -2.0))
    accelerations = (10.0, -2.0, -100.0)
    speeds = (10.0, 7.0, 99.0)
    route_progress = (10.0, 50.0, 75.0)

    for index, event in enumerate(events):
        delivered = event.observation_fault_evidence.delivered_observation.model_copy(
            update={
                "front_distance_m": 12.0 - index,
                "front_relative_speed_mps": -3.0,
                "observation_age_s": ages[index],
            }
        )
        observation_evidence = event.observation_fault_evidence.model_copy(
            update={"delivered_observation": delivered}
        )
        collision_count = 0 if index == 0 else 1
        state = event.vehicle_state.model_copy(
            update={
                "speed_mps": speeds[index],
                "acceleration_mps2": accelerations[index],
                "collision_count": collision_count,
                "route_progress_pct": route_progress[index],
            }
        )
        gap_m, relative_speed_mps = result_geometry[index]
        result = event.result_observation.model_copy(
            update={
                "vehicle_state": state,
                "front_distance_m": gap_m,
                "front_relative_speed_mps": relative_speed_mps,
            }
        )
        events[index] = event.model_copy(
            update={
                "observation_summary": {
                    "front_distance_m": 999.0,
                    "front_relative_speed_mps": -999.0,
                },
                "observation_fault_evidence": observation_evidence,
                "result_observation": result,
                "vehicle_state": state,
                "raw_facts": event.raw_facts.model_copy(
                    update={
                        "collision": collision_count > 0,
                        "collision_count": collision_count,
                        "route_progress_pct": 999.0,
                    }
                ),
            }
        )

    source = events[0]
    source_action = Action(steering=0.0, throttle=0.0, brake=0.6)
    source_decision = source.adas_decision.model_copy(
        update={
            "warning": WarningLevel.ADVISORY,
            "intervention": InterventionLevel.PARTIAL_BRAKE,
            "brake_source": BrakeSource.AEB,
            "throttle": 0.0,
            "brake": 0.6,
            "time_to_collision_s": 4.0,
            "required_deceleration_mps2": 2.5,
        }
    )
    events[0] = source.model_copy(
        update={
            "candidate_action": source_action,
            "permitted_action": source_action,
            "adas_decision": source_decision,
            "candidate_brake_source": BrakeSource.AEB,
            "permitted_brake_source": BrakeSource.AEB,
        }
    )

    onset = events[1]
    executed = Action(steering=0.0, throttle=0.0, brake=0.4)
    events[1] = onset.model_copy(
        update={
            "executed_action": executed,
            "executed_brake_source": BrakeSource.AEB,
            "control_fault_evidence": onset.control_fault_evidence.model_copy(
                update={
                    "executed_from_sequence": 0,
                    "executed_from_candidate_time_s": 0.0,
                    "execution_time_s": 0.1,
                    "pre_saturation_action": source_action,
                    "applied_faults": ("CONTROL_DELAY", "BRAKE_SATURATION"),
                    "control_latency_ms": Measurement(
                        availability=EvidenceAvailability.AVAILABLE,
                        value=100.0,
                        unit="ms",
                    ),
                }
            ),
            # The execution event's current decision must not replace the originating one.
            "adas_decision": onset.adas_decision.model_copy(
                update={
                    "time_to_collision_s": 0.5,
                    "required_deceleration_mps2": 9.0,
                }
            ),
        }
    )
    return tuple(events), scenario, gate


def _metrics(
    repository_root: Path,
    *,
    enabled: tuple[str, ...] = ("fcw", "aeb"),
) -> RunMetricsV3:
    events, scenario, gate = _typed_fact_events(repository_root)
    assert scenario.adas is not None
    scenario = scenario.model_copy(
        update={"adas": scenario.adas.model_copy(update={"enabled": enabled})}
    )
    metrics = compute_metrics(events, scenario=scenario, gate_config=gate)
    assert type(metrics) is RunMetricsV3
    return metrics


def test_summary_requires_exact_nonempty_v3_events_and_resolved_adas_inputs(
    repository_root: Path,
) -> None:
    summary_module = import_module("hermes.evidence.adas_summary")
    summarize = summary_module.summarize_adas_run
    events, scenario, gate = _typed_fact_events(repository_root)

    with pytest.raises(ValueError, match="exact nonempty TraceEventV3 tuple"):
        summarize([], scenario, gate)
    with pytest.raises(ValueError, match="exact nonempty TraceEventV3 tuple"):
        summarize((), scenario, gate)
    with pytest.raises(ValueError, match="schema-4 ADAS scenario"):
        summarize(events, scenario.model_copy(update={"adas": None}), gate)
    with pytest.raises(ValueError, match="schema-2 ADAS gate"):
        summarize(events, scenario, gate.model_copy(update={"adas": None}))


def test_summary_is_immutable_and_uses_typed_views_not_redundant_summary_dict(
    repository_root: Path,
) -> None:
    summary_module = import_module("hermes.evidence.adas_summary")
    events, scenario, gate = _typed_fact_events(repository_root)

    summary = summary_module.summarize_adas_run(events, scenario, gate)

    assert summary.minimum_result_ttc_s == pytest.approx(2.0)
    assert summary.minimum_result_lead_distance_m == pytest.approx(6.0)
    assert summary.first_warning_ttc_s == pytest.approx(4.0)
    assert summary.first_aeb_onset_ttc_s == pytest.approx(4.0)
    assert summary.first_aeb_onset_required_decel_mps2 == pytest.approx(2.5)
    assert summary.first_aeb_onset_execution_time_s == pytest.approx(0.1)
    assert summary.first_aeb_onset_source_sequence == 0
    with pytest.raises(FrozenInstanceError):
        summary.event_count = 99


def test_run_metrics_v3_computes_all_19_scoped_rows_from_exact_typed_views(
    repository_root: Path,
) -> None:
    metrics = _metrics(repository_root)

    assert metrics.collision_count == 1
    assert metrics.collision_occurred == BooleanMeasurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=True,
    )
    assert metrics.minimum_ttc_s.value == pytest.approx(2.0)
    assert metrics.route_completion_pct.value == pytest.approx(75.0)
    assert metrics.ttc_at_warning_s.value == pytest.approx(4.0)
    assert metrics.ttc_at_brake_onset_s.value == pytest.approx(4.0)
    # First collision edge is sequence 1; a later colliding sample is deliberately faster.
    assert metrics.impact_residual_speed_mps.value == pytest.approx(7.0)
    assert metrics.minimum_lead_distance_m.value == pytest.approx(6.0)
    assert metrics.adas.fcw.warning_count.value == 1
    assert metrics.adas.fcw.first_warning_time_s.value == pytest.approx(0.0)
    assert metrics.adas.fcw.false_warning_count.value == 1
    assert metrics.adas.aeb.intervention_count.value == 1
    assert metrics.adas.aeb.first_intervention_time_s.value == pytest.approx(0.1)
    assert metrics.adas.aeb.max_deceleration_mps2.value == pytest.approx(2.0)
    # Includes the onset edge (10 -> -2) and excludes the unattributed release (-2 -> -100).
    assert metrics.adas.aeb.max_jerk_mps3.value == pytest.approx(120.0)
    assert metrics.adas.aeb.false_intervention_count.value == 1
    assert metrics.adas.aeb.required_decel_at_onset_mps2.value == pytest.approx(2.5)
    # Nearest-rank p95 of three samples selects rank 3 without interpolation.
    assert metrics.p95_observation_age_s.value == pytest.approx(0.99)
    assert metrics.p95_control_latency_ms.value == pytest.approx(100.0)
    assert metrics.steering_saturation_count == 0
    assert metrics.brake_saturation_count == 1


def test_run_metrics_v3_preserves_exact_measurement_types_units_and_61_leaf_shape(
    repository_root: Path,
) -> None:
    metrics = _metrics(repository_root)
    computed_display_rows = {
        "collision.count": (("collision_count",),),
        "collision.occurred": (("collision_occurred",),),
        "ttc.minimum_s": (("minimum_ttc_s",),),
        "ttc.at_warning_s": (("ttc_at_warning_s",),),
        "ttc.at_brake_onset_s": (("ttc_at_brake_onset_s",),),
        "impact.residual_speed_mps": (("impact_residual_speed_mps",),),
        "distance.minimum_lead_m": (("minimum_lead_distance_m",),),
        "fcw.warning_count": (("adas", "fcw", "warning_count"),),
        "fcw.first_warning_time_s": (("adas", "fcw", "first_warning_time_s"),),
        "fcw.false_warning_count": (("adas", "fcw", "false_warning_count"),),
        "aeb.intervention_count": (("adas", "aeb", "intervention_count"),),
        "aeb.first_intervention_time_s": (
            ("adas", "aeb", "first_intervention_time_s"),
        ),
        "aeb.max_deceleration_mps2": (
            ("adas", "aeb", "max_deceleration_mps2"),
        ),
        "aeb.max_jerk_mps3": (("adas", "aeb", "max_jerk_mps3"),),
        "aeb.false_intervention_count": (
            ("adas", "aeb", "false_intervention_count"),
        ),
        "aeb.required_decel_at_onset_mps2": (
            ("adas", "aeb", "required_decel_at_onset_mps2"),
        ),
        "system.observation_age_p95_s": (("p95_observation_age_s",),),
        "system.control_latency_p95_ms": (("p95_control_latency_ms",),),
        "system.control_saturation_count": (
            ("steering_saturation_count",),
            ("brake_saturation_count",),
        ),
    }
    assert len(computed_display_rows) == 19
    assert len(computed_display_rows) + len(_DEFERRED_FIELDS) == 46
    for accessor_paths in computed_display_rows.values():
        for accessor_path in accessor_paths:
            assert _at_path(metrics, accessor_path) is not None

    wrappers = {
        "collision_occurred": (BooleanMeasurement, None),
        "minimum_ttc_s": (Measurement, "s"),
        "ttc_at_warning_s": (Measurement, "s"),
        "ttc_at_brake_onset_s": (Measurement, "s"),
        "impact_residual_speed_mps": (Measurement, "m/s"),
        "minimum_lead_distance_m": (Measurement, "m"),
        "p95_observation_age_s": (Measurement, "s"),
        "p95_control_latency_ms": (Measurement, "ms"),
        "adas.fcw.warning_count": (CountMeasurement, "warnings"),
        "adas.fcw.first_warning_time_s": (Measurement, "s"),
        "adas.fcw.false_warning_count": (CountMeasurement, "warnings"),
        "adas.aeb.intervention_count": (CountMeasurement, "interventions"),
        "adas.aeb.first_intervention_time_s": (Measurement, "s"),
        "adas.aeb.max_deceleration_mps2": (Measurement, "m/s^2"),
        "adas.aeb.max_jerk_mps3": (Measurement, "m/s^3"),
        "adas.aeb.false_intervention_count": (CountMeasurement, "interventions"),
        "adas.aeb.required_decel_at_onset_mps2": (Measurement, "m/s^2"),
    }
    for dotted_path, (expected_type, unit) in wrappers.items():
        value = _at_path(metrics, tuple(dotted_path.split(".")))
        assert type(value) is expected_type
        assert value.unit == unit
        assert value.availability is EvidenceAvailability.AVAILABLE

    payload = metrics.model_dump(mode="json")
    leaves = set(payload) - {"evidence_schema_version", "adas"}
    leaves.update(
        f"adas.{group}.{field}"
        for group, group_payload in payload["adas"].items()
        for field in group_payload
    )
    assert len(leaves) == 61


def test_all_27_deferred_rows_keep_exact_reason_unit_and_typed_unavailability(
    repository_root: Path,
) -> None:
    metrics = _metrics(repository_root)
    expected_units = {
        "missed_warning": None,
        "warning_chatter_count": "transitions",
        "missed_intervention": None,
        "headway_target_s": "s",
        "headway_minimum_s": "s",
        "headway_mae_s": "s",
        "speed_error_mae_mps": "m/s",
        "cut_in_recovery_s": "s",
        "max_acceleration_mps2": "m/s^2",
        "max_deceleration_mps2": "m/s^2",
        "max_jerk_mps3": "m/s^3",
        "lateral_error_mae_m": "m",
        "lateral_error_max_m": "m",
        "lane_crossing_count": "crossings",
        "steering_oscillation_count": "oscillations",
        "max_lateral_accel_mps2": "m/s^2",
        "max_lateral_jerk_mps3": "m/s^3",
        "degraded_count": "transitions",
        "curve_steady_state_error_m": "m",
        "mode_transition_count": "transitions",
        "takeover_request_count": "requests",
        "disengagement_count": "transitions",
        "route_completion_pct": "%",
        "constraint_violation_count": "violations",
        "sensor_invalid_count": "events",
        "runtime_error_count": "errors",
    }
    assert len(_DEFERRED_FIELDS) == 27
    for path, reason in _DEFERRED_FIELDS:
        value = _at_path(metrics, path)
        assert value.availability is EvidenceAvailability.NOT_AVAILABLE
        assert value.value is None
        assert value.reason == reason
        assert value.unit == expected_units[path[-1]]


def test_scenario_owned_applicability_does_not_infer_enabled_functions_from_events(
    repository_root: Path,
) -> None:
    fcw_only = _metrics(repository_root, enabled=("fcw",))
    aeb_only = _metrics(repository_root, enabled=("aeb",))

    assert fcw_only.adas.fcw.warning_count.value == 1
    for value in (
        fcw_only.adas.aeb.intervention_count,
        fcw_only.adas.aeb.first_intervention_time_s,
        fcw_only.adas.aeb.max_deceleration_mps2,
        fcw_only.adas.aeb.max_jerk_mps3,
        fcw_only.adas.aeb.false_intervention_count,
        fcw_only.adas.aeb.required_decel_at_onset_mps2,
    ):
        assert value.availability is EvidenceAvailability.NOT_AVAILABLE
        assert value.reason == _AEB_DISABLED

    assert aeb_only.adas.aeb.intervention_count.value == 1
    for value in (
        aeb_only.adas.fcw.warning_count,
        aeb_only.adas.fcw.first_warning_time_s,
        aeb_only.adas.fcw.false_warning_count,
    ):
        assert value.availability is EvidenceAvailability.NOT_AVAILABLE
        assert value.reason == _FCW_DISABLED
