"""Offline ADAS evaluators over the stored trace.

These follow the repository's established verifier pattern: module-level functions that
read immutable stored evidence and return exactly one ``Finding`` each, registered in a
``VerifierIdentity`` tuple and enumerated in a ``VerifierProfile``.

Two properties keep the evaluation honest:

* **No circularity.** The oracle recomputes the closing geometry from the trace and judges
  it against thresholds in *gate config*, never against the controller's configured trigger
  points. A controller cannot pass by being configured to agree with itself.
* **No simulator access.** Everything here is derived from ``observation_summary`` and
  ``vehicle_state`` in the stored events, so a bundle can be re-judged offline, long after
  the run, without the simulator present.

Attribution note: in the default ADAS configuration the scripted driver never brakes, so
every braking command in the trace is AEB-attributable by construction. A configuration
that raises ``DriverConfig.max_brake`` opts into ambiguous attribution, and these evaluators
would over-count interventions for it.
"""

from __future__ import annotations

from dataclasses import dataclass

from hermes.domain.enums import EvidenceAvailability, FindingStatus, Severity
from hermes.domain.models import (
    Finding,
    Measurement,
    ScenarioDefinition,
    TraceEvent,
    VerifierIdentity,
)
from hermes.gates.config import AdasCriteria, GateConfig

ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES = (
    VerifierIdentity(
        name="AdasThreatResponseVerifier",
        version="1.0",
        finding_id="adas.aeb.threat_response",
    ),
    VerifierIdentity(
        name="AdasBrakeOnsetVerifier",
        version="1.0",
        finding_id="adas.aeb.brake_onset_ttc",
    ),
    VerifierIdentity(
        name="AdasFalseInterventionVerifier",
        version="1.0",
        finding_id="adas.aeb.no_false_intervention",
    ),
    VerifierIdentity(
        name="AdasWarningTimingVerifier",
        version="1.0",
        finding_id="adas.fcw.warning_timing",
    ),
)


def _unavailable(reason: str, unit: str) -> Measurement:
    return Measurement(
        availability=EvidenceAvailability.NOT_AVAILABLE, reason=reason, unit=unit
    )


def _available(value: float, unit: str) -> Measurement:
    return Measurement(availability=EvidenceAvailability.AVAILABLE, value=value, unit=unit)


@dataclass(frozen=True, slots=True)
class _Sample:
    """One step of stored longitudinal evidence, already reduced to what the oracle needs."""

    sequence: int
    time_s: float
    speed_mps: float
    gap_m: float | None
    relative_speed_mps: float | None
    brake: float

    @property
    def closing_mps(self) -> float:
        if self.relative_speed_mps is None:
            return 0.0
        return max(0.0, -self.relative_speed_mps)

    @property
    def in_path(self) -> bool:
        return self.gap_m is not None and self.relative_speed_mps is not None

    def ttc_s(self) -> float | None:
        if not self.in_path or self.closing_mps <= 0.0:
            return None
        assert self.gap_m is not None
        return self.gap_m / self.closing_mps

    def required_deceleration_mps2(self, standoff_m: float) -> float | None:
        if not self.in_path or self.closing_mps <= 0.0:
            return None
        assert self.gap_m is not None
        usable = self.gap_m - standoff_m
        if usable <= 0.0:
            return float("inf")
        return (self.closing_mps * self.closing_mps) / (2.0 * usable)


def _samples(events: tuple[TraceEvent, ...]) -> tuple[_Sample, ...]:
    collected: list[_Sample] = []
    for event in events:
        summary = event.observation_summary
        collected.append(
            _Sample(
                sequence=event.sequence,
                time_s=event.simulation_time_s,
                speed_mps=event.vehicle_state.speed_mps,
                gap_m=_number_or_none(summary.get("front_distance_m")),
                relative_speed_mps=_number_or_none(summary.get("front_relative_speed_mps")),
                brake=float(event.executed_action.brake),
            )
        )
    return tuple(collected)


def _number_or_none(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _criteria(gate: GateConfig) -> AdasCriteria:
    if gate.adas is None:
        raise ValueError("ADAS verifiers require a gate configuration with adas criteria")
    return gate.adas


def _threat_samples(
    samples: tuple[_Sample, ...],
    criteria: AdasCriteria,
    authority_mps2: float,
) -> tuple[_Sample, ...]:
    """Steps the oracle labels as a genuine threat, independent of what the controller did."""
    threshold = criteria.threat_authority_fraction * authority_mps2
    threatening: list[_Sample] = []
    for sample in samples:
        required = sample.required_deceleration_mps2(criteria.oracle_standoff_m)
        if required is not None and required >= threshold:
            threatening.append(sample)
    return tuple(threatening)


def _first_brake(samples: tuple[_Sample, ...]) -> _Sample | None:
    return next((sample for sample in samples if sample.brake > 0.0), None)


def adas_threat_response(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """A scenario the oracle labels as a threat must produce braking, and no collision."""
    criteria = _criteria(gate)
    samples = _samples(events)
    threats = _threat_samples(samples, criteria, scenario.control.max_braking_mps2)
    expected_required = (
        scenario.adas.expected_aeb.kind == "required"
        if scenario.adas is not None and scenario.adas.expected_aeb is not None
        else False
    )
    collisions = max(event.vehicle_state.collision_count for event in events)
    criterion = "an oracle-labelled threat produces AEB braking and no collision"

    if not threats and not expected_required:
        return Finding(
            finding_id="adas.aeb.threat_response",
            verifier="AdasThreatResponseVerifier",
            verifier_version="1.0",
            status=FindingStatus.PASS,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message="no oracle-labelled threat occurred and none was declared",
            measurement=_available(0.0, "threat steps"),
        )

    braked = _first_brake(samples)
    if collisions > 0:
        failing = tuple(
            event.sequence
            for event in events
            if event.vehicle_state.collision_count > 0
        )
        return Finding(
            finding_id="adas.aeb.threat_response",
            verifier="AdasThreatResponseVerifier",
            verifier_version="1.0",
            status=FindingStatus.FAIL,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=f"collision occurred during an oracle-labelled threat ({collisions})",
            event_sequences=failing,
            first_failure_time_s=events[failing[0]].simulation_time_s if failing else None,
            measurement=_available(float(collisions), "collisions"),
        )
    if braked is None:
        return Finding(
            finding_id="adas.aeb.threat_response",
            verifier="AdasThreatResponseVerifier",
            verifier_version="1.0",
            status=FindingStatus.FAIL,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=(
                f"{len(threats)} oracle-labelled threat steps produced no braking command"
            ),
            event_sequences=tuple(sample.sequence for sample in threats[:8]),
            first_failure_time_s=threats[0].time_s if threats else None,
            measurement=_available(float(len(threats)), "threat steps"),
        )
    return Finding(
        finding_id="adas.aeb.threat_response",
        verifier="AdasThreatResponseVerifier",
        verifier_version="1.0",
        status=FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message=(
            f"{len(threats)} oracle-labelled threat steps produced braking from sequence "
            f"{braked.sequence} with no collision"
        ),
        event_sequences=(braked.sequence,),
        measurement=_available(float(len(threats)), "threat steps"),
    )


def adas_brake_onset_ttc(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """Braking must begin while there is still time to collision left to spend."""
    criteria = _criteria(gate)
    samples = _samples(events)
    braked = _first_brake(samples)
    criterion = f"ttc_at_brake_onset_s >= {criteria.minimum_ttc_at_brake_onset_s}"
    del scenario

    if braked is None:
        reason = "no braking command was issued, so brake-onset TTC is undefined"
        return Finding(
            finding_id="adas.aeb.brake_onset_ttc",
            verifier="AdasBrakeOnsetVerifier",
            verifier_version="1.0",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            measurement=_unavailable(reason, "s"),
        )
    ttc = braked.ttc_s()
    if ttc is None:
        reason = (
            "the ego was not closing on an in-path lead at brake onset, so TTC is undefined"
        )
        return Finding(
            finding_id="adas.aeb.brake_onset_ttc",
            verifier="AdasBrakeOnsetVerifier",
            verifier_version="1.0",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            event_sequences=(braked.sequence,),
            measurement=_unavailable(reason, "s"),
        )
    late = ttc < criteria.minimum_ttc_at_brake_onset_s
    return Finding(
        finding_id="adas.aeb.brake_onset_ttc",
        verifier="AdasBrakeOnsetVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL if late else FindingStatus.PASS,
        severity=Severity.WARNING,
        hard_invariant=False,
        threshold_or_invariant=criterion,
        message=(
            f"braking began at TTC {ttc:.3f} s (sequence {braked.sequence}), "
            f"{'below' if late else 'at or above'} the configured minimum"
        ),
        event_sequences=(braked.sequence,),
        first_failure_time_s=braked.time_s if late else None,
        measurement=_available(ttc, "s"),
    )


def adas_no_false_intervention(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """Braking during an oracle-labelled threat-free scenario is a hard failure.

    Over-intervention is not a cosmetic complaint. An ADAS that brakes when nothing is
    there is unusable, and a candidate can always buy a better collision number with one.
    """
    criteria = _criteria(gate)
    samples = _samples(events)
    threats = _threat_samples(samples, criteria, scenario.control.max_braking_mps2)
    forbidden = (
        scenario.adas is not None
        and scenario.adas.expected_aeb is not None
        and scenario.adas.expected_aeb.kind == "forbidden"
    )
    criterion = (
        f"braking steps in a threat-free scenario <= {criteria.max_false_intervention_steps}"
    )

    if threats and not forbidden:
        message = (
            f"scenario contains {len(threats)} oracle-labelled threat steps; "
            "false-intervention exposure does not apply"
        )
        return Finding(
            finding_id="adas.aeb.no_false_intervention",
            verifier="AdasFalseInterventionVerifier",
            verifier_version="1.0",
            status=FindingStatus.PASS,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=message,
            measurement=_available(0.0, "steps"),
        )

    braking = tuple(sample for sample in samples if sample.brake > 0.0)
    exceeded = len(braking) > criteria.max_false_intervention_steps
    return Finding(
        finding_id="adas.aeb.no_false_intervention",
        verifier="AdasFalseInterventionVerifier",
        verifier_version="1.0",
        status=FindingStatus.FAIL if exceeded else FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message=(
            f"{len(braking)} braking steps in an oracle-labelled threat-free scenario"
            if exceeded
            else f"{len(braking)} braking steps, within the configured allowance"
        ),
        event_sequences=tuple(sample.sequence for sample in braking[:8]),
        first_failure_time_s=braking[0].time_s if exceeded and braking else None,
        measurement=_available(float(len(braking)), "steps"),
    )


def adas_warning_timing(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """A scenario declaring a required warning must reach the declared TTC in evidence.

    The trace does not record the warning signal itself, so this evaluates the condition a
    warning is required *before*: it confirms the run genuinely presented the declared
    closing geometry. It is a coverage check on the scenario, not a check of the warning
    output, and it says so rather than implying more than it establishes.
    """
    del gate
    samples = _samples(events)
    expectation = scenario.adas.expected_fcw if scenario.adas is not None else None
    observed = [sample.ttc_s() for sample in samples]
    defined = [value for value in observed if value is not None]
    minimum_ttc = min(defined) if defined else None
    criterion = "declared FCW exposure is present in the stored trace"

    if expectation is None or expectation.kind == "none" or expectation.before_ttc_s is None:
        reason = "the scenario declares no required forward-collision warning"
        return Finding(
            finding_id="adas.fcw.warning_timing",
            verifier="AdasWarningTimingVerifier",
            verifier_version="1.0",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            measurement=_unavailable(reason, "s"),
        )
    if minimum_ttc is None:
        reason = "the run never presented a closing in-path lead, so no warning was due"
        return Finding(
            finding_id="adas.fcw.warning_timing",
            verifier="AdasWarningTimingVerifier",
            verifier_version="1.0",
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            measurement=_unavailable(reason, "s"),
        )
    reached = minimum_ttc <= expectation.before_ttc_s
    return Finding(
        finding_id="adas.fcw.warning_timing",
        verifier="AdasWarningTimingVerifier",
        verifier_version="1.0",
        status=FindingStatus.PASS if reached else FindingStatus.FAIL,
        severity=Severity.WARNING,
        hard_invariant=False,
        threshold_or_invariant=f"minimum_ttc_s <= {expectation.before_ttc_s}",
        message=(
            f"minimum TTC {minimum_ttc:.3f} s "
            f"{'reached' if reached else 'never reached'} the declared warning threshold "
            f"{expectation.before_ttc_s} s"
        ),
        measurement=_available(minimum_ttc, "s"),
    )


def run_adas_p0_longitudinal_verifiers(
    events: tuple[TraceEvent, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> tuple[Finding, ...]:
    """Run the ADAS longitudinal suite in deterministic finding order."""
    return (
        adas_threat_response(events, scenario, gate),
        adas_brake_onset_ttc(events, scenario, gate),
        adas_no_false_intervention(events, scenario, gate),
        adas_warning_timing(events, scenario, gate),
    )
