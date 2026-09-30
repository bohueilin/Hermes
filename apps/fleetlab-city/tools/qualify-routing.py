#!/usr/bin/env python3
"""Additional source-graph checks, never human semantic map qualification."""

import math
import random
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from citylib.contracts import digest, load_json, read_bundle, save_json  # noqa: E402
from citylib.engine import run_arm  # noqa: E402
from citylib.routing import Graph  # noqa: E402

spec = load_json(APP / "experiments/sf-depots-v1.json")
pack = read_bundle(spec["pack_path"])["graph.json"]
reference = Graph(pack)
prepared = Graph(pack)
prepared.prepare(spec["node_pool"])
rng = random.Random(6029)
pool = spec["node_pool"]
checks = []
for i in range(100):
    start = pool[i * len(pool) // 100]
    end = rng.choice(pool)
    a, b = reference.route(start, end), prepared.route(start, end)
    good = (a is None and b is None) or (
        a is not None and b is not None and math.isclose(a["seconds"], b["seconds"], abs_tol=1e-7)
    )
    checks.append(
        {
            "origin": start,
            "destination": end,
            "origin_zone": spec["zones"][start],
            "reachable": a is not None,
            "pass": good,
            "reference": "A* edge-state vs SciPy Dijkstra",
            "time_s": None if b is None else b["seconds"],
        }
    )
    if not good:
        raise ValueError("routing algorithms disagree")
save_json(
    "build/fleetlab-city/validation/od-100.json",
    {
        "pass": all(c["pass"] for c in checks),
        "checks": checks,
        "semantic_review": "NOT_RUN",
        "scope": "Pinned supported graph only; not navigation validity",
    },
)
print("100 OD checks passed", flush=True)
bundle = read_bundle("build/fleetlab-city/runs/sf-depots-v1/seed-1001-baseline")
repeat = run_arm(pack, bundle["inputs.json"], bundle["run.json"]["spec"], graph=prepared)
original = digest(bundle["run.json"])
repeated = digest(repeat)
save_json(
    "build/fleetlab-city/validation/repeated-run.json",
    {
        "pass": original == repeated,
        "original": original,
        "repeated": repeated,
        "run": "seed-1001-baseline",
        "environment": "pinned local environment",
    },
)
if original != repeated:
    raise ValueError("exact repeated run differs")
print("Eight-hour semantic run digest exactly reproduced", flush=True)
