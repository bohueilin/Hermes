"""Multi-event challenge provenance across deterministic observation faults."""

from __future__ import annotations

from collections.abc import Callable

import pytest

from hermes.domain.enums import EvidenceAvailability, TerminationReason
from hermes.domain.models import (
    Action,
    ControlFaultEvidence,
    FaultConfig,
    Measurement,
    Observation,
    ObservationFaultEvidence,
    ObservationNoiseConfig,
    RunContextV2,
    ScenarioDefinition,
    TraceEventV2,
    VehicleState,
)
from hermes.evidence.trace import (
    GENESIS_HASH,
    TraceIntegrityError,
    create_trace_event_v2,
    verify_complete_trace,
)
from hermes.faults.deterministic import DeterministicFaultInjector

_FAULT_LABEL = "illustrative_simulation_faults_not_real_vehicle_limits"
# Simulator-measured 20 m/s peak in evidence/calibration/metadrive-brake-curve-0.4.3.json.
_CALIBRATED_MAX_BRAKING_MPS2 = 12.982444763183452
_ACTION = Action(steering=0.0, throttle=0.0, brake=0.0)
_CHALLENGE_FIELDS = (
    "front_distance_m",
    "front_relative_speed_mps",
    "challenge_actor_longitudinal_m",
    "challenge_actor_lateral_offset_m",
    "challenge_actor_speed_mps",
    "challenge_phase",
)


def _fault_config(**updates: object) -> FaultConfig:
    return FaultConfig.model_validate(
        {
            "schema_version": "1.0",
            "name": "phase_source_probe",
            "version": "1.0",
            "label": _FAULT_LABEL,
            **updates,
        }
    )


def _scenario(faults: FaultConfig) -> ScenarioDefinition:
    return ScenarioDefinition.model_validate(
        {
            "schema_version": "4.0",
            "name": "phase_source_probe",
            "version": "1.0",
            "description": "Fast phase-changing challenge provenance probe.",
            "adapter": "metadrive",
            "control": {
                "frequency_hz": 10,
                "horizon_steps": 5,
                "target_speed_mps": 20.0,
                "max_braking_mps2": _CALIBRATED_MAX_BRAKING_MPS2,
            },
            "initial_state": {"speed_mps": 20.0, "lateral_offset_m": 0.0},
            "road": {
                "destination_distance_m": 200.0,
                "boundary_tolerance_m": 1.5,
            },
            "challenge": {
                "kind": "lead_vehicle_hard_brake",
                "actor_control_mode": "metadrive_dynamic_action",
                "behavior_realism_claim": False,
                "initial_gap_m": 40.0,
                "actor_speed_mps": 20.0,
                "trigger_step": 2,
                "brake_duration_steps": 2,
                "brake_command": -1.0,
                "resume_throttle_command": 0.4,
            },
            "faults": faults,
        }
    )


def _raw_observations() -> tuple[Observation, ...]:
    phases = (
        "PRE_TRIGGER",
        "PRE_TRIGGER",
        "PRE_TRIGGER",
        "BRAKING",
        "BRAKING",
        "RECOVERY",
    )
    observations = []
    for sequence, phase in enumerate(phases):
        speed = 20.0 - sequence * 0.25
        state = VehicleState(
            position_m=sequence * 2.0,
            speed_mps=speed,
            acceleration_mps2=0.0 if sequence == 0 else -2.5,
            lateral_offset_m=sequence * 0.01,
            route_progress_pct=sequence * 10.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        )
        actor_speed = 20.0 if sequence < 3 else 20.0 - (sequence - 2) * 2.0
        observations.append(
            Observation(
                sequence=sequence,
                simulation_time_s=sequence / 10,
                vehicle_state=state,
                front_distance_m=40.0 - sequence,
                front_relative_speed_mps=actor_speed - speed,
                challenge_actor_longitudinal_m=44.515 + sequence,
                challenge_actor_lateral_offset_m=0.0,
                challenge_actor_speed_mps=actor_speed,
                challenge_phase=phase,
            )
        )
    return tuple(observations)


def _summary(delivered: Observation, result: Observation) -> dict[str, object]:
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


EventMutation = Callable[
    [
        int,
        ObservationFaultEvidence,
        Observation,
        dict[str, object],
        tuple[Observation, ...],
    ],
    tuple[ObservationFaultEvidence, Observation, dict[str, object]],
]


def _trace(
    faults: FaultConfig,
    *,
    mutate: EventMutation | None = None,
) -> tuple[ScenarioDefinition, tuple[TraceEventV2, ...]]:
    scenario = _scenario(faults)
    raw_observations = _raw_observations()
    injector = DeterministicFaultInjector(faults)
    injector.reset(scenario, seed=7)
    context = RunContextV2(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        policy_name="adas-longitudinal",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        fault_name=injector.name,
        fault_version=injector.version,
        fault_config_digest="1" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=5,
    )
    previous_hash = GENESIS_HASH
    events = []
    for sequence in range(5):
        raw = raw_observations[sequence]
        faulted = injector.process_observation(raw)
        result = raw_observations[sequence + 1]
        evidence = ObservationFaultEvidence(
            raw_observation=raw,
            delivered_observation=faulted.observation,
            delivered_from_sequence=faulted.source_sequence,
            delivered_from_time_s=faulted.source_simulation_time_s,
            delivery_time_s=faulted.delivery_time_s,
            applied_faults=faulted.reason_codes,
            speed_noise_delta_mps=faulted.noise_deltas.speed_mps,
            lateral_noise_delta_m=faulted.noise_deltas.lateral_offset_m,
        )
        summary = _summary(faulted.observation, result)
        if mutate is not None:
            evidence, result, summary = mutate(
                sequence,
                evidence,
                result,
                summary,
                raw_observations,
            )
        is_last = sequence == 4
        event = create_trace_event_v2(
            sequence=sequence,
            simulation_time_s=(sequence + 1) / 10,
            run_context=context,
            observation_summary=summary,
            candidate_action=_ACTION,
            permitted_action=_ACTION,
            executed_action=_ACTION,
            override_reasons=(),
            observation_fault_evidence=evidence,
            control_fault_evidence=ControlFaultEvidence(
                candidate_time_s=sequence / 10,
                executed_from_sequence=sequence,
                executed_from_candidate_time_s=sequence / 10,
                execution_time_s=sequence / 10,
                pre_saturation_action=_ACTION,
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
                "route_progress_pct": result.vehicle_state.route_progress_pct,
            },
            previous_hash=previous_hash,
        )
        events.append(event)
        previous_hash = event.current_hash
    return scenario, tuple(events)


@pytest.mark.parametrize(
    "faults",
    [
        _fault_config(observation_delay_steps=3),
        _fault_config(
            frozen_observation_interval={"start_step": 1, "duration_steps": 4}
        ),
        _fault_config(dropped_observation_steps=(2, 3, 4)),
    ],
    ids=("delay", "freeze", "drop"),
)
def test_phase_changing_fault_delivery_binds_to_its_declared_raw_source(
    faults: FaultConfig,
) -> None:
    scenario, events = _trace(faults)
    evidence = events[4].observation_fault_evidence

    assert evidence.delivered_from_sequence == 1
    assert evidence.raw_observation == events[3].result_observation
    assert evidence.raw_observation.challenge_phase == "BRAKING"
    assert evidence.delivered_observation.challenge_phase == "PRE_TRIGGER"
    assert events[4].result_observation.challenge_phase == "RECOVERY"
    assert verify_complete_trace(events, scenario) == events[-1].current_hash


def _change_event_four(
    change: Callable[
        [ObservationFaultEvidence, Observation, dict[str, object], tuple[Observation, ...]],
        tuple[ObservationFaultEvidence, Observation, dict[str, object]],
    ],
) -> EventMutation:
    def mutate(
        sequence: int,
        evidence: ObservationFaultEvidence,
        result: Observation,
        summary: dict[str, object],
        observations: tuple[Observation, ...],
    ) -> tuple[ObservationFaultEvidence, Observation, dict[str, object]]:
        if sequence != 4:
            return evidence, result, summary
        return change(evidence, result, summary, observations)

    return mutate


def _relabel_delivered_phase_as_current(
    evidence: ObservationFaultEvidence,
    result: Observation,
    summary: dict[str, object],
    observations: tuple[Observation, ...],
) -> tuple[ObservationFaultEvidence, Observation, dict[str, object]]:
    current_phase = observations[4].challenge_phase
    delivered = evidence.delivered_observation.model_copy(
        update={"challenge_phase": current_phase}
    )
    return (
        evidence.model_copy(update={"delivered_observation": delivered}),
        result,
        {**summary, "challenge_phase": current_phase},
    )


def _relabel_delivered_geometry_as_prior_result(
    evidence: ObservationFaultEvidence,
    result: Observation,
    summary: dict[str, object],
    observations: tuple[Observation, ...],
) -> tuple[ObservationFaultEvidence, Observation, dict[str, object]]:
    prior_result = observations[4]
    updates = {
        field: getattr(prior_result, field)
        for field in _CHALLENGE_FIELDS
        if field != "challenge_phase"
    }
    delivered = evidence.delivered_observation.model_copy(update=updates)
    summary_updates = {field: getattr(delivered, field) for field in updates}
    return (
        evidence.model_copy(update={"delivered_observation": delivered}),
        result,
        {**summary, **summary_updates},
    )


def _break_raw_continuity(
    evidence: ObservationFaultEvidence,
    result: Observation,
    summary: dict[str, object],
    observations: tuple[Observation, ...],
) -> tuple[ObservationFaultEvidence, Observation, dict[str, object]]:
    del observations
    raw = evidence.raw_observation.model_copy(update={"front_distance_m": 1.0})
    return evidence.model_copy(update={"raw_observation": raw}), result, summary


def _break_result_schedule(
    evidence: ObservationFaultEvidence,
    result: Observation,
    summary: dict[str, object],
    observations: tuple[Observation, ...],
) -> tuple[ObservationFaultEvidence, Observation, dict[str, object]]:
    del observations
    result = result.model_copy(update={"challenge_phase": "PRE_TRIGGER"})
    return evidence, result, {**summary, "result_challenge_phase": "PRE_TRIGGER"}


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (_relabel_delivered_phase_as_current, "input phase contradicts"),
        (_relabel_delivered_geometry_as_prior_result, "declared raw source"),
        (_break_raw_continuity, "raw observation disagrees with prior result"),
        (_break_result_schedule, "result phase contradicts"),
    ],
    ids=("current-phase", "prior-result-geometry", "raw-continuity", "result-phase"),
)
def test_phase_changing_fault_trace_rejects_broken_provenance_edges(
    mutation: Callable[
        [ObservationFaultEvidence, Observation, dict[str, object], tuple[Observation, ...]],
        tuple[ObservationFaultEvidence, Observation, dict[str, object]],
    ],
    message: str,
) -> None:
    scenario, events = _trace(
        _fault_config(observation_delay_steps=3),
        mutate=_change_event_four(mutation),
    )

    with pytest.raises(TraceIntegrityError, match=message):
        verify_complete_trace(events, scenario)


def test_observation_noise_changes_only_declared_ego_fields() -> None:
    scenario, events = _trace(
        _fault_config(
            observation_noise=ObservationNoiseConfig(
                speed_mps_bound=0.5,
                lateral_offset_m_bound=0.2,
            )
        )
    )

    assert verify_complete_trace(events, scenario) == events[-1].current_hash
    for event in events:
        evidence = event.observation_fault_evidence
        raw = evidence.raw_observation
        delivered = evidence.delivered_observation
        assert evidence.delivered_from_sequence == event.sequence
        assert evidence.applied_faults == ("OBSERVATION_NOISE",)
        assert any(
            (
                delivered.vehicle_state.speed_mps != raw.vehicle_state.speed_mps,
                delivered.vehicle_state.lateral_offset_m
                != raw.vehicle_state.lateral_offset_m,
            )
        )
        assert delivered.vehicle_state.model_copy(
            update={
                "speed_mps": raw.vehicle_state.speed_mps,
                "lateral_offset_m": raw.vehicle_state.lateral_offset_m,
            }
        ) == raw.vehicle_state
        for field in _CHALLENGE_FIELDS:
            assert getattr(delivered, field) == getattr(raw, field)
