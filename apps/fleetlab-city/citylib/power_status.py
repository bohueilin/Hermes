"""Fresh status projection of a stopped study; never estimate from a partial population."""

from pathlib import Path

from .contracts import digest, load_json
from .power_package import source_identity
from .power_protocol import ARM_IDS
from .power_study import bound_spec, capture_arm, capture_study


def export_power_status(root, frozen):
    root, frozen = Path(root), Path(frozen)
    before = source_identity(frozen)
    protocol, tapes, graph = capture_study(root, frozen)
    execution = load_json(frozen / "evaluate/execution.json")
    expected = [(seed, arm) for seed in protocol["seeds"]["evaluate"] for arm in ARM_IDS]
    if (
        execution.get("protocol_digest") != protocol["protocol_digest"]
        or execution.get("mode") != "evaluate"
        or execution.get("status") != "INCOMPLETE"
        or not isinstance(execution.get("failure"), dict)
    ):
        raise ValueError("expected an explicitly stopped, compatible evaluation")
    rows = execution.get("arms")
    if not isinstance(rows, list) or len(rows) >= len(expected):
        raise ValueError("invalid incomplete arm population")
    keys = [(r["seed"], r["arm"]) for r in rows]
    if keys != expected[: len(keys)]:
        raise ValueError("completed arms differ from scheduled prefix")
    inventory = {p.name for p in (frozen / "evaluate").iterdir()}
    if inventory != {"started.json", "execution.json", *(f"{s}-{a}" for s, a in keys)}:
        raise ValueError("partial, missing or foreign evaluation directory; inspect raw evidence")
    completed = {}
    for row in rows:
        seed, arm = row["seed"], row["arm"]
        bundle, verification = capture_arm(
            frozen / "evaluate" / f"{seed}-{arm}",
            tapes[seed],
            graph,
            bound_spec(protocol, arm),
            protocol,
        )
        if digest(bundle["run.json"]) != row["run_digest"]:
            raise ValueError("completed run differs from execution record")
        if (
            row["valid"] != verification["valid"]
            or row["eligible"] != verification["recommendation_eligible"]
        ):
            raise ValueError("execution verification claim differs from fresh verification")
        completed[seed, arm] = {
            "seed": seed,
            "arm": arm,
            "status": "RECORDED",
            "verification": verification["verification"],
            "run_digest": row["run_digest"],
            "bundle_digest": bundle["manifest.json"]["content_digest"],
        }
        del bundle
    del graph, tapes
    final_protocol = capture_study(root, frozen)[0]
    if final_protocol != protocol or source_identity(frozen) != before:
        raise ValueError("study mutated during partial-status projection")
    return {
        "schema": "fleetlab.power-status/1.0.0",
        "id": protocol["id"],
        "protocol_digest": protocol["protocol_digest"],
        "analysis_status": "INCOMPLETE",
        "primary": None,
        "completed_arms": len(rows),
        "scheduled_arms": len(expected),
        "not_run_arms": len(expected) - len(rows),
        "failure": execution["failure"],
        "peak_rss_bytes": execution.get("peak_rss_bytes"),
        "limits": protocol.get("limits"),
        "seeds": protocol["seeds"]["evaluate"],
        "cells": [
            completed.get((s, a), {"seed": s, "arm": a, "status": "NOT_RUN"}) for s, a in expected
        ],
        "scope": "SIMULATION_ONLY",
        "decision_authority": "NONE",
        "authenticity": "NOT_AUTHENTICATED",
        "map_eligibility": "BLOCKED_MAP_QUALIFICATION",
        "interpretation": (
            "A resource-stopped population cannot support a primary estimate; "
            "no replacement cells or extrapolation"
        ),
    }


if __name__ == "__main__":
    import json
    import sys

    print(json.dumps(export_power_status(Path(sys.argv[1]), Path(sys.argv[2]))))
