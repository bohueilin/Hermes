#!/usr/bin/env python3
"""Create clearly labeled local failure fixtures from a reviewed static package."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, default=Path("dist/city-explorer-reviewed"))
parser.add_argument("--out", type=Path, default=Path("build/fleetlab-city/browser-fixtures"))
args = parser.parse_args()
source, root = args.source, args.out
root.mkdir(exist_ok=False)
for status in ["INCOMPATIBLE", "INVALID", "INCOMPLETE"]:
    dest = root / status.lower()
    (dest / "data").mkdir(parents=True)
    shutil.copytree(source / "vendor", dest / "vendor")
    for name in [
        "index.html",
        *[p.name for p in source.glob("*.css")],
        *[p.name for p in source.glob("*.mjs")],
    ]:
        shutil.copyfile(source / name, dest / name)
    if (source / "assets").exists():
        shutil.copytree(source / "assets", dest / "assets")
    for candidate in (source / "data").glob("candidate-*.json"):
        shutil.copyfile(candidate, dest / "data" / candidate.name)
    for name in ["routing-roads.geo.json", "geometry.json"]:
        shutil.copyfile(source / "data" / name, dest / "data" / name)
    comparison = {
        "schema": "fleetlab.city-comparison/1.0.0",
        "eligibility": status,
        "outcome": status,
        "pairs": [],
        "reason": f"LOCAL TEST FIXTURE: {status}; no SF result is represented",
        "decision_authority": "NONE",
        "scope": "SIMULATION_ONLY",
        "expected_seeds": [],
        "pack_qualified": False,
    }
    data = json.dumps(comparison).encode()
    (dest / "data/comparison.json").write_bytes(data)
    catalog = json.loads((source / "data/catalog.json").read_text())
    catalog["files"]["data/comparison.json"] = {
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    (dest / "data/catalog.json").write_text(json.dumps(catalog))
print("Three clearly labeled local state fixtures created; replay files deliberately absent.")
