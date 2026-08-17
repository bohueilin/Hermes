from __future__ import annotations

import hashlib
import inspect
import math
from collections import Counter

import pytest
from pydantic import ValidationError

import hermes.adequacy.assessment as assessment_module
import hermes.adequacy.models as adequacy_models
from hermes.adequacy.assessment import (
    _scan_lead_ttc_adequacy,
    assess_lead_ttc_adequacy,
)
from hermes.adequacy.models import (
    MAX_CRITERION_REFERENCES,
    SELECTION_EVIDENCE_MISSING_REASON,
    ActionCommand,
    AdequacyAssessment,
    AdequacyCriterion,
    AdequacyStatus,
    AssessmentEvent,
    AssessmentSide,
    CandidateShieldPlan,
    ComponentExpectation,
    CriterionDefinition,
    CriterionStatus,
    ExclusionRule,
    ExpectedComponents,
    GridDimension,
    MaterializerFieldMapping,
    MaterializerSpecification,
    ObservationDisposition,
    PlannedExecution,
    RegistrationLocation,
    RunValidityRule,
    SelectionEvidenceDefinition,
    SelectionRule,
    ShieldConfiguration,
    StudyProtocol,
    canonical_adequacy_json_bytes,
)

_DIGEST_A = "a" * 64
_DIGEST_B = "b" * 64
_COMMIT = "c" * 40
_SIMULATOR_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"


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


def _configuration(
    *,
    speed_cap_mps: float = 20.0,
    max_observation_age_s: float = 1.0,
    emergency_stop_active: bool = False,
) -> ShieldConfiguration:
    return ShieldConfiguration(
        schema_version="1.0",
        name="phase3_deterministic",
        version="1.0",
        label="illustrative_simulation_only_not_real_vehicle_limits",
        ttc_threshold_s=2.0,
        speed_cap_mps=speed_cap_mps,
        max_observation_age_s=max_observation_age_s,
        boundary_margin_m=0.25,
        actuation_delay_compensation_s=0.0,
        emergency_stop_active=emergency_stop_active,
        full_brake_command=1.0,
        boundary_steering_command=0.5,
    )


def _configuration_digest(configuration: ShieldConfiguration) -> str:
    return hashlib.sha256(canonical_adequacy_json_bytes(configuration)).hexdigest()


def _selection_evidence_definition() -> SelectionEvidenceDefinition:
    return SelectionEvidenceDefinition(
        schema_version="1.0",
        observation_id="minimum_policy_input_ttc_s",
        event_domain="BRAKING_POLICY_INPUT_EVENTS",
        required_signals="FRONT_DISTANCE_AND_RELATIVE_SPEED",
        closing_condition="FRONT_RELATIVE_SPEED_LT_ZERO",
        value_expression="FRONT_DISTANCE_DIVIDED_BY_NEGATED_RELATIVE_SPEED",
        aggregation="MINIMUM",
        sequence_tie_breaker="EARLIEST_SEQUENCE",
        unit="s",
        operator="LTE",
        threshold_source="criteria.policy_input_ttc_lte_s",
        source_file="events.jsonl",
        source_json_pointers=(
            "/sequence",
            "/observation_summary/challenge_phase",
            "/observation_summary/front_distance_m",
            "/observation_summary/front_relative_speed_mps",
        ),
    )


def _protocol(
    *,
    minimum_phase_samples_per_arm: int = 2,
    minimum_target_override_events: int = 1,
    minimum_post_response_decision_steps: int = 1,
    configuration: ShieldConfiguration | None = None,
) -> StudyProtocol:
    config = configuration or _configuration()
    return StudyProtocol(
        schema_version="1.0",
        protocol_id="lead_ttc_engagement",
        protocol_version="1.0",
        label="illustrative_simulation_only_declared_question",
        scope="SIMULATION_ONLY",
        claim_type="LEAD_TTC_INTERVENTION_ENGAGEMENT",
        criteria=CriterionDefinition(
            required_phase="BRAKING",
            minimum_phase_samples_per_arm=minimum_phase_samples_per_arm,
            policy_input_ttc_lte_s=2.0,
            candidate_required_override_reason="TTC_BELOW_THRESHOLD",
            minimum_target_override_events=minimum_target_override_events,
            prohibit_non_target_reasons_through_first_target_response=True,
            minimum_post_response_decision_steps=minimum_post_response_decision_steps,
            actuation_delay_compensation_s=0.0,
        ),
        selection_evidence=_selection_evidence_definition(),
        baseline_grid=(
            GridDimension(
                parameter="initial_gap_m",
                scenario_field="challenge.initial_gap_m",
                values=(8.0,),
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
            ),
        ),
        candidate_shield=CandidateShieldPlan(
            name="deterministic",
            version="1.0",
            configuration=config,
            config_digest_sha256=_configuration_digest(config),
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
                source_commit=_SIMULATOR_COMMIT,
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
            repository_relative_path="evaluation-plans/lead.protocol.v1.yaml"
        ),
    )


def _action(
    *,
    steering: float = 0.0,
    throttle: float = 0.0,
    brake: float = 0.0,
) -> ActionCommand:
    return ActionCommand(
        steering=steering,
        throttle=throttle,
        brake=brake,
    )


def _event(
    sequence: int,
    *,
    phase: str = "PRE_TRIGGER",
    distance: float | None = 10.0,
    relative_speed: float | None = -1.0,
    speed: float = 4.0,
    lateral_offset: float = 0.0,
    observation_age: float = 0.0,
    candidate_action: ActionCommand | None = None,
    executed_action: ActionCommand | None = None,
    reasons: tuple[str, ...] = (),
) -> AssessmentEvent:
    proposed = candidate_action or _action()
    return AssessmentEvent(
        sequence=sequence,
        challenge_phase=phase,
        front_distance_m=distance,
        front_relative_speed_mps=relative_speed,
        speed_mps=speed,
        lateral_offset_m=lateral_offset,
        observation_age_s=observation_age,
        candidate_action=proposed,
        executed_action=executed_action or proposed,
        override_reasons=reasons,
    )


def _engagement_events(
    *,
    divergence: bool = True,
    executed_action: ActionCommand | None = None,
    reasons: tuple[str, ...] | None = None,
) -> tuple[AssessmentEvent, ...]:
    events = [
        _event(
            sequence,
            phase="PRE_TRIGGER" if sequence <= 30 else "BRAKING",
            distance=10.0 if sequence <= 30 else 2.0,
        )
        for sequence in range(34)
    ]
    if divergence:
        events[32] = _event(
            32,
            phase="BRAKING",
            distance=2.0,
            executed_action=executed_action or _action(brake=1.0),
            reasons=("TTC_BELOW_THRESHOLD",) if reasons is None else reasons,
        )
    return tuple(events)


def _side(
    role: str,
    events: tuple[AssessmentEvent, ...],
    *,
    configuration: ShieldConfiguration | None = None,
    horizon_steps: int | None = None,
    shield_config_digest: str | None = None,
) -> AssessmentSide:
    candidate_configuration = configuration or _configuration()
    captured_configuration = adequacy_models.CapturedShieldConfiguration(
        **candidate_configuration.model_dump()
    )
    shield = (
        adequacy_models.CapturedShield(
            name="noop",
            version="1.0",
            config_digest=_DIGEST_A,
            configuration=None,
        )
        if role == "BASELINE"
        else adequacy_models.CapturedShield(
            name="deterministic",
            version="1.0",
            config_digest=(
                shield_config_digest or _configuration_digest(candidate_configuration)
            ),
            configuration=captured_configuration,
        )
    )
    return AssessmentSide(
        role=role,
        boundary_tolerance_m=1.0,
        shield=shield,
        events=events,
    )


def _criterion(
    assessment: AdequacyAssessment,
    criterion_id: str,
) -> AdequacyCriterion:
    return next(item for item in assessment.criteria if item.criterion_id == criterion_id)


def _observation(assessment: AdequacyAssessment, criterion_id: str) -> object:
    criterion = _criterion(assessment, criterion_id)
    assert criterion.observation is not None
    return criterion.observation.machine_value


def test_exact_phase_entry_divergence_and_scan_endpoints() -> None:
    protocol = _protocol()
    candidate_events = _engagement_events()
    baseline_events = _engagement_events(divergence=False)

    scan = _scan_lead_ttc_adequacy(
        protocol,
        _side("BASELINE", baseline_events),
        _side("CANDIDATE", candidate_events),
    )

    assert candidate_events[30].challenge_phase == "PRE_TRIGGER"
    assert candidate_events[31].challenge_phase == "BRAKING"
    assert (
        scan.condition_sequence,
        scan.divergence_sequence,
        scan.prefix_endpoint,
        scan.confound_endpoint,
        scan.precondition_endpoint,
    ) == (31, 32, 31, 32, 30)
    assert (
        scan.prefix_events_examined,
        scan.confound_events_examined,
        scan.precondition_events_examined,
    ) == (32, 33, 31)
    assert scan.baseline_event_visits + scan.candidate_event_visits == 68
    assert scan.assessment.status is AdequacyStatus.ADEQUATE
    assert (
        scan.assessment.observation_disposition
        is ObservationDisposition.TARGET_INTERVENTION_RECORDED
    )
    assert all(item.status is CriterionStatus.PASS for item in scan.assessment.criteria)
    assert tuple(item.criterion_id for item in scan.assessment.criteria) == (
        "arm_roles_and_candidate_configuration",
        "minimum_braking_samples_per_arm",
        "common_prefix_equality",
        "target_condition_exposure",
        "at_condition_arm_alignment",
        "pre_condition_cleanliness",
        "material_target_intervention",
        "at_divergence_arm_alignment",
        "minimum_target_event_count",
        "non_target_predicates_and_reasons_clear",
        "post_response_horizon",
    )
    exposure = _criterion(scan.assessment, "target_condition_exposure")
    assert exposure.threshold.machine_value == 2.0
    assert exposure.threshold.unit == "s"
    assert exposure.observation is not None
    assert exposure.observation.machine_value == 2.0
    assert exposure.observation.unit == "s"
    assert scan.baseline_selection_evidence.model_dump(mode="json") == {
        "status": "AVAILABLE",
        "outcome": "OBSERVED",
        "observations": [
            {
                "observation_id": "minimum_policy_input_ttc_s",
                "machine_value": 2.0,
                "canonical_value": "2.0",
                "display_value": "2.0",
                "unit": "s",
                "operator": "LTE",
                "threshold_machine_value": 2.0,
                "sequence": 31,
            }
        ],
        "unavailable_reason": None,
    }
    assert scan.baseline_selection_evidence_sha256 == hashlib.sha256(
        canonical_adequacy_json_bytes(scan.baseline_selection_evidence)
    ).hexdigest()


def test_zero_sequence_condition_and_divergence_have_explicit_empty_ranges() -> None:
    baseline = (
        _event(0, phase="BRAKING", distance=1.0),
        _event(1, phase="BRAKING", distance=1.0),
    )
    candidate = (
        _event(
            0,
            phase="BRAKING",
            distance=1.0,
            executed_action=_action(brake=1.0),
            reasons=("TTC_BELOW_THRESHOLD",),
        ),
        _event(1, phase="BRAKING", distance=1.0),
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline),
        _side("CANDIDATE", candidate),
    )

    assert (
        scan.condition_sequence,
        scan.divergence_sequence,
        scan.prefix_endpoint,
        scan.confound_endpoint,
        scan.precondition_endpoint,
    ) == (0, 0, -1, 0, -1)
    assert (
        scan.prefix_events_examined,
        scan.confound_events_examined,
        scan.precondition_events_examined,
    ) == (0, 1, 0)
    assert _observation(scan.assessment, "common_prefix_equality") == 0
    assert _observation(scan.assessment, "pre_condition_cleanliness") == 0


def test_arm_configuration_and_minimum_phase_samples_are_independent_criteria() -> None:
    baseline = (
        _event(0, phase="BRAKING", distance=1.0),
        _event(1, phase="RECOVERY", distance=1.0),
    )
    candidate = (
        _event(
            0,
            phase="BRAKING",
            distance=1.0,
            executed_action=_action(brake=1.0),
            reasons=("TTC_BELOW_THRESHOLD",),
        ),
        _event(1, phase="RECOVERY", distance=1.0),
    )
    candidate_side = _side(
        "CANDIDATE",
        candidate,
        shield_config_digest=_DIGEST_A,
    )

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline),
        candidate_side,
    )

    assert (
        _criterion(assessment, "arm_roles_and_candidate_configuration").status
        is CriterionStatus.FAIL
    )
    phase = _criterion(assessment, "minimum_braking_samples_per_arm")
    assert phase.status is CriterionStatus.FAIL
    assert phase.threshold.machine_value == 2
    assert phase.observation is not None
    assert phase.observation.machine_value == 1


@pytest.mark.parametrize(
    ("distance", "relative_speed", "expected_status", "expected_disposition"),
    [
        (None, None, CriterionStatus.NOT_AVAILABLE, ObservationDisposition.EVIDENCE_NOT_AVAILABLE),
        (10.0, 0.0, CriterionStatus.FAIL, ObservationDisposition.CONDITION_NOT_OBSERVED),
        (10.0, 1.0, CriterionStatus.FAIL, ObservationDisposition.CONDITION_NOT_OBSERVED),
    ],
)
def test_missing_front_signals_are_distinct_from_available_nonclosing_evidence(
    distance: float | None,
    relative_speed: float | None,
    expected_status: CriterionStatus,
    expected_disposition: ObservationDisposition,
) -> None:
    events = tuple(
        _event(
            sequence,
            phase="BRAKING",
            distance=distance,
            relative_speed=relative_speed,
        )
        for sequence in range(3)
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", events),
        _side("CANDIDATE", events),
    )

    assert scan.condition_sequence is None
    assert scan.divergence_sequence is None
    assert (scan.prefix_endpoint, scan.confound_endpoint, scan.precondition_endpoint) == (
        2,
        2,
        2,
    )
    assert (
        scan.prefix_events_examined,
        scan.confound_events_examined,
        scan.precondition_events_examined,
    ) == (3, 3, 3)
    assert _criterion(scan.assessment, "target_condition_exposure").status is expected_status
    exposure = _criterion(scan.assessment, "target_condition_exposure")
    assert exposure.threshold.machine_value == 2.0
    assert exposure.threshold.unit == "s"
    if expected_status is CriterionStatus.FAIL:
        assert exposure.observation is not None
        assert exposure.observation.machine_value == "NO_CLOSING_FRONT_INPUT"
        assert exposure.observation.unit == "state"
    assert _criterion(scan.assessment, "common_prefix_equality").status is CriterionStatus.PASS
    assert (
        _criterion(scan.assessment, "non_target_predicates_and_reasons_clear").status
        is CriterionStatus.PASS
    )
    assert scan.assessment.status is AdequacyStatus.INADEQUATE
    assert scan.assessment.observation_disposition is expected_disposition


def test_baseline_selection_derivation_uses_finite_minimum_and_earliest_tie() -> None:
    events = (
        _event(0, phase="BRAKING", distance=3.0),
        _event(1, phase="BRAKING", distance=1.5),
        _event(2, phase="BRAKING", distance=1.5),
        _event(3, phase="BRAKING", distance=2.0, relative_speed=0.0),
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", events),
        _side("CANDIDATE", events),
    )

    evidence = scan.baseline_selection_evidence
    assert (evidence.status, evidence.outcome, evidence.unavailable_reason) == (
        "AVAILABLE",
        "OBSERVED",
        None,
    )
    assert len(evidence.observations) == 1
    observation = evidence.observations[0]
    assert (observation.machine_value, observation.sequence) == (1.5, 1)
    assert observation.canonical_value == observation.display_value == "1.5"
    assert scan.baseline_selection_evidence_sha256 == hashlib.sha256(
        canonical_adequacy_json_bytes(evidence)
    ).hexdigest()


def test_baseline_selection_missing_signal_is_sticky_over_finite_observations() -> None:
    baseline = (
        _event(0, phase="BRAKING", distance=1.5),
        _event(1, phase="BRAKING", distance=None, relative_speed=None),
        _event(2, phase="BRAKING", distance=1.0),
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline),
        _side("CANDIDATE", baseline),
    )

    evidence = scan.baseline_selection_evidence
    assert evidence.status == "NOT_AVAILABLE"
    assert evidence.outcome == "REQUIRED_SIGNAL_MISSING"
    assert evidence.observations == ()
    assert evidence.unavailable_reason == SELECTION_EVIDENCE_MISSING_REASON


@pytest.mark.parametrize(
    ("distance", "relative_speed"),
    ((10.0, 0.0), (1e308, -5e-324)),
)
def test_baseline_selection_available_no_finite_closing_ttc_never_serializes_infinity(
    distance: float,
    relative_speed: float,
) -> None:
    events = tuple(
        _event(
            sequence,
            phase="BRAKING",
            distance=distance,
            relative_speed=relative_speed,
        )
        for sequence in range(3)
    )
    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", events),
        _side("CANDIDATE", events),
    )

    evidence = scan.baseline_selection_evidence
    assert evidence.status == "AVAILABLE"
    assert evidence.outcome == "NO_FINITE_CLOSING_TTC"
    assert evidence.observations == ()
    assert evidence.unavailable_reason is None
    assert b"Infinity" not in canonical_adequacy_json_bytes(evidence)


def test_baseline_selection_empty_state_digests_are_distinct() -> None:
    missing_events = tuple(
        _event(sequence, phase="BRAKING", distance=None, relative_speed=None)
        for sequence in range(2)
    )
    nonclosing_events = tuple(
        _event(sequence, phase="BRAKING", distance=10.0, relative_speed=0.0)
        for sequence in range(2)
    )
    missing = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", missing_events),
        _side("CANDIDATE", missing_events),
    )
    nonclosing = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", nonclosing_events),
        _side("CANDIDATE", nonclosing_events),
    )

    assert missing.baseline_selection_evidence_sha256 != (
        nonclosing.baseline_selection_evidence_sha256
    )


@pytest.mark.parametrize(
    ("executed", "reasons", "expected"),
    [
        (_action(), (), ObservationDisposition.CONDITION_MET_NO_RECORDED_INTERVENTION),
        (
            _action(),
            ("TTC_BELOW_THRESHOLD",),
            ObservationDisposition.TARGET_REASON_WITHOUT_MATERIAL_ACTION,
        ),
        (
            _action(steering=0.500000000001),
            ("TTC_BELOW_THRESHOLD",),
            ObservationDisposition.TARGET_REASON_WITHOUT_MATERIAL_ACTION,
        ),
        (
            _action(brake=1.0),
            ("TTC_BELOW_THRESHOLD",),
            ObservationDisposition.TARGET_INTERVENTION_RECORDED,
        ),
        (
            _action(brake=1.0),
            ("TTC_BELOW_THRESHOLD", "SPEED_CAP"),
            ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED,
        ),
    ],
)
def test_observation_dispositions_separate_reason_action_and_confound(
    executed: ActionCommand,
    reasons: tuple[str, ...],
    expected: ObservationDisposition,
) -> None:
    candidate_action = _action(steering=0.5) if executed.steering else _action()
    candidate_events = list(_engagement_events(divergence=False))
    candidate_events[32] = _event(
        32,
        phase="BRAKING",
        distance=2.0,
        candidate_action=candidate_action,
        executed_action=executed,
        reasons=reasons,
    )
    baseline_events = list(_engagement_events(divergence=False))
    baseline_events[32] = _event(
        32,
        phase="BRAKING",
        distance=2.0,
        candidate_action=candidate_action,
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", tuple(baseline_events)),
        _side("CANDIDATE", tuple(candidate_events)),
    )
    assessment = scan.assessment

    assert assessment.observation_disposition is expected
    intervention = _criterion(assessment, "material_target_intervention")
    should_pass = expected in {
        ObservationDisposition.TARGET_INTERVENTION_RECORDED,
        ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED,
    }
    assert (intervention.status is CriterionStatus.PASS) is should_pass
    if not should_pass:
        assert scan.condition_sequence == 31
        assert scan.divergence_sequence is None
        assert (scan.prefix_endpoint, scan.confound_endpoint, scan.precondition_endpoint) == (
            33,
            33,
            30,
        )


def test_binary32_only_action_difference_is_not_material() -> None:
    wider = math.nextafter(0.5, 1.0)
    assert wider != 0.5
    candidate_events = list(_engagement_events(divergence=False))
    baseline_events = list(_engagement_events(divergence=False))
    candidate_events[32] = _event(
        32,
        phase="BRAKING",
        distance=2.0,
        candidate_action=_action(steering=0.5),
        executed_action=_action(steering=wider),
        reasons=("TTC_BELOW_THRESHOLD",),
    )
    baseline_events[32] = _event(
        32,
        phase="BRAKING",
        distance=2.0,
        candidate_action=_action(steering=0.5),
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", tuple(baseline_events)),
        _side("CANDIDATE", tuple(candidate_events)),
    )

    assert scan.divergence_sequence is None
    assert (
        scan.assessment.observation_disposition
        is ObservationDisposition.TARGET_REASON_WITHOUT_MATERIAL_ACTION
    )
    assert (
        _criterion(scan.assessment, "material_target_intervention").status
        is CriterionStatus.FAIL
    )


def test_target_evidence_before_absent_condition_is_never_credited() -> None:
    baseline = tuple(
        _event(sequence, phase="PRE_TRIGGER", distance=10.0, relative_speed=0.0)
        for sequence in range(4)
    )
    candidate = list(baseline)
    candidate[1] = _event(
        1,
        phase="PRE_TRIGGER",
        distance=10.0,
        relative_speed=0.0,
        executed_action=_action(brake=1.0),
        reasons=("TTC_BELOW_THRESHOLD",),
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline),
        _side("CANDIDATE", tuple(candidate)),
    )

    assert scan.condition_sequence is None
    assert scan.divergence_sequence is None
    assert scan.precondition_endpoint == 3
    assert scan.precondition_events_examined == 4
    assert (
        _criterion(scan.assessment, "pre_condition_cleanliness").status
        is CriterionStatus.FAIL
    )
    assert (
        _criterion(scan.assessment, "material_target_intervention").status
        is CriterionStatus.FAIL
    )
    assert (
        scan.assessment.observation_disposition
        is ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
    )


def test_typed_retained_lead_negative_control_reports_nonentry_and_speed_confound() -> None:
    baseline = tuple(
        _event(sequence, phase="BRAKING", distance=4.0, speed=21.0)
        for sequence in range(3)
    )
    candidate = tuple(
        _event(
            sequence,
            phase="BRAKING",
            distance=4.0,
            speed=21.0,
            executed_action=_action(brake=1.0),
            reasons=("SPEED_CAP",),
        )
        for sequence in range(3)
    )

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline),
        _side("CANDIDATE", candidate),
    )

    assert assessment.status is AdequacyStatus.INADEQUATE
    assert (
        _criterion(assessment, "target_condition_exposure").status
        is CriterionStatus.FAIL
    )
    assert (
        _criterion(assessment, "pre_condition_cleanliness").status
        is CriterionStatus.FAIL
    )
    assert (
        _criterion(assessment, "non_target_predicates_and_reasons_clear").status
        is CriterionStatus.FAIL
    )
    assert (
        assessment.observation_disposition
        is ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
    )


@pytest.mark.parametrize(
    ("configuration", "event_changes", "extra_reason"),
    [
        (_configuration(), {"speed": 20.0001}, None),
        (_configuration(), {"observation_age": 1.0001}, None),
        (_configuration(), {"lateral_offset": 0.75}, None),
        (_configuration(emergency_stop_active=True), {}, None),
        (_configuration(), {}, "SPEED_CAP"),
        (_configuration(), {}, "STALE_OBSERVATION"),
        (_configuration(), {}, "BOUNDARY_RISK"),
        (_configuration(), {}, "EMERGENCY_STOP"),
        (_configuration(), {}, "ACTUATION_DELAY_COMPENSATION"),
    ],
)
def test_every_non_target_predicate_and_reason_is_checked_through_e(
    configuration: ShieldConfiguration,
    event_changes: dict[str, float],
    extra_reason: str | None,
) -> None:
    candidate_events = list(_engagement_events())
    reasons = ["TTC_BELOW_THRESHOLD"]
    if extra_reason is not None:
        reasons.append(extra_reason)
    candidate_events[32] = _event(
        32,
        phase="BRAKING",
        distance=2.0,
        executed_action=_action(brake=1.0),
        reasons=tuple(reasons),
        **event_changes,
    )
    baseline_events = list(_engagement_events(divergence=False))
    baseline_events[32] = _event(32, phase="BRAKING", distance=2.0)

    assessment = assess_lead_ttc_adequacy(
        _protocol(configuration=configuration),
        _side("BASELINE", tuple(baseline_events)),
        _side("CANDIDATE", tuple(candidate_events), configuration=configuration),
    )

    criterion = _criterion(assessment, "non_target_predicates_and_reasons_clear")
    assert criterion.status is CriterionStatus.FAIL
    assert int(_observation(assessment, criterion.criterion_id)) >= 1
    assert (
        assessment.observation_disposition
        is ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
    )


def test_non_target_predicate_boundaries_and_zero_delay_are_exact() -> None:
    candidate_events = list(_engagement_events())
    candidate_events[32] = _event(
        32,
        phase="BRAKING",
        distance=2.0,
        speed=20.0,
        observation_age=1.0,
        lateral_offset=math.nextafter(0.75, 0.0),
        executed_action=_action(brake=1.0),
        reasons=("TTC_BELOW_THRESHOLD",),
    )
    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", _engagement_events(divergence=False)),
        _side("CANDIDATE", tuple(candidate_events)),
    )

    assert (
        _criterion(assessment, "non_target_predicates_and_reasons_clear").status
        is CriterionStatus.PASS
    )

    with pytest.raises(ValidationError):
        ShieldConfiguration.model_validate(
            {
                **_configuration().model_dump(),
                "actuation_delay_compensation_s": 0.000001,
            }
        )


def test_non_target_scan_includes_d_and_stops_before_events_after_e() -> None:
    candidate_events = list(_engagement_events())
    candidate_events[33] = _event(
        33,
        phase="BRAKING",
        distance=2.0,
        speed=20.5,
        reasons=("SPEED_CAP",),
        executed_action=_action(brake=1.0),
    )

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", _engagement_events(divergence=False)),
        _side("CANDIDATE", tuple(candidate_events)),
    )

    assert scan.divergence_sequence == 32
    assert scan.confound_endpoint == 32
    assert scan.confound_events_examined == 33
    assert (
        _criterion(scan.assessment, "non_target_predicates_and_reasons_clear").status
        is CriterionStatus.PASS
    )


def test_non_target_predicate_before_d_confounds_the_recorded_target_response() -> None:
    candidate_events = list(_engagement_events())
    candidate_events[31] = _event(
        31,
        phase="BRAKING",
        distance=2.0,
        speed=20.5,
        reasons=("SPEED_CAP",),
        executed_action=_action(brake=1.0),
    )

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", _engagement_events(divergence=False)),
        _side("CANDIDATE", tuple(candidate_events)),
    )

    assert (
        _criterion(assessment, "non_target_predicates_and_reasons_clear").status
        is CriterionStatus.FAIL
    )
    assert (
        assessment.observation_disposition
        is ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
    )


@pytest.mark.parametrize(
    ("baseline_length", "condition_status", "divergence_status", "prefix_status"),
    [
        (31, CriterionStatus.FAIL, CriterionStatus.FAIL, CriterionStatus.FAIL),
        (32, CriterionStatus.PASS, CriterionStatus.FAIL, CriterionStatus.PASS),
    ],
)
def test_missing_baseline_counterpart_at_c_or_d_is_available_alignment_failure(
    baseline_length: int,
    condition_status: CriterionStatus,
    divergence_status: CriterionStatus,
    prefix_status: CriterionStatus,
) -> None:
    baseline_events = _engagement_events(divergence=False)[:baseline_length]
    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline_events),
        _side("CANDIDATE", _engagement_events()),
    )

    assert scan.condition_sequence == 31
    assert scan.divergence_sequence == 32
    assert (
        _criterion(scan.assessment, "at_condition_arm_alignment").status
        is condition_status
    )
    assert (
        _criterion(scan.assessment, "at_divergence_arm_alignment").status
        is divergence_status
    )
    assert _criterion(scan.assessment, "common_prefix_equality").status is prefix_status
    assert condition_status is not CriterionStatus.NOT_AVAILABLE
    assert divergence_status is not CriterionStatus.NOT_AVAILABLE


def test_post_response_horizon_is_independent_and_available_when_d_exists() -> None:
    candidate = _engagement_events()[:33]
    baseline = _engagement_events(divergence=False)[:33]
    assessment = assess_lead_ttc_adequacy(
        _protocol(minimum_post_response_decision_steps=1),
        _side("BASELINE", baseline),
        _side("CANDIDATE", candidate),
    )

    assert _criterion(assessment, "post_response_horizon").status is CriterionStatus.FAIL
    assert _observation(assessment, "post_response_horizon") == 0


def test_independent_criterion_precedence_is_fail_then_not_available_then_pass() -> None:
    candidate = _engagement_events(divergence=False)
    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", candidate),
        _side("CANDIDATE", candidate),
    )

    assert _criterion(assessment, "target_condition_exposure").status is CriterionStatus.PASS
    assert (
        _criterion(assessment, "material_target_intervention").status
        is CriterionStatus.FAIL
    )
    assert (
        _criterion(assessment, "at_divergence_arm_alignment").status
        is CriterionStatus.NOT_AVAILABLE
    )
    assert assessment.status is AdequacyStatus.INADEQUATE


def test_target_count_references_only_events_that_satisfy_the_counted_predicate() -> None:
    baseline = tuple(
        _event(
            sequence,
            phase="PRE_TRIGGER" if sequence <= 30 else "BRAKING",
            distance=10.0 if sequence <= 30 else 2.0,
        )
        for sequence in range(43)
    )
    candidate = list(baseline)
    for sequence in range(31, 41):
        candidate[sequence] = _event(
            sequence,
            phase="BRAKING",
            distance=2.0,
            reasons=("TTC_BELOW_THRESHOLD",),
        )
    candidate[41] = _event(
        41,
        phase="BRAKING",
        distance=2.0,
        executed_action=_action(brake=1.0),
        reasons=("TTC_BELOW_THRESHOLD",),
    )

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", baseline),
        _side("CANDIDATE", tuple(candidate)),
    )

    counted = _criterion(assessment, "minimum_target_event_count")
    assert counted.status is CriterionStatus.PASS
    assert counted.observation is not None
    assert counted.observation.machine_value == 1
    assert counted.references
    assert {(reference.side, reference.sequence) for reference in counted.references} == {
        ("CANDIDATE", 41)
    }


@pytest.mark.parametrize("distance", [1.0, 1e308])
def test_finite_extreme_closing_input_with_infinite_derived_ttc_is_available_fail(
    distance: float,
) -> None:
    events = tuple(
        _event(
            sequence,
            phase="BRAKING",
            distance=distance,
            relative_speed=-5e-324,
        )
        for sequence in range(3)
    )
    relative_speed = events[0].front_relative_speed_mps
    assert relative_speed is not None
    assert math.isfinite(distance)
    assert math.isfinite(relative_speed)
    assert math.isinf(distance / -relative_speed)

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", events),
        _side("CANDIDATE", events),
    )

    exposure = _criterion(assessment, "target_condition_exposure")
    assert exposure.status is CriterionStatus.FAIL
    assert exposure.observation is not None
    assert exposure.observation.machine_value == "NO_FINITE_CLOSING_TTC"
    assert exposure.observation.unit == "state"
    assert assessment.observation_disposition is ObservationDisposition.CONDITION_NOT_OBSERVED


def test_gate_verdict_and_outcome_metrics_are_not_assessor_inputs() -> None:
    signature = inspect.signature(assess_lead_ttc_adequacy)
    assert tuple(signature.parameters) == ("protocol", "baseline", "candidate")

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", _engagement_events(divergence=False)),
        _side("CANDIDATE", _engagement_events()),
    )
    assert assessment.status is AdequacyStatus.ADEQUATE


def test_ten_thousand_event_boundary_is_one_pass_and_references_are_bounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    baseline_events: list[AssessmentEvent] = []
    candidate_events: list[AssessmentEvent] = []
    for sequence in range(10_000):
        phase = "BRAKING" if sequence >= 9_998 else "PRE_TRIGGER"
        distance = 1.0 if phase == "BRAKING" else 10.0
        baseline_events.append(_event(sequence, phase=phase, distance=distance))
        candidate_events.append(
            _event(
                sequence,
                phase=phase,
                distance=distance,
                candidate_action=(
                    _action() if sequence >= 9_998 else _action(steering=0.25)
                ),
            )
        )
    candidate_events[9_998] = _event(
        9_998,
        phase="BRAKING",
        distance=1.0,
        executed_action=_action(brake=1.0),
        reasons=("TTC_BELOW_THRESHOLD",),
    )

    baseline_side = _side("BASELINE", tuple(baseline_events), horizon_steps=10_000)
    candidate_side = _side("CANDIDATE", tuple(candidate_events), horizon_steps=10_000)
    expected_event_ids = {
        id(event) for event in baseline_side.events + candidate_side.events
    }
    assert len(expected_event_ids) == 20_000
    ttc_calls: Counter[int] = Counter()
    original_input_ttc = assessment_module._input_ttc

    def count_input_ttc(event: AssessmentEvent) -> float | None:
        ttc_calls[id(event)] += 1
        return original_input_ttc(event)

    monkeypatch.setattr(assessment_module, "_input_ttc", count_input_ttc)
    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        baseline_side,
        candidate_side,
    )

    assert (
        scan.condition_sequence,
        scan.divergence_sequence,
        scan.prefix_endpoint,
        scan.confound_endpoint,
        scan.precondition_endpoint,
    ) == (9_998, 9_998, 9_997, 9_998, 9_997)
    assert scan.baseline_event_visits == 10_000
    assert scan.candidate_event_visits == 10_000
    assert scan.baseline_event_visits + scan.candidate_event_visits <= 20_000
    assert set(ttc_calls) == expected_event_ids
    assert sum(ttc_calls.values()) == 20_000
    assert set(ttc_calls.values()) == {1}
    assert scan.baseline_selection_evidence.observations[0].sequence == 9_998
    prefix = _criterion(scan.assessment, "common_prefix_equality")
    assert prefix.status is CriterionStatus.FAIL
    assert prefix.observation is not None
    assert prefix.observation.machine_value == 9_998
    assert len(prefix.references) == MAX_CRITERION_REFERENCES
    assert all(
        len(criterion.references) <= MAX_CRITERION_REFERENCES
        for criterion in scan.assessment.criteria
    )


def _task6_runtime_configuration(*, delay: float = 0.0) -> object:
    return adequacy_models.CapturedShieldConfiguration(
        **{
            **_configuration().model_dump(),
            "actuation_delay_compensation_s": delay,
        }
    )


_TASK6_DEFAULT_CONFIG = object()


def _task6_scanner_side(
    role: str,
    events: tuple[AssessmentEvent, ...],
    *,
    shield_name: str | None = None,
    shield_digest: str | None = None,
    configuration: object | None = _TASK6_DEFAULT_CONFIG,
) -> object:
    if shield_name is None:
        shield_name = "noop" if role == "BASELINE" else "deterministic"
    if shield_digest is None:
        shield_digest = _DIGEST_A if role == "BASELINE" else _configuration_digest(_configuration())
    if (
        configuration is _TASK6_DEFAULT_CONFIG
        and role == "CANDIDATE"
        and shield_name == "deterministic"
    ):
        configuration = _task6_runtime_configuration()
    elif configuration is _TASK6_DEFAULT_CONFIG:
        configuration = None
    return adequacy_models.AssessmentSide(
        role=role,
        boundary_tolerance_m=1.0,
        shield=adequacy_models.CapturedShield(
            name=shield_name,
            version="1.0",
            config_digest=shield_digest,
            configuration=configuration,
        ),
        events=events,
    )


def _task6_captured_side(
    role: str,
    events: tuple[AssessmentEvent, ...],
    *,
    run_id: str | None = None,
    commit: str | None = _COMMIT,
    dirty: bool | None = False,
    reason: str | None = None,
    challenge_kind: str | None = "lead_vehicle_hard_brake",
    simulator: object | None = None,
    shield_name: str | None = None,
    shield_digest: str | None = None,
    configuration: object | None = _TASK6_DEFAULT_CONFIG,
) -> object:
    scanner = _task6_scanner_side(
        role,
        events,
        shield_name=shield_name,
        shield_digest=shield_digest,
        configuration=configuration,
    )
    if simulator is None:
        simulator = adequacy_models.CapturedSimulatorIdentity(
            name="metadrive",
            version="0.4.3",
            source_commit=_SIMULATOR_COMMIT,
        )
    if commit is None or dirty is None:
        reason = reason or "repository provenance unavailable"
    component = adequacy_models.CapturedComponentIdentity
    return adequacy_models.CapturedArtifactSide(
        role=role,
        run_id=run_id or f"handoff-p7-lead-{role.lower()}",
        evidence_schema_version="1.0",
        bundle_digest_sha256=_DIGEST_A,
        trace_digest_sha256=_DIGEST_B,
        repository=adequacy_models.CapturedRepositoryProvenance(
            commit=commit,
            dirty=dirty,
            reason=reason,
        ),
        hermes_version="0.1.0",
        scenario=adequacy_models.CapturedScenario(
            schema_version="2.0",
            digest=_DIGEST_A,
            challenge_kind=challenge_kind,
            boundary_tolerance_m=1.0,
        ),
        policy=component(name="metadrive-idm", version="1.0", config_digest=_DIGEST_A),
        adapter=component(name="metadrive", version="1.1", config_digest=_DIGEST_A),
        simulator=simulator,
        gate=component(name="phase2", version="1.0", config_digest=_DIGEST_A),
        execution=adequacy_models.CapturedExecutionIdentity(
            seed=7,
            control_frequency_hz=10,
            horizon_steps=300,
        ),
        scanner=scanner,
    )


def _task6_expected_pair(selection_digest: str) -> object:
    return adequacy_models.ExpectedPair(
        baseline_run_id="handoff-p7-lead-baseline",
        candidate_run_id="handoff-p7-lead-candidate",
        selected_discovery_attempt_id="attempt-0001",
        selected_discovery_selection_evidence_sha256=selection_digest,
        scenario_digest_sha256=_DIGEST_A,
        challenge_kind="lead_vehicle_hard_brake",
        seed=7,
        control_frequency_hz=10,
        horizon_steps=300,
        hermes_version="0.1.0",
        implementation_base_commit="a" * 40,
        require_repository_dirty=False,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest_sha256=_DIGEST_A,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest_sha256=_DIGEST_A,
        simulator_name="metadrive",
        simulator_version="0.4.3",
        simulator_commit=_SIMULATOR_COMMIT,
        gate_name="phase2",
        gate_version="1.0",
        gate_config_digest_sha256=_DIGEST_A,
        baseline_shield_name="noop",
        baseline_shield_version="1.0",
        baseline_shield_config_digest_sha256=_DIGEST_A,
        candidate_shield_name="deterministic",
        candidate_shield_version="1.0",
        candidate_shield_config_digest_sha256=_configuration_digest(_configuration()),
    )


def _task6_plan_inputs(
    protocol: StudyProtocol,
    baseline: object,
    candidate: object,
) -> tuple[tuple[object, ...], object]:
    scan = assessment_module._scan_lead_ttc_adequacy(
        protocol,
        baseline.scanner,
        candidate.scanner,
    )
    evidence = scan.baseline_selection_evidence
    digest = scan.baseline_selection_evidence_sha256
    selected = adequacy_models.DiscoveryLedgerEntry.model_construct(
        attempt_id="attempt-0001",
        selection=adequacy_models.SelectionResult(
            status="SELECTED",
            rank=1,
            tie_breaker="GRID_ORDER",
            rationale="fixture",
        ),
        selection_evidence=evidence,
        selection_evidence_sha256=digest,
    )
    pair = adequacy_models.PairPlan.model_construct(
        expected_pair=_task6_expected_pair(digest),
    )
    return (selected,), pair


def _task6_pair_assessment(
    *,
    baseline: object | None = None,
    candidate: object | None = None,
    ledger: tuple[object, ...] | None = None,
    pair_plan: object | None = None,
) -> AdequacyAssessment:
    protocol = _protocol()
    baseline = baseline or _task6_captured_side(
        "BASELINE", _engagement_events(divergence=False)
    )
    candidate = candidate or _task6_captured_side("CANDIDATE", _engagement_events())
    default_ledger, default_pair = _task6_plan_inputs(protocol, baseline, candidate)
    return assessment_module._assess_captured_pair(
        protocol,
        ledger or default_ledger,
        pair_plan or default_pair,
        baseline,
        candidate,
    )


def test_task6_pure_pair_assessor_prepends_exact_six_identity_criteria() -> None:
    assessment = _task6_pair_assessment()
    assert tuple(item.criterion_id for item in assessment.criteria) == (
        "primary_run_ids_match_pair_plan",
        "primary_repository_commits_match",
        "artifact_execution_identity_matches_pair_plan",
        "artifact_component_identities_match_pair_plan",
        "baseline_shield_identity_matches_pair_plan",
        "fresh_baseline_selection_reproduces_selected_discovery",
        "arm_roles_and_candidate_configuration",
        "minimum_braking_samples_per_arm",
        "common_prefix_equality",
        "target_condition_exposure",
        "at_condition_arm_alignment",
        "pre_condition_cleanliness",
        "material_target_intervention",
        "at_divergence_arm_alignment",
        "minimum_target_event_count",
        "non_target_predicates_and_reasons_clear",
        "post_response_horizon",
    )
    assert all(item.status is CriterionStatus.PASS for item in assessment.criteria)


def test_task6_first_six_available_mismatches_fail_independently() -> None:
    baseline = _task6_captured_side("BASELINE", _engagement_events(divergence=False))
    candidate = _task6_captured_side("CANDIDATE", _engagement_events())
    protocol = _protocol()
    ledger, pair = _task6_plan_inputs(protocol, baseline, candidate)
    mutations = (
        (
            "primary_run_ids_match_pair_plan",
            baseline,
            candidate.model_copy(update={"run_id": "different-run"}),
        ),
        (
            "primary_repository_commits_match",
            baseline.model_copy(
                update={
                    "repository": adequacy_models.CapturedRepositoryProvenance(
                        commit="shared-nonhex", dirty=False, reason=None
                    )
                }
            ),
            candidate.model_copy(
                update={
                    "repository": adequacy_models.CapturedRepositoryProvenance(
                        commit="shared-nonhex", dirty=False, reason=None
                    )
                }
            ),
        ),
        (
            "artifact_execution_identity_matches_pair_plan",
            baseline,
            candidate.model_copy(
                update={
                    "scenario": candidate.scenario.model_copy(
                        update={"challenge_kind": "cut_in_near_field"}
                    )
                }
            ),
        ),
        (
            "artifact_component_identities_match_pair_plan",
            baseline,
            candidate.model_copy(
                update={
                    "simulator": adequacy_models.CapturedSimulatorIdentity(
                        name=None, version=None, source_commit=None
                    )
                }
            ),
        ),
        (
            "baseline_shield_identity_matches_pair_plan",
            baseline.model_copy(
                update={
                    "scanner": baseline.scanner.model_copy(
                        update={
                            "shield": baseline.scanner.shield.model_copy(
                                update={"config_digest": _DIGEST_B}
                            )
                        }
                    )
                }
            ),
            candidate,
        ),
    )
    for criterion_id, changed_baseline, changed_candidate in mutations:
        assessment = assessment_module._assess_captured_pair(
            protocol, ledger, pair, changed_baseline, changed_candidate
        )
        assert _criterion(assessment, criterion_id).status is CriterionStatus.FAIL


def test_task6_execution_dirty_precedence_is_fail_then_missing_then_pass() -> None:
    baseline = _task6_captured_side("BASELINE", _engagement_events(divergence=False))
    candidate = _task6_captured_side("CANDIDATE", _engagement_events())
    protocol = _protocol()
    ledger, pair = _task6_plan_inputs(protocol, baseline, candidate)
    missing = baseline.model_copy(
        update={
            "repository": adequacy_models.CapturedRepositoryProvenance(
                commit=_COMMIT, dirty=None, reason="dirty state unavailable"
            )
        }
    )
    assessment = assessment_module._assess_captured_pair(
        protocol, ledger, pair, missing, candidate
    )
    assert _criterion(
        assessment, "artifact_execution_identity_matches_pair_plan"
    ).status is CriterionStatus.NOT_AVAILABLE

    mismatch_and_missing = missing.model_copy(
        update={"hermes_version": "different-observed-version"}
    )
    assessment = assessment_module._assess_captured_pair(
        protocol, ledger, pair, mismatch_and_missing, candidate
    )
    assert _criterion(
        assessment, "artifact_execution_identity_matches_pair_plan"
    ).status is CriterionStatus.FAIL

    dirty = candidate.model_copy(
        update={
            "repository": adequacy_models.CapturedRepositoryProvenance(
                commit=_COMMIT, dirty=True, reason=None
            )
        }
    )
    assessment = assessment_module._assess_captured_pair(
        protocol, ledger, pair, baseline, dirty
    )
    assert _criterion(
        assessment, "artifact_execution_identity_matches_pair_plan"
    ).status is CriterionStatus.FAIL


def test_task6_fresh_selection_reproduction_has_exact_three_state_semantics() -> None:
    protocol = _protocol()
    candidate = _task6_captured_side("CANDIDATE", _engagement_events())
    reference_baseline = _task6_captured_side(
        "BASELINE", _engagement_events(divergence=False)
    )
    ledger, pair = _task6_plan_inputs(protocol, reference_baseline, candidate)
    cases = (
        (
            tuple(
                _event(sequence, phase="BRAKING", distance=None, relative_speed=None)
                for sequence in range(3)
            ),
            CriterionStatus.NOT_AVAILABLE,
        ),
        (
            tuple(
                _event(sequence, phase="BRAKING", distance=10.0, relative_speed=0.0)
                for sequence in range(3)
            ),
            CriterionStatus.FAIL,
        ),
    )
    for events, expected in cases:
        baseline = _task6_captured_side("BASELINE", events)
        assessment = assessment_module._assess_captured_pair(
            protocol, ledger, pair, baseline, candidate
        )
        assert _criterion(
            assessment,
            "fresh_baseline_selection_reproduces_selected_discovery",
        ).status is expected


def test_task6_fresh_selection_digest_binding_mutation_is_available_fail() -> None:
    baseline = _task6_captured_side("BASELINE", _engagement_events(divergence=False))
    candidate = _task6_captured_side("CANDIDATE", _engagement_events())
    protocol = _protocol()
    ledger, pair = _task6_plan_inputs(protocol, baseline, candidate)
    pair = pair.model_copy(
        update={
            "expected_pair": pair.expected_pair.model_copy(
                update={"selected_discovery_selection_evidence_sha256": _DIGEST_A}
            )
        }
    )
    assessment = assessment_module._assess_captured_pair(
        protocol, ledger, pair, baseline, candidate
    )
    assert _criterion(
        assessment,
        "fresh_baseline_selection_reproduces_selected_discovery",
    ).status is CriterionStatus.FAIL


def test_task6_absent_candidate_configuration_has_exact_scanner_override_matrix() -> None:
    events = tuple(_event(sequence, phase="PRE_TRIGGER") for sequence in range(3))
    baseline = _task6_scanner_side("BASELINE", events)
    candidate = _task6_scanner_side(
        "CANDIDATE",
        events,
        shield_name="deterministic",
        configuration=None,
    )
    scan = assessment_module._scan_lead_ttc_adequacy(_protocol(), baseline, candidate)
    assert (
        scan.condition_sequence,
        scan.divergence_sequence,
        scan.prefix_endpoint,
        scan.precondition_endpoint,
        scan.confound_endpoint,
    ) == (None, None, 2, 2, 2)
    assert scan.assessment.observation_disposition is ObservationDisposition.EVIDENCE_NOT_AVAILABLE
    statuses = {item.criterion_id: item.status for item in scan.assessment.criteria}
    assert statuses["arm_roles_and_candidate_configuration"] is CriterionStatus.FAIL
    assert statuses["minimum_braking_samples_per_arm"] is CriterionStatus.FAIL
    assert statuses["common_prefix_equality"] is CriterionStatus.PASS
    assert statuses["pre_condition_cleanliness"] is CriterionStatus.PASS
    for criterion_id in (
        "target_condition_exposure",
        "at_condition_arm_alignment",
        "material_target_intervention",
        "at_divergence_arm_alignment",
        "minimum_target_event_count",
        "non_target_predicates_and_reasons_clear",
        "post_response_horizon",
    ):
        assert statuses[criterion_id] is CriterionStatus.NOT_AVAILABLE


@pytest.mark.parametrize(
    "phases",
    (
        (None, None, None),
        ("PRE_TRIGGER", "CUT_IN", "POST_CUT_IN"),
    ),
)
def test_task6_fake_and_cutin_phase_mismatches_complete_as_available_failures(
    phases: tuple[str | None, ...],
) -> None:
    events = tuple(
        _event(sequence, phase=phase)
        if phase is not None
        else AssessmentEvent(
            **{**_event(sequence).model_dump(), "challenge_phase": None}
        )
        for sequence, phase in enumerate(phases)
    )
    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _task6_scanner_side("BASELINE", events),
        _task6_scanner_side("CANDIDATE", events),
    )
    assert _criterion(
        assessment, "minimum_braking_samples_per_arm"
    ).status is CriterionStatus.FAIL
    assert _criterion(
        assessment, "target_condition_exposure"
    ).status is CriterionStatus.FAIL
