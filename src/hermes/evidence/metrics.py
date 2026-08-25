"""Pure deterministic metric computation over immutable trace events."""

from __future__ import annotations

import math
from collections import Counter

from hermes.domain.enums import EvidenceAvailability
from hermes.domain.models import (
    AccMetricsV3,
    AdasMetricsV3,
    AebMetricsV3,
    AssistMetricsV3,
    BooleanMeasurement,
    CountMeasurement,
    FcwMetricsV3,
    LkaMetricsV3,
    Measurement,
    RunMetrics,
    RunMetricsV2,
    RunMetricsV3,
    ScenarioDefinition,
    TraceEvent,
    TraceEventV2,
    TraceEventV3,
)
from hermes.evidence.adas_summary import AdasRunSummary, summarize_adas_run
from hermes.gates.config import GateConfig
from hermes.shields.deterministic import SUPPORTED_OVERRIDE_REASONS


def _available(value: float, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=value,
        unit=unit,
    )


def _unavailable(reason: str, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.NOT_AVAILABLE,
        reason=reason,
        unit=unit,
    )


def _available_count(value: int, unit: str) -> CountMeasurement:
    return CountMeasurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=value,
        unit=unit,
    )


def _unavailable_count(reason: str, unit: str | None = None) -> CountMeasurement:
    return CountMeasurement(
        availability=EvidenceAvailability.NOT_AVAILABLE,
        reason=reason,
        unit=unit,
    )


def _available_boolean(value: bool, unit: str | None = None) -> BooleanMeasurement:
    return BooleanMeasurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=value,
        unit=unit,
    )


def _unavailable_boolean(reason: str, unit: str | None = None) -> BooleanMeasurement:
    return BooleanMeasurement(
        availability=EvidenceAvailability.NOT_AVAILABLE,
        reason=reason,
        unit=unit,
    )


def _nearest_rank_percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile * len(ordered)))
    return ordered[rank - 1]


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
_FCW_DISABLED = "FCW is not enabled by the scenario"
_AEB_DISABLED = "AEB is not enabled by the scenario"


def _permanently_unavailable_functions() -> tuple[AccMetricsV3, LkaMetricsV3, AssistMetricsV3]:
    unavailable = _FUNCTION_NOT_IMPLEMENTED
    return (
        AccMetricsV3(
            headway_target_s=_unavailable(unavailable, "s"),
            headway_minimum_s=_unavailable(unavailable, "s"),
            headway_mae_s=_unavailable(unavailable, "s"),
            speed_error_mae_mps=_unavailable(unavailable, "m/s"),
            cut_in_recovery_s=_unavailable(unavailable, "s"),
            max_acceleration_mps2=_unavailable(unavailable, "m/s^2"),
            max_deceleration_mps2=_unavailable(unavailable, "m/s^2"),
            max_jerk_mps3=_unavailable(unavailable, "m/s^3"),
        ),
        LkaMetricsV3(
            lateral_error_mae_m=_unavailable(unavailable, "m"),
            lateral_error_max_m=_unavailable(unavailable, "m"),
            lane_crossing_count=_unavailable_count(unavailable, "crossings"),
            steering_oscillation_count=_unavailable_count(
                unavailable, "oscillations"
            ),
            max_lateral_accel_mps2=_unavailable(unavailable, "m/s^2"),
            max_lateral_jerk_mps3=_unavailable(unavailable, "m/s^3"),
            degraded_count=_unavailable_count(unavailable, "transitions"),
            curve_steady_state_error_m=_unavailable(unavailable, "m"),
        ),
        AssistMetricsV3(
            mode_transition_count=_unavailable_count(unavailable, "transitions"),
            degraded_count=_unavailable_count(unavailable, "transitions"),
            takeover_request_count=_unavailable_count(unavailable, "requests"),
            disengagement_count=_unavailable_count(unavailable, "transitions"),
            route_completion_pct=_unavailable(unavailable, "%"),
            constraint_violation_count=_unavailable_count(unavailable, "violations"),
        ),
    )


def _metrics_v3_from_summary(summary: AdasRunSummary) -> RunMetricsV3:
    route_completion = (
        _available(max(summary.route_progress_values), "%")
        if summary.route_progress_complete
        else _unavailable("route progress explicitly unavailable", "%")
    )
    minimum_ttc = (
        _available(summary.minimum_result_ttc_s, "s")
        if summary.minimum_result_ttc_s is not None
        else _unavailable("no paired closing front-object evidence", "s")
    )
    max_jerk = (
        _available(max(summary.all_jerk_mps3), "m/s^3")
        if summary.all_jerk_mps3
        else _unavailable("fewer than two result samples", "m/s^3")
    )
    p95_control_latency = (
        _available(
            _nearest_rank_percentile(list(summary.control_latencies_ms), 0.95),
            "ms",
        )
        if summary.control_latencies_ms
        else _unavailable(
            "control-delay startup fill has no originating candidate",
            "ms",
        )
    )

    if summary.fcw_enabled:
        warning_count = _available_count(summary.warning_onset_count, "warnings")
        first_warning_time = (
            _available(summary.first_warning_time_s, "s")
            if summary.first_warning_time_s is not None
            else _unavailable("no FCW warning was emitted", "s")
        )
        false_warning_count = (
            _available_count(summary.warning_onset_count, "warnings")
            if summary.false_fcw_exposure
            else _unavailable_count(
                "scenario does not declare whole-run threat-free FCW exposure",
                "warnings",
            )
        )
        ttc_at_warning = (
            _available(summary.first_warning_ttc_s, "s")
            if summary.first_warning_ttc_s is not None
            else _unavailable("no FCW warning was emitted", "s")
        )
    else:
        warning_count = _unavailable_count(_FCW_DISABLED, "warnings")
        first_warning_time = _unavailable(_FCW_DISABLED, "s")
        false_warning_count = _unavailable_count(_FCW_DISABLED, "warnings")
        ttc_at_warning = _unavailable(_FCW_DISABLED, "s")

    if summary.aeb_enabled:
        intervention_count = _available_count(
            summary.aeb_onset_count, "interventions"
        )
        first_intervention_time = (
            _available(summary.first_aeb_onset_execution_time_s, "s")
            if summary.first_aeb_onset_execution_time_s is not None
            else _unavailable("no AEB intervention was executed", "s")
        )
        max_deceleration = (
            _available(max(summary.aeb_decelerations_mps2), "m/s^2")
            if summary.aeb_decelerations_mps2
            else _unavailable("no AEB execution interval", "m/s^2")
        )
        max_aeb_jerk = (
            _available(max(summary.aeb_jerks_mps3), "m/s^3")
            if summary.aeb_jerks_mps3
            else _unavailable("no AEB execution interval", "m/s^3")
        )
        false_intervention_count = (
            _available_count(summary.aeb_onset_count, "interventions")
            if summary.false_aeb_exposure
            else _unavailable_count(
                "scenario does not declare whole-run forbidden AEB exposure",
                "interventions",
            )
        )
        ttc_at_brake_onset = (
            _available(summary.first_aeb_onset_ttc_s, "s")
            if summary.first_aeb_onset_ttc_s is not None
            else _unavailable("no AEB-attributed brake onset", "s")
        )
        required_decel_at_onset = (
            _available(summary.first_aeb_onset_required_decel_mps2, "m/s^2")
            if summary.first_aeb_onset_required_decel_mps2 is not None
            else _unavailable("no AEB-attributed brake onset", "m/s^2")
        )
    else:
        intervention_count = _unavailable_count(_AEB_DISABLED, "interventions")
        first_intervention_time = _unavailable(_AEB_DISABLED, "s")
        max_deceleration = _unavailable(_AEB_DISABLED, "m/s^2")
        max_aeb_jerk = _unavailable(_AEB_DISABLED, "m/s^3")
        false_intervention_count = _unavailable_count(
            _AEB_DISABLED, "interventions"
        )
        ttc_at_brake_onset = _unavailable(_AEB_DISABLED, "s")
        required_decel_at_onset = _unavailable(_AEB_DISABLED, "m/s^2")

    acc, lka, assist = _permanently_unavailable_functions()
    return RunMetricsV3(
        event_count=summary.event_count,
        simulation_duration_s=summary.simulation_duration_s,
        collision_count=summary.collision_count,
        max_abs_lateral_offset_m=summary.max_abs_lateral_offset_m,
        offroad_duration_s=summary.offroad_duration_s,
        route_completion_pct=route_completion,
        minimum_ttc_s=minimum_ttc,
        max_abs_acceleration_mps2=_available(
            summary.max_abs_acceleration_mps2, "m/s^2"
        ),
        max_abs_jerk_mps3=max_jerk,
        p95_policy_latency_ms=_available(
            _nearest_rank_percentile(list(summary.policy_latencies_ms), 0.95),
            "ms",
        ),
        shield_override_count=summary.shield_override_count,
        shield_override_reasons=dict(summary.shield_override_reasons),
        termination_reason=summary.termination_reason,
        fault_application_counts=dict(summary.fault_application_counts),
        max_observation_age_s=_available(max(summary.observation_ages_s), "s"),
        p95_control_latency_ms=p95_control_latency,
        control_fill_count=summary.control_fill_count,
        steering_saturation_count=summary.steering_saturation_count,
        brake_saturation_count=summary.brake_saturation_count,
        collision_occurred=_available_boolean(summary.collision_count > 0),
        ttc_at_warning_s=ttc_at_warning,
        ttc_at_brake_onset_s=ttc_at_brake_onset,
        impact_residual_speed_mps=(
            _available(summary.first_collision_residual_speed_mps, "m/s")
            if summary.first_collision_residual_speed_mps is not None
            else _unavailable("no collision occurred", "m/s")
        ),
        minimum_lead_distance_m=(
            _available(summary.minimum_result_lead_distance_m, "m")
            if summary.minimum_result_lead_distance_m is not None
            else _unavailable("no in-path lead was observed", "m")
        ),
        p95_observation_age_s=_available(
            _nearest_rank_percentile(list(summary.observation_ages_s), 0.95),
            "s",
        ),
        sensor_invalid_count=_unavailable_count(
            _SENSOR_INVALID_NOT_REPRESENTED, "events"
        ),
        runtime_error_count=_unavailable_count(_RUNTIME_ERRORS_NOT_RETAINED, "errors"),
        adas=AdasMetricsV3(
            fcw=FcwMetricsV3(
                warning_count=warning_count,
                first_warning_time_s=first_warning_time,
                false_warning_count=false_warning_count,
                missed_warning=_unavailable_boolean(_WINDOW_NOT_REPRESENTED),
                warning_chatter_count=_unavailable_count(
                    _CHATTER_NOT_DEFINED, "transitions"
                ),
            ),
            aeb=AebMetricsV3(
                intervention_count=intervention_count,
                first_intervention_time_s=first_intervention_time,
                max_deceleration_mps2=max_deceleration,
                max_jerk_mps3=max_aeb_jerk,
                false_intervention_count=false_intervention_count,
                missed_intervention=_unavailable_boolean(_WINDOW_NOT_REPRESENTED),
                required_decel_at_onset_mps2=required_decel_at_onset,
            ),
            acc=acc,
            lka=lka,
            assist=assist,
        ),
    )


def compute_metrics(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    *,
    scenario: ScenarioDefinition | None = None,
    gate_config: GateConfig | None = None,
) -> RunMetrics | RunMetricsV2 | RunMetricsV3:
    """Recompute all Phase 1 metrics without adapter or policy access."""
    if not events:
        raise ValueError("cannot compute metrics from an empty trace")
    if type(events[0]) is TraceEventV3:
        if any(type(event) is not TraceEventV3 for event in events):
            raise ValueError("trace cannot mix evidence schema versions")
        if scenario is None or gate_config is None:
            raise ValueError("schema-3 metrics require resolved scenario and gate inputs")
        return _metrics_v3_from_summary(
            summarize_adas_run(
                tuple(event for event in events if type(event) is TraceEventV3),
                scenario,
                gate_config,
            )
        )
    if any(type(event) is TraceEventV3 for event in events):
        raise ValueError("trace cannot mix evidence schema versions")
    frequency_hz = events[0].run_context.control_frequency_hz
    dt = 1.0 / frequency_hz
    collision_count = max(event.vehicle_state.collision_count for event in events)
    max_lateral = max(abs(event.vehicle_state.lateral_offset_m) for event in events)
    offroad_duration = sum(dt for event in events if event.vehicle_state.offroad)

    if all(event.raw_facts.route_progress_available for event in events):
        route_completion = _available(
            max(event.vehicle_state.route_progress_pct for event in events), "%"
        )
    else:
        route_completion = _unavailable("route progress explicitly unavailable", "%")

    accelerations = [abs(event.vehicle_state.acceleration_mps2) for event in events]
    max_acceleration = _available(max(accelerations), "m/s^2")
    if len(events) >= 2:
        jerks = [
            abs(
                events[index].vehicle_state.acceleration_mps2
                - events[index - 1].vehicle_state.acceleration_mps2
            )
            / dt
            for index in range(1, len(events))
        ]
        max_jerk = _available(max(jerks), "m/s^3")
    else:
        max_jerk = _unavailable("at least two events are required to compute jerk", "m/s^3")

    latencies = [event.policy_latency_ms for event in events]
    p95_latency = _available(_nearest_rank_percentile(latencies, 0.95), "ms")
    ttc_samples: list[float] = []
    has_front_evidence_fields = False
    for event in events:
        distance_field = (
            "result_front_distance_m"
            if "result_front_distance_m" in event.observation_summary
            else "front_distance_m"
        )
        relative_speed_field = (
            "result_front_relative_speed_mps"
            if "result_front_relative_speed_mps" in event.observation_summary
            else "front_relative_speed_mps"
        )
        has_front_evidence_fields = has_front_evidence_fields or (
            distance_field in event.observation_summary
            and relative_speed_field in event.observation_summary
        )
        distance = event.observation_summary.get(distance_field)
        relative_speed = event.observation_summary.get(relative_speed_field)
        if (
            isinstance(distance, (int, float))
            and not isinstance(distance, bool)
            and isinstance(relative_speed, (int, float))
            and not isinstance(relative_speed, bool)
            and math.isfinite(distance)
            and math.isfinite(relative_speed)
            and distance >= 0.0
            and relative_speed < 0.0
        ):
            ttc_samples.append(float(distance) / -float(relative_speed))
    minimum_ttc = (
        _available(min(ttc_samples), "s")
        if ttc_samples
        else _unavailable(
            (
                "no paired closing front-object evidence"
                if has_front_evidence_fields
                else "front-object TTC evidence is unavailable for this trace"
            ),
            "s",
        )
    )
    reason_counts = Counter(
        reason
        for event in events
        for reason in event.override_reasons
        if reason in SUPPORTED_OVERRIDE_REASONS
    )
    common = dict(
        event_count=len(events),
        simulation_duration_s=events[-1].simulation_time_s,
        collision_count=collision_count,
        max_abs_lateral_offset_m=max_lateral,
        offroad_duration_s=offroad_duration,
        route_completion_pct=route_completion,
        minimum_ttc_s=minimum_ttc,
        max_abs_acceleration_mps2=max_acceleration,
        max_abs_jerk_mps3=max_jerk,
        p95_policy_latency_ms=p95_latency,
        shield_override_count=sum(
            event.candidate_action
            != (
                event.permitted_action
                if isinstance(event, TraceEventV2)
                else event.executed_action
            )
            for event in events
        ),
        shield_override_reasons=dict(sorted(reason_counts.items())),
        termination_reason=events[-1].termination_reason,
    )
    if not isinstance(events[0], TraceEventV2):
        return RunMetrics(**common)
    if not all(isinstance(event, TraceEventV2) for event in events):
        raise ValueError("trace cannot mix evidence schema versions")
    fault_events = tuple(event for event in events if isinstance(event, TraceEventV2))
    fault_counts = Counter(
        reason
        for event in fault_events
        for reason in (
            *event.observation_fault_evidence.applied_faults,
            *event.control_fault_evidence.applied_faults,
        )
    )
    control_latencies = [
        event.control_fault_evidence.control_latency_ms.value
        for event in fault_events
        if event.control_fault_evidence.control_latency_ms.availability
        is EvidenceAvailability.AVAILABLE
    ]
    return RunMetricsV2(
        **common,
        fault_application_counts=dict(sorted(fault_counts.items())),
        max_observation_age_s=_available(
            max(
                event.observation_fault_evidence.delivered_observation.observation_age_s
                for event in fault_events
            ),
            "s",
        ),
        p95_control_latency_ms=(
            _available(
                _nearest_rank_percentile(
                    [float(value) for value in control_latencies if value is not None],
                    0.95,
                ),
                "ms",
            )
            if control_latencies
            else _unavailable(
                "control-delay startup fill has no originating candidate",
                "ms",
            )
        ),
        control_fill_count=fault_counts["CONTROL_DELAY_FILL"],
        steering_saturation_count=fault_counts["STEERING_SATURATION"],
        brake_saturation_count=fault_counts["BRAKE_SATURATION"],
    )
