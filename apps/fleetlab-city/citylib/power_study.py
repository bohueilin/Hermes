"""One-pass orchestration around the unchanged City runner and verifier."""

import copy
import time
from pathlib import Path

from .contracts import canonical, digest, load_json, read_bundle
from .inputs import generate_inputs
from .power_protocol import (
    ARM_IDS,
    check_resources,
    contained,
    find_seed_collisions,
    make_protocol,
    peak_rss_bytes,
)
from .routing import Graph
from .runner import execute_arm
from .verify import verify


def write_new(path, value):
    path = Path(path)
    with path.open("xb") as stream:
        stream.write(canonical(value) + b"\n")


def freeze_study(root: Path, out: Path) -> dict:
    root = Path(root).absolute()
    out = contained(root, out)
    if out.exists():
        raise FileExistsError(f"study already exists: {out}")
    protocol = make_protocol(root)
    protocol["frozen_directory"] = str(out.relative_to(root))
    collisions = find_seed_collisions(
        root, protocol["seeds"]["preflight"] + protocol["seeds"]["evaluate"]
    )
    if collisions:
        raise ValueError("seed collision in existing artifacts: " + ", ".join(collisions))
    pack = read_bundle(root / protocol["pack_path"])["graph.json"]
    out.mkdir(parents=True, exist_ok=False)
    (out / "tapes").mkdir()
    for seed in protocol["input_digests"]:
        inputs = generate_inputs(
            pack, protocol["scientific_spec"], int(seed), protocol["node_pool"], protocol["zones"]
        )
        if digest(inputs) != protocol["input_digests"][seed]:
            raise ValueError("input generation changed during freeze")
        write_new(out / "tapes" / f"{seed}-inputs.json", inputs)
    protocol_digest = digest(protocol)
    write_new(out / "protocol.json", {**protocol, "protocol_digest": protocol_digest})
    write_new(
        out / "freeze.json",
        {
            "protocol_digest": protocol_digest,
            "seed_collision_scan": "No prior structured tape/experiment seed matches",
            "map_eligibility": "BLOCKED_MAP_QUALIFICATION",
        },
    )
    return {
        "output": str(out),
        "protocol_digest": protocol_digest,
        "tapes": len(protocol["input_digests"]),
    }


def capture_study(root, frozen):
    root = Path(root).absolute()
    frozen = contained(root, frozen)
    protocol = load_json(frozen / "protocol.json")
    if protocol.get("frozen_directory") != str(frozen.relative_to(root)):
        raise ValueError("foreign frozen directory")
    expected = make_protocol(root)
    expected["frozen_directory"] = str(frozen.relative_to(root))
    claimed = protocol.get("protocol_digest")
    if (
        claimed != digest({k: v for k, v in protocol.items() if k != "protocol_digest"})
        or claimed != digest(expected)
        or load_json(frozen / "freeze.json").get("protocol_digest") != claimed
    ):
        raise ValueError("frozen protocol/input/spec/source identity mismatch")
    expected_files = {f"{seed}-inputs.json" for seed in protocol["input_digests"]}
    if {p.name for p in (frozen / "tapes").iterdir()} != expected_files:
        raise ValueError("mismatched frozen tape inventory")
    tapes = {}
    for seed, wanted in protocol["input_digests"].items():
        tape = load_json(frozen / "tapes" / f"{seed}-inputs.json")
        if digest(tape) != wanted or tape.get("seed") != int(seed):
            raise ValueError("frozen input digest mismatch")
        tapes[int(seed)] = tape
    allowed = {
        "protocol.json",
        "freeze.json",
        "tapes",
        "preflight",
        "evaluate",
        "preflight-analysis.json",
        "evaluate-analysis.json",
    }
    if {p.name for p in frozen.iterdir()} - allowed:
        raise ValueError("foreign files in study directory")
    pack = read_bundle(root / protocol["pack_path"])["graph.json"]
    return protocol, tapes, pack


def bound_spec(protocol, arm):
    return {
        **copy.deepcopy(protocol["arms"][arm]),
        "power_study": protocol["id"],
        "power_protocol_digest": protocol["protocol_digest"],
    }


def validate_run(run, inputs, pack, expected_spec, protocol):
    if (
        run.get("spec") != expected_spec
        or run.get("model") != protocol["model"]
        or run.get("pack_digest") != protocol["pack_digest"]
        or run.get("input_digest") != digest(inputs)
    ):
        raise ValueError("run protocol/input/spec/map/model mismatch")
    return verify(run, inputs, pack)


def capture_arm(path, inputs, pack, expected_spec, protocol):
    if {p.name for p in Path(path).iterdir()} != {
        "manifest.json",
        "run.json",
        "inputs.json",
        "verification.json",
        "execution-context.json",
    }:
        raise ValueError("run bundle inventory mismatch")
    bundle = read_bundle(path)
    if digest(bundle["inputs.json"]) != digest(inputs):
        raise ValueError("arm differs from frozen input")
    verification = validate_run(bundle["run.json"], inputs, pack, expected_spec, protocol)
    if digest(verification) != digest(bundle["verification.json"]):
        raise ValueError("stored verification differs from fresh verification")
    if bundle["execution-context.json"].get("semantic_run_digest") != digest(bundle["run.json"]):
        raise ValueError("semantic run digest mismatch")
    return bundle, verification


def execute_study(root: Path, frozen: Path, mode: str) -> dict:
    if mode not in ("preflight", "evaluate"):
        raise ValueError("mode must be preflight or evaluate")
    began = time.monotonic()
    root, frozen = Path(root).absolute(), Path(frozen).absolute()
    if mode == "evaluate":
        from .power_analysis import analyze_study

        preflight = analyze_study(root, frozen, "preflight")
        if preflight["analysis_status"] != "COMPLETE":
            raise ValueError("complete valid preflight required before evaluation")
    protocol, tapes, pack = capture_study(root, frozen)
    destination = frozen / mode
    destination.mkdir(exist_ok=False)
    write_new(
        destination / "started.json", {"protocol_digest": protocol["protocol_digest"], "mode": mode}
    )
    rows = []
    result = {
        "protocol_digest": protocol["protocol_digest"],
        "mode": mode,
        "status": "INCOMPLETE",
        "arms": rows,
        "failure": None,
        "map_eligibility": "BLOCKED_MAP_QUALIFICATION",
        "decision_authority": "NONE",
        "scope": "SIMULATION_ONLY",
    }
    try:
        check_resources(protocol["limits"]["estimated_route_table_bytes"])
        graph = Graph(pack)
        tick = time.monotonic()
        graph.prepare(protocol["node_pool"])
        result["router_prepare_s"] = time.monotonic() - tick
        check_resources(protocol["limits"]["estimated_route_table_bytes"])
        for seed in protocol["seeds"][mode]:
            for arm in ARM_IDS:
                # Detect file mutation between arms; captured dictionaries remain unchanged.
                if (
                    digest(load_json(frozen / "tapes" / f"{seed}-inputs.json"))
                    != protocol["input_digests"][str(seed)]
                ):
                    raise ValueError("frozen tape mutated during execution")
                if load_json(frozen / "protocol.json") != protocol:
                    raise ValueError("frozen protocol mutated during execution")
                check_resources(protocol["limits"]["estimated_route_table_bytes"])
                path = destination / f"{seed}-{arm}"
                tick = time.monotonic()
                _, verification, context = execute_arm(
                    pack, tapes[seed], bound_spec(protocol, arm), graph, path
                )
                row = {
                    "seed": seed,
                    "arm": arm,
                    "run_digest": context["semantic_run_digest"],
                    "engine_s": context["wall_s"],
                    "execution_verify_write_s": time.monotonic() - tick,
                    "valid": verification["valid"],
                    "eligible": verification["recommendation_eligible"],
                    "peak_rss_bytes": peak_rss_bytes(),
                    "disk_bytes": sum(p.stat().st_size for p in path.iterdir()),
                }
                rows.append(row)
                check_resources(protocol["limits"]["estimated_route_table_bytes"])
                if not verification["valid"] or not verification["recommendation_eligible"]:
                    raise ValueError(f"invalid or hard-violation arm {seed}-{arm}")
        result["status"] = "COMPLETE"
    except Exception as exc:
        result["failure"] = {"type": type(exc).__name__, "detail": str(exc)}
    result["total_s"] = time.monotonic() - began
    result["peak_rss_bytes"] = peak_rss_bytes()
    result["disk_bytes"] = sum(r["disk_bytes"] for r in rows)
    write_new(destination / "execution.json", result)
    return result
