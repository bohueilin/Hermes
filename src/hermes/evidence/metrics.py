"""Pure deterministic metric computation over immutable trace events."""

from __future__ import annotations

import math
from collections import Counter

from hermes.domain.enums import EvidenceAvailability
from hermes.domain.models import Measurement, RunMetrics, TraceEvent


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


def compute_metrics(events: tuple[TraceEvent, ...]) -> RunMetrics:
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
    reason_counts = Counter(reason for event in events for reason in event.override_reasons)
    return RunMetrics(
        event_count=len(events),
        simulation_duration_s=events[-1].simulation_time_s,
        collision_count=collision_count,
        max_abs_lateral_offset_m=max_lateral,
        offroad_duration_s=offroad_duration,
        route_completion_pct=route_completion,
        max_abs_acceleration_mps2=max_acceleration,
        max_abs_jerk_mps3=max_jerk,
        p95_policy_latency_ms=p95_latency,
        shield_override_count=sum(reason_counts.values()),
        shield_override_reasons=dict(sorted(reason_counts.items())),
        termination_reason=events[-1].termination_reason,
    )
