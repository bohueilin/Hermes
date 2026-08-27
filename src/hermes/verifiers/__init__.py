"""Independent Phase 1 verifiers over immutable stored-domain evidence."""

from __future__ import annotations

import re

from hermes.domain.enums import EvidenceAvailability, FindingStatus, Severity
from hermes.domain.models import (
    Finding,
    Measurement,
    ScenarioDefinition,
    TraceEvent,
    TraceEventV2,
    TraceEventV3,
    VerifierIdentity,
)
from hermes.evidence.metrics import compute_metrics
from hermes.evidence.trace import TraceIntegrityError, verify_complete_trace
from hermes.gates.config import GateConfig
from hermes.gates.release import VerifierProfile, trace_integrity_verifier_version
from hermes.shields.config import ShieldConfig

PHASE1_VERIFIER_IDENTITIES = (
    VerifierIdentity(
        name="TraceIntegrityVerifier",
        version=trace_integrity_verifier_version("1.0"),
        finding_id="trace.integrity",
    ),
    VerifierIdentity(name="CollisionVerifier", version="1.0", finding_id="collision.zero"),
    VerifierIdentity(
        name="BoundaryVerifier", version="1.0", finding_id="boundary.within_tolerance"
    ),
    VerifierIdentity(name="ProgressVerifier", version="1.1", finding_id="progress.required"),
    VerifierIdentity(
        name="ComfortVerifier", version="1.0", finding_id="comfort.acceleration"
    ),
    VerifierIdentity(name="ComfortVerifier", version="1.0", finding_id="comfort.jerk"),
)
PHASE4_VERIFIER_IDENTITIES = PHASE1_VERIFIER_IDENTITIES + (
    VerifierIdentity(
        name="FaultCoverageVerifier",
        version="1.0",
        finding_id="fault.coverage.required",
    ),
)


def verifier_identities_for_profile(
    profile: VerifierProfile,
    *,
    evidence_schema_version: str = "1.0",
) -> tuple[VerifierIdentity, ...]:
    """Return the exact ordered identities executed by one verifier profile."""
    if profile is VerifierProfile.LEGACY:
        identities = PHASE1_VERIFIER_IDENTITIES
    elif profile is VerifierProfile.FAULT_COVERAGE:
        identities = PHASE4_VERIFIER_IDENTITIES
    else:
        from hermes.verifiers.adas import (
            ADAS_P0_LONGITUDINAL_V3_VERIFIER_IDENTITIES,
            ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES,
        )

        adas_identities_by_schema_profile = {
            (schema, adas_profile): (
                ADAS_P0_LONGITUDINAL_V3_VERIFIER_IDENTITIES
                if schema == "3.0"
                else ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES
            )
            for schema in ("1.0", "2.0", "3.0")
            for adas_profile in (
                VerifierProfile.ADAS_P0_LONGITUDINAL,
                VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT,
            )
        }
        try:
            adas_identities = adas_identities_by_schema_profile[
                (evidence_schema_version, profile)
            ]
        except (KeyError, TypeError) as exc:
            raise ValueError(
                "unsupported evidence-schema/verifier-profile pair: "
                f"{evidence_schema_version!r}, {profile!r}"
            ) from exc

        if profile is VerifierProfile.ADAS_P0_LONGITUDINAL:
            identities = PHASE1_VERIFIER_IDENTITIES + adas_identities
        elif profile is VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT:
            identities = PHASE4_VERIFIER_IDENTITIES + adas_identities
        else:
            raise ValueError(f"unsupported verifier profile: {profile}")

    trace_version = trace_integrity_verifier_version(evidence_schema_version)
    if trace_version == identities[0].version:
        return identities
    return (
        identities[0].model_copy(update={"version": trace_version}),
        *identities[1:],
    )


def _available(value: float, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=value,
        unit=unit,
    )


def _collision(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...], gate: GateConfig
) -> Finding:
    maximum = max(event.vehicle_state.collision_count for event in events)
    failed_events = tuple(
        event
        for event in events
        if event.vehicle_state.collision_count > gate.hard.max_collision_count
    )
    return Finding(
        finding_id="collision.zero",
        verifier="CollisionVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL if failed_events else FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant="collision_count == 0",
        message=(
            f"collision count {maximum} exceeds allowed {gate.hard.max_collision_count}"
            if failed_events
            else f"collision count {maximum} meets required maximum"
        ),
        event_sequences=tuple(event.sequence for event in failed_events),
        first_failure_time_s=(
            failed_events[0].simulation_time_s if failed_events else None
        ),
        measurement=_available(float(maximum), "count"),
    )


def _boundary(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    metrics = compute_metrics(events, scenario=scenario, gate_config=gate)
    lateral_tolerance = min(
        gate.hard.max_abs_lateral_offset_m,
        scenario.road.boundary_tolerance_m,
    )
    failed_events = tuple(
        event
        for event in events
        if abs(event.vehicle_state.lateral_offset_m) > lateral_tolerance
        or event.vehicle_state.offroad
    )
    return Finding(
        finding_id="boundary.within_tolerance",
        verifier="BoundaryVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL if failed_events else FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant=(
            f"abs(lateral_offset_m) <= {lateral_tolerance} and offroad == false; "
            "max_offroad_duration_s == 0.0"
        ),
        message=(
            "road-boundary requirement failed: "
            f"maximum lateral offset {metrics.max_abs_lateral_offset_m} m, "
            f"off-road duration {metrics.offroad_duration_s} s"
            if failed_events
            else "road-boundary requirement passed: "
            f"maximum lateral offset {metrics.max_abs_lateral_offset_m} m, "
            f"off-road duration {metrics.offroad_duration_s} s"
        ),
        event_sequences=tuple(event.sequence for event in failed_events),
        first_failure_time_s=(
            failed_events[0].simulation_time_s if failed_events else None
        ),
        measurement=_available(metrics.max_abs_lateral_offset_m, "m"),
    )


def _progress(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    measurement = compute_metrics(
        events, scenario=scenario, gate_config=gate
    ).route_completion_pct
    criterion = (
        "destination_reached == true and "
        f"route_completion_pct >= {gate.hard.min_route_completion_pct}"
    )
    if measurement.availability is EvidenceAvailability.NOT_AVAILABLE:
        return Finding(
            finding_id="progress.required",
            verifier="ProgressVerifier",
            verifier_version="1.1",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.ERROR,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=f"required route progress is NOT_AVAILABLE: {measurement.reason}",
            measurement=measurement,
        )
    assert measurement.value is not None
    destination_reached = events[-1].vehicle_state.destination_reached
    failed = (
        measurement.value < gate.hard.min_route_completion_pct
        or not destination_reached
    )
    return Finding(
        finding_id="progress.required",
        verifier="ProgressVerifier",
        verifier_version="1.1",
        status=FindingStatus.FAIL if failed else FindingStatus.PASS,
        severity=Severity.ERROR,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message=(
            "destination was not reached"
            if not destination_reached
            else f"route completion {measurement.value}% is below required "
            f"{gate.hard.min_route_completion_pct}%"
            if failed
            else (
                f"destination reached and route completion {measurement.value}% "
                "meets requirement"
            )
        ),
        event_sequences=(events[-1].sequence,) if failed else (),
        first_failure_time_s=events[-1].simulation_time_s if failed else None,
        measurement=measurement,
    )


def _comfort_acceleration(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    measurement = compute_metrics(
        events, scenario=scenario, gate_config=gate
    ).max_abs_acceleration_mps2
    assert measurement.value is not None
    failed_events = tuple(
        event
        for event in events
        if abs(event.vehicle_state.acceleration_mps2)
        > gate.soft.max_abs_acceleration_mps2
    )
    return Finding(
        finding_id="comfort.acceleration",
        verifier="ComfortVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL if failed_events else FindingStatus.PASS,
        severity=Severity.WARNING,
        hard_invariant=False,
        threshold_or_invariant=(
            f"max_abs_acceleration_mps2 <= {gate.soft.max_abs_acceleration_mps2}"
        ),
        message=(
            "illustrative acceleration/deceleration threshold failed"
            if failed_events
            else "illustrative acceleration/deceleration threshold passed"
        ),
        event_sequences=tuple(event.sequence for event in failed_events),
        first_failure_time_s=(
            failed_events[0].simulation_time_s if failed_events else None
        ),
        measurement=measurement,
    )


def _comfort_jerk(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    measurement = compute_metrics(
        events, scenario=scenario, gate_config=gate
    ).max_abs_jerk_mps3
    criterion = f"max_abs_jerk_mps3 <= {gate.soft.max_abs_jerk_mps3}"
    if measurement.availability is EvidenceAvailability.NOT_AVAILABLE:
        return Finding(
            finding_id="comfort.jerk",
            verifier="ComfortVerifier",
            verifier_version="1.0",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=f"illustrative jerk evidence is NOT_AVAILABLE: {measurement.reason}",
            measurement=measurement,
        )
    assert measurement.value is not None
    dt = 1.0 / events[0].run_context.control_frequency_hz
    failed_events = tuple(
        events[index]
        for index in range(1, len(events))
        if abs(
            events[index].vehicle_state.acceleration_mps2
            - events[index - 1].vehicle_state.acceleration_mps2
        )
        / dt
        > gate.soft.max_abs_jerk_mps3
    )
    return Finding(
        finding_id="comfort.jerk",
        verifier="ComfortVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL if failed_events else FindingStatus.PASS,
        severity=Severity.WARNING,
        hard_invariant=False,
        threshold_or_invariant=criterion,
        message=(
            "illustrative jerk threshold failed"
            if failed_events
            else "illustrative jerk threshold passed"
        ),
        event_sequences=tuple(event.sequence for event in failed_events),
        first_failure_time_s=(
            failed_events[0].simulation_time_s if failed_events else None
        ),
        measurement=measurement,
    )


def _trace_integrity(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    *,
    shield_config: ShieldConfig | None = None,
) -> Finding:
    measurement = _available(float(len(events)), "events")
    criterion = "complete trace sequence and SHA-256 chain are internally consistent"
    verifier_version = trace_integrity_verifier_version(
        events[0].evidence_schema_version if events else "1.0"
    )
    try:
        verify_complete_trace(events, scenario, shield_config=shield_config)
    except TraceIntegrityError as exc:
        match = re.search(r"sequence (\d+)", str(exc))
        sequence = int(match.group(1)) if match else None
        failed_event = (
            next((event for event in events if event.sequence == sequence), None)
            if sequence is not None
            else None
        )
        return Finding(
            finding_id="trace.integrity",
            verifier="TraceIntegrityVerifier",
            verifier_version=verifier_version,
            status=FindingStatus.FAIL,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=str(exc),
            event_sequences=(sequence,) if failed_event is not None else (),
            first_failure_time_s=(
                failed_event.simulation_time_s if failed_event is not None else None
            ),
            measurement=measurement,
        )
    return Finding(
        finding_id="trace.integrity",
        verifier="TraceIntegrityVerifier",
        verifier_version=verifier_version,
        status=FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message="event sequence and SHA-256 chain are internally consistent",
        measurement=measurement,
    )


def run_phase1_verifiers(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    *,
    shield_config: ShieldConfig | None = None,
) -> tuple[Finding, ...]:
    """Run the stable Phase 1 suite in deterministic finding order."""
    return (
        _trace_integrity(events, scenario, shield_config=shield_config),
        _collision(events, gate),
        _boundary(events, scenario, gate),
        _progress(events, scenario, gate),
        _comfort_acceleration(events, scenario, gate),
        _comfort_jerk(events, scenario, gate),
    )


def _fault_coverage(
    events: tuple[TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
) -> Finding:
    config = scenario.faults
    if config is None:
        raise ValueError("fault coverage requires a scenario fault profile")
    required: list[str] = []
    if config.observation_delay_steps:
        required.append("OBSERVATION_DELAY")
    if config.frozen_observation_interval is not None:
        required.append("OBSERVATION_FROZEN")
    if config.dropped_observation_steps:
        required.append("OBSERVATION_DROPOUT_HOLD_LAST")
    if config.observation_noise is not None:
        required.append("OBSERVATION_NOISE")
    if config.control_delay_steps:
        required.append("CONTROL_DELAY")
    if config.max_abs_steering is not None:
        required.append("STEERING_SATURATION")
    if config.max_brake is not None:
        required.append("BRAKE_SATURATION")
    observed = {
        reason
        for event in events
        for reason in (
            *event.observation_fault_evidence.applied_faults,
            *event.control_fault_evidence.applied_faults,
        )
    }
    missing = [reason for reason in required if reason not in observed]
    scheduled_missing: list[str] = []
    interval = config.frozen_observation_interval
    if interval is not None:
        for sequence in range(
            interval.start_step,
            interval.start_step + interval.duration_steps,
        ):
            if sequence >= len(events) or "OBSERVATION_FROZEN" not in (
                events[sequence].observation_fault_evidence.applied_faults
            ):
                scheduled_missing.append(f"OBSERVATION_FROZEN@{sequence}")
    for sequence in config.dropped_observation_steps:
        if sequence >= len(events) or "OBSERVATION_DROPOUT_HOLD_LAST" not in (
            events[sequence].observation_fault_evidence.applied_faults
        ):
            scheduled_missing.append(f"OBSERVATION_DROPOUT_HOLD_LAST@{sequence}")
    criterion = (
        "every configured deterministic fault mechanism and scheduled fault step is observed"
    )
    if missing or scheduled_missing:
        missing_items = [*missing, *scheduled_missing]
        reason = "configured fault mechanisms or schedule were not exercised: " + ", ".join(
            missing_items
        )
        return Finding(
            finding_id="fault.coverage.required",
            verifier="FaultCoverageVerifier",
            verifier_version="1.0",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.ERROR,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=reason,
            measurement=Measurement(
                availability=EvidenceAvailability.NOT_AVAILABLE,
                reason=reason,
                unit="configured mechanisms",
            ),
        )
    return Finding(
        finding_id="fault.coverage.required",
        verifier="FaultCoverageVerifier",
        verifier_version="1.0",
        status=FindingStatus.PASS,
        severity=Severity.ERROR,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message=(
            f"all {len(required)} configured fault mechanisms and scheduled steps were "
            "exercised"
        ),
        measurement=_available(float(len(required)), "configured mechanisms"),
    )


def run_phase4_verifiers(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    *,
    shield_config: ShieldConfig | None = None,
) -> tuple[Finding, ...]:
    """Run legacy safety checks plus required deterministic fault coverage."""
    return (
        *run_phase1_verifiers(
            events,
            scenario,
            gate,
            shield_config=shield_config,
        ),
        _fault_coverage(events, scenario),
    )


def run_verifiers_for_profile(
    profile: VerifierProfile,
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    *,
    shield_config: ShieldConfig | None = None,
) -> tuple[Finding, ...]:
    """Run exactly the suite a verifier profile enumerates.

    Single dispatch point shared by the run orchestrator and stored-evidence verification.
    The gate matches a profile's expected finding set for exact equality, so a suite and its
    profile that disagree produce INVALID_EVIDENCE rather than a wrong verdict - which makes
    keeping the two in one place a correctness requirement, not tidiness.
    """
    from hermes.verifiers.adas import run_adas_p0_longitudinal_verifiers

    if profile is VerifierProfile.ADAS_P0_LONGITUDINAL:
        return (
            *run_phase1_verifiers(
                events,
                scenario,
                gate,
                shield_config=shield_config,
            ),
            *run_adas_p0_longitudinal_verifiers(events, scenario, gate),
        )
    if profile is VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT:
        return (
            *run_phase4_verifiers(
                events,
                scenario,
                gate,
                shield_config=shield_config,
            ),
            *run_adas_p0_longitudinal_verifiers(events, scenario, gate),
        )
    if profile is VerifierProfile.FAULT_COVERAGE:
        return run_phase4_verifiers(
            events,
            scenario,
            gate,
            shield_config=shield_config,
        )
    if profile is VerifierProfile.LEGACY:
        return run_phase1_verifiers(
            events,
            scenario,
            gate,
            shield_config=shield_config,
        )
    raise ValueError(f"unsupported verifier profile: {profile}")
