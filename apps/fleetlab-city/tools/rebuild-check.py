#!/usr/bin/env python3
"""Rebuild the pinned source into a new immutable directory and compare semantic files."""

import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parents[1]
sys.path.insert(0, str(APP))
from citylib.contracts import digest, load_json, read_bundle, save_json  # noqa: E402
from citylib.importer import import_sf  # noqa: E402

config = load_json(APP / "config/sf-v1.json")
original = read_bundle(ROOT / config["output"])
config["output"] = "build/fleetlab-city/packs/sf-v1-rebuilt"
rebuilt = import_sf(config, ROOT)
result = read_bundle(rebuilt["output"])
checks = {
    name: digest(original[name]) == digest(result[name])
    for name in (
        "graph.json",
        "coverage.json",
        "geometry.json",
        "roads.geo.json",
        "source-inventory.json",
    )
}
record = {
    "pass": all(checks.values()),
    "checks": checks,
    "note": (
        "Output directory in import-config differs intentionally; "
        "semantic source products must match."
    ),
}
save_json(ROOT / "build/fleetlab-city/validation/import-repeat.json", record)
print(record)
if not record["pass"]:
    raise SystemExit(1)
