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
from hermes.domain.enums import EvidenceAvailability, IntegrityStatus, Verdict
from hermes.domain.models import (
    ArtifactVerification,
    ComponentContext,
    ControlFaultEvidence,
    ExecutionContext,
    ExecutionContextV2,
    Measurement,
    ObservationFaultEvidence,
    RunContext,
    RunContextV2,
    TraceEvent,
    TraceEventV2,
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
from hermes.evidence.trace import (
    GENESIS_HASH,
    TraceEventLike,
    create_trace_event,
    create_trace_event_v2,
    verify_complete_trace,
)
from hermes.evidence.verification import verify_artifact
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.gates.config import GateConfigError, gate_config_digest, load_gate_config
from hermes.gates.release import VerifierProfile, apply_release_gate
from hermes.policies.baseline import BaselinePolicy
from hermes.policies.metadrive_idm import MetaDriveIDMPolicy
from hermes.scenarios.loader import ScenarioLoadError, load_scenario, scenario_digest
from hermes.shields.noop import NoOpShield
from hermes.verifiers import (
    PHASE1_VERIFIER_IDENTITIES,
    PHASE4_VERIFIER_IDENTITIES,
    run_phase1_verifiers,
    run_phase4_verifiers,
)


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


def _observation_summary(observation, result_observation, scenario) -> dict[str, object]:
    summary: dict[str, object] = {
        "input_sequence": observation.sequence,
        "input_simulation_time_s": observation.simulation_time_s,
        "speed_mps": observation.vehicle_state.speed_mps,
        "lateral_offset_m": observation.vehicle_state.lateral_offset_m,
        "route_progress_pct": observation.vehicle_state.route_progress_pct,
        "observation_age_s": observation.observation_age_s,
    }
    if scenario.challenge is not None:
        for label, observed in (
            ("input", observation),
            ("result", result_observation),
        ):
            actor_values = (
                observed.challenge_actor_longitudinal_m,
                observed.challenge_actor_lateral_offset_m,
                observed.challenge_actor_speed_mps,
                observed.challenge_phase,
            )
            if any(value is None for value in actor_values):
                raise RunOperationalError(
                    f"challenge {label} observation omitted required actual actor evidence"
                )
            if (observed.front_distance_m is None) != (
                observed.front_relative_speed_mps is None
            ):
                raise RunOperationalError(
                    f"challenge {label} observation front distance and relative speed "
                    "must be paired"
                )
        summary.update(
            {
                "front_distance_m": observation.front_distance_m,
                "front_relative_speed_mps": observation.front_relative_speed_mps,
                "challenge_actor_longitudinal_m": (
                    observation.challenge_actor_longitudinal_m
                ),
                "challenge_actor_lateral_offset_m": (
                    observation.challenge_actor_lateral_offset_m
                ),
                "challenge_actor_speed_mps": observation.challenge_actor_speed_mps,
                "challenge_phase": observation.challenge_phase,
                "result_front_distance_m": result_observation.front_distance_m,
                "result_front_relative_speed_mps": (
                    result_observation.front_relative_speed_mps
                ),
                "result_challenge_actor_longitudinal_m": (
                    result_observation.challenge_actor_longitudinal_m
                ),
                "result_challenge_actor_lateral_offset_m": (
                    result_observation.challenge_actor_lateral_offset_m
                ),
                "result_challenge_actor_speed_mps": (
                    result_observation.challenge_actor_speed_mps
                ),
                "result_challenge_phase": result_observation.challenge_phase,
            }
        )
    return summary


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
    fault_injector: DeterministicFaultInjector | None,
) -> ExecutionContext | ExecutionContextV2:
    adapter_config = adapter.evidence_config
    policy_config = policy.evidence_config
    shield_config = shield.evidence_config
    verifier_suite = (
        PHASE4_VERIFIER_IDENTITIES
        if fault_injector is not None
        else PHASE1_VERIFIER_IDENTITIES
    )
    suite_payload = [identity.model_dump(mode="json") for identity in verifier_suite]
    if fault_injector is not None:
        fault_config = fault_injector.evidence_config
        run_context_v2 = RunContextV2(
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
            fault_name=fault_injector.name,
            fault_version=fault_injector.version,
            fault_config_digest=config_digest(fault_config),
            seed=seed,
            control_frequency_hz=scenario.control.frequency_hz,
            horizon_steps=scenario.control.horizon_steps,
        )
        return ExecutionContextV2(
            run_context=run_context_v2,
            adapter=ComponentContext(
                name=adapter.name,
                version=adapter.version,
                config=adapter_config,
                config_digest=run_context_v2.adapter_config_digest,
            ),
            policy=ComponentContext(
                name=policy.name,
                version=policy.version,
                config=policy_config,
                config_digest=run_context_v2.policy_config_digest,
            ),
            shield=ComponentContext(
                name=shield.name,
                version=shield.version,
                config=shield_config,
                config_digest=run_context_v2.shield_config_digest,
            ),
            faults=ComponentContext(
                name=fault_injector.name,
                version=fault_injector.version,
                config=fault_config,
                config_digest=run_context_v2.fault_config_digest,
            ),
            verifier_suite=verifier_suite,
        )
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
        verifier_suite=verifier_suite,
    )


def _execute_episode(
    *,
    scenario,
    gate_config,
    seed: int,
    adapter_factory: Callable[[], SimulatorAdapter],
    policy_builder: Callable[[SimulatorAdapter], DrivingPolicy],
    shield_factory: Callable[[], SafetyShield],
) -> tuple[
    tuple[TraceEventLike, ...],
    ExecutionContext | ExecutionContextV2,
    SimulatorProvenance,
]:
    try:
        adapter = adapter_factory()
    except Exception as exc:
        raise RunOperationalError(
            f"adapter construction failed: {type(exc).__name__}: {exc}"
        ) from exc

    operation_error: Exception | None = None
    events: list[TraceEventLike] = []
    execution_context: ExecutionContext | ExecutionContextV2 | None = None
    simulator_provenance: SimulatorProvenance | None = None
    try:
        raw_observation = adapter.reset(scenario, seed)
        policy = policy_builder(adapter)
        shield = shield_factory()
        fault_injector = (
            DeterministicFaultInjector(scenario.faults)
            if scenario.faults is not None
            else None
        )
        policy.reset(scenario, seed)
        shield.reset(scenario, seed)
        if fault_injector is not None:
            fault_injector.reset(scenario, seed)
        execution_context = _build_execution_context(
            scenario=scenario,
            gate_config=gate_config,
            seed=seed,
            adapter=adapter,
            policy=policy,
            shield=shield,
            fault_injector=fault_injector,
        )
        simulator_provenance = SimulatorProvenance(
            name=adapter.simulator_name,
            version=adapter.simulator_version,
            commit=adapter.simulator_commit,
        )
        previous_hash = GENESIS_HASH
        for sequence in range(scenario.control.horizon_steps):
            faulted_observation = (
                fault_injector.process_observation(raw_observation)
                if fault_injector is not None
                else None
            )
            policy_observation = (
                faulted_observation.observation
                if faulted_observation is not None
                else raw_observation
            )
            candidate = policy.act(policy_observation)
            permitted, override_reasons = shield.apply(policy_observation, candidate)
            faulted_action = (
                fault_injector.process_action(
                    permitted,
                    sequence=sequence,
                    simulation_time_s=raw_observation.simulation_time_s,
                )
                if fault_injector is not None
                else None
            )
            executed = faulted_action.action if faulted_action is not None else permitted
            result = adapter.step(executed)
            if fault_injector is None:
                assert isinstance(execution_context, ExecutionContext)
                event: TraceEventLike = create_trace_event(
                    sequence=sequence,
                    simulation_time_s=result.observation.simulation_time_s,
                    run_context=execution_context.run_context,
                    observation_summary=_observation_summary(
                        policy_observation, result.observation, scenario
                    ),
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
            else:
                assert isinstance(execution_context, ExecutionContextV2)
                assert faulted_observation is not None
                assert faulted_action is not None
                control_latency = (
                    Measurement(
                        availability=EvidenceAvailability.NOT_AVAILABLE,
                        unit="ms",
                        reason=(
                            "control-delay startup fill has no originating candidate"
                        ),
                    )
                    if faulted_action.source_simulation_time_s is None
                    else Measurement(
                        availability=EvidenceAvailability.AVAILABLE,
                        value=(
                            raw_observation.simulation_time_s
                            - faulted_action.source_simulation_time_s
                        )
                        * 1000.0,
                        unit="ms",
                    )
                )
                event = create_trace_event_v2(
                    sequence=sequence,
                    simulation_time_s=result.observation.simulation_time_s,
                    run_context=execution_context.run_context,
                    observation_summary=_observation_summary(
                        policy_observation, result.observation, scenario
                    ),
                    candidate_action=candidate,
                    permitted_action=permitted,
                    executed_action=executed,
                    override_reasons=override_reasons,
                    observation_fault_evidence=ObservationFaultEvidence(
                        raw_observation=raw_observation,
                        delivered_observation=policy_observation,
                        delivered_from_sequence=faulted_observation.source_sequence,
                        delivered_from_time_s=(
                            faulted_observation.source_simulation_time_s
                        ),
                        delivery_time_s=faulted_observation.delivery_time_s,
                        applied_faults=faulted_observation.reason_codes,
                        speed_noise_delta_mps=(
                            faulted_observation.noise_deltas.speed_mps
                        ),
                        lateral_noise_delta_m=(
                            faulted_observation.noise_deltas.lateral_offset_m
                        ),
                    ),
                    control_fault_evidence=ControlFaultEvidence(
                        candidate_time_s=raw_observation.simulation_time_s,
                        executed_from_sequence=faulted_action.source_sequence,
                        executed_from_candidate_time_s=(
                            faulted_action.source_simulation_time_s
                        ),
                        execution_time_s=faulted_action.execution_time_s,
                        pre_saturation_action=faulted_action.pre_saturation_action,
                        applied_faults=faulted_action.reason_codes,
                        control_latency_ms=control_latency,
                        latency_source="simulated",
                    ),
                    result_observation=result.observation,
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
            raw_observation = result.observation
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
    if (
        expected_adapter == "metadrive"
        and scenario.faults is not None
        and (
            scenario.faults.observation_delay_steps > 0
            or scenario.faults.frozen_observation_interval is not None
            or bool(scenario.faults.dropped_observation_steps)
            or scenario.faults.observation_noise is not None
        )
    ):
        raise RunConfigurationError(
            "MetaDrive IDM v1.0 reads native simulator state, so Hermes observation faults "
            "would not truthfully affect that policy; use control delay/saturation only or "
            "the fake baseline policy"
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
    if scenario.faults is not None:
        fault_events = tuple(
            event for event in events if isinstance(event, TraceEventV2)
        )
        if len(fault_events) != len(events):
            raise RunOperationalError("fault run produced a mixed evidence schema")
        findings = run_phase4_verifiers(fault_events, scenario, gate_config)
    else:
        legacy_events = tuple(event for event in events if isinstance(event, TraceEvent))
        if len(legacy_events) != len(events):
            raise RunOperationalError("legacy run produced a mixed evidence schema")
        findings = run_phase1_verifiers(legacy_events, scenario, gate_config)
    verifier_profile = (
        VerifierProfile.FAULT_COVERAGE
        if scenario.faults is not None
        else VerifierProfile.LEGACY
    )
    verdict = apply_release_gate(
        findings,
        gate_config,
        adapter_name=expected_adapter,
        expected_profile=verifier_profile,
    )
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
