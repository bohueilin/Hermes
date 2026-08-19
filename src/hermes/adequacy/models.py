"""Strict, immutable, framework-independent Phase 7 adequacy contracts."""

from __future__ import annotations

import json
import math
from enum import StrEnum
from itertools import product
from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _AdequacyModel(BaseModel):
    """Common contract settings with no process, review, or authority dependency."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)


NonEmptyString = Annotated[str, Field(min_length=1)]
Identifier = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_\-]*$")]
RuleIdentifier = Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]*$")]
Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
GitCommit = Annotated[str, Field(pattern=r"^[0-9a-f]{40}$")]
FiniteFloat = Annotated[float, Field(allow_inf_nan=False)]
NonNegativeInt = Annotated[int, Field(ge=0)]
PositiveInt = Annotated[int, Field(gt=0)]
RelativeLocator = Annotated[str, Field(min_length=1)]
JsonScalar: TypeAlias = str | bool | int | float | None
GridValue: TypeAlias = int | float
GridParameter = Literal[
    "initial_gap_m",
    "actor_speed_mps",
    "trigger_step",
    "brake_duration_steps",
    "recovery_throttle",
]
GRID_PARAMETER_ORDER: tuple[str, ...] = (
    "initial_gap_m",
    "actor_speed_mps",
    "trigger_step",
    "brake_duration_steps",
    "recovery_throttle",
)
GRID_PARAMETER_SCENARIO_FIELDS: dict[str, str] = {
    "initial_gap_m": "challenge.initial_gap_m",
    "actor_speed_mps": "challenge.actor_speed_mps",
    "trigger_step": "challenge.trigger_step",
    "brake_duration_steps": "challenge.brake_duration_steps",
    "recovery_throttle": "challenge.resume_throttle_command",
}
# Exact closed domains frozen by the Task 8 contract amendment. `kind` is enforced
# strictly: a bool is never a number, and an int is never accepted where the scenario
# field is a float (and vice versa).
_GRID_PARAMETER_DOMAIN: dict[str, tuple[str, float, bool, float, bool]] = {
    "initial_gap_m": ("float", 0.0, False, 200.0, True),
    "actor_speed_mps": ("float", 0.0, True, 50.0, True),
    "trigger_step": ("int", 0.0, True, 9_999.0, True),
    "brake_duration_steps": ("int", 1.0, True, 10_000.0, True),
    "recovery_throttle": ("float", 0.0, True, 1.0, True),
}


def validate_grid_value(parameter: str, value: object) -> None:
    """Reject any grid value outside its exact declared type and closed domain."""
    kind, low, low_inclusive, high, high_inclusive = _GRID_PARAMETER_DOMAIN[parameter]
    if isinstance(value, bool):
        raise ValueError(f"grid parameter {parameter} rejects boolean values")
    if kind == "int":
        if not isinstance(value, int):
            raise ValueError(f"grid parameter {parameter} requires a strict integer")
    else:
        if not isinstance(value, float):
            raise ValueError(f"grid parameter {parameter} requires a strict float")
        if not math.isfinite(value):
            raise ValueError(f"grid parameter {parameter} requires a finite value")
    numeric = float(value)
    if (numeric < low) or (numeric == low and not low_inclusive):
        raise ValueError(f"grid parameter {parameter} is below its allowed domain")
    if (numeric > high) or (numeric == high and not high_inclusive):
        raise ValueError(f"grid parameter {parameter} is above its allowed domain")

LOCAL_HISTORY_LIMITATION = "Rewritable local history; no external timestamp."
MAX_CRITERION_REFERENCES = 8
SELECTION_EVIDENCE_MISSING_REASON = (
    "A BRAKING policy-input event lacks paired front distance and relative speed."
)

_SELECTION_EVIDENCE_SOURCE_POINTERS = (
    "/sequence",
    "/observation_summary/challenge_phase",
    "/observation_summary/front_distance_m",
    "/observation_summary/front_relative_speed_mps",
)

_OVERRIDE_REASON_ORDER = {
    "TTC_BELOW_THRESHOLD": 0,
    "SPEED_CAP": 1,
    "STALE_OBSERVATION": 2,
    "BOUNDARY_RISK": 3,
    "EMERGENCY_STOP": 4,
    "ACTUATION_DELAY_COMPENSATION": 5,
}


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


def _require_unique(values: tuple[object, ...], label: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"{label} must be unique")


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
Integrity = Literal["UNVERIFIED", "INTERNALLY_CONSISTENT", "INVALID_EVIDENCE"]
Compatibility = Literal["COMPATIBLE", "INCOMPATIBLE", "NOT_EVALUATED"]
Role = Literal["BASELINE", "CANDIDATE"]
ChallengePhase = Literal[
    "PRE_TRIGGER", "BRAKING", "RECOVERY", "CUT_IN", "POST_CUT_IN"
] | None
OverrideReason = Literal[
    "TTC_BELOW_THRESHOLD",
    "SPEED_CAP",
    "STALE_OBSERVATION",
    "BOUNDARY_RISK",
    "EMERGENCY_STOP",
    "ACTUATION_DELAY_COMPENSATION",
]
EvidenceCategory = Literal["OBSERVED", "COMPUTED", "ASSUMPTION", "NOT_AVAILABLE"]


class CriterionDefinition(_AdequacyModel):
    required_phase: Literal["BRAKING"]
    minimum_phase_samples_per_arm: PositiveInt
    policy_input_ttc_lte_s: Annotated[FiniteFloat, Field(gt=0.0, le=30.0)]
    candidate_required_override_reason: Literal["TTC_BELOW_THRESHOLD"]
    minimum_target_override_events: PositiveInt
    prohibit_non_target_reasons_through_first_target_response: Literal[True]
    minimum_post_response_decision_steps: NonNegativeInt
    actuation_delay_compensation_s: Literal[0.0]


class SelectionEvidenceDefinition(_AdequacyModel):
    """Protocol-owned v1 derivation for baseline discovery evidence."""

    schema_version: Literal["1.0"]
    observation_id: Literal["minimum_policy_input_ttc_s"]
    event_domain: Literal["BRAKING_POLICY_INPUT_EVENTS"]
    required_signals: Literal["FRONT_DISTANCE_AND_RELATIVE_SPEED"]
    closing_condition: Literal["FRONT_RELATIVE_SPEED_LT_ZERO"]
    value_expression: Literal["FRONT_DISTANCE_DIVIDED_BY_NEGATED_RELATIVE_SPEED"]
    aggregation: Literal["MINIMUM"]
    sequence_tie_breaker: Literal["EARLIEST_SEQUENCE"]
    unit: Literal["s"]
    operator: Literal["LTE"]
    threshold_source: Literal["criteria.policy_input_ttc_lte_s"]
    source_file: Literal["events.jsonl"]
    source_json_pointers: Annotated[
        tuple[NonEmptyString, ...], Field(min_length=4, max_length=4)
    ]

    @model_validator(mode="after")
    def require_exact_source_pointers(self) -> SelectionEvidenceDefinition:
        if self.source_json_pointers != _SELECTION_EVIDENCE_SOURCE_POINTERS:
            raise ValueError("selection evidence source pointers must match the v1 definition")
        return self


class GridDimension(_AdequacyModel):
    parameter: GridParameter
    scenario_field: NonEmptyString
    values: Annotated[tuple[GridValue, ...], Field(min_length=1)]

    @model_validator(mode="after")
    def require_unique_values(self) -> GridDimension:
        _require_unique(self.values, "grid values")
        if self.scenario_field != GRID_PARAMETER_SCENARIO_FIELDS[self.parameter]:
            raise ValueError(
                f"grid parameter {self.parameter} must map to "
                f"{GRID_PARAMETER_SCENARIO_FIELDS[self.parameter]}"
            )
        for value in self.values:
            validate_grid_value(self.parameter, value)
        return self


class SelectionRule(_AdequacyModel):
    rule_id: Literal["FIRST_VALID_BY_GRID_ORDER"]
    metric: Literal["POLICY_INPUT_TTC_BAND_ENTRY"]
    direction: Literal["FIRST_MATCH"]
    tie_breakers: Annotated[
        tuple[Literal["GRID_ORDER", "ATTEMPT_ID"], ...], Field(min_length=1)
    ]

    @model_validator(mode="after")
    def require_unique_tie_breakers(self) -> SelectionRule:
        _require_unique(self.tie_breakers, "selection tie breakers")
        return self


class RunValidityRule(_AdequacyModel):
    rule_id: RuleIdentifier
    observation: NonEmptyString
    operator: Literal["EQ", "NE", "LTE", "GTE"]
    expected_value: JsonScalar


class ExclusionRule(_AdequacyModel):
    rule_id: RuleIdentifier
    observation: NonEmptyString
    operator: Literal["EQ", "NE", "LTE", "GTE"]
    excluded_value: JsonScalar


class MaterializerFieldMapping(_AdequacyModel):
    parameter: GridParameter
    scenario_field: NonEmptyString

    @model_validator(mode="after")
    def require_frozen_scenario_field(self) -> MaterializerFieldMapping:
        if self.scenario_field != GRID_PARAMETER_SCENARIO_FIELDS[self.parameter]:
            raise ValueError(
                f"materializer parameter {self.parameter} must map to "
                f"{GRID_PARAMETER_SCENARIO_FIELDS[self.parameter]}"
            )
        return self


class MaterializerTemplate(_AdequacyModel):
    """Exact identity of the reviewed scenario template every variant derives from."""

    repository_relative_path: RelativeLocator
    byte_digest_sha256: Sha256
    scenario_digest_sha256: Sha256

    @model_validator(mode="after")
    def require_relative_template_path(self) -> MaterializerTemplate:
        _require_lexical_relative_locator(
            self.repository_relative_path, "repository_relative_path"
        )
        return self


class MaterializedVariantBinding(_AdequacyModel):
    """One predeclared Cartesian-grid output with its exact rendered identity."""

    grid_index: NonNegativeInt
    variant_id: Identifier
    parameters: Annotated[tuple[GridAssignment, ...], Field(min_length=1)]
    scenario_byte_digest_sha256: Sha256
    scenario_digest_sha256: Sha256
    adapter_config_digest_sha256: Sha256

    @model_validator(mode="after")
    def require_ordered_unique_parameters(self) -> MaterializedVariantBinding:
        parameters = tuple(assignment.parameter for assignment in self.parameters)
        _require_unique(parameters, "variant parameters")
        if parameters != GRID_PARAMETER_ORDER:
            raise ValueError("variant parameters must use the frozen grid parameter order")
        return self


class MaterializerSpecification(_AdequacyModel):
    version: Literal["2.0"]
    algorithm: Literal["STRICT_EXISTING_SCALAR_REPLACEMENT_V1"]
    output_serialization: Literal["HERMES_RESOLVED_SCENARIO_YAML_UTF8_LF_V1"]
    protocol_serialization: Literal["HERMES_EVALUATION_PROTOCOL_YAML_UTF8_LF_V1"]
    adapter_config_projection: Literal["METADRIVE_ADAPTER_EVIDENCE_CONFIG_V1_1"]
    template: MaterializerTemplate
    mappings: Annotated[tuple[MaterializerFieldMapping, ...], Field(min_length=1)]
    variants: Annotated[tuple[MaterializedVariantBinding, ...], Field(min_length=1)]

    @model_validator(mode="after")
    def require_unique_mappings(self) -> MaterializerSpecification:
        parameters = tuple(mapping.parameter for mapping in self.mappings)
        fields = tuple(mapping.scenario_field for mapping in self.mappings)
        _require_unique(parameters, "materializer parameters")
        _require_unique(fields, "materializer scenario fields")
        if parameters != GRID_PARAMETER_ORDER:
            raise ValueError("materializer mappings must use the frozen grid parameter order")
        indices = tuple(variant.grid_index for variant in self.variants)
        if indices != tuple(range(len(self.variants))):
            raise ValueError("variant grid indices must be dense and ascending from zero")
        _require_unique(tuple(variant.variant_id for variant in self.variants), "variant IDs")
        _require_unique(
            tuple(variant.scenario_byte_digest_sha256 for variant in self.variants),
            "variant scenario byte digests",
        )
        _require_unique(
            tuple(variant.scenario_digest_sha256 for variant in self.variants),
            "variant scenario digests",
        )
        _require_unique(
            tuple(variant.adapter_config_digest_sha256 for variant in self.variants),
            "variant adapter config digests",
        )
        return self

    def variant_by_id(self, variant_id: str) -> MaterializedVariantBinding | None:
        for variant in self.variants:
            if variant.variant_id == variant_id:
                return variant
        return None


class ShieldConfiguration(_AdequacyModel):
    schema_version: Literal["1.0"]
    name: Literal["phase3_deterministic"]
    version: Literal["1.0"]
    label: Literal["illustrative_simulation_only_not_real_vehicle_limits"]
    ttc_threshold_s: Annotated[FiniteFloat, Field(gt=0.0, le=30.0)]
    speed_cap_mps: Annotated[FiniteFloat, Field(gt=0.0, le=50.0)]
    max_observation_age_s: Annotated[FiniteFloat, Field(ge=0.0, le=10.0)]
    boundary_margin_m: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)]
    actuation_delay_compensation_s: Literal[0.0]
    emergency_stop_active: bool
    full_brake_command: Literal[1.0]
    boundary_steering_command: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)]


class CandidateShieldPlan(_AdequacyModel):
    name: Literal["deterministic"]
    version: Literal["1.0"]
    configuration: ShieldConfiguration
    config_digest_sha256: Sha256


class ComponentExpectation(_AdequacyModel):
    component: Literal["POLICY", "ADAPTER", "SIMULATOR", "GATE"]
    name: NonEmptyString
    version: NonEmptyString
    config_digest_scope: Literal["FIXED", "MATERIALIZED_VARIANT", "NOT_APPLICABLE"]
    config_digest_sha256: Sha256 | None
    source_commit: GitCommit | None

    @model_validator(mode="after")
    def require_component_specific_identity(self) -> ComponentExpectation:
        # A multi-variant MetaDrive grid cannot have one global adapter-config digest:
        # the adapter's trace-bound evidence config embeds the scenario challenge
        # payload, so every grid point has a different digest. Digest ownership is
        # therefore explicit per component rather than implied.
        expected_scope = {
            "POLICY": "FIXED",
            "GATE": "FIXED",
            "ADAPTER": "MATERIALIZED_VARIANT",
            "SIMULATOR": "NOT_APPLICABLE",
        }[self.component]
        if self.config_digest_scope != expected_scope:
            raise ValueError(
                f"{self.component} expectation requires config_digest_scope {expected_scope}"
            )
        if self.config_digest_scope == "FIXED":
            if self.config_digest_sha256 is None:
                raise ValueError("FIXED digest scope requires config_digest_sha256")
            if self.source_commit is not None:
                raise ValueError("FIXED digest scope rejects source_commit")
        elif self.config_digest_scope == "MATERIALIZED_VARIANT":
            if self.config_digest_sha256 is not None:
                raise ValueError(
                    "MATERIALIZED_VARIANT digest scope rejects a global config digest"
                )
            if self.source_commit is not None:
                raise ValueError("MATERIALIZED_VARIANT digest scope rejects source_commit")
        else:
            if self.config_digest_sha256 is not None:
                raise ValueError("NOT_APPLICABLE digest scope rejects a global config digest")
            if self.source_commit is None:
                raise ValueError("NOT_APPLICABLE digest scope requires source_commit")
        return self


class ExpectedComponents(_AdequacyModel):
    hermes_version: NonEmptyString
    policy: ComponentExpectation
    adapter: ComponentExpectation
    simulator: ComponentExpectation
    gate: ComponentExpectation

    @model_validator(mode="after")
    def require_component_roles(self) -> ExpectedComponents:
        observed = (
            self.policy.component,
            self.adapter.component,
            self.simulator.component,
            self.gate.component,
        )
        if observed != ("POLICY", "ADAPTER", "SIMULATOR", "GATE"):
            raise ValueError("expected component roles are inconsistent")
        return self


class PlannedExecution(_AdequacyModel):
    seed: Annotated[int, Field(ge=-(2**31), lt=2**31)]
    control_frequency_hz: Annotated[int, Field(ge=1, le=100)]
    horizon_steps: Annotated[int, Field(ge=1, le=10_000)]
    challenge_kind: Literal["lead_vehicle_hard_brake"]


class RegistrationLocation(_AdequacyModel):
    repository_relative_path: RelativeLocator

    @model_validator(mode="after")
    def require_relative_path(self) -> RegistrationLocation:
        _require_lexical_relative_locator(
            self.repository_relative_path, "repository_relative_path"
        )
        return self


class StudyProtocol(_AdequacyModel):
    """Complete frozen-before-discovery declared-question protocol."""

    schema_version: Literal["2.0"]
    protocol_id: Identifier
    protocol_version: Literal["1.0"]
    label: Literal["illustrative_simulation_only_declared_question"]
    scope: Literal["SIMULATION_ONLY"]
    claim_type: Literal["LEAD_TTC_INTERVENTION_ENGAGEMENT"]
    criteria: CriterionDefinition
    selection_evidence: SelectionEvidenceDefinition
    baseline_grid: Annotated[tuple[GridDimension, ...], Field(min_length=1)]
    selection_rule: SelectionRule
    valid_run_rules: Annotated[tuple[RunValidityRule, ...], Field(min_length=1)]
    exclusion_rules: Annotated[tuple[ExclusionRule, ...], Field(min_length=1)]
    materializer: MaterializerSpecification
    candidate_shield: CandidateShieldPlan
    expected_components: ExpectedComponents
    planned_execution: PlannedExecution
    registration: RegistrationLocation

    @model_validator(mode="after")
    def require_complete_unique_grid_and_rules(self) -> StudyProtocol:
        grid_parameters = tuple(dimension.parameter for dimension in self.baseline_grid)
        grid_fields = tuple(dimension.scenario_field for dimension in self.baseline_grid)
        grid_pairs = tuple(
            (dimension.parameter, dimension.scenario_field)
            for dimension in self.baseline_grid
        )
        if grid_parameters != GRID_PARAMETER_ORDER:
            raise ValueError(
                "baseline grid must declare every frozen grid parameter exactly once in order"
            )
        _require_unique(grid_parameters, "baseline grid parameters")
        _require_unique(grid_fields, "baseline grid scenario fields")
        _require_unique(grid_pairs, "baseline grid parameter/scenario field pairs")
        mapping_pairs = tuple(
            (mapping.parameter, mapping.scenario_field)
            for mapping in self.materializer.mappings
        )
        if grid_pairs != mapping_pairs:
            raise ValueError(
                "materializer mappings must exactly follow baseline grid "
                "parameter/scenario field pairs"
            )
        validity_ids = tuple(rule.rule_id for rule in self.valid_run_rules)
        exclusion_ids = tuple(rule.rule_id for rule in self.exclusion_rules)
        _require_unique(validity_ids, "valid-run rule IDs")
        _require_unique(exclusion_ids, "exclusion rule IDs")
        self._require_exhaustive_variant_table()
        return self

    def _require_exhaustive_variant_table(self) -> None:
        """The frozen variant table must be the complete declared Cartesian product."""
        expected = tuple(
            tuple(
                {"parameter": dimension.parameter, "value": value}
                for dimension, value in zip(self.baseline_grid, combination, strict=True)
            )
            for combination in product(*(dimension.values for dimension in self.baseline_grid))
        )
        variants = self.materializer.variants
        if len(variants) != len(expected):
            raise ValueError("materializer variants must exhaust the declared Cartesian grid")
        for variant, expected_parameters in zip(variants, expected, strict=True):
            observed = tuple(item.model_dump(mode="json") for item in variant.parameters)
            if observed != expected_parameters:
                raise ValueError(
                    "materializer variants must follow the declared grid order exactly"
                )
        horizon = self.planned_execution.horizon_steps
        for variant in variants:
            values = {item.parameter: item.value for item in variant.parameters}
            if values["trigger_step"] + values["brake_duration_steps"] > horizon:
                raise ValueError(
                    "every variant braking window must fit within planned horizon_steps"
                )


class GridAssignment(_AdequacyModel):
    parameter: GridParameter
    value: GridValue

    @model_validator(mode="after")
    def require_declared_domain(self) -> GridAssignment:
        validate_grid_value(self.parameter, self.value)
        return self


class DiscoveryEnvironment(_AdequacyModel):
    hermes_version: NonEmptyString
    python_version: NonEmptyString
    platform: NonEmptyString
    architecture: NonEmptyString
    repository_commit: GitCommit
    repository_dirty: Literal[False]


class SelectionObservation(_AdequacyModel):
    observation_id: Identifier
    machine_value: JsonScalar
    canonical_value: NonEmptyString
    display_value: NonEmptyString
    unit: NonEmptyString
    operator: Literal["EQ", "NE", "LT", "LTE", "GT", "GTE"]
    threshold_machine_value: JsonScalar
    sequence: NonNegativeInt | None

    @model_validator(mode="after")
    def require_exact_lexical_representation(self) -> SelectionObservation:
        canonical = _canonical_json_data(self.machine_value).decode("utf-8")
        display = self.machine_value if isinstance(self.machine_value, str) else canonical
        if self.canonical_value != canonical or self.display_value != display:
            raise ValueError(
                "selection observation text must deterministically represent machine value"
            )
        return self


class SelectionEvidence(_AdequacyModel):
    """Strict three-state result for the frozen selection-evidence derivation."""

    status: Literal["AVAILABLE", "NOT_AVAILABLE"]
    outcome: Literal[
        "OBSERVED", "NO_FINITE_CLOSING_TTC", "REQUIRED_SIGNAL_MISSING"
    ]
    observations: Annotated[tuple[SelectionObservation, ...], Field(max_length=1)]
    unavailable_reason: (
        Literal[
            "A BRAKING policy-input event lacks paired front distance and relative speed."
        ]
        | None
    )

    @model_validator(mode="after")
    def require_exact_state_cross_product(self) -> SelectionEvidence:
        if self.outcome == "OBSERVED":
            if (
                self.status != "AVAILABLE"
                or len(self.observations) != 1
                or self.unavailable_reason is not None
            ):
                raise ValueError("OBSERVED selection evidence requires one available observation")
            observation = self.observations[0]
            if (
                type(observation.machine_value) is not float
                or not math.isfinite(observation.machine_value)
                or observation.machine_value < 0.0
                or observation.sequence is None
            ):
                raise ValueError(
                    "OBSERVED selection evidence requires a nonnegative finite float and sequence"
                )
            return self
        if self.outcome == "NO_FINITE_CLOSING_TTC":
            if (
                self.status != "AVAILABLE"
                or self.observations
                or self.unavailable_reason is not None
            ):
                raise ValueError(
                    "NO_FINITE_CLOSING_TTC selection evidence must be available and empty"
                )
            return self
        if (
            self.status != "NOT_AVAILABLE"
            or self.observations
            or self.unavailable_reason != SELECTION_EVIDENCE_MISSING_REASON
        ):
            raise ValueError(
                "REQUIRED_SIGNAL_MISSING selection evidence requires the fixed reason"
            )
        return self


class ExclusionResult(_AdequacyModel):
    valid_run: bool
    disposition: Literal["INCLUDED", "EXCLUDED"]
    rule_id: RuleIdentifier | Literal["NONE"]
    rationale: NonEmptyString

    @model_validator(mode="after")
    def require_validity_to_match_disposition(self) -> ExclusionResult:
        if self.valid_run != (self.disposition == "INCLUDED"):
            raise ValueError("valid_run must match exclusion disposition")
        if self.disposition == "INCLUDED" and self.rule_id != "NONE":
            raise ValueError("included result must use NONE exclusion rule")
        if self.disposition == "EXCLUDED" and self.rule_id == "NONE":
            raise ValueError("excluded result requires a concrete rule")
        return self


class SelectionResult(_AdequacyModel):
    status: Literal["SELECTED", "NOT_SELECTED"]
    rank: PositiveInt
    tie_breaker: Literal["GRID_ORDER", "ATTEMPT_ID"]
    rationale: NonEmptyString


class DiscoveryLedgerEntry(_AdequacyModel):
    """One complete append-created baseline discovery attempt."""

    schema_version: Literal["2.0"]
    attempt_index: NonNegativeInt
    attempt_id: Identifier
    protocol_byte_digest_sha256: Sha256
    protocol_semantic_digest_sha256: Sha256
    registration_commit: GitCommit
    materialized_variant_id: Identifier
    adapter_config_digest_sha256: Sha256
    parameters: Annotated[tuple[GridAssignment, ...], Field(min_length=1)]
    command_argv: Annotated[tuple[NonEmptyString, ...], Field(min_length=1)]
    environment: DiscoveryEnvironment
    run_id: Identifier
    artifact_locator: RelativeLocator
    scenario_byte_digest_sha256: Sha256
    scenario_digest_sha256: Sha256
    bundle_digest_sha256: Sha256
    trace_digest_sha256: Sha256
    verification_status: Literal["INTERNALLY_CONSISTENT", "INVALID_EVIDENCE"]
    selection_evidence: SelectionEvidence
    selection_evidence_sha256: Sha256
    exclusion: ExclusionResult
    selection: SelectionResult

    @model_validator(mode="after")
    def require_consistent_attempt(self) -> DiscoveryLedgerEntry:
        _require_lexical_relative_locator(self.artifact_locator, "artifact_locator")
        parameters = tuple(assignment.parameter for assignment in self.parameters)
        _require_unique(parameters, "discovery parameters")
        if self.exclusion.valid_run and self.selection_evidence.outcome != "OBSERVED":
            raise ValueError("included valid attempt requires observed selection evidence")
        if self.environment.repository_commit != self.registration_commit:
            raise ValueError("discovery environment must use registration commit")
        if self.verification_status == "INVALID_EVIDENCE" and self.exclusion.valid_run:
            raise ValueError("invalid evidence cannot be a valid discovery run")
        if self.selection.status == "SELECTED":
            if not self.exclusion.valid_run:
                raise ValueError("an excluded discovery attempt cannot be selected")
            if self.selection_evidence.outcome != "OBSERVED":
                raise ValueError("selected attempt requires observed selection evidence")
        return self


class ExpectedPair(_AdequacyModel):
    baseline_run_id: Identifier
    candidate_run_id: Identifier
    selected_discovery_attempt_id: Identifier
    selected_discovery_selection_evidence_sha256: Sha256
    selected_materialized_variant_id: Identifier
    scenario_byte_digest_sha256: Sha256
    scenario_digest_sha256: Sha256
    challenge_kind: Literal["lead_vehicle_hard_brake"]
    seed: Annotated[int, Field(ge=-(2**31), lt=2**31)]
    control_frequency_hz: Annotated[int, Field(ge=1, le=100)]
    horizon_steps: Annotated[int, Field(ge=1, le=10_000)]
    hermes_version: NonEmptyString
    implementation_base_commit: GitCommit
    require_repository_dirty: Literal[False]
    policy_name: NonEmptyString
    policy_version: NonEmptyString
    policy_config_digest_sha256: Sha256
    adapter_name: NonEmptyString
    adapter_version: NonEmptyString
    adapter_config_digest_sha256: Sha256
    simulator_name: NonEmptyString
    simulator_version: NonEmptyString
    simulator_commit: GitCommit
    gate_name: NonEmptyString
    gate_version: NonEmptyString
    gate_config_digest_sha256: Sha256
    baseline_shield_name: Literal["noop"]
    baseline_shield_version: Literal["1.0"]
    baseline_shield_config_digest_sha256: Sha256
    candidate_shield_name: Literal["deterministic"]
    candidate_shield_version: Literal["1.0"]
    candidate_shield_config_digest_sha256: Sha256

    @model_validator(mode="after")
    def require_distinct_primary_runs(self) -> ExpectedPair:
        if self.baseline_run_id == self.candidate_run_id:
            raise ValueError("baseline and candidate run IDs must differ")
        return self


class PairPlan(_AdequacyModel):
    """Complete frozen-before-primary-run pair declaration."""

    schema_version: Literal["2.0"]
    pair_plan_id: Identifier
    protocol_byte_digest_sha256: Sha256
    protocol_semantic_digest_sha256: Sha256
    discovery_ledger_byte_digest_sha256: Sha256
    discovery_ledger_semantic_digest_sha256: Sha256
    expected_pair: ExpectedPair
    selected_scenario_relative_path: RelativeLocator

    @model_validator(mode="after")
    def require_relative_selected_scenario(self) -> PairPlan:
        _require_lexical_relative_locator(
            self.selected_scenario_relative_path, "selected_scenario_relative_path"
        )
        return self


class CapturedSourceIdentity(_AdequacyModel):
    """Portable identity for bytes captured under an explicit plan root."""

    relative_path: RelativeLocator
    byte_digest_sha256: Sha256
    semantic_digest_sha256: Sha256

    @model_validator(mode="after")
    def require_relative_path(self) -> CapturedSourceIdentity:
        _require_lexical_relative_locator(self.relative_path, "relative_path")
        return self


class ActionCommand(_AdequacyModel):
    steering: Annotated[FiniteFloat, Field(ge=-1.0, le=1.0)]
    throttle: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]
    brake: Annotated[FiniteFloat, Field(ge=0.0, le=1.0)]

    @model_validator(mode="after")
    def reject_conflicting_longitudinal_commands(self) -> ActionCommand:
        if self.throttle > 0.0 and self.brake > 0.0:
            raise ValueError("throttle and brake cannot both be positive")
        return self


class AssessmentEvent(_AdequacyModel):
    """Minimal verified event facts consumed by the pure scanner."""

    sequence: NonNegativeInt
    challenge_phase: ChallengePhase
    front_distance_m: Annotated[FiniteFloat | None, Field(ge=0.0)]
    front_relative_speed_mps: FiniteFloat | None
    speed_mps: Annotated[FiniteFloat, Field(ge=0.0)]
    lateral_offset_m: FiniteFloat
    observation_age_s: Annotated[FiniteFloat, Field(ge=0.0)]
    candidate_action: ActionCommand
    executed_action: ActionCommand
    override_reasons: tuple[OverrideReason, ...]

    @model_validator(mode="after")
    def require_paired_front_signals_and_reason_order(self) -> AssessmentEvent:
        if (self.front_distance_m is None) != (self.front_relative_speed_mps is None):
            raise ValueError("front distance and relative speed must be paired")
        _require_unique(self.override_reasons, "override reasons")
        indexes = tuple(_OVERRIDE_REASON_ORDER[reason] for reason in self.override_reasons)
        if indexes != tuple(sorted(indexes)):
            raise ValueError("override reasons must follow deterministic shield order")
        return self


class CapturedRepositoryProvenance(_AdequacyModel):
    """Repository facts exactly as accepted by stored verification."""

    commit: str | None
    dirty: bool | None
    reason: str | None

    @model_validator(mode="after")
    def require_truthful_availability(self) -> CapturedRepositoryProvenance:
        unavailable = self.commit is None or self.dirty is None
        if unavailable and not self.reason:
            raise ValueError("unavailable repository provenance requires a reason")
        if not unavailable and self.reason is not None:
            raise ValueError("available repository provenance cannot carry a reason")
        return self


class CapturedComponentIdentity(_AdequacyModel):
    """Observed non-simulator component identity without plan-shaped validators."""

    name: str
    version: str
    config_digest: str


class CapturedSimulatorIdentity(_AdequacyModel):
    """Observed external simulator tuple; all-null means no external simulator."""

    name: str | None
    version: str | None
    source_commit: str | None

    @model_validator(mode="after")
    def require_complete_or_absent_tuple(self) -> CapturedSimulatorIdentity:
        present = (self.name is not None, self.version is not None, self.source_commit is not None)
        if any(present) and not all(present):
            raise ValueError("captured simulator identity must be complete or all-null")
        return self


class CapturedScenario(_AdequacyModel):
    schema_version: str
    digest: str
    challenge_kind: Literal["lead_vehicle_hard_brake", "cut_in_near_field"] | None
    boundary_tolerance_m: Annotated[FiniteFloat, Field(gt=0.0, le=10.0)]


class CapturedShieldConfiguration(_AdequacyModel):
    """Runtime-valid stored shield configuration, distinct from the zero-delay plan."""

    schema_version: Literal["1.0"]
    name: Literal["phase3_deterministic"]
    version: Literal["1.0"]
    label: Literal["illustrative_simulation_only_not_real_vehicle_limits"]
    ttc_threshold_s: Annotated[FiniteFloat, Field(gt=0.0, le=30.0)]
    speed_cap_mps: Annotated[FiniteFloat, Field(gt=0.0, le=50.0)]
    max_observation_age_s: Annotated[FiniteFloat, Field(ge=0.0, le=10.0)]
    boundary_margin_m: Annotated[FiniteFloat, Field(gt=0.0, le=5.0)]
    actuation_delay_compensation_s: Annotated[FiniteFloat, Field(ge=0.0, le=5.0)]
    emergency_stop_active: bool
    full_brake_command: Literal[1.0]
    boundary_steering_command: Annotated[FiniteFloat, Field(gt=0.0, le=1.0)]


class CapturedShield(_AdequacyModel):
    """Observed shield identity without positional role or presence inference."""

    name: str
    version: str
    config_digest: str
    configuration: CapturedShieldConfiguration | None


class CapturedExecutionIdentity(_AdequacyModel):
    seed: Annotated[int, Field(ge=-(2**31), lt=2**31)]
    control_frequency_hz: Annotated[int, Field(ge=1, le=100)]
    horizon_steps: Annotated[int, Field(ge=1, le=10_000)]


class AssessmentSide(_AdequacyModel):
    """Scanner-only stored inputs; no plan or repository identity is inferred here."""

    role: Role
    boundary_tolerance_m: Annotated[FiniteFloat, Field(gt=0.0, le=10.0)]
    shield: CapturedShield
    events: Annotated[tuple[AssessmentEvent, ...], Field(min_length=1)]

    @model_validator(mode="after")
    def require_contiguous_events(self) -> AssessmentSide:
        sequences = tuple(event.sequence for event in self.events)
        if sequences != tuple(range(len(sequences))):
            raise ValueError("events must be nonempty and contiguous from sequence zero")
        return self


class CapturedArtifactSide(_AdequacyModel):
    """Complete supported stored observations used by the pure pair assessor."""

    role: Role
    run_id: NonEmptyString
    evidence_schema_version: Literal["1.0"]
    bundle_digest_sha256: Sha256
    trace_digest_sha256: Sha256
    repository: CapturedRepositoryProvenance
    hermes_version: str
    scenario: CapturedScenario
    policy: CapturedComponentIdentity
    adapter: CapturedComponentIdentity
    simulator: CapturedSimulatorIdentity
    gate: CapturedComponentIdentity
    execution: CapturedExecutionIdentity
    scanner: AssessmentSide

    @model_validator(mode="after")
    def require_scanner_role(self) -> CapturedArtifactSide:
        if self.scanner.role != self.role:
            raise ValueError("captured artifact and scanner roles must match")
        return self


class RequestedPlanSelections(_AdequacyModel):
    protocol_relative_path: RelativeLocator
    discovery_ledger_relative_path: RelativeLocator
    pair_plan_relative_path: RelativeLocator

    @model_validator(mode="after")
    def require_distinct_lexical_paths(self) -> RequestedPlanSelections:
        values = (
            self.protocol_relative_path,
            self.discovery_ledger_relative_path,
            self.pair_plan_relative_path,
        )
        for field_name, value in zip(type(self).model_fields, values, strict=True):
            _require_lexical_relative_locator(value, field_name)
        _require_unique(values, "requested plan selections")
        return self


class SideIdentity(_AdequacyModel):
    """Safe requested identity that remains representable when parsing fails."""

    role: Role
    requested_relative_locator: RelativeLocator
    observed_run_id: NonEmptyString | None
    observed_evidence_schema_version: Literal["1.0", "2.0"] | None
    observed_scenario_schema_version: NonEmptyString | None
    observed_bundle_digest_sha256: Sha256 | None
    computed_bundle_digest_sha256: Sha256 | None
    observed_trace_digest_sha256: Sha256 | None
    computed_trace_digest_sha256: Sha256 | None

    @model_validator(mode="after")
    def require_safe_consistent_identity(self) -> SideIdentity:
        _require_lexical_relative_locator(
            self.requested_relative_locator, "requested_relative_locator"
        )
        parsed = (
            self.observed_run_id,
            self.observed_evidence_schema_version,
            self.observed_scenario_schema_version,
        )
        if any(value is not None for value in parsed) and not all(
            value is not None for value in parsed
        ):
            raise ValueError("observed run and schema identity must be all-present or all-absent")
        return self


class ArtifactDiagnostic(_AdequacyModel):
    side: Role
    code: NonEmptyString
    message: NonEmptyString


class SideReviewState(_AdequacyModel):
    """Portable event-free per-side trust state."""

    identity: SideIdentity
    gate_verdict: Literal["PASS", "CONDITIONAL", "HOLD", "INVALID_EVIDENCE"] | None
    integrity: Integrity
    authenticity: Literal["NOT_AUTHENTICATED"]
    authorization: Literal["NOT_EVALUATED"]
    deployment_permission: Literal["NONE"]
    scope: Literal["SIMULATION_ONLY"]
    authoritative_status: Literal["NOT_DEFINED"]
    diagnostics: tuple[ArtifactDiagnostic, ...]

    @model_validator(mode="after")
    def require_integrity_specific_payload(self) -> SideReviewState:
        if any(item.side != self.identity.role for item in self.diagnostics):
            raise ValueError("side diagnostics must match side identity")
        if self.integrity == "UNVERIFIED":
            if (
                any(
                    value is not None
                    for value in (
                        self.identity.observed_run_id,
                        self.identity.observed_evidence_schema_version,
                        self.identity.observed_scenario_schema_version,
                        self.identity.observed_bundle_digest_sha256,
                        self.identity.computed_bundle_digest_sha256,
                        self.identity.observed_trace_digest_sha256,
                        self.identity.computed_trace_digest_sha256,
                    )
                )
                or self.gate_verdict is not None
                or self.diagnostics
            ):
                raise ValueError("unverified side cannot carry parsed or verified claims")
            return self
        if self.integrity == "INVALID_EVIDENCE":
            if (
                self.gate_verdict != "INVALID_EVIDENCE"
                or not self.diagnostics
            ):
                raise ValueError("invalid evidence must be quarantined with diagnostics")
            return self
        # Integrity and gate verdict are independent planes. A bundle can verify
        # byte-for-byte while its recomputed gate returns INVALID_EVIDENCE - for
        # example a finding set that does not match the declared profile. Rejecting
        # that here would couple adequacy to a verdict value, which is precisely the
        # coupling this phase exists to forbid.
        if self.gate_verdict not in {"PASS", "CONDITIONAL", "HOLD", "INVALID_EVIDENCE"}:
            raise ValueError("consistent evidence requires a recomputed gate verdict")
        identity = self.identity
        required = (
            identity.observed_run_id,
            identity.observed_evidence_schema_version,
            identity.observed_scenario_schema_version,
            identity.observed_bundle_digest_sha256,
            identity.computed_bundle_digest_sha256,
            identity.observed_trace_digest_sha256,
            identity.computed_trace_digest_sha256,
        )
        if any(value is None for value in required):
            raise ValueError("consistent evidence requires complete observed identity")
        if (
            identity.observed_bundle_digest_sha256
            != identity.computed_bundle_digest_sha256
            or identity.observed_trace_digest_sha256
            != identity.computed_trace_digest_sha256
        ):
            raise ValueError("consistent evidence requires matching digest roots")
        return self


class CriterionExactValue(_AdequacyModel):
    machine_value: JsonScalar
    canonical_value: NonEmptyString
    display_value: NonEmptyString
    unit: NonEmptyString

    @model_validator(mode="after")
    def require_available_exact_value(self) -> CriterionExactValue:
        if self.machine_value is None:
            raise ValueError("exact criterion value cannot be None")
        expected = _canonical_json_data(self.machine_value).decode("utf-8")
        if self.canonical_value != expected:
            raise ValueError("canonical_value must exactly encode machine_value")
        return self


class EvidenceReference(_AdequacyModel):
    side: Role
    source_file: Literal[
        "manifest.json",
        "execution-context.json",
        "scenario.resolved.yaml",
        "gate-config.resolved.yaml",
        "events.jsonl",
        "metrics.json",
        "findings.json",
        "verdict.json",
    ]
    sequence: NonNegativeInt | None
    json_pointer: NonEmptyString

    def sort_key(self) -> tuple[int, int, str, str]:
        side_rank = 0 if self.side == "BASELINE" else 1
        sequence = -1 if self.sequence is None else self.sequence
        return (side_rank, sequence, self.source_file, self.json_pointer)


class AdequacyCriterion(_AdequacyModel):
    """One status-discriminated criterion with exact values and bounded references."""

    criterion_id: Identifier
    status: CriterionStatus
    definition_category: Literal["ASSUMPTION"]
    definition: NonEmptyString
    threshold: CriterionExactValue
    observation_category: Literal["COMPUTED", "NOT_AVAILABLE"]
    observation: CriterionExactValue | None
    evidence_category: Literal["OBSERVED", "NOT_AVAILABLE"]
    rationale: NonEmptyString
    references: Annotated[tuple[EvidenceReference, ...], Field(max_length=MAX_CRITERION_REFERENCES)]
    unavailable_reason: str | None

    @model_validator(mode="after")
    def require_status_discriminated_values_and_ordered_references(self) -> AdequacyCriterion:
        if self.status is CriterionStatus.NOT_AVAILABLE:
            if (
                self.observation is not None
                or self.observation_category != "NOT_AVAILABLE"
                or self.evidence_category != "NOT_AVAILABLE"
                or not self.unavailable_reason
            ):
                raise ValueError("NOT_AVAILABLE cannot carry an observed value")
        elif (
            self.observation is None
            or self.observation_category != "COMPUTED"
            or self.evidence_category != "OBSERVED"
            or self.unavailable_reason is not None
        ):
            raise ValueError("PASS/FAIL criteria require an available exact observation")
        keys = tuple(reference.sort_key() for reference in self.references)
        if keys != tuple(sorted(keys)) or len(keys) != len(set(keys)):
            raise ValueError("criterion references must be sorted and unique")
        return self


class AdequacyAssessment(_AdequacyModel):
    status: AdequacyStatus
    observation_disposition: ObservationDisposition
    criteria: Annotated[tuple[AdequacyCriterion, ...], Field(min_length=1)]

    @model_validator(mode="after")
    def require_status_to_match_unique_criteria(self) -> AdequacyAssessment:
        criterion_ids = tuple(criterion.criterion_id for criterion in self.criteria)
        _require_unique(criterion_ids, "criterion IDs")
        if self.status is not aggregate_adequacy_status(
            tuple(criterion.status for criterion in self.criteria)
        ):
            raise ValueError("assessment status must match criterion aggregation")
        return self


class RegistrationEvidence(_AdequacyModel):
    """Local-history ordering evidence, expressly not origin authentication."""

    status: RegistrationStatus
    authenticity: Literal["NOT_AUTHENTICATED"]
    limitation: Literal[LOCAL_HISTORY_LIMITATION]
    protocol_commit: GitCommit | None
    pair_plan_commit: GitCommit | None

    @model_validator(mode="after")
    def require_status_specific_commits(self) -> RegistrationEvidence:
        has_both = self.protocol_commit is not None and self.pair_plan_commit is not None
        has_either = self.protocol_commit is not None or self.pair_plan_commit is not None
        if self.status is RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED and not has_both:
            raise ValueError("verified local ordering requires both commits")
        if self.status is RegistrationStatus.REGISTRATION_NOT_ESTABLISHED and has_either:
            raise ValueError("unestablished registration cannot carry accepted commits")
        return self


class EvaluationAdequacyEnvelope(_AdequacyModel):
    """Portable Phase 7 envelope with independent decision and trust planes."""

    schema_version: Literal["1.0"]
    hermes_version: NonEmptyString
    requested_plan_selections: RequestedPlanSelections
    baseline: SideReviewState
    candidate: SideReviewState
    compatibility: Compatibility
    compatibility_reasons: tuple[NonEmptyString, ...]
    plan_evaluation: PlanEvaluation
    plan_evaluation_reason: Literal["INVALID_EVIDENCE", "INCOMPATIBLE_EVIDENCE"] | None
    protocol_source: CapturedSourceIdentity | None
    discovery_ledger_source: CapturedSourceIdentity | None
    pair_plan_source: CapturedSourceIdentity | None
    assessment: AdequacyAssessment | None
    registration: RegistrationEvidence | None
    interpretation: Interpretation
    diagnostics: tuple[ArtifactDiagnostic, ...]
    limitations: Annotated[tuple[NonEmptyString, ...], Field(min_length=1)]

    @model_validator(mode="after")
    def require_exhaustive_decision_planes(self) -> EvaluationAdequacyEnvelope:
        if self.baseline.identity.role != "BASELINE" or self.candidate.identity.role != "CANDIDATE":
            raise ValueError("envelope sides must be ordered baseline then candidate")
        baseline_unverified = self.baseline.integrity == "UNVERIFIED"
        candidate_unverified = self.candidate.integrity == "UNVERIFIED"
        baseline_invalid = self.baseline.integrity == "INVALID_EVIDENCE"
        candidate_invalid = self.candidate.integrity == "INVALID_EVIDENCE"
        if baseline_unverified:
            raise ValueError("UNVERIFIED is allowed only for an unvisited candidate")
        if candidate_unverified and not baseline_invalid:
            raise ValueError("UNVERIFIED candidate requires baseline-first invalid evidence")
        if baseline_invalid and not candidate_unverified:
            raise ValueError("baseline-first invalid evidence requires an UNVERIFIED candidate")
        ordered_side_diagnostics = self.baseline.diagnostics + self.candidate.diagnostics
        if self.diagnostics != ordered_side_diagnostics:
            raise ValueError("envelope diagnostics must equal ordered per-side diagnostics")
        sources = (self.protocol_source, self.discovery_ledger_source, self.pair_plan_source)
        if self.plan_evaluation == "PLAN_NOT_EVALUATED":
            if (
                any(source is not None for source in sources)
                or self.assessment is not None
                or self.registration is not None
                or self.interpretation is not Interpretation.NO_INTERPRETATION
                or self.plan_evaluation_reason is None
            ):
                raise ValueError("PLAN_NOT_EVALUATED cannot expose accepted plan or assessment")
        else:
            if (
                any(source is None for source in sources)
                or self.assessment is None
                or self.registration is None
                or self.plan_evaluation_reason is not None
            ):
                raise ValueError("EVALUATED output requires sources, assessment, and registration")
            expected = interpretation_for(self.assessment.status, self.registration.status)
            if self.interpretation is not expected:
                raise ValueError("interpretation must match assessment and registration")

        if baseline_invalid or candidate_invalid:
            if (
                self.compatibility != "NOT_EVALUATED"
                or self.plan_evaluation != "PLAN_NOT_EVALUATED"
                or self.plan_evaluation_reason != "INVALID_EVIDENCE"
            ):
                raise ValueError("invalid evidence must precede compatibility and plan evaluation")
            expected_first_side = "BASELINE" if baseline_invalid else "CANDIDATE"
            if not self.diagnostics or self.diagnostics[0].side != expected_first_side:
                raise ValueError("invalid evidence diagnostics must preserve baseline-first order")
            if self.compatibility_reasons:
                raise ValueError("invalid evidence cannot carry compatibility reasons")
            return self

        if self.compatibility == "INCOMPATIBLE":
            if (
                not self.compatibility_reasons
                or self.plan_evaluation != "PLAN_NOT_EVALUATED"
                or self.plan_evaluation_reason != "INCOMPATIBLE_EVIDENCE"
            ):
                raise ValueError("incompatible evidence requires reasons and no plan evaluation")
            return self
        if self.compatibility != "COMPATIBLE" or self.compatibility_reasons:
            raise ValueError("valid evidence must be COMPATIBLE or explicitly INCOMPATIBLE")
        if self.plan_evaluation != "EVALUATED":
            raise ValueError("completed valid compatible output must evaluate plans")
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


def _canonical_json_data(value: object) -> bytes:
    return json.dumps(
        _normalize_json(value),
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def canonical_adequacy_json_bytes(model: _AdequacyModel) -> bytes:
    """Serialize one adequacy contract deterministically without changing other schemas."""

    return _canonical_json_data(model.model_dump(mode="json"))
