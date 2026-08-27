"""Deterministic, simulator-free comparison over verified artifact snapshots."""

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from types import MappingProxyType
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict

from hermes.domain.enums import EvidenceAvailability, Verdict
from hermes.domain.models import (
    BooleanMeasurement,
    CountMeasurement,
    JsonValue,
    Measurement,
    RunMetricsV3,
)
from hermes.evidence.metric_registry import (
    SCHEMA2_METRIC_REGISTRY,
    MetricLeafSpec,
    metric_leaf_value,
)

if TYPE_CHECKING:
    from hermes.evidence.verification import VerifiedArtifactSnapshot


class ComparisonStatus(StrEnum):
    """Direction of one candidate result relative to its baseline."""

    IMPROVED = "IMPROVED"
    REGRESSED = "REGRESSED"
    UNCHANGED = "UNCHANGED"
    NOT_COMPARABLE = "NOT_COMPARABLE"


class _ComparisonModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)


class VariationAxis(StrEnum):
    """The one component a comparison is permitted to vary.

    Comparison is fail-closed by design: two runs that differ in any identity or
    configuration digest are not comparable, because a metric delta between them cannot be
    attributed to anything. That is correct, and it also makes the single most useful
    comparison - this controller against that controller - structurally impossible.

    A declared variation axis resolves it without weakening the principle. The caller states
    in advance which component is the independent variable; every other digest must still
    match exactly. A delta is then attributable to the declared axis or to nothing.
    """

    NONE = "none"
    POLICY = "policy"


#: Checks a declared axis is permitted to relax. Everything not listed stays fail-closed.
_AXIS_EXEMPT_CHECKS: Mapping[VariationAxis, frozenset[str]] = MappingProxyType(
    {
        VariationAxis.NONE: frozenset(),
        VariationAxis.POLICY: frozenset(
            {"policy name", "policy version", "policy configuration digest"}
        ),
    }
)


class ComparisonCompatibility(_ComparisonModel):
    """Fail-closed compatibility decision made before metric comparison."""

    comparable: bool
    reasons: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    declared_variation_axis: VariationAxis = VariationAxis.NONE
    varied: tuple[str, ...] = ()


class ComparisonDimension(_ComparisonModel):
    """One explicit, machine-readable comparison dimension."""

    name: str
    status: ComparisonStatus
    baseline_value: JsonValue
    candidate_value: JsonValue
    unit: str | None = None
    explanation: str


class ArtifactComparison(_ComparisonModel):
    """Complete comparison result for two stable, verified snapshots."""

    baseline_path: str
    candidate_path: str
    compatibility: ComparisonCompatibility
    dimensions: tuple[ComparisonDimension, ...] = ()


class ComparisonDimensionV2(_ComparisonModel):
    """One evidence-V3 leaf comparison with its frozen neutral metadata."""

    name: str
    status: ComparisonStatus
    baseline_value: JsonValue
    candidate_value: JsonValue
    value_kind: str
    unit: str | None = None
    explanation: str
    desired_direction: str
    abs_tol: float
    rel_tol: float
    tolerance_label: str
    criticality: str
    gating: bool


class ArtifactComparisonV2(_ComparisonModel):
    """Standalone comparison schema selected whenever either side is evidence V3."""

    comparison_schema_version: Literal["2.0"] = "2.0"
    baseline_path: str
    candidate_path: str
    compatibility: ComparisonCompatibility
    dimensions: tuple[ComparisonDimensionV2, ...] = ()


def _compatibility(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
    variation_axis: VariationAxis = VariationAxis.NONE,
) -> ComparisonCompatibility:
    baseline_manifest = baseline.manifest
    candidate_manifest = candidate.manifest
    reasons: list[str] = []
    warnings: list[str] = []

    checks: tuple[tuple[str, object, object], ...] = (
        (
            "evidence schema version",
            baseline_manifest.evidence_schema_version,
            candidate_manifest.evidence_schema_version,
        ),
        ("scenario digest", baseline_manifest.scenario_digest, candidate_manifest.scenario_digest),
        ("scenario name", baseline.scenario.name, candidate.scenario.name),
        ("scenario version", baseline.scenario.version, candidate.scenario.version),
        (
            "scenario schema version",
            baseline.scenario.schema_version,
            candidate.scenario.schema_version,
        ),
        (
            "gate configuration digest",
            baseline_manifest.gate_config_digest,
            candidate_manifest.gate_config_digest,
        ),
        ("gate name", baseline.gate_config.name, candidate.gate_config.name),
        ("gate version", baseline.gate_config.version, candidate.gate_config.version),
        ("adapter name", baseline_manifest.adapter_name, candidate_manifest.adapter_name),
        ("adapter version", baseline_manifest.adapter_version, candidate_manifest.adapter_version),
        (
            "adapter configuration digest",
            baseline_manifest.adapter_config_digest,
            candidate_manifest.adapter_config_digest,
        ),
        ("policy name", baseline_manifest.policy_name, candidate_manifest.policy_name),
        ("policy version", baseline_manifest.policy_version, candidate_manifest.policy_version),
        (
            "policy configuration digest",
            baseline_manifest.policy_config_digest,
            candidate_manifest.policy_config_digest,
        ),
        ("seed", baseline_manifest.seed, candidate_manifest.seed),
        (
            "control frequency",
            baseline_manifest.control_frequency_hz,
            candidate_manifest.control_frequency_hz,
        ),
        ("horizon", baseline_manifest.horizon_steps, candidate_manifest.horizon_steps),
        ("simulator name", baseline_manifest.simulator_name, candidate_manifest.simulator_name),
        (
            "simulator version",
            baseline_manifest.simulator_version,
            candidate_manifest.simulator_version,
        ),
        (
            "simulator commit",
            baseline_manifest.simulator_commit,
            candidate_manifest.simulator_commit,
        ),
        ("Python version", baseline_manifest.python_version, candidate_manifest.python_version),
        ("platform", baseline_manifest.platform, candidate_manifest.platform),
        ("architecture", baseline_manifest.architecture, candidate_manifest.architecture),
        (
            "fault name",
            getattr(baseline_manifest, "fault_name", None),
            getattr(candidate_manifest, "fault_name", None),
        ),
        (
            "fault version",
            getattr(baseline_manifest, "fault_version", None),
            getattr(candidate_manifest, "fault_version", None),
        ),
        (
            "fault configuration digest",
            getattr(baseline_manifest, "fault_config_digest", None),
            getattr(candidate_manifest, "fault_config_digest", None),
        ),
    )
    exempt = _AXIS_EXEMPT_CHECKS[variation_axis]
    varied: list[str] = []
    for label, baseline_value, candidate_value in checks:
        if baseline_value == candidate_value:
            continue
        if label in exempt:
            # Declared in advance as the independent variable, so it is recorded as a
            # variation rather than as a reason the pair cannot be compared.
            varied.append(f"{label}: baseline={baseline_value!r}, candidate={candidate_value!r}")
            continue
        reasons.append(
            f"{label} differs: baseline={baseline_value!r}, candidate={candidate_value!r}"
        )
    if variation_axis is not VariationAxis.NONE and not varied:
        # A declared axis that did not actually vary is a mistake worth surfacing: the
        # caller believes they are comparing two controllers and they are not.
        warnings.append(
            f"declared variation axis {variation_axis.value!r} did not vary between the runs"
        )

    if baseline_manifest.repository_commit is None or candidate_manifest.repository_commit is None:
        reasons.append("repository commit is unavailable for one or both artifacts")
    elif baseline_manifest.repository_commit != candidate_manifest.repository_commit:
        reasons.append(
            "repository commit differs: "
            f"baseline={baseline_manifest.repository_commit!r}, "
            f"candidate={candidate_manifest.repository_commit!r}"
        )

    dirty_labels = [
        label
        for label, dirty in (
            ("baseline", baseline_manifest.repository_dirty),
            ("candidate", candidate_manifest.repository_dirty),
        )
        if dirty is True
    ]
    unknown_dirty_labels = [
        label
        for label, dirty in (
            ("baseline", baseline_manifest.repository_dirty),
            ("candidate", candidate_manifest.repository_dirty),
        )
        if dirty is None
    ]
    if dirty_labels:
        warnings.append("repository worktree was dirty for: " + ", ".join(dirty_labels))
    if unknown_dirty_labels:
        warnings.append(
            "repository dirty state is unavailable for: " + ", ".join(unknown_dirty_labels)
        )

    return ComparisonCompatibility(
        comparable=not reasons,
        reasons=tuple(reasons),
        warnings=tuple(warnings),
        declared_variation_axis=variation_axis,
        varied=tuple(varied),
    )


def _ordered_numeric_status(
    baseline: float | int,
    candidate: float | int,
    *,
    higher_is_better: bool,
) -> ComparisonStatus:
    if candidate == baseline:
        return ComparisonStatus.UNCHANGED
    improved = candidate > baseline if higher_is_better else candidate < baseline
    return ComparisonStatus.IMPROVED if improved else ComparisonStatus.REGRESSED


def _measurement_payload(measurement: Measurement) -> dict[str, JsonValue]:
    return {
        "availability": measurement.availability.value,
        "value": measurement.value,
        "reason": measurement.reason,
    }


def _measurement_dimension(
    name: str,
    baseline: Measurement,
    candidate: Measurement,
    *,
    higher_is_better: bool,
) -> ComparisonDimension:
    baseline_payload = _measurement_payload(baseline)
    candidate_payload = _measurement_payload(candidate)
    if baseline.unit != candidate.unit:
        return ComparisonDimension(
            name=name,
            status=ComparisonStatus.NOT_COMPARABLE,
            baseline_value=baseline_payload,
            candidate_value=candidate_payload,
            explanation=f"measurement units differ: {baseline.unit!r} vs {candidate.unit!r}",
        )
    if (
        baseline.availability is not EvidenceAvailability.AVAILABLE
        or candidate.availability is not EvidenceAvailability.AVAILABLE
    ):
        return ComparisonDimension(
            name=name,
            status=ComparisonStatus.NOT_COMPARABLE,
            baseline_value=baseline_payload,
            candidate_value=candidate_payload,
            unit=baseline.unit,
            explanation="both measurements must be AVAILABLE; missing evidence is not zero",
        )
    assert baseline.value is not None
    assert candidate.value is not None
    return ComparisonDimension(
        name=name,
        status=_ordered_numeric_status(
            baseline.value,
            candidate.value,
            higher_is_better=higher_is_better,
        ),
        baseline_value=baseline_payload,
        candidate_value=candidate_payload,
        unit=baseline.unit,
        explanation=(
            "higher values are favorable" if higher_is_better else "lower values are favorable"
        ),
    )


def _verdict_dimension(baseline: Verdict, candidate: Verdict) -> ComparisonDimension:
    rank = {
        Verdict.HOLD: 0,
        Verdict.CONDITIONAL: 1,
        Verdict.PASS: 2,
    }
    if baseline not in rank or candidate not in rank:
        status = ComparisonStatus.NOT_COMPARABLE
        explanation = "INVALID_EVIDENCE is not an ordinal policy outcome"
    else:
        status = _ordered_numeric_status(rank[baseline], rank[candidate], higher_is_better=True)
        explanation = "policy outcomes are ordered HOLD, CONDITIONAL, PASS"
    return ComparisonDimension(
        name="verdict",
        status=status,
        baseline_value=baseline.value,
        candidate_value=candidate.value,
        explanation=explanation,
    )


def _hard_failures_dimension(
    baseline_failures: tuple[str, ...],
    candidate_failures: tuple[str, ...],
) -> ComparisonDimension:
    baseline = set(baseline_failures)
    candidate = set(candidate_failures)
    removed = sorted(baseline - candidate)
    added = sorted(candidate - baseline)
    if not removed and not added:
        status = ComparisonStatus.UNCHANGED
        explanation = "hard-failure set is unchanged"
    elif removed and not added:
        status = ComparisonStatus.IMPROVED
        explanation = "removed hard failures: " + ", ".join(removed)
    elif added and not removed:
        status = ComparisonStatus.REGRESSED
        explanation = "added hard failures: " + ", ".join(added)
    else:
        status = ComparisonStatus.NOT_COMPARABLE
        explanation = (
            "hard failures changed in both directions; removed: "
            + ", ".join(removed)
            + "; added: "
            + ", ".join(added)
        )
    return ComparisonDimension(
        name="hard_failures",
        status=status,
        baseline_value=sorted(baseline),
        candidate_value=sorted(candidate),
        explanation=explanation,
    )


_MEASUREMENT_DIMENSIONS: tuple[tuple[str, bool], ...] = (
    ("minimum_ttc_s", True),
    ("route_completion_pct", True),
    ("max_abs_acceleration_mps2", False),
    ("max_abs_jerk_mps3", False),
    ("p95_policy_latency_ms", False),
)


def _availability_dimension(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
) -> ComparisonDimension:
    baseline_availability = {
        name: getattr(baseline.metrics, name).availability.value
        for name, _ in _MEASUREMENT_DIMENSIONS
    }
    candidate_availability = {
        name: getattr(candidate.metrics, name).availability.value
        for name, _ in _MEASUREMENT_DIMENSIONS
    }
    gains = [
        name
        for name, _ in _MEASUREMENT_DIMENSIONS
        if baseline_availability[name] == EvidenceAvailability.NOT_AVAILABLE.value
        and candidate_availability[name] == EvidenceAvailability.AVAILABLE.value
    ]
    losses = [
        name
        for name, _ in _MEASUREMENT_DIMENSIONS
        if baseline_availability[name] == EvidenceAvailability.AVAILABLE.value
        and candidate_availability[name] == EvidenceAvailability.NOT_AVAILABLE.value
    ]
    if not gains and not losses:
        status = ComparisonStatus.UNCHANGED
        explanation = "measurement evidence availability is unchanged"
    elif gains and not losses:
        status = ComparisonStatus.NOT_COMPARABLE
        explanation = (
            "measurement applicability became available and is descriptive, not an "
            "ordinal improvement: " + ", ".join(gains)
        )
    elif losses and not gains:
        status = ComparisonStatus.NOT_COMPARABLE
        explanation = (
            "measurement applicability became unavailable and is descriptive, not an "
            "ordinal regression: " + ", ".join(losses)
        )
    else:
        status = ComparisonStatus.NOT_COMPARABLE
        explanation = (
            "evidence availability changed in both directions; gained: "
            + ", ".join(gains)
            + "; lost: "
            + ", ".join(losses)
        )
    return ComparisonDimension(
        name="evidence_availability",
        status=status,
        baseline_value=baseline_availability,
        candidate_value=candidate_availability,
        explanation=explanation,
    )


def _latency_source_dimension(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
) -> ComparisonDimension:
    baseline_sources = _latency_sources(baseline)
    candidate_sources = _latency_sources(candidate)
    equal = baseline_sources == candidate_sources
    return ComparisonDimension(
        name="policy_latency_source",
        status=(ComparisonStatus.UNCHANGED if equal else ComparisonStatus.NOT_COMPARABLE),
        baseline_value=baseline_sources,
        candidate_value=candidate_sources,
        explanation=(
            "latency evidence source is unchanged"
            if equal
            else "different latency sources are descriptive and cannot be ranked"
        ),
    )


def _latency_sources(snapshot: VerifiedArtifactSnapshot) -> list[str]:
    return sorted({event.latency_source for event in snapshot.events})


def _latency_measurement_dimension(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
) -> ComparisonDimension:
    baseline_measurement = baseline.metrics.p95_policy_latency_ms
    candidate_measurement = candidate.metrics.p95_policy_latency_ms
    if _latency_sources(baseline) != _latency_sources(candidate):
        return ComparisonDimension(
            name="p95_policy_latency_ms",
            status=ComparisonStatus.NOT_COMPARABLE,
            baseline_value=_measurement_payload(baseline_measurement),
            candidate_value=_measurement_payload(candidate_measurement),
            unit=(
                baseline_measurement.unit
                if baseline_measurement.unit == candidate_measurement.unit
                else None
            ),
            explanation="policy latency measurements with different sources cannot be ranked",
        )
    return _measurement_dimension(
        "p95_policy_latency_ms",
        baseline_measurement,
        candidate_measurement,
        higher_is_better=False,
    )


def _intervention_dimension(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
) -> ComparisonDimension:
    baseline_value: dict[str, JsonValue] = {
        "count": baseline.metrics.shield_override_count,
        "reasons": dict(sorted(baseline.metrics.shield_override_reasons.items())),
    }
    candidate_value: dict[str, JsonValue] = {
        "count": candidate.metrics.shield_override_count,
        "reasons": dict(sorted(candidate.metrics.shield_override_reasons.items())),
    }
    equal = baseline_value == candidate_value
    return ComparisonDimension(
        name="shield_interventions",
        status=(ComparisonStatus.UNCHANGED if equal else ComparisonStatus.NOT_COMPARABLE),
        baseline_value=baseline_value,
        candidate_value=candidate_value,
        explanation=(
            "interventions are unchanged; counts and reasons are descriptive only"
            if equal
            else "intervention counts and reasons are descriptive, not ordinal safety evidence"
        ),
    )


def _compare_artifacts_v1(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
    variation_axis: VariationAxis = VariationAxis.NONE,
) -> ArtifactComparison:
    """Compare two stable verified snapshots, refusing incompatible evidence.

    ``variation_axis`` defaults to NONE, which preserves the original fail-closed behaviour
    exactly: any difference in any identity or configuration digest makes the pair
    incomparable. A caller that wants to compare two controllers must say so.
    """
    compatibility = _compatibility(baseline, candidate, variation_axis)
    if not compatibility.comparable:
        return ArtifactComparison(
            baseline_path=str(baseline.path),
            candidate_path=str(candidate.path),
            compatibility=compatibility,
        )

    dimensions: list[ComparisonDimension] = [
        _verdict_dimension(baseline.verdict.verdict, candidate.verdict.verdict),
        _hard_failures_dimension(
            baseline.verdict.hard_failures,
            candidate.verdict.hard_failures,
        ),
        ComparisonDimension(
            name="collision_count",
            status=_ordered_numeric_status(
                baseline.metrics.collision_count,
                candidate.metrics.collision_count,
                higher_is_better=False,
            ),
            baseline_value=baseline.metrics.collision_count,
            candidate_value=candidate.metrics.collision_count,
            unit="collisions",
            explanation="lower values are favorable; collision remains a hard invariant",
        ),
    ]
    dimensions.extend(
        _measurement_dimension(
            name,
            getattr(baseline.metrics, name),
            getattr(candidate.metrics, name),
            higher_is_better=higher_is_better,
        )
        for name, higher_is_better in _MEASUREMENT_DIMENSIONS
        if name != "p95_policy_latency_ms"
    )
    dimensions.extend(
        (
            _latency_measurement_dimension(baseline, candidate),
            _latency_source_dimension(baseline, candidate),
            _intervention_dimension(baseline, candidate),
            _availability_dimension(baseline, candidate),
        )
    )
    return ArtifactComparison(
        baseline_path=str(baseline.path),
        candidate_path=str(candidate.path),
        compatibility=compatibility,
        dimensions=tuple(dimensions),
    )


def _v2_dimension(
    spec: MetricLeafSpec,
    baseline_value: object,
    candidate_value: object,
) -> ComparisonDimensionV2:
    def payload(value: object) -> JsonValue:
        if isinstance(value, (Measurement, CountMeasurement, BooleanMeasurement)):
            return value.model_dump(mode="json")
        if isinstance(value, StrEnum):
            return value.value
        if isinstance(value, Mapping):
            return dict(sorted(value.items()))
        assert isinstance(value, (str, int, float, bool, type(None)))
        return value

    baseline_payload = payload(baseline_value)
    candidate_payload = payload(candidate_value)
    unit = spec.unit
    left: object = baseline_value
    right: object = candidate_value
    if isinstance(
        baseline_value, (Measurement, CountMeasurement, BooleanMeasurement)
    ) and isinstance(candidate_value, (Measurement, CountMeasurement, BooleanMeasurement)):
        if baseline_value.unit != candidate_value.unit or baseline_value.unit != spec.unit:
            status = ComparisonStatus.NOT_COMPARABLE
            explanation = (
                "metric units differ from the registry or between sides: "
                f"{baseline_value.unit!r} vs {candidate_value.unit!r}; expected {spec.unit!r}"
            )
        elif (
            baseline_value.availability is not EvidenceAvailability.AVAILABLE
            or candidate_value.availability is not EvidenceAvailability.AVAILABLE
        ):
            status = ComparisonStatus.NOT_COMPARABLE
            explanation = (
                "availability transition is "
                f"{baseline_value.availability.value} -> {candidate_value.availability.value}; "
                "unavailable evidence is not zero or an ordinal result"
            )
        else:
            left = baseline_value.value
            right = candidate_value.value
            assert left is not None and right is not None
            status, explanation = _typed_v2_status(spec, left, right)
    else:
        status, explanation = _typed_v2_status(spec, left, right)
    return ComparisonDimensionV2(
        name=spec.leaf_id,
        status=status,
        baseline_value=baseline_payload,
        candidate_value=candidate_payload,
        value_kind=spec.value_kind,
        unit=unit,
        explanation=explanation,
        desired_direction=spec.direction,
        abs_tol=spec.abs_tol,
        rel_tol=spec.rel_tol,
        tolerance_label=spec.tolerance_label,
        criticality=spec.criticality,
        gating=spec.gating,
    )


def _typed_v2_status(
    spec: MetricLeafSpec,
    baseline: object,
    candidate: object,
) -> tuple[ComparisonStatus, str]:
    if spec.value_kind == "BOOLEAN":
        if type(baseline) is not bool or type(candidate) is not bool:
            return ComparisonStatus.NOT_COMPARABLE, "boolean metric has a non-boolean value"
        if baseline == candidate:
            return ComparisonStatus.UNCHANGED, "exact false-preferred boolean is unchanged"
        return (
            (ComparisonStatus.IMPROVED, "false-preferred transition is true -> false")
            if baseline and not candidate
            else (ComparisonStatus.REGRESSED, "false-preferred transition is false -> true")
        )
    if spec.direction == "DESCRIPTIVE":
        return (
            (ComparisonStatus.UNCHANGED, "descriptive value is exactly unchanged")
            if baseline == candidate
            else (
                ComparisonStatus.NOT_COMPARABLE,
                "descriptive values differ and are not ordinal",
            )
        )
    if (
        isinstance(baseline, bool)
        or isinstance(candidate, bool)
        or not isinstance(baseline, (int, float))
        or not isinstance(candidate, (int, float))
    ):
        return ComparisonStatus.NOT_COMPARABLE, "ordinal metric has a non-numeric value"
    tolerance = max(spec.abs_tol, spec.rel_tol * abs(float(baseline)))
    delta = float(candidate) - float(baseline)
    if abs(delta) <= tolerance:
        return (
            ComparisonStatus.UNCHANGED,
            f"absolute delta {abs(delta)!r} is within tolerance {tolerance!r}",
        )
    improved = delta > 0.0 if spec.direction == "HIGHER" else delta < 0.0
    return (
        ComparisonStatus.IMPROVED if improved else ComparisonStatus.REGRESSED,
        f"{spec.direction.lower()} values are favorable beyond tolerance {tolerance!r}",
    )


def _v2_special_dimension(
    dimension: ComparisonDimension,
    *,
    value_kind: str,
    direction: str,
) -> ComparisonDimensionV2:
    return ComparisonDimensionV2(
        name=dimension.name,
        status=dimension.status,
        baseline_value=dimension.baseline_value,
        candidate_value=dimension.candidate_value,
        value_kind=value_kind,
        unit=dimension.unit,
        explanation=dimension.explanation,
        desired_direction=direction,
        abs_tol=0.0,
        rel_tol=0.0,
        tolerance_label="illustrative_prototype_tolerances_not_for_real_vehicle_use",
        criticality="UNASSIGNED",
        gating=False,
    )


def _compare_artifacts_v2(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
    variation_axis: VariationAxis,
) -> ArtifactComparisonV2:
    compatibility = _compatibility(baseline, candidate, variation_axis)
    if not compatibility.comparable:
        return ArtifactComparisonV2(
            baseline_path=str(baseline.path),
            candidate_path=str(candidate.path),
            compatibility=compatibility,
        )
    if type(baseline.metrics) is not RunMetricsV3 or type(candidate.metrics) is not RunMetricsV3:
        # This should already be rejected by evidence-schema compatibility.  Keep the type seam
        # explicit so an impossible mixed family cannot be treated as V3 by inheritance.
        return ArtifactComparisonV2(
            baseline_path=str(baseline.path),
            candidate_path=str(candidate.path),
            compatibility=ComparisonCompatibility(
                comparable=False,
                reasons=("schema-2 comparison requires exact RunMetricsV3 on both sides",),
                warnings=compatibility.warnings,
                declared_variation_axis=variation_axis,
                varied=compatibility.varied,
            ),
        )
    dimensions: list[ComparisonDimensionV2] = [
        _v2_special_dimension(
            _verdict_dimension(baseline.verdict.verdict, candidate.verdict.verdict),
            value_kind="ENUM",
            direction="HIGHER",
        ),
        _v2_special_dimension(
            _hard_failures_dimension(
                baseline.verdict.hard_failures, candidate.verdict.hard_failures
            ),
            value_kind="STRING_LIST",
            direction="DESCRIPTIVE",
        ),
    ]
    dimensions.extend(
        _v2_dimension(
            spec,
            metric_leaf_value(baseline.metrics, spec),
            metric_leaf_value(candidate.metrics, spec),
        )
        for spec in SCHEMA2_METRIC_REGISTRY
    )
    return ArtifactComparisonV2(
        baseline_path=str(baseline.path),
        candidate_path=str(candidate.path),
        compatibility=compatibility,
        dimensions=tuple(dimensions),
    )


def compare_artifacts(
    baseline: VerifiedArtifactSnapshot,
    candidate: VerifiedArtifactSnapshot,
    variation_axis: VariationAxis = VariationAxis.NONE,
) -> ArtifactComparison | ArtifactComparisonV2:
    """Dispatch to a standalone schema before evaluating compatibility.

    Any pair involving evidence V3 is comparison schema 2, including mixed incompatible
    pairs.  Only a pair wholly in the legacy V1/V2 family can produce legacy bytes.
    """

    versions = {
        baseline.manifest.evidence_schema_version,
        candidate.manifest.evidence_schema_version,
    }
    if "3.0" in versions:
        return _compare_artifacts_v2(baseline, candidate, variation_axis)
    return _compare_artifacts_v1(baseline, candidate, variation_axis)
