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

_SCREENS = (
    "Intake / verification",
    "Review summary / trust",
    "Findings / evidence coverage",
    "Timeline",
    "Provenance / integrity / limitations",
    "Compatible comparison",
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
    ("Evidence authenticity", "NOT_AUTHENTICATED", "AUTHENTICITY"),
    ("Authorization status", "NOT_EVALUATED", "ASSUMPTION"),
    ("Deployment permission", "NONE", "RESIDUAL_RISK"),
    ("Scope", "SIMULATION_ONLY", "ASSUMPTION"),
    ("Authoritative status", "NOT_DEFINED", "ASSUMPTION"),
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


def _sufficiency_rows(envelope: ReviewEnvelope) -> tuple[dict[str, str], ...]:
    return tuple(
        _safe_row(
            ("evidence ID", item.evidence_id),
            ("label", item.label),
            ("requiredness", item.requirement),
            ("availability", item.availability),
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


def _render_intake(root: Path) -> None:
    st.header("Intake / verification")
    st.caption("Enter one exact relative selection. Hermes does not discover or auto-select runs.")
    draft = st.text_input("Exact relative artifact selection", key="artifact_selection_draft")
    if st.button("Verify stored evidence"):
        st.session_state["submitted_artifact_selection"] = draft
        st.session_state["review_requested"] = True
        st.session_state["timeline_page"] = 0
    envelope = _active_review(root)
    if envelope is None:
        st.text("Evidence integrity: UNVERIFIED [COMPUTED]")
        st.text("Evidence has not yet been checked by the installed Hermes verifier.")
        return
    _show_rows(_trust_rows(envelope))
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        st.error("INVALID_EVIDENCE")
        st.warning("Stored verdict, findings, and metrics are quarantined and not accepted.")
    _show_rows(_identity_rows(envelope))
    st.subheader("Captured source inventory")
    _show_rows(_inventory_rows(envelope))
    st.subheader("Verification diagnostics")
    _show_rows(_diagnostic_rows(envelope))


def _render_summary(envelope: ReviewEnvelope | None) -> None:
    st.header("Review summary / trust")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing it.")
        return
    _show_rows(_trust_rows(envelope))
    _show_rows(_identity_rows(envelope))
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        st.error("INVALID_EVIDENCE — stored claims remain quarantined.")
        return
    _show_rows(_accepted_review_rows(envelope))


def _render_findings(envelope: ReviewEnvelope | None) -> None:
    st.header("Findings / evidence coverage")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing findings.")
        return
    _show_rows(_trust_rows(envelope))
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        st.error("No accepted findings are available because evidence is invalid.")
        return
    st.subheader("Evidence sufficiency")
    _show_rows(_sufficiency_rows(envelope))
    st.subheader("Findings")
    _show_rows(_finding_rows(envelope))
    st.subheader("Threshold expression nodes")
    _show_rows(
        tuple(row for finding in envelope.findings for row in _threshold_rows(finding))
    )
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
    if st.button("Inspect exact event evidence"):
        st.session_state["inspect_event_requested"] = True
    if st.session_state.get("inspect_event_requested", False):
        rows = _sequence_rows(envelope, int(sequence))
        if rows:
            _show_rows(rows)
        else:
            st.info("No retained point exists for that exact event sequence.")


def _render_timeline(envelope: ReviewEnvelope | None) -> None:
    st.header("Timeline")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing the timeline.")
        return
    _show_rows(_trust_rows(envelope))
    if envelope.verification.integrity == "INVALID_EVIDENCE":
        st.error("No accepted timeline is available because evidence is invalid.")
        return
    page_count = max(1, (envelope.timeline.event_count + _PAGE_SIZE - 1) // _PAGE_SIZE)
    page = st.number_input(
        "Timeline page",
        min_value=1,
        max_value=page_count,
        value=min(st.session_state.get("timeline_page", 0) + 1, page_count),
        step=1,
    )
    st.session_state["timeline_page"] = int(page) - 1
    available_tracks = tuple(
        track for track in envelope.timeline.tracks if track.availability == "AVAILABLE"
    )
    available = len(available_tracks)
    selected_track_ids = st.multiselect(
        "Visible timeline tracks",
        options=[track.track_id for track in envelope.timeline.tracks],
        default=[track.track_id for track in envelope.timeline.tracks],
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


def _render_provenance(envelope: ReviewEnvelope | None) -> None:
    st.header("Provenance / integrity / limitations")
    if envelope is None:
        st.info("Verify an exact stored artifact before reviewing provenance.")
        return
    _show_rows(_trust_rows(envelope))
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
    st.header("Compatible comparison")
    baseline = st.text_input("Exact baseline selection", key="baseline_selection_draft")
    candidate = st.text_input("Exact candidate selection", key="candidate_selection_draft")
    if st.button("Compare stored evidence"):
        st.session_state["submitted_baseline_selection"] = baseline
        st.session_state["submitted_candidate_selection"] = candidate
        st.session_state["comparison_requested"] = True
    result = _active_comparison(root)
    if result is None:
        st.info("Enter two exact independently verified selections.")
        return
    if isinstance(result, ReviewEnvelope):
        baseline = st.session_state.get("submitted_baseline_selection", "")
        candidate = st.session_state.get("submitted_candidate_selection", "")
        side = _invalid_comparison_side(result, baseline, candidate)
        st.error(f"{side} is INVALID_EVIDENCE; no comparison claim is available.")
        _show_rows(_trust_rows(result))
        _show_rows(_identity_rows(result))
        _show_rows(_diagnostic_rows(result))
        return
    compatible = result.compatibility.status == "COMPATIBLE"
    _show_rows(
        _comparison_side_rows(
            result,
            include_source_references=compatible,
        )
    )
    _show_rows(_compatibility_rows(result))
    _show_rows(_compatibility_reason_rows(result))
    if result.compatibility.status == "INCOMPATIBLE":
        st.error("These artifacts are incompatible; no deltas or charts are available.")
        _show_rows(_comparison_limitation_rows(result))
        return
    st.subheader("Verdict, hard-failure, and availability summary deltas")
    _show_rows(_dedicated_comparison_rows(result))
    st.subheader("Improvements, regressions, unchanged, and descriptive outcomes")
    _show_rows(_comparison_rows(result))
    st.subheader("Evidence availability details")
    _show_rows(_availability_delta_rows(result))
    st.subheader("Comparison limitations")
    _show_rows(_comparison_limitation_rows(result))
    st.caption(
        "Intervention count is descriptive. No winner or overall advancement is inferred. "
        "[RESIDUAL_RISK]"
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
    for label, value, category in _PERSISTENT_TRUST_FRAME:
        st.text(f"{label}: {value} [{category}]")
    for statement, category in _FIXED_LIMITATION_RECORDS:
        st.text(f"{statement} [{category}]")
    screen = st.radio("Review screen", _SCREENS, key="selected_screen")
    if screen == _SCREENS[0]:
        _render_intake(arguments.artifact_root)
    elif screen == _SCREENS[1]:
        _render_summary(_active_review(arguments.artifact_root))
    elif screen == _SCREENS[2]:
        _render_findings(_active_review(arguments.artifact_root))
    elif screen == _SCREENS[3]:
        _render_timeline(_active_review(arguments.artifact_root))
    elif screen == _SCREENS[4]:
        _render_provenance(_active_review(arguments.artifact_root))
    else:
        _render_comparison(arguments.artifact_root)


if __name__ == "__main__":
    main()
