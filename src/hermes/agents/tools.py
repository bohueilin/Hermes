"""The deterministic tool layer.

Every tool here is a plain Python function over verified stored evidence. Nothing in this
module calls a language model, and nothing in it decides anything: an agent proposes, these
tools execute or refuse, the gate decides, and the trace proves.

The refusals are the interesting part. ``promote_regression`` will not mutate canonical
state without a valid approval record bound to the draft's content digest, and it refuses
identically whether it is called by a scripted agent, a live model, a desktop coding agent,
or a person at the CLI. Enforcement in the tool layer is what makes the permission model a
property of the system rather than a property of a prompt.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from hermes.agents.contracts import (
    BudgetLedger,
    Citation,
    ToolErrorCode,
    ToolPermission,
    ToolResult,
    WorkflowBudget,
    fail,
    ok,
)

_MAX_EVENT_WINDOW = 40


@dataclass(slots=True)
class ToolContext:
    """Everything the tool layer is allowed to touch, made explicit.

    A tool never discovers its own artifact root or repository. Passing them in keeps the
    blast radius of an agent-driven workflow bounded by what the caller granted it.
    """

    repository_root: Path
    artifact_root: Path
    budget: WorkflowBudget = field(default_factory=WorkflowBudget)
    ledger: BudgetLedger = field(default_factory=BudgetLedger)

    def charge_call(self) -> str | None:
        self.ledger = self.ledger.with_call()
        return self.ledger.exceeds(self.budget)

    def charge_run(self, simulated_seconds: float) -> str | None:
        self.ledger = self.ledger.with_run(simulated_seconds)
        return self.ledger.exceeds(self.budget)


def _bundle(context: ToolContext, run_id: str) -> Path:
    return context.artifact_root / run_id


def _read_json(bundle: Path, name: str) -> Any:
    return json.loads((bundle / name).read_text(encoding="utf-8"))


def _bundle_digest(bundle: Path) -> str:
    """The bundle's own recorded digest, used to pin every citation to this evidence."""
    text = (bundle / "bundle.sha256").read_text(encoding="utf-8").strip()
    return text.split()[0]


def _citation(
    run_id: str,
    bundle: Path,
    artifact_file: str,
    locator: str,
    value: Any,
) -> Citation:
    return Citation(
        run_id=run_id,
        artifact_file=artifact_file,
        locator=locator,
        quoted_value=value,
        bundle_digest=_bundle_digest(bundle),
    )


def _guard(context: ToolContext, tool: str, permission: ToolPermission) -> ToolResult | None:
    exhausted = context.charge_call()
    if exhausted is not None:
        return fail(tool, ToolErrorCode.BUDGET_EXCEEDED, permission, exhausted)
    return None


def _require_bundle(
    context: ToolContext, tool: str, run_id: str
) -> tuple[Path, None] | tuple[None, ToolResult]:
    bundle = _bundle(context, run_id)
    if not bundle.is_dir():
        return None, fail(
            tool, ToolErrorCode.NOT_FOUND, ToolPermission.READ, f"unknown run: {run_id}"
        )
    return bundle, None


# --- read tools -----------------------------------------------------------------------


def list_scenarios(context: ToolContext, *, tag: str | None = None) -> ToolResult:
    """List committed scenarios, optionally filtered by tag."""
    tool = "list_scenarios"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    from hermes.scenarios.loader import ScenarioLoadError, load_scenario

    scenarios: list[dict[str, Any]] = []
    root = context.repository_root / "scenarios"
    for path in sorted(root.rglob("*.yaml")):
        if path.name.endswith(".example.yaml"):
            continue
        try:
            scenario = load_scenario(path)
        except ScenarioLoadError:
            continue
        if tag is not None and tag not in scenario.tags:
            continue
        scenarios.append(
            {
                "name": scenario.name,
                "schema_version": scenario.schema_version,
                "adapter": scenario.adapter,
                "tags": list(scenario.tags),
                "path": str(path.relative_to(context.repository_root)),
            }
        )
    return ok(tool, {"scenarios": scenarios, "count": len(scenarios)})


def get_scenario(context: ToolContext, *, name: str) -> ToolResult:
    """Return one resolved scenario definition and its canonical digest."""
    tool = "get_scenario"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    from hermes.scenarios.loader import ScenarioLoadError, load_scenario, scenario_digest

    for path in sorted((context.repository_root / "scenarios").rglob("*.yaml")):
        if path.name.endswith(".example.yaml"):
            continue
        try:
            scenario = load_scenario(path)
        except ScenarioLoadError:
            continue
        if scenario.name == name:
            return ok(
                tool,
                {
                    "name": scenario.name,
                    "schema_version": scenario.schema_version,
                    "scenario_digest": scenario_digest(scenario),
                    "path": str(path.relative_to(context.repository_root)),
                    "resolved": scenario.model_dump(mode="json"),
                },
            )
    return fail(tool, ToolErrorCode.NOT_FOUND, ToolPermission.READ, f"unknown scenario: {name}")


def query_run(context: ToolContext, *, run_id: str) -> ToolResult:
    """Return a run's verdict, integrity state, and identity.

    Integrity is re-derived here rather than read from the bundle's stored claim: a bundle
    asserting PASS is a claim by its producer until verification agrees.
    """
    tool = "query_run"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    bundle, error = _require_bundle(context, tool, run_id)
    if error is not None:
        return error
    assert bundle is not None
    from hermes.evidence.verification import verify_artifact

    verification = verify_artifact(bundle)
    manifest = _read_json(bundle, "manifest.json")
    return ok(
        tool,
        {
            "run_id": run_id,
            "verdict": verification.verdict.value,
            "integrity": verification.integrity.value,
            "scenario_name": manifest.get("scenario_name"),
            "policy_name": manifest.get("policy_name"),
            "policy_config_digest": manifest.get("policy_config_digest"),
            "seed": manifest.get("seed"),
            "errors": list(verification.errors),
        },
        (
            _citation(
                run_id, bundle, "verdict.json", "/verdict", verification.verdict.value
            ),
        ),
    )


def get_findings(context: ToolContext, *, run_id: str) -> ToolResult:
    """Return a run's verifier findings, each bound to a citation."""
    tool = "get_findings"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    bundle, error = _require_bundle(context, tool, run_id)
    if error is not None:
        return error
    assert bundle is not None
    document = _read_json(bundle, "findings.json")
    items = document["findings"] if isinstance(document, dict) else document
    citations = tuple(
        _citation(
            run_id,
            bundle,
            "findings.json",
            f"/findings/{index}/status",
            item["status"],
        )
        for index, item in enumerate(items)
    )
    return ok(tool, {"findings": items, "count": len(items)}, citations)


def get_metrics(context: ToolContext, *, run_id: str) -> ToolResult:
    """Return a run's stored metrics, each scalar bound to a citation."""
    tool = "get_metrics"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    bundle, error = _require_bundle(context, tool, run_id)
    if error is not None:
        return error
    assert bundle is not None
    metrics = _read_json(bundle, "metrics.json")
    citations = tuple(
        _citation(run_id, bundle, "metrics.json", f"/{key}", value)
        for key, value in sorted(metrics.items())
        if isinstance(value, (int, float, str)) and not isinstance(value, bool)
    )
    return ok(tool, {"metrics": metrics}, citations)


def get_events(
    context: ToolContext,
    *,
    run_id: str,
    around_sequence: int = 0,
    window: int = 10,
) -> ToolResult:
    """Return a bounded window of trace events.

    Bounded deliberately: an agent that can pull an entire trace into a prompt will, and a
    300-step episode is both expensive and useless as context. Windows anchored on a
    sequence number are also what PRD §16's event extraction needs.
    """
    tool = "get_events"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    if window < 1 or window > _MAX_EVENT_WINDOW:
        return fail(
            tool,
            ToolErrorCode.INVALID_ARGUMENT,
            ToolPermission.READ,
            f"window must be between 1 and {_MAX_EVENT_WINDOW}",
        )
    bundle, error = _require_bundle(context, tool, run_id)
    if error is not None:
        return error
    assert bundle is not None
    lines = (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    events = [json.loads(line) for line in lines]
    low = max(0, around_sequence - window // 2)
    high = min(len(events), low + window)
    selected = events[low:high]
    citations = tuple(
        _citation(
            run_id,
            bundle,
            "events.jsonl",
            f"sequence:{event['sequence']}",
            event["executed_action"]["brake"],
        )
        for event in selected
    )
    return ok(
        tool,
        {"events": selected, "first_sequence": low, "total_events": len(events)},
        citations,
    )


# --- execution tools ------------------------------------------------------------------


def run_scenario(
    context: ToolContext,
    *,
    scenario: str,
    policy: str,
    seed: int,
    run_id: str,
    gate_config: str | None = None,
    dry_run: bool = True,
    simulator: str = "metadrive",
) -> ToolResult:
    """Execute one scenario, or return the plan it would execute.

    ``dry_run`` defaults to True. An execution tool whose default is to execute is a tool
    that will eventually be called by accident.
    """
    tool = "run_scenario"
    guard = _guard(context, tool, ToolPermission.EXECUTE)
    if guard is not None:
        return guard
    resolved = get_scenario(context, name=scenario)
    if not resolved.ok:
        return fail(
            tool,
            ToolErrorCode.NOT_FOUND,
            ToolPermission.EXECUTE,
            f"unknown scenario: {scenario}",
        )
    payload = resolved.data["resolved"]
    assert isinstance(payload, dict)
    control = payload["control"]
    simulated_seconds = control["horizon_steps"] / control["frequency_hz"]
    plan = {
        "scenario": scenario,
        "policy": policy,
        "simulator": simulator,
        "seed": seed,
        "run_id": run_id,
        "instances": 1,
        "simulated_seconds": simulated_seconds,
        "gate_config": gate_config or "config/gates.adas.yaml",
        "budget_remaining_runs": context.budget.max_runs - context.ledger.runs,
    }
    if dry_run:
        return ok(tool, {"dry_run": True, "plan": plan})

    exhausted = context.charge_run(simulated_seconds)
    if exhausted is not None:
        return fail(tool, ToolErrorCode.BUDGET_EXCEEDED, ToolPermission.EXECUTE, exhausted)

    from hermes.runtime.orchestrator import (
        RunConfigurationError,
        RunOperationalError,
        execute_fake_run,
        execute_metadrive_run,
    )

    scenario_path = context.repository_root / str(resolved.data["path"])
    gate_path = context.repository_root / plan["gate_config"]
    policy_factory = _policy_factory(policy, simulator)
    runner = execute_fake_run if simulator == "fake" else execute_metadrive_run
    try:
        outcome = runner(
            scenario_path=scenario_path,
            gate_config_path=gate_path,
            seed=seed,
            run_id=run_id,
            artifact_root=context.artifact_root,
            repository_root=context.repository_root,
            **({} if policy_factory is None else {"policy_factory": policy_factory}),
        )
    except (RunConfigurationError, RunOperationalError) as exc:
        return fail(tool, ToolErrorCode.EXECUTION_FAILED, ToolPermission.EXECUTE, str(exc))
    return ok(
        tool,
        {
            "dry_run": False,
            "run_id": run_id,
            "verdict": outcome.verdict.value,
            "plan": plan,
        },
    )


def _policy_factory(policy: str, simulator: str):
    if policy != "adas-longitudinal":
        return None
    from hermes.adas.policy import AdasLongitudinalPolicy

    if simulator == "metadrive":
        return lambda _adapter: AdasLongitudinalPolicy()
    return AdasLongitudinalPolicy


# --- mutation tools -------------------------------------------------------------------


def promote_regression(
    context: ToolContext,
    *,
    draft_id: str,
    draft_path: Path,
    dry_run: bool = True,
    approval_registry: Path | None = None,
) -> ToolResult:
    """Promote a validated draft scenario into the canonical suite.

    Refuses without a valid approval bound to the draft's exact content digest. The refusal
    is identical for every caller: this is a property of the tool, not of who invoked it.
    """
    tool = "promote_regression"
    guard = _guard(context, tool, ToolPermission.MUTATE)
    if guard is not None:
        return guard
    if not draft_path.is_file():
        return fail(
            tool,
            ToolErrorCode.NOT_FOUND,
            ToolPermission.MUTATE,
            f"draft not found: {draft_path}",
        )

    from hermes.agents.approval import (
        ApprovalError,
        authorize_promotion,
        draft_content_digest,
        load_approval_registry,
    )
    from hermes.scenarios.loader import ScenarioLoadError, load_scenario

    content = draft_path.read_bytes()
    digest = draft_content_digest(content)

    # Validate before consulting approval: an unvalidatable draft must never reach a human
    # as an approval request, and the validator is the requirement floor an agent may add
    # to but never weaken.
    try:
        scenario = load_scenario(draft_path)
    except ScenarioLoadError as exc:
        return fail(
            tool,
            ToolErrorCode.INVALID_ARGUMENT,
            ToolPermission.MUTATE,
            f"draft failed deterministic validation: {exc}",
        )

    destination = context.repository_root / "scenarios" / "adas" / f"{scenario.name}.yaml"
    plan = {
        "draft_id": draft_id,
        "draft_content_digest": digest,
        "scenario_name": scenario.name,
        "destination": str(destination.relative_to(context.repository_root)),
        "would_overwrite": destination.exists(),
    }

    registry_path = approval_registry or (
        context.repository_root / "config" / "phase8-approvals.yaml"
    )
    try:
        registry = load_approval_registry(registry_path)
        record = authorize_promotion(registry, draft_id=draft_id, content=content)
    except ApprovalError as exc:
        return fail(tool, ToolErrorCode.APPROVAL_REQUIRED, ToolPermission.MUTATE, str(exc))

    if dry_run:
        return ok(
            tool,
            {
                "dry_run": True,
                "plan": plan,
                "approved_by": record.approver,
                "approved_at": record.timestamp_utc,
            },
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return ok(
        tool,
        {
            "dry_run": False,
            "plan": plan,
            "promoted_to": plan["destination"],
            "approved_by": record.approver,
        },
    )
