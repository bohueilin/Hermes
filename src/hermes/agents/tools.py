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
from pathlib import Path, PurePosixPath
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
from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES
from hermes.evidence.schema_registry import (
    FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA,
    RUN_METRICS_BY_EVIDENCE_SCHEMA,
)

_MAX_EVENT_WINDOW = 40
STALE_OBSERVATION_FAULT_REASONS = frozenset(
    {
        "OBSERVATION_DELAY",
        "OBSERVATION_FROZEN",
        "OBSERVATION_DROPOUT_HOLD_LAST",
    }
)


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


@dataclass(frozen=True, slots=True)
class _AgentBundle:
    path: Path
    capture: Any
    payloads: dict[str, bytes]


def _bundle(context: ToolContext, run_id: str) -> Path:
    return context.artifact_root / run_id


def _read_json(bundle: _AgentBundle, name: str) -> Any:
    return json.loads(bundle.payloads[name])


def _bundle_digest(bundle: _AgentBundle) -> str:
    """The bundle's own recorded digest, used to pin every citation to this evidence."""
    digest = bundle.capture.inspection.observed_bundle_digest
    if digest is None:
        raise ValueError("captured bundle has no valid recorded digest")
    return digest


def _evidence_schema_version(bundle: _AgentBundle) -> str:
    snapshot = bundle.capture.inspection.snapshot
    if snapshot is not None:
        return snapshot.manifest.evidence_schema_version
    identity = bundle.capture.safe_manifest_identity
    if identity is None:
        raise ValueError("captured bundle has no safe evidence-schema identity")
    return identity.evidence_schema_version


def _malformed_capture_detail(artifact_file: str, exc: Exception) -> str:
    detail = f"captured {artifact_file} is malformed: {exc}"
    return detail if len(detail) <= 500 else f"{detail[:497]}..."


def _citation(
    run_id: str,
    bundle: _AgentBundle,
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
    context: ToolContext,
    tool: str,
    run_id: str,
    captured_bundle: _AgentBundle | None = None,
) -> tuple[_AgentBundle, None] | tuple[None, ToolResult]:
    path = PurePosixPath(run_id)
    if (
        not run_id
        or path.is_absolute()
        or "\\" in run_id
        or "\x00" in run_id
        or run_id.endswith("/")
        or "//" in run_id
        or any(part in {"", ".", ".."} for part in path.parts)
        or str(path) != run_id
    ):
        return None, fail(
            tool,
            ToolErrorCode.INVALID_ARGUMENT,
            ToolPermission.READ,
            "run selection must be a lexical root-contained path",
        )
    if captured_bundle is not None:
        if captured_bundle.path != _bundle(context, run_id):
            return None, fail(
                tool,
                ToolErrorCode.INVALID_EVIDENCE,
                ToolPermission.READ,
                "workflow capture does not match the requested artifact selection",
            )
        return captured_bundle, None
    from hermes.evidence.verification import _inspect_artifact_under_root_capture

    capture = _inspect_artifact_under_root_capture(context.artifact_root, run_id)
    if not capture.captured_files:
        return None, fail(
            tool, ToolErrorCode.NOT_FOUND, ToolPermission.READ, f"unknown run: {run_id}"
        )
    payloads = capture.payload_map()
    safe_identity = capture.safe_manifest_identity
    legacy_invalid_read = (
        capture.inspection.snapshot is None
        and safe_identity is not None
        and safe_identity.evidence_schema_version in {"1.0", "2.0"}
        and set(REQUIRED_ARTIFACT_FILES) <= payloads.keys()
        and capture.inspection.observed_bundle_digest is not None
    )
    if capture.inspection.snapshot is None and not legacy_invalid_read:
        detail = "; ".join(capture.inspection.verification.errors[:2])
        return None, fail(
            tool,
            ToolErrorCode.INVALID_EVIDENCE,
            ToolPermission.READ,
            detail or "artifact did not pass independent stored verification",
        )
    return (
        _AgentBundle(
            path=_bundle(context, run_id),
            capture=capture,
            payloads=payloads,
        ),
        None,
    )


def _aeb_stale_observation_counterfactual(
    *,
    run_id: str,
    bundle: _AgentBundle,
    controller_config: Any,
    stale_threshold_s: float,
    seed: int,
) -> tuple[dict[str, Any] | None, tuple[Citation, ...]]:
    """Find the earliest policy-bound raw-vs-delivered AEB counterfactual.

    The delivered replay is the binding edge: unless the exact stored controller
    reproduces every stored candidate through the proof event, the trace cannot support a
    causal claim about that controller. The raw replay then changes only the observation
    stream, keeping the stored scenario, seed, and controller fixed. Its first positive
    AEB-attributed intervention is decisive: a later stateful hold cannot replace an onset
    that did not itself satisfy the counterfactual conditions.
    """
    from hermes.adas.interfaces import BrakeSource, InterventionLevel
    from hermes.adas.policy import AdasLongitudinalPolicy

    try:
        snapshot = bundle.capture.inspection.snapshot
        if snapshot is None or snapshot.manifest.evidence_schema_version not in {"2.0", "3.0"}:
            return None, ()
        scenario = snapshot.scenario
        events = snapshot.events
        raw_policy = AdasLongitudinalPolicy(controller_config)
        delivered_policy = AdasLongitudinalPolicy(controller_config)
        raw_policy.reset(scenario, seed)
        delivered_policy.reset(scenario, seed)
        for event in events:
            fault_evidence = event.observation_fault_evidence
            raw_candidate = raw_policy.act(fault_evidence.raw_observation)
            delivered_candidate = delivered_policy.act(fault_evidence.delivered_observation)
            if delivered_candidate != event.candidate_action:
                return None, ()
            raw_decision = raw_policy.last_decision
            raw_aeb_intervention = (
                raw_decision is not None
                and raw_decision.brake_source is BrakeSource.AEB
                and raw_decision.intervention is not InterventionLevel.NO_INTERVENTION
                and raw_candidate.brake > 0.0
            )
            if not raw_aeb_intervention:
                continue
            if (
                fault_evidence.delivered_observation.observation_age_s <= stale_threshold_s
                or not STALE_OBSERVATION_FAULT_REASONS.intersection(fault_evidence.applied_faults)
                or fault_evidence.delivered_from_sequence >= event.sequence
                or event.candidate_action.brake != 0.0
            ):
                return None, ()
            prefix = f"sequence:{event.sequence}"
            proof = {
                "sequence": event.sequence,
                "delivered_from_sequence": fault_evidence.delivered_from_sequence,
                "raw_replay_brake": raw_candidate.brake,
                "stored_candidate_brake": event.candidate_action.brake,
            }
            citations = (
                _citation(
                    run_id,
                    bundle,
                    "events.jsonl",
                    f"{prefix}/candidate_action/brake",
                    event.candidate_action.brake,
                ),
                _citation(
                    run_id,
                    bundle,
                    "events.jsonl",
                    (
                        f"{prefix}/observation_fault_evidence/"
                        "delivered_observation/observation_age_s"
                    ),
                    fault_evidence.delivered_observation.observation_age_s,
                ),
                _citation(
                    run_id,
                    bundle,
                    "events.jsonl",
                    f"{prefix}/observation_fault_evidence/applied_faults",
                    list(fault_evidence.applied_faults),
                ),
                _citation(
                    run_id,
                    bundle,
                    "events.jsonl",
                    f"{prefix}/observation_fault_evidence/delivered_from_sequence",
                    fault_evidence.delivered_from_sequence,
                ),
                _citation(
                    run_id,
                    bundle,
                    "events.jsonl",
                    (f"{prefix}/observation_fault_evidence/raw_observation/front_distance_m"),
                    fault_evidence.raw_observation.front_distance_m,
                ),
                _citation(
                    run_id,
                    bundle,
                    "events.jsonl",
                    (
                        f"{prefix}/observation_fault_evidence/"
                        "raw_observation/front_relative_speed_mps"
                    ),
                    fault_evidence.raw_observation.front_relative_speed_mps,
                ),
            )
            return proof, citations
    except (OSError, UnicodeError, RecursionError, RuntimeError, ValueError):
        # This is derived read-only evidence, not a new integrity claim. Any unsupported
        # stored input or replay mismatch withholds the proof and fails triage closed.
        return None, ()
    return None, ()


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


def query_run(
    context: ToolContext,
    *,
    run_id: str,
    _captured_bundle: _AgentBundle | None = None,
) -> ToolResult:
    """Return a run's verdict, integrity state, and identity.

    Integrity is re-derived here rather than read from the bundle's stored claim: a bundle
    asserting PASS is a claim by its producer until verification agrees.
    """
    tool = "query_run"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    bundle, error = _require_bundle(context, tool, run_id, _captured_bundle)
    if error is not None:
        return error
    assert bundle is not None
    from hermes.adas.interfaces import AdasControllerConfig
    from hermes.domain.models import ExecutionContextV2, ExecutionContextV3
    from hermes.evidence.canonical import canonical_json_bytes

    inspection = bundle.capture.inspection
    verification = inspection.verification
    snapshot = inspection.snapshot
    manifest = _read_json(bundle, "manifest.json")
    data: dict[str, Any] = {
        "run_id": run_id,
        "verdict": verification.verdict.value,
        "integrity": verification.integrity.value,
        "scenario_name": manifest.get("scenario_name"),
        "policy_name": manifest.get("policy_name"),
        "policy_config_digest": manifest.get("policy_config_digest"),
        "seed": manifest.get("seed"),
        "errors": list(verification.errors),
    }
    citations = [_citation(run_id, bundle, "verdict.json", "/verdict", verification.verdict.value)]
    if snapshot is not None:
        execution_document = _read_json(bundle, "execution-context.json")
        execution = snapshot.context
    if snapshot is not None and (
        execution_document.get("evidence_schema_version") in {"2.0", "3.0"}
        and type(execution) in {ExecutionContextV2, ExecutionContextV3}
        and execution.policy.name == "adas-longitudinal"
        and execution.policy.version == "1.0"
    ):
        controller_keys = set(AdasControllerConfig.model_fields)
        expected_keys = controller_keys | {
            "target_speed_mps",
            "simulated_policy_latency_ms",
        }
        if set(execution.policy.config) == expected_keys:
            controller_config = {key: execution.policy.config[key] for key in controller_keys}
            try:
                policy_config = AdasControllerConfig.model_validate_json(
                    canonical_json_bytes(controller_config), strict=True
                )
                complete_controller_config = canonical_json_bytes(
                    policy_config.model_dump(mode="json")
                ) == canonical_json_bytes(controller_config)
            except (RecursionError, ValueError):
                # Integrity verification binds this config but intentionally does
                # not interpret controller tunables. An invalid bounded value is
                # therefore unavailable to the agent, never exposed as evidence.
                policy_config = None
                complete_controller_config = False
            if policy_config is not None and complete_controller_config:
                threshold = policy_config.aeb.stale_observation_s
                data["aeb_stale_observation_s"] = threshold
                citations.append(
                    _citation(
                        run_id,
                        bundle,
                        "execution-context.json",
                        "/policy/config/aeb/stale_observation_s",
                        threshold,
                    )
                )
                proof, proof_citations = _aeb_stale_observation_counterfactual(
                    run_id=run_id,
                    bundle=bundle,
                    controller_config=policy_config,
                    stale_threshold_s=threshold,
                    seed=execution.run_context.seed,
                )
                if proof is not None:
                    data["aeb_stale_observation_counterfactual"] = proof
                    citations.extend(proof_citations)
    return ok(
        tool,
        data,
        tuple(citations),
    )


def get_findings(
    context: ToolContext,
    *,
    run_id: str,
    _captured_bundle: _AgentBundle | None = None,
) -> ToolResult:
    """Return a run's verifier findings, each bound to a citation."""
    tool = "get_findings"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    bundle, error = _require_bundle(context, tool, run_id, _captured_bundle)
    if error is not None:
        return error
    assert bundle is not None
    try:
        document = _read_json(bundle, "findings.json")
        findings_type = FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA[
            _evidence_schema_version(bundle)
        ]
        findings_type.model_validate_json(bundle.payloads["findings.json"])
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError, RecursionError) as exc:
        return fail(
            tool,
            ToolErrorCode.INVALID_EVIDENCE,
            ToolPermission.READ,
            _malformed_capture_detail("findings.json", exc),
        )
    if not isinstance(document, dict):
        return fail(
            tool,
            ToolErrorCode.INVALID_EVIDENCE,
            ToolPermission.READ,
            "captured findings.json does not contain the legacy findings list",
        )
    items = document["findings"]
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


def get_metrics(
    context: ToolContext,
    *,
    run_id: str,
    _captured_bundle: _AgentBundle | None = None,
) -> ToolResult:
    """Return a run's stored metrics, each scalar bound to a citation."""
    tool = "get_metrics"
    guard = _guard(context, tool, ToolPermission.READ)
    if guard is not None:
        return guard
    bundle, error = _require_bundle(context, tool, run_id, _captured_bundle)
    if error is not None:
        return error
    assert bundle is not None
    try:
        metrics = _read_json(bundle, "metrics.json")
        metrics_type = RUN_METRICS_BY_EVIDENCE_SCHEMA[_evidence_schema_version(bundle)]
        metrics_type.model_validate_json(bundle.payloads["metrics.json"])
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError, RecursionError) as exc:
        return fail(
            tool,
            ToolErrorCode.INVALID_EVIDENCE,
            ToolPermission.READ,
            _malformed_capture_detail("metrics.json", exc),
        )
    if not isinstance(metrics, dict):
        return fail(
            tool,
            ToolErrorCode.INVALID_EVIDENCE,
            ToolPermission.READ,
            "captured metrics.json is not an object",
        )
    snapshot = bundle.capture.inspection.snapshot
    evidence_schema_version = _evidence_schema_version(bundle)
    if evidence_schema_version == "3.0":
        from hermes.domain.models import RunMetricsV3
        from hermes.evidence.metric_registry import SCHEMA2_METRIC_REGISTRY

        if type(snapshot.metrics) is not RunMetricsV3:
            return fail(
                tool,
                ToolErrorCode.INVALID_EVIDENCE,
                ToolPermission.READ,
                "evidence V3 did not retain exact RunMetricsV3",
            )
        citations = []
        for spec in SCHEMA2_METRIC_REGISTRY:
            stored = metrics
            for token in spec.accessor:
                stored = stored[token]
            if isinstance(stored, dict) and {"availability", "value"} <= set(stored):
                if stored["availability"] == "AVAILABLE":
                    citations.append(
                        _citation(
                            run_id,
                            bundle,
                            "metrics.json",
                            f"{spec.json_pointer}/value",
                            stored["value"],
                        )
                    )
                else:
                    for field in ("availability", "reason"):
                        citations.append(
                            _citation(
                                run_id,
                                bundle,
                                "metrics.json",
                                f"{spec.json_pointer}/{field}",
                                stored[field],
                            )
                        )
            else:
                citations.append(
                    _citation(
                        run_id,
                        bundle,
                        "metrics.json",
                        spec.json_pointer,
                        stored,
                    )
                )
    else:
        citations = [
            _citation(run_id, bundle, "metrics.json", f"/{key}", value)
            for key, value in sorted(metrics.items())
            if isinstance(value, (int, float, str)) and not isinstance(value, bool)
        ]
    maximum_age = metrics.get("max_observation_age_s")
    if evidence_schema_version != "3.0" and isinstance(maximum_age, dict):
        value = maximum_age.get("value")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            citations.append(
                _citation(
                    run_id,
                    bundle,
                    "metrics.json",
                    "/max_observation_age_s/value",
                    value,
                )
            )
    fault_counts = metrics.get("fault_application_counts")
    if isinstance(fault_counts, dict):
        for reason, value in sorted(fault_counts.items()):
            if (
                isinstance(value, (int, float))
                and not isinstance(value, bool)
                and value > 0
            ):
                token = reason.replace("~", "~0").replace("/", "~1")
                citations.append(
                    _citation(
                        run_id,
                        bundle,
                        "metrics.json",
                        f"/fault_application_counts/{token}",
                        value,
                    )
                )
    return ok(tool, {"metrics": metrics}, tuple(citations))


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
    events = [json.loads(line) for line in bundle.payloads["events.jsonl"].splitlines()]
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
