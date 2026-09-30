"""Read-only, freshly validated browser projection of the frozen power study."""

import copy
import gzip
import stat
from pathlib import Path

from .contracts import canonical, digest, load_json, read_bundle, save_json
from .power_analysis import analyze_study
from .power_protocol import ARM_IDS
from .power_study import bound_spec, capture_arm, capture_study
from .presentation import feature_vehicles, vehicle_views


def scientific_content(value):
    # Exactly this observational runtime changes during honest re-verification.
    return {k: v for k, v in value.items() if k != "verification_and_analysis_s"}


def energy_metadata(spec):
    return {k: spec[k] for k in ("initial_kwh", "target_kwh", "reserve_kwh")} | {
        "nominal_capacity_kwh": spec.get("capacity_kwh"),
        "capacity_usage": "UNUSED_NOMINAL_METADATA",
    }


def source_identity(frozen):
    """Bounded filesystem identity guard for ledger/inventory and late mutations."""
    identity = {}
    for path in frozen.rglob("*"):
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise ValueError("symlink in frozen study")
        if not stat.S_ISREG(info.st_mode) and not stat.S_ISDIR(info.st_mode):
            raise ValueError("unsupported frozen study entry")
        identity[str(path.relative_to(frozen))] = (
            info.st_dev,
            info.st_ino,
            info.st_size,
            info.st_mtime_ns,
            info.st_ctime_ns,
        )
        if len(identity) > 2048:
            raise ValueError("frozen study inventory exceeds projection bound")
    return identity


def export_power_study(root, frozen, destination):
    root, frozen, destination = Path(root), Path(frozen), Path(destination)
    before = source_identity(frozen)
    stored = load_json(frozen / "evaluate-analysis.json")
    fresh = analyze_study(root, frozen, "evaluate")
    if fresh["analysis_status"] != "COMPLETE":
        raise ValueError(
            "complete fresh power evaluation required; incomplete study retained locally"
        )
    if digest(scientific_content(stored)) != digest(scientific_content(fresh)):
        raise ValueError("stored power analysis differs from captured runs and fresh verification")
    protocol, tapes, graph = capture_study(root, frozen)
    seed = protocol.get("replay", {}).get("seed", protocol["seeds"]["evaluate"][0])
    identities = {(r["seed"], r["arm"]): r for r in fresh["run_set"]}
    recordings, compressed = [], {}
    for arm in ARM_IDS:
        spec = protocol["arms"][arm]
        bundle, verification = capture_arm(
            frozen / "evaluate" / f"{seed}-{arm}",
            tapes[seed],
            graph,
            bound_spec(protocol, arm),
            protocol,
        )
        expected = identities[(seed, arm)]
        if (
            digest(bundle["run.json"]) != expected["run_digest"]
            or bundle["manifest.json"]["content_digest"] != expected["bundle_digest"]
        ):
            raise ValueError("replay changed after fresh analysis")
        run = bundle["run.json"]
        key = f"power-{seed}-{arm}"
        energy = energy_metadata(spec)
        fleet, traces = [], {}
        identity = {
            "study": protocol["id"],
            "seed": seed,
            "arm": arm,
            "configuration": arm,
            "source_run_digest": expected["run_digest"],
        }
        size = 0
        for view in vehicle_views(run, bundle["inputs.json"], graph):
            vid = view["vehicle"]
            fleet.append({"vehicle": vid, **view["summary"]})
            payload = {
                **view,
                **identity,
                "schema": "fleetlab.city-vehicle-view/1.1.0",
                "energy": energy,
                "layout": arm.split("-")[0].upper(),
                "total_power_kw": sum(s["power_kw"] for s in spec["sites"]),
                "interval_s": spec["sample_s"],
                "verification": verification["verification"],
                "execution": run["execution"],
                "decision_authority": "NONE",
            }
            name = f"run-{key}-{vid}.json"
            data = canonical(payload) + b"\n"
            (destination / name).write_bytes(data)
            size += len(gzip.compress(data, mtime=0))
            traces[vid] = "data/" + name
        fleet_payload = {**identity, "vehicles": fleet, "featured": feature_vehicles(fleet)}
        name = f"fleet-{key}.json"
        save_json(destination / name, fleet_payload)
        size += len(gzip.compress(canonical(fleet_payload) + b"\n", mtime=0))
        compressed[arm] = size
        recordings.append(
            {
                **identity,
                "energy": energy,
                "layout": arm.split("-")[0].upper(),
                "total_power_kw": sum(s["power_kw"] for s in spec["sites"]),
                "sites": [
                    {**s, "coordinates": graph["nodes"][s["node"]], "provenance": "FICTIONAL"}
                    for s in spec["sites"]
                ],
                "fleet_file": "data/" + name,
                "vehicle_files": traces,
            }
        )
    # Re-capture all exact digests after projection, including non-replay arms.
    # The scientific verifier already evaluated these bytes above. Do not repeat
    # expensive analysis when bounded no-follow capture can establish equality.
    for expected in fresh["run_set"]:
        captured = read_bundle(frozen / "evaluate" / f"{expected['seed']}-{expected['arm']}")
        if captured["manifest.json"]["content_digest"] != expected["bundle_digest"]:
            raise ValueError("power study changed during projection")
    final_protocol, _, _ = capture_study(root, frozen)
    if digest(final_protocol) != digest(protocol):
        raise ValueError("frozen study changed during projection")
    if source_identity(frozen) != before:
        raise ValueError("frozen study files changed during projection")
    projection = copy.deepcopy(fresh)
    for row in projection["arms"]:
        if row.get("diagnostics"):
            row["diagnostics"].pop("requests", None)
    projection["projection_schema"] = "fleetlab.power-view/1.0.0"
    save_json(destination / "power-analysis.json", projection)
    save_json(
        destination / "power-protocol.json", {k: v for k, v in protocol.items() if k != "root"}
    )
    study = {
        "schema": "fleetlab.city-study/1.0.0",
        "id": protocol["id"],
        "label": "Power headroom · six configurations",
        "seeds": protocol["seeds"]["evaluate"],
        "configurations": list(ARM_IDS),
        "analysis_file": "data/power-analysis.json",
        "protocol_file": "data/power-protocol.json",
        "replay_seed": seed,
        "recordings": recordings,
        "protocol_digest": protocol["protocol_digest"],
    }
    budgets = {
        f"power-{seed}-{reference}-{candidate}": compressed[reference] + compressed[candidate]
        for reference, candidate in [
            ("a-200", "ab-200"),
            ("a-200", "b-200"),
            ("a-400", "ab-400"),
            ("a-400", "b-400"),
        ]
    }
    return study, budgets
