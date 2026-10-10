#!/usr/bin/env python3
"""Create an additive hosted release; never publish or modify input distributions."""

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "launch", Path(__file__).with_name("prepare-launch.py")
)
launch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(launch)
ASSETS = Path(__file__).resolve().parents[1] / "hosted"
EXCEPTIONS = frozenset(("index.html", "boot.js", "_headers"))
CLIENT_FIXES = frozenset(("src/ui/setup-codec.js", "src/ui/setup-sharing.js", "src/ui/studio.js"))
FLOW_CHANGED = frozenset((
    "styles.css", "src/ui/routes.js", "src/ui/teaching-frames.js", "src/ui/charts.js",
    "src/ui/simulation-catalog.js", "src/ui/operations-lab.js", "src/ui/street-lab.js",
    "src/ui/hero-film.js",
))
FLOW_ADDED = frozenset((
    "src/model/depot-flow-contract.js", "src/model/depot-flow.js",
    "src/model/depot-flow-verify.js", "src/ui/depot-flow-lab.js",
    "src/model/depot-cohort-contract.js", "src/model/depot-cohort.js",
    "src/model/depot-cohort-verify.js", "src/ui/depot-flow-view.js",
    "src/ui/depot-flow-reading.js", "src/ui/depot-flow-player.js",
))
CAPACITY_ADDED = frozenset((
    "network-flows/capacity/index.html", "network-flows/capacity/boot.js",
    "network-flows/capacity/visual.css", "network-flows/capacity/release.json",
    "src/ui/depot-capacity-bench.js", "src/ui/depot-capacity-guided.js",
    "src/ui/capacity-app.js", "src/ui/depot-capacity-page.js", "src/ui/depot-capacity-view.js",
    "src/model/depot-capacity-contract.js", "src/model/depot-capacity.js",
    "src/model/depot-capacity-verify.js", "src/data/depot-capacity-study.js",
))
CAPACITY_BOOT = 'import { startCapacity } from "../../src/ui/capacity-app.js";\nstartCapacity();\n'
PROVENANCE_TOOL = (
    Path(__file__).resolve().parents[3] / "playground/fleetlab/tools/release-sidecar.mjs"
)


def check_temporal_offer(release, offered, offer):
    selection = release.get("temporal_candidate")
    if not selection:
        return
    identity = selection.get("candidate_bundle_digest")
    archive = "sf-temporal-v3-complete.tar.gz"
    if not identity or identity != offered.get("temporal_candidate_bundle_digest"):
        raise ValueError("temporal source offer does not match viewer")
    path = offer / archive
    if not path.is_file():
        raise ValueError("temporal source offer missing complete database")
    declared = offered.get("archive_members", {}).get(archive, {})
    with tarfile.open(path, "r:gz") as tar:
        manifests = [m for m in tar.getmembers() if m.name.endswith("/manifest.json")]
        if len(manifests) != 1 or not manifests[0].isfile() or manifests[0].size > 1024**2:
            raise ValueError("temporal source offer has no unique bounded manifest")
        raw = tar.extractfile(manifests[0]).read()
        manifest = json.loads(raw)
        claimed = manifest.pop("content_digest", None)
        canonical = json.dumps(
            manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode()
        if claimed != identity or hashlib.sha256(canonical).hexdigest() != identity:
            raise ValueError("temporal source offer candidate identity mismatch")
        prefix = manifests[0].name.removesuffix("manifest.json")
        for name, record in manifest["files"].items():
            key = prefix + name
            if declared.get(key) != record:
                raise ValueError("temporal source offer constituent identity mismatch")
            member = tar.getmember(key)
            if not member.isfile() or member.size != record["bytes"]:
                raise ValueError("temporal source offer constituent size mismatch")
            checksum = hashlib.sha256()
            with tar.extractfile(member) as stream:
                for chunk in iter(lambda: stream.read(1024**2), b""):
                    checksum.update(chunk)
            if checksum.hexdigest() != record["sha256"]:
                raise ValueError("temporal source offer constituent bytes mismatch")


def check_preservation(before, after, client_update=False, flow_update=False):
    changed = {name for name, record in before.items() if after.get(name) != record}
    allowed = EXCEPTIONS | (CLIENT_FIXES if client_update else frozenset()) | (
        FLOW_CHANGED if flow_update else frozenset()
    )
    if changed - allowed or any(name not in after for name in before):
        raise ValueError(f"unexpected established file changes: {sorted(changed)}")
    return sorted(changed)


def integrate(
    legacy,
    viewer,
    previous,
    offer,
    out,
    offline,
    readback=None,
    client_update=None,
    source_commit=None,
    flow_update=False,
):
    legacy, viewer, previous, offer, out, offline = map(
        Path, (legacy, viewer, previous, offer, out, offline)
    )
    if out.exists():
        raise ValueError("output already exists")
    if flow_update and not client_update:
        raise ValueError("flow update requires a reviewed client distribution")
    if source_commit and not client_update:
        raise ValueError("a source-identified release requires the reviewed security client update")
    offer_files = launch.inventory(offer)
    offer_manifest = json.loads((offer / "manifest.json").read_text())
    if offer_manifest.get("files") != {
        k: v for k, v in offer_files.items() if k != "manifest.json"
    }:
        raise ValueError("source offer integrity mismatch")
    if not {"index.html", "ODbL-1.0.txt"}.issubset(offer_files):
        raise ValueError("source offer missing required notices")
    check_temporal_offer(json.loads((viewer / "release.json").read_text()), offer_manifest, offer)
    offline_before = launch.sha_file(offline)
    established = launch.verify_legacy(legacy, readback)
    boot = (legacy / "boot.js").read_text()
    index = (legacy / "index.html").read_text()
    copied = CLIENT_FIXES | (
        FLOW_CHANGED | FLOW_ADDED | CAPACITY_ADDED if flow_update else frozenset()
    )
    if client_update:
        updates = launch.inventory(Path(client_update))
        if flow_update and set(updates) != set(established) | FLOW_ADDED | CAPACITY_ADDED:
            raise ValueError("flow client inventory has missing or unexpected modules")
        for name in copied:
            if name not in updates or (
                name not in established and name not in FLOW_ADDED | CAPACITY_ADDED
            ):
                raise ValueError("client update missing expected module")
            if name.startswith("network-flows/capacity/"):
                continue  # generated by the packer, so there is no source file; pinned below
            reviewed = launch.ROOT / "playground/fleetlab" / name
            if launch.sha_file(reviewed) != updates[name]["sha256"]:
                raise ValueError("client update differs from reviewed source")
        if flow_update:
            page = Path(client_update) / "network-flows/capacity"
            html = (page / "index.html").read_text().lower()
            if (
                (page / "boot.js").read_text() != CAPACITY_BOOT
                or html.count("<script") != 1
                or html.count("<link") != 2
                or '<script type="module" src="./boot.js"></script>' not in html
                or '<link rel="stylesheet" href="../../styles.css">' not in html
                or '<link rel="stylesheet" href="./visual.css">' not in html
            ):
                raise ValueError("undeclared capacity page change")
            if launch.sha_file(page / "visual.css") != launch.sha_file(
                launch.ROOT / "playground/fleetlab/capacity/visual.css"
            ):
                raise ValueError("capacity visual stylesheet differs from reviewed source")
            command = [
                "node", str(PROVENANCE_TOOL), "--check", str(client_update),
                "--playground", str(launch.ROOT / "playground/fleetlab"),
            ]
            if source_commit:
                command.extend(("--source-commit", source_commit))
            checked = subprocess.run(command, capture_output=True, text=True, check=False)
            if checked.returncode:
                raise ValueError(f"capacity provenance rejected: {checked.stderr.strip()}")
            for name in set(established) - copied - {"index.html"}:
                if updates[name] != established[name]:
                    raise ValueError(f"undeclared teaching client change: {name}")
            # The packer adds CSP/bootstrap markup. Permit only the reviewed metadata
            # wording change against the already verified legacy shell.
            expected_index = index.replace(
                "Four teaching models with explicit limits", "Teaching models with explicit limits"
            )
            index = (Path(client_update) / "index.html").read_text()
            if index != expected_index:
                raise ValueError("undeclared teaching index change")
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
        intro = (
            '<section aria-label="About FleetLab"><h1>FleetLab: test fleet '
            "decisions in simulation</h1>"
            "<p>Independent educational software by Bo-Huei Lin. Explore Fleet day, Street lab, "
            'paired experiments, Depot flow lab and the <a href="/city-explorer/">San '
            "Francisco City Explorer</a>.</p>"
            "<p>Synthetic operations; map qualification remains open. Not affiliated with or "
            "endorsed by Waymo, Zoox, or their partners. No operational authority.</p></section>"
        )
        hosted_index = index.replace(
            marker, marker + '\n<link rel="stylesheet" href="./integration.css">'
        )
        hosted_index = hosted_index.replace(
            "</head>",
            '<link rel="canonical" href="https://fleetlab.pages.dev/">'
            '<meta property="og:url" content="https://fleetlab.pages.dev/">'
            '<meta property="og:site_name" content="FleetLab"><meta '
            'name="author" content="Bo-Huei Lin"></head>',
        )
        hosted_index = hosted_index.replace(
            '<div id="fleetlab-teaching-strip"', intro + '<div id="fleetlab-teaching-strip"'
        )
        (site / "index.html").write_text(hosted_index)
        if client_update:
            for name in copied:
                (site / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(Path(client_update) / name, site / name)
        shutil.copyfile(review / "_headers.candidate", site / "_headers")
        for name in ("integration.mjs", "integration.css"):
            shutil.copyfile(ASSETS / name, site / name)
        for name in ("404.html", "not-found.css"):
            shutil.copyfile(ASSETS / name, site / name)
        offline_path = "downloads/fleetlab-offline.html"
        offline_url = "/downloads/fleetlab-offline"
        (site / "downloads").mkdir(exist_ok=True)
        shutil.copyfile(offline, site / offline_path)
        if launch.sha_file(site / offline_path) != offline_before:
            raise ValueError("offline download copy integrity mismatch")
        (site / "downloads/fleetlab-offline.sha256").write_text(
            f"{offline_before}  fleetlab-offline.html\n"
        )
        (site / "downloads/verify-offline.txt").write_text(
            "FleetLab offline edition — download verification\n\n"
            f"SHA-256: {offline_before}\n"
            "macOS/Linux: shasum -a 256 fleetlab-offline.html\n"
            "Windows PowerShell: Get-FileHash .\\fleetlab-offline.html -Algorithm SHA256\n\n"
            "Compare the full digest before opening. This detects corruption "
            "against this website's "
            "published copy, not independent authenticity. The offline file "
            "excludes City Explorer.\n"
        )
        with (site / "_headers").open("a") as headers:
            # Pages redirects named .html files to an extensionless canonical URL.
            # Apply the attachment contract to both the redirect and its destination.
            headers.write(
                "\n/downloads/fleetlab-offline.html\n"
                '  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'
                "\n/downloads/fleetlab-offline\n"
                '  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'
            )
        launch.safe_copy(offer, site / "city-explorer/sources", offer_files)
        launch.write_json(
            site / "publication.json",
            {
                "schema": "fleetlab.publication-selection/1.0.0",
                "source_commit": source_commit,
                "current": report["current"],
                "rollback": report["rollback"],
                "offline_sha256": offline_before,
                "scope": "EDUCATIONAL_WEBSITE",
                "authenticity": "NOT_AUTHENTICATED",
                "sf_qualification": "HOLD",
                "operational_deployment_permission": "NONE",
                "meaning": (
                    "Packaging selection, not proof of successful hosting. "
                    "release.json records build-time state. Verify served bytes with "
                    "the release readback tool."
                ),
            },
        )
        final = launch.inventory(site)
        if client_update:
            for name in copied:
                if final.get(name) != updates[name]:
                    raise ValueError("copied client integrity mismatch")
            if launch.inventory(Path(client_update)) != updates:
                raise ValueError("client distribution changed during integration")
        changed = check_preservation(established, final, bool(client_update), flow_update)
        if set(changed) != EXCEPTIONS | (CLIENT_FIXES if client_update else frozenset()) | (
            FLOW_CHANGED if flow_update else frozenset()
        ):
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
            "offline_download": {"path": offline_path, "url": offline_url, **final[offline_path]},
            "source_offer_manifest_sha256": launch.sha_file(offer / "manifest.json"),
            "files": final,
            "file_count": len(final),
            "total_bytes": sum(r["bytes"] for r in final.values()),
            "publication": "NOT_PERFORMED",
            "teaching_update": "depot-capacity-nf03-2026-10-09" if flow_update else None,
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
    parser.add_argument(
        "--client-update",
        type=Path,
        help="Reviewed rebuilt teaching site; only the three declared security modules are copied",
    )
    parser.add_argument(
        "--source-commit", help="Exact reviewed source commit for public build identification"
    )
    parser.add_argument(
        "--flow-update", action="store_true",
        help="Apply the explicit NF-01 teaching module and NF-03 capacity entry allowlists",
    )
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
