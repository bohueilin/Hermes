"""Strict, immutable portable contracts for Phase 6 evidence review."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import PurePosixPath
from types import MappingProxyType
from typing import Annotated, Literal, TypeAlias

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

from hermes.evidence.canonical import canonical_json_bytes

REVIEW_SCHEMA_VERSION = "1.0"

NonEmptyString = Annotated[str, Field(min_length=1)]
Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
FiniteFloat = Annotated[float, Field(allow_inf_nan=False)]
NonNegativeFloat = Annotated[FiniteFloat, Field(ge=0.0)]
NonNegativeInt = Annotated[int, Field(ge=0)]
Scalar: TypeAlias = str | bool | int | float | None

EvidenceCategory = Literal[
    "OBSERVED",
    "COMPUTED",
    "GATE_DECISION",
    "ASSUMPTION",
    "NOT_AVAILABLE",
    "AUTHENTICITY",
    "RESIDUAL_RISK",
]
ArtifactFileName = Literal[
    "manifest.json",
    "execution-context.json",
    "scenario.resolved.yaml",
    "gate-config.resolved.yaml",
    "events.jsonl",
    "metrics.json",
    "findings.json",
    "verdict.json",
    "trace.sha256",
    "bundle.sha256",
]
Availability = Literal["AVAILABLE", "NOT_AVAILABLE", "NOT_APPLICABLE"]
Requiredness = Literal["REQUIRED", "OPTIONAL", "NOT_APPLICABLE"]
Verdict = Literal["PASS", "CONDITIONAL", "HOLD", "INVALID_EVIDENCE"]
Integrity = Literal["UNVERIFIED", "INTERNALLY_CONSISTENT", "INVALID_EVIDENCE"]
ComparisonStatus = Literal["IMPROVED", "REGRESSED", "UNCHANGED", "NOT_COMPARABLE"]
SourceType = Literal[
    "MANIFEST",
    "EXECUTION_CONTEXT",
    "SCENARIO",
    "GATE_CONFIG",
    "EVENT",
    "METRIC",
    "FINDING",
    "VERDICT",
    "TRACE_DIGEST",
    "BUNDLE_DIGEST",
]
ComparisonSide = Literal["BASELINE", "CANDIDATE"]
DesiredDirection = Literal["HIGHER", "LOWER", "TARGET", "DESCRIPTIVE", "NONE"]

ARTIFACT_FILES: tuple[str, ...] = (
    "manifest.json",
    "execution-context.json",
    "scenario.resolved.yaml",
    "gate-config.resolved.yaml",
    "events.jsonl",
    "metrics.json",
    "findings.json",
    "verdict.json",
    "trace.sha256",
    "bundle.sha256",
)
FILE_ORDER = {name: index for index, name in enumerate(ARTIFACT_FILES)}
SOURCE_FILES = dict(
    zip(
        (
            "MANIFEST",
            "EXECUTION_CONTEXT",
            "SCENARIO",
            "GATE_CONFIG",
            "EVENT",
            "METRIC",
            "FINDING",
            "VERDICT",
            "TRACE_DIGEST",
            "BUNDLE_DIGEST",
        ),
        ARTIFACT_FILES,
        strict=True,
    )
)
FINDING_ORDER = (
    "trace.integrity",
    "collision.zero",
    "boundary.within_tolerance",
    "progress.required",
    "comfort.acceleration",
    "comfort.jerk",
    "fault.coverage.required",
)
METRIC_ORDER = (
    "event_count",
    "simulation_duration_s",
    "collision_count",
    "max_abs_lateral_offset_m",
    "offroad_duration_s",
    "route_completion_pct",
    "minimum_ttc_s",
    "max_abs_acceleration_mps2",
    "max_abs_jerk_mps3",
    "p95_policy_latency_ms",
    "shield_override_count",
    "shield_override_reasons",
    "termination_reason",
    "fault_application_counts",
    "max_observation_age_s",
    "p95_control_latency_ms",
    "control_fill_count",
    "steering_saturation_count",
    "brake_saturation_count",
)
METRIC_REGISTRY: dict[str, tuple[str | None, str, str]] = {
    "event_count": ("events", "DESCRIPTIVE", "SCALAR"),
    "simulation_duration_s": ("s", "DESCRIPTIVE", "SCALAR"),
    "collision_count": ("collisions", "LOWER", "SCALAR"),
    "max_abs_lateral_offset_m": ("m", "LOWER", "SCALAR"),
    "offroad_duration_s": ("s", "LOWER", "SCALAR"),
    "route_completion_pct": ("%", "HIGHER", "SCALAR"),
    "minimum_ttc_s": ("s", "HIGHER", "SCALAR"),
    "max_abs_acceleration_mps2": ("m/s^2", "LOWER", "SCALAR"),
    "max_abs_jerk_mps3": ("m/s^3", "LOWER", "SCALAR"),
    "p95_policy_latency_ms": ("ms", "LOWER", "SCALAR"),
    "shield_override_count": ("overrides", "DESCRIPTIVE", "SCALAR"),
    "shield_override_reasons": ("occurrences", "DESCRIPTIVE", "STRING_COUNT_MAP"),
    "termination_reason": (None, "DESCRIPTIVE", "SCALAR"),
    "fault_application_counts": ("occurrences", "DESCRIPTIVE", "STRING_COUNT_MAP"),
    "max_observation_age_s": ("s", "LOWER", "SCALAR"),
    "p95_control_latency_ms": ("ms", "LOWER", "SCALAR"),
    "control_fill_count": ("events", "DESCRIPTIVE", "SCALAR"),
    "steering_saturation_count": ("events", "LOWER", "SCALAR"),
    "brake_saturation_count": ("events", "LOWER", "SCALAR"),
}
MEASUREMENT_METRICS = {
    "route_completion_pct",
    "minimum_ttc_s",
    "max_abs_acceleration_mps2",
    "max_abs_jerk_mps3",
    "p95_policy_latency_ms",
    "max_observation_age_s",
    "p95_control_latency_ms",
}
TRACK_ORDER = (
    "raw_observation",
    "delivered_observation",
    "result_observation",
    "candidate_action",
    "permitted_action",
    "executed_action",
    "override_reasons",
    "observation_fault_reasons",
    "control_fault_reasons",
    "collision_count",
    "offroad",
    "speed_mps",
    "route_progress_pct",
    "ttc_s",
    "policy_latency_ms",
    "verifier_triggering_findings",
)
TRACK_REGISTRY: dict[str, tuple[str, str]] = {
    "raw_observation": ("OBSERVATION", "OBSERVED"),
    "delivered_observation": ("OBSERVATION", "OBSERVED"),
    "result_observation": ("OBSERVATION", "OBSERVED"),
    "candidate_action": ("ACTION", "OBSERVED"),
    "permitted_action": ("ACTION", "OBSERVED"),
    "executed_action": ("ACTION", "OBSERVED"),
    "override_reasons": ("STRING_LIST", "OBSERVED"),
    "observation_fault_reasons": ("STRING_LIST", "OBSERVED"),
    "control_fault_reasons": ("STRING_LIST", "OBSERVED"),
    "collision_count": ("SCALAR", "OBSERVED"),
    "offroad": ("SCALAR", "OBSERVED"),
    "speed_mps": ("SCALAR", "OBSERVED"),
    "route_progress_pct": ("SCALAR", "OBSERVED"),
    "ttc_s": ("SCALAR", "COMPUTED"),
    "policy_latency_ms": ("SCALAR", "OBSERVED"),
    "verifier_triggering_findings": ("STRING_LIST", "COMPUTED"),
}
TRACK_POINT_POINTERS: dict[str, frozenset[str]] = {
    "raw_observation": frozenset({"/observation_fault_evidence/raw_observation"}),
    "delivered_observation": frozenset({"/observation_fault_evidence/delivered_observation"}),
    "result_observation": frozenset({"/result_observation"}),
    "candidate_action": frozenset({"/candidate_action"}),
    "permitted_action": frozenset({"/permitted_action"}),
    "executed_action": frozenset({"/executed_action"}),
    "override_reasons": frozenset({"/override_reasons"}),
    "observation_fault_reasons": frozenset({"/observation_fault_evidence/applied_faults"}),
    "control_fault_reasons": frozenset({"/control_fault_evidence/applied_faults"}),
    "collision_count": frozenset({"/vehicle_state/collision_count"}),
    "offroad": frozenset({"/vehicle_state/offroad"}),
    "speed_mps": frozenset({"/vehicle_state/speed_mps"}),
    "route_progress_pct": frozenset(
        {"/vehicle_state/route_progress_pct", "/raw_facts/route_progress_available"}
    ),
    "ttc_s": frozenset({"", "/observation_summary"}),
    "policy_latency_ms": frozenset({"/policy_latency_ms"}),
    "verifier_triggering_findings": frozenset({""}),
}
LEGACY_UNAVAILABLE_TRACKS = {
    "raw_observation",
    "delivered_observation",
    "result_observation",
    "permitted_action",
    "observation_fault_reasons",
    "control_fault_reasons",
}
PARTITION_DIMENSION_ORDER = (
    "collision_count",
    "minimum_ttc_s",
    "route_completion_pct",
    "max_abs_acceleration_mps2",
    "max_abs_jerk_mps3",
    "p95_policy_latency_ms",
    "policy_latency_source",
    "shield_interventions",
)
AVAILABILITY_ORDER = (
    "minimum_ttc_s",
    "route_completion_pct",
    "max_abs_acceleration_mps2",
    "max_abs_jerk_mps3",
    "p95_policy_latency_ms",
)


class ReviewUnavailableReason(StrEnum):
    """Operational reasons a verified shape cannot be projected."""

    UNSUPPORTED_REVIEW_SHAPE = "UNSUPPORTED_REVIEW_SHAPE"


class ReviewUnavailableError(Exception):
    """Typed non-portable failure for an unsupported review projection shape."""

    def __init__(self, reason: ReviewUnavailableReason, message: str) -> None:
        if not isinstance(reason, ReviewUnavailableReason):
            raise TypeError("reason must be ReviewUnavailableReason")
        if not isinstance(message, str) or not message:
            raise ValueError("message must be a non-empty string")
        self.reason = reason
        self.message = message
        super().__init__(message)


def _validate_relative_path(value: str) -> str:
    if not value or "\\" in value or "\x00" in value:
        raise ValueError("selected_relative_path must be a non-empty POSIX relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or value.endswith("/") or "//" in value:
        raise ValueError("selected_relative_path must be lexical and relative")
    if any(part in {"", ".", ".."} for part in path.parts) or str(path) != value:
        raise ValueError("selected_relative_path must be lexical and relative")
    return value


@dataclass(frozen=True, slots=True)
class ReviewCacheKey:
    """Exact locator-bound portable cache tuple."""

    computed_bundle_digest_sha256: Sha256
    review_schema_version: Literal["1.0"]
    hermes_version: NonEmptyString
    selected_relative_path: NonEmptyString

    def __post_init__(self) -> None:
        if (
            not isinstance(self.computed_bundle_digest_sha256, str)
            or len(self.computed_bundle_digest_sha256) != 64
            or any(
                character not in "0123456789abcdef"
                for character in self.computed_bundle_digest_sha256
            )
        ):
            raise ValueError("computed_bundle_digest_sha256 must be lowercase SHA-256")
        if self.review_schema_version != REVIEW_SCHEMA_VERSION:
            raise ValueError("unsupported review schema version")
        if not isinstance(self.hermes_version, str) or not self.hermes_version:
            raise ValueError("hermes_version must be a non-empty string")
        _validate_relative_path(self.selected_relative_path)

    def as_tuple(self) -> tuple[str, str, str, str]:
        return (
            self.computed_bundle_digest_sha256,
            self.review_schema_version,
            self.hermes_version,
            self.selected_relative_path,
        )


def _reference_key(reference: SourceReference) -> tuple[int, int, str]:
    return (
        FILE_ORDER[reference.file_name],
        -1 if reference.event_sequence is None else reference.event_sequence,
        "" if reference.json_pointer is None else reference.json_pointer,
    )


def _validate_references(references: tuple[SourceReference, ...]) -> None:
    if len(set(references)) != len(references):
        raise ValueError("source references must be unique")
    if tuple(sorted(references, key=_reference_key)) != references:
        raise ValueError("source references must use canonical order")


def _side_reference_key(reference: SideReference) -> tuple[int, int, str, int]:
    return (
        *_reference_key(reference.reference),
        0 if reference.side == "BASELINE" else 1,
    )


def _validate_side_references(references: tuple[SideReference, ...]) -> None:
    if len(set(references)) != len(references):
        raise ValueError("side references must be unique")
    if tuple(sorted(references, key=_side_reference_key)) != references:
        raise ValueError("side references must use canonical order")


class ReviewModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_reference_fields(self) -> ReviewModel:
        for field_name in (
            "source_references",
            "configuration_sources",
            "evidence_sources",
            "configuration_references",
        ):
            references = getattr(self, field_name, None)
            if references is None or self.__class__.__name__ == "MetricItem":
                continue
            if references and isinstance(references[0], SideReference):
                _validate_side_references(references)
            else:
                _validate_references(references)
        return self


class ToolInfo(ReviewModel):
    hermes_distribution: Literal["hermes-autonomy"]
    hermes_version: NonEmptyString
    review_schema_version: Literal["1.0"]
    category: Literal["COMPUTED"]


class SourceFileObservation(ReviewModel):
    file_name: ArtifactFileName
    size_bytes: NonNegativeInt
    category: Literal["OBSERVED"]


class CategorizedDigest(ReviewModel):
    algorithm: Literal["SHA-256"]
    value: Sha256
    category: Literal["COMPUTED"]


class SourceInventoryItem(ReviewModel):
    file: SourceFileObservation
    observed_sha256: CategorizedDigest


class LocatorInfo(ReviewModel):
    selected_relative_path: NonEmptyString
    selected_directory_name: NonEmptyString
    category: Literal["OBSERVED"]

    @field_validator("selected_relative_path")
    @classmethod
    def lexical_relative_path(cls, value: str) -> str:
        return _validate_relative_path(value)

    @model_validator(mode="after")
    def directory_matches_path(self) -> LocatorInfo:
        if PurePosixPath(self.selected_relative_path).name != self.selected_directory_name:
            raise ValueError("selected_directory_name must be the selected path basename")
        return self


class ManifestIdentityInfo(ReviewModel):
    run_id: NonEmptyString | None
    created_at_utc: NonEmptyString | None
    evidence_schema_version: NonEmptyString | None
    scenario_schema_version: NonEmptyString | None
    category: Literal["OBSERVED"]


class DigestInfo(ReviewModel):
    algorithm: Literal["SHA-256"]
    value: Sha256
    semantic: Literal["OBSERVED_CLAIM", "COMPUTED_FROM_CAPTURE", "COMPUTED_FROM_EVENTS"]
    category: Literal["OBSERVED", "COMPUTED"]

    @model_validator(mode="after")
    def category_matches_semantic(self) -> DigestInfo:
        expected = "OBSERVED" if self.semantic == "OBSERVED_CLAIM" else "COMPUTED"
        if self.category != expected:
            raise ValueError("digest category must match its semantic")
        return self


class PortableArtifactIdentity(ReviewModel):
    locator: LocatorInfo
    manifest_identity: ManifestIdentityInfo
    observed_bundle_digest: DigestInfo | None
    computed_bundle_digest: DigestInfo | None
    observed_trace_digest: DigestInfo | None
    computed_trace_digest: DigestInfo | None
    source_inventory: Annotated[tuple[SourceInventoryItem, ...], Field(max_length=10)]

    @model_validator(mode="after")
    def validate_inventory_and_digest_roles(self) -> PortableArtifactIdentity:
        names = tuple(item.file.file_name for item in self.source_inventory)
        expected = tuple(name for name in ARTIFACT_FILES if name in names)
        if len(set(names)) != len(names) or names != expected:
            raise ValueError("source inventory must be unique and in canonical order")
        roles = (
            (self.observed_bundle_digest, "OBSERVED_CLAIM"),
            (self.computed_bundle_digest, "COMPUTED_FROM_CAPTURE"),
            (self.observed_trace_digest, "OBSERVED_CLAIM"),
            (self.computed_trace_digest, "COMPUTED_FROM_EVENTS"),
        )
        if any(digest is not None and digest.semantic != semantic for digest, semantic in roles):
            raise ValueError("artifact digest has an incorrect semantic role")
        if self.computed_bundle_digest is not None and not set(ARTIFACT_FILES[:-1]).issubset(names):
            raise ValueError("computed bundle digest requires every bundle input")
        identity_values = tuple(
            getattr(self.manifest_identity, name)
            for name in (
                "run_id",
                "created_at_utc",
                "evidence_schema_version",
                "scenario_schema_version",
            )
        )
        if any(value is None for value in identity_values) and any(
            value is not None for value in identity_values
        ):
            raise ValueError("manifest identity is retained all-four-or-none")
        return self


class SourceReference(ReviewModel):
    source_type: SourceType
    file_name: ArtifactFileName
    json_pointer: str | None
    event_sequence: NonNegativeInt | None

    @model_validator(mode="after")
    def validate_source_relation(self) -> SourceReference:
        if SOURCE_FILES[self.source_type] != self.file_name:
            raise ValueError("source type and file name do not match")
        if (self.source_type == "EVENT") != (self.event_sequence is not None):
            raise ValueError("only EVENT references carry an event sequence")
        if (
            self.json_pointer is not None
            and self.json_pointer != ""
            and not self.json_pointer.startswith("/")
        ):
            raise ValueError("json_pointer must be an RFC 6901 pointer")
        if self.json_pointer is not None:
            for index, character in enumerate(self.json_pointer):
                if character == "~" and (
                    index + 1 == len(self.json_pointer) or self.json_pointer[index + 1] not in "01"
                ):
                    raise ValueError("json_pointer contains an invalid escape")
        return self


class SideReference(ReviewModel):
    side: ComparisonSide
    reference: SourceReference


class ExactValue(ReviewModel):
    machine_value: Scalar
    canonical_text: str | None
    display_text: str
    unit: str | None


class ActionValue(ReviewModel):
    steering: Annotated[FiniteFloat, Field(ge=-1.0, le=1.0)]
    throttle: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    brake: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]


class DiagnosticItem(ReviewModel):
    id: NonEmptyString
    code: NonEmptyString
    text: NonEmptyString
    impact: NonEmptyString
    category: EvidenceCategory
    source_references: tuple[SourceReference, ...]


class LimitationItem(ReviewModel):
    id: NonEmptyString
    text: NonEmptyString
    impact: NonEmptyString
    category: Literal["RESIDUAL_RISK", "AUTHENTICITY", "NOT_AVAILABLE"]
    source_references: tuple[SourceReference, ...]


class AssumptionItem(ReviewModel):
    id: NonEmptyString
    text: NonEmptyString
    impact: NonEmptyString
    category: Literal["ASSUMPTION"]
    source_references: tuple[SourceReference, ...]


class ThresholdClause(ReviewModel):
    left_operand: NonEmptyString
    transforms: Annotated[
        tuple[
            Literal[
                "IDENTITY",
                "ABSOLUTE_VALUE",
                "ALL_EVENTS",
                "MAX_OVER_EVENTS",
                "DURATION_TRUE",
                "FINITE_DIFFERENCE",
                "FINAL_EVENT",
            ],
            ...,
        ],
        Field(min_length=1),
    ]
    operator: Literal["EQ", "NE", "LT", "LTE", "GT", "GTE", "IS_TRUE", "IS_FALSE"]
    right_operand: ExactValue | None
    configuration_sources: tuple[SourceReference, ...]
    evidence_sources: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def validate_operand_arity(self) -> ThresholdClause:
        unary = self.operator in {"IS_TRUE", "IS_FALSE"}
        if unary != (self.right_operand is None):
            raise ValueError("right operand is null exactly for unary operators")
        return self


class InvariantRule(ReviewModel):
    operator: Literal["COMPLETE", "ALL_OBSERVED"]
    configuration_sources: tuple[SourceReference, ...]
    evidence_sources: tuple[SourceReference, ...]


class ClauseExpression(ReviewModel):
    kind: Literal["CLAUSE"]
    label: str
    clause: ThresholdClause
    children: tuple[ThresholdExpression, ...]
    invariant: None

    @field_validator("children")
    @classmethod
    def children_are_empty(
        cls, value: tuple[ThresholdExpression, ...]
    ) -> tuple[ThresholdExpression, ...]:
        if value:
            raise ValueError("clause expression children must be empty")
        return value


class GroupExpression(ReviewModel):
    kind: Literal["ALL_OF", "ANY_OF"]
    label: str
    clause: None
    children: Annotated[tuple[ThresholdExpression, ...], Field(min_length=1)]
    invariant: None

    @model_validator(mode="after")
    def validate_portable_depth(self) -> GroupExpression:
        def depth(expression: ThresholdExpression) -> int:
            if isinstance(expression, GroupExpression):
                return 1 + max(depth(child) for child in expression.children)
            return 1

        if depth(self) > 16:
            raise ReviewUnavailableError(
                ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
                "review threshold nesting depth exceeded",
            )
        return self


class InvariantExpression(ReviewModel):
    kind: Literal["INVARIANT"]
    label: str
    clause: None
    children: tuple[ThresholdExpression, ...]
    invariant: InvariantRule

    @field_validator("children")
    @classmethod
    def children_are_empty(
        cls, value: tuple[ThresholdExpression, ...]
    ) -> tuple[ThresholdExpression, ...]:
        if value:
            raise ValueError("invariant expression children must be empty")
        return value


ThresholdExpression = Annotated[
    ClauseExpression | GroupExpression | InvariantExpression,
    Field(discriminator="kind"),
]


class VerificationInfo(ReviewModel):
    integrity: Literal["INTERNALLY_CONSISTENT", "INVALID_EVIDENCE"]
    verified_by: NonEmptyString
    errors: tuple[DiagnosticItem, ...]
    first_mismatch_sequence: NonNegativeInt | None
    stored_claims_quarantined: bool
    category: Literal["COMPUTED"]

    @model_validator(mode="after")
    def validate_integrity_state(self) -> VerificationInfo:
        if self.integrity == "INTERNALLY_CONSISTENT":
            if (
                self.errors
                or self.first_mismatch_sequence is not None
                or self.stored_claims_quarantined
            ):
                raise ValueError("consistent evidence cannot carry verification failure state")
        elif not self.errors:
            raise ValueError("invalid evidence requires a diagnostic")
        return self


class TrustRecord(ReviewModel):
    dimension: Literal[
        "authenticity",
        "authorization",
        "deployment_permission",
        "scope",
        "authoritative_status",
    ]
    value: Literal["NOT_AUTHENTICATED", "NOT_EVALUATED", "NONE", "SIMULATION_ONLY", "NOT_DEFINED"]
    category: Literal["AUTHENTICITY", "ASSUMPTION", "RESIDUAL_RISK"]
    explanation: NonEmptyString

    @model_validator(mode="after")
    def validate_dimension_record(self) -> TrustRecord:
        expected = {
            "authenticity": ("NOT_AUTHENTICATED", "AUTHENTICITY"),
            "authorization": ("NOT_EVALUATED", "ASSUMPTION"),
            "deployment_permission": ("NONE", "RESIDUAL_RISK"),
            "scope": ("SIMULATION_ONLY", "ASSUMPTION"),
            "authoritative_status": ("NOT_DEFINED", "ASSUMPTION"),
        }[self.dimension]
        if (self.value, self.category) != expected:
            raise ValueError("trust record does not match the frozen dimension contract")
        return self


class TrustInfo(ReviewModel):
    records: tuple[TrustRecord, ...]

    @model_validator(mode="after")
    def validate_frozen_records(self) -> TrustInfo:
        if tuple(record.dimension for record in self.records) != (
            "authenticity",
            "authorization",
            "deployment_permission",
            "scope",
            "authoritative_status",
        ):
            raise ValueError("trust records must occur exactly once in frozen order")
        return self


class GateConsequence(ReviewModel):
    triggered: bool
    effect: Literal[
        "NO_EFFECT",
        "INVALID_EVIDENCE",
        "HOLD",
        "CONDITIONAL",
        "CONFIGURED_MISSING_REQUIRED_EVIDENCE",
    ]
    result_if_controlling: Verdict | None
    source: Literal[
        "FIXED_GATE_PRECEDENCE",
        "GATE_CONFIG_MISSING_REQUIRED_EVIDENCE",
        "PROFILE_NOT_APPLICABLE",
    ]
    listed_in_hard_failures: bool
    listed_in_soft_failures: bool
    listed_in_supporting_findings: bool
    configuration_references: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def validate_effect(self) -> GateConsequence:
        if (self.effect == "NO_EFFECT") != (self.result_if_controlling is None):
            raise ValueError("only NO_EFFECT has no controlling verdict")
        if self.effect == "NO_EFFECT" and self.triggered:
            raise ValueError("NO_EFFECT cannot be triggered")
        if self.effect != "NO_EFFECT" and not self.triggered:
            raise ValueError("a non-NO_EFFECT consequence must be triggered")
        expected_results = {
            "NO_EFFECT": {None},
            "INVALID_EVIDENCE": {"INVALID_EVIDENCE"},
            "HOLD": {"HOLD"},
            "CONDITIONAL": {"CONDITIONAL"},
            "CONFIGURED_MISSING_REQUIRED_EVIDENCE": {"HOLD", "INVALID_EVIDENCE"},
        }
        if self.result_if_controlling not in expected_results[self.effect]:
            raise ValueError("controlling verdict must match the gate effect")
        if (
            self.effect == "CONFIGURED_MISSING_REQUIRED_EVIDENCE"
            and self.source != "GATE_CONFIG_MISSING_REQUIRED_EVIDENCE"
        ):
            raise ValueError("configured missing evidence must identify its gate-config source")
        return self


class GateInfo(ReviewModel):
    verdict: Verdict
    category: Literal["GATE_DECISION"]
    accepted_recomputation: bool
    gate_name: NonEmptyString | None
    gate_version: NonEmptyString | None
    gate_config_digest_sha256: Sha256 | None
    rationale: tuple[NonEmptyString, ...]
    hard_failure_ids: tuple[NonEmptyString, ...]
    soft_failure_ids: tuple[NonEmptyString, ...]
    supporting_finding_ids: tuple[NonEmptyString, ...]
    residual_limitation_ids: tuple[NonEmptyString, ...]

    @model_validator(mode="after")
    def unique_ids(self) -> GateInfo:
        for values in (
            self.hard_failure_ids,
            self.soft_failure_ids,
            self.supporting_finding_ids,
            self.residual_limitation_ids,
        ):
            if len(set(values)) != len(values):
                raise ValueError("gate ID arrays must be unique")
        return self


class SufficiencySummary(ReviewModel):
    required_and_available: NonNegativeInt
    required_but_unavailable: NonNegativeInt
    optional_and_available: NonNegativeInt
    optional_and_unavailable: NonNegativeInt
    not_applicable: NonNegativeInt


class SufficiencyItem(ReviewModel):
    evidence_id: NonEmptyString
    label: NonEmptyString
    requirement: Requiredness
    availability: Availability
    reason: str | None
    consequence: GateConsequence
    category: Literal["OBSERVED", "COMPUTED", "NOT_AVAILABLE"]
    source_references: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def validate_availability(self) -> SufficiencyItem:
        if (self.requirement == "NOT_APPLICABLE") != (self.availability == "NOT_APPLICABLE"):
            raise ValueError("NOT_APPLICABLE requirement and availability must match")
        if self.availability in {"NOT_AVAILABLE", "NOT_APPLICABLE"}:
            if not self.reason or self.category != "NOT_AVAILABLE":
                raise ValueError("unavailable evidence requires a reason and category")
        elif self.reason is not None or self.category == "NOT_AVAILABLE":
            raise ValueError(
                "available/applicable evidence cannot carry an unavailable reason/category"
            )
        return self


class EvidenceSufficiency(ReviewModel):
    profile_name: NonEmptyString | None
    profile_version: NonEmptyString | None
    summary: SufficiencySummary
    items: tuple[SufficiencyItem, ...]
    category: Literal["COMPUTED"]

    @model_validator(mode="after")
    def validate_summary(self) -> EvidenceSufficiency:
        if (self.profile_name is None) != (self.profile_version is None):
            raise ValueError("profile name and version availability must match")
        if len({item.evidence_id for item in self.items}) != len(self.items):
            raise ValueError("sufficiency item IDs must be unique")
        if self.profile_name is None:
            if self.items:
                raise ValueError("unselected profile cannot carry sufficiency items")
        else:
            if (
                self.profile_name not in {"legacy", "fault_coverage"}
                or self.profile_version != "1.0"
            ):
                raise ValueError("unsupported evidence requirement profile")
            if tuple(item.evidence_id for item in self.items) != FINDING_ORDER:
                raise ValueError("sufficiency items must match frozen profile order")
            expected_requiredness = (
                "REQUIRED",
                "REQUIRED",
                "REQUIRED",
                "REQUIRED",
                "OPTIONAL",
                "OPTIONAL",
                "NOT_APPLICABLE" if self.profile_name == "legacy" else "REQUIRED",
            )
            if tuple(item.requirement for item in self.items) != expected_requiredness:
                raise ValueError("sufficiency requiredness must match the selected profile")
        counts = {
            "required_and_available": 0,
            "required_but_unavailable": 0,
            "optional_and_available": 0,
            "optional_and_unavailable": 0,
            "not_applicable": 0,
        }
        for item in self.items:
            if item.requirement == "NOT_APPLICABLE":
                counts["not_applicable"] += 1
            elif item.requirement == "REQUIRED" and item.availability == "AVAILABLE":
                counts["required_and_available"] += 1
            elif item.requirement == "REQUIRED":
                counts["required_but_unavailable"] += 1
            elif item.availability == "AVAILABLE":
                counts["optional_and_available"] += 1
            else:
                counts["optional_and_unavailable"] += 1
        if self.summary.model_dump() != counts:
            raise ValueError("sufficiency summary must exactly count its items")
        return self


class UnavailableEvidenceItem(ReviewModel):
    evidence_id: NonEmptyString
    label: NonEmptyString
    reason: NonEmptyString
    requiredness: Requiredness
    consequence: GateConsequence
    category: Literal["NOT_AVAILABLE"]
    source_references: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def unavailable_is_applicable(self) -> UnavailableEvidenceItem:
        if self.requiredness == "NOT_APPLICABLE":
            raise ValueError("not-applicable evidence is not unavailable evidence")
        return self


class FindingItem(ReviewModel):
    finding_id: NonEmptyString
    verifier_name: NonEmptyString
    verifier_version: NonEmptyString
    label: NonEmptyString
    explanation: NonEmptyString
    category: Literal["COMPUTED", "NOT_AVAILABLE"]
    status: Literal["PASS", "FAIL", "NOT_AVAILABLE"]
    severity: Literal["INFO", "WARNING", "ERROR", "CRITICAL"]
    hard_invariant: bool
    measured: ExactValue
    threshold: ThresholdExpression
    threshold_source_text: NonEmptyString
    first_failure_simulation_time_s: NonNegativeFloat | None
    supporting_event_sequences: tuple[NonNegativeInt, ...]
    evidence_availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    requiredness: Requiredness
    consequence: GateConsequence
    source_references: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def validate_finding(self) -> FindingItem:
        if tuple(sorted(set(self.supporting_event_sequences))) != self.supporting_event_sequences:
            raise ValueError("supporting event sequences must be increasing and unique")
        unavailable = self.evidence_availability == "NOT_AVAILABLE"
        if unavailable != (self.status == "NOT_AVAILABLE") or unavailable != (
            self.category == "NOT_AVAILABLE"
        ):
            raise ValueError("finding unavailability fields must agree")
        if unavailable:
            if self.measured.machine_value is not None:
                raise ValueError("unavailable finding cannot carry a measured value")
        elif self.measured.machine_value is None:
            raise ValueError("available finding requires a measured value")
        if self.status != "FAIL" and self.first_failure_simulation_time_s is not None:
            raise ValueError("only failed findings carry first failure time")
        if (
            self.status == "FAIL"
            and self.supporting_event_sequences
            and self.first_failure_simulation_time_s is None
        ):
            raise ValueError("event-backed failure requires first failure time")
        self._validate_threshold_registry()
        self._validate_consequence_registry()
        return self

    def _validate_threshold_registry(self) -> None:
        expression = self.threshold
        expected_simple = {
            "collision.zero": (
                "Maximum collision count",
                "collision_count",
                ("MAX_OVER_EVENTS",),
                "LTE",
                "count",
                0,
                (("GATE_CONFIG", "/hard/max_collision_count"),),
                (("EVENT", "/vehicle_state/collision_count"),),
            ),
            "comfort.acceleration": (
                "Maximum absolute acceleration",
                "acceleration_mps2",
                ("ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
                "LTE",
                "m/s^2",
                None,
                (("GATE_CONFIG", "/soft/max_abs_acceleration_mps2"),),
                (("EVENT", "/vehicle_state/acceleration_mps2"),),
            ),
            "comfort.jerk": (
                "Maximum absolute jerk",
                "acceleration_mps2",
                ("FINITE_DIFFERENCE", "ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
                "LTE",
                "m/s^3",
                None,
                (("GATE_CONFIG", "/soft/max_abs_jerk_mps3"),),
                (
                    ("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
                    ("EVENT", "/vehicle_state/acceleration_mps2"),
                ),
            ),
        }
        if self.finding_id == "trace.integrity":
            valid = (
                isinstance(expression, InvariantExpression)
                and expression.label == "Complete trace sequence and digest chain"
                and expression.invariant.operator == "COMPLETE"
                and self._references_match(
                    expression.invariant.configuration_sources,
                    (("SCENARIO", "/control/horizon_steps"),),
                )
                and self._references_match(
                    expression.invariant.evidence_sources,
                    (("EVENT", ""), ("TRACE_DIGEST", "")),
                )
            )
        elif self.finding_id == "fault.coverage.required":
            valid = (
                isinstance(expression, InvariantExpression)
                and expression.label == "All configured faults are observed"
                and expression.invariant.operator == "ALL_OBSERVED"
                and self._references_match(
                    expression.invariant.configuration_sources,
                    (("SCENARIO", "/faults"),),
                )
                and self._references_match(
                    expression.invariant.evidence_sources,
                    (
                        ("EVENT", "/observation_fault_evidence/applied_faults"),
                        ("EVENT", "/control_fault_evidence/applied_faults"),
                    ),
                )
            )
        elif self.finding_id in expected_simple:
            valid = isinstance(expression, ClauseExpression) and self._clause_matches(
                expression, expected_simple[self.finding_id]
            )
        elif self.finding_id == "boundary.within_tolerance":
            clauses = expression.children if isinstance(expression, GroupExpression) else ()
            valid = (
                isinstance(expression, GroupExpression)
                and expression.kind == "ALL_OF"
                and expression.label == "Boundary and off-road limits"
                and len(clauses) == 3
                and all(isinstance(child, ClauseExpression) for child in clauses)
                and all(
                    self._clause_matches(child, spec)
                    for child, spec in zip(
                        clauses,
                        (
                            (
                                "Maximum absolute lateral offset",
                                "lateral_offset_m",
                                ("ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
                                "LTE",
                                "m",
                                None,
                                (
                                    ("SCENARIO", "/road/boundary_tolerance_m"),
                                    ("GATE_CONFIG", "/hard/max_abs_lateral_offset_m"),
                                ),
                                (("EVENT", "/vehicle_state/lateral_offset_m"),),
                            ),
                            (
                                "No event is off-road",
                                "offroad",
                                ("ALL_EVENTS",),
                                "IS_FALSE",
                                None,
                                None,
                                (),
                                (("EVENT", "/vehicle_state/offroad"),),
                            ),
                            (
                                "Maximum off-road duration",
                                "offroad",
                                ("DURATION_TRUE",),
                                "LTE",
                                "s",
                                0.0,
                                (("GATE_CONFIG", "/hard/max_offroad_duration_s"),),
                                (
                                    ("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
                                    ("EVENT", "/vehicle_state/offroad"),
                                ),
                            ),
                        ),
                        strict=True,
                    )
                )
            )
        elif self.finding_id == "progress.required":
            clauses = expression.children if isinstance(expression, GroupExpression) else ()
            valid = (
                isinstance(expression, GroupExpression)
                and expression.kind == "ALL_OF"
                and expression.label == "Destination and route progress requirements"
                and len(clauses) == 2
                and all(isinstance(child, ClauseExpression) for child in clauses)
                and all(
                    self._clause_matches(child, spec)
                    for child, spec in zip(
                        clauses,
                        (
                            (
                                "Destination reached at final event",
                                "destination_reached",
                                ("FINAL_EVENT",),
                                "IS_TRUE",
                                None,
                                None,
                                (),
                                (("EVENT", "/vehicle_state/destination_reached"),),
                            ),
                            (
                                "Minimum route completion",
                                "route_completion_pct",
                                ("MAX_OVER_EVENTS",),
                                "GTE",
                                "%",
                                None,
                                (("GATE_CONFIG", "/hard/min_route_completion_pct"),),
                                (
                                    ("EVENT", "/raw_facts/route_progress_available"),
                                    ("EVENT", "/vehicle_state/route_progress_pct"),
                                    ("METRIC", "/route_completion_pct"),
                                ),
                            ),
                        ),
                        strict=True,
                    )
                )
            )
        else:
            valid = False
        if not valid:
            raise ValueError("finding threshold does not match the frozen registry")

    @staticmethod
    def _references_match(
        references: tuple[SourceReference, ...],
        allowed: tuple[tuple[str, str], ...],
    ) -> bool:
        allowed_set = set(allowed)
        present_non_event = {
            (reference.source_type, reference.json_pointer)
            for reference in references
            if reference.source_type != "EVENT"
        }
        required_non_event = {item for item in allowed_set if item[0] != "EVENT"}
        return present_non_event == required_non_event and all(
            (reference.source_type, reference.json_pointer) in allowed_set
            for reference in references
        )

    @classmethod
    def _clause_matches(
        cls,
        expression: ClauseExpression,
        spec: tuple[
            str,
            str,
            tuple[str, ...],
            str,
            str | None,
            int | float | None,
            tuple[tuple[str, str], ...],
            tuple[tuple[str, str], ...],
        ],
    ) -> bool:
        label, left, transforms, operator, unit, fixed_value, config, evidence = spec
        clause = expression.clause
        if (
            expression.label != label
            or clause.left_operand != left
            or clause.transforms != transforms
            or clause.operator != operator
            or not cls._references_match(clause.configuration_sources, config)
            or not cls._references_match(clause.evidence_sources, evidence)
        ):
            return False
        if operator in {"IS_TRUE", "IS_FALSE"}:
            return clause.right_operand is None
        right = clause.right_operand
        if right is None or right.unit != unit or isinstance(right.machine_value, bool):
            return False
        if not isinstance(right.machine_value, (int, float)):
            return False
        return fixed_value is None or right.machine_value == fixed_value

    def _validate_consequence_registry(self) -> None:
        consequence = self.consequence
        if self.status == "PASS":
            valid = (
                consequence.effect == "NO_EFFECT"
                and not consequence.triggered
                and consequence.source == "FIXED_GATE_PRECEDENCE"
                and not consequence.configuration_references
            )
        elif self.finding_id == "trace.integrity":
            valid = (
                consequence.effect == "INVALID_EVIDENCE"
                and consequence.result_if_controlling == "INVALID_EVIDENCE"
                and consequence.source == "FIXED_GATE_PRECEDENCE"
                and not consequence.configuration_references
            )
        elif self.finding_id in {"collision.zero", "boundary.within_tolerance"}:
            expected = "HOLD" if self.status == "FAIL" else "INVALID_EVIDENCE"
            valid = (
                consequence.effect == expected
                and consequence.result_if_controlling == expected
                and consequence.source == "FIXED_GATE_PRECEDENCE"
                and not consequence.configuration_references
            )
        elif self.finding_id == "progress.required":
            if self.status == "FAIL":
                valid = (
                    consequence.effect == "HOLD"
                    and consequence.result_if_controlling == "HOLD"
                    and consequence.source == "FIXED_GATE_PRECEDENCE"
                    and not consequence.configuration_references
                )
            else:
                valid = (
                    consequence.effect == "CONFIGURED_MISSING_REQUIRED_EVIDENCE"
                    and consequence.result_if_controlling in {"HOLD", "INVALID_EVIDENCE"}
                    and consequence.source == "GATE_CONFIG_MISSING_REQUIRED_EVIDENCE"
                    and self._references_match(
                        consequence.configuration_references,
                        (("GATE_CONFIG", "/hard/missing_required_evidence"),),
                    )
                )
        elif self.finding_id in {"comfort.acceleration", "comfort.jerk"}:
            valid = (
                consequence.effect == "CONDITIONAL"
                and consequence.result_if_controlling == "CONDITIONAL"
                and consequence.source == "FIXED_GATE_PRECEDENCE"
                and not consequence.configuration_references
            )
        elif self.finding_id == "fault.coverage.required":
            valid = (
                consequence.effect == "HOLD"
                and consequence.result_if_controlling == "HOLD"
                and consequence.source == "FIXED_GATE_PRECEDENCE"
                and not consequence.configuration_references
            )
        else:
            valid = False
        if not valid:
            raise ValueError("finding consequence does not match the frozen registry")


class ScalarMetricValue(ReviewModel):
    kind: Literal["SCALAR"]
    value: ExactValue


class StringCountMapMetricValue(ReviewModel):
    kind: Literal["STRING_COUNT_MAP"]
    values: Mapping[NonEmptyString, NonNegativeInt]

    @field_validator("values")
    @classmethod
    def sorted_keys(cls, value: Mapping[str, int]) -> Mapping[str, int]:
        if tuple(value) != tuple(sorted(value)):
            raise ValueError("map keys must use Unicode code-point order")
        return MappingProxyType(dict(value))

    @field_serializer("values")
    def serialize_values(self, value: Mapping[str, int]) -> dict[str, int]:
        return dict(value)


MetricValue = Annotated[ScalarMetricValue | StringCountMapMetricValue, Field(discriminator="kind")]


class MetricItem(ReviewModel):
    metric_id: NonEmptyString
    label: NonEmptyString
    category: Literal["COMPUTED", "NOT_AVAILABLE"]
    value: MetricValue
    availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    unavailable_reason: str | None
    desired_direction: DesiredDirection
    source_references: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def validate_metric(self) -> MetricItem:
        if self.metric_id not in METRIC_REGISTRY:
            raise ValueError("unsupported metric ID")
        unit, direction, kind = METRIC_REGISTRY[self.metric_id]
        if self.desired_direction != direction or self.value.kind != kind:
            raise ValueError("metric metadata must match the frozen registry")
        if isinstance(self.value, ScalarMetricValue) and self.value.value.unit != unit:
            raise ValueError("scalar metric unit must match the frozen registry")
        if not self.source_references:
            raise ValueError("metric requires its exact metrics source")
        first, *tail = self.source_references
        if first.source_type != "METRIC" or first.json_pointer != f"/{self.metric_id}":
            raise ValueError("metric references must begin with its metrics pointer")
        _validate_references(tuple(tail))
        if len(set(self.source_references)) != len(self.source_references):
            raise ValueError("metric source references must be unique")
        allowed_types = {"EVENT", "EXECUTION_CONTEXT", "METRIC"}
        if any(reference.source_type not in allowed_types for reference in tail):
            raise ValueError("metric tail reference has no frozen transform role")
        context_required = self.metric_id in {"offroad_duration_s", "max_abs_jerk_mps3"}
        context_reference = (
            "EXECUTION_CONTEXT",
            "/run_context/control_frequency_hz",
        )
        has_context = any(
            (reference.source_type, reference.json_pointer) == context_reference
            for reference in tail
        )
        if context_required != has_context:
            raise ValueError("metric control-frequency reference does not match its transform")
        unavailable = self.availability == "NOT_AVAILABLE"
        if unavailable:
            if self.metric_id not in MEASUREMENT_METRICS:
                raise ValueError("non-measurement metrics are always available")
            if self.category != "NOT_AVAILABLE" or not self.unavailable_reason:
                raise ValueError("unavailable metric requires category and reason")
            if not isinstance(self.value, ScalarMetricValue):
                raise ValueError("unavailable measurements use scalar values")
            exact = self.value.value
            if (
                exact.machine_value is not None
                or exact.canonical_text is not None
                or exact.display_text != "NOT_AVAILABLE"
            ):
                raise ValueError("unavailable metric must carry the exact null value shape")
        elif self.category != "COMPUTED" or self.unavailable_reason is not None:
            raise ValueError("available metric must be computed without an unavailable reason")
        elif isinstance(self.value, ScalarMetricValue):
            machine_value = self.value.value.machine_value
            integer_metrics = {
                "event_count",
                "collision_count",
                "shield_override_count",
                "control_fill_count",
                "steering_saturation_count",
                "brake_saturation_count",
            }
            if self.metric_id == "termination_reason":
                valid_value = isinstance(machine_value, str) and bool(machine_value)
            elif self.metric_id in integer_metrics:
                valid_value = isinstance(machine_value, int) and not isinstance(machine_value, bool)
                valid_value = valid_value and machine_value >= 0
            else:
                valid_value = isinstance(machine_value, (int, float)) and not isinstance(
                    machine_value, bool
                )
            if not valid_value:
                raise ValueError("available scalar metric requires its registry machine-value type")
        return self


class ObservationValue(ReviewModel):
    sequence: NonNegativeInt
    simulation_time_s: NonNegativeFloat
    position_m: FiniteFloat
    speed_mps: NonNegativeFloat
    acceleration_mps2: FiniteFloat
    lateral_offset_m: FiniteFloat
    route_progress_pct: Annotated[FiniteFloat, Field(ge=0.0, le=100.0)]
    collision_count: NonNegativeInt
    offroad: bool
    destination_reached: bool
    front_distance_m: NonNegativeFloat | None
    front_relative_speed_mps: FiniteFloat | None
    observation_age_s: NonNegativeFloat
    challenge_actor_longitudinal_m: FiniteFloat | None
    challenge_actor_lateral_offset_m: FiniteFloat | None
    challenge_actor_speed_mps: NonNegativeFloat | None
    challenge_phase: Literal["PRE_TRIGGER", "BRAKING", "RECOVERY", "CUT_IN", "POST_CUT_IN"] | None


class StringListValue(ReviewModel):
    values: tuple[str, ...]

    @field_validator("values")
    @classmethod
    def unique_values(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(set(value)) != len(value):
            raise ValueError("string-list values must be unique")
        return value


class Point(ReviewModel):
    sequence: NonNegativeInt
    simulation_time_s: NonNegativeFloat
    category: Literal["OBSERVED", "COMPUTED", "NOT_AVAILABLE"]
    availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    unavailable_reason: str | None
    scalar_value: ExactValue | None
    action_value: ActionValue | None
    observation_value: ObservationValue | None
    string_list_value: StringListValue | None
    source_reference: SourceReference

    @model_validator(mode="after")
    def exactly_one_typed_value(self) -> Point:
        values = (
            self.scalar_value,
            self.action_value,
            self.observation_value,
            self.string_list_value,
        )
        if sum(item is not None for item in values) != 1:
            raise ValueError("point must contain exactly one typed value")
        if self.availability == "NOT_AVAILABLE":
            if self.category != "NOT_AVAILABLE" or not self.unavailable_reason:
                raise ValueError("unavailable point requires category and reason")
            if (
                self.scalar_value is None
                or self.scalar_value.machine_value is not None
                or self.scalar_value.unit is None
            ):
                raise ValueError("only null scalar points may be individually unavailable")
            if (
                self.scalar_value.canonical_text is not None
                or self.scalar_value.display_text != "NOT_AVAILABLE"
            ):
                raise ValueError("unavailable scalar point requires the exact null display shape")
        elif self.category == "NOT_AVAILABLE" or self.unavailable_reason is not None:
            raise ValueError("available point cannot carry unavailability state")
        elif self.scalar_value is not None and self.scalar_value.machine_value is None:
            raise ValueError("available scalar point requires a machine value")
        if self.source_reference.source_type == "EVENT":
            if self.source_reference.event_sequence != self.sequence:
                raise ValueError("timeline point must reference its exact event sequence")
        elif not (
            self.source_reference.source_type == "FINDING"
            and self.source_reference.json_pointer == ""
        ):
            raise ValueError("timeline point source must be its event or the finding root")
        return self


class Track(ReviewModel):
    track_id: NonEmptyString
    label: NonEmptyString
    category: Literal["OBSERVED", "COMPUTED", "NOT_AVAILABLE"]
    availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    unavailable_reason: str | None
    value_kind: Literal["SCALAR", "ACTION", "OBSERVATION", "STRING_LIST"]
    points: tuple[Point, ...]
    source_references: tuple[SourceReference, ...]

    @model_validator(mode="after")
    def validate_track(self) -> Track:
        if self.track_id not in TRACK_REGISTRY:
            raise ValueError("unsupported track ID")
        kind, category = TRACK_REGISTRY[self.track_id]
        if self.value_kind != kind:
            raise ValueError("track value kind must match the frozen registry")
        sequences = tuple(point.sequence for point in self.points)
        if sequences != tuple(sorted(set(sequences))):
            raise ValueError("track points must be ordered by sequence")
        if self.availability == "NOT_AVAILABLE":
            if self.category != "NOT_AVAILABLE" or not self.unavailable_reason or self.points:
                raise ValueError("unavailable track requires reason and no points")
        else:
            if self.category != category or self.unavailable_reason is not None:
                raise ValueError("available track category must match the registry")
            field_for_kind = {
                "SCALAR": "scalar_value",
                "ACTION": "action_value",
                "OBSERVATION": "observation_value",
                "STRING_LIST": "string_list_value",
            }[kind]
            if any(getattr(point, field_for_kind) is None for point in self.points):
                raise ValueError("point typed value must match its track")
            for point in self.points:
                if point.availability == "AVAILABLE" and point.category != self.category:
                    raise ValueError("available point category must match its track")
                if self.track_id == "verifier_triggering_findings":
                    if (
                        point.source_reference.source_type != "FINDING"
                        or point.source_reference.json_pointer != ""
                    ):
                        raise ValueError("triggering-finding points use the finding root")
                elif point.source_reference.source_type != "EVENT":
                    raise ValueError("non-finding timeline points use event sources")
                elif point.source_reference.json_pointer not in TRACK_POINT_POINTERS[self.track_id]:
                    raise ValueError("timeline point source pointer must match its track registry")
            point_references = tuple(point.source_reference for point in self.points)
            if (
                self.track_id != "verifier_triggering_findings"
                and self.source_references != point_references
            ):
                raise ValueError("track source references must exactly cover its points")
        return self


class Timeline(ReviewModel):
    event_count: Annotated[int, Field(ge=0, le=10_000)]
    simulation_start_s: NonNegativeFloat | None
    simulation_end_s: NonNegativeFloat | None
    tracks: tuple[Track, ...]
    category: Literal["OBSERVED"]

    @model_validator(mode="after")
    def validate_time_bounds(self) -> Timeline:
        if self.event_count == 0:
            if self.simulation_start_s is not None or self.simulation_end_s is not None:
                raise ValueError("empty timeline has null bounds")
        elif self.simulation_start_s is None or self.simulation_end_s is None:
            raise ValueError("non-empty timeline requires both time bounds")
        elif self.simulation_start_s > self.simulation_end_s:
            raise ValueError("timeline start must not follow its end")
        if any(
            track.availability == "AVAILABLE" and len(track.points) != self.event_count
            for track in self.tracks
        ):
            raise ValueError("every available track must retain one point per event")
        available_tracks = tuple(
            track for track in self.tracks if track.availability == "AVAILABLE"
        )
        expected_sequences = tuple(range(self.event_count))
        grids = tuple(
            tuple((point.sequence, point.simulation_time_s) for point in track.points)
            for track in available_tracks
        )
        if any(tuple(sequence for sequence, _ in grid) != expected_sequences for grid in grids):
            raise ValueError("available timeline tracks require the complete event sequence grid")
        if grids and any(grid != grids[0] for grid in grids[1:]):
            raise ValueError("available timeline tracks must share one exact event time grid")
        if (
            self.event_count
            and grids
            and (
                grids[0][0][1] != self.simulation_start_s
                or grids[0][-1][1] != self.simulation_end_s
            )
        ):
            raise ValueError("timeline bounds must equal the common event grid bounds")
        return self


PROVENANCE_FIELDS = (
    "hermes_version",
    "hermes_git_commit",
    "hermes_git_dirty",
    "repository_provenance_reason",
    "adapter_name",
    "adapter_version",
    "adapter_config_digest",
    "simulator_name",
    "simulator_version",
    "simulator_commit",
    "policy_name",
    "policy_version",
    "policy_config_digest",
    "shield_name",
    "shield_version",
    "shield_config_digest",
    "fault_name",
    "fault_version",
    "fault_config_digest",
    "gate_name",
    "gate_version",
    "gate_config_digest",
    "scenario_name",
    "scenario_version",
    "scenario_schema_version",
    "scenario_digest",
    "python_version",
    "platform",
    "architecture",
)


class RecordedProvenance(ReviewModel):
    status: Literal["ACCEPTED", "QUARANTINED"]
    category: Literal["OBSERVED", "NOT_AVAILABLE"]
    source_references: tuple[SourceReference, ...]
    hermes_version: str | None
    hermes_git_commit: str | None
    hermes_git_dirty: bool | None
    repository_provenance_reason: str | None
    adapter_name: str | None
    adapter_version: str | None
    adapter_config_digest: str | None
    simulator_name: str | None
    simulator_version: str | None
    simulator_commit: str | None
    policy_name: str | None
    policy_version: str | None
    policy_config_digest: str | None
    shield_name: str | None
    shield_version: str | None
    shield_config_digest: str | None
    fault_name: str | None
    fault_version: str | None
    fault_config_digest: str | None
    gate_name: str | None
    gate_version: str | None
    gate_config_digest: str | None
    scenario_name: str | None
    scenario_version: str | None
    scenario_schema_version: str | None
    scenario_digest: str | None
    python_version: str | None
    platform: str | None
    architecture: str | None

    @model_validator(mode="after")
    def validate_provenance(self) -> RecordedProvenance:
        if self.status == "QUARANTINED":
            if (
                self.category != "NOT_AVAILABLE"
                or self.source_references
                or any(getattr(self, name) is not None for name in PROVENANCE_FIELDS)
            ):
                raise ValueError("quarantined provenance must expose no recorded claims")
            return self
        if self.category != "OBSERVED" or not self.source_references:
            raise ValueError("accepted provenance requires observed source references")
        required = set(PROVENANCE_FIELDS) - {
            "hermes_git_commit",
            "hermes_git_dirty",
            "repository_provenance_reason",
            "simulator_name",
            "simulator_version",
            "simulator_commit",
            "fault_name",
            "fault_version",
            "fault_config_digest",
        }
        if any(getattr(self, name) is None for name in required):
            raise ValueError("accepted provenance is missing a required source field")
        repository_missing = self.hermes_git_commit is None or self.hermes_git_dirty is None
        if repository_missing != (self.repository_provenance_reason is not None):
            raise ValueError("repository provenance reason must match availability")
        return self


class AuthenticatedOrigin(ReviewModel):
    status: Literal["NOT_AUTHENTICATED"]
    signer_id: None
    signature_id: None
    category: Literal["AUTHENTICITY"]


class Provenance(ReviewModel):
    recorded: RecordedProvenance
    authenticated_origin: AuthenticatedOrigin


class ScalarDeltaValue(ReviewModel):
    kind: Literal["SCALAR"]
    value: ExactValue


class MeasurementDeltaValue(ReviewModel):
    kind: Literal["MEASUREMENT"]
    availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    value: FiniteFloat | None
    reason: str | None

    @model_validator(mode="after")
    def validate_availability(self) -> MeasurementDeltaValue:
        if self.availability == "AVAILABLE":
            if self.value is None or self.reason is not None:
                raise ValueError("available measurement delta requires a value and no reason")
        elif self.value is not None or not self.reason:
            raise ValueError("unavailable measurement delta requires null value and a reason")
        return self


class ComparisonStringListValue(ReviewModel):
    kind: Literal["STRING_LIST"]
    values: tuple[str, ...]

    @field_validator("values")
    @classmethod
    def sorted_unique(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if tuple(sorted(set(value))) != value:
            raise ValueError("comparison string-list values must be sorted and unique")
        return value


class InterventionValue(ReviewModel):
    kind: Literal["INTERVENTION"]
    count: NonNegativeInt
    reasons: Mapping[NonEmptyString, NonNegativeInt]

    @field_validator("reasons")
    @classmethod
    def sorted_reasons(cls, value: Mapping[str, int]) -> Mapping[str, int]:
        if tuple(value) != tuple(sorted(value)):
            raise ValueError("intervention reasons must be sorted")
        return MappingProxyType(dict(value))

    @field_serializer("reasons")
    def serialize_reasons(self, value: Mapping[str, int]) -> dict[str, int]:
        return dict(value)


class AvailabilityValues(ReviewModel):
    minimum_ttc_s: Literal["AVAILABLE", "NOT_AVAILABLE"]
    route_completion_pct: Literal["AVAILABLE", "NOT_AVAILABLE"]
    max_abs_acceleration_mps2: Literal["AVAILABLE", "NOT_AVAILABLE"]
    max_abs_jerk_mps3: Literal["AVAILABLE", "NOT_AVAILABLE"]
    p95_policy_latency_ms: Literal["AVAILABLE", "NOT_AVAILABLE"]


class AvailabilityMapValue(ReviewModel):
    kind: Literal["AVAILABILITY_MAP"]
    values: AvailabilityValues


DimensionValue = Annotated[
    ScalarDeltaValue
    | MeasurementDeltaValue
    | ComparisonStringListValue
    | InterventionValue
    | AvailabilityMapValue,
    Field(discriminator="kind"),
]


class DimensionDelta(ReviewModel):
    dimension_id: NonEmptyString
    status: ComparisonStatus
    baseline_value: DimensionValue
    candidate_value: DimensionValue
    unit: str | None
    explanation: NonEmptyString
    desired_direction: DesiredDirection
    category: Literal["COMPUTED"]
    source_references: tuple[SideReference, ...]

    @model_validator(mode="after")
    def same_value_variant(self) -> DimensionDelta:
        if type(self.baseline_value) is not type(self.candidate_value):
            raise ValueError("comparison sides must use the same dimension-value variant")
        registry: dict[str, tuple[type[ReviewModel], str | None, str, set[str]]] = {
            "verdict": (ScalarDeltaValue, None, "NONE", set(ComparisonStatus.__args__)),
            "collision_count": (
                ScalarDeltaValue,
                "collisions",
                "LOWER",
                {"IMPROVED", "REGRESSED", "UNCHANGED"},
            ),
            "minimum_ttc_s": (
                MeasurementDeltaValue,
                "s",
                "HIGHER",
                set(ComparisonStatus.__args__),
            ),
            "route_completion_pct": (
                MeasurementDeltaValue,
                "%",
                "HIGHER",
                set(ComparisonStatus.__args__),
            ),
            "max_abs_acceleration_mps2": (
                MeasurementDeltaValue,
                "m/s^2",
                "LOWER",
                set(ComparisonStatus.__args__),
            ),
            "max_abs_jerk_mps3": (
                MeasurementDeltaValue,
                "m/s^3",
                "LOWER",
                set(ComparisonStatus.__args__),
            ),
            "p95_policy_latency_ms": (
                MeasurementDeltaValue,
                "ms",
                "LOWER",
                set(ComparisonStatus.__args__),
            ),
            "policy_latency_source": (
                ComparisonStringListValue,
                None,
                "DESCRIPTIVE",
                {"UNCHANGED", "NOT_COMPARABLE"},
            ),
            "shield_interventions": (
                InterventionValue,
                "interventions",
                "DESCRIPTIVE",
                {"UNCHANGED", "NOT_COMPARABLE"},
            ),
            "evidence_availability": (
                AvailabilityMapValue,
                None,
                "NONE",
                {"UNCHANGED", "NOT_COMPARABLE"},
            ),
        }
        if self.dimension_id not in registry:
            raise ValueError("unsupported comparison dimension")
        expected_type, expected_unit, expected_direction, allowed_statuses = registry[
            self.dimension_id
        ]
        if (
            self.unit != expected_unit
            or self.desired_direction != expected_direction
            or self.status not in allowed_statuses
        ):
            raise ValueError("comparison metadata must match the dimension registry")
        if self.dimension_id in {
            "minimum_ttc_s",
            "route_completion_pct",
            "max_abs_acceleration_mps2",
            "max_abs_jerk_mps3",
            "p95_policy_latency_ms",
        }:
            expected_type = MeasurementDeltaValue
        elif self.dimension_id == "policy_latency_source":
            expected_type = ComparisonStringListValue
            if self.status not in {"UNCHANGED", "NOT_COMPARABLE"}:
                raise ValueError("latency source is descriptive and not ordinal")
        elif self.dimension_id == "shield_interventions":
            expected_type = InterventionValue
            values_equal = self.baseline_value == self.candidate_value
            expected_status = "UNCHANGED" if values_equal else "NOT_COMPARABLE"
            if self.status != expected_status or self.desired_direction != "DESCRIPTIVE":
                raise ValueError("interventions are descriptive and not ordinal")
        elif self.dimension_id == "evidence_availability":
            expected_type = AvailabilityMapValue
        if not isinstance(self.baseline_value, expected_type):
            raise ValueError("dimension value variant does not match the dimension registry")
        if self.dimension_id == "verdict":
            rank = {"HOLD": 0, "CONDITIONAL": 1, "PASS": 2}
            baseline = self.baseline_value.value.machine_value
            candidate = self.candidate_value.value.machine_value
            if baseline not in rank or candidate not in rank:
                expected_status = "NOT_COMPARABLE"
            else:
                expected_status = self._numeric_status(rank[baseline], rank[candidate], True)
        elif self.dimension_id == "collision_count":
            baseline = self.baseline_value.value.machine_value
            candidate = self.candidate_value.value.machine_value
            if (
                not isinstance(baseline, int)
                or isinstance(baseline, bool)
                or baseline < 0
                or not isinstance(candidate, int)
                or isinstance(candidate, bool)
                or candidate < 0
            ):
                raise ValueError("collision delta requires non-negative integer values")
            expected_status = self._numeric_status(baseline, candidate, False)
        elif isinstance(self.baseline_value, MeasurementDeltaValue):
            baseline = self.baseline_value
            candidate = self.candidate_value
            if (
                baseline.availability != "AVAILABLE"
                or candidate.availability != "AVAILABLE"
                or self.dimension_id == "p95_policy_latency_ms"
                and self.status == "NOT_COMPARABLE"
            ):
                expected_status = "NOT_COMPARABLE"
            else:
                expected_status = self._numeric_status(
                    baseline.value,
                    candidate.value,
                    self.desired_direction == "HIGHER",
                )
        elif self.dimension_id in {"policy_latency_source", "evidence_availability"}:
            expected_status = (
                "UNCHANGED" if self.baseline_value == self.candidate_value else "NOT_COMPARABLE"
            )
        else:
            expected_status = self.status
        if self.status != expected_status:
            raise ValueError("dimension status must match its exact side values")
        return self

    @staticmethod
    def _numeric_status(
        baseline: int | float,
        candidate: int | float,
        higher_is_better: bool,
    ) -> str:
        if candidate == baseline:
            return "UNCHANGED"
        improved = candidate > baseline if higher_is_better else candidate < baseline
        return "IMPROVED" if improved else "REGRESSED"


class HardFailureDelta(ReviewModel):
    status: ComparisonStatus
    baseline_ids: tuple[NonEmptyString, ...]
    candidate_ids: tuple[NonEmptyString, ...]
    removed_ids: tuple[NonEmptyString, ...]
    added_ids: tuple[NonEmptyString, ...]
    explanation: NonEmptyString
    category: Literal["COMPUTED"]
    source_references: tuple[SideReference, ...]

    @model_validator(mode="after")
    def sorted_unique_ids(self) -> HardFailureDelta:
        for values in (self.baseline_ids, self.candidate_ids, self.removed_ids, self.added_ids):
            if tuple(sorted(set(values))) != values:
                raise ValueError("hard-failure ID arrays must be sorted and unique")
        removed = tuple(sorted(set(self.baseline_ids) - set(self.candidate_ids)))
        added = tuple(sorted(set(self.candidate_ids) - set(self.baseline_ids)))
        if self.removed_ids != removed or self.added_ids != added:
            raise ValueError("hard-failure added/removed IDs must equal side set math")
        expected_status = (
            "UNCHANGED"
            if not removed and not added
            else "IMPROVED"
            if removed and not added
            else "REGRESSED"
            if added and not removed
            else "NOT_COMPARABLE"
        )
        if self.status != expected_status:
            raise ValueError("hard-failure status must match exact set changes")
        expected_explanation = (
            "hard-failure set is unchanged"
            if expected_status == "UNCHANGED"
            else "removed hard failures: " + ", ".join(removed)
            if expected_status == "IMPROVED"
            else "added hard failures: " + ", ".join(added)
            if expected_status == "REGRESSED"
            else (
                "hard failures changed in both directions; removed: "
                + ", ".join(removed)
                + "; added: "
                + ", ".join(added)
            )
        )
        if self.explanation != expected_explanation:
            raise ValueError("hard-failure explanation must match exact set changes")
        return self


class AvailabilityDelta(ReviewModel):
    metric_id: NonEmptyString
    baseline_availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    candidate_availability: Literal["AVAILABLE", "NOT_AVAILABLE"]
    baseline_reason: str | None
    candidate_reason: str | None
    category: Literal["COMPUTED"]
    source_references: tuple[SideReference, ...]

    @model_validator(mode="after")
    def reasons_match_availability(self) -> AvailabilityDelta:
        pairs = (
            (self.baseline_availability, self.baseline_reason),
            (self.candidate_availability, self.candidate_reason),
        )
        if any((availability == "NOT_AVAILABLE") != bool(reason) for availability, reason in pairs):
            raise ValueError("availability reasons must match side availability")
        return self


class ChartSeries(ReviewModel):
    dimension_id: NonEmptyString
    baseline_numeric_value: FiniteFloat
    candidate_numeric_value: FiniteFloat
    unit: str | None
    category: Literal["COMPUTED"]
    source_references: tuple[SideReference, ...]


class CompatibilityInfo(ReviewModel):
    status: Literal["COMPATIBLE", "INCOMPATIBLE"]
    reasons: tuple[str, ...]
    warnings: tuple[str, ...]
    category: Literal["COMPUTED"]

    @model_validator(mode="after")
    def reasons_match_status(self) -> CompatibilityInfo:
        if self.status == "INCOMPATIBLE" and not self.reasons:
            raise ValueError("incompatible comparison requires a reason")
        if self.status == "COMPATIBLE" and self.reasons:
            raise ValueError("compatible comparison cannot carry incompatibility reasons")
        return self


class SideSummary(ReviewModel):
    side: ComparisonSide
    artifact: PortableArtifactIdentity
    integrity: Literal["INTERNALLY_CONSISTENT"]
    gate_verdict: Literal["PASS", "CONDITIONAL", "HOLD"]
    category: Literal["COMPUTED"]
    source_references: tuple[SideReference, ...]

    @model_validator(mode="after")
    def references_match_side(self) -> SideSummary:
        if any(reference.side != self.side for reference in self.source_references):
            raise ValueError("side summary references must match the summary side")
        return self


def _threshold_depth(expression: ThresholdExpression) -> int:
    if isinstance(expression, GroupExpression):
        return 1 + max(_threshold_depth(child) for child in expression.children)
    return 1


class ReviewEnvelope(ReviewModel):
    review_schema_version: Literal["1.0"]
    tool: ToolInfo
    artifact: PortableArtifactIdentity
    verification: VerificationInfo
    trust: TrustInfo
    gate: GateInfo
    evidence_sufficiency: EvidenceSufficiency
    findings: tuple[FindingItem, ...]
    metrics: tuple[MetricItem, ...]
    timeline: Timeline
    provenance: Provenance
    diagnostics: tuple[DiagnosticItem, ...]
    assumptions: tuple[AssumptionItem, ...]
    unavailable_evidence: tuple[UnavailableEvidenceItem, ...]
    residual_limitations: tuple[LimitationItem, ...]

    @model_validator(mode="after")
    def validate_review_envelope(self) -> ReviewEnvelope:
        if len(self.findings) > 64 or len(self.metrics) > 64:
            raise ReviewUnavailableError(
                ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
                "review finding or metric budget exceeded",
            )
        if self.tool.review_schema_version != self.review_schema_version:
            raise ValueError("tool and envelope review schema versions must match")
        limitation_ids = tuple(item.id for item in self.residual_limitations)
        if tuple(sorted(set(limitation_ids))) != limitation_ids:
            raise ValueError("residual limitations must be unique and sorted by ID")
        assumption_ids = tuple(item.id for item in self.assumptions)
        if tuple(sorted(set(assumption_ids))) != assumption_ids:
            raise ValueError("assumptions must be unique and sorted by ID")
        expected_unavailable = tuple(
            (
                item.evidence_id,
                item.label,
                item.reason,
                item.requirement,
                item.consequence,
                item.source_references,
            )
            for item in self.evidence_sufficiency.items
            if item.availability == "NOT_AVAILABLE"
        )
        actual_unavailable = tuple(
            (
                item.evidence_id,
                item.label,
                item.reason,
                item.requiredness,
                item.consequence,
                item.source_references,
            )
            for item in self.unavailable_evidence
        )
        if expected_unavailable != actual_unavailable:
            raise ValueError("unavailable evidence must exactly project sufficiency items")
        if self.verification.integrity == "INVALID_EVIDENCE":
            summary = self.evidence_sufficiency.summary
            inventory_names = {item.file.file_name for item in self.artifact.source_inventory}
            captured_claims = bool(
                inventory_names.intersection({"metrics.json", "findings.json", "verdict.json"})
            )
            if (
                self.gate.verdict != "INVALID_EVIDENCE"
                or self.gate.accepted_recomputation
                or self.gate.rationale
                or any(
                    (
                        self.gate.hard_failure_ids,
                        self.gate.soft_failure_ids,
                        self.gate.supporting_finding_ids,
                        self.gate.residual_limitation_ids,
                    )
                )
                or self.findings
                or self.metrics
                or self.timeline.event_count != 0
                or self.timeline.tracks
                or self.provenance.recorded.status != "QUARANTINED"
                or self.evidence_sufficiency.profile_name is not None
                or self.evidence_sufficiency.profile_version is not None
                or self.evidence_sufficiency.items
                or any(summary.model_dump().values())
                or self.verification.stored_claims_quarantined != captured_claims
            ):
                raise ValueError("invalid evidence must use the quarantined envelope shape")
            return self
        if self.gate.residual_limitation_ids != limitation_ids:
            raise ValueError("gate limitation IDs must match envelope limitations")
        if self.gate.verdict == "INVALID_EVIDENCE" or not self.gate.accepted_recomputation:
            raise ValueError("consistent evidence requires an accepted recomputation")
        if len(self.artifact.source_inventory) != 10:
            raise ValueError("consistent evidence requires the complete inventory")
        identity = self.artifact.manifest_identity
        if any(
            getattr(identity, name) is None
            for name in (
                "run_id",
                "created_at_utc",
                "evidence_schema_version",
                "scenario_schema_version",
            )
        ):
            raise ValueError("consistent evidence requires complete manifest identity")
        if any(
            digest is None
            for digest in (
                self.artifact.observed_bundle_digest,
                self.artifact.computed_bundle_digest,
                self.artifact.observed_trace_digest,
                self.artifact.computed_trace_digest,
            )
        ):
            raise ValueError("consistent evidence requires all observed and computed digest roots")
        if self.provenance.recorded.status != "ACCEPTED":
            raise ValueError("consistent evidence requires accepted recorded provenance")
        finding_ids = tuple(item.finding_id for item in self.findings)
        profile = self.evidence_sufficiency.profile_name
        if profile is None:
            raise ValueError("consistent evidence requires a selected sufficiency profile")
        schema = self.artifact.manifest_identity.evidence_schema_version
        if (schema, profile) not in {("1.0", "legacy"), ("2.0", "fault_coverage")}:
            raise ValueError("evidence schema and sufficiency profile must use the frozen pairing")
        expected_findings = FINDING_ORDER[:6] if profile == "legacy" else FINDING_ORDER
        if finding_ids != expected_findings:
            raise ValueError("findings must match the frozen profile order")
        requirements = {
            item.evidence_id: item.requirement for item in self.evidence_sufficiency.items
        }
        if any(item.requiredness != requirements[item.finding_id] for item in self.findings):
            raise ValueError("finding requiredness must match the selected profile")
        emitted_ids = set(finding_ids)
        gate_arrays = (
            self.gate.hard_failure_ids,
            self.gate.soft_failure_ids,
            self.gate.supporting_finding_ids,
        )
        if any(not set(values).issubset(emitted_ids) for values in gate_arrays):
            raise ValueError("gate arrays may contain only emitted finding IDs")
        for values in gate_arrays:
            if values != tuple(item for item in finding_ids if item in values):
                raise ValueError("gate arrays must preserve emitted finding order")
        for finding in self.findings:
            consequence = finding.consequence
            actual = (
                finding.finding_id in self.gate.hard_failure_ids,
                finding.finding_id in self.gate.soft_failure_ids,
                finding.finding_id in self.gate.supporting_finding_ids,
            )
            recorded = (
                consequence.listed_in_hard_failures,
                consequence.listed_in_soft_failures,
                consequence.listed_in_supporting_findings,
            )
            if recorded != actual:
                raise ValueError("finding consequence membership must exactly copy GateInfo arrays")
            self._validate_threshold_event_coverage(finding)
        if any(_threshold_depth(item.threshold) > 16 for item in self.findings):
            raise ReviewUnavailableError(
                ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
                "review threshold nesting depth exceeded",
            )
        expected_metrics = (
            METRIC_ORDER[:13] if schema == "1.0" else METRIC_ORDER if schema == "2.0" else ()
        )
        if tuple(item.metric_id for item in self.metrics) != expected_metrics:
            raise ValueError("metrics must match the evidence-schema registry")
        if tuple(track.track_id for track in self.timeline.tracks) != TRACK_ORDER:
            raise ValueError("timeline tracks must match the frozen registry")
        for track in self.timeline.tracks:
            should_be_unavailable = schema == "1.0" and track.track_id in LEGACY_UNAVAILABLE_TRACKS
            if should_be_unavailable != (track.availability == "NOT_AVAILABLE"):
                raise ValueError("track availability must match the evidence schema")
        return self

    def _validate_threshold_event_coverage(self, finding: FindingItem) -> None:
        event_count = self.timeline.event_count
        every = tuple(range(event_count))

        def event_pairs(references: tuple[SourceReference, ...]) -> tuple[tuple[int, str], ...]:
            return tuple(
                (reference.event_sequence, reference.json_pointer or "")
                for reference in references
                if reference.source_type == "EVENT" and reference.event_sequence is not None
            )

        def expected(
            pointer: str, sequences: tuple[int, ...] = every
        ) -> tuple[tuple[int, str], ...]:
            return tuple((sequence, pointer) for sequence in sequences)

        expression = finding.threshold
        groups: tuple[tuple[SourceReference, ...], ...]
        expected_groups: tuple[tuple[tuple[int, str], ...], ...]
        if finding.finding_id == "trace.integrity":
            groups = (expression.invariant.evidence_sources,)
            expected_groups = (expected(""),)
        elif finding.finding_id == "collision.zero":
            groups = (expression.clause.evidence_sources,)
            expected_groups = (expected("/vehicle_state/collision_count"),)
        elif finding.finding_id == "boundary.within_tolerance":
            groups = tuple(child.clause.evidence_sources for child in expression.children)
            expected_groups = (
                expected("/vehicle_state/lateral_offset_m"),
                expected("/vehicle_state/offroad"),
                expected("/vehicle_state/offroad"),
            )
        elif finding.finding_id == "progress.required":
            groups = tuple(child.clause.evidence_sources for child in expression.children)
            final = () if event_count == 0 else (event_count - 1,)
            progress = expected("/raw_facts/route_progress_available")
            if finding.evidence_availability == "AVAILABLE":
                progress += expected("/vehicle_state/route_progress_pct")
                progress = tuple(sorted(progress))
            expected_groups = (
                expected("/vehicle_state/destination_reached", final),
                progress,
            )
        elif finding.finding_id in {"comfort.acceleration", "comfort.jerk"}:
            groups = (expression.clause.evidence_sources,)
            expected_groups = (expected("/vehicle_state/acceleration_mps2"),)
        else:
            groups = (expression.invariant.evidence_sources,)
            expected_groups = (
                tuple(
                    sorted(
                        expected("/observation_fault_evidence/applied_faults")
                        + expected("/control_fault_evidence/applied_faults")
                    )
                ),
            )
        if tuple(event_pairs(group) for group in groups) != expected_groups:
            raise ValueError("threshold event references must completely cover the timeline grid")


class ComparisonEnvelope(ReviewModel):
    comparison_schema_version: Literal["1.0"]
    tool: ToolInfo
    baseline: SideSummary
    candidate: SideSummary
    compatibility: CompatibilityInfo
    verdict_delta: DimensionDelta | None
    hard_failure_delta: HardFailureDelta | None
    availability_summary_delta: DimensionDelta | None
    improvements: tuple[DimensionDelta, ...]
    regressions: tuple[DimensionDelta, ...]
    unchanged_outcomes: tuple[DimensionDelta, ...]
    not_comparable: tuple[DimensionDelta, ...]
    availability_deltas: tuple[AvailabilityDelta, ...]
    chart_series: tuple[ChartSeries, ...]
    residual_limitations: tuple[LimitationItem, ...]

    @model_validator(mode="after")
    def validate_comparison_envelope(self) -> ComparisonEnvelope:
        if self.tool.review_schema_version != self.comparison_schema_version:
            raise ValueError("tool and comparison schema versions must match")
        if self.baseline.side != "BASELINE" or self.candidate.side != "CANDIDATE":
            raise ValueError("comparison side summaries have fixed roles")
        detail_arrays = (
            self.improvements,
            self.regressions,
            self.unchanged_outcomes,
            self.not_comparable,
            self.availability_deltas,
            self.chart_series,
        )
        if self.compatibility.status == "INCOMPATIBLE":
            if any(
                value is not None
                for value in (
                    self.verdict_delta,
                    self.hard_failure_delta,
                    self.availability_summary_delta,
                )
            ) or any(detail_arrays):
                raise ValueError("incompatible comparison cannot expose deltas or charts")
            return self
        if self.verdict_delta is None or self.verdict_delta.dimension_id != "verdict":
            raise ValueError("compatible comparison requires dedicated verdict delta")
        if self.hard_failure_delta is None:
            raise ValueError("compatible comparison requires dedicated hard-failure delta")
        if (
            self.availability_summary_delta is None
            or self.availability_summary_delta.dimension_id != "evidence_availability"
        ):
            raise ValueError("compatible comparison requires dedicated availability summary")
        partitions = (
            ("IMPROVED", self.improvements),
            ("REGRESSED", self.regressions),
            ("UNCHANGED", self.unchanged_outcomes),
            ("NOT_COMPARABLE", self.not_comparable),
        )
        all_dimensions: list[str] = []
        for status, values in partitions:
            ids = tuple(item.dimension_id for item in values)
            if any(item.status != status for item in values):
                raise ValueError("dimension must be in its matching status partition")
            expected = tuple(item for item in PARTITION_DIMENSION_ORDER if item in ids)
            if len(set(ids)) != len(ids) or ids != expected:
                raise ValueError("partition dimensions must be unique and in core order")
            all_dimensions.extend(ids)
        if (
            tuple(sorted(all_dimensions, key=PARTITION_DIMENSION_ORDER.index))
            != PARTITION_DIMENSION_ORDER
        ):
            raise ValueError("every partition dimension must be mapped exactly once")
        availability_ids = tuple(item.metric_id for item in self.availability_deltas)
        if availability_ids != tuple(
            item for item in AVAILABILITY_ORDER if item in availability_ids
        ):
            raise ValueError("availability deltas must follow frozen metric order")
        if len(set(availability_ids)) != len(availability_ids) or len(availability_ids) > 5:
            raise ValueError("availability delta metric IDs must be unique and bounded")
        if any(
            item.baseline_availability == item.candidate_availability
            and item.baseline_reason == item.candidate_reason
            for item in self.availability_deltas
        ):
            raise ValueError("availability deltas are emitted only for side differences")
        measurement_deltas = {
            item.dimension_id: item
            for partition in partitions
            for item in partition[1]
            if item.dimension_id in AVAILABILITY_ORDER
        }
        summary = self.availability_summary_delta
        if not isinstance(summary.baseline_value, AvailabilityMapValue) or not isinstance(
            summary.candidate_value, AvailabilityMapValue
        ):
            raise ValueError("availability summary must use availability maps")
        maps_equal = summary.baseline_value == summary.candidate_value
        if summary.status != ("UNCHANGED" if maps_equal else "NOT_COMPARABLE"):
            raise ValueError("availability summary status must match its side maps")
        expected_availability_ids = tuple(
            metric_id
            for metric_id in AVAILABILITY_ORDER
            if (
                getattr(summary.baseline_value.values, metric_id)
                != getattr(summary.candidate_value.values, metric_id)
                or (
                    isinstance(measurement_deltas[metric_id].baseline_value, MeasurementDeltaValue)
                    and measurement_deltas[metric_id].baseline_value.reason
                    != measurement_deltas[metric_id].candidate_value.reason
                )
            )
        )
        if availability_ids != expected_availability_ids:
            raise ValueError("availability details must exactly match summary/reason changes")
        for detail in self.availability_deltas:
            dimension = measurement_deltas[detail.metric_id]
            baseline = dimension.baseline_value
            candidate = dimension.candidate_value
            if not isinstance(baseline, MeasurementDeltaValue) or not isinstance(
                candidate, MeasurementDeltaValue
            ):
                raise ValueError("availability detail requires measurement dimension values")
            if (
                detail.baseline_availability != baseline.availability
                or detail.candidate_availability != candidate.availability
                or detail.baseline_reason != baseline.reason
                or detail.candidate_reason != candidate.reason
                or detail.source_references != dimension.source_references
            ):
                raise ValueError("availability detail must copy its measurement dimension")
        chart_ids = tuple(item.dimension_id for item in self.chart_series)
        chart_order = PARTITION_DIMENSION_ORDER[:-2]
        if chart_ids != tuple(item for item in chart_order if item in chart_ids):
            raise ValueError("chart series must follow core order")
        if len(set(chart_ids)) != len(chart_ids):
            raise ValueError("chart dimensions must be unique")
        partition_by_id = {
            item.dimension_id: item for partition in partitions for item in partition[1]
        }
        eligible_chart_ids = []
        for dimension_id in chart_order:
            delta = partition_by_id[dimension_id]
            if isinstance(delta.baseline_value, ScalarDeltaValue):
                baseline_number = delta.baseline_value.value.machine_value
                candidate_number = delta.candidate_value.value.machine_value
                eligible = (
                    isinstance(baseline_number, (int, float))
                    and not isinstance(baseline_number, bool)
                    and isinstance(candidate_number, (int, float))
                    and not isinstance(candidate_number, bool)
                )
            else:
                baseline_number = delta.baseline_value.value
                candidate_number = delta.candidate_value.value
                eligible = (
                    delta.baseline_value.availability == "AVAILABLE"
                    and delta.candidate_value.availability == "AVAILABLE"
                    and dimension_id != "p95_policy_latency_ms"
                    or (
                        dimension_id == "p95_policy_latency_ms"
                        and delta.status != "NOT_COMPARABLE"
                        and delta.baseline_value.availability == "AVAILABLE"
                        and delta.candidate_value.availability == "AVAILABLE"
                    )
                )
            if eligible:
                eligible_chart_ids.append(dimension_id)
        if chart_ids != tuple(eligible_chart_ids):
            raise ValueError("chart series must exactly cover eligible numeric dimensions")
        for chart in self.chart_series:
            delta = partition_by_id[chart.dimension_id]
            baseline_value = delta.baseline_value
            candidate_value = delta.candidate_value
            expected_baseline = (
                baseline_value.value.machine_value
                if isinstance(baseline_value, ScalarDeltaValue)
                else baseline_value.value
            )
            expected_candidate = (
                candidate_value.value.machine_value
                if isinstance(candidate_value, ScalarDeltaValue)
                else candidate_value.value
            )
            if (
                chart.baseline_numeric_value != expected_baseline
                or chart.candidate_numeric_value != expected_candidate
                or chart.unit != delta.unit
                or chart.source_references != delta.source_references
            ):
                raise ValueError("chart must exactly copy its authoritative numeric delta")
        limitation_ids = tuple(item.id for item in self.residual_limitations)
        if tuple(sorted(set(limitation_ids))) != limitation_ids:
            raise ValueError("comparison limitations must be unique and sorted")
        return self


def canonical_envelope_bytes(envelope: ReviewEnvelope | ComparisonEnvelope) -> bytes:
    """Return canonical portable JSON bytes without transport newline decoration."""
    if not isinstance(envelope, (ReviewEnvelope, ComparisonEnvelope)):
        raise TypeError("envelope must be ReviewEnvelope or ComparisonEnvelope")
    return canonical_json_bytes(envelope.model_dump(mode="json"))


ClauseExpression.model_rebuild()
GroupExpression.model_rebuild()
InvariantExpression.model_rebuild()
