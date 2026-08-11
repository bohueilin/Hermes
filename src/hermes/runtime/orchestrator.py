"""Bounded scenario orchestration with unconditional cleanup and verified publication."""

from __future__ import annotations

import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.domain.contracts import DrivingPolicy, SafetyShield, SimulatorAdapter
from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.domain.models import (
    ArtifactVerification,
    ComponentContext,
    ExecutionContext,
    RunContext,
    TraceEvent,
)
from hermes.evidence.artifacts import (
    ArtifactError,
    ArtifactExistsError,
    ArtifactStager,
    config_digest,
    validate_artifact_destination,
    write_bundle,
)
from hermes.evidence.metrics import compute_metrics
from hermes.evidence.trace import GENESIS_HASH, create_trace_event, verify_complete_trace
from hermes.evidence.verification import verify_artifact
from hermes.gates.config import GateConfigError, gate_config_digest, load_gate_config
from hermes.gates.release import apply_release_gate
from hermes.policies.baseline import BaselinePolicy
from hermes.scenarios.loader import ScenarioLoadError, load_scenario, scenario_digest
from hermes.shields.noop import NoOpShield
from hermes.verifiers import PHASE1_VERIFIER_IDENTITIES, run_phase1_verifiers


class RunConfigurationError(ValueError):
    """The requested run is unsupported, invalid, unsafe, or would overwrite evidence."""


class RunOperationalError(RuntimeError):
    """Execution, cleanup, serialization, self-verification, or publication failed."""


@dataclass(frozen=True, slots=True)
class RunOutcome:
    verdict: Verdict
    artifact_path: Path
    trace_digest: str
    verification: ArtifactVerification


def _git(repository_root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", *arguments],
            cwd=repository_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        return subprocess.CompletedProcess(["git", *arguments], 127, "", str(exc))


def _repository_provenance(repository_root: Path) -> tuple[str | None, bool | None, str | None]:
    commit = _git(repository_root, "rev-parse", "HEAD")
    status = _git(repository_root, "status", "--porcelain", "--untracked-files=normal")
    if commit.returncode != 0 or status.returncode != 0:
        reasons = [
            message
            for message in (commit.stderr.strip(), status.stderr.strip())
            if message
        ]
        return None, None, "; ".join(reasons) or "Git provenance unavailable"
    return commit.stdout.strip(), bool(status.stdout.strip()), None


def _build_execution_context(
    *,
    scenario,
    gate_config,
    seed: int,
    adapter: SimulatorAdapter,
    policy: DrivingPolicy,
    shield: SafetyShield,
) -> ExecutionContext:
    adapter_config = {"model": "deterministic_architectural_test_double_v1"}
    policy_config = {
        "target_speed_mps": scenario.control.target_speed_mps,
        "simulated_policy_latency_ms": scenario.control.simulated_policy_latency_ms,
    }
    shield_config: dict[str, object] = {}
    suite_payload = [identity.model_dump(mode="json") for identity in PHASE1_VERIFIER_IDENTITIES]
    run_context = RunContext(
        scenario_digest=scenario_digest(scenario),
        gate_config_digest=gate_config_digest(gate_config),
        adapter_name=adapter.name,
        adapter_version=adapter.version,
        adapter_config_digest=config_digest(adapter_config),
        policy_name=policy.name,
        policy_version=policy.version,
        policy_config_digest=config_digest(policy_config),
        shield_name=shield.name,
        shield_version=shield.version,
        shield_config_digest=config_digest(shield_config),
        verifier_suite_digest=config_digest(suite_payload),
        seed=seed,
        control_frequency_hz=scenario.control.frequency_hz,
        horizon_steps=scenario.control.horizon_steps,
    )
    return ExecutionContext(
        run_context=run_context,
        adapter=ComponentContext(
            name=adapter.name,
            version=adapter.version,
            config=adapter_config,
            config_digest=run_context.adapter_config_digest,
        ),
        policy=ComponentContext(
            name=policy.name,
            version=policy.version,
            config=policy_config,
            config_digest=run_context.policy_config_digest,
        ),
        shield=ComponentContext(
            name=shield.name,
            version=shield.version,
            config=shield_config,
            config_digest=run_context.shield_config_digest,
        ),
        verifier_suite=PHASE1_VERIFIER_IDENTITIES,
    )


def _execute_episode(
    *,
    scenario,
    gate_config,
    seed: int,
    adapter_factory: Callable[[], SimulatorAdapter],
    policy_factory: Callable[[], DrivingPolicy],
    shield_factory: Callable[[], SafetyShield],
) -> tuple[tuple[TraceEvent, ...], ExecutionContext]:
    try:
        adapter = adapter_factory()
    except Exception as exc:
        raise RunOperationalError(
            f"adapter construction failed: {type(exc).__name__}: {exc}"
        ) from exc

    operation_error: Exception | None = None
    events: list[TraceEvent] = []
    execution_context: ExecutionContext | None = None
    try:
        policy = policy_factory()
        shield = shield_factory()
        observation = adapter.reset(scenario, seed)
        policy.reset(scenario, seed)
        shield.reset(scenario, seed)
        execution_context = _build_execution_context(
            scenario=scenario,
            gate_config=gate_config,
            seed=seed,
            adapter=adapter,
            policy=policy,
            shield=shield,
        )
        previous_hash = GENESIS_HASH
        for sequence in range(scenario.control.horizon_steps):
            candidate = policy.act(observation)
            executed, override_reasons = shield.apply(observation, candidate)
            result = adapter.step(executed)
            event = create_trace_event(
                sequence=sequence,
                simulation_time_s=result.observation.simulation_time_s,
                run_context=execution_context.run_context,
                observation_summary={
                    "input_sequence": observation.sequence,
                    "input_simulation_time_s": observation.simulation_time_s,
                    "speed_mps": observation.vehicle_state.speed_mps,
                    "lateral_offset_m": observation.vehicle_state.lateral_offset_m,
                    "route_progress_pct": observation.vehicle_state.route_progress_pct,
                    "observation_age_s": observation.observation_age_s,
                },
                candidate_action=candidate,
                executed_action=executed,
                override_reasons=override_reasons,
                vehicle_state=result.observation.vehicle_state,
                policy_latency_ms=policy.simulated_latency_ms,
                latency_source="simulated",
                terminated=result.terminated,
                truncated=result.truncated,
                termination_reason=result.termination_reason,
                raw_facts=result.raw_facts,
                previous_hash=previous_hash,
            )
            events.append(event)
            previous_hash = event.current_hash
            observation = result.observation
            if result.terminated or result.truncated:
                break
    except Exception as exc:
        operation_error = exc
    finally:
        try:
            adapter.close()
        except Exception as exc:
            if operation_error is None:
                operation_error = exc
            else:
                operation_error = RuntimeError(
                    f"{operation_error}; adapter close also failed: {type(exc).__name__}: {exc}"
                )

    if operation_error is not None:
        raise RunOperationalError(
            f"run execution failed: {type(operation_error).__name__}: {operation_error}"
        ) from operation_error
    assert execution_context is not None
    try:
        verify_complete_trace(tuple(events), scenario)
    except Exception as exc:
        raise RunOperationalError(f"runtime produced invalid trace: {exc}") from exc
    return tuple(events), execution_context


def execute_fake_run(
    *,
    scenario_path: Path,
    gate_config_path: Path,
    seed: int,
    run_id: str,
    artifact_root: Path,
    repository_root: Path,
    adapter_factory: Callable[[], SimulatorAdapter] = FakeSimulatorAdapter,
    policy_factory: Callable[[], DrivingPolicy] = BaselinePolicy,
    shield_factory: Callable[[], SafetyShield] = NoOpShield,
) -> RunOutcome:
    """Execute, self-verify, and atomically publish one Phase 1 fake run."""
    if isinstance(seed, bool) or not -(2**31) <= seed < 2**31:
        raise RunConfigurationError("seed must be a signed 32-bit integer")
    try:
        destination = validate_artifact_destination(artifact_root, run_id)
        scenario = load_scenario(scenario_path)
        gate_config = load_gate_config(gate_config_path)
    except (ArtifactExistsError, ArtifactError, ScenarioLoadError, GateConfigError) as exc:
        raise RunConfigurationError(str(exc)) from exc
    if scenario.adapter != "fake":
        raise RunConfigurationError("Phase 1 execute_fake_run requires adapter: fake")

    events, execution_context = _execute_episode(
        scenario=scenario,
        gate_config=gate_config,
        seed=seed,
        adapter_factory=adapter_factory,
        policy_factory=policy_factory,
        shield_factory=shield_factory,
    )
    metrics = compute_metrics(events)
    findings = run_phase1_verifiers(events, scenario, gate_config)
    verdict = apply_release_gate(findings, gate_config)
    commit, dirty, provenance_reason = _repository_provenance(
        repository_root.expanduser().resolve()
    )

    try:
        with ArtifactStager(artifact_root, run_id) as stager:
            assert stager.staging_path is not None
            write_bundle(
                stager.staging_path,
                run_id=run_id,
                scenario=scenario,
                gate_config=gate_config,
                execution_context=execution_context,
                events=events,
                metrics=metrics,
                findings=findings,
                verdict=verdict,
                repository_commit=commit,
                repository_dirty=dirty,
                repository_provenance_reason=provenance_reason,
            )
            staged_verification = verify_artifact(stager.staging_path)
            if staged_verification.integrity is not IntegrityStatus.INTERNALLY_CONSISTENT:
                raise ArtifactError(
                    "staged artifact failed self-verification: "
                    + "; ".join(staged_verification.errors)
                )
            published = stager.publish()
    except ArtifactExistsError as exc:
        raise RunConfigurationError(str(exc)) from exc
    except Exception as exc:
        raise RunOperationalError(
            f"artifact publication failed: {type(exc).__name__}: {exc}"
        ) from exc

    assert published == destination
    return RunOutcome(
        verdict=verdict.verdict,
        artifact_path=published,
        trace_digest=events[-1].current_hash,
        verification=staged_verification.model_copy(update={"artifact_path": str(published)}),
    )
