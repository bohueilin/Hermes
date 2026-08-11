"""Independent Phase 1 verifiers over immutable stored-domain evidence."""

from __future__ import annotations

import re

from hermes.domain.enums import EvidenceAvailability, FindingStatus, Severity
from hermes.domain.models import (
    Finding,
    Measurement,
    ScenarioDefinition,
    TraceEvent,
    VerifierIdentity,
)
from hermes.evidence.metrics import compute_metrics
from hermes.evidence.trace import TraceIntegrityError, verify_complete_trace
from hermes.gates.config import GateConfig

PHASE1_VERIFIER_IDENTITIES = (
    VerifierIdentity(
        name="TraceIntegrityVerifier", version="1.0", finding_id="trace.integrity"
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


def _available(value: float, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=value,
        unit=unit,
    )


def _collision(events: tuple[TraceEvent, ...], gate: GateConfig) -> Finding:
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
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    metrics = compute_metrics(events)
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


def _progress(events: tuple[TraceEvent, ...], gate: GateConfig) -> Finding:
    measurement = compute_metrics(events).route_completion_pct
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


def _comfort_acceleration(events: tuple[TraceEvent, ...], gate: GateConfig) -> Finding:
    measurement = compute_metrics(events).max_abs_acceleration_mps2
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


def _comfort_jerk(events: tuple[TraceEvent, ...], gate: GateConfig) -> Finding:
    measurement = compute_metrics(events).max_abs_jerk_mps3
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
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
) -> Finding:
    measurement = _available(float(len(events)), "events")
    criterion = "complete trace sequence and SHA-256 chain are internally consistent"
    try:
        verify_complete_trace(events, scenario)
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
            verifier_version="1.0",
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
        verifier_version="1.0",
        status=FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message="event sequence and SHA-256 chain are internally consistent",
        measurement=measurement,
    )


def run_phase1_verifiers(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> tuple[Finding, ...]:
    """Run the stable Phase 1 suite in deterministic finding order."""
    return (
        _trace_integrity(events, scenario),
        _collision(events, gate),
        _boundary(events, scenario, gate),
        _progress(events, gate),
        _comfort_acceleration(events, gate),
        _comfort_jerk(events, gate),
    )
