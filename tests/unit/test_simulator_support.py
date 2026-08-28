from __future__ import annotations

from pathlib import Path

import pytest

from hermes.domain.models import (
    CutInNearFieldChallenge,
    LeadVehicleHardBrakeChallenge,
    StationaryLeadChallenge,
)
from hermes.scenarios.loader import load_scenario
from hermes.simulator_support import metadrive_map_for_gap

_COMMITTED_MAPS = {
    "scenarios/fake_boundary.yaml": "S",
    "scenarios/fake_collision.yaml": "S",
    "scenarios/fake_fault_injection.yaml": "S",
    "scenarios/fake_nominal.yaml": "S",
    "scenarios/fake_soft_degradation.yaml": "S",
    "scenarios/metadrive_cut_in_near_field.yaml": "S",
    "scenarios/metadrive_lead_vehicle_hard_brake.yaml": "S",
    "scenarios/metadrive_nominal.yaml": "S",
    "scenarios/adas/adas_cut_in_far.yaml": "S",
    "scenarios/adas/adas_cut_in_near.yaml": "S",
    "scenarios/adas/adas_nominal_no_lead.yaml": "S",
    "scenarios/adas/adas_nominal_slow_closing.yaml": "S",
    "scenarios/adas/aeb_lead_hard_brake.yaml": "S",
    "scenarios/adas/aeb_stationary_lead.yaml": "S",
    "scenarios/adas/aeb_stationary_lead_observation_delay.yaml": "S",
    "scenarios/adas/fcw_stationary_lead.yaml": "SSS",
    "scenarios/adas/non_in_path_stationary_object.yaml": "S",
}


def test_metadrive_map_for_no_challenge_preserves_single_straight() -> None:
    assert metadrive_map_for_gap(None) == "S"


@pytest.mark.parametrize(
    ("challenge_kind", "initial_gap_m", "expected_map"),
    (
        ("lead_vehicle_hard_brake", 100.484, "S"),
        ("lead_vehicle_hard_brake", 100.485, "S"),
        ("lead_vehicle_hard_brake", 100.486, "SS"),
        ("cut_in_near_field", 100.484, "S"),
        ("cut_in_near_field", 100.485, "S"),
        ("cut_in_near_field", 100.486, "SS"),
        ("stationary_lead", 100.484, "S"),
        ("stationary_lead", 100.485, "S"),
        ("stationary_lead", 100.486, "SS"),
    ),
)
def test_metadrive_map_for_challenge_gap_crosses_the_byte_identity_threshold(
    challenge_kind: str, initial_gap_m: float, expected_map: str
) -> None:
    if challenge_kind == "lead_vehicle_hard_brake":
        challenge = LeadVehicleHardBrakeChallenge(
            kind=challenge_kind,
            actor_control_mode="metadrive_dynamic_action",
            behavior_realism_claim=False,
            initial_gap_m=initial_gap_m,
            actor_speed_mps=0.0,
            trigger_step=0,
            brake_duration_steps=1,
            brake_command=-1.0,
            resume_throttle_command=0.0,
        )
    elif challenge_kind == "cut_in_near_field":
        challenge = CutInNearFieldChallenge(
            kind=challenge_kind,
            actor_control_mode="scripted_kinematic_replay",
            behavior_realism_claim=False,
            initial_gap_m=initial_gap_m,
            actor_speed_mps=0.0,
            initial_lane_delta=1,
            trigger_step=0,
            transition_steps=1,
        )
    else:
        assert challenge_kind == "stationary_lead"
        challenge = StationaryLeadChallenge(
            kind=challenge_kind,
            actor_control_mode="scripted_kinematic_replay",
            behavior_realism_claim=False,
            initial_gap_m=initial_gap_m,
        )

    assert metadrive_map_for_gap(challenge.initial_gap_m) == expected_map


def test_metadrive_map_for_gap_140_derives_seed_independent_longer_map() -> None:
    assert metadrive_map_for_gap(140.0) == "SSS"


def test_metadrive_map_for_gap_is_monotonic_non_decreasing() -> None:
    maps = [metadrive_map_for_gap(gap) for gap in (0.001, 100.484, 100.486, 140.0, 200.0)]
    assert [len(value) for value in maps] == sorted(len(value) for value in maps)


def test_committed_scenarios_match_reviewed_metadrive_map_table(
    repository_root: Path,
) -> None:
    scenario_paths = sorted((repository_root / "scenarios").glob("*.yaml")) + sorted(
        (repository_root / "scenarios" / "adas").glob("*.yaml")
    )
    committed_paths = {
        path.relative_to(repository_root).as_posix()
        for path in scenario_paths
        if not path.name.endswith(".example.yaml")
    }

    assert committed_paths == set(_COMMITTED_MAPS)
    for relative_path, expected_map in _COMMITTED_MAPS.items():
        scenario = load_scenario(repository_root / relative_path)
        initial_gap_m = (
            scenario.challenge.initial_gap_m if scenario.challenge is not None else None
        )
        assert metadrive_map_for_gap(initial_gap_m) == expected_map
