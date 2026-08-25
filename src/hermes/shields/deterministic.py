"""Deterministic simulation-only safety shield over supported Hermes observations."""

from __future__ import annotations

import math
import struct

from hermes.domain.models import Action, JsonValue, Observation, ScenarioDefinition
from hermes.shields.config import ShieldConfig

TTC_BELOW_THRESHOLD = "TTC_BELOW_THRESHOLD"
SPEED_CAP = "SPEED_CAP"
STALE_OBSERVATION = "STALE_OBSERVATION"
BOUNDARY_RISK = "BOUNDARY_RISK"
EMERGENCY_STOP = "EMERGENCY_STOP"
ACTUATION_DELAY_COMPENSATION = "ACTUATION_DELAY_COMPENSATION"
SUPPORTED_OVERRIDE_REASONS = (
    TTC_BELOW_THRESHOLD,
    SPEED_CAP,
    STALE_OBSERVATION,
    BOUNDARY_RISK,
    EMERGENCY_STOP,
    ACTUATION_DELAY_COMPENSATION,
)


def _binary32(value: float) -> float:
    return struct.unpack("!f", struct.pack("!f", value))[0]


def observation_ttc_s(observation: Observation) -> float | None:
    """Return TTC when a named front gap and a closing relative speed are available."""
    distance = observation.front_distance_m
    relative_speed = observation.front_relative_speed_mps
    if distance is None or relative_speed is None or relative_speed >= 0.0:
        return None
    closing_speed = -relative_speed
    if closing_speed <= 0.0:
        return None
    return distance / closing_speed


class DeterministicSafetyShield:
    """Apply explicit, replayable Phase 3 override rules in a stable order."""

    name = "deterministic"
    version = "1.0"

    def __init__(self, config: ShieldConfig) -> None:
        self._config = config
        self._scenario: ScenarioDefinition | None = None

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        return self._config.model_dump(mode="json")

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del seed
        if self._config.boundary_margin_m >= scenario.road.boundary_tolerance_m:
            raise ValueError(
                "shield boundary margin must be smaller than scenario boundary tolerance"
            )
        self._scenario = scenario

    def apply(
        self,
        observation: Observation,
        candidate: Action,
    ) -> tuple[Action, tuple[str, ...]]:
        if self._scenario is None:
            raise RuntimeError("deterministic shield must be reset before apply")

        reasons: list[str] = []
        ttc_s = observation_ttc_s(observation)
        if ttc_s is not None and ttc_s <= self._config.ttc_threshold_s:
            reasons.append(TTC_BELOW_THRESHOLD)
        if observation.vehicle_state.speed_mps > self._config.speed_cap_mps:
            reasons.append(SPEED_CAP)
        if observation.observation_age_s > self._config.max_observation_age_s:
            reasons.append(STALE_OBSERVATION)

        boundary_threshold = (
            self._scenario.road.boundary_tolerance_m - self._config.boundary_margin_m
        )
        boundary_risk = (
            abs(observation.vehicle_state.lateral_offset_m) >= boundary_threshold
        )
        if boundary_risk:
            reasons.append(BOUNDARY_RISK)
        if self._config.emergency_stop_active:
            reasons.append(EMERGENCY_STOP)
        if (
            ttc_s is not None
            and self._config.actuation_delay_compensation_s > 0.0
            and self._config.ttc_threshold_s
            < ttc_s
            <= self._config.ttc_threshold_s
            + self._config.actuation_delay_compensation_s
        ):
            reasons.append(ACTUATION_DELAY_COMPENSATION)

        if not reasons:
            return candidate, ()

        steering = candidate.steering
        if boundary_risk:
            steering = -math.copysign(
                self._config.boundary_steering_command,
                observation.vehicle_state.lateral_offset_m,
            )
        executed = Action(
            steering=_binary32(steering),
            throttle=0.0,
            brake=_binary32(self._config.full_brake_command),
        )
        if executed == candidate:
            return candidate, ()
        return executed, tuple(reasons)
