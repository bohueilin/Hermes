"""Independent interval accounting for the temporal model's integer-ms clock.

Forked from the frozen historical ledger at 7cf32c5. Resource/state/energy checks
and tolerances are retained; cumulative route clocks alone use exact integers.
This separate reducer avoids changing the stopped power study's verifier bytes.
Samples at t precede discrete transitions at t, as in the recorded contract.
"""

import bisect
import math
from collections import defaultdict


def check_ledger(run, inputs, pack):
    problems = []

    def fail(message):
        if len(problems) < 100:
            problems.append({"code": "interval_ledger", "detail": message})

    spec = run["spec"]
    edges = {e["id"]: e for e in pack["edges"]}
    sites = {s["id"]: s for s in spec["sites"]}
    requests = {r["id"]: r for r in inputs["requests"]}
    vehicles = {}
    profiles = {}
    ownership = defaultdict(set)
    state_edges = {
        "idle": {"pickup", "returning", "stranded"},
        "pickup": {"boarding"},
        "boarding": {"passenger"},
        "passenger": {"idle"},
        "returning": {"queue_turnaround", "queue_charge", "idle"},
        "queue_turnaround": {"turnaround"},
        "turnaround": {"queue_charge", "idle"},
        "queue_charge": {"charging"},
        "charging": {"idle"},
        "stranded": set(),
    }
    for lid, route in run["legs"].items():
        milliseconds, metres = [0], [0.0]
        ns = route["nodes"]
        if len(ns) != len(route["edges"]) + 1 or any(n not in pack["nodes"] for n in ns):
            fail("route node inventory differs from edge inventory")
        for i, eid in enumerate(route["edges"]):
            e = edges[eid]
            if [e["u"], e["v"]] != ns[i : i + 2]:
                fail("route nodes disagree with source edges")
            duration_ms = e["duration_ms"]
            if (
                type(duration_ms) is not int
                or duration_ms <= 0
                or e["seconds"] != duration_ms / 1000
            ):
                raise ValueError("invalid temporal millisecond duration")
            milliseconds.append(milliseconds[-1] + duration_ms)
            metres.append(metres[-1] + e["length_m"])
        profiles[lid] = (milliseconds, metres)
    for raw in inputs["initial"]:
        vehicles[raw["id"]] = dict(
            raw,
            t=0,
            state="idle",
            stored=False,
            leg=None,
            energy=raw["energy"],
            distance_m=0.0,
            empty_m=0.0,
            charged_kwh=0.0,
            active_s=0,
            queue_s=0,
            busy_s=0,
            idle_s=0,
            power=0.0,
            request=None,
            pickup_at=None,
            arrival=None,
            service_at=None,
        )

    def motion(v, t):
        if v["leg"] is None:
            return 0.0, pack["nodes"][v["node"]], 0.0
        route = run["legs"][v["leg"]]
        milliseconds, metres = profiles[v["leg"]]
        elapsed_ms = max(0, t - v["began"]) * 1000
        i = bisect.bisect_right(milliseconds, elapsed_ms) - 1
        if i >= len(route["edges"]):
            return metres[-1], pack["nodes"][route["nodes"][-1]], 0.0
        edge = edges[route["edges"][i]]
        f = (elapsed_ms - milliseconds[i]) / edge["duration_ms"]
        a, b = pack["nodes"][edge["u"]], pack["nodes"][edge["v"]]
        xy = [a[j] + (b[j] - a[j]) * f for j in range(2)]
        bearing = (
            math.degrees(math.atan2((b[0] - a[0]) * math.cos(math.radians(a[1])), b[1] - a[1]))
            % 360
        )
        return metres[i] + f * edge["length_m"], xy, bearing

    def advance(vid, t):
        v = vehicles[vid]
        dt = t - v["t"]
        if dt < 0:
            fail("non-monotone vehicle time")
            return v
        ds = motion(v, t)[0] - motion(v, v["t"])[0]
        v["distance_m"] += ds
        if v["leg"] is not None and v["purpose"] != "passenger":
            v["empty_m"] += ds
        if dt > 0 and v["power"] and not v["stored"]:
            fail("charging outside depot storage")
        added = max(0.0, min(v["power"] * dt / 3600, spec["target_kwh"] - v["energy"]))
        v["charged_kwh"] += added
        v["energy"] += added - ds / 1000 * spec["drive_kwh_per_km"]
        if not v["stored"]:
            v["energy"] -= dt / 3600 * spec["aux_kw"]
            v["active_s"] += dt
        category = (
            "queue_s"
            if v["state"].startswith("queue_")
            else "idle_s"
            if v["state"] == "idle"
            else "busy_s"
        )
        v[category] += dt
        v["t"] = t
        return v

    poses = iter(sorted(run["poses"], key=lambda p: (p[0], p[1])))
    pending = next(poses, None)
    ids = list(vehicles)
    seen_initial = set()
    for event in run["events"]:
        t, kind = event["t"], event["kind"]
        while pending is not None and pending[0] <= t:
            pt, index, lon, lat, heading, state, energy = pending
            vid = ids[index]
            v = advance(vid, pt)
            expected_heading = motion(v, pt)[2]
            angle = abs((heading - expected_heading + 180) % 360 - 180)
            if state != v["state"] or abs(energy - v["energy"]) > 1.1e-6 or angle > 0.051:
                fail(f"{vid} sample at {pt} disagrees with derived state/energy/heading")
            pending = next(poses, None)
        vid = event.get("vehicle")
        v = advance(vid, t) if vid else None
        if kind == "initial":
            if vid in seen_initial or t != 0:
                fail("duplicate/late initial vehicle")
            seen_initial.add(vid)
        elif kind == "state":
            if event["after"] not in state_edges.get(v["state"], set()):
                fail("illegal vehicle state transition")
            v["state"] = event["after"]
        elif kind == "assigned":
            if v["state"] != "idle" or v["request"] is not None:
                fail("assignment requires an idle unassigned vehicle")
            v["request"] = event["request"]
        elif kind == "leg_start":
            route = run["legs"][event["leg"]]
            purpose = event["purpose"]
            if v["leg"] is not None or route["nodes"][0] != v["node"]:
                fail("leg departure is disconnected from vehicle location")
            if purpose in ("pickup", "passenger"):
                request = requests[v["request"]]
                target = request["origin" if purpose == "pickup" else "destination"]
                if event.get("request") != v["request"] or route["nodes"][-1] != target:
                    fail("leg endpoint disagrees with frozen request")
                if purpose == "passenger" and v["node"] != request["origin"]:
                    fail("passenger departed away from request origin")
            elif purpose == "returning":
                if not any(s["node"] == route["nodes"][-1] for s in sites.values()):
                    fail("return leg does not reach a declared depot")
            else:
                fail("unknown leg purpose")
            v.update(leg=event["leg"], began=t, purpose=purpose, stored=False)
        elif kind == "leg_end":
            if v["leg"] != event["leg"]:
                fail("arrival lacks matching departure")
                continue
            route = run["legs"][v["leg"]]
            if t != v["began"] + max(1, math.ceil(route["seconds"] - 1e-10)):
                fail("arrival time disagrees with graph duration")
            v["node"] = route["nodes"][-1]
            v["arrival"] = (v["purpose"], t)
            if v["purpose"] == "pickup":
                v["pickup_at"] = t
            if v["purpose"] == "returning":
                v["stored"] = True
            v["leg"] = None
        elif kind == "boarded":
            r = requests[event["request"]]
            if (
                v["node"] != r["origin"]
                or v["pickup_at"] is None
                or t != v["pickup_at"] + spec["boarding_s"]
            ):
                fail("boarding lacks matching pickup and boarding delay")
        elif kind == "completed":
            r = requests[event["request"]]
            if v["node"] != r["destination"] or v["arrival"] != ("passenger", t):
                fail("completion lacks matching passenger arrival")
            v["request"] = None
        elif kind in ("charge_start", "turnaround_start", "charge_end", "turnaround_end"):
            site, service = event["site"], kind.split("_")[0]
            if not v["stored"] or v["node"] != sites[site]["node"]:
                fail("resource acquisition/release away from depot")
            if kind.endswith("_start"):
                ownership[(site, service)].add(vid)
                v["service_at"] = t
            else:
                ownership[(site, service)].discard(vid)
                if service == "turnaround" and t - v["service_at"] != spec["turnaround_s"]:
                    fail("turnaround duration mismatch")
                if service == "charge" and abs(v["energy"] - spec["target_kwh"]) > 1e-6:
                    fail("charging released before target")
        elif kind == "charge":
            site = event["site"]
            active = event["vehicles"]
            if set(active) != ownership[(site, "charge")] or len(active) != len(set(active)):
                fail("power recipients differ from charging ownership")
            for who, vv in vehicles.items():
                if vv.get("power_site") == site:
                    advance(who, t)["power"] = 0.0
            for who, power in zip(active, event["powers_kw"], strict=True):
                vv = advance(who, t)
                vv.update(power=power, power_site=site)
        elif kind == "energy":
            for field in (
                "energy",
                "distance_m",
                "empty_m",
                "charged_kwh",
                "active_s",
                "queue_s",
                "busy_s",
                "idle_s",
            ):
                tolerance = 1e-5 if field.endswith("_m") else 1e-6
                if abs(event[field] - v[field]) > tolerance:
                    fail(f"{vid} {field} at {t} disagrees with interval ledger")
    if pending is not None or seen_initial != set(vehicles):
        fail("incomplete sample/initial inventory")
    final = run["final"]["vehicles"]
    if len(final) != len(vehicles) or {v["id"] for v in final} != set(vehicles):
        fail("final vehicle inventory mismatch")
    for record in final:
        v = advance(record["id"], run["elapsed_s"])
        for field in (
            "energy",
            "distance_m",
            "empty_m",
            "charged_kwh",
            "active_s",
            "queue_s",
            "busy_s",
            "idle_s",
        ):
            if abs(record[field] - v[field]) > (1e-5 if field.endswith("_m") else 1e-6):
                fail("final vehicle ledger mismatch: " + field)
        if record["node"] != v["node"]:
            fail("final vehicle source node mismatch")
    ending = run["events"][-1]
    if (
        ending["kind"] != "run_end"
        or ending["counters"] != run["counters"]
        or ending["execution"] != run["execution"]
    ):
        fail("run-end counters/status differ from summary")
    unreachable = sum(
        e["kind"] == "unserved" and e.get("reason") == "unreachable on supported graph"
        for e in run["events"]
    )
    if unreachable != run["counters"]["unreachable_requests"]:
        fail("unreachable counter differs from event population")
    return problems
