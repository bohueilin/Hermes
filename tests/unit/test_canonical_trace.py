from __future__ import annotations

import math
from pathlib import Path

import pytest

from hermes.domain.enums import TerminationReason
from hermes.domain.models import Action, RunContext, ScenarioDefinition, VehicleState
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.trace import (
    GENESIS_HASH,
    TraceIntegrityError,
    create_trace_event,
    verify_complete_trace,
    verify_event_chain,
)
from hermes.scenarios.loader import load_scenario


def _context(*, horizon_steps: int = 20) -> RunContext:
    return RunContext(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="fake",
        adapter_version="1.0",
        adapter_config_digest="c" * 64,
        policy_name="baseline",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=horizon_steps,
    )


def _event(
    sequence: int,
    previous_hash: str,
    *,
    context: RunContext | None = None,
):
    run_context = context or _context()
    return create_trace_event(
        sequence=sequence,
        simulation_time_s=(sequence + 1) / 10,
        run_context=run_context,
        observation_summary={
            "input_sequence": sequence,
            "input_simulation_time_s": sequence / run_context.control_frequency_hz,
            "speed_mps": float(sequence),
            "lateral_offset_m": 0.0,
            "route_progress_pct": float(sequence * 10),
            "observation_age_s": 0.0,
        },
        candidate_action=Action(steering=0.0, throttle=0.5, brake=0.0),
        executed_action=Action(steering=0.0, throttle=0.5, brake=0.0),
        override_reasons=(),
        vehicle_state=VehicleState(
            position_m=float(sequence + 1),
            speed_mps=float(sequence + 1),
            acceleration_mps2=1.0,
            lateral_offset_m=0.0,
            route_progress_pct=float((sequence + 1) * 10),
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
        policy_latency_ms=10.0,
        latency_source="simulated",
        terminated=False,
        truncated=False,
        termination_reason=TerminationReason.NONE,
        raw_facts={
            "collision": False,
            "collision_count": 0,
            "offroad": False,
            "destination_reached": False,
            "route_progress_available": True,
            "route_progress_pct": float((sequence + 1) * 10),
        },
        previous_hash=previous_hash,
    )


def _shield_event(
    *,
    candidate: Action,
    executed: Action,
    reasons: tuple[str, ...],
):
    context = _context(horizon_steps=1).model_copy(
        update={"shield_name": "deterministic"}
    )
    return create_trace_event(
        sequence=0,
        simulation_time_s=0.1,
        run_context=context,
        observation_summary={
            "input_sequence": 0,
            "input_simulation_time_s": 0.0,
            "speed_mps": 0.0,
            "lateral_offset_m": 0.0,
            "route_progress_pct": 0.0,
            "observation_age_s": 0.0,
        },
        candidate_action=candidate,
        executed_action=executed,
        override_reasons=reasons,
        vehicle_state=VehicleState(
            position_m=0.0,
            speed_mps=0.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=0.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
        policy_latency_ms=10.0,
        latency_source="simulated",
        terminated=False,
        truncated=True,
        termination_reason=TerminationReason.HORIZON,
        raw_facts={
            "collision": False,
            "collision_count": 0,
            "offroad": False,
            "destination_reached": False,
            "route_progress_available": True,
            "route_progress_pct": 0.0,
        },
        previous_hash=GENESIS_HASH,
    )


def _challenge_event(
    scenario: ScenarioDefinition,
    *,
    summary_updates: dict[str, object] | None = None,
):
    assert scenario.challenge is not None
    initial_gap = scenario.challenge.initial_gap_m
    actor_speed = scenario.challenge.actor_speed_mps
    context = _context(horizon_steps=scenario.control.horizon_steps).model_copy(
        update={"adapter_name": "metadrive", "policy_name": "metadrive-idm"}
    )
    summary = {
        "input_sequence": 0,
        "input_simulation_time_s": 0.0,
        "speed_mps": 0.0,
        "lateral_offset_m": 0.0,
        "route_progress_pct": 0.0,
        "observation_age_s": 0.0,
        "front_distance_m": initial_gap,
        "front_relative_speed_mps": actor_speed,
        "challenge_actor_longitudinal_m": initial_gap + 4.515,
        "challenge_actor_lateral_offset_m": 0.0,
        "challenge_actor_speed_mps": actor_speed,
        "challenge_phase": "PRE_TRIGGER",
        "result_front_distance_m": initial_gap,
        "result_front_relative_speed_mps": actor_speed,
        "result_challenge_actor_longitudinal_m": initial_gap + 4.515,
        "result_challenge_actor_lateral_offset_m": 0.0,
        "result_challenge_actor_speed_mps": actor_speed,
        "result_challenge_phase": "PRE_TRIGGER",
    }
    summary.update(summary_updates or {})
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    return create_trace_event(
        sequence=0,
        simulation_time_s=0.1,
        run_context=context,
        observation_summary=summary,
        candidate_action=action,
        executed_action=action,
        override_reasons=(),
        vehicle_state=VehicleState(
            position_m=20.0,
            speed_mps=0.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=100.0,
            collision_count=0,
            offroad=False,
            destination_reached=True,
        ),
        policy_latency_ms=10.0,
        latency_source="simulated",
        terminated=True,
        truncated=False,
        termination_reason=TerminationReason.DESTINATION_REACHED,
        raw_facts={
            "collision": False,
            "collision_count": 0,
            "offroad": False,
            "destination_reached": True,
            "route_progress_available": True,
            "route_progress_pct": 100.0,
        },
        previous_hash=GENESIS_HASH,
    )


def test_canonical_json_has_literal_oracle_and_normalizes_negative_zero() -> None:
    payload = canonical_json_bytes({"b": 1, "a": -0.0})

    assert payload == b'{"a":0.0,"b":1}'
    assert sha256_hex(payload) == "df5a6664b5add9d47a7d97a272810dfdfd7f74f483580fe7656a70779bbf21f7"


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_canonical_json_rejects_non_finite_numbers(value: float) -> None:
    with pytest.raises(ValueError, match="finite"):
        canonical_json_bytes({"value": value})


def test_trace_chain_has_stable_genesis_and_validates_continuity() -> None:
    first = _event(0, GENESIS_HASH)
    second = _event(1, first.current_hash)

    root = verify_event_chain((first, second))

    assert GENESIS_HASH == "0" * 64
    assert root == second.current_hash


def test_trace_chain_identifies_first_modified_event() -> None:
    first = _event(0, GENESIS_HASH)
    second = _event(1, first.current_hash)
    modified = second.model_copy(
        update={"executed_action": Action(steering=0.0, throttle=0.0, brake=0.5)}
    )

    with pytest.raises(TraceIntegrityError, match="sequence 1"):
        verify_event_chain((first, modified))


def test_trace_chain_rejects_duplicate_sequence_even_with_recomputed_hash() -> None:
    first = _event(0, GENESIS_HASH)
    duplicate = _event(0, first.current_hash)

    with pytest.raises(TraceIntegrityError, match="expected sequence 1"):
        verify_event_chain((first, duplicate))


def test_complete_trace_rejects_missing_terminal_event() -> None:
    event = _event(0, GENESIS_HASH)

    with pytest.raises(TraceIntegrityError, match="final event"):
        verify_complete_trace((event,))


def test_complete_trace_rejects_contradictory_safety_facts() -> None:
    event = _event(0, GENESIS_HASH)
    contradictory = event.model_copy(
        update={
            "vehicle_state": event.vehicle_state.model_copy(update={"collision_count": 1}),
            "terminated": True,
            "termination_reason": TerminationReason.COLLISION,
        }
    )
    rehashed = create_trace_event(
        sequence=contradictory.sequence,
        simulation_time_s=contradictory.simulation_time_s,
        run_context=contradictory.run_context,
        observation_summary=contradictory.observation_summary,
        candidate_action=contradictory.candidate_action,
        executed_action=contradictory.executed_action,
        override_reasons=contradictory.override_reasons,
        vehicle_state=contradictory.vehicle_state,
        policy_latency_ms=contradictory.policy_latency_ms,
        latency_source=contradictory.latency_source,
        terminated=contradictory.terminated,
        truncated=contradictory.truncated,
        termination_reason=contradictory.termination_reason,
        raw_facts=contradictory.raw_facts,
        previous_hash=contradictory.previous_hash,
    )

    with pytest.raises(TraceIntegrityError, match="collision facts disagree"):
        verify_complete_trace((rehashed,))


def test_complete_trace_rejects_more_events_than_configured_horizon() -> None:
    context = _context(horizon_steps=1)
    first = _event(0, GENESIS_HASH, context=context)
    second = _event(1, first.current_hash, context=context)

    with pytest.raises(TraceIntegrityError, match="configured horizon"):
        verify_complete_trace((first, second))


@pytest.mark.parametrize(
    "reasons",
    [
        ("UNKNOWN_REASON",),
        ("SPEED_CAP", "SPEED_CAP"),
        ("SPEED_CAP", "TTC_BELOW_THRESHOLD"),
    ],
)
def test_deterministic_shield_reasons_must_be_known_unique_and_stably_ordered(
    reasons: tuple[str, ...],
) -> None:
    event = _shield_event(
        candidate=Action(steering=0.0, throttle=0.5, brake=0.0),
        executed=Action(steering=0.0, throttle=0.0, brake=1.0),
        reasons=reasons,
    )

    with pytest.raises(TraceIntegrityError, match="override reasons"):
        verify_complete_trace((event,))


def test_deterministic_shield_reason_requires_an_actual_action_change() -> None:
    action = Action(steering=0.0, throttle=0.0, brake=1.0)
    event = _shield_event(
        candidate=action,
        executed=action,
        reasons=("TTC_BELOW_THRESHOLD",),
    )

    with pytest.raises(TraceIntegrityError, match="override reasons"):
        verify_complete_trace((event,))


@pytest.mark.parametrize(
    ("updates", "message"),
    [
        ({"front_relative_speed_mps": None}, "front-object evidence must be paired"),
        ({"front_distance_m": -1.0}, "front_distance_m is negative"),
        ({"challenge_actor_speed_mps": -1.0}, "actor_speed_mps is negative"),
        ({"challenge_phase": "INVENTED"}, "challenge_phase is unsupported"),
        ({"challenge_phase": "BRAKING"}, "contradicts the scenario schedule"),
        ({"result_challenge_phase": "BRAKING"}, "contradicts the scenario schedule"),
        (
            {"challenge_actor_speed_mps": 5.0, "front_relative_speed_mps": 5.0},
            "initial challenge actor speed",
        ),
        ({"front_distance_m": 14.0}, "initial front gap"),
    ],
)
def test_challenge_observation_summary_rejects_false_or_incomplete_actor_evidence(
    repository_root: Path,
    updates: dict[str, object],
    message: str,
) -> None:
    scenario = load_scenario(
        repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
    )
    event = _challenge_event(scenario, summary_updates=updates)

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace((event,), scenario)
