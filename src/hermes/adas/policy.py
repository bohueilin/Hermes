"""The ADAS longitudinal stack, exposed as an ordinary ``DrivingPolicy``.

Phase 8 deliberately does not introduce a parallel controller contract. An ADAS function is
a policy: it proposes an action, the environment executes it, verifiers evaluate the stored
trace, and the gate decides. Everything below is state that lives inside one policy.

Command arbitration (PRD §0-A.2.4) is fixed priority:

    AEB EMERGENCY_BRAKE  >  AEB PARTIAL_BRAKE  >  driver / ACC longitudinal

Brake always wins over throttle. The fused command is projected onto ``Action``, whose
invariant forbids simultaneous throttle and brake - that invariant is a hard pydantic
failure rather than a clamp, so the projection happens here explicitly rather than being
left to chance.
"""

from __future__ import annotations

import struct

from hermes.adas.functions import (
    AutomaticEmergencyBraking,
    ForwardCollisionWarning,
    ScriptedLongitudinalDriver,
)
from hermes.adas.interfaces import (
    AdasControllerConfig,
    AdasDecision,
    AdasMode,
    AdasObservation,
    BrakeSource,
    InterventionLevel,
    WarningLevel,
    project_observation,
)
from hermes.domain.models import Action, JsonValue, Observation, ScenarioDefinition


def _binary32(value: float) -> float:
    """Round to IEEE-754 binary32.

    MetaDrive stores actions as float32 and the adapter refuses to proceed when the action
    it reads back differs from the one it requested. A float64 command that is not exactly
    representable therefore aborts the run - observed as
    "accepted action (0.0, 0.9158437252044678) differs from requested (0.0, 0.9158437251382487)".
    Quantising here makes the executed action exactly what the trace records, which is the
    same clipping contract the existing MetaDrive policy declares.
    """
    return struct.unpack("!f", struct.pack("!f", value))[0]


def project_to_action(
    *,
    throttle: float,
    brake: float,
    steering: float = 0.0,
) -> Action:
    """Project a fused longitudinal command onto the executable action contract.

    Brake wins: a positive brake zeroes throttle. Without this an arbitration result of
    "coast off the throttle while braking" would raise a validation error deep inside the
    run loop and surface as an opaque operational failure.
    """
    if brake > 0.0:
        throttle = 0.0
    return Action(
        steering=_binary32(max(-1.0, min(1.0, steering))),
        throttle=_binary32(max(0.0, min(1.0, throttle))),
        brake=_binary32(max(0.0, min(1.0, brake))),
    )


class AdasLongitudinalPolicy:
    """FCW + AEB over a scripted longitudinal driver.

    Implements the existing ``DrivingPolicy`` protocol: ``name``, ``version``,
    ``evidence_config``, ``simulated_latency_ms``, ``reset(scenario, seed)`` and
    ``act(observation)``.
    """

    name = "adas-longitudinal"
    version = "1.0"

    def __init__(self, config: AdasControllerConfig | None = None) -> None:
        self._config = config or AdasControllerConfig()
        self._fcw = ForwardCollisionWarning(self._config.fcw)
        self._aeb = AutomaticEmergencyBraking(self._config.aeb, max_braking_mps2=6.0)
        self._driver = ScriptedLongitudinalDriver(self._config.driver)
        self._latency_ms = 10.0
        self._control_period_s = 0.1
        self._previous_relative_speed_mps: float | None = None
        self._last_decision: AdasDecision | None = None

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        """The digest-bound controller configuration.

        This is what ``policy_config_digest`` binds, and therefore what a baseline and a
        candidate are permitted to differ in under the declared variation axis.

        The scenario-owned values every policy reports - the tracked speed and the simulated
        latency - are included alongside the controller tunables, matching the existing
        policies. Stored-evidence verification reads ``simulated_policy_latency_ms`` from
        here and cross-checks it against every trace event's recorded latency.
        """
        return {
            **self._config.model_dump(mode="json"),
            "target_speed_mps": self._driver.target_speed_mps,
            "simulated_policy_latency_ms": self._latency_ms,
        }

    @property
    def simulated_latency_ms(self) -> float:
        return self._latency_ms

    @property
    def last_decision(self) -> AdasDecision | None:
        """The most recent decision, for trace-event evidence."""
        return self._last_decision

    @property
    def controller_config(self) -> AdasControllerConfig:
        return self._config

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del seed  # the controller is deterministic and draws no randomness
        self._latency_ms = scenario.control.simulated_policy_latency_ms
        self._control_period_s = 1.0 / scenario.control.frequency_hz
        # Braking authority and the speed to track are scenario-owned, not controller-owned.
        self._aeb = AutomaticEmergencyBraking(
            self._config.aeb,
            max_braking_mps2=scenario.control.max_braking_mps2,
        )
        self._fcw.reset()
        self._driver.reset(scenario.control.target_speed_mps)
        self._previous_relative_speed_mps = None
        self._last_decision = None

    def decide(self, observation: AdasObservation) -> AdasDecision:
        """Run the enabled functions and arbitrate, without touching policy plumbing."""
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

        decision = AdasDecision(
            warning=warning,
            intervention=intervention,
            mode=mode,
            brake_source=source,
            throttle=throttle,
            brake=brake,
            time_to_collision_s=observation.time_to_collision_s(),
            required_deceleration_mps2=_finite_or_none(
                observation.required_deceleration_mps2(standoff_m=self._config.aeb.standoff_m)
            ),
            reasons=tuple(reasons),
        )
        self._last_decision = decision
        return decision

    def act(self, observation: Observation) -> Action:
        adas_observation = project_observation(
            observation,
            previous_relative_speed_mps=self._previous_relative_speed_mps,
            control_period_s=self._control_period_s,
        )
        self._previous_relative_speed_mps = observation.front_relative_speed_mps
        decision = self.decide(adas_observation)
        return project_to_action(throttle=decision.throttle, brake=decision.brake)


def _finite_or_none(value: float | None) -> float | None:
    """Required deceleration is infinite once the usable gap is gone; do not store that.

    ``Action``-adjacent evidence models forbid non-finite floats, and an infinite value
    carries no more information than "the gap is already closed".
    """
    if value is None:
        return None
    if value == float("inf"):
        return None
    return value
