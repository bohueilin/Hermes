"""WP-7 exact producer routing, construction, cleanup, and determinism contracts."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import hermes.runtime.orchestrator as orchestrator
from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.adas.policy import AdasLongitudinalPolicy
from hermes.domain.enums import (
    AdasMode,
    BrakeSource,
    EvidenceAvailability,
    IntegrityStatus,
    InterventionLevel,
    WarningLevel,
)
from hermes.domain.models import (
    Action,
    AdasDecision,
    AdasDecisionEvidence,
    ArtifactManifestV3,
    ExecutionContext,
    ExecutionContextV2,
    ExecutionContextV3,
    FindingsDocumentV3,
    RunContext,
    RunContextV2,
    RunContextV3,
    RunMetricsV3,
    ScenarioDefinition,
    TraceEventV3,
)
from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES
from hermes.evidence.verification import inspect_artifact
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.gates.config import load_gate_config
from hermes.gates.release import VerifierProfile, select_verifier_profile
from hermes.policies.baseline import BaselinePolicy
from hermes.scenarios.loader import load_scenario, resolved_scenario_yaml
from hermes.shields.config import ShieldConfig
from hermes.shields.deterministic import DeterministicSafetyShield
from hermes.shields.noop import NoOpShield

_NO_FAULT_SUITE_DIGEST = (
    "00687face2297eb9f35bf0bde426bff52fc96b539d69b41ca902fdd40016f39c"
)
_FAULT_SUITE_DIGEST = (
    "f8f716b526b50818477e1965dea90c40c20e6302f1f9028b9adc969df585e429"
)
_DETERMINISTIC_FILES = (
    "events.jsonl",
    "trace.sha256",
    "execution-context.json",
    "scenario.resolved.yaml",
    "gate-config.resolved.yaml",
    "metrics.json",
    "findings.json",
    "verdict.json",
)


def _adas_scenario(*, faulted: bool, tags: tuple[str, ...] = ()) -> ScenarioDefinition:
    payload: dict[str, object] = {
        "schema_version": "4.0",
        "name": "wp7_producer_activation",
        "version": "1.0",
        "description": "Simulator-neutral WP-7 producer activation probe.",
        "adapter": "fake",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": 3,
            "target_speed_mps": 5.0,
            "max_braking_mps2": 12.982444763183452,
        },
        "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 100.0, "boundary_tolerance_m": 1.5},
        "tags": tags,
        "adas": {
            "enabled": ("fcw", "aeb"),
            "expected_fcw": {"kind": "none"},
            "expected_aeb": {"kind": "forbidden"},
        },
    }
    if faulted:
        payload["faults"] = {
            "schema_version": "1.0",
            "name": "wp7_delay_and_saturation",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            "observation_delay_steps": 1,
            "control_delay_steps": 1,
            "max_brake": 0.4,
        }
    return ScenarioDefinition.model_validate(payload)


def _write_scenario(tmp_path: Path, *, faulted: bool) -> Path:
    path = tmp_path / ("adas-fault.yaml" if faulted else "adas-no-fault.yaml")
    path.write_text(
        resolved_scenario_yaml(_adas_scenario(faulted=faulted)),
        encoding="utf-8",
    )
    return path


def _run_adas(
    repository_root: Path,
    artifact_root: Path,
    scenario_path: Path,
    *,
    run_id: str,
    policy_factory=AdasLongitudinalPolicy,
):
    return orchestrator.execute_fake_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=policy_factory,
    )


@pytest.mark.parametrize(
    ("profile", "expected_schema"),
    [
        (VerifierProfile.LEGACY, "1.0"),
        (VerifierProfile.FAULT_COVERAGE, "2.0"),
        (VerifierProfile.ADAS_P0_LONGITUDINAL, "3.0"),
        (VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT, "3.0"),
    ],
)
def test_exact_verifier_profile_alone_selects_producer_schema(
    profile: VerifierProfile,
    expected_schema: str,
) -> None:
    assert orchestrator._evidence_schema_for_verifier_profile(profile) == expected_schema


@pytest.mark.parametrize("accidental_selector", ["adas_p0_longitudinal", object()])
def test_producer_schema_rejects_non_profile_accidental_selectors(
    accidental_selector: object,
) -> None:
    with pytest.raises(TypeError, match="exact VerifierProfile"):
        orchestrator._evidence_schema_for_verifier_profile(accidental_selector)


def test_tags_gate_and_policy_identity_cannot_activate_v3(
    repository_root: Path,
) -> None:
    tagged = _adas_scenario(faulted=False, tags=("aeb",)).model_copy(
        update={"adas": None}
    )
    gate = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    policy = AdasLongitudinalPolicy()
    shield = NoOpShield()
    policy.reset(tagged, 7)
    shield.reset(tagged, 7)

    assert select_verifier_profile(tagged) is VerifierProfile.LEGACY
    context = orchestrator._build_execution_context(
        scenario=tagged,
        gate_config=gate,
        seed=7,
        adapter=FakeSimulatorAdapter(),
        policy=policy,
        shield=shield,
        fault_injector=None,
    )

    assert type(context) is ExecutionContext
    assert type(context.run_context) is RunContext


@pytest.mark.parametrize(
    ("scenario_name", "policy_factory", "expected_context", "expected_run_context"),
    [
        ("fake_nominal.yaml", BaselinePolicy, ExecutionContext, RunContext),
        (
            "fake_fault_injection.yaml",
            BaselinePolicy,
            ExecutionContextV2,
            RunContextV2,
        ),
    ],
)
def test_legacy_and_non_adas_fault_construction_remain_exact_siblings(
    repository_root: Path,
    scenario_name: str,
    policy_factory,
    expected_context: type,
    expected_run_context: type,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / scenario_name)
    gate = load_gate_config(repository_root / "config" / "gates.phase1.yaml")
    policy = policy_factory()
    shield = NoOpShield()
    fault_injector = (
        DeterministicFaultInjector(scenario.faults)
        if scenario.faults is not None
        else None
    )
    policy.reset(scenario, 7)
    shield.reset(scenario, 7)
    if fault_injector is not None:
        fault_injector.reset(scenario, 7)

    context = orchestrator._build_execution_context(
        scenario=scenario,
        gate_config=gate,
        seed=7,
        adapter=FakeSimulatorAdapter(),
        policy=policy,
        shield=shield,
        fault_injector=fault_injector,
    )

    assert type(context) is expected_context
    assert type(context.run_context) is expected_run_context


@pytest.mark.parametrize(
    ("faulted", "expected_suite_digest"),
    [(False, _NO_FAULT_SUITE_DIGEST), (True, _FAULT_SUITE_DIGEST)],
)
def test_adas_profiles_construct_exact_v3_context_and_pinned_suite(
    repository_root: Path,
    faulted: bool,
    expected_suite_digest: str,
) -> None:
    scenario = _adas_scenario(faulted=faulted)
    gate = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    policy = AdasLongitudinalPolicy()
    shield = NoOpShield()
    fault_injector = (
        DeterministicFaultInjector(scenario.faults)
        if scenario.faults is not None
        else None
    )
    policy.reset(scenario, 7)
    shield.reset(scenario, 7)
    if fault_injector is not None:
        fault_injector.reset(scenario, 7)

    context = orchestrator._build_execution_context(
        scenario=scenario,
        gate_config=gate,
        seed=7,
        adapter=FakeSimulatorAdapter(),
        policy=policy,
        shield=shield,
        fault_injector=fault_injector,
    )

    assert type(context) is ExecutionContextV3
    assert type(context.run_context) is RunContextV3
    assert context.evidence_schema_version == "3.0"
    assert context.run_context.verifier_suite_digest == expected_suite_digest
    assert (context.faults is not None) is faulted


@pytest.mark.parametrize("faulted", [False, True], ids=("no-fault", "fault"))
def test_adas_publication_is_exact_v3_end_to_end(
    repository_root: Path,
    tmp_path: Path,
    faulted: bool,
) -> None:
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    outcome = _run_adas(
        repository_root,
        artifact_root,
        _write_scenario(tmp_path, faulted=faulted),
        run_id="wp7-v3-e2e",
    )
    inspection = inspect_artifact(outcome.artifact_path)
    snapshot = inspection.snapshot

    assert inspection.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert snapshot is not None
    assert type(snapshot.manifest) is ArtifactManifestV3
    assert type(snapshot.context) is ExecutionContextV3
    assert type(snapshot.context.run_context) is RunContextV3
    assert all(type(event) is TraceEventV3 for event in snapshot.events)
    assert type(snapshot.metrics) is RunMetricsV3
    assert type(snapshot.findings) is FindingsDocumentV3
    assert set(path.name for path in outcome.artifact_path.iterdir()) == set(
        REQUIRED_ARTIFACT_FILES
    )
    assert snapshot.verdict.verdict.value != "INVALID_EVIDENCE"
    assert snapshot.context.run_context.verifier_suite_digest == (
        _FAULT_SUITE_DIGEST if faulted else _NO_FAULT_SUITE_DIGEST
    )
    finding_versions = {
        finding.finding_id: finding.verifier_version
        for finding in snapshot.findings.findings
    }
    assert finding_versions["trace.integrity"] == "1.1"
    assert finding_versions["adas.aeb.brake_onset_margin"] == "1.1"

    if not faulted:
        for event in snapshot.events:
            observation = event.observation_fault_evidence
            control = event.control_fault_evidence
            assert observation.raw_observation == observation.delivered_observation
            assert observation.applied_faults == ()
            assert event.permitted_action == event.executed_action
            assert control.pre_saturation_action == event.permitted_action
            assert control.applied_faults == ()
            assert control.control_latency_ms.availability is EvidenceAvailability.AVAILABLE
            assert control.control_latency_ms.value == 0.0
            assert event.run_context.fault_name is None


class _TrackingAdapter(FakeSimulatorAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.close_count = 0

    def close(self) -> None:
        self.close_count += 1
        super().close()


class _BrokenEvidencePolicy(AdasLongitudinalPolicy):
    def __init__(self, mode: str) -> None:
        super().__init__()
        self._mode = mode

    @property
    def last_decision_evidence(self) -> AdasDecisionEvidence | None:
        evidence = super().last_decision_evidence
        if self._mode == "none":
            return None
        assert evidence is not None
        if self._mode == "stale-sequence":
            return evidence.model_copy(update={"input_sequence": evidence.input_sequence + 1})
        if self._mode == "stale-time":
            return evidence.model_copy(update={"input_time_s": evidence.input_time_s + 0.1})
        if self._mode == "action-mismatch":
            return evidence.model_copy(
                update={"decision": evidence.decision.model_copy(update={"throttle": 0.0})}
            )
        return evidence


@pytest.mark.parametrize(
    ("policy_factory", "message"),
    [
        (BaselinePolicy, "does not implement AdasDecisionEvidenceProvider"),
        (lambda: _BrokenEvidencePolicy("none"), "returned no ADAS decision evidence"),
        (lambda: _BrokenEvidencePolicy("stale-sequence"), "sequence"),
        (lambda: _BrokenEvidencePolicy("stale-time"), "time"),
        (lambda: _BrokenEvidencePolicy("action-mismatch"), "candidate action"),
    ],
    ids=("missing", "none", "stale-sequence", "stale-time", "action-mismatch"),
)
def test_invalid_v3_decision_evidence_closes_once_and_leaves_no_residue(
    repository_root: Path,
    tmp_path: Path,
    policy_factory,
    message: str,
) -> None:
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    adapter = _TrackingAdapter()

    with pytest.raises(orchestrator.RunOperationalError, match=message):
        orchestrator.execute_fake_run(
            scenario_path=_write_scenario(tmp_path, faulted=False),
            gate_config_path=repository_root / "config" / "gates.adas.yaml",
            seed=7,
            run_id="wp7-invalid-provider",
            artifact_root=artifact_root,
            repository_root=repository_root,
            adapter_factory=lambda: adapter,
            policy_factory=policy_factory,
        )

    assert adapter.close_count == 1
    assert list(artifact_root.iterdir()) == []


class _FullBrakePolicy:
    name = "wp7-full-brake"
    version = "1.0"

    def __init__(self) -> None:
        self._evidence: AdasDecisionEvidence | None = None

    @property
    def evidence_config(self):
        return {"command": "full_brake"}

    @property
    def simulated_latency_ms(self) -> float:
        return 0.0

    @property
    def last_decision_evidence(self) -> AdasDecisionEvidence | None:
        return self._evidence

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del scenario, seed
        self._evidence = None

    def act(self, observation) -> Action:
        decision = AdasDecision(
            warning=WarningLevel.NO_WARNING,
            intervention=InterventionLevel.NO_INTERVENTION,
            mode=AdasMode.ACTIVE,
            brake_source=BrakeSource.DRIVER,
            throttle=0.0,
            brake=1.0,
            time_to_collision_s=None,
            required_deceleration_mps2=None,
            reasons=(),
        )
        self._evidence = AdasDecisionEvidence(
            input_sequence=observation.sequence,
            input_time_s=observation.simulation_time_s,
            decision=decision,
        )
        return Action(steering=0.0, throttle=0.0, brake=1.0)


def test_faulted_v3_preserves_delay_startup_saturation_and_source_attribution(
    repository_root: Path,
) -> None:
    scenario = _adas_scenario(faulted=True)
    adapter = _TrackingAdapter()

    events, context, _, _ = orchestrator._execute_episode(
        scenario=scenario,
        gate_config=load_gate_config(repository_root / "config" / "gates.adas.yaml"),
        seed=7,
        adapter_factory=lambda: adapter,
        policy_builder=lambda _: _FullBrakePolicy(),
        shield_factory=NoOpShield,
        enforce_metadrive_observation_fault_policy=False,
    )

    assert adapter.close_count == 1
    assert type(context) is ExecutionContextV3
    assert all(type(event) is TraceEventV3 for event in events)
    first, second = events[:2]
    assert first.control_fault_evidence.executed_from_sequence is None
    assert first.control_fault_evidence.applied_faults == ("CONTROL_DELAY_FILL",)
    assert first.executed_action == Action(steering=0.0, throttle=0.0, brake=0.0)
    assert first.executed_brake_source is BrakeSource.NONE
    assert second.observation_fault_evidence.delivered_from_sequence == 0
    assert second.observation_fault_evidence.applied_faults == ("OBSERVATION_DELAY",)
    assert second.control_fault_evidence.executed_from_sequence == 0
    assert second.control_fault_evidence.pre_saturation_action.brake == 1.0
    assert second.control_fault_evidence.applied_faults == (
        "CONTROL_DELAY",
        "BRAKE_SATURATION",
    )
    assert second.executed_action.brake == 0.4
    assert second.executed_brake_source is BrakeSource.DRIVER


def _emergency_shield() -> DeterministicSafetyShield:
    return DeterministicSafetyShield(
        ShieldConfig(
            schema_version="1.0",
            name="phase3_deterministic",
            version="1.0",
            label="illustrative_simulation_only_not_real_vehicle_limits",
            ttc_threshold_s=2.0,
            speed_cap_mps=30.0,
            max_observation_age_s=0.5,
            boundary_margin_m=0.5,
            actuation_delay_compensation_s=0.0,
            emergency_stop_active=True,
            full_brake_command=1.0,
            boundary_steering_command=0.2,
        )
    )


def test_v3_live_trace_threads_exact_deterministic_shield_config(
    repository_root: Path,
) -> None:
    scenario = _adas_scenario(faulted=False)
    events, context, _, shield_config = orchestrator._execute_episode(
        scenario=scenario,
        gate_config=load_gate_config(repository_root / "config" / "gates.adas.yaml"),
        seed=7,
        adapter_factory=FakeSimulatorAdapter,
        policy_builder=lambda _: AdasLongitudinalPolicy(),
        shield_factory=_emergency_shield,
        enforce_metadrive_observation_fault_policy=False,
    )

    assert type(context) is ExecutionContextV3
    assert shield_config is not None
    assert all(type(event) is TraceEventV3 for event in events)
    assert events[0].candidate_action.brake == 0.0
    assert events[0].permitted_action.brake == 1.0
    assert events[0].executed_brake_source is BrakeSource.SHIELD


@pytest.mark.parametrize("faulted", [False, True], ids=("no-fault", "fault"))
def test_v3_producer_is_n3_deterministic_with_timestamp_only_manifest_variation(
    repository_root: Path,
    tmp_path: Path,
    faulted: bool,
) -> None:
    scenario_path = _write_scenario(tmp_path, faulted=faulted)
    bundles: list[Path] = []
    for repeat in range(3):
        artifact_root = tmp_path / f"repeat-{repeat}"
        artifact_root.mkdir()
        bundles.append(
            _run_adas(
                repository_root,
                artifact_root,
                scenario_path,
                run_id="wp7-n3",
            ).artifact_path
        )

    for filename in _DETERMINISTIC_FILES:
        assert len({(bundle / filename).read_bytes() for bundle in bundles}) == 1
    manifests = [
        json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        for bundle in bundles
    ]
    timestamps = [manifest.pop("created_at_utc") for manifest in manifests]
    assert len(set(timestamps)) == 3
    assert manifests[0] == manifests[1] == manifests[2]
