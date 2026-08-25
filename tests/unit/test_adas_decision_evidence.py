"""Typed ADAS policy decisions and candidate-to-executed attribution contracts."""

from __future__ import annotations

from dataclasses import dataclass

import pytest

import hermes.domain.contracts as domain_contracts
import hermes.domain.models as domain_models
import hermes.evidence.trace as trace_module
import hermes.runtime.orchestrator as orchestrator
from hermes.adas.decision import AdasLongitudinalDecisionKernel
from hermes.adas.interfaces import AdasControllerConfig, DriverConfig
from hermes.adas.policy import AdasLongitudinalPolicy, project_to_action
from hermes.domain.enums import (
    AdasMode,
    BrakeSource,
    EvidenceAvailability,
    InterventionLevel,
    TerminationReason,
    WarningLevel,
)
from hermes.domain.models import (
    Action,
    AdasDecision,
    AdasDecisionEvidence,
    ControlFaultEvidence,
    FaultConfig,
    Measurement,
    Observation,
    ObservationFaultEvidence,
    RunContextV3,
    ScenarioDefinition,
    TraceEventV3,
    VehicleState,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.shields.config import ShieldConfig, shield_config_digest

_DEFAULT_CONSTRUCTION_SCENARIO = object()


def _scenario(*, control_delay_steps: int = 0, horizon_steps: int = 4) -> ScenarioDefinition:
    payload: dict[str, object] = {
        "schema_version": "4.0",
        "name": "wp3_decision_attribution",
        "version": "1.0",
        "description": "Simulator-neutral WP-3 decision and attribution unit scenario.",
        "adapter": "fake",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": horizon_steps,
            "target_speed_mps": 10.0,
            "max_braking_mps2": 12.982444763183452,
        },
        "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 100.0, "boundary_tolerance_m": 1.5},
        "adas": {"enabled": ("fcw", "aeb")},
    }
    if control_delay_steps:
        payload["faults"] = {
            "schema_version": "1.0",
            "name": "wp3_control_delay",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            "control_delay_steps": control_delay_steps,
            "max_brake": 0.4,
        }
    return ScenarioDefinition.model_validate(payload)


def _shield_config() -> ShieldConfig:
    return ShieldConfig(
        schema_version="1.0",
        name="phase3_deterministic",
        version="1.0",
        label="illustrative_simulation_only_not_real_vehicle_limits",
        ttc_threshold_s=2.0,
        speed_cap_mps=30.0,
        max_observation_age_s=0.5,
        boundary_margin_m=0.5,
        actuation_delay_compensation_s=0.0,
        emergency_stop_active=False,
        full_brake_command=1.0,
        boundary_steering_command=0.2,
    )


def _state(sequence: int, *, route_progress_pct: float | None = None) -> VehicleState:
    return VehicleState(
        position_m=float(sequence),
        speed_mps=0.0,
        acceleration_mps2=0.0,
        lateral_offset_m=0.0,
        route_progress_pct=(
            float(sequence * 10) if route_progress_pct is None else route_progress_pct
        ),
        collision_count=0,
        offroad=False,
        destination_reached=False,
    )


def _observation(
    sequence: int,
    *,
    speed_mps: float = 0.0,
    gap_m: float | None = None,
    relative_speed_mps: float | None = None,
    age_s: float = 0.0,
) -> Observation:
    state = _state(sequence).model_copy(update={"speed_mps": speed_mps})
    return Observation(
        sequence=sequence,
        simulation_time_s=sequence / 10,
        vehicle_state=state,
        front_distance_m=gap_m,
        front_relative_speed_mps=relative_speed_mps,
        observation_age_s=age_s,
    )


def _decision(
    *,
    brake_source: BrakeSource = BrakeSource.NONE,
    throttle: float = 0.0,
    brake: float = 0.0,
    warning: WarningLevel = WarningLevel.NO_WARNING,
    intervention: InterventionLevel = InterventionLevel.NO_INTERVENTION,
    mode: AdasMode = AdasMode.ACTIVE,
) -> AdasDecision:
    return AdasDecision(
        warning=warning,
        intervention=intervention,
        mode=mode,
        brake_source=brake_source,
        throttle=throttle,
        brake=brake,
        time_to_collision_s=None,
        required_deceleration_mps2=None,
        reasons=(),
    )


def _decision_evidence(
    observation: Observation,
    decision: AdasDecision,
) -> AdasDecisionEvidence:
    return domain_models.AdasDecisionEvidence(
        input_sequence=observation.sequence,
        input_time_s=observation.simulation_time_s,
        decision=decision,
    )


def _run_context(
    scenario: ScenarioDefinition,
    *,
    shield_name: str = "noop",
    shield_config: ShieldConfig | None = None,
) -> RunContextV3:
    fault = scenario.faults
    shield_digest = (
        shield_config_digest(shield_config)
        if shield_config is not None
        else sha256_hex(canonical_json_bytes({}))
    )
    fault_digest = (
        sha256_hex(canonical_json_bytes(fault.model_dump(mode="json")))
        if fault is not None
        else None
    )
    return RunContextV3(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="fake",
        adapter_version="1.0",
        adapter_config_digest="c" * 64,
        policy_name="adas-longitudinal",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name=shield_name,
        shield_version="1.0",
        shield_config_digest=shield_digest,
        verifier_suite_digest="f" * 64,
        fault_name="deterministic-faults" if fault is not None else None,
        fault_version="1.0" if fault is not None else None,
        fault_config_digest=fault_digest,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=scenario.control.horizon_steps,
    )


def _summary(observation: Observation, result: Observation) -> dict[str, object]:
    del result
    return {
        "input_sequence": observation.sequence,
        "input_simulation_time_s": observation.simulation_time_s,
        "speed_mps": observation.vehicle_state.speed_mps,
        "lateral_offset_m": observation.vehicle_state.lateral_offset_m,
        "route_progress_pct": observation.vehicle_state.route_progress_pct,
        "observation_age_s": observation.observation_age_s,
    }


def _observation_evidence(observation: Observation) -> ObservationFaultEvidence:
    return ObservationFaultEvidence(
        raw_observation=observation,
        delivered_observation=observation,
        delivered_from_sequence=observation.sequence,
        delivered_from_time_s=observation.simulation_time_s,
        delivery_time_s=observation.simulation_time_s,
        applied_faults=(),
        speed_noise_delta_mps=0.0,
        lateral_noise_delta_m=0.0,
    )


def _control_evidence(
    *,
    sequence: int,
    source_sequence: int | None,
    source_time_s: float | None,
    pre_saturation_action: Action,
    applied_faults: tuple[str, ...] = (),
) -> ControlFaultEvidence:
    latency = (
        Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            unit="ms",
            reason="control-delay startup fill has no originating candidate",
        )
        if source_time_s is None
        else Measurement(
            availability=EvidenceAvailability.AVAILABLE,
            value=(sequence / 10 - source_time_s) * 1000.0,
            unit="ms",
        )
    )
    return ControlFaultEvidence(
        candidate_time_s=sequence / 10,
        executed_from_sequence=source_sequence,
        executed_from_candidate_time_s=source_time_s,
        execution_time_s=sequence / 10,
        pre_saturation_action=pre_saturation_action,
        applied_faults=applied_faults,
        control_latency_ms=latency,
        latency_source="simulated",
    )


def _create_event(
    *,
    scenario: ScenarioDefinition,
    sequence: int,
    observation: Observation,
    result: Observation,
    decision: AdasDecision,
    candidate: Action,
    permitted: Action,
    executed: Action,
    override_reasons: tuple[str, ...] = (),
    source_sequence: int | None = None,
    source_time_s: float | None = None,
    pre_saturation_action: Action | None = None,
    control_faults: tuple[str, ...] = (),
    prior_events: tuple[TraceEventV3, ...] = (),
    shield_name: str = "noop",
    shield_config: ShieldConfig | None = None,
    run_context: RunContextV3 | None = None,
    construction_scenario: ScenarioDefinition | None | object = (
        _DEFAULT_CONSTRUCTION_SCENARIO
    ),
    is_last: bool = True,
    evidence: AdasDecisionEvidence | None = None,
) -> TraceEventV3:
    if shield_name == "deterministic" and shield_config is None:
        shield_config = _shield_config()
    if source_sequence is None and scenario.faults is None:
        source_sequence = sequence
        source_time_s = sequence / 10
    control = _control_evidence(
        sequence=sequence,
        source_sequence=source_sequence,
        source_time_s=source_time_s,
        pre_saturation_action=pre_saturation_action or permitted,
        applied_faults=control_faults,
    )
    if construction_scenario is _DEFAULT_CONSTRUCTION_SCENARIO:
        replay_scenario: ScenarioDefinition | None = scenario
    else:
        assert construction_scenario is None or isinstance(
            construction_scenario, ScenarioDefinition
        )
        replay_scenario = construction_scenario
    return trace_module.create_trace_event_v3(
        sequence=sequence,
        simulation_time_s=result.simulation_time_s,
        run_context=(
            run_context
            if run_context is not None
            else _run_context(
                scenario,
                shield_name=shield_name,
                shield_config=shield_config,
            )
        ),
        observation_summary=_summary(observation, result),
        candidate_action=candidate,
        permitted_action=permitted,
        executed_action=executed,
        override_reasons=override_reasons,
        observation_fault_evidence=_observation_evidence(observation),
        control_fault_evidence=control,
        result_observation=result,
        adas_decision_evidence=(
            _decision_evidence(observation, decision) if evidence is None else evidence
        ),
        vehicle_state=result.vehicle_state,
        policy_latency_ms=10.0,
        latency_source="simulated",
        terminated=False,
        truncated=is_last,
        termination_reason=(TerminationReason.HORIZON if is_last else TerminationReason.NONE),
        raw_facts={
            "collision": False,
            "collision_count": 0,
            "offroad": False,
            "destination_reached": False,
            "route_progress_available": True,
            "route_progress_pct": result.vehicle_state.route_progress_pct,
        },
        previous_hash=(
            prior_events[-1].current_hash if prior_events else trace_module.GENESIS_HASH
        ),
        scenario=replay_scenario,
        shield_config=shield_config,
        prior_events=prior_events,
    )


def _parity_inputs() -> tuple[Observation, ...]:
    return (
        _observation(0, speed_mps=0.0),
        _observation(1, speed_mps=20.0),
        _observation(2, speed_mps=20.0, gap_m=40.0, relative_speed_mps=-20.0),
        _observation(
            3,
            speed_mps=20.0,
            gap_m=10.0,
            relative_speed_mps=-20.0,
            age_s=1.0,
        ),
    )


_EXPECTED_ACTIONS = (
    {"steering": 0.0, "throttle": 1.0, "brake": 0.0},
    {"steering": 0.0, "throttle": 0.0, "brake": 0.30000001192092896},
    {"steering": 0.0, "throttle": 0.0, "brake": 1.0},
    {"steering": 0.0, "throttle": 0.0, "brake": 0.30000001192092896},
)

_EXPECTED_DECISIONS = (
    {
        "warning": "NO_WARNING",
        "intervention": "NO_INTERVENTION",
        "mode": "ACTIVE",
        "brake_source": "none",
        "throttle": 1.0,
        "brake": 0.0,
        "time_to_collision_s": None,
        "required_deceleration_mps2": None,
        "reasons": [],
    },
    {
        "warning": "NO_WARNING",
        "intervention": "NO_INTERVENTION",
        "mode": "ACTIVE",
        "brake_source": "driver",
        "throttle": 0.0,
        "brake": 0.3,
        "time_to_collision_s": None,
        "required_deceleration_mps2": None,
        "reasons": [],
    },
    {
        "warning": "ADVISORY",
        "intervention": "EMERGENCY_BRAKE",
        "mode": "ACTIVE",
        "brake_source": "aeb",
        "throttle": 0.0,
        "brake": 1.0,
        "time_to_collision_s": 2.0,
        "required_deceleration_mps2": 5.2631578947368425,
        "reasons": [
            "FCW_TTC_BELOW_ADVISORY_THRESHOLD",
            "AEB_REQUIRED_DECELERATION_AT_EMERGENCY_AUTHORITY",
            "ARBITRATION_AEB_OVERRIDES_LONGITUDINAL",
        ],
    },
    {
        "warning": "NO_WARNING",
        "intervention": "NO_INTERVENTION",
        "mode": "DEGRADED",
        "brake_source": "driver",
        "throttle": 0.0,
        "brake": 0.3,
        "time_to_collision_s": 0.5,
        "required_deceleration_mps2": 25.0,
        "reasons": [
            "FCW_DEGRADED_STALE_OBSERVATION",
            "AEB_DEGRADED_STALE_OBSERVATION",
        ],
    },
)


def test_legacy_policy_decisions_and_actions_are_exactly_characterized() -> None:
    scenario = _scenario()
    config = AdasControllerConfig(driver=DriverConfig(max_brake=0.3))
    policy = AdasLongitudinalPolicy(config)
    policy.reset(scenario, seed=7)

    actions = []
    decisions = []
    for observation in _parity_inputs():
        actions.append(policy.act(observation).model_dump(mode="json"))
        assert policy.last_decision is not None
        decisions.append(policy.last_decision.model_dump(mode="json"))

    assert policy.name == "adas-longitudinal"
    assert policy.version == "1.0"
    assert tuple(actions) == _EXPECTED_ACTIONS
    assert tuple(decisions) == _EXPECTED_DECISIONS


def test_simulator_free_kernel_is_the_live_policy_behavior() -> None:
    scenario = _scenario()
    config = AdasControllerConfig(driver=DriverConfig(max_brake=0.3))
    kernel = AdasLongitudinalDecisionKernel(config)
    kernel.reset(scenario)

    outputs = [kernel.step(observation) for observation in _parity_inputs()]

    assert tuple(action.model_dump(mode="json") for action, _ in outputs) == _EXPECTED_ACTIONS
    assert tuple(
        evidence.decision.model_dump(mode="json") for _, evidence in outputs
    ) == _EXPECTED_DECISIONS
    assert tuple(evidence.input_sequence for _, evidence in outputs) == (0, 1, 2, 3)
    assert tuple(evidence.input_time_s for _, evidence in outputs) == (0.0, 0.1, 0.2, 0.3)


def test_live_policy_exposes_runtime_checkable_decision_evidence() -> None:
    observation = _observation(0)
    policy = AdasLongitudinalPolicy()

    assert isinstance(policy, domain_contracts.AdasDecisionEvidenceProvider)
    assert policy.last_decision_evidence is None
    candidate = policy.act(observation)
    evidence = policy.last_decision_evidence

    assert evidence is not None
    assert evidence.input_sequence == 0
    assert evidence.input_time_s == 0.0
    assert evidence.decision == policy.last_decision
    assert candidate == project_to_action(
        throttle=evidence.decision.throttle,
        brake=evidence.decision.brake,
    )


@dataclass
class _EvidenceProvider:
    last_decision_evidence: object


@pytest.mark.parametrize(
    ("policy", "message"),
    [
        (object(), "does not implement AdasDecisionEvidenceProvider"),
        (_EvidenceProvider(None), "returned no ADAS decision evidence"),
    ],
    ids=("missing-provider", "none-evidence"),
)
def test_v3_runtime_rejects_missing_or_none_policy_decision_evidence(
    policy: object,
    message: str,
) -> None:
    observation = _observation(0)
    candidate = project_to_action(throttle=0.0, brake=0.0)

    with pytest.raises(orchestrator.RunOperationalError, match=message):
        orchestrator._require_v3_adas_decision_evidence(policy, observation, candidate)


@pytest.mark.parametrize(
    ("evidence_update", "candidate", "message"),
    [
        ({"input_sequence": 1}, Action(steering=0.0, throttle=0.0, brake=0.0), "sequence"),
        ({"input_time_s": 0.1}, Action(steering=0.0, throttle=0.0, brake=0.0), "time"),
        ({}, Action(steering=0.0, throttle=1.0, brake=0.0), "candidate action"),
    ],
    ids=("stale-sequence", "stale-time", "action-mismatch"),
)
def test_v3_runtime_rejects_stale_or_action_inconsistent_decision_evidence(
    evidence_update: dict[str, object],
    candidate: Action,
    message: str,
) -> None:
    observation = _observation(0)
    evidence = _decision_evidence(observation, _decision()).model_copy(
        update=evidence_update
    )

    with pytest.raises(orchestrator.RunOperationalError, match=message):
        orchestrator._require_v3_adas_decision_evidence(
            _EvidenceProvider(evidence), observation, candidate
        )


@pytest.mark.parametrize(
    (
        "decision",
        "permitted",
        "override_reasons",
        "shield_name",
        "expected_sources",
    ),
    [
        (_decision(), None, (), "noop", (BrakeSource.NONE,) * 3),
        (
            _decision(brake_source=BrakeSource.DRIVER, brake=0.3),
            None,
            (),
            "noop",
            (BrakeSource.DRIVER,) * 3,
        ),
        (
            _decision(
                brake_source=BrakeSource.AEB,
                brake=1.0,
                intervention=InterventionLevel.EMERGENCY_BRAKE,
            ),
            None,
            (),
            "noop",
            (BrakeSource.AEB,) * 3,
        ),
        (
            _decision(),
            Action(steering=0.0, throttle=0.0, brake=1.0),
            ("EMERGENCY_STOP",),
            "deterministic",
            (BrakeSource.NONE, BrakeSource.SHIELD, BrakeSource.SHIELD),
        ),
    ],
    ids=("no-brake", "driver-brake", "aeb-brake", "shield-brake"),
)
def test_v3_construction_derives_candidate_permitted_and_executed_sources(
    decision: AdasDecision,
    permitted: Action | None,
    override_reasons: tuple[str, ...],
    shield_name: str,
    expected_sources: tuple[BrakeSource, BrakeSource, BrakeSource],
) -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    shield_config = (
        _shield_config().model_copy(update={"emergency_stop_active": True})
        if shield_name == "deterministic"
        else None
    )
    candidate = project_to_action(throttle=decision.throttle, brake=decision.brake)
    permitted = candidate if permitted is None else permitted

    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=candidate,
        permitted=permitted,
        executed=permitted,
        override_reasons=override_reasons,
        shield_name=shield_name,
        shield_config=shield_config,
    )

    assert (
        event.candidate_brake_source,
        event.permitted_brake_source,
        event.executed_brake_source,
    ) == expected_sources
    assert event.adas_decision_input_sequence == observation.sequence
    assert event.adas_decision_input_time_s == observation.simulation_time_s
    assert event.simulation_time_s == result.simulation_time_s
    assert (
        trace_module.verify_complete_trace(
            (event,),
            scenario,
            shield_config=shield_config,
        )
        == event.current_hash
    )


@pytest.mark.parametrize(
    ("evidence_update", "candidate_update", "message"),
    [
        ({"input_sequence": 1}, {}, "sequence"),
        ({"input_time_s": 0.1}, {}, "time"),
        ({}, {"throttle": 1.0}, "candidate action"),
    ],
    ids=("stale-sequence", "stale-time", "candidate-mismatch"),
)
def test_v3_construction_rejects_stale_or_action_inconsistent_decision_evidence(
    evidence_update: dict[str, object],
    candidate_update: dict[str, float],
    message: str,
) -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    evidence = _decision_evidence(observation, decision).model_copy(update=evidence_update)
    candidate = project_to_action(throttle=0.0, brake=0.0).model_copy(
        update=candidate_update
    )

    with pytest.raises(ValueError, match=message):
        _create_event(
            scenario=scenario,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=candidate,
            permitted=candidate,
            executed=candidate,
            evidence=evidence,
        )


def test_v3_construction_rejects_unexplained_shield_brake_removal() -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision(
        brake_source=BrakeSource.AEB,
        brake=1.0,
        intervention=InterventionLevel.EMERGENCY_BRAKE,
    )
    candidate = project_to_action(throttle=0.0, brake=1.0)
    permitted = project_to_action(throttle=0.0, brake=0.0)

    with pytest.raises(ValueError, match="shield transition"):
        _create_event(
            scenario=scenario,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=candidate,
            permitted=permitted,
            executed=permitted,
        )


def _delay_trace() -> tuple[ScenarioDefinition, tuple[TraceEventV3, TraceEventV3]]:
    scenario = _scenario(control_delay_steps=1, horizon_steps=2)
    first_observation = _observation(0)
    first_result = _observation(1)
    first_decision = _decision(
        brake_source=BrakeSource.AEB,
        brake=1.0,
        intervention=InterventionLevel.EMERGENCY_BRAKE,
    )
    first_permitted = project_to_action(throttle=0.0, brake=1.0)
    neutral = Action(steering=0.0, throttle=0.0, brake=0.0)
    first = _create_event(
        scenario=scenario,
        sequence=0,
        observation=first_observation,
        result=first_result,
        decision=first_decision,
        candidate=first_permitted,
        permitted=first_permitted,
        executed=neutral,
        source_sequence=None,
        source_time_s=None,
        pre_saturation_action=neutral,
        control_faults=("CONTROL_DELAY_FILL",),
        is_last=False,
    )
    second_observation = first_result
    second_result = _observation(2)
    second_decision = _decision()
    second_candidate = project_to_action(throttle=0.0, brake=0.0)
    second_executed = Action(steering=0.0, throttle=0.0, brake=0.4)
    second = _create_event(
        scenario=scenario,
        sequence=1,
        observation=second_observation,
        result=second_result,
        decision=second_decision,
        candidate=second_candidate,
        permitted=second_candidate,
        executed=second_executed,
        source_sequence=0,
        source_time_s=0.0,
        pre_saturation_action=first_permitted,
        control_faults=("CONTROL_DELAY", "BRAKE_SATURATION"),
        prior_events=(first,),
    )
    return scenario, (first, second)


def test_v3_executed_attribution_follows_delayed_source_through_saturation() -> None:
    scenario, events = _delay_trace()

    assert events[0].candidate_brake_source is BrakeSource.AEB
    assert events[0].permitted_brake_source is BrakeSource.AEB
    assert events[0].executed_brake_source is BrakeSource.NONE
    assert events[1].candidate_brake_source is BrakeSource.NONE
    assert events[1].permitted_brake_source is BrakeSource.NONE
    assert events[1].executed_action.brake == 0.4
    assert events[1].executed_brake_source is BrakeSource.AEB
    assert trace_module.verify_complete_trace(events, scenario) == events[-1].current_hash


@pytest.mark.parametrize(
    ("event_index", "update", "message"),
    [
        (0, {"candidate_brake_source": BrakeSource.DRIVER}, "candidate brake source"),
        (0, {"permitted_brake_source": BrakeSource.DRIVER}, "permitted brake source"),
        (0, {"executed_brake_source": BrakeSource.AEB}, "startup fill"),
        (1, {"executed_brake_source": BrakeSource.DRIVER}, "executed brake source"),
    ],
    ids=(
        "candidate-attribution",
        "permitted-attribution",
        "startup-attribution",
        "delayed-source-attribution",
    ),
)
def test_v3_trace_rejects_coherently_rehashed_attribution_tampering(
    event_index: int,
    update: dict[str, object],
    message: str,
) -> None:
    scenario, events = _delay_trace()
    tampered = events[event_index].model_copy(update=update)
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )
    changed = list(events)
    changed[event_index] = tampered
    if event_index == 0:
        second = changed[1].model_copy(update={"previous_hash": tampered.current_hash})
        changed[1] = second.model_copy(
            update={"current_hash": trace_module.event_hash(second)}
        )

    with pytest.raises(trace_module.TraceIntegrityError, match=message):
        trace_module.verify_complete_trace(tuple(changed), scenario)


def test_v3_trace_rejects_coherently_rehashed_wrong_delayed_pre_saturation_action() -> None:
    scenario, events = _delay_trace()
    neutral = Action(steering=0.0, throttle=0.0, brake=0.0)
    control = events[1].control_fault_evidence.model_copy(
        update={"pre_saturation_action": neutral}
    )
    tampered = events[1].model_copy(update={"control_fault_evidence": control})
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="pre-saturation action"):
        trace_module.verify_complete_trace((events[0], tampered), scenario)


def test_v3_construction_rejects_non_neutral_unattributed_startup_fill() -> None:
    scenario = _scenario(control_delay_steps=1, horizon_steps=2)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)

    with pytest.raises(ValueError, match="startup fill"):
        _create_event(
            scenario=scenario,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=neutral,
            permitted=neutral,
            executed=Action(steering=0.0, throttle=0.0, brake=0.1),
            source_sequence=None,
            source_time_s=None,
            pre_saturation_action=neutral,
            control_faults=("CONTROL_DELAY_FILL",),
        )


def test_v3_fault_contract_rejects_a_control_source_not_selected_by_declared_delay() -> None:
    scenario, events = _delay_trace()
    control = events[1].control_fault_evidence.model_copy(
        update={
            "executed_from_sequence": 1,
            "executed_from_candidate_time_s": 0.1,
            "pre_saturation_action": events[1].permitted_action,
        }
    )
    tampered = events[1].model_copy(
        update={
            "control_fault_evidence": control,
            "executed_action": events[1].permitted_action,
            "executed_brake_source": events[1].permitted_brake_source,
        }
    )
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="control-delay source"):
        trace_module.verify_complete_trace((events[0], tampered), scenario)


def test_no_concrete_adas_policy_is_needed_for_the_v3_runtime_protocol() -> None:
    observation = _observation(0)
    decision = _decision()
    candidate = project_to_action(throttle=0.0, brake=0.0)
    provider = _EvidenceProvider(_decision_evidence(observation, decision))

    assert isinstance(provider, domain_contracts.AdasDecisionEvidenceProvider)
    assert (
        orchestrator._require_v3_adas_decision_evidence(
            provider,
            observation,
            candidate,
        )
        == provider.last_decision_evidence
    )


def test_fault_config_used_by_delay_contract_is_existing_schema_one() -> None:
    """WP-3 attribution needs no scenario/gate schema field beyond the existing fault seam."""
    scenario = _scenario(control_delay_steps=1, horizon_steps=2)

    assert isinstance(scenario.faults, FaultConfig)
    assert scenario.faults.schema_version == "1.0"
    assert scenario.faults.control_delay_steps == 1


@pytest.mark.parametrize(
    ("decision_update", "message"),
    [
        ({"throttle": 0.25}, "throttle and brake"),
        ({"intervention": InterventionLevel.NO_INTERVENTION}, "intervention"),
        ({"brake_source": BrakeSource.DRIVER}, "intervention"),
    ],
    ids=(
        "simultaneous-throttle-brake",
        "aeb-source-without-intervention",
        "intervention-with-non-aeb-source",
    ),
)
def test_v3_construction_rejects_semantically_contradictory_adas_decision(
    decision_update: dict[str, object],
    message: str,
) -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision(
        brake_source=BrakeSource.AEB,
        brake=1.0,
        intervention=InterventionLevel.EMERGENCY_BRAKE,
    ).model_copy(update=decision_update)
    candidate = project_to_action(throttle=decision.throttle, brake=decision.brake)

    with pytest.raises(ValueError, match=message):
        _create_event(
            scenario=scenario,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=candidate,
            permitted=candidate,
            executed=candidate,
        )


@pytest.mark.parametrize(
    ("decision_update", "message"),
    [
        ({"throttle": 0.25}, "throttle and brake"),
        ({"intervention": InterventionLevel.NO_INTERVENTION}, "intervention"),
        ({"brake_source": BrakeSource.DRIVER}, "intervention"),
    ],
    ids=(
        "simultaneous-throttle-brake",
        "aeb-source-without-intervention",
        "intervention-with-non-aeb-source",
    ),
)
def test_v3_trace_rejects_coherently_rehashed_semantic_decision_tampering(
    decision_update: dict[str, object],
    message: str,
) -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision(
        brake_source=BrakeSource.AEB,
        brake=1.0,
        intervention=InterventionLevel.EMERGENCY_BRAKE,
    )
    candidate = project_to_action(throttle=decision.throttle, brake=decision.brake)
    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=candidate,
        permitted=candidate,
        executed=candidate,
    )
    tampered = event.model_copy(
        update={"adas_decision": event.adas_decision.model_copy(update=decision_update)}
    )
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match=message):
        trace_module.verify_complete_trace((tampered,), scenario)


def test_v3_construction_rejects_unsupported_shield_contract() -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)

    with pytest.raises(ValueError, match="unsupported shield"):
        _create_event(
            scenario=scenario,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=neutral,
            permitted=neutral,
            executed=neutral,
            shield_name="opaque-shield",
        )


def test_v3_trace_rejects_coherent_deterministic_ttc_override_not_replayed() -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)
    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=neutral,
        permitted=neutral,
        executed=neutral,
        shield_name="deterministic",
    )
    fabricated_brake = project_to_action(throttle=0.0, brake=1.0)
    control = event.control_fault_evidence.model_copy(
        update={"pre_saturation_action": fabricated_brake}
    )
    tampered = event.model_copy(
        update={
            "permitted_action": fabricated_brake,
            "executed_action": fabricated_brake,
            "override_reasons": ("TTC_BELOW_THRESHOLD",),
            "control_fault_evidence": control,
            "permitted_brake_source": BrakeSource.SHIELD,
            "executed_brake_source": BrakeSource.SHIELD,
        }
    )
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="shield transition"):
        trace_module.verify_complete_trace(
            (tampered,),
            scenario,
            shield_config=_shield_config(),
        )


def test_v3_trace_rejects_coherently_rehashed_unsupported_shield_identity() -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)
    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=neutral,
        permitted=neutral,
        executed=neutral,
    )
    context = event.run_context.model_copy(update={"shield_name": "future-shield"})
    tampered = event.model_copy(update={"run_context": context})
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="unsupported shield"):
        trace_module.verify_complete_trace((tampered,), scenario)


@pytest.mark.parametrize(
    "supplied_config",
    (None, _shield_config().model_copy(update={"ttc_threshold_s": 0.5})),
    ids=("missing-config", "digest-mismatched-config"),
)
def test_v3_trace_requires_exact_bound_deterministic_shield_config(
    supplied_config: ShieldConfig | None,
) -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)
    shield_brake = project_to_action(throttle=0.0, brake=1.0)
    bound_shield_config = _shield_config().model_copy(
        update={"emergency_stop_active": True}
    )
    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=neutral,
        permitted=shield_brake,
        executed=shield_brake,
        override_reasons=("EMERGENCY_STOP",),
        shield_name="deterministic",
        shield_config=bound_shield_config,
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="shield.*config"):
        trace_module.verify_complete_trace(
            (event,),
            scenario,
            shield_config=supplied_config,
        )


def test_v3_trace_rejects_coherent_no_fault_saturation_claim() -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)
    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=neutral,
        permitted=neutral,
        executed=neutral,
    )
    control = event.control_fault_evidence.model_copy(
        update={"applied_faults": ("BRAKE_SATURATION",)}
    )
    tampered = event.model_copy(update={"control_fault_evidence": control})
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="no-fault V3"):
        trace_module.verify_complete_trace((tampered,), scenario)


@pytest.mark.parametrize(
    ("executed_brake", "control_faults"),
    [
        (0.2, ("CONTROL_DELAY", "BRAKE_SATURATION")),
        (0.4, ("CONTROL_DELAY",)),
    ],
    ids=("wrong-saturation-magnitude", "missing-saturation-reason"),
)
def test_v3_trace_rejects_coherent_control_fault_replay_tampering(
    executed_brake: float,
    control_faults: tuple[str, ...],
) -> None:
    scenario, events = _delay_trace()
    control = events[1].control_fault_evidence.model_copy(
        update={"applied_faults": control_faults}
    )
    tampered = events[1].model_copy(
        update={
            "control_fault_evidence": control,
            "executed_action": events[1].executed_action.model_copy(
                update={"brake": executed_brake}
            ),
        }
    )
    tampered = tampered.model_copy(
        update={"current_hash": trace_module.event_hash(tampered)}
    )

    with pytest.raises(trace_module.TraceIntegrityError, match="control fault replay"):
        trace_module.verify_complete_trace((events[0], tampered), scenario)


def _mismatched_fault_scenario() -> ScenarioDefinition:
    scenario = _scenario(control_delay_steps=1, horizon_steps=2)
    assert scenario.faults is not None
    payload = scenario.model_dump(mode="json")
    fault_payload = scenario.faults.model_dump(mode="json")
    fault_payload["max_brake"] = 0.3
    payload["faults"] = fault_payload
    return ScenarioDefinition.model_validate(payload)


@pytest.mark.parametrize(
    ("construction_scenario", "message"),
    [
        (None, "fault scenario"),
        (_scenario(horizon_steps=2), "fault scenario"),
        (_mismatched_fault_scenario(), "fault config digest"),
    ],
    ids=("missing-scenario", "scenario-without-faults", "mismatched-fault-config"),
)
def test_v3_fault_construction_requires_exact_declared_scenario_binding(
    construction_scenario: ScenarioDefinition | None,
    message: str,
) -> None:
    declared_scenario = _scenario(control_delay_steps=1, horizon_steps=2)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)

    with pytest.raises(ValueError, match=message):
        _create_event(
            scenario=declared_scenario,
            construction_scenario=construction_scenario,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=neutral,
            permitted=neutral,
            executed=neutral,
            source_sequence=None,
            source_time_s=None,
            pre_saturation_action=neutral,
            control_faults=("CONTROL_DELAY_FILL",),
        )


@pytest.mark.parametrize(
    ("context_update", "message"),
    [
        ({"fault_name": "other-fault-injector"}, "fault identity"),
        ({"fault_version": "2.0"}, "fault identity"),
        ({"fault_config_digest": "2" * 64}, "fault config digest"),
    ],
    ids=("fault-name", "fault-version", "fault-config-digest"),
)
def test_v3_fault_construction_rejects_mismatched_declared_fault_identity(
    context_update: dict[str, object],
    message: str,
) -> None:
    scenario = _scenario(control_delay_steps=1, horizon_steps=2)
    context_payload = _run_context(scenario).model_dump(mode="json")
    context_payload.update(context_update)
    context = RunContextV3.model_validate(context_payload)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)

    with pytest.raises(ValueError, match=message):
        _create_event(
            scenario=scenario,
            run_context=context,
            sequence=0,
            observation=observation,
            result=result,
            decision=decision,
            candidate=neutral,
            permitted=neutral,
            executed=neutral,
            source_sequence=None,
            source_time_s=None,
            pre_saturation_action=neutral,
            control_faults=("CONTROL_DELAY_FILL",),
        )


def test_v3_fault_construction_accepts_exact_declared_fault_binding() -> None:
    scenario = _scenario(control_delay_steps=1, horizon_steps=2)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)

    event = _create_event(
        scenario=scenario,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=neutral,
        permitted=neutral,
        executed=neutral,
        source_sequence=None,
        source_time_s=None,
        pre_saturation_action=neutral,
        control_faults=("CONTROL_DELAY_FILL",),
        is_last=False,
    )

    assert event.run_context.fault_name == "deterministic-faults"
    assert event.run_context.fault_version == "1.0"
    assert (
        event.run_context.fault_config_digest
        == "36acbc01c124ba77b000aa83630bcb988ba1cbc5dbd68792978f68efc4f72586"
    )
    assert event.control_fault_evidence.applied_faults == ("CONTROL_DELAY_FILL",)


def test_v3_no_fault_construction_accepts_truthful_pass_through_without_scenario() -> None:
    scenario = _scenario(horizon_steps=1)
    observation = _observation(0)
    result = _observation(1)
    decision = _decision()
    neutral = project_to_action(throttle=0.0, brake=0.0)

    event = _create_event(
        scenario=scenario,
        construction_scenario=None,
        sequence=0,
        observation=observation,
        result=result,
        decision=decision,
        candidate=neutral,
        permitted=neutral,
        executed=neutral,
    )

    assert event.run_context.fault_name is None
    assert event.candidate_action == event.permitted_action == event.executed_action
