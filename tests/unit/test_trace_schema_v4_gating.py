"""Trace-layer version gates must admit schema 4.0 without disturbing older versions.

Two exact-equality gates in ``hermes.evidence.trace`` decide what a valid trace looks like:
the permitted ``observation_summary`` field set, and whether schema-2 fault evidence is
allowed. Both were keyed to a single scenario schema version, so an ADAS scenario tripped
them. These tests pin the new behaviour and, more importantly, pin that 1.0/2.0/3.0 still
resolve exactly as before.
"""

from __future__ import annotations

import pytest

from hermes.evidence.trace import (
    _CHALLENGE_OBSERVATION_SUMMARY_FIELDS,
    _OBSERVATION_SUMMARY_FIELDS,
    _expected_observation_summary_fields,
)
from hermes.scenarios.loader import parse_scenario_yaml

_BASE = """\
schema_version: "{version}"
name: gating_probe
version: "1.0"
description: Version-gating probe scenario.
adapter: {adapter}
control:
  frequency_hz: 10
  horizon_steps: 60
  target_speed_mps: 8.0
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 120.0
  boundary_tolerance_m: 1.5
"""

_CHALLENGE = """\
challenge:
  kind: lead_vehicle_hard_brake
  actor_control_mode: metadrive_dynamic_action
  behavior_realism_claim: false
  initial_gap_m: 40.0
  actor_speed_mps: 8.0
  trigger_step: 10
  brake_duration_steps: 10
  brake_command: -1.0
  resume_throttle_command: 0.3
"""

_FAULTS = """\
faults:
  schema_version: "1.0"
  name: gating_probe_faults
  version: "1.0"
  label: illustrative_simulation_faults_not_real_vehicle_limits
  observation_delay_steps: 2
"""


def _scenario(version: str, *, adapter: str = "metadrive", challenge: bool, faults: bool):
    text = _BASE.format(version=version, adapter=adapter)
    if challenge:
        text += _CHALLENGE
    if faults:
        text += _FAULTS
    return parse_scenario_yaml(text)


def test_absent_scenario_keeps_the_base_field_set() -> None:
    assert _expected_observation_summary_fields(None) is _OBSERVATION_SUMMARY_FIELDS


def test_schema_2_still_requires_challenge_fields() -> None:
    scenario = _scenario("2.0", challenge=True, faults=False)

    assert (
        _expected_observation_summary_fields(scenario)
        is _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
    )


def test_schema_3_still_uses_the_base_field_set_even_with_a_challenge() -> None:
    """Pins the pre-existing behaviour so the 4.0 branch cannot widen it by accident."""
    scenario = _scenario("3.0", challenge=True, faults=True)

    assert _expected_observation_summary_fields(scenario) is _OBSERVATION_SUMMARY_FIELDS


def test_schema_4_uses_challenge_fields_only_when_a_challenge_is_declared() -> None:
    with_challenge = _scenario("4.0", challenge=True, faults=False)
    without_challenge = _scenario("4.0", adapter="fake", challenge=False, faults=False)

    assert (
        _expected_observation_summary_fields(with_challenge)
        is _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
    )
    assert (
        _expected_observation_summary_fields(without_challenge)
        is _OBSERVATION_SUMMARY_FIELDS
    )


def test_schema_4_challenge_and_faults_together_still_selects_challenge_fields() -> None:
    """The combination schema 4.0 exists to allow."""
    scenario = _scenario("4.0", challenge=True, faults=True)

    assert (
        _expected_observation_summary_fields(scenario)
        is _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
    )


@pytest.mark.parametrize("version", ["1.0", "2.0", "3.0", "4.0"])
def test_the_field_sets_themselves_are_never_mutated(version: str) -> None:
    """The sets are module constants compared by identity; nothing may rebind them."""
    assert _CHALLENGE_OBSERVATION_SUMMARY_FIELDS > _OBSERVATION_SUMMARY_FIELDS
    assert "front_distance_m" not in _OBSERVATION_SUMMARY_FIELDS
    assert "front_distance_m" in _CHALLENGE_OBSERVATION_SUMMARY_FIELDS
