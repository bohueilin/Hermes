"""Non-compensatory release-gate precedence over structured findings."""

from __future__ import annotations

from hermes.domain.enums import FindingStatus, Verdict
from hermes.domain.models import Finding, GateResult
from hermes.gates.config import GateConfig

EXPECTED_FINDINGS = {
    "trace.integrity": ("TraceIntegrityVerifier", "1.0", True),
    "collision.zero": ("CollisionVerifier", "1.0", True),
    "boundary.within_tolerance": ("BoundaryVerifier", "1.0", True),
    "progress.required": ("ProgressVerifier", "1.0", True),
    "comfort.acceleration": ("ComfortVerifier", "1.0", False),
    "comfort.jerk": ("ComfortVerifier", "1.0", False),
}


def apply_release_gate(
    findings: tuple[Finding, ...],
    config: GateConfig,
) -> GateResult:
    """Apply explicit precedence; aggregate scores cannot mask a hard failure."""
    by_id: dict[str, list[Finding]] = {}
    for finding in findings:
        by_id.setdefault(finding.finding_id, []).append(finding)

    malformed_finding_set = set(by_id) != set(EXPECTED_FINDINGS) or any(
        len(matches) != 1
        or (
            matches[0].verifier,
            matches[0].verifier_version,
            matches[0].hard_invariant,
        )
        != EXPECTED_FINDINGS.get(finding_id)
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
                "Simulation-only prototype; fake dynamics are an architectural test double.",
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
            "Simulation-only prototype; fake dynamics are an architectural test double.",
            "Local SHA-256 evidence is tamper-evident, not independently authenticated.",
            "All configured thresholds are illustrative, not real-world safety limits.",
            *unavailable,
        ),
        findings=findings,
    )
