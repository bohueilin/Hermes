"""The tool layer's refusals are the product.

An agentic workflow in a safety-critical pipeline is only deployable if its boundaries hold
regardless of who is calling. These tests exercise the boundaries rather than the happy
paths: budgets that stop a runaway sweep, a mutation that refuses without a recorded human
decision, an approval invalidated by editing the thing that was approved, and a deterministic
classification an agent cannot move.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import hermes.agents.triage as triage_module
from hermes.agents.approval import (
    ApprovalDecision,
    ApprovalError,
    ApprovalRecord,
    append_approval,
    authorize_promotion,
    draft_content_digest,
    load_approval_registry,
)
from hermes.agents.contracts import (
    TOOL_CATALOG,
    BudgetLedger,
    FailureCategory,
    ToolErrorCode,
    ToolPermission,
    WorkflowBudget,
    ok,
)
from hermes.agents.tools import (
    ToolContext,
    get_scenario,
    list_scenarios,
    promote_regression,
    query_run,
    run_scenario,
)
from hermes.agents.triage import ScriptedAgent, classify_failure, triage_run

DRAFT = """\
schema_version: "4.0"
name: adas_promoted_probe
version: "1.0"
description: Draft regression scenario used to exercise the approval boundary.
adapter: fake
control:
  frequency_hz: 10
  horizon_steps: 40
  target_speed_mps: 8.0
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 12.0
  boundary_tolerance_m: 1.5
tags:
  - regression
adas:
  enabled:
    - aeb
  expected_aeb:
    kind: forbidden
"""


@pytest.fixture
def context(repository_root: Path) -> ToolContext:
    return ToolContext(
        repository_root=repository_root,
        artifact_root=repository_root / "artifacts",
    )


# --- catalogue and envelope ------------------------------------------------------------


def test_every_catalogued_tool_declares_a_permission() -> None:
    """Discoverability is a product requirement: a developer integrating these needs it."""
    assert TOOL_CATALOG
    for spec in TOOL_CATALOG:
        assert spec.permission in set(ToolPermission)
        assert spec.summary


def test_mutation_and_execution_tools_offer_a_dry_run() -> None:
    """A proposal must be reviewable before it is expensive or irreversible."""
    for spec in TOOL_CATALOG:
        if spec.permission in {ToolPermission.EXECUTE, ToolPermission.MUTATE}:
            assert spec.supports_dry_run, spec.name


def test_a_failed_result_cannot_masquerade_as_an_empty_success(context: ToolContext) -> None:
    result = get_scenario(context, name="does_not_exist")

    assert result.ok is False
    assert result.error is not None
    assert result.error.code is ToolErrorCode.NOT_FOUND


def test_read_tools_return_citations_bound_to_the_bundle_digest(
    context: ToolContext,
) -> None:
    result = query_run(context, run_id="handoff-phase5-demo")

    assert result.ok
    assert result.citations
    for citation in result.citations:
        assert len(citation.bundle_digest) == 64
        assert citation.run_id == "handoff-phase5-demo"


def test_listing_scenarios_finds_the_committed_adas_pair(context: ToolContext) -> None:
    result = list_scenarios(context, tag="aeb")

    assert result.ok
    names = {item["name"] for item in result.data["scenarios"]}
    assert {"adas_aeb_lead_hard_brake", "adas_nominal_no_lead"} <= names


# --- budgets ---------------------------------------------------------------------------


def test_the_tool_layer_stops_a_runaway_caller(repository_root: Path) -> None:
    """Budget enforcement lives with the tools, not with the agent's good intentions."""
    context = ToolContext(
        repository_root=repository_root,
        artifact_root=repository_root / "artifacts",
        budget=WorkflowBudget(max_tool_calls=2),
    )

    assert list_scenarios(context).ok
    assert list_scenarios(context).ok
    third = list_scenarios(context)

    assert third.ok is False
    assert third.error is not None
    assert third.error.code is ToolErrorCode.BUDGET_EXCEEDED


def test_a_ledger_reports_which_dimension_is_exhausted() -> None:
    budget = WorkflowBudget(max_runs=1, max_simulated_seconds=10.0, max_tool_calls=100)
    ledger = BudgetLedger().with_run(5.0).with_run(5.0)

    exhausted = ledger.exceeds(budget)

    assert exhausted is not None
    assert "runs" in exhausted


def test_run_scenario_defaults_to_a_dry_run(context: ToolContext) -> None:
    """An execution tool whose default is to execute will be called by accident."""
    result = run_scenario(
        context,
        scenario="adas_nominal_no_lead",
        policy="adas-longitudinal",
        seed=7,
        run_id="unused-dry-run",
    )

    assert result.ok
    assert result.data["dry_run"] is True
    assert result.data["plan"]["instances"] == 1
    assert not (context.artifact_root / "unused-dry-run").exists()


# --- the mutation boundary -------------------------------------------------------------


def test_promotion_refuses_without_an_approval_record(
    context: ToolContext, tmp_path: Path
) -> None:
    """The load-bearing refusal: no recorded human decision, no canonical change."""
    draft = tmp_path / "draft.yaml"
    draft.write_text(DRAFT, encoding="utf-8")

    result = promote_regression(
        context,
        draft_id="probe-draft",
        draft_path=draft,
        dry_run=False,
        approval_registry=tmp_path / "approvals.yaml",
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code is ToolErrorCode.APPROVAL_REQUIRED
    assert result.error.category is ToolPermission.MUTATE


def test_promotion_refuses_an_unvalidatable_draft_before_asking_for_approval(
    context: ToolContext, tmp_path: Path
) -> None:
    """A draft that cannot pass the validator must never reach a human as a request."""
    draft = tmp_path / "draft.yaml"
    draft.write_text(DRAFT.replace('schema_version: "4.0"', 'schema_version: "9.9"'), "utf-8")

    result = promote_regression(
        context, draft_id="probe-draft", draft_path=draft, dry_run=True
    )

    assert result.ok is False
    assert result.error is not None
    assert result.error.code is ToolErrorCode.INVALID_ARGUMENT


def test_editing_a_draft_after_approval_invalidates_the_approval(tmp_path: Path) -> None:
    """Approving one thing and shipping another is the failure this closes."""
    registry_path = tmp_path / "approvals.yaml"
    content = DRAFT.encode("utf-8")
    append_approval(
        registry_path,
        ApprovalRecord(
            draft_id="probe-draft",
            draft_content_digest=draft_content_digest(content),
            approver="owner",
            timestamp_utc="2026-08-21T12:00:00+00:00",
            decision=ApprovalDecision.APPROVED,
            rationale="Reviewed the drafted regression scenario.",
        ),
    )
    registry = load_approval_registry(registry_path)

    authorize_promotion(registry, draft_id="probe-draft", content=content)
    edited = content + b"# an edit made after approval\n"

    with pytest.raises(ApprovalError, match="no approval for content digest"):
        authorize_promotion(registry, draft_id="probe-draft", content=edited)


def test_a_rejected_draft_is_not_promotable(tmp_path: Path) -> None:
    registry_path = tmp_path / "approvals.yaml"
    content = DRAFT.encode("utf-8")
    append_approval(
        registry_path,
        ApprovalRecord(
            draft_id="probe-draft",
            draft_content_digest=draft_content_digest(content),
            approver="owner",
            timestamp_utc="2026-08-21T12:00:00+00:00",
            decision=ApprovalDecision.REJECTED,
            rationale="The scenario duplicates existing coverage.",
        ),
    )

    with pytest.raises(ApprovalError, match="REJECTED"):
        authorize_promotion(
            load_approval_registry(registry_path), draft_id="probe-draft", content=content
        )


def test_an_approved_draft_promotes(context: ToolContext, tmp_path: Path) -> None:
    draft = tmp_path / "draft.yaml"
    draft.write_text(DRAFT, encoding="utf-8")
    registry_path = tmp_path / "approvals.yaml"
    append_approval(
        registry_path,
        ApprovalRecord(
            draft_id="probe-draft",
            draft_content_digest=draft_content_digest(draft.read_bytes()),
            approver="owner",
            timestamp_utc="2026-08-21T12:00:00+00:00",
            decision=ApprovalDecision.APPROVED,
            rationale="Reviewed the drafted regression scenario.",
        ),
    )

    result = promote_regression(
        context,
        draft_id="probe-draft",
        draft_path=draft,
        dry_run=True,
        approval_registry=registry_path,
    )

    assert result.ok
    assert result.data["approved_by"] == "owner"
    assert result.data["plan"]["scenario_name"] == "adas_promoted_probe"


def test_an_absent_registry_approves_nothing(tmp_path: Path) -> None:
    """A missing registry must mean "nothing is approved", never "no checks apply"."""
    registry = load_approval_registry(tmp_path / "absent.yaml")

    assert registry.approvals == ()
    with pytest.raises(ApprovalError):
        authorize_promotion(registry, draft_id="anything", content=b"x")


# --- triage authority ------------------------------------------------------------------


def test_the_deterministic_classifier_is_a_function_of_stored_evidence(
    context: ToolContext,
) -> None:
    first, supporting = classify_failure(context, "handoff-p1-collision")
    second, _ = classify_failure(context, "handoff-p1-collision")

    assert first is second
    assert isinstance(supporting, tuple)


def test_a_passing_run_is_classified_as_no_failure(context: ToolContext) -> None:
    category, supporting = classify_failure(context, "handoff-phase5-demo")

    assert category is FailureCategory.NO_FAILURE
    assert supporting == ()


def test_triage_ignores_not_available_findings_when_a_real_failure_is_present(
    context: ToolContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing evidence is a limitation, not a failed upstream predicate."""
    findings = ok(
        "get_findings",
        {
            "findings": [
                {
                    "finding_id": "adas.aeb.brake_onset_margin",
                    "status": "NOT_AVAILABLE",
                },
                {
                    "finding_id": "adas.aeb.no_false_intervention",
                    "status": "FAIL",
                },
            ]
        },
    )
    monkeypatch.setattr(triage_module, "get_findings", lambda *_args, **_kwargs: findings)
    monkeypatch.setattr(
        triage_module,
        "get_metrics",
        lambda *_args, **_kwargs: ok("get_metrics", {"metrics": {}}),
    )
    monkeypatch.setattr(
        triage_module,
        "query_run",
        lambda *_args, **_kwargs: ok(
            "query_run", {"verdict": "HOLD", "integrity": "INTERNALLY_CONSISTENT"}
        ),
    )

    proposal = triage_run(context, "stationary-over-braking")

    assert proposal.deterministic_category is FailureCategory.OVER_INTERVENTION
    assert proposal.category is FailureCategory.OVER_INTERVENTION


def test_an_agent_proposal_never_replaces_the_deterministic_label(
    context: ToolContext,
) -> None:
    """The authority boundary: both answers are recorded, side by side."""

    class ContrarianAgent:
        name = "contrarian/1.0"

        def propose_triage(self, *, run_id, evidence, citations):
            del run_id, evidence, citations
            return FailureCategory.OVER_INTERVENTION, "An assertion with no support."

    proposal = triage_run(context, "handoff-phase5-demo", ContrarianAgent())

    assert proposal.category is FailureCategory.OVER_INTERVENTION
    assert proposal.deterministic_category is FailureCategory.NO_FAILURE
    assert proposal.agrees_with_deterministic_classifier is False
    assert proposal.runtime == "contrarian/1.0"


def test_the_scripted_runtime_is_deterministic(context: ToolContext) -> None:
    """The only runtime CI exercises: no API key, no network, reproducible."""
    first = triage_run(context, "handoff-p1-collision", ScriptedAgent())
    second = triage_run(context, "handoff-p1-collision", ScriptedAgent())

    assert first.model_dump(mode="json") == second.model_dump(mode="json")


def test_triage_output_carries_citations(context: ToolContext) -> None:
    proposal = triage_run(context, "handoff-p1-collision")

    assert proposal.citations
    for citation in proposal.citations:
        assert citation.run_id == "handoff-p1-collision"
        assert len(citation.bundle_digest) == 64
