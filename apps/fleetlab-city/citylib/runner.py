"""Frozen schedules, immutable arm bundles, and complete diagnostic comparison records."""

import copy
import platform
import resource
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from .compare import compare_pairs
from .contracts import digest, load_json, read_bundle, save_json, write_bundle
from .engine import run_arm
from .inputs import generate_inputs
from .routing import Graph
from .verify import verify


def scientific_spec(spec):
    return {
        k: v
        for k, v in spec.items()
        if k
        not in (
            "candidate_sites",
            "evaluation_seeds",
            "tuning_seeds",
            "sensitivities",
            "pack_path",
            "node_pool",
            "zones",
        )
    }


def execute_arm(pack, inputs, spec, graph, out):
    start = datetime.now(UTC).isoformat()
    tick = time.monotonic()
    run = run_arm(pack, inputs, spec, graph=graph)
    wall = time.monotonic() - tick
    verification = verify(run, inputs, pack)
    context = {
        "start_utc": start,
        "end_utc": datetime.now(UTC).isoformat(),
        "wall_s": wall,
        "peak_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "python": sys.version,
        "platform": platform.platform(),
        "semantic_run_digest": digest(run),
    }
    write_bundle(
        out,
        "fleetlab.city-run/1.0.0",
        {
            "run.json": run,
            "inputs.json": inputs,
            "verification.json": verification,
            "execution-context.json": context,
        },
        {"semantic_run_digest": digest(run), "input_digest": digest(inputs)},
    )
    return (
        {k: run[k] for k in ("input_digest", "pack_digest", "model", "spec", "execution")},
        verification,
        context,
    )


def run_schedule(spec_path, out, tuning=False):
    spec = load_json(spec_path)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=False)
    captured = read_bundle(spec["pack_path"])
    pack = captured["graph.json"]
    coverage = captured["coverage.json"]
    g = Graph(pack)
    began = time.monotonic()
    g.prepare(spec["node_pool"])
    prepare = time.monotonic() - began
    seeds = spec["tuning_seeds"] if tuning else spec["evaluation_seeds"]
    frozen = []
    # Freeze every case and all exogenous tapes before examining either treatment's output.
    for seed in seeds:
        frozen.append(
            {"name": f"seed-{seed}", "seed": seed, "spec": scientific_spec(spec), "main": True}
        )
    if not tuning:
        for case in spec["sensitivities"]:
            frozen.append(
                {
                    "name": case["name"],
                    "seed": case["seed"],
                    "spec": {**scientific_spec(spec), **case["changes"]},
                    "main": False,
                }
            )
    for case in frozen:
        case["inputs"] = generate_inputs(
            pack, case["spec"], case["seed"], spec["node_pool"], spec["zones"]
        )
        save_json(out / f"{case['name']}-inputs.json", case["inputs"])
    save_json(
        out / "frozen-protocol.json",
        {
            "spec": spec,
            "case_input_digests": {c["name"]: digest(c["inputs"]) for c in frozen},
            "pack_manifest_digest": captured["manifest.json"]["content_digest"],
            "router_prepare_s": prepare,
            "qualification": "REVIEW_ONLY; map source/support gates not waived",
        },
    )
    results = []
    pairs = []
    for case in frozen:
        pair = {"seed": case["seed"]}
        for arm in ["baseline", "candidate"]:
            arm_spec = copy.deepcopy(case["spec"])
            if arm == "candidate":
                arm_spec["sites"] = copy.deepcopy(spec["candidate_sites"])
            run, v, context = execute_arm(
                pack, case["inputs"], arm_spec, g, out / f"{case['name']}-{arm}"
            )
            pair[arm] = run
            pair[arm + "_verification"] = v
            line = {
                "case": case["name"],
                "arm": arm,
                "valid": v["valid"],
                "eligible": v["recommendation_eligible"],
                "completed": v["metrics"]["completed"],
                "wall_s": context["wall_s"],
                "findings": v["findings"][:3],
            }
            print(line, flush=True)
            results.append(line)
            save_json(out / "execution-log.json", results)
        if case["main"]:
            pairs.append(pair)
        else:
            save_json(
                out / f"{case['name']}-comparison.json",
                compare_pairs([pair], [case["seed"]], False),
            )
    qualified = (
        coverage["routing_support_pass"] and coverage["semantic_map_review"]["status"] == "PASS"
    )
    comparison = compare_pairs(pairs, seeds, qualified)
    save_json(out / "comparison.json", comparison)
    return {
        "output": str(out),
        "all_runs_valid": all(r["valid"] for r in results),
        "comparison": comparison,
        "runs": len(results),
        "router_prepare_s": prepare,
    }


def verify_directory(path, pack_path):
    path = Path(path)
    pack = read_bundle(pack_path)["graph.json"]
    records = []
    dirs = (
        [path]
        if (path / "manifest.json").exists()
        else sorted(p.parent for p in path.glob("*/manifest.json"))
    )
    if not dirs:
        raise ValueError("no explicitly selected run bundles")
    for p in dirs:
        captured = read_bundle(p)
        v = verify(captured["run.json"], captured["inputs.json"], pack)
        if digest(v) != digest(captured["verification.json"]):
            v["valid"] = False
            v["findings"].append(
                {
                    "code": "stored_verification",
                    "detail": "stored report differs from fresh verifier",
                }
            )
        records.append({"run": p.name, "valid": v["valid"], "findings": v["findings"]})
    return {"pass": all(r["valid"] for r in records), "runs": records}
