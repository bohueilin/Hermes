"""The whole flywheel, on real physics: failure to regression case and back.

The property that matters is the last one. A regression case that merely *runs* is worthless;
it has to discriminate — fail for the controller that provoked it, and pass for one that does
not have the defect. Without that, the suite grows and detects nothing.

Marked ``metadrive`` because every step is a real physics episode.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytestmark = pytest.mark.metadrive


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _run(repository_root: Path, artifact_root: Path, run_id: str, scenario: Path, config: str):
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    controller = load_adas_config(repository_root / "config" / "adas" / f"{config}.yaml")
    execute_metadrive_run(
        scenario_path=scenario,
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(controller),
    )
    return artifact_root / run_id


def _failing_adas(bundle: Path) -> set[str]:
    document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    items = document["findings"] if isinstance(document, dict) else document
    return {
        item["finding_id"]
        for item in items
        if item["status"] == "FAIL" and item["finding_id"].startswith("adas.")
    }


def test_a_failure_becomes_a_regression_case_that_discriminates(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """Failed run -> triage -> draft -> validate -> approve -> promote -> rerun.

    The full canonical workflow, with the deterministic checks in their places: the draft is
    refused promotion until an approval exists, the approval binds to the draft's exact bytes,
    and the promoted case is then shown to fail for the defect and pass for the baseline.
    """
    _requires_metadrive(repository_root)
    from datetime import UTC, datetime

    from hermes.agents import ToolContext, triage_run
    from hermes.agents.approval import (
        ApprovalDecision,
        ApprovalRecord,
        append_approval,
        draft_content_digest,
    )
    from hermes.agents.contracts import FailureCategory, ToolErrorCode
    from hermes.agents.tools import promote_regression
    from hermes.regression import build_regression_draft, committed_suite

    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    draft_root = tmp_path / "drafts"
    registry_path = tmp_path / "approvals.yaml"

    # 1. A controller with a seeded defect fails on the committed threat scenario.
    failed = _run(
        repository_root,
        artifact_root,
        "flywheel-source",
        repository_root / "scenarios" / "adas" / "aeb_lead_hard_brake.yaml",
        "defect_late_braking",
    )
    assert "adas.aeb.brake_onset_margin" in _failing_adas(failed)

    # 2. Triage classifies it, and the agent's proposal is recorded beside the truth.
    context = ToolContext(repository_root=repository_root, artifact_root=artifact_root)
    proposal = triage_run(context, "flywheel-source")
    assert proposal.deterministic_category is FailureCategory.INTERVENTION_TOO_LATE
    assert proposal.citations

    # 3. A regression case is drafted from the observed failure geometry.
    draft, scenario_path, coverage, violations = build_regression_draft(
        repository_root=repository_root,
        artifact_root=artifact_root,
        run_id="flywheel-source",
        draft_root=draft_root,
        suite=committed_suite(repository_root),
    )
    assert violations == (), "a faithful draft must pass the requirement floor"
    assert coverage.covered is False, "the sharper case is not already covered"
    assert draft.provenance.trigger_finding_id == "adas.aeb.brake_onset_margin"
    assert draft.provenance.observed_gap_m is not None

    # 4. Promotion is refused while no human decision exists.
    refused = promote_regression(
        context,
        draft_id=draft.draft_id,
        draft_path=scenario_path,
        dry_run=False,
        approval_registry=registry_path,
    )
    assert refused.ok is False
    assert refused.error is not None
    assert refused.error.code is ToolErrorCode.APPROVAL_REQUIRED

    # 5. A decision is recorded, bound to the draft's exact bytes.
    append_approval(
        registry_path,
        ApprovalRecord(
            draft_id=draft.draft_id,
            draft_content_digest=draft_content_digest(scenario_path.read_bytes()),
            approver="integration-test",
            timestamp_utc=datetime.now(UTC).isoformat(),
            decision=ApprovalDecision.APPROVED,
            rationale="Reproduces the late-braking failure at the observed geometry.",
        ),
    )
    approved = promote_regression(
        context,
        draft_id=draft.draft_id,
        draft_path=scenario_path,
        dry_run=True,
        approval_registry=registry_path,
    )
    assert approved.ok
    assert approved.data["approved_by"] == "integration-test"

    # 6. The regression case discriminates: it fails the defect and passes the baseline.
    defect_bundle = _run(
        repository_root, artifact_root, "flywheel-defect", scenario_path, "defect_late_braking"
    )
    baseline_bundle = _run(
        repository_root, artifact_root, "flywheel-baseline", scenario_path, "baseline"
    )

    assert "adas.aeb.brake_onset_margin" in _failing_adas(defect_bundle), (
        "the derived case must reproduce the failure it was drafted from"
    )
    assert _failing_adas(baseline_bundle) == set(), (
        "the derived case must pass for a controller without the defect, "
        "or it is not a regression test but a scenario nobody can satisfy"
    )


def test_an_edited_draft_loses_its_approval(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """Approve one thing, ship another - the failure the content digest closes."""
    _requires_metadrive(repository_root)
    from datetime import UTC, datetime

    from hermes.agents.approval import (
        ApprovalDecision,
        ApprovalRecord,
        append_approval,
        draft_content_digest,
    )
    from hermes.agents.contracts import ToolErrorCode
    from hermes.agents.tools import ToolContext, promote_regression
    from hermes.regression import build_regression_draft, committed_suite

    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    registry_path = tmp_path / "approvals.yaml"
    _run(
        repository_root,
        artifact_root,
        "flywheel-edit",
        repository_root / "scenarios" / "adas" / "aeb_lead_hard_brake.yaml",
        "defect_late_braking",
    )
    draft, scenario_path, _, _ = build_regression_draft(
        repository_root=repository_root,
        artifact_root=artifact_root,
        run_id="flywheel-edit",
        draft_root=tmp_path / "drafts",
        suite=committed_suite(repository_root),
    )
    append_approval(
        registry_path,
        ApprovalRecord(
            draft_id=draft.draft_id,
            draft_content_digest=draft_content_digest(scenario_path.read_bytes()),
            approver="integration-test",
            timestamp_utc=datetime.now(UTC).isoformat(),
            decision=ApprovalDecision.APPROVED,
            rationale="Approved as reviewed.",
        ),
    )

    scenario_path.write_bytes(
        scenario_path.read_bytes() + b"# an edit made after approval\n"
    )
    context = ToolContext(repository_root=repository_root, artifact_root=artifact_root)
    result = promote_regression(
        context,
        draft_id=draft.draft_id,
        draft_path=scenario_path,
        dry_run=False,
        approval_registry=registry_path,
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code is ToolErrorCode.APPROVAL_REQUIRED
