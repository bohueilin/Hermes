"""Forward collision warning, automatic emergency braking, and the scripted driver.

Each function is a small deterministic state machine over ``AdasObservation``. They hold
their own state (hysteresis, hold timers) and are reset per run, so a run's behaviour
depends only on the scenario, the configuration, and the delivered observations.

None of these are production ADAS implementations, and none of their thresholds carry any
standards or regulatory meaning.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from hermes.adas.interfaces import (
    AdasObservation,
    AebConfig,
    BrakeSource,
    DriverConfig,
    FcwConfig,
    InterventionLevel,
    WarningLevel,
)


@dataclass(slots=True)
class ForwardCollisionWarning:
    """Two-stage TTC warning with release hysteresis and explicit stale handling.

    First-order TTC remains the warning criterion. It is the right instrument for an
    advisory: it answers "how long until contact at the present closing rate", which is
    what a warning is telling the driver. AEB stages on a different criterion precisely
    because TTC is the wrong instrument for deciding to brake.
    """

    config: FcwConfig
    _level: WarningLevel = WarningLevel.NO_WARNING
    _emitted: int = 0

    def reset(self) -> None:
        self._level = WarningLevel.NO_WARNING
        self._emitted = 0

    @property
    def warning_count(self) -> int:
        return self._emitted

    def step(self, observation: AdasObservation) -> tuple[WarningLevel, tuple[str, ...]]:
        reasons: list[str] = []
        if observation.observation_age_s > self.config.stale_observation_s:
            # A stale observation is not evidence of safety. Drop to no warning and say so,
            # rather than continuing to assert a threat level computed from old data.
            self._level = WarningLevel.NO_WARNING
            return self._level, ("FCW_DEGRADED_STALE_OBSERVATION",)
        if observation.ego_speed_mps < self.config.minimum_ego_speed_mps:
            self._level = WarningLevel.NO_WARNING
            return self._level, ()
        if not observation.lead_in_path:
            self._level = WarningLevel.NO_WARNING
            return self._level, ()

        ttc = observation.time_to_collision_s()
        if ttc is None:
            # Not closing. Release only past the hysteresis margin so a warning does not
            # chatter across the boundary while the gap oscillates.
            self._level = WarningLevel.NO_WARNING
            return self._level, ()

        previous = self._level
        if ttc <= self.config.urgent_ttc_s:
            level = WarningLevel.URGENT_WARNING
            reasons.append("FCW_TTC_BELOW_URGENT_THRESHOLD")
        elif ttc <= self.config.advisory_ttc_s:
            level = WarningLevel.ADVISORY
            reasons.append("FCW_TTC_BELOW_ADVISORY_THRESHOLD")
        elif previous is not WarningLevel.NO_WARNING and ttc <= (
            self.config.advisory_ttc_s + self.config.release_ttc_margin_s
        ):
            level = previous
            reasons.append("FCW_HELD_BY_RELEASE_HYSTERESIS")
        else:
            level = WarningLevel.NO_WARNING

        if level is not WarningLevel.NO_WARNING and previous is WarningLevel.NO_WARNING:
            self._emitted += 1
        self._level = level
        return level, tuple(reasons)


#: Explicit severity rank. InterventionLevel is a StrEnum, so comparing members directly
#: compares their *strings* - which would order PARTIAL_BRAKE above EMERGENCY_BRAKE.
_INTERVENTION_RANK: dict[InterventionLevel, int] = {
    InterventionLevel.NO_INTERVENTION: 0,
    InterventionLevel.PARTIAL_BRAKE: 1,
    InterventionLevel.EMERGENCY_BRAKE: 2,
}


@dataclass(slots=True)
class AutomaticEmergencyBraking:
    """Required-deceleration staged braking with hold, release, and standstill hold.

    Staging is on ``a_req = closing^2 / (2 * usable_gap)`` rather than TTC. A lead that is
    itself braking makes TTC optimistic - the gap closes faster than the present relative
    speed implies - so a TTC-staged AEB intervenes late in exactly the scenario that
    matters most. Required deceleration asks the decision-relevant question instead: how
    hard would we have to brake, and is that within the authority we have?
    """

    config: AebConfig
    max_braking_mps2: float
    _level: InterventionLevel = InterventionLevel.NO_INTERVENTION
    _hold_remaining_s: float = 0.0
    _holding_standstill: bool = False
    _interventions: int = 0
    _reasons: tuple[str, ...] = field(default=())

    def reset(self) -> None:
        self._level = InterventionLevel.NO_INTERVENTION
        self._hold_remaining_s = 0.0
        self._holding_standstill = False
        self._interventions = 0

    @property
    def intervention_count(self) -> int:
        return self._interventions

    @property
    def holding_standstill(self) -> bool:
        return self._holding_standstill

    def _stage(self, required: float | None) -> InterventionLevel:
        if required is None:
            return InterventionLevel.NO_INTERVENTION
        emergency = self.config.emergency_authority_fraction * self.max_braking_mps2
        partial = self.config.partial_authority_fraction * self.max_braking_mps2
        if required >= emergency:
            return InterventionLevel.EMERGENCY_BRAKE
        if required >= partial:
            return InterventionLevel.PARTIAL_BRAKE
        return InterventionLevel.NO_INTERVENTION

    def _threat_cleared(self, observation: AdasObservation) -> bool:
        """Release requires positive evidence of safety, not merely absent evidence.

        Both conditions must hold: a real distance margin, and a TTC that is either
        undefined *and* the gap is large, or comfortably above the release threshold. An
        undefined TTC alone is not a release criterion - it happens the instant the closing
        speed touches zero, which is precisely mid-intervention.
        """
        if not observation.lead_in_path:
            return True
        assert observation.lead_distance_m is not None
        if observation.lead_distance_m < self.config.release_gap_margin_m:
            return False
        ttc = observation.time_to_collision_s()
        return ttc is None or ttc >= self.config.release_ttc_s

    def step(
        self,
        observation: AdasObservation,
        *,
        control_period_s: float,
    ) -> tuple[InterventionLevel, float, tuple[str, ...]]:
        """Return the intervention level, brake command, and evidence reasons."""
        reasons: list[str] = []

        if self._holding_standstill:
            # After bringing the vehicle to rest under AEB, hold the brake. Releasing at
            # zero speed would let the scripted driver immediately re-accelerate into the
            # obstacle that triggered the intervention.
            if observation.ego_speed_mps <= self.config.standstill_speed_mps:
                return (
                    InterventionLevel.EMERGENCY_BRAKE,
                    self.config.emergency_brake_command,
                    ("AEB_STANDSTILL_HOLD",),
                )
            self._holding_standstill = False

        if observation.observation_age_s > self.config.stale_observation_s:
            self._level = InterventionLevel.NO_INTERVENTION
            self._hold_remaining_s = 0.0
            return (
                InterventionLevel.NO_INTERVENTION,
                0.0,
                ("AEB_DEGRADED_STALE_OBSERVATION",),
            )

        required = observation.required_deceleration_mps2(standoff_m=self.config.standoff_m)
        staged = self._stage(required)

        if self._hold_remaining_s > 0.0:
            self._hold_remaining_s = max(0.0, self._hold_remaining_s - control_period_s)

        if staged is not InterventionLevel.NO_INTERVENTION:
            if self._level is InterventionLevel.NO_INTERVENTION:
                self._interventions += 1
                self._hold_remaining_s = self.config.minimum_hold_s
            elif _INTERVENTION_RANK[staged] > _INTERVENTION_RANK[self._level]:
                self._hold_remaining_s = max(self._hold_remaining_s, self.config.minimum_hold_s)
            self._level = staged
            reasons.append(
                "AEB_REQUIRED_DECELERATION_AT_EMERGENCY_AUTHORITY"
                if staged is InterventionLevel.EMERGENCY_BRAKE
                else "AEB_REQUIRED_DECELERATION_AT_PARTIAL_AUTHORITY"
            )
        elif self._level is not InterventionLevel.NO_INTERVENTION:
            if self._hold_remaining_s > 0.0:
                reasons.append("AEB_MINIMUM_HOLD_ACTIVE")
            elif self._threat_cleared(observation):
                self._level = InterventionLevel.NO_INTERVENTION
                reasons.append("AEB_RELEASED_THREAT_CLEARED")
            else:
                reasons.append("AEB_HELD_THREAT_NOT_CLEARED")

        if self._level is InterventionLevel.NO_INTERVENTION:
            return InterventionLevel.NO_INTERVENTION, 0.0, tuple(reasons)

        command = (
            self.config.emergency_brake_command
            if self._level is InterventionLevel.EMERGENCY_BRAKE
            else self.config.partial_brake_command
        )
        if (
            self._level is InterventionLevel.EMERGENCY_BRAKE
            and observation.ego_speed_mps <= self.config.standstill_speed_mps
        ):
            self._holding_standstill = True
            reasons.append("AEB_STANDSTILL_HOLD_ENGAGED")
        return self._level, command, tuple(reasons)


@dataclass(slots=True)
class ScriptedLongitudinalDriver:
    """Deterministic speed-tracking baseline the ADAS functions override."""

    config: DriverConfig
    target_speed_mps: float = 0.0

    def reset(self, target_speed_mps: float) -> None:
        self.target_speed_mps = target_speed_mps

    def step(self, observation: AdasObservation) -> tuple[float, float, BrakeSource]:
        """Return throttle, brake, and the attribution for any braking it commands."""
        error = self.target_speed_mps - observation.ego_speed_mps
        if abs(error) <= self.config.speed_deadband_mps:
            return 0.0, 0.0, BrakeSource.NONE
        if error > 0.0:
            throttle = min(self.config.max_throttle, self.config.speed_gain_per_mps * error)
            return throttle, 0.0, BrakeSource.NONE
        brake = min(self.config.max_brake, self.config.speed_gain_per_mps * -error)
        if brake <= 0.0:
            return 0.0, 0.0, BrakeSource.NONE
        return 0.0, brake, BrakeSource.DRIVER
