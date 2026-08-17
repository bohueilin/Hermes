from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
from typer.testing import CliRunner

from hermes.cli import app
from hermes.domain.enums import Verdict
from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES
from hermes.review import canonical_envelope_bytes, review_artifact
from hermes.runtime.orchestrator import execute_fake_run

_RUN_ID = "handoff-p7-evidence-availability"
_SCENARIO_BYTES = b"""schema_version: "1.0"
name: fake_evidence_availability
version: "1.0"
description: Forced one-event presentation fixture for typed evidence availability review.
adapter: fake
control:
  frequency_hz: 10
  horizon_steps: 1
  target_speed_mps: 8.0
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 20.0
  boundary_tolerance_m: 1.5
hazards:
  unavailable_progress: true
"""
_FINDING_IDS = (
    "trace.integrity",
    "collision.zero",
    "boundary.within_tolerance",
    "progress.required",
    "comfort.acceleration",
    "comfort.jerk",
)
_SUFFICIENCY_IDS = _FINDING_IDS + ("fault.coverage.required",)
_METRIC_IDS = (
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
_UNAVAILABLE_TRACK_IDS = {
    "raw_observation",
    "delivered_observation",
    "result_observation",
    "permitted_action",
    "observation_fault_reasons",
    "control_fault_reasons",
}
_RUNNER = CliRunner()


def _hashes(bundle: Path) -> dict[str, str]:
    return {
        name: hashlib.sha256((bundle / name).read_bytes()).hexdigest()
        for name in REQUIRED_ARTIFACT_FILES
    }


@pytest.fixture
def availability_bundle(repository_root: Path, tmp_path: Path) -> tuple[Path, object]:
    scenario = repository_root / "scenarios" / "fake_evidence_availability.yaml"
    assert scenario.read_bytes() == _SCENARIO_BYTES
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    outcome = execute_fake_run(
        scenario_path=scenario,
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id=_RUN_ID,
        artifact_root=artifact_root,
        repository_root=repository_root,
    )

    assert outcome.verdict is Verdict.HOLD
    return artifact_root, outcome


def test_phase7_availability_fixture_uses_normal_pipeline_and_exact_semantics(
    availability_bundle: tuple[Path, object],
) -> None:
    artifact_root, outcome = availability_bundle
    bundle = outcome.artifact_path
    assert bundle == artifact_root / _RUN_ID
    assert tuple(sorted(path.name for path in bundle.iterdir())) == tuple(
        sorted(REQUIRED_ARTIFACT_FILES)
    )

    before = _hashes(bundle)
    envelope = review_artifact(artifact_root, _RUN_ID)

    assert envelope.artifact.locator.selected_relative_path == _RUN_ID
    assert envelope.artifact.manifest_identity.run_id == _RUN_ID
    assert envelope.artifact.manifest_identity.evidence_schema_version == "1.0"
    assert envelope.artifact.manifest_identity.scenario_schema_version == "1.0"
    assert envelope.verification.integrity == "INTERNALLY_CONSISTENT"
    assert envelope.gate.verdict == "HOLD"
    assert envelope.gate.rationale == (
        "Required mission evidence is NOT_AVAILABLE; advancement fails closed.",
    )
    assert envelope.gate.hard_failure_ids == ("progress.required",)
    assert envelope.gate.soft_failure_ids == ("comfort.jerk",)
    assert envelope.gate.supporting_finding_ids == (
        "progress.required",
        "comfort.jerk",
    )
    assert envelope.evidence_sufficiency.profile_name == "legacy"
    assert envelope.evidence_sufficiency.profile_version == "1.0"

    trust = {item.dimension: item.value for item in envelope.trust.records}
    assert trust == {
        "authenticity": "NOT_AUTHENTICATED",
        "authorization": "NOT_EVALUATED",
        "deployment_permission": "NONE",
        "scope": "SIMULATION_ONLY",
        "authoritative_status": "NOT_DEFINED",
    }

    assert tuple(item.finding_id for item in envelope.findings) == _FINDING_IDS
    assert len(envelope.findings) == 6
    findings = {item.finding_id: item for item in envelope.findings}
    expected_findings = {
        "trace.integrity": ("REQUIRED", "PASS", "AVAILABLE", 1.0, "events", "NO_EFFECT"),
        "collision.zero": ("REQUIRED", "PASS", "AVAILABLE", 0.0, "count", "NO_EFFECT"),
        "boundary.within_tolerance": (
            "REQUIRED",
            "PASS",
            "AVAILABLE",
            0.0,
            "m",
            "NO_EFFECT",
        ),
        "progress.required": (
            "REQUIRED",
            "NOT_AVAILABLE",
            "NOT_AVAILABLE",
            None,
            "%",
            "CONFIGURED_MISSING_REQUIRED_EVIDENCE",
        ),
        "comfort.acceleration": (
            "OPTIONAL",
            "PASS",
            "AVAILABLE",
            3.0,
            "m/s^2",
            "NO_EFFECT",
        ),
        "comfort.jerk": (
            "OPTIONAL",
            "NOT_AVAILABLE",
            "NOT_AVAILABLE",
            None,
            "m/s^3",
            "CONDITIONAL",
        ),
    }
    for finding_id, expected in expected_findings.items():
        finding = findings[finding_id]
        actual = (
            finding.requiredness,
            finding.status,
            finding.evidence_availability,
            finding.measured.machine_value,
            finding.measured.unit,
            finding.consequence.effect,
        )
        assert actual == expected
    assert findings["progress.required"].explanation.endswith(
        "route progress explicitly unavailable"
    )
    jerk = findings["comfort.jerk"]
    assert jerk.explanation.endswith("at least two events are required to compute jerk")
    assert jerk.consequence.result_if_controlling == "CONDITIONAL"
    assert jerk.consequence.listed_in_soft_failures is True
    assert jerk.consequence.listed_in_supporting_findings is True

    sufficiency = envelope.evidence_sufficiency
    assert tuple(item.evidence_id for item in sufficiency.items) == _SUFFICIENCY_IDS
    assert len(sufficiency.items) == 7
    assert sufficiency.summary.model_dump() == {
        "required_and_available": 3,
        "required_but_unavailable": 1,
        "optional_and_available": 1,
        "optional_and_unavailable": 1,
        "not_applicable": 1,
    }
    by_id = {item.evidence_id: item for item in sufficiency.items}
    assert by_id["progress.required"].reason == "route progress explicitly unavailable"
    assert by_id["comfort.jerk"].reason == (
        "at least two events are required to compute jerk"
    )
    not_applicable = by_id["fault.coverage.required"]
    assert (
        not_applicable.requirement,
        not_applicable.availability,
        not_applicable.reason,
        not_applicable.consequence.effect,
    ) == (
        "NOT_APPLICABLE",
        "NOT_APPLICABLE",
        "Not applicable to the legacy verifier profile",
        "NO_EFFECT",
    )

    assert tuple(item.metric_id for item in envelope.metrics) == _METRIC_IDS
    assert len(envelope.metrics) == 13
    metrics = {item.metric_id: item for item in envelope.metrics}
    scalar_values = {
        metric_id: metric.value.value.machine_value
        for metric_id, metric in metrics.items()
        if metric.value.kind == "SCALAR"
    }
    assert scalar_values == {
        "event_count": 1,
        "simulation_duration_s": 0.1,
        "collision_count": 0,
        "max_abs_lateral_offset_m": 0.0,
        "offroad_duration_s": 0.0,
        "route_completion_pct": None,
        "minimum_ttc_s": None,
        "max_abs_acceleration_mps2": 3.0,
        "max_abs_jerk_mps3": None,
        "p95_policy_latency_ms": 10.0,
        "shield_override_count": 0,
        "termination_reason": "HORIZON",
    }
    assert metrics["route_completion_pct"].unavailable_reason == (
        "route progress explicitly unavailable"
    )
    assert metrics["minimum_ttc_s"].unavailable_reason == (
        "front-object TTC evidence is unavailable for this trace"
    )
    assert metrics["max_abs_jerk_mps3"].unavailable_reason == (
        "at least two events are required to compute jerk"
    )
    assert metrics["shield_override_reasons"].value.model_dump(mode="json") == {
        "kind": "STRING_COUNT_MAP",
        "values": {},
    }

    assert envelope.timeline.event_count == 1
    assert envelope.timeline.simulation_start_s == 0.1
    assert envelope.timeline.simulation_end_s == 0.1
    assert len(envelope.timeline.tracks) == 16
    unavailable_tracks = {
        track.track_id
        for track in envelope.timeline.tracks
        if track.availability == "NOT_AVAILABLE"
    }
    assert unavailable_tracks == _UNAVAILABLE_TRACK_IDS
    for track in envelope.timeline.tracks:
        assert len(track.points) == (0 if track.track_id in _UNAVAILABLE_TRACK_IDS else 1)
    route_track = next(
        track for track in envelope.timeline.tracks if track.track_id == "route_progress_pct"
    )
    route_point = route_track.points[0]
    assert route_track.availability == "AVAILABLE"
    assert route_point.sequence == 0
    assert route_point.simulation_time_s == 0.1
    assert route_point.availability == "NOT_AVAILABLE"
    assert route_point.category == "NOT_AVAILABLE"
    assert route_point.scalar_value.machine_value is None
    assert route_point.scalar_value.canonical_text is None
    assert route_point.scalar_value.display_text == "NOT_AVAILABLE"
    assert route_point.scalar_value.unit == "%"
    assert route_point.unavailable_reason == "route progress explicitly unavailable"
    assert route_point.source_reference.json_pointer == "/raw_facts/route_progress_available"
    ttc_track = next(track for track in envelope.timeline.tracks if track.track_id == "ttc_s")
    assert ttc_track.points[0].availability == "NOT_AVAILABLE"
    assert ttc_track.points[0].unavailable_reason == (
        "no paired closing front-object evidence"
    )
    assert _hashes(bundle) == before


def test_phase7_availability_fixture_cli_parity_and_review_are_byte_immutable(
    availability_bundle: tuple[Path, object],
) -> None:
    artifact_root, outcome = availability_bundle
    bundle = outcome.artifact_path
    before = _hashes(bundle)
    envelope = review_artifact(artifact_root, _RUN_ID)

    json_result = _RUNNER.invoke(
        app,
        [
            "review-artifact",
            _RUN_ID,
            "--artifact-root",
            str(artifact_root),
            "--format",
            "json",
        ],
    )
    text_result = _RUNNER.invoke(
        app,
        [
            "review-artifact",
            _RUN_ID,
            "--artifact-root",
            str(artifact_root),
            "--format",
            "text",
        ],
    )

    assert json_result.exit_code == 0
    assert json_result.output.encode("utf-8") == canonical_envelope_bytes(envelope) + b"\n"
    assert text_result.exit_code == 0
    for expected in (
        "Gate verdict: HOLD",
        "Evidence integrity: INTERNALLY_CONSISTENT",
        '"evidence_id":"progress.required"',
        '"availability":"NOT_AVAILABLE"',
        '"reason":"route progress explicitly unavailable"',
        '"effect":"CONFIGURED_MISSING_REQUIRED_EVIDENCE"',
        '"evidence_id":"comfort.jerk"',
        '"reason":"at least two events are required to compute jerk"',
        '"effect":"CONDITIONAL"',
        '"evidence_id":"fault.coverage.required"',
        '"availability":"NOT_APPLICABLE"',
        "Track: route_progress_pct | availability=AVAILABLE",
        "Track: ttc_s | availability=AVAILABLE",
    ):
        assert expected in text_result.output
    assert "comparison delta" not in text_result.output.lower()
    assert _hashes(bundle) == before
