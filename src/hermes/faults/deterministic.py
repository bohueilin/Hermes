"""Deterministic, trace-replayable observation and action fault transforms."""

from __future__ import annotations

import hashlib
import json
import math

from pydantic import Field

from hermes.domain.models import (
    Action,
    FaultConfig,
    FiniteFloat,
    HermesModel,
    Observation,
    ScenarioDefinition,
)

OBSERVATION_FAULT_REASONS = (
    "OBSERVATION_DELAY",
    "OBSERVATION_DELAY_WARMUP",
    "OBSERVATION_FROZEN",
    "OBSERVATION_DROPOUT_HOLD_LAST",
    "OBSERVATION_NOISE",
)
ACTION_FAULT_REASONS = (
    "CONTROL_DELAY",
    "CONTROL_DELAY_FILL",
    "STEERING_SATURATION",
    "BRAKE_SATURATION",
)


class NoiseDeltas(HermesModel):
    """Exact deterministic deltas applied to a delivered observation."""

    speed_mps: FiniteFloat = 0.0
    lateral_offset_m: FiniteFloat = 0.0


class FaultedObservation(HermesModel):
    """One policy delivery plus its raw-source provenance."""

    observation: Observation
    delivery_sequence: int = Field(ge=0)
    delivery_time_s: float = Field(ge=0.0, allow_inf_nan=False)
    source_sequence: int = Field(ge=0)
    source_simulation_time_s: float = Field(ge=0.0, allow_inf_nan=False)
    reason_codes: tuple[str, ...]
    noise_deltas: NoiseDeltas


class FaultedAction(HermesModel):
    """One actual adapter action plus delayed-command provenance."""

    action: Action
    pre_saturation_action: Action
    execution_sequence: int = Field(ge=0)
    execution_time_s: float = Field(ge=0.0, allow_inf_nan=False)
    source_sequence: int | None = Field(default=None, ge=0)
    source_simulation_time_s: float | None = Field(
        default=None, ge=0.0, allow_inf_nan=False
    )
    reason_codes: tuple[str, ...]


def _canonical_config(config: FaultConfig) -> bytes:
    return json.dumps(
        config.model_dump(mode="json"),
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


class DeterministicFaultInjector:
    """Apply a strict fault profile without simulator-specific dependencies."""

    name = "deterministic-faults"
    version = "1.0"

    def __init__(self, config: FaultConfig) -> None:
        self._config = config
        self._profile_digest = hashlib.sha256(_canonical_config(config)).hexdigest()
        self._scenario: ScenarioDefinition | None = None
        self._seed: int | None = None
        self._raw_observations: dict[int, Observation] = {}
        self._last_base: Observation | None = None
        self._frozen_base: Observation | None = None
        self._permitted_actions: dict[int, tuple[float, Action]] = {}
        self._next_observation_sequence = 0
        self._next_action_sequence = 0

    @property
    def evidence_config(self) -> dict[str, object]:
        return self._config.model_dump(mode="json")

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        horizon = scenario.control.horizon_steps
        if self._config.observation_delay_steps >= horizon:
            raise ValueError("observation_delay_steps must be less than horizon_steps")
        if self._config.control_delay_steps >= horizon:
            raise ValueError("control_delay_steps must be less than horizon_steps")
        interval = self._config.frozen_observation_interval
        if interval is not None and interval.start_step + interval.duration_steps > horizon:
            raise ValueError("frozen observation interval must fit within horizon_steps")
        if any(step >= horizon for step in self._config.dropped_observation_steps):
            raise ValueError("dropped observation steps must be less than horizon_steps")
        self._scenario = scenario
        self._seed = seed
        self._raw_observations = {}
        self._last_base = None
        self._frozen_base = None
        self._permitted_actions = {}
        self._next_observation_sequence = 0
        self._next_action_sequence = 0

    def _require_reset(self) -> tuple[ScenarioDefinition, int]:
        if self._scenario is None or self._seed is None:
            raise RuntimeError("fault injector must be reset before use")
        return self._scenario, self._seed

    def _unit_noise(self, sequence: int, field_name: str) -> float:
        _, seed = self._require_reset()
        material = (
            f"hermes.fault-noise.v1:{self._profile_digest}:{seed}:"
            f"{sequence}:{field_name}"
        ).encode()
        value = int.from_bytes(hashlib.sha256(material).digest(), "big")
        return value / ((1 << 256) - 1) * 2.0 - 1.0

    def process_observation(self, observation: Observation) -> FaultedObservation:
        """Return the exact policy/shield input and its deterministic provenance."""
        self._require_reset()
        sequence = observation.sequence
        if sequence != self._next_observation_sequence:
            raise ValueError(
                "raw observation sequence must be contiguous: expected "
                f"{self._next_observation_sequence}, observed {sequence}"
            )
        self._next_observation_sequence += 1
        self._raw_observations[sequence] = observation
        reasons: list[str] = []

        delay = self._config.observation_delay_steps
        source_sequence = max(0, sequence - delay)
        if delay:
            reasons.append(
                "OBSERVATION_DELAY"
                if sequence >= delay
                else "OBSERVATION_DELAY_WARMUP"
            )
        base = self._raw_observations[source_sequence]

        interval = self._config.frozen_observation_interval
        if interval is not None:
            end = interval.start_step + interval.duration_steps
            if sequence == interval.start_step:
                self._frozen_base = base
            if interval.start_step <= sequence < end:
                assert self._frozen_base is not None
                base = self._frozen_base
                source_sequence = base.sequence
                reasons.append("OBSERVATION_FROZEN")

        if sequence in self._config.dropped_observation_steps:
            if self._last_base is None:
                raise RuntimeError("dropped observation has no prior delivered source")
            base = self._last_base
            source_sequence = base.sequence
            reasons.append("OBSERVATION_DROPOUT_HOLD_LAST")
        else:
            self._last_base = base

        noise = self._config.observation_noise
        speed_delta = 0.0
        lateral_delta = 0.0
        if noise is not None:
            speed_delta = (
                self._unit_noise(source_sequence, "speed_mps") * noise.speed_mps_bound
            )
            lateral_delta = (
                self._unit_noise(source_sequence, "lateral_offset_m")
                * noise.lateral_offset_m_bound
            )
            reasons.append("OBSERVATION_NOISE")

        source_time = base.simulation_time_s
        age = observation.simulation_time_s - source_time
        if age < -1e-12:
            raise RuntimeError("faulted observation source time is in the future")
        speed = max(0.0, base.vehicle_state.speed_mps + speed_delta)
        lateral = base.vehicle_state.lateral_offset_m + lateral_delta
        applied_speed_delta = speed - base.vehicle_state.speed_mps
        applied_lateral_delta = lateral - base.vehicle_state.lateral_offset_m
        delivered = base.model_copy(
            update={
                "sequence": sequence,
                "simulation_time_s": observation.simulation_time_s,
                "observation_age_s": max(0.0, age),
                "vehicle_state": base.vehicle_state.model_copy(
                    update={"speed_mps": speed, "lateral_offset_m": lateral}
                ),
            }
        )
        return FaultedObservation(
            observation=delivered,
            delivery_sequence=sequence,
            delivery_time_s=observation.simulation_time_s,
            source_sequence=source_sequence,
            source_simulation_time_s=source_time,
            reason_codes=tuple(reasons),
            noise_deltas=NoiseDeltas(
                speed_mps=applied_speed_delta,
                lateral_offset_m=applied_lateral_delta,
            ),
        )

    def process_action(
        self,
        action: Action,
        *,
        sequence: int,
        simulation_time_s: float,
    ) -> FaultedAction:
        """Delay a permitted command, then apply deterministic actuator saturation."""
        self._require_reset()
        if sequence != self._next_action_sequence:
            raise ValueError(
                "permitted action sequence must be contiguous: expected "
                f"{self._next_action_sequence}, observed {sequence}"
            )
        self._next_action_sequence += 1
        self._permitted_actions[sequence] = (simulation_time_s, action)
        reasons: list[str] = []
        delay = self._config.control_delay_steps
        source_sequence: int | None = sequence
        source_time: float | None = simulation_time_s
        pre_saturation = action
        if delay:
            delayed_sequence = sequence - delay
            if delayed_sequence < 0:
                source_sequence = None
                source_time = None
                pre_saturation = self._config.neutral_startup_action
                reasons.append("CONTROL_DELAY_FILL")
            else:
                source_sequence = delayed_sequence
                source_time, pre_saturation = self._permitted_actions[delayed_sequence]
                reasons.append("CONTROL_DELAY")

        steering = pre_saturation.steering
        max_steering = self._config.max_abs_steering
        if max_steering is not None and abs(steering) > max_steering:
            steering = math.copysign(max_steering, steering)
            reasons.append("STEERING_SATURATION")
        brake = pre_saturation.brake
        if self._config.max_brake is not None and brake > self._config.max_brake:
            brake = self._config.max_brake
            reasons.append("BRAKE_SATURATION")
        executed = Action(
            steering=steering,
            throttle=pre_saturation.throttle,
            brake=brake,
        )
        return FaultedAction(
            action=executed,
            pre_saturation_action=pre_saturation,
            execution_sequence=sequence,
            execution_time_s=simulation_time_s,
            source_sequence=source_sequence,
            source_simulation_time_s=source_time,
            reason_codes=tuple(reasons),
        )
