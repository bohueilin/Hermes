from __future__ import annotations

import json
import math

import pytest
from pydantic import ValidationError

from hermes.adequacy.models import (
    AdequacyAssessment,
    AdequacyCriterion,
    AdequacyStatus,
    AssessmentEvent,
    AssessmentSide,
    CapturedSourceIdentity,
    CriterionDefinition,
    CriterionStatus,
    DiscoveryLedgerEntry,
    EvaluationAdequacyEnvelope,
    Interpretation,
    ObservationDisposition,
    PairPlan,
    RegistrationEvidence,
    RegistrationStatus,
    StudyProtocol,
    aggregate_adequacy_status,
    canonical_adequacy_json_bytes,
    interpretation_for,
)

_DIGEST = "a" * 64


def _protocol() -> StudyProtocol:
    return StudyProtocol(
        schema_version="1.0",
        protocol_id="lead_ttc_engagement",
        protocol_version="1.0",
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
            ("initial_gap_m", (8.0, 10.0)),
            ("actor_speed_mps", (8.0,)),
        ),
        selection_rule="lowest_attempt_id",
    )


def _source(relative_path: str = "lead.protocol.v1.yaml") -> CapturedSourceIdentity:
    return CapturedSourceIdentity(
        relative_path=relative_path,
        byte_digest_sha256=_DIGEST,
        semantic_digest_sha256="b" * 64,
        size_bytes=123,
    )


def _side(role: str = "CANDIDATE") -> AssessmentSide:
    return AssessmentSide(
        relative_locator="candidate",
        run_id="handoff-p7-lead-candidate",
        role=role,
        evidence_schema_version="1.0",
        bundle_digest_sha256=_DIGEST,
        trace_digest_sha256="b" * 64,
        repository_commit="c" * 40,
        repository_dirty=False,
        scenario_digest_sha256="d" * 64,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest_sha256="e" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest_sha256="f" * 64,
        simulator_name="metadrive",
        simulator_version="0.4.3",
        simulator_commit="1" * 40,
        shield_name="deterministic",
        shield_version="1.0",
        shield_config_digest_sha256="2" * 64,
        gate_name="phase2",
        gate_version="1.0",
        gate_config_digest_sha256="3" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=300,
        events=(
            AssessmentEvent(
                sequence=31,
                challenge_phase="BRAKING",
                front_distance_m=1.0,
                front_relative_speed_mps=-1.0,
                speed_mps=4.0,
                lateral_offset_m=0.0,
                observation_age_s=0.0,
                candidate_action=(0.0, 0.0, 0.0),
                executed_action=(0.0, 0.0, 1.0),
                override_reasons=("TTC_BELOW_THRESHOLD",),
            ),
        ),
    )


def _pair_plan() -> PairPlan:
    return PairPlan(
        schema_version="1.0",
        pair_plan_id="lead_ttc_engagement_pair",
        protocol_byte_digest_sha256=_DIGEST,
        protocol_semantic_digest_sha256="b" * 64,
        discovery_ledger_byte_digest_sha256="c" * 64,
        discovery_ledger_semantic_digest_sha256="d" * 64,
        baseline_run_id="handoff-p7-lead-baseline",
        candidate_run_id="handoff-p7-lead-candidate",
        selected_discovery_attempt_id="attempt-0001",
        selected_discovery_selection_evidence_sha256="e" * 64,
        scenario_digest_sha256="f" * 64,
        implementation_base_commit="1" * 40,
    )


def _criterion(status: CriterionStatus = CriterionStatus.PASS) -> AdequacyCriterion:
    return AdequacyCriterion(
        criterion_id="target_condition_exposure",
        status=status,
        definition="policy-input TTC is at or below the captured threshold during BRAKING",
        threshold_machine_value=2.0,
        threshold_display_value="2.0",
        threshold_unit="s",
        observation_machine_value=1.0,
        observation_display_value="1.0",
        observation_unit="s",
        rationale="fixture",
        baseline_sequences=(31,),
        candidate_sequences=(31,),
        source_references=("events.jsonl:31",),
        unavailable_reason=None,
    )


def test_protocol_ledger_pair_and_capture_contracts_are_strict_and_frozen() -> None:
    protocol = _protocol()
    ledger = DiscoveryLedgerEntry(
        schema_version="1.0",
        attempt_id="attempt-0001",
        protocol_byte_digest_sha256=_DIGEST,
        protocol_semantic_digest_sha256="b" * 64,
        registration_commit="c" * 40,
        run_id="discovery-0001",
        scenario_digest_sha256="d" * 64,
        bundle_digest_sha256="e" * 64,
        trace_digest_sha256="f" * 64,
        parameters=(("initial_gap_m", 8.0),),
        selection_evidence_sha256="1" * 64,
        selected=True,
    )

    assert protocol.model_config["extra"] == "forbid"
    assert protocol.model_config["frozen"] is True
    assert ledger.attempt_id == "attempt-0001"
    assert _pair_plan().baseline_run_id == "handoff-p7-lead-baseline"
    assert _source().relative_path == "lead.protocol.v1.yaml"
    with pytest.raises(ValidationError):
        StudyProtocol.model_validate({**protocol.model_dump(), "unexpected": True})
    with pytest.raises(ValidationError):
        protocol.criteria.__class__.model_validate(
            {**protocol.criteria.model_dump(), "policy_input_ttc_lte_s": math.inf}
        )
    with pytest.raises(ValidationError):
        protocol.criteria.minimum_phase_samples_per_arm = 11


def test_reduced_assessment_inputs_are_ordered_and_reject_unsafe_locators() -> None:
    candidate = _side()
    assert candidate.events[0].sequence == 31
    assert candidate.events[0].override_reasons == ("TTC_BELOW_THRESHOLD",)
    with pytest.raises(ValidationError, match="relative_locator"):
        _side().model_copy(update={"relative_locator": "/absolute"}).__class__.model_validate(
            {**candidate.model_dump(), "relative_locator": "/absolute"}
        )
    with pytest.raises(ValidationError):
        AssessmentEvent.model_validate(
            {**candidate.events[0].model_dump(), "candidate_action": [0.0, 0.0, 0.0]}
        )


@pytest.mark.parametrize(
    ("statuses", "expected"),
    [
        ((CriterionStatus.PASS,), AdequacyStatus.ADEQUATE),
        ((CriterionStatus.NOT_AVAILABLE,), AdequacyStatus.NOT_AVAILABLE),
        ((CriterionStatus.FAIL,), AdequacyStatus.INADEQUATE),
        ((CriterionStatus.NOT_AVAILABLE, CriterionStatus.FAIL), AdequacyStatus.INADEQUATE),
    ],
)
def test_adequacy_status_precedence_is_noncompensatory(
    statuses: tuple[CriterionStatus, ...], expected: AdequacyStatus
) -> None:
    assert aggregate_adequacy_status(statuses) is expected


def test_registration_changes_interpretation_not_adequacy() -> None:
    assert interpretation_for(
        AdequacyStatus.ADEQUATE, RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED
    ) is Interpretation.DECLARED_QUESTION_ONLY
    assert interpretation_for(
        AdequacyStatus.ADEQUATE, RegistrationStatus.REGISTRATION_NOT_ESTABLISHED
    ) is Interpretation.DESCRIPTIVE_ONLY
    assert interpretation_for(None, RegistrationStatus.REGISTRATION_NOT_ESTABLISHED) is (
        Interpretation.NO_INTERPRETATION
    )


def test_positive_local_registration_remains_unauthenticated_with_fixed_limitation() -> None:
    evidence = RegistrationEvidence(
        status=RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED,
        authenticity="NOT_AUTHENTICATED",
        limitation="Rewritable local history; no external timestamp.",
        protocol_commit="a" * 40,
        pair_plan_commit="b" * 40,
    )

    assert evidence.authenticity == "NOT_AUTHENTICATED"
    with pytest.raises(ValidationError):
        RegistrationEvidence.model_validate(
            {**evidence.model_dump(), "authenticity": "AUTHENTICATED"}
        )
    with pytest.raises(ValidationError):
        RegistrationEvidence.model_validate({**evidence.model_dump(), "limitation": "other"})


def test_envelope_is_deterministic_and_invalid_state_has_no_assessment() -> None:
    assessment = AdequacyAssessment(
        status=AdequacyStatus.ADEQUATE,
        observation_disposition=ObservationDisposition.TARGET_INTERVENTION_RECORDED,
        criteria=(_criterion(),),
    )
    envelope = EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        baseline=_side("BASELINE"),
        candidate=_side(),
        integrity="INTERNALLY_CONSISTENT",
        compatibility="COMPATIBLE",
        plan_evaluation="EVALUATED",
        protocol_source=_source(),
        discovery_ledger_source=_source("lead.discovery.v1.jsonl"),
        pair_plan_source=_source("lead.pair.v1.yaml"),
        assessment=assessment,
        registration=RegistrationEvidence(
            status=RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
            authenticity="NOT_AUTHENTICATED",
            limitation="Rewritable local history; no external timestamp.",
            protocol_commit=None,
            pair_plan_commit=None,
        ),
        interpretation=Interpretation.DESCRIPTIVE_ONLY,
        limitations=("Simulation only.",),
    )
    invalid = EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        baseline=_side("BASELINE"),
        candidate=_side(),
        integrity="INVALID_EVIDENCE",
        compatibility="NOT_EVALUATED",
        plan_evaluation="PLAN_NOT_EVALUATED",
        protocol_source=None,
        discovery_ledger_source=None,
        pair_plan_source=None,
        assessment=None,
        registration=None,
        interpretation=Interpretation.NO_INTERPRETATION,
        limitations=("Stored claims quarantined.",),
    )

    assert canonical_adequacy_json_bytes(envelope) == canonical_adequacy_json_bytes(envelope)
    serialized = json.loads(canonical_adequacy_json_bytes(envelope))
    assert serialized["assessment"]["status"] == "ADEQUATE"
    assert invalid.assessment is None
    assert invalid.interpretation is Interpretation.NO_INTERPRETATION
    with pytest.raises(ValidationError):
        EvaluationAdequacyEnvelope.model_validate(
            {**invalid.model_dump(), "assessment": assessment}
        )
