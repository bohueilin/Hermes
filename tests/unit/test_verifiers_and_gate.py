from __future__ import annotations

from pathlib import Path
from types import MappingProxyType

import pytest

import hermes.gates.release as release_gate
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


def test_expected_finding_registries_preserve_exact_values_order_and_alias() -> None:
    expected_legacy = {
        "trace.integrity": ("TraceIntegrityVerifier", "1.0", True),
        "collision.zero": ("CollisionVerifier", "1.0", True),
        "boundary.within_tolerance": ("BoundaryVerifier", "1.0", True),
        "progress.required": ("ProgressVerifier", "1.1", True),
        "comfort.acceleration": ("ComfortVerifier", "1.0", False),
        "comfort.jerk": ("ComfortVerifier", "1.0", False),
    }
    expected_fault_coverage = {
        "trace.integrity": ("TraceIntegrityVerifier", "1.0", True),
        "collision.zero": ("CollisionVerifier", "1.0", True),
        "boundary.within_tolerance": ("BoundaryVerifier", "1.0", True),
        "progress.required": ("ProgressVerifier", "1.1", True),
        "comfort.acceleration": ("ComfortVerifier", "1.0", False),
        "comfort.jerk": ("ComfortVerifier", "1.0", False),
        "fault.coverage.required": ("FaultCoverageVerifier", "1.0", True),
    }

    assert tuple(release_gate.LEGACY_EXPECTED_FINDINGS.items()) == tuple(
        expected_legacy.items()
    )
    assert tuple(release_gate.EXPECTED_FINDINGS_BY_PROFILE) == (
        VerifierProfile.LEGACY,
        VerifierProfile.FAULT_COVERAGE,
        VerifierProfile.ADAS_P0_LONGITUDINAL,
        VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT,
    )
    # The ADAS profiles are supersets of the legacy set: the pre-Phase-8 findings keep their
    # identity, requiredness and hard/soft classification unchanged inside them.
    for profile in (
        VerifierProfile.ADAS_P0_LONGITUDINAL,
        VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT,
    ):
        adas_findings = release_gate.EXPECTED_FINDINGS_BY_PROFILE[profile]
        for finding_id, identity in expected_legacy.items():
            assert adas_findings[finding_id] == identity
    assert (
        release_gate.EXPECTED_FINDINGS_BY_PROFILE[VerifierProfile.LEGACY]
        is release_gate.LEGACY_EXPECTED_FINDINGS
    )
    assert tuple(
        release_gate.EXPECTED_FINDINGS_BY_PROFILE[VerifierProfile.LEGACY].items()
    ) == tuple(expected_legacy.items())
    assert tuple(
        release_gate.EXPECTED_FINDINGS_BY_PROFILE[
            VerifierProfile.FAULT_COVERAGE
        ].items()
    ) == tuple(expected_fault_coverage.items())


def test_schema_v3_gate_selects_trace_integrity_v1_1_without_moving_legacy() -> None:
    legacy = release_gate.expected_findings_for_profile(
        VerifierProfile.LEGACY,
        evidence_schema_version="1.0",
    )
    fault_v2 = release_gate.expected_findings_for_profile(
        VerifierProfile.FAULT_COVERAGE,
        evidence_schema_version="2.0",
    )
    v3 = release_gate.expected_findings_for_profile(
        VerifierProfile.LEGACY,
        evidence_schema_version="3.0",
    )

    assert legacy is release_gate.LEGACY_EXPECTED_FINDINGS
    assert legacy["trace.integrity"] == ("TraceIntegrityVerifier", "1.0", True)
    assert fault_v2["trace.integrity"] == ("TraceIntegrityVerifier", "1.0", True)
    assert v3["trace.integrity"] == ("TraceIntegrityVerifier", "1.1", True)
    assert tuple(v3) == tuple(legacy)
    assert tuple(
        (finding_id, identity)
        for finding_id, identity in v3.items()
        if finding_id != "trace.integrity"
    ) == tuple(
        (finding_id, identity)
        for finding_id, identity in legacy.items()
        if finding_id != "trace.integrity"
    )


def test_v3_adas_gate_selects_brake_onset_v1_1_without_moving_other_versions() -> None:
    legacy = release_gate.expected_findings_for_profile(
        VerifierProfile.ADAS_P0_LONGITUDINAL,
        evidence_schema_version="1.0",
    )
    fault_v2 = release_gate.expected_findings_for_profile(
        VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT,
        evidence_schema_version="2.0",
    )
    v3 = release_gate.expected_findings_for_profile(
        VerifierProfile.ADAS_P0_LONGITUDINAL,
        evidence_schema_version="3.0",
    )

    assert legacy["adas.aeb.brake_onset_margin"] == (
        "AdasBrakeOnsetVerifier",
        "1.0",
        False,
    )
    assert fault_v2["adas.aeb.brake_onset_margin"] == (
        "AdasBrakeOnsetVerifier",
        "1.0",
        False,
    )
    assert v3["adas.aeb.brake_onset_margin"] == (
        "AdasBrakeOnsetVerifier",
        "1.1",
        False,
    )
    assert v3["adas.aeb.threat_response"] == (
        "AdasThreatResponseVerifier",
        "1.1",
        True,
    )
    assert v3["adas.aeb.no_false_intervention"] == (
        "AdasFalseInterventionVerifier",
        "1.0",
        True,
    )
    assert v3["adas.fcw.warning_timing"] == (
        "AdasWarningTimingVerifier",
        "1.0",
        False,
    )


def test_expected_finding_selector_rejects_unhashable_schema_canonically() -> None:
    with pytest.raises(
        ValueError,
        match=r"unsupported evidence schema for trace verifier: \['3\.0'\]",
    ):
        release_gate.expected_findings_for_profile(
            VerifierProfile.ADAS_P0_LONGITUDINAL,
            evidence_schema_version=["3.0"],  # type: ignore[arg-type]
        )


def test_schema_v3_gate_accepts_only_the_schema_selected_trace_identity(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    legacy_findings = run_phase1_verifiers(_events(), scenario, gate)
    v3_findings = (
        legacy_findings[0].model_copy(update={"verifier_version": "1.1"}),
        *legacy_findings[1:],
    )

    accepted = apply_release_gate(
        v3_findings,
        gate,
        expected_profile=VerifierProfile.LEGACY,
        evidence_schema_version="3.0",
    )
    legacy_rejects_v3 = apply_release_gate(
        v3_findings,
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert accepted.verdict is not Verdict.INVALID_EVIDENCE
    assert legacy_rejects_v3.verdict is Verdict.INVALID_EVIDENCE


@pytest.mark.parametrize(
    "registry_case",
    ["legacy_public", "profile_outer", "legacy_nested", "fault_nested"],
)
def test_expected_finding_registries_reject_outer_and_nested_mutation(
    registry_case: str,
) -> None:
    if registry_case == "legacy_public":
        registry = release_gate.LEGACY_EXPECTED_FINDINGS
        key = "collision.zero"
        replacement = ("InjectedVerifier", "9.9", False)
    elif registry_case == "profile_outer":
        registry = release_gate.EXPECTED_FINDINGS_BY_PROFILE
        key = VerifierProfile.LEGACY
        replacement = {}
    elif registry_case == "legacy_nested":
        registry = release_gate.EXPECTED_FINDINGS_BY_PROFILE[
            VerifierProfile.LEGACY
        ]
        key = "collision.zero"
        replacement = ("InjectedVerifier", "9.9", False)
    else:
        registry = release_gate.EXPECTED_FINDINGS_BY_PROFILE[
            VerifierProfile.FAULT_COVERAGE
        ]
        key = "fault.coverage.required"
        replacement = ("InjectedVerifier", "9.9", False)

    before = tuple(registry.items())
    try:
        with pytest.raises(TypeError):
            registry[key] = replacement
    finally:
        if tuple(registry.items()) != before:
            registry.clear()
            registry.update(before)
    assert tuple(registry.items()) == before


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


def _extended_legacy_profile(
    monkeypatch: pytest.MonkeyPatch,
    *,
    finding_id: str,
    identity: tuple[str, str, bool],
) -> None:
    """Register one extra expected finding on the legacy profile for this test only."""
    monkeypatch.setattr(
        release_gate,
        "EXPECTED_FINDINGS_BY_PROFILE",
        MappingProxyType(
            {
                **release_gate.EXPECTED_FINDINGS_BY_PROFILE,
                VerifierProfile.LEGACY: MappingProxyType(
                    {**release_gate.LEGACY_EXPECTED_FINDINGS, finding_id: identity}
                ),
            }
        ),
    )


def _unhandled_hard_finding(status: FindingStatus) -> Finding:
    measurement = (
        Measurement(availability=EvidenceAvailability.AVAILABLE, value=1.0, unit="count")
        if status is not FindingStatus.NOT_AVAILABLE
        else Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            reason="illustrative unhandled hard evidence is unavailable",
            unit="count",
        )
    )
    return Finding(
        finding_id="gate.unhandled_hard_invariant",
        verifier="UnhandledHardInvariantVerifier",
        verifier_version="1.0",
        status=status,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant="illustrative unhandled hard invariant",
        message="illustrative unhandled hard invariant outcome",
        measurement=measurement,
    )


def test_failing_hard_finding_without_precedence_branch_cannot_pass(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A registered hard finding with no explicit branch must never yield PASS."""
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    passing_suite = run_phase1_verifiers(_events(), scenario, gate)
    unhandled = _unhandled_hard_finding(FindingStatus.FAIL)
    _extended_legacy_profile(
        monkeypatch,
        finding_id=unhandled.finding_id,
        identity=("UnhandledHardInvariantVerifier", "1.0", True),
    )

    result = apply_release_gate(
        (*passing_suite, unhandled),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert result.verdict is Verdict.HOLD
    assert result.hard_failures == ("gate.unhandled_hard_invariant",)
    assert "gate.unhandled_hard_invariant" not in result.soft_failures


def test_unavailable_hard_finding_without_precedence_branch_fails_closed(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unavailable hard evidence with no explicit branch follows the configured policy."""
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    passing_suite = run_phase1_verifiers(_events(), scenario, gate)
    unhandled = _unhandled_hard_finding(FindingStatus.NOT_AVAILABLE)
    _extended_legacy_profile(
        monkeypatch,
        finding_id=unhandled.finding_id,
        identity=("UnhandledHardInvariantVerifier", "1.0", True),
    )

    result = apply_release_gate(
        (*passing_suite, unhandled),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert result.verdict is Verdict(gate.hard.missing_required_evidence)
    assert result.hard_failures == ("gate.unhandled_hard_invariant",)


def test_passing_hard_finding_without_precedence_branch_changes_nothing(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The catch-all must not disturb a suite in which every hard finding passes."""
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    passing_suite = run_phase1_verifiers(_events(), scenario, gate)
    baseline = apply_release_gate(
        passing_suite,
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )
    unhandled = _unhandled_hard_finding(FindingStatus.PASS)
    _extended_legacy_profile(
        monkeypatch,
        finding_id=unhandled.finding_id,
        identity=("UnhandledHardInvariantVerifier", "1.0", True),
    )

    result = apply_release_gate(
        (*passing_suite, unhandled),
        gate,
        expected_profile=VerifierProfile.LEGACY,
    )

    assert result.verdict is baseline.verdict
    assert result.hard_failures == baseline.hard_failures == ()
