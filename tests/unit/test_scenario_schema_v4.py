"""Scenario schema 4.0: ADAS blocks, challenge-with-faults, and digest stability.

Schema 4.0 is the first version that may declare a scripted challenge and a fault profile
at the same time, which every ADAS degradation scenario needs. It also adds the optional
``odd``, ``tags``, ``adas`` and ``requirements`` blocks.

The load-bearing property here is negative: adding those fields must not change the
identity of any 1.0/2.0/3.0 scenario. ``scenario_digest`` is recomputed during
re-verification and compared to the value stored in every bundle's run context, so a digest
that shifts would invalidate stored evidence wholesale.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from hermes.scenarios.loader import (
    ScenarioLoadError,
    load_scenario,
    parse_scenario_yaml,
    resolved_scenario_yaml,
    scenario_digest,
)

ADAS_SCENARIO = """\
schema_version: "4.0"
name: adas_unit_lead_brake
version: "1.0"
description: ADAS unit scenario with a scripted lead vehicle and observation delay.
adapter: metadrive
control:
  frequency_hz: 10
  horizon_steps: 60
  target_speed_mps: 20.0
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 300.0
  boundary_tolerance_m: 1.5
challenge:
  kind: lead_vehicle_hard_brake
  actor_control_mode: metadrive_dynamic_action
  behavior_realism_claim: false
  initial_gap_m: 40.0
  actor_speed_mps: 20.0
  trigger_step: 20
  brake_duration_steps: 20
  brake_command: -1.0
  resume_throttle_command: 0.3
faults:
  schema_version: "1.0"
  name: adas_observation_delay
  version: "1.0"
  label: illustrative_simulation_faults_not_real_vehicle_limits
  observation_delay_steps: 2
tags:
  - aeb
  - longitudinal
odd:
  road_type:
    - highway
  weather:
    - clear
  lighting:
    - daylight
  min_speed_mps: 0.0
  max_speed_mps: 30.0
adas:
  enabled:
    - fcw
    - aeb
  expected_fcw:
    kind: required
    before_ttc_s: 2.6
  expected_aeb:
    kind: required
requirements:
  - property_id: no_runtime_error
    verifier: SystemReliabilityVerifier
    metric: system_runtime_error_count
    operator: "=="
    threshold: 0.0
    unit: count
    hard: true
"""


def _strip_block(text: str, block: str) -> str:
    """Drop one top-level YAML block, keeping everything else byte-identical."""
    kept: list[str] = []
    skipping = False
    for line in text.splitlines(keepends=True):
        if line.startswith(f"{block}:"):
            skipping = True
            continue
        if skipping and line[:1] not in {" ", "-"}:
            skipping = False
        if not skipping:
            kept.append(line)
    return "".join(kept)


def _without(block: str) -> str:
    return _strip_block(ADAS_SCENARIO, block)


# --- identity stability for existing schema versions ---------------------------------


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
def test_schema_4_fields_do_not_change_pre_v4_identity(
    repository_root: Path,
    name: str,
    expected_digest: str,
) -> None:
    """The golden schema-1.0 digests must survive every 4.0-only field addition."""
    scenario = load_scenario(repository_root / "scenarios" / name)

    assert scenario_digest(scenario) == expected_digest


@pytest.mark.parametrize("block", ["odd", "tags", "adas", "requirements"])
def test_schema_4_only_blocks_are_absent_from_pre_v4_serialization(
    repository_root: Path,
    block: str,
) -> None:
    """A 4.0-only field must not appear in the resolved form of an older scenario."""
    for name in sorted(path.name for path in (repository_root / "scenarios").glob("*.yaml")):
        path = repository_root / "scenarios" / name
        try:
            scenario = load_scenario(path)
        except ScenarioLoadError:
            continue  # stale example documents are covered elsewhere
        if scenario.schema_version == "4.0":
            continue
        assert f"{block}:" not in resolved_scenario_yaml(scenario), name


def test_every_committed_scenario_still_loads(repository_root: Path) -> None:
    loaded = 0
    for path in sorted((repository_root / "scenarios").glob("*.yaml")):
        if path.name.endswith(".example.yaml"):
            continue
        load_scenario(path)
        loaded += 1
    assert loaded == 8, "the committed non-example scenario set changed unexpectedly"


# --- schema 4.0 acceptance ------------------------------------------------------------


def test_schema_4_accepts_a_challenge_and_a_fault_profile_together() -> None:
    """The combination every ADAS degradation scenario needs, forbidden before 4.0."""
    scenario = parse_scenario_yaml(ADAS_SCENARIO)

    assert scenario.schema_version == "4.0"
    assert scenario.challenge is not None
    assert scenario.faults is not None
    assert scenario.tags == ("aeb", "longitudinal")
    assert scenario.adas is not None
    assert scenario.adas.enabled == ("fcw", "aeb")
    assert scenario.odd is not None
    assert scenario.requirements[0].property_id == "no_runtime_error"


def test_schema_4_permits_a_faultless_scenario() -> None:
    """Nominal-exposure scenarios carry no faults; the schema-3 rule must not apply."""
    scenario = parse_scenario_yaml(_without("faults"))

    assert scenario.faults is None


def test_schema_4_permits_a_challengeless_scenario() -> None:
    text = _without("challenge").replace("adapter: metadrive", "adapter: fake")
    scenario = parse_scenario_yaml(text)

    assert scenario.challenge is None


def test_schema_4_blocks_are_optional() -> None:
    """A 4.0 scenario needs none of the new blocks."""
    text = ADAS_SCENARIO
    for block in ("odd", "adas", "requirements", "tags"):
        text = _strip_block(text, block)

    scenario = parse_scenario_yaml(text)

    assert scenario.odd is None
    assert scenario.adas is None
    assert scenario.tags == ()
    assert scenario.requirements == ()


# --- schema 4.0 validation ------------------------------------------------------------


def test_schema_4_rejects_a_control_frequency_without_an_exact_decision_interval() -> None:
    """MetaDrive steps physics at 0.02 s, so only divisors of 50 Hz are representable."""
    text = ADAS_SCENARIO.replace("frequency_hz: 10", "frequency_hz: 30")

    with pytest.raises(ScenarioLoadError, match="decision interval"):
        parse_scenario_yaml(text)


@pytest.mark.parametrize("frequency", [1, 2, 5, 10, 25, 50])
def test_schema_4_accepts_representable_control_frequencies(frequency: int) -> None:
    text = ADAS_SCENARIO.replace("frequency_hz: 10", f"frequency_hz: {frequency}")

    assert parse_scenario_yaml(text).control.frequency_hz == frequency


@pytest.mark.parametrize("frequency", [3, 20, 30, 60, 7])
def test_schema_4_rejects_unrepresentable_control_frequencies(frequency: int) -> None:
    text = ADAS_SCENARIO.replace("frequency_hz: 10", f"frequency_hz: {frequency}")

    with pytest.raises(ScenarioLoadError):
        parse_scenario_yaml(text)


def test_schema_4_rejects_an_odd_speed_range_that_excludes_the_target_speed() -> None:
    text = ADAS_SCENARIO.replace("max_speed_mps: 30.0", "max_speed_mps: 5.0")

    with pytest.raises(ScenarioLoadError, match="ODD speed range"):
        parse_scenario_yaml(text)


def test_schema_4_rejects_an_inverted_odd_speed_range() -> None:
    text = ADAS_SCENARIO.replace("min_speed_mps: 0.0", "min_speed_mps: 40.0")

    with pytest.raises(ScenarioLoadError):
        parse_scenario_yaml(text)


def test_schema_4_rejects_duplicate_tags() -> None:
    text = ADAS_SCENARIO.replace("  - longitudinal\n", "  - aeb\n")

    with pytest.raises(ScenarioLoadError, match="tags"):
        parse_scenario_yaml(text)


def test_schema_4_rejects_duplicate_requirement_property_ids() -> None:
    text = ADAS_SCENARIO + (
        "  - property_id: no_runtime_error\n"
        "    verifier: SystemReliabilityVerifier\n"
        "    metric: system_runtime_error_count\n"
        '    operator: "=="\n'
        "    threshold: 0.0\n"
        "    unit: count\n"
        "    hard: true\n"
    )

    with pytest.raises(ScenarioLoadError, match="property_id"):
        parse_scenario_yaml(text)


def test_pre_v4_schema_versions_still_reject_schema_4_blocks() -> None:
    text = ADAS_SCENARIO.replace('schema_version: "4.0"', 'schema_version: "3.0"')

    with pytest.raises(ScenarioLoadError):
        parse_scenario_yaml(text)


def test_schema_4_rejects_a_declared_but_empty_fault_profile() -> None:
    """A fault block that configures no mechanism is a silent no-op; reject it."""
    text = ADAS_SCENARIO.replace("  observation_delay_steps: 2\n", "")

    with pytest.raises(ScenarioLoadError, match="must be enabled"):
        parse_scenario_yaml(text)


def test_schema_3_still_requires_an_enabled_fault_profile() -> None:
    """The schema-3 rule must survive being moved out of a catch-all else branch."""
    text = _strip_block(ADAS_SCENARIO, "challenge")
    text = text.replace('schema_version: "4.0"', 'schema_version: "3.0"')
    text = text.replace("adapter: metadrive", "adapter: fake")
    for block in ("tags", "odd", "adas", "requirements", "faults"):
        text = _strip_block(text, block)

    with pytest.raises(ScenarioLoadError, match="enabled fault profile"):
        parse_scenario_yaml(text)
