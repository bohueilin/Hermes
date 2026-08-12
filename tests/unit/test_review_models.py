from __future__ import annotations

import dataclasses
import math
from copy import deepcopy

import pytest
from pydantic import ValidationError

from hermes.comparison.compare import compare_artifacts
from hermes.domain.enums import EvidenceAvailability, TerminationReason, Verdict
from hermes.domain.models import (
    ArtifactManifest,
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
from hermes.review import (
    ComparisonEnvelope,
    LocatorInfo,
    ReviewCacheKey,
    ReviewEnvelope,
    ReviewUnavailableError,
    ReviewUnavailableReason,
    canonical_envelope_bytes,
)
from hermes.review.models import (
    ActionValue,
    AuthenticatedOrigin,
    AvailabilityDelta,
    AvailabilityMapValue,
    ChartSeries,
    ClauseExpression,
    ComparisonStringListValue,
    DiagnosticItem,
    DimensionDelta,
    ExactValue,
    GateConsequence,
    GroupExpression,
    HardFailureDelta,
    InterventionValue,
    InvariantExpression,
    MeasurementDeltaValue,
    MetricItem,
    ObservationValue,
    Point,
    PortableArtifactIdentity,
    RecordedProvenance,
    ScalarDeltaValue,
    ScalarMetricValue,
    SideReference,
    SourceReference,
    StringCountMapMetricValue,
    StringListValue,
    SufficiencyItem,
    ThresholdClause,
    Timeline,
    ToolInfo,
    Track,
    TrustInfo,
    TrustRecord,
)

SHA = "a" * 64
FILES = (
    "manifest.json",
    "execution-context.json",
    "scenario.resolved.yaml",
    "gate-config.resolved.yaml",
    "events.jsonl",
    "metrics.json",
    "findings.json",
    "verdict.json",
    "trace.sha256",
    "bundle.sha256",
)
FINDINGS = (
    "trace.integrity",
    "collision.zero",
    "boundary.within_tolerance",
    "progress.required",
    "comfort.acceleration",
    "comfort.jerk",
    "fault.coverage.required",
)
METRICS_V1 = (
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
)
METRICS_V2 = METRICS_V1 + (
    "fault_application_counts",
    "max_observation_age_s",
    "p95_control_latency_ms",
    "control_fill_count",
    "steering_saturation_count",
    "brake_saturation_count",
)
TRACKS = (
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
METRIC_META = {
    "event_count": ("events", "DESCRIPTIVE", "SCALAR"),
    "simulation_duration_s": ("s", "DESCRIPTIVE", "SCALAR"),
    "collision_count": ("collisions", "LOWER", "SCALAR"),
    "max_abs_lateral_offset_m": ("m", "LOWER", "SCALAR"),
    "offroad_duration_s": ("s", "LOWER", "SCALAR"),
    "route_completion_pct": ("%", "HIGHER", "SCALAR"),
    "minimum_ttc_s": ("s", "HIGHER", "SCALAR"),
    "max_abs_acceleration_mps2": ("m/s^2", "LOWER", "SCALAR"),
    "max_abs_jerk_mps3": ("m/s^3", "LOWER", "SCALAR"),
    "p95_policy_latency_ms": ("ms", "LOWER", "SCALAR"),
    "shield_override_count": ("overrides", "DESCRIPTIVE", "SCALAR"),
    "shield_override_reasons": ("occurrences", "DESCRIPTIVE", "STRING_COUNT_MAP"),
    "termination_reason": (None, "DESCRIPTIVE", "SCALAR"),
    "fault_application_counts": ("occurrences", "DESCRIPTIVE", "STRING_COUNT_MAP"),
    "max_observation_age_s": ("s", "LOWER", "SCALAR"),
    "p95_control_latency_ms": ("ms", "LOWER", "SCALAR"),
    "control_fill_count": ("events", "DESCRIPTIVE", "SCALAR"),
    "steering_saturation_count": ("events", "LOWER", "SCALAR"),
    "brake_saturation_count": ("events", "LOWER", "SCALAR"),
}
TRACK_META = {
    "raw_observation": ("OBSERVATION", "OBSERVED"),
    "delivered_observation": ("OBSERVATION", "OBSERVED"),
    "result_observation": ("OBSERVATION", "OBSERVED"),
    "candidate_action": ("ACTION", "OBSERVED"),
    "permitted_action": ("ACTION", "OBSERVED"),
    "executed_action": ("ACTION", "OBSERVED"),
    "override_reasons": ("STRING_LIST", "OBSERVED"),
    "observation_fault_reasons": ("STRING_LIST", "OBSERVED"),
    "control_fault_reasons": ("STRING_LIST", "OBSERVED"),
    "collision_count": ("SCALAR", "OBSERVED"),
    "offroad": ("SCALAR", "OBSERVED"),
    "speed_mps": ("SCALAR", "OBSERVED"),
    "route_progress_pct": ("SCALAR", "OBSERVED"),
    "ttc_s": ("SCALAR", "COMPUTED"),
    "policy_latency_ms": ("SCALAR", "OBSERVED"),
    "verifier_triggering_findings": ("STRING_LIST", "COMPUTED"),
}


def _source(source_type: str = "EVENT", *, sequence: int | None = 0) -> dict[str, object]:
    mapping = {
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
    return {
        "source_type": source_type,
        "file_name": mapping[source_type],
        "json_pointer": "/0" if source_type == "EVENT" else "",
        "event_sequence": sequence if source_type == "EVENT" else None,
    }


def _ref(source_type: str, pointer: str, *, sequence: int | None = None) -> dict[str, object]:
    return {**_source(source_type, sequence=sequence), "json_pointer": pointer}


def _exact(value: object = 0, unit: str | None = None) -> dict[str, object]:
    return {
        "machine_value": value,
        "canonical_text": None if value is None else str(value),
        "display_text": "NOT_AVAILABLE" if value is None else str(value),
        "unit": unit,
    }


def _consequence() -> dict[str, object]:
    return {
        "triggered": False,
        "effect": "NO_EFFECT",
        "result_if_controlling": None,
        "source": "FIXED_GATE_PRECEDENCE",
        "listed_in_hard_failures": False,
        "listed_in_soft_failures": False,
        "listed_in_supporting_findings": True,
        "configuration_references": (),
    }


def _clause(
    left: str = "collision_count",
    transforms: tuple[str, ...] = ("MAX_OVER_EVENTS",),
    operator: str = "LTE",
    *,
    right: dict[str, object] | None = None,
    configuration: tuple[dict[str, object], ...] = (),
    evidence: tuple[dict[str, object], ...] = (),
    label: str | None = None,
) -> dict[str, object]:
    return {
        "kind": "CLAUSE",
        "label": label or left,
        "clause": {
            "left_operand": left,
            "transforms": transforms,
            "operator": operator,
            "right_operand": (
                None if operator in {"IS_TRUE", "IS_FALSE"} else right or _exact(0, None)
            ),
            "configuration_sources": configuration,
            "evidence_sources": evidence,
        },
        "children": (),
        "invariant": None,
    }


def _invariant(operator: str = "COMPLETE") -> dict[str, object]:
    trace = operator == "COMPLETE"
    return {
        "kind": "INVARIANT",
        "label": (
            "Complete trace sequence and digest chain"
            if trace
            else "All configured faults are observed"
        ),
        "clause": None,
        "children": (),
        "invariant": {
            "operator": operator,
            "configuration_sources": (
                (_ref("SCENARIO", "/control/horizon_steps"),)
                if trace
                else (_ref("SCENARIO", "/faults"),)
            ),
            "evidence_sources": (_ref("TRACE_DIGEST", ""),) if trace else (),
        },
    }


def _threshold(finding_id: str) -> dict[str, object]:
    if finding_id == "trace.integrity":
        return _invariant()
    if finding_id == "fault.coverage.required":
        return _invariant("ALL_OBSERVED")
    if finding_id == "boundary.within_tolerance":
        children = (
            _clause(
                "lateral_offset_m",
                ("ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
                right=_exact(1.0, "m"),
                configuration=(
                    _ref("SCENARIO", "/road/boundary_tolerance_m"),
                    _ref("GATE_CONFIG", "/hard/max_abs_lateral_offset_m"),
                ),
                label="Maximum absolute lateral offset",
            ),
            _clause(
                "offroad",
                ("ALL_EVENTS",),
                "IS_FALSE",
                label="No event is off-road",
            ),
            _clause(
                "offroad",
                ("DURATION_TRUE",),
                right=_exact(0.0, "s"),
                configuration=(_ref("GATE_CONFIG", "/hard/max_offroad_duration_s"),),
                evidence=(_ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),),
                label="Maximum off-road duration",
            ),
        )
        return {
            "kind": "ALL_OF",
            "label": "Boundary and off-road limits",
            "clause": None,
            "children": children,
            "invariant": None,
        }
    if finding_id == "progress.required":
        return {
            "kind": "ALL_OF",
            "label": "Destination and route progress requirements",
            "clause": None,
            "children": (
                _clause(
                    "destination_reached",
                    ("FINAL_EVENT",),
                    "IS_TRUE",
                    label="Destination reached at final event",
                ),
                _clause(
                    "route_completion_pct",
                    ("MAX_OVER_EVENTS",),
                    "GTE",
                    right=_exact(95.0, "%"),
                    configuration=(_ref("GATE_CONFIG", "/hard/min_route_completion_pct"),),
                    evidence=(_ref("METRIC", "/route_completion_pct"),),
                    label="Minimum route completion",
                ),
            ),
            "invariant": None,
        }
    if finding_id == "comfort.acceleration":
        return _clause(
            "acceleration_mps2",
            ("ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
            right=_exact(4.0, "m/s^2"),
            configuration=(_ref("GATE_CONFIG", "/soft/max_abs_acceleration_mps2"),),
            label="Maximum absolute acceleration",
        )
    if finding_id == "comfort.jerk":
        return _clause(
            "acceleration_mps2",
            ("FINITE_DIFFERENCE", "ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
            right=_exact(10.0, "m/s^3"),
            configuration=(_ref("GATE_CONFIG", "/soft/max_abs_jerk_mps3"),),
            evidence=(_ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),),
            label="Maximum absolute jerk",
        )
    return _clause(
        right=_exact(0, "count"),
        configuration=(_ref("GATE_CONFIG", "/hard/max_collision_count"),),
        label="Maximum collision count",
    )


def _artifact(schema: str = "2.0", *, path: str = "candidate") -> dict[str, object]:
    inventory = tuple(
        {
            "file": {"file_name": name, "size_bytes": index, "category": "OBSERVED"},
            "observed_sha256": {
                "algorithm": "SHA-256",
                "value": f"{index:x}" * 64,
                "category": "COMPUTED",
            },
        }
        for index, name in enumerate(FILES)
    )
    return {
        "locator": {
            "selected_relative_path": path,
            "selected_directory_name": path.rsplit("/", 1)[-1],
            "category": "OBSERVED",
        },
        "manifest_identity": {
            "run_id": "run-1",
            "created_at_utc": "2026-08-12T00:00:00Z",
            "evidence_schema_version": schema,
            "scenario_schema_version": "3.0",
            "category": "OBSERVED",
        },
        "observed_bundle_digest": {
            "algorithm": "SHA-256",
            "value": "b" * 64,
            "semantic": "OBSERVED_CLAIM",
            "category": "OBSERVED",
        },
        "computed_bundle_digest": {
            "algorithm": "SHA-256",
            "value": "c" * 64,
            "semantic": "COMPUTED_FROM_CAPTURE",
            "category": "COMPUTED",
        },
        "observed_trace_digest": {
            "algorithm": "SHA-256",
            "value": "d" * 64,
            "semantic": "OBSERVED_CLAIM",
            "category": "OBSERVED",
        },
        "computed_trace_digest": {
            "algorithm": "SHA-256",
            "value": "e" * 64,
            "semantic": "COMPUTED_FROM_EVENTS",
            "category": "COMPUTED",
        },
        "source_inventory": inventory,
    }


def _metrics(schema: str = "2.0") -> tuple[dict[str, object], ...]:
    ids = METRICS_V1 if schema == "1.0" else METRICS_V2
    result = []
    for metric_id in ids:
        unit, direction, kind = METRIC_META[metric_id]
        value: dict[str, object]
        if kind == "STRING_COUNT_MAP":
            value = {"kind": kind, "values": {}}
        else:
            scalar: object = "HORIZON" if metric_id == "termination_reason" else 0
            value = {"kind": kind, "value": _exact(scalar, unit)}
        result.append(
            {
                "metric_id": metric_id,
                "label": metric_id,
                "category": "COMPUTED",
                "value": value,
                "availability": "AVAILABLE",
                "unavailable_reason": None,
                "desired_direction": direction,
                "source_references": (
                    {
                        **_source("METRIC", sequence=None),
                        "json_pointer": f"/{metric_id}",
                    },
                    *(
                        (_ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),)
                        if metric_id in {"offroad_duration_s", "max_abs_jerk_mps3"}
                        else ()
                    ),
                ),
            }
        )
    return tuple(result)


def _tracks(schema: str = "2.0") -> tuple[dict[str, object], ...]:
    legacy_unavailable = {
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "permitted_action",
        "observation_fault_reasons",
        "control_fault_reasons",
    }
    result = []
    for track_id in TRACKS:
        kind, category = TRACK_META[track_id]
        unavailable = schema == "1.0" and track_id in legacy_unavailable
        result.append(
            {
                "track_id": track_id,
                "label": track_id,
                "category": "NOT_AVAILABLE" if unavailable else category,
                "availability": "NOT_AVAILABLE" if unavailable else "AVAILABLE",
                "unavailable_reason": "not present in schema 1" if unavailable else None,
                "value_kind": kind,
                "points": (),
                "source_references": (),
            }
        )
    return tuple(result)


def _accepted_provenance() -> dict[str, object]:
    return {
        "status": "ACCEPTED",
        "category": "OBSERVED",
        "source_references": (_source("MANIFEST", sequence=None),),
        "hermes_version": "0.1.0",
        "hermes_git_commit": "1" * 40,
        "hermes_git_dirty": False,
        "repository_provenance_reason": None,
        "adapter_name": "fake",
        "adapter_version": "1.0",
        "adapter_config_digest": SHA,
        "simulator_name": None,
        "simulator_version": None,
        "simulator_commit": None,
        "policy_name": "baseline",
        "policy_version": "1.0",
        "policy_config_digest": SHA,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": SHA,
        "fault_name": "faults",
        "fault_version": "1.0",
        "fault_config_digest": SHA,
        "gate_name": "phase5",
        "gate_version": "1.0",
        "gate_config_digest": SHA,
        "scenario_name": "nominal",
        "scenario_version": "1.0",
        "scenario_schema_version": "3.0",
        "scenario_digest": SHA,
        "python_version": "3.11",
        "platform": "darwin",
        "architecture": "arm64",
    }


def _trust() -> dict[str, object]:
    rows = (
        ("authenticity", "NOT_AUTHENTICATED", "AUTHENTICITY"),
        ("authorization", "NOT_EVALUATED", "ASSUMPTION"),
        ("deployment_permission", "NONE", "RESIDUAL_RISK"),
        ("scope", "SIMULATION_ONLY", "ASSUMPTION"),
        ("authoritative_status", "NOT_DEFINED", "ASSUMPTION"),
    )
    return {
        "records": tuple(
            {"dimension": dimension, "value": value, "category": category, "explanation": value}
            for dimension, value, category in rows
        )
    }


def _review_payload(schema: str = "2.0") -> dict[str, object]:
    profile = "legacy" if schema == "1.0" else "fault_coverage"
    finding_ids = FINDINGS[:6] if profile == "legacy" else FINDINGS
    findings = tuple(
        {
            "finding_id": finding_id,
            "verifier_name": "verifier",
            "verifier_version": "1.0",
            "label": finding_id,
            "explanation": "passed",
            "category": "COMPUTED",
            "status": "PASS",
            "severity": "INFO",
            "hard_invariant": finding_id in FINDINGS[:4],
            "measured": _exact(0, None),
            "threshold": _threshold(finding_id),
            "threshold_source_text": "verified threshold",
            "first_failure_simulation_time_s": None,
            "supporting_event_sequences": (),
            "evidence_availability": "AVAILABLE",
            "requiredness": "OPTIONAL" if finding_id.startswith("comfort.") else "REQUIRED",
            "consequence": _consequence(),
            "source_references": (),
        }
        for finding_id in finding_ids
    )
    sufficiency_items = []
    for finding_id in FINDINGS:
        not_applicable = profile == "legacy" and finding_id == "fault.coverage.required"
        requirement = (
            "NOT_APPLICABLE"
            if not_applicable
            else "OPTIONAL"
            if finding_id.startswith("comfort.")
            else "REQUIRED"
        )
        consequence = _consequence()
        if not_applicable:
            consequence = {
                **consequence,
                "source": "PROFILE_NOT_APPLICABLE",
                "listed_in_supporting_findings": False,
            }
        sufficiency_items.append(
            {
                "evidence_id": finding_id,
                "label": finding_id,
                "requirement": requirement,
                "availability": "NOT_APPLICABLE" if not_applicable else "AVAILABLE",
                "reason": "not part of the legacy verifier profile" if not_applicable else None,
                "consequence": consequence,
                "category": "NOT_AVAILABLE" if not_applicable else "COMPUTED",
                "source_references": (),
            }
        )
    return {
        "review_schema_version": "1.0",
        "tool": {
            "hermes_distribution": "hermes-autonomy",
            "hermes_version": "0.1.0",
            "review_schema_version": "1.0",
            "category": "COMPUTED",
        },
        "artifact": _artifact(schema),
        "verification": {
            "integrity": "INTERNALLY_CONSISTENT",
            "verified_by": "hermes.evidence.verification",
            "errors": (),
            "first_mismatch_sequence": None,
            "stored_claims_quarantined": False,
            "category": "COMPUTED",
        },
        "trust": _trust(),
        "gate": {
            "verdict": "PASS",
            "category": "GATE_DECISION",
            "accepted_recomputation": True,
            "gate_name": "phase5",
            "gate_version": "1.0",
            "gate_config_digest_sha256": SHA,
            "rationale": ("all requirements passed",),
            "hard_failure_ids": (),
            "soft_failure_ids": (),
            "supporting_finding_ids": finding_ids,
            "residual_limitation_ids": ("simulation-only",),
        },
        "evidence_sufficiency": {
            "profile_name": profile,
            "profile_version": "1.0",
            "summary": {
                "required_and_available": 4 if profile == "legacy" else 5,
                "required_but_unavailable": 0,
                "optional_and_available": 2,
                "optional_and_unavailable": 0,
                "not_applicable": 1 if profile == "legacy" else 0,
            },
            "items": tuple(sufficiency_items),
            "category": "COMPUTED",
        },
        "findings": findings,
        "metrics": _metrics(schema),
        "timeline": {
            "event_count": 0,
            "simulation_start_s": None,
            "simulation_end_s": None,
            "tracks": _tracks(schema),
            "category": "OBSERVED",
        },
        "provenance": {
            "recorded": _accepted_provenance(),
            "authenticated_origin": {
                "status": "NOT_AUTHENTICATED",
                "signer_id": None,
                "signature_id": None,
                "category": "AUTHENTICITY",
            },
        },
        "diagnostics": (),
        "assumptions": (),
        "unavailable_evidence": (),
        "residual_limitations": (
            {
                "id": "simulation-only",
                "text": "simulation only",
                "impact": "no deployment permission",
                "category": "RESIDUAL_RISK",
                "source_references": (),
            },
        ),
    }


def _invalid_review_payload() -> dict[str, object]:
    payload = _review_payload()
    nullable_provenance = {
        key: None
        for key in _accepted_provenance()
        if key not in {"status", "category", "source_references"}
    }
    payload["verification"] = {
        "integrity": "INVALID_EVIDENCE",
        "verified_by": "hermes.evidence.verification",
        "errors": (
            {
                "id": "digest-mismatch",
                "code": "DIGEST_MISMATCH",
                "text": "stored digest mismatch",
                "impact": "stored claims quarantined",
                "category": "COMPUTED",
                "source_references": (),
            },
        ),
        "first_mismatch_sequence": None,
        "stored_claims_quarantined": True,
        "category": "COMPUTED",
    }
    payload["gate"] = {
        "verdict": "INVALID_EVIDENCE",
        "category": "GATE_DECISION",
        "accepted_recomputation": False,
        "gate_name": None,
        "gate_version": None,
        "gate_config_digest_sha256": None,
        "rationale": (),
        "hard_failure_ids": (),
        "soft_failure_ids": (),
        "supporting_finding_ids": (),
        "residual_limitation_ids": (),
    }
    payload["evidence_sufficiency"] = {
        "profile_name": None,
        "profile_version": None,
        "summary": {
            "required_and_available": 0,
            "required_but_unavailable": 0,
            "optional_and_available": 0,
            "optional_and_unavailable": 0,
            "not_applicable": 0,
        },
        "items": (),
        "category": "COMPUTED",
    }
    payload["findings"] = ()
    payload["metrics"] = ()
    payload["timeline"] = {
        "event_count": 0,
        "simulation_start_s": None,
        "simulation_end_s": None,
        "tracks": (),
        "category": "OBSERVED",
    }
    payload["provenance"] = {
        "recorded": {
            "status": "QUARANTINED",
            "category": "NOT_AVAILABLE",
            "source_references": (),
            **nullable_provenance,
        },
        "authenticated_origin": {
            "status": "NOT_AUTHENTICATED",
            "signer_id": None,
            "signature_id": None,
            "category": "AUTHENTICITY",
        },
    }
    return payload


def _side(side: str, path: str) -> dict[str, object]:
    return {
        "side": side,
        "artifact": _artifact(path=path),
        "integrity": "INTERNALLY_CONSISTENT",
        "gate_verdict": "PASS",
        "category": "COMPUTED",
        "source_references": ({"side": side, "reference": _source("VERDICT", sequence=None)},),
    }


def _scalar_delta(dimension_id: str, status: str = "UNCHANGED") -> dict[str, object]:
    return {
        "dimension_id": dimension_id,
        "status": status,
        "baseline_value": {"kind": "SCALAR", "value": _exact("PASS")},
        "candidate_value": {"kind": "SCALAR", "value": _exact("PASS")},
        "unit": None,
        "explanation": "unchanged",
        "desired_direction": "NONE",
        "category": "COMPUTED",
        "source_references": (
            {"side": "BASELINE", "reference": _source("VERDICT", sequence=None)},
            {"side": "CANDIDATE", "reference": _source("VERDICT", sequence=None)},
        ),
    }


def _measurement_delta(dimension_id: str) -> dict[str, object]:
    return {
        "dimension_id": dimension_id,
        "status": "UNCHANGED",
        "baseline_value": {
            "kind": "MEASUREMENT",
            "availability": "AVAILABLE",
            "value": 1.0,
            "reason": None,
        },
        "candidate_value": {
            "kind": "MEASUREMENT",
            "availability": "AVAILABLE",
            "value": 1.0,
            "reason": None,
        },
        "unit": "s",
        "explanation": "unchanged",
        "desired_direction": "HIGHER",
        "category": "COMPUTED",
        "source_references": (),
    }


def _comparison_payload(*, compatible: bool = True) -> dict[str, object]:
    if not compatible:
        return {
            "comparison_schema_version": "1.0",
            "tool": _review_payload()["tool"],
            "baseline": _side("BASELINE", "baseline"),
            "candidate": _side("CANDIDATE", "candidate"),
            "compatibility": {
                "status": "INCOMPATIBLE",
                "reasons": ("scenario differs",),
                "warnings": (),
                "category": "COMPUTED",
            },
            "verdict_delta": None,
            "hard_failure_delta": None,
            "availability_summary_delta": None,
            "improvements": (),
            "regressions": (),
            "unchanged_outcomes": (),
            "not_comparable": (),
            "availability_deltas": (),
            "chart_series": (),
            "residual_limitations": (),
        }
    unchanged = (
        {
            **_scalar_delta("collision_count"),
            "baseline_value": {"kind": "SCALAR", "value": _exact(0, "collisions")},
            "candidate_value": {"kind": "SCALAR", "value": _exact(0, "collisions")},
            "unit": "collisions",
            "desired_direction": "LOWER",
        },
        _measurement_delta("minimum_ttc_s"),
        {**_measurement_delta("route_completion_pct"), "unit": "%"},
        {
            **_measurement_delta("max_abs_acceleration_mps2"),
            "unit": "m/s^2",
            "desired_direction": "LOWER",
        },
        {**_measurement_delta("max_abs_jerk_mps3"), "unit": "m/s^3", "desired_direction": "LOWER"},
        {**_measurement_delta("p95_policy_latency_ms"), "unit": "ms", "desired_direction": "LOWER"},
        {
            "dimension_id": "policy_latency_source",
            "status": "UNCHANGED",
            "baseline_value": {"kind": "STRING_LIST", "values": ("simulated",)},
            "candidate_value": {"kind": "STRING_LIST", "values": ("simulated",)},
            "unit": None,
            "explanation": "hard-failure set is unchanged",
            "desired_direction": "DESCRIPTIVE",
            "category": "COMPUTED",
            "source_references": (),
        },
        {
            "dimension_id": "shield_interventions",
            "status": "UNCHANGED",
            "baseline_value": {"kind": "INTERVENTION", "count": 0, "reasons": {}},
            "candidate_value": {"kind": "INTERVENTION", "count": 0, "reasons": {}},
            "unit": "interventions",
            "explanation": "descriptive",
            "desired_direction": "DESCRIPTIVE",
            "category": "COMPUTED",
            "source_references": (),
        },
    )
    return {
        "comparison_schema_version": "1.0",
        "tool": _review_payload()["tool"],
        "baseline": _side("BASELINE", "baseline"),
        "candidate": _side("CANDIDATE", "candidate"),
        "compatibility": {
            "status": "COMPATIBLE",
            "reasons": (),
            "warnings": (),
            "category": "COMPUTED",
        },
        "verdict_delta": _scalar_delta("verdict"),
        "hard_failure_delta": {
            "status": "UNCHANGED",
            "baseline_ids": (),
            "candidate_ids": (),
            "removed_ids": (),
            "added_ids": (),
            "explanation": "hard-failure set is unchanged",
            "category": "COMPUTED",
            "source_references": (),
        },
        "availability_summary_delta": {
            "dimension_id": "evidence_availability",
            "status": "UNCHANGED",
            "baseline_value": {
                "kind": "AVAILABILITY_MAP",
                "values": {
                    "minimum_ttc_s": "AVAILABLE",
                    "route_completion_pct": "AVAILABLE",
                    "max_abs_acceleration_mps2": "AVAILABLE",
                    "max_abs_jerk_mps3": "AVAILABLE",
                    "p95_policy_latency_ms": "AVAILABLE",
                },
            },
            "candidate_value": {
                "kind": "AVAILABILITY_MAP",
                "values": {
                    "minimum_ttc_s": "AVAILABLE",
                    "route_completion_pct": "AVAILABLE",
                    "max_abs_acceleration_mps2": "AVAILABLE",
                    "max_abs_jerk_mps3": "AVAILABLE",
                    "p95_policy_latency_ms": "AVAILABLE",
                },
            },
            "unit": None,
            "explanation": "unchanged",
            "desired_direction": "NONE",
            "category": "COMPUTED",
            "source_references": (),
        },
        "improvements": (),
        "regressions": (),
        "unchanged_outcomes": unchanged,
        "not_comparable": (),
        "availability_deltas": (),
        "chart_series": tuple(
            {
                "dimension_id": item["dimension_id"],
                "baseline_numeric_value": (
                    item["baseline_value"]["value"]["machine_value"]
                    if item["baseline_value"]["kind"] == "SCALAR"
                    else item["baseline_value"]["value"]
                ),
                "candidate_numeric_value": (
                    item["candidate_value"]["value"]["machine_value"]
                    if item["candidate_value"]["kind"] == "SCALAR"
                    else item["candidate_value"]["value"]
                ),
                "unit": item["unit"],
                "category": "COMPUTED",
                "source_references": item["source_references"],
            }
            for item in unchanged[:6]
        ),
        "residual_limitations": (),
    }


def _core_comparison_snapshot(path: str, *, latency_source: str = "simulated"):
    def available(value: float, unit: str) -> Measurement:
        return Measurement(
            availability=EvidenceAvailability.AVAILABLE,
            value=value,
            unit=unit,
        )

    metrics = RunMetrics(
        event_count=1,
        simulation_duration_s=0.0,
        collision_count=0,
        max_abs_lateral_offset_m=0.0,
        offroad_duration_s=0.0,
        route_completion_pct=available(100.0, "%"),
        minimum_ttc_s=available(1.0, "s"),
        max_abs_acceleration_mps2=available(0.0, "m/s^2"),
        max_abs_jerk_mps3=available(0.0, "m/s^3"),
        p95_policy_latency_ms=available(10.0, "ms"),
        shield_override_count=0,
        shield_override_reasons={},
        termination_reason=TerminationReason.DESTINATION_REACHED,
    )
    context = RunContext.model_construct(
        scenario_digest="1" * 64,
        gate_config_digest="2" * 64,
        adapter_name="fake",
        adapter_version="1.0",
        adapter_config_digest="3" * 64,
        policy_name="baseline",
        policy_version="1.0",
        policy_config_digest="4" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="5" * 64,
        verifier_suite_digest="6" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=1,
    )
    return VerifiedArtifactSnapshot(
        path=path,
        manifest=ArtifactManifest.model_construct(
            evidence_schema_version="1.0",
            repository_commit="7" * 40,
            repository_dirty=False,
            adapter_name="fake",
            adapter_version="1.0",
            adapter_config_digest="3" * 64,
            simulator_name=None,
            simulator_version=None,
            simulator_commit=None,
            scenario_digest="1" * 64,
            policy_name="baseline",
            policy_version="1.0",
            policy_config_digest="4" * 64,
            shield_name="noop",
            shield_version="1.0",
            shield_config_digest="5" * 64,
            gate_config_digest="2" * 64,
            seed=7,
            control_frequency_hz=10,
            horizon_steps=1,
            python_version="3.11",
            platform="darwin",
            architecture="arm64",
        ),
        context=ExecutionContext.model_construct(
            run_context=context,
            adapter=ComponentContext.model_construct(
                name="fake", version="1.0", config={}, config_digest="3" * 64
            ),
            policy=ComponentContext.model_construct(
                name="baseline", version="1.0", config={}, config_digest="4" * 64
            ),
            shield=ComponentContext.model_construct(
                name="noop", version="1.0", config={}, config_digest="5" * 64
            ),
            verifier_suite=(),
        ),
        scenario=ScenarioDefinition.model_construct(
            schema_version="1.0", name="nominal", version="1.0"
        ),
        gate_config=GateConfig.model_construct(schema_version="1.0", name="phase1", version="1.0"),
        events=(TraceEvent.model_construct(latency_source=latency_source),),
        metrics=metrics,
        findings=FindingsDocument(findings=()),
        verdict=GateResult.model_construct(verdict=Verdict.PASS, hard_failures=()),
    )


def test_models_are_strict_frozen_finite_and_forbid_unknown_fields() -> None:
    tool = ToolInfo(
        hermes_distribution="hermes-autonomy",
        hermes_version="0.1.0",
        review_schema_version="1.0",
        category="COMPUTED",
    )
    with pytest.raises(ValidationError):
        ToolInfo.model_validate({**tool.model_dump(), "unexpected": True})
    with pytest.raises(ValidationError):
        ToolInfo.model_validate({**tool.model_dump(), "hermes_version": 1})
    with pytest.raises(ValidationError):
        ActionValue(steering=math.inf, throttle=0.0, brake=0.0)
    with pytest.raises(ValidationError):
        tool.hermes_version = "changed"


def test_runtime_cache_key_and_unavailable_error_have_exact_stable_api() -> None:
    key = ReviewCacheKey(SHA, "1.0", "0.1.0", "runs/candidate")
    assert dataclasses.fields(key)[0].name == "computed_bundle_digest_sha256"
    assert key.as_tuple() == (SHA, "1.0", "0.1.0", "runs/candidate")
    with pytest.raises((TypeError, ValueError)):
        ReviewCacheKey(SHA, "2.0", "0.1.0", "runs/candidate")  # type: ignore[arg-type]
    with pytest.raises((TypeError, ValueError)):
        ReviewCacheKey(SHA, "1.0", "", "/absolute")
    with pytest.raises((TypeError, ValueError)):
        ReviewCacheKey(SHA, "1.0", "0.1.0", "bad\x00path")
    with pytest.raises(ValidationError):
        LocatorInfo(
            selected_relative_path="bad\x00path",
            selected_directory_name="bad\x00path",
            category="OBSERVED",
        )
    error = ReviewUnavailableError(
        ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
        "finding budget exceeded",
    )
    assert error.reason is ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE
    assert str(error) == "finding budget exceeded"


def test_inventory_locator_and_digests_preserve_observed_computed_separation() -> None:
    artifact = PortableArtifactIdentity.model_validate(_artifact())
    assert tuple(item.file.file_name for item in artifact.source_inventory) == FILES
    assert artifact.observed_bundle_digest.category == "OBSERVED"
    assert artifact.computed_bundle_digest.category == "COMPUTED"
    bad = deepcopy(_artifact())
    bad["source_inventory"] = tuple(reversed(bad["source_inventory"]))
    with pytest.raises(ValidationError):
        PortableArtifactIdentity.model_validate(bad)
    bad = deepcopy(_artifact())
    bad["computed_bundle_digest"]["semantic"] = "OBSERVED_CLAIM"
    with pytest.raises(ValidationError):
        PortableArtifactIdentity.model_validate(bad)
    with pytest.raises(ValidationError):
        LocatorInfo(
            selected_relative_path="../escape",
            selected_directory_name="escape",
            category="OBSERVED",
        )


def test_computed_bundle_digest_requires_nine_inputs_not_stored_bundle_claim() -> None:
    payload = _artifact()
    payload["source_inventory"] = payload["source_inventory"][:-1]
    artifact = PortableArtifactIdentity.model_validate(payload)
    assert artifact.computed_bundle_digest is not None
    payload = deepcopy(payload)
    payload["source_inventory"] = payload["source_inventory"][:-1]
    with pytest.raises(ValidationError):
        PortableArtifactIdentity.model_validate(payload)


def test_source_reference_type_relation_rfc6901_order_and_deduplication() -> None:
    event = SourceReference.model_validate(_source())
    assert event.event_sequence == 0
    with pytest.raises(ValidationError):
        SourceReference.model_validate({**_source(), "file_name": "metrics.json"})
    with pytest.raises(ValidationError):
        SourceReference.model_validate({**_source("METRIC", sequence=None), "event_sequence": 1})
    with pytest.raises(ValidationError):
        SourceReference.model_validate({**_source(), "json_pointer": "not/a/pointer"})
    with pytest.raises(ValidationError):
        DiagnosticItem(
            id="bad-order",
            code="ORDER",
            text="bad",
            impact="ambiguous",
            category="COMPUTED",
            source_references=(
                SourceReference.model_validate(_source("METRIC", sequence=None)),
                event,
            ),
        )
    with pytest.raises(ValidationError):
        DiagnosticItem(
            id="duplicate",
            code="DUP",
            text="bad",
            impact="ambiguous",
            category="COMPUTED",
            source_references=(event, event),
        )


def test_exact_action_observation_and_timeline_string_values_are_typed() -> None:
    assert ExactValue(**_exact(False)).machine_value is False
    with pytest.raises(ValidationError):
        ExactValue(**_exact([1, 2]))
    with pytest.raises(ValidationError):
        ActionValue(steering=1.01, throttle=0.0, brake=0.0)
    observation = ObservationValue(
        sequence=0,
        simulation_time_s=0.0,
        position_m=0.0,
        speed_mps=0.0,
        acceleration_mps2=0.0,
        lateral_offset_m=0.0,
        route_progress_pct=0.0,
        collision_count=0,
        offroad=False,
        destination_reached=False,
        front_distance_m=None,
        front_relative_speed_mps=None,
        observation_age_s=0.0,
        challenge_actor_longitudinal_m=None,
        challenge_actor_lateral_offset_m=None,
        challenge_actor_speed_mps=None,
        challenge_phase=None,
    )
    assert observation.sequence == 0
    with pytest.raises(ValidationError):
        StringListValue(values=("DUP", "DUP"))


def test_all_threshold_expression_variants_and_operand_rules() -> None:
    assert ClauseExpression.model_validate(_clause()).kind == "CLAUSE"
    assert (
        GroupExpression.model_validate(
            {
                "kind": "ANY_OF",
                "label": "either",
                "clause": None,
                "children": (_clause(),),
                "invariant": None,
            }
        ).kind
        == "ANY_OF"
    )
    assert InvariantExpression.model_validate(_invariant()).kind == "INVARIANT"
    with pytest.raises(ValidationError):
        ThresholdClause(
            left_operand="offroad",
            transforms=("ALL_EVENTS",),
            operator="IS_FALSE",
            right_operand=ExactValue(**_exact(False)),
            configuration_sources=(),
            evidence_sources=(),
        )
    with pytest.raises(ValidationError):
        GroupExpression(
            kind="ALL_OF",
            label="empty",
            clause=None,
            children=(),
            invariant=None,
        )


def test_trust_records_are_exactly_once_and_in_frozen_order() -> None:
    trust = TrustInfo.model_validate(_trust())
    assert tuple(record.dimension for record in trust.records) == (
        "authenticity",
        "authorization",
        "deployment_permission",
        "scope",
        "authoritative_status",
    )
    bad = deepcopy(_trust())
    bad["records"] = tuple(reversed(bad["records"]))
    with pytest.raises(ValidationError):
        TrustInfo.model_validate(bad)
    with pytest.raises(ValidationError):
        TrustRecord(
            dimension="authenticity",
            value="NOT_AUTHENTICATED",
            category="ASSUMPTION",
            explanation="wrong category",
        )


def test_gate_consequence_and_sufficiency_reject_false_unavailability() -> None:
    consequence = GateConsequence.model_validate(_consequence())
    assert consequence.result_if_controlling is None
    with pytest.raises(ValidationError):
        GateConsequence.model_validate(
            {**_consequence(), "effect": "HOLD", "result_if_controlling": None}
        )
    with pytest.raises(ValidationError):
        SufficiencyItem(
            evidence_id="route-progress",
            label="Route progress",
            requirement="REQUIRED",
            availability="NOT_AVAILABLE",
            reason=None,
            consequence=consequence,
            category="NOT_AVAILABLE",
            source_references=(),
        )
    not_applicable = SufficiencyItem(
        evidence_id="fault.coverage.required",
        label="Fault coverage",
        requirement="NOT_APPLICABLE",
        availability="NOT_APPLICABLE",
        reason="not part of the legacy verifier profile",
        consequence=GateConsequence.model_validate(
            {**_consequence(), "source": "PROFILE_NOT_APPLICABLE"}
        ),
        category="NOT_AVAILABLE",
        source_references=(),
    )
    assert not_applicable.category == "NOT_AVAILABLE"
    with pytest.raises(ValidationError):
        SufficiencyItem(
            evidence_id="legacy",
            label="Legacy",
            requirement="NOT_APPLICABLE",
            availability="AVAILABLE",
            reason=None,
            consequence=consequence,
            category="COMPUTED",
            source_references=(),
        )


def test_finding_unavailability_requires_null_measurement_and_consistent_status() -> None:
    finding = deepcopy(_review_payload()["findings"][0])
    finding.update(
        category="NOT_AVAILABLE",
        status="NOT_AVAILABLE",
        evidence_availability="NOT_AVAILABLE",
        measured=_exact(None, "count"),
        explanation="missing evidence",
        consequence={
            **_consequence(),
            "triggered": True,
            "effect": "INVALID_EVIDENCE",
            "result_if_controlling": "INVALID_EVIDENCE",
        },
    )
    assert (
        ReviewEnvelope.model_validate(
            {
                **_invalid_review_payload(),
                "verification": _review_payload()["verification"],
            }
        )
        if False
        else finding["measured"]["machine_value"] is None
    )
    from hermes.review.models import FindingItem

    assert FindingItem.model_validate(finding).status == "NOT_AVAILABLE"
    finding["measured"] = _exact(0, "count")
    with pytest.raises(ValidationError):
        FindingItem.model_validate(finding)


def test_metric_value_variants_enforce_sorted_maps_units_registry_and_unavailability() -> None:
    assert ScalarMetricValue(kind="SCALAR", value=ExactValue(**_exact(1, "s"))).kind == "SCALAR"
    assert StringCountMapMetricValue(kind="STRING_COUNT_MAP", values={}).values == {}
    with pytest.raises(ValidationError):
        StringCountMapMetricValue(kind="STRING_COUNT_MAP", values={"z": 1, "a": 2})
    payload = _review_payload()
    payload["metrics"] = tuple(reversed(payload["metrics"]))
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    payload = _review_payload("1.0")
    payload["metrics"] = payload["metrics"] + (_metrics("2.0")[-1],)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    unavailable = deepcopy(_review_payload()["metrics"][6])
    unavailable.update(
        category="NOT_AVAILABLE",
        availability="NOT_AVAILABLE",
        unavailable_reason="no eligible pair",
        value={"kind": "SCALAR", "value": _exact(None, "s")},
    )
    assert MetricItem.model_validate(unavailable).availability == "NOT_AVAILABLE"
    unavailable["value"] = {"kind": "SCALAR", "value": _exact(0, "s")}
    with pytest.raises(ValidationError):
        MetricItem.model_validate(unavailable)


def test_metric_references_allow_ordered_config_and_context_after_metrics_pointer() -> None:
    payload = deepcopy(_review_payload()["metrics"][0])
    payload["source_references"] = (
        {**_source("METRIC", sequence=None), "json_pointer": "/event_count"},
        _source("EXECUTION_CONTEXT", sequence=None),
        _source("EVENT", sequence=0),
    )
    assert len(MetricItem.model_validate(payload).source_references) == 3


def test_point_and_track_union_rules_preserve_unavailable_scalar_without_inference() -> None:
    route_source = SourceReference.model_validate(
        {**_source(), "json_pointer": "/raw_facts/route_progress_available"}
    )
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="NOT_AVAILABLE",
        availability="NOT_AVAILABLE",
        unavailable_reason="raw fact unavailable",
        scalar_value=ExactValue(**_exact(None, "%")),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=route_source,
    )
    Track(
        track_id="route_progress_pct",
        label="route progress",
        category="OBSERVED",
        availability="AVAILABLE",
        unavailable_reason=None,
        value_kind="SCALAR",
        points=(point,),
        source_references=(route_source,),
    )
    with pytest.raises(ValidationError):
        Point.model_validate(
            {
                **point.model_dump(mode="python"),
                "action_value": {"steering": 0.0, "throttle": 0.0, "brake": 0.0},
            }
        )
    with pytest.raises(ValidationError):
        Track(
            track_id="candidate_action",
            label="candidate",
            category="NOT_AVAILABLE",
            availability="NOT_AVAILABLE",
            unavailable_reason="missing",
            value_kind="ACTION",
            points=(point,),
            source_references=(),
        )


def test_timeline_registry_has_16_tracks_and_schema_separation_is_explicit() -> None:
    v1 = ReviewEnvelope.model_validate(_review_payload("1.0"))
    v2 = ReviewEnvelope.model_validate(_review_payload("2.0"))
    assert len(v1.metrics) == 13
    assert len(v2.metrics) == 19
    assert tuple(track.track_id for track in v2.timeline.tracks) == TRACKS
    assert v1.timeline.tracks[0].availability == "NOT_AVAILABLE"
    assert v1.timeline.tracks[4].availability == "NOT_AVAILABLE"
    assert all(track.availability == "AVAILABLE" for track in v2.timeline.tracks)
    assert len(v1.findings) == 6
    assert len(v1.evidence_sufficiency.items) == 7
    assert v1.evidence_sufficiency.items[-1].availability == "NOT_APPLICABLE"
    assert len(v2.findings) == 7
    payload = _review_payload()
    payload["timeline"]["tracks"] = tuple(reversed(payload["timeline"]["tracks"]))
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_provenance_quarantine_nulls_every_recorded_field() -> None:
    accepted = RecordedProvenance.model_validate(_accepted_provenance())
    assert accepted.status == "ACCEPTED"
    quarantined = _invalid_review_payload()["provenance"]["recorded"]
    assert RecordedProvenance.model_validate(quarantined).status == "QUARANTINED"
    bad = deepcopy(quarantined)
    bad["policy_name"] = "unverified-policy"
    with pytest.raises(ValidationError):
        RecordedProvenance.model_validate(bad)
    with pytest.raises(ValidationError):
        AuthenticatedOrigin(
            status="NOT_AUTHENTICATED",
            signer_id="signer",
            signature_id=None,
            category="AUTHENTICITY",
        )


def test_review_envelope_validates_registries_ids_and_cross_model_summaries() -> None:
    review = ReviewEnvelope.model_validate(_review_payload())
    assert tuple(item.finding_id for item in review.findings) == FINDINGS
    assert tuple(item.metric_id for item in review.metrics) == METRICS_V2
    payload = _review_payload()
    payload["gate"]["residual_limitation_ids"] = ("different",)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    payload = _review_payload()
    payload["findings"] = payload["findings"] + (payload["findings"][0],)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    payload = _review_payload()
    payload["evidence_sufficiency"] = {
        **_invalid_review_payload()["evidence_sufficiency"],
    }
    with pytest.raises(ValidationError, match="profile"):
        ReviewEnvelope.model_validate(payload)


def test_invalid_envelope_quarantines_stored_pass_findings_metrics_timeline_and_provenance() -> (
    None
):
    invalid = ReviewEnvelope.model_validate(_invalid_review_payload())
    assert invalid.gate.verdict == "INVALID_EVIDENCE"
    assert invalid.gate.residual_limitation_ids == ()
    assert invalid.findings == ()
    payload = _invalid_review_payload()
    payload["gate"] = _review_payload()["gate"]
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    payload = _invalid_review_payload()
    payload["metrics"] = _review_payload()["metrics"]
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_review_envelope_matches_unavailable_items_and_summary_counts() -> None:
    payload = _review_payload()
    missing = {
        **payload["evidence_sufficiency"]["items"][5],
        "evidence_id": "comfort.jerk",
        "label": "comfort.jerk",
        "requirement": "OPTIONAL",
        "availability": "NOT_AVAILABLE",
        "reason": "no eligible pair",
        "category": "NOT_AVAILABLE",
    }
    items = list(payload["evidence_sufficiency"]["items"])
    items[5] = missing
    payload["evidence_sufficiency"]["items"] = tuple(items)
    payload["evidence_sufficiency"]["summary"]["optional_and_available"] = 1
    payload["evidence_sufficiency"]["summary"]["optional_and_unavailable"] = 1
    payload["unavailable_evidence"] = (
        {
            "evidence_id": "comfort.jerk",
            "label": "comfort.jerk",
            "reason": "no eligible pair",
            "requiredness": "OPTIONAL",
            "consequence": _consequence(),
            "category": "NOT_AVAILABLE",
            "source_references": (),
        },
    )
    ReviewEnvelope.model_validate(payload)
    payload["unavailable_evidence"] = ()
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_dimension_value_union_accepts_all_five_variants_and_rejects_variant_mismatch() -> None:
    scalar = ScalarDeltaValue(kind="SCALAR", value=ExactValue(**_exact(1)))
    measurement = MeasurementDeltaValue(
        kind="MEASUREMENT", availability="AVAILABLE", value=1.0, reason=None
    )
    strings = ComparisonStringListValue(kind="STRING_LIST", values=("a", "b"))
    intervention = InterventionValue(kind="INTERVENTION", count=1, reasons={"shield": 1})
    availability = AvailabilityMapValue(
        kind="AVAILABILITY_MAP",
        values={
            "minimum_ttc_s": "AVAILABLE",
            "route_completion_pct": "AVAILABLE",
            "max_abs_acceleration_mps2": "AVAILABLE",
            "max_abs_jerk_mps3": "AVAILABLE",
            "p95_policy_latency_ms": "AVAILABLE",
        },
    )
    assert {item.kind for item in (scalar, measurement, strings, intervention, availability)} == {
        "SCALAR",
        "MEASUREMENT",
        "STRING_LIST",
        "INTERVENTION",
        "AVAILABILITY_MAP",
    }
    with pytest.raises(ValidationError):
        MeasurementDeltaValue(
            kind="MEASUREMENT", availability="NOT_AVAILABLE", value=0.0, reason="missing"
        )
    with pytest.raises(ValidationError):
        ComparisonStringListValue(kind="STRING_LIST", values=("b", "a"))


def test_side_references_hard_failure_availability_and_chart_models_are_strict() -> None:
    baseline_ref = SideReference(
        side="BASELINE", reference=SourceReference.model_validate(_source())
    )
    HardFailureDelta(
        status="IMPROVED",
        baseline_ids=("collision.zero",),
        candidate_ids=(),
        removed_ids=("collision.zero",),
        added_ids=(),
        explanation="removed hard failures: collision.zero",
        category="COMPUTED",
        source_references=(baseline_ref,),
    )
    AvailabilityDelta(
        metric_id="minimum_ttc_s",
        baseline_availability="NOT_AVAILABLE",
        candidate_availability="AVAILABLE",
        baseline_reason="missing",
        candidate_reason=None,
        category="COMPUTED",
        source_references=(baseline_ref,),
    )
    with pytest.raises(ValidationError):
        ChartSeries(
            dimension_id="minimum_ttc_s",
            baseline_numeric_value=math.nan,
            candidate_numeric_value=1.0,
            unit="s",
            category="COMPUTED",
            source_references=(baseline_ref,),
        )


def test_comparison_maps_each_core_dimension_once_and_preserves_partition_order() -> None:
    comparison = ComparisonEnvelope.model_validate(_comparison_payload())
    mapped = [comparison.verdict_delta.dimension_id, "hard_failures"]
    mapped += [item.dimension_id for item in comparison.unchanged_outcomes]
    mapped += [item.dimension_id for item in comparison.not_comparable]
    mapped += [comparison.availability_summary_delta.dimension_id]
    assert mapped == [
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
    ]
    payload = _comparison_payload()
    payload["improvements"] = (payload["unchanged_outcomes"][1],)
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


def test_incompatible_comparison_must_have_no_deltas_partitions_details_or_charts() -> None:
    incompatible = ComparisonEnvelope.model_validate(_comparison_payload(compatible=False))
    assert incompatible.chart_series == ()
    payload = _comparison_payload(compatible=False)
    payload["verdict_delta"] = _scalar_delta("verdict")
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


def test_canonical_serialization_is_stable_locator_bound_and_has_no_transport_newline() -> None:
    first = ReviewEnvelope.model_validate(_review_payload())
    second = ReviewEnvelope.model_validate(deepcopy(_review_payload()))
    assert canonical_envelope_bytes(first) == canonical_envelope_bytes(second)
    assert not canonical_envelope_bytes(first).endswith(b"\n")
    moved = _review_payload()
    moved["artifact"]["locator"] = {
        "selected_relative_path": "copies/candidate",
        "selected_directory_name": "candidate",
        "category": "OBSERVED",
    }
    assert canonical_envelope_bytes(first) != canonical_envelope_bytes(
        ReviewEnvelope.model_validate(moved)
    )


def test_portable_envelopes_recursively_exclude_session_authority_and_filesystem_keys() -> None:
    review = ReviewEnvelope.model_validate(_review_payload()).model_dump(mode="json")
    comparison = ComparisonEnvelope.model_validate(_comparison_payload()).model_dump(mode="json")
    forbidden = {
        "winner",
        "score",
        "safety_score",
        "approval",
        "deployment_grant",
        "absolute_path",
        "device",
        "inode",
        "mode",
        "mtime",
        "mtime_ns",
        "ctime",
        "ctime_ns",
        "generated_at",
        "generated_time",
        "session_id",
        "cache_state",
        "port",
    }

    def keys(value: object) -> set[str]:
        if isinstance(value, dict):
            return set(value) | set().union(*(keys(item) for item in value.values()))
        if isinstance(value, list):
            return set().union(*(keys(item) for item in value)) if value else set()
        return set()

    assert not (keys(review) | keys(comparison)) & forbidden
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate({**_review_payload(), "winner": "candidate"})


def test_structural_budgets_fail_with_typed_review_unavailable_error() -> None:
    payload = _review_payload()
    payload["metrics"] = tuple(payload["metrics"]) * 4
    with pytest.raises(ReviewUnavailableError) as exc_info:
        ReviewEnvelope.model_validate(payload)
    assert exc_info.value.reason is ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE


def test_threshold_nesting_over_16_fails_with_typed_review_unavailable_error() -> None:
    child = _clause()
    for depth in range(16):
        child = {
            "kind": "ALL_OF",
            "label": f"depth-{depth}",
            "clause": None,
            "children": (child,),
            "invariant": None,
        }
    payload = _review_payload()
    payload["findings"][1]["threshold"] = child
    with pytest.raises(ReviewUnavailableError) as exc_info:
        ReviewEnvelope.model_validate(payload)
    assert exc_info.value.reason is ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE


def test_round1_threshold_and_gate_registry_rejects_fabricated_portable_basis() -> None:
    payload = _review_payload()
    collision = payload["findings"][1]
    collision["threshold"]["label"] = "fabricated label"
    collision["threshold"]["clause"]["right_operand"] = _exact(999, "bananas")
    collision["threshold"]["clause"]["configuration_sources"] = (
        _source("MANIFEST", sequence=None),
    )
    collision["threshold"]["clause"]["evidence_sources"] = (_source("METRIC", sequence=None),)
    payload["gate"]["hard_failure_ids"] = ("collision.zero",)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


@pytest.mark.parametrize("finding_index", range(7))
def test_round1_each_finding_uses_its_frozen_threshold_label(finding_index: int) -> None:
    payload = _review_payload()
    payload["findings"][finding_index]["threshold"]["label"] = "arbitrary caller label"
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


@pytest.mark.parametrize(
    "membership_field",
    (
        "listed_in_hard_failures",
        "listed_in_soft_failures",
        "listed_in_supporting_findings",
    ),
)
def test_round1_finding_membership_flags_exactly_copy_gate_arrays(
    membership_field: str,
) -> None:
    payload = _review_payload()
    consequence = payload["findings"][0]["consequence"]
    consequence[membership_field] = not consequence[membership_field]
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round1_comparison_registry_rejects_invented_set_chart_and_availability_deltas() -> None:
    payload = _comparison_payload()
    latency = next(
        item
        for item in payload["unchanged_outcomes"]
        if item["dimension_id"] == "policy_latency_source"
    )
    latency["baseline_value"] = {"kind": "STRING_LIST", "values": ("simulated",)}
    latency["candidate_value"] = {"kind": "STRING_LIST", "values": ("simulated",)}
    payload["hard_failure_delta"]["removed_ids"] = ("ghost",)
    payload["hard_failure_delta"]["status"] = "IMPROVED"
    payload["chart_series"] = (
        {
            "dimension_id": "minimum_ttc_s",
            "baseline_numeric_value": 999.0,
            "candidate_numeric_value": -3.0,
            "unit": "bananas",
            "category": "COMPUTED",
            "source_references": (),
        },
    )
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


def test_round1_chart_must_exactly_copy_eligible_partition_delta() -> None:
    payload = _comparison_payload()
    payload["chart_series"][1]["baseline_numeric_value"] = 999.0
    payload["chart_series"][1]["unit"] = "bananas"
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


def test_round1_availability_details_exactly_match_summary_and_measurement_delta() -> None:
    payload = _comparison_payload()
    minimum_ttc = payload["unchanged_outcomes"][1]
    minimum_ttc["status"] = "NOT_COMPARABLE"
    minimum_ttc["baseline_value"] = {
        "kind": "MEASUREMENT",
        "availability": "NOT_AVAILABLE",
        "value": None,
        "reason": "missing baseline TTC",
    }
    payload["availability_summary_delta"]["status"] = "NOT_COMPARABLE"
    payload["availability_summary_delta"]["baseline_value"]["values"]["minimum_ttc_s"] = (
        "NOT_AVAILABLE"
    )
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


def test_round1_portable_maps_are_transitively_immutable_and_canonical_bytes_stable() -> None:
    review = ReviewEnvelope.model_validate(_review_payload())
    before = canonical_envelope_bytes(review)
    with pytest.raises(TypeError):
        review.metrics[11].value.values["injected"] = 7
    assert canonical_envelope_bytes(review) == before
    comparison = ComparisonEnvelope.model_validate(_comparison_payload())
    intervention = comparison.unchanged_outcomes[-1].baseline_value
    with pytest.raises(TypeError):
        intervention.reasons["injected"] = 7


def test_round1_integrity_requires_complete_identity_roots_provenance_and_quarantine_flag() -> None:
    payload = _review_payload()
    payload["artifact"]["manifest_identity"]["run_id"] = None
    payload["artifact"]["computed_bundle_digest"] = None
    payload["provenance"]["recorded"] = _invalid_review_payload()["provenance"]["recorded"]
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    invalid = _invalid_review_payload()
    invalid["verification"]["stored_claims_quarantined"] = False
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(invalid)


def test_round1_available_metric_requires_typed_value_and_exact_source() -> None:
    payload = _review_payload()
    payload["metrics"][0]["value"] = {"kind": "SCALAR", "value": _exact(None, "events")}
    payload["metrics"][0]["value"]["value"]["display_text"] = "PASS"
    payload["metrics"][0]["source_references"] = ()
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round1_side_reference_order_is_source_first_then_side_tiebreaker() -> None:
    candidate_manifest = SideReference(
        side="CANDIDATE",
        reference=SourceReference.model_validate(_source("MANIFEST", sequence=None)),
    )
    baseline_verdict = SideReference(
        side="BASELINE",
        reference=SourceReference.model_validate(_source("VERDICT", sequence=None)),
    )
    HardFailureDelta(
        status="UNCHANGED",
        baseline_ids=(),
        candidate_ids=(),
        removed_ids=(),
        added_ids=(),
        explanation="hard-failure set is unchanged",
        category="COMPUTED",
        source_references=(candidate_manifest, baseline_verdict),
    )


def test_round1_timeline_grid_categories_and_scalar_availability_are_exact() -> None:
    source = SourceReference.model_validate(_source(sequence=0))
    with pytest.raises(ValidationError):
        Point(
            sequence=0,
            simulation_time_s=0.0,
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            scalar_value=ExactValue(**_exact(None, "m/s")),
            action_value=None,
            observation_value=None,
            string_list_value=None,
            source_reference=source,
        )
    collision_source = SourceReference.model_validate(
        {**_source(sequence=0), "json_pointer": "/vehicle_state/collision_count"}
    )
    speed_source = SourceReference.model_validate(
        {**_source(sequence=0), "json_pointer": "/vehicle_state/speed_mps"}
    )
    collision = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="OBSERVED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=ExactValue(**_exact(0, "collisions")),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=collision_source,
    )
    speed = Point(
        sequence=0,
        simulation_time_s=1.0,
        category="OBSERVED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=ExactValue(**_exact(1.0, "m/s")),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=speed_source,
    )
    tracks = (
        Track(
            track_id="collision_count",
            label="collision",
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(collision,),
            source_references=(collision_source,),
        ),
        Track(
            track_id="speed_mps",
            label="speed",
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(speed,),
            source_references=(speed_source,),
        ),
    )
    with pytest.raises(ValidationError, match="time grid"):
        Timeline(
            event_count=1,
            simulation_start_s=0.0,
            simulation_end_s=0.0,
            tracks=tracks,
            category="OBSERVED",
        )


def test_round1_schema_profile_pair_and_gate_memberships_are_exact() -> None:
    payload = _review_payload("2.0")
    payload["evidence_sufficiency"] = _review_payload("1.0")["evidence_sufficiency"]
    payload["findings"] = _review_payload("1.0")["findings"]
    payload["gate"]["supporting_finding_ids"] = tuple(
        item["finding_id"] for item in payload["findings"]
    )
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round1_dimension_variants_match_real_compare_artifacts_shapes() -> None:
    core = compare_artifacts(
        _core_comparison_snapshot("baseline"),
        _core_comparison_snapshot("candidate"),
    )
    dimensions = {item.name: item.model_dump(mode="json") for item in core.dimensions}
    latency = dimensions["policy_latency_source"]
    intervention = dimensions["shield_interventions"]
    projected_latency = DimensionDelta(
        dimension_id="policy_latency_source",
        status=latency["status"],
        baseline_value=ComparisonStringListValue(
            kind="STRING_LIST", values=tuple(latency["baseline_value"])
        ),
        candidate_value=ComparisonStringListValue(
            kind="STRING_LIST", values=tuple(latency["candidate_value"])
        ),
        unit=None,
        explanation=latency["explanation"],
        desired_direction="DESCRIPTIVE",
        category="COMPUTED",
        source_references=(),
    )
    projected_intervention = DimensionDelta(
        dimension_id="shield_interventions",
        status=intervention["status"],
        baseline_value=InterventionValue(
            kind="INTERVENTION",
            count=intervention["baseline_value"]["count"],
            reasons=intervention["baseline_value"]["reasons"],
        ),
        candidate_value=InterventionValue(
            kind="INTERVENTION",
            count=intervention["candidate_value"]["count"],
            reasons=intervention["candidate_value"]["reasons"],
        ),
        unit="interventions",
        explanation=intervention["explanation"],
        desired_direction="DESCRIPTIVE",
        category="COMPUTED",
        source_references=(),
    )
    assert projected_latency.baseline_value.values == ("simulated",)
    assert projected_latency.status == "UNCHANGED"
    assert projected_intervention.baseline_value.count == 0
    assert projected_intervention.status == "UNCHANGED"
    payload = _review_payload()
    payload["gate"]["hard_failure_ids"] = ("ghost.finding",)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
