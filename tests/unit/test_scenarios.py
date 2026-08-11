from __future__ import annotations

from pathlib import Path

import pytest

from hermes.scenarios.loader import ScenarioLoadError, load_scenario, scenario_digest

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
