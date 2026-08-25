"""The fleet engine's honesty properties: determinism, conservation, and the seeded defect.

The engine is trusted only as far as these tests reach: same tape twice gives identical
metrics, request states partition the population, a healthy run violates no invariant, and a
dispatcher broken on purpose is caught by the invariant that names its defect.
"""

from __future__ import annotations

from tests.unit.test_fleet_contracts_and_world import small_scenario

from hermes.fleet.engine import RequestState, run_fleet, run_metrics
from hermes.fleet.invariants import check_invariants
from hermes.fleet.world import build_tape


def test_the_same_tape_replays_to_identical_metrics() -> None:
    scenario = small_scenario()
    tape = build_tape(scenario, 3)
    assert run_metrics(run_fleet(scenario, tape)) == run_metrics(run_fleet(scenario, tape))


def test_request_states_partition_the_population() -> None:
    scenario = small_scenario()
    log = run_fleet(scenario, build_tape(scenario, 3))
    states = [request.state for request in log.requests.values()]
    terminal = sum(1 for s in states if s in {RequestState.COMPLETED, RequestState.UNSERVED})
    open_count = sum(1 for s in states if s in {RequestState.WAITING, RequestState.ASSIGNED})
    assert terminal + open_count == len(states)
    metrics = run_metrics(log)
    assert metrics["requests.served"] + metrics["requests.unserved"] <= metrics["requests.total"]


def test_a_healthy_run_violates_no_invariant() -> None:
    scenario = small_scenario()
    assert check_invariants(run_fleet(scenario, build_tape(scenario, 3))) == []


def test_in_zone_pickups_take_declared_time_not_zero() -> None:
    """Zone granularity must not make co-located pickups instantaneous."""
    scenario = small_scenario(travel_sigma=0.0, vehicle_count=8)
    log = run_fleet(scenario, build_tape(scenario, 1))
    waits = [
        r.pickup_time_s - r.time_s
        for r in log.requests.values()
        if r.state is RequestState.COMPLETED and r.pickup_time_s is not None
    ]
    assert waits and min(waits) >= scenario.in_zone_pickup_s * 0.5


def test_the_seeded_double_assign_defect_is_caught_by_invariant_2() -> None:
    """The evaluation's own acceptance check: a dispatcher broken in exactly one way must
    be caught by the invariant that names the defect — not by generic misbehaviour."""
    scenario = small_scenario(vehicle_count=1, demand_per_zone_per_hour=30)
    log = run_fleet(
        scenario, build_tape(scenario, 3), dispatch_mode="defect_double_assign"
    )
    violations = check_invariants(log)
    assert any(violation.startswith("I2:") for violation in violations), violations


def test_bay_capacity_is_respected() -> None:
    scenario = small_scenario(trips_between_service=1, service_bays=1)
    log = run_fleet(scenario, build_tape(scenario, 3))
    assert log.max_bays_in_use <= scenario.service_bays
    assert check_invariants(log) == []


def test_missing_populations_are_absent_not_zero() -> None:
    """A run with no completed service visits must not report a zero queue percentile."""
    scenario = small_scenario(trips_between_service=100)
    metrics = run_metrics(run_fleet(scenario, build_tape(scenario, 3)))
    assert "depot.queue_p90_s" not in metrics
