#!/usr/bin/env python3
"""Reconcile frozen source and inspect candidate routing; never run a fleet experiment."""

import math
import random
import sys
import time
from collections import Counter
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from citylib.contracts import (  # noqa: E402
    digest,
    load_json,
    read_bundle,
    read_bytes,
    save_json,
    sha,
)
from citylib.importer import parse_osm  # noqa: E402
from citylib.restrictions import compile_sequence, validate_path  # noqa: E402
from citylib.routing import Graph  # noqa: E402


def qualify(root):
    root = Path(root)
    config = load_json(APP / "config/sf-v2.json")
    bundle = read_bundle(root / config["output"])
    pack = bundle["graph.json"]
    raw = read_bytes(root / config["source_dir"] / "sf.osm.xml", 150_000_000)
    if sha(raw) != config["osm_sha256"]:
        raise ValueError("source digest mismatch")
    source = parse_osm(raw, routing_profile=config["routing_profile"])
    if sorted(w["id"] for w in source["ways"]) != pack["candidate_ids"]:
        raise ValueError("fresh source candidate accounting differs")
    if Counter(r["id"] for r in source["restrictions"]) != Counter(
        r["id"] for r in pack["restriction_audit"]
    ):
        raise ValueError("fresh source restriction accounting differs")
    originals = {r["id"]: r for r in source["restrictions"]}
    sequence_checks = []
    edges = {e["id"]: e for e in pack["edges"]}
    for r in pack["turns"]:
        if "edge_sequences" not in r:
            continue
        rebuilt = compile_sequence(originals[r["id"]], source["all_ways"])
        if rebuilt != r:
            raise ValueError("compiled restriction differs from frozen source")
        for seq in r["edge_sequences"]:
            available = all(e in edges for e in seq)
            details = validate_path(pack, seq) if available else []
            if (
                available
                and r["kind"].startswith("no_")
                and not any(f"forbidden via-way sequence: {r['id']}" == d for d in details)
            ):
                raise ValueError("independent validator missed prohibited source sequence")
            sequence_checks.append(
                {
                    "relation_id": r["id"],
                    "all_edges_available": available,
                    "kind": r["kind"],
                    "sequence_length": len(seq),
                    "source_recompiled_match": True,
                    "no_sequence_rejected": bool(details)
                    if r["kind"].startswith("no_") and available
                    else None,
                }
            )
    # This is a routing-only OD sample. Old experiment coordinates are not replayed.
    nodes = sorted({e["u"] for e in pack["edges"]} & {e["v"] for e in pack["edges"]})
    rng = random.Random(20260929)
    pool = rng.sample(nodes, min(40, len(nodes)))
    prepared, reference = Graph(pack), Graph(pack)
    start = time.monotonic()
    prepared.prepare(pool)
    preparation_s = time.monotonic() - start
    checks = []
    start = time.monotonic()
    for i in range(100):
        origin, destination = pool[i % len(pool)], rng.choice(pool)
        a, b = reference.route(origin, destination), prepared.route(origin, destination)
        same = (a is None and b is None) or (
            a is not None
            and b is not None
            and math.isclose(a["seconds"], b["seconds"], abs_tol=1e-7)
        )
        if not same:
            raise ValueError("A*/Dijkstra reachability or cost differs")
        for route in (a, b):
            if route and validate_path(pack, route["edges"]):
                raise ValueError("independent path validation failed")
        checks.append(
            {
                "origin": origin,
                "destination": destination,
                "pass": same,
                "reachable": a is not None,
                "seconds": a["seconds"] if a else None,
            }
        )
    report = {
        "schema": "fleetlab.map-routing-validation/1.0.0",
        "pass": True,
        "pack_digest": bundle["manifest.json"]["content_digest"],
        "graph_digest": digest({k: pack[k] for k in ("nodes", "edges", "turns")}),
        "source_sha256": sha(raw),
        "source_way_count": len(source["ways"]),
        "source_restriction_records": len(source["restrictions"]),
        "sequence_checks": sequence_checks,
        "od_checks": checks,
        "preparation_s": preparation_s,
        "od_validation_s": time.monotonic() - start,
        "prepared_state_count": prepared.prepared["state_count"],
        "edge_count": len(edges),
        "estimated_table_bytes": prepared.prepared["estimated_table_bytes"],
        "semantic_review": "NOT_RUN",
        "fleet_execution": "BLOCKED",
        "scope": "SIMULATION_ONLY",
        "meaning": "Internal graph/source consistency and algorithm agreement only",
    }
    save_json(root / "build/fleetlab-city/validation/map-v2-routing.json", report)
    print({k: v for k, v in report.items() if k not in {"sequence_checks", "od_checks"}})


if __name__ == "__main__":
    qualify(APP.parents[1])
