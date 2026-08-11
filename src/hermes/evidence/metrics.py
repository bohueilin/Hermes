"""Pure deterministic metric computation over immutable trace events."""

from __future__ import annotations

import math
from collections import Counter

from hermes.domain.enums import EvidenceAvailability
from hermes.domain.models import Measurement, RunMetrics, RunMetricsV2, TraceEvent, TraceEventV2
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


def _nearest_rank_percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile * len(ordered)))
    return ordered[rank - 1]


def compute_metrics(
    events: tuple[TraceEvent | TraceEventV2, ...],
) -> RunMetrics | RunMetricsV2:
    """Recompute all Phase 1 metrics without adapter or policy access."""
    if not events:
        raise ValueError("cannot compute metrics from an empty trace")
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
