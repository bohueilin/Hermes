"""Typed contracts for the deterministic tool layer agents call.

The product argument this layer exists to make: **an agent's capability is not its
permission.** Every tool below is classified, and the classification is enforced here, in
the tool layer, rather than in an agent's prompt or in a front-end. A different agent
runtime, a desktop coding agent, or a human at the CLI all reach the same enforcement.

Three properties make these tools productizable rather than merely callable:

* **Uniform result envelope.** Every tool returns ``ToolResult`` - ``ok``, ``data``,
  ``error`` - with a closed error-code table. A caller never has to parse prose to learn
  what happened, and an agent cannot mistake a failure for an empty success.
* **Dry run.** Execution and mutation tools accept ``dry_run`` and return the resolved plan
  - what would run, how many instances, what it would cost against the budget - without
  side effects. This is what makes an agent's proposal reviewable before it is expensive.
* **Citations.** Read tools return values already bound to the evidence they came from, so
  a downstream claim can be checked mechanically instead of trusted.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any

from pydantic import Field

from hermes.domain.models import HermesModel, JsonValue


class ToolPermission(StrEnum):
    """What a caller is entitled to do with a tool, independent of who is calling.

    Mirrors PRD §18's permission model. The distinction that matters is the last one:
    a mutation changes canonical repository state and therefore needs a human decision
    recorded against a specific content digest, not merely an agent that decided to.
    """

    READ = "READ"
    EXECUTE = "EXECUTE"
    MUTATE = "MUTATE"


class ToolErrorCode(StrEnum):
    """Closed error vocabulary, so callers branch on codes rather than on wording."""

    NOT_FOUND = "NOT_FOUND"
    INVALID_ARGUMENT = "INVALID_ARGUMENT"
    INVALID_EVIDENCE = "INVALID_EVIDENCE"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"
    UNSUPPORTED = "UNSUPPORTED"
    EXECUTION_FAILED = "EXECUTION_FAILED"


class ToolError(HermesModel):
    """A failure a caller can act on without reading prose."""

    code: ToolErrorCode
    category: ToolPermission
    detail: Annotated[str, Field(min_length=1, max_length=500)]


class Citation(HermesModel):
    """A value bound to the exact stored evidence it was read from.

    Modelled on the review layer's ``SourceReference``/``LocatorInfo``, extended with the
    three fields a cross-bundle claim needs: which run, what the value was at the time of
    reading, and the bundle digest that pins the evidence it came from.

    A citation is checkable: ``hermes agent check-citations`` re-resolves each one against
    the bundle and fails when a locator dangles or a quoted value has drifted. That is the
    difference between an agent that cites evidence and an agent that merely sounds like it.
    """

    run_id: Annotated[str, Field(min_length=1, max_length=64)]
    artifact_file: Annotated[str, Field(min_length=1, max_length=64)]
    locator: Annotated[str, Field(min_length=1, max_length=200)]
    quoted_value: JsonValue
    bundle_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class ToolResult(HermesModel):
    """Uniform envelope returned by every tool."""

    ok: bool
    tool: Annotated[str, Field(min_length=1, max_length=64)]
    data: dict[str, JsonValue] = Field(default_factory=dict)
    citations: tuple[Citation, ...] = ()
    error: ToolError | None = None

    def model_post_init(self, _context: object) -> None:
        if self.ok and self.error is not None:
            raise ValueError("a successful tool result cannot carry an error")
        if not self.ok and self.error is None:
            raise ValueError("a failed tool result must carry an error")


class ToolSpec(HermesModel):
    """Discoverable description of one tool.

    Discoverability is a product requirement, not documentation: a developer integrating
    these workflows into their own pipeline, and an agent selecting a tool, both need the
    same machine-readable catalogue. ``hermes agent tools`` renders it.
    """

    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    permission: ToolPermission
    summary: Annotated[str, Field(min_length=1, max_length=200)]
    arguments: tuple[str, ...] = ()
    supports_dry_run: bool = False
    returns: Annotated[str, Field(min_length=1, max_length=200)] = "typed tool envelope"


class WorkflowBudget(HermesModel):
    """Per-workflow ceilings the tool layer enforces.

    PRD §10's example parameter grid alone resolves to 2,304 scenario instances. An agent
    that can trigger sweeps without a ceiling is a cost and denial-of-service channel, so
    the ceiling lives with the tools rather than with the agent's good intentions.
    """

    max_runs: Annotated[int, Field(ge=0, le=10_000)] = 8
    max_simulated_seconds: Annotated[float, Field(ge=0.0, le=1_000_000.0)] = 3_600.0
    max_tool_calls: Annotated[int, Field(ge=1, le=10_000)] = 200


class BudgetLedger(HermesModel):
    """Consumption recorded alongside the evidence a workflow produced."""

    runs: Annotated[int, Field(ge=0)] = 0
    simulated_seconds: Annotated[float, Field(ge=0.0)] = 0.0
    tool_calls: Annotated[int, Field(ge=0)] = 0

    def with_call(self) -> BudgetLedger:
        return self.model_copy(update={"tool_calls": self.tool_calls + 1})

    def with_run(self, simulated_seconds: float) -> BudgetLedger:
        return self.model_copy(
            update={
                "runs": self.runs + 1,
                "simulated_seconds": self.simulated_seconds + simulated_seconds,
            }
        )

    def exceeds(self, budget: WorkflowBudget) -> str | None:
        """Return the exhausted dimension, or None while the workflow is within budget."""
        if self.tool_calls > budget.max_tool_calls:
            return f"tool calls {self.tool_calls} exceed {budget.max_tool_calls}"
        if self.runs > budget.max_runs:
            return f"runs {self.runs} exceed {budget.max_runs}"
        if self.simulated_seconds > budget.max_simulated_seconds:
            return (
                f"simulated seconds {self.simulated_seconds} exceed "
                f"{budget.max_simulated_seconds}"
            )
        return None


class FailureCategory(StrEnum):
    """PRD §15 taxonomy, restricted to what the P0 longitudinal evidence can support.

    An agent proposes one of these. The deterministic classifier assigns the authoritative
    one; the agent's proposal is stored beside it with provenance and never overwrites it.
    """

    INTERVENTION_TOO_LATE = "INTERVENTION_TOO_LATE"
    OVER_INTERVENTION = "OVER_INTERVENTION"
    MISSED_INTERVENTION = "MISSED_INTERVENTION"
    COMFORT_VIOLATION = "COMFORT_VIOLATION"
    STALE_OBSERVATION = "STALE_OBSERVATION"
    NO_FAILURE = "NO_FAILURE"
    UNKNOWN = "UNKNOWN"


class TriageProposal(HermesModel):
    """An agent's proposed reading of a failed run.

    Deliberately shaped so the three kinds of statement PRD §17 requires stay separable:
    ``category``/``rationale`` are agent interpretation, ``citations`` are deterministic
    fact, and nothing here is a verdict. ``deterministic_category`` is filled by the
    classifier, not the agent, so a reader can see where the two disagree.
    """

    run_id: Annotated[str, Field(min_length=1, max_length=64)]
    category: FailureCategory
    deterministic_category: FailureCategory
    rationale: Annotated[str, Field(min_length=1, max_length=1_000)]
    citations: tuple[Citation, ...]
    runtime: Annotated[str, Field(min_length=1, max_length=64)]

    @property
    def agrees_with_deterministic_classifier(self) -> bool:
        return self.category is self.deterministic_category


def ok(tool: str, data: dict[str, Any], citations: tuple[Citation, ...] = ()) -> ToolResult:
    return ToolResult(ok=True, tool=tool, data=data, citations=citations)


def fail(
    tool: str,
    code: ToolErrorCode,
    category: ToolPermission,
    detail: str,
) -> ToolResult:
    return ToolResult(
        ok=False,
        tool=tool,
        error=ToolError(code=code, category=category, detail=detail),
    )


TOOL_CATALOG: tuple[ToolSpec, ...] = (
    ToolSpec(
        name="list_scenarios",
        permission=ToolPermission.READ,
        summary="List committed scenarios, optionally filtered by tag.",
        arguments=("tag",),
        returns="scenario names, schema versions, tags",
    ),
    ToolSpec(
        name="get_scenario",
        permission=ToolPermission.READ,
        summary="Return one resolved scenario definition and its canonical digest.",
        arguments=("name",),
        returns="resolved scenario payload and scenario_digest",
    ),
    ToolSpec(
        name="query_run",
        permission=ToolPermission.READ,
        summary="Return a run's verdict, integrity state, and identity.",
        arguments=("run_id",),
        returns="verdict, integrity, scenario, policy, digests",
    ),
    ToolSpec(
        name="get_findings",
        permission=ToolPermission.READ,
        summary="Return a run's verifier findings with citations to findings.json.",
        arguments=("run_id",),
        returns="findings with status, measurement, and citations",
    ),
    ToolSpec(
        name="get_metrics",
        permission=ToolPermission.READ,
        summary="Return a run's recomputed metrics with citations to metrics.json.",
        arguments=("run_id",),
        returns="metrics with citations",
    ),
    ToolSpec(
        name="get_events",
        permission=ToolPermission.READ,
        summary="Return a bounded window of trace events around a sequence.",
        arguments=("run_id", "around_sequence", "window"),
        returns="trace events with citations by sequence",
    ),
    ToolSpec(
        name="run_scenario",
        permission=ToolPermission.EXECUTE,
        summary="Execute one scenario within the workflow budget.",
        arguments=("scenario", "policy", "seed", "run_id", "dry_run"),
        supports_dry_run=True,
        returns="resolved plan, or the published run identity and verdict",
    ),
    ToolSpec(
        name="promote_regression",
        permission=ToolPermission.MUTATE,
        summary="Promote a validated draft scenario into the canonical suite.",
        arguments=("draft_id", "dry_run"),
        supports_dry_run=True,
        returns="promotion plan, or the promoted scenario path",
    ),
)
