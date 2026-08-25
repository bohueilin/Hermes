"""The thinnest fleet engine that can express FLEET-005 honestly.

An event-driven loop over the world tape: requests arrive (exogenous), the nearest idle
vehicle is dispatched, trips complete, and every ``trips_between_service`` completed trips a
vehicle must pass through a depot service bay whose duration is the experiment's variation
axis. Availability pressure from longer turnaround is what connects the offboard change to
rider wait — the causal path FLEET-005 exists to measure.

Deliberately absent (P0-later, per the spike cut): charging, repositioning, multiple depots,
party size, cancellation behaviour beyond a max-wait timeout, and any policy SDK — dispatch
is an internal function. The engine's state is not evidence; the decision record is. What the
engine must be is *deterministic*: same scenario + same tape → identical events and metrics.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from enum import StrEnum

from hermes.fleet.contracts import FleetScenarioConfig
from hermes.fleet.world import WorldTape


class VehicleStatus(StrEnum):
    IDLE = "IDLE"
    ENROUTE_PICKUP = "ENROUTE_PICKUP"
    ON_TRIP = "ON_TRIP"
    QUEUED_SERVICE = "QUEUED_SERVICE"
    IN_SERVICE = "IN_SERVICE"


class RequestState(StrEnum):
    WAITING = "WAITING"
    ASSIGNED = "ASSIGNED"
    COMPLETED = "COMPLETED"
    UNSERVED = "UNSERVED"


@dataclass
class _Vehicle:
    vehicle_id: str
    zone: str
    status: VehicleStatus = VehicleStatus.IDLE
    trips_since_service: int = 0
    completed_trips: int = 0
    busy_since_s: int = 0
    busy_total_s: int = 0
    current_request_id: str | None = None


@dataclass
class _Request:
    request_id: str
    time_s: int
    origin: str
    destination: str
    state: RequestState = RequestState.WAITING
    assigned_vehicle_id: str | None = None
    pickup_time_s: int | None = None


@dataclass
class RunLog:
    """Everything the invariants and metrics need — the engine's only output."""

    scenario: FleetScenarioConfig
    requests: dict[str, _Request] = field(default_factory=dict)
    vehicles: dict[str, _Vehicle] = field(default_factory=dict)
    #: (time_s, event_type, entity_id) in emission order — clock monotonicity is checkable.
    events: list[tuple[int, str, str]] = field(default_factory=list)
    service_queue_waits_s: list[int] = field(default_factory=list)
    max_bays_in_use: int = 0


def _travel_s(scenario: FleetScenarioConfig, origin: str, dest: str, multiplier: float) -> int:
    base = (
        scenario.in_zone_pickup_s
        if origin == dest
        else scenario.travel_time_s[f"{origin}->{dest}"]
    )
    return max(1, int(round(base * multiplier)))


def run_fleet(
    scenario: FleetScenarioConfig,
    tape: WorldTape,
    *,
    dispatch_mode: str = "nearest",
) -> RunLog:
    """One deterministic episode over one tape.

    ``dispatch_mode="defect_double_assign"`` exists for the seeded-defect suite: it assigns
    an already-busy vehicle, which invariant 2 must catch. The defect is in the *dispatcher*,
    the component under test — the same design as the ADAS seeded controllers.
    """
    log = RunLog(scenario=scenario)
    for index in range(scenario.vehicle_count):
        zone = scenario.zones[index % len(scenario.zones)]
        vehicle_id = f"v-{index}"
        log.vehicles[vehicle_id] = _Vehicle(vehicle_id=vehicle_id, zone=zone)

    #: heap of (time_s, sequence, kind, entity_id); sequence breaks ties deterministically.
    heap: list[tuple[int, int, str, str]] = []
    sequence = 0

    def push(time_s: int, kind: str, entity_id: str) -> None:
        nonlocal sequence
        heapq.heappush(heap, (time_s, sequence, kind, entity_id))
        sequence += 1

    for event in tape.demand:
        log.requests[event.request_id] = _Request(
            request_id=event.request_id,
            time_s=event.time_s,
            origin=event.origin,
            destination=event.destination,
        )
        push(event.time_s, "REQUEST_CREATED", event.request_id)
        push(event.time_s + scenario.max_wait_s, "WAIT_DEADLINE", event.request_id)

    waiting: list[str] = []  # request ids in arrival order
    bays_in_use = 0
    service_wait_since: dict[str, int] = {}
    defect_armed = dispatch_mode == "defect_double_assign"

    def try_dispatch(now_s: int) -> None:
        nonlocal bays_in_use, defect_armed
        while waiting:
            request = log.requests[waiting[0]]
            idle = [v for v in log.vehicles.values() if v.status is VehicleStatus.IDLE]
            chosen: _Vehicle | None = None
            if defect_armed:
                # The seeded defect: grab any busy vehicle if one exists, exactly once.
                busy = [
                    v
                    for v in log.vehicles.values()
                    if v.status in {VehicleStatus.ENROUTE_PICKUP, VehicleStatus.ON_TRIP}
                ]
                if busy:
                    chosen = min(busy, key=lambda v: v.vehicle_id)
                    defect_armed = False
            if chosen is None:
                if not idle:
                    return
                chosen = min(
                    idle,
                    key=lambda v: (
                        _travel_s(
                            scenario,
                            v.zone,
                            request.origin,
                            tape.travel_multiplier[request.request_id],
                        ),
                        v.vehicle_id,
                    ),
                )
            waiting.pop(0)
            request.state = RequestState.ASSIGNED
            request.assigned_vehicle_id = chosen.vehicle_id
            multiplier = tape.travel_multiplier[request.request_id]
            pickup_at = now_s + _travel_s(scenario, chosen.zone, request.origin, multiplier)
            dropoff_at = pickup_at + _travel_s(
                scenario, request.origin, request.destination, multiplier
            )
            request.pickup_time_s = pickup_at
            chosen.status = VehicleStatus.ENROUTE_PICKUP
            chosen.current_request_id = request.request_id
            chosen.busy_since_s = now_s
            log.events.append((now_s, "REQUEST_ASSIGNED", request.request_id))
            push(pickup_at, "PICKUP_COMPLETED", request.request_id)
            push(dropoff_at, "TRIP_COMPLETED", request.request_id)

    while heap:
        now_s, _, kind, entity_id = heapq.heappop(heap)
        if now_s > scenario.horizon_s and kind == "REQUEST_CREATED":
            continue
        if kind == "REQUEST_CREATED":
            log.events.append((now_s, kind, entity_id))
            waiting.append(entity_id)
            try_dispatch(now_s)
        elif kind == "WAIT_DEADLINE":
            request = log.requests[entity_id]
            if request.state is RequestState.WAITING:
                request.state = RequestState.UNSERVED
                waiting.remove(entity_id)
                log.events.append((now_s, "REQUEST_UNSERVED", entity_id))
        elif kind == "PICKUP_COMPLETED":
            request = log.requests[entity_id]
            vehicle = log.vehicles[request.assigned_vehicle_id or ""]
            vehicle.status = VehicleStatus.ON_TRIP
            vehicle.zone = request.origin
            log.events.append((now_s, kind, entity_id))
        elif kind == "TRIP_COMPLETED":
            request = log.requests[entity_id]
            vehicle = log.vehicles[request.assigned_vehicle_id or ""]
            request.state = RequestState.COMPLETED
            vehicle.zone = request.destination
            vehicle.current_request_id = None
            vehicle.completed_trips += 1
            vehicle.trips_since_service += 1
            vehicle.busy_total_s += now_s - vehicle.busy_since_s
            log.events.append((now_s, kind, entity_id))
            if vehicle.trips_since_service >= scenario.trips_between_service:
                vehicle.status = VehicleStatus.QUEUED_SERVICE
                service_wait_since[vehicle.vehicle_id] = now_s
                log.events.append((now_s, "SERVICE_QUEUE_ENTERED", vehicle.vehicle_id))
                push(now_s, "SERVICE_TRY_START", vehicle.vehicle_id)
            else:
                vehicle.status = VehicleStatus.IDLE
                try_dispatch(now_s)
        elif kind == "SERVICE_TRY_START":
            vehicle = log.vehicles[entity_id]
            if vehicle.status is not VehicleStatus.QUEUED_SERVICE:
                continue
            if bays_in_use < scenario.service_bays:
                bays_in_use += 1
                log.max_bays_in_use = max(log.max_bays_in_use, bays_in_use)
                vehicle.status = VehicleStatus.IN_SERVICE
                log.service_queue_waits_s.append(now_s - service_wait_since.pop(entity_id))
                log.events.append((now_s, "SERVICE_STARTED", entity_id))
                push(now_s + scenario.service_duration_s, "SERVICE_COMPLETED", entity_id)
            # else: stay queued; a completing service re-triggers every queued vehicle.
        elif kind == "SERVICE_COMPLETED":
            vehicle = log.vehicles[entity_id]
            bays_in_use -= 1
            vehicle.status = VehicleStatus.IDLE
            vehicle.trips_since_service = 0
            log.events.append((now_s, kind, entity_id))
            for queued in sorted(
                v.vehicle_id
                for v in log.vehicles.values()
                if v.status is VehicleStatus.QUEUED_SERVICE
            ):
                push(now_s, "SERVICE_TRY_START", queued)
            try_dispatch(now_s)
    return log


def run_metrics(log: RunLog) -> dict[str, float]:
    """Operational metrics and labelled business proxies for one run.

    A metric whose population is empty is absent from the dict — the comparison layer
    reports it NOT_AVAILABLE rather than inventing a zero.
    """

    def percentile(values: list[int], q: float) -> float:
        ordered = sorted(values)
        if not ordered:
            raise ValueError("empty")
        position = (len(ordered) - 1) * q
        low = int(position)
        high = min(low + 1, len(ordered) - 1)
        return ordered[low] + (ordered[high] - ordered[low]) * (position - low)

    requests = list(log.requests.values())
    waits = [
        r.pickup_time_s - r.time_s
        for r in requests
        if r.state is RequestState.COMPLETED and r.pickup_time_s is not None
    ]
    served = sum(1 for r in requests if r.state is RequestState.COMPLETED)
    unserved = sum(1 for r in requests if r.state is RequestState.UNSERVED)
    horizon = log.scenario.horizon_s
    metrics: dict[str, float] = {
        "requests.total": float(len(requests)),
        "requests.served": float(served),
        "requests.unserved": float(unserved),
        "unserved.fraction": unserved / len(requests) if requests else 0.0,
        "fleet.utilization_fraction": (
            sum(v.busy_total_s for v in log.vehicles.values())
            / (horizon * len(log.vehicles))
        ),
        "business_proxy.served_trips": float(served),
        "business_proxy.unserved_demand": float(unserved),
    }
    if waits:
        metrics["wait.p50_s"] = percentile(waits, 0.50)
        metrics["wait.p90_s"] = percentile(waits, 0.90)
    if log.service_queue_waits_s:
        metrics["depot.queue_p90_s"] = percentile(log.service_queue_waits_s, 0.90)
    return metrics
