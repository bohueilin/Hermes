"""Pure, import-safe MetaDrive adapter evidence-configuration builder.

This module is the single source of the trace-bound MetaDrive ``evidence_config``
projection. Planning code uses it to predeclare per-variant adapter identity without
launching a simulator, and :mod:`hermes.adapters.metadrive` uses the identical builder
at runtime. Keeping one builder is what makes a predeclared adapter-config digest
equal to the digest a real run later records.

Hard boundaries:

- no MetaDrive import, environment construction, filesystem discovery, network, or
  subprocess occurs here;
- every input is an explicit argument, so no ambient environment value can change the
  result; and
- the returned mapping is a fresh structure the caller owns.
"""

from __future__ import annotations

import copy
import json
import math
from typing import Any, Final

from hermes.adapters.metadrive_challenge import ACTOR_NAME, MANAGER_VERSION
from hermes.domain.models import JsonValue, ScenarioDefinition
from hermes.evidence.canonical import canonical_json_bytes
from hermes.simulator_support import SUPPORTED_METADRIVE_SOURCE

PHYSICS_STEP_S: Final = 0.02
ADAPTER_EVIDENCE_CONFIG_PROJECTION: Final = "METADRIVE_ADAPTER_EVIDENCE_CONFIG_V1_1"
NOMINAL_ADAPTER_VERSION: Final = "1.0"
CHALLENGE_ADAPTER_VERSION: Final = "1.1"


def decision_repeat(frequency_hz: int) -> int:
    """Return the exact MetaDrive decision interval for one control frequency."""
    desired = 1.0 / (frequency_hz * PHYSICS_STEP_S)
    repeat = round(desired)
    if repeat < 1 or not math.isclose(desired, repeat, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError(
            f"control frequency {frequency_hz} Hz has no exact MetaDrive decision interval "
            f"with physics_world_step_size={PHYSICS_STEP_S}"
        )
    return repeat


def resolved_metadrive_environment_config(
    scenario: ScenarioDefinition,
    seed: int,
) -> dict[str, Any]:
    """Return the resolved MetaDrive environment configuration for one scenario/seed."""
    if scenario.adapter != "metadrive":
        raise ValueError("MetaDrive environment config requires a scenario with adapter: metadrive")
    if not math.isclose(scenario.initial_state.speed_mps, 0.0, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("Phase 2 MetaDrive scenarios require initial speed_mps: 0.0")
    repeat = decision_repeat(scenario.control.frequency_hz)
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
        "physics_world_step_size": PHYSICS_STEP_S,
        "decision_repeat": repeat,
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


def metadrive_adapter_version(scenario: ScenarioDefinition) -> str:
    """Return the adapter version a MetaDrive run records for one scenario."""
    if scenario.adapter != "metadrive":
        raise ValueError("MetaDrive adapter version requires a scenario with adapter: metadrive")
    return CHALLENGE_ADAPTER_VERSION if scenario.challenge is not None else NOMINAL_ADAPTER_VERSION


def preview_metadrive_adapter_evidence_config(
    scenario: ScenarioDefinition,
    seed: int,
    simulator_version: str,
    simulator_commit: str,
) -> dict[str, JsonValue]:
    """Build the exact trace-bound MetaDrive evidence configuration without a simulator.

    The result is byte-identical to what :class:`~hermes.adapters.metadrive.MetaDriveAdapter`
    records for the same scenario, seed, and resolved simulator identity.
    """
    if not isinstance(simulator_version, str) or not simulator_version:
        raise ValueError("simulator_version must be a non-empty string")
    if not isinstance(simulator_commit, str) or not simulator_commit:
        raise ValueError("simulator_commit must be a non-empty string")
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise ValueError("seed must be a strict integer")

    evidence: dict[str, JsonValue] = {
        "headless": True,
        "agent_policy": "metadrive.policy.env_input_policy.EnvInputPolicy",
        "simulator_name": "metadrive",
        "simulator_version": simulator_version,
        "simulator_commit": simulator_commit,
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
        "metadrive_config": resolved_metadrive_environment_config(scenario, seed),
    }
    if scenario.challenge is not None:
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
            "manager_class": "hermes.adapters.metadrive_challenge.HermesChallengeManager",
            "manager_version": MANAGER_VERSION,
            "priority": 20,
            "actor_name": ACTOR_NAME,
            "actor_seed": seed,
        }
        evidence["challenge"] = scenario.challenge.model_dump(mode="json")
        evidence["front_signal_mapping"] = {
            "source": "HermesChallengeManager.actual_actor_ground_truth",
            "distance": (
                "oriented_bounding_boxes_projected_into_ego_frame_"
                "bumper_gap_when_laterally_overlapping"
            ),
            "relative_speed": "(actor_velocity-ego_velocity)_projected_onto_ego_heading",
            "no_lateral_overlap": None,
        }
    return evidence


class ImmutableAdapterEvidenceConfig:
    """Canonical immutable bytes for one built adapter evidence configuration.

    Runtime builds this once before environment construction. Every later reader gets an
    independent structure decoded from the retained bytes, so neither the simulator nor a
    caller can change what the trace records.
    """

    __slots__ = ("_canonical_bytes",)

    def __init__(self, evidence_config: dict[str, JsonValue]) -> None:
        self._canonical_bytes = canonical_json_bytes(evidence_config)

    @property
    def canonical_bytes(self) -> bytes:
        return self._canonical_bytes

    def as_dict(self) -> dict[str, JsonValue]:
        """Return a fresh independent mapping decoded from the retained bytes."""
        return json.loads(self._canonical_bytes.decode("utf-8"))

    def member_clone(self, key: str) -> Any:
        """Return an independent mutable deep clone of one retained member."""
        decoded = self.as_dict()
        if key not in decoded:
            raise KeyError(f"retained adapter evidence config has no member {key!r}")
        return copy.deepcopy(decoded[key])
