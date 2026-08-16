from __future__ import annotations

import ast
import json
import math
from pathlib import Path

import pytest
from pydantic import ValidationError

from hermes.adequacy.models import (
    LOCAL_HISTORY_LIMITATION,
    MAX_CRITERION_REFERENCES,
    ActionCommand,
    AdequacyAssessment,
    AdequacyCriterion,
    AdequacyStatus,
    ArtifactDiagnostic,
    AssessmentEvent,
    AssessmentScenario,
    AssessmentSide,
    CandidateShieldPlan,
    CapturedShield,
    CapturedSourceIdentity,
    ComponentExpectation,
    CriterionDefinition,
    CriterionExactValue,
    CriterionStatus,
    DiscoveryEnvironment,
    DiscoveryLedgerEntry,
    EvaluationAdequacyEnvelope,
    EvidenceReference,
    ExclusionResult,
    ExclusionRule,
    ExpectedComponents,
    ExpectedPair,
    GridAssignment,
    GridDimension,
    Interpretation,
    MaterializerFieldMapping,
    MaterializerSpecification,
    ObservationDisposition,
    PairPlan,
    PlannedExecution,
    RegistrationEvidence,
    RegistrationLocation,
    RegistrationStatus,
    RunValidityRule,
    SelectionObservation,
    SelectionResult,
    SelectionRule,
    ShieldConfiguration,
    SideIdentity,
    SideReviewState,
    StudyProtocol,
    aggregate_adequacy_status,
    canonical_adequacy_json_bytes,
    interpretation_for,
)

_DIGEST_A = "a" * 64
_DIGEST_B = "b" * 64
_COMMIT_A = "a" * 40
_COMMIT_B = "b" * 40


def _component(
    component: str,
    name: str,
    version: str,
    *,
    config_digest: str | None = _DIGEST_A,
    source_commit: str | None = None,
) -> ComponentExpectation:
    return ComponentExpectation(
        component=component,
        name=name,
        version=version,
        config_digest_sha256=config_digest,
        source_commit=source_commit,
    )


def _shield_config() -> ShieldConfiguration:
    return ShieldConfiguration(
        schema_version="1.0",
        name="phase3_deterministic",
        version="1.0",
        label="illustrative_simulation_only_not_real_vehicle_limits",
        ttc_threshold_s=2.0,
        speed_cap_mps=50.0,
        max_observation_age_s=1.0,
        boundary_margin_m=0.25,
        actuation_delay_compensation_s=0.0,
        emergency_stop_active=False,
        full_brake_command=1.0,
        boundary_steering_command=0.5,
    )


def _protocol() -> StudyProtocol:
    return StudyProtocol(
        schema_version="1.0",
        protocol_id="lead_ttc_engagement",
        protocol_version="1.0",
        label="illustrative_simulation_only_declared_question",
        scope="SIMULATION_ONLY",
        claim_type="LEAD_TTC_INTERVENTION_ENGAGEMENT",
        criteria=CriterionDefinition(
            required_phase="BRAKING",
            minimum_phase_samples_per_arm=10,
            policy_input_ttc_lte_s=2.0,
            candidate_required_override_reason="TTC_BELOW_THRESHOLD",
            minimum_target_override_events=1,
            prohibit_non_target_reasons_through_first_target_response=True,
            minimum_post_response_decision_steps=1,
            actuation_delay_compensation_s=0.0,
        ),
        baseline_grid=(
            GridDimension(
                parameter="initial_gap_m",
                scenario_field="challenge.initial_gap_m",
                values=(8.0, 10.0),
            ),
            GridDimension(
                parameter="trigger_step",
                scenario_field="challenge.trigger_step",
                values=(25, 30),
            ),
        ),
        selection_rule=SelectionRule(
            rule_id="FIRST_VALID_BY_GRID_ORDER",
            metric="POLICY_INPUT_TTC_BAND_ENTRY",
            direction="FIRST_MATCH",
            tie_breakers=("GRID_ORDER", "ATTEMPT_ID"),
        ),
        valid_run_rules=(
            RunValidityRule(
                rule_id="INTERNALLY_CONSISTENT",
                observation="INTEGRITY",
                operator="EQ",
                expected_value="INTERNALLY_CONSISTENT",
            ),
        ),
        exclusion_rules=(
            ExclusionRule(
                rule_id="INVALID_EVIDENCE",
                observation="INTEGRITY",
                operator="EQ",
                excluded_value="INVALID_EVIDENCE",
            ),
        ),
        materializer=MaterializerSpecification(
            version="1.0",
            mappings=(
                MaterializerFieldMapping(
                    parameter="initial_gap_m",
                    scenario_field="challenge.initial_gap_m",
                ),
                MaterializerFieldMapping(
                    parameter="trigger_step",
                    scenario_field="challenge.trigger_step",
                ),
            ),
        ),
        candidate_shield=CandidateShieldPlan(
            name="deterministic",
            version="1.0",
            configuration=_shield_config(),
            config_digest_sha256=_DIGEST_A,
        ),
        expected_components=ExpectedComponents(
            hermes_version="0.1.0",
            policy=_component("POLICY", "metadrive-idm", "1.0"),
            adapter=_component("ADAPTER", "metadrive", "1.1"),
            simulator=_component(
                "SIMULATOR",
                "metadrive",
                "0.4.3",
                config_digest=None,
                source_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
            ),
            gate=_component("GATE", "phase2", "1.0"),
        ),
        planned_execution=PlannedExecution(
            seed=7,
            control_frequency_hz=10,
            horizon_steps=300,
            challenge_kind="lead_vehicle_hard_brake",
        ),
        registration=RegistrationLocation(
            repository_relative_path="evaluation-plans/lead_ttc_engagement.protocol.v1.yaml"
        ),
    )


def _selection_observation() -> SelectionObservation:
    return SelectionObservation(
        observation_id="minimum_policy_input_ttc_s",
        machine_value=1.5,
        canonical_value="1.5",
        display_value="1.5",
        unit="s",
        operator="LTE",
        threshold_machine_value=2.0,
        sequence=35,
    )


def _ledger() -> DiscoveryLedgerEntry:
    return DiscoveryLedgerEntry(
        schema_version="1.0",
        attempt_index=0,
        attempt_id="attempt-0001",
        protocol_byte_digest_sha256=_DIGEST_A,
        protocol_semantic_digest_sha256=_DIGEST_B,
        registration_commit=_COMMIT_A,
        parameters=(GridAssignment(parameter="initial_gap_m", value=8.0),),
        command_argv=("python", "-m", "hermes", "run", "--run-id", "discovery-0001"),
        environment=DiscoveryEnvironment(
            hermes_version="0.1.0",
            python_version="3.11.15",
            platform="macOS-15",
            architecture="arm64",
            repository_commit=_COMMIT_A,
            repository_dirty=False,
        ),
        run_id="discovery-0001",
        artifact_locator="artifacts/discovery-0001",
        scenario_byte_digest_sha256=_DIGEST_A,
        scenario_digest_sha256=_DIGEST_B,
        bundle_digest_sha256=_DIGEST_A,
        trace_digest_sha256=_DIGEST_B,
        verification_status="INTERNALLY_CONSISTENT",
        selection_observations=(_selection_observation(),),
        selection_evidence_sha256=_DIGEST_A,
        exclusion=ExclusionResult(
            valid_run=True,
            disposition="INCLUDED",
            rule_id="NONE",
            rationale="all registered valid-run checks passed",
        ),
        selection=SelectionResult(
            status="SELECTED",
            rank=1,
            tie_breaker="GRID_ORDER",
            rationale="first valid registered attempt",
        ),
    )


def _expected_pair() -> ExpectedPair:
    return ExpectedPair(
        baseline_run_id="handoff-p7-lead-baseline",
        candidate_run_id="handoff-p7-lead-candidate",
        selected_discovery_attempt_id="attempt-0001",
        selected_discovery_selection_evidence_sha256=_DIGEST_A,
        scenario_digest_sha256=_DIGEST_B,
        challenge_kind="lead_vehicle_hard_brake",
        seed=7,
        control_frequency_hz=10,
        horizon_steps=300,
        hermes_version="0.1.0",
        implementation_base_commit=_COMMIT_A,
        require_repository_dirty=False,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest_sha256=_DIGEST_A,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest_sha256=_DIGEST_B,
        simulator_name="metadrive",
        simulator_version="0.4.3",
        simulator_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
        gate_name="phase2",
        gate_version="1.0",
        gate_config_digest_sha256=_DIGEST_A,
        baseline_shield_name="noop",
        baseline_shield_version="1.0",
        baseline_shield_config_digest_sha256=_DIGEST_A,
        candidate_shield_name="deterministic",
        candidate_shield_version="1.0",
        candidate_shield_config_digest_sha256=_DIGEST_B,
    )


def _pair_plan() -> PairPlan:
    return PairPlan(
        schema_version="1.0",
        pair_plan_id="lead_ttc_engagement_pair",
        protocol_byte_digest_sha256=_DIGEST_A,
        protocol_semantic_digest_sha256=_DIGEST_B,
        discovery_ledger_byte_digest_sha256=_DIGEST_A,
        discovery_ledger_semantic_digest_sha256=_DIGEST_B,
        expected_pair=_expected_pair(),
        selected_scenario_relative_path=(
            "scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v1.yaml"
        ),
    )


def _source(relative_path: str = "lead.protocol.v1.yaml") -> CapturedSourceIdentity:
    return CapturedSourceIdentity(
        relative_path=relative_path,
        byte_digest_sha256=_DIGEST_A,
        semantic_digest_sha256=_DIGEST_B,
    )


def _action(*, throttle: float = 0.0, brake: float = 0.0) -> ActionCommand:
    return ActionCommand(steering=0.0, throttle=throttle, brake=brake)


def _event(sequence: int = 0) -> AssessmentEvent:
    return AssessmentEvent(
        sequence=sequence,
        challenge_phase="BRAKING",
        front_distance_m=1.0,
        front_relative_speed_mps=-1.0,
        speed_mps=4.0,
        lateral_offset_m=0.0,
        observation_age_s=0.0,
        candidate_action=_action(),
        executed_action=_action(brake=1.0),
        override_reasons=("TTC_BELOW_THRESHOLD",),
    )


def _facts(role: str = "CANDIDATE") -> AssessmentSide:
    shield = (
        CapturedShield(
            name="noop",
            version="1.0",
            config_digest_sha256=_DIGEST_A,
            configuration=None,
        )
        if role == "BASELINE"
        else CapturedShield(
            name="deterministic",
            version="1.0",
            config_digest_sha256=_DIGEST_B,
            configuration=_shield_config(),
        )
    )
    return AssessmentSide(
        role=role,
        hermes_version="0.1.0",
        bundle_digest_sha256=_DIGEST_A,
        trace_digest_sha256=_DIGEST_B,
        repository_commit=_COMMIT_B,
        repository_dirty=False,
        scenario_digest_sha256=_DIGEST_A,
        scenario=AssessmentScenario(
            challenge_kind="lead_vehicle_hard_brake",
            boundary_tolerance_m=1.0,
        ),
        policy=_component("POLICY", "metadrive-idm", "1.0"),
        adapter=_component("ADAPTER", "metadrive", "1.1"),
        simulator=_component(
            "SIMULATOR",
            "metadrive",
            "0.4.3",
            config_digest=None,
            source_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
        ),
        gate=_component("GATE", "phase2", "1.0"),
        shield=shield,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=300,
        fresh_selection_observations=(_selection_observation(),),
        fresh_selection_evidence_sha256=_DIGEST_A,
        events=(_event(), _event(1)),
    )


def _identity(role: str = "CANDIDATE", *, parsed: bool = True) -> SideIdentity:
    return SideIdentity(
        role=role,
        requested_relative_locator=role.lower(),
        observed_run_id=(f"handoff-p7-lead-{role.lower()}" if parsed else None),
        observed_evidence_schema_version=("1.0" if parsed else None),
    )


def _side_state(
    role: str,
    *,
    valid: bool = True,
    diagnostics: tuple[ArtifactDiagnostic, ...] = (),
) -> SideReviewState:
    return SideReviewState(
        identity=_identity(role, parsed=valid),
        gate_verdict=("CONDITIONAL" if valid else "INVALID_EVIDENCE"),
        integrity=("INTERNALLY_CONSISTENT" if valid else "INVALID_EVIDENCE"),
        authenticity="NOT_AUTHENTICATED",
        authorization="NOT_EVALUATED",
        deployment_permission="NONE",
        scope="SIMULATION_ONLY",
        authoritative_status="NOT_DEFINED",
        assessment_facts=(_facts(role) if valid else None),
        diagnostics=diagnostics,
    )


def _unverified_side_state(role: str = "CANDIDATE") -> SideReviewState:
    return SideReviewState(
        identity=_identity(role, parsed=False),
        gate_verdict=None,
        integrity="UNVERIFIED",
        authenticity="NOT_AUTHENTICATED",
        authorization="NOT_EVALUATED",
        deployment_permission="NONE",
        scope="SIMULATION_ONLY",
        authoritative_status="NOT_DEFINED",
        assessment_facts=None,
        diagnostics=(),
    )


def _exact(value: float = 2.0) -> CriterionExactValue:
    return CriterionExactValue(
        machine_value=value,
        canonical_value=str(value),
        display_value=str(value),
        unit="s",
    )


def _reference(side: str = "BASELINE", sequence: int = 0) -> EvidenceReference:
    return EvidenceReference(
        side=side,
        source_file="events.jsonl",
        sequence=sequence,
        json_pointer="/observation_summary/front_distance_m",
    )


def _criterion(status: CriterionStatus = CriterionStatus.PASS) -> AdequacyCriterion:
    unavailable = status is CriterionStatus.NOT_AVAILABLE
    return AdequacyCriterion(
        criterion_id="target_condition_exposure",
        status=status,
        definition_category="ASSUMPTION",
        definition="policy-input TTC is at or below the captured threshold during BRAKING",
        threshold=_exact(),
        observation_category="NOT_AVAILABLE" if unavailable else "COMPUTED",
        observation=None if unavailable else _exact(1.0),
        evidence_category="NOT_AVAILABLE" if unavailable else "OBSERVED",
        rationale="required front signal is absent" if unavailable else "fixture",
        references=(_reference(),),
        unavailable_reason="front distance is absent" if unavailable else None,
    )


def _assessment(status: AdequacyStatus = AdequacyStatus.ADEQUATE) -> AdequacyAssessment:
    criterion_status = {
        AdequacyStatus.ADEQUATE: CriterionStatus.PASS,
        AdequacyStatus.INADEQUATE: CriterionStatus.FAIL,
        AdequacyStatus.NOT_AVAILABLE: CriterionStatus.NOT_AVAILABLE,
    }[status]
    return AdequacyAssessment(
        status=status,
        observation_disposition=(
            ObservationDisposition.EVIDENCE_NOT_AVAILABLE
            if status is AdequacyStatus.NOT_AVAILABLE
            else ObservationDisposition.TARGET_INTERVENTION_RECORDED
        ),
        criteria=(_criterion(criterion_status),),
    )


def _registration(status: RegistrationStatus) -> RegistrationEvidence:
    verified = status is RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED
    return RegistrationEvidence(
        status=status,
        authenticity="NOT_AUTHENTICATED",
        limitation=LOCAL_HISTORY_LIMITATION,
        protocol_commit=_COMMIT_A if verified else None,
        pair_plan_commit=_COMMIT_B if verified else None,
    )


def _completed_envelope(
    status: AdequacyStatus = AdequacyStatus.ADEQUATE,
    registration: RegistrationStatus = RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
) -> EvaluationAdequacyEnvelope:
    return EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        baseline=_side_state("BASELINE"),
        candidate=_side_state("CANDIDATE"),
        compatibility="COMPATIBLE",
        compatibility_reasons=(),
        plan_evaluation="EVALUATED",
        protocol_source=_source(),
        discovery_ledger_source=_source("lead.discovery.v1.jsonl"),
        pair_plan_source=_source("lead.pair.v1.yaml"),
        assessment=_assessment(status),
        registration=_registration(registration),
        interpretation=interpretation_for(status, registration),
        diagnostics=(),
        limitations=("Simulation only.",),
    )


def test_complete_protocol_ledger_and_pair_contracts_preserve_decision_fields() -> None:
    protocol = _protocol()
    ledger = _ledger()
    pair = _pair_plan()

    assert protocol.baseline_grid[0].scenario_field == "challenge.initial_gap_m"
    assert protocol.selection_rule.tie_breakers == ("GRID_ORDER", "ATTEMPT_ID")
    assert protocol.candidate_shield.configuration == _shield_config()
    assert protocol.expected_components.simulator.source_commit is not None
    assert protocol.planned_execution.challenge_kind == "lead_vehicle_hard_brake"
    assert protocol.registration.repository_relative_path.startswith("evaluation-plans/")
    assert ledger.command_argv[0:3] == ("python", "-m", "hermes")
    assert ledger.selection_observations == (_selection_observation(),)
    assert ledger.exclusion.valid_run is True
    assert ledger.selection.status == "SELECTED"
    assert pair.expected_pair.candidate_shield_name == "deterministic"
    assert pair.expected_pair.require_repository_dirty is False
    assert pair.selected_scenario_relative_path.startswith("scenarios/")


@pytest.mark.parametrize(
    ("field", "replacement"),
    (
        (
            "materializer",
            MaterializerSpecification(
                version="1.0",
                mappings=(
                    MaterializerFieldMapping(
                        parameter="initial_gap_m",
                        scenario_field="challenge.initial_gap_m",
                    ),
                    MaterializerFieldMapping(
                        parameter="trigger_step",
                        scenario_field="challenge.brake_duration_steps",
                    ),
                ),
            ),
        ),
        (
            "baseline_grid",
            (
                GridDimension(
                    parameter="initial_gap_m",
                    scenario_field="challenge.initial_gap_m",
                    values=(8.0, 10.0),
                ),
                GridDimension(
                    parameter="trigger_step",
                    scenario_field="challenge.initial_gap_m",
                    values=(25, 30),
                ),
            ),
        ),
    ),
)
def test_protocol_requires_exact_unique_parameter_scenario_field_pairs(
    field: str,
    replacement: object,
) -> None:
    protocol = _protocol()
    with pytest.raises(ValidationError, match="scenario field"):
        StudyProtocol.model_validate(
            {**protocol.model_dump(), field: replacement}
        )


def test_materializer_rejects_duplicate_scenario_field_mappings() -> None:
    with pytest.raises(ValidationError, match="scenario fields"):
        MaterializerSpecification(
            version="1.0",
            mappings=(
                MaterializerFieldMapping(
                    parameter="initial_gap_m",
                    scenario_field="challenge.initial_gap_m",
                ),
                MaterializerFieldMapping(
                    parameter="trigger_step",
                    scenario_field="challenge.initial_gap_m",
                ),
            ),
        )


@pytest.mark.parametrize("selection_status", ("SELECTED", "NOT_SELECTED"))
def test_included_discovery_attempt_requires_selection_observations(
    selection_status: str,
) -> None:
    ledger = _ledger()
    with pytest.raises(ValidationError, match="selection observations"):
        DiscoveryLedgerEntry.model_validate(
            {
                **ledger.model_dump(),
                "selection_observations": (),
                "selection": {
                    **ledger.selection.model_dump(),
                    "status": selection_status,
                },
            }
        )


@pytest.mark.parametrize(
    ("machine_value", "canonical_value", "display_value"),
    (
        (1.5, "1.50", "1.5"),
        (1.5, "1.5", "1.50"),
        ("observed", '"observed"', '"observed"'),
    ),
)
def test_selection_observation_requires_exact_machine_canonical_display_consistency(
    machine_value: object,
    canonical_value: str,
    display_value: str,
) -> None:
    observation = _selection_observation()
    with pytest.raises(ValidationError, match="deterministically represent"):
        SelectionObservation.model_validate(
            {
                **observation.model_dump(),
                "machine_value": machine_value,
                "canonical_value": canonical_value,
                "display_value": display_value,
            }
        )


def test_contracts_are_strict_frozen_finite_and_reject_unknown_fields() -> None:
    protocol = _protocol()
    assert protocol.model_config["extra"] == "forbid"
    assert protocol.model_config["frozen"] is True
    with pytest.raises(ValidationError):
        StudyProtocol.model_validate({**protocol.model_dump(), "unexpected": True})
    with pytest.raises(ValidationError):
        ShieldConfiguration.model_validate(
            {**_shield_config().model_dump(), "ttc_threshold_s": math.inf}
        )
    with pytest.raises(ValidationError):
        protocol.criteria.minimum_phase_samples_per_arm = 11


def test_public_captured_source_identity_excludes_filesystem_metadata() -> None:
    with pytest.raises(ValidationError):
        CapturedSourceIdentity.model_validate(
            {
                "relative_path": "lead.protocol.v1.yaml",
                "byte_digest_sha256": _DIGEST_A,
                "semantic_digest_sha256": _DIGEST_B,
                "size_bytes": 123,
            }
        )


def test_reduced_side_has_complete_predicate_inputs_and_nonempty_contiguous_events() -> None:
    candidate = _facts()
    assert candidate.scenario.boundary_tolerance_m == 1.0
    assert candidate.shield.configuration == _shield_config()
    assert tuple(event.sequence for event in candidate.events) == (0, 1)
    with pytest.raises(ValidationError, match="contiguous"):
        AssessmentSide.model_validate(
            {**candidate.model_dump(), "events": (_event(), _event(2))}
        )
    with pytest.raises(ValidationError, match="at least 1"):
        AssessmentSide.model_validate({**candidate.model_dump(), "events": ()})


@pytest.mark.parametrize(
    "updates",
    [
        {"front_distance_m": None, "front_relative_speed_mps": -1.0},
        {"override_reasons": ("SPEED_CAP", "TTC_BELOW_THRESHOLD")},
        {"override_reasons": ("TTC_BELOW_THRESHOLD", "TTC_BELOW_THRESHOLD")},
        {"override_reasons": ("UNKNOWN",)},
        {
            "candidate_action": {
                "steering": 0.0,
                "throttle": 0.5,
                "brake": 0.5,
            }
        },
    ],
)
def test_event_contract_rejects_unpaired_reasons_and_invalid_actions(
    updates: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        AssessmentEvent.model_validate({**_event().model_dump(), **updates})


def test_criterion_status_controls_value_availability_and_categories() -> None:
    available = _criterion()
    unavailable = _criterion(CriterionStatus.NOT_AVAILABLE)
    assert available.observation is not None
    assert available.observation.canonical_value == "1.0"
    assert unavailable.observation is None
    with pytest.raises(ValidationError):
        AdequacyCriterion.model_validate(
            {
                **unavailable.model_dump(),
                "observation": _exact(0.0),
            }
        )
    with pytest.raises(ValidationError):
        AdequacyCriterion.model_validate(
            {
                **available.model_dump(),
                "observation": None,
            }
        )


def test_criterion_references_are_sorted_unique_and_bounded() -> None:
    criterion = _criterion()
    assert criterion.references == (_reference(),)
    for references in (
        (_reference("CANDIDATE"), _reference("BASELINE")),
        (_reference(), _reference()),
        tuple(_reference(sequence=index) for index in range(MAX_CRITERION_REFERENCES + 1)),
    ):
        with pytest.raises(ValidationError):
            AdequacyCriterion.model_validate({**criterion.model_dump(), "references": references})


@pytest.mark.parametrize(
    ("statuses", "expected"),
    [
        ((CriterionStatus.PASS,), AdequacyStatus.ADEQUATE),
        ((CriterionStatus.NOT_AVAILABLE,), AdequacyStatus.NOT_AVAILABLE),
        ((CriterionStatus.FAIL,), AdequacyStatus.INADEQUATE),
        ((CriterionStatus.PASS, CriterionStatus.FAIL), AdequacyStatus.INADEQUATE),
        ((CriterionStatus.NOT_AVAILABLE, CriterionStatus.FAIL), AdequacyStatus.INADEQUATE),
    ],
)
def test_adequacy_status_precedence_is_noncompensatory(
    statuses: tuple[CriterionStatus, ...], expected: AdequacyStatus
) -> None:
    assert aggregate_adequacy_status(statuses) is expected


@pytest.mark.parametrize(
    ("adequacy", "registration", "expected"),
    [
        (
            AdequacyStatus.ADEQUATE,
            RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED,
            Interpretation.DECLARED_QUESTION_ONLY,
        ),
        (
            AdequacyStatus.ADEQUATE,
            RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
            Interpretation.DESCRIPTIVE_ONLY,
        ),
        (
            AdequacyStatus.INADEQUATE,
            RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED,
            Interpretation.DESCRIPTIVE_ONLY,
        ),
        (
            AdequacyStatus.INADEQUATE,
            RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
            Interpretation.DESCRIPTIVE_ONLY,
        ),
        (
            AdequacyStatus.NOT_AVAILABLE,
            RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED,
            Interpretation.DESCRIPTIVE_ONLY,
        ),
        (
            AdequacyStatus.NOT_AVAILABLE,
            RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
            Interpretation.DESCRIPTIVE_ONLY,
        ),
    ],
)
def test_full_adequacy_registration_interpretation_cross_product(
    adequacy: AdequacyStatus,
    registration: RegistrationStatus,
    expected: Interpretation,
) -> None:
    assert interpretation_for(adequacy, registration) is expected
    assert _completed_envelope(adequacy, registration).interpretation is expected


def test_plan_not_evaluated_cannot_bypass_decision_planes() -> None:
    completed = _completed_envelope()
    for forbidden_update in (
        {"plan_evaluation": "PLAN_NOT_EVALUATED"},
        {"plan_evaluation": "PLAN_NOT_EVALUATED", "protocol_source": None},
        {
            "plan_evaluation": "PLAN_NOT_EVALUATED",
            "protocol_source": None,
            "discovery_ledger_source": None,
            "pair_plan_source": None,
        },
    ):
        with pytest.raises(ValidationError):
            EvaluationAdequacyEnvelope.model_validate(
                {**completed.model_dump(), **forbidden_update}
            )


def test_invalid_baseline_is_safe_sparse_and_baseline_first() -> None:
    baseline_diagnostic = ArtifactDiagnostic(
        side="BASELINE",
        code="BUNDLE_DIGEST_MISMATCH",
        message="bundle digest did not match captured bytes",
    )
    invalid = EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        baseline=_side_state(
            "BASELINE", valid=False, diagnostics=(baseline_diagnostic,)
        ),
        candidate=_unverified_side_state(),
        compatibility="NOT_EVALUATED",
        compatibility_reasons=(),
        plan_evaluation="PLAN_NOT_EVALUATED",
        protocol_source=None,
        discovery_ledger_source=None,
        pair_plan_source=None,
        assessment=None,
        registration=None,
        interpretation=Interpretation.NO_INTERPRETATION,
        diagnostics=(baseline_diagnostic,),
        limitations=("Stored claims quarantined.",),
    )

    assert invalid.baseline.identity.observed_run_id is None
    assert invalid.baseline.assessment_facts is None
    assert invalid.baseline.gate_verdict == "INVALID_EVIDENCE"
    assert invalid.candidate.integrity == "UNVERIFIED"
    assert invalid.candidate.identity.observed_run_id is None
    assert invalid.candidate.gate_verdict is None
    assert invalid.candidate.assessment_facts is None
    assert invalid.candidate.diagnostics == ()
    assert invalid.diagnostics[0].side == "BASELINE"
    assert invalid.assessment is None

    with pytest.raises(ValidationError, match="requires an UNVERIFIED candidate"):
        EvaluationAdequacyEnvelope.model_validate(
            {**invalid.model_dump(), "candidate": _side_state("CANDIDATE")}
        )


@pytest.mark.parametrize(
    "updates",
    (
        {"identity": _identity("CANDIDATE")},
        {"gate_verdict": "HOLD"},
        {"assessment_facts": _facts("CANDIDATE")},
        {
            "diagnostics": (
                ArtifactDiagnostic(
                    side="CANDIDATE",
                    code="NOT_VISITED",
                    message="candidate was not visited",
                ),
            )
        },
    ),
)
def test_unverified_candidate_carries_no_parsed_or_verified_claims(
    updates: dict[str, object],
) -> None:
    candidate = _unverified_side_state()
    with pytest.raises(ValidationError, match="unverified"):
        SideReviewState.model_validate({**candidate.model_dump(), **updates})


def test_internally_consistent_side_requires_an_accepted_gate() -> None:
    candidate = _side_state("CANDIDATE")
    with pytest.raises(ValidationError, match="consistent evidence requires accepted gate"):
        SideReviewState.model_validate(
            {**candidate.model_dump(), "gate_verdict": None}
        )


def test_unverified_side_is_only_allowed_after_baseline_invalid_evidence() -> None:
    unverified = _unverified_side_state()
    completed = _completed_envelope()
    with pytest.raises(ValidationError, match="UNVERIFIED"):
        EvaluationAdequacyEnvelope.model_validate(
            {**completed.model_dump(), "candidate": unverified}
        )

    incompatible = EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        baseline=_side_state("BASELINE"),
        candidate=_side_state("CANDIDATE"),
        compatibility="INCOMPATIBLE",
        compatibility_reasons=("scenario digest differs",),
        plan_evaluation="PLAN_NOT_EVALUATED",
        protocol_source=None,
        discovery_ledger_source=None,
        pair_plan_source=None,
        assessment=None,
        registration=None,
        interpretation=Interpretation.NO_INTERPRETATION,
        diagnostics=(),
        limitations=("No comparison claims accepted.",),
    )
    with pytest.raises(ValidationError, match="UNVERIFIED"):
        EvaluationAdequacyEnvelope.model_validate(
            {**incompatible.model_dump(), "candidate": unverified}
        )

    with pytest.raises(ValidationError, match="UNVERIFIED"):
        EvaluationAdequacyEnvelope.model_validate(
            {
                **incompatible.model_dump(),
                "baseline": _unverified_side_state("BASELINE"),
            }
        )


def test_invalid_diagnostics_equal_ordered_per_side_diagnostics() -> None:
    side_diagnostic = ArtifactDiagnostic(
        side="BASELINE",
        code="BUNDLE_DIGEST_MISMATCH",
        message="captured mismatch",
    )
    different_diagnostic = ArtifactDiagnostic(
        side="BASELINE",
        code="TRACE_DIGEST_MISMATCH",
        message="different mismatch",
    )
    with pytest.raises(ValidationError, match="ordered per-side diagnostics"):
        EvaluationAdequacyEnvelope(
            schema_version="1.0",
            hermes_version="0.1.0",
            baseline=_side_state(
                "BASELINE", valid=False, diagnostics=(side_diagnostic,)
            ),
            candidate=_unverified_side_state(),
            compatibility="NOT_EVALUATED",
            compatibility_reasons=(),
            plan_evaluation="PLAN_NOT_EVALUATED",
            protocol_source=None,
            discovery_ledger_source=None,
            pair_plan_source=None,
            assessment=None,
            registration=None,
            interpretation=Interpretation.NO_INTERPRETATION,
            diagnostics=(different_diagnostic,),
            limitations=("Stored claims quarantined.",),
        )


def test_incompatible_valid_pair_has_no_plan_or_criteria() -> None:
    incompatible = EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        baseline=_side_state("BASELINE"),
        candidate=_side_state("CANDIDATE"),
        compatibility="INCOMPATIBLE",
        compatibility_reasons=("scenario digest differs",),
        plan_evaluation="PLAN_NOT_EVALUATED",
        protocol_source=None,
        discovery_ledger_source=None,
        pair_plan_source=None,
        assessment=None,
        registration=None,
        interpretation=Interpretation.NO_INTERPRETATION,
        diagnostics=(),
        limitations=("No comparison claims accepted.",),
    )

    assert incompatible.baseline.assessment_facts is not None
    assert incompatible.assessment is None
    assert incompatible.protocol_source is None


def test_completed_valid_compatible_output_requires_every_completed_plane() -> None:
    completed = _completed_envelope()
    for field in (
        "protocol_source",
        "discovery_ledger_source",
        "pair_plan_source",
        "assessment",
        "registration",
    ):
        with pytest.raises(ValidationError):
            EvaluationAdequacyEnvelope.model_validate(
                {**completed.model_dump(), field: None}
            )


def test_canonical_bytes_have_a_literal_oracle_and_ignore_constructor_keyword_order() -> None:
    first = SideIdentity(
        role="BASELINE",
        requested_relative_locator="baseline",
        observed_run_id=None,
        observed_evidence_schema_version=None,
    )
    second = SideIdentity(
        observed_evidence_schema_version=None,
        requested_relative_locator="baseline",
        observed_run_id=None,
        role="BASELINE",
    )

    expected = (
        b'{"observed_evidence_schema_version":null,"observed_run_id":null,'
        b'"requested_relative_locator":"baseline","role":"BASELINE"}'
    )
    assert canonical_adequacy_json_bytes(first) == expected
    assert canonical_adequacy_json_bytes(second) == expected
    assert json.loads(canonical_adequacy_json_bytes(_completed_envelope()))[
        "assessment"
    ]["status"] == "ADEQUATE"


def test_adequacy_initializer_is_documentation_only(repository_root: Path) -> None:
    source = repository_root / "src/hermes/adequacy/__init__.py"
    tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    assert len(tree.body) == 1
    assert isinstance(tree.body[0], ast.Expr)
    assert isinstance(tree.body[0].value, ast.Constant)
    assert isinstance(tree.body[0].value.value, str)
