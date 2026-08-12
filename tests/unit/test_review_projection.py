from __future__ import annotations

import builtins
import os
from pathlib import Path

import pytest

import hermes.evidence.verification as verification_module
import hermes.review.projection as projection_module
from hermes import __version__
from hermes.review import (
    canonical_envelope_bytes,
    format_threshold_value,
    group_records,
    page_records,
    truncate_display_text,
)
from hermes.review.models import ExactValue
from hermes.review.projection import project_review_envelope


def test_projection_registries_are_transitively_immutable() -> None:
    with pytest.raises(TypeError):
        projection_module._FINDING_LABELS["collision.zero"] = "changed"
    with pytest.raises(TypeError):
        projection_module._METRIC_METADATA["event_count"] = (
            "changed",
            "events",
            "DESCRIPTIVE",
        )
    with pytest.raises(AttributeError):
        projection_module._MEASUREMENT_METRICS.add("event_count")


def _capture(repository_root: Path, selection: str):
    return verification_module._inspect_artifact_under_root_capture(
        repository_root / "artifacts", selection
    )


def test_valid_projection_uses_only_captured_typed_facts_and_frozen_registries(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    capture = _capture(repository_root, "handoff-phase5-demo")

    def forbid_reopen(*args, **kwargs):
        del args, kwargs
        raise AssertionError("pure review projection reopened artifact content")

    monkeypatch.setattr(os, "open", forbid_reopen)
    monkeypatch.setattr(builtins, "open", forbid_reopen)
    monkeypatch.setattr(Path, "open", forbid_reopen)
    monkeypatch.setattr(Path, "read_bytes", forbid_reopen)
    monkeypatch.setattr(Path, "read_text", forbid_reopen)

    envelope = project_review_envelope(
        capture,
        selected_relative_path="handoff-phase5-demo",
        hermes_version=__version__,
    )

    assert envelope.verification.integrity == "INTERNALLY_CONSISTENT"
    assert envelope.gate.verdict == "PASS"
    assert envelope.artifact.manifest_identity.run_id == "handoff-phase5-demo"
    assert envelope.artifact.manifest_identity.created_at_utc == (
        capture.safe_manifest_identity.created_at_utc
    )
    assert len(envelope.artifact.source_inventory) == 10
    assert tuple(item.evidence_id for item in envelope.evidence_sufficiency.items) == (
        "trace.integrity",
        "collision.zero",
        "boundary.within_tolerance",
        "progress.required",
        "comfort.acceleration",
        "comfort.jerk",
        "fault.coverage.required",
    )
    assert envelope.evidence_sufficiency.profile_name == "legacy"
    assert len(envelope.findings) == 6
    assert len(envelope.metrics) == 13
    assert len(envelope.timeline.tracks) == 16
    assert sum(track.availability == "NOT_AVAILABLE" for track in envelope.timeline.tracks) == 6
    assert all(
        metric.source_references[0].source_type == "METRIC"
        and metric.source_references[0].json_pointer == f"/{metric.metric_id}"
        for metric in envelope.metrics
    )
    assert tuple(record.dimension for record in envelope.trust.records) == (
        "authenticity",
        "authorization",
        "deployment_permission",
        "scope",
        "authoritative_status",
    )
    assert envelope.provenance.authenticated_origin.status == "NOT_AUTHENTICATED"
    provenance_pointers = {
        reference.json_pointer for reference in envelope.provenance.recorded.source_references
    }
    assert "/repository_commit" in provenance_pointers
    assert "/repository_dirty" in provenance_pointers
    assert "/hermes_git_commit" not in provenance_pointers
    assert "/hermes_git_dirty" not in provenance_pointers
    assert envelope.assumptions
    assert canonical_envelope_bytes(envelope) == canonical_envelope_bytes(envelope)


def test_invalid_projection_retains_only_safe_identity_and_quarantines_claims(
    repository_root: Path,
) -> None:
    capture = _capture(repository_root, "phase1-tampered")

    envelope = project_review_envelope(
        capture,
        selected_relative_path="phase1-tampered",
        hermes_version=__version__,
    )

    assert envelope.verification.integrity == "INVALID_EVIDENCE"
    assert envelope.gate.verdict == "INVALID_EVIDENCE"
    assert envelope.gate.accepted_recomputation is False
    assert envelope.artifact.locator.selected_directory_name == "phase1-tampered"
    assert envelope.artifact.manifest_identity.run_id == "phase1-nominal"
    assert envelope.artifact.manifest_identity.created_at_utc == (
        capture.safe_manifest_identity.created_at_utc
    )
    assert envelope.artifact.observed_bundle_digest is not None
    assert envelope.artifact.computed_bundle_digest is not None
    assert envelope.artifact.observed_bundle_digest.value != (
        envelope.artifact.computed_bundle_digest.value
    )
    assert envelope.verification.stored_claims_quarantined is True
    assert envelope.verification.errors == envelope.diagnostics
    assert envelope.gate.rationale == ()
    assert envelope.gate.hard_failure_ids == ()
    assert envelope.findings == ()
    assert envelope.metrics == ()
    assert envelope.timeline.event_count == 0
    assert envelope.timeline.tracks == ()
    assert envelope.provenance.recorded.status == "QUARANTINED"
    assert envelope.provenance.recorded.source_references == ()
    assert all(
        getattr(envelope.provenance.recorded, field) is None
        for field in type(envelope.provenance.recorded).model_fields
        if field not in {"status", "category", "source_references"}
    )


def test_schema2_projection_preserves_fault_profile_metrics_tracks_and_ttc_absence(
    repository_root: Path,
) -> None:
    capture = _capture(repository_root, "handoff-p4-fault")

    envelope = project_review_envelope(
        capture,
        selected_relative_path="handoff-p4-fault",
        hermes_version=__version__,
    )

    assert envelope.gate.verdict == "HOLD"
    assert envelope.evidence_sufficiency.profile_name == "fault_coverage"
    assert len(envelope.findings) == 7
    assert envelope.findings[-1].finding_id == "fault.coverage.required"
    assert envelope.findings[-1].status == "PASS"
    assert len(envelope.metrics) == 19
    assert all(track.availability == "AVAILABLE" for track in envelope.timeline.tracks)
    reason_by_metric = {
        "control_fill_count": "CONTROL_DELAY_FILL",
        "steering_saturation_count": "STEERING_SATURATION",
        "brake_saturation_count": "BRAKE_SATURATION",
    }
    events = capture.inspection.snapshot.events
    for metric_id, reason in reason_by_metric.items():
        metric = next(item for item in envelope.metrics if item.metric_id == metric_id)
        expected = tuple(
            (
                event.sequence,
                pointer,
            )
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
            if reason in reasons
        )
        actual = tuple(
            (reference.event_sequence, reference.json_pointer)
            for reference in metric.source_references
            if reference.source_type == "EVENT"
        )
        assert actual == expected
    ttc = next(track for track in envelope.timeline.tracks if track.track_id == "ttc_s")
    assert len(ttc.points) == envelope.timeline.event_count
    assert all(
        point.source_reference.json_pointer == "/observation_summary"
        for point in ttc.points
    )
    assert all(point.availability == "NOT_AVAILABLE" for point in ttc.points)


def test_presentation_helpers_do_not_round_or_mutate_authoritative_values() -> None:
    exact = "α" * 1_024
    over = exact + "β"

    unchanged = truncate_display_text(exact)
    truncated = truncate_display_text(over)
    neutralized = truncate_display_text("safe\x1b[31m\x00\x85")
    unicode_controls = truncate_display_text("😀e\u0301\u202e\r\n\t\x7f\x85")
    expanded_truncation = truncate_display_text("\x1b" * 1_025)

    assert unchanged.displayed_text == exact
    assert unchanged.truncated is False
    assert unchanged.original_length == 1_024
    assert truncated.displayed_text == exact
    assert truncated.truncated is True
    assert truncated.original_length == 1_025
    assert neutralized.displayed_text == "safe\\u001b[31m\\u0000\\u0085"
    assert neutralized.truncated is False
    assert neutralized.original_length == 11
    assert unicode_controls.displayed_text == (
        "😀e\u0301\\u202e\\u000d\\u000a\\u0009\\u007f\\u0085"
    )
    assert unicode_controls.original_length == 9
    assert expanded_truncation.displayed_text == "\\u001b" * 1_024
    assert expanded_truncation.truncated is True
    assert expanded_truncation.original_length == 1_025
    assert page_records(("a", "b", "c"), offset=1, limit=1) == ("b",)
    assert group_records(("b2", "a1", "b1"), key=lambda item: item[0]) == (
        ("a", ("a1",)),
        ("b", ("b2", "b1")),
    )
    threshold = ExactValue(
        machine_value=0.30000000000000004,
        canonical_text="0.30000000000000004",
        display_text="0.30000000000000004",
        unit="m",
    )
    unavailable = ExactValue(
        machine_value=None,
        canonical_text=None,
        display_text="NOT_AVAILABLE",
        unit="m",
    )
    assert format_threshold_value(threshold) == (
        "0.30000000000000004 m"
    )
    assert format_threshold_value(unavailable) == "NOT_AVAILABLE"
