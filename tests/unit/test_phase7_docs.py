from __future__ import annotations

from pathlib import Path

_PHASE7_DOCS = (
    "PHASE7_HUMAN_VALIDATION_PLAN.md",
    "PHASE7_HUMAN_OBSERVATION_TEMPLATE.md",
    "PHASE7_COHORT_SYNTHESIS_TEMPLATE.md",
    "PHASE7_MANUAL_VISUAL_RECORD.md",
    "PHASE7_ACCESSIBILITY_RECORD.md",
    "PHASE7_HUMAN_VALIDATION_HANDOFF.md",
    "PHASE7_REQUIREMENTS_TRACEABILITY.md",
)
_AUTHORITY_FIELDS = (
    "Gate verdict",
    "Evidence integrity",
    "Origin",
    "Authorization",
    "Deployment permission",
    "Scope",
    "Authoritative status",
)
_ASSISTANCE_STATES = (
    "UNASSISTED",
    "NEUTRAL_PROMPT",
    "INSTRUCTIONAL_ASSISTANCE",
    "NOT_COMPLETED",
    "NOT_RUN",
)


def _read(repository_root: Path, name: str) -> str:
    raw = (repository_root / "docs" / name).read_text(encoding="utf-8")
    return " ".join(raw.split())


def test_phase7_human_packet_has_exact_file_set_and_honest_statuses(
    repository_root: Path,
) -> None:
    for name in _PHASE7_DOCS:
        text = _read(repository_root, name)
        assert text.startswith("# Hermes Phase 7")
        assert "NOT YET OBSERVED" in text
        assert "SIMULATION_ONLY" in text
        assert "Deployment permission" in text

    handoff = _read(repository_root, "PHASE7_HUMAN_VALIDATION_HANDOFF.md")
    for status in (
        "Automated correctness: TEST-DERIVED",
        "Manual visual quality: NOT YET OBSERVED",
        "Accessibility: NOT YET OBSERVED",
        "Expert critique: NOT YET OBSERVED",
        "Pilot human comprehension: NOT YET OBSERVED",
        "Main-cohort human comprehension: NOT YET OBSERVED",
    ):
        assert status in handoff
    assert "Implementer dry run: EXECUTABILITY ONLY" in handoff
    assert "HUMAN_EVIDENCE_OBSERVED: NOT PROMOTED" in handoff
    assert "COMPREHENSION_GATE_MET: NOT PROMOTED" in handoff


def test_phase7_plan_freezes_ten_versioned_tasks_and_exact_answer_contract(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "PHASE7_HUMAN_VALIDATION_PLAN.md")

    for task_id in range(1, 11):
        assert f"## Task {task_id} —" in text
        assert f"Prompt version: P7-T{task_id:02d}-v1" in text
        assert f"Answer-key version: P7-T{task_id:02d}-A1" in text
    assert "Tasks 1–9 only" in text
    assert "Task 10 is excluded from the North Star" in text
    assert "Task 4: classification, reason, and consequence only" in text
    assert "No timeline scrubbing is required" in text
    assert "No comparison-availability inference is required" in text
    assert "handoff-p4-fault" in text
    assert "Evidence schema: 2.0" in text
    assert "Scenario schema: 3.0" in text
    assert "CONDITIONAL does not grant permission" in text
    assert "1.8155836417275437 → 8.49579415469856 s" in text
    assert "SPEED_CAP at sequences 20, 26, and 32" in text
    assert "candidate never entered the TTC target band" in text
    assert "zero TTC_BELOW_THRESHOLD target reasons" in text
    assert "pre-trigger SPEED_CAP confounding" in text
    for prohibited in (
        "engagement",
        "mechanism exercised",
        "causal",
        "winner",
        "safer",
        "advancement",
    ):
        assert f"Reject: {prohibited}" in text
    assert "comfort.jerk" in text
    assert "effect=CONDITIONAL" in text
    assert "result_if_controlling=CONDITIONAL" in text
    assert "listed_in_soft_failures=true" in text
    assert "listed_in_supporting_findings=true" in text
    assert "overall verdict remains HOLD" in text
    for field in _AUTHORITY_FIELDS:
        assert field in text
    assert text.count("Authority response: use the fixed seven-field answer above.") == 10
    for canonical in (
        "Gate verdict | Artifact-specific",
        "Evidence integrity | Artifact-specific",
        "Origin | NOT_AUTHENTICATED",
        "Authorization | NOT_EVALUATED",
        "Deployment permission | NONE",
        "Scope | SIMULATION_ONLY",
        "Authoritative status | NOT_DEFINED",
    ):
        assert canonical in text


def test_phase7_moderation_protocol_bounds_help_correction_order_and_denominator(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "PHASE7_HUMAN_VALIDATION_PLAN.md")

    for state in _ASSISTANCE_STATES:
        assert state in text
    for required in (
        "Any prompt removes the attempt from the unassisted numerator.",
        "Neutral clarification may restate the task but may not name an answer or evidence value.",
        (
            "Instructional help begins when the moderator supplies an answer, location, "
            "or interpretation."
        ),
        (
            "Correction may occur only after the scored attempt is closed or an "
            "immediate-stop condition fires."
        ),
        "A scored task is never repeated after teaching its answer.",
        "Record exact prompt words and time.",
        "Record exact correction words and time.",
        "Record every protocol deviation.",
        "Record withdrawal and completion state.",
        "NOT_RUN_TECHNICAL",
        "denominator-visible",
        "blocks 100% executable-instrument coverage",
        "corrected and rerun under the unchanged frozen protocol before cohort closure",
        "Pilot median hypothesis (single-artifact): <=120 seconds — PROPOSED",
        "Pilot median hypothesis (accountability/comparison): <=240 seconds — PROPOSED",
        "Frozen per-attempt numerator bound: TBD_BEFORE_MAIN_COHORT",
        "The cohort-median hypotheses are not per-attempt timeouts.",
        "Pilot task order, maximum session duration, and break rule are frozen before use.",
        "Tasks 1–9 are deterministically counterbalanced by participant-order assignment.",
        "Every session preserves its assigned order.",
        "Record fatigue and carryover observations.",
        (
            "Numerator: exact count of assigned Tasks 1–9 completed correctly, "
            "UNASSISTED, and within the frozen bound."
        ),
        "Denominator: every assigned Tasks 1–9 opportunity.",
        (
            "Only protocol-defined withdrawals may be excluded, and every exclusion is "
            "reported explicitly."
        ),
        "Report task, participant-role, and accessibility slices separately.",
        "No composite score.",
        "Main-cohort eligibility: 6–10 declared non-author participants",
        "Report raw eligible participant and task counts",
        "Never exclude an eligible attempt because it is incorrect.",
        "Never turn the small raw count into an unqualified population percentage.",
        "Pilot cohort: 2–3 declared non-author participants.",
        "At least 80% correct unassisted eligible critical attempts — PROPOSED",
        "Zero critical trust misconceptions — PROPOSED",
        "100% executable critical fixture coverage — PROPOSED",
        "READY_FOR_PILOT",
        "READY_FOR_MAIN_COHORT",
        "Material prompt, key, fixture, UI, or threshold changes exclude pilot results",
        "no open P0/P1 instrument or authority finding",
        "no open P0/P1 instrument finding",
        "authority label or state mismatch",
        "hidden required failure",
        "keyboard trap or unreachable critical control",
        "fixture digest mismatch",
        "none may be accepted as risk-owned debt for recruitment",
    ):
        assert required in text


def test_phase7_plan_contains_every_immediate_stop_and_privacy_boundary(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "PHASE7_HUMAN_VALIDATION_PLAN.md")
    for stop in (
        "PASS or CONDITIONAL as safe, authenticated, authoritative, approved, or deployable",
        "uses quarantined evidence",
        "hard failure as compensable",
        "unavailable as zero, false, blank, infinity, or pass",
        "collapses candidate, permitted, and executed actions",
        "attributes a control fault to the shield",
        "winner, safer, or advancement from mixed comparison",
        "attributes a mixed-pair metric delta to the challenge or shield",
        "recorded intervention as proof of causal effect",
        "TTC-mechanism engagement from comparison evidence alone",
        "infers deltas from incompatibility",
        "provenance or hash as an origin signature",
        "fixture digest mismatch",
        "failed verification",
        "artifact mutation",
        "contradictory answer key",
        "moderator teaching",
        "essential inaccessible workflow",
    ):
        assert stop in text
    for privacy in (
        "Participant IDs only",
        "explicit recording consent",
        "encrypted raw data outside Git and artifacts/",
        "Evidence custodian:",
        "Deletion owner:",
        "30 days after accepted synthesis",
        "do not share employer-confidential information",
        "No names, emails, employers, or employer-confidential information in Git",
        "Only blank templates and de-identified accepted synthesis may be committed",
        "On unexpected generation exit, oracle mismatch, digest mismatch, or immutability mismatch",
        "preserve the command, repository state, output, artifact, and diagnostics",
        "retry only through a separately reviewed new scenario/run version",
    ):
        assert privacy in text


def test_observation_template_is_blank_and_records_all_authority_and_protocol_fields(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "PHASE7_HUMAN_OBSERVATION_TEMPLATE.md")
    for field in (
        "Participant ID: ____",
        "Consent recorded: ____",
        "Assigned task order: ____",
        "Actual task order: ____",
        "Assistance state: ____",
        "Prompt exact words: ____",
        "Prompt time: ____",
        "Correction exact words: ____",
        "Correction time: ____",
        "Deviation: ____",
        "Withdrawal: ____",
        "Completion state: ____",
        "Technical invalidation: ____",
        "Fatigue observation: ____",
        "Carryover observation: ____",
        "Participant quote (verbatim): ____",
        "Observer inference: ____",
    ):
        assert field in text
    for field in _AUTHORITY_FIELDS:
        assert f"{field}: ____" in text
    for state in _ASSISTANCE_STATES:
        assert state in text
    assert "NOT_RUN_TECHNICAL" in text
    assert "handoff-" not in text
    assert "Expected answer" not in text
    assert "Answer key" not in text
    assert "1.8155836417275437" not in text
    assert "SPEED_CAP" not in text


def test_cohort_synthesis_keeps_claims_bounded_and_outcomes_separate(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "PHASE7_COHORT_SYNTHESIS_TEMPLATE.md")
    for field in _AUTHORITY_FIELDS:
        assert field in text
    for required in (
        "HUMAN_EVIDENCE_OBSERVED: ____",
        "COMPREHENSION_GATE_MET: ____",
        "Eligible unassisted-correct-within-bound numerator: ____",
        "Assigned Tasks 1–9 denominator: ____",
        "Withdrawal-only exclusions: ____",
        "NOT_RUN_TECHNICAL opportunities: ____",
        "Executable critical-task coverage: ____",
        "Task slices",
        "Participant-role slices",
        "Accessibility slices",
        "No composite score",
        "observed sample and tasks only",
        "does not generalize to reviewer populations",
        "does not describe Waymo practice",
        "does not establish safety readiness",
        "does not grant deployment permission",
        "HOLD AND REDESIGN",
        "Raw eligible participant count: ____",
        "Raw assigned task-opportunity count: ____",
        "6–10 declared non-author participants",
        "No unqualified population percentage",
    ):
        assert required in text


def test_manual_and_accessibility_records_define_named_unexecuted_flows(
    repository_root: Path,
) -> None:
    manual = _read(repository_root, "PHASE7_MANUAL_VISUAL_RECORD.md")
    accessibility = _read(repository_root, "PHASE7_ACCESSIBILITY_RECORD.md")

    assert "Status: NOT YET OBSERVED" in manual
    assert "Status: NOT YET OBSERVED" in accessibility
    assert "Browser/version: ____" in manual
    assert "Viewport: ____" in manual
    assert "Keyboard-only nominal review flow" in accessibility
    assert "Screen-reader nominal review flow" in accessibility
    assert "Browser/version: ____" in accessibility
    assert "Assistive technology/version: ____" in accessibility
    assert "Task 10" in accessibility
    assert "handoff-phase5-demo" in accessibility
    assert "No comparison is included" in accessibility
    assert "excluded from the North Star denominator" in accessibility
    assert "No WCAG claim" in accessibility


def test_phase7_traceability_and_phase6_supersession_are_explicit(
    repository_root: Path,
) -> None:
    traceability = _read(repository_root, "PHASE7_REQUIREMENTS_TRACEABILITY.md")
    for requirement_id in (
        "P7-HV-01",
        "P7-HV-02",
        "P7-HV-03",
        "P7-HV-04",
        "P7-HV-05",
        "P7-HV-06",
        "P7-HV-07",
        "P7-HV-08",
        "P7-HV-09",
        "P7-HV-10",
    ):
        assert requirement_id in traceability

    phase6 = _read(repository_root, "PHASE6_USABILITY_TEST_PLAN.md")
    assert "Superseded for future execution by PHASE7_HUMAN_VALIDATION_PLAN.md" in phase6
    assert "Historical Phase 6 evidence is preserved and not reinterpreted." in phase6

    demo = _read(repository_root, "PHASE6_DEMO_RUNBOOK.md")
    assert (
        "Stored deltas are descriptive; comparison alone does not establish challenge "
        "engagement or causal treatment effect"
    ) in demo
    assert "The retained lead and cut-in pairs must not be presented as proof" in demo

    decision_log = _read(repository_root, "decision-log.md")
    assert "Phase 7 human-validation instrument repair" in decision_log
    assert "six findings plus seven sufficiency rows" in decision_log
    assert (
        "human, manual, accessibility, expert, pilot, and cohort status remain "
        "NOT YET OBSERVED"
    ) in decision_log
