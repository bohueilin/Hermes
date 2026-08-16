from __future__ import annotations

import hashlib
import inspect
import math

import pytest
from pydantic import ValidationError

from hermes.adequacy.assessment import (
    _scan_lead_ttc_adequacy,
    assess_lead_ttc_adequacy,
)
from hermes.adequacy.models import (
    MAX_CRITERION_REFERENCES,
    ActionCommand,
    AdequacyAssessment,
    AdequacyCriterion,
    AdequacyStatus,
    AssessmentEvent,
    AssessmentScenario,
    AssessmentSide,
    CandidateShieldPlan,
    CapturedShield,
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
    SelectionObservation,
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


def _selection_observation() -> SelectionObservation:
    return SelectionObservation(
        observation_id="minimum_policy_input_ttc_s",
        machine_value=2.0,
        canonical_value="2.0",
        display_value="2.0",
        unit="s",
        operator="LTE",
        threshold_machine_value=2.0,
        sequence=31,
    )


def _side(
    role: str,
    events: tuple[AssessmentEvent, ...],
    *,
    configuration: ShieldConfiguration | None = None,
    horizon_steps: int | None = None,
    shield_config_digest: str | None = None,
) -> AssessmentSide:
    candidate_configuration = configuration or _configuration()
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
            config_digest_sha256=(
                shield_config_digest or _configuration_digest(candidate_configuration)
            ),
            configuration=candidate_configuration,
        )
    )
    return AssessmentSide(
        role=role,
        hermes_version="0.1.0",
        bundle_digest_sha256=_DIGEST_A,
        trace_digest_sha256=_DIGEST_B,
        repository_commit=_COMMIT,
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
            source_commit=_SIMULATOR_COMMIT,
        ),
        gate=_component("GATE", "phase2", "1.0"),
        shield=shield,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=horizon_steps or max(len(events), 1),
        fresh_selection_observations=(_selection_observation(),),
        fresh_selection_evidence_sha256=_DIGEST_A,
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


def test_gate_verdict_and_outcome_metrics_are_not_assessor_inputs() -> None:
    signature = inspect.signature(assess_lead_ttc_adequacy)
    assert tuple(signature.parameters) == ("protocol", "baseline", "candidate")

    assessment = assess_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", _engagement_events(divergence=False)),
        _side("CANDIDATE", _engagement_events()),
    )
    assert assessment.status is AdequacyStatus.ADEQUATE


def test_ten_thousand_event_boundary_is_one_pass_and_references_are_bounded() -> None:
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

    scan = _scan_lead_ttc_adequacy(
        _protocol(),
        _side("BASELINE", tuple(baseline_events), horizon_steps=10_000),
        _side("CANDIDATE", tuple(candidate_events), horizon_steps=10_000),
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
    prefix = _criterion(scan.assessment, "common_prefix_equality")
    assert prefix.status is CriterionStatus.FAIL
    assert prefix.observation is not None
    assert prefix.observation.machine_value == 9_998
    assert len(prefix.references) == MAX_CRITERION_REFERENCES
    assert all(
        len(criterion.references) <= MAX_CRITERION_REFERENCES
        for criterion in scan.assessment.criteria
    )
