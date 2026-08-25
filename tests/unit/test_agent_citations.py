"""A citation that is never checked is decoration.

These tests exercise the four ways a citation fails, because the only one that matters in
practice is the quiet one: a citation that still resolves while the value it quotes has
moved. That reads as a well-sourced claim right up until someone checks it.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from hermes.agents import ToolContext, triage_run
from hermes.agents.citations import (
    CitationStatus,
    all_valid,
    check_citation,
    check_citations,
)
from hermes.agents.contracts import Citation


def _bundle_digest(bundle: Path) -> str:
    return (bundle / "bundle.sha256").read_text(encoding="utf-8").strip().split()[0]


def _citation(bundle: Path, run_id: str, **overrides) -> Citation:
    payload = {
        "run_id": run_id,
        "artifact_file": "verdict.json",
        "locator": "/verdict",
        "quoted_value": json.loads((bundle / "verdict.json").read_text(encoding="utf-8"))[
            "verdict"
        ],
        "bundle_digest": _bundle_digest(bundle),
    }
    payload.update(overrides)
    return Citation(**payload)


def test_a_faithful_citation_resolves(repository_root: Path) -> None:
    artifacts = repository_root / "artifacts"
    bundle = artifacts / "handoff-phase5-demo"

    check = check_citation(_citation(bundle, "handoff-phase5-demo"), artifacts)

    assert check.status is CitationStatus.RESOLVED
    assert check.valid


def test_an_event_field_citation_resolves(repository_root: Path) -> None:
    artifacts = repository_root / "artifacts"
    bundle = artifacts / "handoff-p4-fault"
    first_event = json.loads(
        (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()[0]
    )
    citation = _citation(
        bundle,
        "handoff-p4-fault",
        artifact_file="events.jsonl",
        locator="sequence:0/candidate_action/brake",
        quoted_value=first_event["candidate_action"]["brake"],
    )

    check = check_citation(citation, artifacts)

    assert check.status is CitationStatus.RESOLVED
    assert check.valid


def test_a_citation_to_a_missing_run_fails(repository_root: Path) -> None:
    artifacts = repository_root / "artifacts"
    bundle = artifacts / "handoff-phase5-demo"
    citation = _citation(bundle, "handoff-phase5-demo").model_copy(
        update={"run_id": "no-such-run"}
    )

    check = check_citation(citation, artifacts)

    assert check.status is CitationStatus.RUN_NOT_FOUND


def test_a_dangling_locator_fails(repository_root: Path) -> None:
    artifacts = repository_root / "artifacts"
    bundle = artifacts / "handoff-phase5-demo"

    check = check_citation(
        _citation(bundle, "handoff-phase5-demo", locator="/not_a_field"), artifacts
    )

    assert check.status is CitationStatus.LOCATOR_DANGLING


def test_a_citation_written_against_a_different_bundle_fails(
    repository_root: Path,
) -> None:
    artifacts = repository_root / "artifacts"
    bundle = artifacts / "handoff-phase5-demo"
    citation = _citation(bundle, "handoff-phase5-demo").model_copy(
        update={"bundle_digest": "0" * 64}
    )

    check = check_citation(citation, artifacts)

    assert check.status is CitationStatus.BUNDLE_DIGEST_MISMATCH


def test_a_drifted_value_fails_even_though_the_locator_resolves(
    repository_root: Path, tmp_path: Path
) -> None:
    """The dangerous failure: it still looks like a well-sourced claim."""
    source = repository_root / "artifacts" / "handoff-phase5-demo"
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    bundle = artifacts / "drifted"
    shutil.copytree(source, bundle)
    citation = _citation(bundle, "drifted", quoted_value="HOLD")

    check = check_citation(citation, artifacts)

    assert check.status is CitationStatus.VALUE_DRIFTED
    assert check.resolved_value == "PASS"
    assert "HOLD" in check.detail


def test_an_uncited_claim_is_not_a_cited_claim() -> None:
    """all_valid fails closed on an empty set rather than vacuously passing."""
    assert all_valid(()) is False


def test_every_citation_a_triage_proposal_emits_resolves(repository_root: Path) -> None:
    """The end-to-end property: the workflow's own output survives its own checker."""
    artifacts = repository_root / "artifacts"
    context = ToolContext(repository_root=repository_root, artifact_root=artifacts)

    proposal = triage_run(context, "handoff-p1-collision")
    checks = check_citations(proposal.citations, artifacts)

    assert checks
    assert all_valid(checks), [
        (check.citation.locator, check.status.value) for check in checks if not check.valid
    ]
