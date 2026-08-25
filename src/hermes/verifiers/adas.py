"""Offline ADAS evaluators over the stored trace.

These follow the repository's established verifier pattern: module-level functions that
read immutable stored evidence and return exactly one ``Finding`` each, registered in a
``VerifierIdentity`` tuple and enumerated in a ``VerifierProfile``.

Two properties keep the evaluation honest:

* **No circularity.** The oracle recomputes the closing geometry from the trace and judges
  it against thresholds in *gate config*, never against the controller's configured trigger
  points. A controller cannot pass by being configured to agree with itself.
* **No simulator access.** Legacy schema-1/2 findings retain their historical derivation
  from ``observation_summary`` and ``vehicle_state``. Schema-3 findings derive from the
  typed delivered observation, result geometry/state, and execution source/attribution in
  the stored events. A bundle can therefore be re-judged offline without the simulator.

Attribution note: schema-3 evidence explicitly distinguishes candidate, permitted, and
executed actions and records the executed source; its AEB findings use that typed
attribution. Schema-1/2 findings retain the historical default-driver braking assumption.
"""

from __future__ import annotations

from dataclasses import dataclass

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
from hermes.evidence.adas_summary import (
    AdasRunSummary,
    LongitudinalFact,
    summarize_adas_run,
)
from hermes.gates.config import AdasCriteria, GateConfig

ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES = (
    VerifierIdentity(
        name="AdasThreatResponseVerifier",
        version="1.1",
        finding_id="adas.aeb.threat_response",
    ),
    VerifierIdentity(
        name="AdasBrakeOnsetVerifier",
        version="1.0",
        finding_id="adas.aeb.brake_onset_margin",
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
ADAS_P0_LONGITUDINAL_V3_VERIFIER_IDENTITIES = tuple(
    identity.model_copy(update={"version": "1.1"})
    if identity.finding_id == "adas.aeb.brake_onset_margin"
    else identity
    for identity in ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES
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


def _derive_v3_summary(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> AdasRunSummary | None:
    """Derive typed schema-3 facts from the exact public verifier inputs."""
    if events and type(events[0]) is TraceEventV3:
        if any(type(event) is not TraceEventV3 for event in events):
            raise ValueError("ADAS verifier trace cannot mix evidence schema versions")
        return summarize_adas_run(
            tuple(event for event in events if type(event) is TraceEventV3),
            scenario,
            gate,
        )
    if any(type(event) is TraceEventV3 for event in events):
        raise ValueError("ADAS verifier trace cannot mix evidence schema versions")
    return None


def _threat_samples(
    samples: tuple[_Sample | LongitudinalFact, ...],
    criteria: AdasCriteria,
    authority_mps2: float,
) -> tuple[_Sample | LongitudinalFact, ...]:
    """Steps the oracle labels as a genuine threat, independent of what the controller did."""
    threshold = criteria.threat_authority_fraction * authority_mps2
    threatening: list[_Sample | LongitudinalFact] = []
    for sample in samples:
        required = sample.required_deceleration_mps2(criteria.oracle_standoff_m)
        if required is not None and required >= threshold:
            threatening.append(sample)
    return tuple(threatening)


def _first_brake(
    samples: tuple[_Sample | LongitudinalFact, ...],
) -> _Sample | LongitudinalFact | None:
    return next((sample for sample in samples if sample.brake > 0.0), None)


def _adas_threat_response_from_summary(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    summary: AdasRunSummary | None,
) -> Finding:
    """A threat must produce braking; any contact must stay within its residual-speed limit.

    Version 1.1 (2026-08-25). 1.0 failed on *any* collision; 1.1 additionally enforces
    ``max_residual_impact_speed_mps`` at contact and rewrote its criterion and message text.
    That is an observable behaviour change, so the version had to move: a stored bundle
    naming ``("AdasThreatResponseVerifier", "1.0")`` must keep meaning the 1.0 behaviour.
    The bump was free at the time it was made - every ADAS bundle in the local fleet was
    already invalid under the suite-identity correction in the same range.
    """
    criteria = _criteria(gate)
    samples = summary.policy_samples if summary is not None else _samples(events)  # type: ignore[arg-type]
    threats = (
        summary.threatening_policy_samples
        if summary is not None
        else _threat_samples(samples, criteria, scenario.control.max_braking_mps2)
    )
    expected_required = (
        scenario.adas.expected_aeb.kind == "required"
        if scenario.adas is not None and scenario.adas.expected_aeb is not None
        else False
    )
    residual_speed_limit_mps = criteria.max_residual_impact_speed_mps
    violating_contacts = (
        tuple(
            contact
            for contact in summary.collision_contacts
            if contact.residual_speed_mps > residual_speed_limit_mps
        )
        if summary is not None
        else tuple(
            event
            for event in events
            if event.vehicle_state.collision_count > 0
            and event.vehicle_state.speed_mps > residual_speed_limit_mps
        )
    )
    criterion = (
        "an oracle-labelled threat produces AEB braking and every contact residual ego speed "
        "is within the configured limit"
    )

    if violating_contacts:
        return Finding(
            finding_id="adas.aeb.threat_response",
            verifier="AdasThreatResponseVerifier",
            verifier_version="1.1",
            status=FindingStatus.FAIL,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message=(
                f"residual ego speed exceeded {residual_speed_limit_mps} m/s at "
                f"{len(violating_contacts)} contact event(s)"
            ),
            event_sequences=tuple(event.sequence for event in violating_contacts),
            first_failure_time_s=(
                violating_contacts[0].time_s
                if summary is not None
                else violating_contacts[0].simulation_time_s
            ),
            measurement=_available(
                max(
                    contact.residual_speed_mps
                    if summary is not None
                    else contact.vehicle_state.speed_mps
                    for contact in violating_contacts
                ),
                "m/s",
            ),
        )

    if not threats and not expected_required:
        return Finding(
            finding_id="adas.aeb.threat_response",
            verifier="AdasThreatResponseVerifier",
            verifier_version="1.1",
            status=FindingStatus.PASS,
            severity=Severity.CRITICAL,
            hard_invariant=True,
            threshold_or_invariant=criterion,
            message="no oracle-labelled threat occurred and none was declared",
            measurement=_available(0.0, "threat steps"),
        )

    braked = _first_brake(
        summary.positive_braking_steps if summary is not None else samples
    )
    if braked is None:
        return Finding(
            finding_id="adas.aeb.threat_response",
            verifier="AdasThreatResponseVerifier",
            verifier_version="1.1",
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
        verifier_version="1.1",
        status=FindingStatus.PASS,
        severity=Severity.CRITICAL,
        hard_invariant=True,
        threshold_or_invariant=criterion,
        message=(
            f"{len(threats)} oracle-labelled threat steps produced braking from sequence "
            f"{braked.sequence} with all contact residual speeds within the configured limit"
        ),
        event_sequences=(braked.sequence,),
        measurement=_available(float(len(threats)), "threat steps"),
    )


def _adas_brake_onset_margin_from_summary(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    summary: AdasRunSummary | None,
) -> Finding:
    """Braking must begin within the calibrated required-deceleration margin.

    The criterion is the required deceleration at the first brake command, expressed against
    the scenario's braking authority - not a fixed time-to-collision threshold. Two reasons:

    * It is speed-independent. A TTC that leaves ample margin at 10 m/s leaves none at 30,
      so one fixed TTC threshold is either too lax at the top of the ODD or too strict at
      the bottom.
    * It preserves the pre-calibration 6.0 m/s^2 evaluation boundary as a fraction of the
      measured 20 m/s MetaDrive peak. That is an explicit simulator-relative margin, not a
      claim that the old unenforced value was the physical stopping limit.

    Measured on the committed lead-brake scenario: a timely controller begins around 23% of
    the measured envelope, while the late-braking seed begins around 50%, beyond the calibrated
    46% onset margin whether or not it happens to get away with it.
    """
    criteria = _criteria(gate)
    samples = summary.policy_samples if summary is not None else _samples(events)  # type: ignore[arg-type]
    braked = _first_brake(
        summary.aeb_onset_facts if summary is not None else samples
    )
    verifier_version = "1.1" if summary is not None else "1.0"
    authority = scenario.control.max_braking_mps2
    limit = criteria.onset_authority_fraction * authority
    criterion = (
        f"required_deceleration_at_brake_onset_mps2 <= {limit} "
        f"({criteria.onset_authority_fraction} of {authority} m/s^2 authority)"
    )

    if braked is None:
        reason = "no braking command was issued, so brake-onset margin is undefined"
        return Finding(
            finding_id="adas.aeb.brake_onset_margin",
            verifier="AdasBrakeOnsetVerifier",
            verifier_version=verifier_version,
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            measurement=_unavailable(reason, "m/s^2"),
        )
    required = braked.required_deceleration_mps2(criteria.oracle_standoff_m)
    if required is None:
        reason = (
            "the ego was not closing on an in-path lead at brake onset, so the required "
            "deceleration is undefined"
        )
        return Finding(
            finding_id="adas.aeb.brake_onset_margin",
            verifier="AdasBrakeOnsetVerifier",
            verifier_version=verifier_version,
            status=FindingStatus.NOT_AVAILABLE,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            event_sequences=(braked.sequence,),
            measurement=_unavailable(reason, "m/s^2"),
        )
    if required == float("inf"):
        reason = "the usable gap was already consumed at brake onset"
        if summary is not None:
            assert braked.gap_m is not None
            return Finding(
                finding_id="adas.aeb.brake_onset_margin",
                verifier="AdasBrakeOnsetVerifier",
                verifier_version=verifier_version,
                status=FindingStatus.FAIL,
                severity=Severity.WARNING,
                hard_invariant=False,
                threshold_or_invariant=criterion,
                message=reason,
                event_sequences=(braked.sequence,),
                first_failure_time_s=braked.time_s,
                measurement=_available(
                    max(0.0, braked.gap_m - criteria.oracle_standoff_m),
                    "m usable gap",
                ),
            )
        return Finding(
            finding_id="adas.aeb.brake_onset_margin",
            verifier="AdasBrakeOnsetVerifier",
            verifier_version=verifier_version,
            status=FindingStatus.FAIL,
            severity=Severity.WARNING,
            hard_invariant=False,
            threshold_or_invariant=criterion,
            message=reason,
            event_sequences=(braked.sequence,),
            first_failure_time_s=braked.time_s,
            measurement=_unavailable(reason, "m/s^2"),
        )
    late = required > limit
    ttc = braked.ttc_s()
    return Finding(
        finding_id="adas.aeb.brake_onset_margin",
        verifier="AdasBrakeOnsetVerifier",
        verifier_version=verifier_version,
        status=FindingStatus.FAIL if late else FindingStatus.PASS,
        severity=Severity.WARNING,
        hard_invariant=False,
        threshold_or_invariant=criterion,
        message=(
            f"braking began at sequence {braked.sequence} requiring "
            f"{required:.2f} m/s^2 ({100 * required / authority:.0f}% of authority"
            + (f", TTC {ttc:.3f} s" if ttc is not None else "")
            + f"), {'past' if late else 'within'} the configured onset margin"
        ),
        event_sequences=(braked.sequence,),
        first_failure_time_s=braked.time_s if late else None,
        measurement=_available(required, "m/s^2"),
    )


def _adas_no_false_intervention_from_summary(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    summary: AdasRunSummary | None,
) -> Finding:
    """Braking during an oracle-labelled threat-free scenario is a hard failure.

    Over-intervention is not a cosmetic complaint. An ADAS that brakes when nothing is
    there is unusable, and a candidate can always buy a better collision number with one.
    """
    criteria = _criteria(gate)
    samples = summary.policy_samples if summary is not None else _samples(events)  # type: ignore[arg-type]
    threats = (
        summary.threatening_policy_samples
        if summary is not None
        else _threat_samples(samples, criteria, scenario.control.max_braking_mps2)
    )
    expectation = scenario.adas.expected_aeb if scenario.adas is not None else None
    forbidden = expectation is not None and expectation.kind == "forbidden"
    declared_required = expectation is not None and expectation.kind == "required"
    criterion = (
        f"braking steps in a threat-free scenario <= {criteria.max_false_intervention_steps}"
    )

    def _not_applicable(message: str) -> Finding:
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

    if declared_required:
        # The scenario's *declared* label decides whether false-intervention exposure
        # applies, not the realised trace. A controller that intervenes early can prevent
        # the threat from ever appearing in the trace it is judged on - so labelling from
        # the trace alone would convert a correct early intervention into a false one.
        # Whether that early intervention was warranted is the threat-response criterion's
        # question, not this one's.
        return _not_applicable(
            "scenario declares AEB is required, so false-intervention exposure does not apply"
        )
    if threats and not forbidden:
        return _not_applicable(
            f"scenario contains {len(threats)} oracle-labelled threat steps; "
            "false-intervention exposure does not apply"
        )

    braking = (
        summary.positive_braking_steps
        if summary is not None
        else tuple(sample for sample in samples if sample.brake > 0.0)
    )
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


def _adas_warning_timing_from_summary(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
    summary: AdasRunSummary | None,
) -> Finding:
    """A scenario declaring a required warning must reach the declared TTC in evidence.

    The trace does not record the warning signal itself, so this evaluates the condition a
    warning is required *before*: it confirms the run genuinely presented the declared
    closing geometry. It is a coverage check on the scenario, not a check of the warning
    output, and it says so rather than implying more than it establishes.
    """
    del gate
    samples = summary.policy_samples if summary is not None else _samples(events)  # type: ignore[arg-type]
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


def adas_threat_response(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """Evaluate threat response from the supplied trace and resolved inputs."""
    return _adas_threat_response_from_summary(
        events, scenario, gate, _derive_v3_summary(events, scenario, gate)
    )


def adas_brake_onset_margin(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """Evaluate brake-onset margin from the supplied trace and resolved inputs."""
    return _adas_brake_onset_margin_from_summary(
        events, scenario, gate, _derive_v3_summary(events, scenario, gate)
    )


def adas_no_false_intervention(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """Evaluate false intervention from the supplied trace and resolved inputs."""
    return _adas_no_false_intervention_from_summary(
        events, scenario, gate, _derive_v3_summary(events, scenario, gate)
    )


def adas_warning_timing(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> Finding:
    """Evaluate warning timing from the supplied trace and resolved inputs."""
    return _adas_warning_timing_from_summary(
        events, scenario, gate, _derive_v3_summary(events, scenario, gate)
    )


def run_adas_p0_longitudinal_verifiers(
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate: GateConfig,
) -> tuple[Finding, ...]:
    """Run the ADAS longitudinal suite in deterministic finding order."""
    summary = _derive_v3_summary(events, scenario, gate)
    return (
        _adas_threat_response_from_summary(events, scenario, gate, summary),
        _adas_brake_onset_margin_from_summary(events, scenario, gate, summary),
        _adas_no_false_intervention_from_summary(events, scenario, gate, summary),
        _adas_warning_timing_from_summary(events, scenario, gate, summary),
    )
