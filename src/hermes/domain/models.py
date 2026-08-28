"""Strict simulator-neutral data models for Hermes."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from hermes.domain.enums import (
    AdasMode,
    AuthenticityStatus,
    BrakeSource,
    EvidenceAvailability,
    FindingStatus,
    IntegrityStatus,
    InterventionLevel,
    Severity,
    TerminationReason,
    Verdict,
    WarningLevel,
)

FiniteFloat = Annotated[float, Field(allow_inf_nan=False)]
NonNegativeFloat = Annotated[FiniteFloat, Field(ge=0.0)]
JsonValue = str | int | float | bool | None | list[Any] | dict[str, Any]


class HermesModel(BaseModel):
    """Base configuration shared by every persisted Hermes model."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)


class Action(HermesModel):
    """Normalized steering, throttle, and brake command."""

    steering: Annotated[FiniteFloat, Field(ge=-1.0, le=1.0)]
    throttle: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    brake: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]

    @model_validator(mode="after")
    def reject_conflicting_longitudinal_commands(self) -> Action:
        if self.throttle > 0.0 and self.brake > 0.0:
            raise ValueError("throttle and brake cannot both be positive")
        return self


class VehicleState(HermesModel):
    """Verifier-relevant state independent of a simulator implementation."""

    position_m: FiniteFloat
    speed_mps: NonNegativeFloat
    acceleration_mps2: FiniteFloat
    lateral_offset_m: FiniteFloat
    route_progress_pct: Annotated[FiniteFloat, Field(ge=0.0, le=100.0)]
    collision_count: Annotated[int, Field(ge=0)]
    offroad: bool
    destination_reached: bool


class Observation(HermesModel):
    """Information made available to a policy at one deterministic step."""

    sequence: Annotated[int, Field(ge=0)]
    simulation_time_s: NonNegativeFloat
    vehicle_state: VehicleState
    front_distance_m: NonNegativeFloat | None = None
    front_relative_speed_mps: FiniteFloat | None = None
    observation_age_s: NonNegativeFloat = 0.0
    challenge_actor_longitudinal_m: FiniteFloat | None = None
    challenge_actor_lateral_offset_m: FiniteFloat | None = None
    challenge_actor_speed_mps: NonNegativeFloat | None = None
    challenge_phase: Literal[
        "PRE_TRIGGER",
        "BRAKING",
        "RECOVERY",
        "CUT_IN",
        "POST_CUT_IN",
        "PRESENT",
        "STEADY",
    ] | None = None


class AdasDecision(HermesModel):
    """One typed ADAS decision before action attribution and execution."""

    warning: WarningLevel
    intervention: InterventionLevel
    mode: AdasMode
    brake_source: BrakeSource
    throttle: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    brake: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    time_to_collision_s: FiniteFloat | None
    required_deceleration_mps2: FiniteFloat | None
    reasons: tuple[str, ...] = ()


class AdasDecisionEvidence(HermesModel):
    """One policy decision bound to the exact delivered input that produced it."""

    input_sequence: Annotated[int, Field(ge=0)]
    input_time_s: NonNegativeFloat
    decision: AdasDecision


class VerifierFacts(HermesModel):
    """Authoritative typed facts consumed by offline verifiers."""

    collision: bool
    collision_count: Annotated[int, Field(ge=0)]
    offroad: bool
    destination_reached: bool
    route_progress_available: bool
    route_progress_pct: Annotated[FiniteFloat, Field(ge=0.0, le=100.0)] | None

    @model_validator(mode="after")
    def validate_progress_availability(self) -> VerifierFacts:
        if self.route_progress_available and self.route_progress_pct is None:
            raise ValueError("available route progress requires route_progress_pct")
        if not self.route_progress_available and self.route_progress_pct is not None:
            raise ValueError("unavailable route progress cannot include a value")
        return self


class StepResult(HermesModel):
    """Result returned by a simulator adapter after one action."""

    observation: Observation
    terminated: bool = False
    truncated: bool = False
    termination_reason: TerminationReason = TerminationReason.NONE
    raw_facts: VerifierFacts


class EpisodeResult(HermesModel):
    """Bounded adapter outcome used by orchestration callers."""

    steps: Annotated[int, Field(ge=0)]
    termination_reason: TerminationReason
    final_state: VehicleState


class ControlConfig(HermesModel):
    """Resolved deterministic control-loop settings."""

    frequency_hz: Annotated[int, Field(ge=1, le=100)]
    horizon_steps: Annotated[int, Field(ge=1, le=10_000)]
    target_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)]
    max_acceleration_mps2: Annotated[FiniteFloat, Field(gt=0.0, le=20.0)] = 3.0
    #: The 6.0 m/s² default is a declared, unenforced, unmeasured value; committed ADAS
    #: scenarios override it with the measured simulator envelope.
    max_braking_mps2: Annotated[FiniteFloat, Field(gt=0.0, le=20.0)] = 6.0
    lateral_response_mps: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)] = 1.0
    simulated_policy_latency_ms: Annotated[FiniteFloat, Field(ge=0.0, le=10_000.0)] = 10.0


class InitialState(HermesModel):
    """Initial ego state for a bounded scenario."""

    speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)]
    lateral_offset_m: Annotated[FiniteFloat, Field(ge=-10.0, le=10.0)]


class RoadConfig(HermesModel):
    """Minimal lane-like road definition for the architectural test double."""

    destination_distance_m: Annotated[FiniteFloat, Field(gt=0.0, le=100_000.0)]
    boundary_tolerance_m: Annotated[FiniteFloat, Field(gt=0.0, le=10.0)]


class HazardConfig(HermesModel):
    """Deterministic synthetic conditions supported by the fake adapter."""

    collision_at_step: Annotated[int, Field(ge=0)] | None = None
    boundary_at_step: Annotated[int, Field(ge=0)] | None = None
    comfort_spike_at_step: Annotated[int, Field(ge=0)] | None = None
    comfort_acceleration_mps2: Annotated[FiniteFloat, Field(ge=-20.0, le=20.0)] = 6.0
    unavailable_progress: bool = False


class FrozenObservationInterval(HermesModel):
    """A bounded interval that reuses one previously selected observation."""

    start_step: Annotated[int, Field(ge=1, le=9_999)]
    duration_steps: Annotated[int, Field(ge=1, le=10_000)]


class ObservationNoiseConfig(HermesModel):
    """Counter-based bounded noise applied only to declared ego-state fields."""

    speed_mps_bound: Annotated[FiniteFloat, Field(ge=0.0, le=10.0)] = 0.0
    lateral_offset_m_bound: Annotated[FiniteFloat, Field(ge=0.0, le=5.0)] = 0.0

    @model_validator(mode="after")
    def require_a_positive_bound(self) -> ObservationNoiseConfig:
        if self.speed_mps_bound == 0.0 and self.lateral_offset_m_bound == 0.0:
            raise ValueError("observation noise requires at least one positive bound")
        return self


class FaultConfig(HermesModel):
    """Strict deterministic fault profile bound into a schema-3 scenario."""

    schema_version: Literal["1.0"]
    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    version: Annotated[str, Field(min_length=1, max_length=32)]
    label: Literal["illustrative_simulation_faults_not_real_vehicle_limits"]
    observation_delay_steps: Annotated[int, Field(ge=0, le=9_999)] = 0
    control_delay_steps: Annotated[int, Field(ge=0, le=9_999)] = 0
    neutral_startup_action: Action = Field(
        default_factory=lambda: Action(steering=0.0, throttle=0.0, brake=0.0)
    )
    frozen_observation_interval: FrozenObservationInterval | None = None
    dropped_observation_steps: tuple[Annotated[int, Field(ge=1, le=9_999)], ...] = ()
    observation_noise: ObservationNoiseConfig | None = None
    max_abs_steering: Annotated[FiniteFloat, Field(gt=0.0, lt=1.0)] | None = None
    max_brake: Annotated[FiniteFloat, Field(gt=0.0, lt=1.0)] | None = None

    @field_validator("dropped_observation_steps", mode="before")
    @classmethod
    def normalize_yaml_step_list(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    @model_validator(mode="after")
    def reject_ambiguous_profile(self) -> FaultConfig:
        if self.neutral_startup_action != Action(
            steering=0.0, throttle=0.0, brake=0.0
        ):
            raise ValueError("neutral_startup_action must be exactly neutral")
        if tuple(sorted(set(self.dropped_observation_steps))) != self.dropped_observation_steps:
            raise ValueError("dropped_observation_steps must be sorted and unique")
        if self.frozen_observation_interval is not None:
            start = self.frozen_observation_interval.start_step
            end = start + self.frozen_observation_interval.duration_steps
            overlap = [step for step in self.dropped_observation_steps if start <= step < end]
            if overlap:
                raise ValueError(
                    "frozen observation interval cannot overlap dropped observation steps"
                )
        return self

    @property
    def enabled(self) -> bool:
        return (
            self.observation_delay_steps > 0
            or self.control_delay_steps > 0
            or self.frozen_observation_interval is not None
            or bool(self.dropped_observation_steps)
            or self.observation_noise is not None
            or self.max_abs_steering is not None
            or self.max_brake is not None
        )


class LeadVehicleHardBrakeChallenge(HermesModel):
    """A simulator-dynamic lead actor with a scheduled full-brake interval."""

    kind: Literal["lead_vehicle_hard_brake"]
    actor_control_mode: Literal["metadrive_dynamic_action"]
    behavior_realism_claim: Literal[False]
    initial_gap_m: Annotated[FiniteFloat, Field(gt=0.0, le=200.0)]
    actor_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)]
    trigger_step: Annotated[int, Field(ge=0)]
    brake_duration_steps: Annotated[int, Field(ge=1, le=10_000)]
    brake_command: Literal[-1.0]
    resume_throttle_command: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]


class CutInNearFieldChallenge(HermesModel):
    """A deterministic kinematic replay from an adjacent lane into the ego lane."""

    kind: Literal["cut_in_near_field"]
    actor_control_mode: Literal["scripted_kinematic_replay"]
    behavior_realism_claim: Literal[False]
    initial_gap_m: Annotated[FiniteFloat, Field(gt=0.0, le=200.0)]
    actor_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)]
    initial_lane_delta: Literal[-1, 1]
    trigger_step: Annotated[int, Field(ge=0)]
    transition_steps: Annotated[int, Field(ge=1, le=10_000)]


class StationaryLeadChallenge(HermesModel):
    """A stationary actor replayed at a fixed pose in or beside the ego lane."""

    kind: Literal["stationary_lead"]
    actor_control_mode: Literal["scripted_kinematic_replay"]
    behavior_realism_claim: Literal[False]
    initial_gap_m: Annotated[FiniteFloat, Field(gt=0.0, le=200.0)]
    initial_lane_delta: Literal[-1, 0, 1] = 0


class SteadyLeadChallenge(HermesModel):
    """A deterministic kinematic lead replayed at constant speed in or beside the ego lane."""

    kind: Literal["steady_lead"]
    actor_control_mode: Literal["scripted_kinematic_replay"]
    behavior_realism_claim: Literal[False]
    initial_gap_m: Annotated[FiniteFloat, Field(gt=0.0, le=200.0)]
    # Zero speed would duplicate stationary_lead's physical situation under a second kind
    # identity, so this implementation-level narrowing excludes it.
    actor_speed_mps: Annotated[FiniteFloat, Field(gt=0.0, le=50.0)]
    initial_lane_delta: Literal[-1, 0, 1] = 0


ChallengeConfig = Annotated[
    LeadVehicleHardBrakeChallenge
    | CutInNearFieldChallenge
    | StationaryLeadChallenge
    | SteadyLeadChallenge,
    Field(discriminator="kind"),
]


#: MetaDrive advances physics in fixed 0.02 s steps, so a control frequency is only exactly
#: representable when 1 / (frequency_hz * 0.02) is a whole number of physics steps. That is
#: true precisely for the divisors of 50: 1, 2, 5, 10, 25 and 50 Hz. 20, 30 and 60 Hz are not.
METADRIVE_PHYSICS_STEP_S = 0.02
METADRIVE_STEPS_PER_SECOND = 50


class OddDeclaration(HermesModel):
    """Resolved operational design domain for one simulated scenario.

    This records the conditions a scenario is *declared* to exercise. It is a scoping
    statement about the simulation, not a claim about real-world operating limits.
    """

    road_type: tuple[Literal["highway", "arterial_simple"], ...]
    weather: tuple[Literal["clear"], ...] = ("clear",)
    lighting: tuple[Literal["daylight"], ...] = ("daylight",)
    lane_markings_required: bool = True
    min_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)] = 0.0
    max_speed_mps: Annotated[FiniteFloat, Field(ge=0.0, le=50.0)] = 30.0
    vulnerable_road_users: Literal["excluded", "explicit_scenarios"] = "excluded"
    intersections: Literal["excluded"] = "excluded"

    @field_validator("road_type", "weather", "lighting", mode="before")
    @classmethod
    def normalize_yaml_sequence(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    @model_validator(mode="after")
    def require_ordered_non_empty_declaration(self) -> OddDeclaration:
        if not self.road_type:
            raise ValueError("ODD must declare at least one road type")
        if self.min_speed_mps > self.max_speed_mps:
            raise ValueError("ODD speed range must be ordered: min_speed_mps <= max_speed_mps")
        return self


class FcwExpectation(HermesModel):
    """Scenario-authored, oracle-verified expectation for forward collision warning."""

    kind: Literal["none", "required"]
    before_ttc_s: Annotated[FiniteFloat, Field(gt=0.0, le=10.0)] | None = None

    @model_validator(mode="after")
    def require_threshold_only_when_required(self) -> FcwExpectation:
        if self.kind == "none" and self.before_ttc_s is not None:
            raise ValueError("expected_fcw none cannot declare before_ttc_s")
        return self


class AebExpectation(HermesModel):
    """Scenario-authored, oracle-verified expectation for automatic emergency braking."""

    kind: Literal["forbidden", "required"]


class AdasConfig(HermesModel):
    """Which ADAS functions a scenario exercises, and what is expected of them."""

    enabled: tuple[Literal["fcw", "aeb", "acc", "lka", "assist"], ...]
    expected_fcw: FcwExpectation | None = None
    expected_aeb: AebExpectation | None = None

    @field_validator("enabled", mode="before")
    @classmethod
    def normalize_yaml_sequence(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    @model_validator(mode="after")
    def require_unique_non_empty_functions(self) -> AdasConfig:
        if not self.enabled:
            raise ValueError("an ADAS block must enable at least one function")
        if len(set(self.enabled)) != len(self.enabled):
            raise ValueError("enabled ADAS functions must be unique")
        return self


class ScenarioRequirement(HermesModel):
    """One structured expected property, compiling to exactly one verifier finding."""

    property_id: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    verifier: Annotated[str, Field(min_length=1, max_length=64)]
    metric: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_.]{0,63}$")]
    operator: Literal["<", "<=", "==", "!=", ">=", ">"]
    threshold: FiniteFloat | None = None
    unit: Annotated[str, Field(min_length=1, max_length=32)] | None = None
    hard: bool


class ScenarioDefinition(HermesModel):
    """Versioned, resolved, simulator-neutral scenario definition."""

    schema_version: Literal["1.0", "2.0", "3.0", "4.0"]
    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    version: Annotated[str, Field(min_length=1, max_length=32)]
    description: Annotated[str, Field(min_length=1, max_length=500)]
    adapter: Literal["fake", "metadrive"]
    control: ControlConfig
    initial_state: InitialState
    road: RoadConfig
    hazards: HazardConfig = Field(default_factory=HazardConfig)
    challenge: ChallengeConfig | None = None
    faults: FaultConfig | None = None
    # Schema-4.0-only blocks. They must never reach the resolved payload of an older
    # scenario: scenario_digest is recomputed during re-verification and compared to the
    # value stored in every bundle, so a shifted digest would invalidate stored evidence.
    # hermes.scenarios.loader strips them for schema versions below 4.0.
    tags: tuple[Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")], ...] = ()
    odd: OddDeclaration | None = None
    adas: AdasConfig | None = None
    requirements: tuple[ScenarioRequirement, ...] = ()

    @field_validator("tags", "requirements", mode="before")
    @classmethod
    def normalize_yaml_sequence(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    @model_validator(mode="after")
    def reject_contradictory_configuration(self) -> ScenarioDefinition:
        for field_name in (
            "collision_at_step",
            "boundary_at_step",
            "comfort_spike_at_step",
        ):
            step = getattr(self.hazards, field_name)
            if step is not None and step >= self.control.horizon_steps:
                raise ValueError(
                    f"{field_name} must be less than horizon_steps "
                    f"({self.control.horizon_steps})"
                )

        if self.schema_version != "4.0" and (
            self.tags or self.odd is not None or self.adas is not None or self.requirements
        ):
            raise ValueError(
                "schema_version below 4.0 cannot define tags, odd, adas, or requirements"
            )

        if self.schema_version == "1.0":
            if self.challenge is not None:
                raise ValueError("schema_version 1.0 cannot define challenge")
            if self.faults is not None:
                raise ValueError("schema_version 1.0 cannot define faults")
            return self

        if self.schema_version == "2.0":
            if self.faults is not None:
                raise ValueError("schema_version 2.0 cannot define faults")
            if self.adapter != "metadrive":
                raise ValueError("schema_version 2.0 requires adapter metadrive")
            if self.challenge is None:
                raise ValueError("schema_version 2.0 requires challenge")
        elif self.schema_version == "3.0":
            if self.faults is None or not self.faults.enabled:
                raise ValueError("schema_version 3.0 requires an enabled fault profile")
            if self.adapter == "fake" and self.challenge is not None:
                raise ValueError("fake adapter cannot define a MetaDrive challenge")
            self._reject_faults_beyond_horizon()
        else:
            self._validate_schema_4()

        if self.challenge is None:
            return self
        if self.adapter != "metadrive":
            raise ValueError("challenge scenarios require adapter metadrive")
        if self.hazards != HazardConfig():
            raise ValueError("MetaDrive challenge cannot coexist with fake hazards")

        end_step: int
        window_name: str
        if isinstance(self.challenge, LeadVehicleHardBrakeChallenge):
            end_step = self.challenge.trigger_step + self.challenge.brake_duration_steps
            window_name = "lead-vehicle braking window"
        elif isinstance(self.challenge, CutInNearFieldChallenge):
            end_step = self.challenge.trigger_step + self.challenge.transition_steps
            window_name = "cut-in transition window"
        else:
            return self
        if end_step > self.control.horizon_steps:
            raise ValueError(
                f"{window_name} must fit within horizon_steps "
                f"({self.control.horizon_steps})"
            )
        return self

    def _reject_faults_beyond_horizon(self) -> None:
        """Fault schedules must fit inside the run. Shared by schema 3.0 and 4.0."""
        assert self.faults is not None
        if (
            self.faults.observation_delay_steps >= self.control.horizon_steps
            or self.faults.control_delay_steps >= self.control.horizon_steps
        ):
            raise ValueError("fault delays must be less than horizon_steps")
        interval = self.faults.frozen_observation_interval
        if (
            interval is not None
            and interval.start_step + interval.duration_steps > self.control.horizon_steps
        ):
            raise ValueError("frozen observation interval must fit within horizon_steps")
        if any(
            step >= self.control.horizon_steps
            for step in self.faults.dropped_observation_steps
        ):
            raise ValueError("dropped observation steps must be less than horizon_steps")

    def _validate_schema_4(self) -> None:
        """Validate an ADAS scenario.

        Schema 4.0 is deliberately permissive where 2.0 and 3.0 are strict: a challenge and
        a fault profile may coexist, and both are optional, because ADAS coverage needs
        threat scenarios, degraded threat scenarios, and threat-free nominal exposure.
        """
        if self.faults is not None:
            if not self.faults.enabled:
                raise ValueError("a declared schema_version 4.0 fault profile must be enabled")
            self._reject_faults_beyond_horizon()
        if self.adapter == "metadrive" and METADRIVE_STEPS_PER_SECOND % self.control.frequency_hz:
            raise ValueError(
                f"control frequency {self.control.frequency_hz} Hz has no exact MetaDrive "
                f"decision interval at the {METADRIVE_PHYSICS_STEP_S} s physics step; use a "
                f"divisor of {METADRIVE_STEPS_PER_SECOND} Hz"
            )
        if len(set(self.tags)) != len(self.tags):
            raise ValueError("scenario tags must be unique")
        if self.odd is not None and not (
            self.odd.min_speed_mps <= self.control.target_speed_mps <= self.odd.max_speed_mps
        ):
            raise ValueError(
                f"target_speed_mps {self.control.target_speed_mps} lies outside the declared "
                f"ODD speed range [{self.odd.min_speed_mps}, {self.odd.max_speed_mps}]"
            )
        property_ids = [requirement.property_id for requirement in self.requirements]
        if len(set(property_ids)) != len(property_ids):
            raise ValueError("requirement property_id values must be unique")

    @property
    def expected_hazard(self) -> str | None:
        if self.challenge is not None:
            return self.challenge.kind
        if self.hazards.collision_at_step is not None:
            return "collision"
        if self.hazards.boundary_at_step is not None:
            return "boundary"
        if self.hazards.comfort_spike_at_step is not None:
            return "comfort"
        return None


class Measurement(HermesModel):
    """A metric value with explicit evidence availability."""

    availability: EvidenceAvailability
    value: FiniteFloat | None = None
    unit: str | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def require_consistent_availability(self) -> Measurement:
        if self.availability is EvidenceAvailability.AVAILABLE:
            if self.value is None:
                raise ValueError("available measurement requires a value")
            if self.reason is not None:
                raise ValueError("available measurement cannot include an unavailable reason")
        elif not self.reason:
            raise ValueError("NOT_AVAILABLE measurement requires a reason")
        elif self.value is not None:
            raise ValueError("NOT_AVAILABLE measurement cannot include a value")
        return self


class CountMeasurement(HermesModel):
    """A strict non-negative integral count with explicit evidence availability."""

    availability: EvidenceAvailability
    value: Annotated[int, Field(ge=0)] | None = None
    unit: str | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def require_consistent_availability(self) -> CountMeasurement:
        if self.availability is EvidenceAvailability.AVAILABLE:
            if self.value is None:
                raise ValueError("available count measurement requires a value")
            if self.reason is not None:
                raise ValueError(
                    "available count measurement cannot include an unavailable reason"
                )
        elif not self.reason:
            raise ValueError("NOT_AVAILABLE count measurement requires a reason")
        elif self.value is not None:
            raise ValueError("NOT_AVAILABLE count measurement cannot include a value")
        return self


class BooleanMeasurement(HermesModel):
    """A strict boolean result with explicit evidence availability."""

    availability: EvidenceAvailability
    value: bool | None = None
    unit: str | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def require_consistent_availability(self) -> BooleanMeasurement:
        if self.availability is EvidenceAvailability.AVAILABLE:
            if self.value is None:
                raise ValueError("available boolean measurement requires a value")
            if self.reason is not None:
                raise ValueError(
                    "available boolean measurement cannot include an unavailable reason"
                )
        elif not self.reason:
            raise ValueError("NOT_AVAILABLE boolean measurement requires a reason")
        elif self.value is not None:
            raise ValueError("NOT_AVAILABLE boolean measurement cannot include a value")
        return self


class ObservationFaultEvidence(HermesModel):
    """Typed policy-input provenance for an evidence-schema-2 fault run."""

    raw_observation: Observation
    delivered_observation: Observation
    delivered_from_sequence: Annotated[int, Field(ge=0)]
    delivered_from_time_s: NonNegativeFloat
    delivery_time_s: NonNegativeFloat
    applied_faults: tuple[str, ...]
    speed_noise_delta_mps: FiniteFloat
    lateral_noise_delta_m: FiniteFloat


class ControlFaultEvidence(HermesModel):
    """Typed permitted-to-executed command provenance for a fault run."""

    candidate_time_s: NonNegativeFloat
    executed_from_sequence: Annotated[int, Field(ge=0)] | None
    executed_from_candidate_time_s: NonNegativeFloat | None
    execution_time_s: NonNegativeFloat
    pre_saturation_action: Action
    applied_faults: tuple[str, ...]
    control_latency_ms: Measurement
    latency_source: Literal["simulated"]


class Finding(HermesModel):
    """Structured result emitted by an independent verifier."""

    finding_id: Annotated[str, Field(min_length=1, max_length=100)]
    verifier: Annotated[str, Field(min_length=1, max_length=100)]
    verifier_version: Annotated[str, Field(min_length=1, max_length=32)]
    status: FindingStatus
    severity: Severity
    hard_invariant: bool
    threshold_or_invariant: Annotated[str, Field(min_length=1, max_length=500)]
    measurement: Measurement
    message: Annotated[str, Field(min_length=1, max_length=500)]
    event_sequences: tuple[Annotated[int, Field(ge=0)], ...] = ()
    first_failure_time_s: NonNegativeFloat | None = None

    @model_validator(mode="after")
    def require_consistent_finding_evidence(self) -> Finding:
        unavailable = self.measurement.availability is EvidenceAvailability.NOT_AVAILABLE
        if (self.status is FindingStatus.NOT_AVAILABLE) != unavailable:
            raise ValueError(
                "finding status NOT_AVAILABLE must exactly match measurement availability"
            )
        if (
            self.status is FindingStatus.FAIL
            and self.event_sequences
            and self.first_failure_time_s is None
        ):
            raise ValueError("event-backed failure requires first_failure_time_s")
        if self.status is not FindingStatus.FAIL and self.first_failure_time_s is not None:
            raise ValueError("only failed findings may include first_failure_time_s")
        if len(set(self.event_sequences)) != len(self.event_sequences) or tuple(
            sorted(self.event_sequences)
        ) != self.event_sequences:
            raise ValueError("event_sequences must be sorted and unique")
        return self


class GateResult(HermesModel):
    """Deterministic release verdict and its complete rationale."""

    gate_name: str
    gate_version: str
    verdict: Verdict
    rationale: tuple[str, ...]
    supporting_finding_ids: tuple[str, ...]
    hard_failures: tuple[str, ...]
    soft_failures: tuple[str, ...]
    residual_limitations: tuple[str, ...]
    findings: tuple[Finding, ...]


class RunMetrics(HermesModel):
    """Deterministic metrics recomputed exclusively from stored trace events."""

    evidence_schema_version: Literal["1.0"] = "1.0"
    event_count: Annotated[int, Field(ge=1)]
    simulation_duration_s: NonNegativeFloat
    collision_count: Annotated[int, Field(ge=0)]
    max_abs_lateral_offset_m: NonNegativeFloat
    offroad_duration_s: NonNegativeFloat
    route_completion_pct: Measurement
    minimum_ttc_s: Measurement = Field(
        default_factory=lambda: Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            reason="front-object TTC evidence is unavailable for this trace",
            unit="s",
        )
    )
    max_abs_acceleration_mps2: Measurement
    max_abs_jerk_mps3: Measurement
    p95_policy_latency_ms: Measurement
    shield_override_count: Annotated[int, Field(ge=0)]
    shield_override_reasons: dict[str, Annotated[int, Field(ge=0)]]
    termination_reason: TerminationReason


class RunMetricsV2(RunMetrics):
    """Schema-2 metrics with descriptive deterministic fault evidence."""

    evidence_schema_version: Literal["2.0"] = "2.0"
    fault_application_counts: dict[str, Annotated[int, Field(ge=0)]]
    max_observation_age_s: Measurement
    p95_control_latency_ms: Measurement
    control_fill_count: Annotated[int, Field(ge=0)]
    steering_saturation_count: Annotated[int, Field(ge=0)]
    brake_saturation_count: Annotated[int, Field(ge=0)]


_FUNCTION_NOT_IMPLEMENTED = "function not implemented in this phase"
_WINDOW_NOT_REPRESENTED = (
    "required/forbidden evaluation window is not represented in scenario schema 4.0"
)
_CHATTER_NOT_DEFINED = "FCW chatter window/formula is not defined in this phase"
_SENSOR_INVALID_NOT_REPRESENTED = (
    "invalid-sensor evidence is not represented in evidence schema 3.0"
)
_RUNTIME_ERRORS_NOT_RETAINED = (
    "runtime errors abort the run and are not retained in successful bundle evidence"
)


def _require_permanently_unavailable(
    measurement: Measurement | CountMeasurement | BooleanMeasurement,
    *,
    field_name: str,
    reason: str,
) -> None:
    if (
        measurement.availability is not EvidenceAvailability.NOT_AVAILABLE
        or measurement.reason != reason
    ):
        raise ValueError(
            f"{field_name} is permanently NOT_AVAILABLE with reason {reason!r}"
        )


class FcwMetricsV3(HermesModel):
    """Typed per-run forward-collision-warning evidence metrics."""

    warning_count: CountMeasurement
    first_warning_time_s: Measurement
    false_warning_count: CountMeasurement
    missed_warning: BooleanMeasurement
    warning_chatter_count: CountMeasurement

    @model_validator(mode="after")
    def require_owner_deferred_fields(self) -> FcwMetricsV3:
        _require_permanently_unavailable(
            self.missed_warning,
            field_name="adas.fcw.missed_warning",
            reason=_WINDOW_NOT_REPRESENTED,
        )
        _require_permanently_unavailable(
            self.warning_chatter_count,
            field_name="adas.fcw.warning_chatter_count",
            reason=_CHATTER_NOT_DEFINED,
        )
        return self


class AebMetricsV3(HermesModel):
    """Typed per-run automatic-emergency-braking evidence metrics."""

    intervention_count: CountMeasurement
    first_intervention_time_s: Measurement
    max_deceleration_mps2: Measurement
    max_jerk_mps3: Measurement
    false_intervention_count: CountMeasurement
    missed_intervention: BooleanMeasurement
    required_decel_at_onset_mps2: Measurement

    @model_validator(mode="after")
    def require_owner_deferred_fields(self) -> AebMetricsV3:
        _require_permanently_unavailable(
            self.missed_intervention,
            field_name="adas.aeb.missed_intervention",
            reason=_WINDOW_NOT_REPRESENTED,
        )
        return self


class _UnavailableFunctionMetrics(HermesModel):
    """Base enforcing the Phase-4 scope cut for unimplemented ADAS functions."""

    @model_validator(mode="after")
    def require_unimplemented_function_fields(self) -> _UnavailableFunctionMetrics:
        for field_name in type(self).model_fields:
            _require_permanently_unavailable(
                getattr(self, field_name),
                field_name=f"adas.{field_name}",
                reason=_FUNCTION_NOT_IMPLEMENTED,
            )
        return self


class AccMetricsV3(_UnavailableFunctionMetrics):
    """Typed ACC metrics, unavailable until ACC is implemented."""

    headway_target_s: Measurement
    headway_minimum_s: Measurement
    headway_mae_s: Measurement
    speed_error_mae_mps: Measurement
    cut_in_recovery_s: Measurement
    max_acceleration_mps2: Measurement
    max_deceleration_mps2: Measurement
    max_jerk_mps3: Measurement


class LkaMetricsV3(_UnavailableFunctionMetrics):
    """Typed LKA metrics, unavailable until LKA is implemented."""

    lateral_error_mae_m: Measurement
    lateral_error_max_m: Measurement
    lane_crossing_count: CountMeasurement
    steering_oscillation_count: CountMeasurement
    max_lateral_accel_mps2: Measurement
    max_lateral_jerk_mps3: Measurement
    degraded_count: CountMeasurement
    curve_steady_state_error_m: Measurement


class AssistMetricsV3(_UnavailableFunctionMetrics):
    """Typed combined-assist metrics, unavailable until the supervisor exists."""

    mode_transition_count: CountMeasurement
    degraded_count: CountMeasurement
    takeover_request_count: CountMeasurement
    disengagement_count: CountMeasurement
    route_completion_pct: Measurement
    constraint_violation_count: CountMeasurement


class AdasMetricsV3(HermesModel):
    """The complete typed ADAS metric namespace for evidence schema 3.0."""

    fcw: FcwMetricsV3
    aeb: AebMetricsV3
    acc: AccMetricsV3
    lka: LkaMetricsV3
    assist: AssistMetricsV3


class RunMetricsV3(HermesModel):
    """Standalone schema-3 metrics contract with 61 canonical review leaves."""

    evidence_schema_version: Literal["3.0"] = "3.0"
    event_count: Annotated[int, Field(ge=1)]
    simulation_duration_s: NonNegativeFloat
    collision_count: Annotated[int, Field(ge=0)]
    max_abs_lateral_offset_m: NonNegativeFloat
    offroad_duration_s: NonNegativeFloat
    route_completion_pct: Measurement
    minimum_ttc_s: Measurement
    max_abs_acceleration_mps2: Measurement
    max_abs_jerk_mps3: Measurement
    p95_policy_latency_ms: Measurement
    shield_override_count: Annotated[int, Field(ge=0)]
    shield_override_reasons: dict[str, Annotated[int, Field(ge=0)]]
    termination_reason: TerminationReason
    fault_application_counts: dict[str, Annotated[int, Field(ge=0)]]
    max_observation_age_s: Measurement
    p95_control_latency_ms: Measurement
    control_fill_count: Annotated[int, Field(ge=0)]
    steering_saturation_count: Annotated[int, Field(ge=0)]
    brake_saturation_count: Annotated[int, Field(ge=0)]
    collision_occurred: BooleanMeasurement
    ttc_at_warning_s: Measurement
    ttc_at_brake_onset_s: Measurement
    impact_residual_speed_mps: Measurement
    minimum_lead_distance_m: Measurement
    p95_observation_age_s: Measurement
    sensor_invalid_count: CountMeasurement
    runtime_error_count: CountMeasurement
    adas: AdasMetricsV3

    @model_validator(mode="after")
    def require_owner_deferred_system_fields(self) -> RunMetricsV3:
        _require_permanently_unavailable(
            self.sensor_invalid_count,
            field_name="sensor_invalid_count",
            reason=_SENSOR_INVALID_NOT_REPRESENTED,
        )
        _require_permanently_unavailable(
            self.runtime_error_count,
            field_name="runtime_error_count",
            reason=_RUNTIME_ERRORS_NOT_RETAINED,
        )
        return self


class RunContext(HermesModel):
    """Deterministic inputs bound into every trace event."""

    evidence_schema_version: Literal["1.0"] = "1.0"
    scenario_digest: str
    gate_config_digest: str
    adapter_name: str
    adapter_version: str
    adapter_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    policy_name: str
    policy_version: str
    policy_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    shield_name: str
    shield_version: str
    shield_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    verifier_suite_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    seed: Annotated[int, Field(ge=-(2**31), lt=2**31)]
    control_frequency_hz: Annotated[int, Field(ge=1, le=100)]
    horizon_steps: Annotated[int, Field(ge=1, le=10_000)]


class RunContextV2(RunContext):
    """Schema-2 run identity with an independently bound fault component."""

    evidence_schema_version: Literal["2.0"] = "2.0"
    fault_name: str
    fault_version: str
    fault_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


def _require_optional_fault_identity(
    *,
    fault_name: str | None,
    fault_version: str | None,
    fault_config_digest: str | None,
) -> None:
    present = (
        fault_name is not None,
        fault_version is not None,
        fault_config_digest is not None,
    )
    if any(present) and not all(present):
        raise ValueError("fault identity must be all present or all absent")


class RunContextV3(HermesModel):
    """Standalone schema-3 run identity for faulted and no-fault ADAS runs."""

    evidence_schema_version: Literal["3.0"] = "3.0"
    scenario_digest: str
    gate_config_digest: str
    adapter_name: str
    adapter_version: str
    adapter_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    policy_name: str
    policy_version: str
    policy_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    shield_name: str
    shield_version: str
    shield_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    verifier_suite_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    seed: Annotated[int, Field(ge=-(2**31), lt=2**31)]
    control_frequency_hz: Annotated[int, Field(ge=1, le=100)]
    horizon_steps: Annotated[int, Field(ge=1, le=10_000)]
    fault_name: str | None = None
    fault_version: str | None = None
    fault_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")] | None = None

    @model_validator(mode="after")
    def require_complete_fault_identity(self) -> RunContextV3:
        _require_optional_fault_identity(
            fault_name=self.fault_name,
            fault_version=self.fault_version,
            fault_config_digest=self.fault_config_digest,
        )
        return self


class ComponentContext(HermesModel):
    """Resolved deterministic identity and configuration for one runtime component."""

    name: str
    version: str
    config: dict[str, JsonValue]
    config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class VerifierIdentity(HermesModel):
    """One member of the independently rerunnable verifier suite."""

    name: str
    version: str
    finding_id: str


class ExecutionContext(HermesModel):
    """Complete deterministic component context persisted outside the trace."""

    evidence_schema_version: Literal["1.0"] = "1.0"
    run_context: RunContext
    adapter: ComponentContext
    policy: ComponentContext
    shield: ComponentContext
    verifier_suite: tuple[VerifierIdentity, ...]


class ExecutionContextV2(ExecutionContext):
    """Schema-2 execution context for a deterministic fault run."""

    evidence_schema_version: Literal["2.0"] = "2.0"
    run_context: RunContextV2
    faults: ComponentContext


class ExecutionContextV3(HermesModel):
    """Standalone schema-3 component context with optional exact fault identity."""

    evidence_schema_version: Literal["3.0"] = "3.0"
    run_context: RunContextV3
    adapter: ComponentContext
    policy: ComponentContext
    shield: ComponentContext
    verifier_suite: tuple[VerifierIdentity, ...]
    faults: ComponentContext | None = None

    @model_validator(mode="after")
    def require_fault_component_to_match_run_identity(self) -> ExecutionContextV3:
        identity_present = self.run_context.fault_name is not None
        if identity_present != (self.faults is not None):
            raise ValueError("faults component must match run_context fault identity presence")
        if self.faults is not None and (
            self.faults.name != self.run_context.fault_name
            or self.faults.version != self.run_context.fault_version
            or self.faults.config_digest != self.run_context.fault_config_digest
        ):
            raise ValueError("faults component must exactly match run_context fault identity")
        return self


class TraceEvent(HermesModel):
    """One hash-chained deterministic evidence event."""

    evidence_schema_version: Literal["1.0"] = "1.0"
    sequence: Annotated[int, Field(ge=0)]
    simulation_time_s: NonNegativeFloat
    run_context: RunContext
    observation_summary: dict[str, JsonValue]
    candidate_action: Action
    executed_action: Action
    override_reasons: tuple[str, ...]
    vehicle_state: VehicleState
    policy_latency_ms: NonNegativeFloat
    latency_source: Literal["simulated", "measured"]
    terminated: bool
    truncated: bool
    termination_reason: TerminationReason
    raw_facts: VerifierFacts
    previous_hash: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    current_hash: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class TraceEventV2(TraceEvent):
    """Schema-2 event separating policy, shield, fault, and adapter actions."""

    evidence_schema_version: Literal["2.0"] = "2.0"
    run_context: RunContextV2
    permitted_action: Action
    observation_fault_evidence: ObservationFaultEvidence
    control_fault_evidence: ControlFaultEvidence
    result_observation: Observation


class TraceEventV3(HermesModel):
    """Standalone schema-3 event with unified fault and typed ADAS evidence."""

    evidence_schema_version: Literal["3.0"] = "3.0"
    sequence: Annotated[int, Field(ge=0)]
    simulation_time_s: NonNegativeFloat
    run_context: RunContextV3
    observation_summary: dict[str, JsonValue]
    candidate_action: Action
    permitted_action: Action
    executed_action: Action
    override_reasons: tuple[str, ...]
    observation_fault_evidence: ObservationFaultEvidence
    control_fault_evidence: ControlFaultEvidence
    result_observation: Observation
    adas_decision_input_sequence: Annotated[int, Field(ge=0)]
    adas_decision_input_time_s: NonNegativeFloat
    adas_decision: AdasDecision
    candidate_brake_source: BrakeSource
    permitted_brake_source: BrakeSource
    executed_brake_source: BrakeSource
    vehicle_state: VehicleState
    policy_latency_ms: NonNegativeFloat
    latency_source: Literal["simulated", "measured"]
    terminated: bool
    truncated: bool
    termination_reason: TerminationReason
    raw_facts: VerifierFacts
    previous_hash: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    current_hash: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]

    @model_validator(mode="after")
    def require_truthful_no_fault_pass_through(self) -> TraceEventV3:
        if self.run_context.fault_name is not None:
            return self

        observation = self.observation_fault_evidence
        raw = observation.raw_observation
        control = self.control_fault_evidence
        latency = control.control_latency_ms
        if (
            observation.delivered_observation != raw
            or observation.delivered_from_sequence != raw.sequence
            or observation.delivered_from_time_s != raw.simulation_time_s
            or observation.delivery_time_s != raw.simulation_time_s
            or observation.applied_faults
            or observation.speed_noise_delta_mps != 0.0
            or observation.lateral_noise_delta_m != 0.0
            or control.candidate_time_s != raw.simulation_time_s
            or control.executed_from_sequence != self.sequence
            or control.executed_from_candidate_time_s != raw.simulation_time_s
            or control.execution_time_s != raw.simulation_time_s
            or control.pre_saturation_action != self.permitted_action
            or control.applied_faults
            or self.executed_action != self.permitted_action
            or latency.availability is not EvidenceAvailability.AVAILABLE
            or latency.value != 0.0
            or latency.unit != "ms"
        ):
            raise ValueError("no-fault V3 event must contain truthful pass-through evidence")
        return self


class ArtifactManifest(HermesModel):
    """Execution provenance plus a digest inventory for one evidence bundle."""

    evidence_schema_version: Literal["1.0"] = "1.0"
    hermes_version: str
    run_id: str
    created_at_utc: datetime
    repository_commit: str | None
    repository_dirty: bool | None
    repository_provenance_reason: str | None = None
    adapter_name: str
    adapter_version: str
    adapter_config_digest: str
    simulator_name: str | None = None
    simulator_version: str | None = None
    simulator_commit: str | None = None
    scenario_name: str
    scenario_version: str
    scenario_schema_version: str
    scenario_digest: str
    policy_name: str
    policy_version: str
    policy_config_digest: str
    shield_name: str
    shield_version: str
    shield_config_digest: str
    gate_name: str
    gate_version: str
    gate_config_digest: str
    verifier_suite_digest: str
    seed: int
    control_frequency_hz: int
    horizon_steps: int
    python_version: str
    platform: str
    architecture: str
    trace_digest: str
    required_files: tuple[str, ...]
    file_digests: dict[str, str]
    integrity_limitation: str

    @model_validator(mode="after")
    def require_truthful_repository_provenance(self) -> ArtifactManifest:
        if (
            self.created_at_utc.tzinfo is None
            or self.created_at_utc.utcoffset() != timedelta(0)
        ):
            raise ValueError("created_at_utc must be timezone-aware UTC")
        unavailable = self.repository_commit is None or self.repository_dirty is None
        if unavailable and not self.repository_provenance_reason:
            raise ValueError("unavailable repository provenance requires a reason")
        if not unavailable and self.repository_provenance_reason is not None:
            raise ValueError("available repository provenance cannot include a reason")
        return self


class ArtifactManifestV2(ArtifactManifest):
    """Schema-2 manifest surfacing the bound deterministic fault profile."""

    evidence_schema_version: Literal["2.0"] = "2.0"
    fault_name: str
    fault_version: str
    fault_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class ArtifactManifestV3(HermesModel):
    """Standalone schema-3 bundle identity with optional exact fault provenance."""

    evidence_schema_version: Literal["3.0"] = "3.0"
    hermes_version: str
    run_id: str
    created_at_utc: datetime
    repository_commit: str | None
    repository_dirty: bool | None
    repository_provenance_reason: str | None = None
    adapter_name: str
    adapter_version: str
    adapter_config_digest: str
    simulator_name: str | None = None
    simulator_version: str | None = None
    simulator_commit: str | None = None
    scenario_name: str
    scenario_version: str
    scenario_schema_version: str
    scenario_digest: str
    policy_name: str
    policy_version: str
    policy_config_digest: str
    shield_name: str
    shield_version: str
    shield_config_digest: str
    gate_name: str
    gate_version: str
    gate_config_digest: str
    verifier_suite_digest: str
    seed: int
    control_frequency_hz: int
    horizon_steps: int
    python_version: str
    platform: str
    architecture: str
    trace_digest: str
    required_files: tuple[str, ...]
    file_digests: dict[str, str]
    integrity_limitation: str
    fault_name: str | None = None
    fault_version: str | None = None
    fault_config_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")] | None = None

    @model_validator(mode="after")
    def require_truthful_provenance_and_fault_identity(self) -> ArtifactManifestV3:
        if (
            self.created_at_utc.tzinfo is None
            or self.created_at_utc.utcoffset() != timedelta(0)
        ):
            raise ValueError("created_at_utc must be timezone-aware UTC")
        unavailable = self.repository_commit is None or self.repository_dirty is None
        if unavailable and not self.repository_provenance_reason:
            raise ValueError("unavailable repository provenance requires a reason")
        if not unavailable and self.repository_provenance_reason is not None:
            raise ValueError("available repository provenance cannot include a reason")
        _require_optional_fault_identity(
            fault_name=self.fault_name,
            fault_version=self.fault_version,
            fault_config_digest=self.fault_config_digest,
        )
        return self


class FindingsDocument(HermesModel):
    """Complete deterministic structured verifier output."""

    evidence_schema_version: Literal["1.0"] = "1.0"
    findings: tuple[Finding, ...]


class FindingsDocumentV2(FindingsDocument):
    """Schema-2 finding collection for a fault run."""

    evidence_schema_version: Literal["2.0"] = "2.0"


class FindingsDocumentV3(HermesModel):
    """Standalone schema-3 finding collection."""

    evidence_schema_version: Literal["3.0"] = "3.0"
    findings: tuple[Finding, ...]


class ArtifactVerification(HermesModel):
    """Stored-only artifact integrity result, separate from the policy verdict."""

    artifact_path: str
    integrity: IntegrityStatus
    authenticity: AuthenticityStatus = AuthenticityStatus.NOT_AUTHENTICATED
    verdict: Verdict
    errors: tuple[str, ...] = ()
    first_mismatch_sequence: int | None = None
    trace_digest: str | None = None
    rationale: tuple[str, ...] = ()
    supporting_finding_ids: tuple[str, ...] = ()
    residual_limitations: tuple[str, ...] = ()
