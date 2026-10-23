"""Descriptive projections of freshly verified runs; never a second verifier or gate.

Preserves exact ledger values in SI units. Rendering converts units. Revenue and
real-world safety metrics are unavailable; user-entered fares live only in the UI.
"""

from collections import defaultdict

STORAGE = {"queue_charge", "charging", "queue_turnaround", "turnaround"}


def feature_vehicles(rows):
    """Same transparent selection rules in either arm; all vehicles remain accessible."""
    rows = sorted(rows, key=lambda r: r["vehicle"])
    by_trips = sorted(rows, key=lambda r: (r["completed"], r["vehicle"]))
    choices = [
        ("Reference vehicle", rows[0]),
        ("Most completed trips", min(rows, key=lambda r: (-r["completed"], r["vehicle"]))),
        ("Longest total queue", min(rows, key=lambda r: (-r["queue_s"], r["vehicle"]))),
        ("Middle by trip count", by_trips[(len(rows) - 1) // 2]),
    ]
    seen, result = set(), []
    for label, row in choices:
        if row["vehicle"] not in seen:
            result.append({**row, "label": label})
            seen.add(row["vehicle"])
    return result


def route_coordinates(route, metres, graph):
    """Clip a recorded route to traveled distance; never draw an untraveled remainder."""
    nodes = route["nodes"]
    if not nodes or metres <= 0:
        return []
    coords = [graph["nodes"][nodes[0]]]
    remaining = metres
    from .pack import distance

    for a, b in zip(nodes, nodes[1:], strict=False):
        start, end = graph["nodes"][a], graph["nodes"][b]
        length = distance(start, end)
        if remaining >= length - 1e-6:
            coords.append(end)
            remaining -= length
        else:
            ratio = max(0, remaining / length) if length else 0
            coords.append(
                [start[0] + ratio * (end[0] - start[0]), start[1] + ratio * (end[1] - start[1])]
            )
            break
    return coords


def vehicle_views(run, inputs, graph):
    ids = [v["id"] for v in inputs["initial"]]
    events, poses, requests = defaultdict(list), defaultdict(list), defaultdict(list)
    for e in run["events"]:
        if e.get("vehicle") and e["kind"] not in {"energy", "charge"}:
            events[e["vehicle"]].append(e)
    for p in run["poses"]:
        poses[ids[p[1]]].append([p[0], *p[2:]])
    for r in run["final"]["requests"]:
        requests[r.get("vehicle")].append(r)
    end = run["elapsed_s"]
    sites = [
        {**s, "coordinates": graph["nodes"][s["node"]], "provenance": "FICTIONAL"}
        for s in run["spec"]["sites"]
    ]
    terminal = next(e for e in reversed(run["events"]) if e["kind"] == "run_end")
    for final in run["final"]["vehicles"]:
        vid = final["id"]
        es = events[vid]
        starts = {e["leg"]: e for e in es if e["kind"] == "leg_start"}
        ends = {e["leg"]: e for e in es if e["kind"] == "leg_end"}
        completed = {r["id"]: r for r in requests[vid] if r["state"] == "completed"}
        routes, completed_m = [], 0.0
        for lid, event in starts.items():
            metres = (
                ends[lid]["distance_m"]
                if lid in ends
                else (final["leg_distance"] if final.get("leg") == lid else 0)
            )
            if event["purpose"] == "passenger" and event.get("request") in completed:
                completed_m += metres
            coords = route_coordinates(run["legs"][lid], metres, graph)
            if len(coords) > 1:
                routes.append(
                    {
                        "type": "Feature",
                        "distance_m": metres,
                        "properties": {
                            "leg": lid,
                            "purpose": event["purpose"],
                            "start": event["t"],
                            "end": ends.get(lid, {}).get("t", end),
                        },
                        "geometry": {"type": "LineString", "coordinates": coords},
                    }
                )
        intervals = []
        state, since, site = "idle", 0, None
        for e in es:
            if e["kind"] != "state":
                continue
            if e["t"] > since:
                intervals.append(dict(start=since, end=e["t"], state=state, site=site))
            state, since = e["after"], e["t"]
            site = e.get("site") if state in STORAGE else None
        if end > since:
            intervals.append(dict(start=since, end=end, state=state, site=site))
        # Arriving at a depot is a completed returning leg, not every service-state change.
        visits = [e for e in ends.values() if starts[e["leg"]]["purpose"] == "returning"]
        visited_sites = set()
        for e in visits:
            dest = run["legs"][e["leg"]]["nodes"][-1]
            visited_sites.update(s["id"] for s in sites if s["node"] == dest)
        summary = {
            "completed": len(completed),
            "boarded": sum("boarded_at" in r for r in requests[vid]),
            "in_progress": sum(r["state"] in {"assigned", "in_progress"} for r in requests[vid]),
            "distance_m": final["distance_m"],
            "empty_m": final["empty_m"],
            "empty_fraction": final["empty_m"] / final["distance_m"]
            if final["distance_m"]
            else None,
            "completed_passenger_m": completed_m,
            "completed_passenger_s": sum(
                r["completed_at"] - r["boarded_at"] for r in completed.values()
            ),
            "queue_s": final["queue_s"],
            "charged_kwh": final["charged_kwh"],
            "depot_visits": len(visits),
            "unique_depots": sorted(visited_sites),
            "charge_started": sum(e["kind"] == "charge_start" for e in es),
            "charge_completed": sum(e["kind"] == "charge_end" for e in es),
            "turnaround_started": sum(e["kind"] == "turnaround_start" for e in es),
            "turnaround_completed": sum(e["kind"] == "turnaround_end" for e in es),
            "final_state": final["state"],
            "final_site": final.get("site"),
            "revenue": None,
            "injury_crash_rate_per_mm": None,
            "remote_guidance_per_mm": None,
            "minimum_risk_maneuvers": None,
            "cleaning": None,
            "software_updates": None,
            "repairs": None,
            "safety_regulatory_gate": "NOT_EVALUATED",
            "scope": "SIMULATION_ONLY",
        }
        yield {
            "vehicle": vid,
            "samples": poses[vid],
            "events": [*es, terminal],
            "intervals": intervals,
            "summary": summary,
            "sites": sites,
            "routes": {"type": "FeatureCollection", "features": routes},
            "duration_s": run["spec"]["duration_s"],
            "elapsed_s": end,
            "event_scope": "All vehicle operational and state events, plus run end. "
            "Energy checkpoints and charge-allocation records omitted; "
            "totals preserved in summary.",
        }
