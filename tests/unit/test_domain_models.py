from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

import hermes.domain.models as domain_models
from hermes.domain.enums import EvidenceAvailability, FindingStatus, Severity, Verdict
from hermes.domain.models import (
    Action,
    Finding,
    Measurement,
    Observation,
    RunContext,
    ScenarioDefinition,
    VehicleState,
)


def test_action_rejects_out_of_range_and_conflicting_longitudinal_commands() -> None:
    with pytest.raises(ValidationError):
        Action(steering=1.01, throttle=0.0, brake=0.0)
    with pytest.raises(ValidationError):
        Action(steering=0.0, throttle=0.2, brake=0.1)


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_vehicle_state_rejects_non_finite_evidence(value: float) -> None:
    with pytest.raises(ValidationError):
        VehicleState(
            position_m=value,
            speed_mps=0.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=0.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        )


def test_persisted_vehicle_state_rejects_coercion_and_missing_safety_facts() -> None:
    with pytest.raises(ValidationError):
        VehicleState.model_validate(
            {
                "position_m": "1.0",
                "speed_mps": "2.0",
                "acceleration_mps2": "0.0",
                "lateral_offset_m": "0.0",
                "route_progress_pct": "5.0",
            }
        )

    with pytest.raises(ValidationError):
        VehicleState(
            position_m=1.0,
            speed_mps=2.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=5.0,
        )


def test_measurement_requires_value_or_unavailable_reason_consistently() -> None:
    available = Measurement(availability=EvidenceAvailability.AVAILABLE, value=3.5)
    unavailable = Measurement(
        availability=EvidenceAvailability.NOT_AVAILABLE,
        reason="signal not emitted by adapter",
    )

    assert available.value == 3.5
    assert unavailable.reason == "signal not emitted by adapter"
    with pytest.raises(ValidationError):
        Measurement(availability=EvidenceAvailability.AVAILABLE, reason="missing")
    with pytest.raises(ValidationError):
        Measurement(availability=EvidenceAvailability.NOT_AVAILABLE)


@pytest.mark.parametrize("value", [True, False, 1.0, 1.5, 0.5, -1, "1"])
def test_count_measurement_rejects_non_integral_or_negative_values(value: object) -> None:
    count_measurement = domain_models.CountMeasurement

    with pytest.raises(ValidationError):
        count_measurement(availability=EvidenceAvailability.AVAILABLE, value=value)


def test_count_and_boolean_measurements_are_strictly_typed_and_availability_wrapped() -> None:
    count_measurement = domain_models.CountMeasurement
    boolean_measurement = domain_models.BooleanMeasurement

    assert count_measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=0,
        unit="events",
    ).value == 0
    assert boolean_measurement(
        availability=EvidenceAvailability.AVAILABLE,
        value=False,
    ).value is False
    with pytest.raises(ValidationError):
        boolean_measurement(availability=EvidenceAvailability.AVAILABLE, value=0)
    with pytest.raises(ValidationError):
        count_measurement(availability=EvidenceAvailability.NOT_AVAILABLE, unit="events")
    with pytest.raises(ValidationError):
        boolean_measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            value=False,
            reason="not observed",
        )


def test_finding_requires_structured_measurement_and_criterion() -> None:
    required = {
        "finding_id": "collision.zero",
        "verifier": "CollisionVerifier",
        "verifier_version": "1.0",
        "status": FindingStatus.PASS,
        "severity": Severity.CRITICAL,
        "hard_invariant": True,
        "message": "collision invariant passed",
    }

    with pytest.raises(ValidationError, match="measurement"):
        Finding.model_validate(
            {
                **required,
                "threshold_or_invariant": "collision_count == 0",
            }
        )
    with pytest.raises(ValidationError, match="threshold_or_invariant"):
        Finding.model_validate(
            {
                **required,
                "measurement": {
                    "availability": "AVAILABLE",
                    "value": 0.0,
                    "unit": "count",
                },
            }
        )


def test_public_enum_values_are_stable_and_explicit() -> None:
    assert Verdict.PASS.value == "PASS"
    assert Verdict.CONDITIONAL.value == "CONDITIONAL"
    assert Verdict.HOLD.value == "HOLD"
    assert Verdict.INVALID_EVIDENCE.value == "INVALID_EVIDENCE"
    assert FindingStatus.NOT_AVAILABLE.value == "NOT_AVAILABLE"


def _steady_lead_scenario_payload(*, actor_speed_mps: float = 4.0) -> dict[str, object]:
    return {
        "schema_version": "4.0",
        "name": "steady_lead_domain_unit",
        "version": "1.0",
        "description": "Steady lead challenge schema unit scenario.",
        "adapter": "metadrive",
        "control": {
            "frequency_hz": 10,
            "horizon_steps": 2,
            "target_speed_mps": 8.0,
        },
        "initial_state": {"speed_mps": 8.0, "lateral_offset_m": 0.0},
        "road": {"destination_distance_m": 20.0, "boundary_tolerance_m": 1.5},
        "challenge": {
            "kind": "steady_lead",
            "actor_control_mode": "scripted_kinematic_replay",
            "behavior_realism_claim": False,
            "initial_gap_m": 12.0,
            "actor_speed_mps": actor_speed_mps,
            "initial_lane_delta": 0,
        },
    }


def test_steady_lead_challenge_is_an_additive_round_trippable_union_member() -> None:
    scenario = ScenarioDefinition.model_validate(_steady_lead_scenario_payload())

    assert scenario.challenge is not None
    assert scenario.challenge.kind == "steady_lead"
    assert scenario.challenge.model_dump(mode="json") == {
        "kind": "steady_lead",
        "actor_control_mode": "scripted_kinematic_replay",
        "behavior_realism_claim": False,
        "initial_gap_m": 12.0,
        "actor_speed_mps": 4.0,
        "initial_lane_delta": 0,
    }
    assert ScenarioDefinition.model_validate(
        scenario.model_dump(mode="json")
    ).challenge == scenario.challenge


def test_steady_lead_challenge_rejects_zero_actor_speed() -> None:
    with pytest.raises(ValidationError, match="actor_speed_mps"):
        ScenarioDefinition.model_validate(_steady_lead_scenario_payload(actor_speed_mps=0.0))


def test_observation_accepts_the_steady_challenge_phase() -> None:
    observation = Observation(
        sequence=0,
        simulation_time_s=0.0,
        vehicle_state=VehicleState(
            position_m=0.0,
            speed_mps=8.0,
            acceleration_mps2=0.0,
            lateral_offset_m=0.0,
            route_progress_pct=0.0,
            collision_count=0,
            offroad=False,
            destination_reached=False,
        ),
        challenge_phase="STEADY",
    )

    assert observation.challenge_phase == "STEADY"


@pytest.mark.parametrize(
    ("field_name", "value"),
    [("control_frequency_hz", 0), ("control_frequency_hz", 101), ("horizon_steps", 0)],
)
def test_run_context_rejects_unsafe_control_bounds(field_name: str, value: int) -> None:
    payload = {
        "scenario_digest": "a" * 64,
        "gate_config_digest": "b" * 64,
        "adapter_name": "fake",
        "adapter_version": "1.0",
        "adapter_config_digest": "c" * 64,
        "policy_name": "baseline",
        "policy_version": "1.0",
        "policy_config_digest": "d" * 64,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": "e" * 64,
        "verifier_suite_digest": "f" * 64,
        "seed": 7,
        "control_frequency_hz": 10,
        "horizon_steps": 20,
    }
    payload[field_name] = value

    with pytest.raises(ValidationError, match=field_name):
        RunContext.model_validate(payload)
