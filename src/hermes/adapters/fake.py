"""Deterministic architectural test double; this is not a vehicle-physics model."""

from __future__ import annotations

from hermes.domain.enums import TerminationReason
from hermes.domain.models import (
    Action,
    Observation,
    ScenarioDefinition,
    StepResult,
    VehicleState,
)


class FakeSimulatorAdapter:
    """Exercise Hermes orchestration and evidence semantics without a simulator."""

    name = "fake"
    version = "1.0"

    def __init__(self) -> None:
        self._scenario: ScenarioDefinition | None = None
        self._state: VehicleState | None = None
        self._step_index = 0
        self._closed = False
        self._finished = False

    def reset(self, scenario: ScenarioDefinition, seed: int) -> Observation:
        """Reset deterministic state; seed is recorded even though no randomness is used."""
        del seed
        if self._closed:
            raise RuntimeError("fake adapter is closed")
        if scenario.adapter != self.name:
            raise ValueError("fake adapter requires a scenario with adapter: fake")
        self._scenario = scenario
        self._step_index = 0
        self._finished = False
        progress = 0.0
        self._state = VehicleState(
            position_m=0.0,
            speed_mps=scenario.initial_state.speed_mps,
            acceleration_mps2=0.0,
            lateral_offset_m=scenario.initial_state.lateral_offset_m,
            route_progress_pct=progress,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        )
        return Observation(
            sequence=0,
            simulation_time_s=0.0,
            vehicle_state=self._state,
        )

    def step(self, action: Action) -> StepResult:
        """Advance bounded deterministic state by exactly one control interval."""
        if self._closed:
            raise RuntimeError("fake adapter is closed")
        if self._scenario is None or self._state is None:
            raise RuntimeError("fake adapter must be reset before step")
        if self._finished:
            raise RuntimeError("fake adapter episode has already terminated")

        scenario = self._scenario
        previous = self._state
        dt = 1.0 / scenario.control.frequency_hz
        acceleration = (
            action.throttle * scenario.control.max_acceleration_mps2
            - action.brake * scenario.control.max_braking_mps2
        )
        if scenario.hazards.comfort_spike_at_step == self._step_index:
            acceleration = scenario.hazards.comfort_acceleration_mps2

        speed = max(0.0, min(50.0, previous.speed_mps + acceleration * dt))
        position = previous.position_m + speed * dt
        lateral_offset = (
            previous.lateral_offset_m
            + action.steering * scenario.control.lateral_response_mps * dt
        )
        collision_count = previous.collision_count
        if scenario.hazards.collision_at_step == self._step_index:
            collision_count += 1
        offroad = previous.offroad
        if scenario.hazards.boundary_at_step == self._step_index:
            lateral_offset = scenario.road.boundary_tolerance_m + 0.25
            offroad = True

        route_progress_pct = min(
            100.0,
            max(0.0, position / scenario.road.destination_distance_m * 100.0),
        )
        destination_reached = route_progress_pct >= 100.0
        self._state = VehicleState(
            position_m=position,
            speed_mps=speed,
            acceleration_mps2=acceleration,
            lateral_offset_m=lateral_offset,
            route_progress_pct=route_progress_pct,
            collision_count=collision_count,
            offroad=offroad,
            destination_reached=destination_reached,
        )

        self._step_index += 1
        terminated = collision_count > 0 or offroad or destination_reached
        truncated = not terminated and self._step_index >= scenario.control.horizon_steps
        if collision_count > 0:
            reason = TerminationReason.COLLISION
        elif offroad:
            reason = TerminationReason.OFF_ROAD
        elif destination_reached:
            reason = TerminationReason.DESTINATION_REACHED
        elif truncated:
            reason = TerminationReason.HORIZON
        else:
            reason = TerminationReason.NONE
        self._finished = terminated or truncated

        observation = Observation(
            sequence=self._step_index,
            simulation_time_s=self._step_index * dt,
            vehicle_state=self._state,
        )
        return StepResult(
            observation=observation,
            terminated=terminated,
            truncated=truncated,
            termination_reason=reason,
            raw_facts={
                "collision": collision_count > 0,
                "collision_count": collision_count,
                "offroad": offroad,
                "destination_reached": destination_reached,
                "route_progress_available": not scenario.hazards.unavailable_progress,
                "route_progress_pct": (
                    None if scenario.hazards.unavailable_progress else route_progress_pct
                ),
            },
        )

    def close(self) -> None:
        """Close idempotently so orchestrator cleanup can be unconditional."""
        self._closed = True
