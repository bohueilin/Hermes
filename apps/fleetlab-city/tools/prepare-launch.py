#!/usr/bin/env python3
"""Prepare, without publishing, a legacy-preserving FleetLab City Pages tree."""

import argparse
import difflib
import hashlib
import json
import os
import shutil
import stat
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PAGES_FILE_LIMIT = 25 * 1024 * 1024
PAGES_FREE_FILE_LIMIT = 20_000
LEGACY_FILES = 99
RELEASE_SCHEMA = "fleetlab.city-release/1.0.0"
CITY_CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self'; "
    "img-src 'self' data: blob:; connect-src 'self'; "
    "worker-src 'self' blob:; font-src 'self'; base-uri 'none'; "
    "object-src 'none'; frame-ancestors 'none'; form-action 'none'"
)


def sha_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def inventory(root):
    """Record every regular file and reject links/special files at any depth."""
    if not root.is_dir() or root.is_symlink():
        raise ValueError(f"directory unavailable or linked: {root}")
    records = {}
    for parent, dirs, files in os.walk(root, followlinks=False):
        for name in dirs:
            path = Path(parent) / name
            if not stat.S_ISDIR(path.lstat().st_mode):
                raise ValueError(f"linked or special directory refused: {path}")
        for name in files:
            path = Path(parent) / name
            if not stat.S_ISREG(path.lstat().st_mode):
                raise ValueError(f"linked or special file refused: {path}")
            rel = path.relative_to(root).as_posix()
            records[rel] = {"bytes": path.stat().st_size, "sha256": sha_file(path)}
    return dict(sorted(records.items()))


def verify_legacy(root, readback=None):
    files = inventory(root)
    if len(files) != LEGACY_FILES or "_headers" not in files or "index.html" not in files:
        raise ValueError(
            f"legacy inventory expected {LEGACY_FILES} files including index.html and _headers"
        )
    if readback is not None:
        evidence = json.loads(Path(readback).read_text())
        candidates = evidence if isinstance(evidence, list) else [evidence]
        hosted = {k: v for k, v in files.items() if k != "_headers"}
        header_lines = (root / "_headers").read_text().splitlines()
        expected_headers = {}
        for line in header_lines:
            if line[:1].isspace() and ":" in line:
                key, value = line.strip().split(":", 1)
                expected_headers[key.lower()] = value.strip()
        matched = False
        for record in candidates:
            observed = {
                f.get("path"): {"bytes": f.get("bytes"), "sha256": f.get("sha256")}
                for f in record.get("files", [])
                if f.get("matches") is True
            }
            actual_headers = {k.lower(): v for k, v in record.get("headers", {}).items()}
            if (
                record.get("headers_match") is True
                and record.get("legacy_headers_sha256") == files["_headers"]["sha256"]
                and record.get("matched") == len(hosted)
                and record.get("total") == len(hosted)
                and observed == hosted
                and all(actual_headers.get(k) == v for k, v in expected_headers.items())
            ):
                matched = True
                break
        if not matched:
            raise ValueError("legacy files differ from complete hosted readback")
    return files


def verify_viewer(root, role):
    files = inventory(root)
    if "release.json" not in files:
        raise ValueError(f"{role} release.json missing")
    release = json.loads((root / "release.json").read_text())
    if release.get("schema") != RELEASE_SCHEMA:
        raise ValueError(f"{role} unsupported release schema")
    expected = release.get("files")
    if not isinstance(expected, dict) or expected != {
        k: v for k, v in files.items() if k != "release.json"
    }:
        raise ValueError(f"{role} release integrity mismatch")
    for required in ("index.html", "app.mjs", "style.css", "network.json", "_headers"):
        if required not in expected:
            raise ValueError(f"{role} release missing {required}")
    network = json.loads((root / "network.json").read_text())
    if (
        network.get("origins") != ["self"]
        or network.get("accounts") is not False
        or network.get("analytics") is not False
        or network.get("provider_calls") is not False
    ):
        raise ValueError(f"{role} network contract is not self-only")
    if release.get("scope") != "REVIEW_ONLY" or release.get("public_deployment") != "NOT_PERFORMED":
        raise ValueError(f"{role} review-only release contract required")
    compatibility = release.get("compatibility")
    if not isinstance(compatibility, dict) or not all(
        compatibility.get(x) for x in ("viewer", "pack", "run", "metrics")
    ):
        raise ValueError(f"{role} compatibility declaration missing")
    if max(r["bytes"] for r in files.values()) > PAGES_FILE_LIMIT:
        raise ValueError(f"{role} exceeds Pages 25 MiB per-file limit")
    return release, files


def require_compatible(current, prior):
    now = current["compatibility"]
    old = prior["compatibility"]
    same_data = all(now[key] == old[key] for key in ("pack", "run", "metrics"))
    same_viewer_major = now["viewer"].split(".", 1)[0] == old["viewer"].split(".", 1)[0]
    if not (same_data and same_viewer_major):
        raise ValueError(
            "rollback viewer is not compatible with current pack/run/metrics contracts"
        )


def write_json(path, data):
    path.write_text(json.dumps(data, sort_keys=True, indent=2) + "\n")


def safe_copy(source, destination, before):
    shutil.copytree(source, destination)
    if inventory(source) != before or inventory(destination) != before:
        raise ValueError(f"input mutated or staged copy differs: {source}")


def make_entry(city_dir, prefix):
    switch_name = f"switch-{prefix}.mjs"
    (city_dir / "index.html").write_text(
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>City explorer · FleetLab</title></head><body>"
        "<p>Opening the versioned City explorer…</p>"
        f'<script type="module" src="./{switch_name}"></script>'
        f'<noscript><a href="./releases/{prefix}/">Open the versioned City explorer</a></noscript>'
        "</body></html>\n"
    )
    (city_dir / switch_name).write_text(
        f"const target = new URL('./releases/{prefix}/', location.href);\n"
        "target.search = location.search;\n"
        "target.hash = location.hash;\n"
        "location.replace(target.href);\n"
    )


def make_candidate_headers(original, review):
    old = original.decode("utf-8")
    permission_value = "camera=(), microphone=(), geolocation=()"
    inherited_permissions = [
        line.strip().split(":", 1)[1].strip()
        for line in old.splitlines()
        if line.strip().lower().startswith("permissions-policy:")
    ]
    addition = (
        f"\n/city-explorer/*\n  ! Content-Security-Policy\n  Content-Security-Policy: {CITY_CSP}\n"
    )
    if inherited_permissions != [permission_value]:
        if inherited_permissions:
            addition += "  ! Permissions-Policy\n"
        addition += f"  Permissions-Policy: {permission_value}\n"
    proposed = old.rstrip("\n") + "\n" + addition
    (review / "_headers.candidate").write_text(proposed)
    (review / "_headers.diff").write_text(
        "".join(
            difflib.unified_diff(
                old.splitlines(keepends=True),
                proposed.splitlines(keepends=True),
                fromfile="legacy/_headers",
                tofile="candidate/_headers",
            )
        )
    )


def make_optional_nav_diff(review):
    """Propose a source-only legacy link; never edit the source or packaged site."""
    source_path = ROOT / "playground/fleetlab/src/ui/studio.js"
    source = source_path.read_text()
    marker = "  const brand=pageLink('F','overview',navigate);"
    if source.count(marker) != 1 or "  const navLinks=navItems.map(" not in source:
        raise ValueError("legacy navigation source changed; optional diff needs review")
    proposed = source.replace(
        marker,
        "  navLinks.push(el('a',{href:'/city-explorer/'},'City explorer'));\n" + marker,
        1,
    )
    (review / "optional-legacy-nav.diff").write_text(
        "".join(
            difflib.unified_diff(
                source.splitlines(keepends=True),
                proposed.splitlines(keepends=True),
                fromfile="playground/fleetlab/src/ui/studio.js",
                tofile="optional/playground/fleetlab/src/ui/studio.js",
            )
        )
    )


def prepare(legacy, viewer, out, previous_viewer, legacy_readback=None):
    legacy, viewer, out, previous_viewer = map(Path, (legacy, viewer, out, previous_viewer))
    if out.exists():
        raise ValueError(f"output already exists: {out}")
    sources = [legacy.resolve(), viewer.resolve(), previous_viewer.resolve()]
    target = out.resolve()
    if any(target == src or src in target.parents or target in src.parents for src in sources):
        raise ValueError("output must be separate from every input tree")
    legacy_files = verify_legacy(legacy, legacy_readback)
    current, viewer_files = verify_viewer(viewer, "viewer")
    prior, prior_files = verify_viewer(previous_viewer, "rollback")
    require_compatible(current, prior)
    current_id = sha_file(viewer / "release.json")[:16]
    prior_id = sha_file(previous_viewer / "release.json")[:16]
    if current_id == prior_id:
        raise ValueError("rollback must be a distinct prior release")
    if len(legacy_files) + len(viewer_files) + len(prior_files) + 2 > PAGES_FREE_FILE_LIMIT:
        raise ValueError("stage exceeds Pages 20,000-file free-plan ceiling")
    out.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix=out.name + ".tmp-", dir=out.parent))
    try:
        site = temp / "site"
        review = temp / "review"
        review.mkdir()
        safe_copy(legacy, site, legacy_files)
        city = site / "city-explorer"
        releases = city / "releases"
        releases.mkdir(parents=True)
        current_path = f"city-explorer/releases/{current_id}"
        prior_path = f"city-explorer/releases/{prior_id}"
        safe_copy(viewer, site / current_path, viewer_files)
        safe_copy(previous_viewer, site / prior_path, prior_files)
        make_entry(city, current_id)
        make_candidate_headers((legacy / "_headers").read_bytes(), review)
        make_optional_nav_diff(review)
        staged = inventory(site)
        if any(staged.get(name) != record for name, record in legacy_files.items()):
            raise ValueError("legacy payload changed during staging")
        if max(record["bytes"] for record in staged.values()) > PAGES_FILE_LIMIT:
            raise ValueError("stage exceeds Pages 25 MiB per-file limit")
        added = {name: record for name, record in staged.items() if name not in legacy_files}
        write_json(
            review / "inventory-diff.json",
            {
                "legacy_unchanged": legacy_files,
                "modified_legacy": [],
                "removed_legacy": [],
                "added": added,
                "stage_files": len(staged),
                "largest_file_bytes": max(r["bytes"] for r in staged.values()),
            },
        )
        rollback = {
            "status": "COMPATIBLE_STAGED",
            "path": prior_path,
            "release_sha256": sha_file(previous_viewer / "release.json"),
            "compatibility": prior["compatibility"],
            "unit": "viewer + compatible manifest + city pack + run/metric schema",
            "rehearsal": "NOT_RUN",
            "retention_after_publication_days": 30,
            "manual_restore": (
                "Point the stable switch module at this staged release; verify catalog "
                "and replay with the candidate headers before any later publication."
            ),
        }
        write_json(review / "rollback.json", rollback)
        report = {
            "stage_schema": "fleetlab.city-launch-stage/1.0.0",
            "legacy": {
                "files": len(legacy_files),
                "headers_sha256": legacy_files["_headers"]["sha256"],
                "hosted_readback": "MATCHED" if legacy_readback else "NOT_PROVIDED",
            },
            "current": {
                "path": current_path,
                "release_sha256": sha_file(viewer / "release.json"),
                "compatibility": current["compatibility"],
            },
            "rollback": rollback,
            "stable_entry": "city-explorer/index.html",
            "header_candidate": "review/_headers.candidate",
            "optional_legacy_nav_diff": "review/optional-legacy-nav.diff",
            "header_publication_exception": (
                "Root _headers in site/ remains byte-identical to legacy; "
                "candidate route rule requires a separately reviewed "
                "root-file replacement."
            ),
            "pages_file_limit_bytes": PAGES_FILE_LIMIT,
            "pages_file_count": len(staged),
            "release_ready": False,
            "pending": [
                "owner review",
                "route CSP and data Range readback",
                "map/source human qualification",
                "target-device/browser checks",
                "rollback rehearsal",
            ],
            "publication": "NOT_PERFORMED",
        }
        write_json(review / "staging-report.json", report)
        temp.rename(out)
        return report
    except BaseException:
        shutil.rmtree(temp, ignore_errors=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--legacy", type=Path, required=True, help="preserved 99-file hosted legacy directory"
    )
    parser.add_argument(
        "--viewer",
        type=Path,
        required=True,
        help="verified current City explorer release directory",
    )
    parser.add_argument(
        "--out", type=Path, required=True, help="new staging directory; must not exist"
    )
    parser.add_argument(
        "--previous-viewer",
        type=Path,
        default=ROOT / "dist/city-explorer-reviewed",
        help="prior compatible viewer for rollback",
    )
    parser.add_argument(
        "--legacy-readback",
        type=Path,
        default=ROOT
        / "build/fleetlab-city/validation/launch-live-baseline-20260929/live-readback.json",
        help="complete current hosted readback evidence",
    )
    args = parser.parse_args()
    result = prepare(args.legacy, args.viewer, args.out, args.previous_viewer, args.legacy_readback)
    print(
        json.dumps(
            {
                "stage": str(args.out),
                "current": result["current"]["path"],
                "legacy_files": result["legacy"]["files"],
                "release_ready": False,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
