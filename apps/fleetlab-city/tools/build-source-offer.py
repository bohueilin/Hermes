#!/usr/bin/env python3
"""Export complete corresponding map databases with exact source and code identities."""

import argparse
import gzip
import hashlib
import html
import io
import json
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / "apps/fleetlab-city"
NOTICE = """FleetLab San Francisco map databases — 29 September 2026

Contains information from OpenStreetMap, © OpenStreetMap contributors,
made available under the Open Database License (ODbL) 1.0.
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/

The corresponding OSM-derived databases and road/route geometry are offered
under ODbL 1.0. Complete sf-v1 and sf-v2 databases are provided, including
graphs, restrictions, source inventories, configurations and qualification
records. Recorded operations use sf-v1; sf-v2 is an unqualified map candidate.
See each pack manifest for exact constituent hashes. No qualification is
conferred by publication or a checksum.

DataSF Supervisor Districts (2022), dataset f2zs-jevy, is provided separately
under the captured metadata's CC0 1.0 designation:
https://data.sfgov.org/Geographic-Locations-and-Boundaries/Supervisor-Districts-2022/f2zs-jevy
https://creativecommons.org/publicdomain/zero/1.0/

Transformation software: copyright 2026 Bo-Huei Lin, Apache License 2.0.
The Apache software license does not replace ODbL for the map databases.
MapLibre GL JS 6.11.2: BSD-3-Clause, license in the viewer's vendor directory.
Demand, depot choices and fleet operations are synthetic. Illustrations are
original conceptual artwork, without operator affiliation or endorsement.
"""
REPRO = """# Corresponding map source offer

Unpack `captured-sources.tar.gz` and the selected complete derived pack archive.
The database is supplied in full; no regeneration is needed to obtain it.
Every exact uncompressed member has its size and SHA-256 in manifest.json.
The OSM snapshot, DataSF polygons, query and capture metadata are retained.

For optional reproduction, unpack `transformation-code.tar.gz` in the same
root. Python 3.11 and requirements.lock.txt are required. Configurations use
relative build/fleetlab-city paths; there are no workstation-specific paths.
Run from that root (imports can take substantial RAM):

    python -m pip install -r apps/fleetlab-city/requirements.lock.txt
    python apps/fleetlab-city/tools/city.py import-sf --config apps/fleetlab-city/config/sf-v1.json
    python apps/fleetlab-city/tools/city.py import-sf --config apps/fleetlab-city/config/sf-v2.json

Use a fresh output tree for regeneration; do not overwrite downloaded records.
Compare generated manifest/file hashes with the full databases. The browser's
recorded operations use sf-v1. sf-v2 has source-backed restriction changes, but
cross-leg route continuity and independent semantic review remain open.
No source offer or simulation result proves current road access or vehicle safety.
"""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def archive(out, paths, notice, license_bytes):
    members = {}
    with (
        out.open("wb") as raw,
        gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as zipped,
        tarfile.open(fileobj=zipped, mode="w|") as tar,
    ):
        for path in sorted(paths):
            if not path.is_file() or path.is_symlink():
                raise ValueError("source offer refuses links or non-files")
            name = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            if any(
                marker in data for marker in (b"/Users/", b"/private/tmp/", b"BEGIN PRIVATE KEY")
            ):
                raise ValueError(f"private path/material in public offer: {name}")
            members[name] = {"bytes": len(data), "sha256": sha(data)}
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(data), 0o644
            tar.addfile(info, io.BytesIO(data))
        for name, data in [("MAP-NOTICE.txt", notice), ("ODbL-1.0.txt", license_bytes)]:
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(data), 0o644
            tar.addfile(info, io.BytesIO(data))
            members[name] = {"bytes": len(data), "sha256": sha(data)}
    if out.stat().st_size > 25 * 1024 * 1024:
        raise ValueError(f"archive exceeds Pages per-file budget: {out.name}")
    return members


def build(out):
    if out.exists():
        raise ValueError("output must be new")
    out.parent.mkdir(parents=True, exist_ok=True)
    licenses = (APP / "licenses/ODbL-1.0.txt").read_bytes()
    groups = {
        "sf-v1-complete.tar.gz": list((ROOT / "build/fleetlab-city/packs/sf-v1").glob("*.json")),
        "sf-v2-complete.tar.gz": list((ROOT / "build/fleetlab-city/packs/sf-v2").glob("*.json")),
        "captured-sources.tar.gz": list((ROOT / "build/fleetlab-city/sources").iterdir()),
        "transformation-code.tar.gz": list((APP / "citylib").glob("*.py"))
        + list((APP / "config").glob("*.json"))
        + [APP / "tools/city.py", APP / "requirements.lock.txt", ROOT / "LICENSE"],
    }
    with tempfile.TemporaryDirectory(prefix="map-offer-", dir=out.parent) as temporary:
        target = Path(temporary) / "sources"
        target.mkdir()
        members = {
            name: archive(target / name, files, NOTICE.encode(), licenses)
            for name, files in groups.items()
        }
        (target / "ODbL-1.0.txt").write_bytes(licenses)
        (target / "NOTICE.txt").write_text(NOTICE)
        (target / "REPRODUCE.md").write_text(REPRO)
        links = "".join(
            f'<li><a href="./{html.escape(name)}">{html.escape(name)}</a>'
            f"<span>{(target / name).stat().st_size / 1024 / 1024:.1f} MiB"
            " · complete archive</span></li>"
            for name in groups
        )
        template = (APP / "hosted/map-sources.html").read_text()
        (target / "index.html").write_text(template.replace("{{DOWNLOADS}}", links))
        (target / "sources.css").write_bytes((APP / "hosted/map-sources.css").read_bytes())
        manifest = {
            "schema": "fleetlab.map-source-offer/1.0.0",
            "database_license": "ODbL-1.0",
            "archive_members": members,
            "files": {
                p.name: {"bytes": p.stat().st_size, "sha256": sha(p.read_bytes())}
                for p in sorted(target.iterdir())
            },
        }
        (target / "manifest.json").write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n")
        target.rename(out)
    return {
        "files": len(manifest["files"]) + 1,
        "archives": {name: (out / name).stat().st_size for name in groups},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path)
    print(json.dumps(build(parser.parse_args().out), indent=2))
