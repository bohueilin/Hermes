from __future__ import annotations

from pathlib import Path

import pytest

from hermes.shields.config import (
    ShieldConfigError,
    load_shield_config,
    parse_shield_config_yaml,
    shield_config_digest,
)


def test_phase3_shield_config_is_strict_versioned_and_digestible(
    repository_root: Path,
) -> None:
    config = load_shield_config(repository_root / "config" / "shield.phase3.yaml")

    assert config.schema_version == "1.0"
    assert config.name == "phase3_deterministic"
    assert config.version == "1.0"
    assert config.label == "illustrative_simulation_only_not_real_vehicle_limits"
    assert config.ttc_threshold_s == 2.0
    assert config.speed_cap_mps == 5.5
    assert config.max_observation_age_s == 0.2
    assert config.boundary_margin_m == 0.3
    assert config.actuation_delay_compensation_s == 0.25
    assert config.emergency_stop_active is False
    assert len(shield_config_digest(config)) == 64


@pytest.mark.parametrize(
    "text",
    [
        """
schema_version: "1.0"
name: phase3_deterministic
version: "1.0"
label: illustrative_simulation_only_not_real_vehicle_limits
ttc_threshold_s: 2.0
ttc_threshold_s: 3.0
speed_cap_mps: 8.5
max_observation_age_s: 0.2
boundary_margin_m: 0.3
actuation_delay_compensation_s: 0.25
emergency_stop_active: false
full_brake_command: 1.0
boundary_steering_command: 0.5
""",
        """
schema_version: "1.0"
name: phase3_deterministic
version: "1.0"
label: illustrative_simulation_only_not_real_vehicle_limits
ttc_threshold_s: .nan
speed_cap_mps: 8.5
max_observation_age_s: 0.2
boundary_margin_m: 0.3
actuation_delay_compensation_s: 0.25
emergency_stop_active: false
full_brake_command: 1.0
boundary_steering_command: 0.5
""",
        """
schema_version: "1.0"
name: phase3_deterministic
version: "1.0"
label: illustrative_simulation_only_not_real_vehicle_limits
ttc_threshold_s: 2.0
speed_cap_mps: 8.5
max_observation_age_s: 0.2
boundary_margin_m: 0.3
actuation_delay_compensation_s: 0.25
emergency_stop_active: false
full_brake_command: 1.0
boundary_steering_command: 0.5
unknown_threshold: 1.0
""",
    ],
)
def test_shield_config_rejects_ambiguous_or_unknown_values(text: str) -> None:
    with pytest.raises(ShieldConfigError):
        parse_shield_config_yaml(text)
