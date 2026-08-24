"""Typed inputs, outputs, and tunables shared by the ADAS longitudinal functions.

Conventions, fixed here once so no function re-derives them:

* ``lead_relative_speed_mps`` is negative when closing. This matches the repository's
  existing convention in ``hermes.shields.deterministic.observation_ttc_s``.
* ``lead_distance_m`` is a bumper gap that the adapter reports **only** while the actor
  laterally overlaps the ego lane, so ``lead_distance_m is not None`` already carries the
  in-path determination. There is no separate in-path flag to disagree with it.
* Time to collision is ``None`` whenever the closing speed is not positive. It is never
  epsilon-clamped, because a clamped TTC turns "no threat" into "a very large threat
  margin" and both read as a number downstream.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Field, field_validator

from hermes.domain.models import FiniteFloat, HermesModel, NonNegativeFloat, Observation


class WarningLevel(StrEnum):
    """Forward-collision warning output (PRD §7.1)."""

    NO_WARNING = "NO_WARNING"
    ADVISORY = "ADVISORY"
    URGENT_WARNING = "URGENT_WARNING"


class InterventionLevel(StrEnum):
    """Automatic emergency braking output (PRD §7.2)."""

    NO_INTERVENTION = "NO_INTERVENTION"
    PARTIAL_BRAKE = "PARTIAL_BRAKE"
    EMERGENCY_BRAKE = "EMERGENCY_BRAKE"


class BrakeSource(StrEnum):
    """Which component a braking command is attributable to.

    Required by PRD §0-A.2.4: AEB metrics count only ``aeb``-attributed braking, so a
    brake applied by the scripted driver or a shield can never inflate an AEB result.
    """

    NONE = "none"
    DRIVER = "driver"
    AEB = "aeb"
    ACC = "acc"
    SHIELD = "shield"


class AdasMode(StrEnum):
    """Supervisory mode of the longitudinal stack."""

    OFF = "OFF"
    AVAILABLE = "AVAILABLE"
    ACTIVE = "ACTIVE"
    DEGRADED = "DEGRADED"


class AdasObservation(HermesModel):
    """The ADAS view of one step, projected from the stored-domain ``Observation``."""

    sequence: Annotated[int, Field(ge=0)]
    simulation_time_s: NonNegativeFloat
    ego_speed_mps: NonNegativeFloat
    ego_acceleration_mps2: FiniteFloat
    observation_age_s: NonNegativeFloat
    lead_distance_m: NonNegativeFloat | None = None
    lead_relative_speed_mps: FiniteFloat | None = None
    lead_relative_acceleration_mps2: FiniteFloat | None = None

    @property
    def lead_in_path(self) -> bool:
        """Whether a lead object is both present and laterally in the ego path."""
        return self.lead_distance_m is not None and self.lead_relative_speed_mps is not None

    @property
    def closing_speed_mps(self) -> float:
        """Positive rate at which the gap is shrinking; zero when not closing."""
        if self.lead_relative_speed_mps is None:
            return 0.0
        return max(0.0, -self.lead_relative_speed_mps)

    def time_to_collision_s(self) -> float | None:
        """First-order TTC, or ``None`` when undefined.

        Undefined means undefined: no lead, or a closing speed that is not positive. The
        caller must handle ``None`` rather than receive a sentinel that compares as safe.
        """
        if not self.lead_in_path:
            return None
        closing = self.closing_speed_mps
        if closing <= 0.0:
            return None
        assert self.lead_distance_m is not None
        return self.lead_distance_m / closing

    def required_deceleration_mps2(self, *, standoff_m: float) -> float | None:
        """Constant deceleration that would just null the closing speed within the gap.

        ``a_req = closing^2 / (2 * usable_gap)``. This is the AEB staging criterion rather
        than TTC because first-order TTC systematically overestimates the time available
        when the lead is itself decelerating - exactly the flagship lead-hard-brake case.
        """
        if not self.lead_in_path:
            return None
        closing = self.closing_speed_mps
        if closing <= 0.0:
            return None
        assert self.lead_distance_m is not None
        usable_gap = self.lead_distance_m - standoff_m
        if usable_gap <= 0.0:
            return float("inf")
        return (closing * closing) / (2.0 * usable_gap)


class AdasDecision(HermesModel):
    """One step's ADAS output, before projection onto the executed vehicle command."""

    warning: WarningLevel
    intervention: InterventionLevel
    mode: AdasMode
    brake_source: BrakeSource
    throttle: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    brake: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    time_to_collision_s: FiniteFloat | None
    required_deceleration_mps2: FiniteFloat | None
    reasons: tuple[str, ...] = ()


class FcwConfig(HermesModel):
    """Forward-collision-warning tunables.

    Defaults are illustrative simulation values, not regulatory or standards thresholds.
    """

    advisory_ttc_s: Annotated[FiniteFloat, Field(gt=0.0, le=10.0)] = 2.6
    urgent_ttc_s: Annotated[FiniteFloat, Field(gt=0.0, le=10.0)] = 1.6
    release_ttc_margin_s: Annotated[FiniteFloat, Field(ge=0.0, le=5.0)] = 0.4
    minimum_ego_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=20.0)] = 1.0
    stale_observation_s: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)] = 0.5

    def model_post_init(self, _context: object) -> None:
        if self.urgent_ttc_s >= self.advisory_ttc_s:
            raise ValueError("urgent_ttc_s must be below advisory_ttc_s")


class AebConfig(HermesModel):
    """Automatic-emergency-braking tunables.

    Staging is expressed as fractions of the scenario's measured simulator envelope so a
    threshold means the same thing at any explicitly calibrated deceleration limit. The
    defaults preserve the prior 2.4 and 4.2 m/s^2 absolute staging boundaries against the
    measured 20 m/s peak in ``evidence/calibration/metadrive-brake-curve-0.4.3.json``.
    """

    partial_authority_fraction: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)] = (
        0.1848650268712171
    )
    emergency_authority_fraction: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)] = (
        0.3235137970246298
    )
    partial_brake_command: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)] = 0.5
    emergency_brake_command: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)] = 1.0
    standoff_m: Annotated[FiniteFloat, Field(ge=0.0, le=20.0)] = 2.0
    minimum_hold_s: Annotated[FiniteFloat, Field(ge=0.0, le=10.0)] = 0.5
    release_gap_margin_m: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)] = 5.0
    release_ttc_s: Annotated[FiniteFloat, Field(gt=0.0, le=20.0)] = 4.0
    standstill_speed_mps: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)] = 0.2
    minimum_ego_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=20.0)] = 1.0
    stale_observation_s: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)] = 0.5

    def model_post_init(self, _context: object) -> None:
        if self.emergency_authority_fraction <= self.partial_authority_fraction:
            raise ValueError(
                "emergency_authority_fraction must exceed partial_authority_fraction"
            )
        if self.emergency_brake_command < self.partial_brake_command:
            raise ValueError("emergency_brake_command must not be below partial_brake_command")


class DriverConfig(HermesModel):
    """Deterministic scripted longitudinal driver the ADAS functions override.

    FCW- and AEB-only scenarios still need the ego to approach the threat. Without a driver
    the policy would be the only source of throttle and an AEB-only controller would never
    move. This is a scripted baseline behaviour, not a model of a human.
    """

    speed_gain_per_mps: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)] = 0.5
    max_throttle: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)] = 1.0
    #: Defaults to zero so the scripted driver never brakes.
    #:
    #: In an FCW/AEB run that makes every braking command in the trace AEB-attributable by
    #: construction, which is what lets an offline verifier - which sees only the stored
    #: trace, not the controller's internal decision - count AEB interventions without
    #: guessing. A configuration that raises it is opting into ambiguous attribution.
    max_brake: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)] = 0.0
    speed_deadband_mps: Annotated[FiniteFloat, Field(ge=0.0, le=5.0)] = 0.2


class AdasControllerConfig(HermesModel):
    """Complete, digest-bound configuration of the ADAS longitudinal stack.

    This is what a policy exposes as ``evidence_config``, so it is what
    ``policy_config_digest`` binds. Two controllers differing only here are the declared
    variation axis a baseline-versus-candidate comparison is allowed to vary.
    """

    label: Literal["illustrative_simulation_adas_not_real_vehicle_limits"] = (
        "illustrative_simulation_adas_not_real_vehicle_limits"
    )
    functions: tuple[Literal["fcw", "aeb"], ...] = ("fcw", "aeb")
    fcw: FcwConfig = Field(default_factory=FcwConfig)
    aeb: AebConfig = Field(default_factory=AebConfig)
    driver: DriverConfig = Field(default_factory=DriverConfig)

    @field_validator("functions", mode="before")
    @classmethod
    def normalize_yaml_sequence(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    def model_post_init(self, _context: object) -> None:
        if not self.functions:
            raise ValueError("an ADAS controller must enable at least one function")
        if len(set(self.functions)) != len(self.functions):
            raise ValueError("enabled ADAS functions must be unique")


def project_observation(
    observation: Observation,
    *,
    previous_relative_speed_mps: float | None,
    control_period_s: float,
) -> AdasObservation:
    """Project a stored-domain observation into the ADAS view.

    Lead relative acceleration is estimated here by differencing the relative speed across
    one control period rather than being read from the observation. It is therefore an
    estimate derived from delivered - possibly delayed or noisy - observations, exactly
    like every other input the controller sees, and it carries no privileged simulator
    knowledge.
    """
    relative_speed = observation.front_relative_speed_mps
    relative_acceleration: float | None = None
    if (
        relative_speed is not None
        and previous_relative_speed_mps is not None
        and control_period_s > 0.0
    ):
        relative_acceleration = (relative_speed - previous_relative_speed_mps) / control_period_s
    return AdasObservation(
        sequence=observation.sequence,
        simulation_time_s=observation.simulation_time_s,
        ego_speed_mps=observation.vehicle_state.speed_mps,
        ego_acceleration_mps2=observation.vehicle_state.acceleration_mps2,
        observation_age_s=observation.observation_age_s,
        lead_distance_m=observation.front_distance_m,
        lead_relative_speed_mps=relative_speed,
        lead_relative_acceleration_mps2=relative_acceleration,
    )
