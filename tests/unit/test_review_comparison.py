from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import pytest

import hermes.review as review_api
import hermes.review.facade as facade_module
from hermes.comparison.compare import (
    ArtifactComparison,
    ComparisonCompatibility,
    ComparisonDimension,
)
from hermes.comparison.compare import (
    ComparisonStatus as CoreComparisonStatus,
)
from hermes.comparison.compare import (
    compare_artifacts as compare_core,
)
from hermes.review.models import (
    AvailabilityMapValue,
    ComparisonEnvelope,
    ComparisonStringListValue,
    HardFailureDelta,
    InterventionValue,
    MeasurementDeltaValue,
    ReviewEnvelope,
    ReviewUnavailableError,
    ReviewUnavailableReason,
    ScalarDeltaValue,
)

_PARTITIONS = (
    "improvements",
    "regressions",
    "unchanged_outcomes",
    "not_comparable",
)


def _comparison_api() -> Callable[[Path, str, str], ComparisonEnvelope | ReviewEnvelope]:
    function = getattr(review_api, "compare_review_artifacts", None)
    assert callable(function), "Task 4 public comparison facade is not implemented"
    return function


def _dimension(result: ComparisonEnvelope, dimension_id: str):
    for partition_name in _PARTITIONS:
        for dimension in getattr(result, partition_name):
            if dimension.dimension_id == dimension_id:
                return dimension
    raise AssertionError(f"missing comparison dimension {dimension_id!r}")


def _partition_ids(result: ComparisonEnvelope) -> dict[str, tuple[str, ...]]:
    return {
        name: tuple(item.dimension_id for item in getattr(result, name)) for name in _PARTITIONS
    }


def _forbidden_keys(value: object) -> set[str]:
    forbidden = {
        "winner",
        "score",
        "safety_score",
        "recommendation",
        "approval",
        "deployment_grant",
    }
    found: set[str] = set()
    if isinstance(value, dict):
        found.update(forbidden.intersection(value))
        for child in value.values():
            found.update(_forbidden_keys(child))
    elif isinstance(value, list):
        for child in value:
            found.update(_forbidden_keys(child))
    return found


def test_compare_facade_independently_reviews_both_sides_and_calls_core_once(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reviewed: list[str] = []
    core_calls: list[tuple[object, object]] = []
    original_review = facade_module._ReviewFacade._review_result

    def record_review(self, root: Path, selection: str):
        reviewed.append(selection)
        return original_review(self, root, selection)

    def record_compare(baseline: object, candidate: object) -> ArtifactComparison:
        core_calls.append((baseline, candidate))
        return compare_core(baseline, candidate)

    monkeypatch.setattr(facade_module._ReviewFacade, "_review_result", record_review)
    monkeypatch.setattr(facade_module, "compare_artifacts", record_compare, raising=False)

    result = _comparison_api()(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    assert isinstance(result, ComparisonEnvelope)
    assert reviewed == ["handoff-p3-lead-baseline", "handoff-p3-lead-shielded"]
    assert len(core_calls) == 1


@pytest.mark.parametrize(
    ("baseline", "candidate", "invalid_locator", "reviewed_paths"),
    [
        (
            "phase1-tampered",
            "handoff-phase5-demo",
            "phase1-tampered",
            ["phase1-tampered"],
        ),
        (
            "handoff-phase5-demo",
            "phase1-tampered",
            "phase1-tampered",
            ["handoff-phase5-demo", "phase1-tampered"],
        ),
        (
            "phase1-tampered",
            "phase1-tampered",
            "phase1-tampered",
            ["phase1-tampered"],
        ),
    ],
)
def test_invalid_comparison_returns_baseline_first_quarantined_review_without_core_claims(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    baseline: str,
    candidate: str,
    invalid_locator: str,
    reviewed_paths: list[str],
) -> None:
    core_calls = 0
    reviewed: list[str] = []
    original_review = facade_module._ReviewFacade._review_result

    def record_review(self, root: Path, selection: str):
        reviewed.append(selection)
        return original_review(self, root, selection)

    def forbidden_compare(*args: object) -> ArtifactComparison:
        nonlocal core_calls
        core_calls += 1
        raise AssertionError(f"invalid evidence reached comparison core: {args!r}")

    monkeypatch.setattr(facade_module._ReviewFacade, "_review_result", record_review)
    monkeypatch.setattr(facade_module, "compare_artifacts", forbidden_compare, raising=False)

    result = _comparison_api()(repository_root / "artifacts", baseline, candidate)

    assert reviewed == reviewed_paths
    assert core_calls == 0
    assert isinstance(result, ReviewEnvelope)
    assert result.artifact.locator.selected_relative_path == invalid_locator
    assert result.verification.integrity == "INVALID_EVIDENCE"
    assert result.gate.verdict == "INVALID_EVIDENCE"
    assert result.findings == ()
    assert result.metrics == ()
    assert result.timeline.event_count == 0
    assert result.provenance.recorded.status == "QUARANTINED"


def test_lead_pair_maps_every_core_dimension_once_with_exact_tradeoffs_and_types(
    repository_root: Path,
) -> None:
    result = _comparison_api()(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    assert isinstance(result, ComparisonEnvelope)
    assert result.compatibility.status == "COMPATIBLE"
    assert result.compatibility.reasons == ()
    assert _partition_ids(result) == {
        "improvements": ("minimum_ttc_s",),
        "regressions": (
            "route_completion_pct",
            "max_abs_acceleration_mps2",
            "max_abs_jerk_mps3",
        ),
        "unchanged_outcomes": (
            "collision_count",
            "p95_policy_latency_ms",
            "policy_latency_source",
        ),
        "not_comparable": ("shield_interventions",),
    }
    assert result.verdict_delta is not None
    assert isinstance(result.verdict_delta.baseline_value, ScalarDeltaValue)
    assert result.verdict_delta.baseline_value.value.machine_value == "CONDITIONAL"
    assert result.verdict_delta.candidate_value.value.machine_value == "CONDITIONAL"
    assert isinstance(result.hard_failure_delta, HardFailureDelta)
    assert result.hard_failure_delta.status == "UNCHANGED"
    assert result.hard_failure_delta.baseline_ids == ()
    assert result.hard_failure_delta.candidate_ids == ()
    assert result.hard_failure_delta.removed_ids == ()
    assert result.hard_failure_delta.added_ids == ()
    assert result.hard_failure_delta.explanation == "hard-failure set is unchanged"
    assert result.availability_summary_delta is not None
    assert isinstance(
        result.availability_summary_delta.baseline_value,
        AvailabilityMapValue,
    )

    collision = _dimension(result, "collision_count")
    ttc = _dimension(result, "minimum_ttc_s")
    latency_source = _dimension(result, "policy_latency_source")
    interventions = _dimension(result, "shield_interventions")
    assert isinstance(collision.baseline_value, ScalarDeltaValue)
    assert collision.baseline_value.value.machine_value == 0
    assert isinstance(ttc.baseline_value, MeasurementDeltaValue)
    assert ttc.baseline_value.value == 11.585881563948043
    assert ttc.candidate_value.value == 13.338911253788899
    assert isinstance(latency_source.baseline_value, ComparisonStringListValue)
    assert latency_source.baseline_value.values == ("simulated",)
    assert isinstance(interventions.baseline_value, InterventionValue)
    assert interventions.baseline_value.count == 0
    assert interventions.candidate_value.count == 36
    assert dict(interventions.candidate_value.reasons) == {"SPEED_CAP": 36}
    assert result.availability_deltas == ()
    assert tuple(series.dimension_id for series in result.chart_series) == (
        "collision_count",
        "minimum_ttc_s",
        "route_completion_pct",
        "max_abs_acceleration_mps2",
        "max_abs_jerk_mps3",
        "p95_policy_latency_ms",
    )
    assert _forbidden_keys(result.model_dump(mode="json")) == set()


def test_cutin_pair_retains_hold_and_mixed_tradeoffs_without_a_winner(
    repository_root: Path,
) -> None:
    result = _comparison_api()(
        repository_root / "artifacts",
        "handoff-p3-cutin-baseline",
        "handoff-p3-cutin-shielded",
    )

    assert isinstance(result, ComparisonEnvelope)
    assert result.baseline.gate_verdict == "HOLD"
    assert result.candidate.gate_verdict == "HOLD"
    assert result.verdict_delta is not None
    assert result.verdict_delta.status == "UNCHANGED"
    assert result.hard_failure_delta is not None
    assert result.hard_failure_delta.baseline_ids == ("progress.required",)
    assert result.hard_failure_delta.candidate_ids == ("progress.required",)
    assert _dimension(result, "minimum_ttc_s").baseline_value.value == 1.8155836417275437
    assert _dimension(result, "minimum_ttc_s").candidate_value.value == 8.49579415469856
    assert _partition_ids(result) == {
        "improvements": ("minimum_ttc_s",),
        "regressions": (
            "route_completion_pct",
            "max_abs_acceleration_mps2",
            "max_abs_jerk_mps3",
        ),
        "unchanged_outcomes": (
            "collision_count",
            "p95_policy_latency_ms",
            "policy_latency_source",
        ),
        "not_comparable": ("shield_interventions",),
    }
    assert _forbidden_keys(result.model_dump(mode="json")) == set()


def test_comparison_references_are_side_qualified_exact_and_canonically_ordered(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"
    baseline_review = review_api.review_artifact(root, "handoff-p3-lead-baseline")
    candidate_review = review_api.review_artifact(root, "handoff-p3-lead-shielded")
    result = _comparison_api()(
        root,
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    assert isinstance(result, ComparisonEnvelope)
    assert [
        (item.side, item.reference.file_name, item.reference.json_pointer)
        for item in result.baseline.source_references
    ] == [
        ("BASELINE", "manifest.json", "/created_at_utc"),
        ("BASELINE", "manifest.json", "/evidence_schema_version"),
        ("BASELINE", "manifest.json", "/run_id"),
        ("BASELINE", "manifest.json", "/scenario_schema_version"),
        ("BASELINE", "verdict.json", "/verdict"),
        ("BASELINE", "trace.sha256", ""),
        ("BASELINE", "bundle.sha256", ""),
    ]
    assert result.verdict_delta is not None
    assert [
        (item.side, item.reference.file_name, item.reference.json_pointer)
        for item in result.verdict_delta.source_references
    ] == [
        ("BASELINE", "verdict.json", "/verdict"),
        ("CANDIDATE", "verdict.json", "/verdict"),
    ]
    intervention_references = _dimension(result, "shield_interventions").source_references
    assert [(item.side, item.reference.json_pointer) for item in intervention_references] == [
        ("BASELINE", "/shield_override_count"),
        ("CANDIDATE", "/shield_override_count"),
        ("BASELINE", "/shield_override_reasons"),
        ("CANDIDATE", "/shield_override_reasons"),
    ]
    latency_references = _dimension(result, "policy_latency_source").source_references
    assert len(latency_references) == (
        baseline_review.timeline.event_count + candidate_review.timeline.event_count
    )
    assert [
        item.reference.event_sequence for item in latency_references if item.side == "BASELINE"
    ] == list(range(baseline_review.timeline.event_count))
    assert [
        item.reference.event_sequence for item in latency_references if item.side == "CANDIDATE"
    ] == list(range(candidate_review.timeline.event_count))
    assert latency_references[0].side == "BASELINE"
    assert latency_references[1].side == "CANDIDATE"
    assert latency_references[0].reference.event_sequence == 0
    assert latency_references[-1].reference.event_sequence == (
        candidate_review.timeline.event_count - 1
    )
    assert latency_references[-1].side == "CANDIDATE"


def test_incompatible_valid_pair_has_only_core_reasons_and_no_comparison_claims(
    repository_root: Path,
) -> None:
    result = _comparison_api()(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-cutin-baseline",
    )

    assert isinstance(result, ComparisonEnvelope)
    assert result.compatibility.status == "INCOMPATIBLE"
    assert result.compatibility.reasons == (
        "scenario digest differs: "
        "baseline='a3b738431af234f4d2751667e8fee869307bc7c6d32b69fa71b602d340b48aaf', "
        "candidate='5d96994b9a1efd7626f162d852501a7c51c358e865be24a5c7929c2de5129e32'",
        "scenario name differs: baseline='lead_vehicle_hard_brake', candidate='cut_in_near_field'",
        "adapter configuration digest differs: "
        "baseline='4bf4f0051f46a079abf3d208773ea9ed668e0888f81c1b70f24752adcd9bc4a3', "
        "candidate='d8e9e31b3f069fb9cbd26d5331747255315a112109af29345ccd6e1fddf0b999'",
    )
    assert result.compatibility.warnings == ()
    assert result.verdict_delta is None
    assert result.hard_failure_delta is None
    assert result.availability_summary_delta is None
    assert all(not getattr(result, name) for name in _PARTITIONS)
    assert result.availability_deltas == ()
    assert result.chart_series == ()
    assert _forbidden_keys(result.model_dump(mode="json")) == set()


def test_reason_only_availability_change_emits_exact_detail_and_chart_gap(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = repository_root / "artifacts"
    baseline = facade_module._ReviewFacade()._review_result(root, "handoff-p3-lead-baseline")
    candidate = facade_module._ReviewFacade()._review_result(root, "handoff-p3-lead-shielded")
    original = compare_core(
        baseline.capture.inspection.snapshot,
        candidate.capture.inspection.snapshot,
    )
    replacement: list[ComparisonDimension] = []
    for dimension in original.dimensions:
        if dimension.name == "minimum_ttc_s":
            replacement.append(
                ComparisonDimension(
                    name=dimension.name,
                    status=CoreComparisonStatus.NOT_COMPARABLE,
                    baseline_value={
                        "availability": "NOT_AVAILABLE",
                        "value": None,
                        "reason": "baseline TTC unavailable",
                    },
                    candidate_value={
                        "availability": "NOT_AVAILABLE",
                        "value": None,
                        "reason": "candidate TTC unavailable",
                    },
                    unit="s",
                    explanation="both measurements must be AVAILABLE; missing evidence is not zero",
                )
            )
        elif dimension.name == "evidence_availability":
            baseline_values = dict(dimension.baseline_value)
            candidate_values = dict(dimension.candidate_value)
            baseline_values["minimum_ttc_s"] = "NOT_AVAILABLE"
            candidate_values["minimum_ttc_s"] = "NOT_AVAILABLE"
            replacement.append(
                ComparisonDimension(
                    name=dimension.name,
                    status=CoreComparisonStatus.UNCHANGED,
                    baseline_value=baseline_values,
                    candidate_value=candidate_values,
                    explanation="measurement evidence availability is unchanged",
                )
            )
        else:
            replacement.append(dimension)
    synthetic = original.model_copy(update={"dimensions": tuple(replacement)})
    monkeypatch.setattr(
        facade_module,
        "compare_artifacts",
        lambda baseline_snapshot, candidate_snapshot: synthetic,
        raising=False,
    )

    result = _comparison_api()(
        root,
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    assert isinstance(result, ComparisonEnvelope)
    assert tuple(item.metric_id for item in result.availability_deltas) == ("minimum_ttc_s",)
    detail = result.availability_deltas[0]
    assert detail.baseline_availability == "NOT_AVAILABLE"
    assert detail.candidate_availability == "NOT_AVAILABLE"
    assert detail.baseline_reason == "baseline TTC unavailable"
    assert detail.candidate_reason == "candidate TTC unavailable"
    assert "minimum_ttc_s" not in {series.dimension_id for series in result.chart_series}


def test_unknown_comparison_core_shape_is_typed_review_unavailable(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    synthetic = ArtifactComparison(
        baseline_path="baseline",
        candidate_path="candidate",
        compatibility=ComparisonCompatibility(comparable=True),
        dimensions=(
            ComparisonDimension(
                name="future_dimension",
                status=CoreComparisonStatus.UNCHANGED,
                baseline_value=1,
                candidate_value=1,
                explanation="future core shape",
            ),
        ),
    )
    monkeypatch.setattr(
        facade_module,
        "compare_artifacts",
        lambda baseline_snapshot, candidate_snapshot: synthetic,
        raising=False,
    )

    with pytest.raises(ReviewUnavailableError) as caught:
        _comparison_api()(
            repository_root / "artifacts",
            "handoff-p3-lead-baseline",
            "handoff-p3-lead-shielded",
        )

    assert caught.value.reason is ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE


@pytest.mark.parametrize(
    ("dimension_id", "wrong_unit"),
    [
        ("minimum_ttc_s", "ms"),
        ("hard_failures", "failures"),
    ],
)
def test_wrong_core_dimension_unit_is_typed_review_unavailable(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    dimension_id: str,
    wrong_unit: str,
) -> None:
    root = repository_root / "artifacts"
    baseline = facade_module._ReviewFacade()._review_result(root, "handoff-p3-lead-baseline")
    candidate = facade_module._ReviewFacade()._review_result(root, "handoff-p3-lead-shielded")
    original = compare_core(
        baseline.capture.inspection.snapshot,
        candidate.capture.inspection.snapshot,
    )
    dimensions = tuple(
        dimension.model_copy(update={"unit": wrong_unit})
        if dimension.name == dimension_id
        else dimension
        for dimension in original.dimensions
    )
    synthetic = original.model_copy(update={"dimensions": dimensions})
    monkeypatch.setattr(
        facade_module,
        "compare_artifacts",
        lambda baseline_snapshot, candidate_snapshot: synthetic,
    )

    with pytest.raises(ReviewUnavailableError) as caught:
        _comparison_api()(
            root,
            "handoff-p3-lead-baseline",
            "handoff-p3-lead-shielded",
        )

    assert caught.value.reason is ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE
