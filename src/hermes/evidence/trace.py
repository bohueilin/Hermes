"""Construction, serialization, and structural verification of event hash chains."""

from __future__ import annotations

import math
from typing import Any

from hermes.domain.models import (
    Action,
    RunContext,
    ScenarioDefinition,
    TraceEvent,
    VehicleState,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex

GENESIS_HASH = "0" * 64


class TraceIntegrityError(ValueError):
    """The first structural or cryptographic trace failure."""


def create_trace_event(
    *,
    sequence: int,
    simulation_time_s: float,
    run_context: RunContext,
    observation_summary: dict[str, Any],
    candidate_action: Action,
    executed_action: Action,
    override_reasons: tuple[str, ...],
    vehicle_state: VehicleState,
    policy_latency_ms: float,
    latency_source: str,
    terminated: bool,
    truncated: bool,
    termination_reason: object,
    raw_facts: dict[str, Any],
    previous_hash: str,
) -> TraceEvent:
    """Build an immutable event whose hash excludes only its current-hash field."""
    payload: dict[str, Any] = {
        "evidence_schema_version": "1.0",
        "sequence": sequence,
        "simulation_time_s": simulation_time_s,
        "run_context": run_context.model_dump(mode="json"),
        "observation_summary": observation_summary,
        "candidate_action": candidate_action.model_dump(mode="json"),
        "executed_action": executed_action.model_dump(mode="json"),
        "override_reasons": override_reasons,
        "vehicle_state": vehicle_state.model_dump(mode="json"),
        "policy_latency_ms": policy_latency_ms,
        "latency_source": latency_source,
        "terminated": terminated,
        "truncated": truncated,
        "termination_reason": termination_reason,
        "raw_facts": raw_facts,
        "previous_hash": previous_hash,
    }
    json_payload = TraceEvent.model_validate({**payload, "current_hash": "0" * 64}).model_dump(
        mode="json", exclude={"current_hash"}
    )
    current_hash = sha256_hex(canonical_json_bytes(json_payload))
    return TraceEvent.model_validate({**payload, "current_hash": current_hash})


def event_hash(event: TraceEvent) -> str:
    """Recompute one event hash from its canonical hash material."""
    payload = event.model_dump(mode="json", exclude={"current_hash"})
    return sha256_hex(canonical_json_bytes(payload))


def verify_event_chain(events: tuple[TraceEvent, ...]) -> str:
    """Verify sequence continuity, time ordering, links, and every event hash."""
    if not events:
        raise TraceIntegrityError("trace contains no events")
    expected_previous = GENESIS_HASH
    previous_time = -1.0
    context = events[0].run_context
    for expected_sequence, event in enumerate(events):
        if event.sequence != expected_sequence:
            raise TraceIntegrityError(
                f"expected sequence {expected_sequence}, observed {event.sequence}"
            )
        if event.simulation_time_s <= previous_time:
            raise TraceIntegrityError(
                f"simulation time is not strictly increasing at sequence {event.sequence}"
            )
        if event.run_context != context:
            raise TraceIntegrityError(f"run context changed at sequence {event.sequence}")
        if event.previous_hash != expected_previous:
            raise TraceIntegrityError(f"previous hash mismatch at sequence {event.sequence}")
        recomputed = event_hash(event)
        if event.current_hash != recomputed:
            raise TraceIntegrityError(f"current hash mismatch at sequence {event.sequence}")
        expected_previous = event.current_hash
        previous_time = event.simulation_time_s
    return expected_previous


_OBSERVATION_SUMMARY_FIELDS = {
    "input_sequence",
    "input_simulation_time_s",
    "speed_mps",
    "lateral_offset_m",
    "route_progress_pct",
    "observation_age_s",
}


def _summary_number(event: TraceEvent, field_name: str) -> float:
    value = event.observation_summary[field_name]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TraceIntegrityError(
            f"observation summary {field_name} is not numeric at sequence {event.sequence}"
        )
    if not math.isfinite(value):
        raise TraceIntegrityError(
            f"observation summary {field_name} is not finite at sequence {event.sequence}"
        )
    return float(value)


def _verify_observation_summary(
    events: tuple[TraceEvent, ...],
    index: int,
    scenario: ScenarioDefinition | None,
) -> None:
    event = events[index]
    if set(event.observation_summary) != _OBSERVATION_SUMMARY_FIELDS:
        raise TraceIntegrityError(
            f"observation summary fields are incomplete or unsupported at sequence "
            f"{event.sequence}"
        )
    input_sequence = event.observation_summary["input_sequence"]
    if isinstance(input_sequence, bool) or not isinstance(input_sequence, int):
        raise TraceIntegrityError(
            f"observation summary input_sequence is not an integer at sequence {event.sequence}"
        )
    if input_sequence != event.sequence:
        raise TraceIntegrityError(
            f"observation summary input_sequence disagrees at sequence {event.sequence}"
        )
    expected_input_time = event.sequence / event.run_context.control_frequency_hz
    input_time = _summary_number(event, "input_simulation_time_s")
    if not math.isclose(input_time, expected_input_time, rel_tol=0.0, abs_tol=1e-12):
        raise TraceIntegrityError(
            f"observation summary input_simulation_time_s disagrees at sequence "
            f"{event.sequence}"
        )
    age = _summary_number(event, "observation_age_s")
    observed_time = input_time - age
    if age < 0.0 or observed_time < -1e-12:
        raise TraceIntegrityError(
            f"observation summary age is impossible at sequence {event.sequence}"
        )

    expected_values: tuple[float, float, float] | None = None
    if math.isclose(observed_time, 0.0, rel_tol=0.0, abs_tol=1e-12):
        if scenario is not None:
            expected_values = (
                scenario.initial_state.speed_mps,
                scenario.initial_state.lateral_offset_m,
                0.0,
            )
    else:
        prior = next(
            (
                candidate
                for candidate in events[:index]
                if math.isclose(
                    candidate.simulation_time_s,
                    observed_time,
                    rel_tol=0.0,
                    abs_tol=1e-12,
                )
            ),
            None,
        )
        if prior is None:
            raise TraceIntegrityError(
                f"observation summary age has no matching prior state at sequence "
                f"{event.sequence}"
            )
        expected_values = (
            prior.vehicle_state.speed_mps,
            prior.vehicle_state.lateral_offset_m,
            prior.vehicle_state.route_progress_pct,
        )

    observed_values = (
        _summary_number(event, "speed_mps"),
        _summary_number(event, "lateral_offset_m"),
        _summary_number(event, "route_progress_pct"),
    )
    if expected_values is not None:
        for field_name, observed, expected in zip(
            ("speed_mps", "lateral_offset_m", "route_progress_pct"),
            observed_values,
            expected_values,
            strict=True,
        ):
            if not math.isclose(observed, expected, rel_tol=0.0, abs_tol=1e-12):
                raise TraceIntegrityError(
                    f"observation summary {field_name} disagrees with prior executed state "
                    f"at sequence {event.sequence}"
                )


def verify_complete_trace(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition | None = None,
) -> str:
    """Verify chain plus semantic completeness and redundant-fact consistency."""
    root = verify_event_chain(events)
    configured_horizon = events[0].run_context.horizon_steps
    if len(events) > configured_horizon:
        raise TraceIntegrityError(
            f"trace has {len(events)} events but configured horizon is {configured_horizon}"
        )
    for index, event in enumerate(events):
        _verify_observation_summary(events, index, scenario)
        expected_time = (event.sequence + 1) / event.run_context.control_frequency_hz
        if not math.isclose(event.simulation_time_s, expected_time, rel_tol=0.0, abs_tol=1e-12):
            raise TraceIntegrityError(
                f"simulation time disagrees with control frequency at sequence {event.sequence}"
            )
        facts = event.raw_facts
        state = event.vehicle_state
        if (
            facts.collision != (state.collision_count > 0)
            or facts.collision_count != state.collision_count
        ):
            raise TraceIntegrityError(f"collision facts disagree at sequence {event.sequence}")
        if facts.offroad != state.offroad:
            raise TraceIntegrityError(f"offroad facts disagree at sequence {event.sequence}")
        if facts.destination_reached != state.destination_reached:
            raise TraceIntegrityError(
                f"destination facts disagree at sequence {event.sequence}"
            )
        if facts.route_progress_available:
            if facts.route_progress_pct != state.route_progress_pct:
                raise TraceIntegrityError(
                    f"route-progress facts disagree at sequence {event.sequence}"
                )
        elif facts.route_progress_pct is not None:
            raise TraceIntegrityError(
                f"unavailable route progress has a value at sequence {event.sequence}"
            )
        if event.run_context.shield_name == "noop" and (
            event.candidate_action != event.executed_action or event.override_reasons
        ):
            raise TraceIntegrityError(
                f"no-op shield evidence is contradictory at sequence {event.sequence}"
            )
        if (
            event.run_context.shield_name != "noop"
            and event.candidate_action != event.executed_action
            and not event.override_reasons
        ):
            raise TraceIntegrityError(
                f"action override lacks a reason at sequence {event.sequence}"
            )
        if event.run_context.policy_name == "baseline" and event.latency_source != "simulated":
            raise TraceIntegrityError(
                f"baseline policy latency_source must be simulated at sequence {event.sequence}"
            )

        is_last = index == len(events) - 1
        if not is_last and (
            event.terminated
            or event.truncated
            or event.termination_reason.value != "NONE"
        ):
            raise TraceIntegrityError(
                f"terminal state appears before final event at sequence {event.sequence}"
            )
        if is_last:
            if event.terminated == event.truncated:
                raise TraceIntegrityError(
                    "final event must be exactly one of terminated or truncated"
                )
            if event.termination_reason.value == "NONE":
                raise TraceIntegrityError("final event requires a termination reason")
            if event.truncated and len(events) != configured_horizon:
                raise TraceIntegrityError(
                    "horizon termination occurred before configured horizon: "
                    f"{len(events)} of {configured_horizon} events"
                )
            expected_reason = None
            if state.collision_count > 0:
                expected_reason = "COLLISION"
            elif state.offroad:
                expected_reason = "OFF_ROAD"
            elif state.destination_reached:
                expected_reason = "DESTINATION_REACHED"
            elif event.truncated:
                expected_reason = "HORIZON"
            if expected_reason is None or event.termination_reason.value != expected_reason:
                raise TraceIntegrityError(
                    f"termination reason contradicts final state at sequence {event.sequence}"
                )
    return root


def events_jsonl_bytes(events: tuple[TraceEvent, ...]) -> bytes:
    """Serialize events one canonical JSON object per UTF-8 line."""
    return b"".join(
        canonical_json_bytes(event.model_dump(mode="json")) + b"\n" for event in events
    )
