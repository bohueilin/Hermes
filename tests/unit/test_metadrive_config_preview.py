"""Parity, purity, and immutability of the shared MetaDrive evidence-config builder."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from hermes.adapters.metadrive import MetaDriveAdapter, MetaDriveDependencies
from hermes.adapters.metadrive_challenge import ChallengeActorState
from hermes.adapters.metadrive_config import (
    ADAPTER_EVIDENCE_CONFIG_PROJECTION,
    ImmutableAdapterEvidenceConfig,
    metadrive_adapter_version,
    preview_metadrive_adapter_evidence_config,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.scenarios.loader import load_scenario
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_VERSION,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
LEAD_SCENARIO = REPOSITORY_ROOT / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
NOMINAL_SCENARIO = REPOSITORY_ROOT / "scenarios" / "metadrive_nominal.yaml"


class _Agent:
    position = (0.0, 0.0)
    speed = 0.0

    class _Lane:
        @staticmethod
        def local_coordinates(_position: Any) -> tuple[float, float]:
            return (0.0, 0.0)

    lane = _Lane()

    class _Navigation:
        route_completion = 0.0

    navigation = _Navigation()


class _MutatingEnvironment:
    """An environment that mutates every mapping it is handed."""

    def __init__(self, config: dict[str, Any], challenge: dict[str, Any] | None = None) -> None:
        self.config = config
        self.challenge = challenge
        config["map"] = "MUTATED"
        config["vehicle_config"]["spawn_lateral"] = 9999.0
        config["injected_by_environment"] = True
        if challenge is not None:
            challenge["initial_gap_m"] = -1.0
            challenge["injected_by_environment"] = True
        self.agent = _Agent()
        self.hermes_challenge_state = (
            None
            if challenge is None
            else ChallengeActorState(
                front_distance_m=12.0,
                front_relative_speed_mps=-4.0,
                actor_longitudinal_m=12.0,
                actor_lateral_offset_m=0.0,
                actor_speed_mps=8.0,
                phase="PRE_TRIGGER",
            )
        )

    def reset(self, seed: int) -> tuple[None, dict[str, Any]]:
        del seed
        return (None, {"route_completion": 0.0})

    def close(self) -> None:
        return None


def _dependencies(created: list[_MutatingEnvironment]) -> MetaDriveDependencies:
    def nominal_factory(config: dict[str, Any]) -> _MutatingEnvironment:
        environment = _MutatingEnvironment(config)
        created.append(environment)
        return environment

    def challenge_factory(
        config: dict[str, Any], challenge: dict[str, Any]
    ) -> _MutatingEnvironment:
        environment = _MutatingEnvironment(config, challenge)
        created.append(environment)
        return environment

    return MetaDriveDependencies(
        environment_factory=nominal_factory,
        idm_policy_factory=lambda control_object, seed: None,
        action_array=lambda values: list(values),
        simulator_version=SUPPORTED_METADRIVE_VERSION,
        simulator_commit=SUPPORTED_METADRIVE_COMMIT,
        simulator_source=Path("/verified/metadrive"),
        challenge_environment_factory=challenge_factory,
    )


def test_preview_matches_dependency_injected_runtime_for_challenge_scenario() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    created: list[_MutatingEnvironment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))
    adapter.reset(scenario, seed=7)

    expected = preview_metadrive_adapter_evidence_config(
        scenario,
        7,
        SUPPORTED_METADRIVE_VERSION,
        SUPPORTED_METADRIVE_COMMIT,
    )
    assert canonical_json_bytes(adapter.evidence_config) == canonical_json_bytes(expected)
    assert adapter.version == metadrive_adapter_version(scenario) == "1.1"


def test_preview_matches_dependency_injected_runtime_for_nominal_scenario() -> None:
    scenario = load_scenario(NOMINAL_SCENARIO)
    created: list[_MutatingEnvironment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))
    adapter.reset(scenario, seed=7)

    expected = preview_metadrive_adapter_evidence_config(
        scenario,
        7,
        SUPPORTED_METADRIVE_VERSION,
        SUPPORTED_METADRIVE_COMMIT,
    )
    assert canonical_json_bytes(adapter.evidence_config) == canonical_json_bytes(expected)
    assert adapter.version == metadrive_adapter_version(scenario) == "1.0"
    assert "challenge" not in adapter.evidence_config


def test_environment_mutation_cannot_change_recorded_evidence_config() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    created: list[_MutatingEnvironment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))
    adapter.reset(scenario, seed=7)

    environment = created[0]
    assert environment.config["map"] == "MUTATED"
    assert environment.challenge["initial_gap_m"] == -1.0

    recorded = adapter.evidence_config
    assert recorded["metadrive_config"]["map"] == "S"
    assert "injected_by_environment" not in recorded["metadrive_config"]
    assert recorded["challenge"]["initial_gap_m"] == scenario.challenge.initial_gap_m
    assert "injected_by_environment" not in recorded["challenge"]


def test_caller_mutation_cannot_change_recorded_evidence_config() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    created: list[_MutatingEnvironment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))
    adapter.reset(scenario, seed=7)

    first = adapter.evidence_config
    first["metadrive_config"]["map"] = "CALLER"
    first["challenge"]["trigger_step"] = -5
    first["brand_new_key"] = True

    second = adapter.evidence_config
    assert second["metadrive_config"]["map"] == "S"
    assert second["challenge"]["trigger_step"] == scenario.challenge.trigger_step
    assert "brand_new_key" not in second
    assert first is not second


def test_environment_receives_independent_clones_of_config_and_challenge() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    created: list[_MutatingEnvironment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))
    adapter.reset(scenario, seed=7)

    environment = created[0]
    assert environment.config is not environment.challenge
    recorded = adapter.evidence_config
    assert environment.config is not recorded["metadrive_config"]
    assert environment.challenge is not recorded["challenge"]


def test_immutable_snapshot_returns_fresh_independent_structures() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    snapshot = ImmutableAdapterEvidenceConfig(
        preview_metadrive_adapter_evidence_config(
            scenario, 7, SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT
        )
    )
    digest = sha256_hex(snapshot.canonical_bytes)

    first = snapshot.as_dict()
    first["metadrive_config"]["map"] = "CHANGED"
    clone = snapshot.member_clone("challenge")
    clone["initial_gap_m"] = -1.0

    assert snapshot.as_dict()["metadrive_config"]["map"] == "S"
    assert snapshot.as_dict()["challenge"]["initial_gap_m"] == scenario.challenge.initial_gap_m
    assert sha256_hex(snapshot.canonical_bytes) == digest
    with pytest.raises(KeyError):
        snapshot.member_clone("not_a_member")


def test_preview_is_deterministic_and_scenario_sensitive() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    first = preview_metadrive_adapter_evidence_config(
        scenario, 7, SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT
    )
    second = preview_metadrive_adapter_evidence_config(
        scenario, 7, SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT
    )
    assert canonical_json_bytes(first) == canonical_json_bytes(second)

    other = scenario.model_copy(
        update={
            "challenge": scenario.challenge.model_copy(update={"initial_gap_m": 12.0}),
        }
    )
    assert canonical_json_bytes(
        preview_metadrive_adapter_evidence_config(
            other, 7, SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT
        )
    ) != canonical_json_bytes(first)


def test_preview_rejects_unsupported_inputs() -> None:
    scenario = load_scenario(LEAD_SCENARIO)
    for bad in ("", None, 3):
        with pytest.raises((ValueError, TypeError)):
            preview_metadrive_adapter_evidence_config(
                scenario, 7, bad, SUPPORTED_METADRIVE_COMMIT
            )
    with pytest.raises(ValueError):
        preview_metadrive_adapter_evidence_config(
            scenario, True, SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT
        )


def test_projection_identity_is_frozen() -> None:
    assert ADAPTER_EVIDENCE_CONFIG_PROJECTION == "METADRIVE_ADAPTER_EVIDENCE_CONFIG_V1_1"


def test_preview_module_never_imports_metadrive_or_subprocess() -> None:
    program = (
        "import sys\n"
        "import hermes.adapters.metadrive_config as module\n"
        "from pathlib import Path\n"
        "from hermes.scenarios.loader import load_scenario\n"
        f"scenario = load_scenario(Path({str(LEAD_SCENARIO)!r}))\n"
        "module.preview_metadrive_adapter_evidence_config(scenario, 7, '0.4.3', 'a' * 40)\n"
        "loaded = sorted(name for name in sys.modules if name.split('.')[0] in "
        "{'metadrive', 'panda3d', 'subprocess'})\n"
        "print(','.join(loaded))\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", program],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        env={"PYTHONPATH": str(REPOSITORY_ROOT / "src"), "PYTHONDONTWRITEBYTECODE": "1"},
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == ""
