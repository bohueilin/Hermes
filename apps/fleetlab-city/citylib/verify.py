"""Recompute teaching metrics from event records; shared schema is not independent authenticity."""

import bisect
import math
from collections import defaultdict

from .contracts import digest
from .ledger import check_ledger
from .pack import distance
from .restrictions import PROFILE, validate_path, validate_profile


def quantile(values, p):
    if not values:
        return None
    values = sorted(values)
    i = (len(values) - 1) * p
    lo = int(i)
    hi = min(lo + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (i - lo)


def verify(run, inputs, pack):
    routing_profile = validate_profile(pack)
    findings = []

    def fail(code, detail):
        findings.append({"code": code, "detail": str(detail)})

    if routing_profile == PROFILE:
        fail(
            "routing_continuity",
            "Candidate map only: incoming restriction history across fleet legs is not qualified",
        )

    if run.get("schema") != "fleetlab.city-run/1.0.0":
        fail("schema", "unsupported run schema")
    if run.get("input_digest") != digest(inputs):
        fail("inputs", "frozen input digest mismatch")
    graph_digest = digest({k: pack[k] for k in ("nodes", "edges", "turns")})
    if run.get("pack_digest") != graph_digest:
        fail("pack", "graph digest mismatch")
    spec = run["spec"]
    horizon = run["elapsed_s"]
    events = run["events"]
    initial = {v["id"]: v for v in inputs["initial"]}
    states = {v: "idle" for v in initial}
    active_request = {}
    request_states = {}
    boarded = {}
    assigned = {}
    request_inputs = {r["id"]: r for r in inputs["requests"]}
    checkpoints = {}
    last_time = -1
    resources = defaultdict(set)
    sites = {s["id"]: s for s in spec["sites"]}
    leg_starts = defaultdict(list)
    edge_map = {e["id"]: e for e in pack["edges"]}
    profiles = {}
    violations = []
    power_peak = defaultdict(float)
    turn_index = defaultdict(list)
    for rule in pack["turns"]:
        if "edge_sequences" not in rule:
            turn_index[(rule["via"], rule["from"])].append(rule)
    open_legs = {}
    closed_distance = defaultdict(float)
    closed_empty = defaultdict(float)
    aux_closed = defaultdict(int)
    aux_since = {vid: 0 for vid in initial}
    stored = {vid: False for vid in initial}
    for lid, route in run["legs"].items():
        if routing_profile == PROFILE:
            for issue in validate_path(pack, route["edges"]):
                fail("route", issue)
        elapsed = [0.0]
        length = 0.0
        last = None
        for eid in route["edges"]:
            e = edge_map.get(eid)
            if e is None:
                fail("route", "unknown source edge")
                continue
            if last and last["v"] != e["u"]:
                fail("route", "disconnected edge sequence")
            if last and last["u"] == e["v"]:
                fail("route", "undeclared immediate U-turn")
            if last:
                for rule in turn_index[(e["u"], last["way"])]:
                    if (
                        rule["kind"].startswith("no_")
                        and rule["to"] == e["way"]
                        or rule["kind"].startswith("only_")
                        and rule["to"] != e["way"]
                    ):
                        fail("route", "forbidden turn")
            elapsed.append(elapsed[-1] + e["seconds"])
            length += e["length_m"]
            last = e
        if abs(length - route["length_m"]) > 1e-6 or abs(elapsed[-1] - route["seconds"]) > 1e-6:
            fail("route", "path cost does not equal graph edges")
        profiles[lid] = elapsed
    allowed_kinds = {
        "initial",
        "state",
        "leg_start",
        "leg_end",
        "created",
        "assigned",
        "boarded",
        "completed",
        "unserved",
        "turnaround_start",
        "turnaround_end",
        "charge_start",
        "charge_end",
        "charge",
        "energy",
        "violation",
        "run_end",
    }
    for seq, e in enumerate(events):
        try:
            t = e["t"]
            kind = e["kind"]
            vid = e.get("vehicle")
            rid = e.get("request")
            if e["seq"] != seq or not isinstance(t, int) or t < last_time or not 0 <= t <= horizon:
                fail("sequence", seq)
            last_time = t
            if kind not in allowed_kinds:
                fail("event", "unknown kind")
            if vid is not None and vid not in initial:
                fail("vehicle", "unknown ID")
                continue
            if kind == "initial":
                if e["node"] != initial[vid]["node"] or e["energy"] != initial[vid]["energy"]:
                    fail("initial", "state mismatch")
            elif kind == "state":
                if states[vid] != e["before"]:
                    fail("state", "before-state mismatch")
                states[vid] = e["after"]
            elif kind == "created":
                if (
                    rid in request_states
                    or rid not in request_inputs
                    or request_inputs[rid]["t"] != t
                ):
                    fail("request", "creation mismatch")
                request_states[rid] = "waiting"
            elif kind == "assigned":
                if request_states.get(rid) != "waiting" or vid in active_request:
                    fail("assignment", "double/illegal assignment")
                request_states[rid] = "assigned"
                active_request[vid] = rid
                assigned[rid] = vid
            elif kind == "boarded":
                if request_states.get(rid) != "assigned" or assigned.get(rid) != vid:
                    fail("boarding", "illegal boarding")
                request_states[rid] = "in_progress"
                boarded[rid] = t
            elif kind == "completed":
                if request_states.get(rid) != "in_progress" or active_request.get(vid) != rid:
                    fail("completion", "illegal completion")
                request_states[rid] = "completed"
                active_request.pop(vid, None)
            elif kind == "unserved":
                if request_states.get(rid) != "waiting":
                    fail("unserved", "invalid population")
                request_states[rid] = "unserved"
            elif kind in {"charge_start", "turnaround_start", "charge_end", "turnaround_end"}:
                service = kind.split("_")[0]
                key = (e["site"], service)
                group = resources[key]
                if kind.endswith("_start"):
                    if any(vid in vs for vs in resources.values()):
                        fail("ownership", "two resources for one vehicle")
                    group.add(vid)
                    cap = sites[e["site"]]["ports" if service == "charge" else "slots"]
                    if len(group) > cap:
                        fail("capacity", key)
                else:
                    if vid not in group:
                        fail("ownership", "release without acquisition")
                    group.discard(vid)
            elif kind == "charge":
                site = sites[e["site"]]
                powers = e["powers_kw"]
                if (
                    len(powers) != len(e["vehicles"])
                    or len(powers) > site["ports"]
                    or any(
                        not math.isfinite(p) or p < 0 or p > site.get("port_kw", 50) + 1e-9
                        for p in powers
                    )
                    or sum(powers) > site["power_kw"] + 1e-9
                ):
                    fail("power", "port/site limit")
                power_peak[e["site"]] = max(power_peak[e["site"]], sum(powers))
            elif kind == "leg_start":
                if e["leg"] not in run["legs"]:
                    fail("route", "unknown leg")
                else:
                    leg_starts[vid].append((t, e["leg"]))
                    if vid in open_legs:
                        fail("route", "overlapping vehicle legs")
                    open_legs[vid] = (t, e["leg"], e["purpose"])
                    if stored[vid]:
                        stored[vid] = False
                        aux_since[vid] = t
            elif kind == "leg_end":
                if abs(e["distance_m"] - run["legs"][e["leg"]]["length_m"]) > 1e-5:
                    fail("distance", "leg endpoint mismatch")
                ongoing = open_legs.pop(vid, None)
                if ongoing is None or ongoing[1] != e["leg"]:
                    fail("route", "end without matching start")
                else:
                    closed_distance[vid] += run["legs"][e["leg"]]["length_m"]
                    if ongoing[2] != "passenger":
                        closed_empty[vid] += run["legs"][e["leg"]]["length_m"]
                    if ongoing[2] == "returning":
                        aux_closed[vid] += t - aux_since[vid]
                        stored[vid] = True
            elif kind == "energy":
                motion = 0.0
                empty_motion = 0.0
                if vid in open_legs:
                    began, lid, purpose = open_legs[vid]
                    remaining = t - began
                    for eid in run["legs"][lid]["edges"]:
                        edge = edge_map[eid]
                        dt = min(max(0, remaining), edge["seconds"])
                        motion += dt / edge["seconds"] * edge["length_m"]
                        remaining -= dt
                        if remaining <= 0:
                            break
                    if purpose != "passenger":
                        empty_motion = motion
                if (
                    abs(e["distance_m"] - closed_distance[vid] - motion) > 1e-5
                    or abs(e["empty_m"] - closed_empty[vid] - empty_motion) > 1e-5
                ):
                    fail("distance", "checkpoint disagrees with recorded graph legs")
                active = aux_closed[vid] + (0 if stored[vid] else t - aux_since[vid])
                if e["active_s"] != active:
                    fail("energy", "auxiliary time differs from storage transitions")
                expected = (
                    initial[vid]["energy"]
                    - e["distance_m"] / 1000 * spec["drive_kwh_per_km"]
                    - e["active_s"] / 3600 * spec["aux_kw"]
                    + e["charged_kwh"]
                )
                if abs(expected - e["energy"]) > 1e-6:
                    fail("energy", "ledger equation mismatch")
                if not 0 <= e["energy"] <= spec["capacity_kwh"] + 1e-6:
                    fail("energy", "capacity/negative energy")
                if e["energy"] < spec["reserve_kwh"] - 1e-6:
                    violations.append({"code": "reserve_breach", "vehicle": vid, "t": t})
                if e["busy_s"] + e["idle_s"] + e["queue_s"] != t or not 0 <= e["active_s"] <= t:
                    fail("clock", "occupancy/auxiliary conservation")
                previous = checkpoints.get(vid)
                if previous and any(
                    e[k] + 1e-7 < previous[k]
                    for k in ("distance_m", "empty_m", "active_s", "charged_kwh", "queue_s")
                ):
                    fail("energy", "cumulative quantity decreased")
                if e["empty_m"] > e["distance_m"] + 1e-6:
                    fail("population", "empty distance exceeds all distance")
                checkpoints[vid] = e
            elif kind == "violation":
                violations.append(e)
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            fail("malformed_event", f"{seq}: {exc}")
    if not events or events[-1]["kind"] != "run_end" or events[-1]["t"] != horizon:
        fail("truncated", "missing final record")
    expected_ids = {r["id"] for r in inputs["requests"] if r["t"] < horizon}
    if set(request_states) != expected_ids:
        fail("population", "created records differ from frozen arrival tape")
    final_requests = {r["id"]: r for r in run["final"]["requests"]}
    if set(final_requests) != set(request_states):
        fail("final", "request inventory mismatch")
    for rid, state in request_states.items():
        if final_requests.get(rid, {}).get("state") != state:
            fail("final", "request state mismatch")
    for v in run["final"]["vehicles"]:
        check = checkpoints.get(v["id"])
        if check is None or abs(check["energy"] - v["energy"]) > 1e-6:
            fail("final", "energy mismatch")
        if states.get(v["id"]) != v["state"]:
            fail("final", "vehicle state mismatch")
    # Independent pose reconstruction from the exact graph-edge durations in each recorded leg.
    vehicle_ids = list(initial)
    last_pose = {}
    starts = {v: [x[0] for x in xs] for v, xs in leg_starts.items()}
    for pose in run["poses"]:
        try:
            t, index, lon, lat, heading, state, energy = pose
            vid = vehicle_ids[index]
            if index < 0 or t <= last_pose.get(vid, 0) or t > horizon:
                fail("poses", "unordered/duplicate sample")
            if t != min(last_pose.get(vid, 0) + spec["sample_s"], horizon):
                fail("poses", "missing sample or unexplained gap")
            last_pose[vid] = t
            expected = pack["nodes"][initial[vid]["node"]]
            k = bisect.bisect_left(starts.get(vid, []), t) - 1
            if k >= 0:
                began, lid = leg_starts[vid][k]
                route = run["legs"][lid]
                elapsed = t - began
                profile = profiles[lid]
                edge_index = bisect.bisect_right(profile, elapsed) - 1
                if edge_index >= len(route["edges"]):
                    expected = pack["nodes"][route["nodes"][-1]]
                else:
                    e = edge_map[route["edges"][edge_index]]
                    a = pack["nodes"][e["u"]]
                    b = pack["nodes"][e["v"]]
                    f = (elapsed - profile[edge_index]) / e["seconds"]
                    expected = [a[j] + (b[j] - a[j]) * f for j in range(2)]
            if distance(expected, [lon, lat]) > 0.10:
                fail("poses", f"{vid} at {t}: disagrees with recorded graph motion")
        except (KeyError, ValueError, TypeError, IndexError):
            fail("poses", "malformed sample")
    if any(last_pose.get(v) != horizon for v in initial):
        fail("poses", "missing terminal sample")
    counts = {
        name: sum(s == name for s in request_states.values())
        for name in ("completed", "unserved", "waiting", "assigned", "in_progress")
    }
    n = len(request_states)
    done = counts["completed"]
    waits = [t - request_inputs[rid]["t"] for rid, t in boarded.items()]
    empty_km = sum(e["empty_m"] for e in checkpoints.values()) / 1000
    zone_stats = {}
    for rid, state in request_states.items():
        z = request_inputs[rid]["zone"]
        rec = zone_stats.setdefault(z, {"created": 0, "completed": 0})
        rec["created"] += 1
        rec["completed"] += state == "completed"
    unavailable = {}
    if not n:
        unavailable["completion_fraction"] = "No requests created"
    if not done:
        unavailable["empty_km_per_completed"] = "No completed trips"
    if not waits:
        unavailable["wait_p90_s"] = "No boarded requests"
    metrics = {
        "schema": "fleetlab.city-metrics/1.0.0",
        "created": n,
        "completed": done,
        "unserved": counts["unserved"],
        "waiting": counts["waiting"],
        "in_progress": counts["assigned"] + counts["in_progress"],
        "assigned_not_boarded": counts["assigned"],
        "completion_fraction": done / n if n else None,
        "boarded_count": len(waits),
        "wait_p50_s": quantile(waits, 0.5),
        "wait_p90_s": quantile(waits, 0.9),
        "empty_km": empty_km,
        "empty_km_per_completed": empty_km / done if done else None,
        "queue_vehicle_minutes": sum(e["queue_s"] for e in checkpoints.values()) / 60,
        "charged_kwh": sum(e["charged_kwh"] for e in checkpoints.values()),
        "site_peak_kw": dict(power_peak),
        "hard_violations": len(violations),
        "zones": zone_stats,
        "unavailable": unavailable,
    }
    if "metrics" in run and digest(run["metrics"]) != digest(metrics):
        fail("metrics", "stored summary differs from recomputed metrics")
    try:
        findings.extend(check_ledger(run, inputs, pack))
    except (KeyError, TypeError, ValueError, IndexError, ZeroDivisionError) as exc:
        fail("interval_ledger", f"Malformed ledger: {exc}")
    valid = not findings
    complete = run["execution"] == "COMPLETE" and horizon == spec["duration_s"]
    counters_ok = all(
        run["counters"].get(k) == 0 for k in ("teleports", "dropped", "insertion_failed")
    )
    return {
        "valid": valid,
        "execution": run["execution"],
        "verification": "INTERNALLY_CONSISTENT" if valid else "INVALID",
        "recommendation_eligible": valid and complete and counters_ok and not violations,
        "metrics": metrics,
        "findings": findings[:100],
        "finding_count": len(findings),
        "violations": violations[:100],
        "authenticity": "NOT_AUTHENTICATED",
        "scope": "SIMULATION_ONLY",
        "decision_authority": "NONE",
        "verifier": "fleetlab.city-event-verifier/1.0.0",
        "independence": (
            "Separate metric reducer; shared schema/graph and same implementation author."
        ),
    }
