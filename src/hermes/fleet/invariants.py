"""Operational invariants (PRD §17): a violation voids the evidence, it never grades the
candidate. "The dispatcher double-assigned a vehicle" is a broken experiment, not a slow
fleet — conflating those two is how a simulator quietly learns to lie.
"""

from __future__ import annotations

from hermes.fleet.engine import RequestState, RunLog, VehicleStatus


def check_invariants(log: RunLog) -> list[str]:
    """Every violated invariant, as ``I<n>: detail`` strings. Empty means the run's
    mechanics are internally consistent — which is not a statement about realism."""
    violations: list[str] = []
    scenario = log.scenario

    # I1: fleet-state counts always equal configured fleet size.
    if len(log.vehicles) != scenario.vehicle_count:
        violations.append(
            f"I1: {len(log.vehicles)} vehicles tracked, {scenario.vehicle_count} configured"
        )

    # I2: a vehicle cannot serve two requests simultaneously.
    open_by_vehicle: dict[str, list[str]] = {}
    for request in log.requests.values():
        if request.assigned_vehicle_id is None:
            continue
        open_by_vehicle.setdefault(request.assigned_vehicle_id, []).append(request.request_id)
    intervals: dict[str, list[tuple[int, int, str]]] = {}
    for request in log.requests.values():
        if request.assigned_vehicle_id and request.pickup_time_s is not None:
            assigned_at = next(
                (t for t, kind, rid in log.events
                 if kind == "REQUEST_ASSIGNED" and rid == request.request_id),
                request.time_s,
            )
            completed_at = next(
                (t for t, kind, rid in log.events
                 if kind == "TRIP_COMPLETED" and rid == request.request_id),
                None,
            )
            if completed_at is not None:
                intervals.setdefault(request.assigned_vehicle_id, []).append(
                    (assigned_at, completed_at, request.request_id)
                )
    for vehicle_id, spans in intervals.items():
        ordered = sorted(spans)
        for (_, e1, r1), (s2, _, r2) in zip(ordered, ordered[1:], strict=False):
            if s2 < e1:
                violations.append(
                    f"I2: vehicle {vehicle_id} overlaps {r1} and {r2} ({s2} < {e1})"
                )

    # I3: a request has at most one terminal state (structural here, asserted for drift).
    for request in log.requests.values():
        if request.state is RequestState.COMPLETED and request.pickup_time_s is None:
            violations.append(f"I3/I8: {request.request_id} completed without a pickup")

    # I4/I5: bay occupancy never exceeds capacity.
    if log.max_bays_in_use > scenario.service_bays:
        violations.append(
            f"I5: {log.max_bays_in_use} bays in use, {scenario.service_bays} configured"
        )

    # I9: vehicles end in a legal state.
    legal = set(VehicleStatus)
    for vehicle in log.vehicles.values():
        if vehicle.status not in legal:
            violations.append(f"I9: vehicle {vehicle.vehicle_id} in {vehicle.status}")

    # I10: every event references an existing entity.
    for _, kind, entity_id in log.events:
        if kind.startswith("REQUEST") and entity_id not in log.requests:
            violations.append(f"I10: {kind} references unknown request {entity_id}")
        if kind.startswith("SERVICE") and entity_id not in log.vehicles:
            violations.append(f"I10: {kind} references unknown vehicle {entity_id}")

    # I11: the simulation clock never moves backward.
    times = [t for t, _, _ in log.events]
    if any(b < a for a, b in zip(times, times[1:], strict=False)):
        violations.append("I11: event log time decreased")

    # Conservation (analytical fixture backbone): served + unserved + still-open = total.
    terminal = sum(
        1
        for r in log.requests.values()
        if r.state in {RequestState.COMPLETED, RequestState.UNSERVED}
    )
    open_states = sum(
        1
        for r in log.requests.values()
        if r.state in {RequestState.WAITING, RequestState.ASSIGNED}
    )
    if terminal + open_states != len(log.requests):
        violations.append("I-conservation: request states do not partition the population")

    return violations
