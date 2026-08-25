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

from hermes.agents.citations import CitationStatus, _walk, check_citations
from hermes.agents.contracts import Citation, ToolErrorCode
from hermes.agents.tools import ToolContext, get_metrics, query_run
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
