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


PRIVATE_MARKERS = (b"/Users/", b"/private/tmp/", b"BEGIN PRIVATE KEY")


def public_report_projection(path, expected_sha):
    raw = path.read_bytes()
    if sha(raw) != expected_sha:
        raise ValueError("public report original identity mismatch")
    report = json.loads(raw)
    report.pop("traceback", None)
    report["publication_projection"] = {
        "schema": "fleetlab.public-diagnostic/1.0.0",
        "original_sha256": expected_sha,
        "omitted_json_pointers": ["/traceback"],
        "reason": "Private workstation paths; original retained locally unchanged.",
        "original_bytes_reproducible_from_projection": False,
    }
    data = (json.dumps(report, sort_keys=True, indent=2) + "\n").encode()
    if any(marker in data for marker in PRIVATE_MARKERS):
        raise ValueError("private material remains in public report")
    return data


def archive(out, paths, notice, license_bytes, projections=None):
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
            if path in (projections or {}):
                name, data = projections[path]
            if any(marker in data for marker in PRIVATE_MARKERS):
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


def build(out, temporal_candidate=False):
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
    temporal_identity = None
    projections = {}
    notice, reproduction = NOTICE, REPRO
    if temporal_candidate:
        pack = ROOT / "build/fleetlab-city/packs/sf-temporal-v3-r2"
        workspace = ROOT / "build/fleetlab-city/reviews/sf-temporal-v3-review-r2"
        evidence = ROOT / "build/fleetlab-city/validation/sf-temporal-fleet-20260930-r6"
        corrected = evidence.with_name(evidence.name + "-verifier-3.0.1")
        temporal_manifest = json.loads((pack / "manifest.json").read_text())
        temporal_identity = temporal_manifest["content_digest"]
        if temporal_identity != "8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198":
            raise ValueError("source offer requires the selected complete temporal candidate")
        groups["sf-temporal-v3-complete.tar.gz"] = list(pack.glob("*.json"))
        groups["sf-temporal-v3-review.tar.gz"] = list(workspace.iterdir())
        groups["sf-temporal-recording.tar.gz"] = [evidence / n for n in ("run.json", "inputs.json")]
        groups["sf-temporal-engineering-evidence.tar.gz"] = (
            [
                evidence / n
                for n in (
                    "freeze.json",
                    "execute-report.json",
                    "verify-report.json",
                    "verification.json",
                )
            ]
            + [corrected / n for n in ("freeze.json", "verify-report.json", "verification.json")]
            + [ROOT / "build/fleetlab-city/validation/sf-temporal-20260930/r5/graph.json"]
        )
        groups["transformation-code.tar.gz"] += [APP / "tools/package-temporal-candidate.py"]
        original_report = evidence / "verify-report.json"
        projections[original_report] = (
            original_report.with_name("verify-report.public.json").relative_to(ROOT).as_posix(),
            public_report_projection(
                original_report,
                "e444d51809c598dda1e2bd60b73d6dd36e2e83b1b5b66dffa85a49e7104710dc",
            ),
        )
        notice += """\n30 September temporal candidate addition:
The complete sf-temporal-v3-r2 map is also offered under ODbL 1.0, with the
same captured sources and geographic scope. Its qualification remains HOLD.
The review workspace is candidate-specific and contains no human observations.
The separate 100-vehicle, eight-hour recording is one synthetic engineering
case, not a new depot comparison or an operator prediction. Its first invalid
verification is supplied as an explicitly labeled public projection with only
the private traceback omitted. The original SHA-256 is retained; its bytes are
preserved locally, not downloadable. All findings and corrected verification
of the same recording are included without alteration.
The main notebook/replay continue to use the original sf-v1 experiment.
"""
        reproduction += """\n## Temporal candidate and engineering record

The complete temporal database is supplied in sf-temporal-v3-complete.tar.gz.
The source XML and previous map remain in their corresponding archives above.
The unmodified original graph bytes used by the engineering recording are also
included in sf-temporal-engineering-evidence.tar.gz to preserve its raw hashes.
The large recording is separate in sf-temporal-recording.tar.gz. Extraction
preserves all relative paths; no simulator execution is needed to inspect it.
Exception: verify-report.public.json replaces the original failed report in
this public offer. Its publication_projection records the original SHA-256 and
the omitted /traceback field, which contained private workstation paths.
The original failed report hash in the corrected freeze cannot be reproduced
from this projection. All graph, input, recording and corrected-result bytes
are exact, and the public projection never claims the original file identity.

Use citylib.verify_temporal_v3.verify(run, inputs, graph) for independent
read-only event verification of decoded JSON inputs. It does not run a simulator.
The corrected verifier identity is 3.0.1. Resource measurements and limitations
are in the retained reports; one successful case does not qualify a whole city.

The generic immutable container format remains city-pack/1.0.0; its graph uses
city-temporal-pack/3.0.0, with a distinct temporal-map-candidate/1.0.0 report.
Static fleet consumers must not route this graph. The map does not enable a
site-specific depot connector or establish physical maneuver feasibility.
The stopped power study is separate and is not resumed by these tools.
"""
    with tempfile.TemporaryDirectory(prefix="map-offer-", dir=out.parent) as temporary:
        target = Path(temporary) / "sources"
        target.mkdir()
        members = {
            name: archive(target / name, files, notice.encode(), licenses, projections)
            for name, files in groups.items()
        }
        if temporal_candidate:
            archived = members["sf-temporal-v3-complete.tar.gz"]
            prefix = pack.relative_to(ROOT).as_posix() + "/"
            for name, expected in temporal_manifest["files"].items():
                if archived.get(prefix + name) != expected:
                    raise ValueError(
                        "archived temporal database differs from its complete manifest"
                    )
        (target / "ODbL-1.0.txt").write_bytes(licenses)
        (target / "NOTICE.txt").write_text(notice)
        (target / "REPRODUCE.md").write_text(reproduction)
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
            "temporal_candidate_bundle_digest": temporal_identity,
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
    parser.add_argument("--temporal-candidate", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(args.out, args.temporal_candidate), indent=2))
