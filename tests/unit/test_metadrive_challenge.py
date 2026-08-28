from __future__ import annotations

import math
from typing import Any

import numpy as np
import pytest

from hermes.adapters.metadrive import MetaDriveAdapter, MetaDriveDependencies
from hermes.adapters.metadrive_challenge import (
    ChallengeActorState,
    ChallengeRuntimeTypes,
    create_challenge_environment,
    measure_challenge_actor,
)
from hermes.domain.models import Action, ScenarioDefinition


class _BoxObject:
    LENGTH = 4.0
    WIDTH = 2.0

    def __init__(
        self,
        *,
        position: tuple[float, float],
        heading_theta: float,
        velocity: tuple[float, float],
    ) -> None:
        self.position = list(position)
        self.heading_theta = heading_theta
        self.velocity = list(velocity)

    @property
    def heading(self) -> tuple[float, float]:
        return math.cos(self.heading_theta), math.sin(self.heading_theta)

    @property
    def speed(self) -> float:
        return math.hypot(*self.velocity)

    @property
    def bounding_box(self) -> list[tuple[float, float]]:
        forward = self.heading
        lateral = (-forward[1], forward[0])
        corners: list[tuple[float, float]] = []
        for longitudinal, sideways in (
            (self.LENGTH / 2.0, self.WIDTH / 2.0),
            (self.LENGTH / 2.0, -self.WIDTH / 2.0),
            (-self.LENGTH / 2.0, -self.WIDTH / 2.0),
            (-self.LENGTH / 2.0, self.WIDTH / 2.0),
        ):
            corners.append(
                (
                    self.position[0]
                    + longitudinal * forward[0]
                    + sideways * lateral[0],
                    self.position[1]
                    + longitudinal * forward[1]
                    + sideways * lateral[1],
                )
            )
        return corners


def test_measure_challenge_actor_uses_oriented_bumpers_and_relative_velocity() -> None:
    ego = _BoxObject(position=(10.0, 20.0), heading_theta=math.pi / 2, velocity=(0.0, 10.0))
    actor = _BoxObject(position=(10.0, 31.0), heading_theta=math.pi / 2, velocity=(0.0, 4.0))

    state = measure_challenge_actor(ego, actor, phase="BRAKING")

    assert state.front_distance_m == pytest.approx(7.0)
    assert state.front_relative_speed_mps == pytest.approx(-6.0)
    assert state.actor_longitudinal_m == pytest.approx(11.0)
    assert state.actor_lateral_offset_m == pytest.approx(0.0)
    assert state.actor_speed_mps == pytest.approx(4.0)
    assert state.phase == "BRAKING"


def test_measure_challenge_actor_marks_non_overlapping_actor_as_not_front() -> None:
    ego = _BoxObject(position=(0.0, 0.0), heading_theta=0.0, velocity=(8.0, 0.0))
    actor = _BoxObject(position=(10.0, 3.0), heading_theta=0.0, velocity=(4.0, 0.0))

    state = measure_challenge_actor(ego, actor, phase="PRE_TRIGGER")

    assert state.front_distance_m is None
    assert state.front_relative_speed_mps is None
    assert state.actor_longitudinal_m == pytest.approx(10.0)
    assert state.actor_lateral_offset_m == pytest.approx(3.0)


class _NumpyBoxObject(_BoxObject):
    def __init__(
        self,
        *,
        position: tuple[float, float],
        heading_theta: float,
        velocity: tuple[float, float],
    ) -> None:
        super().__init__(
            position=position,
            heading_theta=heading_theta,
            velocity=velocity,
        )
        self.position = np.asarray(self.position, dtype=np.float64)
        self.velocity = np.asarray(self.velocity, dtype=np.float64)

    @property
    def bounding_box(self) -> list[np.ndarray[Any, Any]]:
        return [np.asarray(corner, dtype=np.float64) for corner in super().bounding_box]


def test_measure_challenge_actor_accepts_metadrive_numpy_vectors() -> None:
    ego = _NumpyBoxObject(position=(0.0, 0.0), heading_theta=0.0, velocity=(8.0, 0.0))
    actor = _NumpyBoxObject(position=(10.0, 0.0), heading_theta=0.0, velocity=(4.0, 0.0))

    state = measure_challenge_actor(ego, actor, phase="PRE_TRIGGER")

    assert state.front_distance_m == pytest.approx(6.0)
    assert state.front_relative_speed_mps == pytest.approx(-4.0)


class _Lane:
    index = ("start", "end", 0)

    def position(self, longitudinal: float, lateral: float) -> list[float]:
        return [float(longitudinal), -float(lateral)]

    def local_coordinates(self, position: list[float]) -> tuple[float, float]:
        return float(position[0]), -float(position[1])

    def heading_theta_at(self, longitudinal: float) -> float:
        del longitudinal
        return 0.0

    def width_at(self, longitudinal: float) -> float:
        del longitudinal
        return 4.0


class _FakeActor(_BoxObject):
    def __init__(
        self,
        *,
        name: str,
        random_seed: int,
        vehicle_config: dict[str, Any],
    ) -> None:
        lane = _ENGINE.agent.lane
        position = lane.position(
            vehicle_config["spawn_longitude"], vehicle_config["spawn_lateral"]
        )
        super().__init__(
            position=(position[0], position[1]),
            heading_theta=lane.heading_theta_at(vehicle_config["spawn_longitude"]),
            velocity=tuple(vehicle_config["spawn_velocity"]),
        )
        self.name = self.id = name
        self.random_seed = random_seed
        self.actions: list[list[float] | None] = []
        self.after_step_count = 0
        self.static = False

    def before_step(self, action: list[float] | None = None) -> None:
        self.actions.append(action)

    def after_step(self) -> None:
        self.after_step_count += 1

    def set_position(self, position: list[float]) -> None:
        self.position = [float(position[0]), float(position[1])]

    def set_velocity(self, velocity: list[float], *, in_local_frame: bool = False) -> None:
        assert in_local_frame is False
        self.velocity = [float(velocity[0]), float(velocity[1])]

    def set_heading_theta(self, heading_theta: float) -> None:
        self.heading_theta = float(heading_theta)

    def set_static(self, flag: bool) -> None:
        self.static = flag


class _FakeAgent(_BoxObject):
    def __init__(self) -> None:
        super().__init__(position=(10.0, 0.0), heading_theta=0.0, velocity=(8.0, 0.0))
        self.lane = _Lane()
        self.lane_index = self.lane.index


class _FakeAgentManager:
    def __init__(self, agent: _FakeAgent) -> None:
        self.active_agents = {"default_agent": agent}


class _FakeEngine:
    def __init__(self) -> None:
        self.agent = _FakeAgent()
        self.agent_manager = _FakeAgentManager(self.agent)
        self.episode_step = 0
        self.managers: dict[str, Any] = {}
        self.objects: dict[str, Any] = {}

    def register_manager(self, name: str, manager: Any) -> None:
        self.managers[name] = manager
        setattr(self, name, manager)

    def get_objects(self, object_ids: list[str]) -> dict[str, Any]:
        return {object_id: self.objects[object_id] for object_id in object_ids}


_ENGINE = _FakeEngine()


class _FakeBaseManager:
    def __init__(self) -> None:
        self.engine = _ENGINE
        self.spawned_objects: dict[str, _FakeActor] = {}

    def spawn_object(self, object_class: type[_FakeActor], **kwargs: Any) -> _FakeActor:
        actor = object_class(**kwargs)
        self.spawned_objects[actor.id] = actor
        self.engine.objects[actor.id] = actor
        return actor

    def before_reset(self) -> None:
        self.spawned_objects = {}


class _FakeMetaDriveEnvironment:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.engine = _ENGINE
        self.setup_engine()

    def setup_engine(self) -> None:
        return None


def _runtime_types() -> ChallengeRuntimeTypes:
    return ChallengeRuntimeTypes(
        environment_type=_FakeMetaDriveEnvironment,
        manager_type=_FakeBaseManager,
        actor_type=_FakeActor,
    )


def _config() -> dict[str, Any]:
    return {
        "start_seed": 17,
        "physics_world_step_size": 0.02,
        "decision_repeat": 5,
    }


def _reset_runtime() -> None:
    _ENGINE.__init__()


def test_lead_actor_uses_fixed_seed_and_exact_hard_brake_schedule() -> None:
    _reset_runtime()
    environment = create_challenge_environment(
        _config(),
        {
            "kind": "lead_vehicle_hard_brake",
            "actor_control_mode": "metadrive_dynamic_action",
            "behavior_realism_claim": False,
            "initial_gap_m": 8.0,
            "actor_speed_mps": 4.0,
            "trigger_step": 2,
            "brake_duration_steps": 2,
            "brake_command": -1.0,
            "resume_throttle_command": 0.4,
        },
        runtime_types=_runtime_types(),
    )
    manager = environment.engine.hermes_challenge_manager

    manager.reset()
    with pytest.raises(RuntimeError, match="unavailable before reset"):
        _ = manager.actor
    manager.after_reset()
    actor = manager.actor

    assert actor.name == "hermes_challenge_actor"
    assert actor.random_seed == 17
    assert manager.snapshot.front_distance_m == pytest.approx(8.0)

    expected = (
        (1, [0.0, 0.0], "PRE_TRIGGER"),
        (2, [0.0, 0.0], "PRE_TRIGGER"),
        (3, [0.0, -1.0], "BRAKING"),
        (4, [0.0, -1.0], "BRAKING"),
        (5, [0.0, 0.4], "RECOVERY"),
    )
    for step, action, phase in expected:
        _ENGINE.episode_step = step
        manager.before_step()
        assert actor.actions[-1] == action
        assert manager.snapshot.phase == phase
        manager.after_step()

    assert actor.after_step_count == 5


def test_cut_in_actor_follows_labeled_smooth_kinematic_replay() -> None:
    _reset_runtime()
    environment = create_challenge_environment(
        _config(),
        {
            "kind": "cut_in_near_field",
            "actor_control_mode": "scripted_kinematic_replay",
            "behavior_realism_claim": False,
            "initial_gap_m": 8.0,
            "actor_speed_mps": 4.0,
            "initial_lane_delta": 1,
            "trigger_step": 2,
            "transition_steps": 2,
        },
        runtime_types=_runtime_types(),
    )
    manager = environment.engine.hermes_challenge_manager

    manager.reset()
    manager.after_reset()
    actor = manager.actor

    assert actor.static is True
    assert abs(manager.snapshot.actor_lateral_offset_m) == pytest.approx(4.0)
    assert manager.snapshot.front_distance_m is None

    _ENGINE.episode_step = 3
    manager.before_step()
    assert actor.actions[-1] is None
    assert abs(manager.snapshot.actor_lateral_offset_m) == pytest.approx(2.0)
    assert manager.snapshot.phase == "CUT_IN"

    _ENGINE.episode_step = 4
    manager.before_step()
    assert manager.snapshot.actor_lateral_offset_m == pytest.approx(0.0)
    assert manager.snapshot.front_distance_m is not None
    assert manager.snapshot.phase == "CUT_IN"

    _ENGINE.episode_step = 5
    manager.before_step()
    assert manager.snapshot.phase == "POST_CUT_IN"


def test_stationary_lead_actor_stays_static_in_one_present_phase() -> None:
    """Dispatching the stationary kind to cut-in replay would move it or require a speed."""
    _reset_runtime()
    environment = create_challenge_environment(
        _config(),
        {
            "kind": "stationary_lead",
            "actor_control_mode": "scripted_kinematic_replay",
            "behavior_realism_claim": False,
            "initial_gap_m": 8.0,
            "initial_lane_delta": 0,
        },
        runtime_types=_runtime_types(),
    )
    manager = environment.engine.hermes_challenge_manager

    manager.reset()
    manager.after_reset()
    actor = manager.actor
    initial_position = tuple(actor.position)

    assert actor.static is True
    assert actor.velocity == [0.0, 0.0]
    assert manager.snapshot.front_distance_m == pytest.approx(8.0)
    assert manager.snapshot.actor_speed_mps == 0.0
    assert manager.snapshot.phase == "PRESENT"

    for episode_step in (1, 10):
        _ENGINE.episode_step = episode_step
        manager.before_step()
        # MetaDrive's static body can retain a tiny post-physics velocity readback even
        # while its pose stays fixed. The scheduler must clear it before evidence capture.
        actor.velocity = [0.0056, 0.0]
        manager.after_step()
        assert tuple(actor.position) == initial_position
        assert actor.velocity == [0.0, 0.0]
        assert manager.snapshot.phase == "PRESENT"


def test_stationary_lead_runtime_rejects_a_dynamic_control_mode() -> None:
    with pytest.raises(ValueError, match="stationary challenge requires"):
        create_challenge_environment(
            _config(),
            {
                "kind": "stationary_lead",
                "actor_control_mode": "metadrive_dynamic_action",
                "behavior_realism_claim": False,
                "initial_gap_m": 8.0,
            },
            runtime_types=_runtime_types(),
        )


def test_manager_fails_if_named_challenge_actor_disappears() -> None:
    _reset_runtime()
    environment = create_challenge_environment(
        _config(),
        {
            "kind": "lead_vehicle_hard_brake",
            "actor_control_mode": "metadrive_dynamic_action",
            "behavior_realism_claim": False,
            "initial_gap_m": 8.0,
            "actor_speed_mps": 4.0,
            "trigger_step": 2,
            "brake_duration_steps": 2,
            "brake_command": -1.0,
            "resume_throttle_command": 0.4,
        },
        runtime_types=_runtime_types(),
    )
    manager = environment.engine.hermes_challenge_manager
    manager.reset()
    manager.after_reset()
    del _ENGINE.objects["hermes_challenge_actor"]
    _ENGINE.episode_step = 1

    with pytest.raises(RuntimeError, match="challenge actor disappeared"):
        manager.before_step()


class _AdapterNavigation:
    route_completion = 0.0


class _AdapterAgent(_FakeAgent):
    def __init__(self) -> None:
        super().__init__()
        self.position = [5.0, 0.0]
        self.velocity = [0.0, 0.0]
        self.navigation = _AdapterNavigation()


class _AdapterChallengeEnvironment:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.agent = _AdapterAgent()
        self.actions: list[list[float]] = []
        self.step_count = 0
        self.closed = False
        self.hermes_challenge_state = ChallengeActorState(
            front_distance_m=12.0,
            front_relative_speed_mps=-4.0,
            actor_longitudinal_m=16.0,
            actor_lateral_offset_m=0.0,
            actor_speed_mps=4.0,
            phase="PRE_TRIGGER",
        )

    def reset(self, *, seed: int) -> tuple[list[float], dict[str, Any]]:
        assert seed == self.config["start_seed"]
        return [], {"route_completion": 0.0}

    def step(
        self, action: list[float]
    ) -> tuple[list[float], float, bool, bool, dict[str, Any]]:
        self.actions.append(action)
        self.step_count += 1
        self.agent.position[0] += 0.2
        self.agent.velocity = [2.0, 0.0]
        self.agent.navigation.route_completion = self.step_count / 2
        self.hermes_challenge_state = ChallengeActorState(
            front_distance_m=8.0,
            front_relative_speed_mps=-6.0,
            actor_longitudinal_m=12.0,
            actor_lateral_offset_m=0.0,
            actor_speed_mps=4.0,
            phase="BRAKING",
        )
        return (
            [],
            0.0,
            False,
            False,
            {
                "action": action,
                "route_completion": self.agent.navigation.route_completion,
                "crash": False,
                "out_of_road": False,
                "arrive_dest": False,
                "max_step": False,
            },
        )

    def close(self) -> None:
        self.closed = True


class _AdapterIDM:
    def __init__(self, control_object: _AdapterAgent, seed: int) -> None:
        self.control_object = control_object
        self.seed = seed

    def act(self) -> list[float]:
        return [0.0, 0.0]

    def destroy(self) -> None:
        return None


def _lead_scenario(*, initial_gap_m: float = 12.0) -> ScenarioDefinition:
    return ScenarioDefinition.model_validate(
        {
            "schema_version": "2.0",
            "name": "lead_challenge_unit",
            "version": "1.0",
            "description": "Dependency-injected challenge adapter scenario.",
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
                "kind": "lead_vehicle_hard_brake",
                "actor_control_mode": "metadrive_dynamic_action",
                "behavior_realism_claim": False,
                "initial_gap_m": initial_gap_m,
                "actor_speed_mps": 4.0,
                "trigger_step": 1,
                "brake_duration_steps": 1,
                "brake_command": -1.0,
                "resume_throttle_command": 1.0,
            },
        }
    )


def test_adapter_selects_challenge_environment_and_surfaces_actual_actor_state() -> None:
    created: list[_AdapterChallengeEnvironment] = []
    challenge_payloads: list[dict[str, Any]] = []

    def fail_nominal_factory(config: dict[str, Any]) -> Any:
        del config
        raise AssertionError("challenge reset must not construct the nominal environment")

    def challenge_factory(
        config: dict[str, Any], challenge: dict[str, Any]
    ) -> _AdapterChallengeEnvironment:
        challenge_payloads.append(challenge)
        environment = _AdapterChallengeEnvironment(config)
        created.append(environment)
        return environment

    dependencies = MetaDriveDependencies(
        environment_factory=fail_nominal_factory,
        idm_policy_factory=_AdapterIDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
        simulator_source=__file__,
        challenge_environment_factory=challenge_factory,
    )
    scenario = _lead_scenario()
    adapter = MetaDriveAdapter(dependencies=dependencies)

    initial = adapter.reset(scenario, seed=7)

    assert adapter.version == "1.1"
    assert challenge_payloads == [scenario.challenge.model_dump(mode="json")]
    assert initial.front_distance_m == 12.0
    assert initial.front_relative_speed_mps == -4.0
    assert initial.challenge_actor_longitudinal_m == 16.0
    assert initial.challenge_actor_lateral_offset_m == 0.0
    assert initial.challenge_actor_speed_mps == 4.0
    assert initial.challenge_phase == "PRE_TRIGGER"
    evidence = adapter.evidence_config
    assert evidence["challenge"] == scenario.challenge.model_dump(mode="json")
    assert evidence["challenge_manager"] == {
        "environment_class": (
            "hermes.adapters.metadrive_challenge.HermesChallengeMetaDriveEnv"
        ),
        "manager_class": "hermes.adapters.metadrive_challenge.HermesChallengeManager",
        "manager_version": "1.0",
        "priority": 20,
        "actor_name": "hermes_challenge_actor",
        "actor_seed": 7,
    }
    assert evidence["signal_availability"]["front_distance_m"]["status"] == "AVAILABLE"
    assert evidence["signal_availability"]["front_relative_speed_mps"]["status"] == "AVAILABLE"

    result = adapter.step(Action(steering=0.0, throttle=0.0, brake=1.0))

    assert result.observation.front_distance_m == 8.0
    assert result.observation.front_relative_speed_mps == -6.0
    assert result.observation.challenge_actor_longitudinal_m == 12.0
    assert result.observation.challenge_phase == "BRAKING"
    adapter.close()
    assert created[0].closed is True


def test_adapter_versions_an_above_threshold_challenge_as_1_2() -> None:
    created: list[_AdapterChallengeEnvironment] = []

    def fail_nominal_factory(config: dict[str, Any]) -> Any:
        del config
        raise AssertionError("challenge reset must not construct the nominal environment")

    def challenge_factory(
        config: dict[str, Any], challenge: dict[str, Any]
    ) -> _AdapterChallengeEnvironment:
        del challenge
        environment = _AdapterChallengeEnvironment(config)
        created.append(environment)
        return environment

    dependencies = MetaDriveDependencies(
        environment_factory=fail_nominal_factory,
        idm_policy_factory=_AdapterIDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
        simulator_source=__file__,
        challenge_environment_factory=challenge_factory,
    )
    adapter = MetaDriveAdapter(dependencies=dependencies)

    adapter.reset(_lead_scenario(initial_gap_m=140.0), seed=7)

    assert adapter.version == "1.2"
    adapter.close()
    assert created[0].closed is True


def test_adapter_rejects_challenge_when_injected_runtime_has_no_challenge_factory() -> None:
    dependencies = MetaDriveDependencies(
        environment_factory=_AdapterChallengeEnvironment,
        idm_policy_factory=_AdapterIDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
        simulator_source=__file__,
    )
    adapter = MetaDriveAdapter(dependencies=dependencies)

    with pytest.raises(RuntimeError, match="challenge environment factory"):
        adapter.reset(_lead_scenario(), seed=7)
