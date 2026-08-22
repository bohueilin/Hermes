"""Non-compensatory release-gate precedence over structured findings."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType

from hermes.domain.enums import FindingStatus, Verdict
from hermes.domain.models import Finding, GateResult
from hermes.gates.config import GateConfig


class VerifierProfile(StrEnum):
    """Closed set of verifier suites the release gate can evaluate."""

    LEGACY = "legacy"
    FAULT_COVERAGE = "fault_coverage"
    ADAS_P0_LONGITUDINAL = "adas_p0_longitudinal"
    ADAS_P0_LONGITUDINAL_FAULT = "adas_p0_longitudinal_fault"


class EvidenceRequiredness(StrEnum):
    """Core-owned applicability for evidence projected by the review facade."""

    REQUIRED = "REQUIRED"
    OPTIONAL = "OPTIONAL"
    NOT_APPLICABLE = "NOT_APPLICABLE"


@dataclass(frozen=True, slots=True)
class EvidenceRequirement:
    """One ordered finding requirement for a versioned verifier profile."""

    finding_id: str
    requiredness: EvidenceRequiredness


@dataclass(frozen=True, slots=True)
class EvidenceRequirementProfile:
    """Immutable requiredness metadata without any release-gate behavior."""

    version: str
    requirements: tuple[EvidenceRequirement, ...]


LEGACY_EXPECTED_FINDINGS: Mapping[str, tuple[str, str, bool]] = MappingProxyType(
    {
        "trace.integrity": ("TraceIntegrityVerifier", "1.0", True),
        "collision.zero": ("CollisionVerifier", "1.0", True),
        "boundary.within_tolerance": ("BoundaryVerifier", "1.0", True),
        "progress.required": ("ProgressVerifier", "1.1", True),
        "comfort.acceleration": ("ComfortVerifier", "1.0", False),
        "comfort.jerk": ("ComfortVerifier", "1.0", False),
    }
)
ADAS_P0_LONGITUDINAL_EXPECTED_FINDINGS: Mapping[str, tuple[str, str, bool]] = MappingProxyType(
    {
        **LEGACY_EXPECTED_FINDINGS,
        "adas.aeb.threat_response": ("AdasThreatResponseVerifier", "1.0", True),
        "adas.aeb.brake_onset_margin": ("AdasBrakeOnsetVerifier", "1.0", False),
        "adas.aeb.no_false_intervention": ("AdasFalseInterventionVerifier", "1.0", True),
        "adas.fcw.warning_timing": ("AdasWarningTimingVerifier", "1.0", False),
    }
)
EXPECTED_FINDINGS_BY_PROFILE: Mapping[
    VerifierProfile, Mapping[str, tuple[str, str, bool]]
] = MappingProxyType(
    {
        VerifierProfile.LEGACY: LEGACY_EXPECTED_FINDINGS,
        VerifierProfile.FAULT_COVERAGE: MappingProxyType(
            {
                **LEGACY_EXPECTED_FINDINGS,
                "fault.coverage.required": (
                    "FaultCoverageVerifier",
                    "1.0",
                    True,
                ),
            }
        ),
        VerifierProfile.ADAS_P0_LONGITUDINAL: ADAS_P0_LONGITUDINAL_EXPECTED_FINDINGS,
        VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT: MappingProxyType(
            {
                **ADAS_P0_LONGITUDINAL_EXPECTED_FINDINGS,
                "fault.coverage.required": ("FaultCoverageVerifier", "1.0", True),
            }
        ),
    }
)

EXPLICITLY_ORDERED_HARD_FINDING_IDS: frozenset[str] = frozenset(
    {
        "trace.integrity",
        "collision.zero",
        "boundary.within_tolerance",
        "progress.required",
        "fault.coverage.required",
    }
)
"""Hard findings that have their own branch in the precedence chain below.

Every other hard finding is caught by the non-compensatory catch-all, so registering a new
hard finding in a verifier profile can never silently produce PASS while that finding fails.
"""

_COMMON_EVIDENCE_REQUIREMENTS = (
    EvidenceRequirement("trace.integrity", EvidenceRequiredness.REQUIRED),
    EvidenceRequirement("collision.zero", EvidenceRequiredness.REQUIRED),
    EvidenceRequirement("boundary.within_tolerance", EvidenceRequiredness.REQUIRED),
    EvidenceRequirement("progress.required", EvidenceRequiredness.REQUIRED),
    EvidenceRequirement("comfort.acceleration", EvidenceRequiredness.OPTIONAL),
    EvidenceRequirement("comfort.jerk", EvidenceRequiredness.OPTIONAL),
)
EVIDENCE_REQUIREMENTS_BY_PROFILE: Mapping[VerifierProfile, EvidenceRequirementProfile] = (
    MappingProxyType(
        {
            VerifierProfile.LEGACY: EvidenceRequirementProfile(
                version="1.0",
                requirements=(
                    *_COMMON_EVIDENCE_REQUIREMENTS,
                    EvidenceRequirement(
                        "fault.coverage.required",
                        EvidenceRequiredness.NOT_APPLICABLE,
                    ),
                ),
            ),
            VerifierProfile.FAULT_COVERAGE: EvidenceRequirementProfile(
                version="1.0",
                requirements=(
                    *_COMMON_EVIDENCE_REQUIREMENTS,
                    EvidenceRequirement(
                        "fault.coverage.required",
                        EvidenceRequiredness.REQUIRED,
                    ),
                ),
            ),
            VerifierProfile.ADAS_P0_LONGITUDINAL: EvidenceRequirementProfile(
                version="1.0",
                requirements=(
                    *_COMMON_EVIDENCE_REQUIREMENTS,
                    EvidenceRequirement(
                        "fault.coverage.required",
                        EvidenceRequiredness.NOT_APPLICABLE,
                    ),
                    EvidenceRequirement(
                        "adas.aeb.threat_response",
                        EvidenceRequiredness.REQUIRED,
                    ),
                    EvidenceRequirement(
                        "adas.aeb.brake_onset_margin",
                        EvidenceRequiredness.OPTIONAL,
                    ),
                    EvidenceRequirement(
                        "adas.aeb.no_false_intervention",
                        EvidenceRequiredness.REQUIRED,
                    ),
                    EvidenceRequirement(
                        "adas.fcw.warning_timing",
                        EvidenceRequiredness.OPTIONAL,
                    ),
                ),
            ),
            VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT: EvidenceRequirementProfile(
                version="1.0",
                requirements=(
                    *_COMMON_EVIDENCE_REQUIREMENTS,
                    EvidenceRequirement(
                        "fault.coverage.required",
                        EvidenceRequiredness.REQUIRED,
                    ),
                    EvidenceRequirement(
                        "adas.aeb.threat_response",
                        EvidenceRequiredness.REQUIRED,
                    ),
                    EvidenceRequirement(
                        "adas.aeb.brake_onset_margin",
                        EvidenceRequiredness.OPTIONAL,
                    ),
                    EvidenceRequirement(
                        "adas.aeb.no_false_intervention",
                        EvidenceRequiredness.REQUIRED,
                    ),
                    EvidenceRequirement(
                        "adas.fcw.warning_timing",
                        EvidenceRequiredness.OPTIONAL,
                    ),
                ),
            ),
        }
    )
)


def select_verifier_profile(scenario: object) -> VerifierProfile:
    """Choose the verifier profile a scenario's evidence must satisfy.

    Single source of truth. Profile selection previously existed as two independent copies -
    one in the run orchestrator and one in stored-evidence verification - so extending one
    without the other would make a run's verdict and its re-verification silently disagree.
    """
    has_faults = getattr(scenario, "faults", None) is not None
    if getattr(scenario, "adas", None) is not None:
        # An ADAS scenario that also injects faults keeps fault-coverage checking. Folding
        # both into one profile would have silently dropped it, because a profile's expected
        # finding set is matched for exact equality.
        return (
            VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT
            if has_faults
            else VerifierProfile.ADAS_P0_LONGITUDINAL
        )
    if has_faults:
        return VerifierProfile.FAULT_COVERAGE
    return VerifierProfile.LEGACY


def apply_release_gate(
    findings: tuple[Finding, ...],
    config: GateConfig,
    *,
    expected_profile: VerifierProfile,
    adapter_name: str = "fake",
) -> GateResult:
    """Apply precedence against an explicitly selected verifier contract."""
    dynamics_limitation = (
        "Simulation-only prototype; fake dynamics are an architectural test double."
        if adapter_name == "fake"
        else "Simulation-only prototype; MetaDrive dynamics do not establish real-world behavior."
    )
    by_id: dict[str, list[Finding]] = {}
    for finding in findings:
        by_id.setdefault(finding.finding_id, []).append(finding)

    expected_findings = EXPECTED_FINDINGS_BY_PROFILE[expected_profile]
    malformed_finding_set = set(by_id) != set(expected_findings) or any(
        len(matches) != 1
        or (
            matches[0].verifier,
            matches[0].verifier_version,
            matches[0].hard_invariant,
        )
        != expected_findings.get(finding_id)
        for finding_id, matches in by_id.items()
    )
    if malformed_finding_set:
        return GateResult(
            gate_name=config.name,
            gate_version=config.version,
            verdict=Verdict.INVALID_EVIDENCE,
            rationale=(
                "Required verifier findings are missing, duplicated, or unsupported; no policy "
                "judgment can be made.",
            ),
            supporting_finding_ids=tuple(sorted(by_id)),
            hard_failures=("gate.finding-set",),
            soft_failures=(),
            residual_limitations=(
                dynamics_limitation,
                "Local SHA-256 evidence is tamper-evident, not independently authenticated.",
                "All configured thresholds are illustrative, not real-world safety limits.",
            ),
            findings=findings,
        )

    trace_failures = [
        finding
        for finding in by_id.get("trace.integrity", [])
        if finding.status is not FindingStatus.PASS
    ]
    collision_failures = [
        finding
        for finding in by_id.get("collision.zero", [])
        if finding.status is FindingStatus.FAIL
    ]
    boundary_failures = [
        finding
        for finding in by_id.get("boundary.within_tolerance", [])
        if finding.status is FindingStatus.FAIL
    ]
    progress_findings = by_id.get("progress.required", [])
    safety_unavailable = [
        finding
        for finding_id in ("collision.zero", "boundary.within_tolerance")
        for finding in by_id.get(finding_id, [])
        if finding.status is FindingStatus.NOT_AVAILABLE
    ]
    progress_failures = [
        finding for finding in progress_findings if finding.status is FindingStatus.FAIL
    ]
    progress_unavailable = [
        finding
        for finding in progress_findings
        if finding.status is FindingStatus.NOT_AVAILABLE
    ]
    fault_coverage_failures = [
        finding
        for finding in by_id.get("fault.coverage.required", [])
        if finding.status is not FindingStatus.PASS
    ]
    unhandled_hard = [
        finding
        for finding in findings
        if finding.hard_invariant
        and finding.finding_id not in EXPLICITLY_ORDERED_HARD_FINDING_IDS
        and finding.status is not FindingStatus.PASS
    ]
    unhandled_hard_unavailable = [
        finding for finding in unhandled_hard if finding.status is FindingStatus.NOT_AVAILABLE
    ]
    unhandled_hard_failures = [
        finding for finding in unhandled_hard if finding.status is FindingStatus.FAIL
    ]
    soft_nonpassing = [
        finding
        for finding in findings
        if not finding.hard_invariant and finding.status is not FindingStatus.PASS
    ]

    if trace_failures:
        verdict = Verdict.INVALID_EVIDENCE
        rationale = ("Stored trace evidence is invalid or internally inconsistent.",)
        hard = tuple(finding.finding_id for finding in trace_failures)
    elif safety_unavailable:
        verdict = Verdict.INVALID_EVIDENCE
        rationale = (
            "Required collision or boundary evidence is NOT_AVAILABLE; no policy judgment "
            "can be made.",
        )
        hard = tuple(finding.finding_id for finding in safety_unavailable)
    elif collision_failures:
        verdict = Verdict.HOLD
        rationale = ("Collision hard invariant failed; positive soft results cannot compensate.",)
        hard = tuple(finding.finding_id for finding in collision_failures)
    elif boundary_failures:
        verdict = Verdict.HOLD
        rationale = (
            "Road-boundary hard invariant failed; positive soft results cannot compensate.",
        )
        hard = tuple(finding.finding_id for finding in boundary_failures)
    elif fault_coverage_failures:
        verdict = Verdict.HOLD
        rationale = (
            "Configured deterministic fault coverage is incomplete; advancement fails closed.",
        )
        hard = tuple(finding.finding_id for finding in fault_coverage_failures)
    elif progress_unavailable:
        verdict = Verdict(config.hard.missing_required_evidence)
        rationale = (
            "Required mission evidence is NOT_AVAILABLE; advancement fails closed.",
        )
        hard = tuple(finding.finding_id for finding in progress_unavailable)
    elif progress_failures:
        verdict = Verdict.HOLD
        rationale = ("Required mission progress criterion failed.",)
        hard = tuple(finding.finding_id for finding in progress_failures)
    elif unhandled_hard_unavailable:
        verdict = Verdict(config.hard.missing_required_evidence)
        rationale = (
            "Required hard-invariant evidence is NOT_AVAILABLE; advancement fails closed.",
        )
        hard = tuple(finding.finding_id for finding in unhandled_hard_unavailable)
    elif unhandled_hard_failures:
        verdict = Verdict.HOLD
        rationale = (
            "A hard invariant failed; positive soft results cannot compensate.",
        )
        hard = tuple(finding.finding_id for finding in unhandled_hard_failures)
    elif soft_nonpassing:
        verdict = Verdict.CONDITIONAL
        rationale = (
            "Hard criteria passed, but illustrative soft criteria failed or are "
            "NOT_AVAILABLE and require human review; "
            "Hermes grants no deployment permission.",
        )
        hard = ()
    else:
        verdict = Verdict.PASS
        rationale = (
            "Configured illustrative prototype criteria passed for this bounded simulation "
            "scenario and seed; this is not a real-world safety or deployment determination.",
        )
        hard = ()

    unavailable = tuple(
        f"{finding.finding_id}: {finding.message}"
        for finding in findings
        if finding.status is FindingStatus.NOT_AVAILABLE
    )
    failed = tuple(
        finding.finding_id for finding in findings if finding.status is not FindingStatus.PASS
    )
    return GateResult(
        gate_name=config.name,
        gate_version=config.version,
        verdict=verdict,
        rationale=rationale,
        supporting_finding_ids=failed,
        hard_failures=hard,
        soft_failures=tuple(finding.finding_id for finding in soft_nonpassing),
        residual_limitations=(
            dynamics_limitation,
            "Local SHA-256 evidence is tamper-evident, not independently authenticated.",
            "All configured thresholds are illustrative, not real-world safety limits.",
            *unavailable,
        ),
        findings=findings,
    )
