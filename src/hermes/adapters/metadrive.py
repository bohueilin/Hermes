"""Lazy MetaDrive 0.4.3 adapter with explicit simulator provenance."""

from __future__ import annotations

import importlib
import math
import struct
import subprocess
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from importlib import metadata
from pathlib import Path
from typing import Any

from hermes.adapters.metadrive_challenge import (
    ACTOR_NAME,
    MANAGER_VERSION,
    ChallengeActorState,
    create_challenge_environment,
)
from hermes.adapters.metadrive_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_SOURCE,
    SUPPORTED_METADRIVE_VERSION,
)
from hermes.domain.enums import TerminationReason
from hermes.domain.models import (
    Action,
    JsonValue,
    Observation,
    ScenarioDefinition,
    StepResult,
    VehicleState,
)

_PHYSICS_STEP_S = 0.02


def _binary32(value: float) -> float:
    """Round once to the exact IEEE-754 precision accepted by MetaDrive's action Box."""
    return struct.unpack("!f", struct.pack("!f", value))[0]


class MetaDriveUnavailableError(RuntimeError):
    """The pinned MetaDrive runtime cannot be loaded or truthfully identified."""


@dataclass(frozen=True, slots=True)
class MetaDriveDependencies:
    """Injected runtime surface; production values are resolved lazily after selection."""

    environment_factory: Callable[[dict[str, Any]], Any]
    idm_policy_factory: Callable[[Any, int], Any]
    action_array: Callable[[Sequence[float]], Any]
    simulator_version: str
    simulator_commit: str
    simulator_source: Path
    challenge_environment_factory: Callable[
        [dict[str, Any], dict[str, Any]], Any
    ] | None = None


def _git(repository: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", *arguments],
            cwd=repository,
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return subprocess.CompletedProcess(["git", *arguments], 127, "", str(exc))


def _load_dependencies(repository_root: Path | None) -> MetaDriveDependencies:
    try:
        metadrive = importlib.import_module("metadrive")
        version_module = importlib.import_module("metadrive.version")
        idm_module = importlib.import_module("metadrive.policy.idm_policy")
        numpy = importlib.import_module("numpy")
    except Exception as exc:
        raise MetaDriveUnavailableError(
            "MetaDrive 0.4.3 is unavailable; activate the hermes-dev Conda environment "
            f"and verify the editable installation ({type(exc).__name__}: {exc})"
        ) from exc

    source_version = getattr(version_module, "VERSION", None)
    try:
        distribution_version = metadata.version("metadrive-simulator")
    except Exception as exc:
        raise MetaDriveUnavailableError(
            "MetaDrive distribution metadata is unavailable; repair the verified editable "
            f"installation in hermes-dev ({type(exc).__name__}: {exc})"
        ) from exc
    if source_version != SUPPORTED_METADRIVE_VERSION or distribution_version != source_version:
        raise MetaDriveUnavailableError(
            "MetaDrive version mismatch: expected source and distribution 0.4.3, observed "
            f"source={source_version!r}, distribution={distribution_version!r}"
        )

    module_file = getattr(metadrive, "__file__", None)
    if not module_file:
        raise MetaDriveUnavailableError("MetaDrive source path is unavailable")
    simulator_source = Path(module_file).expanduser().resolve()
    if repository_root is None:
        raise MetaDriveUnavailableError(
            "Hermes repository root is required to validate SIMULATOR_COMMIT provenance"
        )
    root = repository_root.expanduser().resolve()
    simulator_root = (root / "third_party" / "metadrive").resolve()
    try:
        simulator_source.relative_to(simulator_root)
    except ValueError as exc:
        raise MetaDriveUnavailableError(
            "Imported MetaDrive does not come from the verified third_party/metadrive source: "
            f"{simulator_source}"
        ) from exc

    try:
        pinned_commit = (root / "SIMULATOR_COMMIT").read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise MetaDriveUnavailableError(f"SIMULATOR_COMMIT is unavailable: {exc}") from exc
    commit_probe = _git(simulator_root, "rev-parse", "HEAD")
    status_probe = _git(simulator_root, "status", "--porcelain", "--untracked-files=all")
    if commit_probe.returncode != 0:
        raise MetaDriveUnavailableError(
            "MetaDrive source commit is unavailable: "
            + (commit_probe.stderr.strip() or "git rev-parse failed")
        )
    simulator_commit = commit_probe.stdout.strip()
    if simulator_commit != pinned_commit:
        raise MetaDriveUnavailableError(
            "MetaDrive source commit does not match SIMULATOR_COMMIT: "
            f"source={simulator_commit}, pinned={pinned_commit}"
        )
    if pinned_commit != SUPPORTED_METADRIVE_COMMIT:
        raise MetaDriveUnavailableError(
            "SIMULATOR_COMMIT is not supported by this Hermes build: "
            f"pinned={pinned_commit}, supported={SUPPORTED_METADRIVE_COMMIT}"
        )
    if status_probe.returncode != 0:
        raise MetaDriveUnavailableError(
            "MetaDrive source cleanliness is unavailable: "
            + (status_probe.stderr.strip() or "git status failed")
        )
    if status_probe.stdout.strip():
        raise MetaDriveUnavailableError(
            "MetaDrive source is dirty; restore third_party/metadrive before producing evidence"
        )

    return MetaDriveDependencies(
        environment_factory=metadrive.MetaDriveEnv,
        idm_policy_factory=idm_module.IDMPolicy,
        action_array=lambda values: numpy.asarray(values, dtype=numpy.float32),
        simulator_version=source_version,
        simulator_commit=simulator_commit,
        simulator_source=simulator_source,
        challenge_environment_factory=create_challenge_environment,
    )


class MetaDriveAdapter:
    """Translate the Hermes adapter contract to MetaDrive's headless Gym API."""

    name = "metadrive"
    version = "1.0"

    def __init__(
        self,
        *,
        repository_root: Path | None = None,
        dependencies: MetaDriveDependencies | None = None,
    ) -> None:
        self.version = "1.0"
        self._repository_root = repository_root
        self._dependencies = dependencies
        self._environment: Any | None = None
        self._idm_policy: Any | None = None
        self._scenario: ScenarioDefinition | None = None
        self._config: dict[str, Any] | None = None
        self._seed: int | None = None
        self._sequence = 0
        self._finished = False
        self._closed = False
        self._previous_speed_mps = 0.0
        self._previous_position: tuple[float, float] | None = None
        self._position_m = 0.0
        self._initial_route_raw = 0.0
        self._last_route_pct = 0.0
        self._collision_count = 0
        self._challenge_payload: dict[str, Any] | None = None

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        if self._config is None or self._dependencies is None:
            raise RuntimeError("MetaDrive adapter must be reset before evidence config is read")
        evidence: dict[str, JsonValue] = {
            "headless": True,
            "agent_policy": "metadrive.policy.env_input_policy.EnvInputPolicy",
            "simulator_name": "metadrive",
            "simulator_version": self._dependencies.simulator_version,
            "simulator_commit": self._dependencies.simulator_commit,
            "simulator_source": SUPPORTED_METADRIVE_SOURCE,
            "lateral_offset_mapping": {
                "source": "agent.lane.local_coordinates(agent.position)[1]",
                "mapping": "direct_meters",
                "reset_validation_abs_tolerance_m": 1e-6,
            },
            "route_progress_mapping": {
                "source": "info.route_completion_then_agent.navigation.route_completion",
                "normalization": "100*(raw-reset_raw)/(1-reset_raw)",
                "clamp_min_pct": 0.0,
                "clamp_max_pct": 100.0,
                "destination_override": False,
            },
            "signal_availability": {
                "front_distance_m": {
                    "status": "NOT_AVAILABLE",
                    "reason": "no stable named MetaDrive 0.4.3 info signal selected",
                },
                "front_relative_speed_mps": {
                    "status": "NOT_AVAILABLE",
                    "reason": "no stable named MetaDrive 0.4.3 info signal selected",
                },
            },
            "metadrive_config": self._config,
        }
        if self._challenge_payload is not None:
            assert self._seed is not None
            evidence["signal_availability"] = {
                "front_distance_m": {
                    "status": "AVAILABLE",
                    "source": "hermes_challenge_manager.actual_oriented_bounding_boxes",
                },
                "front_relative_speed_mps": {
                    "status": "AVAILABLE",
                    "source": "hermes_challenge_manager.actual_velocity_projection",
                },
            }
            evidence["challenge_manager"] = {
                "environment_class": (
                    "hermes.adapters.metadrive_challenge.HermesChallengeMetaDriveEnv"
                ),
                "manager_class": (
                    "hermes.adapters.metadrive_challenge.HermesChallengeManager"
                ),
                "manager_version": MANAGER_VERSION,
                "priority": 20,
                "actor_name": ACTOR_NAME,
                "actor_seed": self._seed,
            }
            evidence["challenge"] = self._challenge_payload
            evidence["front_signal_mapping"] = {
                "source": "HermesChallengeManager.actual_actor_ground_truth",
                "distance": (
                    "oriented_bounding_boxes_projected_into_ego_frame_"
                    "bumper_gap_when_laterally_overlapping"
                ),
                "relative_speed": (
                    "(actor_velocity-ego_velocity)_projected_onto_ego_heading"
                ),
                "no_lateral_overlap": None,
            }
        return evidence

    @property
    def simulator_name(self) -> str:
        return "metadrive"

    @property
    def simulator_version(self) -> str | None:
        return self._dependencies.simulator_version if self._dependencies is not None else None

    @property
    def simulator_commit(self) -> str | None:
        return self._dependencies.simulator_commit if self._dependencies is not None else None

    @property
    def idm_policy_for_testing(self) -> Any | None:
        """Expose only lifecycle state needed by dependency-injected unit tests."""
        return self._idm_policy

    def _decision_repeat(self, frequency_hz: int) -> int:
        desired = 1.0 / (frequency_hz * _PHYSICS_STEP_S)
        repeat = round(desired)
        if repeat < 1 or not math.isclose(desired, repeat, rel_tol=0.0, abs_tol=1e-12):
            raise ValueError(
                f"control frequency {frequency_hz} Hz has no exact MetaDrive decision interval "
                f"with physics_world_step_size={_PHYSICS_STEP_S}"
            )
        return repeat

    def _resolved_config(self, scenario: ScenarioDefinition, seed: int) -> dict[str, Any]:
        if not math.isclose(
            scenario.initial_state.speed_mps, 0.0, rel_tol=0.0, abs_tol=1e-12
        ):
            raise ValueError("Phase 2 MetaDrive scenarios require initial speed_mps: 0.0")
        decision_repeat = self._decision_repeat(scenario.control.frequency_hz)
        return {
            "use_render": False,
            "image_observation": False,
            "manual_control": False,
            "show_interface": False,
            "show_policy_mark": False,
            "map": "S",
            "start_seed": seed,
            "num_scenarios": 1,
            "random_agent_model": False,
            "random_spawn_lane_index": False,
            "traffic_density": 0.0,
            "random_traffic": False,
            "accident_prob": 0.0,
            "horizon": scenario.control.horizon_steps,
            "truncate_as_terminate": False,
            "physics_world_step_size": _PHYSICS_STEP_S,
            "decision_repeat": decision_repeat,
            "action_check": True,
            "log_level": 50,
            "vehicle_config": {
                "spawn_lateral": scenario.initial_state.lateral_offset_m,
                "show_navi_mark": False,
                "show_dest_mark": False,
                "show_lidar": False,
                "show_lane_line_detector": False,
                "show_side_detector": False,
                "lidar": {"num_lasers": 0, "distance": 0, "num_others": 0},
            },
        }

    def _agent_position(self) -> tuple[float, float]:
        assert self._environment is not None
        position = self._environment.agent.position
        if len(position) < 2:
            raise RuntimeError("MetaDrive agent position is not two-dimensional")
        x, y = float(position[0]), float(position[1])
        if not math.isfinite(x) or not math.isfinite(y):
            raise RuntimeError("MetaDrive agent position is non-finite")
        return x, y

    def _lateral_raw(self) -> float:
        assert self._environment is not None
        agent = self._environment.agent
        _, lateral = agent.lane.local_coordinates(agent.position)
        result = float(lateral)
        if not math.isfinite(result):
            raise RuntimeError("MetaDrive lane-relative lateral offset is non-finite")
        return result

    def _route_raw(self, info: dict[str, Any]) -> float | None:
        value = info.get("route_completion")
        if value is None and self._environment is not None:
            value = getattr(self._environment.agent.navigation, "route_completion", None)
        if value is None:
            return None
        result = float(value)
        if not math.isfinite(result) or not -1e-9 <= result <= 1.0 + 1e-9:
            raise RuntimeError(f"MetaDrive route completion is outside [0, 1]: {result!r}")
        return min(1.0, max(0.0, result))

    def _normalized_route_pct(self, raw_route: float) -> float:
        remaining = 1.0 - self._initial_route_raw
        if remaining <= 0.0:
            raise RuntimeError("MetaDrive reset route completion leaves no measurable route")
        normalized = (raw_route - self._initial_route_raw) / remaining * 100.0
        if not -1e-7 <= normalized <= 100.0 + 1e-7:
            raise RuntimeError(
                f"normalized MetaDrive route completion is outside [0, 100]: {normalized!r}"
            )
        return min(100.0, max(0.0, normalized))

    def _speed(self) -> float:
        assert self._environment is not None
        speed = float(self._environment.agent.speed)
        if not math.isfinite(speed) or speed < 0.0:
            raise RuntimeError(f"MetaDrive agent speed is invalid: {speed!r}")
        return speed

    def reset(self, scenario: ScenarioDefinition, seed: int) -> Observation:
        if self._closed:
            raise RuntimeError("MetaDrive adapter is closed")
        if self._environment is not None:
            raise RuntimeError("MetaDrive adapter supports one reset per instance")
        if scenario.adapter != self.name:
            raise ValueError("MetaDrive adapter requires a scenario with adapter: metadrive")

        config = self._resolved_config(scenario, seed)
        dependencies = self._dependencies or _load_dependencies(self._repository_root)
        self._dependencies = dependencies
        self._scenario = scenario
        self._seed = seed
        self._config = config
        if scenario.challenge is None:
            self.version = "1.0"
            self._challenge_payload = None
            environment_factory = dependencies.environment_factory
            self._environment = environment_factory(config)
        else:
            self.version = "1.1"
            self._challenge_payload = scenario.challenge.model_dump(mode="json")
            challenge_factory = dependencies.challenge_environment_factory
            if challenge_factory is None:
                raise RuntimeError(
                    "MetaDrive challenge environment factory is unavailable in the selected runtime"
                )
            self._environment = challenge_factory(config, self._challenge_payload)
        reset_result = self._environment.reset(seed=seed)
        if not isinstance(reset_result, tuple) or len(reset_result) != 2:
            raise RuntimeError("MetaDrive reset did not return the expected (observation, info)")
        _, info = reset_result
        if not isinstance(info, dict):
            raise RuntimeError("MetaDrive reset info is not a mapping")

        self._sequence = 0
        self._finished = False
        self._collision_count = 0
        self._previous_position = self._agent_position()
        self._position_m = 0.0
        initial_lateral = self._lateral_raw()
        if not math.isclose(
            initial_lateral,
            scenario.initial_state.lateral_offset_m,
            rel_tol=0.0,
            abs_tol=1e-6,
        ):
            raise RuntimeError(
                "MetaDrive reset lateral offset does not match scenario initial state: "
                f"observed={initial_lateral}, "
                f"expected={scenario.initial_state.lateral_offset_m}"
            )
        initial_route = self._route_raw(info)
        if initial_route is None:
            raise RuntimeError("MetaDrive reset route completion is unavailable")
        self._initial_route_raw = initial_route
        self._last_route_pct = 0.0
        observed_speed = self._speed()
        if not math.isclose(
            observed_speed,
            scenario.initial_state.speed_mps,
            rel_tol=0.0,
            abs_tol=1e-9,
        ):
            raise RuntimeError(
                "MetaDrive reset speed does not match scenario initial state: "
                f"observed={observed_speed}, expected={scenario.initial_state.speed_mps}"
            )
        self._previous_speed_mps = observed_speed
        state = VehicleState(
            position_m=0.0,
            speed_mps=scenario.initial_state.speed_mps,
            acceleration_mps2=0.0,
            lateral_offset_m=scenario.initial_state.lateral_offset_m,
            route_progress_pct=0.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        )
        return Observation(
            sequence=0,
            simulation_time_s=0.0,
            vehicle_state=state,
            **self._challenge_observation_fields(),
        )

    def _challenge_observation_fields(self) -> dict[str, Any]:
        if self._challenge_payload is None:
            return {}
        assert self._environment is not None
        challenge_state = getattr(self._environment, "hermes_challenge_state", None)
        if not isinstance(challenge_state, ChallengeActorState):
            raise RuntimeError(
                "MetaDrive challenge environment did not expose a typed actual-actor state"
            )
        return {
            "front_distance_m": challenge_state.front_distance_m,
            "front_relative_speed_mps": challenge_state.front_relative_speed_mps,
            "challenge_actor_longitudinal_m": challenge_state.actor_longitudinal_m,
            "challenge_actor_lateral_offset_m": challenge_state.actor_lateral_offset_m,
            "challenge_actor_speed_mps": challenge_state.actor_speed_mps,
            "challenge_phase": challenge_state.phase,
        }

    def propose_idm_action(self) -> Action:
        if self._environment is None or self._dependencies is None or self._seed is None:
            raise RuntimeError("MetaDrive adapter must be reset before IDM action")
        if self._finished:
            raise RuntimeError("MetaDrive episode has already terminated")
        if self._idm_policy is None:
            self._idm_policy = self._dependencies.idm_policy_factory(
                self._environment.agent, self._seed
            )
            assert self._scenario is not None
            target_speed_km_h = self._scenario.control.target_speed_mps * 3.6
            self._idm_policy.NORMAL_SPEED = target_speed_km_h
            self._idm_policy.target_speed = target_speed_km_h
            self._idm_policy.enable_lane_change = False
            self._idm_policy.disable_idm_deceleration = False
        raw = self._idm_policy.act()
        if not isinstance(raw, Sequence) or len(raw) != 2:
            raise RuntimeError("MetaDrive IDMPolicy returned an unsupported action")
        steering = float(raw[0])
        longitudinal = float(raw[1])
        if not math.isfinite(steering) or not math.isfinite(longitudinal):
            raise RuntimeError("MetaDrive IDMPolicy returned a non-finite action")
        steering = _binary32(min(1.0, max(-1.0, steering)))
        longitudinal = _binary32(min(1.0, max(-1.0, longitudinal)))
        return Action(
            steering=steering,
            throttle=max(0.0, longitudinal),
            brake=max(0.0, -longitudinal),
        )

    @staticmethod
    def _fact(info: dict[str, Any], key: str) -> bool:
        value = info.get(key)
        if not isinstance(value, bool):
            raise RuntimeError(f"MetaDrive info field {key!r} is unavailable or not boolean")
        return value

    @staticmethod
    def _accepted_action(info: dict[str, Any]) -> tuple[float, float]:
        value = info.get("raw_action", info.get("action"))
        if not isinstance(value, Sequence) or len(value) != 2:
            raise RuntimeError("MetaDrive accepted-action evidence is unavailable")
        return float(value[0]), float(value[1])

    def step(self, action: Action) -> StepResult:
        if self._closed:
            raise RuntimeError("MetaDrive adapter is closed")
        if self._environment is None or self._scenario is None or self._dependencies is None:
            raise RuntimeError("MetaDrive adapter must be reset before step")
        if self._finished:
            raise RuntimeError("MetaDrive episode has already terminated")

        requested = (action.steering, action.throttle - action.brake)
        native_action = self._dependencies.action_array(requested)
        step_result = self._environment.step(native_action)
        if not isinstance(step_result, tuple) or len(step_result) != 5:
            raise RuntimeError("MetaDrive step did not return the expected Gymnasium 5-tuple")
        _, _, terminated, truncated, info = step_result
        if not isinstance(terminated, bool) or not isinstance(truncated, bool):
            raise RuntimeError("MetaDrive termination flags are not boolean")
        if not isinstance(info, dict):
            raise RuntimeError("MetaDrive step info is not a mapping")
        accepted = self._accepted_action(info)
        if accepted != requested:
            raise RuntimeError(
                f"MetaDrive accepted action {accepted!r} differs from requested {requested!r}"
            )

        collision = self._fact(info, "crash")
        offroad = self._fact(info, "out_of_road")
        destination = self._fact(info, "arrive_dest")
        max_step = self._fact(info, "max_step")
        if collision:
            self._collision_count = 1
        if terminated and truncated:
            raise RuntimeError("MetaDrive returned simultaneous terminated and truncated flags")
        if (collision or offroad or destination) and not terminated:
            raise RuntimeError(
                "MetaDrive hard terminal fact was present without terminated=True"
            )
        if truncated != max_step:
            raise RuntimeError(
                "MetaDrive max_step fact does not match the truncated flag"
            )
        if collision:
            reason = TerminationReason.COLLISION
        elif offroad:
            reason = TerminationReason.OFF_ROAD
        elif destination:
            reason = TerminationReason.DESTINATION_REACHED
        elif truncated and max_step:
            reason = TerminationReason.HORIZON
        elif terminated or truncated:
            raise RuntimeError("MetaDrive terminated without a supported termination fact")
        else:
            reason = TerminationReason.NONE

        self._sequence += 1
        current_position = self._agent_position()
        assert self._previous_position is not None
        self._position_m += math.dist(self._previous_position, current_position)
        self._previous_position = current_position
        speed = self._speed()
        dt = 1.0 / self._scenario.control.frequency_hz
        acceleration = (speed - self._previous_speed_mps) / dt
        self._previous_speed_mps = speed
        lateral = self._lateral_raw()
        raw_route = self._route_raw(info)
        route_available = raw_route is not None
        if raw_route is not None:
            self._last_route_pct = self._normalized_route_pct(raw_route)
        state = VehicleState(
            position_m=self._position_m,
            speed_mps=speed,
            acceleration_mps2=acceleration,
            lateral_offset_m=lateral,
            route_progress_pct=self._last_route_pct,
            collision_count=self._collision_count,
            offroad=offroad,
            destination_reached=destination,
        )
        self._finished = terminated or truncated
        observation = Observation(
            sequence=self._sequence,
            simulation_time_s=self._sequence * dt,
            vehicle_state=state,
            **self._challenge_observation_fields(),
        )
        return StepResult(
            observation=observation,
            terminated=terminated,
            truncated=truncated,
            termination_reason=reason,
            raw_facts={
                "collision": collision,
                "collision_count": self._collision_count,
                "offroad": offroad,
                "destination_reached": destination,
                "route_progress_available": route_available,
                "route_progress_pct": self._last_route_pct if route_available else None,
            },
        )

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        errors: list[str] = []
        if self._idm_policy is not None:
            try:
                self._idm_policy.destroy()
            except Exception as exc:
                errors.append(f"IDM policy cleanup failed: {type(exc).__name__}: {exc}")
        if self._environment is not None:
            try:
                self._environment.close()
            except Exception as exc:
                errors.append(f"environment cleanup failed: {type(exc).__name__}: {exc}")
        if errors:
            raise RuntimeError("; ".join(errors))
