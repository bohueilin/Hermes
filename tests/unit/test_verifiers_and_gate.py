from __future__ import annotations

from pathlib import Path

import pytest

from hermes.domain.enums import (
    EvidenceAvailability,
    FindingStatus,
    Severity,
    TerminationReason,
    Verdict,
)
from hermes.domain.models import Action, Finding, Measurement, RunContext, VehicleState
from hermes.evidence.metrics import compute_metrics
from hermes.evidence.trace import GENESIS_HASH, create_trace_event
from hermes.gates.config import GateConfig, load_gate_config
from hermes.gates.release import (
    EVIDENCE_REQUIREMENTS_BY_PROFILE,
    EvidenceRequiredness,
    VerifierProfile,
    apply_release_gate,
)
from hermes.scenarios.loader import load_scenario
from hermes.verifiers import run_phase1_verifiers


def _context(*, horizon_steps: int = 20) -> RunContext:
    return RunContext(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="fake",
        adapter_version="1.0",
        adapter_config_digest="c" * 64,
        policy_name="baseline",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=horizon_steps,
    )


def _events(
    *,
    collision: bool = False,
    offroad: bool = False,
    acceleration: float = 1.0,
    progress_available: bool = True,
    destination_reached: bool = True,
):
    state = VehicleState(
        position_m=20.0,
        speed_mps=8.0,
        acceleration_mps2=acceleration,
        lateral_offset_m=1.75 if offroad else 0.0,
        route_progress_pct=100.0,
        collision_count=1 if collision else 0,
        offroad=offroad,
        destination_reached=destination_reached,
    )
    event = create_trace_event(
        sequence=0,
        simulation_time_s=0.1,
        run_context=_context(horizon_steps=1 if not destination_reached else 20),
        observation_summary={
            "input_sequence": 0,
            "input_simulation_time_s": 0.0,
            "speed_mps": 0.0,
            "lateral_offset_m": 0.0,
            "route_progress_pct": 0.0,
            "observation_age_s": 0.0,
        },
        candidate_action=Action(steering=0.0, throttle=0.0, brake=0.0),
        executed_action=Action(steering=0.0, throttle=0.0, brake=0.0),
        override_reasons=(),
        vehicle_state=state,
        policy_latency_ms=10.0,
        latency_source="simulated",
        terminated=destination_reached or collision or offroad,
        truncated=not (destination_reached or collision or offroad),
        termination_reason=(
            TerminationReason.COLLISION
            if collision
            else TerminationReason.OFF_ROAD
            if offroad
            else TerminationReason.DESTINATION_REACHED
            if destination_reached
            else TerminationReason.HORIZON
        ),
        raw_facts={
            "collision": collision,
            "collision_count": 1 if collision else 0,
            "offroad": offroad,
            "destination_reached": destination_reached,
            "route_progress_available": progress_available,
            "route_progress_pct": 100.0 if progress_available else None,
        },
        previous_hash=GENESIS_HASH,
    )
    return (event,)


def test_evidence_requirement_profiles_are_versioned_ordered_and_immutable() -> None:
    legacy = EVIDENCE_REQUIREMENTS_BY_PROFILE[VerifierProfile.LEGACY]
    fault_coverage = EVIDENCE_REQUIREMENTS_BY_PROFILE[VerifierProfile.FAULT_COVERAGE]

    assert legacy.version == "1.0"
    assert fault_coverage.version == "1.0"
    assert tuple(item.finding_id for item in legacy.requirements) == (
        "trace.integrity",
        "collision.zero",
        "boundary.within_tolerance",
        "progress.required",
        "comfort.acceleration",
        "comfort.jerk",
        "fault.coverage.required",
    )
    assert tuple(item.requiredness for item in legacy.requirements) == (
        EvidenceRequiredness.REQUIRED,
        EvidenceRequiredness.REQUIRED,
        EvidenceRequiredness.REQUIRED,
        EvidenceRequiredness.REQUIRED,
        EvidenceRequiredness.OPTIONAL,
        EvidenceRequiredness.OPTIONAL,
        EvidenceRequiredness.NOT_APPLICABLE,
    )
    assert fault_coverage.requirements[-1].requiredness is EvidenceRequiredness.REQUIRED
    with pytest.raises(TypeError):
        EVIDENCE_REQUIREMENTS_BY_PROFILE[VerifierProfile.LEGACY] = fault_coverage


def test_verifiers_emit_structured_hard_soft_and_unavailable_findings(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")

    collision_findings = {
        finding.finding_id: finding
        for finding in run_phase1_verifiers(_events(collision=True), scenario, gate)
    }
    comfort_findings = {
        finding.finding_id: finding
        for finding in run_phase1_verifiers(_events(acceleration=6.0), scenario, gate)
    }
    unavailable_findings = {
        finding.finding_id: finding
        for finding in run_phase1_verifiers(
            _events(progress_available=False), scenario, gate
        )
    }

    assert collision_findings["collision.zero"].status is FindingStatus.FAIL
    assert collision_findings["collision.zero"].severity is Severity.CRITICAL
    assert collision_findings["collision.zero"].threshold_or_invariant
    assert collision_findings["collision.zero"].first_failure_time_s == 0.1
    assert comfort_findings["comfort.acceleration"].status is FindingStatus.FAIL
    assert comfort_findings["comfort.acceleration"].hard_invariant is False
    assert comfort_findings["comfort.acceleration"].first_failure_time_s == 0.1
    assert unavailable_findings["progress.required"].status is FindingStatus.NOT_AVAILABLE
    assert unavailable_findings["progress.required"].measurement is not None
    assert unavailable_findings["progress.required"].measurement.reason
    assert unavailable_findings["comfort.jerk"].status is FindingStatus.NOT_AVAILABLE


def test_gate_precedence_cannot_average_away_hard_or_invalid_failures(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")

    collision_result = apply_release_gate(
        run_phase1_verifiers(_events(collision=True, acceleration=0.1), scenario, gate),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )
    invalid_finding = Finding(
        finding_id="trace.integrity",
        verifier="TraceIntegrityVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant="complete trace integrity",
        message="event chain mismatch",
        event_sequences=(0,),
        first_failure_time_s=0.1,
        measurement={
            "availability": EvidenceAvailability.AVAILABLE,
            "value": 1.0,
            "unit": "integrity_errors",
        },
    )
    invalid_result = apply_release_gate(
        (invalid_finding,) + collision_result.findings,
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert collision_result.verdict is Verdict.HOLD
    assert "collision.zero" in collision_result.hard_failures
    assert invalid_result.verdict is Verdict.INVALID_EVIDENCE


def test_gate_maps_soft_failure_to_conditional_and_required_unavailable_to_hold(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")

    conditional = apply_release_gate(
        run_phase1_verifiers(_events(acceleration=6.0), scenario, gate),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )
    unavailable = apply_release_gate(
        run_phase1_verifiers(_events(progress_available=False), scenario, gate),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )
    passing = apply_release_gate(
        run_phase1_verifiers(_events(), scenario, gate),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert conditional.verdict is Verdict.CONDITIONAL
    assert "comfort.acceleration" in conditional.soft_failures
    assert unavailable.verdict is Verdict.HOLD
    assert "NOT_AVAILABLE" in " ".join(unavailable.rationale)
    assert passing.verdict is Verdict.CONDITIONAL


def test_progress_requires_destination_even_when_numeric_threshold_is_met(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase2.yaml")

    findings = run_phase1_verifiers(
        _events(destination_reached=False), scenario, gate
    )
    progress = next(
        finding for finding in findings if finding.finding_id == "progress.required"
    )
    result = apply_release_gate(
        findings,
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert progress.status is FindingStatus.FAIL
    assert progress.verifier_version == "1.1"
    assert progress.message == "destination was not reached"
    assert result.verdict is Verdict.HOLD


def test_soft_measurement_unavailable_cannot_produce_pass(repository_root: Path) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")

    findings = run_phase1_verifiers(_events(), scenario, gate)
    by_id = {finding.finding_id: finding for finding in findings}
    result = apply_release_gate(
        findings,
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert by_id["comfort.jerk"].status is FindingStatus.NOT_AVAILABLE
    assert by_id["comfort.jerk"].measurement.reason
    assert result.verdict is Verdict.CONDITIONAL
    assert "comfort.jerk" in result.supporting_finding_ids


def test_offroad_state_fails_boundary_even_with_relaxed_lateral_threshold(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    payload = gate.model_dump(mode="json")
    payload["hard"]["max_abs_lateral_offset_m"] = 10.0
    payload["hard"]["min_route_completion_pct"] = 0.0
    relaxed_lateral_gate = GateConfig.model_validate(payload)

    findings = run_phase1_verifiers(_events(offroad=True), scenario, relaxed_lateral_gate)
    boundary = next(
        finding for finding in findings if finding.finding_id == "boundary.within_tolerance"
    )
    result = apply_release_gate(
        findings,
        relaxed_lateral_gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert boundary.status is FindingStatus.FAIL
    assert boundary.first_failure_time_s == 0.1
    assert result.verdict is Verdict.HOLD


def test_unavailable_collision_or_boundary_evidence_is_invalid(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    findings = list(run_phase1_verifiers(_events(), scenario, gate))
    collision = next(
        finding for finding in findings if finding.finding_id == "collision.zero"
    )
    unavailable_collision = Finding(
        finding_id=collision.finding_id,
        verifier=collision.verifier,
        verifier_version=collision.verifier_version,
        status=FindingStatus.NOT_AVAILABLE,
        severity=collision.severity,
        hard_invariant=True,
        threshold_or_invariant=collision.threshold_or_invariant,
        message="collision evidence is NOT_AVAILABLE",
        measurement=Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            unit="count",
            reason="adapter omitted the required signal",
        ),
    )
    findings[findings.index(collision)] = unavailable_collision

    result = apply_release_gate(
        tuple(findings),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "collision.zero" in result.hard_failures


def test_metrics_never_turn_unavailable_progress_into_zero() -> None:
    metrics = compute_metrics(_events(progress_available=False))

    assert metrics.route_completion_pct.value is None
    assert metrics.route_completion_pct.reason == "route progress explicitly unavailable"


def test_metrics_compute_minimum_ttc_only_from_paired_closing_front_evidence() -> None:
    event = _events()[0]
    closing = event.model_copy(
        update={
            "observation_summary": {
                **event.observation_summary,
                "front_distance_m": 6.0,
                "front_relative_speed_mps": -3.0,
            }
        }
    )
    not_closing = event.model_copy(
        update={
            "observation_summary": {
                **event.observation_summary,
                "front_distance_m": 6.0,
                "front_relative_speed_mps": 1.0,
            }
        }
    )

    available = compute_metrics((closing,))
    unavailable = compute_metrics((not_closing,))

    assert available.minimum_ttc_s.availability is EvidenceAvailability.AVAILABLE
    assert available.minimum_ttc_s.value == 2.0
    assert available.minimum_ttc_s.unit == "s"
    assert unavailable.minimum_ttc_s.availability is EvidenceAvailability.NOT_AVAILABLE
    assert unavailable.minimum_ttc_s.value is None


def test_metrics_count_override_events_not_reason_occurrences() -> None:
    event = _events()[0]
    overridden = event.model_copy(
        update={
            "candidate_action": Action(steering=0.0, throttle=0.5, brake=0.0),
            "executed_action": Action(steering=0.0, throttle=0.0, brake=1.0),
            "override_reasons": ("TTC_BELOW_THRESHOLD", "SPEED_CAP"),
        }
    )

    metrics = compute_metrics((overridden,))

    assert metrics.shield_override_count == 1
    assert metrics.shield_override_reasons == {
        "SPEED_CAP": 1,
        "TTC_BELOW_THRESHOLD": 1,
    }


def test_gate_rejects_missing_duplicate_or_unknown_required_findings(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    findings = run_phase1_verifiers(_events(), scenario, gate)
    without_trace = tuple(
        finding for finding in findings if finding.finding_id != "trace.integrity"
    )
    duplicate = findings + (findings[0],)
    unknown = findings + (
        Finding(
            finding_id="invented.pass",
            verifier="InventedVerifier",
            verifier_version="1.0",
            status=FindingStatus.PASS,
            severity=Severity.INFO,
            hard_invariant=False,
            threshold_or_invariant="unsupported finding must not exist",
            message="invented finding",
            measurement={
                "availability": EvidenceAvailability.AVAILABLE,
                "value": 0.0,
                "unit": "count",
            },
        ),
    )

    assert (
        apply_release_gate(
            without_trace,
            gate,
            expected_profile=VerifierProfile.LEGACY,
        ).verdict
        is Verdict.INVALID_EVIDENCE
    )
    assert (
        apply_release_gate(
            duplicate,
            gate,
            expected_profile=VerifierProfile.LEGACY,
        ).verdict
        is Verdict.INVALID_EVIDENCE
    )
    assert (
        apply_release_gate(
            unknown,
            gate,
            expected_profile=VerifierProfile.LEGACY,
        ).verdict
        is Verdict.INVALID_EVIDENCE
    )


def test_fault_coverage_profile_rejects_legacy_suite_without_coverage_finding(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase2.yaml")
    legacy_findings = run_phase1_verifiers(_events(), scenario, gate)

    result = apply_release_gate(
        legacy_findings,
        gate,
        expected_profile=VerifierProfile.FAULT_COVERAGE,
    )

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert result.hard_failures == ("gate.finding-set",)
