#!/usr/bin/env python3
"""Create an additive hosted release; never publish or modify input distributions."""

import argparse
import importlib.util
import json
import shutil
import tempfile
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "launch", Path(__file__).with_name("prepare-launch.py")
)
launch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(launch)
ASSETS = Path(__file__).resolve().parents[1] / "hosted"
EXCEPTIONS = frozenset(("index.html", "boot.js", "_headers"))


def check_preservation(before, after):
    changed = {name for name, record in before.items() if after.get(name) != record}
    if changed - EXCEPTIONS or any(name not in after for name in before):
        raise ValueError(f"unexpected established file changes: {sorted(changed)}")
    return sorted(changed)


def integrate(legacy, viewer, previous, offer, out, offline, readback=None):
    legacy, viewer, previous, offer, out, offline = map(
        Path, (legacy, viewer, previous, offer, out, offline)
    )
    if out.exists():
        raise ValueError("output already exists")
    offer_files = launch.inventory(offer)
    offer_manifest = json.loads((offer / "manifest.json").read_text())
    if offer_manifest.get("files") != {
        k: v for k, v in offer_files.items() if k != "manifest.json"
    }:
        raise ValueError("source offer integrity mismatch")
    if not {"index.html", "ODbL-1.0.txt"}.issubset(offer_files):
        raise ValueError("source offer missing required notices")
    offline_before = launch.sha_file(offline)
    established = launch.verify_legacy(legacy, readback)
    boot = (legacy / "boot.js").read_text()
    index = (legacy / "index.html").read_text()
    marker = '<link rel="stylesheet" href="./styles.css">'
    if (
        boot.count("start({ studio: true") != 1
        or boot.count("import { start }") != 1
        or index.count(marker) != 1
    ):
        raise ValueError("established bootstrap contract changed; inspect before integrating")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="fleetlab-integration-", dir=out.parent) as temporary:
        stage = Path(temporary) / "stage"
        report = launch.prepare(legacy, viewer, stage, previous, readback)
        site, review = stage / "site", stage / "review"
        (site / "boot.js").write_text(
            'import { mountCityEntry } from "./integration.mjs";\n' + boot + "\nmountCityEntry();\n"
        )
        (site / "index.html").write_text(
            index.replace(marker, marker + '\n<link rel="stylesheet" href="./integration.css">')
        )
        shutil.copyfile(review / "_headers.candidate", site / "_headers")
        for name in ("integration.mjs", "integration.css"):
            shutil.copyfile(ASSETS / name, site / name)
        launch.safe_copy(offer, site / "city-explorer/sources", offer_files)
        final = launch.inventory(site)
        changed = check_preservation(established, final)
        if set(changed) != EXCEPTIONS:
            raise ValueError("declared integration changes incomplete")
        if launch.inventory(legacy) != established or launch.sha_file(offline) != offline_before:
            raise ValueError("input distribution changed during integration")
        if (
            len(final) > launch.PAGES_FREE_FILE_LIMIT
            or max(r["bytes"] for r in final.values()) > launch.PAGES_FILE_LIMIT
        ):
            raise ValueError("Pages file budget exceeded")
        result = {
            "schema": "fleetlab.hosted-integration/1.0.0",
            "current": report["current"],
            "rollback": report["rollback"],
            "modified_existing": {
                name: {"before": established[name], "after": final[name]} for name in changed
            },
            "preserved_existing": {
                name: record for name, record in established.items() if name not in changed
            },
            "removed_existing": [],
            "offline_sha256": offline_before,
            "source_offer_manifest_sha256": launch.sha_file(offer / "manifest.json"),
            "files": final,
            "file_count": len(final),
            "total_bytes": sum(r["bytes"] for r in final.values()),
            "publication": "NOT_PERFORMED",
            "scientific_eligibility": "BLOCKED_MAP_QUALIFICATION",
        }
        launch.write_json(review / "integration-manifest.json", result)
        # Historical prepare-stage reports describe the intermediate immutable copy.
        # This final manifest alone describes the intentionally modified hosted tree.
        stage.rename(out)
        return {key: value for key, value in result.items() if key != "files"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("legacy", "viewer", "previous", "offer", "out", "offline"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--readback", type=Path)
    args = parser.parse_args()
    report = integrate(**vars(args))
    print(
        json.dumps(
            {
                k: v
                for k, v in report.items()
                if k not in ("modified_existing", "preserved_existing")
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
