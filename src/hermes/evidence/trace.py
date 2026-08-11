"""Construction, serialization, and structural verification of event hash chains."""

from __future__ import annotations

import math
from typing import Any

from hermes.domain.models import (
    Action,
    ControlFaultEvidence,
    ObservationFaultEvidence,
    RunContext,
    RunContextV2,
    ScenarioDefinition,
    TraceEvent,
    TraceEventV2,
    VehicleState,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.faults.deterministic import ACTION_FAULT_REASONS, OBSERVATION_FAULT_REASONS
from hermes.shields.deterministic import SUPPORTED_OVERRIDE_REASONS

GENESIS_HASH = "0" * 64
TraceEventLike = TraceEvent | TraceEventV2


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


def create_trace_event_v2(
    *,
    sequence: int,
    simulation_time_s: float,
    run_context: RunContextV2,
    observation_summary: dict[str, Any],
    candidate_action: Action,
    permitted_action: Action,
    executed_action: Action,
    override_reasons: tuple[str, ...],
    observation_fault_evidence: ObservationFaultEvidence,
    control_fault_evidence: ControlFaultEvidence,
    result_observation,
    vehicle_state: VehicleState,
    policy_latency_ms: float,
    latency_source: str,
    terminated: bool,
    truncated: bool,
    termination_reason: object,
    raw_facts: dict[str, Any],
    previous_hash: str,
) -> TraceEventV2:
    """Build a schema-2 event without altering the legacy schema-1 hash path."""
    payload: dict[str, Any] = {
        "evidence_schema_version": "2.0",
        "sequence": sequence,
        "simulation_time_s": simulation_time_s,
        "run_context": run_context,
        "observation_summary": observation_summary,
        "candidate_action": candidate_action,
        "permitted_action": permitted_action,
        "executed_action": executed_action,
        "override_reasons": override_reasons,
        "observation_fault_evidence": observation_fault_evidence,
        "control_fault_evidence": control_fault_evidence,
        "result_observation": result_observation,
        "vehicle_state": vehicle_state,
        "policy_latency_ms": policy_latency_ms,
        "latency_source": latency_source,
        "terminated": terminated,
        "truncated": truncated,
        "termination_reason": termination_reason,
        "raw_facts": raw_facts,
        "previous_hash": previous_hash,
    }
    json_payload = TraceEventV2.model_validate(
        {**payload, "current_hash": "0" * 64}
    ).model_dump(mode="json", exclude={"current_hash"})
    current_hash = sha256_hex(canonical_json_bytes(json_payload))
    return TraceEventV2.model_validate({**payload, "current_hash": current_hash})


def event_hash(event: TraceEventLike) -> str:
    """Recompute one event hash from its canonical hash material."""
    payload = event.model_dump(mode="json", exclude={"current_hash"})
    return sha256_hex(canonical_json_bytes(payload))


def verify_event_chain(events: tuple[TraceEventLike, ...]) -> str:
    """Verify sequence continuity, time ordering, links, and every event hash."""
    if not events:
        raise TraceIntegrityError("trace contains no events")
    expected_previous = GENESIS_HASH
    previous_time = -1.0
    context = events[0].run_context
    schema_version = events[0].evidence_schema_version
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
        if event.evidence_schema_version != schema_version:
            raise TraceIntegrityError(f"evidence schema changed at sequence {event.sequence}")
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
_CHALLENGE_OBSERVATION_SUMMARY_FIELDS = _OBSERVATION_SUMMARY_FIELDS | {
    "front_distance_m",
    "front_relative_speed_mps",
    "challenge_actor_longitudinal_m",
    "challenge_actor_lateral_offset_m",
    "challenge_actor_speed_mps",
    "challenge_phase",
    "result_front_distance_m",
    "result_front_relative_speed_mps",
    "result_challenge_actor_longitudinal_m",
    "result_challenge_actor_lateral_offset_m",
    "result_challenge_actor_speed_mps",
    "result_challenge_phase",
}
_CHALLENGE_PHASES = {
    "PRE_TRIGGER",
    "BRAKING",
    "RECOVERY",
    "CUT_IN",
    "POST_CUT_IN",
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


def _verify_front_actor_fields(event: TraceEvent, *, prefix: str) -> None:
    distance_name = f"{prefix}front_distance_m"
    relative_name = f"{prefix}front_relative_speed_mps"
    distance = event.observation_summary[distance_name]
    relative_speed = event.observation_summary[relative_name]
    if (distance is None) != (relative_speed is None):
        raise TraceIntegrityError(
            f"observation summary {prefix}front-object evidence must be paired at sequence "
            f"{event.sequence}"
        )
    if distance is not None:
        if _summary_number(event, distance_name) < 0.0:
            raise TraceIntegrityError(
                f"observation summary {distance_name} is negative at sequence "
                f"{event.sequence}"
            )
        _summary_number(event, relative_name)
    _summary_number(event, f"{prefix}challenge_actor_longitudinal_m")
    _summary_number(event, f"{prefix}challenge_actor_lateral_offset_m")
    if _summary_number(event, f"{prefix}challenge_actor_speed_mps") < 0.0:
        raise TraceIntegrityError(
            f"observation summary {prefix}challenge_actor_speed_mps is negative at sequence "
            f"{event.sequence}"
        )
    phase = event.observation_summary[f"{prefix}challenge_phase"]
    if not isinstance(phase, str) or phase not in _CHALLENGE_PHASES:
        raise TraceIntegrityError(
            f"observation summary {prefix}challenge_phase is unsupported at sequence "
            f"{event.sequence}"
        )


def _expected_challenge_phase(
    scenario: ScenarioDefinition,
    sequence: int,
    *,
    result: bool,
) -> str:
    challenge = scenario.challenge
    if challenge is None:
        raise TraceIntegrityError("challenge configuration is unavailable")
    if challenge.kind == "lead_vehicle_hard_brake":
        trigger = challenge.trigger_step
        end = trigger + challenge.brake_duration_steps
        if sequence < trigger or (not result and sequence == trigger):
            return "PRE_TRIGGER"
        if sequence < end or (not result and sequence == end):
            return "BRAKING"
        return "RECOVERY"
    trigger = challenge.trigger_step
    end = trigger + challenge.transition_steps
    if sequence < trigger or (not result and sequence == trigger):
        return "PRE_TRIGGER"
    if sequence < end or (not result and sequence == end):
        return "CUT_IN"
    return "POST_CUT_IN"


def _challenge_values_match(left: object, right: object) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        return left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return math.isclose(float(left), float(right), rel_tol=0.0, abs_tol=1e-12)
    return left == right


def _verify_observation_summary(
    events: tuple[TraceEvent, ...],
    index: int,
    scenario: ScenarioDefinition | None,
) -> None:
    event = events[index]
    expected_fields = (
        _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
        if scenario is not None and scenario.schema_version == "2.0"
        else _OBSERVATION_SUMMARY_FIELDS
    )
    if set(event.observation_summary) != expected_fields:
        raise TraceIntegrityError(
            f"observation summary fields are incomplete or unsupported at sequence "
            f"{event.sequence}"
        )
    if expected_fields is _CHALLENGE_OBSERVATION_SUMMARY_FIELDS:
        assert scenario is not None and scenario.challenge is not None
        _verify_front_actor_fields(event, prefix="")
        _verify_front_actor_fields(event, prefix="result_")
        expected_input_phase = _expected_challenge_phase(
            scenario, event.sequence, result=False
        )
        expected_result_phase = _expected_challenge_phase(
            scenario, event.sequence, result=True
        )
        if event.observation_summary["challenge_phase"] != expected_input_phase:
            raise TraceIntegrityError(
                "observation summary challenge_phase contradicts the scenario schedule at "
                f"sequence {event.sequence}"
            )
        if event.observation_summary["result_challenge_phase"] != expected_result_phase:
            raise TraceIntegrityError(
                "observation summary result_challenge_phase contradicts the scenario schedule "
                f"at sequence {event.sequence}"
            )
        if event.sequence == 0:
            actor_speed = _summary_number(event, "challenge_actor_speed_mps")
            if not math.isclose(
                actor_speed,
                scenario.challenge.actor_speed_mps,
                rel_tol=0.0,
                abs_tol=1e-6,
            ):
                raise TraceIntegrityError(
                    "observation summary initial challenge actor speed contradicts the "
                    "scenario at sequence 0"
                )
            initial_distance = event.observation_summary["front_distance_m"]
            if scenario.challenge.kind == "lead_vehicle_hard_brake":
                if initial_distance is None or not math.isclose(
                    float(initial_distance),
                    scenario.challenge.initial_gap_m,
                    rel_tol=0.0,
                    abs_tol=1e-6,
                ):
                    raise TraceIntegrityError(
                        "observation summary initial front gap contradicts the lead challenge"
                    )
            elif initial_distance is not None:
                raise TraceIntegrityError(
                    "observation summary cut-in actor must start outside front overlap"
                )
        if index > 0:
            prior_summary = events[index - 1].observation_summary
            for field_name in (
                "front_distance_m",
                "front_relative_speed_mps",
                "challenge_actor_longitudinal_m",
                "challenge_actor_lateral_offset_m",
                "challenge_actor_speed_mps",
                "challenge_phase",
            ):
                if not _challenge_values_match(
                    event.observation_summary[field_name],
                    prior_summary[f"result_{field_name}"],
                ):
                    raise TraceIntegrityError(
                        f"observation summary {field_name} disagrees with the prior result "
                        f"at sequence {event.sequence}"
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


def _known_ordered_reasons(
    reasons: tuple[str, ...],
    supported: tuple[str, ...],
    *,
    label: str,
    sequence: int,
) -> None:
    positions: list[int] = []
    for reason in reasons:
        try:
            positions.append(supported.index(reason))
        except ValueError as exc:
            raise TraceIntegrityError(
                f"{label} reasons are unsupported at sequence {sequence}"
            ) from exc
    if len(set(reasons)) != len(reasons) or positions != sorted(positions):
        raise TraceIntegrityError(
            f"{label} reasons are duplicated or out of order at sequence {sequence}"
        )


def _verify_fault_challenge_evidence(
    events: tuple[TraceEventLike, ...],
    index: int,
    scenario: ScenarioDefinition,
) -> None:
    event = events[index]
    if not isinstance(event, TraceEventV2) or scenario.challenge is None:
        raise TraceIntegrityError("fault challenge verification requires typed challenge evidence")
    _verify_front_actor_fields(event, prefix="")
    _verify_front_actor_fields(event, prefix="result_")
    expected_input_phase = _expected_challenge_phase(
        scenario,
        event.sequence,
        result=False,
    )
    expected_result_phase = _expected_challenge_phase(
        scenario,
        event.sequence,
        result=True,
    )
    if event.observation_summary["challenge_phase"] != expected_input_phase:
        raise TraceIntegrityError(
            "fault challenge input phase contradicts the scenario schedule at sequence "
            f"{event.sequence}"
        )
    if event.observation_summary["result_challenge_phase"] != expected_result_phase:
        raise TraceIntegrityError(
            "fault challenge result phase contradicts the scenario schedule at sequence "
            f"{event.sequence}"
        )
    if event.sequence == 0:
        actor_speed = _summary_number(event, "challenge_actor_speed_mps")
        if not math.isclose(
            actor_speed,
            scenario.challenge.actor_speed_mps,
            rel_tol=0.0,
            abs_tol=1e-6,
        ):
            raise TraceIntegrityError(
                "fault challenge initial actor speed contradicts the scenario at sequence 0"
            )
        initial_distance = event.observation_summary["front_distance_m"]
        if scenario.challenge.kind == "lead_vehicle_hard_brake":
            if initial_distance is None or not math.isclose(
                float(initial_distance),
                scenario.challenge.initial_gap_m,
                rel_tol=0.0,
                abs_tol=1e-6,
            ):
                raise TraceIntegrityError(
                    "fault challenge initial front gap contradicts the lead challenge"
                )
        elif initial_distance is not None:
            raise TraceIntegrityError(
                "fault challenge cut-in actor must start outside front overlap"
            )
    if index > 0:
        prior_summary = events[index - 1].observation_summary
        for field_name in (
            "front_distance_m",
            "front_relative_speed_mps",
            "challenge_actor_longitudinal_m",
            "challenge_actor_lateral_offset_m",
            "challenge_actor_speed_mps",
            "challenge_phase",
        ):
            if not _challenge_values_match(
                event.observation_summary[field_name],
                prior_summary[f"result_{field_name}"],
            ):
                raise TraceIntegrityError(
                    f"fault challenge {field_name} disagrees with the prior result at "
                    f"sequence {event.sequence}"
                )


def _verify_fault_event(
    events: tuple[TraceEventLike, ...],
    index: int,
    scenario: ScenarioDefinition | None,
) -> None:
    event = events[index]
    if not isinstance(event, TraceEventV2):
        raise TraceIntegrityError(
            f"schema-2 fault trace requires schema-2 event at sequence {event.sequence}"
        )
    if scenario is None or scenario.schema_version != "3.0" or scenario.faults is None:
        raise TraceIntegrityError("schema-2 fault trace requires a schema-3 fault scenario")
    evidence = event.observation_fault_evidence
    raw = evidence.raw_observation
    delivered = evidence.delivered_observation
    expected_input_time = event.sequence / event.run_context.control_frequency_hz
    if raw.sequence != event.sequence or delivered.sequence != event.sequence:
        raise TraceIntegrityError(
            f"fault observation sequence disagrees at sequence {event.sequence}"
        )
    if not math.isclose(raw.observation_age_s, 0.0, rel_tol=0.0, abs_tol=1e-12):
        raise TraceIntegrityError(
            f"fault raw observation must be fresh at sequence {event.sequence}"
        )
    if not math.isclose(
        raw.simulation_time_s, expected_input_time, rel_tol=0.0, abs_tol=1e-12
    ) or not math.isclose(
        delivered.simulation_time_s,
        expected_input_time,
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise TraceIntegrityError(
            f"fault observation time disagrees at sequence {event.sequence}"
        )
    if evidence.delivery_time_s != delivered.simulation_time_s:
        raise TraceIntegrityError(
            f"fault delivery time disagrees at sequence {event.sequence}"
        )
    if evidence.delivered_from_sequence > event.sequence:
        raise TraceIntegrityError(
            f"fault observation source is in the future at sequence {event.sequence}"
        )
    expected_age = evidence.delivery_time_s - evidence.delivered_from_time_s
    if expected_age < -1e-12 or not math.isclose(
        delivered.observation_age_s,
        expected_age,
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise TraceIntegrityError(
            f"fault observation age disagrees at sequence {event.sequence}"
        )
    if index == 0:
        if raw.vehicle_state != VehicleState(
            position_m=0.0,
            speed_mps=scenario.initial_state.speed_mps,
            acceleration_mps2=0.0,
            lateral_offset_m=scenario.initial_state.lateral_offset_m,
            route_progress_pct=0.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ):
            raise TraceIntegrityError("fault raw initial observation contradicts the scenario")
    else:
        prior = events[index - 1]
        if not isinstance(prior, TraceEventV2) or raw != prior.result_observation:
            raise TraceIntegrityError(
                f"fault raw observation disagrees with prior result at sequence "
                f"{event.sequence}"
            )
    if event.result_observation.vehicle_state != event.vehicle_state:
        raise TraceIntegrityError(
            f"fault result observation disagrees with event state at sequence {event.sequence}"
        )
    if (
        event.result_observation.sequence != event.sequence + 1
        or not math.isclose(
            event.result_observation.simulation_time_s,
            event.simulation_time_s,
            rel_tol=0.0,
            abs_tol=1e-12,
        )
        or not math.isclose(
            event.result_observation.observation_age_s,
            0.0,
            rel_tol=0.0,
            abs_tol=1e-12,
        )
    ):
        raise TraceIntegrityError(
            f"fault result observation timing disagrees at sequence {event.sequence}"
        )
    expected_summary: dict[str, Any] = {
        "input_sequence": delivered.sequence,
        "input_simulation_time_s": delivered.simulation_time_s,
        "speed_mps": delivered.vehicle_state.speed_mps,
        "lateral_offset_m": delivered.vehicle_state.lateral_offset_m,
        "route_progress_pct": delivered.vehicle_state.route_progress_pct,
        "observation_age_s": delivered.observation_age_s,
    }
    if scenario.challenge is not None:
        expected_summary.update(
            {
                "front_distance_m": delivered.front_distance_m,
                "front_relative_speed_mps": delivered.front_relative_speed_mps,
                "challenge_actor_longitudinal_m": (
                    delivered.challenge_actor_longitudinal_m
                ),
                "challenge_actor_lateral_offset_m": (
                    delivered.challenge_actor_lateral_offset_m
                ),
                "challenge_actor_speed_mps": delivered.challenge_actor_speed_mps,
                "challenge_phase": delivered.challenge_phase,
                "result_front_distance_m": event.result_observation.front_distance_m,
                "result_front_relative_speed_mps": (
                    event.result_observation.front_relative_speed_mps
                ),
                "result_challenge_actor_longitudinal_m": (
                    event.result_observation.challenge_actor_longitudinal_m
                ),
                "result_challenge_actor_lateral_offset_m": (
                    event.result_observation.challenge_actor_lateral_offset_m
                ),
                "result_challenge_actor_speed_mps": (
                    event.result_observation.challenge_actor_speed_mps
                ),
                "result_challenge_phase": event.result_observation.challenge_phase,
            }
        )
    if event.observation_summary != expected_summary:
        raise TraceIntegrityError(
            f"fault observation summary is not derived from typed evidence at sequence "
            f"{event.sequence}"
        )
    if scenario.challenge is not None:
        _verify_fault_challenge_evidence(events, index, scenario)
    _known_ordered_reasons(
        evidence.applied_faults,
        OBSERVATION_FAULT_REASONS,
        label="observation fault",
        sequence=event.sequence,
    )
    control = event.control_fault_evidence
    if (
        not math.isclose(
            control.candidate_time_s,
            expected_input_time,
            rel_tol=0.0,
            abs_tol=1e-12,
        )
        or not math.isclose(
            control.execution_time_s,
            expected_input_time,
            rel_tol=0.0,
            abs_tol=1e-12,
        )
    ):
        raise TraceIntegrityError(
            f"fault command timing disagrees at sequence {event.sequence}"
        )
    _known_ordered_reasons(
        control.applied_faults,
        ACTION_FAULT_REASONS,
        label="action fault",
        sequence=event.sequence,
    )


def verify_complete_trace(
    events: tuple[TraceEventLike, ...],
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
        if event.evidence_schema_version == "2.0":
            _verify_fault_event(events, index, scenario)
        else:
            legacy_events = tuple(
                legacy for legacy in events if isinstance(legacy, TraceEvent)
            )
            if len(legacy_events) != len(events):
                raise TraceIntegrityError("legacy trace contains a schema-2 event")
            _verify_observation_summary(legacy_events, index, scenario)
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
        permitted_action = (
            event.permitted_action
            if isinstance(event, TraceEventV2)
            else event.executed_action
        )
        if event.run_context.shield_name == "noop" and (
            event.candidate_action != permitted_action or event.override_reasons
        ):
            raise TraceIntegrityError(
                f"no-op shield evidence is contradictory at sequence {event.sequence}"
            )
        if event.run_context.shield_name == "deterministic":
            reason_positions = []
            for reason in event.override_reasons:
                try:
                    reason_positions.append(SUPPORTED_OVERRIDE_REASONS.index(reason))
                except ValueError as exc:
                    raise TraceIntegrityError(
                        f"deterministic shield override reasons are unsupported at sequence "
                        f"{event.sequence}"
                    ) from exc
            if (
                len(set(event.override_reasons)) != len(event.override_reasons)
                or reason_positions != sorted(reason_positions)
            ):
                raise TraceIntegrityError(
                    "deterministic shield override reasons are duplicated or out of order "
                    f"at sequence {event.sequence}"
                )
            action_changed = event.candidate_action != permitted_action
            if bool(event.override_reasons) != action_changed:
                raise TraceIntegrityError(
                    "deterministic shield override reasons must exactly match an action "
                    f"change at sequence {event.sequence}"
                )
        elif (
            event.run_context.shield_name != "noop"
            and event.candidate_action != permitted_action
            and not event.override_reasons
        ):
            raise TraceIntegrityError(
                f"action override lacks a reason at sequence {event.sequence}"
            )
        if event.run_context.policy_name in {"baseline", "metadrive-idm"} and (
            event.latency_source != "simulated"
        ):
            raise TraceIntegrityError(
                f"{event.run_context.policy_name} policy latency_source must be simulated at "
                f"sequence {event.sequence}"
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


def events_jsonl_bytes(events: tuple[TraceEventLike, ...]) -> bytes:
    """Serialize events one canonical JSON object per UTF-8 line."""
    return b"".join(
        canonical_json_bytes(event.model_dump(mode="json")) + b"\n" for event in events
    )
