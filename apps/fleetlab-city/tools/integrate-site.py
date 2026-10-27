#!/usr/bin/env python3
"""Create an additive hosted release; never publish or modify input distributions."""

import argparse
import hashlib
import importlib.util
import json
import re
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
_brand_spec = importlib.util.spec_from_file_location(
    "hosted_brand", Path(__file__).with_name("hosted-brand.py")
)
brand = importlib.util.module_from_spec(_brand_spec)
_brand_spec.loader.exec_module(brand)
EXCEPTIONS = frozenset(("index.html", "boot.js", "_headers"))
CLIENT_FIXES = frozenset((
    "src/ui/setup-codec.js", "src/ui/setup-sharing.js", "src/ui/studio.js",
    "src/model/bay-experiment-contract.js",  # FL-SEC-13: 49420b866ff5cab7c21408dd37eef83c981fe914
    "src/model/metrics.js",  # FL-SEC-13: 49420b866ff5cab7c21408dd37eef83c981fe914
    "src/ui/display-text.js",  # FL-SEC-13: 49420b866ff5cab7c21408dd37eef83c981fe914
    "src/ui/depot-scene.js",  # FL-SEC-27: cd40179f397625de23cfa7568bed017996c5c1cd
))
FLOW_CHANGED = frozenset((
    "src/ui/dom.js", "src/ui/iso.js", "src/ui/map.js", "src/ui/present.js",
    "styles.css", "src/ui/routes.js", "src/ui/teaching-frames.js", "src/ui/charts.js",
    "src/ui/simulation-catalog.js", "src/ui/operations-lab.js", "src/ui/street-lab.js",
    "src/ui/hero-film.js", "src/ui/labels.js", "src/ui/advanced-operations-view.js",
    "src/ui/experiment.js", "src/ui/app.js", "src/ui/operations-3d.js",
    "src/ui/operations-map.js", "src/ui/regional-power-view.js",
    "src/ui/analytics.js", "src/ui/car-glyph.js", "src/ui/launch-view.js",
    "src/ui/street-scene.js",
))
FLOW_ADDED = frozenset((
    "src/model/depot-flow-contract.js", "src/model/depot-flow.js",
    "src/model/depot-flow-verify.js", "src/ui/depot-flow-lab.js",
    "src/model/depot-cohort-contract.js", "src/model/depot-cohort.js",
    "src/model/depot-cohort-verify.js", "src/ui/depot-flow-view.js",
    "src/ui/depot-flow-reading.js", "src/ui/depot-flow-player.js",
    "src/ui/methodology-explainer.js",
    "src/ui/concept-primer.js", "src/ui/network-chrome.js", "src/ui/decimal-input.js",
))
CAPACITY_ADDED = frozenset((
    "network-flows/capacity/index.html", "network-flows/capacity/boot.js",
    "network-flows/capacity/visual.css", "network-flows/capacity/release.json",
    "src/ui/depot-capacity-bench.js", "src/ui/depot-capacity-guided.js",
    "src/ui/capacity-app.js", "src/ui/depot-capacity-page.js", "src/ui/depot-capacity-view.js",
    "src/model/depot-capacity-contract.js", "src/model/depot-capacity.js",
    "src/model/depot-capacity-verify.js", "src/data/depot-capacity-study.js",
))
DELIVERY_ADDED = frozenset((
    "network-flows/software-delivery/index.html", "network-flows/software-delivery/boot.js",
    "network-flows/software-delivery/visual.css", "network-flows/software-delivery/release.json",
    "src/model/software-delivery-contract.js", "src/model/software-delivery.js",
    "src/model/software-delivery-verify.js", "src/data/software-delivery-study.js",
    "src/ui/software-delivery-app.js", "src/ui/software-delivery-page.js",
    "src/ui/software-delivery-player.js", "src/ui/software-delivery-view.js",
    "src/runtime/software-delivery-worker.js", "src/runtime/software-delivery-job.js",
))
ORDER_ADDED = frozenset((
    'network-flows/delivery-order/index.html',
    'network-flows/delivery-order/boot.js',
    'network-flows/delivery-order/visual.css',
    'network-flows/delivery-order/release.json',
    'src/model/delivery-order.js',
    'src/model/delivery-order-contract.js',
    'src/model/delivery-order-verify.js',
    'src/model/delivery-order-study-verify.js',
    'src/model/delivery-order-search.js',
    'src/data/delivery-order-study.js',
    'src/ui/delivery-order-app.js',
    'src/ui/delivery-order-page.js',
    'src/ui/delivery-order-view.js',
    'src/ui/delivery-order-player.js',
    'src/runtime/delivery-order-job.js',
    'src/runtime/delivery-order-worker.js',
))
R1_ADDED = frozenset((
    'network-flows/rebalancing/index.html',
    'network-flows/rebalancing/boot.js',
    'network-flows/rebalancing/visual.css',
    'network-flows/rebalancing/release.json',
    'src/model/rebalancing-contract.js',
    'src/model/rebalancing.js',
    'src/model/rebalancing-verify.js',
    'src/model/rebalancing-study.js',
    'src/runtime/rebalancing-job.js',
    'src/runtime/rebalancing-worker.js',
    'src/runtime/rebalancing-session.js',
    'src/ui/rebalancing-app.js',
    'src/ui/rebalancing-view.js',
    'src/ui/rebalancing-concept.js',
))
R3_ADDED = frozenset((
    'network-flows/dispatch/index.html',
    'network-flows/dispatch/boot.js',
    'network-flows/dispatch/visual.css',
    'network-flows/dispatch/release.json',
    'src/model/dispatch-contract.js',
    'src/model/dispatch.js',
    'src/model/dispatch-verify.js',
    'src/runtime/dispatch-job.js',
    'src/runtime/dispatch-worker.js',
    'src/runtime/dispatch-session.js',
    'src/ui/dispatch-app.js',
))
DEPOT_ADDED = frozenset((
    "depot-readiness/index.html", "depot-readiness/boot.js",
    "depot-readiness/visual.css", "depot-readiness/release.json",
    *(f"src/model/depot-lab/{name}.js" for name in (
        "allocation", "canonical", "compare", "engine", "identity", "ledger", "policy", "presets",
        "profiles", "rational", "registry", "schema", "state", "task-graph", "units",
    )),
    *(f"src/model/depot-lab-verify/{name}.js" for name in (
        "allocation-check", "blockage", "metrics", "policy-check", "reconstruct", "verify",
    )),
    "src/runtime/depot-lab-job.js", "src/runtime/depot-lab-session.js",
    "src/runtime/depot-lab-worker.js",
    *(f"src/ui/depot-lab-{name}.js" for name in (
        "app", "controls", "evidence", "format", "inspector", "share", "view",
    )),
))
# Emitted from playground/fleetlab/depot-lab/ (engineering note BD-16); page and boot are generated.
DEPOT_SOURCE = {"depot-readiness/visual.css": "depot-lab/visual.css"}
DEPOT_PAGE = "depot-readiness/index.html"
INTEGRATION_TEXT = frozenset((
    "index.html", "boot.js", "_headers", "integration.mjs", "integration.css",
    "404.html", "network-flows/fleet-day/index.html", "not-found.css", "publication.json",
    "downloads/fleetlab-offline.sha256",
    "downloads/verify-offline.txt",
    "network-flows/index.html", "network-flows/hub.css",
    "network-flows/ota-sharing/index.html", "sitemap.xml",
))
STATIC_INTEGRATION_FILES = {
    "network-flows/index.html": "network-hub.html",
    "network-flows/hub.css": "network-hub.css",
    "network-flows/ota-sharing/index.html": "ota-sharing-redirect.html",
    "sitemap.xml": "sitemap.xml",
}


def software_delivery_files(files):
    """No partial route or unowned software-delivery asset can enable discovery."""
    paths = frozenset(name for name in files if (
        name.startswith("network-flows/software-delivery/")
        or re.fullmatch(r"src/(?:model|ui|runtime|data)/software-delivery(?:-[a-z]+)?\.js", name)
    ))
    if paths and paths != DELIVERY_ADDED:
        raise ValueError("software delivery inventory is incomplete or unexpected")
    return paths


def delivery_order_files(files):
    paths = frozenset(name for name in files if (
        name.startswith("network-flows/delivery-order/")
        or re.fullmatch(r"src/(?:model|ui|runtime|data)/delivery-order(?:-[a-z-]+)?\.js", name)
    ))
    if paths and paths != ORDER_ADDED:
        raise ValueError("delivery order inventory is incomplete or unexpected")
    return paths


def rebalancing_files(files):
    paths = frozenset(name for name in files if (
        name.startswith("network-flows/rebalancing/")
        or re.fullmatch(r"src/(?:model|ui|runtime|data)/rebalancing(?:-[a-z-]+)?\.js", name)
    ))
    if paths and paths != R1_ADDED:
        raise ValueError("R1 inventory is incomplete or unexpected")
    return paths


def dispatch_files(files):
    paths = frozenset(name for name in files if (
        name.startswith("network-flows/dispatch/")
        or re.fullmatch(r"src/(?:model|ui|runtime|data)/dispatch(?:-[a-z-]+)?\.js", name)
    ))
    if paths and paths != R3_ADDED:
        raise ValueError("R3 inventory is incomplete or unexpected")
    return paths


def depot_files(files):
    """The nested depot lab family only; older depot-readiness/depot-flow modules never match."""
    paths = frozenset(name for name in files if (
        name.startswith("depot-readiness/")
        or re.fullmatch(
            r"src/(?:model|ui|runtime|data)/depot-lab(?:-[a-z0-9-]+)?(?:/[a-z0-9-]+)?\.js", name
        )
    ))
    if paths and paths != DEPOT_ADDED:
        raise ValueError("depot lab inventory is incomplete or unexpected")
    return paths


QUIET_RENDER = (
    "import {readFileSync} from 'node:fs';"
    "const {renderPage}=await import(process.argv[1]);"
    "process.stdout.write(renderPage(readFileSync(0,'utf8'),{tagFree:true}));"
)


def render_without_analytics(value):
    """The shared hosted transform without the site-wide analytics tag (owner: no telemetry)."""
    return subprocess.run(
        ["node", "--input-type=module", "-e", QUIET_RENDER,
         (ASSETS / "site-transform.mjs").as_uri()],
        input=value, capture_output=True, text=True, check=True,
    ).stdout


def software_delivery_marker(html, accepted):
    if not accepted:
        return html
    if 'name="fleetlab-software-delivery"' in html or html.count("</head>") != 1:
        raise ValueError("software delivery marker or root shell differs")
    return html.replace(
        "</head>", '<meta name="fleetlab-software-delivery" '
        'content="/network-flows/software-delivery/release.json"></head>'
    )


CLOSURE_LIMITS = {"nf03": 557056, "depot": 786432}


def final_route_counts(routes, files, owners=None):
    """Recount verified route inventories after the hosted header transform."""
    counts = {}
    for route in routes:
        if route["id"] not in {"nf03", "nf04", "delivery_order", "r1", "r3", "depot"}:
            continue
        paths = set(route["paths"]) | {name for name in brand.TEXT if name in files}
        size = sum(files[name]["bytes"] for name in paths)
        if size > CLOSURE_LIMITS.get(route["id"], 524288):
            raise ValueError(f'{route["id"]} final closure byte budget exceeded')
        counts[f'{route["id"]}_closure_bytes'] = size
        if route["id"] == "depot":
            if owners is None:
                raise ValueError("depot final count requires the receipt owners")
            local = sum(files[name]["bytes"] for name in paths if owners.get(name) == "depot-lab")
            if local > 524288:
                raise ValueError("depot final route-local byte budget exceeded")
            counts["depot_route_local_bytes"] = local
    return counts


CAPACITY_BOOT = 'import { startCapacity } from "../../src/ui/capacity-app.js";\nstartCapacity();\n'
PROVENANCE_TOOL = (
    Path(__file__).resolve().parents[3] / "playground/fleetlab/tools/release-sidecar.mjs"
)
PACKAGE_TOOL = PROVENANCE_TOOL.with_name("package-proof.mjs")


def check_teaching_package(package, client, offline, source_commit):
    """Reproduce the two owned files against the frozen teaching source before copying."""
    files = launch.inventory(Path(package))
    archives = [name for name in files if re.fullmatch(
        r"network-flows/sources/[a-f0-9]{64}\.json\.gz", name
    )]
    if len(archives) != 1 or set(files) != {"downloads/teaching-package.json", *archives}:
        raise ValueError("teaching package has missing or unexpected files")
    if files[archives[0]]["bytes"] > 4 * 1024**2 or files[
        "downloads/teaching-package.json"
    ]["bytes"] > 57344:
        raise ValueError("teaching package file budget exceeded")
    command = [
        "node", str(PACKAGE_TOOL), "--check", str(package), "--site", str(client),
        "--playground", str(launch.ROOT / "playground/fleetlab"),
        "--offline", str(offline), "--source-commit", source_commit,
    ]
    checked = subprocess.run(command, capture_output=True, text=True, check=False)
    if checked.returncode:
        raise ValueError(f"teaching package rejected: {checked.stderr.strip()}")
    if launch.inventory(Path(package)) != files:
        raise ValueError("teaching package changed during verification")
    return files


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


def source_headers(source):
    if not re.fullmatch(r"network-flows/sources/[a-f0-9]{64}\.json\.gz", source):
        raise ValueError("invalid teaching source path")
    return (
        f"\n/{source}\n"
        "  Content-Type: application/gzip\n"
        '  Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"\n'
        "  ! Cache-Control\n"
        "  Cache-Control: public, max-age=31536000, immutable\n"
    )


def check_city_inputs(original_base, original_offer):
    """Only source-owned historical pins can approve the unmodified input manifests."""
    path = launch.ROOT / "apps/fleetlab-city/deploy/approved-inputs.json"
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 4096:
        raise ValueError("City input pins must be a regular bounded file")
    pins = json.loads(path.read_bytes())
    if (not isinstance(pins, dict)
            or set(pins) != {"schema", "base_release", "source_offer_manifest"}
            or pins["schema"] != "fleetlab.approved-city-inputs/1.0.0"):
        raise ValueError("invalid City input pin schema")
    for key, data in (("base_release", original_base), ("source_offer_manifest", original_offer)):
        record = pins[key]
        if (not isinstance(record, dict) or set(record) != {"sha256", "provenance"}
                or not re.fullmatch(r"[a-f0-9]{64}", str(record["sha256"]))
                or not re.fullmatch(r"docs/[A-Za-z0-9_./-]+\.md", str(record["provenance"]))
                or any(part in {".", ".."} for part in record["provenance"].split("/"))):
            raise ValueError("invalid City input pin record")
        if hashlib.sha256(data).hexdigest() != record["sha256"]:
            raise ValueError(f"approved City {key} input differs")


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
    teaching_package=None,
    brand_update=False,
    city_base_manifest=None,
):
    legacy, viewer, previous, offer, out, offline = map(
        Path, (legacy, viewer, previous, offer, out, offline)
    )
    if out.exists():
        raise ValueError("output already exists")
    if brand_update and not (teaching_package and source_commit):
        raise ValueError("hosted brand requires source-bound teaching package")
    original_base = original_offer = original_offer_index = None
    if brand_update:
        if city_base_manifest is None:
            raise ValueError("hosted brand requires the original City base manifest")
        if Path(city_base_manifest).is_symlink() or not Path(city_base_manifest).is_file():
            raise ValueError("original City base manifest must be regular")
        if Path(city_base_manifest).stat().st_size > 4 * 1024**2:
            raise ValueError("original City base manifest exceeds evidence byte limit")
        original_base = Path(city_base_manifest).read_bytes()
        if ((offer / "manifest.json").is_symlink() or not (offer / "manifest.json").is_file()
                or (offer / "manifest.json").stat().st_size > 4 * 1024**2):
            raise ValueError("original City source manifest must be regular and bounded")
        original_offer = (offer / "manifest.json").read_bytes()
        check_city_inputs(original_base, original_offer)
        base_release, base_files = brand.verify_projected_base(previous, original_base)
        current_release, _ = launch.verify_viewer(viewer, "hosted current")
        if (current_release.get("hosting_projection") != base_release["hosting_projection"]
                or current_release.get("hosted_presentation", {}).get("base_release_sha256")
                != base_files["release.json"]["sha256"]):
            raise ValueError("hosted current must derive from the projected rollback")
    elif city_base_manifest is not None:
        raise ValueError("original City base manifest requires a hosted brand update")
    if teaching_package and not (flow_update and client_update and source_commit):
        raise ValueError("teaching package requires a frozen flow client and source commit")
    if flow_update and not client_update:
        raise ValueError("flow update requires a reviewed client distribution")
    if source_commit and not client_update:
        raise ValueError("a source-identified release requires the reviewed security client update")
    offer_files = launch.inventory(offer)
    offer_manifest = json.loads((offer / "manifest.json").read_text())
    if original_offer is not None:
        original_offer_index = (offer / "index.html").read_bytes()
        for name, data in (("manifest.json", original_offer), ("index.html", original_offer_index)):
            if offer_files.get(name) != {
                "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()
            }:
                raise ValueError("City source input changed during capture")
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
    delivery_files = frozenset()
    order_files = frozenset()
    r1_files = frozenset()
    r3_files = frozenset()
    lab_files = frozenset()
    if client_update:
        updates = launch.inventory(Path(client_update))
        delivery_files = software_delivery_files(updates)
        order_files = delivery_order_files(updates)
        r1_files = rebalancing_files(updates)
        r3_files = dispatch_files(updates)
        lab_files = depot_files(updates)
        if lab_files and not (flow_update and teaching_package and source_commit):
            raise ValueError("depot lab requires a source-bound teaching package")
        if r3_files and not (r1_files and teaching_package and source_commit):
            raise ValueError("R3 requires a source-bound package and rebalancing")
        if r1_files and not (delivery_files and teaching_package and source_commit):
            raise ValueError("R1 requires a source-bound teaching package and software delivery")
        if order_files and not delivery_files:
            raise ValueError("delivery order requires software delivery")
        if delivery_files and not (flow_update and teaching_package and source_commit):
            raise ValueError("software delivery requires a source-bound teaching package")
        copied |= delivery_files | order_files | r1_files | r3_files | lab_files
        if flow_update and set(updates) != (
            set(established) | FLOW_ADDED | CAPACITY_ADDED
            | delivery_files | order_files | r1_files | r3_files | lab_files
        ):
            raise ValueError("flow client inventory has missing or unexpected modules")
        for name in copied:
            if name not in updates or (
                name not in established
                and name not in (
                    FLOW_ADDED | CAPACITY_ADDED | delivery_files | order_files | r1_files | r3_files
                    | lab_files
                )
            ):
                raise ValueError("client update missing expected module")
            if name.startswith(("network-flows/capacity/", "network-flows/software-delivery/",
                                "network-flows/delivery-order/", "network-flows/rebalancing/",
                                "network-flows/dispatch/")):
                continue  # generated by the packer, so there is no source file; pinned below
            if name.startswith("depot-readiness/") and name not in DEPOT_SOURCE:
                continue  # packer output; bound by its sidecar and the package proof
            reviewed = launch.ROOT / "playground/fleetlab" / DEPOT_SOURCE.get(name, name)
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
    package_files = check_teaching_package(
        teaching_package, client_update, offline, source_commit
    ) if teaching_package else None
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
        if original_base is not None:
            (review / "inputs").mkdir()
            (review / "inputs/city-base-release.json").write_bytes(original_base)
            (review / "inputs/city-source-offer-manifest.json").write_bytes(original_offer)
            (review / "inputs/city-source-offer-index.html").write_bytes(original_offer_index)
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
        if package_files:
            hosted_index = hosted_index.replace(
                "</head>", '<meta name="fleetlab-teaching-package" '
                'content="/downloads/teaching-package.json"></head>'
            )
        hosted_index = software_delivery_marker(
            hosted_index, bool(delivery_files and package_files)
        )
        if r1_files:
            hosted_index = hosted_index.replace(
                "</head>", '<meta name="fleetlab-rebalancing" '
                'content="/network-flows/rebalancing/release.json"></head>'
            )
        if r3_files:
            hosted_index = hosted_index.replace(
                "</head>", '<meta name="fleetlab-dispatch" '
                'content="/network-flows/dispatch/release.json"></head>'
            )
        if order_files:
            hosted_index = hosted_index.replace(
                "</head>", '<meta name="fleetlab-delivery-order" '
                'content="/network-flows/delivery-order/release.json"></head>'
            )
        (site / "index.html").write_text(hosted_index)
        if client_update:
            for name in copied:
                (site / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(Path(client_update) / name, site / name)
        onward = lesson_navigation({
            name: (site / name).read_text()
            for name in ("network-flows/capacity/index.html",
                         "network-flows/software-delivery/release.json",
                         "network-flows/software-delivery/index.html",
                         "network-flows/delivery-order/release.json",
                         "network-flows/delivery-order/index.html",
                         "network-flows/rebalancing/release.json",
                         "network-flows/rebalancing/index.html",
                         "network-flows/dispatch/release.json",
                         "network-flows/dispatch/index.html")
            if (site / name).is_file()
        })
        for name, content in onward.items():
            (site / name).write_text(content)
        shutil.copyfile(review / "_headers.candidate", site / "_headers")
        for name in ("integration.mjs", "integration.css"):
            shutil.copyfile(ASSETS / name, site / name)
        for name in ("404.html", "not-found.css"):
            shutil.copyfile(ASSETS / name, site / name)
        (site / "network-flows/fleet-day").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(
            ASSETS / "fleet-day-redirect.html", site / "network-flows/fleet-day/index.html"
        )
        for target, source in STATIC_INTEGRATION_FILES.items():
            (site / target).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ASSETS / source, site / target)
        (site / "city-explorer/releases").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(
            ASSETS / "city-releases-redirect.html", site / "city-explorer/releases/index.html"
        )
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
            # Path rules may relax or annotate the /* baseline, never restrict it: a percent-encoded
            # spelling of the path matches only /* (tools/check-headers.py).
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
                **({"hosted_presentation": "fleetlab.hosted-presentation/1.0.0"}
                   if brand_update else {}),
                "current": report["current"],
                "rollback": report["rollback"],
                "offline_sha256": offline_before,
                "scope": "EDUCATIONAL_WEBSITE",
                "authenticity": "NOT_AUTHENTICATED",
                "sf_qualification": "HOLD",
                "operational_deployment_permission": "NONE",
                **({"teaching_package": {
                    "path": "downloads/teaching-package.json",
                    **package_files["downloads/teaching-package.json"],
                }} if package_files else {}),
                "meaning": (
                    "Packaging selection, not proof of successful hosting. "
                    "release.json records build-time state. Verify served bytes with "
                    "the release readback tool."
                ),
            },
        )
        if package_files:
            if any((site / name).exists() for name in package_files):
                raise ValueError("teaching package collides with an existing owned path")
            for name in package_files:
                (site / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(Path(teaching_package) / name, site / name)
            with (site / "_headers").open("a") as headers:
                headers.write(
                    source_headers(next(name for name in package_files
                                        if name.startswith("network-flows/sources/"))) +
                    '\n/downloads/teaching-package.json\n'
                    '  Content-Type: application/json\n'
                )
        branded = (brand.apply_site(site, report["current"]["path"], report["rollback"]["path"])
                   if brand_update else {})
        if brand_update and lab_files:
            # The depot page is served without the site-wide analytics tag (engineering note BD-17).
            branded[DEPOT_PAGE] = render_without_analytics(
                (Path(client_update) / DEPOT_PAGE).read_text()
            )
            (site / DEPOT_PAGE).write_text(branded[DEPOT_PAGE])
        # Compact indentation preserves header semantics within the route byte budgets.
        headers = site / "_headers"
        headers.write_text(re.sub(r"^  ", "\t", headers.read_text(), flags=re.M))
        final = launch.inventory(site)
        if package_files and (
            launch.inventory(Path(teaching_package)) != package_files
            or any(final.get(name) != record for name, record in package_files.items())
        ):
            raise ValueError("teaching package changed during integration")
        if client_update:
            for name in copied:
                expected = updates[name]
                if name in branded or name in onward:
                    content = (branded.get(name) or onward[name]).encode()
                    expected = {
                        "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()
                    }
                if final.get(name) != expected:
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
        non_city_bytes = sum(
            record["bytes"] for name, record in final.items()
            if not name.startswith("city-explorer/")
        )
        if package_files and non_city_bytes > 17825792:
            raise ValueError("complete teaching and integration byte budget exceeded")
        integrated_text = {}
        if package_files:
            expected_non_city = set(updates) | set(package_files) | INTEGRATION_TEXT | {
                "downloads/fleetlab-offline.html",
            }
            if brand_update:
                expected_non_city |= set(brand.TEXT) | set(brand.MEDIA)
            non_city_paths = {name for name in final if not name.startswith("city-explorer/")}
            if non_city_paths != expected_non_city:
                raise ValueError("final teaching integration inventory differs")
            text_names = expected_non_city - {
                "downloads/fleetlab-offline.html", "media/fleet-film.mp4",
                "media/fleet-film-poster.webp",
            } - {name for name in package_files if name.endswith(".json.gz")}
            if brand_update:
                text_names -= set(brand.MEDIA)
            text_names.add("city-explorer/releases/index.html")
            integration_names = (
                INTEGRATION_TEXT | (set(brand.TEXT) if brand_update else set())
                | {"city-explorer/releases/index.html"}
            )
            integrated_text = {
                "emitted_text_bytes": sum(final[name]["bytes"] for name in text_names),
                "integration_text_bytes": sum(final[name]["bytes"] for name in integration_names),
                "hosted_artwork_bytes": (sum(final[name]["bytes"] for name in brand.MEDIA)
                                         if brand_update else 0),
            }
            if integrated_text["emitted_text_bytes"] > 3801088:
                raise ValueError("final emitted text budget exceeded")
            receipt = json.loads((site / "downloads/teaching-package.json").read_text())
            integrated_text.update(final_route_counts(
                receipt["routes"], final,
                {name: record["owner"] for name, record in receipt["emitted_files"].items()},
            ))
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
            "source_offer_manifest_sha256": launch.sha_file(
                site / "city-explorer/sources/manifest.json"
            ),
            "files": final,
            "file_count": len(final),
            "total_bytes": sum(r["bytes"] for r in final.values()),
            "publication": "NOT_PERFORMED",
            "teaching_update": "depot-capacity-nf03-2026-10-09" if flow_update else None,
            "scientific_eligibility": "BLOCKED_MAP_QUALIFICATION",
            "teaching_package": package_files,
            "non_city_bytes": non_city_bytes,
            "software_delivery": bool(delivery_files),
            "integrated_text": integrated_text,
        }
        launch.write_json(review / "integration-manifest.json", result)
        # Historical prepare-stage reports describe the intermediate immutable copy.
        # This final manifest alone describes the intentionally modified hosted tree.
        stage.rename(out)
        return {key: value for key, value in result.items() if key != "files"}


def lesson_sequence():
    """The one lesson sequence, 01 to 05, read as JSON from the JavaScript generator line."""
    source = launch.ROOT / "playground/fleetlab/tools/software-delivery-package.mjs"
    found = re.findall(r"^export const LESSON_SEQUENCE=(\[.*\]);$", source.read_text(), re.M)
    if len(found) != 1:
        raise ValueError("lesson sequence missing or ambiguous")
    return json.loads(found[0])


def lesson_navigation(files):
    """Exact hosted Next links from the one sequence, never a skipped-byte exception."""
    sequence, result = lesson_sequence(), {}
    for i in range(4):
        route, (nxt, label) = sequence[i][0], sequence[i + 1]
        if f"network-flows/{nxt}/release.json" not in files or (
            i and f"network-flows/{route}/release.json" not in files
        ):
            continue
        path, end = f"network-flows/{route}/index.html", "</body>" if i < 3 else "</main>"
        source = files.get(path)
        if not isinstance(source, str) or source.count(end) != 1:
            raise ValueError(f"{route} navigation source missing or ambiguous")
        link = f'<a href="/network-flows/{nxt}/">{label}'
        nav = (f'<nav class="{("fl-app", "delivery-shell", "order-shell")[i]}" '
               f'aria-label="Next Network Flows lesson"><p>Next lesson: {link}</a></p></nav>\n'
               if i < 3 else
               '<nav class="lesson-next" aria-label="Next Network Flows lesson"><span>CONTINUE THE '
               f'QUESTION</span>{link} ↗</a><p>Inspect the next request and the car that can reach '
               'it.</p></nav>')
        result[path] = source.replace(end, nav + end)
    return result



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("legacy", "viewer", "previous", "offer", "out", "offline"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--readback", type=Path)
    parser.add_argument("--brand-update", action="store_true",
                        help="Apply approved hosted artwork and Google tag")
    parser.add_argument("--city-base-manifest", type=Path,
                        help="Original City release.json retained as hosting-projection evidence")
    parser.add_argument("--teaching-package", type=Path,
                        help="Verified NF04-A source package and byte-accounting receipt")
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
