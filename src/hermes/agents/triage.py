"""Failure triage: a deterministic classifier, and agents that propose against it.

The division of authority here is the whole point of the module.

``classify_failure`` is the authoritative label. It is a pure function of stored evidence
with a fixed precedence rule, so two people running it on the same bundle a year apart get
the same answer, and no agent can move it.

An ``AgentRuntime`` produces a *proposal*: the same taxonomy, plus a rationale and
citations. The proposal is stored beside the deterministic label, never in place of it, so
a reviewer can see agreement and disagreement rather than a single confident answer whose
provenance has been laundered away.

``ScriptedAgent`` is the only runtime exercised in tests. It is deterministic, needs no API
key, and exists so that agent-shaped workflows can be regression-tested at all - a live
model's output is a non-deterministic draft, and every artifact downstream of it must be
reproducible without re-invoking it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from hermes.agents.contracts import (
    Citation,
    FailureCategory,
    TriageProposal,
)
from hermes.agents.tools import ToolContext, get_findings, get_metrics, query_run

#: Deterministic precedence: upstream causes win over downstream symptoms.
#:
#: A stale observation that leads to a late intervention is one failure, not two, and
#: reporting it as "intervention too late" would send an investigator to the controller
#: when the defect is in the observation path. PRD §0-A.7.9 fixes the ordering as
#: OBSERVATION > PLANNING > CONTROL > SYSTEM.
_PRECEDENCE: tuple[FailureCategory, ...] = (
    FailureCategory.STALE_OBSERVATION,
    FailureCategory.MISSED_INTERVENTION,
    FailureCategory.INTERVENTION_TOO_LATE,
    FailureCategory.OVER_INTERVENTION,
    FailureCategory.COMFORT_VIOLATION,
)

_FINDING_TO_CATEGORY: dict[str, FailureCategory] = {
    "adas.aeb.threat_response": FailureCategory.MISSED_INTERVENTION,
    "adas.aeb.brake_onset_margin": FailureCategory.INTERVENTION_TOO_LATE,
    "adas.aeb.no_false_intervention": FailureCategory.OVER_INTERVENTION,
    "comfort.acceleration": FailureCategory.COMFORT_VIOLATION,
    "comfort.jerk": FailureCategory.COMFORT_VIOLATION,
}


def classify_failure(context: ToolContext, run_id: str) -> tuple[FailureCategory, tuple[str, ...]]:
    """Assign the authoritative failure category for a run.

    Returns the category and the finding IDs that support it. ``UNKNOWN`` is reserved for a
    run that failed in a way no predicate matches - it is a signal that the taxonomy needs
    extending, so it must never be used as a catch-all for "probably fine".
    """
    findings = get_findings(context, run_id=run_id)
    if not findings.ok:
        return FailureCategory.UNKNOWN, ()
    items = findings.data.get("findings", [])
    assert isinstance(items, list)

    failed_by_category: dict[FailureCategory, list[str]] = {}
    any_failure = False
    for item in items:
        if item["status"] == "PASS":
            continue
        any_failure = True
        category = _FINDING_TO_CATEGORY.get(item["finding_id"])
        if category is None:
            continue
        failed_by_category.setdefault(category, []).append(item["finding_id"])

    for category in _PRECEDENCE:
        if category in failed_by_category:
            return category, tuple(sorted(failed_by_category[category]))
    if not any_failure:
        return FailureCategory.NO_FAILURE, ()
    return FailureCategory.UNKNOWN, ()


@runtime_checkable
class AgentRuntime(Protocol):
    """The seam a language model sits behind.

    Deliberately narrow. A runtime receives evidence that has already been read by the
    deterministic tool layer and returns a proposal; it never reaches the filesystem, the
    simulator, or the gate itself.
    """

    name: str

    def propose_triage(
        self,
        *,
        run_id: str,
        evidence: dict[str, object],
        citations: tuple[Citation, ...],
    ) -> tuple[FailureCategory, str]:
        """Return a proposed category and a rationale for it."""


@dataclass(slots=True)
class ScriptedAgent:
    """A deterministic runtime standing in for a language model.

    It reads the same evidence a model would and applies an explicit, inspectable rule.
    Its value is not intelligence - it is that the workflow around it can be tested,
    measured, and regression-protected without a network call or a non-deterministic draft.
    """

    name: str = "scripted-agent/1.0"

    def propose_triage(
        self,
        *,
        run_id: str,
        evidence: dict[str, object],
        citations: tuple[Citation, ...],
    ) -> tuple[FailureCategory, str]:
        del run_id, citations
        failed = evidence.get("failed_findings", ())
        assert isinstance(failed, (list, tuple))
        if not failed:
            return (
                FailureCategory.NO_FAILURE,
                "No verifier finding is failing, so no failure is proposed.",
            )
        for category in _PRECEDENCE:
            supporting = [
                finding_id
                for finding_id in failed
                if _FINDING_TO_CATEGORY.get(str(finding_id)) is category
            ]
            if supporting:
                return (
                    category,
                    f"{', '.join(sorted(supporting))} is failing, which under the "
                    f"upstream-wins precedence rule indicates {category.value}.",
                )
        return (
            FailureCategory.UNKNOWN,
            f"Findings {sorted(map(str, failed))} are failing but map to no known "
            "failure category; the taxonomy may need extending.",
        )


def triage_run(
    context: ToolContext,
    run_id: str,
    runtime: AgentRuntime | None = None,
) -> TriageProposal:
    """Run the triage workflow: read evidence, propose, and record beside the truth.

    The agent is called once, with evidence the tool layer already read and cited. It cannot
    widen its own access, and its answer is placed next to the deterministic label rather
    than substituted for it.
    """
    runtime = runtime or ScriptedAgent()
    deterministic, supporting = classify_failure(context, run_id)

    findings = get_findings(context, run_id=run_id)
    metrics = get_metrics(context, run_id=run_id)
    identity = query_run(context, run_id=run_id)
    items = findings.data.get("findings", []) if findings.ok else []
    assert isinstance(items, list)
    failed = [item["finding_id"] for item in items if item["status"] != "PASS"]

    citations = (*identity.citations, *findings.citations, *metrics.citations)
    evidence: dict[str, object] = {
        "failed_findings": failed,
        "verdict": identity.data.get("verdict") if identity.ok else None,
        "integrity": identity.data.get("integrity") if identity.ok else None,
    }
    proposed, rationale = runtime.propose_triage(
        run_id=run_id, evidence=evidence, citations=citations
    )

    supporting_citations = tuple(
        citation
        for citation in citations
        if citation.artifact_file in {"findings.json", "verdict.json"}
    )
    return TriageProposal(
        run_id=run_id,
        category=proposed,
        deterministic_category=deterministic,
        rationale=rationale + (
            f" Supporting deterministic findings: {', '.join(supporting)}."
            if supporting
            else ""
        ),
        citations=supporting_citations[:12],
        runtime=runtime.name,
    )
