"""Versioned static-continuity fleet runner; historical engine.py stays frozen.

Keeps the original resource clock and adds arrival-state routing at every fleet
boundary. Does not qualify the source map or support conditional rules yet.
"""

import copy
import math

from .contracts import digest
from .fleet_routing_v2 import MODEL, SCHEMA, FleetRouter, traversed_position
from .pack import distance

STORAGE = {"queue_turnaround", "turnaround", "queue_charge", "charging"}


def reserve_feasible(energy, distance_m, duration_s, kwh_per_m, aux_kw, reserve):
    return energy - distance_m * kwh_per_m - duration_s * aux_kw / 3600 >= reserve - 1e-9


def charge_allocation(active, site_kw, port_kw):
    return [min(port_kw, site_kw / active)] * active if active else []


def capacity_schedule(arrivals, duration, capacity):
    if capacity < 1:
        raise ValueError("capacity must be positive")
    free = [0] * capacity
    ends = []
    for arrival in arrivals:
        slot = min(range(capacity), key=lambda i: (free[i], i))
        end = max(arrival, free[slot]) + duration
        free[slot] = end
        ends.append(end)
    return ends


def run_arm(pack, inputs, spec, stop_at=None):
    return _run_arm(pack, inputs, spec, FleetRouter(pack, spec), MODEL, SCHEMA, stop_at)


def _run_arm(pack, inputs, spec, g, model, schema, stop_at=None):
    spec = copy.deepcopy(spec)
    if spec.get("model") != model:
        raise ValueError("unqualified engine/model")
    if spec.get("background_per_hour", 0) or inputs.get("background") or inputs.get("incidents"):
        raise ValueError("Traffic/background and incidents are not modeled by this graph runner")
    sites = {s["id"]: s for s in spec["sites"]}
    site_nodes = {s["node"] for s in sites.values()}
    if any(s["ports"] < 1 or s["slots"] < 1 or s["power_kw"] <= 0 for s in sites.values()):
        raise ValueError("invalid depot resources")
    events = []
    poses = []
    legs = {}
    counters = {"teleports": 0, "dropped": 0, "insertion_failed": 0, "unreachable_requests": 0}
    vehicles = {}
    requests = {}
    request_list = copy.deepcopy(inputs["requests"])
    created = 0
    limit = min(spec["duration_s"], stop_at) if stop_at is not None else spec["duration_s"]
    charge_signatures = {}

    def emit(t, kind, **data):
        events.append({"seq": len(events), "t": t, "kind": kind, **data})

    def state(v, new, t):
        old = v["state"]
        v["state"] = new
        if old != new:
            emit(
                t,
                "state",
                vehicle=v["id"],
                before=old,
                after=new,
                site=v.get("site"),
                routing_state=copy.deepcopy(v["routing_state"]),
            )

    def nearest_site(arrival, t):
        routes = [(g.plan(arrival, site["node"], t), site) for site in sites.values()]
        routes = [(route, site) for route, site in routes if route is not None]
        return min(routes, key=lambda row: (row[0]["seconds"], row[1]["id"])) if routes else None

    def start_leg(v, node, purpose, t):
        route = g.plan(v["routing_state"], node, t)
        if route is None:
            return False
        lid = f"leg-{len(legs):06d}"
        legs[lid] = route
        v.update(
            leg=lid,
            leg_started_s=t,
            edge_index=0,
            edge_progress=0.0,
            edge_elapsed=0.0,
            leg_distance=0.0,
            target=node,
            in_storage=False,
        )
        state(v, purpose, t)
        emit(t, "leg_start", vehicle=v["id"], leg=lid, purpose=purpose, request=v.get("request"))
        return True

    def depot_arrival(v, t):
        v["in_storage"] = True
        v["queue_enter"] = t
        if v["turnaround_due"]:
            state(v, "queue_turnaround", t)
        elif v["energy"] < spec["return_kwh"]:
            state(v, "queue_charge", t)
        else:
            state(v, "idle", t)

    def arrive(v, t):
        purpose = v["state"]
        v["node"] = v["target"]
        v["routing_state"] = copy.deepcopy(legs[v["leg"]]["arrival_after"])
        emit(
            t,
            "leg_end",
            vehicle=v["id"],
            leg=v["leg"],
            distance_m=v["leg_distance"],
            routing_state=copy.deepcopy(v["routing_state"]),
        )
        v["leg"] = None
        if purpose == "pickup":
            state(v, "boarding", t)
            v["due"] = t + spec["boarding_s"]
        elif purpose == "passenger":
            r = requests[v["request"]]
            r["state"] = "completed"
            r["completed_at"] = t
            emit(t, "completed", request=r["id"], vehicle=v["id"])
            v["trips"] += 1
            v["turnaround_due"] = v["trips"] % spec["turnaround_every"] == 0
            v["request"] = None
            state(v, "idle", t)
        elif purpose == "returning":
            depot_arrival(v, t)

    for raw in inputs["initial"]:
        v = {
            **raw,
            "state": "idle",
            "routing_state": g.initial_state(raw["node"]),
            "routing_position": None,
            "trips": 0,
            "turnaround_due": False,
            "request": None,
            "leg": None,
            "site": None,
            "in_storage": False,
            "distance_m": 0.0,
            "empty_m": 0.0,
            "active_s": 0,
            "charged_kwh": 0.0,
            "queue_s": 0,
            "busy_s": 0,
            "idle_s": 0,
        }
        vehicles[v["id"]] = v
        emit(
            0,
            "initial",
            vehicle=v["id"],
            node=v["node"],
            energy=v["energy"],
            routing_state=copy.deepcopy(v["routing_state"]),
        )

    def checkpoint(t, v):
        emit(
            t,
            "energy",
            vehicle=v["id"],
            energy=v["energy"],
            distance_m=v["distance_m"],
            empty_m=v["empty_m"],
            active_s=v["active_s"],
            charged_kwh=v["charged_kwh"],
            queue_s=v["queue_s"],
            busy_s=v["busy_s"],
            idle_s=v["idle_s"],
        )

    for t in range(limit):
        # Clock order: completed transitions; arrivals; abandonment; returns; resource
        # releases/starts;
        # dispatch; continuous movement/energy for [t,t+1); checkpoint/poses at t+1.
        for v in vehicles.values():
            if v["leg"] and v["edge_index"] >= len(legs[v["leg"]]["edges"]):
                arrive(v, t)
            if v["state"] == "boarding" and t >= v["due"]:
                r = requests[v["request"]]
                r["state"] = "in_progress"
                r["boarded_at"] = t
                emit(t, "boarded", request=r["id"], vehicle=v["id"])
                if not start_leg(v, r["destination"], "passenger", t):
                    emit(t, "violation", code="assigned_route_unreachable", vehicle=v["id"])
            if v["state"] == "turnaround" and t >= v["due"]:
                emit(t, "turnaround_end", vehicle=v["id"], site=v["site"])
                v["turnaround_due"] = False
                if v["energy"] < spec["return_kwh"]:
                    state(v, "queue_charge", t)
                    v["queue_enter"] = t
                else:
                    state(v, "idle", t)
            if v["state"] == "charging" and v["energy"] >= spec["target_kwh"] - 1e-9:
                emit(t, "charge_end", vehicle=v["id"], site=v["site"])
                state(v, "idle", t)
        while created < len(request_list) and request_list[created]["t"] == t:
            raw = request_list[created]
            created += 1
            r = {**raw, "state": "waiting", "vehicle": None}
            requests[r["id"]] = r
            emit(t, "created", request=r["id"], zone=r["zone"])
        for r in requests.values():
            if r["state"] == "waiting" and t - r["t"] >= spec["patience_s"]:
                r["state"] = "unserved"
                emit(t, "unserved", request=r["id"], reason="unassigned patience expired")
        for v in vehicles.values():
            if v["state"] == "idle" and (v["energy"] < spec["return_kwh"] or v["turnaround_due"]):
                depot = nearest_site(v["routing_state"], t)
                if depot is None:
                    state(v, "stranded", t)
                    emit(t, "violation", code="no_reachable_depot", vehicle=v["id"])
                    continue
                v["site"] = depot[1]["id"]
                start_leg(v, depot[1]["node"], "returning", t)
        for site in sites.values():
            local = [v for v in vehicles.values() if v["site"] == site["id"]]
            for queue, active, cap, event in [
                ("queue_turnaround", "turnaround", site["slots"], "turnaround_start"),
                ("queue_charge", "charging", site["ports"], "charge_start"),
            ]:
                free = cap - sum(v["state"] == active for v in local)
                queued = sorted(
                    (v for v in local if v["state"] == queue),
                    key=lambda v: (v["queue_enter"], v["id"]),
                )
                for v in queued[:free]:
                    state(v, active, t)
                    v["due"] = t + spec["turnaround_s"]
                    emit(t, event, vehicle=v["id"], site=site["id"])
        if t % spec["dispatch_s"] == 0:
            for r in requests.values():
                if r["state"] != "waiting":
                    continue
                if (
                    r["origin"] != r["destination"]
                    and r["destination"] not in site_nodes
                    and g.is_terminal_arrival(r["destination"])
                ):
                    # Dispatch already requires a post-trip depot route. Keep
                    # the request waiting for its normal patience outcome; avoid
                    # recomputing pickups when every nonempty arrival is trapped.
                    continue
                available = [v for v in vehicles.values() if v["state"] == "idle"]
                if not available:
                    break
                candidates = sorted(
                    available,
                    key=lambda v: (
                        distance(g.nodes[v["node"]], g.nodes[r["origin"]]) / g.max_speed,
                        v["id"],
                    ),
                )
                selected = None
                best = float("inf")
                for v in candidates:
                    lower = distance(g.nodes[v["node"]], g.nodes[r["origin"]]) / g.max_speed
                    if lower > best:
                        break
                    pickup = g.plan(v["routing_state"], r["origin"], t)
                    if pickup is None:
                        continue
                    passenger_at = (
                        t + max(1, math.ceil(pickup["seconds"] - 1e-10)) + spec["boarding_s"]
                    )
                    trip = g.plan(pickup["arrival_after"], r["destination"], passenger_at)
                    if trip is None:
                        continue
                    return_at = passenger_at + max(1, math.ceil(trip["seconds"] - 1e-10))
                    depot = nearest_site(trip["arrival_after"], return_at)
                    if depot is None:
                        continue
                    metres = pickup["length_m"] + trip["length_m"] + depot[0]["length_m"]
                    seconds = (
                        math.ceil(pickup["seconds"])
                        + math.ceil(trip["seconds"])
                        + math.ceil(depot[0]["seconds"])
                        + spec["boarding_s"]
                        + 3
                    )
                    if reserve_feasible(
                        v["energy"],
                        metres,
                        seconds,
                        spec["drive_kwh_per_km"] / 1000,
                        spec["aux_kw"],
                        spec["reserve_kwh"],
                    ) and (pickup["seconds"], v["id"]) < (
                        best,
                        selected["id"] if selected else "",
                    ):
                        selected = v
                        best = pickup["seconds"]
                if selected:
                    r["state"] = "assigned"
                    r["vehicle"] = selected["id"]
                    r["assigned_at"] = t
                    selected["request"] = r["id"]
                    selected["site"] = None
                    emit(t, "assigned", request=r["id"], vehicle=selected["id"])
                    start_leg(selected, r["origin"], "pickup", t)
        for site in sites.values():
            active = [
                v for v in vehicles.values() if v["site"] == site["id"] and v["state"] == "charging"
            ]
            powers = charge_allocation(len(active), site["power_kw"], site.get("port_kw", 50))
            for v, power in zip(active, powers, strict=True):
                added = min(power / 3600, spec["target_kwh"] - v["energy"])
                v["energy"] += added
                v["charged_kwh"] += added
            # One power interval event when occupancy/power changes, with total
            # energy checkpoint below.
            signature = tuple(v["id"] for v in active)
            if charge_signatures.get(site["id"]) != signature:
                charge_signatures[site["id"]] = signature
                emit(t, "charge", site=site["id"], vehicles=list(signature), powers_kw=powers)
        for index, v in enumerate(vehicles.values()):
            ds = 0.0
            if v["leg"]:
                route = legs[v["leg"]]
                remaining = 1.0
                while remaining > 1e-10 and v["edge_index"] < len(route["edges"]):
                    e = g.edges[route["edges"][v["edge_index"]]]
                    duration = e["seconds"] - v["edge_elapsed"]
                    dt = min(duration, remaining)
                    metres = dt * e["length_m"] / e["seconds"]
                    ds += metres
                    v["edge_progress"] += metres
                    v["edge_elapsed"] += dt
                    remaining -= dt
                    if v["edge_elapsed"] >= e["seconds"] - 1e-10:
                        v["edge_index"] += 1
                        v["edge_progress"] = 0.0
                        v["edge_elapsed"] = 0.0
                v["leg_distance"] += ds
                v["distance_m"] += ds
                if v["state"] != "passenger":
                    v["empty_m"] += ds
                v["energy"] -= ds / 1000 * spec["drive_kwh_per_km"]
            if not v["in_storage"]:
                v["energy"] -= spec["aux_kw"] / 3600
                v["active_s"] += 1
            if v["state"].startswith("queue_"):
                v["queue_s"] += 1
            elif v["state"] == "idle":
                v["idle_s"] += 1
            else:
                v["busy_s"] += 1
            if v["energy"] < spec["reserve_kwh"] - 1e-6 and not v.get("reserve_reported"):
                emit(t + 1, "violation", code="reserve_breach", vehicle=v["id"])
                v["reserve_reported"] = True
            if (t + 1) % 60 == 0 or t + 1 == limit:
                checkpoint(t + 1, v)
            if (t + 1) % spec["sample_s"] == 0 or t + 1 == limit:
                xy = g.nodes[v["node"]]
                heading = 0
                if v["leg"]:
                    route = legs[v["leg"]]
                    if v["edge_index"] < len(route["edges"]):
                        e = g.edges[route["edges"][v["edge_index"]]]
                        a = g.nodes[e["u"]]
                        b = g.nodes[e["v"]]
                        fraction = v["edge_elapsed"] / e["seconds"]
                        xy = [a[k] + (b[k] - a[k]) * fraction for k in range(2)]
                        heading = (
                            math.degrees(
                                math.atan2(
                                    (b[0] - a[0]) * math.cos(math.radians(a[1])), b[1] - a[1]
                                )
                            )
                            + 360
                        ) % 360
                    else:
                        xy = g.nodes[v["target"]]
                poses.append(
                    [
                        t + 1,
                        index,
                        round(xy[0], 7),
                        round(xy[1], 7),
                        round(heading, 1),
                        v["state"],
                        round(v["energy"], 6),
                    ]
                )
    # Process arrivals exactly at the horizon but do not begin a new trip after it.
    for v in vehicles.values():
        if v["leg"] and v["edge_index"] >= len(legs[v["leg"]]["edges"]):
            arrive(v, limit)
    for v in vehicles.values():
        if v["leg"]:
            route = legs[v["leg"]]
            position = traversed_position(route, g.edges, limit - v["leg_started_s"])
            v["routing_position"] = position
            v["routing_state"] = g.actual_arrival(route, position["completed_edges"])
            v["node"] = v["routing_state"]["node"]
    execution = "COMPLETE" if limit == spec["duration_s"] else "INCOMPLETE"
    emit(limit, "run_end", execution=execution, counters=counters)
    return {
        "schema": schema,
        "model": model,
        "spec": spec,
        "input_digest": digest(inputs),
        "pack_digest": digest(pack),
        "scenario_digest": digest(spec),
        "routing_profile": "fleetlab.stop-continuity/1.0.0",
        "map_qualification": "NOT_EVALUATED",
        "execution": execution,
        "elapsed_s": limit,
        "events": events,
        "poses": poses,
        "legs": legs,
        "counters": counters,
        "final": {"requests": list(requests.values()), "vehicles": list(vehicles.values())},
        "limits": [
            "No endogenous traffic interaction, signals, lane changing or driving policy",
            "Synthetic demand, generic linear EV energy and fictional depots",
            "No real-world safety, access, business or operator-performance prediction",
        ],
        "pose_contract": {
            "interval_s": spec["sample_s"],
            "coordinate_rounding_degrees": 1e-7,
            "unknown_gaps": "Do not interpolate",
            "motion": "Recorded graph-edge motion only",
        },
    }
