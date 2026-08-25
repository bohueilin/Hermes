"""Phase-4 WP-6 consumer contracts for the synthetic evidence-V3 family.

These tests deliberately exercise the already independently verified WP-5 bundle.  They
therefore test consumer dispatch and presentation only; they do not activate a producer.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import replace
from pathlib import Path

import pytest
from typer.testing import CliRunner

import hermes.agents.citations as citations_module
import hermes.evidence.verification as verification_module
from hermes.agents.citations import CitationStatus, _walk, all_valid, check_citations
from hermes.agents.contracts import Citation, ToolErrorCode
from hermes.agents.tools import ToolContext, get_findings, get_metrics, query_run
from hermes.agents.triage import ScriptedAgent, triage_run
from hermes.comparison.compare import compare_artifacts
from hermes.evidence.verification import inspect_artifact
from hermes.review import (
    canonical_envelope_bytes,
    compare_review_artifacts,
    review_artifact,
)


def _synthetic_v3(
    repository_root: Path,
    parent: Path,
    *,
    faulted: bool = False,
) -> Path:
    # Pytest's import mode exposes peer test modules without turning tests into a product package.
    from test_v3_artifact_verification import _bundle

    parent.mkdir()
    directory, *_ = _bundle(repository_root, parent, faulted=faulted)
    inspection = inspect_artifact(directory)
    assert inspection.verification.integrity.value == "INTERNALLY_CONSISTENT"
    assert inspection.snapshot is not None
    return directory


def _project_real_shaped_v3_clock_failure(
    repository_root: Path,
    parent: Path,
    *,
    failure_kind: str,
    first_failure_time_s: float | None = None,
):
    """Project verified-shaped V3 facts whose input and result clocks differ."""
    from test_run_metrics_v3 import _typed_fact_events

    from hermes.domain.models import FindingsDocumentV3
    from hermes.evidence.metrics import compute_metrics
    from hermes.gates.release import apply_release_gate, select_verifier_profile
    from hermes.review.projection import project_review_envelope
    from hermes.verifiers import run_verifiers_for_profile

    bundle = _synthetic_v3(repository_root, parent, faulted=True)
    capture = verification_module._inspect_artifact_under_root_capture(parent, bundle.name)
    stored_snapshot = capture.inspection.snapshot
    assert stored_snapshot is not None

    if failure_kind == "NO_BRAKE":
        scenario = stored_snapshot.scenario
        gate = stored_snapshot.gate_config
        events = list(stored_snapshot.events)
        source = events[0]
        delivered = source.observation_fault_evidence.delivered_observation.model_copy(
            update={
                "front_distance_m": 1.0,
                "front_relative_speed_mps": -20.0,
            }
        )
        events[0] = source.model_copy(
            update={
                "observation_fault_evidence": (
                    source.observation_fault_evidence.model_copy(
                        update={"delivered_observation": delivered}
                    )
                )
            }
        )
        events = tuple(events)
        target_id = "adas.aeb.threat_response"
    else:
        events, scenario, gate = _typed_fact_events(repository_root)
        target_id = "adas.aeb.threat_response"
        if failure_kind == "BRAKE_ONSET":
            source = events[0]
            delivered = source.observation_fault_evidence.delivered_observation.model_copy(
                update={"front_relative_speed_mps": -12.0}
            )
            events = (
                source.model_copy(
                    update={
                        "observation_fault_evidence": (
                            source.observation_fault_evidence.model_copy(
                                update={"delivered_observation": delivered}
                            )
                        )
                    }
                ),
                *events[1:],
            )
            target_id = "adas.aeb.brake_onset_margin"
        elif failure_kind != "RESIDUAL_IMPACT":
            raise AssertionError(f"unsupported clock failure kind: {failure_kind}")

    profile = select_verifier_profile(scenario)
    findings = list(run_verifiers_for_profile(profile, events, scenario, gate))
    # These model-copied facts deliberately separate the frozen clocks without rebuilding
    # their hash chain. Keep the independently verified synthetic trace-integrity finding so
    # this consumer test reaches the finding-clock projection boundary and no other one.
    findings[0] = stored_snapshot.findings.findings[0]
    target_index = next(
        index for index, finding in enumerate(findings) if finding.finding_id == target_id
    )
    target = findings[target_index]
    assert target.status.value == "FAIL"
    if first_failure_time_s is not None:
        findings[target_index] = target.model_copy(
            update={"first_failure_time_s": first_failure_time_s}
        )
    findings_tuple = tuple(findings)
    metrics = compute_metrics(events, scenario=scenario, gate_config=gate)
    verdict = apply_release_gate(
        findings_tuple,
        gate,
        expected_profile=profile,
        adapter_name=stored_snapshot.context.adapter.name,
        evidence_schema_version="3.0",
    )
    snapshot = replace(
        stored_snapshot,
        scenario=scenario,
        gate_config=gate,
        events=events,
        metrics=metrics,
        findings=FindingsDocumentV3(findings=findings_tuple),
        verdict=verdict,
        verifier_profile=profile,
    )
    capture = replace(
        capture,
        inspection=replace(capture.inspection, snapshot=snapshot),
    )
    return project_review_envelope(
        capture,
        selected_relative_path=bundle.name,
        hermes_version="0.1.0",
    )


@pytest.fixture
def v3_pair(repository_root: Path, tmp_path: Path) -> tuple[Path, Path, Path]:
    root = tmp_path / "artifacts"
    root.mkdir()
    baseline = _synthetic_v3(repository_root, root / "baseline")
    candidate = _synthetic_v3(repository_root, root / "candidate")
    return root, baseline, candidate


def test_schema2_registry_is_one_immutable_exact_61_leaf_contract() -> None:
    from hermes.evidence.metric_registry import (
        SCHEMA2_METRIC_REGISTRY,
        SCHEMA2_TOLERANCE_LABEL,
    )

    assert len(SCHEMA2_METRIC_REGISTRY) == 61
    assert len({leaf.leaf_id for leaf in SCHEMA2_METRIC_REGISTRY}) == 61
    assert tuple(leaf.leaf_id for leaf in SCHEMA2_METRIC_REGISTRY[:19]) == (
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
    assert SCHEMA2_TOLERANCE_LABEL == ("illustrative_prototype_tolerances_not_for_real_vehicle_use")
    for leaf in SCHEMA2_METRIC_REGISTRY:
        assert leaf.accessor
        assert leaf.json_pointer == "/" + "/".join(leaf.accessor)
        assert leaf.abs_tol == leaf.rel_tol == 0.0
        assert leaf.tolerance_label == SCHEMA2_TOLERANCE_LABEL
        assert leaf.criticality == "UNASSIGNED"
        assert leaf.gating is False
    saturation = [
        leaf
        for leaf in SCHEMA2_METRIC_REGISTRY
        if leaf.display_id == "system.control_saturation_count"
    ]
    assert [leaf.leaf_id for leaf in saturation] == [
        "steering_saturation_count",
        "brake_saturation_count",
    ]


def test_v3_review_uses_exact_schema2_sibling_and_all_nested_value_citations(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from hermes.review.models import ReviewEnvelope, ReviewEnvelopeV2

    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    envelope = review_artifact(tmp_path / "source", bundle.name)

    assert type(envelope) is ReviewEnvelopeV2
    assert not isinstance(envelope, ReviewEnvelope)
    assert envelope.review_schema_version == "2.0"
    assert len(envelope.metrics) == 61
    by_id = {metric.metric_id: metric for metric in envelope.metrics}
    nested = by_id["adas.aeb.required_decel_at_onset_mps2"]
    assert nested.source_references[0].json_pointer in {
        "/adas/aeb/required_decel_at_onset_mps2/value",
        "/adas/aeb/required_decel_at_onset_mps2/availability",
    }
    assert by_id["max_observation_age_s"].source_references[0].json_pointer.endswith("/value")
    assert by_id["p95_observation_age_s"].metric_id == "p95_observation_age_s"


def test_v3_review_cache_is_schema2_and_cold_warm_bytes_are_identical(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from hermes.review.models import ReviewEnvelopeV2

    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    first = review_artifact(tmp_path / "source", bundle.name)
    second = review_artifact(tmp_path / "source", bundle.name)

    assert type(first) is type(second) is ReviewEnvelopeV2
    assert canonical_envelope_bytes(first) == canonical_envelope_bytes(second)
    assert first.tool.review_schema_version == "2.0"
    assert ReviewEnvelopeV2.model_validate_json(first.model_dump_json()) == first


def test_schema2_review_projects_delayed_no_brake_failure_at_delivered_input_clock(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    envelope = _project_real_shaped_v3_clock_failure(
        repository_root,
        tmp_path / "source",
        failure_kind="NO_BRAKE",
    )

    finding = next(
        item for item in envelope.findings if item.finding_id == "adas.aeb.threat_response"
    )
    delivered_track = next(
        item for item in envelope.timeline.tracks if item.track_id == "delivered_observation"
    )
    support = delivered_track.points[finding.supporting_event_sequences[0]]
    assert finding.measured.unit == "threat steps"
    assert finding.first_failure_simulation_time_s == 0.0
    assert support.observation_value is not None
    assert support.observation_value.simulation_time_s == 0.0
    assert support.simulation_time_s == 0.1


@pytest.mark.parametrize("wrong_time_s", (0.05, 0.1), ids=("between-clocks", "result-clock"))
def test_schema2_review_rejects_wrong_delayed_no_brake_failure_clocks(
    repository_root: Path,
    tmp_path: Path,
    wrong_time_s: float,
) -> None:
    from pydantic import ValidationError

    with pytest.raises(
        ValidationError,
        match="finding failure time",
    ):
        _project_real_shaped_v3_clock_failure(
            repository_root,
            tmp_path / "source",
            failure_kind="NO_BRAKE",
            first_failure_time_s=wrong_time_s,
        )


def test_schema2_review_projects_brake_onset_failure_at_execution_clock(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    envelope = _project_real_shaped_v3_clock_failure(
        repository_root,
        tmp_path / "source",
        failure_kind="BRAKE_ONSET",
    )

    finding = next(
        item
        for item in envelope.findings
        if item.finding_id == "adas.aeb.brake_onset_margin"
    )
    raw_track = next(
        item for item in envelope.timeline.tracks if item.track_id == "raw_observation"
    )
    support = raw_track.points[finding.supporting_event_sequences[0]]
    assert finding.measured.unit == "m/s^2"
    assert finding.first_failure_simulation_time_s == 0.1
    assert support.observation_value is not None
    assert support.observation_value.simulation_time_s == 0.1
    assert support.simulation_time_s == 0.2


@pytest.mark.parametrize("wrong_time_s", (0.15, 0.2), ids=("between-clocks", "result-clock"))
def test_schema2_review_rejects_wrong_brake_onset_failure_clocks(
    repository_root: Path,
    tmp_path: Path,
    wrong_time_s: float,
) -> None:
    from pydantic import ValidationError

    with pytest.raises(
        ValidationError,
        match="finding failure time",
    ):
        _project_real_shaped_v3_clock_failure(
            repository_root,
            tmp_path / "source",
            failure_kind="BRAKE_ONSET",
            first_failure_time_s=wrong_time_s,
        )


def test_schema2_review_residual_impact_failure_stays_on_result_clock(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from pydantic import ValidationError

    envelope = _project_real_shaped_v3_clock_failure(
        repository_root,
        tmp_path / "accepted",
        failure_kind="RESIDUAL_IMPACT",
    )
    finding = next(
        item for item in envelope.findings if item.finding_id == "adas.aeb.threat_response"
    )
    result_track = next(
        item for item in envelope.timeline.tracks if item.track_id == "result_observation"
    )
    support = result_track.points[finding.supporting_event_sequences[0]]
    assert finding.measured.unit == "m/s"
    assert finding.first_failure_simulation_time_s == 0.2
    assert support.simulation_time_s == 0.2

    with pytest.raises(
        ValidationError,
        match="finding failure time",
    ):
        _project_real_shaped_v3_clock_failure(
            repository_root,
            tmp_path / "rejected",
            failure_kind="RESIDUAL_IMPACT",
            first_failure_time_s=0.1,
        )


def test_schema2_review_rejects_extra_metric_and_consumed_gap_source_pointers(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from pydantic import ValidationError

    from hermes.review.models import ReviewEnvelopeV2

    bundle = _synthetic_v3(repository_root, tmp_path / "source", faulted=True)
    envelope = review_artifact(tmp_path / "source", bundle.name)

    metric_payload = envelope.model_dump(mode="json")
    first_metric = metric_payload["metrics"][0]
    first_metric["source_references"].append(
        {
            "source_type": "METRIC",
            "file_name": "metrics.json",
            "json_pointer": "/event_count/z",
            "event_sequence": None,
        }
    )
    with pytest.raises(ValidationError):
        ReviewEnvelopeV2.model_validate_json(json.dumps(metric_payload))

    metric_payload = envelope.model_dump(mode="json")
    metric_payload["metrics"][0]["value"]["unit"] = "wrong-unit"
    with pytest.raises(ValidationError):
        ReviewEnvelopeV2.model_validate_json(json.dumps(metric_payload))

    finding_payload = envelope.model_dump(mode="json")
    finding = next(
        item
        for item in finding_payload["findings"]
        if item["finding_id"] == "adas.aeb.brake_onset_margin"
    )
    clause = finding["threshold"]["clause"]
    finding["verifier_version"] = "1.1"
    finding["measured"]["unit"] = "m usable gap"
    finding["threshold"] = {
        "kind": "INVARIANT",
        "label": "Usable gap at AEB brake onset (m usable gap)",
        "clause": None,
        "children": [],
        "invariant": {
            "operator": "COMPLETE",
            "configuration_sources": clause["configuration_sources"],
            "evidence_sources": clause["evidence_sources"],
        },
    }
    converted = ReviewEnvelopeV2.model_validate_json(json.dumps(finding_payload))
    finding_payload = converted.model_dump(mode="json")
    finding = next(
        item
        for item in finding_payload["findings"]
        if item["finding_id"] == "adas.aeb.brake_onset_margin"
    )
    for reference in finding["threshold"]["invariant"]["evidence_sources"]:
        reference["json_pointer"] = "/vehicle_state/acceleration_mps2"
    with pytest.raises(ValidationError):
        ReviewEnvelopeV2.model_validate_json(json.dumps(finding_payload))


@pytest.mark.parametrize(
    ("value_kind", "metric_id", "forged_value"),
    (
        ("SCALAR", "simulation_duration_s", "forged-duration"),
        ("COUNT", "event_count", 1.5),
        ("BOOLEAN", "collision_occurred", 1),
        ("STRING_COUNT_MAP", "fault_application_counts", {"forged": 1.5}),
        ("ENUM", "termination_reason", 3),
        ("MEASUREMENT", "route_completion_pct", "forged-completion"),
        ("NOT_AVAILABLE", None, 0.0),
    ),
)
def test_schema2_review_rejects_forged_machine_values_for_every_registry_kind(
    repository_root: Path,
    tmp_path: Path,
    value_kind: str,
    metric_id: str | None,
    forged_value: object,
) -> None:
    from pydantic import ValidationError

    from hermes.review.models import ReviewEnvelopeV2

    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    envelope = review_artifact(tmp_path / "source", bundle.name)
    payload = envelope.model_dump(mode="json")
    if value_kind == "NOT_AVAILABLE":
        metric = next(item for item in payload["metrics"] if item["availability"] == value_kind)
    else:
        metric = next(item for item in payload["metrics"] if item["metric_id"] == metric_id)
        assert metric["value"]["kind"] == value_kind
    if value_kind == "SCALAR":
        metric["value"]["value"] = {
            "machine_value": forged_value,
            "canonical_text": json.dumps(forged_value, separators=(",", ":")),
            "display_text": forged_value,
            "unit": metric["value"]["value"]["unit"],
        }
    elif value_kind == "STRING_COUNT_MAP":
        metric["value"]["values"] = forged_value
    else:
        metric["value"]["value"] = forged_value

    with pytest.raises(ValidationError):
        ReviewEnvelopeV2.model_validate_json(json.dumps(payload))


def test_recognized_tampered_v3_uses_schema2_quarantine(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from hermes.review.models import ReviewEnvelopeV2

    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    metrics_path = bundle / "metrics.json"
    payload = json.loads(metrics_path.read_text(encoding="utf-8"))
    payload["collision_count"] += 1
    metrics_path.write_text(json.dumps(payload), encoding="utf-8")

    envelope = review_artifact(tmp_path / "source", bundle.name)
    assert type(envelope) is ReviewEnvelopeV2
    assert envelope.verification.integrity == "INVALID_EVIDENCE"
    assert envelope.metrics == ()
    assert envelope.findings == ()
    assert envelope.gate.verdict == "INVALID_EVIDENCE"


def test_v3_core_comparison_selects_schema2_before_compatibility_and_has_63_dimensions(
    v3_pair: tuple[Path, Path, Path],
) -> None:
    from hermes.comparison.compare import ArtifactComparisonV2

    _, baseline_path, candidate_path = v3_pair
    baseline = inspect_artifact(baseline_path).snapshot
    candidate = inspect_artifact(candidate_path).snapshot
    assert baseline is not None and candidate is not None

    result = compare_artifacts(baseline, candidate)
    assert type(result) is ArtifactComparisonV2
    assert result.comparison_schema_version == "2.0"
    assert result.compatibility.comparable is True
    assert len(result.dimensions) == 63
    assert tuple(dimension.name for dimension in result.dimensions[:2]) == (
        "verdict",
        "hard_failures",
    )
    assert all(dimension.status.value == "UNCHANGED" for dimension in result.dimensions[:2])
    assert any(
        dimension.status.value == "NOT_COMPARABLE"
        and "availability transition" in dimension.explanation
        for dimension in result.dimensions[2:]
    )


def test_schema2_comparison_formula_boundary_and_exact_typed_transitions() -> None:
    from hermes.comparison.compare import ComparisonStatus, _typed_v2_status
    from hermes.evidence.metric_registry import SCHEMA2_METRIC_BY_ID

    higher = replace(
        SCHEMA2_METRIC_BY_ID["route_completion_pct"],
        abs_tol=1.0,
        rel_tol=0.1,
    )
    assert _typed_v2_status(higher, 10.0, 11.0)[0] is ComparisonStatus.UNCHANGED
    assert _typed_v2_status(higher, 10.0, 11.000001)[0] is ComparisonStatus.IMPROVED
    assert _typed_v2_status(higher, 0.0, 1.0)[0] is ComparisonStatus.UNCHANGED

    boolean = SCHEMA2_METRIC_BY_ID["collision_occurred"]
    assert _typed_v2_status(boolean, True, False)[0] is ComparisonStatus.IMPROVED
    assert _typed_v2_status(boolean, False, True)[0] is ComparisonStatus.REGRESSED

    count = SCHEMA2_METRIC_BY_ID["collision_count"]
    assert _typed_v2_status(count, 1, 0)[0] is ComparisonStatus.IMPROVED
    descriptive = SCHEMA2_METRIC_BY_ID["termination_reason"]
    assert _typed_v2_status(descriptive, "HORIZON", "DESTINATION")[0] is (
        ComparisonStatus.NOT_COMPARABLE
    )


def test_any_mixed_v3_core_pair_is_schema2_incompatible_with_no_dimensions(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    from hermes.comparison.compare import ArtifactComparisonV2

    v3 = _synthetic_v3(repository_root, tmp_path / "source")
    legacy = inspect_artifact(repository_root / "artifacts" / "handoff-p1-nominal").snapshot
    modern = inspect_artifact(v3).snapshot
    assert legacy is not None and modern is not None

    for baseline, candidate in ((legacy, modern), (modern, legacy)):
        result = compare_artifacts(baseline, candidate)
        assert type(result) is ArtifactComparisonV2
        assert result.comparison_schema_version == "2.0"
        assert result.compatibility.comparable is False
        assert result.dimensions == ()


@pytest.mark.parametrize("legacy_first", (True, False))
def test_mixed_legacy_v3_review_comparison_is_schema2_incompatible_in_both_orientations(
    repository_root: Path,
    tmp_path: Path,
    legacy_first: bool,
) -> None:
    from hermes.review.models import ComparisonEnvelopeV2
    from hermes.workbench.app import _comparison_rows

    root = tmp_path / "artifacts"
    root.mkdir()
    legacy = root / "legacy"
    shutil.copytree(repository_root / "artifacts" / "handoff-p1-nominal", legacy)
    modern = _synthetic_v3(repository_root, root / "modern")
    baseline, candidate = (legacy, modern) if legacy_first else (modern, legacy)

    result = compare_review_artifacts(
        root,
        baseline.relative_to(root).as_posix(),
        candidate.relative_to(root).as_posix(),
    )

    assert type(result) is ComparisonEnvelopeV2
    assert result.comparison_schema_version == "2.0"
    assert result.compatibility.status == "INCOMPATIBLE"
    assert result.dimensions == ()
    assert result.chart_series == ()
    assert _comparison_rows(result) == ()


def test_every_v3_finding_metric_link_resolves_to_the_exact_registered_leaf(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _synthetic_v3(repository_root, tmp_path / "source", faulted=True)
    envelope = review_artifact(tmp_path / "source", bundle.name)
    stored_metrics = json.loads((bundle / "metrics.json").read_text(encoding="utf-8"))

    metric_pointers = {
        reference.json_pointer
        for finding in envelope.findings
        for reference in finding.source_references
        if reference.source_type == "METRIC"
    }
    assert {
        "/event_count",
        "/collision_count",
        "/max_abs_lateral_offset_m",
        "/fault_application_counts",
    } <= metric_pointers
    assert not {
        "/event_count/value",
        "/collision_count/value",
        "/max_abs_lateral_offset_m/value",
        "/fault_application_counts/value",
    } & metric_pointers
    for pointer in metric_pointers:
        found, _ = _walk(stored_metrics, pointer)
        assert found, pointer


def test_review_comparison_mirrors_schema2_core_with_exact_sibling(
    v3_pair: tuple[Path, Path, Path],
) -> None:
    from pydantic import ValidationError

    from hermes.review.models import ComparisonEnvelopeV2

    root, baseline, candidate = v3_pair
    result = compare_review_artifacts(
        root,
        baseline.relative_to(root).as_posix(),
        candidate.relative_to(root).as_posix(),
    )

    assert type(result) is ComparisonEnvelopeV2
    assert result.comparison_schema_version == "2.0"
    assert result.compatibility.status == "COMPATIBLE"
    assert len(result.dimensions) == 63
    unavailable = next(
        item
        for item in result.dimensions
        if isinstance(item.baseline_value, dict)
        and item.baseline_value.get("availability") == "NOT_AVAILABLE"
    )
    unavailable_pointers = {
        (reference.side, reference.reference.json_pointer)
        for reference in unavailable.source_references
    }
    assert any(pointer.endswith("/reason") for _, pointer in unavailable_pointers)

    payload = result.model_dump(mode="json")
    payload["dimensions"][2]["unit"] = "wrong-unit"
    with pytest.raises(ValidationError):
        ComparisonEnvelopeV2.model_validate_json(json.dumps(payload))


def test_legacy_review_comparison_canonical_bytes_remain_pinned(repository_root: Path) -> None:
    result = compare_review_artifacts(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )
    assert type(result).__name__ == "ComparisonEnvelope"
    assert hashlib.sha256(canonical_envelope_bytes(result)).hexdigest() == (
        "19384cf6b08063a1378d6924e248aef589f9ba3eca91a2492abd256acb9ab360"
    )


def test_rfc6901_resolver_handles_escapes_empty_tokens_arrays_and_malformed_tokens() -> None:
    payload = {"a/b": {"~key": {"": ["zero", {"value": 7}]}}}
    assert _walk(payload, "/a~1b/~0key//1/value") == (True, 7)
    assert _walk(payload, "") == (True, payload)
    assert _walk(payload, "/a~2b") == (False, None)
    assert _walk(["zero"], "/01") == (False, None)
    assert _walk(["zero"], "/-") == (False, None)


def test_agent_traversal_and_symlink_runs_fail_structured_without_raw_read_exception(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (root / "linked").symlink_to(outside, target_is_directory=True)
    for run_id in ("../outside", "linked", "/tmp"):
        result = query_run(
            ToolContext(repository_root=repository_root, artifact_root=root), run_id=run_id
        )
        assert result.ok is False
        assert result.error is not None
        assert result.error.code in {
            ToolErrorCode.INVALID_ARGUMENT,
            ToolErrorCode.NOT_FOUND,
            ToolErrorCode.INVALID_EVIDENCE,
        }


def test_agent_v3_metrics_keep_max_age_nested_and_positive_fault_count_citations(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _synthetic_v3(repository_root, tmp_path / "source", faulted=True)
    context = ToolContext(repository_root=repository_root, artifact_root=tmp_path / "source")
    result = get_metrics(context, run_id=bundle.name)

    assert result.ok is True
    locators = {citation.locator for citation in result.citations}
    assert "/max_observation_age_s/value" in locators
    assert locators.intersection(
        {
            "/adas/aeb/required_decel_at_onset_mps2/value",
            "/adas/aeb/required_decel_at_onset_mps2/availability",
        }
    )
    assert "/p95_observation_age_s/value" not in locators or (
        "/max_observation_age_s/value" in locators
    )
    assert any(locator.startswith("/fault_application_counts/") for locator in locators)
    checks = check_citations(result.citations, tmp_path / "source")
    assert checks and all(check.status is CitationStatus.RESOLVED for check in checks)


def test_citation_path_allowlist_rejects_traversal_as_structured_failure(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    digest = (bundle / "bundle.sha256").read_text(encoding="utf-8").split()[0]
    citation = Citation(
        run_id=bundle.name,
        artifact_file="../manifest.json",
        locator="/run_id",
        quoted_value=bundle.name,
        bundle_digest=digest,
    )
    checks = check_citations((citation,), tmp_path / "source")
    assert len(checks) == 1
    assert checks[0].status in {
        CitationStatus.LOCATOR_DANGLING,
        getattr(CitationStatus, "UNSAFE_PATH", CitationStatus.LOCATOR_DANGLING),
    }


def test_workbench_value_helpers_render_every_schema2_kind_without_attribute_errors() -> None:
    from hermes.review.models import (
        BooleanMetricValue,
        CountMetricValue,
        EnumMetricValue,
        MeasurementMetricValue,
    )
    from hermes.workbench.app import _metric_value

    assert _metric_value(CountMetricValue(kind="COUNT", value=2, unit="events"))[0] == 2
    assert _metric_value(BooleanMetricValue(kind="BOOLEAN", value=False, unit=None))[0] is False
    assert _metric_value(EnumMetricValue(kind="ENUM", value="HORIZON", unit=None))[0] == "HORIZON"
    unavailable = MeasurementMetricValue(
        kind="MEASUREMENT",
        availability="NOT_AVAILABLE",
        value=None,
        unit="s",
        reason="no eligible evidence",
    )
    assert "NOT_AVAILABLE" in _metric_value(unavailable)[1]


def test_workbench_rows_consume_real_schema2_review_and_comparison_siblings(
    v3_pair: tuple[Path, Path, Path],
) -> None:
    from hermes.workbench.app import _comparison_rows, _metric_rows

    root, baseline, candidate = v3_pair
    review = review_artifact(root, baseline.relative_to(root).as_posix())
    comparison = compare_review_artifacts(
        root,
        baseline.relative_to(root).as_posix(),
        candidate.relative_to(root).as_posix(),
    )

    assert len(_metric_rows(review)) == 61
    rows = _comparison_rows(comparison)
    assert len(rows) == 63
    assert {row["value kind"] for row in rows} >= {
        "COUNT",
        "BOOLEAN",
        "MEASUREMENT",
        "STRING_COUNT_MAP",
        "ENUM",
    }


def test_scripted_triage_consumes_v3_and_returns_resolvable_exact_citations(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _synthetic_v3(repository_root, tmp_path / "source", faulted=True)
    context = ToolContext(repository_root=repository_root, artifact_root=tmp_path / "source")

    proposal = triage_run(context, bundle.name, runtime=ScriptedAgent())
    checks = check_citations(proposal.citations, tmp_path / "source")

    assert proposal.category == proposal.deterministic_category
    assert checks and all(check.status is CitationStatus.RESOLVED for check in checks)


def test_triage_binds_all_read_tools_to_one_immutable_capture(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = repository_root / "artifacts"
    original_capture = verification_module._inspect_artifact_under_root_capture
    alternating = (
        original_capture(artifacts, "handoff-phase5-demo"),
        original_capture(artifacts, "handoff-p1-collision"),
    )
    calls = 0

    def alternating_capture(_root: Path, _selection: str):
        nonlocal calls
        capture = alternating[calls % len(alternating)]
        calls += 1
        return capture

    monkeypatch.setattr(
        verification_module,
        "_inspect_artifact_under_root_capture",
        alternating_capture,
    )
    proposal = triage_run(
        ToolContext(repository_root=repository_root, artifact_root=artifacts),
        "one-logical-run",
        runtime=ScriptedAgent(),
    )

    assert calls == 1
    assert len({citation.bundle_digest for citation in proposal.citations}) == 1


def test_citation_batch_rejects_alternating_pass_hold_capture_laundering(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = repository_root / "artifacts"
    original_capture = verification_module._inspect_artifact_under_root_capture
    pass_capture = original_capture(artifacts, "handoff-phase5-demo")
    hold_capture = original_capture(artifacts, "handoff-p1-collision")
    calls = 0

    def alternating_capture(_root: Path, _selection: str):
        nonlocal calls
        capture = (pass_capture, hold_capture)[calls % 2]
        calls += 1
        return capture

    monkeypatch.setattr(
        citations_module,
        "_inspect_artifact_under_root_capture",
        alternating_capture,
    )
    citations = (
        Citation(
            run_id="one-logical-run",
            artifact_file="verdict.json",
            locator="/verdict",
            quoted_value="PASS",
            bundle_digest=pass_capture.inspection.observed_bundle_digest,
        ),
        Citation(
            run_id="one-logical-run",
            artifact_file="verdict.json",
            locator="/verdict",
            quoted_value="HOLD",
            bundle_digest=hold_capture.inspection.observed_bundle_digest,
        ),
    )

    checks = check_citations(citations, artifacts)

    assert calls == 1
    assert all_valid(checks) is False
    assert any(check.status is CitationStatus.BUNDLE_DIGEST_MISMATCH for check in checks)


@pytest.mark.parametrize("tool_name", ("query_run", "get_findings", "get_metrics"))
def test_legacy_invalid_artifact_read_behavior_remains_exact(
    repository_root: Path,
    tool_name: str,
) -> None:
    artifacts = repository_root / "artifacts"
    context = ToolContext(repository_root=repository_root, artifact_root=artifacts)
    tools = {
        "query_run": query_run,
        "get_findings": get_findings,
        "get_metrics": get_metrics,
    }

    result = tools[tool_name](context, run_id="phase1-tampered")

    assert result.ok is True
    if tool_name == "query_run":
        assert result.data["integrity"] == "INVALID"
        assert result.data["verdict"] == "INVALID_EVIDENCE"
        assert result.data["errors"]
    elif tool_name == "get_findings":
        stored = json.loads((artifacts / "phase1-tampered" / "findings.json").read_text())
        assert result.data == {
            "findings": stored["findings"],
            "count": len(stored["findings"]),
        }
    else:
        stored = json.loads((artifacts / "phase1-tampered" / "metrics.json").read_text())
        assert result.data == {"metrics": stored}


def _malformed_legacy_bundle(
    repository_root: Path,
    tmp_path: Path,
    *,
    artifact_file: str,
    case: str,
) -> tuple[Path, Path]:
    root = tmp_path / "artifacts"
    root.mkdir()
    bundle = root / "malformed-legacy"
    shutil.copytree(repository_root / "artifacts" / "handoff-phase5-demo", bundle)
    target = bundle / artifact_file
    document = json.loads(target.read_text(encoding="utf-8"))
    if artifact_file == "findings.json":
        if case == "missing_findings_field":
            document = {"evidence_schema_version": "1.0"}
        elif case == "non_list_findings":
            document["findings"] = {}
        else:
            item = document["findings"][0]
            if case == "missing_finding_id":
                item.pop("finding_id")
            elif case == "missing_status":
                item.pop("status")
            elif case == "wrong_finding_id_type":
                item["finding_id"] = 7
            elif case == "wrong_status_type":
                item["status"] = 7
            elif case == "wrong_required_field_type":
                item["event_sequences"] = "not-a-sequence-list"
            else:
                raise AssertionError(case)
    elif case == "empty_object":
        document = {}
    elif case == "non_object":
        document = []
    elif case == "version_only":
        document = {"evidence_schema_version": "1.0"}
    elif case == "missing_required_field":
        document.pop("event_count")
    elif case == "wrong_required_field_type":
        document["event_count"] = "40"
    elif case == "wrong_nested_measurement_shape":
        document["route_completion_pct"] = {}
    else:
        raise AssertionError(case)
    target.write_text(json.dumps(document), encoding="utf-8")
    return root, bundle


@pytest.mark.parametrize(
    "case",
    (
        "missing_findings_field",
        "non_list_findings",
        "missing_finding_id",
        "missing_status",
        "wrong_finding_id_type",
        "wrong_status_type",
        "wrong_required_field_type",
    ),
)
def test_malformed_legacy_findings_fail_closed_across_agent_workflows(
    repository_root: Path,
    tmp_path: Path,
    case: str,
) -> None:
    root, bundle = _malformed_legacy_bundle(
        repository_root,
        tmp_path,
        artifact_file="findings.json",
        case=case,
    )
    context = ToolContext(repository_root=repository_root, artifact_root=root)

    findings = get_findings(context, run_id=bundle.name)
    identity = query_run(context, run_id=bundle.name)
    proposal = triage_run(context, bundle.name, runtime=ScriptedAgent())
    checks = check_citations((*identity.citations, *proposal.citations), root)

    assert findings.ok is False
    assert findings.error is not None
    assert findings.error.code is ToolErrorCode.INVALID_EVIDENCE
    assert findings.data == {}
    assert findings.citations == ()
    assert identity.ok is True
    assert identity.data["integrity"] == "INVALID"
    assert identity.data["verdict"] == "INVALID_EVIDENCE"
    assert identity.data["errors"]
    assert proposal.deterministic_category.value == "UNKNOWN"
    assert proposal.category.value == "UNKNOWN"
    assert checks
    assert all_valid(checks) is False
    assert all(check.status is CitationStatus.INVALID_EVIDENCE for check in checks)


@pytest.mark.parametrize(
    "case",
    (
        "empty_object",
        "non_object",
        "version_only",
        "missing_required_field",
        "wrong_required_field_type",
        "wrong_nested_measurement_shape",
    ),
)
def test_malformed_legacy_metrics_fail_closed_without_empty_success(
    repository_root: Path,
    tmp_path: Path,
    case: str,
) -> None:
    root, bundle = _malformed_legacy_bundle(
        repository_root,
        tmp_path,
        artifact_file="metrics.json",
        case=case,
    )
    context = ToolContext(repository_root=repository_root, artifact_root=root)

    metrics = get_metrics(context, run_id=bundle.name)
    identity = query_run(context, run_id=bundle.name)
    proposal = triage_run(context, bundle.name, runtime=ScriptedAgent())
    checks = check_citations((*identity.citations, *proposal.citations), root)

    assert metrics.ok is False
    assert metrics.error is not None
    assert metrics.error.code is ToolErrorCode.INVALID_EVIDENCE
    assert metrics.data == {}
    assert metrics.citations == ()
    assert identity.ok is True
    assert identity.data["integrity"] == "INVALID"
    assert identity.data["verdict"] == "INVALID_EVIDENCE"
    assert identity.data["errors"]
    assert proposal.deterministic_category.value == "UNKNOWN"
    assert proposal.category.value == "UNKNOWN"
    assert checks
    assert all_valid(checks) is False
    assert all(check.status is CitationStatus.INVALID_EVIDENCE for check in checks)


def test_well_formed_invalid_v2_legacy_reads_remain_available(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    bundle = root / "invalid-v2"
    shutil.copytree(repository_root / "artifacts" / "handoff-p4-fault", bundle)
    events_path = bundle / "events.jsonl"
    events_path.write_bytes(events_path.read_bytes() + b"\n")
    context = ToolContext(repository_root=repository_root, artifact_root=root)

    findings = get_findings(context, run_id=bundle.name)
    metrics = get_metrics(context, run_id=bundle.name)
    identity = query_run(context, run_id=bundle.name)

    assert findings.ok is True
    assert findings.data["findings"]
    assert metrics.ok is True
    assert metrics.data["metrics"]["evidence_schema_version"] == "2.0"
    assert identity.ok is True
    assert identity.data["integrity"] == "INVALID"
    assert identity.data["verdict"] == "INVALID_EVIDENCE"


def test_malformed_v3_agent_and_citation_workflows_remain_fail_closed(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    metrics_path = bundle / "metrics.json"
    metrics_path.write_text("{}", encoding="utf-8")
    context = ToolContext(repository_root=repository_root, artifact_root=tmp_path / "source")

    results = (
        get_findings(context, run_id=bundle.name),
        get_metrics(context, run_id=bundle.name),
        query_run(context, run_id=bundle.name),
    )
    proposal = triage_run(context, bundle.name, runtime=ScriptedAgent())
    citation = Citation(
        run_id=bundle.name,
        artifact_file="verdict.json",
        locator="/verdict",
        quoted_value="PASS",
        bundle_digest=(bundle / "bundle.sha256").read_text(encoding="utf-8").strip(),
    )
    check = check_citations((citation,), tmp_path / "source")[0]

    assert all(result.ok is False for result in results)
    assert all(
        result.error is not None and result.error.code is ToolErrorCode.INVALID_EVIDENCE
        for result in results
    )
    assert proposal.deterministic_category.value == "UNKNOWN"
    assert proposal.category.value == "UNKNOWN"
    assert proposal.citations == ()
    assert check.status is CitationStatus.INVALID_EVIDENCE


def test_invalid_unknown_evidence_identity_still_fails_closed(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    unknown = root / "unknown"
    shutil.copytree(repository_root / "artifacts" / "handoff-phase5-demo", unknown)
    manifest_path = unknown / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["evidence_schema_version"] = "9.0"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = query_run(
        ToolContext(repository_root=repository_root, artifact_root=root),
        run_id=unknown.name,
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code is ToolErrorCode.INVALID_EVIDENCE


@pytest.mark.parametrize("output_format", ("json", "text"))
def test_cli_reviews_exact_v3_sibling_in_both_formats(
    repository_root: Path,
    tmp_path: Path,
    output_format: str,
) -> None:
    from hermes.cli import app

    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    result = CliRunner().invoke(
        app,
        [
            "review-artifact",
            bundle.name,
            "--artifact-root",
            str(tmp_path / "source"),
            "--format",
            output_format,
        ],
    )

    assert result.exit_code == 0, result.output
    assert "2.0" in result.output
    assert "adas.aeb.required_decel_at_onset_mps2" in result.output


def test_cli_review_compare_serializes_exact_schema2_sibling(
    v3_pair: tuple[Path, Path, Path],
) -> None:
    from hermes.cli import app

    root, baseline, candidate = v3_pair
    result = CliRunner().invoke(
        app,
        [
            "review-compare",
            baseline.relative_to(root).as_posix(),
            candidate.relative_to(root).as_posix(),
            "--artifact-root",
            str(root),
            "--format",
            "json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["comparison_schema_version"] == "2.0"
    assert len(payload["dimensions"]) == 63


def test_no_cross_capture_laundering_after_coherent_bundle_replacement(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    bundle = _synthetic_v3(repository_root, tmp_path / "source")
    context = ToolContext(repository_root=repository_root, artifact_root=tmp_path / "source")
    result = get_metrics(context, run_id=bundle.name)
    assert result.ok
    citation = next(
        item for item in result.citations if item.locator == "/max_observation_age_s/value"
    )

    replacement_parent = tmp_path / "replacement"
    replacement = _synthetic_v3(repository_root, replacement_parent, faulted=True)
    shutil.rmtree(bundle)
    shutil.copytree(replacement, bundle)

    check = check_citations((citation,), tmp_path / "source")[0]
    assert check.status is CitationStatus.BUNDLE_DIGEST_MISMATCH
