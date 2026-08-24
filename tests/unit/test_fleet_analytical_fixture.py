"""The analytical fixture: a world small enough to compute by hand, asserted exactly.

Stochastic comparisons can only be trusted once the deterministic mechanics are right, and
"right" here means *derivable on paper*. This fixture bypasses the demand generator entirely —
the tape is hand-written — so every expected number below comes from arithmetic in the
comments, not from running the engine and copying its output.

Scenario: one vehicle starting in zone "a"; travel a<->b = 600 s; in-zone pickup 120 s; all
multipliers 1.0; service after every 2 trips, one bay, 500 s duration; horizon 4,000 s.

Timeline, derived by hand:
  t=0     r1 (a->b) arrives; v-0 idle in a  -> pickup 0+120=120,  dropoff 120+600=720
  t=100   r2 (b->a) arrives; v-0 busy       -> waits in queue
  t=720   r1 completes; v-0 in b, 1 trip since service -> IDLE; dispatch r2:
          pickup 720+120=840, dropoff 840+600=1440        (r2 wait = 840-100 = 740)
  t=1440  r2 completes; v-0 in a, 2 trips -> service bay free: starts 1440 (queue wait 0),
          completes 1440+500=1940; counter resets
  t=2000  r3 (a->b) arrives; v-0 idle in a  -> pickup 2120, dropoff 2720 (r3 wait = 120)

Expected metrics:
  waits sorted            [120, 120, 740]
  wait.p50_s              120.0                       (index position (3-1)*0.5 = 1)
  wait.p90_s              120 + 0.8*(740-120) = 616.0 (position 1.8, linear interpolation)
  busy time               720*3 = 2160 s (assignment to dropoff; service is not trip time)
  utilization             2160 / (4000*1) = 0.54
  depot.queue_p90_s       0.0   (one service visit, zero queue wait)
"""

from __future__ import annotations

from tests.unit.test_fleet_contracts_and_world import small_scenario

from hermes.fleet.engine import run_fleet, run_metrics
from hermes.fleet.invariants import check_invariants
from hermes.fleet.world import RequestEvent, WorldTape

_SCENARIO = dict(
    horizon_s=4000,
    zones=("a", "b"),
    travel_time_s={"a->b": 600, "b->a": 600},
    vehicle_count=1,
    max_wait_s=1000,
    trips_between_service=2,
    service_bays=1,
    service_duration_s=500,
    in_zone_pickup_s=120,
    travel_sigma=0.0,
)

_DEMAND = (
    RequestEvent(request_id="r1", time_s=0, origin="a", destination="b"),
    RequestEvent(request_id="r2", time_s=100, origin="b", destination="a"),
    RequestEvent(request_id="r3", time_s=2000, origin="a", destination="b"),
)


def _hand_written_tape() -> WorldTape:
    return WorldTape(
        seed=0,
        demand=_DEMAND,
        travel_multiplier={event.request_id: 1.0 for event in _DEMAND},
    )


def test_the_hand_computed_world_matches_the_engine_exactly() -> None:
    scenario = small_scenario(**_SCENARIO)
    log = run_fleet(scenario, _hand_written_tape())
    metrics = run_metrics(log)

    assert check_invariants(log) == []
    assert metrics["requests.total"] == 3.0
    assert metrics["requests.served"] == 3.0
    assert metrics["requests.unserved"] == 0.0
    assert metrics["wait.p50_s"] == 120.0
    assert metrics["wait.p90_s"] == 616.0
    assert metrics["fleet.utilization_fraction"] == 2160 / 4000
    assert metrics["depot.queue_p90_s"] == 0.0


def test_the_hand_computed_pickup_and_dropoff_times_hold() -> None:
    scenario = small_scenario(**_SCENARIO)
    log = run_fleet(scenario, _hand_written_tape())

    assert log.requests["r1"].pickup_time_s == 120
    assert log.requests["r2"].pickup_time_s == 840
    assert log.requests["r3"].pickup_time_s == 2120
    completed = {
        rid: t for t, kind, rid in log.events if kind == "TRIP_COMPLETED"
    }
    assert completed == {"r1": 720, "r2": 1440, "r3": 2720}
    service = [(t, kind) for t, kind, _ in log.events if kind.startswith("SERVICE")]
    assert service == [
        (1440, "SERVICE_QUEUE_ENTERED"),
        (1440, "SERVICE_STARTED"),
        (1940, "SERVICE_COMPLETED"),
    ]


def test_a_smaller_bay_delay_shifts_exactly_the_hand_computed_amount() -> None:
    """Metamorphic check: doubling service duration moves nothing before the service visit
    and delays nothing after it — r3 arrives at t=2000, after even the longer service ends
    (1440+1000=2440 > 2000 means v-0 is still IN_SERVICE; dispatch happens at 2440 instead).

    By hand for service_duration_s=1000: r3 pickup = 2440+120 = 2560, wait = 560.
    """
    scenario = small_scenario(**{**_SCENARIO, "service_duration_s": 1000})
    log = run_fleet(scenario, _hand_written_tape())

    assert log.requests["r1"].pickup_time_s == 120
    assert log.requests["r2"].pickup_time_s == 840
    assert log.requests["r3"].pickup_time_s == 2560
