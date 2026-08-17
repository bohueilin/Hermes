from __future__ import annotations

import hashlib
import json
import shlex
from pathlib import Path

import pytest
import yaml
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


_CHECKPOINT_A_COMMIT = "b101fc02b0e5377b3d1e636c5a817ace734c720a"
_HISTORICAL_GENERATION_REASON = (
    "No retained evidence establishes the exact historical generation command."
)
_GENERATION_COMMAND = (
    "conda run -n hermes-dev python -m hermes run --simulator fake "
    "--scenario scenarios/fake_evidence_availability.yaml --policy baseline "
    "--seed 7 --run-id handoff-p7-evidence-availability "
    "--gate-config config/gates.phase1.yaml --shield noop"
)


def _review_command(locator: str) -> str:
    return (
        f"hermes review-artifact {locator} --artifact-root artifacts --format json"
    )


def _compare_command(baseline: str, candidate: str) -> str:
    return (
        f"hermes review-compare {baseline} {candidate} "
        "--artifact-root artifacts --format json"
    )


_FIXTURE_IDENTITIES = {
    "task1_nominal": {
        "locator": "handoff-phase5-demo",
        "manifest_run_id": "handoff-phase5-demo",
        "observed_bundle_digest_sha256": (
            "fd42b8399ba32853a587a63fee7aba9803c5918539b6053b1554937abcc13334"
        ),
        "computed_bundle_digest_sha256": (
            "fd42b8399ba32853a587a63fee7aba9803c5918539b6053b1554937abcc13334"
        ),
        "observed_trace_digest_sha256": (
            "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e"
        ),
        "computed_trace_digest_sha256": (
            "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "1.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "PASS",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [1, 10],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task2_collision": {
        "locator": "handoff-p1-collision",
        "manifest_run_id": "handoff-p1-collision",
        "observed_bundle_digest_sha256": (
            "723e814d0aea399dc2590dd0f1d5b09b20a03a28cadb49c062610894049ae27c"
        ),
        "computed_bundle_digest_sha256": (
            "723e814d0aea399dc2590dd0f1d5b09b20a03a28cadb49c062610894049ae27c"
        ),
        "observed_trace_digest_sha256": (
            "ecaa3b9222612044349b643c44406c2088cfb335b07f7bf4da56ac587bb76a24"
        ),
        "computed_trace_digest_sha256": (
            "ecaa3b9222612044349b643c44406c2088cfb335b07f7bf4da56ac587bb76a24"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "1.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "HOLD",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [2],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task3_tampered": {
        "locator": "phase1-tampered",
        "manifest_run_id": "phase1-nominal",
        "observed_bundle_digest_sha256": (
            "6eac41695c890dd08758bc6da95e8ae0092d9120057af4693fc64847017d97de"
        ),
        "computed_bundle_digest_sha256": (
            "831f22ed419e4b13ce5d0a1aa3bc1444b2ca523d60edb8d4c75eaa7491e1d61e"
        ),
        "observed_trace_digest_sha256": (
            "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e"
        ),
        "computed_trace_digest_sha256": None,
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "1.0",
        "verifier_profile_name": None,
        "verifier_profile_version": None,
        "session_review_expected_gate": "INVALID_EVIDENCE",
        "session_review_expected_integrity": "INVALID_EVIDENCE",
        "task_ids": [3],
        "manifest_repository_commit": None,
        "manifest_repository_dirty": None,
    },
    "task4_availability": {
        "locator": "handoff-p7-evidence-availability",
        "manifest_run_id": "handoff-p7-evidence-availability",
        "observed_bundle_digest_sha256": (
            "7eaf785fda100618d265c07dbecb994e22609714796a433b958b183e1995c12a"
        ),
        "computed_bundle_digest_sha256": (
            "7eaf785fda100618d265c07dbecb994e22609714796a433b958b183e1995c12a"
        ),
        "observed_trace_digest_sha256": (
            "14faefa9fe3b050195d44f094aa7e2effe5dbbf407719d81e042fe320923eda7"
        ),
        "computed_trace_digest_sha256": (
            "14faefa9fe3b050195d44f094aa7e2effe5dbbf407719d81e042fe320923eda7"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "1.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "HOLD",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [4],
        "manifest_repository_commit": _CHECKPOINT_A_COMMIT,
        "manifest_repository_dirty": False,
    },
    "task5_fault_accountability": {
        "locator": "handoff-p4-fault",
        "manifest_run_id": "handoff-p4-fault",
        "observed_bundle_digest_sha256": (
            "83ba9b39b764fb3f09f9fc70f2adfb42415a73ef3b43b655c1a639d49761c43f"
        ),
        "computed_bundle_digest_sha256": (
            "83ba9b39b764fb3f09f9fc70f2adfb42415a73ef3b43b655c1a639d49761c43f"
        ),
        "observed_trace_digest_sha256": (
            "c365813d9ebda590299830a68d1683e3d8f413bc7b4b43da13ea77c5678552af"
        ),
        "computed_trace_digest_sha256": (
            "c365813d9ebda590299830a68d1683e3d8f413bc7b4b43da13ea77c5678552af"
        ),
        "evidence_schema_version": "2.0",
        "scenario_schema_version": "3.0",
        "verifier_profile_name": "fault_coverage",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "HOLD",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [5],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task6_conditional": {
        "locator": "handoff-p1-conditional",
        "manifest_run_id": "handoff-p1-conditional",
        "observed_bundle_digest_sha256": (
            "752ba4725930d62335c1469ceebee6f7517d24265f8c945f68e45d2e7cb41cb4"
        ),
        "computed_bundle_digest_sha256": (
            "752ba4725930d62335c1469ceebee6f7517d24265f8c945f68e45d2e7cb41cb4"
        ),
        "observed_trace_digest_sha256": (
            "dfd8cc47423f8b93e70da1f5bcac00d21f363aec4a435da8ca9518b111704158"
        ),
        "computed_trace_digest_sha256": (
            "dfd8cc47423f8b93e70da1f5bcac00d21f363aec4a435da8ca9518b111704158"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "1.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "CONDITIONAL",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [6],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task7_cutin_baseline": {
        "locator": "handoff-p3-cutin-baseline",
        "manifest_run_id": "handoff-p3-cutin-baseline",
        "observed_bundle_digest_sha256": (
            "348336d29e572e15f7f7ecb21def162e608f8e169235c8da872a7cb4ebd97bff"
        ),
        "computed_bundle_digest_sha256": (
            "348336d29e572e15f7f7ecb21def162e608f8e169235c8da872a7cb4ebd97bff"
        ),
        "observed_trace_digest_sha256": (
            "00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5"
        ),
        "computed_trace_digest_sha256": (
            "00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "2.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "HOLD",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [7],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task7_cutin_candidate": {
        "locator": "handoff-p3-cutin-shielded",
        "manifest_run_id": "handoff-p3-cutin-shielded",
        "observed_bundle_digest_sha256": (
            "63377020423fe68053ca1153b95042f6b5ba15b83511b8f05c8226793993ea52"
        ),
        "computed_bundle_digest_sha256": (
            "63377020423fe68053ca1153b95042f6b5ba15b83511b8f05c8226793993ea52"
        ),
        "observed_trace_digest_sha256": (
            "7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae"
        ),
        "computed_trace_digest_sha256": (
            "7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "2.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "HOLD",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [7, 9],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task8_metadrive": {
        "locator": "handoff-p2-metadrive",
        "manifest_run_id": "handoff-p2-metadrive",
        "observed_bundle_digest_sha256": (
            "78b6b15f96b3e2c3aacdbd525031cd82b54ccf7f17e162b36cff9dfba436ab42"
        ),
        "computed_bundle_digest_sha256": (
            "78b6b15f96b3e2c3aacdbd525031cd82b54ccf7f17e162b36cff9dfba436ab42"
        ),
        "observed_trace_digest_sha256": (
            "2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987"
        ),
        "computed_trace_digest_sha256": (
            "2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "1.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "PASS",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [8],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "task9_lead_baseline": {
        "locator": "handoff-p3-lead-baseline",
        "manifest_run_id": "handoff-p3-lead-baseline",
        "observed_bundle_digest_sha256": (
            "016b65ece13edd33f08bbb6c9b46b14cfdecc1ca5a8ff090715a8254b3906c3e"
        ),
        "computed_bundle_digest_sha256": (
            "016b65ece13edd33f08bbb6c9b46b14cfdecc1ca5a8ff090715a8254b3906c3e"
        ),
        "observed_trace_digest_sha256": (
            "504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1"
        ),
        "computed_trace_digest_sha256": (
            "504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "2.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "CONDITIONAL",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [9],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
    "excluded_lead_shielded": {
        "locator": "handoff-p3-lead-shielded",
        "manifest_run_id": "handoff-p3-lead-shielded",
        "observed_bundle_digest_sha256": (
            "1541635cfd156cc86bd7b85cce559d2e81aaac8f17fb214ce38bd61c4aac8357"
        ),
        "computed_bundle_digest_sha256": (
            "1541635cfd156cc86bd7b85cce559d2e81aaac8f17fb214ce38bd61c4aac8357"
        ),
        "observed_trace_digest_sha256": (
            "7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380"
        ),
        "computed_trace_digest_sha256": (
            "7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380"
        ),
        "evidence_schema_version": "1.0",
        "scenario_schema_version": "2.0",
        "verifier_profile_name": "legacy",
        "verifier_profile_version": "1.0",
        "session_review_expected_gate": "CONDITIONAL",
        "session_review_expected_integrity": "INTERNALLY_CONSISTENT",
        "task_ids": [],
        "manifest_repository_commit": (
            "3c32c529e8be7127fbd71ecc467da007b2f72d5f"
        ),
        "manifest_repository_dirty": False,
    },
}


def _expected_fixture_records() -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for fixture_key, identity in _FIXTURE_IDENTITIES.items():
        is_new = fixture_key == "task4_availability"
        records.append(
            {
                "fixture_key": fixture_key,
                **identity,
                "generation_command": _GENERATION_COMMAND if is_new else None,
                "generation_command_status": (
                    "EXECUTED_FOR_THIS_FIXTURE" if is_new else "NOT_AVAILABLE"
                ),
                "generation_command_unavailable_reason": (
                    None if is_new else _HISTORICAL_GENERATION_REASON
                ),
                "session_review_command": _review_command(str(identity["locator"])),
                "session_review_expected_exit": (
                    30
                    if identity["session_review_expected_integrity"]
                    == "INVALID_EVIDENCE"
                    else 0
                ),
            }
        )
    return records


def _review_operation(
    fixture_key: str,
    expected_result: str,
    *,
    expected_exit: int = 0,
) -> dict[str, object]:
    return {
        "kind": "REVIEW",
        "exact_command": _review_command(
            str(_FIXTURE_IDENTITIES[fixture_key]["locator"])
        ),
        "expected_exit": expected_exit,
        "expected_result": expected_result,
    }


def _compare_operation(
    baseline_key: str,
    candidate_key: str,
    expected_result: str,
    *,
    expected_exit: int,
) -> dict[str, object]:
    return {
        "kind": "COMPARE",
        "exact_command": _compare_command(
            str(_FIXTURE_IDENTITIES[baseline_key]["locator"]),
            str(_FIXTURE_IDENTITIES[candidate_key]["locator"]),
        ),
        "expected_exit": expected_exit,
        "expected_result": expected_result,
    }


_EXPECTED_TASKS = [
    {
        "task_id": 1,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task1_nominal"],
        "north_star_included": True,
        "operations": [_review_operation("task1_nominal", "PASS")],
    },
    {
        "task_id": 2,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task2_collision"],
        "north_star_included": True,
        "operations": [_review_operation("task2_collision", "HOLD")],
    },
    {
        "task_id": 3,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task3_tampered"],
        "north_star_included": True,
        "operations": [
            _review_operation(
                "task3_tampered", "INVALID_EVIDENCE", expected_exit=30
            )
        ],
    },
    {
        "task_id": 4,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task4_availability"],
        "north_star_included": True,
        "operations": [_review_operation("task4_availability", "HOLD")],
    },
    {
        "task_id": 5,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task5_fault_accountability"],
        "north_star_included": True,
        "operations": [_review_operation("task5_fault_accountability", "HOLD")],
    },
    {
        "task_id": 6,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task6_conditional"],
        "north_star_included": True,
        "operations": [_review_operation("task6_conditional", "CONDITIONAL")],
    },
    {
        "task_id": 7,
        "task_version": "1.0",
        "ordered_fixture_keys": [
            "task7_cutin_baseline",
            "task7_cutin_candidate",
        ],
        "north_star_included": True,
        "operations": [
            _review_operation("task7_cutin_baseline", "HOLD"),
            _review_operation("task7_cutin_candidate", "HOLD"),
            _compare_operation(
                "task7_cutin_baseline",
                "task7_cutin_candidate",
                "COMPATIBLE",
                expected_exit=0,
            ),
        ],
    },
    {
        "task_id": 8,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task8_metadrive"],
        "north_star_included": True,
        "operations": [_review_operation("task8_metadrive", "PASS")],
    },
    {
        "task_id": 9,
        "task_version": "1.0",
        "ordered_fixture_keys": [
            "task9_lead_baseline",
            "task7_cutin_candidate",
        ],
        "north_star_included": True,
        "operations": [
            _review_operation("task9_lead_baseline", "CONDITIONAL"),
            _review_operation("task7_cutin_candidate", "HOLD"),
            _compare_operation(
                "task9_lead_baseline",
                "task7_cutin_candidate",
                "INCOMPATIBLE",
                expected_exit=40,
            ),
        ],
    },
    {
        "task_id": 10,
        "task_version": "1.0",
        "ordered_fixture_keys": ["task1_nominal"],
        "north_star_included": False,
        "operations": [_review_operation("task1_nominal", "PASS")],
    },
]

_EXPECTED_EXCLUDED_CONTROLS = [
    {
        "fixture_key": "excluded_lead_shielded",
        "locators": ["handoff-p3-lead-shielded"],
        "reason": (
            "The retained shielded lead fixture does not establish TTC-target "
            "entry or mechanism engagement."
        ),
        "prohibited_participant_use": (
            "TTC-mechanism engagement, causal-effect, winner, safety, or "
            "advancement evidence"
        ),
    },
    {
        "fixture_key": "excluded_lead_pair",
        "locators": [
            "handoff-p3-lead-baseline",
            "handoff-p3-lead-shielded",
        ],
        "reason": (
            "The retained lead baseline-to-shielded pair is a negative control "
            "for the failed TTC-mechanism claim."
        ),
        "prohibited_participant_use": (
            "TTC-mechanism engagement, causal-effect, winner, safety, or "
            "advancement evidence"
        ),
    },
]


def _digest_value(value: object) -> str | None:
    return None if value is None else value.value


def test_phase7_retained_registry_is_exact_fresh_and_executes_ordered_tasks(
    repository_root: Path,
) -> None:
    registry_path = repository_root / "config" / "phase7-fixture-registry.yaml"
    registry = yaml.safe_load(registry_path.read_text(encoding="utf-8"))

    assert set(registry) == {
        "registry_schema_version",
        "artifact_root",
        "fixtures",
        "tasks",
        "excluded_controls",
    }
    assert registry["registry_schema_version"] == "1.0"
    assert registry["artifact_root"] == "artifacts"
    assert registry["fixtures"] == _expected_fixture_records()
    assert registry["tasks"] == _EXPECTED_TASKS
    assert registry["excluded_controls"] == _EXPECTED_EXCLUDED_CONTROLS

    artifact_root = repository_root / registry["artifact_root"]
    expected_records = _expected_fixture_records()
    before = {
        str(record["locator"]): _hashes(artifact_root / str(record["locator"]))
        for record in expected_records
    }

    for record in expected_records:
        fixture_key = str(record["fixture_key"])
        locator = str(record["locator"])
        envelope = review_artifact(artifact_root, locator)
        artifact = envelope.artifact
        provenance = envelope.provenance.recorded

        assert artifact.locator.selected_relative_path == locator
        assert artifact.manifest_identity.run_id == record["manifest_run_id"]
        assert (
            _digest_value(artifact.observed_bundle_digest)
            == record["observed_bundle_digest_sha256"]
        )
        assert (
            _digest_value(artifact.computed_bundle_digest)
            == record["computed_bundle_digest_sha256"]
        )
        assert (
            _digest_value(artifact.observed_trace_digest)
            == record["observed_trace_digest_sha256"]
        )
        assert (
            _digest_value(artifact.computed_trace_digest)
            == record["computed_trace_digest_sha256"]
        )
        assert (
            artifact.manifest_identity.evidence_schema_version
            == record["evidence_schema_version"]
        )
        assert (
            artifact.manifest_identity.scenario_schema_version
            == record["scenario_schema_version"]
        )
        assert (
            envelope.evidence_sufficiency.profile_name
            == record["verifier_profile_name"]
        )
        assert (
            envelope.evidence_sufficiency.profile_version
            == record["verifier_profile_version"]
        )
        assert envelope.gate.verdict == record["session_review_expected_gate"]
        assert (
            envelope.verification.integrity
            == record["session_review_expected_integrity"]
        )
        assert provenance.hermes_git_commit == record["manifest_repository_commit"]
        assert provenance.hermes_git_dirty == record["manifest_repository_dirty"]

        if envelope.verification.integrity == "INTERNALLY_CONSISTENT":
            assert record["observed_bundle_digest_sha256"] == record[
                "computed_bundle_digest_sha256"
            ]
            assert record["observed_trace_digest_sha256"] == record[
                "computed_trace_digest_sha256"
            ]
        else:
            assert fixture_key == "task3_tampered"
            assert record["observed_bundle_digest_sha256"] != record[
                "computed_bundle_digest_sha256"
            ]
            assert record["computed_trace_digest_sha256"] is None

        is_new = fixture_key == "task4_availability"
        if record["generation_command_status"] == "EXECUTED_FOR_THIS_FIXTURE":
            assert is_new
            assert record["generation_command"] == _GENERATION_COMMAND
            assert record["generation_command_unavailable_reason"] is None
        else:
            assert record["generation_command_status"] == "NOT_AVAILABLE"
            assert not is_new
            assert record["generation_command"] is None
            assert (
                record["generation_command_unavailable_reason"]
                == _HISTORICAL_GENERATION_REASON
            )

    new_fixture = next(
        record
        for record in expected_records
        if record["fixture_key"] == "task4_availability"
    )
    assert new_fixture["manifest_repository_commit"] == _CHECKPOINT_A_COMMIT
    assert new_fixture["manifest_repository_dirty"] is False

    for task in registry["tasks"]:
        reviewed_locators: list[str] = []
        ordered_locators = [
            str(_FIXTURE_IDENTITIES[key]["locator"])
            for key in task["ordered_fixture_keys"]
        ]
        for operation in task["operations"]:
            arguments = shlex.split(operation["exact_command"])
            assert arguments[0] == "hermes"
            command = arguments[1]
            result = _RUNNER.invoke(app, arguments[1:])
            assert result.exit_code == operation["expected_exit"]
            payload = json.loads(result.output)

            if operation["kind"] == "REVIEW":
                assert command == "review-artifact"
                locator = arguments[2]
                assert locator in ordered_locators
                reviewed_locators.append(locator)
                assert payload["gate"]["verdict"] == operation["expected_result"]
            else:
                assert operation["kind"] == "COMPARE"
                assert command == "review-compare"
                baseline, candidate = arguments[2:4]
                assert [baseline, candidate] == ordered_locators
                assert baseline in reviewed_locators
                assert candidate in reviewed_locators
                comparison = payload.get("details", {}).get("comparison", payload)
                assert (
                    comparison["compatibility"]["status"]
                    == operation["expected_result"]
                )

    assert {
        str(record["locator"]): _hashes(artifact_root / str(record["locator"]))
        for record in expected_records
    } == before
