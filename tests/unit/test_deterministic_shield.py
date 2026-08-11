from __future__ import annotations

import struct
from pathlib import Path

import pytest

from hermes.domain.models import Action, Observation, ScenarioDefinition, VehicleState
from hermes.scenarios.loader import load_scenario
from hermes.shields.config import ShieldConfig, load_shield_config
from hermes.shields.deterministic import DeterministicSafetyShield


def _observation(
    *,
    speed_mps: float = 5.0,
    lateral_offset_m: float = 0.0,
    front_distance_m: float | None = None,
    front_relative_speed_mps: float | None = None,
    observation_age_s: float = 0.0,
) -> Observation:
    return Observation(
        sequence=3,
        simulation_time_s=0.3,
        vehicle_state=VehicleState(
            position_m=10.0,
            speed_mps=speed_mps,
            acceleration_mps2=0.0,
            lateral_offset_m=lateral_offset_m,
            route_progress_pct=25.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
        front_distance_m=front_distance_m,
        front_relative_speed_mps=front_relative_speed_mps,
        observation_age_s=observation_age_s,
    )


@pytest.fixture
def scenario(repository_root: Path) -> ScenarioDefinition:
    return load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")


@pytest.fixture
def shield_config(repository_root: Path) -> ShieldConfig:
    return load_shield_config(repository_root / "config" / "shield.phase3.yaml")


def _apply(
    scenario: ScenarioDefinition,
    config: ShieldConfig,
    observation: Observation,
    candidate: Action | None = None,
) -> tuple[Action, tuple[str, ...]]:
    shield = DeterministicSafetyShield(config)
    shield.reset(scenario, seed=7)
    return shield.apply(
        observation,
        candidate or Action(steering=0.1, throttle=0.8, brake=0.0),
    )


def test_no_supported_trigger_preserves_candidate_exactly(
    scenario: ScenarioDefinition,
    shield_config: ShieldConfig,
) -> None:
    candidate = Action(steering=0.123456789, throttle=0.4, brake=0.0)

    executed, reasons = _apply(
        scenario,
        shield_config,
        _observation(
            speed_mps=5.0,
            front_distance_m=None,
            front_relative_speed_mps=None,
        ),
        candidate,
    )

    assert executed == candidate
    assert reasons == ()


@pytest.mark.parametrize(
    ("observation", "reason"),
    [
        (
            _observation(front_distance_m=5.0, front_relative_speed_mps=-5.0),
            "TTC_BELOW_THRESHOLD",
        ),
        (_observation(speed_mps=9.0), "SPEED_CAP"),
        (_observation(observation_age_s=0.3), "STALE_OBSERVATION"),
        (_observation(lateral_offset_m=1.25), "BOUNDARY_RISK"),
        (
            _observation(front_distance_m=10.5, front_relative_speed_mps=-5.0),
            "ACTUATION_DELAY_COMPENSATION",
        ),
    ],
)
def test_each_observation_trigger_has_stable_reason_and_brakes(
    scenario: ScenarioDefinition,
    shield_config: ShieldConfig,
    observation: Observation,
    reason: str,
) -> None:
    executed, reasons = _apply(scenario, shield_config, observation)

    assert reasons == (reason,)
    assert executed.throttle == 0.0
    assert executed.brake == 1.0


def test_boundary_risk_steers_toward_center_at_binary32_precision(
    scenario: ScenarioDefinition,
    shield_config: ShieldConfig,
) -> None:
    executed, reasons = _apply(
        scenario,
        shield_config,
        _observation(lateral_offset_m=-1.25),
    )

    expected = struct.unpack("!f", struct.pack("!f", 0.5))[0]
    assert executed.steering == expected
    assert reasons == ("BOUNDARY_RISK",)


def test_emergency_stop_configuration_has_explicit_reason(
    scenario: ScenarioDefinition,
    shield_config: ShieldConfig,
) -> None:
    emergency = shield_config.model_copy(update={"emergency_stop_active": True})

    executed, reasons = _apply(scenario, emergency, _observation())

    expected_steering = struct.unpack("!f", struct.pack("!f", 0.1))[0]
    assert executed == Action(
        steering=expected_steering,
        throttle=0.0,
        brake=1.0,
    )
    assert reasons == ("EMERGENCY_STOP",)


def test_multiple_triggers_are_stable_and_not_collapsed(
    scenario: ScenarioDefinition,
    shield_config: ShieldConfig,
) -> None:
    emergency = shield_config.model_copy(update={"emergency_stop_active": True})

    executed, reasons = _apply(
        scenario,
        emergency,
        _observation(
            speed_mps=9.0,
            lateral_offset_m=1.25,
            front_distance_m=5.0,
            front_relative_speed_mps=-5.0,
            observation_age_s=0.3,
        ),
    )

    assert executed == Action(steering=-0.5, throttle=0.0, brake=1.0)
    assert reasons == (
        "TTC_BELOW_THRESHOLD",
        "SPEED_CAP",
        "STALE_OBSERVATION",
        "BOUNDARY_RISK",
        "EMERGENCY_STOP",
    )


def test_trigger_that_would_not_change_action_is_not_reported_as_override(
    scenario: ScenarioDefinition,
    shield_config: ShieldConfig,
) -> None:
    candidate = Action(steering=0.0, throttle=0.0, brake=1.0)

    executed, reasons = _apply(
        scenario,
        shield_config,
        _observation(front_distance_m=5.0, front_relative_speed_mps=-5.0),
        candidate,
    )

    assert executed == candidate
    assert reasons == ()


def test_shield_requires_reset_before_apply(shield_config: ShieldConfig) -> None:
    shield = DeterministicSafetyShield(shield_config)

    with pytest.raises(RuntimeError, match="reset"):
        shield.apply(
            _observation(),
            Action(steering=0.0, throttle=0.0, brake=0.0),
        )
