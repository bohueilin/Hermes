"""Versioned, outcome-independent specification for the SF diagnostic power study."""

import copy
import os
import platform
import resource
import sys
from importlib.metadata import version
from pathlib import Path

from .contracts import digest, load_json, read_bundle, read_bytes, sha
from .engine import MODEL
from .inputs import generate_inputs
from .runner import scientific_spec

STUDY_ID = "sf-power-headroom-v1"
SPEC_PATH = "apps/fleetlab-city/experiments/sf-depots-v1.json"
LEGACY_SPEC_DIGEST = "64f1be6c7442e988c619a97b687c85bac5f259519a62142c894a0d4dbf23c56e"
LEGACY_PACK_MANIFEST = "5c604fa0c0af9355dd6851ec5f6f7cac16a00b3c296c08de318f468ac1d7e536"
ARM_IDS = ("a-200", "ab-200", "b-200", "a-400", "ab-400", "b-400")
PREFLIGHT_SEEDS = tuple(range(7301001, 7301005))
EVALUATION_SEEDS = tuple(range(7302001, 7302025))
SOURCE_FILES = (
    "contracts.py",
    "engine.py",
    "inputs.py",
    "routing.py",
    "restrictions.py",
    "runner.py",
    "verify.py",
    "ledger.py",
    "pack.py",
    "power_protocol.py",
    "power_study.py",
    "power_analysis.py",
)


def validate_seeds(preflight, evaluation):
    if (
        len(preflight) != 4
        or len(evaluation) != 24
        or any(type(s) is not int for s in [*preflight, *evaluation])
        or len(set(preflight + evaluation)) != 28
    ):
        raise ValueError("duplicate, overlapping or incomplete seed schedule")


def peak_rss_bytes():
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if sys.platform == "darwin" else value * 1024)


def check_resources(route_table_bytes, rss_bytes=None):
    if route_table_bytes > 2_000_000_000:
        raise ValueError("route table exceeds 2 GB limit")
    if (peak_rss_bytes() if rss_bytes is None else rss_bytes) > 4_000_000_000:
        raise ValueError("process memory exceeds 4 GB limit")


def contained(root, path):
    root, path = Path(root).absolute(), Path(path).absolute()
    if path.is_symlink() or any(p.is_symlink() for p in path.parents):
        raise ValueError("symlink refused")
    if not path.is_relative_to(root) or ".." in path.parts:
        raise ValueError("path outside selected root")
    return path


def arm_specs(spec):
    result = {}
    a, b = spec["sites"][0], spec["candidate_sites"][1]
    for power in (200, 400):
        for layout, selected in [("a", [a]), ("ab", [a, b]), ("b", [b])]:
            arm = copy.deepcopy(scientific_spec(spec))
            arm["sites"] = [
                {
                    **copy.deepcopy(s),
                    "ports": 8 // len(selected),
                    "slots": 4 // len(selected),
                    "port_kw": 50,
                    "power_kw": power // len(selected),
                }
                for s in selected
            ]
            result[f"{layout}-{power}"] = arm
    return result


def source_identity(root):
    base = Path(root) / "apps/fleetlab-city/citylib"
    return {name: sha(read_bytes(base / name)) for name in SOURCE_FILES}


def make_protocol(root: Path) -> dict:
    root = Path(root).absolute()
    spec = load_json(contained(root, root / SPEC_PATH))
    if digest(spec) != LEGACY_SPEC_DIGEST:
        raise ValueError("legacy scientific specification differs from approved frozen v1")
    if (
        spec["model"] != MODEL
        or spec["pack_path"] != "build/fleetlab-city/packs/sf-v1"
        or len(spec["node_pool"]) != 220
        or len(set(spec["node_pool"])) != 220
        or spec["sites"][0]["node"] != "2327650830"
        or spec["candidate_sites"][1]["node"] != "3998169805"
    ):
        raise ValueError("wrong map, model, node pool or depot identity")
    controls = {
        "fleet_size": 100,
        "request_count": 1200,
        "duration_s": 28800,
        "initial_kwh": 30,
        "target_kwh": 48,
        "background_per_hour": 0,
    }
    if any(spec.get(k) != v for k, v in controls.items()):
        raise ValueError("frozen scientific controls differ")
    captured = read_bundle(contained(root, root / spec["pack_path"]))
    if captured["manifest.json"]["content_digest"] != LEGACY_PACK_MANIFEST:
        raise ValueError("wrong map: approved frozen v1 pack manifest differs")
    pack = captured["graph.json"]
    if (
        pack.get("pack_id") != "sf-v1"
        or pack.get("routing_profile", "node-via/1.0.0") != "node-via/1.0.0"
    ):
        raise ValueError("wrong map or routing model")
    if any(n not in pack["nodes"] for n in spec["node_pool"]):
        raise ValueError("node pool differs from pack")
    preflight, evaluation = list(PREFLIGHT_SEEDS), list(EVALUATION_SEEDS)
    validate_seeds(preflight, evaluation)
    route_bytes = (len(pack["edges"]) + len(spec["node_pool"])) * len(spec["node_pool"]) * 12
    check_resources(route_bytes)
    inputs = {
        str(seed): digest(
            generate_inputs(pack, scientific_spec(spec), seed, spec["node_pool"], spec["zones"])
        )
        for seed in preflight + evaluation
    }
    return {
        "schema": "fleetlab.power-protocol/1.0.0",
        "id": STUDY_ID,
        "root": str(root),
        "model": MODEL,
        "spec_digest": digest(spec),
        "pack_path": spec["pack_path"],
        "pack_manifest_digest": captured["manifest.json"]["content_digest"],
        "pack_digest": digest({k: pack[k] for k in ("nodes", "edges", "turns")}),
        "sources": source_identity(root),
        "generator": {
            "name": "citylib.inputs.generate_inputs",
            "version": "1.0.0",
            "python": platform.python_version(),
            "dependencies": {name: version(name) for name in ("numpy", "scipy", "jsonschema")},
            "rng": "random.Random",
            "namespaces": {"demand_and_initial": "seed", "background": "seed + 1000000"},
            "independence": "Numeric disjointness is not proof of statistical independence",
        },
        "scientific_spec": scientific_spec(spec),
        "node_pool": spec["node_pool"],
        "zones": spec["zones"],
        "arms": arm_specs(spec),
        "seeds": {"preflight": preflight, "evaluate": evaluation},
        "input_digests": inputs,
        "analysis": {
            "version": "fleetlab.power-analysis/1.0.0",
            "primary": "(AB400-A400)-(AB200-A200)",
            "unit": "percentage_points",
            "method": "95% paired Student t interval across seed interactions",
            "confidence": 0.95,
            "practical_band_pp": [-1, 1],
            "required_blocks": 24,
            "secondary": "B-only location diagnostics",
            "guardrails": "historical fleetlab.city-comparison/1.0.0; descriptive only",
            "conditional_waits": (
                "boarded and completed-in-both populations are treatment-dependent"
            ),
            "uncertainty_excludes": [
                "map error",
                "model error",
                "real-world calibration",
                "simultaneous coverage",
            ],
        },
        "replay": {"mode": "evaluate", "seed": evaluation[0], "arms": list(ARM_IDS)},
        "limits": {
            "process_rss_bytes": 4_000_000_000,
            "route_table_bytes": 2_000_000_000,
            "estimated_route_table_bytes": route_bytes,
            "evaluation_arms": 144,
            "preflight_arms": 24,
        },
        "stop_rules": [
            "invalid or partial arm",
            "hard violation",
            "incompatible input/spec/pack/model",
            "resource limit",
            "execution failure",
            "seed already inspected",
            "no replacement seeds/cells; repair requires a new named study",
        ],
        "map_eligibility": "BLOCKED_MAP_QUALIFICATION",
        "decision_authority": "NONE",
        "scope": "SIMULATION_ONLY",
        "authenticity": "NOT_AUTHENTICATED",
    }


def find_seed_collisions(root, seeds):
    """Inspect prior structured scenario tapes and source experiment seed registries."""
    root = Path(root)
    files = set((root / "apps/fleetlab-city/experiments").glob("*.json"))
    # Generated evidence lives here; skip runtime/dependency installations.
    for directory in (".",):
        base = root / directory
        if base.exists():
            for folder, directories, names in os.walk(base, followlinks=False):
                directories[:] = [
                    d
                    for d in directories
                    if d
                    not in {
                        "venv",
                        ".venv",
                        "node_modules",
                        ".git",
                        "__pycache__",
                        "third_party",
                        ".superpowers",
                    }
                ]
                files.update(
                    Path(folder) / n
                    for n in names
                    if n.endswith("inputs.json") or n in {"protocol.json", "frozen-protocol.json"}
                )
    hits = []
    wanted = set(seeds)

    def visit(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == "seed" and type(item) is int and item in wanted:
                    return True
                # The power protocol reserves its seed blocks even if only the
                # protocol survives and its materialized input tapes are absent.
                if key == "seeds" and isinstance(item, dict):
                    for mode in ("preflight", "evaluate"):
                        schedule = item.get(mode)
                        if isinstance(schedule, list) and any(
                            type(seed) is int and seed in wanted for seed in schedule
                        ):
                            return True
                if (
                    key.endswith("seeds")
                    and isinstance(item, list)
                    and any(s in wanted for s in item if type(s) is int)
                ):
                    return True
                if visit(item):
                    return True
        elif isinstance(value, list):
            return any(visit(v) for v in value)
        return False

    for path in sorted(files):
        if visit(load_json(path)):
            hits.append(str(path.relative_to(root)))
    return hits
