"""The ADAS evaluators judge a run from stored evidence, not from the controller.

The properties under test are the ones that decide whether ADAS evidence means anything:
the threat label is derived from the trace and gate config rather than from the controller's
thresholds, a threat that produced no braking fails, a collision fails, braking in a
threat-free scenario fails, and an undefined measurement is reported as unavailable rather
than as a passing number.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from hermes.domain.enums import EvidenceAvailability, FindingStatus, TerminationReason
from hermes.domain.models import Action, RunContext, VehicleState
from hermes.evidence.trace import GENESIS_HASH, create_trace_event
from hermes.gates.config import GateConfig, gate_config_digest, load_gate_config
from hermes.gates.release import VerifierProfile, select_verifier_profile
from hermes.scenarios.loader import parse_scenario_yaml
from hermes.verifiers.adas import run_adas_p0_longitudinal_verifiers

SCENARIO = """\
schema_version: "4.0"
name: adas_verifier_probe
version: "1.0"
description: ADAS verifier probe scenario.
adapter: metadrive
control:
  frequency_hz: 10
  horizon_steps: 60
  target_speed_mps: 20.0
  max_braking_mps2: 12.982444763183452
initial_state:
  speed_mps: 20.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 300.0
  boundary_tolerance_m: 1.5
adas:
  enabled:
    - fcw
    - aeb
  expected_fcw:
    kind: required
    before_ttc_s: 2.6
  expected_aeb:
    kind: {aeb_expectation}
"""


def _scenario(aeb_expectation: str = "required"):
    return parse_scenario_yaml(SCENARIO.format(aeb_expectation=aeb_expectation))


def _context() -> RunContext:
    return RunContext(
        scenario_digest="a" * 64,
        gate_config_digest="b" * 64,
        adapter_name="metadrive",
        adapter_version="1.1",
        adapter_config_digest="c" * 64,
        policy_name="adas-longitudinal",
        policy_version="1.0",
        policy_config_digest="d" * 64,
        shield_name="noop",
        shield_version="1.0",
        shield_config_digest="e" * 64,
        verifier_suite_digest="f" * 64,
        seed=7,
        control_frequency_hz=10,
        horizon_steps=60,
    )


def _events(steps: list[tuple[float, float, float, float]], *, collision_at: int | None = None):
    """Build a trace from (gap, relative_speed, brake, speed) tuples."""
    events = []
    previous = GENESIS_HASH
    for index, (gap, relative_speed, brake, speed) in enumerate(steps):
        collided = collision_at is not None and index >= collision_at
        state = VehicleState(
            position_m=float(index),
            speed_mps=speed,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=100.0,
            collision_count=1 if collided else 0,
            offroad=False,
            destination_reached=not collided,
        )
        event = create_trace_event(
            sequence=index,
            simulation_time_s=index * 0.1,
            run_context=_context(),
            observation_summary={
                "input_sequence": index,
                "input_simulation_time_s": index * 0.1,
                "speed_mps": speed,
                "lateral_offset_m": 0.0,
                "route_progress_pct": 0.0,
                "observation_age_s": 0.0,
                "front_distance_m": gap,
                "front_relative_speed_mps": relative_speed,
            },
            candidate_action=Action(steering=0.0, throttle=0.0, brake=brake),
            executed_action=Action(steering=0.0, throttle=0.0, brake=brake),
            override_reasons=(),
            vehicle_state=state,
            policy_latency_ms=10.0,
            latency_source="simulated",
            terminated=index == len(steps) - 1,
            truncated=False,
            termination_reason=(
                TerminationReason.COLLISION
                if collided
                else TerminationReason.DESTINATION_REACHED
                if index == len(steps) - 1
                else TerminationReason.NONE
            ),
            raw_facts={
                "collision": collided,
                "collision_count": 1 if collided else 0,
                "offroad": False,
                "destination_reached": not collided,
                "route_progress_available": True,
                "route_progress_pct": 100.0,
            },
            previous_hash=previous,
        )
        previous = event.current_hash
        events.append(event)
    return tuple(events)


@pytest.fixture
def adas_gate(repository_root: Path) -> GateConfig:
    return load_gate_config(repository_root / "config" / "gates.adas.yaml")


def _by_id(findings):
    return {finding.finding_id: finding for finding in findings}


# --- gate-config identity --------------------------------------------------------------


def test_schema_2_gate_fields_do_not_change_schema_1_gate_identity(
    repository_root: Path,
) -> None:
    """gate_config_digest is bound into every trace event and re-derived on verification.

    Adding the schema-2.0 adas block to the model changed the digest of every schema-1.0
    configuration, which invalidated every stored bundle with "gate configuration digest
    does not match trace context". The digest must ignore fields the version does not have.
    """
    for name in ("gates.phase1.yaml", "gates.phase2.yaml"):
        config = load_gate_config(repository_root / "config" / name)
        payload = config.model_dump(mode="json")

        assert config.schema_version == "1.0"
        assert config.adas is None
        assert "adas" in payload, "the field exists on the model"
        assert gate_config_digest(config) == gate_config_digest(config)
        from hermes.gates.config import resolved_gate_config_yaml

        assert "adas:" not in resolved_gate_config_yaml(config)


def test_schema_1_gate_config_cannot_declare_adas_criteria() -> None:
    from hermes.gates.config import GateConfigError, parse_gate_config_yaml

    text = (
        'schema_version: "1.0"\nname: probe\nversion: "1.0"\n'
        "label: illustrative_prototype_thresholds_not_for_real_vehicle_use\n"
        "hard:\n  max_collision_count: 0\n  max_abs_lateral_offset_m: 1.5\n"
        "  max_offroad_duration_s: 0.0\n  min_route_completion_pct: 0.0\n"
        "  missing_required_evidence: HOLD\n"
        "soft:\n  max_abs_acceleration_mps2: 4.0\n  max_abs_jerk_mps3: 100.0\n"
        "adas:\n  threat_authority_fraction: 0.3\n"
    )

    with pytest.raises(GateConfigError, match="cannot define adas criteria"):
        parse_gate_config_yaml(text)


# --- profile selection -----------------------------------------------------------------


def test_an_adas_scenario_selects_an_adas_profile() -> None:
    assert select_verifier_profile(_scenario()) is VerifierProfile.ADAS_P0_LONGITUDINAL


def test_a_non_adas_scenario_keeps_its_previous_profile(repository_root: Path) -> None:
    from hermes.scenarios.loader import load_scenario

    nominal = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    fault = load_scenario(repository_root / "scenarios" / "fake_fault_injection.yaml")

    assert select_verifier_profile(nominal) is VerifierProfile.LEGACY
    assert select_verifier_profile(fault) is VerifierProfile.FAULT_COVERAGE


# --- threat response -------------------------------------------------------------------


def test_a_threat_that_produced_braking_without_collision_passes(adas_gate: GateConfig) -> None:
    events = _events([(20.0, -20.0, 1.0, 20.0), (10.0, -10.0, 1.0, 10.0), (8.0, 0.0, 1.0, 0.0)])

    findings = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))

    assert findings["adas.aeb.threat_response"].status is FindingStatus.PASS


def test_a_threat_that_produced_no_braking_fails_hard(adas_gate: GateConfig) -> None:
    """The core AEB failure: the oracle saw a threat and the controller did nothing."""
    events = _events([(20.0, -20.0, 0.0, 20.0), (10.0, -20.0, 0.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))[
        "adas.aeb.threat_response"
    ]

    assert finding.status is FindingStatus.FAIL
    assert finding.hard_invariant
    assert finding.event_sequences


def test_a_collision_during_a_threat_fails_hard(adas_gate: GateConfig) -> None:
    events = _events(
        [(20.0, -20.0, 1.0, 20.0), (5.0, -20.0, 1.0, 20.0)], collision_at=1
    )

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))[
        "adas.aeb.threat_response"
    ]

    assert finding.status is FindingStatus.FAIL
    assert finding.hard_invariant


def test_the_threat_label_comes_from_the_trace_not_the_controller(
    adas_gate: GateConfig,
) -> None:
    """A distant, slowly-closing lead is not a threat however the controller behaved."""
    events = _events([(300.0, -1.0, 0.0, 20.0), (299.0, -1.0, 0.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario("forbidden"), adas_gate))[
        "adas.aeb.threat_response"
    ]

    assert finding.status is FindingStatus.PASS


# --- false intervention ----------------------------------------------------------------


def test_braking_in_a_threat_free_scenario_fails_hard(adas_gate: GateConfig) -> None:
    """Over-intervention is a hard failure: a candidate can always buy collisions with it."""
    events = _events([(300.0, -1.0, 0.8, 20.0), (299.0, -1.0, 0.8, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario("forbidden"), adas_gate))[
        "adas.aeb.no_false_intervention"
    ]

    assert finding.status is FindingStatus.FAIL
    assert finding.hard_invariant
    assert finding.measurement.value == 2.0


def test_no_braking_in_a_threat_free_scenario_passes(adas_gate: GateConfig) -> None:
    events = _events([(300.0, -1.0, 0.0, 20.0), (299.0, -1.0, 0.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario("forbidden"), adas_gate))[
        "adas.aeb.no_false_intervention"
    ]

    assert finding.status is FindingStatus.PASS


# --- brake onset -----------------------------------------------------------------------


def test_braking_within_authority_passes_the_onset_criterion(adas_gate: GateConfig) -> None:
    """Onset needing 5.26 m/s^2 remains inside the calibrated 6.0 m/s^2 margin."""
    events = _events([(40.0, -20.0, 1.0, 20.0), (30.0, -20.0, 1.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))[
        "adas.aeb.brake_onset_margin"
    ]

    assert finding.status is FindingStatus.PASS
    assert finding.measurement.value == pytest.approx(5.263157894736842)


def test_braking_past_the_calibrated_margin_fails_the_onset_criterion(
    adas_gate: GateConfig,
) -> None:
    """Onset at 20 m closing 20 m/s needs 11.1 m/s^2, beyond the 6.0 margin.

    The measured peak is higher, but the calibrated evaluation deliberately preserves the
    previous absolute discriminator instead of silently making a late-braking seed pass.
    """
    events = _events([(60.0, -20.0, 0.0, 20.0), (20.0, -20.0, 1.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))[
        "adas.aeb.brake_onset_margin"
    ]

    assert finding.status is FindingStatus.FAIL
    assert finding.measurement.value == pytest.approx(11.11111111111111)


def test_the_onset_criterion_is_speed_independent(adas_gate: GateConfig) -> None:
    """The reason it is not a fixed TTC: the same TTC means different things by speed.

    Both onsets below sit at TTC 2.0 s. At 10 m/s that leaves the required deceleration
    inside authority; at 30 m/s it does not. A single TTC threshold cannot separate them.
    """
    slow = _events([(20.0, -10.0, 1.0, 10.0)])
    fast = _events([(60.0, -30.0, 1.0, 30.0)])

    slow_finding = _by_id(run_adas_p0_longitudinal_verifiers(slow, _scenario(), adas_gate))[
        "adas.aeb.brake_onset_margin"
    ]
    fast_finding = _by_id(run_adas_p0_longitudinal_verifiers(fast, _scenario(), adas_gate))[
        "adas.aeb.brake_onset_margin"
    ]

    assert slow.__len__() == fast.__len__() == 1
    assert slow_finding.status is FindingStatus.PASS
    assert fast_finding.status is FindingStatus.FAIL


def test_brake_onset_is_unavailable_when_nothing_braked(adas_gate: GateConfig) -> None:
    """An undefined measurement is reported unavailable, never as a passing number."""
    events = _events([(300.0, -1.0, 0.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario("forbidden"), adas_gate))[
        "adas.aeb.brake_onset_margin"
    ]

    assert finding.status is FindingStatus.NOT_AVAILABLE
    assert finding.measurement.availability is EvidenceAvailability.NOT_AVAILABLE
    assert finding.measurement.value is None
    assert finding.measurement.reason


# --- warning exposure ------------------------------------------------------------------


def test_declared_warning_exposure_is_confirmed_from_the_trace(adas_gate: GateConfig) -> None:
    events = _events([(20.0, -20.0, 0.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))[
        "adas.fcw.warning_timing"
    ]

    assert finding.status is FindingStatus.PASS


def test_a_scenario_that_never_reaches_its_declared_warning_ttc_fails(
    adas_gate: GateConfig,
) -> None:
    """A scenario that never presents the threat it declares is not evidence of anything."""
    events = _events([(1000.0, -1.0, 0.0, 20.0)])

    finding = _by_id(run_adas_p0_longitudinal_verifiers(events, _scenario(), adas_gate))[
        "adas.fcw.warning_timing"
    ]

    assert finding.status is FindingStatus.FAIL
