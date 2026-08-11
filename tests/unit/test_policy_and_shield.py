from pathlib import Path

from hermes.domain.models import Action, Observation, VehicleState
from hermes.policies.baseline import BaselinePolicy
from hermes.scenarios.loader import load_scenario
from hermes.shields.noop import NoOpShield


def test_baseline_policy_is_deterministic_bounded_and_corrects_lateral_error(
    repository_root: Path,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    policy = BaselinePolicy()
    policy.reset(scenario, seed=7)
    observation = Observation(
        sequence=3,
        simulation_time_s=0.3,
        vehicle_state=VehicleState(
            position_m=1.0,
            speed_mps=2.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.75,
            route_progress_pct=5.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
    )

    first = policy.act(observation)
    second = policy.act(observation)

    assert first == second
    assert first == Action(steering=-0.5, throttle=1.0, brake=0.0)
    assert policy.simulated_latency_ms == 10.0


def test_baseline_policy_brakes_above_target_speed(repository_root: Path) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    policy = BaselinePolicy()
    policy.reset(scenario, seed=7)
    observation = Observation(
        sequence=1,
        simulation_time_s=0.1,
        vehicle_state=VehicleState(
            position_m=1.0,
            speed_mps=11.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=5.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
    )

    action = policy.act(observation)

    assert action.throttle == 0.0
    assert action.brake == 0.5


def test_noop_shield_preserves_candidate_and_reports_no_override() -> None:
    observation = Observation(
        sequence=0,
        simulation_time_s=0.0,
        vehicle_state=VehicleState(
            position_m=0.0,
            speed_mps=0.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=0.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
    )
    candidate = Action(steering=0.2, throttle=0.5, brake=0.0)

    executed, reasons = NoOpShield().apply(observation, candidate)

    assert executed == candidate
    assert reasons == ()
