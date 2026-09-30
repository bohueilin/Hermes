"""Exogenous inputs are materialized before treatment; no policy RNG access."""

import random
from collections import defaultdict

from .pack import distance


def select_pool(pack, count=220):
    # Main SF peninsula and Treasure Island remain sourced; only supported endpoints enter demand.
    candidates = {}
    for r in pack["inventory"]:
        if r["status"] != "included" or r["scope"] not in {"city", "boundary-crossing"}:
            continue
        if r["class"] not in {"primary", "secondary", "tertiary", "residential", "unclassified"}:
            continue
        districts = r.get("district_lengths_m", {})
        zone = max(districts, key=districts.get) if districts else "UNASSIGNED"
        for n in (r["source_nodes"][0], r["source_nodes"][-1]):
            candidates[n] = zone
    if not candidates:
        raise ValueError("no supported city endpoints")
    buckets = defaultdict(list)
    for n, z in sorted(candidates.items()):
        buckets[z].append(n)
    rng = random.Random(421)
    pool = []
    for ns in buckets.values():
        rng.shuffle(ns)
    while len(pool) < count and any(buckets.values()):
        for _z, ns in sorted(buckets.items()):
            if ns and len(pool) < count:
                pool.append(ns.pop())
    return pool, {n: candidates[n] for n in pool}


def choose_sites(pack, pool):
    coords = [pack["nodes"][n] for n in pool]
    # Geometric rule frozen before outcome inspection; not a real facility inventory.
    xs = sorted(p[0] for p in coords)
    ys = sorted(p[1] for p in coords)
    targets = [
        (xs[int(len(xs) * 0.67)], ys[int(len(ys) * 0.33)]),
        (xs[int(len(xs) * 0.33)], ys[int(len(ys) * 0.67)]),
    ]
    return [min(pool, key=lambda n: (distance(pack["nodes"][n], p), n)) for p in targets]


def generate_inputs(pack, spec, seed, node_pool=None, zones=None):
    if node_pool is None:
        node_pool, zones = select_pool(pack)
    zones = zones or {n: "toy" for n in node_pool}
    if len(node_pool) < 2:
        raise ValueError("at least two OD endpoints required")
    rng = random.Random(seed)
    horizon = spec["duration_s"]
    # Uniform zone-balanced endpoints, weighted hourly timestamps: synthetic, not calibrated demand.
    weights = spec.get("hourly_weights", [1, 1.3, 1.1, 0.8, 0.8, 1, 1.1, 0.9])
    requests = []
    for i in range(spec["request_count"]):
        hour = rng.choices(range(8), weights=weights, k=1)[0]
        t = min(horizon - 1, int((hour + rng.random()) * horizon / 8))
        origin = rng.choice(node_pool)
        destination = rng.choice(node_pool)
        while destination == origin:
            destination = rng.choice(node_pool)
        requests.append(
            {
                "id": f"r{i:04d}",
                "t": t,
                "origin": origin,
                "destination": destination,
                "zone": zones[origin],
            }
        )
    requests.sort(key=lambda r: (r["t"], r["id"]))
    initial = [
        {"id": f"ev-{i + 1:03d}", "node": rng.choice(node_pool), "energy": spec["initial_kwh"]}
        for i in range(spec["fleet_size"])
    ]
    bg_rng = random.Random(seed + 1000000)
    bg = [
        {
            "id": f"bg-{i:05d}",
            "t": int(bg_rng.random() * horizon),
            "origin": bg_rng.choice(node_pool),
            "destination": bg_rng.choice(node_pool),
        }
        for i in range(round(spec.get("background_per_hour", 0) * horizon / 3600))
    ]
    bg.sort(key=lambda r: (r["t"], r["id"]))
    return {
        "schema": "fleetlab.city-scenario/1.0.0",
        "seed": seed,
        "requests": requests,
        "initial": initial,
        "background": bg,
        "incidents": [],
        "node_pool": node_pool,
        "zones": zones,
        "generation": (
            "zone-balanced supported road endpoints, synthetic hourly weights; "
            "unreachable requests retained"
        ),
        "seed_namespaces": {"demand_and_initial": seed, "background": seed + 1000000},
    }
