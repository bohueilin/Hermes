from __future__ import annotations

import pytest
from pydantic import ValidationError

from hermes.domain.models import (
    Action,
    FaultConfig,
    FrozenObservationInterval,
    Observation,
    ObservationNoiseConfig,
    VehicleState,
)
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.scenarios.loader import load_scenario


def _config(**updates) -> FaultConfig:
    values = {
        "schema_version": "1.0",
        "name": "unit_faults",
        "version": "1.0",
        "label": "illustrative_simulation_faults_not_real_vehicle_limits",
    }
    values.update(updates)
    return FaultConfig.model_validate(values)


def _observation(sequence: int, *, speed_mps: float | None = None) -> Observation:
    time_s = sequence / 10.0
    return Observation(
        sequence=sequence,
        simulation_time_s=time_s,
        vehicle_state=VehicleState(
            position_m=float(sequence),
            speed_mps=float(sequence) if speed_mps is None else speed_mps,
            acceleration_mps2=0.0,
            lateral_offset_m=sequence / 100.0,
            route_progress_pct=float(sequence),
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
    )


def test_disabled_profile_is_an_exact_identity(repository_root) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    injector = DeterministicFaultInjector(_config())
    injector.reset(scenario, seed=7)
    observation = _observation(0)
    action = Action(steering=0.2, throttle=0.4, brake=0.0)

    delivered = injector.process_observation(observation)
    executed = injector.process_action(action, sequence=0, simulation_time_s=0.0)

    assert delivered.observation == observation
    assert delivered.reason_codes == ()
    assert executed.action == action
    assert executed.pre_saturation_action == action
    assert executed.source_sequence == 0
    assert executed.reason_codes == ()


def test_observation_delay_freeze_and_dropout_preserve_source_provenance(
    repository_root,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    injector = DeterministicFaultInjector(
        _config(
            observation_delay_steps=1,
            frozen_observation_interval={"start_step": 2, "duration_steps": 2},
            dropped_observation_steps=(4,),
        )
    )
    injector.reset(scenario, seed=7)

    results = [injector.process_observation(_observation(index)) for index in range(5)]

    assert results[0].source_sequence == 0
    assert results[0].reason_codes == ("OBSERVATION_DELAY_WARMUP",)
    assert results[1].source_sequence == 0
    assert results[1].observation.sequence == 1
    assert results[1].observation.simulation_time_s == 0.1
    assert results[1].observation.observation_age_s == 0.1
    assert results[2].source_sequence == 1
    assert results[2].reason_codes == (
        "OBSERVATION_DELAY",
        "OBSERVATION_FROZEN",
    )
    assert results[3].source_sequence == 1
    assert results[3].observation.observation_age_s == pytest.approx(0.2)
    assert results[4].source_sequence == 1
    assert results[4].reason_codes == (
        "OBSERVATION_DELAY",
        "OBSERVATION_DROPOUT_HOLD_LAST",
    )


def test_counter_based_noise_is_seeded_bounded_and_clamp_aware(repository_root) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    config = _config(
        observation_noise={"speed_mps_bound": 0.5, "lateral_offset_m_bound": 0.2}
    )

    def sample(seed: int):
        injector = DeterministicFaultInjector(config)
        injector.reset(scenario, seed)
        return injector.process_observation(_observation(0, speed_mps=0.0))

    first = sample(7)
    repeat = sample(7)
    different = sample(8)

    assert first == repeat
    assert first != different
    assert 0.0 <= first.observation.vehicle_state.speed_mps <= 0.5
    assert abs(first.noise_deltas.speed_mps) <= 0.5
    assert abs(first.noise_deltas.lateral_offset_m) <= 0.2
    assert first.reason_codes == ("OBSERVATION_NOISE",)


def test_noise_is_bound_to_the_source_packet_so_delayed_frozen_and_dropped_values_hold(
    repository_root,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    injector = DeterministicFaultInjector(
        _config(
            observation_delay_steps=1,
            frozen_observation_interval={"start_step": 2, "duration_steps": 2},
            dropped_observation_steps=(4,),
            observation_noise={
                "speed_mps_bound": 0.5,
                "lateral_offset_m_bound": 0.2,
            },
        )
    )
    injector.reset(scenario, seed=7)

    results = [injector.process_observation(_observation(index)) for index in range(5)]
    sensed_values = [
        (
            result.observation.vehicle_state.speed_mps,
            result.observation.vehicle_state.lateral_offset_m,
            result.noise_deltas,
        )
        for result in results
    ]

    assert sensed_values[0] == sensed_values[1]
    assert sensed_values[2] == sensed_values[3] == sensed_values[4]


def test_control_delay_then_saturation_has_exact_order_and_source(repository_root) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    injector = DeterministicFaultInjector(
        _config(control_delay_steps=1, max_abs_steering=0.4, max_brake=0.6)
    )
    injector.reset(scenario, seed=7)
    first = Action(steering=1.0, throttle=0.0, brake=1.0)
    second = Action(steering=-1.0, throttle=0.2, brake=0.0)

    fill = injector.process_action(first, sequence=0, simulation_time_s=0.0)
    delayed = injector.process_action(second, sequence=1, simulation_time_s=0.1)

    assert fill.source_sequence is None
    assert fill.source_simulation_time_s is None
    assert fill.action == Action(steering=0.0, throttle=0.0, brake=0.0)
    assert fill.reason_codes == ("CONTROL_DELAY_FILL",)
    assert delayed.source_sequence == 0
    assert delayed.source_simulation_time_s == 0.0
    assert delayed.pre_saturation_action == first
    assert delayed.action == Action(steering=0.4, throttle=0.0, brake=0.6)
    assert delayed.reason_codes == (
        "CONTROL_DELAY",
        "STEERING_SATURATION",
        "BRAKE_SATURATION",
    )


def test_fault_config_rejects_ambiguous_schedule_and_non_neutral_fill() -> None:
    with pytest.raises(ValidationError, match="sorted and unique"):
        _config(dropped_observation_steps=(3, 2))
    with pytest.raises(ValidationError, match="cannot overlap"):
        _config(
            frozen_observation_interval=FrozenObservationInterval(
                start_step=2, duration_steps=2
            ),
            dropped_observation_steps=(3,),
        )
    with pytest.raises(ValidationError, match="exactly neutral"):
        _config(
            control_delay_steps=1,
            neutral_startup_action=Action(steering=0.0, throttle=0.1, brake=0.0),
        )
    with pytest.raises(ValidationError, match="positive bound"):
        ObservationNoiseConfig(speed_mps_bound=0.0, lateral_offset_m_bound=0.0)


def test_fault_injector_rejects_noncontiguous_calls_and_out_of_horizon_schedule(
    repository_root,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    injector = DeterministicFaultInjector(_config(observation_delay_steps=1))
    injector.reset(scenario, seed=7)
    with pytest.raises(ValueError, match="expected 0, observed 1"):
        injector.process_observation(_observation(1))

    invalid = DeterministicFaultInjector(_config(control_delay_steps=100))
    with pytest.raises(ValueError, match="less than horizon_steps"):
        invalid.reset(scenario, seed=7)
