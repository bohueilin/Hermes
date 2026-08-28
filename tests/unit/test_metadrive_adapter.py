from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any

import pytest

import hermes.adapters.metadrive as metadrive_module
from hermes.adapters.metadrive import (
    MetaDriveAdapter,
    MetaDriveDependencies,
    MetaDriveUnavailableError,
)
from hermes.adapters.metadrive_challenge import ChallengeActorState
from hermes.domain.enums import TerminationReason
from hermes.domain.models import (
    Action,
    ComponentContext,
    ExecutionContextV3,
    RunContextV3,
    ScenarioDefinition,
)
from hermes.evidence.artifacts import config_digest
from hermes.evidence.verification import _profile_errors
from hermes.gates.release import select_verifier_profile
from hermes.policies.metadrive_idm import MetaDriveIDMPolicy
from hermes.scenarios.loader import scenario_digest
from hermes.verifiers import verifier_identities_for_profile

SIMULATOR_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"


def _scenario(
    *, horizon_steps: int = 2, lateral_offset_m: float = 0.0
) -> ScenarioDefinition:
    return ScenarioDefinition.model_validate(
        {
            "schema_version": "1.0",
            "name": "metadrive_unit",
            "version": "1.0",
            "description": "Unit-only MetaDrive adapter contract scenario.",
            "adapter": "metadrive",
            "control": {
                "frequency_hz": 10,
                "horizon_steps": horizon_steps,
                "target_speed_mps": 8.0,
                "simulated_policy_latency_ms": 10.0,
            },
            "initial_state": {
                "speed_mps": 0.0,
                "lateral_offset_m": lateral_offset_m,
            },
            "road": {"destination_distance_m": 20.0, "boundary_tolerance_m": 1.5},
            "hazards": {},
        }
    )


def _challenge_scenario(*, initial_gap_m: float = 140.0) -> ScenarioDefinition:
    return ScenarioDefinition.model_validate(
        {
            "schema_version": "2.0",
            "name": "metadrive_long_challenge_unit",
            "version": "1.0",
            "description": "Unit-only long challenge geometry contract scenario.",
            "adapter": "metadrive",
            "control": {
                "frequency_hz": 10,
                "horizon_steps": 2,
                "target_speed_mps": 8.0,
                "simulated_policy_latency_ms": 10.0,
            },
            "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
            "road": {"destination_distance_m": 20.0, "boundary_tolerance_m": 1.5},
            "hazards": {},
            "challenge": {
                "kind": "stationary_lead",
                "actor_control_mode": "scripted_kinematic_replay",
                "behavior_realism_claim": False,
                "initial_gap_m": initial_gap_m,
                "initial_lane_delta": 0,
            },
        }
    )


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


class _Environment:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.agent = _Agent()
        self.agent.position[1] = config["vehicle_config"]["spawn_lateral"]
        self.actions: list[list[float]] = []
        self.closed = False
        self.step_count = 0

    def reset(self, *, seed: int) -> tuple[list[float], dict[str, Any]]:
        assert seed == self.config["start_seed"]
        return [], {"route_completion": 0.0}

    def step(
        self, action: list[float]
    ) -> tuple[list[float], float, bool, bool, dict[str, Any]]:
        self.actions.append(action)
        self.step_count += 1
        self.agent.speed = float(self.step_count * 2)
        self.agent.position = [
            5.0 + self.step_count * 0.2,
            self.agent.position[1] + 0.1,
        ]
        self.agent.navigation.route_completion = self.step_count / 2
        terminal = self.step_count == 2
        return (
            [],
            0.0,
            terminal,
            False,
            {
                "action": action,
                "route_completion": self.agent.navigation.route_completion,
                "crash": False,
                "out_of_road": False,
                "arrive_dest": terminal,
                "max_step": False,
            },
        )

    def close(self) -> None:
        self.closed = True


class _ChallengeEnvironment(_Environment):
    def __init__(self, config: dict[str, Any], initial_gap_m: float) -> None:
        super().__init__(config)
        gap = initial_gap_m
        self.hermes_challenge_state = ChallengeActorState(
            front_distance_m=gap,
            front_relative_speed_mps=0.0,
            actor_longitudinal_m=gap + 9.515,
            actor_lateral_offset_m=0.0,
            actor_speed_mps=0.0,
            phase="PRESENT",
        )


class _IDM:
    def __init__(self, control_object: _Agent, seed: int) -> None:
        self.control_object = control_object
        self.seed = seed
        self.destroyed = False

    def act(self) -> list[float]:
        return [0.1, -0.7]

    def destroy(self) -> None:
        self.destroyed = True


def _dependencies(created: list[_Environment]) -> MetaDriveDependencies:
    def environment_factory(config: dict[str, Any]) -> _Environment:
        environment = _Environment(config)
        created.append(environment)
        return environment

    return MetaDriveDependencies(
        environment_factory=environment_factory,
        idm_policy_factory=_IDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit=SIMULATOR_COMMIT,
        simulator_source=Path("/verified/metadrive/metadrive/__init__.py"),
    )


def _challenge_dependencies(created: list[_Environment]) -> MetaDriveDependencies:
    dependencies = _dependencies(created)

    def challenge_environment_factory(
        config: dict[str, Any], payload: dict[str, Any]
    ) -> _ChallengeEnvironment:
        environment = _ChallengeEnvironment(config, float(payload["initial_gap_m"]))
        created.append(environment)
        return environment

    return MetaDriveDependencies(
        environment_factory=dependencies.environment_factory,
        idm_policy_factory=dependencies.idm_policy_factory,
        action_array=dependencies.action_array,
        simulator_version=dependencies.simulator_version,
        simulator_commit=dependencies.simulator_commit,
        simulator_source=dependencies.simulator_source,
        challenge_environment_factory=challenge_environment_factory,
    )


def _verification_context(
    scenario: ScenarioDefinition,
    adapter: MetaDriveAdapter,
    *,
    version: str | None = None,
    config: dict[str, Any] | None = None,
) -> ExecutionContextV3:
    adapter_version = adapter.version if version is None else version
    adapter_config = adapter.evidence_config if config is None else config
    policy_config = {
        "backend": "metadrive.policy.idm_policy.IDMPolicy",
        "backend_version": "0.4.3",
        "deceleration_enabled": True,
        "known_limitation": "upstream IDM internal fallback is not structurally surfaced",
        "lane_change_enabled": False,
        "output_clipping": "componentwise_bounds_then_ieee754_binary32",
        "simulated_policy_latency_ms": scenario.control.simulated_policy_latency_ms,
        "target_speed_km_h": scenario.control.target_speed_mps * 3.6,
        "target_speed_mps": scenario.control.target_speed_mps,
    }
    shield_config: dict[str, object] = {}
    verifier_suite = verifier_identities_for_profile(
        select_verifier_profile(scenario), evidence_schema_version="3.0"
    )
    run_context = RunContextV3(
        scenario_digest=scenario_digest(scenario),
        gate_config_digest="0" * 64,
        adapter_name="metadrive",
        adapter_version=adapter_version,
        adapter_config_digest=config_digest(adapter_config),
        policy_name="metadrive-idm",
        policy_version="1.0",
        policy_config_digest=config_digest(policy_config),
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest=config_digest(shield_config),
        verifier_suite_digest=config_digest(
            [identity.model_dump(mode="json") for identity in verifier_suite]
        ),
        seed=7,
        control_frequency_hz=scenario.control.frequency_hz,
        horizon_steps=scenario.control.horizon_steps,
    )
    return ExecutionContextV3(
        run_context=run_context,
        adapter=ComponentContext(
            name="metadrive",
            version=adapter_version,
            config=adapter_config,
            config_digest=run_context.adapter_config_digest,
        ),
        policy=ComponentContext(
            name="metadrive-idm",
            version="1.0",
            config=policy_config,
            config_digest=run_context.policy_config_digest,
        ),
        shield=ComponentContext(
            name="noop",
            version="1.0",
            config=shield_config,
            config_digest=run_context.shield_config_digest,
        ),
        verifier_suite=verifier_suite,
    )


def test_adapter_translates_verified_headless_config_actions_and_facts() -> None:
    created: list[_Environment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))

    initial = adapter.reset(_scenario(), seed=7)

    assert initial.sequence == 0
    assert initial.simulation_time_s == 0.0
    assert initial.vehicle_state.speed_mps == 0.0
    config = created[0].config
    assert config["use_render"] is False
    assert config["image_observation"] is False
    assert config["manual_control"] is False
    assert config["map"] == "S"
    assert config["start_seed"] == 7
    assert config["num_scenarios"] == 1
    assert config["traffic_density"] == 0.0
    assert config["random_spawn_lane_index"] is False
    assert config["horizon"] == 2
    assert config["physics_world_step_size"] == 0.02
    assert config["decision_repeat"] == 5
    assert config["action_check"] is True

    first = adapter.step(Action(steering=0.5, throttle=0.7, brake=0.0))
    second = adapter.step(Action(steering=-0.5, throttle=0.0, brake=0.2))

    assert created[0].actions == [[0.5, 0.7], [-0.5, -0.2]]
    assert first.observation.sequence == 1
    assert first.observation.simulation_time_s == 0.1
    assert first.observation.vehicle_state.acceleration_mps2 == 20.0
    assert first.observation.vehicle_state.lateral_offset_m == pytest.approx(0.1)
    assert first.raw_facts.route_progress_pct == 50.0
    assert second.terminated is True
    assert second.truncated is False
    assert second.termination_reason is TerminationReason.DESTINATION_REACHED
    assert second.raw_facts.destination_reached is True

    adapter.close()
    assert created[0].closed is True


def test_adapter_derives_a_longer_map_for_an_above_threshold_challenge() -> None:
    created: list[_Environment] = []
    adapter = MetaDriveAdapter(dependencies=_challenge_dependencies(created))

    adapter.reset(_challenge_scenario(), seed=7)

    assert created[0].config["map"] == "SSS"
    adapter.close()


@pytest.mark.parametrize(
    ("initial_gap_m", "stored_version", "stored_map", "expected_error"),
    (
        pytest.param(115.0, "1.1", "S", None, id="1-legacy-long-gap-1.1-S"),
        pytest.param(100.485, "1.1", "S", None, id="2-carve-out-1.1-S"),
        pytest.param(140.0, "1.2", None, None, id="3-new-derived-1.2-SSS"),
        pytest.param(
            140.0,
            "1.1",
            "SSS",
            "execution-context.json MetaDrive adapter configuration is unsupported",
            id="4-crossed-1.1-SSS",
        ),
        pytest.param(
            140.0,
            "1.2",
            "S",
            "execution-context.json MetaDrive adapter configuration is unsupported",
            id="5-crossed-1.2-S",
        ),
        pytest.param(None, "1.0", None, None, id="6-non-challenge-1.0-S"),
        pytest.param(
            None,
            "1.1",
            "S",
            "execution-context.json contains an unsupported MetaDrive adapter version",
            id="7-non-challenge-1.1-S",
        ),
        pytest.param(
            None,
            "1.2",
            "S",
            "execution-context.json contains an unsupported MetaDrive adapter version",
            id="8-non-challenge-1.2-S",
        ),
        pytest.param(
            100.485,
            "1.2",
            "S",
            "execution-context.json contains an unsupported MetaDrive adapter version",
            id="9-carve-out-1.2-S",
        ),
        pytest.param(
            100.485,
            "1.0",
            "S",
            "execution-context.json contains an unsupported MetaDrive adapter version",
            id="10-carve-out-1.0-S",
        ),
        pytest.param(
            140.0,
            "1.3",
            "SSS",
            "execution-context.json contains an unsupported MetaDrive adapter version",
            id="11-unknown-1.3-SSS",
        ),
    ),
)
def test_stored_verification_enforces_versioned_metadrive_map_contract(
    initial_gap_m: float | None,
    stored_version: str,
    stored_map: str | None,
    expected_error: str | None,
) -> None:
    scenario = _scenario() if initial_gap_m is None else _challenge_scenario(
        initial_gap_m=initial_gap_m
    )
    created: list[_Environment] = []
    dependencies = (
        _dependencies(created)
        if initial_gap_m is None
        else _challenge_dependencies(created)
    )
    adapter = MetaDriveAdapter(dependencies=dependencies)
    adapter.reset(scenario, seed=7)
    config = json.loads(json.dumps(adapter.evidence_config))
    if stored_map is not None:
        config["metadrive_config"]["map"] = stored_map

    errors = _profile_errors(
        _verification_context(
            scenario,
            adapter,
            version=stored_version,
            config=config,
        ),
        scenario,
        None,
    )

    if expected_error is None:
        assert not any("MetaDrive adapter" in error for error in errors)
    else:
        assert expected_error in errors
        if expected_error.endswith("adapter configuration is unsupported"):
            assert (
                "execution-context.json contains an unsupported MetaDrive adapter version"
                not in errors
            )
    adapter.close()


def test_adapter_validates_and_preserves_nonzero_lateral_reset() -> None:
    created: list[_Environment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))

    initial = adapter.reset(_scenario(lateral_offset_m=0.25), seed=7)
    first = adapter.step(Action(steering=0.0, throttle=0.1, brake=0.0))

    assert initial.vehicle_state.lateral_offset_m == 0.25
    assert first.observation.vehicle_state.lateral_offset_m == pytest.approx(0.35)
    lateral_mapping = adapter.evidence_config["lateral_offset_mapping"]
    assert lateral_mapping["mapping"] == "direct_meters"
    adapter.close()


def test_adapter_rejects_lateral_reset_that_disagrees_with_scenario() -> None:
    created: list[_Environment] = []

    class MismatchedEnvironment(_Environment):
        def __init__(self, config: dict[str, Any]) -> None:
            super().__init__(config)
            self.agent.position[1] = 0.0

    dependencies = _dependencies(created)
    mismatched = MetaDriveDependencies(
        environment_factory=MismatchedEnvironment,
        idm_policy_factory=dependencies.idm_policy_factory,
        action_array=dependencies.action_array,
        simulator_version=dependencies.simulator_version,
        simulator_commit=dependencies.simulator_commit,
        simulator_source=dependencies.simulator_source,
    )
    adapter = MetaDriveAdapter(dependencies=mismatched)

    with pytest.raises(RuntimeError, match="reset lateral offset does not match"):
        adapter.reset(_scenario(lateral_offset_m=0.25), seed=7)

    adapter.close()


def test_metadrive_idm_wrapper_preserves_candidate_action_and_cleanup() -> None:
    created: list[_Environment] = []
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))
    scenario = _scenario()
    observation = adapter.reset(scenario, seed=7)
    policy = MetaDriveIDMPolicy(adapter)
    policy.reset(scenario, seed=7)

    candidate = policy.act(observation)

    expected_steering = struct.unpack("!f", struct.pack("!f", 0.1))[0]
    expected_longitudinal = struct.unpack("!f", struct.pack("!f", -0.7))[0]
    assert candidate.steering == expected_steering
    assert candidate.throttle == 0.0
    assert candidate.brake == -expected_longitudinal
    assert policy.simulated_latency_ms == 10.0
    assert policy.evidence_config["backend"] == "metadrive.policy.idm_policy.IDMPolicy"
    availability = adapter.evidence_config["signal_availability"]
    assert availability["front_distance_m"]["status"] == "NOT_AVAILABLE"
    route_mapping = adapter.evidence_config["route_progress_mapping"]
    assert route_mapping["destination_override"] is False
    adapter.step(candidate)
    assert created[0].actions == [[expected_steering, expected_longitudinal]]
    idm = adapter.idm_policy_for_testing
    assert pytest.approx(28.8) == idm.NORMAL_SPEED
    assert pytest.approx(28.8) == idm.target_speed
    assert idm.enable_lane_change is False
    assert idm.disable_idm_deceleration is False
    adapter.close()
    assert idm is not None
    assert idm.destroyed is True


def test_adapter_rejects_unsupported_frequency_before_environment_construction() -> None:
    created: list[_Environment] = []
    scenario = _scenario().model_copy(
        update={"control": _scenario().control.model_copy(update={"frequency_hz": 20})}
    )
    adapter = MetaDriveAdapter(dependencies=_dependencies(created))

    with pytest.raises(ValueError, match="exact MetaDrive decision interval"):
        adapter.reset(scenario, seed=7)

    assert created == []


def test_missing_metadrive_dependency_is_lazy_and_actionable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_import(name: str):
        raise ImportError(f"no module named {name}")

    monkeypatch.setattr(metadrive_module.importlib, "import_module", fail_import)
    adapter = MetaDriveAdapter(repository_root=Path("/unused"))

    with pytest.raises(
        MetaDriveUnavailableError,
        match="MetaDrive 0.4.3 is unavailable.*hermes-dev",
    ):
        adapter.reset(_scenario(), seed=7)


def test_adapter_close_is_idempotent_before_reset() -> None:
    adapter = MetaDriveAdapter(dependencies=_dependencies([]))

    adapter.close()
    adapter.close()


@pytest.mark.parametrize(
    ("facts", "terminated", "truncated", "expected_reason"),
    [
        (
            {"crash": True, "out_of_road": False, "arrive_dest": False, "max_step": False},
            True,
            False,
            TerminationReason.COLLISION,
        ),
        (
            {"crash": False, "out_of_road": True, "arrive_dest": False, "max_step": False},
            True,
            False,
            TerminationReason.OFF_ROAD,
        ),
        (
            {"crash": False, "out_of_road": False, "arrive_dest": False, "max_step": True},
            False,
            True,
            TerminationReason.HORIZON,
        ),
    ],
)
def test_adapter_maps_supported_terminal_facts(
    facts: dict[str, bool],
    terminated: bool,
    truncated: bool,
    expected_reason: TerminationReason,
) -> None:
    class TerminalEnvironment(_Environment):
        def step(self, action):
            self.actions.append(action)
            return [], 0.0, terminated, truncated, {
                "action": action,
                "route_completion": 0.0,
                **facts,
            }

    dependencies = MetaDriveDependencies(
        environment_factory=TerminalEnvironment,
        idm_policy_factory=_IDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit=SIMULATOR_COMMIT,
        simulator_source=Path("/verified/metadrive/metadrive/__init__.py"),
    )
    adapter = MetaDriveAdapter(dependencies=dependencies)
    adapter.reset(_scenario(horizon_steps=1), seed=7)

    result = adapter.step(Action(steering=0.0, throttle=0.0, brake=0.0))

    assert result.termination_reason is expected_reason
    assert result.raw_facts.collision is facts["crash"]
    assert result.raw_facts.offroad is facts["out_of_road"]
    adapter.close()
