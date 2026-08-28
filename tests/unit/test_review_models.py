from __future__ import annotations

import dataclasses
import json
import math
from collections.abc import Mapping
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError

import hermes.review.models as review_models
from hermes.comparison.compare import compare_artifacts
from hermes.domain.enums import EvidenceAvailability, FindingStatus, TerminationReason, Verdict
from hermes.domain.models import (
    ArtifactManifest,
    ComponentContext,
    ExecutionContext,
    Finding,
    FindingsDocument,
    GateResult,
    Measurement,
    RunContext,
    RunMetrics,
    ScenarioDefinition,
    TraceEvent,
)
from hermes.evidence.verification import VerifiedArtifactSnapshot, inspect_artifact
from hermes.gates.config import GateConfig
from hermes.gates.release import VerifierProfile, apply_release_gate
from hermes.review import (
    ComparisonEnvelope,
    LocatorInfo,
    ReviewCacheKey,
    ReviewEnvelope,
    ReviewUnavailableError,
    ReviewUnavailableReason,
    canonical_envelope_bytes,
    review_artifact,
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


@pytest.mark.parametrize(
    ("run_id", "evidence_schema"),
    (("phase1-nominal", "1.0"), ("handoff-p4-fault", "2.0")),
)
def test_legacy_review_models_round_trip_to_the_exact_same_canonical_envelope(
    repository_root: Path,
    run_id: str,
    evidence_schema: str,
) -> None:
    review = review_artifact(repository_root / "artifacts", run_id)
    canonical = canonical_envelope_bytes(review)
    round_tripped = ReviewEnvelope.model_validate_json(canonical)

    assert type(review) is ReviewEnvelope
    assert type(round_tripped) is ReviewEnvelope
    assert round_tripped.artifact.manifest_identity.evidence_schema_version == evidence_schema
    assert canonical_envelope_bytes(round_tripped) == canonical
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
    if value is None:
        canonical_text = None
        display_text = "NOT_AVAILABLE"
    else:
        canonical_text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        display_text = value if isinstance(value, str) else canonical_text
    return {
        "machine_value": value,
        "canonical_text": canonical_text,
        "display_text": display_text,
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
            "evidence_sources": (
                (_ref("EVENT", "", sequence=0), _ref("TRACE_DIGEST", ""))
                if trace
                else (
                    _ref("EVENT", "/control_fault_evidence/applied_faults", sequence=0),
                    _ref("EVENT", "/observation_fault_evidence/applied_faults", sequence=0),
                )
            ),
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
                evidence=(_ref("EVENT", "/vehicle_state/lateral_offset_m", sequence=0),),
                label="Maximum absolute lateral offset",
            ),
            _clause(
                "offroad",
                ("ALL_EVENTS",),
                "IS_FALSE",
                evidence=(_ref("EVENT", "/vehicle_state/offroad", sequence=0),),
                label="No event is off-road",
            ),
            _clause(
                "offroad",
                ("DURATION_TRUE",),
                right=_exact(0.0, "s"),
                configuration=(_ref("GATE_CONFIG", "/hard/max_offroad_duration_s"),),
                evidence=(
                    _ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
                    _ref("EVENT", "/vehicle_state/offroad", sequence=0),
                ),
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
                    evidence=(
                        _ref("EVENT", "/vehicle_state/destination_reached", sequence=0),
                    ),
                    label="Destination reached at final event",
                ),
                _clause(
                    "route_completion_pct",
                    ("MAX_OVER_EVENTS",),
                    "GTE",
                    right=_exact(95.0, "%"),
                    configuration=(_ref("GATE_CONFIG", "/hard/min_route_completion_pct"),),
                    evidence=(
                        _ref("EVENT", "/raw_facts/route_progress_available", sequence=0),
                        _ref("EVENT", "/vehicle_state/route_progress_pct", sequence=0),
                        _ref("METRIC", "/route_completion_pct"),
                    ),
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
            evidence=(_ref("EVENT", "/vehicle_state/acceleration_mps2", sequence=0),),
            label="Maximum absolute acceleration",
        )
    if finding_id == "comfort.jerk":
        return _clause(
            "acceleration_mps2",
            ("FINITE_DIFFERENCE", "ABSOLUTE_VALUE", "MAX_OVER_EVENTS"),
            right=_exact(10.0, "m/s^3"),
            configuration=(_ref("GATE_CONFIG", "/soft/max_abs_jerk_mps3"),),
            evidence=(
                _ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
                _ref("EVENT", "/vehicle_state/acceleration_mps2", sequence=0),
            ),
            label="Maximum absolute jerk",
        )
    return _clause(
        right=_exact(0, "count"),
        configuration=(_ref("GATE_CONFIG", "/hard/max_collision_count"),),
        evidence=(_ref("EVENT", "/vehicle_state/collision_count", sequence=0),),
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
            "value": "c" * 64,
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
            "value": "e" * 64,
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
            if metric_id == "event_count":
                scalar = 1
            value = {"kind": kind, "value": _exact(scalar, unit)}
        event_pointers: dict[str, tuple[str, ...]] = {
            "event_count": ("",),
            "simulation_duration_s": ("/simulation_time_s",),
            "collision_count": ("/vehicle_state/collision_count",),
            "max_abs_lateral_offset_m": ("/vehicle_state/lateral_offset_m",),
            "offroad_duration_s": ("/vehicle_state/offroad",),
            "route_completion_pct": (
                "/raw_facts/route_progress_available",
                "/vehicle_state/route_progress_pct",
            ),
            "minimum_ttc_s": (
                "/observation_summary/result_front_distance_m",
                "/observation_summary/result_front_relative_speed_mps",
            ),
            "max_abs_acceleration_mps2": ("/vehicle_state/acceleration_mps2",),
            "max_abs_jerk_mps3": ("/vehicle_state/acceleration_mps2",),
            "p95_policy_latency_ms": ("/policy_latency_ms",),
            "shield_override_count": (
                "/candidate_action",
                "/executed_action" if schema == "1.0" else "/permitted_action",
            ),
            "shield_override_reasons": ("/override_reasons",),
            "termination_reason": ("/termination_reason",),
            "fault_application_counts": (
                "/control_fault_evidence/applied_faults",
                "/observation_fault_evidence/applied_faults",
            ),
            "max_observation_age_s": (
                "/observation_fault_evidence/delivered_observation/observation_age_s",
            ),
            "p95_control_latency_ms": ("/control_fault_evidence/control_latency_ms/value",),
            "control_fill_count": (),
            "steering_saturation_count": (),
            "brake_saturation_count": (),
        }
        tail = tuple(
            _ref("EVENT", pointer, sequence=0) for pointer in event_pointers[metric_id]
        )
        if metric_id in {"offroad_duration_s", "max_abs_jerk_mps3"}:
            tail = (_ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"), *tail)
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
                    *tail,
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
    point_pointers = {
        "raw_observation": "/observation_fault_evidence/raw_observation",
        "delivered_observation": "/observation_fault_evidence/delivered_observation",
        "result_observation": "/result_observation",
        "candidate_action": "/candidate_action",
        "permitted_action": "/permitted_action",
        "executed_action": "/executed_action",
        "override_reasons": "/override_reasons",
        "observation_fault_reasons": "/observation_fault_evidence/applied_faults",
        "control_fault_reasons": "/control_fault_evidence/applied_faults",
        "collision_count": "/vehicle_state/collision_count",
        "offroad": "/vehicle_state/offroad",
        "speed_mps": "/vehicle_state/speed_mps",
        "route_progress_pct": "/vehicle_state/route_progress_pct",
        "ttc_s": "/observation_summary",
        "policy_latency_ms": "/policy_latency_ms",
        "verifier_triggering_findings": "",
    }
    observation = {
        "sequence": 0,
        "simulation_time_s": 0.0,
        "position_m": 0.0,
        "speed_mps": 0.0,
        "acceleration_mps2": 0.0,
        "lateral_offset_m": 0.0,
        "route_progress_pct": 0.0,
        "collision_count": 0,
        "offroad": False,
        "destination_reached": False,
        "front_distance_m": 2.0,
        "front_relative_speed_mps": -1.0,
        "observation_age_s": 0.0,
        "challenge_actor_longitudinal_m": None,
        "challenge_actor_lateral_offset_m": None,
        "challenge_actor_speed_mps": None,
        "challenge_phase": None,
    }
    scalar_values = {
        "collision_count": _exact(0, "collisions"),
        "offroad": _exact(False, None),
        "speed_mps": _exact(0.0, "m/s"),
        "route_progress_pct": _exact(0.0, "%"),
        "ttc_s": _exact(2.0, "s"),
        "policy_latency_ms": _exact(0.0, "ms"),
    }
    result = []
    for track_id in TRACKS:
        kind, category = TRACK_META[track_id]
        unavailable = schema == "1.0" and track_id in legacy_unavailable
        pointer = point_pointers[track_id]
        source = _ref(
            "FINDING" if track_id == "verifier_triggering_findings" else "EVENT",
            pointer,
            sequence=None if track_id == "verifier_triggering_findings" else 0,
        )
        point = {
            "sequence": 0,
            "simulation_time_s": 0.0,
            "category": category,
            "availability": "AVAILABLE",
            "unavailable_reason": None,
            "scalar_value": scalar_values.get(track_id),
            "action_value": (
                {"steering": 0.0, "throttle": 0.0, "brake": 0.0}
                if kind == "ACTION"
                else None
            ),
            "observation_value": observation if kind == "OBSERVATION" else None,
            "string_list_value": {"values": ()} if kind == "STRING_LIST" else None,
            "source_reference": source,
        }
        track_sources = (source,)
        if track_id == "ttc_s":
            track_sources = (
                _ref("EVENT", "/observation_summary/result_front_distance_m", sequence=0),
                _ref(
                    "EVENT",
                    "/observation_summary/result_front_relative_speed_mps",
                    sequence=0,
                ),
            )
        elif track_id == "verifier_triggering_findings":
            track_sources = ()
        result.append(
            {
                "track_id": track_id,
                "label": track_id,
                "category": "NOT_AVAILABLE" if unavailable else category,
                "availability": "NOT_AVAILABLE" if unavailable else "AVAILABLE",
                "unavailable_reason": "not present in schema 1" if unavailable else None,
                "value_kind": kind,
                "points": () if unavailable else (point,),
                "source_references": () if unavailable else track_sources,
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
            "event_count": 1,
            "simulation_start_s": 0.0,
            "simulation_end_s": 0.0,
            "tracks": _tracks(schema),
            "category": "OBSERVED",
        },
        "provenance": {
            "recorded": {
                **_accepted_provenance(),
                **(
                    {"fault_name": None, "fault_version": None, "fault_config_digest": None}
                    if schema == "1.0"
                    else {}
                ),
            },
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
        verifier_profile=VerifierProfile.LEGACY,
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
    schema2 = ReviewCacheKey(SHA, "2.0", "0.1.0", "runs/candidate")
    assert schema2.as_tuple() == (SHA, "2.0", "0.1.0", "runs/candidate")
    with pytest.raises((TypeError, ValueError)):
        ReviewCacheKey(SHA, "3.0", "0.1.0", "runs/candidate")  # type: ignore[arg-type]
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
    payload["observed_bundle_digest"] = None
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
    stationary_payload = observation.model_dump()
    stationary_payload["challenge_phase"] = "PRESENT"
    stationary = ObservationValue.model_validate(stationary_payload)
    assert stationary.challenge_phase == "PRESENT"
    steady_payload = observation.model_dump()
    steady_payload["challenge_phase"] = "STEADY"
    steady = ObservationValue.model_validate(steady_payload)
    assert steady.challenge_phase == "STEADY"
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
    payload = deepcopy(_review_payload()["metrics"][4])
    payload["source_references"] = (
        {**_source("METRIC", sequence=None), "json_pointer": "/offroad_duration_s"},
        _ref("EXECUTION_CONTEXT", "/run_context/control_frequency_hz"),
        _ref("EVENT", "/vehicle_state/offroad", sequence=0),
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


@pytest.mark.parametrize(
    ("distance_pointer", "speed_pointer", "availability"),
    (
        (
            "/observation_summary/result_front_distance_m",
            "/observation_summary/result_front_relative_speed_mps",
            "AVAILABLE",
        ),
        (
            "/observation_summary/front_distance_m",
            "/observation_summary/front_relative_speed_mps",
            "AVAILABLE",
        ),
        (
            "/observation_summary/result_front_distance_m",
            "/observation_summary/result_front_relative_speed_mps",
            "NOT_AVAILABLE",
        ),
    ),
)
def test_round2_ttc_track_retains_exact_contributing_pair_for_common_record_point(
    distance_pointer: str,
    speed_pointer: str,
    availability: str,
) -> None:
    unavailable = availability == "NOT_AVAILABLE"
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="NOT_AVAILABLE" if unavailable else "COMPUTED",
        availability=availability,
        unavailable_reason="no paired closing front-object evidence" if unavailable else None,
        scalar_value=ExactValue(
            machine_value=None if unavailable else 2.0,
            canonical_text=None if unavailable else "2.0",
            display_text="NOT_AVAILABLE" if unavailable else "2.0",
            unit="s",
        ),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=SourceReference(
            source_type="EVENT",
            file_name="events.jsonl",
            json_pointer="/observation_summary",
            event_sequence=0,
        ),
    )
    track = Track(
        track_id="ttc_s",
        label="TTC",
        category="COMPUTED",
        availability="AVAILABLE",
        unavailable_reason=None,
        value_kind="SCALAR",
        points=(point,),
        source_references=(
            SourceReference(
                source_type="EVENT",
                file_name="events.jsonl",
                json_pointer=distance_pointer,
                event_sequence=0,
            ),
            SourceReference(
                source_type="EVENT",
                file_name="events.jsonl",
                json_pointer=speed_pointer,
                event_sequence=0,
            ),
        ),
    )
    assert track.points[0].source_reference.json_pointer == "/observation_summary"
    assert tuple(reference.json_pointer for reference in track.source_references) == (
        distance_pointer,
        speed_pointer,
    )


@pytest.mark.parametrize(
    "contributor_pointers",
    (
        ("/observation_summary/front_distance_m",),
        (
            "/observation_summary/result_front_distance_m",
            "/observation_summary/front_relative_speed_mps",
        ),
    ),
)
def test_round2_ttc_track_rejects_incomplete_or_mixed_contributing_pairs(
    contributor_pointers: tuple[str, ...],
) -> None:
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="COMPUTED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=ExactValue(
            machine_value=2.0,
            canonical_text="2.0",
            display_text="2.0",
            unit="s",
        ),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=SourceReference(
            source_type="EVENT",
            file_name="events.jsonl",
            json_pointer="/observation_summary",
            event_sequence=0,
        ),
    )
    with pytest.raises(ValidationError):
        Track(
            track_id="ttc_s",
            label="TTC",
            category="COMPUTED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(point,),
            source_references=tuple(
                SourceReference(
                    source_type="EVENT",
                    file_name="events.jsonl",
                    json_pointer=pointer,
                    event_sequence=0,
                )
                for pointer in contributor_pointers
            ),
        )


def test_round2_ordinary_track_still_requires_its_single_exact_point_source() -> None:
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="OBSERVED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=ExactValue(
            machine_value=1.0,
            canonical_text="1.0",
            display_text="1.0",
            unit="m/s",
        ),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=SourceReference(
            source_type="EVENT",
            file_name="events.jsonl",
            json_pointer="/vehicle_state/speed_mps",
            event_sequence=0,
        ),
    )
    with pytest.raises(ValidationError, match="exactly cover"):
        Track(
            track_id="speed_mps",
            label="speed",
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(point,),
            source_references=(
                SourceReference(
                    source_type="EVENT",
                    file_name="events.jsonl",
                    json_pointer="/observation_summary/front_distance_m",
                    event_sequence=0,
                ),
                SourceReference(
                    source_type="EVENT",
                    file_name="events.jsonl",
                    json_pointer="/observation_summary/front_relative_speed_mps",
                    event_sequence=0,
                ),
            ),
        )


def test_round2_verifier_track_uses_finding_root_points_and_exact_row_references() -> None:
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="COMPUTED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=None,
        action_value=None,
        observation_value=None,
        string_list_value=StringListValue(values=("collision.zero", "progress.required")),
        source_reference=SourceReference(
            source_type="FINDING",
            file_name="findings.json",
            json_pointer="",
            event_sequence=None,
        ),
    )
    track = Track(
        track_id="verifier_triggering_findings",
        label="triggering findings",
        category="COMPUTED",
        availability="AVAILABLE",
        unavailable_reason=None,
        value_kind="STRING_LIST",
        points=(point,),
        source_references=(
            SourceReference(
                source_type="FINDING",
                file_name="findings.json",
                json_pointer="/findings/1",
                event_sequence=None,
            ),
            SourceReference(
                source_type="FINDING",
                file_name="findings.json",
                json_pointer="/findings/3",
                event_sequence=None,
            ),
        ),
    )
    assert tuple(reference.json_pointer for reference in track.source_references) == (
        "/findings/1",
        "/findings/3",
    )


def test_round2_probe_latency_source_change_forces_measurement_not_comparable() -> None:
    payload = _comparison_payload()
    unchanged = list(payload["unchanged_outcomes"])
    source_delta = unchanged.pop(6)
    source_delta["status"] = "NOT_COMPARABLE"
    source_delta["candidate_value"] = {"kind": "STRING_LIST", "values": ("measured",)}
    payload["unchanged_outcomes"] = tuple(unchanged)
    payload["not_comparable"] = (source_delta,)
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


def test_round2_probe_verdict_delta_must_copy_side_summary_verdicts() -> None:
    payload = _comparison_payload()
    payload["candidate"]["gate_verdict"] = "HOLD"
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


@pytest.mark.parametrize(
    "retained_field",
    (
        "manifest_identity",
        "observed_bundle_digest",
        "observed_trace_digest",
        "computed_trace_digest",
    ),
)
def test_round2_probe_identity_and_digest_facts_require_their_captured_source(
    retained_field: str,
) -> None:
    original = _artifact()
    payload = deepcopy(original)
    payload["source_inventory"] = ()
    payload["manifest_identity"] = {
        "run_id": None,
        "created_at_utc": None,
        "evidence_schema_version": None,
        "scenario_schema_version": None,
        "category": "OBSERVED",
    }
    payload["observed_bundle_digest"] = None
    payload["computed_bundle_digest"] = None
    payload["observed_trace_digest"] = None
    payload["computed_trace_digest"] = None
    payload[retained_field] = original[retained_field]
    with pytest.raises(ValidationError):
        PortableArtifactIdentity.model_validate(payload)


def test_round2_json_round_trip_copy_preserves_transitive_immutability() -> None:
    review = ReviewEnvelope.model_validate(_review_payload())
    copied = ReviewEnvelope.model_validate_json(review.model_dump_json())
    assert canonical_envelope_bytes(copied) == canonical_envelope_bytes(review)
    with pytest.raises(TypeError):
        copied.metrics[11].value.values["injected"] = 7


def test_round2_metric_rejects_event_pointer_outside_its_transform_registry() -> None:
    metric = deepcopy(_metrics()[2])
    metric["source_references"] = (
        metric["source_references"][0],
        _ref("EVENT", "/vehicle_state/offroad", sequence=0),
    )
    with pytest.raises(ValidationError):
        MetricItem.model_validate(metric)


@pytest.mark.parametrize("metric_index", range(19))
def test_round2_every_metric_rejects_event_pointer_outside_its_transform_registry(
    metric_index: int,
) -> None:
    metric = deepcopy(_metrics()[metric_index])
    references = list(metric["source_references"])
    event_index = next(
        (
            index
            for index, reference in enumerate(references)
            if reference["source_type"] == "EVENT"
        ),
        None,
    )
    bad_reference = _ref("EVENT", "/not-a-contract-transform", sequence=0)
    if event_index is None:
        references.append(bad_reference)
    else:
        references[event_index] = bad_reference
    metric["source_references"] = tuple(references)
    with pytest.raises(ValidationError):
        MetricItem.model_validate(metric)


def test_round2_consistent_review_requires_nonempty_event_timeline() -> None:
    payload = _review_payload()
    payload["timeline"] = {
        "event_count": 0,
        "simulation_start_s": None,
        "simulation_end_s": None,
        "tracks": tuple(
            {
                **track,
                "points": (),
                "source_references": (),
            }
            for track in payload["timeline"]["tracks"]
        ),
        "category": "OBSERVED",
    }
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round2_timeline_event_count_must_equal_event_count_metric() -> None:
    payload = _review_payload()
    payload["metrics"][0]["value"] = {"kind": "SCALAR", "value": _exact(2, "events")}
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round2_scalar_track_machine_type_and_unit_follow_registry() -> None:
    source = SourceReference.model_validate(
        _ref("EVENT", "/vehicle_state/speed_mps", sequence=0)
    )
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="OBSERVED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=ExactValue(
            machine_value="fast",
            canonical_text='"fast"',
            display_text="fast",
            unit="bananas",
        ),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=source,
    )
    with pytest.raises(ValidationError):
        Track(
            track_id="speed_mps",
            label="speed",
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(point,),
            source_references=(source,),
        )


@pytest.mark.parametrize(
    ("metric_index", "bad_value"),
    ((1, -1.0), (3, -1.0), (5, 101.0), (12, "not-a-termination-reason")),
)
def test_round2_metric_scalar_range_and_enum_follow_registry(
    metric_index: int,
    bad_value: object,
) -> None:
    metric = deepcopy(_metrics()[metric_index])
    metric["value"] = {
        "kind": "SCALAR",
        "value": _exact(bad_value, metric["value"]["value"]["unit"]),
    }
    with pytest.raises(ValidationError):
        MetricItem.model_validate(metric)


@pytest.mark.parametrize(
    ("availability", "pointer"),
    (
        ("AVAILABLE", "/raw_facts/route_progress_available"),
        ("NOT_AVAILABLE", "/vehicle_state/route_progress_pct"),
    ),
)
def test_round2_route_progress_point_source_matches_availability(
    availability: str,
    pointer: str,
) -> None:
    unavailable = availability == "NOT_AVAILABLE"
    source = SourceReference.model_validate(_ref("EVENT", pointer, sequence=0))
    point = Point(
        sequence=0,
        simulation_time_s=0.0,
        category="NOT_AVAILABLE" if unavailable else "OBSERVED",
        availability=availability,
        unavailable_reason="route progress explicitly unavailable" if unavailable else None,
        scalar_value=ExactValue(**_exact(None if unavailable else 5.0, "%")),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=source,
    )
    with pytest.raises(ValidationError):
        Track(
            track_id="route_progress_pct",
            label="route progress",
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(point,),
            source_references=(source,),
        )


def test_round2_verifier_points_exactly_match_finding_sequence_membership() -> None:
    payload = _review_payload()
    verifier_track = payload["timeline"]["tracks"][-1]
    verifier_track["points"][0]["string_list_value"] = {"values": ("collision.zero",)}
    verifier_track["source_references"] = (_ref("FINDING", "/findings/1", sequence=None),)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round2_unavailable_track_has_no_source_references() -> None:
    with pytest.raises(ValidationError):
        Track(
            track_id="raw_observation",
            label="raw observation",
            category="NOT_AVAILABLE",
            availability="NOT_AVAILABLE",
            unavailable_reason="not represented in this schema",
            value_kind="OBSERVATION",
            points=(),
            source_references=(
                SourceReference.model_validate(
                    _ref("EVENT", "/observation_fault_evidence/raw_observation", sequence=0)
                ),
            ),
        )


@pytest.mark.parametrize("schema", ("1.0", "2.0"))
def test_round2_accepted_fault_provenance_matches_evidence_schema(schema: str) -> None:
    payload = _review_payload(schema)
    if schema == "2.0":
        payload["provenance"]["recorded"]["fault_name"] = None
        payload["provenance"]["recorded"]["fault_version"] = None
        payload["provenance"]["recorded"]["fault_config_digest"] = None
    else:
        payload["provenance"]["recorded"]["fault_name"] = "faults"
        payload["provenance"]["recorded"]["fault_version"] = "1.0"
        payload["provenance"]["recorded"]["fault_config_digest"] = SHA
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round2_consistent_gate_requires_complete_identity() -> None:
    payload = _review_payload()
    payload["gate"]["gate_name"] = None
    payload["gate"]["gate_version"] = None
    payload["gate"]["gate_config_digest_sha256"] = None
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


@pytest.mark.parametrize(
    ("machine_value", "canonical_text", "display_text"),
    (
        ("PASS", "PASS", "PASS"),
        (True, "True", "True"),
        (2.0, "2", "2"),
    ),
)
def test_round2_exact_value_requires_canonical_json_lexical_and_full_display(
    machine_value: object,
    canonical_text: str,
    display_text: str,
) -> None:
    with pytest.raises(ValidationError):
        ExactValue(
            machine_value=machine_value,
            canonical_text=canonical_text,
            display_text=display_text,
            unit=None,
        )


@pytest.mark.parametrize(
    ("machine_value", "canonical_text", "display_text"),
    (("PASS", '"PASS"', "PASS"), (True, "true", "true"), (2.0, "2.0", "2.0")),
)
def test_round2_exact_value_accepts_canonical_json_lexical_and_full_display(
    machine_value: object,
    canonical_text: str,
    display_text: str,
) -> None:
    value = ExactValue(
        machine_value=machine_value,
        canonical_text=canonical_text,
        display_text=display_text,
        unit=None,
    )
    assert value.machine_value == machine_value


def test_round2_consistent_review_requires_matching_observed_and_computed_roots() -> None:
    payload = _review_payload()
    payload["artifact"]["observed_bundle_digest"]["value"] = "f" * 64
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)
    payload = _review_payload()
    payload["artifact"]["observed_trace_digest"]["value"] = "f" * 64
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


@pytest.mark.parametrize("relative_path", (".", "bad\x00path"))
def test_round2_public_relative_paths_reject_non_locator_forms(relative_path: str) -> None:
    with pytest.raises((TypeError, ValueError)):
        ReviewCacheKey(SHA, "1.0", "0.1.0", relative_path)
    with pytest.raises(ValidationError):
        LocatorInfo(
            selected_relative_path=relative_path,
            selected_directory_name=relative_path,
            category="OBSERVED",
        )


def test_round2_reference_arrays_reject_semantically_duplicate_root_pointers() -> None:
    with pytest.raises(ValidationError):
        DiagnosticItem(
            id="duplicate-root",
            code="DUPLICATE_ROOT",
            text="duplicate root",
            impact="ambiguous canonical bytes",
            category="COMPUTED",
            source_references=(
                SourceReference(
                    source_type="MANIFEST",
                    file_name="manifest.json",
                    json_pointer=None,
                    event_sequence=None,
                ),
                SourceReference(
                    source_type="MANIFEST",
                    file_name="manifest.json",
                    json_pointer="",
                    event_sequence=None,
                ),
            ),
        )


@pytest.mark.parametrize("side_name", ("baseline", "candidate"))
def test_round2_consistent_comparison_side_requires_complete_matching_artifact_roots(
    side_name: str,
) -> None:
    payload = _comparison_payload()
    payload[side_name]["artifact"]["source_inventory"] = ()
    payload[side_name]["artifact"]["observed_bundle_digest"] = None
    payload[side_name]["artifact"]["computed_bundle_digest"] = None
    payload[side_name]["artifact"]["observed_trace_digest"] = None
    payload[side_name]["artifact"]["computed_trace_digest"] = None
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


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


def test_round2_complete_envelope_matches_real_latency_source_incompatibility() -> None:
    core = compare_artifacts(
        _core_comparison_snapshot("baseline", latency_source="simulated"),
        _core_comparison_snapshot("candidate", latency_source="measured"),
    )
    dimensions = {item.name: item.model_dump(mode="json") for item in core.dimensions}
    assert dimensions["policy_latency_source"]["status"] == "NOT_COMPARABLE"
    assert dimensions["p95_policy_latency_ms"]["status"] == "NOT_COMPARABLE"

    payload = _comparison_payload()
    unchanged = list(payload["unchanged_outcomes"])
    latency = unchanged.pop(5)
    source = unchanged.pop(5)
    latency["status"] = dimensions["p95_policy_latency_ms"]["status"]
    source["status"] = dimensions["policy_latency_source"]["status"]
    source["baseline_value"] = {
        "kind": "STRING_LIST",
        "values": tuple(dimensions["policy_latency_source"]["baseline_value"]),
    }
    source["candidate_value"] = {
        "kind": "STRING_LIST",
        "values": tuple(dimensions["policy_latency_source"]["candidate_value"]),
    }
    payload["unchanged_outcomes"] = tuple(unchanged)
    payload["not_comparable"] = (latency, source)
    payload["chart_series"] = payload["chart_series"][:-1]

    envelope = ComparisonEnvelope.model_validate(payload)
    assert tuple(item.dimension_id for item in envelope.not_comparable) == (
        "p95_policy_latency_ms",
        "policy_latency_source",
    )
    assert "p95_policy_latency_ms" not in {
        item.dimension_id for item in envelope.chart_series
    }


@pytest.mark.parametrize("retained_artifact", ("handoff-p1-nominal", "handoff-p4-fault"))
def test_round3_ttc_absence_uses_common_summary_evidence_for_unavailable_metric_and_point(
    retained_artifact: str,
) -> None:
    metric_payload = deepcopy(_metrics()[6])
    metric_payload["category"] = "NOT_AVAILABLE"
    metric_payload["availability"] = "NOT_AVAILABLE"
    metric_payload["unavailable_reason"] = "no paired closing front-object evidence"
    metric_payload["value"] = {"kind": "SCALAR", "value": _exact(None, "s")}
    metric_payload["source_references"] = (
        _ref("METRIC", "/minimum_ttc_s", sequence=None),
        _ref("EVENT", "/observation_summary", sequence=0),
    )
    metric = MetricItem.model_validate(metric_payload)

    point = Point(
        sequence=0,
        simulation_time_s=0.1,
        category="NOT_AVAILABLE",
        availability="NOT_AVAILABLE",
        unavailable_reason="no paired closing front-object evidence",
        scalar_value=ExactValue(**_exact(None, "s")),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=SourceReference.model_validate(
            _ref("EVENT", "/observation_summary", sequence=0)
        ),
    )
    track = Track(
        track_id="ttc_s",
        label=f"TTC from {retained_artifact}",
        category="COMPUTED",
        availability="AVAILABLE",
        unavailable_reason=None,
        value_kind="SCALAR",
        points=(point,),
        source_references=(
            SourceReference.model_validate(
                _ref("EVENT", "/observation_summary", sequence=0)
            ),
        ),
    )

    assert metric.source_references[1].json_pointer == "/observation_summary"
    assert track.points[0].availability == "NOT_AVAILABLE"


def test_round3_ttc_common_summary_absence_requires_an_unavailable_point() -> None:
    point = Point(
        sequence=0,
        simulation_time_s=0.1,
        category="COMPUTED",
        availability="AVAILABLE",
        unavailable_reason=None,
        scalar_value=ExactValue(**_exact(2.0, "s")),
        action_value=None,
        observation_value=None,
        string_list_value=None,
        source_reference=SourceReference.model_validate(
            _ref("EVENT", "/observation_summary", sequence=0)
        ),
    )
    with pytest.raises(ValidationError):
        Track(
            track_id="ttc_s",
            label="TTC",
            category="COMPUTED",
            availability="AVAILABLE",
            unavailable_reason=None,
            value_kind="SCALAR",
            points=(point,),
            source_references=(
                SourceReference.model_validate(
                    _ref("EVENT", "/observation_summary", sequence=0)
                ),
            ),
        )


@pytest.mark.parametrize(
    ("distance_pointer", "speed_pointer"),
    (
        (
            "/observation_summary/result_front_distance_m",
            "/observation_summary/result_front_relative_speed_mps",
        ),
        (
            "/observation_summary/front_distance_m",
            "/observation_summary/front_relative_speed_mps",
        ),
    ),
)
def test_round3_available_ttc_metric_allows_mixed_absence_and_eligible_event_sources(
    distance_pointer: str,
    speed_pointer: str,
) -> None:
    payload = deepcopy(_metrics()[6])
    payload["value"] = {"kind": "SCALAR", "value": _exact(2.0, "s")}
    payload["source_references"] = (
        _ref("METRIC", "/minimum_ttc_s", sequence=None),
        _ref("EVENT", "/observation_summary", sequence=0),
        _ref("EVENT", distance_pointer, sequence=1),
        _ref("EVENT", speed_pointer, sequence=1),
    )
    metric = MetricItem.model_validate(payload)
    assert metric.availability == "AVAILABLE"
    assert tuple(reference.event_sequence for reference in metric.source_references[1:]) == (
        0,
        1,
        1,
    )


@pytest.mark.parametrize("schema", ("1.0", "2.0"))
def test_round3_valid_schema_envelope_retains_ttc_common_record_absence(schema: str) -> None:
    payload = _review_payload(schema)
    metric = payload["metrics"][6]
    metric.update(
        {
            "category": "NOT_AVAILABLE",
            "availability": "NOT_AVAILABLE",
            "unavailable_reason": "front-object TTC evidence is unavailable for this trace",
            "value": {"kind": "SCALAR", "value": _exact(None, "s")},
            "source_references": (
                _ref("METRIC", "/minimum_ttc_s", sequence=None),
                _ref("EVENT", "/observation_summary", sequence=0),
            ),
        }
    )
    track = payload["timeline"]["tracks"][13]
    track["points"][0].update(
        {
            "category": "NOT_AVAILABLE",
            "availability": "NOT_AVAILABLE",
            "unavailable_reason": "no paired closing front-object evidence",
            "scalar_value": _exact(None, "s"),
        }
    )
    track["source_references"] = (
        _ref("EVENT", "/observation_summary", sequence=0),
    )
    envelope = ReviewEnvelope.model_validate(payload)
    assert envelope.metrics[6].availability == "NOT_AVAILABLE"
    assert envelope.timeline.tracks[13].points[0].availability == "NOT_AVAILABLE"


def test_round3_probe_finding_supporting_sequences_stay_within_timeline() -> None:
    payload = _review_payload()
    payload["findings"][1]["supporting_event_sequences"] = (1,)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round3_probe_failed_finding_time_matches_first_supporting_event() -> None:
    payload = _review_payload()
    finding = payload["findings"][1]
    finding["status"] = "FAIL"
    finding["severity"] = "ERROR"
    finding["measured"] = _exact(1, "count")
    finding["first_failure_simulation_time_s"] = 999.0
    finding["supporting_event_sequences"] = (0,)
    finding["consequence"] = {
        **finding["consequence"],
        "triggered": True,
        "effect": "HOLD",
        "result_if_controlling": "HOLD",
        "listed_in_hard_failures": True,
    }
    payload["gate"]["verdict"] = "HOLD"
    payload["gate"]["hard_failure_ids"] = ("collision.zero",)
    verifier_track = payload["timeline"]["tracks"][-1]
    verifier_track["points"][0]["string_list_value"] = {"values": ("collision.zero",)}
    verifier_track["source_references"] = (_ref("FINDING", "/findings/1", sequence=None),)
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round3_probe_timeline_times_are_strictly_increasing() -> None:
    def point(sequence: int) -> Point:
        source = SourceReference.model_validate(
            _ref("EVENT", "/vehicle_state/speed_mps", sequence=sequence)
        )
        return Point(
            sequence=sequence,
            simulation_time_s=0.5,
            category="OBSERVED",
            availability="AVAILABLE",
            unavailable_reason=None,
            scalar_value=ExactValue(**_exact(1.0, "m/s")),
            action_value=None,
            observation_value=None,
            string_list_value=None,
            source_reference=source,
        )

    points = (point(0), point(1))
    track = Track(
        track_id="speed_mps",
        label="speed",
        category="OBSERVED",
        availability="AVAILABLE",
        unavailable_reason=None,
        value_kind="SCALAR",
        points=points,
        source_references=tuple(item.source_reference for item in points),
    )
    with pytest.raises(ValidationError):
        Timeline(
            event_count=2,
            simulation_start_s=0.5,
            simulation_end_s=0.5,
            tracks=(track,),
            category="OBSERVED",
        )


@pytest.mark.parametrize("schema_field", ("evidence_schema_version", "scenario_schema_version"))
def test_round3_probe_compatible_comparison_sides_require_matching_schema_keys(
    schema_field: str,
) -> None:
    payload = _comparison_payload()
    payload["candidate"]["artifact"]["manifest_identity"][schema_field] = (
        "1.0" if schema_field == "evidence_schema_version" else "4.0"
    )
    with pytest.raises(ValidationError):
        ComparisonEnvelope.model_validate(payload)


@pytest.mark.parametrize(
    ("artifact_or_gate_field", "provenance_field"),
    (
        ("gate_name", "gate_name"),
        ("gate_version", "gate_version"),
        ("gate_config_digest_sha256", "gate_config_digest"),
        ("scenario_schema_version", "scenario_schema_version"),
    ),
)
def test_round3_probe_valid_gate_and_scenario_identity_match_recorded_provenance(
    artifact_or_gate_field: str,
    provenance_field: str,
) -> None:
    payload = _review_payload()
    if artifact_or_gate_field == "scenario_schema_version":
        payload["artifact"]["manifest_identity"][artifact_or_gate_field] = "4.0"
    else:
        payload["gate"][artifact_or_gate_field] = (
            "different" if artifact_or_gate_field != "gate_config_digest_sha256" else "f" * 64
        )
    assert payload["provenance"]["recorded"][provenance_field] != (
        payload["artifact"]["manifest_identity"].get(artifact_or_gate_field)
        if artifact_or_gate_field == "scenario_schema_version"
        else payload["gate"][artifact_or_gate_field]
    )
    with pytest.raises(ValidationError):
        ReviewEnvelope.model_validate(payload)


def test_round3_comparison_accepts_internally_consistent_invalid_gate_side() -> None:
    payload = _comparison_payload()
    payload["baseline"]["gate_verdict"] = "INVALID_EVIDENCE"
    payload["verdict_delta"]["baseline_value"] = {
        "kind": "SCALAR",
        "value": _exact("INVALID_EVIDENCE"),
    }
    payload["verdict_delta"]["status"] = "NOT_COMPARABLE"
    envelope = ComparisonEnvelope.model_validate(payload)
    assert envelope.baseline.integrity == "INTERNALLY_CONSISTENT"
    assert envelope.baseline.gate_verdict == "INVALID_EVIDENCE"
    assert envelope.verdict_delta.status == "NOT_COMPARABLE"


def test_round3_core_invalid_gate_remains_accepted_under_consistent_integrity() -> None:
    inspection = inspect_artifact(Path("artifacts/handoff-p1-nominal"))
    assert inspection.snapshot is not None
    snapshot = inspection.snapshot
    gate_payload = snapshot.gate_config.model_dump(mode="json")
    gate_payload["hard"]["missing_required_evidence"] = "INVALID_EVIDENCE"
    invalid_on_missing = GateConfig.model_validate(gate_payload)
    findings = list(snapshot.findings.findings)
    progress_index = next(
        index for index, finding in enumerate(findings) if finding.finding_id == "progress.required"
    )
    original_progress = findings[progress_index]
    findings[progress_index] = Finding(
        finding_id=original_progress.finding_id,
        verifier=original_progress.verifier,
        verifier_version=original_progress.verifier_version,
        status=FindingStatus.NOT_AVAILABLE,
        severity=original_progress.severity,
        hard_invariant=original_progress.hard_invariant,
        threshold_or_invariant=original_progress.threshold_or_invariant,
        measurement=Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            value=None,
            unit="%",
            reason="route progress explicitly unavailable",
        ),
        message="route progress explicitly unavailable",
        event_sequences=(),
        first_failure_time_s=None,
    )
    core = apply_release_gate(
        tuple(findings),
        invalid_on_missing,
        expected_profile=VerifierProfile.LEGACY,
    )
    assert core.verdict is Verdict.INVALID_EVIDENCE

    payload = _review_payload("1.0")
    progress = payload["findings"][3]
    consequence = {
        **progress["consequence"],
        "triggered": True,
        "effect": "CONFIGURED_MISSING_REQUIRED_EVIDENCE",
        "result_if_controlling": "INVALID_EVIDENCE",
        "source": "GATE_CONFIG_MISSING_REQUIRED_EVIDENCE",
        "listed_in_hard_failures": True,
        "configuration_references": (
            _ref("GATE_CONFIG", "/hard/missing_required_evidence"),
        ),
    }
    progress.update(
        {
            "status": "NOT_AVAILABLE",
            "category": "NOT_AVAILABLE",
            "measured": _exact(None, "%"),
            "evidence_availability": "NOT_AVAILABLE",
            "consequence": consequence,
        }
    )
    progress["threshold"]["children"][1]["clause"]["evidence_sources"] = (
        _ref("EVENT", "/raw_facts/route_progress_available", sequence=0),
        _ref("METRIC", "/route_completion_pct", sequence=None),
    )
    for index, finding in enumerate(payload["findings"]):
        if index != 3:
            finding["consequence"]["listed_in_supporting_findings"] = False
    payload["gate"].update(
        {
            "verdict": core.verdict.value,
            "hard_failure_ids": ("progress.required",),
            "supporting_finding_ids": ("progress.required",),
        }
    )
    sufficiency = payload["evidence_sufficiency"]
    sufficiency["summary"]["required_and_available"] -= 1
    sufficiency["summary"]["required_but_unavailable"] = 1
    sufficiency_item = sufficiency["items"][3]
    sufficiency_item.update(
        {
            "availability": "NOT_AVAILABLE",
            "reason": "route progress explicitly unavailable",
            "category": "NOT_AVAILABLE",
            "consequence": consequence,
        }
    )
    route_metric = payload["metrics"][5]
    route_metric.update(
        {
            "category": "NOT_AVAILABLE",
            "availability": "NOT_AVAILABLE",
            "unavailable_reason": "route progress explicitly unavailable",
            "value": {"kind": "SCALAR", "value": _exact(None, "%")},
            "source_references": (
                _ref("METRIC", "/route_completion_pct", sequence=None),
                _ref("EVENT", "/raw_facts/route_progress_available", sequence=0),
            ),
        }
    )
    route_track = payload["timeline"]["tracks"][12]
    route_track["points"][0].update(
        {
            "category": "NOT_AVAILABLE",
            "availability": "NOT_AVAILABLE",
            "unavailable_reason": "route progress explicitly unavailable",
            "scalar_value": _exact(None, "%"),
            "source_reference": _ref(
                "EVENT", "/raw_facts/route_progress_available", sequence=0
            ),
        }
    )
    route_track["source_references"] = (
        _ref("EVENT", "/raw_facts/route_progress_available", sequence=0),
    )
    payload["unavailable_evidence"] = (
        {
            "evidence_id": "progress.required",
            "label": "progress.required",
            "reason": "route progress explicitly unavailable",
            "requiredness": "REQUIRED",
            "consequence": consequence,
            "category": "NOT_AVAILABLE",
            "source_references": (),
        },
    )
    envelope = ReviewEnvelope.model_validate(payload)
    assert envelope.verification.integrity == "INTERNALLY_CONSISTENT"
    assert envelope.gate.verdict == "INVALID_EVIDENCE"
    assert envelope.gate.accepted_recomputation is True


def _assert_exact_ordered_mapping(
    actual: Mapping[object, object],
    expected: Mapping[object, object],
) -> None:
    assert tuple(actual.items()) == tuple(expected.items())


def test_normative_review_registries_preserve_exact_values_and_order() -> None:
    expected_file_order = {
        "manifest.json": 0,
        "execution-context.json": 1,
        "scenario.resolved.yaml": 2,
        "gate-config.resolved.yaml": 3,
        "events.jsonl": 4,
        "metrics.json": 5,
        "findings.json": 6,
        "verdict.json": 7,
        "trace.sha256": 8,
        "bundle.sha256": 9,
    }
    expected_source_files = {
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
    expected_metric_registry = {
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
        "shield_override_reasons": (
            "occurrences",
            "DESCRIPTIVE",
            "STRING_COUNT_MAP",
        ),
        "termination_reason": (None, "DESCRIPTIVE", "SCALAR"),
        "fault_application_counts": (
            "occurrences",
            "DESCRIPTIVE",
            "STRING_COUNT_MAP",
        ),
        "max_observation_age_s": ("s", "LOWER", "SCALAR"),
        "p95_control_latency_ms": ("ms", "LOWER", "SCALAR"),
        "control_fill_count": ("events", "DESCRIPTIVE", "SCALAR"),
        "steering_saturation_count": ("events", "LOWER", "SCALAR"),
        "brake_saturation_count": ("events", "LOWER", "SCALAR"),
    }
    expected_metric_event_pointers = {
        "event_count": frozenset({""}),
        "simulation_duration_s": frozenset({"/simulation_time_s"}),
        "collision_count": frozenset({"/vehicle_state/collision_count"}),
        "max_abs_lateral_offset_m": frozenset(
            {"/vehicle_state/lateral_offset_m"}
        ),
        "offroad_duration_s": frozenset({"/vehicle_state/offroad"}),
        "route_completion_pct": frozenset(
            {
                "/raw_facts/route_progress_available",
                "/vehicle_state/route_progress_pct",
            }
        ),
        "minimum_ttc_s": frozenset(
            {
                "/observation_summary",
                "/observation_summary/result_front_distance_m",
                "/observation_summary/result_front_relative_speed_mps",
                "/observation_summary/front_distance_m",
                "/observation_summary/front_relative_speed_mps",
            }
        ),
        "max_abs_acceleration_mps2": frozenset(
            {"/vehicle_state/acceleration_mps2"}
        ),
        "max_abs_jerk_mps3": frozenset({"/vehicle_state/acceleration_mps2"}),
        "p95_policy_latency_ms": frozenset({"/policy_latency_ms"}),
        "shield_override_count": frozenset(
            {"/candidate_action", "/permitted_action", "/executed_action"}
        ),
        "shield_override_reasons": frozenset({"/override_reasons"}),
        "termination_reason": frozenset({"/termination_reason"}),
        "fault_application_counts": frozenset(
            {
                "/observation_fault_evidence/applied_faults",
                "/control_fault_evidence/applied_faults",
            }
        ),
        "max_observation_age_s": frozenset(
            {
                "/observation_fault_evidence/delivered_observation/observation_age_s"
            }
        ),
        "p95_control_latency_ms": frozenset(
            {"/control_fault_evidence/control_latency_ms/value"}
        ),
        "control_fill_count": frozenset(
            {
                "/observation_fault_evidence/applied_faults",
                "/control_fault_evidence/applied_faults",
            }
        ),
        "steering_saturation_count": frozenset(
            {
                "/observation_fault_evidence/applied_faults",
                "/control_fault_evidence/applied_faults",
            }
        ),
        "brake_saturation_count": frozenset(
            {
                "/observation_fault_evidence/applied_faults",
                "/control_fault_evidence/applied_faults",
            }
        ),
    }
    expected_metric_aux_pointers = {
        "offroad_duration_s": frozenset(
            {("EXECUTION_CONTEXT", "/run_context/control_frequency_hz")}
        ),
        "max_abs_jerk_mps3": frozenset(
            {("EXECUTION_CONTEXT", "/run_context/control_frequency_hz")}
        ),
        "control_fill_count": frozenset(
            {("METRIC", "/fault_application_counts/CONTROL_DELAY_FILL")}
        ),
        "steering_saturation_count": frozenset(
            {("METRIC", "/fault_application_counts/STEERING_SATURATION")}
        ),
        "brake_saturation_count": frozenset(
            {("METRIC", "/fault_application_counts/BRAKE_SATURATION")}
        ),
    }
    expected_track_registry = {
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
    expected_track_point_pointers = {
        "raw_observation": frozenset(
            {"/observation_fault_evidence/raw_observation"}
        ),
        "delivered_observation": frozenset(
            {"/observation_fault_evidence/delivered_observation"}
        ),
        "result_observation": frozenset({"/result_observation"}),
        "candidate_action": frozenset({"/candidate_action"}),
        "permitted_action": frozenset({"/permitted_action"}),
        "executed_action": frozenset({"/executed_action"}),
        "override_reasons": frozenset({"/override_reasons"}),
        "observation_fault_reasons": frozenset(
            {"/observation_fault_evidence/applied_faults"}
        ),
        "control_fault_reasons": frozenset(
            {"/control_fault_evidence/applied_faults"}
        ),
        "collision_count": frozenset({"/vehicle_state/collision_count"}),
        "offroad": frozenset({"/vehicle_state/offroad"}),
        "speed_mps": frozenset({"/vehicle_state/speed_mps"}),
        "route_progress_pct": frozenset(
            {
                "/vehicle_state/route_progress_pct",
                "/raw_facts/route_progress_available",
            }
        ),
        "ttc_s": frozenset({"/observation_summary"}),
        "policy_latency_ms": frozenset({"/policy_latency_ms"}),
        "verifier_triggering_findings": frozenset({""}),
    }
    expected_scalar_track_units = {
        "collision_count": "collisions",
        "offroad": None,
        "speed_mps": "m/s",
        "route_progress_pct": "%",
        "ttc_s": "s",
        "policy_latency_ms": "ms",
    }

    _assert_exact_ordered_mapping(review_models.FILE_ORDER, expected_file_order)
    _assert_exact_ordered_mapping(review_models.SOURCE_FILES, expected_source_files)
    _assert_exact_ordered_mapping(
        review_models.METRIC_REGISTRY,
        expected_metric_registry,
    )
    _assert_exact_ordered_mapping(
        review_models.METRIC_EVENT_POINTERS,
        expected_metric_event_pointers,
    )
    _assert_exact_ordered_mapping(
        review_models.METRIC_AUX_POINTERS,
        expected_metric_aux_pointers,
    )
    assert frozenset(
        {
            "route_completion_pct",
            "minimum_ttc_s",
            "max_abs_acceleration_mps2",
            "max_abs_jerk_mps3",
            "p95_policy_latency_ms",
            "max_observation_age_s",
            "p95_control_latency_ms",
        }
    ) == review_models.MEASUREMENT_METRICS
    _assert_exact_ordered_mapping(
        review_models.TRACK_REGISTRY,
        expected_track_registry,
    )
    _assert_exact_ordered_mapping(
        review_models.TRACK_POINT_POINTERS,
        expected_track_point_pointers,
    )
    _assert_exact_ordered_mapping(
        review_models.SCALAR_TRACK_UNITS,
        expected_scalar_track_units,
    )
    assert frozenset(
        {
            "raw_observation",
            "delivered_observation",
            "result_observation",
            "permitted_action",
            "observation_fault_reasons",
            "control_fault_reasons",
        }
    ) == review_models.LEGACY_UNAVAILABLE_TRACKS


@pytest.mark.parametrize(
    ("registry_name", "key", "replacement"),
    [
        ("FILE_ORDER", "manifest.json", 99),
        ("SOURCE_FILES", "MANIFEST", "verdict.json"),
        ("METRIC_REGISTRY", "event_count", (None, "NONE", "SCALAR")),
        ("METRIC_EVENT_POINTERS", "event_count", frozenset({"/injected"})),
        (
            "METRIC_AUX_POINTERS",
            "offroad_duration_s",
            frozenset({("MANIFEST", "/injected")}),
        ),
        ("TRACK_REGISTRY", "candidate_action", ("SCALAR", "NOT_AVAILABLE")),
        (
            "TRACK_POINT_POINTERS",
            "candidate_action",
            frozenset({"/injected"}),
        ),
        ("SCALAR_TRACK_UNITS", "speed_mps", "bananas"),
    ],
)
def test_normative_review_mapping_registries_reject_mutation(
    registry_name: str,
    key: str,
    replacement: object,
) -> None:
    registry = getattr(review_models, registry_name)
    before = tuple(registry.items())
    try:
        with pytest.raises(TypeError):
            registry[key] = replacement
    finally:
        if tuple(registry.items()) != before:
            registry.clear()
            registry.update(before)
    assert tuple(registry.items()) == before


@pytest.mark.parametrize(
    ("registry_name", "injected_value"),
    [
        ("MEASUREMENT_METRICS", "event_count"),
        ("LEGACY_UNAVAILABLE_TRACKS", "speed_mps"),
    ],
)
def test_normative_review_set_registries_reject_mutation(
    registry_name: str,
    injected_value: str,
) -> None:
    registry = getattr(review_models, registry_name)
    before = frozenset(registry)
    try:
        with pytest.raises(AttributeError):
            registry.add(injected_value)
    finally:
        if injected_value not in before and hasattr(registry, "discard"):
            registry.discard(injected_value)
    assert frozenset(registry) == before
