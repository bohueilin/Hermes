from pathlib import Path

import pytest

from hermes.gates.config import GateConfigError, gate_config_digest, load_gate_config


def test_phase1_gate_config_is_strict_versioned_and_illustrative(repository_root: Path) -> None:
    config = load_gate_config(repository_root / "config" / "gates.phase1.yaml")

    assert config.schema_version == "1.0"
    assert config.label == "illustrative_prototype_thresholds_not_for_real_vehicle_use"
    assert config.hard.max_collision_count == 0
    assert len(gate_config_digest(config)) == 64


def test_gate_config_rejects_unknown_or_weighted_score_fields(tmp_path: Path) -> None:
    config_file = tmp_path / "gate.yaml"
    config_file.write_text(
        """\
schema_version: "1.0"
name: phase1
version: "1.0"
label: illustrative_prototype_thresholds_not_for_real_vehicle_use
hard:
  max_collision_count: 0
  max_abs_lateral_offset_m: 1.5
  max_offroad_duration_s: 0.0
  min_route_completion_pct: 100.0
  missing_required_evidence: HOLD
soft:
  max_abs_acceleration_mps2: 4.0
  max_abs_jerk_mps3: 100.0
pass_min_score: 85
""",
        encoding="utf-8",
    )

    with pytest.raises(GateConfigError, match="pass_min_score"):
        load_gate_config(config_file)


def test_gate_config_rejects_duplicate_hard_rule(tmp_path: Path) -> None:
    config_file = tmp_path / "duplicate.yaml"
    config_file.write_text(
        """\
schema_version: "1.0"
name: phase1
version: "1.0"
label: illustrative_prototype_thresholds_not_for_real_vehicle_use
hard:
  max_collision_count: 0
  max_collision_count: 1
  max_abs_lateral_offset_m: 1.5
  max_offroad_duration_s: 0.0
  min_route_completion_pct: 100.0
  missing_required_evidence: HOLD
soft:
  max_abs_acceleration_mps2: 4.0
  max_abs_jerk_mps3: 100.0
""",
        encoding="utf-8",
    )

    with pytest.raises(GateConfigError, match="duplicate key"):
        load_gate_config(config_file)


def test_gate_config_cannot_relax_collision_zero_invariant(tmp_path: Path) -> None:
    config_file = tmp_path / "relaxed-collision.yaml"
    config_file.write_text(
        """\
schema_version: "1.0"
name: phase1
version: "1.0"
label: illustrative_prototype_thresholds_not_for_real_vehicle_use
hard:
  max_collision_count: 1
  max_abs_lateral_offset_m: 1.5
  max_offroad_duration_s: 0.0
  min_route_completion_pct: 100.0
  missing_required_evidence: HOLD
soft:
  max_abs_acceleration_mps2: 4.0
  max_abs_jerk_mps3: 100.0
""",
        encoding="utf-8",
    )

    with pytest.raises(GateConfigError, match="max_collision_count"):
        load_gate_config(config_file)


def test_gate_config_cannot_relax_zero_offroad_invariant(tmp_path: Path) -> None:
    config_file = tmp_path / "relaxed-offroad.yaml"
    config_file.write_text(
        """\
schema_version: "1.0"
name: phase1
version: "1.0"
label: illustrative_prototype_thresholds_not_for_real_vehicle_use
hard:
  max_collision_count: 0
  max_abs_lateral_offset_m: 10.0
  max_offroad_duration_s: 60.0
  min_route_completion_pct: 0.0
  missing_required_evidence: HOLD
soft:
  max_abs_acceleration_mps2: 4.0
  max_abs_jerk_mps3: 100.0
""",
        encoding="utf-8",
    )

    with pytest.raises(GateConfigError, match="max_offroad_duration_s"):
        load_gate_config(config_file)
