from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from hermes.comparison.compare import ComparisonStatus, compare_artifacts
from hermes.domain.enums import EvidenceAvailability, TerminationReason, Verdict
from hermes.domain.models import (
    ArtifactManifest,
    ArtifactManifestV2,
    ComponentContext,
    ExecutionContext,
    FindingsDocument,
    GateResult,
    Measurement,
    RunContext,
    RunMetrics,
    ScenarioDefinition,
    TraceEvent,
)
from hermes.evidence.verification import VerifiedArtifactSnapshot
from hermes.gates.config import GateConfig


def _available(value: float, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=value,
        unit=unit,
    )


def _unavailable(reason: str, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.NOT_AVAILABLE,
        reason=reason,
        unit=unit,
    )


def _metrics(
    *,
    collision_count: int = 0,
    minimum_ttc_s: Measurement | None = None,
    route_completion_pct: Measurement | None = None,
    acceleration: Measurement | None = None,
    jerk: Measurement | None = None,
    latency: Measurement | None = None,
    override_count: int = 0,
    override_reasons: dict[str, int] | None = None,
) -> RunMetrics:
    return RunMetrics(
        event_count=10,
        simulation_duration_s=1.0,
        collision_count=collision_count,
        max_abs_lateral_offset_m=0.1,
        offroad_duration_s=0.0,
        minimum_ttc_s=minimum_ttc_s or _available(1.0, "s"),
        route_completion_pct=route_completion_pct or _available(90.0, "%"),
        max_abs_acceleration_mps2=acceleration or _available(3.0, "m/s^2"),
        max_abs_jerk_mps3=jerk or _available(4.0, "m/s^3"),
        p95_policy_latency_ms=latency or _available(10.0, "ms"),
        shield_override_count=override_count,
        shield_override_reasons=override_reasons or {},
        termination_reason=TerminationReason.HORIZON,
    )


def _snapshot(
    path: str,
    *,
    metrics: RunMetrics | None = None,
    verdict: Verdict = Verdict.PASS,
    hard_failures: tuple[str, ...] = (),
    latency_source: str = "simulated",
    repository_dirty: bool | None = False,
    repository_commit: str | None = "1" * 40,
    shield_name: str = "noop",
    shield_version: str = "1.0",
    shield_config_digest: str = "6" * 64,
) -> VerifiedArtifactSnapshot:
    run_context = RunContext(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name=shield_name,
        shield_version=shield_version,
        shield_config_digest=shield_config_digest,
        verifier_suite_digest="e" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=100,
    )
    context = ExecutionContext.model_construct(
        evidence_schema_version="1.0",
        run_context=run_context,
        adapter=ComponentContext.model_construct(
            name="metadrive", version="1.1", config={}, config_digest="c" * 64
        ),
        policy=ComponentContext.model_construct(
            name="metadrive-idm", version="1.0", config={}, config_digest="d" * 64
        ),
        shield=ComponentContext.model_construct(
            name=shield_name,
            version=shield_version,
            config={},
            config_digest=shield_config_digest,
        ),
        verifier_suite=(),
    )
    manifest = ArtifactManifest.model_construct(
        evidence_schema_version="1.0",
        repository_commit=repository_commit,
        repository_dirty=repository_dirty,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        simulator_name="metadrive",
        simulator_version="0.4.3",
        simulator_commit="2" * 40,
        scenario_digest="a" * 64,
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name=shield_name,
        shield_version=shield_version,
        shield_config_digest=shield_config_digest,
        gate_config_digest="b" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=100,
        python_version="3.11.15",
        platform="macOS-15",
        architecture="arm64",
    )
    return VerifiedArtifactSnapshot(
        path=Path(path),
        manifest=manifest,
        context=context,
        scenario=ScenarioDefinition.model_construct(
            schema_version="2.0", name="lead_vehicle_hard_brake", version="1.0"
        ),
        gate_config=GateConfig.model_construct(
            schema_version="1.0", name="phase3", version="1.0"
        ),
        events=(TraceEvent.model_construct(latency_source=latency_source),),
        metrics=metrics or _metrics(),
        findings=FindingsDocument(findings=()),
        verdict=GateResult.model_construct(
            gate_name="phase3",
            gate_version="1.0",
            verdict=verdict,
            rationale=(),
            supporting_finding_ids=(),
            hard_failures=hard_failures,
            soft_failures=(),
            residual_limitations=(),
            findings=(),
        ),
    )


def _statuses(result) -> dict[str, ComparisonStatus]:
    return {dimension.name: dimension.status for dimension in result.dimensions}


def test_comparison_reports_direction_without_hiding_tradeoffs() -> None:
    baseline = _snapshot(
        "/artifacts/baseline",
        metrics=_metrics(collision_count=1, minimum_ttc_s=_available(0.5, "s")),
        verdict=Verdict.HOLD,
        hard_failures=("collision.zero",),
    )
    candidate = _snapshot(
        "/artifacts/candidate",
        metrics=_metrics(
            collision_count=0,
            minimum_ttc_s=_available(1.5, "s"),
            route_completion_pct=_available(85.0, "%"),
            acceleration=_available(4.0, "m/s^2"),
            jerk=_available(4.0, "m/s^3"),
            latency=_available(9.0, "ms"),
            override_count=2,
            override_reasons={"TTC_BELOW_THRESHOLD": 2},
        ),
        verdict=Verdict.CONDITIONAL,
    )

    result = compare_artifacts(baseline, candidate)

    assert result.compatibility.comparable is True
    assert _statuses(result) == {
        "verdict": ComparisonStatus.IMPROVED,
        "hard_failures": ComparisonStatus.IMPROVED,
        "collision_count": ComparisonStatus.IMPROVED,
        "minimum_ttc_s": ComparisonStatus.IMPROVED,
        "route_completion_pct": ComparisonStatus.REGRESSED,
        "max_abs_acceleration_mps2": ComparisonStatus.REGRESSED,
        "max_abs_jerk_mps3": ComparisonStatus.UNCHANGED,
        "p95_policy_latency_ms": ComparisonStatus.IMPROVED,
        "policy_latency_source": ComparisonStatus.UNCHANGED,
        "shield_interventions": ComparisonStatus.NOT_COMPARABLE,
        "evidence_availability": ComparisonStatus.UNCHANGED,
    }
    intervention = next(
        dimension for dimension in result.dimensions if dimension.name == "shield_interventions"
    )
    assert intervention.candidate_value == {
        "count": 2,
        "reasons": {"TTC_BELOW_THRESHOLD": 2},
    }
    assert "descriptive" in intervention.explanation.lower()
    assert result.model_dump(mode="json")["baseline_path"] == "/artifacts/baseline"


def test_hard_failure_replacement_is_not_ranked_by_count() -> None:
    baseline = _snapshot("/baseline", verdict=Verdict.HOLD, hard_failures=("collision.zero",))
    candidate = _snapshot(
        "/candidate",
        verdict=Verdict.HOLD,
        hard_failures=("boundary.within_tolerance",),
    )

    result = compare_artifacts(baseline, candidate)

    hard_failures = next(
        dimension for dimension in result.dimensions if dimension.name == "hard_failures"
    )
    assert hard_failures.status is ComparisonStatus.NOT_COMPARABLE
    assert "removed" in hard_failures.explanation
    assert "added" in hard_failures.explanation


def test_missing_measurements_are_never_defaulted_to_zero_or_success() -> None:
    baseline = _snapshot(
        "/baseline",
        metrics=_metrics(
            minimum_ttc_s=_unavailable("no front actor overlap", "s"),
            route_completion_pct=_available(90.0, "%"),
        ),
    )
    candidate = _snapshot(
        "/candidate",
        metrics=_metrics(
            minimum_ttc_s=_available(2.0, "s"),
            route_completion_pct=_unavailable("route signal unavailable", "%"),
        ),
    )

    result = compare_artifacts(baseline, candidate)

    statuses = _statuses(result)
    assert statuses["minimum_ttc_s"] is ComparisonStatus.NOT_COMPARABLE
    assert statuses["route_completion_pct"] is ComparisonStatus.NOT_COMPARABLE
    assert statuses["evidence_availability"] is ComparisonStatus.NOT_COMPARABLE
    availability = next(
        dimension for dimension in result.dimensions if dimension.name == "evidence_availability"
    )
    assert availability.baseline_value["minimum_ttc_s"] == "NOT_AVAILABLE"
    assert availability.candidate_value["route_completion_pct"] == "NOT_AVAILABLE"


@pytest.mark.parametrize(
    ("baseline_metrics", "candidate_metrics", "expected"),
    [
        (
            _metrics(
                minimum_ttc_s=_unavailable("missing", "s"),
                route_completion_pct=_unavailable("missing", "%"),
            ),
            _metrics(),
            ComparisonStatus.NOT_COMPARABLE,
        ),
        (
            _metrics(),
            _metrics(
                minimum_ttc_s=_unavailable("missing", "s"),
                route_completion_pct=_unavailable("missing", "%"),
            ),
            ComparisonStatus.NOT_COMPARABLE,
        ),
    ],
)
def test_evidence_availability_changes_are_descriptive_not_ordinal(
    baseline_metrics: RunMetrics,
    candidate_metrics: RunMetrics,
    expected: ComparisonStatus,
) -> None:
    result = compare_artifacts(
        _snapshot("/baseline", metrics=baseline_metrics),
        _snapshot("/candidate", metrics=candidate_metrics),
    )

    assert _statuses(result)["evidence_availability"] is expected


@pytest.mark.parametrize(
    ("field_name", "candidate_value", "reason_fragment"),
    [
        ("evidence_schema_version", "2.0", "evidence schema"),
        ("scenario_digest", "f" * 64, "scenario"),
        ("gate_config_digest", "f" * 64, "gate configuration"),
        ("adapter_config_digest", "f" * 64, "adapter"),
        ("policy_version", "2.0", "policy"),
        ("seed", 8, "seed"),
        ("control_frequency_hz", 20, "control frequency"),
        ("horizon_steps", 200, "horizon"),
        ("simulator_commit", "f" * 40, "simulator"),
        ("python_version", "3.11.16", "Python"),
        ("platform", "linux", "platform"),
        ("repository_commit", "f" * 40, "repository commit"),
    ],
)
def test_incompatible_runtime_identity_refuses_metric_comparison(
    field_name: str,
    candidate_value: object,
    reason_fragment: str,
) -> None:
    baseline = _snapshot("/baseline")
    candidate = _snapshot("/candidate")
    candidate = replace(
        candidate,
        manifest=candidate.manifest.model_copy(update={field_name: candidate_value}),
    )

    result = compare_artifacts(baseline, candidate)

    assert result.compatibility.comparable is False
    assert not result.dimensions
    assert any(reason_fragment in reason for reason in result.compatibility.reasons)


def test_repository_provenance_must_be_available_and_dirty_state_warns() -> None:
    missing_commit = compare_artifacts(
        _snapshot("/baseline", repository_commit=None),
        _snapshot("/candidate", repository_commit=None),
    )
    dirty = compare_artifacts(
        _snapshot("/baseline", repository_dirty=True),
        _snapshot("/candidate", repository_dirty=False),
    )

    assert missing_commit.compatibility.comparable is False
    assert any("unavailable" in reason for reason in missing_commit.compatibility.reasons)
    assert dirty.compatibility.comparable is True
    assert any("dirty" in warning for warning in dirty.compatibility.warnings)


def _with_fault_manifest(
    snapshot: VerifiedArtifactSnapshot,
    *,
    digest: str,
) -> VerifiedArtifactSnapshot:
    payload = snapshot.manifest.model_dump()
    payload.update(
        {
            "evidence_schema_version": "2.0",
            "fault_name": "deterministic-faults",
            "fault_version": "1.0",
            "fault_config_digest": digest,
        }
    )
    return replace(
        snapshot,
        manifest=ArtifactManifestV2.model_construct(**payload),
    )


def test_fault_profile_identity_is_required_for_comparison() -> None:
    baseline = _with_fault_manifest(_snapshot("/baseline"), digest="7" * 64)
    same_profile = _with_fault_manifest(_snapshot("/same"), digest="7" * 64)
    different_profile = _with_fault_manifest(_snapshot("/different"), digest="8" * 64)

    comparable = compare_artifacts(baseline, same_profile)
    incompatible = compare_artifacts(baseline, different_profile)

    assert comparable.compatibility.comparable is True
    assert incompatible.compatibility.comparable is False
    assert any(
        "fault configuration digest" in reason
        for reason in incompatible.compatibility.reasons
    )


def test_shield_identity_may_differ_and_interventions_remain_descriptive() -> None:
    baseline = _snapshot("/baseline")
    candidate = _snapshot(
        "/candidate",
        shield_name="deterministic",
        shield_version="1.0",
        shield_config_digest="7" * 64,
    )

    result = compare_artifacts(baseline, candidate)

    assert result.compatibility.comparable is True
    assert _statuses(result)["shield_interventions"] is ComparisonStatus.UNCHANGED


def test_different_latency_sources_are_shown_but_not_ranked() -> None:
    result = compare_artifacts(
        _snapshot("/baseline", latency_source="simulated"),
        _snapshot("/candidate", latency_source="measured"),
    )

    source = next(
        dimension for dimension in result.dimensions if dimension.name == "policy_latency_source"
    )
    assert source.status is ComparisonStatus.NOT_COMPARABLE
    assert source.baseline_value == ["simulated"]
    assert source.candidate_value == ["measured"]
    assert _statuses(result)["p95_policy_latency_ms"] is ComparisonStatus.NOT_COMPARABLE
