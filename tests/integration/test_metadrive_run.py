from __future__ import annotations

import builtins
import json
from pathlib import Path
from typing import Any

import pytest

from hermes.adapters.metadrive import MetaDriveAdapter, MetaDriveDependencies
from hermes.adapters.metadrive_challenge import ChallengeActorState
from hermes.comparison.compare import compare_artifacts
from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.evidence.verification import inspect_artifact, verify_artifact
from hermes.runtime.orchestrator import RunOperationalError, execute_metadrive_run
from hermes.shields.config import load_shield_config
from hermes.shields.deterministic import DeterministicSafetyShield

SIMULATOR_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"


class _Lane:
    def local_coordinates(self, position: list[float]) -> tuple[float, float]:
        return float(position[0]), float(position[1])


class _Navigation:
    route_completion = 0.0


class _Agent:
    def __init__(self) -> None:
        self.position = [5.0, 0.0]
        self.speed = 0.0
        self.lane = _Lane()
        self.navigation = _Navigation()


class _Env:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.agent = _Agent()
        self.steps = 0

    def reset(self, *, seed: int):
        assert seed == 7
        return [], {"route_completion": 0.0}

    def step(self, action):
        self.steps += 1
        self.agent.speed = self.steps * 0.3
        self.agent.position = [5.0 + self.steps * 0.03, 0.0]
        self.agent.navigation.route_completion = self.steps / 2
        terminal = self.steps == 2
        return [], 0.0, terminal, False, {
            "action": action,
            "route_completion": self.agent.navigation.route_completion,
            "crash": False,
            "out_of_road": False,
            "arrive_dest": terminal,
            "max_step": False,
        }

    def close(self) -> None:
        pass


class _IDM:
    def __init__(self, control_object, seed: int) -> None:
        del control_object, seed

    def act(self):
        return [0.0, 0.5]

    def destroy(self) -> None:
        pass


class _ChallengeEnv(_Env):
    def __init__(self, config: dict[str, Any], challenge: dict[str, Any]) -> None:
        super().__init__(config)
        self._challenge = challenge
        initial_gap = float(challenge["initial_gap_m"])
        actor_speed = float(challenge["actor_speed_mps"])
        self.hermes_challenge_state = ChallengeActorState(
            front_distance_m=initial_gap,
            front_relative_speed_mps=actor_speed,
            actor_longitudinal_m=initial_gap + 4.515,
            actor_lateral_offset_m=0.0,
            actor_speed_mps=actor_speed,
            phase="PRE_TRIGGER",
        )
        self._gap_m = initial_gap

    def step(self, action):
        self.actions = getattr(self, "actions", [])
        self.actions.append(action)
        sequence = self.steps
        self.steps += 1
        ego_speed = min(8.0, self.steps * 0.4)
        trigger = int(self._challenge["trigger_step"])
        actor_speed = (
            0.0
            if sequence >= trigger
            else float(self._challenge["actor_speed_mps"])
        )
        relative_speed = actor_speed - ego_speed
        self._gap_m = max(0.0, self._gap_m + relative_speed * 0.1)
        self.agent.speed = ego_speed
        self.agent.position[0] += ego_speed * 0.1
        terminal_step = trigger + 3
        self.agent.navigation.route_completion = self.steps / terminal_step
        terminal = self.steps == terminal_step
        phase = "BRAKING" if sequence >= trigger else "PRE_TRIGGER"
        self.hermes_challenge_state = ChallengeActorState(
            front_distance_m=self._gap_m,
            front_relative_speed_mps=relative_speed,
            actor_longitudinal_m=self._gap_m + 4.515,
            actor_lateral_offset_m=0.0,
            actor_speed_mps=actor_speed,
            phase=phase,
        )
        return [], 0.0, terminal, False, {
            "action": action,
            "route_completion": self.agent.navigation.route_completion,
            "crash": False,
            "out_of_road": False,
            "arrive_dest": terminal,
            "max_step": False,
        }


def test_metadrive_artifact_is_stored_only_replayable_without_simulator_import(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    dependencies = MetaDriveDependencies(
        environment_factory=_Env,
        idm_policy_factory=_IDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit=SIMULATOR_COMMIT,
        simulator_source=repository_root
        / "third_party"
        / "metadrive"
        / "metadrive"
        / "__init__.py",
    )

    outcome = execute_metadrive_run(
        scenario_path=repository_root / "scenarios" / "metadrive_nominal.yaml",
        gate_config_path=repository_root / "config" / "gates.phase2.yaml",
        seed=7,
        run_id="metadrive-stored-replay",
        artifact_root=artifacts,
        repository_root=repository_root,
        adapter_factory=lambda: MetaDriveAdapter(dependencies=dependencies),
    )

    original_import = builtins.__import__

    def no_metadrive_import(name, *args, **kwargs):
        if name == "metadrive" or name.startswith("metadrive."):
            raise AssertionError("stored verification attempted to import MetaDrive")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", no_metadrive_import)
    verification = verify_artifact(outcome.artifact_path)

    assert outcome.verdict is Verdict.PASS
    verdict_payload = json.loads(
        (outcome.artifact_path / "verdict.json").read_text(encoding="utf-8")
    )
    assert verdict_payload["gate_name"] == "phase2"
    assert verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert verification.verdict is Verdict.PASS
    manifest = (outcome.artifact_path / "manifest.json").read_text(encoding="utf-8")
    assert '"simulator_name":"metadrive"' in manifest
    assert '"simulator_version":"0.4.3"' in manifest
    assert f'"simulator_commit":"{SIMULATOR_COMMIT}"' in manifest


def test_metadrive_exception_closes_environment_and_publishes_nothing(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    created: list[_Env] = []
    destroyed: list[bool] = []

    class ExplodingEnv(_Env):
        closed = False

        def __init__(self, config):
            super().__init__(config)
            created.append(self)

        def step(self, action):
            del action
            raise RuntimeError("injected MetaDrive failure")

        def close(self) -> None:
            self.closed = True

    class TrackingIDM(_IDM):
        def destroy(self) -> None:
            destroyed.append(True)

    dependencies = MetaDriveDependencies(
        environment_factory=ExplodingEnv,
        idm_policy_factory=TrackingIDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit=SIMULATOR_COMMIT,
        simulator_source=repository_root
        / "third_party"
        / "metadrive"
        / "metadrive"
        / "__init__.py",
    )

    with pytest.raises(RunOperationalError, match="injected MetaDrive failure"):
        execute_metadrive_run(
            scenario_path=repository_root / "scenarios" / "metadrive_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase2.yaml",
            seed=7,
            run_id="metadrive-exception",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=lambda: MetaDriveAdapter(dependencies=dependencies),
        )

    assert created and created[0].closed is True
    assert destroyed == [True]
    assert list(artifacts.iterdir()) == []


def test_challenge_baseline_and_shield_publish_replayable_comparable_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "challenge-artifacts"
    artifacts.mkdir()

    def challenge_factory(config, challenge):
        assert challenge["kind"] == "lead_vehicle_hard_brake"
        return _ChallengeEnv(config, challenge)

    dependencies = MetaDriveDependencies(
        environment_factory=_Env,
        idm_policy_factory=_IDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit=SIMULATOR_COMMIT,
        simulator_source=repository_root
        / "third_party"
        / "metadrive"
        / "metadrive"
        / "__init__.py",
        challenge_environment_factory=challenge_factory,
    )
    common = {
        "scenario_path": (
            repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
        ),
        "gate_config_path": repository_root / "config" / "gates.phase2.yaml",
        "seed": 7,
        "artifact_root": artifacts,
        "repository_root": repository_root,
        "adapter_factory": lambda: MetaDriveAdapter(dependencies=dependencies),
    }
    baseline = execute_metadrive_run(run_id="challenge-baseline", **common)
    config = load_shield_config(repository_root / "config" / "shield.phase3.yaml")
    shielded = execute_metadrive_run(
        run_id="challenge-shielded",
        shield_factory=lambda: DeterministicSafetyShield(config),
        **common,
    )

    baseline_inspection = inspect_artifact(baseline.artifact_path)
    shielded_inspection = inspect_artifact(shielded.artifact_path)
    assert baseline_inspection.snapshot is not None
    assert shielded_inspection.snapshot is not None
    assert (
        verify_artifact(baseline.artifact_path).integrity
        is IntegrityStatus.INTERNALLY_CONSISTENT
    )
    assert (
        verify_artifact(shielded.artifact_path).integrity
        is IntegrityStatus.INTERNALLY_CONSISTENT
    )
    events = shielded_inspection.snapshot.events
    terminal_summary = events[-1].observation_summary
    terminal_ttc = terminal_summary["result_front_distance_m"] / -terminal_summary[
        "result_front_relative_speed_mps"
    ]
    assert shielded_inspection.snapshot.metrics.minimum_ttc_s.value == terminal_ttc
    assert terminal_ttc < 2.0
    override_events = [event for event in events if event.override_reasons]
    assert shielded_inspection.snapshot.metrics.shield_override_count == len(
        override_events
    )
    assert len(override_events) > 2
    assert any(
        "SPEED_CAP" in event.override_reasons for event in override_events
    )
    assert events[-1].candidate_action != (
        events[-1].executed_action
    )
    assert events[-1].override_reasons == (
        "TTC_BELOW_THRESHOLD",
        "SPEED_CAP",
    )
    comparison = compare_artifacts(
        baseline_inspection.snapshot,
        shielded_inspection.snapshot,
    )
    assert comparison.compatibility.comparable is True
