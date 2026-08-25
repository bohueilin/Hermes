"""The FleetLab contracts and the world tape: what is frozen, and what varies.

The rigor claims live here as tests: the demand trace is identical for every seed, only
disturbances vary, disturbance identity is exogenous (keyed to the request, never to the
vehicle a policy happens to choose), and every digest is stable and sensitive.
"""

from __future__ import annotations

import pytest

from hermes.fleet.contracts import (
    CalibrationState,
    ExperimentSpec,
    FleetScenarioConfig,
    Guardrail,
    PrimaryMetric,
)
from hermes.fleet.experiment import FleetExperimentError, apply_axis
from hermes.fleet.world import build_demand_trace, build_tape, tape_digest


def small_scenario(**overrides) -> FleetScenarioConfig:
    payload = dict(
        name="fleet_probe",
        horizon_s=1800,
        zones=("a", "b"),
        travel_time_s={"a->b": 300, "b->a": 300},
        vehicle_count=4,
        demand_per_zone_per_hour=12,
        max_wait_s=600,
        trips_between_service=3,
        service_bays=1,
        service_duration_s=300,
        in_zone_pickup_s=120,
        travel_sigma=0.2,
    )
    payload.update(overrides)
    return FleetScenarioConfig(**payload)


def small_spec(**overrides) -> ExperimentSpec:
    payload = dict(
        experiment_id="probe-experiment",
        decision_owner="AUTHOR_SELF_TEST",
        question="Does a longer service duration degrade wait p90 beyond the margin?",
        scenario=small_scenario(),
        variation_axis="parameter:service_duration_s",
        baseline_value=300,
        candidate_value=600,
        primary_metric=PrimaryMetric(
            name="wait.p90_s", unit="s", direction="lower_is_better", equivalence_margin=20.0
        ),
        guardrails=(
            Guardrail(metric="unserved.fraction", max_harm=0.05, direction="lower_is_better"),
        ),
        seeds=tuple(range(1, 11)),
    )
    payload.update(overrides)
    return ExperimentSpec(**payload)


# --- contracts -------------------------------------------------------------------------


def test_spec_digest_is_stable_and_sensitive() -> None:
    assert small_spec().spec_digest() == small_spec().spec_digest()
    changed = small_spec(candidate_value=601)
    assert changed.spec_digest() != small_spec().spec_digest()


def test_seed_set_digest_freezes_the_exact_seed_tuple() -> None:
    assert small_spec().seed_set_digest() != small_spec(seeds=tuple(range(2, 12))).seed_set_digest()


def test_a_missing_travel_pair_fails_at_construction_not_mid_run() -> None:
    with pytest.raises(ValueError, match="missing zone pairs: b->a"):
        small_scenario(travel_time_s={"a->b": 300})


def test_the_axis_resolves_one_scenario_field_per_arm() -> None:
    spec = small_spec()
    assert apply_axis(spec, spec.baseline_value).service_duration_s == 300
    assert apply_axis(spec, spec.candidate_value).service_duration_s == 600


def test_an_axis_naming_an_unknown_field_is_a_loud_error() -> None:
    spec = small_spec(variation_axis="parameter:no_such_field")
    with pytest.raises(FleetExperimentError, match="unknown scenario field"):
        apply_axis(spec, 1.0)


def test_a_policy_axis_is_not_silently_accepted_in_the_spike() -> None:
    spec = small_spec(variation_axis="policy:nearest")
    with pytest.raises(FleetExperimentError, match="not implemented"):
        apply_axis(spec, 1.0)


def test_real_world_validated_cannot_be_expressed() -> None:
    """The same device as AuthenticityStatus: the enum cannot state the unsupported claim."""
    assert "REAL_WORLD_VALIDATED" not in CalibrationState.__members__


# --- the world tape --------------------------------------------------------------------


def test_the_demand_trace_is_identical_for_every_seed() -> None:
    scenario = small_scenario()
    assert build_tape(scenario, 1).demand == build_tape(scenario, 999).demand
    assert build_tape(scenario, 1).demand == build_demand_trace(scenario)


def test_disturbances_vary_by_seed_but_share_identity() -> None:
    scenario = small_scenario()
    first, second = build_tape(scenario, 1), build_tape(scenario, 2)
    assert set(first.travel_multiplier) == set(second.travel_multiplier)
    assert first.travel_multiplier != second.travel_multiplier


def test_disturbance_identity_is_the_request_never_the_vehicle() -> None:
    """The G1 rule: keys are exogenous. If a multiplier were keyed to the chosen vehicle,
    changing the policy would change the world — silently decoupling the arms."""
    scenario = small_scenario()
    tape = build_tape(scenario, 7)
    request_ids = {event.request_id for event in tape.demand}
    assert set(tape.travel_multiplier) == request_ids


def test_the_tape_digest_covers_the_disturbances() -> None:
    scenario = small_scenario()
    seeds = tuple(range(1, 11))
    assert tape_digest(scenario, seeds) == tape_digest(scenario, seeds)
    assert tape_digest(scenario, seeds) != tape_digest(
        small_scenario(travel_sigma=0.3), seeds
    )


def test_zero_sigma_yields_a_deterministic_world() -> None:
    scenario = small_scenario(travel_sigma=0.0)
    tape = build_tape(scenario, 5)
    assert all(value == 1.0 for value in tape.travel_multiplier.values())
