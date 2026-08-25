"""The experiment and decision contracts — frozen before the engine, on purpose.

The contract is the product surface: what a team declares before running, and what a decision
meeting reads afterwards. Freezing the seed set alone does not prevent analytical flexibility,
so the spec also fixes the question, the single variation axis, the primary estimand and its
equivalence boundary, and the guardrails — all before any result exists. The decision record
then binds to the spec's digest, the world tape's digest and the resolved seed set, so the
claim a reviewer reads is the claim that was preregistered, not one selected afterwards.
"""

from __future__ import annotations

import hashlib
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Field, model_validator

from hermes.domain.models import FiniteFloat, HermesModel
from hermes.evidence.canonical import canonical_json_bytes

#: Every FleetLab surface carries these labels verbatim (PRD §4.3). They are the honesty
#: boundary: synthetic inputs, no calibration to any real operator, no forecast, no authority.
REQUIRED_LABELS: tuple[str, ...] = (
    "SIMULATION_ONLY",
    "SYNTHETIC_OR_EXPLICITLY_SOURCED_INPUTS",
    "NOT_CALIBRATED_TO_WAYMO_OPERATIONS",
    "NOT_PRODUCTION_FORECAST",
    "NO_DEPLOYMENT_AUTHORITY",
)


class CalibrationState(StrEnum):
    """How far an input's numbers can be trusted (PRD §22.1, one spelling, canonical).

    ``REAL_WORLD_VALIDATED`` deliberately does not exist here: no member can be constructed
    for a claim the project cannot support, the same device as AuthenticityStatus.
    """

    SYNTHETIC_UNCALIBRATED = "SYNTHETIC_UNCALIBRATED"
    ANALYTICALLY_VALIDATED = "ANALYTICALLY_VALIDATED"
    CALIBRATED_TO_LOCAL_SIMULATOR_MEASUREMENT = "CALIBRATED_TO_LOCAL_SIMULATOR_MEASUREMENT"
    CALIBRATED_TO_PUBLIC_DATA = "CALIBRATED_TO_PUBLIC_DATA"


class ExperimentValidity(StrEnum):
    VALID = "VALID"
    INVALID_EXPERIMENT = "INVALID_EXPERIMENT"


class InvalidityReason(StrEnum):
    """Why an experiment's evidence is void — never a statement about the candidate."""

    INVARIANT_VIOLATION = "INVARIANT_VIOLATION"
    REPLICATION_MISMATCH = "REPLICATION_MISMATCH"
    NOT_COMPARABLE = "NOT_COMPARABLE"


class ExperimentOutcome(StrEnum):
    """Resolved from the paired-delta CI against the preregistered equivalence region.

    UNCHANGED is a positive claim and therefore needs the CI to sit *entirely inside* the
    equivalence region; a CI that merely straddles zero is INCONCLUSIVE. MIXED exists for
    multi-regime designs and is unreachable in a single-regime spike — reachable is not the
    same as defined, and defining it now keeps the enum stable when regimes arrive.
    """

    IMPROVED = "IMPROVED"
    REGRESSED = "REGRESSED"
    MIXED = "MIXED"
    UNCHANGED = "UNCHANGED"
    INCONCLUSIVE = "INCONCLUSIVE"


class FleetRecommendation(StrEnum):
    ADVANCE_TO_NEXT_TEST = "ADVANCE_TO_NEXT_TEST"
    HOLD = "HOLD"
    RUN_MORE_EXPERIMENTS = "RUN_MORE_EXPERIMENTS"
    NO_RECOMMENDATION = "NO_RECOMMENDATION"


class PrimaryMetric(HermesModel):
    """The one metric that carries the inferential claim (everything else is DESCRIPTIVE).

    ``equivalence_margin`` is declared in the metric's own unit, before any run. It separates
    UNCHANGED from INCONCLUSIVE — without it, "no significant difference" quietly becomes
    "no difference", which is the oldest lie in experimentation.
    """

    name: Annotated[str, Field(min_length=1, max_length=64)]
    unit: Annotated[str, Field(min_length=1, max_length=16)]
    direction: Literal["lower_is_better", "higher_is_better"]
    equivalence_margin: Annotated[FiniteFloat, Field(gt=0.0)]


class Guardrail(HermesModel):
    """A thresholded pass/fail check on the paired delta — never averaged into anything."""

    metric: Annotated[str, Field(min_length=1, max_length=64)]
    #: Worst tolerated mean paired delta in the harmful direction, in the metric's unit.
    max_harm: Annotated[FiniteFloat, Field(ge=0.0)]
    direction: Literal["lower_is_better", "higher_is_better"]


class FleetScenarioConfig(HermesModel):
    """The world a FLEET-005 spike simulates. Declarative, digest-bound, synthetic."""

    schema_version: Literal["0.1"] = "0.1"
    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    label: Literal["synthetic_fleet_scenario_not_calibrated_to_any_real_operation"] = (
        "synthetic_fleet_scenario_not_calibrated_to_any_real_operation"
    )
    horizon_s: Annotated[int, Field(ge=600, le=86_400)]
    zones: Annotated[tuple[str, ...], Field(min_length=2, max_length=16)]
    #: Zone-to-zone base travel seconds (PRD §11 P0 matrix), flattened as "a->b" keys so the
    #: canonical JSON stays order-stable.
    travel_time_s: dict[str, Annotated[int, Field(ge=30, le=7_200)]]
    vehicle_count: Annotated[int, Field(ge=1, le=500)]
    #: Requests per hour per zone; the demand *trace* derived from this is fixed across every
    #: replication — only disturbances vary by seed.
    demand_per_zone_per_hour: Annotated[int, Field(ge=1, le=120)]
    max_wait_s: Annotated[int, Field(ge=60, le=3_600)]
    #: A vehicle must visit a depot service bay after this many completed trips.
    trips_between_service: Annotated[int, Field(ge=1, le=100)]
    service_bays: Annotated[int, Field(ge=1, le=50)]
    service_duration_s: Annotated[int, Field(ge=60, le=14_400)]
    #: Pickup travel when the vehicle is already in the request's zone. Zone granularity
    #: would otherwise make those pickups instantaneous, which reads as broken (wait p50 = 0).
    in_zone_pickup_s: Annotated[int, Field(ge=30, le=1_800)]
    #: Lognormal sigma of the per-request travel multiplier — the only stochastic input.
    travel_sigma: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]

    @model_validator(mode="after")
    def travel_matrix_is_complete(self) -> FleetScenarioConfig:
        # A missing pair must fail at load, not as a KeyError mid-simulation.
        missing = [
            f"{a}->{b}"
            for a in self.zones
            for b in self.zones
            if a != b and f"{a}->{b}" not in self.travel_time_s
        ]
        if missing:
            raise ValueError(f"travel_time_s is missing zone pairs: {', '.join(missing)}")
        return self


class ExperimentSpec(HermesModel):
    """A preregistered fleet experiment: one question, one axis, one primary claim."""

    schema_version: Literal["0.1"] = "0.1"
    experiment_id: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    #: Who will act on the answer. AUTHOR_SELF_TEST is the only honest value at n=1.
    decision_owner: Annotated[str, Field(min_length=1, max_length=64)]
    question: Annotated[str, Field(min_length=1, max_length=300)]
    scenario: FleetScenarioConfig
    #: Exactly one declared axis. "parameter:<field>" varies one scenario field between
    #: arms; "policy:<name>" (not in the spike) would vary the dispatch policy.
    variation_axis: Annotated[str, Field(pattern=r"^(parameter|policy):[a-z0-9_.]{1,64}$")]
    baseline_value: FiniteFloat
    candidate_value: FiniteFloat
    primary_metric: PrimaryMetric
    guardrails: tuple[Guardrail, ...]
    #: Resolved before any run; the record binds to the digest of this exact tuple.
    seeds: Annotated[tuple[int, ...], Field(min_length=10, max_length=200)]
    bootstrap_resamples: Annotated[int, Field(ge=1_000, le=100_000)] = 2_000
    calibration_state: CalibrationState = CalibrationState.SYNTHETIC_UNCALIBRATED

    def spec_digest(self) -> str:
        return hashlib.sha256(canonical_json_bytes(self.model_dump(mode="json"))).hexdigest()

    def seed_set_digest(self) -> str:
        return hashlib.sha256(
            canonical_json_bytes({"seeds": list(self.seeds)})
        ).hexdigest()


class MetricComparison(HermesModel):
    """One metric's paired result. Only the primary metric carries an inferential claim."""

    metric: Annotated[str, Field(min_length=1, max_length=64)]
    role: Literal["PRIMARY", "GUARDRAIL", "DESCRIPTIVE"]
    baseline_mean: FiniteFloat
    candidate_mean: FiniteFloat
    paired_deltas: tuple[FiniteFloat, ...]
    mean_delta: FiniteFloat
    median_delta: FiniteFloat
    ci_low: FiniteFloat | None = None
    ci_high: FiniteFloat | None = None


class DecisionRecord(HermesModel):
    """The one-page artifact a decision meeting reads. Binds claim to preregistration.

    It is the consumption surface, deliberately not a dashboard: question, digests, the
    primary result with its CI, guardrails, outcome, recommendation, and limitations that
    cannot be scrolled past. It never authorizes anything.
    """

    schema_version: Literal["0.1"] = "0.1"
    experiment_id: str
    decision_owner: str
    question: str
    spec_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    world_tape_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    seed_set_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    replications: Annotated[int, Field(ge=1)]
    variation_axis: str
    baseline_value: FiniteFloat
    candidate_value: FiniteFloat
    validity: ExperimentValidity
    invalidity_reason: InvalidityReason | None = None
    invalidity_detail: Annotated[str, Field(max_length=300)] | None = None
    #: None whenever validity is INVALID_EXPERIMENT — void evidence yields no outcome,
    #: not a partial one.
    outcome: ExperimentOutcome | None
    recommendation: FleetRecommendation
    primary: MetricComparison | None
    guardrail_results: tuple[MetricComparison, ...]
    guardrail_regressions: tuple[str, ...]
    descriptives: tuple[MetricComparison, ...]
    calibration_state: CalibrationState
    labels: tuple[str, ...] = REQUIRED_LABELS
    deployment_permission: Literal["NONE"] = "NONE"
    limitations: tuple[str, ...]

    def record_digest(self) -> str:
        """Content identity of the record itself, for replay comparison."""
        return hashlib.sha256(canonical_json_bytes(self.model_dump(mode="json"))).hexdigest()
