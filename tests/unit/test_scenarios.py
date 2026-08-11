from __future__ import annotations

from pathlib import Path

import pytest

from hermes.scenarios.loader import (
    ScenarioLoadError,
    load_scenario,
    resolved_scenario_yaml,
    scenario_digest,
)

VALID_SCENARIO = """\
schema_version: "1.0"
name: unit_nominal
version: "1.0"
description: Unit-test nominal scenario
adapter: fake
control:
  frequency_hz: 10
  horizon_steps: 40
  target_speed_mps: 8.0
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 12.0
  boundary_tolerance_m: 1.5
hazards: {}
"""


def test_scenario_loader_resolves_defaults_and_has_order_independent_digest(
    tmp_path: Path,
) -> None:
    first = tmp_path / "first.yaml"
    second = tmp_path / "second.yaml"
    first.write_text(VALID_SCENARIO, encoding="utf-8")
    second.write_text(
        VALID_SCENARIO.replace(
            'name: unit_nominal\nversion: "1.0"',
            'version: "1.0"\nname: unit_nominal',
        ),
        encoding="utf-8",
    )

    first_loaded = load_scenario(first)
    second_loaded = load_scenario(second)

    assert first_loaded.control.max_acceleration_mps2 == 3.0
    assert first_loaded.hazards.collision_at_step is None
    assert scenario_digest(first_loaded) == scenario_digest(second_loaded)


@pytest.mark.parametrize(
    ("name", "expected_digest"),
    [
        ("fake_nominal.yaml", "c8d4e79352e5b556d6dd350f04cde6e52ea61cde6c1d7b04d4447c4add32ab95"),
        (
            "metadrive_nominal.yaml",
            "675413578f3675b9581e7bac4d889c244e050d277c5402e2da0b13133931a995",
        ),
    ],
)
def test_schema_v1_canonical_identity_is_backward_compatible(
    repository_root: Path,
    name: str,
    expected_digest: str,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / name)

    assert scenario.schema_version == "1.0"
    assert scenario.challenge is None
    assert "challenge:" not in resolved_scenario_yaml(scenario)
    assert scenario_digest(scenario) == expected_digest


def test_scenario_loader_rejects_unknown_fields(tmp_path: Path) -> None:
    scenario_file = tmp_path / "unknown.yaml"
    scenario_file.write_text(VALID_SCENARIO + "invented_key: true\n", encoding="utf-8")

    with pytest.raises(ScenarioLoadError, match="invented_key"):
        load_scenario(scenario_file)


def test_scenario_loader_rejects_duplicate_keys_and_aliases(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.yaml"
    duplicate.write_text(
        VALID_SCENARIO.replace(
            "  horizon_steps: 40",
            "  horizon_steps: 40\n  horizon_steps: 1",
        ),
        encoding="utf-8",
    )
    aliased = tmp_path / "aliased.yaml"
    aliased.write_text(
        VALID_SCENARIO.replace(
            "  speed_mps: 0.0",
            "  speed_mps: &initial_speed 0.0",
        ).replace(
            "  lateral_offset_m: 0.0",
            "  lateral_offset_m: *initial_speed",
        ),
        encoding="utf-8",
    )

    with pytest.raises(ScenarioLoadError, match="duplicate key"):
        load_scenario(duplicate)
    with pytest.raises(ScenarioLoadError, match="aliases"):
        load_scenario(aliased)


def test_scenario_loader_rejects_contradictory_hazard_step(tmp_path: Path) -> None:
    scenario_file = tmp_path / "contradictory.yaml"
    scenario_file.write_text(
        VALID_SCENARIO.replace("hazards: {}", "hazards:\n  collision_at_step: 40"),
        encoding="utf-8",
    )

    with pytest.raises(ScenarioLoadError, match="collision_at_step"):
        load_scenario(scenario_file)


def test_schema_v1_rejects_challenge_configuration(tmp_path: Path) -> None:
    scenario_file = tmp_path / "v1-challenge.yaml"
    scenario_file.write_text(
        VALID_SCENARIO
        + """\
challenge:
  kind: lead_vehicle_hard_brake
  actor_control_mode: metadrive_dynamic_action
  behavior_realism_claim: false
  initial_gap_m: 15.0
  actor_speed_mps: 4.0
  trigger_step: 10
  brake_duration_steps: 5
  brake_command: -1.0
  resume_throttle_command: 1.0
""",
        encoding="utf-8",
    )

    with pytest.raises(ScenarioLoadError, match="schema_version 1.0 cannot define challenge"):
        load_scenario(scenario_file)


def test_schema_v2_requires_metadrive_challenge_and_no_fake_hazard(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    valid_text = (repository_root / "scenarios/metadrive_lead_vehicle_hard_brake.yaml").read_text(
        encoding="utf-8"
    )
    invalid_cases = {
        "missing": (
            valid_text.split("challenge:\n", maxsplit=1)[0],
            "schema_version 2.0 requires challenge",
        ),
        "fake": (
            valid_text.replace("adapter: metadrive", "adapter: fake", 1),
            "schema_version 2.0 requires adapter metadrive",
        ),
        "hazard": (
            valid_text.replace(
                "hazards: {}",
                "hazards:\n  collision_at_step: 12",
                1,
            ),
            "cannot coexist with fake hazards",
        ),
    }

    for name, (text, error) in invalid_cases.items():
        scenario_file = tmp_path / f"{name}.yaml"
        scenario_file.write_text(text, encoding="utf-8")
        with pytest.raises(ScenarioLoadError, match=error):
            load_scenario(scenario_file)


@pytest.mark.parametrize(
    ("name", "old", "new", "error"),
    [
        (
            "lead-timing",
            "brake_duration_steps: 15",
            "brake_duration_steps: 281",
            "braking window",
        ),
        (
            "lead-mode",
            "actor_control_mode: metadrive_dynamic_action",
            "actor_control_mode: scripted_kinematic_replay",
            "actor_control_mode",
        ),
        (
            "lead-realism",
            "behavior_realism_claim: false",
            "behavior_realism_claim: true",
            "behavior_realism_claim",
        ),
        (
            "cut-in-timing",
            "transition_steps: 10",
            "transition_steps: 271",
            "transition window",
        ),
        (
            "cut-in-lane",
            "initial_lane_delta: 1",
            "initial_lane_delta: 0",
            "initial_lane_delta",
        ),
        (
            "cut-in-mode",
            "actor_control_mode: scripted_kinematic_replay",
            "actor_control_mode: metadrive_dynamic_action",
            "actor_control_mode",
        ),
        (
            "cut-in-realism",
            "behavior_realism_claim: false",
            "behavior_realism_claim: true",
            "behavior_realism_claim",
        ),
    ],
)
def test_phase3_challenge_validation_is_strict(
    repository_root: Path,
    tmp_path: Path,
    name: str,
    old: str,
    new: str,
    error: str,
) -> None:
    source_name = (
        "metadrive_cut_in_near_field.yaml"
        if name.startswith("cut-in")
        else "metadrive_lead_vehicle_hard_brake.yaml"
    )
    text = (repository_root / "scenarios" / source_name).read_text(encoding="utf-8")
    scenario_file = tmp_path / f"{name}.yaml"
    scenario_file.write_text(text.replace(old, new, 1), encoding="utf-8")

    with pytest.raises(ScenarioLoadError, match=error):
        load_scenario(scenario_file)


def test_scenario_loader_rejects_oversized_yaml_before_parsing(tmp_path: Path) -> None:
    scenario_file = tmp_path / "oversized.yaml"
    scenario_file.write_bytes(b"x" * (1_048_576 + 1))

    with pytest.raises(ScenarioLoadError, match="maximum size"):
        load_scenario(scenario_file)


@pytest.mark.parametrize(
    "name, expected_hazard",
    [
        ("fake_nominal.yaml", None),
        ("fake_collision.yaml", "collision"),
        ("fake_boundary.yaml", "boundary"),
        ("fake_soft_degradation.yaml", "comfort"),
    ],
)
def test_phase1_scenario_files_are_strictly_loadable(
    repository_root: Path,
    name: str,
    expected_hazard: str | None,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / name)

    assert scenario.adapter == "fake"
    assert scenario.expected_hazard == expected_hazard


@pytest.mark.parametrize(
    ("name", "kind", "control_mode"),
    [
        (
            "metadrive_lead_vehicle_hard_brake.yaml",
            "lead_vehicle_hard_brake",
            "metadrive_dynamic_action",
        ),
        (
            "metadrive_cut_in_near_field.yaml",
            "cut_in_near_field",
            "scripted_kinematic_replay",
        ),
    ],
)
def test_phase3_challenge_scenarios_are_strictly_loadable(
    repository_root: Path,
    name: str,
    kind: str,
    control_mode: str,
) -> None:
    scenario = load_scenario(repository_root / "scenarios" / name)

    assert scenario.schema_version == "2.0"
    assert scenario.adapter == "metadrive"
    assert scenario.expected_hazard == kind
    assert scenario.challenge is not None
    assert scenario.challenge.kind == kind
    assert scenario.challenge.actor_control_mode == control_mode
    assert scenario.challenge.behavior_realism_claim is False
    assert "challenge:" in resolved_scenario_yaml(scenario)
