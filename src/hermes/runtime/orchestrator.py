"""Bounded scenario orchestration with unconditional cleanup and verified publication."""

from __future__ import annotations

import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.adapters.metadrive import MetaDriveAdapter
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
from hermes.policies.metadrive_idm import MetaDriveIDMPolicy
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


@dataclass(frozen=True, slots=True)
class SimulatorProvenance:
    name: str | None
    version: str | None
    commit: str | None


@dataclass(frozen=True, slots=True)
class SimulatorSmokeOutcome:
    simulator_name: str
    simulator_version: str
    simulator_commit: str
    steps_completed: int


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
    adapter_config = adapter.evidence_config
    policy_config = policy.evidence_config
    shield_config = shield.evidence_config
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
    policy_builder: Callable[[SimulatorAdapter], DrivingPolicy],
    shield_factory: Callable[[], SafetyShield],
) -> tuple[tuple[TraceEvent, ...], ExecutionContext, SimulatorProvenance]:
    try:
        adapter = adapter_factory()
    except Exception as exc:
        raise RunOperationalError(
            f"adapter construction failed: {type(exc).__name__}: {exc}"
        ) from exc

    operation_error: Exception | None = None
    events: list[TraceEvent] = []
    execution_context: ExecutionContext | None = None
    simulator_provenance: SimulatorProvenance | None = None
    try:
        observation = adapter.reset(scenario, seed)
        policy = policy_builder(adapter)
        shield = shield_factory()
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
        simulator_provenance = SimulatorProvenance(
            name=adapter.simulator_name,
            version=adapter.simulator_version,
            commit=adapter.simulator_commit,
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
    assert simulator_provenance is not None
    try:
        verify_complete_trace(tuple(events), scenario)
    except Exception as exc:
        raise RunOperationalError(f"runtime produced invalid trace: {exc}") from exc
    return tuple(events), execution_context, simulator_provenance


def _execute_run(
    *,
    expected_adapter: str,
    scenario_path: Path,
    gate_config_path: Path,
    seed: int,
    run_id: str,
    artifact_root: Path,
    repository_root: Path,
    adapter_factory: Callable[[], SimulatorAdapter],
    policy_builder: Callable[[SimulatorAdapter], DrivingPolicy],
    shield_factory: Callable[[], SafetyShield],
) -> RunOutcome:
    if isinstance(seed, bool) or not -(2**31) <= seed < 2**31:
        raise RunConfigurationError("seed must be a signed 32-bit integer")
    try:
        destination = validate_artifact_destination(artifact_root, run_id)
        scenario = load_scenario(scenario_path)
        gate_config = load_gate_config(gate_config_path)
    except (ArtifactExistsError, ArtifactError, ScenarioLoadError, GateConfigError) as exc:
        raise RunConfigurationError(str(exc)) from exc
    if scenario.adapter != expected_adapter:
        raise RunConfigurationError(
            f"requested {expected_adapter} adapter requires scenario adapter: {expected_adapter}"
        )
    if expected_adapter == "metadrive" and any(
        value is not None and value is not False
        for value in (
            scenario.hazards.collision_at_step,
            scenario.hazards.boundary_at_step,
            scenario.hazards.comfort_spike_at_step,
            scenario.hazards.unavailable_progress,
        )
    ):
        raise RunConfigurationError(
            "Phase 2 MetaDrive nominal runs do not support synthetic fake-adapter hazards"
        )

    events, execution_context, simulator_provenance = _execute_episode(
        scenario=scenario,
        gate_config=gate_config,
        seed=seed,
        adapter_factory=adapter_factory,
        policy_builder=policy_builder,
        shield_factory=shield_factory,
    )
    if expected_adapter == "fake" and any(
        value is not None
        for value in (
            simulator_provenance.name,
            simulator_provenance.version,
            simulator_provenance.commit,
        )
    ):
        raise RunOperationalError("fake adapter unexpectedly claimed simulator provenance")
    if expected_adapter == "metadrive" and not all(
        (
            simulator_provenance.name,
            simulator_provenance.version,
            simulator_provenance.commit,
        )
    ):
        raise RunOperationalError("MetaDrive simulator provenance is incomplete")

    metrics = compute_metrics(events)
    findings = run_phase1_verifiers(events, scenario, gate_config)
    verdict = apply_release_gate(findings, gate_config, adapter_name=expected_adapter)
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
                simulator_name=simulator_provenance.name,
                simulator_version=simulator_provenance.version,
                simulator_commit=simulator_provenance.commit,
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
    return _execute_run(
        expected_adapter="fake",
        scenario_path=scenario_path,
        gate_config_path=gate_config_path,
        seed=seed,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        adapter_factory=adapter_factory,
        policy_builder=lambda adapter: policy_factory(),
        shield_factory=shield_factory,
    )


def execute_metadrive_run(
    *,
    scenario_path: Path,
    gate_config_path: Path,
    seed: int,
    run_id: str,
    artifact_root: Path,
    repository_root: Path,
    adapter_factory: Callable[[], SimulatorAdapter] | None = None,
    policy_factory: Callable[[MetaDriveAdapter], DrivingPolicy] | None = None,
    shield_factory: Callable[[], SafetyShield] = NoOpShield,
) -> RunOutcome:
    """Execute, self-verify, and atomically publish one Phase 2 MetaDrive run."""
    resolved_adapter_factory = adapter_factory or (
        lambda: MetaDriveAdapter(repository_root=repository_root)
    )

    def build_policy(adapter: SimulatorAdapter) -> DrivingPolicy:
        metadrive_adapter = cast(MetaDriveAdapter, adapter)
        return (
            policy_factory(metadrive_adapter)
            if policy_factory is not None
            else MetaDriveIDMPolicy(metadrive_adapter)
        )

    return _execute_run(
        expected_adapter="metadrive",
        scenario_path=scenario_path,
        gate_config_path=gate_config_path,
        seed=seed,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        adapter_factory=resolved_adapter_factory,
        policy_builder=build_policy,
        shield_factory=shield_factory,
    )


def run_metadrive_smoke(
    *,
    scenario_path: Path,
    seed: int,
    repository_root: Path,
    max_steps: int = 5,
    adapter_factory: Callable[[], MetaDriveAdapter] | None = None,
) -> SimulatorSmokeOutcome:
    """Run a bounded reset/IDM/step/close probe without publishing evidence."""
    try:
        scenario = load_scenario(scenario_path)
    except ScenarioLoadError as exc:
        raise RunConfigurationError(str(exc)) from exc
    if scenario.adapter != "metadrive":
        raise RunConfigurationError("MetaDrive smoke requires scenario adapter: metadrive")
    if max_steps < 1:
        raise RunConfigurationError("MetaDrive smoke max_steps must be positive")

    adapter = (
        adapter_factory()
        if adapter_factory is not None
        else MetaDriveAdapter(repository_root=repository_root)
    )
    operation_error: Exception | None = None
    completed = 0
    provenance: SimulatorProvenance | None = None
    try:
        observation = adapter.reset(scenario, seed)
        policy = MetaDriveIDMPolicy(adapter)
        policy.reset(scenario, seed)
        provenance = SimulatorProvenance(
            adapter.simulator_name,
            adapter.simulator_version,
            adapter.simulator_commit,
        )
        for _ in range(min(max_steps, scenario.control.horizon_steps)):
            result = adapter.step(policy.act(observation))
            completed += 1
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
            f"MetaDrive smoke failed: {type(operation_error).__name__}: {operation_error}"
        ) from operation_error
    if provenance is None or not all((provenance.name, provenance.version, provenance.commit)):
        raise RunOperationalError("MetaDrive smoke provenance is incomplete")
    return SimulatorSmokeOutcome(
        simulator_name=provenance.name,
        simulator_version=provenance.version,
        simulator_commit=provenance.commit,
        steps_completed=completed,
    )
