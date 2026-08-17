from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("streamlit")
from hermes.review import compare_review_artifacts, review_artifact  # noqa: E402
from hermes.review.models import (  # noqa: E402
    ExactValue,
    GateConsequence,
    Point,
    SourceReference,
    SufficiencySummary,
    Timeline,
    Track,
    UnavailableEvidenceItem,
)
from hermes.workbench import app as workbench_app  # noqa: E402


@pytest.fixture
def presentation_only_unavailable_envelope(repository_root: Path):
    """Typed presentation fixture only; it is not verified artifact evidence."""

    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")
    required = envelope.evidence_sufficiency.items[0]
    optional = envelope.evidence_sufficiency.items[4]
    required_consequence = GateConsequence(
        triggered=True,
        effect="CONFIGURED_MISSING_REQUIRED_EVIDENCE",
        result_if_controlling="HOLD",
        source="GATE_CONFIG_MISSING_REQUIRED_EVIDENCE",
        listed_in_hard_failures=False,
        listed_in_soft_failures=False,
        listed_in_supporting_findings=False,
        configuration_references=required.consequence.configuration_references,
    )
    items = list(envelope.evidence_sufficiency.items)
    items[0] = required.model_copy(
        update={
            "availability": "NOT_AVAILABLE",
            "reason": "required source record is absent",
            "category": "NOT_AVAILABLE",
            "consequence": required_consequence,
        }
    )
    items[4] = optional.model_copy(
        update={
            "availability": "NOT_AVAILABLE",
            "reason": "optional comfort source record is absent",
            "category": "NOT_AVAILABLE",
        }
    )
    sufficiency = envelope.evidence_sufficiency.model_copy(
        update={
            "items": tuple(items),
            "summary": SufficiencySummary(
                required_and_available=3,
                required_but_unavailable=1,
                optional_and_available=1,
                optional_and_unavailable=1,
                not_applicable=1,
            ),
        }
    )
    unavailable = (
        UnavailableEvidenceItem(
            evidence_id=items[0].evidence_id,
            label=items[0].label,
            reason=items[0].reason,
            requiredness=items[0].requirement,
            consequence=items[0].consequence,
            category="NOT_AVAILABLE",
            source_references=items[0].source_references,
        ),
        UnavailableEvidenceItem(
            evidence_id=items[4].evidence_id,
            label=items[4].label,
            reason=items[4].reason,
            requiredness=items[4].requirement,
            consequence=items[4].consequence,
            category="NOT_AVAILABLE",
            source_references=items[4].source_references,
        ),
    )
    return envelope.model_copy(
        update={"evidence_sufficiency": sufficiency, "unavailable_evidence": unavailable}
    )


def test_app_argument_parser_accepts_one_canonical_absolute_root(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()

    arguments = workbench_app._parse_app_arguments(("--artifact-root", str(root)))

    assert arguments.artifact_root == root.resolve()


@pytest.mark.parametrize(
    "argv",
    [
        (),
        ("--artifact-root",),
        ("--artifact-root", ""),
        ("--artifact-root", "relative"),
        ("--artifact", "/tmp"),
        ("--unknown", "value"),
        ("positional",),
    ],
)
def test_app_argument_parser_rejects_missing_empty_relative_unknown_or_abbreviated_root(
    argv: tuple[str, ...],
) -> None:
    with pytest.raises(ValueError, match="invalid workbench application arguments"):
        workbench_app._parse_app_arguments(argv)


def test_app_argument_parser_rejects_duplicate_root(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()

    with pytest.raises(ValueError, match="invalid workbench application arguments"):
        workbench_app._parse_app_arguments(
            ("--artifact-root", str(root), "--artifact-root", str(root))
        )


def test_app_argument_parser_rejects_missing_or_symlink_root(tmp_path: Path) -> None:
    real = tmp_path / "real"
    real.mkdir()
    linked = tmp_path / "linked"
    linked.symlink_to(real, target_is_directory=True)

    for root in (tmp_path / "missing", linked):
        with pytest.raises(ValueError, match="invalid workbench application arguments"):
            workbench_app._parse_app_arguments(("--artifact-root", str(root)))


def test_app_argument_parser_rejects_noncanonical_absolute_spelling(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()

    for value in (str(root) + "/", str(tmp_path) + "//artifacts", str(tmp_path) + "/./artifacts"):
        with pytest.raises(ValueError, match="invalid workbench application arguments"):
            workbench_app._parse_app_arguments(("--artifact-root", value))


def test_text_rows_neutralize_controls_and_report_scalar_truncation() -> None:
    exact = "<script>alert(1)</script> [click](javascript:alert(1)) " + "x" * 1_025
    rows = workbench_app._text_rows(
        (("Evidence", exact), ("Control", "\x00\t\n\r\x1b\x7f\x85\x9b\u202e"))
    )

    assert rows[0]["label"] == "Evidence"
    assert rows[0]["value"].startswith("<script>alert(1)</script>")
    assert len(rows[0]["value"]) == 1_024
    assert rows[0]["truncated"] == "true"
    assert rows[0]["original scalar count"] == str(len(exact))
    assert rows[1]["value"] == (
        "\\u0000\\u0009\\u000a\\u000d\\u001b\\u007f\\u0085\\u009b\\u202e"
    )


def test_reference_text_retains_typed_pointer_sequence_zero_and_comparison_side(
    repository_root: Path,
) -> None:
    review = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")
    reference = review.timeline.tracks[3].points[0].source_reference
    assert workbench_app._reference_text((reference,)) == (
        "source_type=EVENT|file_name=events.jsonl|"
        f"json_pointer={reference.json_pointer}|event_sequence=0"
    )

    comparison = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )
    references = comparison.baseline.source_references[:1] + (
        comparison.candidate.source_references[0],
    )
    projected = workbench_app._reference_text(references)
    assert projected.startswith("side=BASELINE|source_type=")
    assert "; side=CANDIDATE|source_type=" in projected
    assert "|json_pointer=/created_at_utc|" in projected
    root_reference = SourceReference(
        source_type="BUNDLE_DIGEST",
        file_name="bundle.sha256",
        json_pointer="",
        event_sequence=None,
    )
    assert workbench_app._reference_text((root_reference,)).endswith(
        "|json_pointer=|event_sequence=NOT_AVAILABLE"
    )

def test_every_artifact_cell_reports_truncation_and_original_scalar_count() -> None:
    rows = workbench_app._finding_rows.__annotations__
    assert rows["return"]
    expanded = workbench_app._safe_row(("field", "x" * 1_025))

    assert expanded == {
        "field": "x" * 1_024,
        "field truncated": "true",
        "field original scalar count": "1025",
    }


def test_trust_rows_keep_every_dimension_independent(repository_root: Path) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    rows = workbench_app._trust_rows(envelope)

    assert [(row["dimension"], row["value"]) for row in rows] == [
        ("Gate verdict", "PASS"),
        ("Evidence integrity", "INTERNALLY_CONSISTENT"),
        ("Evidence authenticity", "NOT_AUTHENTICATED"),
        ("Authorization status", "NOT_EVALUATED"),
        ("Deployment permission", "NONE"),
        ("Scope", "SIMULATION_ONLY"),
        ("Authoritative status", "NOT_DEFINED"),
    ]
    assert rows[0]["category"] == envelope.gate.category
    assert rows[1]["category"] == envelope.verification.category


@pytest.mark.parametrize(
    ("selection", "profile"),
    [("handoff-phase5-demo", "legacy"), ("handoff-p4-fault", "fault_coverage")],
)
def test_summary_rows_copy_gate_and_sufficiency_parent_categories(
    repository_root: Path,
    selection: str,
    profile: str,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", selection)

    rows = workbench_app._accepted_review_rows(envelope)
    by_label = {row["label"]: row for row in rows}

    assert by_label["Gate rationale"]["category"] == envelope.gate.category
    assert by_label["Evidence profile name"]["value"] == profile
    assert by_label["Evidence profile name"]["category"] == (
        envelope.evidence_sufficiency.category
    )
    assert all(row["category"] in {"GATE_DECISION", "COMPUTED"} for row in rows)


def test_sufficiency_and_finding_nested_fields_inherit_containing_record_category(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    sufficiency_rows = workbench_app._sufficiency_rows(envelope)
    sufficiency_by_id = {row["evidence ID"]: row for row in sufficiency_rows}
    finding_rows = workbench_app._finding_rows(envelope)
    finding_by_id = {row["finding ID"]: row for row in finding_rows}

    for item in envelope.evidence_sufficiency.items:
        row = sufficiency_by_id[item.evidence_id]
        assert row["category"] == item.category
        assert row["consequence category"] == item.category
    for finding in envelope.findings:
        row = finding_by_id[finding.finding_id]
        assert row["category"] == finding.category
        assert row["threshold category"] == finding.category
        assert row["consequence category"] == finding.category


def test_invalid_review_never_produces_accepted_rows(repository_root: Path) -> None:
    envelope = review_artifact(repository_root / "artifacts", "phase1-tampered")

    assert workbench_app._accepted_review_rows(envelope) == ()
    assert envelope.gate.verdict == "INVALID_EVIDENCE"
    assert envelope.findings == ()
    assert envelope.metrics == ()
    assert envelope.timeline.event_count == 0
    assert envelope.provenance.recorded.status == "QUARANTINED"


@pytest.mark.parametrize("selection", ["handoff-phase5-demo", "phase1-tampered"])
def test_identity_rows_copy_observed_computed_or_unavailable_categories(
    repository_root: Path,
    selection: str,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", selection)

    rows = workbench_app._identity_rows(envelope)

    assert all(row["category"] in {"OBSERVED", "COMPUTED", "NOT_AVAILABLE"} for row in rows)
    assert all(row["category"] for row in rows)


def test_finding_rows_preserve_exact_verifier_threshold_unit_sources_and_consequence(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    rows = workbench_app._finding_rows(envelope)

    assert len(rows) == len(envelope.findings)
    for finding, row in zip(envelope.findings, rows, strict=True):
        assert row["finding ID"] == finding.finding_id
        assert row["verifier"] == finding.verifier_name
        assert row["verifier version"] == finding.verifier_version
        assert row["exact value"] == (finding.measured.canonical_text or "NOT_AVAILABLE")
        assert row["machine value"] == str(finding.measured.machine_value)
        assert row["display value"] == finding.measured.display_text
        assert row["unit"] == (finding.measured.unit or "NOT_AVAILABLE")
        assert row["threshold"]
        assert row["threshold label"] == finding.threshold.label
        assert row["threshold transforms"]
        assert row["threshold configuration references"]
        assert row["threshold evidence references"]
        assert row["gate consequence"] == finding.consequence.effect
        assert row["source references"]


def test_sufficiency_rows_keep_unavailable_distinct_from_zero_or_pass(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    rows = workbench_app._sufficiency_rows(envelope)

    assert len(rows) == 7
    assert any(row["availability"] == "NOT_APPLICABLE" for row in rows)
    assert all(row["availability"] not in {"0", "False", "PASS", ""} for row in rows)


def test_null_exact_values_render_not_available_without_rewriting_real_zero_or_false(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    finding_rows = workbench_app._finding_rows(envelope)
    metric_rows = workbench_app._metric_rows(envelope)
    unavailable_findings = [
        row for row in finding_rows if row["availability"] == "NOT_AVAILABLE"
    ]
    unavailable_metrics = [
        row for row in metric_rows if row["availability"] == "NOT_AVAILABLE"
    ]

    assert unavailable_findings or unavailable_metrics
    for row in unavailable_findings + unavailable_metrics:
        assert row["machine value"] == "NOT_AVAILABLE"
        assert row["exact value"] == "NOT_AVAILABLE"
        assert row["display value"] == "NOT_AVAILABLE"
    assert any(row["machine value"] == "0" for row in metric_rows)


def test_timeline_pages_are_deterministic_complete_and_do_not_mutate_envelope(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p4-fault")
    before = envelope.model_dump_json()
    expected_count = sum(
        len(track.points)
        for track in envelope.timeline.tracks
        if track.availability == "AVAILABLE"
    )

    first = workbench_app._timeline_rows(envelope, offset=0, limit=7)
    second = workbench_app._timeline_rows(envelope, offset=7, limit=7)
    repeat = workbench_app._timeline_rows(envelope, offset=0, limit=7)
    rows = tuple(
        row
        for offset in range(0, envelope.timeline.event_count, 7)
        for row in workbench_app._timeline_rows(envelope, offset=offset, limit=7)
    )

    assert first == repeat
    assert second == rows[len(first) : len(first) + len(second)]
    assert len(rows) == expected_count
    assert {row["track ID"] for row in rows} == {
        track.track_id
        for track in envelope.timeline.tracks
        if track.availability == "AVAILABLE"
    }
    assert sorted((row["track ID"], int(row["sequence"])) for row in rows) == sorted(
        (track.track_id, point.sequence)
        for track in envelope.timeline.tracks
        if track.availability == "AVAILABLE"
        for point in track.points
    )
    assert envelope.model_dump_json() == before


def test_timeline_rows_retain_unavailable_tracks_and_reasons(repository_root: Path) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    rows = workbench_app._unavailable_track_rows(envelope)

    expected = tuple(
        (track.track_id, track.unavailable_reason)
        for track in envelope.timeline.tracks
        if track.availability == "NOT_AVAILABLE"
    )
    assert tuple((row["track ID"], row["unavailable reason"]) for row in rows) == expected
    assert expected


def test_timeline_and_drilldown_rows_preserve_every_scalar_exact_value_field(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")
    timeline_rows = workbench_app._timeline_rows(
        envelope,
        offset=0,
        limit=envelope.timeline.event_count,
    )
    timeline_by_key = {
        (row["track ID"], int(row["sequence"])): row for row in timeline_rows
    }
    sequence_rows = workbench_app._sequence_rows(envelope, 0)
    sequence_by_key = {row["track ID"]: row for row in sequence_rows}

    scalar_count = 0
    unavailable_count = 0
    for track in envelope.timeline.tracks:
        if track.availability != "AVAILABLE" or track.value_kind != "SCALAR":
            continue
        for point in track.points:
            scalar_count += 1
            exact = point.scalar_value
            assert exact is not None
            row = timeline_by_key[(track.track_id, point.sequence)]
            expected_machine = (
                str(exact.machine_value)
                if exact.machine_value is not None
                else "NOT_AVAILABLE"
            )
            assert row["machine value"] == expected_machine
            assert row["exact value"] == (exact.canonical_text or "NOT_AVAILABLE")
            assert row["display value"] == exact.display_text
            assert row["unit"] == (exact.unit or "NOT_AVAILABLE")
            assert row["unavailable reason"] == (
                point.unavailable_reason or "NOT_APPLICABLE"
            )
            if point.availability == "NOT_AVAILABLE":
                unavailable_count += 1
                assert row["machine value"] == "NOT_AVAILABLE"
                assert row["exact value"] == "NOT_AVAILABLE"
                assert row["display value"] == "NOT_AVAILABLE"
                assert row["unit"] == exact.unit
        first = track.points[0]
        exact = first.scalar_value
        assert exact is not None
        drilldown = sequence_by_key[track.track_id]
        assert drilldown["machine value"] == (
            str(exact.machine_value)
            if exact.machine_value is not None
            else "NOT_AVAILABLE"
        )
        assert drilldown["exact value"] == (exact.canonical_text or "NOT_AVAILABLE")
        assert drilldown["display value"] == exact.display_text
        assert drilldown["unit"] == (exact.unit or "NOT_AVAILABLE")

    assert scalar_count > 0
    assert unavailable_count > 0


def test_provenance_assumption_limitation_and_diagnostic_rows_use_public_text_fields(
    repository_root: Path,
) -> None:
    valid = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")
    invalid = review_artifact(repository_root / "artifacts", "phase1-tampered")

    assert workbench_app._assumption_rows(valid)[0]["text"] == valid.assumptions[0].text
    assert workbench_app._limitation_rows(valid)[0]["text"] == valid.residual_limitations[0].text
    assert workbench_app._diagnostic_rows(invalid)[0]["text"] == invalid.verification.errors[0].text


def test_recorded_provenance_rows_copy_observed_category_per_field(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    rows = workbench_app._recorded_provenance_rows(envelope)
    by_label = {row["label"]: row for row in rows}

    assert by_label["status"]["value"] == envelope.provenance.recorded.status
    expected_sources = workbench_app.truncate_display_text(
        workbench_app._reference_text(envelope.provenance.recorded.source_references)
    )
    assert by_label["source_references"]["value"] == expected_sources.displayed_text
    assert by_label["source_references"]["value truncated"] == str(
        expected_sources.truncated
    ).lower()
    assert by_label["source_references"]["value original scalar count"] == str(
        expected_sources.original_length
    )
    assert by_label["hermes_version"]["value"] == (
        envelope.provenance.recorded.hermes_version
    )
    assert all(row["category"] == envelope.provenance.recorded.category for row in rows)
    for label in (
        "repository_provenance_reason",
        "simulator_name",
        "simulator_version",
        "simulator_commit",
        "fault_name",
        "fault_version",
        "fault_config_digest",
    ):
        assert by_label[label]["value"] == "NOT_AVAILABLE"
        assert by_label[label]["availability"] == "NOT_AVAILABLE"
        assert by_label[label]["reason"] == "not recorded in captured provenance"
    assert all(row["value"] != "None" for row in rows)


def test_threshold_rows_preserve_recursive_preorder_and_each_leaf_association(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")
    finding = next(
        item for item in envelope.findings if item.finding_id == "boundary.within_tolerance"
    )
    root = finding.threshold

    rows = workbench_app._threshold_rows(finding)

    assert [(row["node path"], row["depth"], row["kind"], row["label"]) for row in rows] == [
        ("root", "0", root.kind, root.label),
        *[
            (f"root.{index}", "1", child.kind, child.label)
            for index, child in enumerate(root.children)
        ],
    ]
    assert rows[0]["group operator"] == "ALL_OF"
    assert rows[0]["left operand"] == "NOT_APPLICABLE"
    assert rows[0]["configuration references"] == "NOT_APPLICABLE"
    for row, child in zip(rows[1:], root.children, strict=True):
        clause = child.clause
        assert clause is not None
        assert row["finding ID"] == finding.finding_id
        assert row["group operator"] == "NOT_APPLICABLE"
        assert row["left operand"] == clause.left_operand
        assert row["ordered transforms"] == "; ".join(clause.transforms)
        assert row["operator"] == clause.operator
        assert row["configuration references"] == (
            workbench_app._reference_text(clause.configuration_sources)
            if clause.configuration_sources
            else "NOT_APPLICABLE"
        )
        expected_evidence = workbench_app.truncate_display_text(
            workbench_app._reference_text(clause.evidence_sources)
        )
        assert row["evidence references"] == expected_evidence.displayed_text
        assert row["evidence references truncated"] == str(
            expected_evidence.truncated
        ).lower()
        assert row["evidence references original scalar count"] == str(
            expected_evidence.original_length
        )
        if clause.right_operand is None:
            assert {
                row["right machine value"],
                row["right exact value"],
                row["right display value"],
                row["right unit"],
            } == {"NOT_APPLICABLE"}
        else:
            assert row["right machine value"] == str(clause.right_operand.machine_value)
            assert row["right exact value"] == clause.right_operand.canonical_text
            assert row["right display value"] == clause.right_operand.display_text
            assert row["right unit"] == (clause.right_operand.unit or "NOT_AVAILABLE")


def test_threshold_rows_cover_all_finding_nodes_once_in_deterministic_preorder(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")

    for finding in envelope.findings:
        expected: list[tuple[str, str, str]] = []

        def visit(
            node: object,
            path: str,
            expected_rows: list[tuple[str, str, str]] = expected,
        ) -> None:
            expected_rows.append((path, node.kind, node.label))
            for index, child in enumerate(node.children):
                visit(child, f"{path}.{index}")

        visit(finding.threshold, "root")
        rows = workbench_app._threshold_rows(finding)
        assert [(row["node path"], row["kind"], row["label"]) for row in rows] == expected


def test_comparison_rows_keep_both_directions_and_never_make_a_winner(
    repository_root: Path,
) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    rows = workbench_app._comparison_rows(result)

    statuses = {row["status"] for row in rows}
    assert "IMPROVED" in statuses
    assert "REGRESSED" in statuses
    assert "UNCHANGED" in statuses
    assert "NOT_COMPARABLE" in statuses
    assert all("winner" not in key.lower() for row in rows for key in row)


def test_comparison_rows_preserve_scalar_machine_exact_display_and_measurement_gaps(
    repository_root: Path,
) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    rows = workbench_app._comparison_rows(result)
    rows_by_id = {row["dimension ID"]: row for row in rows}
    collision = next(
        item
        for item in (*result.improvements, *result.regressions, *result.unchanged_outcomes)
        if item.dimension_id == "collision_count"
    )
    row = rows_by_id["collision_count"]
    for side, value in (
        ("baseline", collision.baseline_value.value),
        ("candidate", collision.candidate_value.value),
    ):
        assert row[f"{side} machine value"] == str(value.machine_value)
        assert row[f"{side} exact value"] == value.canonical_text
        assert row[f"{side} display value"] == value.display_text
        assert row[f"{side} value unit"] == (value.unit or "NOT_AVAILABLE")

    minimum_ttc = rows_by_id["minimum_ttc_s"]
    minimum_ttc_delta = next(
        item
        for item in (*result.improvements, *result.regressions, *result.unchanged_outcomes)
        if item.dimension_id == "minimum_ttc_s"
    )
    assert minimum_ttc["baseline machine value"] == str(
        minimum_ttc_delta.baseline_value.value
    )
    assert minimum_ttc["baseline exact value"] == str(
        minimum_ttc_delta.baseline_value.value
    )
    assert minimum_ttc["baseline display value"] == str(
        minimum_ttc_delta.baseline_value.value
    )
    assert minimum_ttc["baseline value unit"] == minimum_ttc_delta.unit

    unavailable_result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-phase5-demo",
        "handoff-phase5-demo",
    )
    unavailable_ttc = {
        row["dimension ID"]: row
        for row in workbench_app._comparison_rows(unavailable_result)
    }["minimum_ttc_s"]
    assert unavailable_ttc["baseline machine value"] == "NOT_AVAILABLE"
    assert unavailable_ttc["baseline exact value"] == "NOT_AVAILABLE"
    assert unavailable_ttc["baseline display value"] == "NOT_AVAILABLE"
    assert unavailable_ttc["baseline unavailable reason"] != "NOT_APPLICABLE"

    dedicated = {
        row["dimension ID"]: row
        for row in workbench_app._dedicated_comparison_rows(result)
    }
    verdict = result.verdict_delta
    assert verdict is not None
    assert dedicated["verdict"]["baseline machine value"] == str(
        verdict.baseline_value.value.machine_value
    )
    assert dedicated["verdict"]["candidate exact value"] == (
        verdict.candidate_value.value.canonical_text
    )


def test_compatibility_rows_copy_authoritative_parent_category(
    repository_root: Path,
) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-cutin-baseline",
    )

    rows = workbench_app._compatibility_rows(result)
    reason_rows = workbench_app._compatibility_reason_rows(result)

    assert rows == (
        workbench_app._safe_row(
            ("label", "Compatibility"),
            ("value", result.compatibility.status),
            ("category", result.compatibility.category),
        ),
    )
    assert all(row["category"] == result.compatibility.category for row in reason_rows)


def test_comparison_side_rows_include_complete_side_identity_and_four_digests(
    repository_root: Path,
) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    rows = workbench_app._comparison_side_rows(result)

    for summary in (result.baseline, result.candidate):
        artifact = summary.artifact
        by_label = {
            row["label"]: row for row in rows if row["side"] == summary.side
        }
        assert by_label["selected relative path"]["value"] == (
            artifact.locator.selected_relative_path
        )
        assert by_label["selected directory name"]["value"] == (
            artifact.locator.selected_directory_name
        )
        assert by_label["manifest run ID"]["value"] == artifact.manifest_identity.run_id
        assert by_label["created at"]["value"] == artifact.manifest_identity.created_at_utc
        assert by_label["evidence schema"]["value"] == (
            artifact.manifest_identity.evidence_schema_version
        )
        assert by_label["scenario schema"]["value"] == (
            artifact.manifest_identity.scenario_schema_version
        )
        assert by_label["observed bundle digest"]["value"] == (
            artifact.observed_bundle_digest.value
        )
        assert by_label["computed bundle digest"]["value"] == (
            artifact.computed_bundle_digest.value
        )
        assert by_label["observed trace digest"]["value"] == (
            artifact.observed_trace_digest.value
        )
        assert by_label["computed trace digest"]["value"] == (
            artifact.computed_trace_digest.value
        )
        assert by_label["selected relative path"]["category"] == artifact.locator.category
        assert by_label["manifest run ID"]["category"] == (
            artifact.manifest_identity.category
        )
        assert by_label["observed bundle digest"]["category"] == (
            artifact.observed_bundle_digest.category
        )
        assert by_label["computed bundle digest"]["category"] == (
            artifact.computed_bundle_digest.category
        )
        assert by_label["integrity"]["category"] == summary.category
        assert by_label["gate verdict"]["category"] == summary.category


@pytest.mark.parametrize(
    ("baseline", "candidate", "expected"),
    [
        ("phase1-tampered", "handoff-phase5-demo", "BASELINE"),
        ("handoff-phase5-demo", "phase1-tampered", "CANDIDATE"),
        ("phase1-tampered", "phase1-tampered", "BASELINE"),
    ],
)
def test_invalid_comparison_side_is_identified_with_baseline_first_rule(
    repository_root: Path,
    baseline: str,
    candidate: str,
    expected: str,
) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts", baseline, candidate
    )

    assert workbench_app._invalid_comparison_side(result, baseline, candidate) == expected


def test_exact_sequence_drilldown_uses_only_retained_typed_timeline_points(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p1-collision")
    sequence = envelope.findings[1].supporting_event_sequences[0]
    before = envelope.model_dump_json()

    rows = workbench_app._sequence_rows(envelope, sequence)

    assert len(rows) == sum(track.availability == "AVAILABLE" for track in envelope.timeline.tracks)
    assert all(row["sequence"] == str(sequence) for row in rows)
    assert all(row["point source reference"] for row in rows)
    metadata = workbench_app._track_metadata_rows(envelope)
    assert all(int(row["source reference count"]) >= 0 for row in metadata)
    assert all(int(row["source references shown"]) <= 8 for row in metadata)
    assert {row["value kind"] for row in rows}.issuperset({"ACTION", "SCALAR"})
    assert workbench_app._sequence_rows(envelope, envelope.timeline.event_count) == ()
    assert envelope.model_dump_json() == before


def test_timeline_page_is_sequence_major_with_complete_track_window(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p4-fault")
    available = tuple(
        track for track in envelope.timeline.tracks if track.availability == "AVAILABLE"
    )

    rows = workbench_app._timeline_rows(envelope, offset=2, limit=3)

    assert len(rows) == 3 * len(available)
    assert [int(row["sequence"]) for row in rows] == [
        sequence for sequence in range(2, 5) for _ in available
    ]
    assert [row["track ID"] for row in rows] == [
        track.track_id for _ in range(2, 5) for track in available
    ]


def test_timeline_track_filter_changes_visible_rows_only_and_preserves_envelope(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p4-fault")
    before = envelope.model_dump_json()
    gate_before = envelope.gate.model_dump_json()
    findings_before = tuple(item.model_dump_json() for item in envelope.findings)
    selected = ("candidate_action", "ttc_s")

    rows = workbench_app._timeline_rows(
        envelope,
        offset=2,
        limit=3,
        selected_track_ids=selected,
    )

    assert [row["track ID"] for row in rows] == [
        track_id for _ in range(2, 5) for track_id in selected
    ]
    assert [int(row["sequence"]) for row in rows] == [
        sequence for sequence in range(2, 5) for _ in selected
    ]
    assert envelope.model_dump_json() == before
    assert envelope.gate.model_dump_json() == gate_before
    assert tuple(item.model_dump_json() for item in envelope.findings) == findings_before
    assert envelope.timeline.event_count == 20
    schema1 = review_artifact(repository_root / "artifacts", "handoff-phase5-demo")
    assert workbench_app._unavailable_track_rows(schema1)


def test_timeline_track_filter_rejects_unknown_or_duplicate_ids_without_reordering(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p4-fault")

    with pytest.raises(ValueError, match="invalid timeline track filter"):
        workbench_app._timeline_rows(
            envelope,
            offset=0,
            limit=1,
            selected_track_ids=("unknown",),
        )
    with pytest.raises(ValueError, match="invalid timeline track filter"):
        workbench_app._timeline_rows(
            envelope,
            offset=0,
            limit=1,
            selected_track_ids=("ttc_s", "ttc_s"),
        )
    rows = workbench_app._timeline_rows(
        envelope,
        offset=0,
        limit=1,
        selected_track_ids=("ttc_s", "candidate_action"),
    )
    assert [row["track ID"] for row in rows] == ["candidate_action", "ttc_s"]


def test_timeline_ten_thousand_event_pages_and_track_metadata_remain_bounded() -> None:
    references = tuple(
        SourceReference(
            source_type="EVENT",
            file_name="events.jsonl",
            json_pointer="/vehicle_state/collision_count",
            event_sequence=sequence,
        )
        for sequence in range(10_000)
    )
    points = tuple(
        Point(
            sequence=sequence,
            simulation_time_s=sequence / 10,
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            scalar_value=ExactValue(
                machine_value=0,
                canonical_text="0",
                display_text="0",
                unit="collisions",
            ),
            action_value=None,
            observation_value=None,
            string_list_value=None,
            source_reference=reference,
        )
        for sequence, reference in enumerate(references)
    )
    timeline = Timeline(
        event_count=10_000,
        simulation_start_s=0.0,
        simulation_end_s=999.9,
        tracks=(
            Track(
                track_id="collision_count",
                label="Collision count",
                category="OBSERVED",
                availability="AVAILABLE",
                unavailable_reason=None,
                value_kind="SCALAR",
                points=points,
                source_references=references,
            ),
        ),
        category="OBSERVED",
    )

    class TimelineEnvelope:
        def __init__(self, value: Timeline) -> None:
            self.timeline = value

    envelope = TimelineEnvelope(timeline)
    before = timeline.model_dump_json()
    for offset in (0, 4_950, 9_950):
        rows = workbench_app._timeline_rows(envelope, offset=offset, limit=50)
        assert len(rows) == 50
        assert [int(row["sequence"]) for row in rows] == list(
            range(offset, offset + 50)
        )
        assert all("track source references" not in row for row in rows)
    metadata = workbench_app._track_metadata_rows(envelope)
    assert metadata[0]["source reference count"] == "10000"
    assert metadata[0]["source references shown"] == "8"
    assert metadata[0]["source references omitted"] == "9992"
    assert timeline.model_dump_json() == before


def test_map_metric_preserves_registry_unit_occurrences(repository_root: Path) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p4-fault")

    rows = workbench_app._metric_rows(envelope)
    map_rows = [row for row in rows if row["metric ID"] == "fault_application_counts"]

    assert map_rows[0]["unit"] == "occurrences"


def test_incompatible_comparison_has_reason_rows_and_no_delta_or_chart_rows(
    repository_root: Path,
) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-cutin-baseline",
    )

    assert result.compatibility.status == "INCOMPATIBLE"
    assert workbench_app._comparison_rows(result) == ()
    assert workbench_app._compatibility_reason_rows(result)
    assert result.chart_series == ()


def test_evidence_groups_are_deterministic_non_overlapping_and_prioritize_hard_failure(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p1-collision")

    grouped = workbench_app._grouped_finding_rows(envelope)

    assert tuple(grouped) == (
        "Failed required evidence",
        "Required but unavailable",
        "Soft failures and warnings",
        "Passing required evidence",
        "Optional evidence",
        "Not applicable",
    )
    finding_ids = [row["finding ID"] for rows in grouped.values() for row in rows]
    assert finding_ids == [
        "collision.zero",
        "progress.required",
        "trace.integrity",
        "boundary.within_tolerance",
        "comfort.acceleration",
        "comfort.jerk",
    ]
    assert len(finding_ids) == len(set(finding_ids)) == len(envelope.findings)
    collision = grouped["Failed required evidence"][0]
    assert collision["label"] == "Collision count is within limit"
    assert collision["status"] == "FAIL"
    assert collision["requiredness"] == "REQUIRED"
    assert collision["display value"] == "1.0"
    assert collision["unit"] == "count"
    assert collision["short rule"]
    assert collision["gate consequence"] == "HOLD"
    assert collision["first supporting event"] == "12"


def test_grouped_finding_rows_keep_exact_threshold_and_source_detail(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p1-collision")

    grouped = workbench_app._grouped_finding_rows(envelope)
    collision = grouped["Failed required evidence"][0]
    exact = workbench_app._finding_detail_rows(envelope, collision["finding ID"])

    assert len(exact) == 1
    row = exact[0]
    finding = next(item for item in envelope.findings if item.finding_id == "collision.zero")
    assert row["machine value"] == str(finding.measured.machine_value)
    assert row["exact value"] == finding.measured.canonical_text
    assert row["display value"] == finding.measured.display_text
    assert row["unit"] == finding.measured.unit
    assert row["verifier"] == finding.verifier_name
    assert row["verifier version"] == finding.verifier_version
    assert row["threshold"]
    assert row["source references"]
    assert row["supporting sequences"] == "12"
    threshold_nodes = workbench_app._finding_threshold_rows(
        envelope, collision["finding ID"]
    )
    assert threshold_nodes
    assert threshold_nodes[0]["node path"] == "root"


def test_evidence_availability_copy_distinguishes_required_optional_and_not_applicable_without_zero(
    presentation_only_unavailable_envelope,
) -> None:
    rows = workbench_app._sufficiency_rows(presentation_only_unavailable_envelope)
    by_id = {row["evidence ID"]: row for row in rows}

    required = by_id["trace.integrity"]
    assert required["availability explanation"] == (
        "This signal was required by the selected verifier profile but could not be "
        "computed from the stored evidence."
    )
    assert required["reason"] == "required source record is absent"
    assert required["gate consequence"] == "CONFIGURED_MISSING_REQUIRED_EVIDENCE"
    assert required["source references"] != "NOT_AVAILABLE"

    optional = by_id["comfort.acceleration"]
    assert optional["availability explanation"] == (
        "This signal could not be computed from the stored evidence. It does not "
        "control the current gate verdict, but it remains a review limitation."
    )
    assert optional["reason"] == "optional comfort source record is absent"

    not_applicable = by_id["fault.coverage.required"]
    assert not_applicable["availability explanation"] == (
        "This verifier is not required or evaluated under the selected profile."
    )
    for row in (required, optional, not_applicable):
        assert row["availability"] in {"NOT_AVAILABLE", "NOT_APPLICABLE"}
        assert row["availability"] not in {"0", "False", "PASS", "", "infinity"}


def test_availability_projection_does_not_mutate_envelope_or_gate(
    presentation_only_unavailable_envelope,
) -> None:
    before = presentation_only_unavailable_envelope.model_dump_json()
    gate_before = presentation_only_unavailable_envelope.gate.model_dump_json()

    workbench_app._sufficiency_rows(presentation_only_unavailable_envelope)

    assert presentation_only_unavailable_envelope.model_dump_json() == before
    assert presentation_only_unavailable_envelope.gate.model_dump_json() == gate_before


def test_timeline_preset_track_ids_are_unique_known_and_deterministic(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p4-fault")
    all_ids = tuple(track.track_id for track in envelope.timeline.tracks)

    assert workbench_app._TIMELINE_PRESET_NAMES == (
        "Decision evidence",
        "Action accountability",
        "Fault behavior",
        "All tracks",
    )
    assert workbench_app._timeline_preset_track_ids(envelope, "Decision evidence") == (
        "collision_count",
        "offroad",
        "route_progress_pct",
        "ttc_s",
        "verifier_triggering_findings",
    )
    assert workbench_app._timeline_preset_track_ids(envelope, "Action accountability") == (
        "candidate_action",
        "permitted_action",
        "executed_action",
        "override_reasons",
        "policy_latency_ms",
    )
    assert workbench_app._timeline_preset_track_ids(envelope, "Fault behavior") == (
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "observation_fault_reasons",
        "control_fault_reasons",
        "policy_latency_ms",
    )
    assert workbench_app._timeline_preset_track_ids(envelope, "All tracks") == all_ids
    for preset in workbench_app._TIMELINE_PRESET_NAMES:
        values = workbench_app._timeline_preset_track_ids(envelope, preset)
        assert len(values) == len(set(values))
        assert set(values).issubset(all_ids)


def test_timeline_presets_only_change_visible_track_projection_and_event_jump(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p1-collision")
    before = envelope.model_dump_json()

    selected = workbench_app._timeline_preset_track_ids(envelope, "Decision evidence")
    rows = workbench_app._timeline_rows(
        envelope,
        offset=0,
        limit=50,
        selected_track_ids=selected,
    )
    jump = workbench_app._finding_timeline_jump(envelope, "collision.zero")

    assert {row["track ID"] for row in rows} == set(selected)
    assert jump == {
        "sequence": 12,
        "page": 1,
        "preset": "Decision evidence",
        "track_ids": ("collision_count", "verifier_triggering_findings"),
    }
    assert envelope.model_dump_json() == before


def test_finding_event_jump_uses_first_supporting_sequence_and_never_recomputes_gate(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "handoff-p1-collision")
    gate_before = envelope.gate.model_dump_json()

    jump = workbench_app._finding_timeline_jump(envelope, "progress.required")
    event_rows = workbench_app._sequence_rows(envelope, jump["sequence"])

    assert jump["sequence"] == 12
    assert jump["page"] == 1
    assert jump["track_ids"] == (
        "route_progress_pct",
        "verifier_triggering_findings",
    )
    assert {row["sequence"] for row in event_rows} == {"12"}
    event_source_rows = [
        row for row in event_rows if row["track ID"] != "verifier_triggering_findings"
    ]
    assert all("source_type=EVENT" in row["point source reference"] for row in event_source_rows)
    assert all("event_sequence=12" in row["point source reference"] for row in event_source_rows)
    finding_source = next(
        row for row in event_rows if row["track ID"] == "verifier_triggering_findings"
    )
    assert finding_source["point source reference"].startswith("source_type=FINDING")
    assert envelope.gate.model_dump_json() == gate_before


def test_descriptive_interpretation_retains_factual_partitions_without_causal_inference(
    repository_root: Path,
) -> None:
    unchanged = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-baseline",
    )
    mixed = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )
    different_mixed = mixed.model_copy(
        update={
            "improvements": (
                mixed.improvements[0].model_copy(
                    update={"dimension_id": "collision_count"}
                ),
            ),
            "regressions": (
                mixed.regressions[0].model_copy(
                    update={"dimension_id": "p95_policy_latency_ms"}
                ),
            ),
            "verdict_delta": mixed.verdict_delta.model_copy(update={"status": "IMPROVED"}),
        }
    )

    assert unchanged.improvements == ()
    assert unchanged.regressions == ()
    unchanged_copy = workbench_app._comparison_interpretation(unchanged)
    assert "mixed trade-off" not in unchanged_copy.lower()
    assert "no overall advancement" in unchanged_copy.lower()
    assert workbench_app._comparison_interpretation(mixed) == (
        "Minimum TTC improved. Route completion, acceleration, and jerk regressed. "
        "The gate verdict did not improve. This is a mixed trade-off and does not "
        "establish overall advancement."
    )
    mixed_copy = workbench_app._comparison_interpretation(mixed).lower()
    for forbidden in (
        "challenge engaged",
        "treatment caused",
        "shield caused",
        "candidate is safer",
        "recommended policy",
        "winner",
    ):
        assert forbidden not in mixed_copy
    different_copy = workbench_app._comparison_interpretation(different_mixed)
    assert "Minimum TTC improved" not in different_copy
    assert "gate verdict did not improve" not in different_copy
    assert "mixed trade-off" in different_copy
    assert "no overall advancement" in different_copy


def test_categorized_text_row_bounds_controls_and_marks_missing_values_unavailable() -> None:
    long_value = "prefix\x00" + "x" * 1_025

    bounded = workbench_app._categorized_text_row(
        "Manifest run ID",
        long_value,
        "OBSERVED",
    )
    absent = workbench_app._categorized_text_row(
        "Manifest run ID",
        None,
        "OBSERVED",
    )

    assert bounded["value"].startswith("prefix\\u0000")
    assert "\x00" not in bounded["value"]
    assert bounded["value"].endswith("x" * 1_017)
    assert bounded["value truncated"] == "true"
    assert bounded["value original scalar count"] == str(len(long_value))
    assert bounded["category"] == "OBSERVED"
    assert absent["value"] == "NOT_AVAILABLE"
    assert absent["category"] == "NOT_AVAILABLE"


def test_persistent_identity_rows_use_not_available_category_for_absent_manifest_run_id(
    repository_root: Path,
) -> None:
    envelope = review_artifact(repository_root / "artifacts", "phase1-tampered")
    manifest = envelope.artifact.manifest_identity.model_copy(update={"run_id": None})
    artifact = envelope.artifact.model_copy(update={"manifest_identity": manifest})
    absent_run_id = envelope.model_copy(update={"artifact": artifact})

    rows = workbench_app._persistent_identity_rows(absent_run_id)
    run_id = next(row for row in rows if row["label"] == "Manifest run ID")

    assert run_id["value"] == "NOT_AVAILABLE"
    assert run_id["category"] == "NOT_AVAILABLE"
