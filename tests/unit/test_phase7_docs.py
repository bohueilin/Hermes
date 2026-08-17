from __future__ import annotations

import re
from pathlib import Path

import pytest

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
    return " ".join(raw.replace("`", "").split())


def _read_raw(repository_root: Path, name: str) -> str:
    return (repository_root / "docs" / name).read_text(encoding="utf-8")


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
    assert "Authority response: use the fixed seven-field answer above." not in text
    assert text.count("Scoring checklist — correct only if every item is satisfied:") == 10
    assert text.count("Required source references:") == 10
    assert "Artifact-specific" not in text
    for canonical in (
        "Gate verdict | Frozen exactly in each task scoring checklist",
        "Evidence integrity | Frozen exactly in each task scoring checklist",
        "Origin | NOT_AUTHENTICATED",
        "Authorization | NOT_EVALUATED",
        "Deployment permission | NONE",
        "Scope | SIMULATION_ONLY",
        "Authoritative status | NOT_DEFINED",
    ):
        assert canonical in text


def _task_section(plan: str, task_id: int) -> str:
    start = plan.index(f"## Task {task_id} —")
    end = plan.find("## Task ", start + 1)
    return plan[start:] if end == -1 else plan[start:end]


def test_phase7_scoring_keys_bind_exact_artifact_facts_sources_and_authority(
    repository_root: Path,
) -> None:
    plan = _read(repository_root, "PHASE7_HUMAN_VALIDATION_PLAN.md")

    single_side_authority = {
        1: ("PASS", "INTERNALLY_CONSISTENT"),
        2: ("HOLD", "INTERNALLY_CONSISTENT"),
        3: ("INVALID_EVIDENCE", "INVALID_EVIDENCE"),
        4: ("HOLD", "INTERNALLY_CONSISTENT"),
        5: ("HOLD", "INTERNALLY_CONSISTENT"),
        6: ("CONDITIONAL", "INTERNALLY_CONSISTENT"),
        8: ("PASS", "INTERNALLY_CONSISTENT"),
        10: ("PASS", "INTERNALLY_CONSISTENT"),
    }
    for task_id, (gate, integrity) in single_side_authority.items():
        section = _task_section(plan, task_id)
        assert (
            f"Required authority state: Gate verdict {gate}; Evidence integrity "
            f"{integrity}; Origin NOT_AUTHENTICATED; Authorization NOT_EVALUATED; "
            "Deployment permission NONE; Scope SIMULATION_ONLY; Authoritative status "
            "NOT_DEFINED."
        ) in section

    task2 = _task_section(plan, 2)
    for exact in (
        "collision.zero is REQUIRED / FAIL / AVAILABLE",
        "measured 1.0 count against LTE 0.0 count",
        "first supporting collision is sequence 12 at 1.3 s",
        "sequence 11 remains 0 collisions",
        "Collision hard invariant failed; positive soft results cannot compensate.",
        "events.jsonl /vehicle_state/collision_count @ sequence 12",
        "gate-config.resolved.yaml /hard/max_collision_count",
        "findings.json /findings/1",
    ):
        assert exact in task2

    task5 = _task_section(plan, 5)
    for exact in (
        "event 9 at 1.0 s",
        "candidate brake 0.9897080762989154, steering -0.5511323602891678, throttle 0.0",
        "permitted brake 1.0, steering -0.5511323809623718, throttle 0.0",
        "SPEED_CAP",
        "event 10 at 1.1 s",
        "executed_from_sequence 9",
        "executed_from_candidate_time_s 0.9",
        "execution_time_s 1.0",
        "control latency 99.99999999999997 ms",
        "executed brake 0.5, steering -0.25, throttle 0.0",
        "CONTROL_DELAY, STEERING_SATURATION, and BRAKE_SATURATION",
        "OBSERVATION_DELAY and OBSERVATION_NOISE",
        "events.jsonl /candidate_action @ sequence 9",
        "events.jsonl /permitted_action @ sequence 9",
        "events.jsonl /observation_fault_evidence/delivered_from_sequence @ sequence 9",
        "events.jsonl /observation_fault_evidence/delivered_from_time_s @ sequence 9",
        (
            "events.jsonl /observation_fault_evidence/delivered_observation/"
            "observation_age_s @ sequence 9"
        ),
        "events.jsonl /executed_action @ sequence 10",
        "events.jsonl /executed_from_sequence @ sequence 10",
    ):
        assert exact in task5
    assert "do not claim a same-row causal chain" in task5

    task6 = _task_section(plan, 6)
    for exact in (
        "comfort.acceleration is OPTIONAL / FAIL / AVAILABLE",
        "measured 6.0 m/s^2 against max_abs_acceleration_mps2 <= 4.0",
        "sole controlling soft finding",
        "first support is sequence 12 at 1.3 s",
        "effect CONDITIONAL and result_if_controlling CONDITIONAL",
        "events.jsonl /vehicle_state/acceleration_mps2 @ sequence 12",
        "gate-config.resolved.yaml /soft/max_abs_acceleration_mps2",
        "metrics.json /max_abs_acceleration_mps2",
        "findings.json /findings/4",
    ):
        assert exact in task6

    task7 = _task_section(plan, 7)
    for exact in (
        "minimum TTC: 1.8155836417275437 → 8.49579415469856 s (IMPROVED)",
        "route completion: 84.88178621406203 → 84.39151677812995 % (REGRESSED)",
        (
            "maximum absolute acceleration: 12.683377265917573 → "
            "13.003747463227677 m/s^2 (REGRESSED)"
        ),
        (
            "maximum absolute jerk: 128.41591835005693 → 157.565283775339 "
            "m/s^3 (REGRESSED)"
        ),
        "baseline Gate verdict HOLD / Evidence integrity INTERNALLY_CONSISTENT",
        "candidate Gate verdict HOLD / Evidence integrity INTERNALLY_CONSISTENT",
        "comparison COMPATIBLE",
        "events.jsonl /override_reasons @ sequences 20, 26, and 32",
        "metrics.json /shield_override_reasons",
    ):
        assert exact in task7

    task9 = _task_section(plan, 9)
    for exact in (
        "baseline Gate verdict CONDITIONAL / Evidence integrity INTERNALLY_CONSISTENT",
        "candidate Gate verdict HOLD / Evidence integrity INTERNALLY_CONSISTENT",
        "INCOMPATIBLE does not mean either side is INVALID_EVIDENCE",
        "a3b738431af234f4d2751667e8fee869307bc7c6d32b69fa71b602d340b48aaf",
        "5d96994b9a1efd7626f162d852501a7c51c358e865be24a5c7929c2de5129e32",
        "lead_vehicle_hard_brake",
        "cut_in_near_field",
        "4bf4f0051f46a079abf3d208773ea9ed668e0888f81c1b70f24752adcd9bc4a3",
        "d8e9e31b3f069fb9cbd26d5331747255315a112109af29345ccd6e1fddf0b999",
        "manifest.json /scenario_digest",
        "manifest.json /scenario_name",
        "manifest.json /adapter_config_digest",
    ):
        assert exact in task9

    required_source_by_task = {
        1: "verdict.json /verdict",
        2: "events.jsonl /vehicle_state/collision_count @ sequence 12",
        3: 'bundle.sha256 whole-file pointer ""',
        4: "findings.json /findings/3",
        5: "events.jsonl /candidate_action @ sequence 9",
        6: "findings.json /findings/4",
        7: "BASELINE metrics.json /minimum_ttc_s",
        8: "manifest.json /simulator_commit",
        9: "manifest.json /scenario_digest",
        10: "verdict.json /verdict",
    }
    for task_id, source_reference in required_source_by_task.items():
        assert source_reference in _task_section(plan, task_id)


def test_phase7_observation_records_bind_sessions_to_frozen_fixture_state(
    repository_root: Path,
) -> None:
    observation = _read(repository_root, "PHASE7_HUMAN_OBSERVATION_TEMPLATE.md")
    accessibility = _read(repository_root, "PHASE7_ACCESSIBILITY_RECORD.md")

    for field in (
        "Protocol version: ____",
        "Session ID: ____",
        "Session date: ____",
        "Implementation commit: ____",
        "Fixture-registry SHA-256: ____",
        "Fresh verification result: ____",
        "Task version: ____",
        "Fixture key: ____",
        "Locator: ____",
        "Manifest run ID: ____",
        "Observed bundle digest SHA-256: ____",
        "Computed bundle digest SHA-256: ____",
        "Observed trace digest SHA-256: ____",
        "Computed trace digest SHA-256: ____",
        "Baseline fixture key: ____",
        "Baseline locator: ____",
        "Baseline manifest run ID: ____",
        "Baseline observed bundle digest SHA-256: ____",
        "Baseline computed bundle digest SHA-256: ____",
        "Baseline observed trace digest SHA-256: ____",
        "Baseline computed trace digest SHA-256: ____",
        "Candidate fixture key: ____",
        "Candidate locator: ____",
        "Candidate manifest run ID: ____",
        "Candidate observed bundle digest SHA-256: ____",
        "Candidate computed bundle digest SHA-256: ____",
        "Candidate observed trace digest SHA-256: ____",
        "Candidate computed trace digest SHA-256: ____",
    ):
        assert field in observation

    for field in (
        "Protocol version: ____",
        "Task version: ____",
        "Session ID: ____",
        "Date: ____",
        "Implementation commit: ____",
        "Fixture-registry SHA-256: ____",
        "Fresh verification result: ____",
        "Fixture key: ____",
        "Locator: ____",
        "Manifest run ID: ____",
        "Observed bundle digest SHA-256: ____",
        "Computed bundle digest SHA-256: ____",
        "Observed trace digest SHA-256: ____",
        "Computed trace digest SHA-256: ____",
        "Exact operation command: ____",
    ):
        assert field in accessibility


def test_phase7_eligibility_handoff_ownership_and_statuses_fail_closed(
    repository_root: Path,
) -> None:
    plan = _read(repository_root, "PHASE7_HUMAN_VALIDATION_PLAN.md")
    handoff = _read(repository_root, "PHASE7_HUMAN_VALIDATION_HANDOFF.md")
    observation = _read(repository_root, "PHASE7_HUMAN_OBSERVATION_TEMPLATE.md")
    raw_handoff = _read_raw(repository_root, "PHASE7_HUMAN_VALIDATION_HANDOFF.md")

    for exact in (
        "Frozen eligible roles: PRODUCT, SAFETY, SIMULATION, ENGINEERING.",
        "at least one eligible participant from each frozen role",
        (
            "Eligible means age 18 or older, explicit consent, declared non-author of "
            "the Hermes Phase 7 instrument, answer keys, fixtures, and implementation"
        ),
        "A participant declares exactly one primary frozen role for slicing.",
    ):
        assert exact in plan

    assert handoff.index("Pre-pilot freeze gate") < handoff.index(
        "Run the 2–3-person non-author pilot"
    )
    assert handoff.index("Run the 2–3-person non-author pilot") < handoff.index(
        "Post-pilot main-cohort freeze gate"
    )
    assert handoff.index("Post-pilot main-cohort freeze gate") < handoff.index(
        "Recruit the 6–10-person main cohort"
    )

    for text in (plan, handoff):
        assert "Bo-Huei Lin" not in text
        assert "Evidence custodian: UNASSIGNED" in text
        assert "Deletion owner: UNASSIGNED" in text
        assert "Recruitment is blocked until both owners explicitly accept" in text

    assert (
        "Moderator-only, non-scored, immutable safety boundary: Scope SIMULATION_ONLY; "
        "Deployment permission NONE."
    ) in observation
    assert "Scope: ____" in observation
    assert "Deployment permission: ____" in observation

    expected_statuses = {
        "Automated correctness": "TEST-DERIVED",
        "Manual visual quality": "NOT YET OBSERVED",
        "Accessibility": "NOT YET OBSERVED",
        "Expert critique": "NOT YET OBSERVED",
        "Pilot human comprehension": "NOT YET OBSERVED",
        "Main-cohort human comprehension": "NOT YET OBSERVED",
        "HUMAN_EVIDENCE_OBSERVED": "NOT PROMOTED",
        "COMPREHENSION_GATE_MET": "NOT PROMOTED",
    }

    def assert_exact_statuses(raw: str) -> None:
        for label, expected in expected_statuses.items():
            values = re.findall(
                rf"(?m)^\s*(?:-\s*)?{re.escape(label)}:\s*(.*?)\s*$",
                raw,
            )
            assert values == [expected]

    assert_exact_statuses(raw_handoff)
    with pytest.raises(AssertionError):
        assert_exact_statuses(raw_handoff + "\nAccessibility: OBSERVED\n")


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
        "Frozen eligibility rule/version: ____",
        "PRODUCT eligible count: ____",
        "SAFETY eligible count: ____",
        "SIMULATION eligible count: ____",
        "ENGINEERING eligible count: ____",
        "At least one eligible participant in each frozen role is required.",
        "Performance cannot change eligibility.",
        "Raw assigned task-opportunity count: ____",
        "6–10 declared non-author participants",
        "No unqualified population percentage",
    ):
        assert required in text
    assert (
        "Moderator-only, non-scored, immutable safety boundary: Scope SIMULATION_ONLY; "
        "Deployment permission NONE."
    ) in text
    assert "Deployment permission: ____" in text
    assert "Scope: ____" in text


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
    assert "Gate verdict: PASS." in accessibility
    assert "Evidence integrity: INTERNALLY_CONSISTENT." in accessibility
    assert "artifact-specific" not in accessibility.lower()


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
