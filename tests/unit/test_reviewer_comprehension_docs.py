from __future__ import annotations

import re
from pathlib import Path

import pytest

PACKAGE_PATHS = (
    "PHASE6_DESIGN_ITERATION_HANDOFF.md",
    "docs/PHASE6_USABILITY_TEST_PLAN.md",
    "docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md",
    "docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md",
)


def _read(repository_root: Path, relative_path: str) -> str:
    return (repository_root / relative_path).read_text(encoding="utf-8")


@pytest.mark.parametrize("relative_path", PACKAGE_PATHS)
def test_human_review_package_exists_and_preserves_unobserved_status(
    repository_root: Path,
    relative_path: str,
) -> None:
    text = _read(repository_root, relative_path)

    assert "NOT YET OBSERVED" in text
    positive_conformance_claims = (
        "is WCAG compliant",
        "is WCAG conformant",
        "meets WCAG",
        "achieves WCAG",
        "WCAG compliance: PASS",
        "WCAG conformance: PASS",
    )
    assert all(claim not in text for claim in positive_conformance_claims)


def test_usability_plan_defines_future_cohort_and_all_ten_tasks(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "docs/PHASE6_USABILITY_TEST_PLAN.md")

    assert "6–10" in text
    assert all(role in text for role in ("product", "safety", "simulation", "engineering"))
    task_headings = re.findall(r"^## Task (\d+) — ", text, flags=re.MULTILINE)
    assert task_headings == [str(number) for number in range(1, 11)]
    assert all(
        locator in text
        for locator in (
            "handoff-phase5-demo",
            "handoff-p1-collision",
            "phase1-tampered",
            "handoff-p3-lead-baseline",
            "handoff-p3-lead-shielded",
            "handoff-p3-cutin-baseline",
            "handoff-p3-cutin-shielded",
        )
    )
    assert "Immediate stop" in text
    assert "missing evidence is interpreted as zero or pass" in text
    assert "candidate is safer" in text


def test_human_observation_template_is_unfilled_and_evidence_bearing(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md")

    assert "Overall human-comprehension status: `NOT YET OBSERVED`" in text
    assert all(
        field in text
        for field in (
            "Participant ID",
            "Role",
            "Assistive technology",
            "Artifact locator",
            "Bundle digest",
            "Observed answer",
            "Critical misconception",
            "Moderator intervention",
            "Evidence location",
            "Residual-risk owner",
        )
    )
    assert "Do not prefill" in text
    assert "Do not promote the status" in text


def test_visual_checklist_is_executable_and_keeps_manual_gates_open(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md")

    assert "hermes workbench" in text
    assert "--host 127.0.0.1" in text
    assert "--no-browser" in text
    assert all(
        section in text
        for section in (
            "Screenshot-state matrix",
            "Keyboard-only review",
            "Screen-reader review",
            "Focus and announcement review",
            "Non-color and contrast review",
            "Table alternatives",
            "200% zoom and reflow",
            "Bounded inert content",
            "Abbreviation expansion",
        )
    )
    assert "time to collision (TTC)" in text
    assert all(
        state in text
        for state in (
            "Initial UNVERIFIED",
            "Nominal PASS",
            "Hard-failure HOLD",
            "INVALID_EVIDENCE",
            "Required evidence unavailable",
            "Compatible mixed comparison",
            "Incompatible comparison",
        )
    )
    assert "Manual visual review: `NOT YET OBSERVED`" in text
    assert "Accessibility audit: `NOT YET OBSERVED`" in text
    assert "Human comprehension: `NOT YET OBSERVED`" in text
    assert "No WCAG conformance claim" in text


def test_design_iteration_handoff_contains_all_twenty_nine_required_items(
    repository_root: Path,
) -> None:
    text = _read(repository_root, "PHASE6_DESIGN_ITERATION_HANDOFF.md")

    numbered_sections = re.findall(r"^## (\d+)\. ", text, flags=re.MULTILINE)
    assert numbered_sections == [str(number) for number in range(1, 30)]
    assert "Automated correctness: `OBSERVED`" in text
    assert "Manual visual review: `NOT YET OBSERVED`" in text
    assert "Accessibility audit: `NOT YET OBSERVED`" in text
    assert "Human comprehension: `NOT YET OBSERVED`" in text
    assert "685b92d" in text
    assert "e2eab34" in text
    assert "80439c5" in text
    assert "No remote action" in text
    assert "Full suite: **756 passed**" in text
    assert "Non-MetaDrive suite: **756 passed**" in text
    assert "Focused matrix: **506 passed**" in text
    assert "100 canonical files across ten retained directories" in text
    assert "Overview `#overview`" in text
    assert "Timeline `#timeline`" in text
    assert "Compare `#compare`" in text
    assert "exception-text count 0" in text
    assert "Documentation commit SHA: intentionally not embedded" in text
    assert "post-commit `git log`" in text
    stale_finalization_phrases = (
        "Final full suite including the new document contract: pending",
        "Fresh Task 4 doctor result: pending",
        "pending fresh Task 4 command confirmation",
        "final Task 4 executions remain pending",
        "Task 4 representative CLI rerun is pending",
    )
    assert all(phrase not in text for phrase in stale_finalization_phrases)
