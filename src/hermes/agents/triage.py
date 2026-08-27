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
from hermes.agents.tools import (
    STALE_OBSERVATION_FAULT_REASONS,
    ToolContext,
    _require_bundle,
    get_findings,
    get_metrics,
    query_run,
)

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
_STALE_OBSERVATION_FINDING_IDS = frozenset({"adas.aeb.threat_response"})

def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _has_causal_stale_observation(evidence: dict[str, object]) -> bool:
    """Return whether verified evidence proves a stale-observation failure chain."""
    failed = evidence.get("failed_findings")
    if not isinstance(failed, (list, tuple)) or not any(
        str(finding_id) in _STALE_OBSERVATION_FINDING_IDS for finding_id in failed
    ):
        return False
    if evidence.get("integrity") != "INTERNALLY_CONSISTENT":
        return False
    counterfactual = evidence.get("aeb_stale_observation_counterfactual")
    if not isinstance(counterfactual, dict):
        return False
    if set(counterfactual) != {
        "sequence",
        "delivered_from_sequence",
        "raw_replay_brake",
        "stored_candidate_brake",
    }:
        return False
    if (
        not isinstance(counterfactual["sequence"], int)
        or isinstance(counterfactual["sequence"], bool)
        or counterfactual["sequence"] < 0
        or not isinstance(counterfactual["delivered_from_sequence"], int)
        or isinstance(counterfactual["delivered_from_sequence"], bool)
        or counterfactual["delivered_from_sequence"] < 0
        or counterfactual["delivered_from_sequence"] >= counterfactual["sequence"]
        or not _is_number(counterfactual["raw_replay_brake"])
        or float(counterfactual["raw_replay_brake"]) <= 0.0
        or not _is_number(counterfactual["stored_candidate_brake"])
        or float(counterfactual["stored_candidate_brake"]) != 0.0
    ):
        return False
    maximum_age = evidence.get("max_observation_age_s")
    threshold = evidence.get("aeb_stale_observation_s")
    if not _is_number(maximum_age) or not _is_number(threshold):
        return False
    if float(maximum_age) <= float(threshold):
        return False
    counts = evidence.get("fault_application_counts")
    if not isinstance(counts, dict):
        return False
    return any(
        _is_number(counts.get(reason)) and float(counts[reason]) > 0.0
        for reason in STALE_OBSERVATION_FAULT_REASONS
    )


def _read_triage_evidence(
    context: ToolContext,
    run_id: str,
) -> tuple[dict[str, object], tuple[Citation, ...], bool]:
    captured_bundle, _capture_error = _require_bundle(context, "triage_run", run_id)
    if captured_bundle is None:
        return (
            {
                "evidence_reads_ok": False,
                "failed_findings": [],
                "failed_stale_finding_locators": (),
                "verdict": None,
                "integrity": None,
                "max_observation_age_s": None,
                "fault_application_counts": {},
                "aeb_stale_observation_s": None,
                "aeb_stale_observation_counterfactual": None,
            },
            (),
            False,
        )
    findings = get_findings(context, run_id=run_id, _captured_bundle=captured_bundle)
    metrics = get_metrics(context, run_id=run_id, _captured_bundle=captured_bundle)
    identity = query_run(context, run_id=run_id, _captured_bundle=captured_bundle)

    items = findings.data.get("findings", []) if findings.ok else []
    assert isinstance(items, list)
    failed = [item["finding_id"] for item in items if item["status"] == "FAIL"]
    failed_stale_locators = tuple(
        f"/findings/{index}/status"
        for index, item in enumerate(items)
        if item["status"] == "FAIL"
        and str(item["finding_id"]) in _STALE_OBSERVATION_FINDING_IDS
    )

    metrics_document = metrics.data.get("metrics", {}) if metrics.ok else {}
    assert isinstance(metrics_document, dict)
    maximum_age_metric = metrics_document.get("max_observation_age_s")
    maximum_age: object = None
    if (
        isinstance(maximum_age_metric, dict)
        and maximum_age_metric.get("availability") == "AVAILABLE"
    ):
        maximum_age = maximum_age_metric.get("value")
    fault_counts = metrics_document.get("fault_application_counts", {})
    if not isinstance(fault_counts, dict):
        fault_counts = {}

    evidence: dict[str, object] = {
        "evidence_reads_ok": findings.ok and metrics.ok and identity.ok,
        "failed_findings": failed,
        "failed_stale_finding_locators": failed_stale_locators,
        "verdict": identity.data.get("verdict") if identity.ok else None,
        "integrity": identity.data.get("integrity") if identity.ok else None,
        "max_observation_age_s": maximum_age,
        "fault_application_counts": fault_counts,
        "aeb_stale_observation_s": (
            identity.data.get("aeb_stale_observation_s") if identity.ok else None
        ),
        "aeb_stale_observation_counterfactual": (
            identity.data.get("aeb_stale_observation_counterfactual")
            if identity.ok
            else None
        ),
    }
    citations = (*findings.citations, *metrics.citations, *identity.citations)
    return evidence, citations, findings.ok and metrics.ok and identity.ok


def _classify_evidence(
    evidence: dict[str, object],
    *,
    evidence_reads_ok: bool,
) -> tuple[FailureCategory, tuple[str, ...]]:
    if not evidence_reads_ok:
        return FailureCategory.UNKNOWN, ()
    failed = evidence.get("failed_findings", ())
    assert isinstance(failed, (list, tuple))
    if _has_causal_stale_observation(evidence):
        supporting = tuple(
            sorted(
                str(finding_id)
                for finding_id in failed
                if str(finding_id) in _STALE_OBSERVATION_FINDING_IDS
            )
        )
        return FailureCategory.STALE_OBSERVATION, supporting

    failed_by_category: dict[FailureCategory, list[str]] = {}
    for raw_finding_id in failed:
        finding_id = str(raw_finding_id)
        category = _FINDING_TO_CATEGORY.get(finding_id)
        if category is not None:
            failed_by_category.setdefault(category, []).append(finding_id)

    for category in _PRECEDENCE:
        if category in failed_by_category:
            return category, tuple(sorted(failed_by_category[category]))
    if not failed:
        return FailureCategory.NO_FAILURE, ()
    return FailureCategory.UNKNOWN, ()


def classify_failure(context: ToolContext, run_id: str) -> tuple[FailureCategory, tuple[str, ...]]:
    """Assign the authoritative failure category for a run.

    Returns the category and the finding IDs that support it. ``UNKNOWN`` is reserved for a
    run that failed in a way no predicate matches - it is a signal that the taxonomy needs
    extending, so it must never be used as a catch-all for "probably fine".
    """
    evidence, _citations, evidence_reads_ok = _read_triage_evidence(context, run_id)
    return _classify_evidence(evidence, evidence_reads_ok=evidence_reads_ok)


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
        if evidence.get("evidence_reads_ok") is not True:
            return (
                FailureCategory.UNKNOWN,
                "Required stored evidence could not be read, so no failure category is proposed.",
            )
        failed = evidence.get("failed_findings", ())
        assert isinstance(failed, (list, tuple))
        if not failed:
            return (
                FailureCategory.NO_FAILURE,
                "No verifier finding is failing, so no failure is proposed.",
            )
        if _has_causal_stale_observation(evidence):
            supporting = sorted(
                str(finding_id)
                for finding_id in failed
                if str(finding_id) in _STALE_OBSERVATION_FINDING_IDS
            )
            return (
                FailureCategory.STALE_OBSERVATION,
                f"{', '.join(supporting)} is failing and verified observation-fault "
                "evidence exceeds the stored AEB staleness threshold, which under the "
                "upstream-wins precedence rule indicates STALE_OBSERVATION.",
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
    evidence, citations, evidence_reads_ok = _read_triage_evidence(context, run_id)
    deterministic, supporting = _classify_evidence(
        evidence, evidence_reads_ok=evidence_reads_ok
    )
    proposed, rationale = runtime.propose_triage(
        run_id=run_id, evidence=evidence, citations=citations
    )

    if proposed is FailureCategory.STALE_OBSERVATION:
        stale_finding_locators = evidence.get("failed_stale_finding_locators", ())
        assert isinstance(stale_finding_locators, (list, tuple))
        fault_counts = evidence.get("fault_application_counts", {})
        assert isinstance(fault_counts, dict)
        positive_fault_locators = {
            f"/fault_application_counts/{reason}"
            for reason in STALE_OBSERVATION_FAULT_REASONS
            if _is_number(fault_counts.get(reason)) and float(fault_counts[reason]) > 0.0
        }
        supporting_citations = tuple(
            citation
            for citation in citations
            if (
                citation.artifact_file == "findings.json"
                and citation.locator in stale_finding_locators
            )
            or (
                citation.artifact_file == "metrics.json"
                and (
                    citation.locator == "/max_observation_age_s/value"
                    or citation.locator in positive_fault_locators
                )
            )
            or (
                citation.artifact_file == "execution-context.json"
                and citation.locator == "/policy/config/aeb/stale_observation_s"
            )
            or citation.artifact_file == "events.jsonl"
        )
    else:
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
        citations=(
            supporting_citations
            if proposed is FailureCategory.STALE_OBSERVATION
            else supporting_citations[:12]
        ),
        runtime=runtime.name,
    )
