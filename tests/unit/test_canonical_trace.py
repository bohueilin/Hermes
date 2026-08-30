from __future__ import annotations

import math
from pathlib import Path

import pytest

import hermes.evidence.trace as trace_module
from hermes.domain.enums import EvidenceAvailability, TerminationReason
from hermes.domain.models import (
    Action,
    ControlFaultEvidence,
    FaultConfig,
    Measurement,
    Observation,
    ObservationFaultEvidence,
    RunContext,
    RunContextV2,
    ScenarioDefinition,
    VehicleState,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.trace import (
    GENESIS_HASH,
    TraceIntegrityError,
    create_trace_event,
    create_trace_event_v2,
    verify_complete_trace,
    verify_event_chain,
)
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.scenarios.loader import load_scenario

_UNSET = object()


LEAD_DECELERATION_CONFORMANCE_VECTORS = (
    (10, 20.0, 15.0, 2.0, 10, 10, 20.0, 19.8, "DECELERATING", "DECELERATING"),
    (10, 20.0, 15.0, 2.0, 10, 22, 17.6, 17.4, "DECELERATING", "DECELERATING"),
    (10, 20.0, 15.0, 2.0, 10, 34, 15.2, 15.0, "DECELERATING", "STEADY"),
    (10, 20.0, 15.0, 2.0, 10, 35, 15.0, 15.0, "STEADY", "STEADY"),
    (10, 20.0, 17.0, 1.5, 10, 10, 20.0, 19.85, "DECELERATING", "DECELERATING"),
    (10, 20.0, 17.0, 1.5, 10, 19, 18.65, 18.5, "DECELERATING", "DECELERATING"),
    (10, 20.0, 17.0, 1.5, 10, 29, 17.15, 17.0, "DECELERATING", "STEADY"),
    (10, 20.0, 17.0, 1.5, 10, 30, 17.0, 17.0, "STEADY", "STEADY"),
)


def _literal_decelerating_speed(
    frequency_hz: int,
    actor_speed_mps: float,
    terminal_speed_mps: float,
    deceleration_mps2: float,
    decel_start_step: int,
    sample: int,
) -> float:
    elapsed_s = max(0.0, (sample - decel_start_step) / frequency_hz)
    return max(
        terminal_speed_mps,
        actor_speed_mps - deceleration_mps2 * elapsed_s,
    )


def _literal_decelerating_phase(
    decel_start_step: int,
    terminal_intervals: int,
    sample: int,
) -> str:
    if decel_start_step <= sample < decel_start_step + terminal_intervals:
        return "DECELERATING"
    return "STEADY"


def test_literal_lead_deceleration_fixture_reproduces_every_conformance_vector() -> None:
    for (
        frequency_hz,
        actor_speed_mps,
        terminal_speed_mps,
        deceleration_mps2,
        decel_start_step,
        sequence,
        expected_input_speed,
        expected_result_speed,
        expected_input_phase,
        expected_result_phase,
    ) in LEAD_DECELERATION_CONFORMANCE_VECTORS:
        terminal_intervals = 25 if terminal_speed_mps == 15.0 else 20
        assert _literal_decelerating_speed(
            frequency_hz,
            actor_speed_mps,
            terminal_speed_mps,
            deceleration_mps2,
            decel_start_step,
            sequence,
        ) == pytest.approx(expected_input_speed, abs=1e-12)
        assert _literal_decelerating_speed(
            frequency_hz,
            actor_speed_mps,
            terminal_speed_mps,
            deceleration_mps2,
            decel_start_step,
            sequence + 1,
        ) == pytest.approx(expected_result_speed, abs=1e-12)
        assert (
            _literal_decelerating_phase(
                decel_start_step,
                terminal_intervals,
                sequence,
            )
            == expected_input_phase
        )
        assert (
            _literal_decelerating_phase(
                decel_start_step,
                terminal_intervals,
                sequence + 1,
            )
            == expected_result_phase
        )


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
    actor_speed = getattr(scenario.challenge, "actor_speed_mps", 0.0)
    in_path = getattr(scenario.challenge, "initial_lane_delta", 0) == 0
    if scenario.challenge.kind == "stationary_lead":
        phase = "PRESENT"
    elif scenario.challenge.kind == "steady_lead":
        phase = "STEADY"
    elif scenario.challenge.kind == "lead_decelerates":
        phase = (
            "DECELERATING"
            if scenario.challenge.decel_start_step == 0
            else "STEADY"
        )
    else:
        phase = "PRE_TRIGGER"
    result_phase = phase
    result_actor_speed = actor_speed
    if scenario.challenge.kind == "lead_decelerates":
        result_actor_speed = _literal_decelerating_speed(
            scenario.control.frequency_hz,
            scenario.challenge.actor_speed_mps,
            scenario.challenge.terminal_speed_mps,
            scenario.challenge.deceleration_mps2,
            scenario.challenge.decel_start_step,
            1,
        )
        result_phase = _literal_decelerating_phase(
            scenario.challenge.decel_start_step,
            _literal_terminal_intervals(scenario),
            1,
        )
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
        "front_distance_m": initial_gap if in_path else None,
        "front_relative_speed_mps": actor_speed if in_path else None,
        "challenge_actor_longitudinal_m": initial_gap + 4.515,
        "challenge_actor_lateral_offset_m": (
            4.0 * getattr(scenario.challenge, "initial_lane_delta", 0)
        ),
        "challenge_actor_speed_mps": actor_speed,
        "challenge_phase": phase,
        "result_front_distance_m": initial_gap if in_path else None,
        "result_front_relative_speed_mps": actor_speed if in_path else None,
        "result_challenge_actor_longitudinal_m": initial_gap + 4.515,
        "result_challenge_actor_lateral_offset_m": (
            4.0 * getattr(scenario.challenge, "initial_lane_delta", 0)
        ),
        "result_challenge_actor_speed_mps": result_actor_speed,
        "result_challenge_phase": result_phase,
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


def _fault_challenge_event(
    scenario: ScenarioDefinition,
    *,
    input_phase: str | None = None,
    front_relative_speed_mps: float | None | object = _UNSET,
    result_actor_speed_mps: float | None | object = _UNSET,
    raw_updates: dict[str, object] | None = None,
    delivered_updates: dict[str, object] | None = None,
    result_updates: dict[str, object] | None = None,
    evidence_updates: dict[str, object] | None = None,
    summary_updates: dict[str, object] | None = None,
):
    assert scenario.challenge is not None
    actor_speed = getattr(scenario.challenge, "actor_speed_mps", 0.0)
    in_path = getattr(scenario.challenge, "initial_lane_delta", 0) == 0
    if input_phase is not None:
        phase = input_phase
    elif scenario.challenge.kind == "stationary_lead":
        phase = "PRESENT"
    elif scenario.challenge.kind == "steady_lead":
        phase = "STEADY"
    elif scenario.challenge.kind == "lead_decelerates":
        phase = (
            "DECELERATING"
            if scenario.challenge.decel_start_step == 0
            else "STEADY"
        )
    else:
        phase = "PRE_TRIGGER"
    if front_relative_speed_mps is _UNSET:
        front_relative_speed_mps = actor_speed if in_path else None
    if result_actor_speed_mps is _UNSET:
        result_actor_speed_mps = (
            _literal_decelerating_speed(
                scenario.control.frequency_hz,
                scenario.challenge.actor_speed_mps,
                scenario.challenge.terminal_speed_mps,
                scenario.challenge.deceleration_mps2,
                scenario.challenge.decel_start_step,
                1,
            )
            if scenario.challenge.kind == "lead_decelerates"
            else actor_speed
        )
    assert isinstance(front_relative_speed_mps, (float, int)) or front_relative_speed_mps is None
    assert isinstance(result_actor_speed_mps, (float, int)) or result_actor_speed_mps is None
    state = VehicleState(
        position_m=0.0,
        speed_mps=scenario.initial_state.speed_mps,
        acceleration_mps2=0.0,
        lateral_offset_m=scenario.initial_state.lateral_offset_m,
        route_progress_pct=0.0,
        collision_count=0,
        offroad=False,
        destination_reached=False,
    )
    result_state = state.model_copy(
        update={
            "position_m": scenario.road.destination_distance_m,
            "route_progress_pct": 100.0,
            "destination_reached": True,
        }
    )
    base_raw = Observation(
        sequence=0,
        simulation_time_s=0.0,
        vehicle_state=state,
        front_distance_m=scenario.challenge.initial_gap_m if in_path else None,
        front_relative_speed_mps=front_relative_speed_mps,
        challenge_actor_longitudinal_m=scenario.challenge.initial_gap_m + 4.515,
        challenge_actor_lateral_offset_m=0.0,
        challenge_actor_speed_mps=actor_speed,
        challenge_phase=(
            _literal_decelerating_phase(
                scenario.challenge.decel_start_step,
                _literal_terminal_intervals(scenario),
                1,
            )
            if scenario.challenge.kind == "lead_decelerates"
            else phase
        ),
    )
    raw = base_raw.model_copy(update=raw_updates or {})
    delivered = base_raw.model_copy(update=delivered_updates or {})
    result = Observation(
        sequence=1,
        simulation_time_s=0.1,
        vehicle_state=result_state,
        front_distance_m=scenario.challenge.initial_gap_m if in_path else None,
        front_relative_speed_mps=actor_speed if in_path else None,
        challenge_actor_longitudinal_m=scenario.challenge.initial_gap_m + 4.515,
        challenge_actor_lateral_offset_m=0.0,
        challenge_actor_speed_mps=result_actor_speed_mps,
        challenge_phase=phase,
    ).model_copy(update=result_updates or {})
    context = RunContextV2(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        fault_name="deterministic-faults",
        fault_version="1.0",
        fault_config_digest="1" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=scenario.control.horizon_steps,
    )
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    summary = {
        "input_sequence": 0,
        "input_simulation_time_s": 0.0,
        "speed_mps": state.speed_mps,
        "lateral_offset_m": state.lateral_offset_m,
        "route_progress_pct": state.route_progress_pct,
        "observation_age_s": 0.0,
        "front_distance_m": delivered.front_distance_m,
        "front_relative_speed_mps": delivered.front_relative_speed_mps,
        "challenge_actor_longitudinal_m": delivered.challenge_actor_longitudinal_m,
        "challenge_actor_lateral_offset_m": delivered.challenge_actor_lateral_offset_m,
        "challenge_actor_speed_mps": delivered.challenge_actor_speed_mps,
        "challenge_phase": delivered.challenge_phase,
        "result_front_distance_m": result.front_distance_m,
        "result_front_relative_speed_mps": result.front_relative_speed_mps,
        "result_challenge_actor_longitudinal_m": result.challenge_actor_longitudinal_m,
        "result_challenge_actor_lateral_offset_m": (
            result.challenge_actor_lateral_offset_m
        ),
        "result_challenge_actor_speed_mps": result.challenge_actor_speed_mps,
        "result_challenge_phase": result.challenge_phase,
    }
    summary.update(summary_updates or {})
    observation_evidence = {
        "raw_observation": raw,
        "delivered_observation": delivered,
        "delivered_from_sequence": 0,
        "delivered_from_time_s": 0.0,
        "delivery_time_s": 0.0,
        "applied_faults": (),
        "speed_noise_delta_mps": 0.0,
        "lateral_noise_delta_m": 0.0,
    }
    observation_evidence.update(evidence_updates or {})
    return create_trace_event_v2(
        sequence=0,
        simulation_time_s=0.1,
        run_context=context,
        observation_summary=summary,
        candidate_action=action,
        permitted_action=action,
        executed_action=action,
        override_reasons=(),
        observation_fault_evidence=ObservationFaultEvidence.model_validate(
            observation_evidence
        ),
        control_fault_evidence=ControlFaultEvidence(
            candidate_time_s=0.0,
            executed_from_sequence=None,
            executed_from_candidate_time_s=None,
            execution_time_s=0.0,
            pre_saturation_action=action,
            applied_faults=("CONTROL_DELAY_FILL",),
            control_latency_ms=Measurement(
                availability=EvidenceAvailability.NOT_AVAILABLE,
                reason="control-delay startup fill has no originating candidate",
                unit="ms",
            ),
            latency_source="simulated",
        ),
        result_observation=result,
        vehicle_state=result_state,
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


def _schema3_action_fault_challenge(repository_root: Path) -> ScenarioDefinition:
    legacy = load_scenario(
        repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
    )
    faults = FaultConfig(
        schema_version="1.0",
        name="action_delay_only",
        version="1.0",
        label="illustrative_simulation_faults_not_real_vehicle_limits",
        control_delay_steps=1,
    )
    return legacy.model_copy(
        update={
            "schema_version": "3.0",
            "faults": faults,
        }
    )


def _stationary_scenario(
    *,
    initial_lane_delta: int = 0,
    with_fault: bool = False,
) -> ScenarioDefinition:
    payload: dict[str, object] = {
        "schema_version": "4.0",
        "name": "stationary_trace_unit",
        "version": "1.0",
        "description": "Static actor trace-contract unit scenario.",
        "adapter": "metadrive",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": 2,
            "target_speed_mps": 0.0,
        },
        "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 20.0, "boundary_tolerance_m": 1.5},
        "challenge": {
            "kind": "stationary_lead",
            "actor_control_mode": "scripted_kinematic_replay",
            "behavior_realism_claim": False,
            "initial_gap_m": 12.0,
            "initial_lane_delta": initial_lane_delta,
        },
    }
    if with_fault:
        payload["faults"] = {
            "schema_version": "1.0",
            "name": "stationary_control_delay",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            "control_delay_steps": 1,
        }
    return ScenarioDefinition.model_validate(payload)


def _steady_scenario(
    *,
    initial_lane_delta: int = 0,
    with_fault: bool = False,
) -> ScenarioDefinition:
    payload: dict[str, object] = {
        "schema_version": "4.0",
        "name": "steady_trace_unit",
        "version": "1.0",
        "description": "Steady actor trace-contract unit scenario.",
        "adapter": "metadrive",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": 2,
            "target_speed_mps": 0.0,
        },
        "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 20.0, "boundary_tolerance_m": 1.5},
        "challenge": {
            "kind": "steady_lead",
            "actor_control_mode": "scripted_kinematic_replay",
            "behavior_realism_claim": False,
            "initial_gap_m": 12.0,
            "actor_speed_mps": 4.0,
            "initial_lane_delta": initial_lane_delta,
        },
    }
    if with_fault:
        payload["faults"] = {
            "schema_version": "1.0",
            "name": "steady_control_delay",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            "control_delay_steps": 1,
        }
    return ScenarioDefinition.model_validate(payload)


def _decelerating_scenario(
    *,
    actor_speed_mps: float = 20.0,
    terminal_speed_mps: float = 15.0,
    deceleration_mps2: float = 2.0,
    decel_start_step: int = 10,
    horizon_steps: int = 36,
    faults: dict[str, object] | None = None,
) -> ScenarioDefinition:
    payload: dict[str, object] = {
        "schema_version": "4.0",
        "name": "lead_decelerates_trace_unit",
        "version": "1.0",
        "description": "Scripted decelerating actor trace-contract unit scenario.",
        "adapter": "metadrive",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": horizon_steps,
            "target_speed_mps": 0.0,
        },
        "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 240.0, "boundary_tolerance_m": 1.5},
        "challenge": {
            "kind": "lead_decelerates",
            "actor_control_mode": "scripted_kinematic_replay",
            "behavior_realism_claim": False,
            "initial_gap_m": 40.0,
            "actor_speed_mps": actor_speed_mps,
            "deceleration_mps2": deceleration_mps2,
            "decel_start_step": decel_start_step,
            "terminal_speed_mps": terminal_speed_mps,
        },
    }
    if faults is not None:
        payload["faults"] = {
            "schema_version": "1.0",
            "name": "lead_decelerates_observation_fault",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            **faults,
        }
    return ScenarioDefinition.model_validate(payload)


def _literal_terminal_intervals(scenario: ScenarioDefinition) -> int:
    assert scenario.challenge is not None
    assert scenario.challenge.kind == "lead_decelerates"
    values = (
        scenario.control.frequency_hz,
        scenario.challenge.actor_speed_mps,
        scenario.challenge.terminal_speed_mps,
        scenario.challenge.deceleration_mps2,
        scenario.challenge.decel_start_step,
    )
    if values == (10, 20.0, 15.0, 2.0, 10):
        return 25
    if values == (10, 20.0, 17.0, 1.5, 10):
        return 20
    if values == (10, 5.0, 2.0, 10.0, 1):
        return 3
    raise AssertionError(f"test fixture has no literal terminal interval for {values!r}")


def _literal_decelerating_displacement(
    scenario: ScenarioDefinition,
    sample: int,
) -> float:
    assert scenario.challenge is not None
    assert scenario.challenge.kind == "lead_decelerates"
    dt = 1.0 / scenario.control.frequency_hz
    time_s = sample * dt
    start_s = scenario.challenge.decel_start_step * dt
    terminal_elapsed_s = (
        scenario.challenge.actor_speed_mps - scenario.challenge.terminal_speed_mps
    ) / scenario.challenge.deceleration_mps2
    elapsed_s = max(0.0, time_s - start_s)
    active_s = min(elapsed_s, terminal_elapsed_s)
    return (
        scenario.challenge.actor_speed_mps * min(time_s, start_s)
        + scenario.challenge.actor_speed_mps * active_s
        - 0.5 * scenario.challenge.deceleration_mps2 * active_s * active_s
        + scenario.challenge.terminal_speed_mps
        * max(0.0, elapsed_s - terminal_elapsed_s)
    )


def _decelerating_observations(
    scenario: ScenarioDefinition,
    *,
    updates_by_sequence: dict[int, dict[str, object]] | None = None,
) -> tuple[Observation, ...]:
    assert scenario.challenge is not None
    assert scenario.challenge.kind == "lead_decelerates"
    terminal_intervals = _literal_terminal_intervals(scenario)
    observations = []
    for sequence in range(scenario.control.horizon_steps + 1):
        actor_speed = _literal_decelerating_speed(
            scenario.control.frequency_hz,
            scenario.challenge.actor_speed_mps,
            scenario.challenge.terminal_speed_mps,
            scenario.challenge.deceleration_mps2,
            scenario.challenge.decel_start_step,
            sequence,
        )
        displacement = _literal_decelerating_displacement(scenario, sequence)
        observation = Observation(
            sequence=sequence,
            simulation_time_s=sequence / scenario.control.frequency_hz,
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
            front_distance_m=scenario.challenge.initial_gap_m + displacement,
            front_relative_speed_mps=actor_speed,
            challenge_actor_longitudinal_m=(
                scenario.challenge.initial_gap_m + 4.515 + displacement
            ),
            challenge_actor_lateral_offset_m=0.0,
            challenge_actor_speed_mps=actor_speed,
            challenge_phase=_literal_decelerating_phase(
                scenario.challenge.decel_start_step,
                terminal_intervals,
                sequence,
            ),
        )
        if updates_by_sequence and sequence in updates_by_sequence:
            observation = observation.model_copy(
                update=updates_by_sequence[sequence]
            )
        observations.append(observation)
    return tuple(observations)


def _multi_event_decelerating_trace(
    scenario: ScenarioDefinition,
    *,
    summary_updates_by_sequence: dict[int, dict[str, object]] | None = None,
):
    assert scenario.faults is None
    observations = _decelerating_observations(scenario)
    context = _context(horizon_steps=scenario.control.horizon_steps).model_copy(
        update={"adapter_name": "metadrive", "policy_name": "metadrive-idm"}
    )
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    previous_hash = GENESIS_HASH
    events = []
    for sequence in range(scenario.control.horizon_steps):
        summary = _challenge_summary(observations[sequence], observations[sequence + 1])
        if summary_updates_by_sequence and sequence in summary_updates_by_sequence:
            summary.update(summary_updates_by_sequence[sequence])
        is_last = sequence == scenario.control.horizon_steps - 1
        event = create_trace_event(
            sequence=sequence,
            simulation_time_s=(sequence + 1) / scenario.control.frequency_hz,
            run_context=context,
            observation_summary=summary,
            candidate_action=action,
            executed_action=action,
            override_reasons=(),
            vehicle_state=observations[sequence + 1].vehicle_state,
            policy_latency_ms=10.0,
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
                "route_progress_pct": 0.0,
            },
            previous_hash=previous_hash,
        )
        events.append(event)
        previous_hash = event.current_hash
    return tuple(events)


def _multi_event_fault_decelerating_trace(
    scenario: ScenarioDefinition,
    *,
    raw_updates_by_sequence: dict[int, dict[str, object]] | None = None,
    delivered_updates_by_sequence: dict[int, dict[str, object]] | None = None,
    result_updates_by_sequence: dict[int, dict[str, object]] | None = None,
):
    assert scenario.faults is not None
    scheduled_observations = _decelerating_observations(scenario)
    raw_observations = tuple(
        observation.model_copy(
            update=(raw_updates_by_sequence or {}).get(sequence, {})
        )
        for sequence, observation in enumerate(scheduled_observations)
    )
    injector = DeterministicFaultInjector(scenario.faults)
    injector.reset(scenario, seed=7)
    deliveries = [
        injector.process_observation(raw_observations[sequence])
        for sequence in range(scenario.control.horizon_steps)
    ]
    context = RunContextV2(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        fault_name="deterministic-faults",
        fault_version="1.0",
        fault_config_digest="1" * 64,
        seed=7,
        control_frequency_hz=scenario.control.frequency_hz,
        horizon_steps=scenario.control.horizon_steps,
    )
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    previous_hash = GENESIS_HASH
    events = []
    for sequence, faulted in enumerate(deliveries):
        delivered = faulted.observation
        if delivered_updates_by_sequence and sequence in delivered_updates_by_sequence:
            delivered = delivered.model_copy(
                update=delivered_updates_by_sequence[sequence]
            )
        result = scheduled_observations[sequence + 1]
        if result_updates_by_sequence and sequence in result_updates_by_sequence:
            result = result.model_copy(update=result_updates_by_sequence[sequence])
        is_last = sequence == scenario.control.horizon_steps - 1
        event = create_trace_event_v2(
            sequence=sequence,
            simulation_time_s=(sequence + 1) / scenario.control.frequency_hz,
            run_context=context,
            observation_summary=_challenge_summary(delivered, result),
            candidate_action=action,
            permitted_action=action,
            executed_action=action,
            override_reasons=(),
            observation_fault_evidence=ObservationFaultEvidence(
                raw_observation=raw_observations[sequence],
                delivered_observation=delivered,
                delivered_from_sequence=faulted.source_sequence,
                delivered_from_time_s=faulted.source_simulation_time_s,
                delivery_time_s=faulted.delivery_time_s,
                applied_faults=faulted.reason_codes,
                speed_noise_delta_mps=faulted.noise_deltas.speed_mps,
                lateral_noise_delta_m=faulted.noise_deltas.lateral_offset_m,
            ),
            control_fault_evidence=ControlFaultEvidence(
                candidate_time_s=sequence / scenario.control.frequency_hz,
                executed_from_sequence=sequence,
                executed_from_candidate_time_s=(
                    sequence / scenario.control.frequency_hz
                ),
                execution_time_s=sequence / scenario.control.frequency_hz,
                pre_saturation_action=action,
                applied_faults=(),
                control_latency_ms=Measurement(
                    availability=EvidenceAvailability.AVAILABLE,
                    value=0.0,
                    unit="ms",
                ),
                latency_source="simulated",
            ),
            result_observation=result,
            vehicle_state=result.vehicle_state,
            policy_latency_ms=10.0,
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
                "route_progress_pct": 0.0,
            },
            previous_hash=previous_hash,
        )
        events.append(event)
        previous_hash = event.current_hash
    return tuple(events)


def _steady_observations(scenario: ScenarioDefinition) -> tuple[Observation, ...]:
    assert scenario.challenge is not None
    assert scenario.challenge.kind == "steady_lead"
    in_path = scenario.challenge.initial_lane_delta == 0
    observations = []
    for sequence in range(3):
        actor_advance = scenario.challenge.actor_speed_mps * sequence / 10
        observations.append(
            Observation(
                sequence=sequence,
                simulation_time_s=sequence / 10,
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
                front_distance_m=(
                    scenario.challenge.initial_gap_m + actor_advance
                    if in_path
                    else None
                ),
                front_relative_speed_mps=(
                    scenario.challenge.actor_speed_mps if in_path else None
                ),
                challenge_actor_longitudinal_m=(
                    scenario.challenge.initial_gap_m + 4.515 + actor_advance
                ),
                challenge_actor_lateral_offset_m=(
                    4.0 * scenario.challenge.initial_lane_delta
                ),
                challenge_actor_speed_mps=scenario.challenge.actor_speed_mps,
                challenge_phase="STEADY",
            )
        )
    return tuple(observations)


def _challenge_summary(
    delivered: Observation,
    result: Observation,
) -> dict[str, object]:
    return {
        "input_sequence": delivered.sequence,
        "input_simulation_time_s": delivered.simulation_time_s,
        "speed_mps": delivered.vehicle_state.speed_mps,
        "lateral_offset_m": delivered.vehicle_state.lateral_offset_m,
        "route_progress_pct": delivered.vehicle_state.route_progress_pct,
        "observation_age_s": delivered.observation_age_s,
        "front_distance_m": delivered.front_distance_m,
        "front_relative_speed_mps": delivered.front_relative_speed_mps,
        "challenge_actor_longitudinal_m": delivered.challenge_actor_longitudinal_m,
        "challenge_actor_lateral_offset_m": (
            delivered.challenge_actor_lateral_offset_m
        ),
        "challenge_actor_speed_mps": delivered.challenge_actor_speed_mps,
        "challenge_phase": delivered.challenge_phase,
        "result_front_distance_m": result.front_distance_m,
        "result_front_relative_speed_mps": result.front_relative_speed_mps,
        "result_challenge_actor_longitudinal_m": (
            result.challenge_actor_longitudinal_m
        ),
        "result_challenge_actor_lateral_offset_m": (
            result.challenge_actor_lateral_offset_m
        ),
        "result_challenge_actor_speed_mps": result.challenge_actor_speed_mps,
        "result_challenge_phase": result.challenge_phase,
    }


def _multi_event_steady_trace(
    scenario: ScenarioDefinition,
    *,
    later_summary_updates: dict[str, object] | None = None,
):
    assert scenario.faults is None
    observations = _steady_observations(scenario)
    context = _context(horizon_steps=scenario.control.horizon_steps).model_copy(
        update={"adapter_name": "metadrive", "policy_name": "metadrive-idm"}
    )
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    previous_hash = GENESIS_HASH
    events = []
    for sequence in range(2):
        summary = _challenge_summary(observations[sequence], observations[sequence + 1])
        if sequence == 1:
            summary.update(later_summary_updates or {})
        is_last = sequence == 1
        event = create_trace_event(
            sequence=sequence,
            simulation_time_s=(sequence + 1) / 10,
            run_context=context,
            observation_summary=summary,
            candidate_action=action,
            executed_action=action,
            override_reasons=(),
            vehicle_state=observations[sequence + 1].vehicle_state,
            policy_latency_ms=10.0,
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
                "route_progress_pct": 0.0,
            },
            previous_hash=previous_hash,
        )
        events.append(event)
        previous_hash = event.current_hash
    return tuple(events)


def _multi_event_fault_steady_trace(
    scenario: ScenarioDefinition,
    *,
    later_delivered_updates: dict[str, object] | None = None,
    later_result_updates: dict[str, object] | None = None,
):
    assert scenario.faults is not None
    observations = _steady_observations(scenario)
    context = RunContextV2(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        fault_name="deterministic-faults",
        fault_version="1.0",
        fault_config_digest="1" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=scenario.control.horizon_steps,
    )
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    previous_hash = GENESIS_HASH
    events = []
    for sequence in range(2):
        raw = observations[sequence]
        delivered = raw
        result = observations[sequence + 1]
        if sequence == 1:
            delivered = delivered.model_copy(update=later_delivered_updates or {})
            result = result.model_copy(update=later_result_updates or {})
        observation_evidence = ObservationFaultEvidence(
            raw_observation=raw,
            delivered_observation=delivered,
            delivered_from_sequence=sequence,
            delivered_from_time_s=raw.simulation_time_s,
            delivery_time_s=raw.simulation_time_s,
            applied_faults=(),
            speed_noise_delta_mps=0.0,
            lateral_noise_delta_m=0.0,
        )
        if sequence == 0:
            source_sequence = None
            source_time = None
            applied_faults = ("CONTROL_DELAY_FILL",)
            latency = Measurement(
                availability=EvidenceAvailability.NOT_AVAILABLE,
                reason="control-delay startup fill has no originating candidate",
                unit="ms",
            )
        else:
            source_sequence = 0
            source_time = 0.0
            applied_faults = ("CONTROL_DELAY",)
            latency = Measurement(
                availability=EvidenceAvailability.AVAILABLE,
                value=100.0,
                unit="ms",
            )
        is_last = sequence == 1
        event = create_trace_event_v2(
            sequence=sequence,
            simulation_time_s=(sequence + 1) / 10,
            run_context=context,
            observation_summary=_challenge_summary(delivered, result),
            candidate_action=action,
            permitted_action=action,
            executed_action=action,
            override_reasons=(),
            observation_fault_evidence=observation_evidence,
            control_fault_evidence=ControlFaultEvidence(
                candidate_time_s=sequence / 10,
                executed_from_sequence=source_sequence,
                executed_from_candidate_time_s=source_time,
                execution_time_s=sequence / 10,
                pre_saturation_action=action,
                applied_faults=applied_faults,
                control_latency_ms=latency,
                latency_source="simulated",
            ),
            result_observation=result,
            vehicle_state=result.vehicle_state,
            policy_latency_ms=10.0,
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
                "route_progress_pct": 0.0,
            },
            previous_hash=previous_hash,
        )
        events.append(event)
        previous_hash = event.current_hash
    return tuple(events)


def test_steady_challenge_trace_accepts_declared_speed_phase_and_in_lane_gap() -> None:
    scenario = _steady_scenario()
    event = _challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


@pytest.mark.parametrize(
    "field_name",
    ["challenge_actor_speed_mps", "result_challenge_actor_speed_mps"],
)
def test_steady_challenge_trace_rejects_off_speed_input_and_result(
    field_name: str,
) -> None:
    scenario = _steady_scenario()
    event = _challenge_event(scenario, summary_updates={field_name: 4.001})

    with pytest.raises(TraceIntegrityError, match="initial challenge actor speed"):
        verify_complete_trace((event,), scenario)


def test_multi_event_steady_trace_accepts_later_constant_speed_and_continuity() -> None:
    scenario = _steady_scenario()
    events = _multi_event_steady_trace(scenario)

    assert verify_complete_trace(events, scenario) == events[-1].current_hash


@pytest.mark.parametrize(
    "field_name",
    ["challenge_actor_speed_mps", "result_challenge_actor_speed_mps"],
)
def test_multi_event_steady_trace_rejects_later_off_speed_input_and_result(
    field_name: str,
) -> None:
    scenario = _steady_scenario()
    events = _multi_event_steady_trace(
        scenario,
        later_summary_updates={field_name: 4.001},
    )

    with pytest.raises(
        TraceIntegrityError,
        match=rf"{field_name} contradicts declared steady actor speed at sequence 1",
    ):
        verify_complete_trace(events, scenario)


def test_multi_event_steady_trace_uses_generic_actor_continuity() -> None:
    scenario = _steady_scenario()
    events = _multi_event_steady_trace(
        scenario,
        later_summary_updates={"challenge_actor_longitudinal_m": 99.0},
    )

    with pytest.raises(
        TraceIntegrityError,
        match="challenge_actor_longitudinal_m disagrees with the prior result at sequence 1",
    ):
        verify_complete_trace(events, scenario)


def test_steady_challenge_trace_rejects_false_phase_without_crashing() -> None:
    scenario = _steady_scenario()
    event = _challenge_event(scenario, summary_updates={"result_challenge_phase": "PRESENT"})

    with pytest.raises(TraceIntegrityError, match="contradicts the scenario schedule"):
        verify_complete_trace((event,), scenario)


def test_steady_challenge_trace_binds_initial_in_lane_gap() -> None:
    scenario = _steady_scenario()
    event = _challenge_event(scenario, summary_updates={"front_distance_m": 11.0})

    with pytest.raises(TraceIntegrityError, match="initial front gap"):
        verify_complete_trace((event,), scenario)


def test_adjacent_steady_trace_accepts_paired_null_front_fields() -> None:
    scenario = _steady_scenario(initial_lane_delta=1)
    event = _challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


def test_adjacent_steady_trace_rejects_false_front_overlap() -> None:
    scenario = _steady_scenario(initial_lane_delta=1)
    event = _challenge_event(
        scenario,
        summary_updates={
            "front_distance_m": scenario.challenge.initial_gap_m,
            "front_relative_speed_mps": 4.0,
        },
    )

    with pytest.raises(TraceIntegrityError, match="adjacent steady actor"):
        verify_complete_trace((event,), scenario)


def test_fault_steady_trace_accepts_declared_speed_phase_and_in_lane_gap() -> None:
    scenario = _steady_scenario(with_fault=True)
    event = _fault_challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


def test_multi_event_fault_steady_trace_accepts_later_constant_speed_and_continuity() -> None:
    scenario = _steady_scenario(with_fault=True)
    events = _multi_event_fault_steady_trace(scenario)

    assert verify_complete_trace(events, scenario) == events[-1].current_hash


def test_multi_event_fault_steady_trace_rejects_later_off_speed_result() -> None:
    scenario = _steady_scenario(with_fault=True)
    events = _multi_event_fault_steady_trace(
        scenario,
        later_result_updates={"challenge_actor_speed_mps": 4.001},
    )

    with pytest.raises(
        TraceIntegrityError,
        match=(
            "result_challenge_actor_speed_mps contradicts declared steady actor speed "
            "at sequence 1"
        ),
    ):
        verify_complete_trace(events, scenario)


def test_multi_event_fault_steady_trace_rejects_later_off_speed_delivered_input() -> None:
    scenario = _steady_scenario(with_fault=True)
    events = _multi_event_fault_steady_trace(
        scenario,
        later_delivered_updates={"challenge_actor_speed_mps": 4.001},
    )

    with pytest.raises(
        TraceIntegrityError,
        match=(
            "challenge_actor_speed_mps contradicts declared steady actor speed "
            "at sequence 1"
        ),
    ):
        verify_complete_trace(events, scenario)


def test_fault_adjacent_steady_delivered_summary_accepts_paired_null_front_fields() -> None:
    scenario = _steady_scenario(initial_lane_delta=1, with_fault=True)
    event = _fault_challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


def test_fault_in_lane_steady_delivered_summary_rejects_incorrect_initial_gap() -> None:
    scenario = _steady_scenario(with_fault=True)
    event = _fault_challenge_event(
        scenario,
        delivered_updates={"front_distance_m": 11.0},
    )

    with pytest.raises(TraceIntegrityError, match="initial front gap"):
        verify_complete_trace((event,), scenario)


def test_fault_adjacent_steady_delivered_summary_rejects_false_front_overlap() -> None:
    scenario = _steady_scenario(initial_lane_delta=1, with_fault=True)
    event = _fault_challenge_event(
        scenario,
        delivered_updates={
            "front_distance_m": scenario.challenge.initial_gap_m,
            "front_relative_speed_mps": 4.0,
        },
    )

    with pytest.raises(TraceIntegrityError, match="adjacent steady actor"):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize(
    ("packet", "updates"),
    [
        ("delivered", {"delivered_updates": {"challenge_actor_speed_mps": 4.001}}),
        ("result", {"result_updates": {"challenge_actor_speed_mps": 4.001}}),
    ],
)
def test_fault_steady_trace_rejects_off_speed_delivered_and_result_packets(
    packet: str,
    updates: dict[str, object],
) -> None:
    del packet
    scenario = _steady_scenario(with_fault=True)
    event = _fault_challenge_event(scenario, **updates)

    with pytest.raises(TraceIntegrityError, match="initial actor speed"):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize(
    ("raw_updates", "message"),
    [
        ({"challenge_actor_speed_mps": 4.001}, "raw steady actor speed"),
        ({"challenge_phase": "PRESENT"}, "raw steady actor phase"),
        ({"front_distance_m": 11.0}, "raw initial front gap"),
    ],
)
def test_fault_steady_trace_binds_initial_raw_actor_to_scenario(
    raw_updates: dict[str, object],
    message: str,
) -> None:
    scenario = _steady_scenario(with_fault=True)
    event = _fault_challenge_event(scenario, raw_updates=raw_updates)

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace((event,), scenario)


def test_fault_adjacent_steady_raw_actor_requires_paired_null_front_fields() -> None:
    scenario = _steady_scenario(initial_lane_delta=1, with_fault=True)
    event = _fault_challenge_event(
        scenario,
        raw_updates={
            "front_distance_m": scenario.challenge.initial_gap_m,
            "front_relative_speed_mps": 4.0,
        },
    )

    with pytest.raises(TraceIntegrityError, match="paired-null front fields"):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize(
    ("terminal_speed_mps", "deceleration_mps2", "horizon_steps"),
    ((15.0, 2.0, 36), (17.0, 1.5, 31)),
)
def test_decelerating_trace_accepts_literal_speed_and_phase_vectors_without_fallthrough(
    terminal_speed_mps: float,
    deceleration_mps2: float,
    horizon_steps: int,
) -> None:
    scenario = _decelerating_scenario(
        terminal_speed_mps=terminal_speed_mps,
        deceleration_mps2=deceleration_mps2,
        horizon_steps=horizon_steps,
    )
    events = _multi_event_decelerating_trace(scenario)

    assert verify_complete_trace(events, scenario) == events[-1].current_hash
    matching_vectors = [
        vector
        for vector in LEAD_DECELERATION_CONFORMANCE_VECTORS
        if vector[2] == terminal_speed_mps
    ]
    for vector in matching_vectors:
        sequence = vector[5]
        summary = events[sequence].observation_summary
        assert summary["challenge_actor_speed_mps"] == pytest.approx(
            vector[6], abs=1e-12
        )
        assert summary["result_challenge_actor_speed_mps"] == pytest.approx(
            vector[7], abs=1e-12
        )
        assert summary["challenge_phase"] == vector[8]
        assert summary["result_challenge_phase"] == vector[9]


@pytest.mark.parametrize(
    "field_name",
    ("challenge_actor_speed_mps", "result_challenge_actor_speed_mps"),
)
def test_decelerating_clean_trace_rejects_mid_schedule_speed_mutations(
    field_name: str,
) -> None:
    scenario = _decelerating_scenario()
    events = _multi_event_decelerating_trace(
        scenario,
        summary_updates_by_sequence={22: {field_name: 17.0}},
    )

    with pytest.raises(
        TraceIntegrityError,
        match=rf"{field_name} contradicts declared decelerating actor speed at sequence 22",
    ):
        verify_complete_trace(events, scenario)


@pytest.mark.parametrize(
    ("sequence", "field_name", "wrong_phase"),
    (
        (10, "challenge_phase", "STEADY"),
        (34, "result_challenge_phase", "DECELERATING"),
    ),
)
def test_decelerating_clean_trace_rejects_wrong_half_open_boundary_phases(
    sequence: int,
    field_name: str,
    wrong_phase: str,
) -> None:
    scenario = _decelerating_scenario()
    events = _multi_event_decelerating_trace(
        scenario,
        summary_updates_by_sequence={sequence: {field_name: wrong_phase}},
    )

    with pytest.raises(TraceIntegrityError, match="contradicts the scenario schedule"):
        verify_complete_trace(events, scenario)


def test_decelerating_clean_trace_binds_the_initial_in_lane_gap() -> None:
    scenario = _decelerating_scenario()
    events = _multi_event_decelerating_trace(
        scenario,
        summary_updates_by_sequence={0: {"front_distance_m": 39.0}},
    )

    with pytest.raises(TraceIntegrityError, match="initial front gap"):
        verify_complete_trace(events, scenario)


def test_expected_actor_speed_helper_rejects_dynamic_challenge_kinds(
    repository_root: Path,
) -> None:
    scenario = load_scenario(
        repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
    )

    with pytest.raises(TraceIntegrityError, match="scripted actor speed is unavailable"):
        trace_module._expected_actor_speed(scenario, 0, result=False)


@pytest.mark.parametrize(
    ("faults", "sequence", "source_sequence", "reason", "delivered_speed"),
    (
        (
            {"observation_delay_steps": 1},
            1,
            0,
            "OBSERVATION_DELAY",
            5.0,
        ),
        (
            {"frozen_observation_interval": {"start_step": 2, "duration_steps": 2}},
            3,
            2,
            "OBSERVATION_FROZEN",
            4.0,
        ),
        (
            {"dropped_observation_steps": (3,)},
            3,
            2,
            "OBSERVATION_DROPOUT_HOLD_LAST",
            4.0,
        ),
    ),
)
def test_decelerating_fault_trace_preserves_schedule_provenance_across_fault_modes(
    faults: dict[str, object],
    sequence: int,
    source_sequence: int,
    reason: str,
    delivered_speed: float,
) -> None:
    scenario = _decelerating_scenario(
        actor_speed_mps=5.0,
        terminal_speed_mps=2.0,
        deceleration_mps2=10.0,
        decel_start_step=1,
        horizon_steps=4,
        faults=faults,
    )
    events = _multi_event_fault_decelerating_trace(scenario)

    assert verify_complete_trace(events, scenario) == events[-1].current_hash
    evidence = events[sequence].observation_fault_evidence
    assert evidence.delivered_from_sequence == source_sequence
    assert reason in evidence.applied_faults
    assert evidence.delivered_observation.challenge_actor_speed_mps == delivered_speed
    assert evidence.raw_observation.challenge_actor_speed_mps == (5.0, 5.0, 4.0, 3.0)[
        sequence
    ]
    assert events[sequence].result_observation.challenge_actor_speed_mps == (
        5.0,
        4.0,
        3.0,
        2.0,
    )[sequence]

    for boundary_sequence in (1, 2, 3):
        assert (
            events[boundary_sequence].observation_fault_evidence.raw_observation
            == events[boundary_sequence - 1].result_observation
        )
        source = events[
            events[boundary_sequence].observation_fault_evidence.delivered_from_sequence
        ].observation_fault_evidence.raw_observation
        delivered = events[
            boundary_sequence
        ].observation_fault_evidence.delivered_observation
        assert delivered.challenge_actor_speed_mps == source.challenge_actor_speed_mps
        assert delivered.challenge_phase == source.challenge_phase


def test_decelerating_delay_can_deliver_steady_input_into_decelerating_result() -> None:
    scenario = _decelerating_scenario(
        actor_speed_mps=5.0,
        terminal_speed_mps=2.0,
        deceleration_mps2=10.0,
        decel_start_step=1,
        horizon_steps=4,
        faults={"observation_delay_steps": 1},
    )
    events = _multi_event_fault_decelerating_trace(scenario)
    cross_phase = events[1]

    assert cross_phase.observation_fault_evidence.delivered_from_sequence == 0
    assert cross_phase.observation_summary["challenge_phase"] == "STEADY"
    assert cross_phase.observation_summary["result_challenge_phase"] == "DECELERATING"
    assert verify_complete_trace(events, scenario) == events[-1].current_hash


def test_decelerating_fault_trace_preserves_terminal_result_raw_and_delivery() -> None:
    scenario = _decelerating_scenario(
        actor_speed_mps=5.0,
        terminal_speed_mps=2.0,
        deceleration_mps2=10.0,
        decel_start_step=1,
        horizon_steps=5,
        faults={"dropped_observation_steps": (2,)},
    )
    events = _multi_event_fault_decelerating_trace(scenario)

    terminal_result = events[3].result_observation
    terminal_event = events[4]
    terminal_evidence = terminal_event.observation_fault_evidence

    assert terminal_result.sequence == 4
    assert terminal_result.challenge_actor_speed_mps == 2.0
    assert terminal_result.challenge_phase == "STEADY"
    assert terminal_evidence.raw_observation == terminal_result
    assert terminal_evidence.delivered_from_sequence == 4
    assert terminal_evidence.delivered_observation == terminal_result
    assert terminal_event.result_observation.challenge_actor_speed_mps == 2.0
    assert terminal_event.result_observation.challenge_phase == "STEADY"
    assert verify_complete_trace(events, scenario) == events[-1].current_hash


@pytest.mark.parametrize(
    ("path", "kwargs", "message"),
    (
        (
            "delivered",
            {"delivered_updates_by_sequence": {2: {"challenge_actor_speed_mps": 4.5}}},
            "challenge_actor_speed_mps contradicts declared decelerating actor speed",
        ),
        (
            "result",
            {"result_updates_by_sequence": {2: {"challenge_actor_speed_mps": 3.5}}},
            "result_challenge_actor_speed_mps contradicts declared decelerating actor speed",
        ),
        (
            "raw",
            {"raw_updates_by_sequence": {2: {"challenge_actor_speed_mps": 4.5}}},
            "raw observation disagrees with prior result",
        ),
    ),
)
def test_decelerating_fault_trace_rejects_mid_schedule_packet_mutations(
    path: str,
    kwargs: dict[str, object],
    message: str,
) -> None:
    del path
    scenario = _decelerating_scenario(
        actor_speed_mps=5.0,
        terminal_speed_mps=2.0,
        deceleration_mps2=10.0,
        decel_start_step=1,
        horizon_steps=4,
        faults={"observation_delay_steps": 1},
    )
    events = _multi_event_fault_decelerating_trace(scenario, **kwargs)

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace(events, scenario)


def test_stationary_challenge_trace_accepts_present_zero_speed_and_initial_gap() -> None:
    scenario = _stationary_scenario()
    event = _challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


@pytest.mark.parametrize(
    ("updates", "message"),
    [
        ({"challenge_phase": "PRE_TRIGGER"}, "contradicts the scenario schedule"),
        ({"challenge_actor_speed_mps": 0.01}, "initial challenge actor speed"),
        ({"front_distance_m": 11.0}, "initial front gap"),
    ],
)
def test_stationary_challenge_trace_rejects_false_sequence_zero_evidence(
    updates: dict[str, object],
    message: str,
) -> None:
    scenario = _stationary_scenario()
    event = _challenge_event(scenario, summary_updates=updates)

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize(
    "field_name",
    ["challenge_actor_speed_mps", "result_challenge_actor_speed_mps"],
)
def test_stationary_challenge_trace_requires_exact_zero_actor_speed(
    field_name: str,
) -> None:
    scenario = _stationary_scenario()
    event = _challenge_event(scenario, summary_updates={field_name: 1e-7})

    with pytest.raises(TraceIntegrityError, match="stationary actor speed"):
        verify_complete_trace((event,), scenario)


def test_adjacent_stationary_trace_rejects_false_front_overlap() -> None:
    scenario = _stationary_scenario(initial_lane_delta=1)
    event = _challenge_event(
        scenario,
        summary_updates={
            "front_distance_m": scenario.challenge.initial_gap_m,
            "front_relative_speed_mps": 0.0,
        },
    )

    with pytest.raises(TraceIntegrityError, match="adjacent stationary actor"):
        verify_complete_trace((event,), scenario)


def test_fault_stationary_trace_accepts_present_zero_speed_and_initial_gap() -> None:
    scenario = _stationary_scenario(with_fault=True)
    event = _fault_challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


def test_fault_stationary_trace_rejects_nonzero_initial_actor_speed() -> None:
    scenario = _stationary_scenario(with_fault=True)
    event = _fault_challenge_event(scenario, result_actor_speed_mps=0.01)

    with pytest.raises(TraceIntegrityError, match="fault challenge initial actor speed"):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize("packet", ["raw", "delivered", "result"])
def test_fault_stationary_trace_requires_exact_zero_actor_speed(packet: str) -> None:
    scenario = _stationary_scenario(with_fault=True)
    kwargs: dict[str, object] = {}
    if packet == "raw":
        kwargs["raw_updates"] = {"challenge_actor_speed_mps": 1e-7}
    elif packet == "delivered":
        kwargs["delivered_updates"] = {"challenge_actor_speed_mps": 1e-7}
    else:
        kwargs["result_updates"] = {"challenge_actor_speed_mps": 1e-7}
    event = _fault_challenge_event(scenario, **kwargs)

    with pytest.raises(TraceIntegrityError, match="stationary actor speed"):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize(
    ("raw_updates", "message"),
    [
        ({"challenge_actor_speed_mps": 1.0}, "raw stationary actor speed"),
        ({"challenge_phase": "PRE_TRIGGER"}, "raw stationary actor phase"),
        ({"front_distance_m": 11.0}, "raw initial front gap"),
    ],
)
def test_fault_stationary_trace_binds_initial_raw_actor_to_scenario(
    raw_updates: dict[str, object],
    message: str,
) -> None:
    scenario = _stationary_scenario(with_fault=True)
    event = _fault_challenge_event(scenario, raw_updates=raw_updates)

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace((event,), scenario)


def test_fault_adjacent_stationary_raw_actor_requires_paired_null_front_fields() -> None:
    scenario = _stationary_scenario(initial_lane_delta=1, with_fault=True)
    event = _fault_challenge_event(
        scenario,
        raw_updates={
            "front_distance_m": scenario.challenge.initial_gap_m,
            "front_relative_speed_mps": 0.0,
        },
    )

    with pytest.raises(TraceIntegrityError, match="paired-null front fields"):
        verify_complete_trace((event,), scenario)


@pytest.mark.parametrize("field_name", ["challenge_actor", "unsummarized_position"])
def test_fault_trace_binds_delivered_packet_to_declared_raw_source(
    field_name: str,
) -> None:
    scenario = _stationary_scenario(with_fault=True)
    if field_name == "challenge_actor":
        delivered_updates: dict[str, object] = {
            "challenge_actor_longitudinal_m": 99.0
        }
    else:
        delivered_updates = {
            "vehicle_state": VehicleState(
                position_m=99.0,
                speed_mps=0.0,
                acceleration_mps2=0.0,
                lateral_offset_m=0.0,
                route_progress_pct=0.0,
                collision_count=0,
                offroad=False,
                destination_reached=False,
            )
        }
    event = _fault_challenge_event(
        scenario,
        delivered_updates=delivered_updates,
    )

    with pytest.raises(TraceIntegrityError, match="declared raw source"):
        verify_complete_trace((event,), scenario)


def test_schema3_fault_challenge_accepts_complete_scheduled_actor_evidence(
    repository_root: Path,
) -> None:
    scenario = _schema3_action_fault_challenge(repository_root)
    event = _fault_challenge_event(scenario)

    assert verify_complete_trace((event,), scenario) == event.current_hash


@pytest.mark.parametrize(
    ("updates", "message"),
    [
        ({"input_phase": "BRAKING"}, "input phase contradicts"),
        ({"front_relative_speed_mps": None}, "front-object evidence must be paired"),
        ({"result_actor_speed_mps": None}, "actor_speed_mps is not numeric"),
    ],
)
def test_schema3_fault_challenge_rejects_false_or_incomplete_actor_evidence(
    repository_root: Path,
    updates: dict[str, object],
    message: str,
) -> None:
    scenario = _schema3_action_fault_challenge(repository_root)
    event = _fault_challenge_event(scenario, **updates)

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace((event,), scenario)


# --- declared-vs-observed geometry tolerance --------------------------------------------


def test_geometry_tolerance_accepts_float32_representation_error() -> None:
    """The case that exposed the defect: a gap that is a difference of float32 positions.

    28.816 m arrived 1.415e-6 short of its declared value, because the observed gap is
    ``float32(lead_x) - float32(ego_x)`` and so carries an ulp of the *position*. A fixed
    1e-6 m tolerance called that a trace contradiction. It was not one.
    """
    from hermes.evidence.trace import _geometry_agrees

    assert _geometry_agrees(28.816 - 1.415e-6, 28.816)


@pytest.mark.parametrize("declared", [1.0, 10.0, 28.816, 40.0, 200.0])
def test_geometry_tolerance_rejects_a_physically_meaningful_contradiction(
    declared: float,
) -> None:
    """A millimetre is the smallest disagreement that means anything. It must still fail.

    This is the property that keeps the derived tolerance honest: it must absorb the
    representation error and nothing larger, at every magnitude in the schema's range.
    """
    from hermes.evidence.trace import _geometry_agrees

    assert not _geometry_agrees(declared + 1e-3, declared)


@pytest.mark.parametrize("declared", [1.0, 10.0, 28.816, 40.0, 200.0])
def test_geometry_tolerance_stays_below_a_millimetre_across_the_schema_range(
    declared: float,
) -> None:
    """Pins the headroom, so a future widening has to be deliberate rather than incidental.

    The margin is not uniform, and it is worth knowing where it is thinnest: at a 1 m gap
    the tolerance is 5e-7 m, and at the schema maximum of 200 m it is 1.2e-4 m - about
    eight times under a millimetre rather than the three orders of magnitude available at
    the low end. That is still a correct tolerance, because float32 spacing genuinely is
    that coarse at 200 m, but it means a sub-millimetre contradiction in a very long-range
    gap is beyond what this check can resolve.
    """
    from hermes.evidence.trace import _FLOAT32_ULP_ALLOWANCE, _float32_ulp

    assert _FLOAT32_ULP_ALLOWANCE * _float32_ulp(declared) < 1e-3


def test_geometry_tolerance_scales_with_magnitude() -> None:
    """A fixed tolerance is the wrong shape: float32 spacing grows with the value."""
    from hermes.evidence.trace import _float32_ulp

    assert _float32_ulp(200.0) > _float32_ulp(28.816) > _float32_ulp(1.0)


def test_geometry_tolerance_does_not_vanish_at_zero() -> None:
    """A declared zero must not be compared against a zero-width tolerance."""
    from hermes.evidence.trace import _geometry_agrees

    assert _geometry_agrees(1e-8, 0.0)
    assert not _geometry_agrees(1e-3, 0.0)


def test_a_gap_within_float32_spacing_is_accepted_end_to_end(repository_root: Path) -> None:
    """The tolerance reaches the verifier, not just the helper."""
    scenario = load_scenario(
        repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
    )
    declared = scenario.challenge.initial_gap_m
    event = _challenge_event(
        scenario,
        summary_updates={"front_distance_m": declared - 1e-6},
    )

    verify_complete_trace((event,), scenario)
