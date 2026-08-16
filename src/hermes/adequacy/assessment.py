"""Pure one-pass assessment for the declared Phase 7 lead-TTC question."""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass, field

from hermes.adequacy.models import (
    MAX_CRITERION_REFERENCES,
    ActionCommand,
    AdequacyAssessment,
    AdequacyCriterion,
    AssessmentEvent,
    AssessmentSide,
    CriterionExactValue,
    CriterionStatus,
    EvidenceReference,
    JsonScalar,
    ObservationDisposition,
    Role,
    ShieldConfiguration,
    StudyProtocol,
    _canonical_json_data,
    aggregate_adequacy_status,
)

_TARGET_REASON = "TTC_BELOW_THRESHOLD"
_NON_TARGET_REASONS = (
    "SPEED_CAP",
    "STALE_OBSERVATION",
    "BOUNDARY_RISK",
    "EMERGENCY_STOP",
    "ACTUATION_DELAY_COMPENSATION",
)


@dataclass(frozen=True, slots=True)
class _ScanResult:
    """Assessment plus deterministic diagnostics used only by focused unit tests."""

    assessment: AdequacyAssessment
    condition_sequence: int | None
    divergence_sequence: int | None
    prefix_endpoint: int
    confound_endpoint: int
    precondition_endpoint: int
    prefix_events_examined: int
    confound_events_examined: int
    precondition_events_examined: int
    baseline_event_visits: int
    candidate_event_visits: int


@dataclass(slots=True)
class _ReferenceBuffer:
    """Keep a constant-size deterministic representative set while scanning."""

    baseline: list[EvidenceReference] = field(default_factory=list)
    candidate: list[EvidenceReference] = field(default_factory=list)
    seen: set[tuple[int, int, str, str]] = field(default_factory=set)

    def add(self, reference: EvidenceReference) -> None:
        key = reference.sort_key()
        if key in self.seen:
            return
        self.seen.add(key)
        destination = self.baseline if reference.side == "BASELINE" else self.candidate
        insert_at = len(destination)
        while insert_at and destination[insert_at - 1].sort_key() > key:
            insert_at -= 1
        destination.insert(insert_at, reference)
        if len(destination) > MAX_CRITERION_REFERENCES:
            removed = destination.pop()
            self.seen.remove(removed.sort_key())

    def extend(self, other: _ReferenceBuffer) -> None:
        for reference in other.baseline:
            self.add(reference)
        for reference in other.candidate:
            self.add(reference)

    def freeze(self) -> tuple[EvidenceReference, ...]:
        if not self.baseline:
            return tuple(self.candidate[:MAX_CRITERION_REFERENCES])
        if not self.candidate:
            return tuple(self.baseline[:MAX_CRITERION_REFERENCES])
        baseline_limit = MAX_CRITERION_REFERENCES // 2
        candidate_limit = MAX_CRITERION_REFERENCES - baseline_limit
        selected = self.baseline[:baseline_limit] + self.candidate[:candidate_limit]
        return tuple(selected)


def _reference(
    side: Role,
    sequence: int | None,
    json_pointer: str,
    *,
    source_file: str = "events.jsonl",
) -> EvidenceReference:
    return EvidenceReference(
        side=side,
        source_file=source_file,
        sequence=sequence,
        json_pointer=json_pointer,
    )


def _exact(value: JsonScalar, unit: str) -> CriterionExactValue:
    canonical = _canonical_json_data(value).decode("utf-8")
    display = value if isinstance(value, str) else canonical
    return CriterionExactValue(
        machine_value=value,
        canonical_value=canonical,
        display_value=display,
        unit=unit,
    )


def _criterion(
    *,
    criterion_id: str,
    status: CriterionStatus,
    definition: str,
    threshold: JsonScalar,
    threshold_unit: str,
    observation: JsonScalar | None,
    observation_unit: str,
    rationale: str,
    references: _ReferenceBuffer,
    unavailable_reason: str | None = None,
) -> AdequacyCriterion:
    unavailable = status is CriterionStatus.NOT_AVAILABLE
    return AdequacyCriterion(
        criterion_id=criterion_id,
        status=status,
        definition_category="ASSUMPTION",
        definition=definition,
        threshold=_exact(threshold, threshold_unit),
        observation_category="NOT_AVAILABLE" if unavailable else "COMPUTED",
        observation=None if unavailable else _exact(observation, observation_unit),
        evidence_category="NOT_AVAILABLE" if unavailable else "OBSERVED",
        rationale=rationale,
        references=references.freeze(),
        unavailable_reason=unavailable_reason if unavailable else None,
    )


def _binary32(value: float) -> float:
    return struct.unpack("!f", struct.pack("!f", value))[0]


def _material_action_difference(
    candidate: ActionCommand,
    executed: ActionCommand,
) -> bool:
    return any(
        _binary32(candidate_value) != _binary32(executed_value)
        for candidate_value, executed_value in (
            (candidate.steering, executed.steering),
            (candidate.throttle, executed.throttle),
            (candidate.brake, executed.brake),
        )
    )


def _input_ttc(event: AssessmentEvent) -> float | None:
    distance = event.front_distance_m
    relative_speed = event.front_relative_speed_mps
    if distance is None or relative_speed is None or relative_speed >= 0.0:
        return None
    ttc_s = distance / -relative_speed
    return ttc_s if math.isfinite(ttc_s) else None


def _same_prefix_event(
    baseline: AssessmentEvent,
    candidate: AssessmentEvent,
    baseline_ttc: float | None,
    candidate_ttc: float | None,
) -> bool:
    return (
        baseline.sequence == candidate.sequence
        and baseline.challenge_phase == candidate.challenge_phase
        and baseline.candidate_action == candidate.candidate_action
        and baseline.front_distance_m == candidate.front_distance_m
        and baseline.front_relative_speed_mps == candidate.front_relative_speed_mps
        and baseline_ttc == candidate_ttc
    )


def _same_at_condition(
    baseline: AssessmentEvent | None,
    candidate: AssessmentEvent,
    baseline_ttc: float | None,
    candidate_ttc: float | None,
    threshold_s: float,
) -> bool:
    return bool(
        baseline is not None
        and baseline.challenge_phase == candidate.challenge_phase
        and baseline.candidate_action == candidate.candidate_action
        and baseline.front_distance_m == candidate.front_distance_m
        and baseline.front_relative_speed_mps == candidate.front_relative_speed_mps
        and baseline_ttc == candidate_ttc
        and baseline_ttc is not None
        and candidate_ttc is not None
        and baseline_ttc <= threshold_s
        and candidate_ttc <= threshold_s
    )


def _same_at_divergence(
    baseline: AssessmentEvent | None,
    candidate: AssessmentEvent,
    baseline_ttc: float | None,
    candidate_ttc: float | None,
    candidate_material: bool,
) -> bool:
    return bool(
        baseline is not None
        and baseline.challenge_phase == candidate.challenge_phase
        and baseline.candidate_action == candidate.candidate_action
        and baseline.front_distance_m == candidate.front_distance_m
        and baseline.front_relative_speed_mps == candidate.front_relative_speed_mps
        and baseline_ttc == candidate_ttc
        and baseline.executed_action == baseline.candidate_action
        and _TARGET_REASON in candidate.override_reasons
        and candidate_material
    )


def _non_target_violations(
    event: AssessmentEvent,
    ttc_s: float | None,
    configuration: ShieldConfiguration,
    boundary_tolerance_m: float,
) -> tuple[tuple[str, str], ...]:
    references: list[tuple[str, str]] = []
    if event.speed_mps > configuration.speed_cap_mps:
        references.append(("events.jsonl", "/observation_summary/speed_mps"))
    if event.observation_age_s > configuration.max_observation_age_s:
        references.append(("events.jsonl", "/observation_summary/observation_age_s"))
    boundary_threshold = boundary_tolerance_m - configuration.boundary_margin_m
    if abs(event.lateral_offset_m) >= boundary_threshold:
        references.append(("events.jsonl", "/observation_summary/lateral_offset_m"))
    if configuration.emergency_stop_active:
        references.append(
            (
                "execution-context.json",
                "/shield/config/emergency_stop_active",
            )
        )
    delay = configuration.actuation_delay_compensation_s
    if (
        ttc_s is not None
        and delay > 0.0
        and configuration.ttc_threshold_s
        < ttc_s
        <= configuration.ttc_threshold_s + delay
    ):
        references.append(("events.jsonl", "/observation_summary/front_distance_m"))
    references.extend(
        ("events.jsonl", "/override_reasons")
        for reason in _NON_TARGET_REASONS
        if reason in event.override_reasons
    )
    return tuple(references)


def _add_event_pair_references(
    references: _ReferenceBuffer,
    baseline: AssessmentEvent | None,
    candidate: AssessmentEvent | None,
    pointer: str,
) -> None:
    if baseline is not None:
        references.add(_reference("BASELINE", baseline.sequence, pointer))
    if candidate is not None:
        references.add(_reference("CANDIDATE", candidate.sequence, pointer))


def assess_lead_ttc_adequacy(
    protocol: StudyProtocol,
    baseline: AssessmentSide,
    candidate: AssessmentSide,
) -> AdequacyAssessment:
    """Assess the declared lead-TTC question without I/O or authority inference."""

    return _scan_lead_ttc_adequacy(protocol, baseline, candidate).assessment


def _scan_lead_ttc_adequacy(
    protocol: StudyProtocol,
    baseline: AssessmentSide,
    candidate: AssessmentSide,
) -> _ScanResult:
    """Run one monotonic pass and retain bounded diagnostics for unit tests."""

    definition = protocol.criteria
    candidate_configuration = candidate.shield.configuration
    scan_configuration = candidate_configuration or protocol.candidate_shield.configuration
    threshold_s = scan_configuration.ttc_threshold_s

    role_references = _ReferenceBuffer()
    role_references.add(
        _reference(
            "BASELINE",
            None,
            "/shield",
            source_file="execution-context.json",
        )
    )
    role_references.add(
        _reference(
            "CANDIDATE",
            None,
            "/shield",
            source_file="execution-context.json",
        )
    )
    role_match = (
        baseline.role == "BASELINE"
        and baseline.shield.name == "noop"
        and baseline.shield.version == "1.0"
        and baseline.shield.configuration is None
        and candidate.role == "CANDIDATE"
        and candidate.shield.name == protocol.candidate_shield.name
        and candidate.shield.version == protocol.candidate_shield.version
        and candidate.shield.config_digest_sha256
        == protocol.candidate_shield.config_digest_sha256
        and candidate_configuration == protocol.candidate_shield.configuration
        and candidate_configuration is not None
        and candidate_configuration.ttc_threshold_s
        == definition.policy_input_ttc_lte_s
        and candidate_configuration.actuation_delay_compensation_s
        == definition.actuation_delay_compensation_s
        == 0.0
    )

    phase_references = _ReferenceBuffer()
    prefix_references = _ReferenceBuffer()
    pending_tail_references = _ReferenceBuffer()
    condition_references = _ReferenceBuffer()
    condition_alignment_references = _ReferenceBuffer()
    cleanliness_references = _ReferenceBuffer()
    intervention_references = _ReferenceBuffer()
    divergence_alignment_references = _ReferenceBuffer()
    target_count_references = _ReferenceBuffer()
    non_target_references = _ReferenceBuffer()
    non_target_references.add(
        _reference(
            "CANDIDATE",
            None,
            "/shield/config",
            source_file="execution-context.json",
        )
    )
    non_target_references.add(
        _reference(
            "CANDIDATE",
            None,
            "/road/boundary_tolerance_m",
            source_file="scenario.resolved.yaml",
        )
    )
    post_references = _ReferenceBuffer()

    baseline_phase_count = 0
    candidate_phase_count = 0
    baseline_event_visits = 0
    candidate_event_visits = 0
    condition_sequence: int | None = None
    divergence_sequence: int | None = None
    condition_match_count = 0
    condition_entry_ttc: float | None = None
    minimum_closing_braking_ttc: float | None = None
    condition_nonfinite_derived_ttc = False
    condition_signal_missing = False
    condition_alignment: bool | None = None
    divergence_alignment: bool | None = None
    prefix_mismatch_count = 0
    pending_tail_mismatch_count = 0
    precondition_violation_count = 0
    target_event_count = 0
    non_target_violation_count = 0
    target_reason_after_condition = False

    baseline_events = baseline.events
    candidate_events = candidate.events
    for index in range(max(len(baseline_events), len(candidate_events))):
        baseline_event = baseline_events[index] if index < len(baseline_events) else None
        candidate_event = candidate_events[index] if index < len(candidate_events) else None
        baseline_ttc: float | None = None
        candidate_ttc: float | None = None
        candidate_event_material = False

        if baseline_event is not None:
            baseline_event_visits += 1
            baseline_ttc = _input_ttc(baseline_event)
            if baseline_event.challenge_phase == definition.required_phase:
                baseline_phase_count += 1
                phase_references.add(
                    _reference(
                        "BASELINE",
                        index,
                        "/observation_summary/challenge_phase",
                    )
                )

        divergence_before_event = divergence_sequence
        if candidate_event is not None:
            candidate_event_visits += 1
            candidate_ttc = _input_ttc(candidate_event)
            candidate_event_material = _material_action_difference(
                candidate_event.candidate_action,
                candidate_event.executed_action,
            )
            if candidate_event.challenge_phase == definition.required_phase:
                candidate_phase_count += 1
                phase_references.add(
                    _reference(
                        "CANDIDATE",
                        index,
                        "/observation_summary/challenge_phase",
                    )
                )
                if (
                    candidate_event.front_distance_m is None
                    or candidate_event.front_relative_speed_mps is None
                ):
                    condition_signal_missing = True
                    condition_references.add(
                        _reference(
                            "CANDIDATE",
                            index,
                            "/observation_summary/front_distance_m",
                        )
                    )
                else:
                    condition_references.add(
                        _reference(
                            "CANDIDATE",
                            index,
                            "/observation_summary/front_distance_m",
                        )
                    )
                    if candidate_ttc is not None:
                        minimum_closing_braking_ttc = (
                            candidate_ttc
                            if minimum_closing_braking_ttc is None
                            else min(minimum_closing_braking_ttc, candidate_ttc)
                        )
                        if candidate_ttc <= threshold_s:
                            condition_match_count += 1
                            if condition_sequence is None:
                                condition_sequence = index
                                condition_entry_ttc = candidate_ttc
                                condition_alignment = _same_at_condition(
                                    baseline_event,
                                    candidate_event,
                                    baseline_ttc,
                                    candidate_ttc,
                                    threshold_s,
                                )
                                _add_event_pair_references(
                                    condition_alignment_references,
                                    baseline_event,
                                    candidate_event,
                                    "/observation_summary/front_distance_m",
                                )
                    elif candidate_event.front_relative_speed_mps < 0.0:
                        condition_nonfinite_derived_ttc = True

            if condition_sequence is None:
                if _TARGET_REASON in candidate_event.override_reasons:
                    precondition_violation_count += 1
                    cleanliness_references.add(
                        _reference("CANDIDATE", index, "/override_reasons")
                    )
                if candidate_event_material:
                    precondition_violation_count += 1
                    cleanliness_references.add(
                        _reference("CANDIDATE", index, "/executed_action")
                    )

            if (
                condition_sequence is not None
                and index >= condition_sequence
                and _TARGET_REASON in candidate_event.override_reasons
            ):
                target_reason_after_condition = True
                intervention_references.add(
                    _reference("CANDIDATE", index, "/override_reasons")
                )

            if (
                divergence_sequence is None
                and condition_sequence is not None
                and index >= condition_sequence
                and _TARGET_REASON in candidate_event.override_reasons
                and candidate_event_material
            ):
                divergence_sequence = index
                divergence_alignment = _same_at_divergence(
                    baseline_event,
                    candidate_event,
                    baseline_ttc,
                    candidate_ttc,
                    candidate_event_material,
                )
                _add_event_pair_references(
                    intervention_references,
                    baseline_event,
                    candidate_event,
                    "/executed_action",
                )
                _add_event_pair_references(
                    divergence_alignment_references,
                    baseline_event,
                    candidate_event,
                    "/observation_summary/front_distance_m",
                )

            if (
                _TARGET_REASON in candidate_event.override_reasons
                and candidate_event_material
                and candidate_ttc is not None
                and candidate_ttc <= threshold_s
            ):
                target_event_count += 1
                target_count_references.add(
                    _reference("CANDIDATE", index, "/override_reasons")
                )

            if divergence_before_event is None:
                violations = _non_target_violations(
                    candidate_event,
                    candidate_ttc,
                    scan_configuration,
                    candidate.scenario.boundary_tolerance_m,
                )
                non_target_violation_count += len(violations)
                for source_file, pointer in violations:
                    non_target_references.add(
                        _reference(
                            "CANDIDATE",
                            index,
                            pointer,
                            source_file=source_file,
                        )
                    )

        if divergence_sequence is None:
            if baseline_event is not None and candidate_event is not None:
                if not _same_prefix_event(
                    baseline_event,
                    candidate_event,
                    baseline_ttc,
                    candidate_ttc,
                ):
                    prefix_mismatch_count += 1
                    _add_event_pair_references(
                        prefix_references,
                        baseline_event,
                        candidate_event,
                        "/candidate_action",
                    )
            elif candidate_event is not None:
                pending_tail_mismatch_count += 1
                pending_tail_references.add(
                    _reference("CANDIDATE", index, "/sequence")
                )
        elif divergence_before_event is None:
            prefix_mismatch_count += pending_tail_mismatch_count
            prefix_references.extend(pending_tail_references)

    prefix_endpoint = (
        divergence_sequence - 1
        if divergence_sequence is not None
        else min(len(baseline_events), len(candidate_events)) - 1
    )
    confound_endpoint = (
        divergence_sequence
        if divergence_sequence is not None
        else len(candidate_events) - 1
    )
    precondition_endpoint = (
        condition_sequence - 1
        if condition_sequence is not None
        else len(candidate_events) - 1
    )
    prefix_events_examined = prefix_endpoint + 1
    confound_events_examined = confound_endpoint + 1
    precondition_events_examined = precondition_endpoint + 1
    if prefix_endpoint >= 0:
        for sequence in (0, prefix_endpoint):
            if sequence < len(baseline_events):
                prefix_references.add(_reference("BASELINE", sequence, "/sequence"))
            if sequence < len(candidate_events):
                prefix_references.add(_reference("CANDIDATE", sequence, "/sequence"))
    if precondition_endpoint >= 0:
        cleanliness_references.add(
            _reference("CANDIDATE", precondition_endpoint, "/override_reasons")
        )
    if confound_endpoint >= 0:
        non_target_references.add(
            _reference("CANDIDATE", confound_endpoint, "/observation_summary")
        )

    if condition_sequence is not None:
        condition_status = CriterionStatus.PASS
        condition_unavailable_reason = None
        condition_observation: JsonScalar | None = condition_entry_ttc
        condition_observation_unit = "s"
    elif condition_signal_missing:
        condition_status = CriterionStatus.NOT_AVAILABLE
        condition_unavailable_reason = (
            "a required paired front-distance/relative-speed policy input is absent during BRAKING"
        )
        condition_observation = None
        condition_observation_unit = "s"
    else:
        condition_status = CriterionStatus.FAIL
        condition_unavailable_reason = None
        if minimum_closing_braking_ttc is None:
            condition_observation = (
                "NO_FINITE_CLOSING_TTC"
                if condition_nonfinite_derived_ttc
                else (
                    "NO_CLOSING_FRONT_INPUT"
                    if candidate_phase_count
                    else "NO_BRAKING_POLICY_INPUT"
                )
            )
            condition_observation_unit = "state"
        else:
            condition_observation = minimum_closing_braking_ttc
            condition_observation_unit = "s"

    if condition_sequence is None:
        condition_alignment_status = CriterionStatus.NOT_AVAILABLE
        condition_alignment_observation: JsonScalar | None = None
        condition_alignment_unavailable = "condition-entry sequence c is not defined"
    else:
        condition_alignment_status = (
            CriterionStatus.PASS if condition_alignment else CriterionStatus.FAIL
        )
        condition_alignment_observation = bool(condition_alignment)
        condition_alignment_unavailable = None

    if divergence_sequence is None:
        divergence_alignment_status = CriterionStatus.NOT_AVAILABLE
        divergence_alignment_observation: JsonScalar | None = None
        divergence_alignment_unavailable = "treatment-divergence sequence d is not defined"
    else:
        divergence_alignment_status = (
            CriterionStatus.PASS if divergence_alignment else CriterionStatus.FAIL
        )
        divergence_alignment_observation = bool(divergence_alignment)
        divergence_alignment_unavailable = None

    post_response_steps = (
        len(candidate_events) - divergence_sequence - 1
        if divergence_sequence is not None
        else None
    )
    if post_response_steps is None:
        post_status = CriterionStatus.NOT_AVAILABLE
        post_unavailable_reason = "treatment-divergence sequence d is not defined"
    else:
        post_status = (
            CriterionStatus.PASS
            if post_response_steps >= definition.minimum_post_response_decision_steps
            else CriterionStatus.FAIL
        )
        post_unavailable_reason = None
        post_references.add(
            _reference("CANDIDATE", divergence_sequence, "/sequence")
        )

    criteria = (
        _criterion(
            criterion_id="arm_roles_and_candidate_configuration",
            status=CriterionStatus.PASS if role_match else CriterionStatus.FAIL,
            definition=(
                "baseline is exact no-op and candidate is the declared deterministic shield "
                "with the captured zero-delay configuration"
            ),
            threshold=True,
            threshold_unit="boolean",
            observation=role_match,
            observation_unit="boolean",
            rationale=(
                "captured arm roles and shield configuration match the declaration"
                if role_match
                else "one or more captured arm-role or shield-configuration fields differ"
            ),
            references=role_references,
        ),
        _criterion(
            criterion_id="minimum_braking_samples_per_arm",
            status=(
                CriterionStatus.PASS
                if min(baseline_phase_count, candidate_phase_count)
                >= definition.minimum_phase_samples_per_arm
                else CriterionStatus.FAIL
            ),
            definition="both arms contain the declared minimum number of BRAKING policy inputs",
            threshold=definition.minimum_phase_samples_per_arm,
            threshold_unit="events_per_arm",
            observation=min(baseline_phase_count, candidate_phase_count),
            observation_unit="events_per_arm",
            rationale=(
                f"baseline has {baseline_phase_count} and candidate has "
                f"{candidate_phase_count} BRAKING events"
            ),
            references=phase_references,
        ),
        _criterion(
            criterion_id="common_prefix_equality",
            status=(
                CriterionStatus.PASS
                if prefix_mismatch_count == 0
                else CriterionStatus.FAIL
            ),
            definition=(
                "sequence, phase, proposed action, named front inputs, and recomputed input TTC "
                "match exactly from sequence zero through p"
            ),
            threshold=0,
            threshold_unit="mismatched_events",
            observation=prefix_mismatch_count,
            observation_unit="mismatched_events",
            rationale=(
                f"examined {prefix_events_examined} events through p={prefix_endpoint}; "
                f"found {prefix_mismatch_count} mismatched events"
            ),
            references=prefix_references,
        ),
        _criterion(
            criterion_id="target_condition_exposure",
            status=condition_status,
            definition=(
                "at least one BRAKING policy input has paired closing front signals and input "
                f"TTC <= {threshold_s} s"
            ),
            threshold=threshold_s,
            threshold_unit="s",
            observation=condition_observation,
            observation_unit=condition_observation_unit,
            rationale=(
                f"first condition-entry sequence c={condition_sequence}; "
                f"found {condition_match_count} qualifying events"
                if condition_sequence is not None
                else (
                    condition_unavailable_reason
                    if condition_unavailable_reason is not None
                    else "available BRAKING inputs never entered the declared TTC band"
                )
            ),
            references=condition_references,
            unavailable_reason=condition_unavailable_reason,
        ),
        _criterion(
            criterion_id="at_condition_arm_alignment",
            status=condition_alignment_status,
            definition=(
                "both arms have exact phase, proposed action, named front inputs, and in-band "
                "recomputed TTC at c"
            ),
            threshold=True,
            threshold_unit="boolean",
            observation=condition_alignment_observation,
            observation_unit="boolean",
            rationale=(
                condition_alignment_unavailable
                if condition_alignment_unavailable is not None
                else (
                    "arms align exactly at c"
                    if condition_alignment
                    else "baseline counterpart at c is absent or mismatched"
                )
            ),
            references=condition_alignment_references,
            unavailable_reason=condition_alignment_unavailable,
        ),
        _criterion(
            criterion_id="pre_condition_cleanliness",
            status=(
                CriterionStatus.PASS
                if precondition_violation_count == 0
                else CriterionStatus.FAIL
            ),
            definition=(
                "candidate has no target reason or binary32-material action divergence from "
                "sequence zero through q"
            ),
            threshold=0,
            threshold_unit="violations",
            observation=precondition_violation_count,
            observation_unit="violations",
            rationale=(
                f"examined {precondition_events_examined} events through "
                f"q={precondition_endpoint}; "
                f"found {precondition_violation_count} target-evidence violations"
            ),
            references=cleanliness_references,
        ),
        _criterion(
            criterion_id="material_target_intervention",
            status=(
                CriterionStatus.PASS
                if divergence_sequence is not None
                else CriterionStatus.FAIL
            ),
            definition=(
                "at or after c, target reason and binary32-material proposed/executed action "
                "difference define d"
            ),
            threshold=True,
            threshold_unit="boolean",
            observation=divergence_sequence is not None,
            observation_unit="boolean",
            rationale=(
                f"first treatment-divergence sequence d={divergence_sequence}"
                if divergence_sequence is not None
                else "no qualifying material target intervention exists at or after c"
            ),
            references=intervention_references,
        ),
        _criterion(
            criterion_id="at_divergence_arm_alignment",
            status=divergence_alignment_status,
            definition=(
                "both arms align exactly at d, baseline execution is no-op, and candidate "
                "records a material target response"
            ),
            threshold=True,
            threshold_unit="boolean",
            observation=divergence_alignment_observation,
            observation_unit="boolean",
            rationale=(
                divergence_alignment_unavailable
                if divergence_alignment_unavailable is not None
                else (
                    "arms align exactly at d"
                    if divergence_alignment
                    else "baseline counterpart at d is absent or mismatched"
                )
            ),
            references=divergence_alignment_references,
            unavailable_reason=divergence_alignment_unavailable,
        ),
        _criterion(
            criterion_id="minimum_target_event_count",
            status=(
                CriterionStatus.PASS
                if target_event_count >= definition.minimum_target_override_events
                else CriterionStatus.FAIL
            ),
            definition=(
                "candidate target events record the target reason, in-band input TTC, and a "
                "binary32-material action difference"
            ),
            threshold=definition.minimum_target_override_events,
            threshold_unit="events",
            observation=target_event_count,
            observation_unit="events",
            rationale=f"found {target_event_count} qualifying target events",
            references=target_count_references,
        ),
        _criterion(
            criterion_id="non_target_predicates_and_reasons_clear",
            status=(
                CriterionStatus.PASS
                if non_target_violation_count == 0
                else CriterionStatus.FAIL
            ),
            definition=(
                "all speed, staleness, boundary, emergency-stop, and zero-delay predicates "
                "are false and non-target reasons absent through e"
            ),
            threshold=0,
            threshold_unit="violations",
            observation=non_target_violation_count,
            observation_unit="violations",
            rationale=(
                f"examined {confound_events_examined} events through e={confound_endpoint}; "
                f"found {non_target_violation_count} non-target predicate/reason violations"
            ),
            references=non_target_references,
        ),
        _criterion(
            criterion_id="post_response_horizon",
            status=post_status,
            definition="candidate retains the declared number of decision opportunities after d",
            threshold=definition.minimum_post_response_decision_steps,
            threshold_unit="decision_steps",
            observation=post_response_steps,
            observation_unit="decision_steps",
            rationale=(
                post_unavailable_reason
                if post_unavailable_reason is not None
                else f"found {post_response_steps} decision steps after d"
            ),
            references=post_references,
            unavailable_reason=post_unavailable_reason,
        ),
    )

    if condition_sequence is None:
        if precondition_violation_count:
            disposition = ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
        elif condition_signal_missing:
            disposition = ObservationDisposition.EVIDENCE_NOT_AVAILABLE
        else:
            disposition = ObservationDisposition.CONDITION_NOT_OBSERVED
    elif divergence_sequence is None:
        if precondition_violation_count:
            disposition = ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
        elif target_reason_after_condition:
            disposition = ObservationDisposition.TARGET_REASON_WITHOUT_MATERIAL_ACTION
        else:
            disposition = ObservationDisposition.CONDITION_MET_NO_RECORDED_INTERVENTION
    elif precondition_violation_count or non_target_violation_count:
        disposition = ObservationDisposition.TARGET_INTERVENTION_CONFOUNDED
    else:
        disposition = ObservationDisposition.TARGET_INTERVENTION_RECORDED

    assessment = AdequacyAssessment(
        status=aggregate_adequacy_status(tuple(item.status for item in criteria)),
        observation_disposition=disposition,
        criteria=criteria,
    )
    return _ScanResult(
        assessment=assessment,
        condition_sequence=condition_sequence,
        divergence_sequence=divergence_sequence,
        prefix_endpoint=prefix_endpoint,
        confound_endpoint=confound_endpoint,
        precondition_endpoint=precondition_endpoint,
        prefix_events_examined=prefix_events_examined,
        confound_events_examined=confound_events_examined,
        precondition_events_examined=precondition_events_examined,
        baseline_event_visits=baseline_event_visits,
        candidate_event_visits=candidate_event_visits,
    )
