"""Construction, serialization, and structural verification of event hash chains."""

from __future__ import annotations

import math
from typing import Any

from hermes.adas.decision import (
    candidate_brake_source,
    executed_brake_source,
    permitted_brake_source,
    validate_decision_evidence,
)
from hermes.domain.enums import BrakeSource
from hermes.domain.models import (
    Action,
    AdasDecisionEvidence,
    ControlFaultEvidence,
    ObservationFaultEvidence,
    RunContext,
    RunContextV2,
    RunContextV3,
    ScenarioDefinition,
    TraceEvent,
    TraceEventV2,
    TraceEventV3,
    VehicleState,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.faults.deterministic import ACTION_FAULT_REASONS, OBSERVATION_FAULT_REASONS
from hermes.shields.deterministic import SUPPORTED_OVERRIDE_REASONS

GENESIS_HASH = "0" * 64
TraceEventLike = TraceEvent | TraceEventV2 | TraceEventV3


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


def _v3_source_attribution(
    *,
    sequence: int,
    permitted_action: Action,
    permitted_source: BrakeSource,
    control_fault_evidence: ControlFaultEvidence,
    prior_events: tuple[TraceEventV3, ...],
) -> tuple[Action | None, BrakeSource | None]:
    if len(prior_events) != sequence or any(
        event.sequence != expected for expected, event in enumerate(prior_events)
    ):
        raise ValueError("V3 event construction requires complete ordered prior events")
    source_sequence = control_fault_evidence.executed_from_sequence
    if source_sequence is None:
        return None, None
    if source_sequence > sequence:
        raise ValueError("executed source sequence cannot be in the future")
    if source_sequence == sequence:
        source_action = permitted_action
        source_attribution = permitted_source
        expected_source_time = control_fault_evidence.candidate_time_s
    else:
        source_event = prior_events[source_sequence]
        source_action = source_event.permitted_action
        source_attribution = source_event.permitted_brake_source
        expected_source_time = source_event.control_fault_evidence.candidate_time_s
    if control_fault_evidence.executed_from_candidate_time_s != expected_source_time:
        raise ValueError("executed source time does not match the source event")
    return source_action, source_attribution


def create_trace_event_v3(
    *,
    sequence: int,
    simulation_time_s: float,
    run_context: RunContextV3,
    observation_summary: dict[str, Any],
    candidate_action: Action,
    permitted_action: Action,
    executed_action: Action,
    override_reasons: tuple[str, ...],
    observation_fault_evidence: ObservationFaultEvidence,
    control_fault_evidence: ControlFaultEvidence,
    result_observation,
    adas_decision_evidence: AdasDecisionEvidence | None,
    vehicle_state: VehicleState,
    policy_latency_ms: float,
    latency_source: str,
    terminated: bool,
    truncated: bool,
    termination_reason: object,
    raw_facts: dict[str, Any],
    previous_hash: str,
    prior_events: tuple[TraceEventV3, ...] = (),
) -> TraceEventV3:
    """Build one inactive schema-3 event with deterministic action attribution."""
    if adas_decision_evidence is None:
        raise ValueError("V3 event construction requires ADAS decision evidence")
    validate_decision_evidence(
        adas_decision_evidence,
        observation_fault_evidence.delivered_observation,
        candidate_action,
    )
    candidate_source = candidate_brake_source(
        adas_decision_evidence.decision,
        candidate_action,
    )
    permitted_source = permitted_brake_source(
        candidate_action=candidate_action,
        candidate_source=candidate_source,
        permitted_action=permitted_action,
        override_reasons=override_reasons,
    )
    source_action, source_attribution = _v3_source_attribution(
        sequence=sequence,
        permitted_action=permitted_action,
        permitted_source=permitted_source,
        control_fault_evidence=control_fault_evidence,
        prior_events=prior_events,
    )
    executed_source = executed_brake_source(
        control_evidence=control_fault_evidence,
        executed_action=executed_action,
        source_permitted_action=source_action,
        source_permitted_brake_source=source_attribution,
    )
    payload: dict[str, Any] = {
        "evidence_schema_version": "3.0",
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
        "adas_decision_input_sequence": adas_decision_evidence.input_sequence,
        "adas_decision_input_time_s": adas_decision_evidence.input_time_s,
        "adas_decision": adas_decision_evidence.decision,
        "candidate_brake_source": candidate_source,
        "permitted_brake_source": permitted_source,
        "executed_brake_source": executed_source,
        "vehicle_state": vehicle_state,
        "policy_latency_ms": policy_latency_ms,
        "latency_source": latency_source,
        "terminated": terminated,
        "truncated": truncated,
        "termination_reason": termination_reason,
        "raw_facts": raw_facts,
        "previous_hash": previous_hash,
    }
    json_payload = TraceEventV3.model_validate(
        {**payload, "current_hash": "0" * 64}
    ).model_dump(mode="json", exclude={"current_hash"})
    current_hash = sha256_hex(canonical_json_bytes(json_payload))
    return TraceEventV3.model_validate({**payload, "current_hash": current_hash})


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
#: How many float32 steps of slack a declared-vs-observed geometry comparison allows.
#:
#: The simulator stores positions and velocities as float32 and we read them back as
#: float64, so an observed quantity cannot be expected to equal a declared one exactly -
#: only to within the spacing of the float32 grid at that magnitude. Eight steps covers the
#: handful of float32 operations between spawn and observation (bumper projection, frame
#: transform, subtraction) with room to spare.
_FLOAT32_ULP_ALLOWANCE = 8


def _float32_ulp(magnitude: float) -> float:
    """Spacing between adjacent float32 values at ``magnitude``.

    float32 carries 23 fraction bits, so within the binade [2**(e-1), 2**e) the spacing is
    2**(e-24), where ``frexp`` supplies ``e``.
    """
    _, exponent = math.frexp(abs(magnitude))
    return math.ldexp(1.0, exponent - 24)


def _geometry_agrees(observed: float, declared: float) -> bool:
    """Whether an observed geometry quantity matches its declared value.

    The tolerance is derived, not chosen. The observed front gap in particular is a
    *difference of two float32 bumper positions*, so its representation error is an ulp of
    the position - tens of metres - and not of the gap. Comparing it with a fixed absolute
    tolerance was the original defect: 1e-6 m held for a 40 m gap by luck and failed for a
    28.816 m one by 1.4e-6, a contradiction that existed only in the check.

    Scaling by ulp is both correct and tighter than the relative tolerance it replaces. At a
    28.8 m gap it admits 1.5e-5 m; the smallest physically meaningful contradiction is a
    millimetre, so this still refuses anything that means something. The magnitude floors at
    1.0 so that a declared zero is compared against a fixed 4.8e-7 rather than a vanishing
    tolerance.
    """
    scale = max(abs(observed), abs(declared), 1.0)
    return abs(observed - declared) <= _FLOAT32_ULP_ALLOWANCE * _float32_ulp(scale)

_CHALLENGE_PHASES = {
    "PRE_TRIGGER",
    "BRAKING",
    "RECOVERY",
    "CUT_IN",
    "POST_CUT_IN",
    "PRESENT",
}


def _summary_number(event: TraceEventLike, field_name: str) -> float:
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


def _verify_front_actor_fields(event: TraceEventLike, *, prefix: str) -> None:
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


def _expected_observation_summary_fields(
    scenario: ScenarioDefinition | None,
) -> frozenset[str] | set[str]:
    """Select the exact observation-summary field set a scenario's trace must carry.

    The set is checked for exact equality, so this is version-gated rather than inferred:
    schema 2.0 always carries challenge fields (a challenge is mandatory there), schema 4.0
    carries them only when it declares a challenge, and every other version keeps the base
    set byte-identically.
    """
    if scenario is None:
        return _OBSERVATION_SUMMARY_FIELDS
    if scenario.schema_version == "2.0":
        return _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
    if scenario.schema_version == "4.0" and scenario.challenge is not None:
        return _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
    return _OBSERVATION_SUMMARY_FIELDS


def _expected_challenge_phase(
    scenario: ScenarioDefinition,
    sequence: int,
    *,
    result: bool,
) -> str:
    challenge = scenario.challenge
    if challenge is None:
        raise TraceIntegrityError("challenge configuration is unavailable")
    if challenge.kind == "stationary_lead":
        return "PRESENT"
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
    events: tuple[TraceEventLike, ...],
    index: int,
    scenario: ScenarioDefinition | None,
) -> None:
    event = events[index]
    expected_fields = _expected_observation_summary_fields(scenario)
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
        if scenario.challenge.kind == "stationary_lead":
            for field_name in (
                "challenge_actor_speed_mps",
                "result_challenge_actor_speed_mps",
            ):
                if _summary_number(event, field_name) != 0.0:
                    if event.sequence == 0:
                        raise TraceIntegrityError(
                            "observation summary initial challenge actor speed contradicts "
                            "stationary actor speed at sequence 0"
                        )
                    raise TraceIntegrityError(
                        f"observation summary {field_name} contradicts stationary actor "
                        f"speed at sequence {event.sequence}"
                    )
        if event.sequence == 0:
            actor_speed = _summary_number(event, "challenge_actor_speed_mps")
            declared_actor_speed = (
                0.0
                if scenario.challenge.kind == "stationary_lead"
                else scenario.challenge.actor_speed_mps
            )
            if not _geometry_agrees(actor_speed, declared_actor_speed):
                raise TraceIntegrityError(
                    "observation summary initial challenge actor speed contradicts the "
                    "scenario at sequence 0"
                )
            initial_distance = event.observation_summary["front_distance_m"]
            if scenario.challenge.kind == "lead_vehicle_hard_brake" or (
                scenario.challenge.kind == "stationary_lead"
                and scenario.challenge.initial_lane_delta == 0
            ):
                if initial_distance is None or not _geometry_agrees(
                    float(initial_distance), scenario.challenge.initial_gap_m
                ):
                    raise TraceIntegrityError(
                        "observation summary initial front gap contradicts the challenge"
                    )
            elif initial_distance is not None:
                label = (
                    "adjacent stationary actor"
                    if scenario.challenge.kind == "stationary_lead"
                    else "cut-in actor"
                )
                raise TraceIntegrityError(
                    f"observation summary {label} must start outside front overlap"
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
    if not isinstance(event, (TraceEventV2, TraceEventV3)) or scenario.challenge is None:
        raise TraceIntegrityError("fault challenge verification requires typed challenge evidence")
    _verify_front_actor_fields(event, prefix="")
    _verify_front_actor_fields(event, prefix="result_")
    expected_input_phase = _expected_challenge_phase(
        scenario,
        event.observation_fault_evidence.delivered_from_sequence,
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
    if scenario.challenge.kind == "stationary_lead":
        for field_name in (
            "challenge_actor_speed_mps",
            "result_challenge_actor_speed_mps",
        ):
            if _summary_number(event, field_name) != 0.0:
                if event.sequence == 0:
                    raise TraceIntegrityError(
                        "fault challenge initial actor speed contradicts stationary actor "
                        "speed at sequence 0"
                    )
                raise TraceIntegrityError(
                    f"fault challenge {field_name} contradicts stationary actor speed at "
                    f"sequence {event.sequence}"
                )
    if event.sequence == 0:
        actor_speed = _summary_number(event, "challenge_actor_speed_mps")
        declared_actor_speed = (
            0.0
            if scenario.challenge.kind == "stationary_lead"
            else scenario.challenge.actor_speed_mps
        )
        if not _geometry_agrees(actor_speed, declared_actor_speed):
            raise TraceIntegrityError(
                "fault challenge initial actor speed contradicts the scenario at sequence 0"
            )
        initial_distance = event.observation_summary["front_distance_m"]
        if scenario.challenge.kind == "lead_vehicle_hard_brake" or (
            scenario.challenge.kind == "stationary_lead"
            and scenario.challenge.initial_lane_delta == 0
        ):
            if initial_distance is None or not _geometry_agrees(
                float(initial_distance), scenario.challenge.initial_gap_m
            ):
                raise TraceIntegrityError(
                    "fault challenge initial front gap contradicts the challenge"
                )
        elif initial_distance is not None:
            label = (
                "adjacent stationary actor"
                if scenario.challenge.kind == "stationary_lead"
                else "cut-in actor"
            )
            raise TraceIntegrityError(
                f"fault challenge {label} must start outside front overlap"
            )
    # Raw challenge observations are already required to equal the immediately prior
    # result, and the delivered packet is required to equal its declared raw source. A
    # delayed/frozen/dropped delivery must therefore not be compared to the prior result at
    # its *delivery* sequence; that would reject the truthful source chain it is meant to
    # verify.


def _verify_delivered_observation_source(
    events: tuple[TraceEventLike, ...],
    event: TraceEventV2 | TraceEventV3,
) -> None:
    """Bind a delivered policy packet to its declared raw source and noise deltas."""
    evidence = event.observation_fault_evidence
    source_event = events[evidence.delivered_from_sequence]
    if not isinstance(source_event, type(event)):
        raise TraceIntegrityError(
            f"fault observation source has the wrong schema at sequence {event.sequence}"
        )
    source = source_event.observation_fault_evidence.raw_observation
    if not math.isclose(
        evidence.delivered_from_time_s,
        source.simulation_time_s,
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise TraceIntegrityError(
            f"fault observation source time disagrees at sequence {event.sequence}"
        )
    age = evidence.delivery_time_s - source.simulation_time_s
    expected = source.model_copy(
        update={
            "sequence": event.sequence,
            "simulation_time_s": evidence.delivery_time_s,
            "observation_age_s": max(0.0, age),
            "vehicle_state": source.vehicle_state.model_copy(
                update={
                    "speed_mps": max(
                        0.0,
                        source.vehicle_state.speed_mps
                        + evidence.speed_noise_delta_mps,
                    ),
                    "lateral_offset_m": (
                        source.vehicle_state.lateral_offset_m
                        + evidence.lateral_noise_delta_m
                    ),
                }
            ),
        }
    )
    if evidence.delivered_observation != expected:
        raise TraceIntegrityError(
            "fault delivered observation is not derived from declared raw source at "
            f"sequence {event.sequence}"
        )


def _verify_fault_event(
    events: tuple[TraceEventLike, ...],
    index: int,
    scenario: ScenarioDefinition | None,
) -> None:
    event = events[index]
    if not isinstance(event, (TraceEventV2, TraceEventV3)):
        raise TraceIntegrityError(
            f"typed fault trace requires a schema-2 or schema-3 event at sequence "
            f"{event.sequence}"
        )
    if (
        scenario is None
        or scenario.schema_version not in {"3.0", "4.0"}
        or scenario.faults is None
    ):
        raise TraceIntegrityError(
            "typed fault trace requires a schema-3 or schema-4 fault scenario"
        )
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
        if scenario.challenge is not None and scenario.challenge.kind == "stationary_lead":
            if raw.challenge_actor_speed_mps != 0.0:
                raise TraceIntegrityError(
                    "fault raw stationary actor speed contradicts the scenario at sequence 0"
                )
            if raw.challenge_phase != "PRESENT":
                raise TraceIntegrityError(
                    "fault raw stationary actor phase contradicts the scenario at sequence 0"
                )
            if scenario.challenge.initial_lane_delta == 0:
                if (
                    raw.front_distance_m is None
                    or raw.front_relative_speed_mps is None
                    or not _geometry_agrees(
                        raw.front_distance_m,
                        scenario.challenge.initial_gap_m,
                    )
                ):
                    raise TraceIntegrityError(
                        "fault raw initial front gap contradicts the stationary challenge"
                    )
            elif (
                raw.front_distance_m is not None
                or raw.front_relative_speed_mps is not None
            ):
                raise TraceIntegrityError(
                    "fault raw adjacent stationary actor must have paired-null front fields"
                )
    else:
        prior = events[index - 1]
        if not isinstance(prior, type(event)) or raw != prior.result_observation:
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
    _verify_delivered_observation_source(events, event)
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


def _verify_v3_decision_and_attribution(
    events: tuple[TraceEventLike, ...],
    index: int,
    scenario: ScenarioDefinition | None,
) -> None:
    event = events[index]
    if not isinstance(event, TraceEventV3):
        raise TraceIntegrityError(
            f"schema-3 ADAS trace requires schema-3 event at sequence {event.sequence}"
        )
    evidence = AdasDecisionEvidence(
        input_sequence=event.adas_decision_input_sequence,
        input_time_s=event.adas_decision_input_time_s,
        decision=event.adas_decision,
    )
    try:
        validate_decision_evidence(
            evidence,
            event.observation_fault_evidence.delivered_observation,
            event.candidate_action,
        )
        expected_candidate_source = candidate_brake_source(
            event.adas_decision,
            event.candidate_action,
        )
        expected_permitted_source = permitted_brake_source(
            candidate_action=event.candidate_action,
            candidate_source=expected_candidate_source,
            permitted_action=event.permitted_action,
            override_reasons=event.override_reasons,
        )
        prior_events = tuple(
            prior for prior in events[:index] if isinstance(prior, TraceEventV3)
        )
        if len(prior_events) != index:
            raise ValueError("V3 attribution source has the wrong event schema")
        source_action, source_attribution = _v3_source_attribution(
            sequence=event.sequence,
            permitted_action=event.permitted_action,
            permitted_source=expected_permitted_source,
            control_fault_evidence=event.control_fault_evidence,
            prior_events=prior_events,
        )
        expected_executed_source = executed_brake_source(
            control_evidence=event.control_fault_evidence,
            executed_action=event.executed_action,
            source_permitted_action=source_action,
            source_permitted_brake_source=source_attribution,
        )
    except ValueError as exc:
        raise TraceIntegrityError(
            f"ADAS action attribution is contradictory at sequence {event.sequence}: {exc}"
        ) from exc

    if event.candidate_brake_source is not expected_candidate_source:
        raise TraceIntegrityError(
            f"candidate brake source disagrees at sequence {event.sequence}"
        )
    if event.permitted_brake_source is not expected_permitted_source:
        raise TraceIntegrityError(
            f"permitted brake source disagrees at sequence {event.sequence}"
        )
    if event.executed_brake_source is not expected_executed_source:
        label = (
            "startup fill executed brake source"
            if event.control_fault_evidence.executed_from_sequence is None
            else "executed brake source"
        )
        raise TraceIntegrityError(f"{label} disagrees at sequence {event.sequence}")

    if scenario is None:
        return
    control_delay = scenario.faults.control_delay_steps if scenario.faults is not None else 0
    expected_source = (
        event.sequence
        if control_delay == 0
        else event.sequence - control_delay
        if event.sequence >= control_delay
        else None
    )
    if event.control_fault_evidence.executed_from_sequence != expected_source:
        raise TraceIntegrityError(
            f"control-delay source contradicts the scenario at sequence {event.sequence}"
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
        elif event.evidence_schema_version == "3.0":
            if not isinstance(event, TraceEventV3):
                raise TraceIntegrityError("schema-3 trace contains a non-schema-3 event")
            if event.run_context.fault_name is not None:
                _verify_fault_event(events, index, scenario)
            else:
                _verify_observation_summary(events, index, scenario)
            _verify_v3_decision_and_attribution(events, index, scenario)
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
            if isinstance(event, (TraceEventV2, TraceEventV3))
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
