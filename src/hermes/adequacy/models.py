"""Strict, immutable, framework-independent Phase 7 adequacy contracts."""

from __future__ import annotations

import json
import math
from enum import StrEnum
from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _AdequacyModel(BaseModel):
    """Common frozen contract settings; no process, review, or evidence dependencies."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)


NonEmptyString = Annotated[str, Field(min_length=1)]
Identifier = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_\-]*$")]
Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
GitCommit = Annotated[str, Field(pattern=r"^[0-9a-f]{40}$")]
FiniteFloat = Annotated[float, Field(allow_inf_nan=False)]
NonNegativeInt = Annotated[int, Field(ge=0)]
PositiveInt = Annotated[int, Field(gt=0)]
RelativeLocator = Annotated[str, Field(min_length=1)]
JsonScalar: TypeAlias = str | bool | int | float | None

LOCAL_HISTORY_LIMITATION = "Rewritable local history; no external timestamp."


def _require_lexical_relative_locator(value: str, field_name: str) -> None:
    if (
        value == "."
        or value.startswith("/")
        or value.endswith("/")
        or "//" in value
        or "\\" in value
        or "\x00" in value
        or any(part in {"", ".", ".."} for part in value.split("/"))
    ):
        raise ValueError(f"{field_name} must be an exact lexical relative path")


class AdequacyStatus(StrEnum):
    ADEQUATE = "ADEQUATE"
    INADEQUATE = "INADEQUATE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class CriterionStatus(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class RegistrationStatus(StrEnum):
    LOCAL_HISTORY_ORDERING_VERIFIED = "LOCAL_HISTORY_ORDERING_VERIFIED"
    REGISTRATION_NOT_ESTABLISHED = "REGISTRATION_NOT_ESTABLISHED"


class Interpretation(StrEnum):
    DECLARED_QUESTION_ONLY = "DECLARED_QUESTION_ONLY"
    DESCRIPTIVE_ONLY = "DESCRIPTIVE_ONLY"
    NO_INTERPRETATION = "NO_INTERPRETATION"


class ObservationDisposition(StrEnum):
    CONDITION_NOT_OBSERVED = "CONDITION_NOT_OBSERVED"
    CONDITION_MET_NO_RECORDED_INTERVENTION = "CONDITION_MET_NO_RECORDED_INTERVENTION"
    TARGET_REASON_WITHOUT_MATERIAL_ACTION = "TARGET_REASON_WITHOUT_MATERIAL_ACTION"
    TARGET_INTERVENTION_RECORDED = "TARGET_INTERVENTION_RECORDED"
    TARGET_INTERVENTION_CONFOUNDED = "TARGET_INTERVENTION_CONFOUNDED"
    EVIDENCE_NOT_AVAILABLE = "EVIDENCE_NOT_AVAILABLE"


PlanEvaluation = Literal["EVALUATED", "PLAN_NOT_EVALUATED"]
Integrity = Literal["INTERNALLY_CONSISTENT", "INVALID_EVIDENCE"]
Compatibility = Literal["COMPATIBLE", "INCOMPATIBLE", "NOT_EVALUATED"]
Role = Literal["BASELINE", "CANDIDATE"]
ChallengePhase = Literal["PRE_TRIGGER", "BRAKING", "RECOVERY", "CUT_IN", "POST_CUT_IN"]


class CriterionDefinition(_AdequacyModel):
    required_phase: Literal["BRAKING"]
    minimum_phase_samples_per_arm: PositiveInt
    policy_input_ttc_lte_s: Annotated[FiniteFloat, Field(gt=0.0, le=30.0)]
    candidate_required_override_reason: Literal["TTC_BELOW_THRESHOLD"]
    minimum_target_override_events: PositiveInt
    prohibit_non_target_reasons_through_first_target_response: Literal[True]
    minimum_post_response_decision_steps: NonNegativeInt
    actuation_delay_compensation_s: Literal[0.0]


class StudyProtocol(_AdequacyModel):
    """The frozen-before-discovery declared-question protocol."""

    schema_version: Literal["1.0"]
    protocol_id: Identifier
    protocol_version: Literal["1.0"]
    scope: Literal["SIMULATION_ONLY"]
    claim_type: Literal["LEAD_TTC_INTERVENTION_ENGAGEMENT"]
    criteria: CriterionDefinition
    baseline_grid: tuple[tuple[Identifier, tuple[FiniteFloat, ...]], ...]
    selection_rule: NonEmptyString

    @model_validator(mode="after")
    def require_nonempty_unique_grid(self) -> StudyProtocol:
        names = tuple(name for name, values in self.baseline_grid)
        if not names or len(names) != len(set(names)):
            raise ValueError("baseline_grid must contain unique dimensions")
        if any(not values for _name, values in self.baseline_grid):
            raise ValueError("baseline_grid dimensions must contain at least one value")
        return self


class DiscoveryLedgerEntry(_AdequacyModel):
    """One ordered baseline-only discovery record."""

    schema_version: Literal["1.0"]
    attempt_id: Identifier
    protocol_byte_digest_sha256: Sha256
    protocol_semantic_digest_sha256: Sha256
    registration_commit: GitCommit
    run_id: Identifier
    scenario_digest_sha256: Sha256
    bundle_digest_sha256: Sha256
    trace_digest_sha256: Sha256
    parameters: tuple[tuple[Identifier, JsonScalar], ...]
    selection_evidence_sha256: Sha256
    selected: bool

    @model_validator(mode="after")
    def require_unique_parameters(self) -> DiscoveryLedgerEntry:
        names = tuple(name for name, _value in self.parameters)
        if len(names) != len(set(names)):
            raise ValueError("parameters must not repeat a name")
        return self


class PairPlan(_AdequacyModel):
    """The frozen-before-primary-run pair declaration."""

    schema_version: Literal["1.0"]
    pair_plan_id: Identifier
    protocol_byte_digest_sha256: Sha256
    protocol_semantic_digest_sha256: Sha256
    discovery_ledger_byte_digest_sha256: Sha256
    discovery_ledger_semantic_digest_sha256: Sha256
    baseline_run_id: Identifier
    candidate_run_id: Identifier
    selected_discovery_attempt_id: Identifier
    selected_discovery_selection_evidence_sha256: Sha256
    scenario_digest_sha256: Sha256
    implementation_base_commit: GitCommit

    @model_validator(mode="after")
    def require_distinct_primary_run_ids(self) -> PairPlan:
        if self.baseline_run_id == self.candidate_run_id:
            raise ValueError("baseline and candidate run IDs must differ")
        return self


class CapturedSourceIdentity(_AdequacyModel):
    """Portable identity for bytes captured under an explicit plan root."""

    relative_path: RelativeLocator
    byte_digest_sha256: Sha256
    semantic_digest_sha256: Sha256
    size_bytes: NonNegativeInt

    @model_validator(mode="after")
    def require_relative_path(self) -> CapturedSourceIdentity:
        _require_lexical_relative_locator(self.relative_path, "relative_path")
        return self


class AssessmentEvent(_AdequacyModel):
    """The minimal verified event facts consumed by the pure scanner."""

    sequence: NonNegativeInt
    challenge_phase: ChallengePhase | None
    front_distance_m: Annotated[FiniteFloat | None, Field(ge=0.0)]
    front_relative_speed_mps: FiniteFloat | None
    speed_mps: Annotated[FiniteFloat, Field(ge=0.0)]
    lateral_offset_m: FiniteFloat
    observation_age_s: Annotated[FiniteFloat, Field(ge=0.0)]
    candidate_action: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    executed_action: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    override_reasons: tuple[NonEmptyString, ...]

    @model_validator(mode="after")
    def require_action_ranges(self) -> AssessmentEvent:
        steering, throttle, brake = self.candidate_action
        executed_steering, executed_throttle, executed_brake = self.executed_action
        values = (steering, executed_steering)
        if any(value < -1.0 or value > 1.0 for value in values):
            raise ValueError("steering must be between -1.0 and 1.0")
        longitudinal = (throttle, brake, executed_throttle, executed_brake)
        if any(value < 0.0 or value > 1.0 for value in longitudinal):
            raise ValueError("throttle and brake must be between 0.0 and 1.0")
        return self


class AssessmentSide(_AdequacyModel):
    """Verified immutable side facts reduced before entering the adequacy core."""

    relative_locator: RelativeLocator
    run_id: Identifier
    role: Role
    evidence_schema_version: Literal["1.0"]
    bundle_digest_sha256: Sha256
    trace_digest_sha256: Sha256
    repository_commit: GitCommit
    repository_dirty: bool
    scenario_digest_sha256: Sha256
    policy_name: NonEmptyString
    policy_version: NonEmptyString
    policy_config_digest_sha256: Sha256
    adapter_name: NonEmptyString
    adapter_version: NonEmptyString
    adapter_config_digest_sha256: Sha256
    simulator_name: NonEmptyString
    simulator_version: NonEmptyString
    simulator_commit: GitCommit
    shield_name: NonEmptyString
    shield_version: NonEmptyString
    shield_config_digest_sha256: Sha256
    gate_name: NonEmptyString
    gate_version: NonEmptyString
    gate_config_digest_sha256: Sha256
    seed: int
    control_frequency_hz: PositiveInt
    horizon_steps: PositiveInt
    events: tuple[AssessmentEvent, ...]

    @model_validator(mode="after")
    def require_monotonic_event_sequences(self) -> AssessmentSide:
        _require_lexical_relative_locator(self.relative_locator, "relative_locator")
        sequences = tuple(event.sequence for event in self.events)
        if sequences != tuple(sorted(sequences)) or len(sequences) != len(set(sequences)):
            raise ValueError("events must have strictly increasing sequences")
        return self


class RegistrationEvidence(_AdequacyModel):
    """Local-history ordering evidence, expressly not origin authentication."""

    status: RegistrationStatus
    authenticity: Literal["NOT_AUTHENTICATED"]
    limitation: Literal[LOCAL_HISTORY_LIMITATION]
    protocol_commit: GitCommit | None
    pair_plan_commit: GitCommit | None

    @model_validator(mode="after")
    def require_commit_pair_for_verified_ordering(self) -> RegistrationEvidence:
        has_commits = self.protocol_commit is not None and self.pair_plan_commit is not None
        if self.status is RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED and not has_commits:
            raise ValueError("verified local ordering requires protocol and pair-plan commits")
        return self


class AdequacyCriterion(_AdequacyModel):
    """One non-compensatory criterion with exact values and bounded references."""

    criterion_id: Identifier
    status: CriterionStatus
    definition: NonEmptyString
    threshold_machine_value: JsonScalar
    threshold_display_value: NonEmptyString
    threshold_unit: str | None
    observation_machine_value: JsonScalar
    observation_display_value: NonEmptyString
    observation_unit: str | None
    rationale: NonEmptyString
    baseline_sequences: tuple[NonNegativeInt, ...]
    candidate_sequences: tuple[NonNegativeInt, ...]
    source_references: tuple[NonEmptyString, ...]
    unavailable_reason: str | None

    @model_validator(mode="after")
    def require_unavailability_reason_only_when_unavailable(self) -> AdequacyCriterion:
        if self.status is CriterionStatus.NOT_AVAILABLE and not self.unavailable_reason:
            raise ValueError("NOT_AVAILABLE criteria require an unavailable_reason")
        if self.status is not CriterionStatus.NOT_AVAILABLE and self.unavailable_reason is not None:
            raise ValueError("available criteria cannot carry unavailable_reason")
        return self


class AdequacyAssessment(_AdequacyModel):
    status: AdequacyStatus
    observation_disposition: ObservationDisposition
    criteria: tuple[AdequacyCriterion, ...]

    @model_validator(mode="after")
    def require_status_to_match_criteria(self) -> AdequacyAssessment:
        if self.status is not aggregate_adequacy_status(
            tuple(criterion.status for criterion in self.criteria)
        ):
            raise ValueError("assessment status must match ordered criterion aggregation")
        return self


class EvaluationAdequacyEnvelope(_AdequacyModel):
    """Portable Phase 7 decision envelope with independent trust dimensions."""

    schema_version: Literal["1.0"]
    hermes_version: NonEmptyString
    baseline: AssessmentSide
    candidate: AssessmentSide
    integrity: Integrity
    compatibility: Compatibility
    plan_evaluation: PlanEvaluation
    protocol_source: CapturedSourceIdentity | None
    discovery_ledger_source: CapturedSourceIdentity | None
    pair_plan_source: CapturedSourceIdentity | None
    assessment: AdequacyAssessment | None
    registration: RegistrationEvidence | None
    interpretation: Interpretation
    limitations: tuple[NonEmptyString, ...]

    @model_validator(mode="after")
    def require_consistent_decision_planes(self) -> EvaluationAdequacyEnvelope:
        quarantined = self.integrity == "INVALID_EVIDENCE" or self.compatibility != "COMPATIBLE"
        sources = (self.protocol_source, self.discovery_ledger_source, self.pair_plan_source)
        if quarantined:
            if (
                self.plan_evaluation != "PLAN_NOT_EVALUATED"
                or any(source is not None for source in sources)
                or self.assessment is not None
                or self.registration is not None
                or self.interpretation is not Interpretation.NO_INTERPRETATION
            ):
                raise ValueError("invalid or incompatible evidence cannot expose plan assessment")
            return self
        if self.plan_evaluation == "EVALUATED" and any(source is None for source in sources):
            raise ValueError("evaluated plans require all captured source identities")
        if self.assessment is None:
            if self.interpretation is not Interpretation.NO_INTERPRETATION:
                raise ValueError("missing assessment requires NO_INTERPRETATION")
            return self
        if self.registration is None:
            raise ValueError("completed assessment requires registration evidence")
        expected = interpretation_for(self.assessment.status, self.registration.status)
        if self.interpretation is not expected:
            raise ValueError("interpretation must match assessment and registration")
        return self


def aggregate_adequacy_status(statuses: tuple[CriterionStatus, ...]) -> AdequacyStatus:
    """Apply the frozen non-compensatory criterion precedence."""

    if not statuses:
        raise ValueError("an adequacy assessment requires at least one criterion")
    if CriterionStatus.FAIL in statuses:
        return AdequacyStatus.INADEQUATE
    if CriterionStatus.NOT_AVAILABLE in statuses:
        return AdequacyStatus.NOT_AVAILABLE
    return AdequacyStatus.ADEQUATE


def interpretation_for(
    assessment: AdequacyStatus | None,
    registration: RegistrationStatus,
) -> Interpretation:
    """Return the independent interpretation boundary for a criteria result."""

    if assessment is None:
        return Interpretation.NO_INTERPRETATION
    if (
        assessment is AdequacyStatus.ADEQUATE
        and registration is RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED
    ):
        return Interpretation.DECLARED_QUESTION_ONLY
    return Interpretation.DESCRIPTIVE_ONLY


def _normalize_json(value: object) -> object:
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("canonical adequacy JSON numbers must be finite")
        return 0.0 if value == 0.0 else value
    if isinstance(value, dict):
        normalized: dict[str, object] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("canonical adequacy JSON object keys must be strings")
            normalized[key] = _normalize_json(item)
        return normalized
    if isinstance(value, (tuple, list)):
        return [_normalize_json(item) for item in value]
    if value is None or isinstance(value, (str, int, bool)):
        return value
    raise ValueError(f"unsupported canonical adequacy JSON value: {type(value).__name__}")


def canonical_adequacy_json_bytes(envelope: EvaluationAdequacyEnvelope) -> bytes:
    """Serialize an adequacy envelope deterministically without altering review serializers."""

    payload = _normalize_json(envelope.model_dump(mode="json"))
    return json.dumps(
        payload,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
