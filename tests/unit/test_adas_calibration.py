"""Calibration binding between measured MetaDrive authority and ADAS thresholds."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from hermes.adas.config import load_adas_config
from hermes.adas.interfaces import AebConfig
from hermes.domain.models import ControlConfig
from hermes.gates.config import AdasCriteria, load_gate_config
from hermes.scenarios.loader import load_scenario

MEASURED_20_MPS_PEAK_AUTHORITY = 12.982444763183452
ADAS_SCENARIOS = (
    "adas_cut_in_far.yaml",
    "adas_cut_in_near.yaml",
    "adas_nominal_no_lead.yaml",
    "adas_nominal_slow_closing.yaml",
    "aeb_lead_hard_brake.yaml",
)


def test_five_adas_scenarios_declare_the_measured_authority_without_changing_default(
    repository_root: Path,
) -> None:
    """Falling back to 6.0 or replacing its Python default must break this contract."""
    default = ControlConfig(frequency_hz=10, horizon_steps=300, target_speed_mps=20.0)
    assert default.max_braking_mps2 == 6.0

    evidence = json.loads(
        (
            repository_root
            / "evidence"
            / "calibration"
            / "metadrive-brake-curve-0.4.3.json"
        ).read_text(encoding="utf-8")
    )
    point_20 = next(
        curve for curve in evidence["curves"] if curve["entry_speed_command_mps"] == 20.0
    )
    assert point_20["peak_deceleration_mps2"] == MEASURED_20_MPS_PEAK_AUTHORITY

    for name in ADAS_SCENARIOS:
        scenario = load_scenario(repository_root / "scenarios" / "adas" / name)
        assert scenario.control.max_braking_mps2 == MEASURED_20_MPS_PEAK_AUTHORITY, name


def test_calibrated_fractions_preserve_the_previous_absolute_boundaries(
    repository_root: Path,
) -> None:
    """Changing authority alone must not move the oracle or baseline trigger boundaries."""
    authority = MEASURED_20_MPS_PEAK_AUTHORITY
    gate = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    assert gate.adas is not None
    defaults = AdasCriteria()
    controller = AebConfig()

    assert gate.adas.threat_authority_fraction * authority == pytest.approx(1.8)
    assert gate.adas.onset_authority_fraction * authority == pytest.approx(6.0)
    assert defaults.threat_authority_fraction == gate.adas.threat_authority_fraction
    assert defaults.onset_authority_fraction == gate.adas.onset_authority_fraction
    assert controller.partial_authority_fraction * authority == pytest.approx(2.4)
    assert controller.emergency_authority_fraction * authority == pytest.approx(4.2)


@pytest.mark.parametrize(
    ("config_name", "expected_partial_mps2", "expected_emergency_mps2"),
    (
        ("defect_late_braking.yaml", 5.7, 5.94),
        ("defect_over_braking.yaml", 0.012, 0.024),
    ),
)
def test_seeded_defect_trigger_boundaries_survive_recalibration(
    repository_root: Path,
    config_name: str,
    expected_partial_mps2: float,
    expected_emergency_mps2: float,
) -> None:
    """A calibrated suite must retain each deliberately broken controller's behaviour."""
    config = load_adas_config(repository_root / "config" / "adas" / config_name)
    assert config.aeb.partial_authority_fraction * MEASURED_20_MPS_PEAK_AUTHORITY == (
        pytest.approx(expected_partial_mps2)
    )
    assert config.aeb.emergency_authority_fraction * MEASURED_20_MPS_PEAK_AUTHORITY == (
        pytest.approx(expected_emergency_mps2)
    )
