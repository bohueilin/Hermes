"""Local, read-only Streamlit evidence review application."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import streamlit as st

from hermes.review import (
    ComparisonEnvelope,
    ReviewEnvelope,
    ReviewUnavailableError,
    compare_review_artifacts,
    format_threshold_value,
    page_records,
    review_artifact,
    truncate_display_text,
    validate_artifact_root,
)

_PRIMARY_WORKFLOWS = ("Review", "Compare", "Evidence limitations")
_REVIEW_SECTIONS = (
    "Select & Verify",
    "Overview",
    "Evidence",
    "Timeline",
    "Provenance",
)
_FINDING_GROUP_LABELS = (
    "Failed required evidence",
    "Required but unavailable",
    "Soft failures and warnings",
    "Passing required evidence",
    "Optional evidence",
    "Not applicable",
)
_TIMELINE_TRACK_REGISTRY = (
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
_TIMELINE_PRESETS = (
    (
        "Decision evidence",
        (
            "collision_count",
            "offroad",
            "route_progress_pct",
            "ttc_s",
            "verifier_triggering_findings",
        ),
    ),
    (
        "Action accountability",
        (
            "candidate_action",
            "permitted_action",
            "executed_action",
            "override_reasons",
            "policy_latency_ms",
        ),
    ),
    (
        "Fault behavior",
        (
            "raw_observation",
            "delivered_observation",
            "result_observation",
            "observation_fault_reasons",
            "control_fault_reasons",
            "policy_latency_ms",
        ),
    ),
    ("All tracks", _TIMELINE_TRACK_REGISTRY),
)
_TIMELINE_PRESET_NAMES = tuple(name for name, _track_ids in _TIMELINE_PRESETS)
_FINDING_TIMELINE_TRACKS = (
    ("trace.integrity", ("verifier_triggering_findings",)),
    ("collision.zero", ("collision_count", "verifier_triggering_findings")),
    ("boundary.within_tolerance", ("offroad", "verifier_triggering_findings")),
    ("progress.required", ("route_progress_pct", "verifier_triggering_findings")),
    (
        "comfort.acceleration",
        ("executed_action", "verifier_triggering_findings"),
    ),
    ("comfort.jerk", ("executed_action", "verifier_triggering_findings")),
    ("fault.coverage.required", ("verifier_triggering_findings",)),
)
_PAGE_SIZE = 50
_REFERENCE_PREVIEW_SIZE = 8
_FIXED_LIMITATION_RECORDS = (
    (
        "A Hermes PASS is only the installed prototype gate verdict for this bounded simulation.",
        "RESIDUAL_RISK",
    ),
    ("Internal consistency is not independent authenticity.", "AUTHENTICITY"),
    (
        "Stored verification does not reexecute the policy or simulator.",
        "RESIDUAL_RISK",
    ),
    ("Simulation evidence grants no physical-system permission.", "RESIDUAL_RISK"),
)
_PERSISTENT_TRUST_FRAME = (
    ("Origin", "NOT_AUTHENTICATED", "AUTHENTICITY"),
    ("Authorization", "NOT_EVALUATED", "ASSUMPTION"),
    ("Deployment permission", "NONE", "RESIDUAL_RISK"),
    ("Scope", "SIMULATION_ONLY", "ASSUMPTION"),
    ("Authoritative status", "NOT_DEFINED", "ASSUMPTION"),
)
_NON_AUTHORITY_SENTENCE = (
    "This is a simulation evidence decision, not an approval or deployment authorization."
)
_REQUIRED_UNAVAILABLE_COPY = (
    "This signal was required by the selected verifier profile but could not be computed "
    "from the stored evidence."
)
_OPTIONAL_UNAVAILABLE_COPY = (
    "This signal could not be computed from the stored evidence. It does not control the "
    "current gate verdict, but it remains a review limitation."
)
_NOT_APPLICABLE_COPY = (
    "This verifier is not required or evaluated under the selected profile."
)
_MIXED_COMPARISON_COPY = (
    "Minimum TTC improved. Route completion, acceleration, and jerk regressed. The gate "
    "verdict did not improve. This is a mixed trade-off and does not establish overall "
    "advancement."
)


@dataclass(frozen=True, slots=True)
class _AppArguments:
    artifact_root: Path


class _RaisingArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise ValueError("invalid workbench application arguments")


def _parse_app_arguments(argv: Sequence[str]) -> _AppArguments:
    """Parse one exact already-canonical root without leaking untrusted text."""

    parser = _RaisingArgumentParser(add_help=False, allow_abbrev=False)
    parser.add_argument("--artifact-root", action="append", required=True)
    try:
        namespace = parser.parse_args(tuple(argv))
        values = namespace.artifact_root
        if not isinstance(values, list) or len(values) != 1:
            raise ValueError
        value = values[0]
        if not isinstance(value, str) or not value or "\0" in value:
            raise ValueError
        received = Path(value)
        if not received.is_absolute():
            raise ValueError
        validated = validate_artifact_root(received)
        if value != str(validated):
            raise ValueError
    except (OSError, RuntimeError, TypeError, ValueError) as exc:
        raise ValueError("invalid workbench application arguments") from exc
    return _AppArguments(artifact_root=validated)


def _safe_row(*values: tuple[str, object]) -> dict[str, str]:
    """Project fields and preserve explicit per-field display-loss metadata."""

    row: dict[str, str] = {}
    for label, value in values:
        displayed_value = "NOT_AVAILABLE" if value is None else value
        projection = truncate_display_text(str(displayed_value))
        row[label] = projection.displayed_text
        row[f"{label} truncated"] = "true" if projection.truncated else "false"
        row[f"{label} original scalar count"] = str(projection.original_length)
    return row


def _categorized_text_row(
    label: str,
    value: object | None,
    category: str,
) -> dict[str, str]:
    effective_category = "NOT_AVAILABLE" if value is None else category
    return _safe_row(
        ("label", label),
        ("value", value),
        ("category", effective_category),
    )


def _render_categorized_row(row: dict[str, str]) -> None:
    st.text(f"{row['label']}: {row['value']} [{row['category']}]")
    if row["value truncated"] == "true":
        st.caption(
            f"{row['label']} display truncated; original scalar count: "
            f"{row['value original scalar count']}."
        )


def _render_categorized_text(
    label: str,
    value: object | None,
    category: str,
) -> None:
    _render_categorized_row(_categorized_text_row(label, value, category))


def _text_rows(values: Sequence[tuple[str, object]]) -> tuple[dict[str, str], ...]:
    rows: list[dict[str, str]] = []
    for label, value in values:
        displayed_value = "NOT_AVAILABLE" if value is None else value
        projected_label = truncate_display_text(str(label))
        projected_value = truncate_display_text(str(displayed_value))
        row = _safe_row(
            ("label", projected_label.displayed_text),
            ("value", displayed_value),
        )
        row["truncated"] = "true" if projected_value.truncated else "false"
        row["original scalar count"] = str(projected_value.original_length)
        rows.append(row)
    return tuple(rows)


def _reference_text(references: Sequence[object]) -> str:
    values = []
    for reference in references:
        side = getattr(reference, "side", None)
        item = getattr(reference, "reference", reference)
        segments = []
        if side is not None:
            segments.append(f"side={side}")
        segments.extend(
            (
                f"source_type={item.source_type}",
                f"file_name={item.file_name}",
                "json_pointer="
                + (str(item.json_pointer) if item.json_pointer is not None else "NOT_AVAILABLE"),
                "event_sequence="
                + (
                    str(item.event_sequence)
                    if item.event_sequence is not None
                    else "NOT_AVAILABLE"
                ),
            )
        )
        values.append("|".join(segments))
    return "; ".join(values) if values else "NOT_AVAILABLE"


def _threshold_text(expression: object) -> str:
    clause = getattr(expression, "clause", None)
    if clause is not None:
        return " ".join(
            (
                str(clause.left_operand),
                str(clause.operator),
                (
                    format_threshold_value(clause.right_operand)
                    if clause.right_operand is not None
                    else "NOT_APPLICABLE"
                ),
            )
        )
    invariant = getattr(expression, "invariant", None)
    if invariant is not None:
        return " ".join(
            (
                str(invariant.operator),
                "complete captured evidence",
            )
        )
    children = getattr(expression, "children", ())
    return f"{expression.kind}: " + " ; ".join(_threshold_text(child) for child in children)


def _threshold_details(expression: object) -> tuple[str, str, str, str]:
    labels: list[str] = []
    transforms: list[str] = []
    configuration_references: list[object] = []
    evidence_references: list[object] = []

    def visit(item: object) -> None:
        clause = getattr(item, "clause", None)
        invariant = getattr(item, "invariant", None)
        labels.append(str(getattr(item, "label", "")))
        if clause is not None:
            transforms.extend(str(value) for value in clause.transforms)
            configuration_references.extend(clause.configuration_sources)
            evidence_references.extend(clause.evidence_sources)
        elif invariant is not None:
            configuration_references.extend(invariant.configuration_sources)
            evidence_references.extend(invariant.evidence_sources)
        for child in getattr(item, "children", ()):
            visit(child)

    visit(expression)
    return (
        " ; ".join(value for value in labels if value) or "NOT_AVAILABLE",
        " ; ".join(transforms) or "NOT_AVAILABLE",
        _reference_text(configuration_references),
        _reference_text(evidence_references),
    )


def _threshold_rows(finding: object) -> tuple[dict[str, str], ...]:
    rows: list[dict[str, str]] = []

    def visit(expression: object, path: str, depth: int) -> None:
        kind = expression.kind
        clause = expression.clause
        invariant = expression.invariant
        if clause is not None:
            right = clause.right_operand
            machine = right.machine_value if right is not None else "NOT_APPLICABLE"
            if right is not None and machine is None:
                machine = "NOT_AVAILABLE"
            exact = (
                right.canonical_text or "NOT_AVAILABLE"
                if right is not None
                else "NOT_APPLICABLE"
            )
            displayed = right.display_text if right is not None else "NOT_APPLICABLE"
            unit = right.unit or "NOT_AVAILABLE" if right is not None else "NOT_APPLICABLE"
            left = clause.left_operand
            transforms = "; ".join(clause.transforms)
            operator = clause.operator
            configuration = (
                _reference_text(clause.configuration_sources)
                if clause.configuration_sources
                else "NOT_APPLICABLE"
            )
            evidence = (
                _reference_text(clause.evidence_sources)
                if clause.evidence_sources
                else "NOT_APPLICABLE"
            )
        elif invariant is not None:
            machine = exact = displayed = unit = "NOT_APPLICABLE"
            left = transforms = "NOT_APPLICABLE"
            operator = invariant.operator
            configuration = (
                _reference_text(invariant.configuration_sources)
                if invariant.configuration_sources
                else "NOT_APPLICABLE"
            )
            evidence = (
                _reference_text(invariant.evidence_sources)
                if invariant.evidence_sources
                else "NOT_APPLICABLE"
            )
        else:
            machine = exact = displayed = unit = "NOT_APPLICABLE"
            left = transforms = operator = "NOT_APPLICABLE"
            configuration = evidence = "NOT_APPLICABLE"
        rows.append(
            _safe_row(
                ("finding ID", finding.finding_id),
                ("node path", path),
                ("depth", depth),
                ("kind", kind),
                ("label", expression.label),
                ("category", finding.category),
                ("group operator", kind if kind in {"ALL_OF", "ANY_OF"} else "NOT_APPLICABLE"),
                ("left operand", left),
                ("ordered transforms", transforms),
                ("operator", operator),
                ("right machine value", machine),
                ("right exact value", exact),
                ("right display value", displayed),
                ("right unit", unit),
                ("configuration references", configuration),
                ("evidence references", evidence),
            )
        )
        for index, child in enumerate(expression.children):
            visit(child, f"{path}.{index}", depth + 1)

    visit(finding.threshold, "root", 0)
    return tuple(rows)


def _trust_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    records = {record.dimension: record for record in envelope.trust.records}
    rows = (
        ("Gate verdict", envelope.gate.verdict, envelope.gate.category),
        (
            "Evidence integrity",
            envelope.verification.integrity,
            envelope.verification.category,
        ),
        (
            "Evidence authenticity",
            records["authenticity"].value,
            records["authenticity"].category,
        ),
        (
            "Authorization status",
            records["authorization"].value,
            records["authorization"].category,
        ),
        (
            "Deployment permission",
            records["deployment_permission"].value,
            records["deployment_permission"].category,
        ),
        ("Scope", records["scope"].value, records["scope"].category),
        (
            "Authoritative status",
            records["authoritative_status"].value,
            records["authoritative_status"].category,
        ),
    )
    return tuple(
        _safe_row(("dimension", dimension), ("value", value), ("category", category))
        for dimension, value, category in rows
    )


def _accepted_review_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    if envelope.verification.integrity != "INTERNALLY_CONSISTENT":
        return ()
    gate_category = envelope.gate.category
    sufficiency_category = envelope.evidence_sufficiency.category
    values = (
            ("Gate rationale", "; ".join(envelope.gate.rationale), gate_category),
            ("Gate category", gate_category, gate_category),
            ("Accepted recomputation", envelope.gate.accepted_recomputation, gate_category),
            ("Hard failures", ", ".join(envelope.gate.hard_failure_ids) or "NONE", gate_category),
            ("Soft failures", ", ".join(envelope.gate.soft_failure_ids) or "NONE", gate_category),
            (
                "Supporting findings",
                ", ".join(envelope.gate.supporting_finding_ids) or "NONE",
                gate_category,
            ),
            (
                "Gate residual limitations",
                ", ".join(envelope.gate.residual_limitation_ids) or "NONE",
                gate_category,
            ),
            ("Gate name", envelope.gate.gate_name or "NOT_AVAILABLE", gate_category),
            ("Gate version", envelope.gate.gate_version or "NOT_AVAILABLE", gate_category),
            (
                "Gate config digest",
                envelope.gate.gate_config_digest_sha256 or "NOT_AVAILABLE",
                gate_category,
            ),
            (
                "Evidence profile name",
                envelope.evidence_sufficiency.profile_name or "NOT_AVAILABLE",
                sufficiency_category,
            ),
            (
                "Evidence profile version",
                envelope.evidence_sufficiency.profile_version or "NOT_AVAILABLE",
                sufficiency_category,
            ),
            (
                "Required / available",
                envelope.evidence_sufficiency.summary.required_and_available,
                sufficiency_category,
            ),
            (
                "Required / unavailable",
                envelope.evidence_sufficiency.summary.required_but_unavailable,
                sufficiency_category,
            ),
            (
                "Optional / available",
                envelope.evidence_sufficiency.summary.optional_and_available,
                sufficiency_category,
            ),
            (
                "Optional / unavailable",
                envelope.evidence_sufficiency.summary.optional_and_unavailable,
                sufficiency_category,
            ),
            (
                "Not applicable",
                envelope.evidence_sufficiency.summary.not_applicable,
                sufficiency_category,
            ),
        )
    return tuple(
        _safe_row(
            ("label", label),
            ("value", value),
            ("category", category),
        )
        for label, value, category in values
    )


def _finding_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    rows = []
    for finding in envelope.findings:
        labels, transforms, configuration, evidence = _threshold_details(finding.threshold)
        rows.append(
            _safe_row(
                ("finding ID", finding.finding_id),
                ("label", finding.label),
                ("explanation", finding.explanation),
                ("verifier", finding.verifier_name),
                ("verifier version", finding.verifier_version),
                ("category", finding.category),
                ("status", finding.status),
                ("severity", finding.severity),
                ("hard invariant", finding.hard_invariant),
                ("requiredness", finding.requiredness),
                ("machine value", finding.measured.machine_value),
                ("exact value", finding.measured.canonical_text or "NOT_AVAILABLE"),
                ("display value", finding.measured.display_text),
                ("unit", finding.measured.unit or "NOT_AVAILABLE"),
                ("threshold", _threshold_text(finding.threshold)),
                ("threshold label", finding.threshold.label),
                ("threshold category", finding.category),
                ("threshold nested labels", labels),
                ("threshold transforms", transforms),
                ("threshold configuration references", configuration),
                ("threshold evidence references", evidence),
                ("threshold source", finding.threshold_source_text),
                (
                    "first failure time",
                    finding.first_failure_simulation_time_s
                    if finding.first_failure_simulation_time_s is not None
                        else "NOT_AVAILABLE",
                ),
                (
                    "first failure time unit",
                    "s"
                    if finding.first_failure_simulation_time_s is not None
                    else "NOT_APPLICABLE",
                ),
                (
                    "supporting sequences",
                    ", ".join(str(item) for item in finding.supporting_event_sequences)
                    or "NONE",
                ),
                ("availability", finding.evidence_availability),
                ("gate consequence", finding.consequence.effect),
                ("consequence category", finding.category),
                ("consequence triggered", finding.consequence.triggered),
                (
                    "result if controlling",
                    finding.consequence.result_if_controlling or "NOT_APPLICABLE",
                ),
                ("consequence source", finding.consequence.source),
                (
                    "listed in hard failures",
                    finding.consequence.listed_in_hard_failures,
                ),
                (
                    "listed in soft failures",
                    finding.consequence.listed_in_soft_failures,
                ),
                (
                    "listed in supporting findings",
                    finding.consequence.listed_in_supporting_findings,
                ),
                (
                    "consequence configuration references",
                    _reference_text(finding.consequence.configuration_references),
                ),
                ("source references", _reference_text(finding.source_references)),
            )
        )
        if finding.measured.machine_value is None:
            rows[-1]["machine value"] = "NOT_AVAILABLE"
            rows[-1]["machine value original scalar count"] = str(len("NOT_AVAILABLE"))
    return tuple(rows)


def _finding_group_id(finding: object) -> str:
    if finding.requiredness == "REQUIRED" and finding.status == "FAIL":
        return "Failed required evidence"
    if (
        finding.requiredness == "REQUIRED"
        and finding.evidence_availability == "NOT_AVAILABLE"
    ):
        return "Required but unavailable"
    if finding.status == "FAIL":
        return "Soft failures and warnings"
    if finding.requiredness == "REQUIRED":
        return "Passing required evidence"
    if finding.requiredness == "OPTIONAL":
        return "Optional evidence"
    return "Not applicable"


def _compact_finding_row(finding: object) -> dict[str, str]:
    return _safe_row(
        ("finding ID", finding.finding_id),
        ("label", finding.label),
        ("status", finding.status),
        ("requiredness", finding.requiredness),
        ("display value", finding.measured.display_text),
        ("unit", finding.measured.unit or "NOT_AVAILABLE"),
        ("short rule", _threshold_text(finding.threshold)),
        ("gate consequence", finding.consequence.effect),
        (
            "first supporting event",
            finding.supporting_event_sequences[0]
            if finding.supporting_event_sequences
            else "NOT_AVAILABLE",
        ),
    )


def _grouped_finding_rows(
    envelope: ReviewEnvelope,
) -> dict[str, tuple[dict[str, str], ...]]:
    grouped: dict[str, list[dict[str, str]]] = {
        label: [] for label in _FINDING_GROUP_LABELS
    }
    for finding in envelope.findings:
        grouped[_finding_group_id(finding)].append(_compact_finding_row(finding))
    return {label: tuple(grouped[label]) for label in _FINDING_GROUP_LABELS}


def _finding_detail_rows(
    envelope: ReviewEnvelope,
    finding_id: str,
) -> tuple[dict[str, str], ...]:
    return tuple(
        row for row in _finding_rows(envelope) if row["finding ID"] == finding_id
    )


def _finding_threshold_rows(
    envelope: ReviewEnvelope,
    finding_id: str,
) -> tuple[dict[str, str], ...]:
    return tuple(
        row
        for finding in envelope.findings
        if finding.finding_id == finding_id
        for row in _threshold_rows(finding)
    )


def _availability_explanation(item: object) -> str:
    if item.requirement == "NOT_APPLICABLE":
        return _NOT_APPLICABLE_COPY
    if item.availability != "NOT_AVAILABLE":
        return "Evidence is available for evaluation under the selected profile."
    if item.requirement == "REQUIRED":
        return _REQUIRED_UNAVAILABLE_COPY
    return _OPTIONAL_UNAVAILABLE_COPY


def _sufficiency_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("evidence ID", item.evidence_id),
            ("label", item.label),
            ("requiredness", item.requirement),
            ("availability", item.availability),
            ("availability explanation", _availability_explanation(item)),
            ("reason", item.reason or "NOT_APPLICABLE"),
            ("category", item.category),
            ("gate consequence", item.consequence.effect),
            ("consequence category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.evidence_sufficiency.items
    )


def _point_value(point: object) -> str:
    for name in ("scalar_value", "action_value", "observation_value", "string_list_value"):
        value = getattr(point, name)
        if value is not None:
            if name == "scalar_value":
                return value.display_text
            return value.model_dump_json()
    return "NOT_AVAILABLE"


def _point_exact_fields(point: object) -> tuple[object, str, str, str]:
    exact = point.scalar_value
    if exact is None:
        return ("NOT_APPLICABLE",) * 4
    machine = exact.machine_value if exact.machine_value is not None else "NOT_AVAILABLE"
    return (
        machine,
        exact.canonical_text or "NOT_AVAILABLE",
        exact.display_text,
        exact.unit or "NOT_AVAILABLE",
    )


def _timeline_preset_track_ids(
    envelope: ReviewEnvelope,
    preset_name: str,
) -> tuple[str, ...]:
    preset_tracks = dict(_TIMELINE_PRESETS).get(preset_name)
    if preset_tracks is None:
        raise ValueError("invalid timeline preset")
    available_ids = {track.track_id for track in envelope.timeline.tracks}
    return tuple(track_id for track_id in preset_tracks if track_id in available_ids)


def _finding_timeline_jump(
    envelope: ReviewEnvelope,
    finding_id: str,
) -> dict[str, object] | None:
    finding = next(
        (item for item in envelope.findings if item.finding_id == finding_id),
        None,
    )
    if finding is None:
        raise ValueError("invalid finding selection")
    if not finding.supporting_event_sequences:
        return None
    track_ids = dict(_FINDING_TIMELINE_TRACKS).get(
        finding_id,
        ("verifier_triggering_findings",),
    )
    known_ids = {track.track_id for track in envelope.timeline.tracks}
    sequence = finding.supporting_event_sequences[0]
    return {
        "sequence": sequence,
        "page": (sequence // _PAGE_SIZE) + 1,
        "preset": "Decision evidence",
        "track_ids": tuple(track_id for track_id in track_ids if track_id in known_ids),
    }


def _timeline_rows(
    envelope: ReviewEnvelope,
    *,
    offset: int,
    limit: int,
    selected_track_ids: Sequence[str] | None = None,
) -> tuple[dict[str, str], ...]:
    all_available_tracks = tuple(
        track for track in envelope.timeline.tracks if track.availability == "AVAILABLE"
    )
    if selected_track_ids is None:
        available_tracks = all_available_tracks
    else:
        selected = tuple(selected_track_ids)
        all_track_ids = tuple(track.track_id for track in envelope.timeline.tracks)
        if len(set(selected)) != len(selected) or any(
            item not in all_track_ids for item in selected
        ):
            raise ValueError("invalid timeline track filter")
        selected_set = set(selected)
        available_tracks = tuple(
            track for track in all_available_tracks if track.track_id in selected_set
        )
    selected_sequences = page_records(
        tuple(range(envelope.timeline.event_count)),
        offset=offset,
        limit=limit,
    )
    records = tuple(
        (track, track.points[sequence])
        for sequence in selected_sequences
        for track in available_tracks
    )
    rows = []
    for track, point in records:
        machine, exact, displayed, unit = _point_exact_fields(point)
        rows.append(
            _safe_row(
            ("track ID", track.track_id),
            ("track label", track.label),
            ("track category", track.category),
            ("track value kind", track.value_kind),
            ("category", point.category),
            ("availability", point.availability),
            ("sequence", point.sequence),
            ("simulation time", point.simulation_time_s),
            ("value", _point_value(point)),
            ("machine value", machine),
            ("exact value", exact),
            ("display value", displayed),
            ("unit", unit),
            ("unavailable reason", point.unavailable_reason or "NOT_APPLICABLE"),
            ("source reference", _reference_text((point.source_reference,))),
            )
        )
    return tuple(rows)


def _track_metadata_rows(
    envelope: ReviewEnvelope,
    *,
    selected_track_ids: Sequence[str] | None = None,
) -> tuple[dict[str, str], ...]:
    all_track_ids = tuple(track.track_id for track in envelope.timeline.tracks)
    if selected_track_ids is None:
        selected = all_track_ids
    else:
        selected = tuple(selected_track_ids)
        if len(set(selected)) != len(selected) or any(
            item not in all_track_ids for item in selected
        ):
            raise ValueError("invalid timeline track filter")
    selected_set = set(selected)
    rows = []
    for track in envelope.timeline.tracks:
        if track.track_id not in selected_set:
            continue
        references = track.source_references
        preview = page_records(
            references,
            offset=0,
            limit=_REFERENCE_PREVIEW_SIZE,
        )
        rows.append(
            _safe_row(
                ("track ID", track.track_id),
                ("track label", track.label),
                ("category", track.category),
                ("availability", track.availability),
                ("value kind", track.value_kind),
                ("unavailable reason", track.unavailable_reason or "NOT_APPLICABLE"),
                ("source reference count", len(references)),
                ("source references shown", len(preview)),
                ("source references omitted", len(references) - len(preview)),
                (
                    "source reference preview",
                    _reference_text(preview) if preview else "NOT_AVAILABLE",
                ),
            )
        )
    return tuple(rows)


def _unavailable_track_rows(
    envelope: ReviewEnvelope,
    *,
    selected_track_ids: Sequence[str] | None = None,
) -> tuple[dict[str, str], ...]:
    all_track_ids = tuple(track.track_id for track in envelope.timeline.tracks)
    selected = all_track_ids if selected_track_ids is None else tuple(selected_track_ids)
    if len(set(selected)) != len(selected) or any(
        item not in all_track_ids for item in selected
    ):
        raise ValueError("invalid timeline track filter")
    selected_set = set(selected)
    return tuple(
        _safe_row(
            ("track ID", track.track_id),
            ("track label", track.label),
            ("category", track.category),
            ("availability", track.availability),
            ("value kind", track.value_kind),
            ("unavailable reason", track.unavailable_reason or "NOT_AVAILABLE"),
            ("source references", _reference_text(track.source_references)),
        )
        for track in envelope.timeline.tracks
        if track.availability == "NOT_AVAILABLE" and track.track_id in selected_set
    )


def _metric_value(value: object) -> tuple[object, str, str, str]:
    if value.kind == "SCALAR":
        exact = value.value
        return (
            exact.machine_value,
            exact.canonical_text or "NOT_AVAILABLE",
            exact.display_text,
            exact.unit or "NOT_AVAILABLE",
        )
    return (
        dict(value.values),
        str(dict(value.values)),
        str(dict(value.values)),
        "occurrences",
    )


def _metric_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    rows = []
    for item in envelope.metrics:
        machine, exact, displayed, unit = _metric_value(item.value)
        rows.append(
            _safe_row(
                ("metric ID", item.metric_id),
                ("label", item.label),
                ("category", item.category),
                ("availability", item.availability),
                ("unavailable reason", item.unavailable_reason or "NOT_APPLICABLE"),
                ("machine value", machine),
                ("exact value", exact),
                ("display value", displayed),
                ("unit", unit),
                ("desired direction", item.desired_direction),
                ("source references", _reference_text(item.source_references)),
            )
        )
        if machine is None:
            rows[-1]["machine value"] = "NOT_AVAILABLE"
            rows[-1]["machine value original scalar count"] = str(len("NOT_AVAILABLE"))
    return tuple(rows)


def _sequence_rows(envelope: ReviewEnvelope, sequence: int) -> tuple[dict[str, str], ...]:
    if isinstance(sequence, bool) or not isinstance(sequence, int):
        return ()
    if sequence < 0 or sequence >= envelope.timeline.event_count:
        return ()
    rows = []
    for track in envelope.timeline.tracks:
        if track.availability != "AVAILABLE":
            continue
        point = track.points[sequence]
        machine, exact, displayed, unit = _point_exact_fields(point)
        rows.append(
            _safe_row(
                ("track ID", track.track_id),
                ("track label", track.label),
                ("value kind", track.value_kind),
                ("track category", track.category),
                ("sequence", point.sequence),
                ("simulation time", point.simulation_time_s),
                ("point category", point.category),
                ("point availability", point.availability),
                ("value", _point_value(point)),
                ("machine value", machine),
                ("exact value", exact),
                ("display value", displayed),
                ("unit", unit),
                ("unavailable reason", point.unavailable_reason or "NOT_APPLICABLE"),
                ("point source reference", _reference_text((point.source_reference,))),
            )
        )
    return tuple(rows)


def _delta_value(value: object) -> str:
    kind = value.kind
    if kind == "SCALAR":
        return value.value.display_text
    if kind == "MEASUREMENT":
        return str(value.value) if value.value is not None else "NOT_AVAILABLE: " + value.reason
    if kind == "STRING_LIST":
        return ", ".join(value.values) or "NONE"
    if kind == "INTERVENTION":
        return f"count={value.count}; reasons={dict(value.reasons)}"
    return value.values.model_dump_json()


def _delta_exact_fields(value: object) -> tuple[object, str, str, str, str]:
    kind = value.kind
    if kind == "SCALAR":
        exact = value.value
        return (
            exact.machine_value if exact.machine_value is not None else "NOT_AVAILABLE",
            exact.canonical_text or "NOT_AVAILABLE",
            exact.display_text,
            exact.unit or "NOT_AVAILABLE",
            "NOT_APPLICABLE",
        )
    if kind == "MEASUREMENT":
        if value.value is None:
            return (
                "NOT_AVAILABLE",
                "NOT_AVAILABLE",
                "NOT_AVAILABLE",
                "NOT_AVAILABLE",
                value.reason,
            )
        return (
            value.value,
            str(value.value),
            str(value.value),
            "NOT_AVAILABLE",
            "NOT_APPLICABLE",
        )
    return (
        "NOT_APPLICABLE",
        "NOT_APPLICABLE",
        _delta_value(value),
        "NOT_APPLICABLE",
        "NOT_APPLICABLE",
    )


def _delta_row_fields(
    prefix: str,
    value: object,
    unit: str | None,
) -> tuple[tuple[str, object], ...]:
    machine, exact, displayed, value_unit, reason = _delta_exact_fields(value)
    if value.kind in {"SCALAR", "MEASUREMENT"}:
        value_unit = unit or value_unit
    return (
        (prefix, _delta_value(value)),
        (f"{prefix} machine value", machine),
        (f"{prefix} exact value", exact),
        (f"{prefix} display value", displayed),
        (f"{prefix} value unit", value_unit),
        (f"{prefix} unavailable reason", reason),
    )


def _comparison_rows(envelope: ComparisonEnvelope) -> tuple[dict[str, str], ...]:
    if envelope.compatibility.status != "COMPATIBLE":
        return ()
    deltas = (
        *envelope.improvements,
        *envelope.regressions,
        *envelope.unchanged_outcomes,
        *envelope.not_comparable,
    )
    return tuple(
        _safe_row(
            ("dimension ID", item.dimension_id),
            ("status", item.status),
            *_delta_row_fields("baseline", item.baseline_value, item.unit),
            *_delta_row_fields("candidate", item.candidate_value, item.unit),
            ("unit", item.unit or "NOT_AVAILABLE"),
            ("desired direction", item.desired_direction),
            ("category", item.category),
            ("explanation", item.explanation),
            ("source references", _reference_text(item.source_references)),
        )
        for item in deltas
    )


def _comparison_partition_rows(items: Sequence[object]) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("dimension ID", item.dimension_id),
            ("status", item.status),
            *_delta_row_fields("baseline", item.baseline_value, item.unit),
            *_delta_row_fields("candidate", item.candidate_value, item.unit),
            ("unit", item.unit or "NOT_AVAILABLE"),
            ("desired direction", item.desired_direction),
            ("category", item.category),
            ("explanation", item.explanation),
            ("source references", _reference_text(item.source_references)),
        )
        for item in items
    )


def _comparison_interpretation(envelope: ComparisonEnvelope) -> str:
    if envelope.improvements and envelope.regressions:
        improvement_ids = {item.dimension_id for item in envelope.improvements}
        regression_ids = {item.dimension_id for item in envelope.regressions}
        if (
            "minimum_ttc_s" in improvement_ids
            and {
                "route_completion_pct",
                "max_abs_acceleration_mps2",
                "max_abs_jerk_mps3",
            }.issubset(regression_ids)
            and envelope.verdict_delta is not None
            and envelope.verdict_delta.status == "UNCHANGED"
        ):
            return _MIXED_COMPARISON_COPY
        return (
            "Improvements and regressions coexist. This is a mixed trade-off; Hermes "
            "makes no overall advancement claim."
        )
    if envelope.improvements:
        return (
            "Comparable improvements are present without a comparable regression. The gate "
            "outcome and authority boundaries remain independent; Hermes makes no overall "
            "advancement claim."
        )
    if envelope.regressions:
        return (
            "Comparable regressions are present without a comparable improvement. Hermes "
            "makes no overall advancement claim."
        )
    return (
        "No comparable dimension improved or regressed. Hermes makes no overall "
        "advancement claim."
    )


def _compatibility_reason_rows(envelope: ComparisonEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("kind", "reason"),
            ("value", value),
            ("category", envelope.compatibility.category),
        )
        for value in envelope.compatibility.reasons
    ) + tuple(
        _safe_row(
            ("kind", "warning"),
            ("value", value),
            ("category", envelope.compatibility.category),
        )
        for value in envelope.compatibility.warnings
    )


def _compatibility_rows(envelope: ComparisonEnvelope) -> tuple[dict[str, str], ...]:
    return (
        _safe_row(
            ("label", "Compatibility"),
            ("value", envelope.compatibility.status),
            ("category", envelope.compatibility.category),
        ),
    )


def _dedicated_comparison_rows(envelope: ComparisonEnvelope) -> tuple[dict[str, str], ...]:
    rows: list[dict[str, str]] = []
    for label, item in (
        ("verdict delta", envelope.verdict_delta),
        ("availability summary delta", envelope.availability_summary_delta),
    ):
        if item is not None:
            rows.append(
                _safe_row(
                    ("record", label),
                    ("dimension ID", item.dimension_id),
                    ("status", item.status),
                    *_delta_row_fields("baseline", item.baseline_value, item.unit),
                    *_delta_row_fields("candidate", item.candidate_value, item.unit),
                    ("category", item.category),
                    ("explanation", item.explanation),
                    ("source references", _reference_text(item.source_references)),
                )
            )
    hard = envelope.hard_failure_delta
    if hard is not None:
        rows.append(
            _safe_row(
                ("record", "hard-failure delta"),
                ("dimension ID", "hard_failures"),
                ("status", hard.status),
                ("baseline", ", ".join(hard.baseline_ids) or "NONE"),
                ("candidate", ", ".join(hard.candidate_ids) or "NONE"),
                ("removed", ", ".join(hard.removed_ids) or "NONE"),
                ("added", ", ".join(hard.added_ids) or "NONE"),
                ("category", hard.category),
                ("explanation", hard.explanation),
                ("source references", _reference_text(hard.source_references)),
            )
        )
    return tuple(rows)


def _availability_delta_rows(envelope: ComparisonEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("metric ID", item.metric_id),
            ("baseline availability", item.baseline_availability),
            ("baseline reason", item.baseline_reason or "NOT_AVAILABLE"),
            ("candidate availability", item.candidate_availability),
            ("candidate reason", item.candidate_reason or "NOT_AVAILABLE"),
            ("category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.availability_deltas
    )


def _comparison_limitation_rows(envelope: ComparisonEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("ID", item.id),
            ("text", item.text),
            ("impact", item.impact),
            ("category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.residual_limitations
    )


def _comparison_side_rows(
    envelope: ComparisonEnvelope,
    *,
    include_source_references: bool = True,
) -> tuple[dict[str, str], ...]:
    rows = []
    for summary in (envelope.baseline, envelope.candidate):
        artifact = summary.artifact
        side = summary.side
        manifest = artifact.manifest_identity
        values = [
            (
                "selected relative path",
                artifact.locator.selected_relative_path,
                artifact.locator.category,
            ),
            (
                "selected directory name",
                artifact.locator.selected_directory_name,
                artifact.locator.category,
            ),
            ("manifest run ID", manifest.run_id, manifest.category),
            ("created at", manifest.created_at_utc, manifest.category),
            ("evidence schema", manifest.evidence_schema_version, manifest.category),
            ("scenario schema", manifest.scenario_schema_version, manifest.category),
            ("integrity", summary.integrity, summary.category),
            ("gate verdict", summary.gate_verdict, summary.category),
            (
                "observed bundle digest",
                artifact.observed_bundle_digest.value,
                artifact.observed_bundle_digest.category,
            ),
            (
                "computed bundle digest",
                artifact.computed_bundle_digest.value,
                artifact.computed_bundle_digest.category,
            ),
            (
                "observed trace digest",
                artifact.observed_trace_digest.value,
                artifact.observed_trace_digest.category,
            ),
            (
                "computed trace digest",
                artifact.computed_trace_digest.value,
                artifact.computed_trace_digest.category,
            ),
        ]
        if include_source_references:
            values.append(
                (
                    "source references",
                    _reference_text(summary.source_references),
                    summary.category,
                )
            )
        rows.extend(
            _safe_row(
                ("side", side),
                ("label", label),
                ("value", value),
                ("category", category),
            )
            for label, value, category in values
        )
    return tuple(rows)


def _invalid_comparison_side(
    envelope: ReviewEnvelope,
    baseline_selection: str,
    candidate_selection: str,
) -> str:
    selected = envelope.artifact.locator.selected_relative_path
    if selected == baseline_selection:
        return "BASELINE"
    if selected == candidate_selection:
        return "CANDIDATE"
    return "UNKNOWN"


def _text_columns(names: Sequence[str]) -> dict[str, object]:
    return {name: st.column_config.TextColumn(name) for name in names}


def _show_rows(rows: Sequence[dict[str, str]]) -> None:
    if not rows:
        st.info("No accepted records are available for this view.")
        return
    st.dataframe(
        list(rows),
        column_config=_text_columns(tuple(rows[0])),
        hide_index=True,
    )


def _identity_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    artifact = envelope.artifact
    manifest = artifact.manifest_identity
    values = (
            (
                "Selected relative path",
                artifact.locator.selected_relative_path,
                artifact.locator.category,
            ),
            (
                "Selected directory name",
                artifact.locator.selected_directory_name,
                artifact.locator.category,
            ),
            ("Manifest run ID", manifest.run_id or "NOT_AVAILABLE", manifest.category),
            ("Created at", manifest.created_at_utc or "NOT_AVAILABLE", manifest.category),
            (
                "Evidence schema",
                manifest.evidence_schema_version or "NOT_AVAILABLE",
                manifest.category,
            ),
            (
                "Scenario schema",
                manifest.scenario_schema_version or "NOT_AVAILABLE",
                manifest.category,
            ),
            (
                "Observed bundle digest",
                artifact.observed_bundle_digest.value
                if artifact.observed_bundle_digest is not None
                else "NOT_AVAILABLE",
                artifact.observed_bundle_digest.category
                if artifact.observed_bundle_digest is not None
                else "NOT_AVAILABLE",
            ),
            (
                "Computed bundle digest",
                artifact.computed_bundle_digest.value
                if artifact.computed_bundle_digest is not None
                else "NOT_AVAILABLE",
                artifact.computed_bundle_digest.category
                if artifact.computed_bundle_digest is not None
                else "NOT_AVAILABLE",
            ),
            (
                "Observed trace digest",
                artifact.observed_trace_digest.value
                if artifact.observed_trace_digest is not None
                else "NOT_AVAILABLE",
                artifact.observed_trace_digest.category
                if artifact.observed_trace_digest is not None
                else "NOT_AVAILABLE",
            ),
            (
                "Computed trace digest",
                artifact.computed_trace_digest.value
                if artifact.computed_trace_digest is not None
                else "NOT_AVAILABLE",
                artifact.computed_trace_digest.category
                if artifact.computed_trace_digest is not None
                else "NOT_AVAILABLE",
            ),
        )
    return tuple(
        _safe_row(
            ("label", label),
            ("value", value),
            ("category", category),
        )
        for label, value, category in values
    )


def _inventory_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("file name", item.file.file_name),
            ("size bytes", item.file.size_bytes),
            ("file category", item.file.category),
            ("SHA-256", item.observed_sha256.value),
            ("digest category", item.observed_sha256.category),
        )
        for item in envelope.artifact.source_inventory
    )


def _recorded_provenance_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    recorded = envelope.provenance.recorded
    if recorded.status == "QUARANTINED":
        return (
            _safe_row(
                ("label", "status"),
                ("value", recorded.status),
                ("availability", "NOT_AVAILABLE"),
                ("reason", "stored provenance is quarantined"),
                ("category", recorded.category),
            ),
        )
    values = recorded.model_dump(mode="python")
    rows = []
    for label, value in values.items():
        if label == "category":
            continue
        if label == "source_references":
            displayed_value = _reference_text(recorded.source_references)
            available = bool(recorded.source_references)
        else:
            displayed_value = value if value is not None else "NOT_AVAILABLE"
            available = value is not None
        rows.append(
            _safe_row(
                ("label", label),
                ("value", displayed_value),
                ("availability", "AVAILABLE" if available else "NOT_AVAILABLE"),
                (
                    "reason",
                    "NOT_APPLICABLE"
                    if available
                    else "not recorded in captured provenance",
                ),
                ("category", recorded.category),
            )
        )
    return tuple(rows)


def _diagnostic_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("ID", item.id),
            ("code", item.code),
            ("text", item.text),
            ("impact", item.impact),
            ("category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.verification.errors
    )


def _assumption_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("ID", item.id),
            ("text", item.text),
            ("impact", item.impact),
            ("category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.assumptions
    )


def _limitation_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("ID", item.id),
            ("text", item.text),
            ("impact", item.impact),
            ("category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.residual_limitations
    )


def _unavailable_evidence_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("evidence ID", item.evidence_id),
            ("label", item.label),
            ("reason", item.reason),
            ("requiredness", item.requiredness),
            ("category", item.category),
            ("gate consequence", item.consequence.effect),
            ("consequence category", item.category),
            ("source references", _reference_text(item.source_references)),
        )
        for item in envelope.unavailable_evidence
    )


def _active_review(root: Path) -> ReviewEnvelope | None:
    if not st.session_state.get("review_requested", False):
        return None
    selection = st.session_state.get("submitted_artifact_selection", "")
    if not isinstance(selection, str) or not selection:
        return None
    try:
        return review_artifact(root, selection)
    except ReviewUnavailableError as exc:
        st.error("REVIEW_UNAVAILABLE / " + str(exc.reason))
        return None
    except (RuntimeError, TypeError, ValueError):
        st.error("The selected artifact could not be reviewed.")
        return None


def _persistent_identity_rows(
    envelope: ReviewEnvelope,
) -> tuple[dict[str, str], ...]:
    locator = envelope.artifact.locator
    manifest = envelope.artifact.manifest_identity
    return (
        _categorized_text_row(
            "Selected directory",
            locator.selected_relative_path,
            locator.category,
        ),
        _categorized_text_row(
            "Manifest run ID",
            manifest.run_id,
            manifest.category,
        ),
    )


def _render_persistent_review_identity(envelope: ReviewEnvelope | None) -> None:
    if envelope is None:
        return
    for row in _persistent_identity_rows(envelope):
        _render_categorized_row(row)


def _render_decision_trust(envelope: ReviewEnvelope) -> None:
    st.text("Decision state")
    st.text(f"Gate verdict: {envelope.gate.verdict} [{envelope.gate.category}]")
    st.text(
        "Evidence integrity: "
        f"{envelope.verification.integrity} [{envelope.verification.category}]"
    )
    st.text("Authority boundaries")
    for row in _trust_rows(envelope)[2:]:
        label = {
            "Evidence authenticity": "Origin",
            "Authorization status": "Authorization",
        }.get(row["dimension"], row["dimension"])
        st.text(f"{label}: {row['value']} [{row['category']}]")
    st.text(_NON_AUTHORITY_SENTENCE)


def _quarantine_identity_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    artifact = envelope.artifact
    manifest = artifact.manifest_identity
    values = (
        (
            "Selected relative path",
            artifact.locator.selected_relative_path,
            artifact.locator.category,
        ),
        (
            "Selected directory name",
            artifact.locator.selected_directory_name,
            artifact.locator.category,
        ),
        (
            "Manifest run ID",
            manifest.run_id or "NOT_AVAILABLE",
            manifest.category if manifest.run_id is not None else "NOT_AVAILABLE",
        ),
        (
            "Created at",
            manifest.created_at_utc or "NOT_AVAILABLE",
            manifest.category if manifest.created_at_utc is not None else "NOT_AVAILABLE",
        ),
        (
            "Evidence schema",
            manifest.evidence_schema_version or "NOT_AVAILABLE",
            (
                manifest.category
                if manifest.evidence_schema_version is not None
                else "NOT_AVAILABLE"
            ),
        ),
        (
            "Scenario schema",
            manifest.scenario_schema_version or "NOT_AVAILABLE",
            (
                manifest.category
                if manifest.scenario_schema_version is not None
                else "NOT_AVAILABLE"
            ),
        ),
    )
    return tuple(
        _safe_row(
            ("label", label),
            ("value", value),
            ("category", category),
        )
        for label, value, category in values
    )


def _render_quarantine(envelope: ReviewEnvelope) -> None:
    st.error("INVALID_EVIDENCE — Invalid evidence quarantine")
    st.text(
        "Stored gate rationale, findings, metrics, timeline, provenance, and comparison "
        "deltas are quarantined and are not accepted."
    )
    _render_decision_trust(envelope)
    st.text("Safely captured partial identity")
    _show_rows(_quarantine_identity_rows(envelope))
    st.text("Integrity diagnostics")
    _show_rows(_diagnostic_rows(envelope))
    mismatch = envelope.verification.first_mismatch_sequence
    st.text(
        "First mismatch: "
        + (str(mismatch) if mismatch is not None else "NOT_AVAILABLE")
        + " [COMPUTED]"
    )
    st.text("Safe next steps")
    st.text(
        "Confirm the intended directory, select another artifact, or contact the artifact "
        "producer."
    )


def _reset_review_presentation_state() -> None:
    st.session_state["timeline_page"] = 1
    st.session_state["inspect_event_requested"] = False
    st.session_state["finding_event_sequence"] = 0
    st.session_state["finding_group"] = _FINDING_GROUP_LABELS[0]
    st.session_state["selected_finding_id"] = ""
    st.session_state["timeline_preset"] = "All tracks"
    st.session_state["timeline_preset_applied"] = ""
    st.session_state["visible_timeline_tracks"] = list(_TIMELINE_TRACK_REGISTRY)
    st.session_state["selected_timeline_sequence"] = -1


def _render_intake(root: Path, envelope: ReviewEnvelope | None) -> None:
    st.header("Select & Verify")
    st.caption(
        "Enter one exact root-relative directory. Omit the configured root name. "
        "Example: handoff-phase5-demo. Hermes does not discover or auto-select artifacts."
    )
    draft = st.text_input("Exact relative artifact selection", key="artifact_selection_draft")
    if st.button(
        "Verify selected artifact",
        key="verify_selected_artifact",
    ):
        _reset_review_presentation_state()
        previous_selection = st.session_state.get("submitted_artifact_selection", "")
        previous_requested = st.session_state.get("review_requested", False)
        st.session_state["submitted_artifact_selection"] = draft
        st.session_state["review_requested"] = True
        candidate = _active_review(root)
        if candidate is None:
            st.session_state["submitted_artifact_selection"] = previous_selection
            st.session_state["review_requested"] = previous_requested
        else:
            envelope = candidate
    if envelope is None:
        st.text("Evidence integrity: UNVERIFIED [COMPUTED]")
        st.text("Evidence has not yet been checked by the installed Hermes verifier.")
        st.info(
            "Enter one exact root-relative directory, omit the configured root name, "
            "confirm the intended directory, and submit Verify again."
        )
        return
    _render_persistent_review_identity(envelope)
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        _render_quarantine(envelope)
        return
    _render_decision_trust(envelope)
    st.text("Submitted directory and manifest identity are shown separately above.")


def _render_summary(envelope: ReviewEnvelope | None) -> None:
    st.header("Overview")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing it.")
        return
    _render_persistent_review_identity(envelope)
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        _render_quarantine(envelope)
        return
    artifact = envelope.artifact
    manifest = artifact.manifest_identity
    st.subheader("Artifact reviewed")
    _render_categorized_text(
        "Selected relative path",
        artifact.locator.selected_relative_path,
        artifact.locator.category,
    )
    _render_categorized_text(
        "Selected directory name",
        artifact.locator.selected_directory_name,
        artifact.locator.category,
    )
    _render_categorized_text("Manifest run ID", manifest.run_id, manifest.category)
    _render_categorized_text("Created at", manifest.created_at_utc, manifest.category)
    _render_categorized_text(
        "Evidence schema",
        manifest.evidence_schema_version,
        manifest.category,
    )
    st.subheader("Gate decision")
    st.text(f"Gate verdict: {envelope.gate.verdict} [GATE_DECISION]")
    if envelope.gate.verdict == "PASS":
        st.text(
            "The installed prototype gate recomputation returned PASS for this bounded "
            "simulation evidence."
        )
    elif envelope.gate.verdict == "HOLD":
        st.text(
            "The installed prototype gate recomputation returned HOLD because controlling "
            "findings did not pass."
        )
    else:
        st.text(
            "The installed prototype gate recomputation returned CONDITIONAL for this "
            "bounded simulation evidence."
        )
    st.subheader("Why")
    _render_categorized_text(
        "Rationale",
        "; ".join(envelope.gate.rationale) or "NONE",
        envelope.gate.category,
    )
    _render_categorized_text(
        "Controlling hard findings",
        ", ".join(envelope.gate.hard_failure_ids) or "NONE",
        envelope.gate.category,
    )
    _render_categorized_text(
        "Controlling soft findings",
        ", ".join(envelope.gate.soft_failure_ids) or "NONE",
        envelope.gate.category,
    )
    st.subheader("Integrity")
    _render_decision_trust(envelope)
    st.subheader("Required unavailable evidence")
    required_unavailable = tuple(
        item
        for item in envelope.evidence_sufficiency.items
        if item.requirement == "REQUIRED" and item.availability == "NOT_AVAILABLE"
    )
    st.text(f"Count: {len(required_unavailable)} [COMPUTED]")
    if required_unavailable:
        _show_rows(
            tuple(
                row
                for row in _sufficiency_rows(envelope)
                if row["requiredness"] == "REQUIRED"
                and row["availability"] == "NOT_AVAILABLE"
            )
        )
    else:
        st.info("No required unavailable evidence is reported by this envelope.")
    st.subheader("What this does not establish")
    for statement, category in _FIXED_LIMITATION_RECORDS:
        st.text(f"{statement} [{category}]")
    st.text(
        "Simulation evidence does not establish real-world safety, certification, "
        "authorization, or permission to control physical hardware. [RESIDUAL_RISK]"
    )
    st.subheader("Technical identity")
    st.text(
        "Open Provenance for hashes, Hermes and gate versions, schema details, and the "
        "captured source inventory."
    )


def _render_findings(envelope: ReviewEnvelope | None) -> None:
    st.header("Evidence")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing findings.")
        return
    _render_persistent_review_identity(envelope)
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        _render_quarantine(envelope)
        return
    _render_decision_trust(envelope)
    st.subheader("Evidence sufficiency")
    _show_rows(_sufficiency_rows(envelope))
    grouped = _grouped_finding_rows(envelope)
    st.text(f"Canonical accepted finding total: {len(envelope.findings)} [COMPUTED]")
    group = st.radio("Finding group", _FINDING_GROUP_LABELS, key="finding_group")
    compact_rows = grouped[group]
    if group != "Failed required evidence":
        st.subheader("Failed required evidence — always visible")
        _show_rows(grouped["Failed required evidence"])
    st.subheader(group)
    if compact_rows:
        _show_rows(compact_rows)
        finding_ids = [row["finding ID"] for row in compact_rows]
        current = st.session_state.get("selected_finding_id", "")
        if current not in finding_ids:
            st.session_state["selected_finding_id"] = finding_ids[0]
        selected_finding_id = st.radio(
            "Finding detail",
            finding_ids,
            key="selected_finding_id",
        )
        st.subheader("Exact finding detail")
        _show_rows(_finding_detail_rows(envelope, selected_finding_id))
        st.subheader("Threshold expression nodes")
        _show_rows(_finding_threshold_rows(envelope, selected_finding_id))
        jump = _finding_timeline_jump(envelope, selected_finding_id)
        if jump is None:
            st.info("No supporting event is stored for this finding.")
        else:
            st.button(
                "Open first supporting event in Timeline",
                key="jump_to_timeline",
                on_click=_apply_timeline_jump_state,
                args=(
                    jump["sequence"],
                    jump["page"],
                    jump["preset"],
                    jump["track_ids"],
                ),
            )
    else:
        matching_sufficiency = tuple(
            row
            for row in _sufficiency_rows(envelope)
            if (
                group == "Required but unavailable"
                and row["requiredness"] == "REQUIRED"
                and row["availability"] == "NOT_AVAILABLE"
            )
            or (
                group == "Not applicable"
                and row["requiredness"] == "NOT_APPLICABLE"
            )
        )
        _show_rows(matching_sufficiency)
    st.subheader("Metrics")
    _show_rows(_metric_rows(envelope))
    st.subheader("Exact supporting-event drill-down")
    sequence = st.number_input(
        "Exact event sequence",
        min_value=0,
        max_value=max(0, envelope.timeline.event_count - 1),
        value=0,
        step=1,
        key="finding_event_sequence",
    )
    if st.button("Inspect exact event evidence", key="inspect_exact_event"):
        st.session_state["inspect_event_requested"] = True
    if st.session_state.get("inspect_event_requested", False):
        rows = _sequence_rows(envelope, int(sequence))
        if rows:
            _show_rows(rows)
        else:
            st.info("No retained point exists for that exact event sequence.")


def _apply_timeline_jump_state(
    sequence: int,
    page: int,
    preset: str,
    track_ids: tuple[str, ...],
) -> None:
    st.session_state["review_section"] = "Timeline"
    st.session_state["timeline_page"] = page
    st.session_state["timeline_preset"] = preset
    st.session_state["timeline_preset_applied"] = preset
    st.session_state["visible_timeline_tracks"] = list(track_ids)
    st.session_state["selected_timeline_sequence"] = sequence


def _render_timeline(envelope: ReviewEnvelope | None) -> None:
    st.header("Timeline")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing the timeline.")
        return
    _render_persistent_review_identity(envelope)
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        _render_quarantine(envelope)
        return
    _render_decision_trust(envelope)
    preset = st.radio(
        "Timeline preset",
        _TIMELINE_PRESET_NAMES,
        key="timeline_preset",
    )
    if st.session_state.get("timeline_preset_applied") != preset:
        st.session_state["visible_timeline_tracks"] = list(
            _timeline_preset_track_ids(envelope, preset)
        )
        st.session_state["timeline_preset_applied"] = preset
    page_count = max(1, (envelope.timeline.event_count + _PAGE_SIZE - 1) // _PAGE_SIZE)
    page = st.number_input(
        "Timeline page",
        min_value=1,
        max_value=page_count,
        step=1,
        key="timeline_page",
    )
    available_tracks = tuple(
        track for track in envelope.timeline.tracks if track.availability == "AVAILABLE"
    )
    available = len(available_tracks)
    selected_track_ids = st.multiselect(
        "Visible timeline tracks",
        options=[track.track_id for track in envelope.timeline.tracks],
        default=list(_timeline_preset_track_ids(envelope, preset)),
        key="visible_timeline_tracks",
    )
    st.text(
        f"Event total: {envelope.timeline.event_count} [{envelope.timeline.category}]"
    )
    st.text(
        f"Track total: {len(envelope.timeline.tracks)}; "
        f"available tracks: {available} [{envelope.timeline.category}]"
    )
    st.subheader("Track metadata and bounded source-reference previews")
    _show_rows(_track_metadata_rows(envelope, selected_track_ids=selected_track_ids))
    st.subheader("Unavailable tracks")
    _show_rows(
        _unavailable_track_rows(
            envelope,
            selected_track_ids=selected_track_ids,
        )
    )
    st.subheader("Paged available track points")
    offset = (int(page) - 1) * _PAGE_SIZE
    _show_rows(
        _timeline_rows(
            envelope,
            offset=offset,
            limit=_PAGE_SIZE,
            selected_track_ids=selected_track_ids,
        )
    )
    selected_sequence = st.session_state.get("selected_timeline_sequence", -1)
    if isinstance(selected_sequence, int) and selected_sequence >= 0:
        st.subheader("Selected supporting event")
        _show_rows(_sequence_rows(envelope, selected_sequence))


def _render_provenance(envelope: ReviewEnvelope | None) -> None:
    st.header("Provenance")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing provenance.")
        return
    _render_persistent_review_identity(envelope)
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        _render_quarantine(envelope)
        return
    _render_decision_trust(envelope)
    _show_rows(_identity_rows(envelope))
    st.subheader("Captured source inventory")
    _show_rows(_inventory_rows(envelope))
    st.subheader("Verification diagnostics")
    _show_rows(_diagnostic_rows(envelope))
    if envelope.provenance.recorded.status == "QUARANTINED":
        st.warning("Recorded provenance is quarantined and not accepted.")
        _show_rows(_recorded_provenance_rows(envelope))
    else:
        _show_rows(_recorded_provenance_rows(envelope))
    st.subheader("Assumptions")
    _show_rows(_assumption_rows(envelope))
    st.subheader("Unavailable evidence")
    _show_rows(_unavailable_evidence_rows(envelope))
    st.subheader("Residual limitations")
    _show_rows(_limitation_rows(envelope))


def _active_comparison(root: Path) -> ComparisonEnvelope | ReviewEnvelope | None:
    if not st.session_state.get("comparison_requested", False):
        return None
    baseline = st.session_state.get("submitted_baseline_selection", "")
    candidate = st.session_state.get("submitted_candidate_selection", "")
    if (
        not isinstance(baseline, str)
        or not isinstance(candidate, str)
        or not baseline
        or not candidate
    ):
        return None
    try:
        return compare_review_artifacts(root, baseline, candidate)
    except ReviewUnavailableError as exc:
        st.error("REVIEW_UNAVAILABLE / " + str(exc.reason))
        return None
    except (RuntimeError, TypeError, ValueError):
        st.error("The selected artifacts could not be compared.")
        return None


def _render_comparison(root: Path) -> None:
    st.header("Compare")
    st.caption(
        "Enter two exact root-relative directories. Hermes does not discover, rank, or "
        "auto-select comparison artifacts."
    )
    baseline = st.text_input(
        "Exact baseline selection",
        key="comparison_baseline_draft",
    )
    candidate = st.text_input(
        "Exact candidate selection",
        key="comparison_candidate_draft",
    )
    result: ComparisonEnvelope | ReviewEnvelope | None = None
    if st.button("Compare stored evidence", key="compare_stored_evidence"):
        previous_baseline = st.session_state.get("submitted_baseline_selection", "")
        previous_candidate = st.session_state.get("submitted_candidate_selection", "")
        previous_requested = st.session_state.get("comparison_requested", False)
        st.session_state["submitted_baseline_selection"] = baseline
        st.session_state["submitted_candidate_selection"] = candidate
        st.session_state["comparison_requested"] = True
        submitted_result = _active_comparison(root)
        if submitted_result is None:
            st.session_state["submitted_baseline_selection"] = previous_baseline
            st.session_state["submitted_candidate_selection"] = previous_candidate
            st.session_state["comparison_requested"] = previous_requested
        else:
            result = submitted_result
    if result is None:
        result = _active_comparison(root)
    if result is None:
        st.info("Enter two exact independently verified selections.")
        return
    if isinstance(result, ReviewEnvelope):
        baseline = st.session_state.get("submitted_baseline_selection", "")
        candidate = st.session_state.get("submitted_candidate_selection", "")
        side = _invalid_comparison_side(result, baseline, candidate)
        st.error(f"{side} is INVALID_EVIDENCE; no comparison claim is available.")
        _render_persistent_review_identity(result)
        _render_quarantine(result)
        return
    _render_categorized_text(
        "Submitted baseline",
        result.baseline.artifact.locator.selected_relative_path,
        result.baseline.artifact.locator.category,
    )
    _render_categorized_text(
        "Submitted candidate",
        result.candidate.artifact.locator.selected_relative_path,
        result.candidate.artifact.locator.category,
    )
    compatible = result.compatibility.status == "COMPATIBLE"
    st.text("Decision state")
    _show_rows(
        _comparison_side_rows(
            result,
            include_source_references=compatible,
        )
    )
    _show_rows(_compatibility_rows(result))
    _show_rows(_compatibility_reason_rows(result))
    if result.compatibility.status == "INCOMPATIBLE":
        st.error("Comparison unavailable")
        st.text(
            "The artifacts may be reviewed independently, but no winner, metric change, "
            "or advancement claim is shown."
        )
        _show_rows(_comparison_limitation_rows(result))
        return
    dedicated = _dedicated_comparison_rows(result)
    st.subheader("Gate outcome")
    _show_rows(tuple(row for row in dedicated if row["record"] == "verdict delta"))
    st.subheader("Hard-failure change")
    _show_rows(tuple(row for row in dedicated if row["record"] == "hard-failure delta"))
    st.subheader("What improved")
    _show_rows(_comparison_partition_rows(result.improvements))
    st.subheader("What regressed")
    _show_rows(_comparison_partition_rows(result.regressions))
    st.subheader("What was unchanged")
    _show_rows(_comparison_partition_rows(result.unchanged_outcomes))
    st.subheader("What was not comparable")
    _show_rows(_comparison_partition_rows(result.not_comparable))
    st.subheader("Evidence availability changes")
    _show_rows(
        tuple(row for row in dedicated if row["record"] == "availability summary delta")
        + _availability_delta_rows(result)
    )
    st.subheader("Advancement interpretation")
    st.text(_comparison_interpretation(result))
    st.subheader("Comparison limitations")
    _show_rows(_comparison_limitation_rows(result))
    st.text(
        "Intervention count is descriptive and is not an ordinal measure. [RESIDUAL_RISK]"
    )


def _render_evidence_limitations() -> None:
    st.header("Evidence limitations")
    st.text("Internal consistency is not independent authenticity. [AUTHENTICITY]")
    st.text(
        "Stored verification does not reexecute the policy or simulator. [RESIDUAL_RISK]"
    )
    st.text(
        "Hermes reviews simulation evidence only; authorization is NOT_EVALUATED and "
        "deployment permission is NONE. [RESIDUAL_RISK]"
    )
    st.text(
        "This result does not establish real-world safety, certification, compliance, or "
        "permission to control physical hardware. [RESIDUAL_RISK]"
    )
    st.text(
        "Human comprehension, manual visual review, and accessibility audit are NOT YET "
        "OBSERVED. [NOT_AVAILABLE]"
    )


def main(argv: Sequence[str] | None = None) -> None:
    st.set_page_config(page_title="Hermes simulation evidence review", layout="wide")
    try:
        arguments = _parse_app_arguments(sys.argv[1:] if argv is None else argv)
    except ValueError:
        st.error("The workbench received invalid application arguments.")
        st.stop()
        return
    st.title("Hermes — Simulation Evidence Review")
    st.text("Authority boundaries")
    for label, value, category in _PERSISTENT_TRUST_FRAME:
        st.text(f"{label}: {value} [{category}]")
    st.text(_NON_AUTHORITY_SENTENCE)
    workflow = st.radio(
        "Primary workflow",
        _PRIMARY_WORKFLOWS,
        key="primary_workflow",
    )
    if workflow == "Review":
        section = st.radio(
            "Review section",
            _REVIEW_SECTIONS,
            key="review_section",
        )
        envelope = _active_review(arguments.artifact_root)
        if section == "Select & Verify":
            _render_intake(arguments.artifact_root, envelope)
        elif section == "Overview":
            _render_summary(envelope)
        elif section == "Evidence":
            _render_findings(envelope)
        elif section == "Timeline":
            _render_timeline(envelope)
        else:
            _render_provenance(envelope)
    elif workflow == "Compare":
        _render_comparison(arguments.artifact_root)
    else:
        _render_evidence_limitations()


if __name__ == "__main__":
    main()
