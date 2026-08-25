"""Simulator-free deterministic ADAS decision and attribution kernel."""

from __future__ import annotations

import struct

from hermes.adas.functions import (
    AutomaticEmergencyBraking,
    ForwardCollisionWarning,
    ScriptedLongitudinalDriver,
)
from hermes.adas.interfaces import AdasControllerConfig, AdasObservation, project_observation
from hermes.domain.enums import AdasMode, BrakeSource, InterventionLevel, WarningLevel
from hermes.domain.models import (
    Action,
    AdasDecision,
    AdasDecisionEvidence,
    ControlFaultEvidence,
    Observation,
    ScenarioDefinition,
)

_NEUTRAL_ACTION = Action(steering=0.0, throttle=0.0, brake=0.0)


def _binary32(value: float) -> float:
    """Round to the binary32 action representation used by MetaDrive."""
    return struct.unpack("!f", struct.pack("!f", value))[0]


def project_to_action(
    *,
    throttle: float,
    brake: float,
    steering: float = 0.0,
) -> Action:
    """Project one fused decision onto the exact executable action contract."""
    if brake > 0.0:
        throttle = 0.0
    return Action(
        steering=_binary32(max(-1.0, min(1.0, steering))),
        throttle=_binary32(max(0.0, min(1.0, throttle))),
        brake=_binary32(max(0.0, min(1.0, brake))),
    )


def action_from_decision(decision: AdasDecision) -> Action:
    """Return the exact candidate action represented by a typed ADAS decision."""
    return project_to_action(throttle=decision.throttle, brake=decision.brake)


def validate_adas_decision(decision: AdasDecision) -> None:
    """Reject internally contradictory typed ADAS semantics."""
    if decision.throttle > 0.0 and decision.brake > 0.0:
        raise ValueError("ADAS decision cannot command throttle and brake together")
    has_intervention = decision.intervention is not InterventionLevel.NO_INTERVENTION
    has_aeb_source = decision.brake_source is BrakeSource.AEB
    if has_intervention != has_aeb_source:
        raise ValueError("ADAS intervention and brake source are contradictory")


def validate_decision_evidence(
    evidence: AdasDecisionEvidence,
    observation: Observation,
    candidate_action: Action,
) -> None:
    """Reject stale or action-inconsistent policy evidence without fallback."""
    validate_adas_decision(evidence.decision)
    if evidence.input_sequence != observation.sequence:
        raise ValueError("ADAS decision input sequence does not match delivered observation")
    if evidence.input_time_s != observation.simulation_time_s:
        raise ValueError("ADAS decision input time does not match delivered observation")
    if action_from_decision(evidence.decision) != candidate_action:
        raise ValueError("ADAS decision does not match candidate action")
    candidate_brake_source(evidence.decision, candidate_action)


def candidate_brake_source(
    decision: AdasDecision,
    candidate_action: Action,
) -> BrakeSource:
    """Derive policy candidate attribution from its exact decision and action."""
    if action_from_decision(decision) != candidate_action:
        raise ValueError("ADAS decision does not match candidate action")
    if candidate_action.brake == 0.0:
        if decision.brake_source is not BrakeSource.NONE:
            raise ValueError("zero-brake candidate decision must have brake source NONE")
        return BrakeSource.NONE
    if decision.brake_source in {BrakeSource.NONE, BrakeSource.SHIELD}:
        raise ValueError("positive-brake candidate requires a policy brake source")
    return decision.brake_source


def permitted_brake_source(
    *,
    candidate_action: Action,
    candidate_source: BrakeSource,
    permitted_action: Action,
    override_reasons: tuple[str, ...],
) -> BrakeSource:
    """Derive shield output attribution from the exact brake change and reasons."""
    brake_changed = permitted_action.brake != candidate_action.brake
    if brake_changed and not override_reasons:
        raise ValueError("changed permitted brake requires an explicit shield override")
    if permitted_action.brake == 0.0:
        return BrakeSource.NONE
    if not brake_changed:
        return candidate_source
    return BrakeSource.SHIELD


def executed_brake_source(
    *,
    control_evidence: ControlFaultEvidence,
    executed_action: Action,
    source_permitted_action: Action | None,
    source_permitted_brake_source: BrakeSource | None,
) -> BrakeSource:
    """Derive executed origin without treating saturation as a new source."""
    source_sequence = control_evidence.executed_from_sequence
    if source_sequence is None:
        if (
            control_evidence.executed_from_candidate_time_s is not None
            or control_evidence.pre_saturation_action != _NEUTRAL_ACTION
            or executed_action != _NEUTRAL_ACTION
            or control_evidence.applied_faults != ("CONTROL_DELAY_FILL",)
            or source_permitted_action is not None
            or source_permitted_brake_source is not None
        ):
            raise ValueError("unattributed startup fill must be exactly neutral")
        return BrakeSource.NONE
    if source_permitted_action is None or source_permitted_brake_source is None:
        raise ValueError("executed source event is unavailable")
    if control_evidence.executed_from_candidate_time_s is None:
        raise ValueError("executed source time is unavailable")
    if control_evidence.pre_saturation_action != source_permitted_action:
        raise ValueError("pre-saturation action does not match the source permitted action")
    if "CONTROL_DELAY_FILL" in control_evidence.applied_faults:
        raise ValueError("sourced execution cannot claim control-delay startup fill")
    if (source_permitted_action.brake > 0.0) != (executed_action.brake > 0.0):
        raise ValueError("saturation cannot change whether the source action brakes")
    return source_permitted_brake_source


class AdasLongitudinalDecisionKernel:
    """Stateful deterministic FCW/AEB kernel reusable by live and stored replay."""

    def __init__(self, config: AdasControllerConfig | None = None) -> None:
        self._config = config or AdasControllerConfig()
        self._fcw = ForwardCollisionWarning(self._config.fcw)
        self._aeb = AutomaticEmergencyBraking(self._config.aeb, max_braking_mps2=6.0)
        self._driver = ScriptedLongitudinalDriver(self._config.driver)
        self._control_period_s = 0.1
        self._previous_relative_speed_mps: float | None = None

    @property
    def target_speed_mps(self) -> float:
        """Return the scenario-owned speed currently bound into the driver state."""
        return self._driver.target_speed_mps

    def reset(self, scenario: ScenarioDefinition) -> None:
        self._control_period_s = 1.0 / scenario.control.frequency_hz
        self._aeb = AutomaticEmergencyBraking(
            self._config.aeb,
            max_braking_mps2=scenario.control.max_braking_mps2,
        )
        self._fcw.reset()
        self._driver.reset(scenario.control.target_speed_mps)
        self._previous_relative_speed_mps = None

    def decide(self, observation: AdasObservation) -> AdasDecision:
        """Run enabled functions and deterministic longitudinal arbitration."""
        reasons: list[str] = []
        warning = WarningLevel.NO_WARNING
        intervention = InterventionLevel.NO_INTERVENTION
        aeb_brake = 0.0

        if "fcw" in self._config.functions:
            warning, fcw_reasons = self._fcw.step(observation)
            reasons.extend(fcw_reasons)

        if "aeb" in self._config.functions:
            intervention, aeb_brake, aeb_reasons = self._aeb.step(
                observation, control_period_s=self._control_period_s
            )
            reasons.extend(aeb_reasons)

        if (
            "seeded_actor_presence_brake" in self._config.functions
            and observation.challenge_actor_present
        ):
            intervention = InterventionLevel.EMERGENCY_BRAKE
            aeb_brake = self._config.aeb.emergency_brake_command
            reasons.append("SEEDED_DEFECT_ACTOR_PRESENCE_BRAKE")

        driver_throttle, driver_brake, driver_source = self._driver.step(observation)
        if intervention is not InterventionLevel.NO_INTERVENTION:
            throttle, brake, source = 0.0, aeb_brake, BrakeSource.AEB
            reasons.append("ARBITRATION_AEB_OVERRIDES_LONGITUDINAL")
        else:
            throttle, brake, source = driver_throttle, driver_brake, driver_source

        degraded = observation.observation_age_s > self._config.aeb.stale_observation_s
        mode = AdasMode.DEGRADED if degraded else AdasMode.ACTIVE
        return AdasDecision(
            warning=warning,
            intervention=intervention,
            mode=mode,
            brake_source=source,
            throttle=throttle,
            brake=brake,
            time_to_collision_s=observation.time_to_collision_s(),
            required_deceleration_mps2=_finite_or_none(
                observation.required_deceleration_mps2(
                    standoff_m=self._config.aeb.standoff_m
                )
            ),
            reasons=tuple(reasons),
        )

    def step(self, observation: Observation) -> tuple[Action, AdasDecisionEvidence]:
        """Decide from one delivered input and return its exact candidate evidence."""
        adas_observation = project_observation(
            observation,
            previous_relative_speed_mps=self._previous_relative_speed_mps,
            control_period_s=self._control_period_s,
        )
        self._previous_relative_speed_mps = observation.front_relative_speed_mps
        decision = self.decide(adas_observation)
        action = action_from_decision(decision)
        return action, AdasDecisionEvidence(
            input_sequence=observation.sequence,
            input_time_s=observation.simulation_time_s,
            decision=decision,
        )


def _finite_or_none(value: float | None) -> float | None:
    if value is None or value == float("inf"):
        return None
    return value
