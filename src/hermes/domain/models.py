"""Strict simulator-neutral data models for Hermes."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from hermes.domain.enums import (
    AuthenticityStatus,
    EvidenceAvailability,
    FindingStatus,
    IntegrityStatus,
    Severity,
    TerminationReason,
    Verdict,
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
    ] | None = None


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


ChallengeConfig = Annotated[
    LeadVehicleHardBrakeChallenge | CutInNearFieldChallenge,
    Field(discriminator="kind"),
]


class ScenarioDefinition(HermesModel):
    """Versioned, resolved, simulator-neutral scenario definition."""

    schema_version: Literal["1.0", "2.0"]
    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    version: Annotated[str, Field(min_length=1, max_length=32)]
    description: Annotated[str, Field(min_length=1, max_length=500)]
    adapter: Literal["fake", "metadrive"]
    control: ControlConfig
    initial_state: InitialState
    road: RoadConfig
    hazards: HazardConfig = Field(default_factory=HazardConfig)
    challenge: ChallengeConfig | None = None

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

        if self.schema_version == "1.0":
            if self.challenge is not None:
                raise ValueError("schema_version 1.0 cannot define challenge")
            return self

        if self.adapter != "metadrive":
            raise ValueError("schema_version 2.0 requires adapter metadrive")
        if self.challenge is None:
            raise ValueError("schema_version 2.0 requires challenge")
        if self.hazards != HazardConfig():
            raise ValueError(
                "schema_version 2.0 challenge cannot coexist with fake hazards"
            )

        end_step: int
        window_name: str
        if isinstance(self.challenge, LeadVehicleHardBrakeChallenge):
            end_step = self.challenge.trigger_step + self.challenge.brake_duration_steps
            window_name = "lead-vehicle braking window"
        else:
            end_step = self.challenge.trigger_step + self.challenge.transition_steps
            window_name = "cut-in transition window"
        if end_step > self.control.horizon_steps:
            raise ValueError(
                f"{window_name} must fit within horizon_steps "
                f"({self.control.horizon_steps})"
            )
        return self

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


class FindingsDocument(HermesModel):
    """Complete deterministic structured verifier output."""

    evidence_schema_version: Literal["1.0"] = "1.0"
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
