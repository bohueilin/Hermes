from __future__ import annotations

import builtins
import json
from pathlib import Path
from typing import Any

import pytest

from hermes.adapters.metadrive import MetaDriveAdapter, MetaDriveDependencies
from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.evidence.verification import verify_artifact
from hermes.runtime.orchestrator import RunOperationalError, execute_metadrive_run

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
