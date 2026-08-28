"""Calibration binding between measured MetaDrive authority and ADAS thresholds."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from hermes.adas.config import load_adas_config
from hermes.adas.interfaces import AebConfig
from hermes.adas.seeded_defects import load_seeded_defects
from hermes.domain.models import ControlConfig
from hermes.evidence.artifacts import config_digest
from hermes.gates.config import AdasCriteria, gate_config_digest, load_gate_config
from hermes.scenarios.loader import load_scenario, scenario_digest

MEASURED_20_MPS_PEAK_AUTHORITY = 12.982444763183452
BASELINE_POLICY_CONFIG_DIGEST = "56fa0f27e205d137ed8de09f29783e764ec80441cb05be329e7782dc7dbaeb41"
EXISTING_ADAS_SCENARIO_DIGESTS = {
    "adas_cut_in_far.yaml": "4d8fd2dc131a2e15d8b1c79b71e5f1634da429aaba9cd32a291592e5f6e7900c",
    "adas_cut_in_near.yaml": "989e948e5e49805125c895d21e889d33bc6c45b33c58cf151377888683b56904",
    "adas_nominal_no_lead.yaml": "b76518e869194df2f58c37828bab2ddb5f867461e19da5e26c2f4f9c54e779c0",
    "adas_nominal_slow_closing.yaml": (
        "9f4ed1cef855f963ce029dc75062f759cdf582eff7f4e5c377f3907c64726526"
    ),
    "aeb_lead_hard_brake.yaml": "bf989c05f44deabff573bbe5b529ed006aa2a0c1924052987cf227f2191b4e85",
}
EXISTING_ADAS_CONFIG_DIGESTS = {
    "baseline.yaml": BASELINE_POLICY_CONFIG_DIGEST,
    "defect_late_braking.yaml": (
        "c4cd3095ff081247b017d48c64e9de71478a7455f21d221cbd07ee2e140b67a7"
    ),
    "defect_no_aeb.yaml": "bf318afbae83e5329c637e61c56c6ea51381dbe283d8783ef0316120580177f6",
    "defect_over_braking.yaml": (
        "616f44f98ca068095f397371b59fdf3c8ad4c50c37a90e2c45203b5c767d93b9"
    ),
}
ADAS_SCENARIOS = (
    "adas_cut_in_far.yaml",
    "adas_cut_in_near.yaml",
    "adas_nominal_no_lead.yaml",
    "adas_nominal_slow_closing.yaml",
    "aeb_stationary_lead.yaml",
    "aeb_lead_hard_brake.yaml",
    "non_in_path_stationary_object.yaml",
    "fcw_stationary_lead.yaml",
    "slow_lead_closing.yaml",
    "fcw_aeb_nominal_following.yaml",
)


def test_ten_adas_scenarios_declare_the_measured_authority_without_changing_default(
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


def test_steady_scenario_pair_pins_the_reviewed_authored_literals(
    repository_root: Path,
) -> None:
    threat = load_scenario(repository_root / "scenarios/adas/slow_lead_closing.yaml")
    nominal = load_scenario(
        repository_root / "scenarios/adas/fcw_aeb_nominal_following.yaml"
    )

    assert threat.schema_version == "4.0"
    assert threat.name == "slow_lead_closing"
    assert threat.control.frequency_hz == 10
    assert threat.control.horizon_steps == 200
    assert threat.control.target_speed_mps == 20.0
    assert threat.initial_state.speed_mps == 20.0
    assert threat.challenge is not None
    assert threat.challenge.kind == "steady_lead"
    assert threat.challenge.actor_control_mode == "scripted_kinematic_replay"
    assert threat.challenge.behavior_realism_claim is False
    assert threat.challenge.actor_speed_mps == 10.0
    assert threat.challenge.initial_gap_m == 32.0
    assert threat.challenge.initial_lane_delta == 0
    assert threat.tags == ("aeb", "fcw", "longitudinal", "threat")
    assert threat.adas is not None
    assert threat.adas.expected_fcw.kind == "required"
    assert threat.adas.expected_fcw.before_ttc_s == 2.6
    assert threat.adas.expected_aeb.kind == "required"

    assert nominal.schema_version == "4.0"
    assert nominal.name == "fcw_aeb_nominal_following"
    assert nominal.control.frequency_hz == 10
    assert nominal.control.horizon_steps == 200
    assert nominal.control.target_speed_mps == 20.0
    assert nominal.initial_state.speed_mps == 20.0
    assert nominal.challenge is not None
    assert nominal.challenge.kind == "steady_lead"
    assert nominal.challenge.actor_control_mode == "scripted_kinematic_replay"
    assert nominal.challenge.behavior_realism_claim is False
    assert nominal.challenge.actor_speed_mps == 20.0
    assert nominal.challenge.initial_gap_m == 40.0
    assert nominal.challenge.initial_lane_delta == 0
    assert nominal.tags == ("aeb", "fcw", "longitudinal", "nominal")
    assert nominal.adas is not None
    assert nominal.adas.expected_fcw.kind == "none"
    assert nominal.adas.expected_aeb.kind == "forbidden"


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


def test_actor_presence_defect_is_evaluation_only_and_preserves_baseline_identity(
    repository_root: Path,
) -> None:
    baseline = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
    defect = load_adas_config(
        repository_root / "config" / "adas" / "defect_actor_presence_braking.yaml"
    )

    assert config_digest(baseline.model_dump(mode="json")) == BASELINE_POLICY_CONFIG_DIGEST
    assert defect.functions == ("fcw", "aeb", "seeded_actor_presence_brake")
    assert defect.fcw == baseline.fcw
    assert defect.aeb == baseline.aeb
    assert defect.driver == baseline.driver


def test_seeded_matrix_binds_each_stationary_twin_to_its_named_finding(
    repository_root: Path,
) -> None:
    suite = load_seeded_defects(repository_root / "config" / "phase8-seeded-defects.yaml")
    defects = {item.defect_id: item for item in suite.defects}

    no_aeb = defects["no_aeb_stationary"]
    assert no_aeb.scenario == "scenarios/adas/aeb_stationary_lead.yaml"
    assert no_aeb.expected_failing_finding == "adas.aeb.threat_response"

    over_braking = defects["over_braking_stationary"]
    assert over_braking.scenario == "scenarios/adas/non_in_path_stationary_object.yaml"
    assert over_braking.policy_config == (
        "config/adas/defect_actor_presence_braking.yaml"
    )
    assert over_braking.expected_failing_finding == "adas.aeb.no_false_intervention"


def test_seeded_matrix_binds_each_steady_twin_to_its_named_finding(
    repository_root: Path,
) -> None:
    suite = load_seeded_defects(repository_root / "config" / "phase8-seeded-defects.yaml")
    defects = {item.defect_id: item for item in suite.defects}

    no_aeb = defects["no_aeb_steady"]
    assert no_aeb.scenario == "scenarios/adas/slow_lead_closing.yaml"
    assert no_aeb.policy_config == "config/adas/defect_no_aeb.yaml"
    assert no_aeb.expected_failing_finding == "adas.aeb.threat_response"
    assert no_aeb.expected_triage_category == "MISSED_INTERVENTION"

    over_braking = defects["actor_presence_braking_steady_nominal"]
    assert over_braking.scenario == "scenarios/adas/fcw_aeb_nominal_following.yaml"
    assert over_braking.policy_config == (
        "config/adas/defect_actor_presence_braking.yaml"
    )
    assert over_braking.expected_failing_finding == "adas.aeb.no_false_intervention"
    assert over_braking.expected_triage_category == "OVER_INTERVENTION"


def test_seeded_matrix_includes_the_observation_delay_environment_failure(
    repository_root: Path,
) -> None:
    suite = load_seeded_defects(repository_root / "config" / "phase8-seeded-defects.yaml")
    defects = {item.defect_id: item for item in suite.defects}

    assert suite.label == (
        "deliberately_seeded_policy_or_environment_failures_for_evaluation_acceptance"
    )
    assert len(defects) == 12
    delayed = defects["stationary_observation_delay"]
    assert delayed.policy_config == "config/adas/baseline.yaml"
    assert delayed.scenario == (
        "scenarios/adas/aeb_stationary_lead_observation_delay.yaml"
    )
    assert delayed.expected_failing_finding == "adas.aeb.threat_response"
    assert delayed.expected_triage_category == "STALE_OBSERVATION"


def test_wp1_preserves_existing_scenario_controller_and_gate_digests(
    repository_root: Path,
) -> None:
    for name, expected in EXISTING_ADAS_SCENARIO_DIGESTS.items():
        scenario = load_scenario(repository_root / "scenarios" / "adas" / name)
        assert scenario_digest(scenario) == expected, name
    for name, expected in EXISTING_ADAS_CONFIG_DIGESTS.items():
        config = load_adas_config(repository_root / "config" / "adas" / name)
        assert config_digest(config.model_dump(mode="json")) == expected, name

    gate = load_gate_config(repository_root / "config" / "gates.adas.yaml")
    assert gate_config_digest(gate) == (
        "026fed87eb047c4c9f2bafcf3383387919f2b0ed9874a0c67227c53f313175d8"
    )
