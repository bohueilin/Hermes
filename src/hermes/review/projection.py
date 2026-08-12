"""Pure projection and presentation helpers for Phase 6 evidence review."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from itertools import groupby
from types import MappingProxyType
from typing import TypeVar
from unicodedata import category as unicode_category

from hermes.comparison.compare import ArtifactComparison
from hermes.gates.release import EVIDENCE_REQUIREMENTS_BY_PROFILE
from hermes.review.models import (
    ActionValue,
    AssumptionItem,
    AuthenticatedOrigin,
    AvailabilityDelta,
    AvailabilityMapValue,
    AvailabilityValues,
    CategorizedDigest,
    ChartSeries,
    ClauseExpression,
    ComparisonEnvelope,
    ComparisonStringListValue,
    CompatibilityInfo,
    DiagnosticItem,
    DigestInfo,
    DimensionDelta,
    EvidenceSufficiency,
    ExactValue,
    FindingItem,
    GateConsequence,
    GateInfo,
    GroupExpression,
    HardFailureDelta,
    InterventionValue,
    InvariantExpression,
    InvariantRule,
    LimitationItem,
    LocatorInfo,
    ManifestIdentityInfo,
    MeasurementDeltaValue,
    MetricItem,
    ObservationValue,
    Point,
    PortableArtifactIdentity,
    Provenance,
    RecordedProvenance,
    ReviewEnvelope,
    ReviewUnavailableError,
    ReviewUnavailableReason,
    ScalarDeltaValue,
    ScalarMetricValue,
    SideReference,
    SideSummary,
    SourceFileObservation,
    SourceInventoryItem,
    SourceReference,
    StringCountMapMetricValue,
    StringListValue,
    SufficiencyItem,
    SufficiencySummary,
    ThresholdClause,
    Timeline,
    ToolInfo,
    Track,
    TrustInfo,
    TrustRecord,
    UnavailableEvidenceItem,
    canonical_json_bytes,
)


@dataclass(frozen=True, slots=True)
class DisplayTextProjection:
    """A bounded, inert presentation copy of an authoritative string."""

    displayed_text: str
    truncated: bool
    original_length: int


_T = TypeVar("_T")
_K = TypeVar("_K")

_VERIFIER_ID = "hermes.stored-artifact-verifier/1.0"
_QUARANTINE_IMPACT = (
    "Artifact claims are quarantined; no stored verdict, findings, metrics, timeline, "
    "or recorded provenance are accepted."
)
_SOURCE_FILES = MappingProxyType(
    {
        "MANIFEST": "manifest.json",
        "EXECUTION_CONTEXT": "execution-context.json",
        "SCENARIO": "scenario.resolved.yaml",
        "GATE_CONFIG": "gate-config.resolved.yaml",
        "EVENT": "events.jsonl",
        "METRIC": "metrics.json",
        "FINDING": "findings.json",
        "VERDICT": "verdict.json",
        "TRACE_DIGEST": "trace.sha256",
        "BUNDLE_DIGEST": "bundle.sha256",
    }
)
_FILE_ORDER = MappingProxyType({name: index for index, name in enumerate(_SOURCE_FILES.values())})
_FINDING_LABELS = MappingProxyType(
    {
        "trace.integrity": "Trace integrity",
        "collision.zero": "Collision count is within limit",
        "boundary.within_tolerance": "Road-boundary evidence is within tolerance",
        "progress.required": "Required mission progress",
        "comfort.acceleration": "Acceleration comfort threshold",
        "comfort.jerk": "Jerk comfort threshold",
        "fault.coverage.required": "Configured fault coverage",
    }
)
_FINDING_METRICS = MappingProxyType(
    {
        "trace.integrity": "event_count",
        "collision.zero": "collision_count",
        "boundary.within_tolerance": "max_abs_lateral_offset_m",
        "progress.required": "route_completion_pct",
        "comfort.acceleration": "max_abs_acceleration_mps2",
        "comfort.jerk": "max_abs_jerk_mps3",
        "fault.coverage.required": "fault_application_counts",
    }
)
_METRIC_ORDER = (
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
_METRIC_METADATA = MappingProxyType(
    {
        "event_count": ("Event count", "events", "DESCRIPTIVE"),
        "simulation_duration_s": ("Simulation duration", "s", "DESCRIPTIVE"),
        "collision_count": ("Collision count", "collisions", "LOWER"),
        "max_abs_lateral_offset_m": ("Maximum absolute lateral offset", "m", "LOWER"),
        "offroad_duration_s": ("Off-road duration", "s", "LOWER"),
        "route_completion_pct": ("Route completion", "%", "HIGHER"),
        "minimum_ttc_s": ("Minimum time to collision", "s", "HIGHER"),
        "max_abs_acceleration_mps2": (
            "Maximum absolute acceleration",
            "m/s^2",
            "LOWER",
        ),
        "max_abs_jerk_mps3": ("Maximum absolute jerk", "m/s^3", "LOWER"),
        "p95_policy_latency_ms": ("P95 policy latency", "ms", "LOWER"),
        "shield_override_count": ("Shield override count", "overrides", "DESCRIPTIVE"),
        "shield_override_reasons": (
            "Shield override reasons",
            "occurrences",
            "DESCRIPTIVE",
        ),
        "termination_reason": ("Termination reason", None, "DESCRIPTIVE"),
        "fault_application_counts": (
            "Fault application counts",
            "occurrences",
            "DESCRIPTIVE",
        ),
        "max_observation_age_s": ("Maximum observation age", "s", "LOWER"),
        "p95_control_latency_ms": ("P95 control latency", "ms", "LOWER"),
        "control_fill_count": ("Control fill count", "events", "DESCRIPTIVE"),
        "steering_saturation_count": ("Steering saturation count", "events", "LOWER"),
        "brake_saturation_count": ("Brake saturation count", "events", "LOWER"),
    }
)
_MEASUREMENT_METRICS = frozenset(
    {
        "route_completion_pct",
        "minimum_ttc_s",
        "max_abs_acceleration_mps2",
        "max_abs_jerk_mps3",
        "p95_policy_latency_ms",
        "max_observation_age_s",
        "p95_control_latency_ms",
    }
)
_TRACK_ORDER = (
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
_TRACK_LABELS = MappingProxyType(
    {
        "raw_observation": "Raw observation",
        "delivered_observation": "Delivered observation",
        "result_observation": "Result observation",
        "candidate_action": "Candidate action",
        "permitted_action": "Permitted action",
        "executed_action": "Executed action",
        "override_reasons": "Override reasons",
        "observation_fault_reasons": "Observation fault reasons",
        "control_fault_reasons": "Control fault reasons",
        "collision_count": "Collision count",
        "offroad": "Off-road state",
        "speed_mps": "Speed",
        "route_progress_pct": "Route progress",
        "ttc_s": "Time to collision",
        "policy_latency_ms": "Policy latency",
        "verifier_triggering_findings": "Verifier-triggering findings",
    }
)
_LEGACY_UNAVAILABLE_TRACKS = frozenset(
    {
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "permitted_action",
        "observation_fault_reasons",
        "control_fault_reasons",
    }
)
_LEGACY_TRACK_REASON = "Not represented separately by evidence schema 1.0; no value is inferred."


def _enum_value(value: object) -> object:
    return getattr(value, "value", value)


def _reference(
    source_type: str,
    pointer: str,
    sequence: int | None = None,
) -> SourceReference:
    return SourceReference(
        source_type=source_type,
        file_name=_SOURCE_FILES[source_type],
        json_pointer=pointer,
        event_sequence=sequence,
    )


def _reference_key(reference: SourceReference) -> tuple[int, int, str]:
    return (
        _FILE_ORDER[reference.file_name],
        -1 if reference.event_sequence is None else reference.event_sequence,
        reference.json_pointer or "",
    )


def _ordered_references(*references: SourceReference) -> tuple[SourceReference, ...]:
    by_key = {_reference_key(reference): reference for reference in references}
    return tuple(by_key[key] for key in sorted(by_key))


def _event_references(events: tuple[object, ...], pointer: str) -> tuple[SourceReference, ...]:
    return tuple(_reference("EVENT", pointer, event.sequence) for event in events)


def _exact(value: object, unit: str | None) -> ExactValue:
    value = _enum_value(value)
    if value is None:
        return ExactValue(
            machine_value=None,
            canonical_text=None,
            display_text="NOT_AVAILABLE",
            unit=unit,
        )
    canonical = canonical_json_bytes(value).decode("utf-8")
    return ExactValue(
        machine_value=value,
        canonical_text=canonical,
        display_text=value if isinstance(value, str) else canonical,
        unit=unit,
    )


def _clause(
    *,
    label: str,
    left: str,
    transforms: tuple[str, ...],
    operator: str,
    right: ExactValue | None,
    configuration: tuple[SourceReference, ...] = (),
    evidence: tuple[SourceReference, ...] = (),
) -> ClauseExpression:
    return ClauseExpression(
        kind="CLAUSE",
        label=label,
        clause=ThresholdClause(
            left_operand=left,
            transforms=transforms,
            operator=operator,
            right_operand=right,
            configuration_sources=_ordered_references(*configuration),
            evidence_sources=_ordered_references(*evidence),
        ),
        children=(),
        invariant=None,
    )


def _threshold(snapshot: object, finding_id: str):
    events = snapshot.events
    gate = snapshot.gate_config
    if finding_id == "trace.integrity":
        return InvariantExpression(
            kind="INVARIANT",
            label="Complete trace sequence and digest chain",
            clause=None,
            children=(),
            invariant=InvariantRule(
                operator="COMPLETE",
                configuration_sources=(_reference("SCENARIO", "/control/horizon_steps"),),
                evidence_sources=_ordered_references(
                    *_event_references(events, ""),
                    _reference("TRACE_DIGEST", ""),
                ),
            ),
        )
    if finding_id == "collision.zero":
        return _clause(
            label="Maximum collision count",
            left="collision_count",
            transforms=("MAX_OVER_EVENTS",),
            operator="LTE",
            right=_exact(gate.hard.max_collision_count, "count"),
            configuration=(_reference("GATE_CONFIG", "/hard/max_collision_count"),),
            evidence=_event_references(events, "/vehicle_state/collision_count"),
        )
    if finding_id == "boundary.within_tolerance":
        lateral_limit = min(
            gate.hard.max_abs_lateral_offset_m,
            snapshot.scenario.road.boundary_tolerance_m,
        )
        return GroupExpression(
            kind="ALL_OF",
            label="Boundary and off-road limits",
            clause=None,
            children=(
                _clause(
                    label="Maximum absolute lateral offset",
                    left="lateral_offset_m",
                    transforms=("ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
                    operator="LTE",
                    right=_exact(lateral_limit, "m"),
                    configuration=(
                        _reference("SCENARIO", "/road/boundary_tolerance_m"),
                        _reference("GATE_CONFIG", "/hard/max_abs_lateral_offset_m"),
                    ),
                    evidence=_event_references(events, "/vehicle_state/lateral_offset_m"),
                ),
                _clause(
                    label="No event is off-road",
                    left="offroad",
                    transforms=("ALL_EVENTS",),
                    operator="IS_FALSE",
                    right=None,
                    evidence=_event_references(events, "/vehicle_state/offroad"),
                ),
                _clause(
                    label="Maximum off-road duration",
                    left="offroad",
                    transforms=("DURATION_TRUE",),
                    operator="LTE",
                    right=_exact(gate.hard.max_offroad_duration_s, "s"),
                    configuration=(_reference("GATE_CONFIG", "/hard/max_offroad_duration_s"),),
                    evidence=(
                        _reference(
                            "EXECUTION_CONTEXT",
                            "/run_context/control_frequency_hz",
                        ),
                        *_event_references(events, "/vehicle_state/offroad"),
                    ),
                ),
            ),
            invariant=None,
        )
    if finding_id == "progress.required":
        final = events[-1]
        finding = next(item for item in snapshot.findings.findings if item.finding_id == finding_id)
        progress_evidence = list(_event_references(events, "/raw_facts/route_progress_available"))
        if _enum_value(finding.measurement.availability) == "AVAILABLE":
            progress_evidence.extend(_event_references(events, "/vehicle_state/route_progress_pct"))
        progress_evidence.append(_reference("METRIC", "/route_completion_pct"))
        return GroupExpression(
            kind="ALL_OF",
            label="Destination and route progress requirements",
            clause=None,
            children=(
                _clause(
                    label="Destination reached at final event",
                    left="destination_reached",
                    transforms=("FINAL_EVENT",),
                    operator="IS_TRUE",
                    right=None,
                    evidence=(
                        _reference(
                            "EVENT",
                            "/vehicle_state/destination_reached",
                            final.sequence,
                        ),
                    ),
                ),
                _clause(
                    label="Minimum route completion",
                    left="route_completion_pct",
                    transforms=("MAX_OVER_EVENTS",),
                    operator="GTE",
                    right=_exact(gate.hard.min_route_completion_pct, "%"),
                    configuration=(_reference("GATE_CONFIG", "/hard/min_route_completion_pct"),),
                    evidence=tuple(progress_evidence),
                ),
            ),
            invariant=None,
        )
    if finding_id == "comfort.acceleration":
        return _clause(
            label="Maximum absolute acceleration",
            left="acceleration_mps2",
            transforms=("ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
            operator="LTE",
            right=_exact(gate.soft.max_abs_acceleration_mps2, "m/s^2"),
            configuration=(_reference("GATE_CONFIG", "/soft/max_abs_acceleration_mps2"),),
            evidence=_event_references(events, "/vehicle_state/acceleration_mps2"),
        )
    if finding_id == "comfort.jerk":
        return _clause(
            label="Maximum absolute jerk",
            left="acceleration_mps2",
            transforms=("FINITE_DIFFERENCE", "ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
            operator="LTE",
            right=_exact(gate.soft.max_abs_jerk_mps3, "m/s^3"),
            configuration=(_reference("GATE_CONFIG", "/soft/max_abs_jerk_mps3"),),
            evidence=(
                _reference("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
                *_event_references(events, "/vehicle_state/acceleration_mps2"),
            ),
        )
    if finding_id == "fault.coverage.required":
        return InvariantExpression(
            kind="INVARIANT",
            label="All configured faults are observed",
            clause=None,
            children=(),
            invariant=InvariantRule(
                operator="ALL_OBSERVED",
                configuration_sources=(_reference("SCENARIO", "/faults"),),
                evidence_sources=_ordered_references(
                    *_event_references(events, "/observation_fault_evidence/applied_faults"),
                    *_event_references(events, "/control_fault_evidence/applied_faults"),
                ),
            ),
        )
    raise ReviewUnavailableError(
        ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
        f"unsupported accepted finding shape: {finding_id}",
    )


def _consequence(
    snapshot: object,
    finding_id: str,
    status: str,
    *,
    not_applicable: bool = False,
) -> GateConsequence:
    verdict = snapshot.verdict
    hard = finding_id in verdict.hard_failures
    soft = finding_id in verdict.soft_failures
    supporting = finding_id in verdict.supporting_finding_ids
    if not_applicable:
        effect = "NO_EFFECT"
        result = None
        source = "PROFILE_NOT_APPLICABLE"
        configuration = ()
    elif status == "PASS":
        effect = "NO_EFFECT"
        result = None
        source = "FIXED_GATE_PRECEDENCE"
        configuration = ()
    elif finding_id == "trace.integrity":
        effect = result = "INVALID_EVIDENCE"
        source = "FIXED_GATE_PRECEDENCE"
        configuration = ()
    elif finding_id in {"collision.zero", "boundary.within_tolerance"}:
        effect = result = "HOLD" if status == "FAIL" else "INVALID_EVIDENCE"
        source = "FIXED_GATE_PRECEDENCE"
        configuration = ()
    elif finding_id == "progress.required" and status == "NOT_AVAILABLE":
        effect = "CONFIGURED_MISSING_REQUIRED_EVIDENCE"
        result = _enum_value(snapshot.gate_config.hard.missing_required_evidence)
        source = "GATE_CONFIG_MISSING_REQUIRED_EVIDENCE"
        configuration = (_reference("GATE_CONFIG", "/hard/missing_required_evidence"),)
    elif finding_id in {"progress.required", "fault.coverage.required"}:
        effect = result = "HOLD"
        source = "FIXED_GATE_PRECEDENCE"
        configuration = ()
    elif finding_id in {"comfort.acceleration", "comfort.jerk"}:
        effect = result = "CONDITIONAL"
        source = "FIXED_GATE_PRECEDENCE"
        configuration = ()
    else:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            f"unsupported accepted consequence shape: {finding_id}/{status}",
        )
    return GateConsequence(
        triggered=effect != "NO_EFFECT",
        effect=effect,
        result_if_controlling=result,
        source=source,
        listed_in_hard_failures=hard,
        listed_in_soft_failures=soft,
        listed_in_supporting_findings=supporting,
        configuration_references=configuration,
    )


def _finding_references(
    snapshot: object,
    finding: object,
    finding_index: int,
) -> tuple[SourceReference, ...]:
    references = [
        _reference("METRIC", f"/{_FINDING_METRICS[finding.finding_id]}"),
        _reference("FINDING", f"/findings/{finding_index}"),
    ]
    references.extend(_reference("EVENT", "", sequence) for sequence in finding.event_sequences)
    return _ordered_references(*references)


def _findings(snapshot: object) -> tuple[FindingItem, ...]:
    profile = EVIDENCE_REQUIREMENTS_BY_PROFILE[snapshot.verifier_profile]
    requiredness = {
        requirement.finding_id: _enum_value(requirement.requiredness)
        for requirement in profile.requirements
    }
    result: list[FindingItem] = []
    for index, finding in enumerate(snapshot.findings.findings):
        status = _enum_value(finding.status)
        availability = _enum_value(finding.measurement.availability)
        result.append(
            FindingItem(
                finding_id=finding.finding_id,
                verifier_name=finding.verifier,
                verifier_version=finding.verifier_version,
                label=_FINDING_LABELS[finding.finding_id],
                explanation=finding.message,
                category=("NOT_AVAILABLE" if availability == "NOT_AVAILABLE" else "COMPUTED"),
                status=status,
                severity=_enum_value(finding.severity),
                hard_invariant=finding.hard_invariant,
                measured=_exact(finding.measurement.value, finding.measurement.unit),
                threshold=_threshold(snapshot, finding.finding_id),
                threshold_source_text=finding.threshold_or_invariant,
                first_failure_simulation_time_s=finding.first_failure_time_s,
                supporting_event_sequences=finding.event_sequences,
                evidence_availability=availability,
                requiredness=requiredness[finding.finding_id],
                consequence=_consequence(snapshot, finding.finding_id, status),
                source_references=_finding_references(snapshot, finding, index),
            )
        )
    return tuple(result)


def _sufficiency(
    snapshot: object,
    findings: tuple[FindingItem, ...],
) -> tuple[EvidenceSufficiency, tuple[UnavailableEvidenceItem, ...]]:
    profile = EVIDENCE_REQUIREMENTS_BY_PROFILE[snapshot.verifier_profile]
    by_id = {finding.finding_id: finding for finding in findings}
    items: list[SufficiencyItem] = []
    for requirement in profile.requirements:
        finding_id = requirement.finding_id
        requiredness = _enum_value(requirement.requiredness)
        finding = by_id.get(finding_id)
        if requiredness == "NOT_APPLICABLE":
            items.append(
                SufficiencyItem(
                    evidence_id=finding_id,
                    label=_FINDING_LABELS[finding_id],
                    requirement="NOT_APPLICABLE",
                    availability="NOT_APPLICABLE",
                    reason="Not applicable to the legacy verifier profile",
                    consequence=_consequence(
                        snapshot,
                        finding_id,
                        "NOT_AVAILABLE",
                        not_applicable=True,
                    ),
                    category="NOT_AVAILABLE",
                    source_references=(),
                )
            )
            continue
        if finding is None:
            raise ReviewUnavailableError(
                ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
                f"accepted profile is missing finding {finding_id}",
            )
        available = finding.evidence_availability == "AVAILABLE"
        source_finding = next(
            item for item in snapshot.findings.findings if item.finding_id == finding_id
        )
        items.append(
            SufficiencyItem(
                evidence_id=finding_id,
                label=finding.label,
                requirement=requiredness,
                availability="AVAILABLE" if available else "NOT_AVAILABLE",
                reason=None if available else source_finding.measurement.reason,
                consequence=finding.consequence,
                category="COMPUTED" if available else "NOT_AVAILABLE",
                source_references=finding.source_references,
            )
        )
    summary_values = {
        "required_and_available": 0,
        "required_but_unavailable": 0,
        "optional_and_available": 0,
        "optional_and_unavailable": 0,
        "not_applicable": 0,
    }
    for item in items:
        if item.requirement == "NOT_APPLICABLE":
            summary_values["not_applicable"] += 1
        elif item.requirement == "REQUIRED":
            key = (
                "required_and_available"
                if item.availability == "AVAILABLE"
                else "required_but_unavailable"
            )
            summary_values[key] += 1
        else:
            key = (
                "optional_and_available"
                if item.availability == "AVAILABLE"
                else "optional_and_unavailable"
            )
            summary_values[key] += 1
    evidence = EvidenceSufficiency(
        profile_name=_enum_value(snapshot.verifier_profile),
        profile_version=profile.version,
        summary=SufficiencySummary(**summary_values),
        items=tuple(items),
        category="COMPUTED",
    )
    unavailable = tuple(
        UnavailableEvidenceItem(
            evidence_id=item.evidence_id,
            label=item.label,
            reason=item.reason,
            requiredness=item.requirement,
            consequence=item.consequence,
            category="NOT_AVAILABLE",
            source_references=item.source_references,
        )
        for item in items
        if item.availability == "NOT_AVAILABLE"
    )
    return evidence, unavailable


def _accepted_limitations(snapshot: object) -> tuple[LimitationItem, ...]:
    limitations: list[LimitationItem] = []
    for index, text in enumerate(snapshot.verdict.residual_limitations):
        if "SHA-256" in text or "authenticated" in text:
            category = "AUTHENTICITY"
        elif any(text.startswith(f"{finding_id}:") for finding_id in _FINDING_LABELS):
            category = "NOT_AVAILABLE"
        else:
            category = "RESIDUAL_RISK"
        limitations.append(
            LimitationItem(
                id=f"gate.residual.{index + 1:04d}",
                text=text,
                impact="This limitation remains after the stored gate decision.",
                category=category,
                source_references=(_reference("VERDICT", f"/residual_limitations/{index}"),),
            )
        )
    return tuple(limitations)


def _accepted_gate(
    snapshot: object,
    limitations: tuple[LimitationItem, ...],
) -> GateInfo:
    verdict = snapshot.verdict
    return GateInfo(
        verdict=_enum_value(verdict.verdict),
        category="GATE_DECISION",
        accepted_recomputation=True,
        gate_name=verdict.gate_name,
        gate_version=verdict.gate_version,
        gate_config_digest_sha256=snapshot.context.run_context.gate_config_digest,
        rationale=verdict.rationale,
        hard_failure_ids=verdict.hard_failures,
        soft_failure_ids=verdict.soft_failures,
        supporting_finding_ids=verdict.supporting_finding_ids,
        residual_limitation_ids=tuple(item.id for item in limitations),
    )


def _ttc_references(event: object) -> tuple[SourceReference, ...]:
    summary = event.observation_summary
    result_keys = ("result_front_distance_m", "result_front_relative_speed_mps")
    fallback_keys = ("front_distance_m", "front_relative_speed_mps")
    keys = result_keys if all(key in summary for key in result_keys) else fallback_keys
    if not all(key in summary for key in keys):
        return (_reference("EVENT", "/observation_summary", event.sequence),)
    return tuple(_reference("EVENT", f"/observation_summary/{key}", event.sequence) for key in keys)


def _metric_tail_references(snapshot: object, metric_id: str) -> tuple[SourceReference, ...]:
    events = snapshot.events
    if metric_id == "event_count":
        references = _event_references(events, "")
    elif metric_id == "simulation_duration_s":
        references = (_reference("EVENT", "/simulation_time_s", events[-1].sequence),)
    elif metric_id == "collision_count":
        references = _event_references(events, "/vehicle_state/collision_count")
    elif metric_id == "max_abs_lateral_offset_m":
        references = _event_references(events, "/vehicle_state/lateral_offset_m")
    elif metric_id == "offroad_duration_s":
        references = (
            _reference("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
            *_event_references(events, "/vehicle_state/offroad"),
        )
    elif metric_id == "route_completion_pct":
        references = _event_references(events, "/raw_facts/route_progress_available")
        measurement = snapshot.metrics.route_completion_pct
        if _enum_value(measurement.availability) == "AVAILABLE":
            references += _event_references(events, "/vehicle_state/route_progress_pct")
    elif metric_id == "minimum_ttc_s":
        references = tuple(reference for event in events for reference in _ttc_references(event))
    elif metric_id in {"max_abs_acceleration_mps2", "max_abs_jerk_mps3"}:
        references = _event_references(events, "/vehicle_state/acceleration_mps2")
        if metric_id == "max_abs_jerk_mps3":
            references = (
                _reference("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
                *references,
            )
    elif metric_id == "p95_policy_latency_ms":
        references = _event_references(events, "/policy_latency_ms")
    elif metric_id == "shield_override_count":
        second = (
            "/executed_action"
            if snapshot.manifest.evidence_schema_version == "1.0"
            else "/permitted_action"
        )
        references = tuple(
            reference
            for event in events
            for reference in (
                _reference("EVENT", "/candidate_action", event.sequence),
                _reference("EVENT", second, event.sequence),
            )
        )
    elif metric_id == "shield_override_reasons":
        references = _event_references(events, "/override_reasons")
    elif metric_id == "termination_reason":
        references = (_reference("EVENT", "/termination_reason", events[-1].sequence),)
    elif metric_id == "fault_application_counts":
        references = tuple(
            reference
            for event in events
            for reference in (
                _reference(
                    "EVENT",
                    "/observation_fault_evidence/applied_faults",
                    event.sequence,
                ),
                _reference(
                    "EVENT",
                    "/control_fault_evidence/applied_faults",
                    event.sequence,
                ),
            )
        )
    elif metric_id in {
        "control_fill_count",
        "steering_saturation_count",
        "brake_saturation_count",
    }:
        fault_name = {
            "control_fill_count": "CONTROL_DELAY_FILL",
            "steering_saturation_count": "STEERING_SATURATION",
            "brake_saturation_count": "BRAKE_SATURATION",
        }[metric_id]
        references = tuple(
            _reference("EVENT", pointer, event.sequence)
            for event in events
            for pointer, reasons in (
                (
                    "/observation_fault_evidence/applied_faults",
                    event.observation_fault_evidence.applied_faults,
                ),
                (
                    "/control_fault_evidence/applied_faults",
                    event.control_fault_evidence.applied_faults,
                ),
            )
            if fault_name in reasons
        )
        if fault_name in snapshot.metrics.fault_application_counts:
            references += (_reference("METRIC", f"/fault_application_counts/{fault_name}"),)
    elif metric_id == "max_observation_age_s":
        references = _event_references(
            events,
            "/observation_fault_evidence/delivered_observation/observation_age_s",
        )
    elif metric_id == "p95_control_latency_ms":
        references = _event_references(events, "/control_fault_evidence/control_latency_ms/value")
    else:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            f"unsupported accepted metric shape: {metric_id}",
        )
    return _ordered_references(*references)


def _metrics(snapshot: object) -> tuple[MetricItem, ...]:
    schema = snapshot.manifest.evidence_schema_version
    metric_ids = _METRIC_ORDER[:13] if schema == "1.0" else _METRIC_ORDER
    result: list[MetricItem] = []
    for metric_id in metric_ids:
        label, registry_unit, direction = _METRIC_METADATA[metric_id]
        stored = getattr(snapshot.metrics, metric_id)
        if metric_id in {"shield_override_reasons", "fault_application_counts"}:
            value = StringCountMapMetricValue(
                kind="STRING_COUNT_MAP",
                values=dict(sorted(stored.items())),
            )
            availability = "AVAILABLE"
            reason = None
        elif metric_id in _MEASUREMENT_METRICS:
            availability = _enum_value(stored.availability)
            reason = stored.reason
            value = ScalarMetricValue(
                kind="SCALAR",
                value=_exact(stored.value, stored.unit),
            )
        else:
            availability = "AVAILABLE"
            reason = None
            value = ScalarMetricValue(
                kind="SCALAR",
                value=_exact(stored, registry_unit),
            )
        result.append(
            MetricItem(
                metric_id=metric_id,
                label=label,
                category=("COMPUTED" if availability == "AVAILABLE" else "NOT_AVAILABLE"),
                value=value,
                availability=availability,
                unavailable_reason=reason,
                desired_direction=direction,
                source_references=(
                    _reference("METRIC", f"/{metric_id}"),
                    *_metric_tail_references(snapshot, metric_id),
                ),
            )
        )
    return tuple(result)


def _action(action: object) -> ActionValue:
    return ActionValue(
        steering=action.steering,
        throttle=action.throttle,
        brake=action.brake,
    )


def _observation(observation: object) -> ObservationValue:
    state = observation.vehicle_state
    return ObservationValue(
        sequence=observation.sequence,
        simulation_time_s=observation.simulation_time_s,
        position_m=state.position_m,
        speed_mps=state.speed_mps,
        acceleration_mps2=state.acceleration_mps2,
        lateral_offset_m=state.lateral_offset_m,
        route_progress_pct=state.route_progress_pct,
        collision_count=state.collision_count,
        offroad=state.offroad,
        destination_reached=state.destination_reached,
        front_distance_m=observation.front_distance_m,
        front_relative_speed_mps=observation.front_relative_speed_mps,
        observation_age_s=observation.observation_age_s,
        challenge_actor_longitudinal_m=observation.challenge_actor_longitudinal_m,
        challenge_actor_lateral_offset_m=observation.challenge_actor_lateral_offset_m,
        challenge_actor_speed_mps=observation.challenge_actor_speed_mps,
        challenge_phase=observation.challenge_phase,
    )


def _ttc_point(event: object) -> tuple[ExactValue, str, str | None]:
    summary = event.observation_summary
    result_keys = ("result_front_distance_m", "result_front_relative_speed_mps")
    fallback_keys = ("front_distance_m", "front_relative_speed_mps")
    keys = result_keys if all(key in summary for key in result_keys) else fallback_keys
    if all(key in summary for key in keys):
        distance, relative_speed = (summary[key] for key in keys)
        numeric = all(
            isinstance(value, (int, float)) and not isinstance(value, bool)
            for value in (distance, relative_speed)
        )
        if numeric and distance >= 0 and relative_speed < 0:
            return _exact(distance / -relative_speed, "s"), "AVAILABLE", None
    return (
        _exact(None, "s"),
        "NOT_AVAILABLE",
        "no paired closing front-object evidence",
    )


def _point_for_track(
    snapshot: object,
    findings: tuple[FindingItem, ...],
    track_id: str,
    event: object,
) -> Point:
    base = {
        "sequence": event.sequence,
        "simulation_time_s": event.simulation_time_s,
        "category": "OBSERVED",
        "availability": "AVAILABLE",
        "unavailable_reason": None,
        "scalar_value": None,
        "action_value": None,
        "observation_value": None,
        "string_list_value": None,
    }
    pointer: str
    if track_id == "raw_observation":
        base["observation_value"] = _observation(event.observation_fault_evidence.raw_observation)
        pointer = "/observation_fault_evidence/raw_observation"
    elif track_id == "delivered_observation":
        base["observation_value"] = _observation(
            event.observation_fault_evidence.delivered_observation
        )
        pointer = "/observation_fault_evidence/delivered_observation"
    elif track_id == "result_observation":
        base["observation_value"] = _observation(event.result_observation)
        pointer = "/result_observation"
    elif track_id in {"candidate_action", "permitted_action", "executed_action"}:
        base["action_value"] = _action(getattr(event, track_id))
        pointer = f"/{track_id}"
    elif track_id == "override_reasons":
        base["string_list_value"] = StringListValue(values=event.override_reasons)
        pointer = "/override_reasons"
    elif track_id == "observation_fault_reasons":
        base["string_list_value"] = StringListValue(
            values=event.observation_fault_evidence.applied_faults
        )
        pointer = "/observation_fault_evidence/applied_faults"
    elif track_id == "control_fault_reasons":
        base["string_list_value"] = StringListValue(
            values=event.control_fault_evidence.applied_faults
        )
        pointer = "/control_fault_evidence/applied_faults"
    elif track_id == "collision_count":
        base["scalar_value"] = _exact(event.vehicle_state.collision_count, "collisions")
        pointer = "/vehicle_state/collision_count"
    elif track_id == "offroad":
        base["scalar_value"] = _exact(event.vehicle_state.offroad, None)
        pointer = "/vehicle_state/offroad"
    elif track_id == "speed_mps":
        base["scalar_value"] = _exact(event.vehicle_state.speed_mps, "m/s")
        pointer = "/vehicle_state/speed_mps"
    elif track_id == "route_progress_pct":
        if event.raw_facts.route_progress_available:
            base["scalar_value"] = _exact(event.vehicle_state.route_progress_pct, "%")
            pointer = "/vehicle_state/route_progress_pct"
        else:
            base["scalar_value"] = _exact(None, "%")
            base["category"] = "NOT_AVAILABLE"
            base["availability"] = "NOT_AVAILABLE"
            base["unavailable_reason"] = "route progress explicitly unavailable"
            pointer = "/raw_facts/route_progress_available"
    elif track_id == "ttc_s":
        value, availability, reason = _ttc_point(event)
        base["scalar_value"] = value
        base["category"] = "COMPUTED" if availability == "AVAILABLE" else "NOT_AVAILABLE"
        base["availability"] = availability
        base["unavailable_reason"] = reason
        pointer = "/observation_summary"
    elif track_id == "policy_latency_ms":
        base["scalar_value"] = _exact(event.policy_latency_ms, "ms")
        pointer = "/policy_latency_ms"
    elif track_id == "verifier_triggering_findings":
        base["category"] = "COMPUTED"
        base["string_list_value"] = StringListValue(
            values=tuple(
                finding.finding_id
                for finding in findings
                if event.sequence in finding.supporting_event_sequences
            )
        )
        return Point(
            **base,
            source_reference=_reference("FINDING", ""),
        )
    else:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            f"unsupported accepted timeline track: {track_id}",
        )
    return Point(
        **base,
        source_reference=_reference("EVENT", pointer, event.sequence),
    )


def _timeline(snapshot: object, findings: tuple[FindingItem, ...]) -> Timeline:
    schema = snapshot.manifest.evidence_schema_version
    tracks: list[Track] = []
    for track_id in _TRACK_ORDER:
        if schema == "1.0" and track_id in _LEGACY_UNAVAILABLE_TRACKS:
            tracks.append(
                Track(
                    track_id=track_id,
                    label=_TRACK_LABELS[track_id],
                    category="NOT_AVAILABLE",
                    availability="NOT_AVAILABLE",
                    unavailable_reason=_LEGACY_TRACK_REASON,
                    value_kind={
                        "raw_observation": "OBSERVATION",
                        "delivered_observation": "OBSERVATION",
                        "result_observation": "OBSERVATION",
                        "permitted_action": "ACTION",
                        "observation_fault_reasons": "STRING_LIST",
                        "control_fault_reasons": "STRING_LIST",
                    }[track_id],
                    points=(),
                    source_references=(),
                )
            )
            continue
        points = tuple(
            _point_for_track(snapshot, findings, track_id, event) for event in snapshot.events
        )
        if track_id == "ttc_s":
            sources = _ordered_references(
                *(reference for event in snapshot.events for reference in _ttc_references(event))
            )
        elif track_id == "verifier_triggering_findings":
            sources = tuple(
                _reference("FINDING", f"/findings/{index}")
                for index, finding in enumerate(findings)
                if finding.supporting_event_sequences
            )
        else:
            sources = tuple(point.source_reference for point in points)
        value_kind = {
            "raw_observation": "OBSERVATION",
            "delivered_observation": "OBSERVATION",
            "result_observation": "OBSERVATION",
            "candidate_action": "ACTION",
            "permitted_action": "ACTION",
            "executed_action": "ACTION",
            "override_reasons": "STRING_LIST",
            "observation_fault_reasons": "STRING_LIST",
            "control_fault_reasons": "STRING_LIST",
            "collision_count": "SCALAR",
            "offroad": "SCALAR",
            "speed_mps": "SCALAR",
            "route_progress_pct": "SCALAR",
            "ttc_s": "SCALAR",
            "policy_latency_ms": "SCALAR",
            "verifier_triggering_findings": "STRING_LIST",
        }[track_id]
        category = (
            "COMPUTED"
            if track_id
            in {
                "ttc_s",
                "verifier_triggering_findings",
            }
            else "OBSERVED"
        )
        tracks.append(
            Track(
                track_id=track_id,
                label=_TRACK_LABELS[track_id],
                category=category,
                availability="AVAILABLE",
                unavailable_reason=None,
                value_kind=value_kind,
                points=points,
                source_references=sources,
            )
        )
    return Timeline(
        event_count=len(snapshot.events),
        simulation_start_s=snapshot.events[0].simulation_time_s,
        simulation_end_s=snapshot.events[-1].simulation_time_s,
        tracks=tuple(tracks),
        category="OBSERVED",
    )


def _tool(hermes_version: str) -> ToolInfo:
    return ToolInfo(
        hermes_distribution="hermes-autonomy",
        hermes_version=hermes_version,
        review_schema_version="1.0",
        category="COMPUTED",
    )


def _digest(value: str | None, semantic: str) -> DigestInfo | None:
    if value is None:
        return None
    return DigestInfo(
        algorithm="SHA-256",
        value=value,
        semantic=semantic,
        category="OBSERVED" if semantic == "OBSERVED_CLAIM" else "COMPUTED",
    )


def _artifact(capture: object, selected_relative_path: str) -> PortableArtifactIdentity:
    inspection = capture.inspection
    snapshot = inspection.snapshot
    safe_identity = capture.safe_manifest_identity
    identity = snapshot.manifest if snapshot is not None else safe_identity
    created_at_utc = None
    if snapshot is not None:
        created_at_utc = snapshot.manifest.model_dump(mode="json")["created_at_utc"]
    elif safe_identity is not None:
        created_at_utc = safe_identity.created_at_utc
    return PortableArtifactIdentity(
        locator=LocatorInfo(
            selected_relative_path=selected_relative_path,
            selected_directory_name=selected_relative_path.rsplit("/", 1)[-1],
            category="OBSERVED",
        ),
        manifest_identity=ManifestIdentityInfo(
            run_id=None if identity is None else identity.run_id,
            created_at_utc=created_at_utc,
            evidence_schema_version=(
                None if identity is None else identity.evidence_schema_version
            ),
            scenario_schema_version=(
                None if identity is None else identity.scenario_schema_version
            ),
            category="OBSERVED",
        ),
        observed_bundle_digest=_digest(inspection.observed_bundle_digest, "OBSERVED_CLAIM"),
        computed_bundle_digest=_digest(inspection.computed_bundle_digest, "COMPUTED_FROM_CAPTURE"),
        observed_trace_digest=_digest(inspection.observed_trace_digest, "OBSERVED_CLAIM"),
        computed_trace_digest=_digest(inspection.computed_trace_digest, "COMPUTED_FROM_EVENTS"),
        source_inventory=tuple(
            SourceInventoryItem(
                file=SourceFileObservation(
                    file_name=item.file_name,
                    size_bytes=item.size_bytes,
                    category="OBSERVED",
                ),
                observed_sha256=CategorizedDigest(
                    algorithm="SHA-256",
                    value=item.observed_sha256,
                    category="COMPUTED",
                ),
            )
            for item in inspection.source_inventory
        ),
    )


def _trust() -> TrustInfo:
    rows = (
        (
            "authenticity",
            "NOT_AUTHENTICATED",
            "AUTHENTICITY",
            "Local hashes do not establish an independently trusted origin.",
        ),
        (
            "authorization",
            "NOT_EVALUATED",
            "ASSUMPTION",
            "Phase 6 does not evaluate promotion or release authority.",
        ),
        (
            "deployment_permission",
            "NONE",
            "RESIDUAL_RISK",
            "Simulation evidence grants no physical deployment permission.",
        ),
        (
            "scope",
            "SIMULATION_ONLY",
            "ASSUMPTION",
            "Hermes Phase 6 is limited to simulation and closed-lab review.",
        ),
        (
            "authoritative_status",
            "NOT_DEFINED",
            "ASSUMPTION",
            "Phase 6 defines no authoritative or official status.",
        ),
    )
    return TrustInfo(
        records=tuple(
            TrustRecord(
                dimension=dimension,
                value=value,
                category=category,
                explanation=explanation,
            )
            for dimension, value, category, explanation in rows
        )
    )


def _assumptions() -> tuple[AssumptionItem, ...]:
    return (
        AssumptionItem(
            id="authoritative_status.not_defined",
            text="No authoritative or official status is defined in Phase 6.",
            impact="The review cannot be treated as an official approval or attestation.",
            category="ASSUMPTION",
            source_references=(),
        ),
        AssumptionItem(
            id="authorization.not_evaluated",
            text="Promotion and release authorization are not evaluated.",
            impact="A gate verdict grants no authorization to promote or release software.",
            category="ASSUMPTION",
            source_references=(),
        ),
        AssumptionItem(
            id="scope.simulation_only",
            text="Evidence is interpreted within a simulation-only product boundary.",
            impact="No real-world vehicle behavior or road readiness is established.",
            category="ASSUMPTION",
            source_references=(),
        ),
    )


def _fixed_limitations() -> tuple[LimitationItem, ...]:
    return (
        LimitationItem(
            id="authenticity.not_authenticated",
            text="The evidence origin is not independently authenticated.",
            impact="A producer able to rewrite the bundle may recompute local hashes.",
            category="AUTHENTICITY",
            source_references=(),
        ),
        LimitationItem(
            id="authorization.not_evaluated",
            text="Hermes does not evaluate release or promotion authorization.",
            impact="The review cannot authorize a release action.",
            category="RESIDUAL_RISK",
            source_references=(),
        ),
        LimitationItem(
            id="deployment.permission.none",
            text="No deployment permission is granted.",
            impact="The result must not be used to deploy to physical hardware.",
            category="RESIDUAL_RISK",
            source_references=(),
        ),
        LimitationItem(
            id="scope.simulation_only",
            text="The reviewed evidence is simulation-only.",
            impact="It establishes no real-world safety, certification, or compliance claim.",
            category="RESIDUAL_RISK",
            source_references=(),
        ),
        LimitationItem(
            id="verification.stored_only",
            text="Stored verification does not rerun a policy or simulator.",
            impact="Runtime facts remain claims made by the evidence producer.",
            category="RESIDUAL_RISK",
            source_references=(),
        ),
    )


def _quarantined_provenance() -> Provenance:
    empty = {
        name: None
        for name in RecordedProvenance.model_fields
        if name
        not in {
            "status",
            "category",
            "source_references",
        }
    }
    return Provenance(
        recorded=RecordedProvenance(
            status="QUARANTINED",
            category="NOT_AVAILABLE",
            source_references=(),
            **empty,
        ),
        authenticated_origin=AuthenticatedOrigin(
            status="NOT_AUTHENTICATED",
            signer_id=None,
            signature_id=None,
            category="AUTHENTICITY",
        ),
    )


def _accepted_provenance(snapshot: object) -> Provenance:
    manifest = snapshot.manifest
    fields = {
        "hermes_version": manifest.hermes_version,
        "hermes_git_commit": manifest.repository_commit,
        "hermes_git_dirty": manifest.repository_dirty,
        "repository_provenance_reason": manifest.repository_provenance_reason,
        "adapter_name": manifest.adapter_name,
        "adapter_version": manifest.adapter_version,
        "adapter_config_digest": manifest.adapter_config_digest,
        "simulator_name": manifest.simulator_name,
        "simulator_version": manifest.simulator_version,
        "simulator_commit": manifest.simulator_commit,
        "policy_name": manifest.policy_name,
        "policy_version": manifest.policy_version,
        "policy_config_digest": manifest.policy_config_digest,
        "shield_name": manifest.shield_name,
        "shield_version": manifest.shield_version,
        "shield_config_digest": manifest.shield_config_digest,
        "fault_name": getattr(manifest, "fault_name", None),
        "fault_version": getattr(manifest, "fault_version", None),
        "fault_config_digest": getattr(manifest, "fault_config_digest", None),
        "gate_name": manifest.gate_name,
        "gate_version": manifest.gate_version,
        "gate_config_digest": manifest.gate_config_digest,
        "scenario_name": manifest.scenario_name,
        "scenario_version": manifest.scenario_version,
        "scenario_schema_version": manifest.scenario_schema_version,
        "scenario_digest": manifest.scenario_digest,
        "python_version": manifest.python_version,
        "platform": manifest.platform,
        "architecture": manifest.architecture,
    }
    manifest_pointers = {
        "hermes_version": "/hermes_version",
        "hermes_git_commit": "/repository_commit",
        "hermes_git_dirty": "/repository_dirty",
        "repository_provenance_reason": "/repository_provenance_reason",
        "adapter_name": "/adapter_name",
        "adapter_version": "/adapter_version",
        "adapter_config_digest": "/adapter_config_digest",
        "simulator_name": "/simulator_name",
        "simulator_version": "/simulator_version",
        "simulator_commit": "/simulator_commit",
        "policy_name": "/policy_name",
        "policy_version": "/policy_version",
        "policy_config_digest": "/policy_config_digest",
        "shield_name": "/shield_name",
        "shield_version": "/shield_version",
        "shield_config_digest": "/shield_config_digest",
        "fault_name": "/fault_name",
        "fault_version": "/fault_version",
        "fault_config_digest": "/fault_config_digest",
        "gate_name": "/gate_name",
        "gate_version": "/gate_version",
        "gate_config_digest": "/gate_config_digest",
        "scenario_name": "/scenario_name",
        "scenario_version": "/scenario_version",
        "scenario_schema_version": "/scenario_schema_version",
        "scenario_digest": "/scenario_digest",
        "python_version": "/python_version",
        "platform": "/platform",
        "architecture": "/architecture",
    }
    references = _ordered_references(
        *(
            _reference("MANIFEST", manifest_pointers[name])
            for name, value in fields.items()
            if value is not None
        )
    )
    return Provenance(
        recorded=RecordedProvenance(
            status="ACCEPTED",
            category="OBSERVED",
            source_references=references,
            **fields,
        ),
        authenticated_origin=AuthenticatedOrigin(
            status="NOT_AUTHENTICATED",
            signer_id=None,
            signature_id=None,
            category="AUTHENTICITY",
        ),
    )


def _invalid_review(
    capture: object,
    *,
    selected_relative_path: str,
    hermes_version: str,
) -> ReviewEnvelope:
    inspection = capture.inspection
    diagnostics = tuple(
        DiagnosticItem(
            id=f"verification.error.{index:04d}",
            code="ARTIFACT_VERIFICATION_ERROR",
            text=error,
            impact=_QUARANTINE_IMPACT,
            category="COMPUTED",
            source_references=(),
        )
        for index, error in enumerate(inspection.verification.errors, start=1)
    )
    return ReviewEnvelope(
        review_schema_version="1.0",
        tool=_tool(hermes_version),
        artifact=_artifact(capture, selected_relative_path),
        verification={
            "integrity": "INVALID_EVIDENCE",
            "verified_by": _VERIFIER_ID,
            "errors": diagnostics,
            "first_mismatch_sequence": inspection.verification.first_mismatch_sequence,
            "stored_claims_quarantined": bool(inspection.stored_claim_files),
            "category": "COMPUTED",
        },
        trust=_trust(),
        gate=GateInfo(
            verdict="INVALID_EVIDENCE",
            category="GATE_DECISION",
            accepted_recomputation=False,
            gate_name=None,
            gate_version=None,
            gate_config_digest_sha256=None,
            rationale=(),
            hard_failure_ids=(),
            soft_failure_ids=(),
            supporting_finding_ids=(),
            residual_limitation_ids=(),
        ),
        evidence_sufficiency=EvidenceSufficiency(
            profile_name=None,
            profile_version=None,
            summary=SufficiencySummary(
                required_and_available=0,
                required_but_unavailable=0,
                optional_and_available=0,
                optional_and_unavailable=0,
                not_applicable=0,
            ),
            items=(),
            category="COMPUTED",
        ),
        findings=(),
        metrics=(),
        timeline=Timeline(
            event_count=0,
            simulation_start_s=None,
            simulation_end_s=None,
            tracks=(),
            category="OBSERVED",
        ),
        provenance=_quarantined_provenance(),
        diagnostics=diagnostics,
        assumptions=_assumptions(),
        unavailable_evidence=(),
        residual_limitations=_fixed_limitations(),
    )


def project_review_envelope(
    capture: object,
    *,
    selected_relative_path: str,
    hermes_version: str,
) -> ReviewEnvelope:
    """Project one already captured and stored-verified artifact without I/O."""

    if capture.inspection.snapshot is None:
        return _invalid_review(
            capture,
            selected_relative_path=selected_relative_path,
            hermes_version=hermes_version,
        )
    snapshot = capture.inspection.snapshot
    if len(snapshot.findings.findings) > 64:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "accepted finding count exceeds the review budget",
        )
    findings = _findings(snapshot)
    metrics = _metrics(snapshot)
    if len(metrics) > 64:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "accepted metric count exceeds the review budget",
        )
    sufficiency, unavailable = _sufficiency(snapshot, findings)
    limitations = _accepted_limitations(snapshot)
    inspection = capture.inspection
    return ReviewEnvelope(
        review_schema_version="1.0",
        tool=_tool(hermes_version),
        artifact=_artifact(capture, selected_relative_path),
        verification={
            "integrity": "INTERNALLY_CONSISTENT",
            "verified_by": _VERIFIER_ID,
            "errors": (),
            "first_mismatch_sequence": None,
            "stored_claims_quarantined": False,
            "category": "COMPUTED",
        },
        trust=_trust(),
        gate=_accepted_gate(snapshot, limitations),
        evidence_sufficiency=sufficiency,
        findings=findings,
        metrics=metrics,
        timeline=_timeline(snapshot, findings),
        provenance=_accepted_provenance(snapshot),
        diagnostics=tuple(
            DiagnosticItem(
                id=f"verification.notice.{index:04d}",
                code="ARTIFACT_VERIFICATION_NOTICE",
                text=error,
                impact="The accepted stored verification retained this diagnostic.",
                category="COMPUTED",
                source_references=(),
            )
            for index, error in enumerate(inspection.verification.errors, start=1)
        ),
        assumptions=_assumptions(),
        unavailable_evidence=unavailable,
        residual_limitations=limitations,
    )


_COMPARISON_DIMENSION_ORDER = (
    "verdict",
    "hard_failures",
    "collision_count",
    "minimum_ttc_s",
    "route_completion_pct",
    "max_abs_acceleration_mps2",
    "max_abs_jerk_mps3",
    "p95_policy_latency_ms",
    "policy_latency_source",
    "shield_interventions",
    "evidence_availability",
)
_COMPARISON_PARTITION_ORDER = _COMPARISON_DIMENSION_ORDER[2:-1]
_COMPARISON_AVAILABILITY_ORDER = (
    "minimum_ttc_s",
    "route_completion_pct",
    "max_abs_acceleration_mps2",
    "max_abs_jerk_mps3",
    "p95_policy_latency_ms",
)
_COMPARISON_UNIT_DIRECTION = MappingProxyType(
    {
        "verdict": (None, "NONE"),
        "collision_count": ("collisions", "LOWER"),
        "minimum_ttc_s": ("s", "HIGHER"),
        "route_completion_pct": ("%", "HIGHER"),
        "max_abs_acceleration_mps2": ("m/s^2", "LOWER"),
        "max_abs_jerk_mps3": ("m/s^3", "LOWER"),
        "p95_policy_latency_ms": ("ms", "LOWER"),
        "policy_latency_source": (None, "DESCRIPTIVE"),
        "shield_interventions": ("interventions", "DESCRIPTIVE"),
        "evidence_availability": (None, "NONE"),
    }
)
_COMPARISON_CORE_UNITS = MappingProxyType(
    {
        **{
            dimension_id: unit_direction[0]
            for dimension_id, unit_direction in _COMPARISON_UNIT_DIRECTION.items()
        },
        "shield_interventions": None,
    }
)


def _side_reference(
    side: str,
    source_type: str,
    pointer: str,
    sequence: int | None = None,
) -> SideReference:
    return SideReference(
        side=side,
        reference=_reference(source_type, pointer, sequence),
    )


def _side_reference_key(reference: SideReference) -> tuple[int, int, str, int]:
    source = reference.reference
    return (
        _FILE_ORDER[source.file_name],
        -1 if source.event_sequence is None else source.event_sequence,
        source.json_pointer or "",
        0 if reference.side == "BASELINE" else 1,
    )


def _ordered_side_references(
    *references: SideReference,
) -> tuple[SideReference, ...]:
    by_key = {_side_reference_key(reference): reference for reference in references}
    return tuple(by_key[key] for key in sorted(by_key))


def _summary_references(side: str) -> tuple[SideReference, ...]:
    return _ordered_side_references(
        *(
            _side_reference(side, "MANIFEST", pointer)
            for pointer in (
                "/run_id",
                "/created_at_utc",
                "/evidence_schema_version",
                "/scenario_schema_version",
            )
        ),
        _side_reference(side, "VERDICT", "/verdict"),
        _side_reference(side, "TRACE_DIGEST", ""),
        _side_reference(side, "BUNDLE_DIGEST", ""),
    )


def _comparison_references(
    dimension_id: str,
    baseline_snapshot: object,
    candidate_snapshot: object,
) -> tuple[SideReference, ...]:
    if dimension_id == "verdict":
        return _ordered_side_references(
            _side_reference("BASELINE", "VERDICT", "/verdict"),
            _side_reference("CANDIDATE", "VERDICT", "/verdict"),
        )
    if dimension_id == "hard_failures":
        return _ordered_side_references(
            _side_reference("BASELINE", "VERDICT", "/hard_failures"),
            _side_reference("CANDIDATE", "VERDICT", "/hard_failures"),
        )
    if dimension_id in {
        "collision_count",
        "minimum_ttc_s",
        "route_completion_pct",
        "max_abs_acceleration_mps2",
        "max_abs_jerk_mps3",
        "p95_policy_latency_ms",
    }:
        return _ordered_side_references(
            _side_reference("BASELINE", "METRIC", f"/{dimension_id}"),
            _side_reference("CANDIDATE", "METRIC", f"/{dimension_id}"),
        )
    if dimension_id == "policy_latency_source":
        return _ordered_side_references(
            *(
                _side_reference("BASELINE", "EVENT", "/latency_source", event.sequence)
                for event in baseline_snapshot.events
            ),
            *(
                _side_reference("CANDIDATE", "EVENT", "/latency_source", event.sequence)
                for event in candidate_snapshot.events
            ),
        )
    if dimension_id == "shield_interventions":
        return _ordered_side_references(
            *(
                _side_reference(side, "METRIC", pointer)
                for pointer in ("/shield_override_count", "/shield_override_reasons")
                for side in ("BASELINE", "CANDIDATE")
            )
        )
    if dimension_id == "evidence_availability":
        return _ordered_side_references(
            *(
                _side_reference(side, "METRIC", f"/{metric_id}")
                for metric_id in _COMPARISON_AVAILABILITY_ORDER
                for side in ("BASELINE", "CANDIDATE")
            )
        )
    raise ReviewUnavailableError(
        ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
        f"unsupported comparison dimension {dimension_id!r}",
    )


def _comparison_scalar(value: object, unit: str | None) -> ScalarDeltaValue:
    if value is not None and not isinstance(value, (str, bool, int, float)):
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison scalar has an unsupported shape",
        )
    return ScalarDeltaValue(kind="SCALAR", value=_exact(value, unit))


def _comparison_measurement(value: object) -> MeasurementDeltaValue:
    if not isinstance(value, Mapping) or set(value) != {"availability", "value", "reason"}:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison measurement has an unsupported shape",
        )
    availability = value["availability"]
    measured = value["value"]
    reason = value["reason"]
    if availability not in {"AVAILABLE", "NOT_AVAILABLE"}:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison measurement has an unsupported availability",
        )
    return MeasurementDeltaValue(
        kind="MEASUREMENT",
        availability=availability,
        value=measured,
        reason=reason,
    )


def _comparison_string_list(value: object) -> ComparisonStringListValue:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison string list has an unsupported shape",
        )
    return ComparisonStringListValue(kind="STRING_LIST", values=tuple(value))


def _comparison_intervention(value: object) -> InterventionValue:
    if not isinstance(value, Mapping) or set(value) != {"count", "reasons"}:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison intervention has an unsupported shape",
        )
    reasons = value["reasons"]
    if not isinstance(reasons, Mapping):
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison intervention reasons have an unsupported shape",
        )
    return InterventionValue(
        kind="INTERVENTION",
        count=value["count"],
        reasons=dict(sorted(reasons.items())),
    )


def _comparison_availability(value: object) -> AvailabilityMapValue:
    if not isinstance(value, Mapping) or set(value) != set(_COMPARISON_AVAILABILITY_ORDER):
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison availability map has an unsupported shape",
        )
    return AvailabilityMapValue(
        kind="AVAILABILITY_MAP",
        values=AvailabilityValues(**value),
    )


def _comparison_dimension_value(dimension_id: str, value: object):
    unit = _COMPARISON_UNIT_DIRECTION[dimension_id][0]
    if dimension_id in {"verdict", "collision_count"}:
        return _comparison_scalar(value, unit)
    if dimension_id in _COMPARISON_AVAILABILITY_ORDER:
        return _comparison_measurement(value)
    if dimension_id == "policy_latency_source":
        return _comparison_string_list(value)
    if dimension_id == "shield_interventions":
        return _comparison_intervention(value)
    if dimension_id == "evidence_availability":
        return _comparison_availability(value)
    raise ReviewUnavailableError(
        ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
        f"unsupported comparison dimension {dimension_id!r}",
    )


def _project_dimension(
    dimension: object,
    baseline_snapshot: object,
    candidate_snapshot: object,
) -> DimensionDelta:
    dimension_id = dimension.name
    if dimension_id not in _COMPARISON_UNIT_DIRECTION:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            f"unsupported comparison dimension {dimension_id!r}",
        )
    if dimension.unit != _COMPARISON_CORE_UNITS[dimension_id]:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            f"comparison dimension {dimension_id!r} has an unsupported unit",
        )
    unit, direction = _COMPARISON_UNIT_DIRECTION[dimension_id]
    return DimensionDelta(
        dimension_id=dimension_id,
        status=dimension.status.value,
        baseline_value=_comparison_dimension_value(dimension_id, dimension.baseline_value),
        candidate_value=_comparison_dimension_value(dimension_id, dimension.candidate_value),
        unit=unit,
        explanation=dimension.explanation,
        desired_direction=direction,
        category="COMPUTED",
        source_references=_comparison_references(
            dimension_id, baseline_snapshot, candidate_snapshot
        ),
    )


def _project_hard_failure(
    dimension: object,
    baseline_snapshot: object,
    candidate_snapshot: object,
) -> HardFailureDelta:
    if dimension.name != "hard_failures" or dimension.unit is not None:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "hard-failure comparison has an unsupported identity or unit",
        )
    baseline = _comparison_string_list(dimension.baseline_value).values
    candidate = _comparison_string_list(dimension.candidate_value).values
    return HardFailureDelta(
        status=dimension.status.value,
        baseline_ids=baseline,
        candidate_ids=candidate,
        removed_ids=tuple(sorted(set(baseline) - set(candidate))),
        added_ids=tuple(sorted(set(candidate) - set(baseline))),
        explanation=dimension.explanation,
        category="COMPUTED",
        source_references=_comparison_references(
            "hard_failures", baseline_snapshot, candidate_snapshot
        ),
    )


def project_comparison_envelope(
    comparison: ArtifactComparison,
    *,
    baseline: ReviewEnvelope,
    candidate: ReviewEnvelope,
    baseline_snapshot: object,
    candidate_snapshot: object,
) -> ComparisonEnvelope:
    """Map one authoritative core comparison into the portable review contract."""

    try:
        baseline_summary = SideSummary(
            side="BASELINE",
            artifact=baseline.artifact,
            integrity=baseline.verification.integrity,
            gate_verdict=baseline.gate.verdict,
            category="COMPUTED",
            source_references=_summary_references("BASELINE"),
        )
        candidate_summary = SideSummary(
            side="CANDIDATE",
            artifact=candidate.artifact,
            integrity=candidate.verification.integrity,
            gate_verdict=candidate.gate.verdict,
            category="COMPUTED",
            source_references=_summary_references("CANDIDATE"),
        )
        compatibility = CompatibilityInfo(
            status=("COMPATIBLE" if comparison.compatibility.comparable else "INCOMPATIBLE"),
            reasons=comparison.compatibility.reasons,
            warnings=comparison.compatibility.warnings,
            category="COMPUTED",
        )
        if not comparison.compatibility.comparable:
            if comparison.dimensions:
                raise ReviewUnavailableError(
                    ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
                    "incompatible core comparison unexpectedly contains dimensions",
                )
            return ComparisonEnvelope(
                comparison_schema_version="1.0",
                tool=baseline.tool,
                baseline=baseline_summary,
                candidate=candidate_summary,
                compatibility=compatibility,
                verdict_delta=None,
                hard_failure_delta=None,
                availability_summary_delta=None,
                improvements=(),
                regressions=(),
                unchanged_outcomes=(),
                not_comparable=(),
                availability_deltas=(),
                chart_series=(),
                residual_limitations=(),
            )
        dimension_ids = tuple(dimension.name for dimension in comparison.dimensions)
        if dimension_ids != _COMPARISON_DIMENSION_ORDER:
            raise ReviewUnavailableError(
                ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
                "comparison core dimensions do not match review schema 1.0",
            )
        by_id = {dimension.name: dimension for dimension in comparison.dimensions}
        verdict_delta = _project_dimension(by_id["verdict"], baseline_snapshot, candidate_snapshot)
        hard_failure_delta = _project_hard_failure(
            by_id["hard_failures"], baseline_snapshot, candidate_snapshot
        )
        availability_summary_delta = _project_dimension(
            by_id["evidence_availability"], baseline_snapshot, candidate_snapshot
        )
        projected = {
            dimension_id: _project_dimension(
                by_id[dimension_id], baseline_snapshot, candidate_snapshot
            )
            for dimension_id in _COMPARISON_PARTITION_ORDER
        }
        partitions = {
            "IMPROVED": tuple(
                projected[dimension_id]
                for dimension_id in _COMPARISON_PARTITION_ORDER
                if projected[dimension_id].status == "IMPROVED"
            ),
            "REGRESSED": tuple(
                projected[dimension_id]
                for dimension_id in _COMPARISON_PARTITION_ORDER
                if projected[dimension_id].status == "REGRESSED"
            ),
            "UNCHANGED": tuple(
                projected[dimension_id]
                for dimension_id in _COMPARISON_PARTITION_ORDER
                if projected[dimension_id].status == "UNCHANGED"
            ),
            "NOT_COMPARABLE": tuple(
                projected[dimension_id]
                for dimension_id in _COMPARISON_PARTITION_ORDER
                if projected[dimension_id].status == "NOT_COMPARABLE"
            ),
        }
        availability_deltas = tuple(
            AvailabilityDelta(
                metric_id=metric_id,
                baseline_availability=projected[metric_id].baseline_value.availability,
                candidate_availability=projected[metric_id].candidate_value.availability,
                baseline_reason=projected[metric_id].baseline_value.reason,
                candidate_reason=projected[metric_id].candidate_value.reason,
                category="COMPUTED",
                source_references=projected[metric_id].source_references,
            )
            for metric_id in _COMPARISON_AVAILABILITY_ORDER
            if (
                projected[metric_id].baseline_value.availability
                != projected[metric_id].candidate_value.availability
                or projected[metric_id].baseline_value.reason
                != projected[metric_id].candidate_value.reason
            )
        )
        chart_series: list[ChartSeries] = []
        for dimension_id in _COMPARISON_PARTITION_ORDER[:6]:
            delta = projected[dimension_id]
            if isinstance(delta.baseline_value, ScalarDeltaValue):
                baseline_numeric = delta.baseline_value.value.machine_value
                candidate_numeric = delta.candidate_value.value.machine_value
                eligible = (
                    isinstance(baseline_numeric, (int, float))
                    and not isinstance(baseline_numeric, bool)
                    and isinstance(candidate_numeric, (int, float))
                    and not isinstance(candidate_numeric, bool)
                )
            else:
                baseline_numeric = delta.baseline_value.value
                candidate_numeric = delta.candidate_value.value
                eligible = (
                    delta.baseline_value.availability == "AVAILABLE"
                    and delta.candidate_value.availability == "AVAILABLE"
                    and (
                        dimension_id != "p95_policy_latency_ms" or delta.status != "NOT_COMPARABLE"
                    )
                )
            if eligible:
                chart_series.append(
                    ChartSeries(
                        dimension_id=dimension_id,
                        baseline_numeric_value=baseline_numeric,
                        candidate_numeric_value=candidate_numeric,
                        unit=delta.unit,
                        category="COMPUTED",
                        source_references=delta.source_references,
                    )
                )
        return ComparisonEnvelope(
            comparison_schema_version="1.0",
            tool=baseline.tool,
            baseline=baseline_summary,
            candidate=candidate_summary,
            compatibility=compatibility,
            verdict_delta=verdict_delta,
            hard_failure_delta=hard_failure_delta,
            availability_summary_delta=availability_summary_delta,
            improvements=partitions["IMPROVED"],
            regressions=partitions["REGRESSED"],
            unchanged_outcomes=partitions["UNCHANGED"],
            not_comparable=partitions["NOT_COMPARABLE"],
            availability_deltas=availability_deltas,
            chart_series=tuple(chart_series),
            residual_limitations=(),
        )
    except ReviewUnavailableError:
        raise
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "comparison core result cannot be projected by review schema 1.0",
        ) from exc


def _visible_character(character: str) -> str:
    if unicode_category(character) not in {"Cc", "Cf"}:
        return character
    codepoint = ord(character)
    if codepoint <= 0xFFFF:
        return f"\\u{codepoint:04x}"
    return f"\\U{codepoint:08x}"


def truncate_display_text(
    value: str,
    *,
    limit: int = 1_024,
) -> DisplayTextProjection:
    """Neutralize controls and bound a non-authoritative display copy.

    ``limit`` and ``original_length`` are measured in input Unicode scalar
    values. The portable evidence value is never modified by this helper.
    """

    if not isinstance(value, str):
        raise TypeError("display value must be a string")
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 0:
        raise ValueError("display limit must be a non-negative integer")
    original_length = len(value)
    selected = value[:limit]
    return DisplayTextProjection(
        displayed_text="".join(_visible_character(character) for character in selected),
        truncated=original_length > limit,
        original_length=original_length,
    )


def page_records(
    records: tuple[_T, ...],
    *,
    offset: int,
    limit: int,
) -> tuple[_T, ...]:
    """Return one deterministic, non-mutating record page."""

    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
        raise ValueError("page offset must be a non-negative integer")
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
        raise ValueError("page limit must be a positive integer")
    return records[offset : offset + limit]


def group_records(
    records: Iterable[_T],
    *,
    key: Callable[[_T], _K],
) -> tuple[tuple[_K, tuple[_T, ...]], ...]:
    """Group records by a deterministic key without changing group order."""

    indexed = tuple(enumerate(records))
    ordered = sorted(indexed, key=lambda item: (key(item[1]), item[0]))
    return tuple(
        (group_key, tuple(item for _, item in group))
        for group_key, group in groupby(ordered, key=lambda item: key(item[1]))
    )


def format_threshold_value(value: ExactValue) -> str:
    """Format an exact threshold value without numeric conversion or rounding."""

    if not isinstance(value, ExactValue):
        raise TypeError("threshold value must be ExactValue")
    if value.machine_value is None:
        return value.display_text
    if value.canonical_text is None:
        raise ValueError("available threshold value requires canonical text")
    if value.unit is None:
        return value.canonical_text
    return f"{value.canonical_text} {value.unit}"
