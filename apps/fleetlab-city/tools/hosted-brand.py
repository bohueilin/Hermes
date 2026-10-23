"""Source-owned public presentation; input generations are never edited."""

import argparse
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "brand_launch", Path(__file__).with_name("prepare-launch.py")
)
launch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(launch)
ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "apps/fleetlab-city/hosted"
MEDIA = {
    **json.loads((ASSETS / "diagram-assets.json").read_text()),
    **json.loads((ASSETS / "brand-assets.json").read_text()),
    **json.loads((ASSETS / "rebalancing-assets.json").read_text()),
    **json.loads((ASSETS / "tile-assets.json").read_text()),
}
TEXT = ("brand.mjs", "brand.css", "visitor.mjs", "visitor-families.mjs", "visitor.css")


def transform(value, mode="--render"):
    result = subprocess.run(
        ["node", str(ASSETS / "site-transform.mjs"), mode],
        input=value,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def asset_inventory():
    for folder, count in (("brand-media", 7), ("tile-media", 19), ("rebalancing-media", 4)):
        source = f"apps/fleetlab-city/{folder}"
        actual = launch.inventory(ROOT / source)
        expected = {
            Path(r["source"]).name: {k: r[k] for k in ("bytes", "sha256")}
            for r in MEDIA.values()
            if r["source"].startswith(source + "/")
        }
        if (
            actual != expected
            or len(actual) != count
            or sum(r["bytes"] for r in actual.values()) > 2 * 1024**2
        ):
            raise ValueError(f"{folder} inventory or 2 MiB asset budget differs")
    return {
        **{
            name: {
                "bytes": (ASSETS / name).stat().st_size,
                "sha256": launch.sha_file(ASSETS / name),
            }
            for name in TEXT
        },
        **{name: {k: r[k] for k in ("bytes", "sha256")} for name, r in MEDIA.items()},
    }


def projected_manifest(original, original_sha256):
    if (original.get("schema") != launch.RELEASE_SCHEMA
            or "hosting_projection" in original or "hosted_presentation" in original
            or "_headers" not in original.get("files", {})):
        raise ValueError("original unprojected review manifest required")
    return {**original,
            "files": {k: v for k, v in original["files"].items() if k != "_headers"},
            "hosting_projection": {
                "schema": "fleetlab.city-hosting-projection/1.0.0",
                "original_release_sha256": original_sha256,
                "omitted_paths": ["_headers"], "header_source": "ROOT_HEADERS",
            }}


def project_hosted_base(viewer, out):
    """Derive a new header-free generation; preserve the original input identity."""
    viewer, out = Path(viewer), Path(out)
    if out.exists():
        raise ValueError("new viewer output already exists")
    if viewer.resolve() in out.resolve().parents:
        raise ValueError("projection output must be separate from its input")
    original, before = launch.verify_viewer(viewer, "original")
    if "hosting_projection" in original or "hosted_presentation" in original:
        raise ValueError("select an original review viewer, not an already projected generation")
    projected = projected_manifest(original, before["release.json"]["sha256"])
    shutil.copytree(viewer, out)
    (out / "_headers").unlink()
    launch.write_json(out / "release.json", projected)
    launch.verify_viewer(out, "projected")
    if launch.inventory(viewer) != before:
        raise ValueError("original viewer mutated")
    return projected


def verify_projected_base(viewer, original_bytes):
    release, files = launch.verify_viewer(Path(viewer), "projected base")
    expected = projected_manifest(
        json.loads(original_bytes), hashlib.sha256(original_bytes).hexdigest()
    )
    if release != expected:
        raise ValueError("City base differs from original hosting projection")
    return release, files


def derive_viewer(viewer, out, source_commit):
    viewer, out = Path(viewer), Path(out)
    if out.exists():
        raise ValueError("new viewer output already exists")
    if not re.fullmatch(r"[a-f0-9]{40}", source_commit):
        raise ValueError("exact source commit required")
    release, before = launch.verify_viewer(viewer, "base")
    if release.get("hosted_presentation"):
        raise ValueError("select the original review viewer, not an already branded generation")
    if not release.get("hosting_projection"):
        raise ValueError("hosted presentation requires a projected base without nested headers")
    assets = asset_inventory()
    shutil.copytree(viewer, out)
    (out / "index.html").write_text(transform((viewer / "index.html").read_text()))
    if (out / "index.html.gz").exists():
        # Use the verifier's Node runtime: Python gzip headers/zlib versions differ.
        (out / "index.html.gz").write_bytes(
            subprocess.run(
                ["node", "--input-type=module", "-e",
                 "import {gzipSync} from 'node:zlib'; import {readFileSync} from 'node:fs'; "
                 "process.stdout.write(gzipSync(readFileSync(0),{level:9}));"],
                input=(out / "index.html").read_bytes(), capture_output=True, check=True,
            ).stdout
        )
    network = json.loads((out / "network.json").read_text())
    network.update(
        schema="fleetlab.city-network/1.1.0",
        origins=launch.ANALYTICS_ORIGINS,
        analytics=True,
        storage=launch.ANALYTICS_STORAGE,
        hosting_disclosure=(
            "Google Analytics measures visits on fleetlab.pages.dev. "
            "Preview collection is disabled. Cloudflare receives hosting requests."
        ),
    )
    launch.write_json(out / "network.json", network)
    release["hosted_presentation"] = {
        "schema": "fleetlab.hosted-presentation/1.0.0",
        "source_commit": source_commit,
        "base_release_sha256": before["release.json"]["sha256"],
        "measurement_id": "G-04EZ8EZWQ2",
        "external_assets": assets,
    }
    release["files"] = {k: v for k, v in launch.inventory(out).items() if k != "release.json"}
    changed = {k for k, v in release["files"].items() if before.get(k) != v}
    if changed - {"index.html", "index.html.gz", "network.json"}:
        raise ValueError("unexpected City scientific or source change")
    launch.write_json(out / "release.json", release)
    launch.verify_viewer(out, "new presentation")
    if launch.inventory(viewer) != before:
        raise ValueError("base viewer mutated")
    return release


def apply_site(site, current, rollback):
    site = Path(site)
    assets = asset_inventory()
    for name in TEXT:
        shutil.copyfile(ASSETS / name, site / name)
    for name, record in MEDIA.items():
        (site / name).parent.mkdir(exist_ok=True)
        shutil.copyfile(ROOT / record["source"], site / name)
    transformed = {}
    for path in sorted(site.rglob("*.html")):
        name = path.relative_to(site).as_posix()
        if name.startswith(("downloads/", "city-explorer/releases/")):
            continue
        content = transform(path.read_text())
        path.write_text(content)
        transformed[name] = content
    offer = site / "city-explorer/sources/manifest.json"
    offered = json.loads(offer.read_text())
    offered["files"]["index.html"] = {
        "bytes": (offer.parent / "index.html").stat().st_size,
        "sha256": launch.sha_file(offer.parent / "index.html"),
    }
    launch.write_json(offer, offered)
    header = site / "_headers"
    lines = header.read_text().splitlines()
    lines = [
        line.split(":", 1)[0] + ": " + transform(line.split(":", 1)[1].strip(), "--policy")
        if line.strip().startswith("Content-Security-Policy:")
        else line
        for line in lines
    ]
    # Immutable historical HTML remains analytics-free and keeps its original restrictive policy.
    # Like every path rule, it cannot be relied on: an encoded spelling of the path gets only /*.
    lines.extend(
        [
            "",
            f"/{rollback}/*",
            "  ! Content-Security-Policy",
            "  Content-Security-Policy: " + launch.CITY_CSP,
        ]
    )
    header.write_text("\n".join(lines) + "\n")
    release = json.loads((site / current / "release.json").read_text())
    if release.get("hosted_presentation", {}).get("external_assets") != assets:
        raise ValueError("current City presentation depends on different hosted assets")
    return transformed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--viewer", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--source-commit")
    parser.add_argument("--project-base", action="store_true",
                        help="Create a new header-free base generation for root policy hosting")
    args = parser.parse_args()
    if args.project_base:
        if args.source_commit:
            parser.error("--project-base does not accept --source-commit")
        project_hosted_base(args.viewer, args.out)
        print("New City hosting projection verified; original input preserved.")
    else:
        if not args.source_commit:
            parser.error("--source-commit is required for a presentation")
        derive_viewer(args.viewer, args.out, args.source_commit)
        print("New City presentation generation verified; scientific files and base preserved.")
