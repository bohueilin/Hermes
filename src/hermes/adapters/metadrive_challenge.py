"""Lazy, deterministic MetaDrive challenge actors for simulation-only scenarios."""

from __future__ import annotations

import importlib
import math
from collections.abc import Mapping
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

ACTOR_NAME = "hermes_challenge_actor"
MANAGER_VERSION = "1.0"


@dataclass(frozen=True, slots=True)
class ChallengeRuntimeTypes:
    """MetaDrive types resolved lazily, or dependency-injected by focused tests."""

    environment_type: type[Any]
    manager_type: type[Any]
    actor_type: type[Any]


@dataclass(frozen=True, slots=True)
class ChallengeActorState:
    """Actual actor geometry and velocity projected into the ego frame."""

    front_distance_m: float | None
    front_relative_speed_mps: float | None
    actor_longitudinal_m: float
    actor_lateral_offset_m: float
    actor_speed_mps: float
    phase: str


def _point(value: Any, *, label: str) -> tuple[float, float]:
    try:
        dimension = len(value)
    except TypeError as exc:
        raise RuntimeError(f"MetaDrive {label} is not two-dimensional") from exc
    if dimension < 2:
        raise RuntimeError(f"MetaDrive {label} is not two-dimensional")
    try:
        x, y = float(value[0]), float(value[1])
    except (TypeError, ValueError, IndexError) as exc:
        raise RuntimeError(f"MetaDrive {label} is not numeric") from exc
    if not math.isfinite(x) or not math.isfinite(y):
        raise RuntimeError(f"MetaDrive {label} is non-finite")
    return x, y


def _project(
    point: tuple[float, float],
    *,
    origin: tuple[float, float],
    forward: tuple[float, float],
    lateral: tuple[float, float],
) -> tuple[float, float]:
    delta_x = point[0] - origin[0]
    delta_y = point[1] - origin[1]
    return (
        delta_x * forward[0] + delta_y * forward[1],
        delta_x * lateral[0] + delta_y * lateral[1],
    )


def measure_challenge_actor(ego: Any, actor: Any, *, phase: str) -> ChallengeActorState:
    """Measure a named actor from actual oriented boxes and world-frame velocities."""

    origin = _point(ego.position, label="ego position")
    raw_heading = _point(ego.heading, label="ego heading")
    heading_norm = math.hypot(*raw_heading)
    if heading_norm <= 1e-12:
        raise RuntimeError("MetaDrive ego heading has zero magnitude")
    forward = (raw_heading[0] / heading_norm, raw_heading[1] / heading_norm)
    lateral = (-forward[1], forward[0])

    ego_box = tuple(
        _project(
            _point(corner, label="ego bounding-box corner"),
            origin=origin,
            forward=forward,
            lateral=lateral,
        )
        for corner in ego.bounding_box
    )
    actor_box = tuple(
        _project(
            _point(corner, label="challenge actor bounding-box corner"),
            origin=origin,
            forward=forward,
            lateral=lateral,
        )
        for corner in actor.bounding_box
    )
    if len(ego_box) != 4 or len(actor_box) != 4:
        raise RuntimeError("MetaDrive oriented vehicle bounding boxes must contain four corners")

    actor_center = _project(
        _point(actor.position, label="challenge actor position"),
        origin=origin,
        forward=forward,
        lateral=lateral,
    )
    ego_lateral_min = min(point[1] for point in ego_box)
    ego_lateral_max = max(point[1] for point in ego_box)
    actor_lateral_min = min(point[1] for point in actor_box)
    actor_lateral_max = max(point[1] for point in actor_box)
    laterally_overlapping = (
        actor_lateral_max >= ego_lateral_min and actor_lateral_min <= ego_lateral_max
    )

    ego_velocity = _point(ego.velocity, label="ego velocity")
    actor_velocity = _point(actor.velocity, label="challenge actor velocity")
    ego_longitudinal_speed = ego_velocity[0] * forward[0] + ego_velocity[1] * forward[1]
    actor_longitudinal_speed = (
        actor_velocity[0] * forward[0] + actor_velocity[1] * forward[1]
    )
    relative_speed = actor_longitudinal_speed - ego_longitudinal_speed

    front_distance: float | None = None
    front_relative_speed: float | None = None
    if actor_center[0] > 0.0 and laterally_overlapping:
        actor_rear = min(point[0] for point in actor_box)
        ego_front = max(point[0] for point in ego_box)
        front_distance = max(0.0, actor_rear - ego_front)
        front_relative_speed = relative_speed

    actor_speed = math.hypot(*actor_velocity)
    return ChallengeActorState(
        front_distance_m=front_distance,
        front_relative_speed_mps=front_relative_speed,
        actor_longitudinal_m=actor_center[0],
        actor_lateral_offset_m=actor_center[1],
        actor_speed_mps=actor_speed,
        phase=phase,
    )


def _load_runtime_types() -> ChallengeRuntimeTypes:
    environment_module = importlib.import_module("metadrive.envs.metadrive_env")
    manager_module = importlib.import_module("metadrive.manager.base_manager")
    vehicle_module = importlib.import_module("metadrive.component.vehicle.vehicle_type")
    return ChallengeRuntimeTypes(
        environment_type=environment_module.MetaDriveEnv,
        manager_type=manager_module.BaseManager,
        actor_type=vehicle_module.TrafficDefaultVehicle,
    )


def _actor_length(actor_type: type[Any]) -> float:
    value = getattr(actor_type, "DEFAULT_LENGTH", getattr(actor_type, "LENGTH", None))
    if not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise RuntimeError("MetaDrive challenge actor length is unavailable")
    return float(value)


def _validated_challenge(challenge: Mapping[str, Any]) -> dict[str, Any]:
    payload = dict(challenge)
    kind = payload.get("kind")
    if kind == "lead_vehicle_hard_brake":
        if payload.get("actor_control_mode") != "metadrive_dynamic_action":
            raise ValueError("lead challenge requires actor_control_mode metadrive_dynamic_action")
    elif kind == "cut_in_near_field":
        if payload.get("actor_control_mode") != "scripted_kinematic_replay":
            raise ValueError(
                "cut-in challenge requires actor_control_mode scripted_kinematic_replay"
            )
    elif kind == "stationary_lead":
        if payload.get("actor_control_mode") != "scripted_kinematic_replay":
            raise ValueError(
                "stationary challenge requires actor_control_mode scripted_kinematic_replay"
            )
    elif kind == "steady_lead":
        if payload.get("actor_control_mode") != "scripted_kinematic_replay":
            raise ValueError(
                "steady challenge requires actor_control_mode scripted_kinematic_replay"
            )
    elif kind == "lead_decelerates":
        if payload.get("actor_control_mode") != "scripted_kinematic_replay":
            raise ValueError(
                "decelerating challenge requires actor_control_mode "
                "scripted_kinematic_replay"
            )
    else:
        raise ValueError(f"unsupported MetaDrive challenge kind: {kind!r}")
    if payload.get("behavior_realism_claim") is not False:
        raise ValueError("MetaDrive challenge behavior_realism_claim must be false")
    return payload


def create_challenge_environment(
    config: dict[str, Any],
    challenge: Mapping[str, Any],
    *,
    runtime_types: ChallengeRuntimeTypes | None = None,
) -> Any:
    """Construct the challenge-only MetaDrive subclass without eager simulator imports."""

    types = runtime_types or _load_runtime_types()
    challenge_payload = _validated_challenge(challenge)
    actor_type = types.actor_type
    base_manager_type = types.manager_type
    environment_type = types.environment_type

    class HermesChallengeManager(base_manager_type):
        PRIORITY = 20

        def __init__(self) -> None:
            super().__init__()
            self._challenge = challenge_payload
            self._actor: Any | None = None
            self._ego: Any | None = None
            self._reference_lane: Any | None = None
            self._initial_actor_longitudinal = 0.0
            self._lane_width = 0.0
            self._phase = "PRE_TRIGGER"
            self._snapshot: ChallengeActorState | None = None
            self._commanded_this_step = False
            self._steady_velocity: list[float] | None = None
            self._decelerating_velocity: list[float] | None = None

        @property
        def actor(self) -> Any:
            if self._actor is None:
                raise RuntimeError("MetaDrive challenge actor is unavailable before reset")
            try:
                active = self.engine.get_objects([self._actor.id])
            except KeyError as exc:
                raise RuntimeError(
                    "MetaDrive challenge actor disappeared during the episode"
                ) from exc
            if active.get(self._actor.id) is not self._actor:
                raise RuntimeError("MetaDrive challenge actor disappeared during the episode")
            return self._actor

        @property
        def snapshot(self) -> ChallengeActorState:
            if self._snapshot is None:
                raise RuntimeError("MetaDrive challenge state is unavailable before reset")
            return self._snapshot

        def before_reset(self) -> Any:
            result = super().before_reset()
            self._actor = None
            self._ego = None
            self._reference_lane = None
            self._snapshot = None
            self._commanded_this_step = False
            return result

        def _measure(self) -> None:
            assert self._ego is not None
            self._snapshot = measure_challenge_actor(
                self._ego,
                self.actor,
                phase=self._phase,
            )

        def reset(self) -> None:
            self._actor = None
            self._ego = None
            self._reference_lane = None
            self._snapshot = None
            self._phase = "PRE_TRIGGER"
            self._commanded_this_step = False
            self._steady_velocity = None
            self._decelerating_velocity = None

        def after_reset(self) -> None:
            agents = tuple(self.engine.agent_manager.active_agents.values())
            if len(agents) != 1:
                raise RuntimeError(
                    "Hermes challenge manager requires exactly one MetaDrive ego agent"
                )
            self._ego = agents[0]
            self._reference_lane = self._ego.lane
            ego_longitudinal, _ = self._reference_lane.local_coordinates(self._ego.position)
            gap = float(self._challenge["initial_gap_m"])
            actor_center = (
                float(ego_longitudinal)
                + float(self._ego.LENGTH) / 2.0
                + gap
                + _actor_length(actor_type) / 2.0
            )
            self._initial_actor_longitudinal = actor_center
            self._lane_width = float(self._reference_lane.width_at(actor_center))
            initial_lane_delta = int(self._challenge.get("initial_lane_delta", 0))
            spawn_lateral = initial_lane_delta * self._lane_width
            heading = float(self._reference_lane.heading_theta_at(actor_center))
            actor_speed = (
                0.0
                if self._challenge["kind"] == "stationary_lead"
                else float(self._challenge["actor_speed_mps"])
            )
            velocity = [math.cos(heading) * actor_speed, math.sin(heading) * actor_speed]
            if self._challenge["kind"] == "steady_lead":
                self._steady_velocity = list(velocity)
            elif self._challenge["kind"] == "lead_decelerates":
                self._decelerating_velocity = list(velocity)
            self._actor = self.spawn_object(
                actor_type,
                name=ACTOR_NAME,
                random_seed=int(config["start_seed"]),
                vehicle_config={
                    "spawn_lane_index": self._ego.lane_index,
                    "spawn_longitude": actor_center,
                    "spawn_lateral": spawn_lateral,
                    "spawn_velocity": velocity,
                    "spawn_velocity_car_frame": False,
                    "show_navi_mark": False,
                    "show_dest_mark": False,
                    "show_lidar": False,
                    "show_lane_line_detector": False,
                    "show_side_detector": False,
                    "lidar": {"num_lasers": 0, "distance": 0, "num_others": 0},
                },
            )
            if self._challenge["kind"] in {
                "cut_in_near_field",
                "stationary_lead",
                "steady_lead",
                "lead_decelerates",
            }:
                self._actor.set_static(True)
            if self._challenge["kind"] == "stationary_lead":
                self._phase = "PRESENT"
            elif self._challenge["kind"] == "steady_lead":
                self._phase = "STEADY"
            elif self._challenge["kind"] == "lead_decelerates":
                self._phase = (
                    "DECELERATING"
                    if int(self._challenge["decel_start_step"]) == 0
                    else "STEADY"
                )
            else:
                self._phase = "PRE_TRIGGER"
            self._measure()

        def _before_lead_step(self, step: int) -> None:
            trigger = int(self._challenge["trigger_step"])
            braking_end = trigger + int(self._challenge["brake_duration_steps"])
            if step < trigger:
                action = [0.0, 0.0]
                self._phase = "PRE_TRIGGER"
            elif step < braking_end:
                action = [0.0, float(self._challenge["brake_command"])]
                self._phase = "BRAKING"
            else:
                action = [0.0, float(self._challenge["resume_throttle_command"])]
                self._phase = "RECOVERY"
            self.actor.before_step(action)

        def _before_cut_in_step(self, step: int) -> None:
            assert self._reference_lane is not None
            trigger = int(self._challenge["trigger_step"])
            transition_steps = int(self._challenge["transition_steps"])
            if step < trigger:
                fraction = 0.0
                self._phase = "PRE_TRIGGER"
            else:
                linear_fraction = min(1.0, (step - trigger + 1) / transition_steps)
                fraction = linear_fraction * linear_fraction * (3.0 - 2.0 * linear_fraction)
                self._phase = "CUT_IN" if step < trigger + transition_steps else "POST_CUT_IN"
            initial_lane_delta = int(self._challenge["initial_lane_delta"])
            lateral = initial_lane_delta * self._lane_width * (1.0 - fraction)
            dt = float(config["physics_world_step_size"]) * int(config["decision_repeat"])
            actor_speed = float(self._challenge["actor_speed_mps"])
            longitudinal = self._initial_actor_longitudinal + actor_speed * step * dt
            heading = float(self._reference_lane.heading_theta_at(longitudinal))
            self.actor.before_step(None)
            self.actor.set_position(self._reference_lane.position(longitudinal, lateral))
            self.actor.set_velocity(
                [math.cos(heading) * actor_speed, math.sin(heading) * actor_speed],
                in_local_frame=False,
            )
            self.actor.set_heading_theta(heading)
            self.actor.set_static(True)

        def _before_stationary_step(self) -> None:
            self.actor.before_step(None)
            self.actor.set_velocity([0.0, 0.0], in_local_frame=False)
            self.actor.set_static(True)
            self._phase = "PRESENT"

        def _before_steady_step(self, step: int) -> None:
            assert self._reference_lane is not None
            initial_lane_delta = int(self._challenge["initial_lane_delta"])
            lateral = initial_lane_delta * self._lane_width
            dt = float(config["physics_world_step_size"]) * int(config["decision_repeat"])
            actor_speed = float(self._challenge["actor_speed_mps"])
            longitudinal = self._initial_actor_longitudinal + actor_speed * step * dt
            heading = float(self._reference_lane.heading_theta_at(longitudinal))
            velocity = [math.cos(heading) * actor_speed, math.sin(heading) * actor_speed]
            self._steady_velocity = velocity
            self.actor.before_step(None)
            self.actor.set_position(self._reference_lane.position(longitudinal, lateral))
            self.actor.set_velocity(velocity, in_local_frame=False)
            self.actor.set_heading_theta(heading)
            self.actor.set_static(True)
            self._phase = "STEADY"

        def _before_decelerating_step(self, step: int) -> None:
            assert self._reference_lane is not None
            dt = float(config["physics_world_step_size"]) * int(
                config["decision_repeat"]
            )
            actor_speed = float(self._challenge["actor_speed_mps"])
            terminal_speed = float(self._challenge["terminal_speed_mps"])
            deceleration = float(self._challenge["deceleration_mps2"])
            start_step = int(self._challenge["decel_start_step"])
            start_time = start_step * dt
            terminal_elapsed = (actor_speed - terminal_speed) / deceleration
            exact_dt = Fraction(str(config["physics_world_step_size"])) * int(
                config["decision_repeat"]
            )
            exact_intervals = (
                Fraction(str(self._challenge["actor_speed_mps"]))
                - Fraction(str(self._challenge["terminal_speed_mps"]))
            ) / (Fraction(str(self._challenge["deceleration_mps2"])) * exact_dt)
            terminal_intervals = (
                exact_intervals.numerator + exact_intervals.denominator - 1
            ) // exact_intervals.denominator

            input_time = step * dt
            input_elapsed = max(0.0, input_time - start_time)
            active_elapsed = min(input_elapsed, terminal_elapsed)
            input_speed = max(
                terminal_speed,
                actor_speed - deceleration * input_elapsed,
            )
            displacement = (
                actor_speed * min(input_time, start_time)
                + actor_speed * active_elapsed
                - 0.5 * deceleration * active_elapsed * active_elapsed
                + terminal_speed * max(0.0, input_elapsed - terminal_elapsed)
            )
            longitudinal = self._initial_actor_longitudinal + displacement
            heading = float(self._reference_lane.heading_theta_at(longitudinal))
            input_velocity = [
                math.cos(heading) * input_speed,
                math.sin(heading) * input_speed,
            ]

            result_time = (step + 1) * dt
            result_elapsed = max(0.0, result_time - start_time)
            result_speed = max(
                terminal_speed,
                actor_speed - deceleration * result_elapsed,
            )
            self._decelerating_velocity = [
                math.cos(heading) * result_speed,
                math.sin(heading) * result_speed,
            ]
            result_sample = step + 1
            if start_step <= result_sample < start_step + terminal_intervals:
                self._phase = "DECELERATING"
            else:
                self._phase = "STEADY"

            self.actor.before_step(None)
            self.actor.set_position(self._reference_lane.position(longitudinal, 0.0))
            self.actor.set_velocity(input_velocity, in_local_frame=False)
            self.actor.set_heading_theta(heading)
            self.actor.set_static(True)

        def before_step(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
            del args, kwargs
            step = int(self.engine.episode_step) - 1
            if step < 0:
                raise RuntimeError("MetaDrive challenge manager observed a negative trace sequence")
            if self._challenge["kind"] == "lead_vehicle_hard_brake":
                self._before_lead_step(step)
            elif self._challenge["kind"] == "cut_in_near_field":
                self._before_cut_in_step(step)
            elif self._challenge["kind"] == "stationary_lead":
                self._before_stationary_step()
            elif self._challenge["kind"] == "steady_lead":
                self._before_steady_step(step)
            elif self._challenge["kind"] == "lead_decelerates":
                self._before_decelerating_step(step)
            else:
                raise RuntimeError(
                    f"unsupported MetaDrive challenge kind: {self._challenge['kind']!r}"
                )
            self._commanded_this_step = True
            self._measure()
            return {}

        def after_step(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
            del args, kwargs
            if self._actor is not None and self._commanded_this_step:
                self.actor.after_step()
                self._commanded_this_step = False
            if self._actor is not None:
                if self._challenge["kind"] == "stationary_lead":
                    self.actor.set_velocity([0.0, 0.0], in_local_frame=False)
                    self.actor.set_static(True)
                elif self._challenge["kind"] == "steady_lead":
                    assert self._steady_velocity is not None
                    self.actor.set_velocity(
                        list(self._steady_velocity), in_local_frame=False
                    )
                    self.actor.set_static(True)
                elif self._challenge["kind"] == "lead_decelerates":
                    assert self._decelerating_velocity is not None
                    self.actor.set_velocity(
                        list(self._decelerating_velocity), in_local_frame=False
                    )
                    self.actor.set_static(True)
                self._measure()
            return {}

    class HermesChallengeMetaDriveEnv(environment_type):
        def setup_engine(self) -> None:
            super().setup_engine()
            self.engine.register_manager(
                "hermes_challenge_manager",
                HermesChallengeManager(),
            )

        @property
        def hermes_challenge_state(self) -> ChallengeActorState:
            return self.engine.hermes_challenge_manager.snapshot

    HermesChallengeManager.__module__ = __name__
    HermesChallengeManager.__qualname__ = "HermesChallengeManager"
    HermesChallengeMetaDriveEnv.__module__ = __name__
    HermesChallengeMetaDriveEnv.__qualname__ = "HermesChallengeMetaDriveEnv"
    return HermesChallengeMetaDriveEnv(config)
