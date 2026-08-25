"""Small deterministic policy for the Phase 1 architectural test double."""

from __future__ import annotations

from hermes.domain.models import Action, JsonValue, Observation, ScenarioDefinition


class BaselinePolicy:
    """Proportional speed and lane-center control with normalized outputs."""

    name = "baseline"
    version = "1.0"

    def __init__(self) -> None:
        self._scenario: ScenarioDefinition | None = None

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        if self._scenario is None:
            raise RuntimeError("baseline policy must be reset before evidence config is read")
        return {
            "target_speed_mps": self._scenario.control.target_speed_mps,
            "simulated_policy_latency_ms": (
                self._scenario.control.simulated_policy_latency_ms
            ),
        }

    @property
    def simulated_latency_ms(self) -> float:
        if self._scenario is None:
            raise RuntimeError("baseline policy must be reset before latency is read")
        return self._scenario.control.simulated_policy_latency_ms

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del seed
        self._scenario = scenario

    def act(self, observation: Observation) -> Action:
        if self._scenario is None:
            raise RuntimeError("baseline policy must be reset before act")
        scenario = self._scenario
        speed_error = scenario.control.target_speed_mps - observation.vehicle_state.speed_mps
        desired_acceleration = max(
            -scenario.control.max_braking_mps2,
            min(scenario.control.max_acceleration_mps2, speed_error),
        )
        if desired_acceleration >= 0.0:
            throttle = desired_acceleration / scenario.control.max_acceleration_mps2
            brake = 0.0
        else:
            throttle = 0.0
            brake = -desired_acceleration / scenario.control.max_braking_mps2
        steering = max(
            -1.0,
            min(
                1.0,
                -observation.vehicle_state.lateral_offset_m
                / scenario.road.boundary_tolerance_m,
            ),
        )
        return Action(steering=steering, throttle=throttle, brake=brake)
