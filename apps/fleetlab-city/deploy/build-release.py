#!/usr/bin/env python3
"""Reconstruct and verify a local FleetLab release from explicit immutable inputs."""

import argparse
import hashlib
import json
import os
import platform
import re
import runpy
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ENV = {key: os.environ[key] for key in (
    "PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "TERM", "NO_COLOR"
) if key in os.environ}


def command(*args):
    return subprocess.run([str(arg) for arg in args], cwd=ROOT, env=ENV,
                          text=True, capture_output=True, check=True).stdout.strip()


def clean_source(commit):
    if (not re.fullmatch(r"[a-f0-9]{40}", commit)
            or command("git", "rev-parse", "HEAD") != commit
            or command("git", "status", "--porcelain")):
        raise ValueError("clean source checkout at the exact requested commit required")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fingerprint_inventory(files):
    return digest(json.dumps(files, sort_keys=True, separators=(",", ":")).encode())


def input_file(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 4 * 1024**2:
        raise ValueError("regular input evidence file within 4 MiB required")
    return path.read_bytes()


def build(commit, legacy, legacy_readback, city_base, city_source_offer, out):
    clean_source(commit)
    out = Path(out)
    if out.exists() or out.is_symlink():
        raise ValueError("output already exists")
    out = out.resolve()
    legacy, legacy_readback, city_base, city_source_offer = map(
        Path, (legacy, legacy_readback, city_base, city_source_offer))
    inputs = [legacy, legacy_readback, city_base, city_source_offer]
    if any(out == path.resolve() or path.resolve() in out.parents or out in path.resolve().parents
           for path in inputs):
        raise ValueError("output must be separate from every input; overlapping paths refused")
    if (out == ROOT or out in ROOT.parents
            or (ROOT in out.parents and ROOT / "dist" not in out.parents)):
        raise ValueError("output must be outside source or under its ignored dist directory")
    if not out.parent.is_dir():
        raise ValueError("output parent directory must already exist")

    integration = runpy.run_path(str(ROOT / "apps/fleetlab-city/tools/integrate-site.py"))
    launch = integration["launch"]
    readback = input_file(legacy_readback)
    original_base = input_file(city_base / "release.json")
    original_offer = input_file(city_source_offer / "manifest.json")
    integration["check_city_inputs"](original_base, original_offer)
    before = {"legacy": launch.verify_legacy(legacy, legacy_readback),
              "city_base": launch.verify_viewer(city_base, "original")[1],
              "city_source_offer": launch.inventory(city_source_offer)}
    offered = json.loads(original_offer)
    if offered.get("files") != {
        k: v for k, v in before["city_source_offer"].items() if k != "manifest.json"
    }:
        raise ValueError("original City source offer integrity mismatch")
    tools = ROOT / "playground/fleetlab/tools"
    city = ROOT / "apps/fleetlab-city"
    with tempfile.TemporaryDirectory(prefix=".fleetlab-build-", dir=out.parent) as temporary:
        work = Path(temporary)
        result, teaching, offline, package = (
            work / "result", work / "teaching", work / "offline.html", work / "package"
        )
        result.mkdir()
        command("node", tools / "pack.mjs", "--site", teaching, "--source-commit", commit)
        command("node", tools / "pack.mjs", "--out", offline)
        command("node", tools / "check-dist.mjs", "--site", teaching)
        command("node", tools / "check-dist.mjs", offline)
        proof = ["node", tools / "package-proof.mjs", "--site", teaching,
                 "--playground", ROOT / "playground/fleetlab", "--offline", offline,
                 "--source-commit", commit]
        command(*proof, "--out", package)
        command(*proof, "--check", package)
        base, current, stage = work / "city-base", work / "city-current", result / "stage"
        command(sys.executable, "-B", city / "tools/hosted-brand.py", "--viewer", city_base,
                "--out", base, "--project-base")
        command(sys.executable, "-B", city / "tools/hosted-brand.py", "--viewer", base,
                "--out", current, "--source-commit", commit)
        command(sys.executable, "-B", city / "tools/integrate-site.py", "--legacy", legacy,
                "--readback", legacy_readback, "--viewer", current, "--previous", base,
                "--offer", city_source_offer, "--offline", offline, "--out", stage,
                "--client-update", teaching, "--source-commit", commit, "--flow-update",
                "--brand-update", "--teaching-package", package,
                "--city-base-manifest", city_base / "release.json")
        command("node", tools / "package-proof.mjs", "--check-integrated", stage / "site",
                "--playground", ROOT / "playground/fleetlab", "--source-commit", commit)
        # This independently checks the complete stage and writes local-only evidence.
        command("node", city / "deploy/record-release.mjs", "--site", stage / "site",
                "--source", ROOT, "--commit", commit, "--out", result / "local-release.json",
                "--python", sys.executable)
        after = {"legacy": launch.inventory(legacy), "city_base": launch.inventory(city_base),
                 "city_source_offer": launch.inventory(city_source_offer)}
        if after != before or input_file(legacy_readback) != readback:
            raise ValueError("immutable build inputs changed")
        clean_source(commit)
        launch.write_json(result / "build-inputs.json", {
            "schema": "fleetlab.local-release-build/1.0.0", "source_commit": commit,
            "recipe": "apps/fleetlab-city/deploy/build-release.py",
            "publication": "NOT_PERFORMED", "readback": "NOT_PERFORMED",
            "inputs": {
                name: {"inventory_sha256": fingerprint_inventory(files), "file_count": len(files)}
                for name, files in before.items()
            },
            "legacy_readback_sha256": digest(readback),
            "city_base_release_sha256": digest(original_base),
            "city_source_offer_manifest_sha256": digest(original_offer),
            "runtime": {"python": platform.python_version(), "node": command("node", "--version")},
        })
        if out.exists() or out.is_symlink():
            raise ValueError("output appeared during build; refusing replacement")
        result.rename(out)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", required=True)
    for name in ("legacy", "legacy-readback", "city-base", "city-source-offer", "out"):
        parser.add_argument("--" + name, type=Path, required=True)
    try:
        build(**vars(parser.parse_args()))
        print("Local release verified; publication and hosted readback NOT_PERFORMED.")
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        detail = (
            error.stderr.strip() if isinstance(error, subprocess.CalledProcessError) else str(error)
        )
        print("Release build failed: " + detail, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
