"""Separate, same-origin review package; loopback serving and compatible-bundle validation."""

import contextlib
import gzip
import json
import mimetypes
import os
import posixpath
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .candidate_binding import validate_candidate
from .compare import compare_pairs
from .contracts import canonical, digest, load_json, read_bundle, read_bytes, save_json, sha
from .model_lessons_v1 import build_model_lessons, verify_model_lessons
from .power_package import energy_metadata, export_power_study
from .presentation import feature_vehicles, vehicle_views
from .readiness_package_v1 import export_readiness
from .runner import scientific_spec
from .verify import verify

CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src "
    "'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; "
    "font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors "
    "'none'; form-action 'none'"
)
HEADERS = {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
}


def file_inventory(root, exclude=()):
    return {
        p.relative_to(root).as_posix(): {"bytes": p.stat().st_size, "sha256": sha(read_bytes(p))}
        for p in sorted(Path(root).rglob("*"))
        if p.is_file() and p.name not in exclude
    }


def require_matching_report(stored, recomputed, label):
    if digest(stored) != digest(recomputed):
        raise ValueError(f"{label} differs from captured runs and fresh verification")


def build_viewer(
    root, out, run_path=None, power_study=None, power_status=None, temporal_candidate=False
):
    root = Path(root)
    app = root / "apps/fleetlab-city"
    out = Path(out)
    if power_study is not None and power_status is not None:
        raise ValueError("select a complete study or a partial status, not both")
    if out.exists():
        raise FileExistsError(f"{out} exists; select a new output to preserve the earlier package")
    out.mkdir(parents=True)
    (out / "data").mkdir()
    (out / "vendor").mkdir()
    runs = Path(run_path or root / "build/fleetlab-city/runs/sf-depots-v1")
    protocol = load_json(runs / "frozen-protocol.json")
    spec = protocol["spec"]
    pack = read_bundle(root / spec["pack_path"])
    graph = pack["graph.json"]
    coverage = pack["coverage.json"]
    if protocol["pack_manifest_digest"] != pack["manifest.json"]["content_digest"]:
        raise ValueError("frozen protocol names a different city pack")

    def check_protocol(captured, case_name, arm, changes=None):
        require_matching_report(
            digest(captured["inputs.json"]),
            protocol["case_input_digests"][case_name],
            "frozen input identity",
        )
        expected = {**scientific_spec(spec), **(changes or {})}
        if arm == "candidate":
            expected["sites"] = spec["candidate_sites"]
        require_matching_report(captured["run.json"]["spec"], expected, "frozen specification")

    comparison = load_json(runs / "comparison.json")
    for name in (
        "index.html",
        "style.css",
        "app.mjs",
        "view-model.mjs",
        "city-map.mjs",
        "replay.mjs",
        "fleet-insights.mjs",
        "vehicle-concepts.mjs",
        "vehicle-concepts.css",
        "qualification.mjs",
        "power-study.mjs",
        "model-lessons.mjs",
        "model-lessons.css",
        "study-status.mjs",
        "qualification-progress.mjs",
        "temporal-candidate.mjs",
    ):
        shutil.copyfile(app / "web" / name, out / name)
    shutil.copytree(app / "web/assets", out / "assets")
    lessons = build_model_lessons()
    verify_model_lessons(lessons)
    save_json(out / "data/model-lessons.json", lessons)
    candidate = read_bundle(root / "build/fleetlab-city/packs/sf-v2")
    validate_candidate(pack, candidate)
    export_readiness(root, candidate, out)
    candidate_report = candidate["qualification-report.json"]
    if candidate_report["baseline_pack_digest"] != pack["manifest.json"]["content_digest"]:
        raise ValueError("map candidate compares a different baseline pack")
    for source, name in (
        ("qualification-report.json", "qualification"),
        ("district-gaps.json", "district-gaps"),
        ("human-review-checklist.json", "human-review"),
    ):
        save_json(out / f"data/candidate-{name}.json", candidate[source])
    save_json(out / "data/candidate-roads.geo.json", candidate["roads.geo.json"])
    save_json(
        out / "data/candidate-district-research.json",
        load_json(root / "build/fleetlab-city/research/districts/assessment.json"),
    )
    vendor = app / "node_modules/maplibre-gl"
    for name in (
        "maplibre-gl.mjs",
        "maplibre-gl-shared.mjs",
        "maplibre-gl-worker.mjs",
        "maplibre-gl.css",
    ):
        shutil.copyfile(vendor / "dist" / name, out / "vendor" / name)
    shutil.copyfile(vendor / "LICENSE.txt", out / "vendor" / "LICENSE.txt")
    roads = pack["roads.geo.json"]
    save_json(out / "data/source-roads.geo.json", roads)
    save_json(
        out / "data/routing-roads.geo.json",
        {
            "type": "FeatureCollection",
            "features": [f for f in roads["features"] if f["properties"]["status"] != "excluded"],
        },
    )
    save_json(out / "data/geometry.json", pack["geometry.json"])
    save_json(out / "data/comparison.json", comparison)
    save_json(out / "data/scenario.json", spec)
    pair_bytes = {}
    vehicles = []
    pairs = []
    sensitivities = []
    for seed in spec["evaluation_seeds"]:
        pair_compressed = 0
        pair = {"seed": seed}
        for arm in ("baseline", "candidate"):
            captured = read_bundle(runs / f"seed-{seed}-{arm}")
            check_protocol(captured, f"seed-{seed}", arm)
            run = captured["run.json"]
            v = verify(run, captured["inputs.json"], graph)
            require_matching_report(captured["verification.json"], v, "verification")
            pair[arm] = {
                k: run[k] for k in ("input_digest", "pack_digest", "model", "spec", "execution")
            }
            pair[arm + "_verification"] = v
            # Never elevate a stored invalid result. The producer/reviewer hashes remain visible.
            ids = [x["id"] for x in captured["inputs.json"]["initial"]]
            if not vehicles:
                vehicles = [{"id": vid} for vid in ids]
            fleet = []
            for view in vehicle_views(run, captured["inputs.json"], graph):
                vid = view["vehicle"]
                fleet.append({"vehicle": vid, **view["summary"]})
                payload = {
                    **view,
                    "schema": "fleetlab.city-vehicle-view/1.1.0",
                    "seed": seed,
                    "arm": arm,
                    "interval_s": spec["sample_s"],
                    "verification": v["verification"],
                    "execution": run["execution"],
                    "energy": energy_metadata(run["spec"]),
                    "layout": "A" if arm == "baseline" else "AB",
                    "total_power_kw": sum(s["power_kw"] for s in run["spec"]["sites"]),
                    "decision_authority": "NONE",
                    "source_run_digest": captured["manifest.json"]["metadata"][
                        "semantic_run_digest"
                    ],
                }
                b = canonical(payload) + b"\n"
                (out / f"data/run-{seed}-{arm}-{vid}.json").write_bytes(b)
                pair_compressed += len(gzip.compress(b, mtime=0))
            fleet_payload = {
                "seed": seed,
                "arm": arm,
                "vehicles": fleet,
                "featured": feature_vehicles(fleet),
            }
            save_json(out / f"data/fleet-{seed}-{arm}.json", fleet_payload)
            pair_compressed += len(gzip.compress(canonical(fleet_payload) + b"\n", mtime=0))
        pair_bytes[str(seed)] = pair_compressed
        pairs.append(pair)
    qualified = (
        coverage["routing_support_pass"] and coverage["semantic_map_review"]["status"] == "PASS"
    )
    fresh_comparison = compare_pairs(pairs, spec["evaluation_seeds"], qualified)
    require_matching_report(comparison, fresh_comparison, "comparison")
    for case in spec["sensitivities"]:
        entry = {"name": case["name"], "valid": True, "hard_violations": 0, "violation_codes": {}}
        for arm in ("baseline", "candidate"):
            captured = read_bundle(runs / f"{case['name']}-{arm}")
            check_protocol(captured, case["name"], arm, case["changes"])
            v = verify(captured["run.json"], captured["inputs.json"], graph)
            require_matching_report(captured["verification.json"], v, "sensitivity verification")
            entry[arm] = v["metrics"]
            for violation in v["violations"]:
                code = violation.get("code", "unspecified")
                entry["violation_codes"][code] = entry["violation_codes"].get(code, 0) + 1
            entry["valid"] = entry["valid"] and v["valid"]
            entry["hard_violations"] += v["metrics"]["hard_violations"]
        sensitivities.append(entry)
    pack_schema = graph["schema"]
    pack_digest = pack["manifest.json"]["content_digest"]
    candidate_digest = candidate["manifest.json"]["content_digest"]
    catalog = {
        "schema": "fleetlab.city-view/1.0.0",
        "scope": "SIMULATION_ONLY",
        "decision_authority": "NONE",
        "coverage": {k: v for k, v in coverage.items() if k != "source_checks"},
        "source": graph["source"],
        "pack_digest": pack["manifest.json"]["content_digest"],
        "vehicles": vehicles,
        "sensitivities": sensitivities,
        "seeds": spec["evaluation_seeds"],
        "sites": [
            {"id": s["id"], "coordinates": graph["nodes"][s["node"]], "provenance": "FICTIONAL"}
            for s in spec["candidate_sites"]
        ],
        "scenario_points": [graph["nodes"][n] for n in spec["node_pool"]],
        "files": file_inventory(out / "data"),
    }
    # Keep only the small presentation projection before fresh power verification.
    # The SF map bundles and last raw recordings otherwise double the working set.
    del pack, graph, roads, candidate, captured, run, payload, view
    if power_study is not None:
        power_metadata, power_bytes = export_power_study(root, power_study, out / "data")
        pair_bytes.update(power_bytes)
        catalog["studies"] = [power_metadata]
        catalog["files"] = file_inventory(out / "data")
    if power_status is not None:
        # Fresh read-only verification has a separate process lifetime from the
        # large legacy/candidate map projections. No simulation is run here.
        status = subprocess.run(
            [
                sys.executable,
                "-m",
                "citylib.power_status",
                str(root.absolute()),
                str(Path(power_status).absolute()),
            ],
            env={**os.environ, "PYTHONPATH": str(app.absolute())},
            capture_output=True,
            text=True,
            check=True,
            timeout=600,
        )
        save_json(out / "data/power-status.json", json.loads(status.stdout))
        catalog["power_status_file"] = "data/power-status.json"
        catalog["files"] = file_inventory(out / "data")
    if temporal_candidate:
        temporal = subprocess.run(
            [
                sys.executable,
                "-m",
                "citylib.temporal_export_v1",
                str(root.absolute()),
                str(out.absolute()),
            ],
            env={**os.environ, "PYTHONPATH": str(app.absolute())},
            capture_output=True,
            text=True,
            check=True,
            timeout=180,
        )
        catalog["temporal_candidate"] = json.loads(temporal.stdout)
        catalog["files"] = file_inventory(out / "data")
    catalog["files"] = {"data/" + k: v for k, v in catalog["files"].items()}
    save_json(out / "data/catalog.json", catalog)
    headers = "/city-explorer/*\n" + "".join(f"  {k}: {v}\n" for k, v in HEADERS.items())
    (out / "_headers").write_text(headers)
    (out / "ATTRIBUTION.txt").write_text(
        "OpenStreetMap contributors: https://www.openstreetmap.org/copyright "
        "(ODbL 1.0).\nDataSF Supervisor Districts (2022), f2zs-jevy: CC0 1.0 as "
        "recorded in source metadata.\nMapLibre GL JS 6.11.2: BSD-3-Clause; "
        "license in vendor/LICENSE.txt.\nVehicle vector artwork and interface: "
        "original project-authored illustrations, no operator marks.\nAll "
        "operational parameters and depots are synthetic. Road-only pack, no "
        "buildings/terrain.\n"
    )
    # Precompressed assets are local-server conveniences, not new data or arbitrary remote requests.
    for p in list(out.rglob("*")):
        if p.is_file() and p.suffix in {".json", ".mjs", ".css", ".html", ".txt", ".svg"}:
            Path(str(p) + ".gz").write_bytes(gzip.compress(p.read_bytes(), mtime=0))
    network = {
        "schema": "fleetlab.city-network/1.0.0",
        "origins": ["self"],
        "provider_calls": False,
        "analytics": False,
        "accounts": False,
        "storage": False,
        "hosting_disclosure": (
            "The app has no analytics. Cloudflare receives hosting requests "
            "and may receive browser network-error reports."
        ),
        "range": "Single byte ranges; original representation, no gzip for Range",
        "data_integrity": (
            "SHA-256/size checked against catalogue; internal consistency, not authenticity"
        ),
    }
    save_json(out / "network.json", network)
    save_json(
        out / "release.json",
        {
            "schema": "fleetlab.city-release/1.0.0",
            "scope": "REVIEW_ONLY",
            "compatibility": {
                "viewer": "1.1.0",
                "pack": pack_schema,
                "run": "fleetlab.city-run/1.0.0",
                "metrics": "fleetlab.city-metrics/1.0.0",
            },
            "pack_digest": pack_digest,
            "candidate_map_digest": candidate_digest,
            "temporal_candidate": catalog.get("temporal_candidate"),
            "files": file_inventory(out),
            "pair_compressed_bytes": pair_bytes,
            "rollback_unit": "viewer + compatible manifest + city pack + run/metric schema",
            "public_deployment": "NOT_PERFORMED",
            "publication_semantics": (
                "Build-time state only. REVIEW_ONLY describes educational "
                "evidence scope, not website visibility. See /publication.json "
                "for the hosting selection; it grants no operational authority."
            ),
        },
    )
    return check_dist(out)


def validate_release(root):
    root = Path(root).resolve()
    manifest = load_json(root / "release.json")
    failures = []
    if manifest.get("schema") != "fleetlab.city-release/1.0.0":
        raise ValueError("unsupported release schema")
    for name, record in manifest["files"].items():
        p = Path(name)
        if p.is_absolute() or ".." in p.parts:
            raise ValueError("unsafe release path")
        try:
            data = read_bytes(root / p)
            if sha(data) != record["sha256"] or len(data) != record["bytes"]:
                failures.append(name)
        except (ValueError, OSError):
            failures.append(name)
    return {"pass": not failures, "failures": failures, "files": len(manifest["files"])}


def viewer_dependencies(root, manifest):
    """Validate static ESM closure without evaluating any packaged JavaScript.

    Node is the existing City build/test runtime. Its native parser handles
    multiline exports and escaped specifiers; regex is not an ESM parser.
    """
    files = manifest["files"]
    failures = []

    def require(source, target):
        parsed = urlsplit(target)
        name = posixpath.normpath(posixpath.join(posixpath.dirname(source), unquote(parsed.path)))
        if (
            parsed.scheme
            or parsed.netloc
            or parsed.query
            or parsed.fragment
            or parsed.path.startswith("/")
            or name.startswith("../")
            or name == ".."
        ):
            failures.append(f"{source}: unsupported local dependency {target}")
        elif name not in files:
            failures.append(f"{source}: dependency absent from manifest: {name}")
        else:
            try:
                captured = read_bytes(root / name, 26 * 1024**2)
                if len(captured) != files[name]["bytes"] or sha(captured) != files[name]["sha256"]:
                    failures.append(f"{source}: dependency integrity mismatch: {name}")
            except (OSError, ValueError):
                failures.append(f"{source}: dependency unavailable: {name}")

    class PageDependencies(HTMLParser):
        def handle_starttag(self, tag, attrs):
            values = dict(attrs)
            if tag == "script" and values.get("src"):
                require("index.html", values["src"])
            if tag == "link" and "stylesheet" in values.get("rel", "").split():
                require("index.html", values.get("href", ""))

    try:
        PageDependencies().feed(read_bytes(root / "index.html").decode("utf-8"))
        modules = {}
        for name in files:
            if name.endswith(".mjs"):
                modules[name] = read_bytes(root / name, 26 * 1024**2).decode("utf-8")
        if len(modules) > 64 or sum(len(code) for code in modules.values()) > 16 * 1024**2:
            raise ValueError("module parsing resource bound exceeded")
        parser = """import vm from 'node:vm';
let input=''; for await(const chunk of process.stdin) input+=chunk;
const dependencies={};
for(const [name,source] of Object.entries(JSON.parse(input))){
  dependencies[name]=new vm.SourceTextModule(source,{identifier:name}).dependencySpecifiers;
}
process.stdout.write(JSON.stringify(dependencies));"""
        result = subprocess.run(
            [
                "node",
                "--no-warnings",
                "--max-old-space-size=128",
                "--experimental-vm-modules",
                "--input-type=module",
                "-e",
                parser,
            ],
            input=json.dumps(modules),
            text=True,
            capture_output=True,
            timeout=20,
            check=True,
        )
        for source, imports in json.loads(result.stdout).items():
            for target in imports:
                if not target.startswith("."):
                    failures.append(f"{source}: non-relative module dependency {target}")
                else:
                    require(source, target)
        # Versioned presentation modules bring these non-module resources with them.
        resources = {
            "vehicle-concepts.mjs": [
                "vehicle-concepts.css",
                "assets/vehicle-generic.svg",
                "assets/vehicle-ojai-concept.svg",
                "assets/vehicle-bidi-concept.svg",
            ],
            "qualification.mjs": [
                "data/candidate-qualification.json",
                "data/candidate-district-gaps.json",
                "data/candidate-district-research.json",
            ],
        }
        for source, targets in resources.items():
            if source in modules:
                for target in targets:
                    require(source, target)
        if load_json(root / "data/catalog.json").get("temporal_candidate"):
            for target in (
                "data/temporal-summary.json",
                "data/temporal-roads.geo.json",
                "data/temporal-review-envelope.json",
                "data/temporal-review-requirements.json",
                "data/temporal-human-review.json",
                "notes/sf-temporal-inspection-worksheet.csv",
            ):
                require("index.html", target)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        failures.append(f"viewer dependency validation unavailable: {type(error).__name__}")
    return {"pass": not failures, "failures": failures}


def check_dist(root):
    root = Path(root)
    integrity = validate_release(root)
    manifest = load_json(root / "release.json")
    dependencies = viewer_dependencies(root, manifest)
    initial = [
        "index.html",
        "style.css",
        "app.mjs",
        "view-model.mjs",
        "city-map.mjs",
        "replay.mjs",
        "fleet-insights.mjs",
        "vehicle-concepts.mjs",
        "vehicle-concepts.css",
        "qualification.mjs",
        "power-study.mjs",
        "model-lessons.mjs",
        "model-lessons.css",
        "data/model-lessons.json",
        "data/temporal-summary.json",
        "study-status.mjs",
        "qualification-progress.mjs",
        "temporal-candidate.mjs",
        "data/sf-review-envelope.json",
        "assets/vehicle-generic.svg",
        "assets/vehicle-ojai-concept.svg",
        "assets/vehicle-bidi-concept.svg",
        "data/candidate-qualification.json",
        "data/candidate-district-gaps.json",
        "data/candidate-district-research.json",
        "vendor/maplibre-gl.mjs",
        "vendor/maplibre-gl-shared.mjs",
        "vendor/maplibre-gl-worker.mjs",
        "vendor/maplibre-gl.css",
        "data/catalog.json",
        "data/routing-roads.geo.json",
        "data/geometry.json",
        "data/comparison.json",
    ]
    # Optional UI generations are absent from older compatible releases.
    optional = {
        "model-lessons.mjs",
        "model-lessons.css",
        "data/model-lessons.json",
        "data/temporal-summary.json",
        "study-status.mjs",
        "qualification-progress.mjs",
        "temporal-candidate.mjs",
        "data/sf-review-envelope.json",
        "fleet-insights.mjs",
        "power-study.mjs",
        "vehicle-concepts.mjs",
        "vehicle-concepts.css",
        "qualification.mjs",
        "assets/vehicle-generic.svg",
        "assets/vehicle-ojai-concept.svg",
        "assets/vehicle-bidi-concept.svg",
        "data/candidate-qualification.json",
        "data/candidate-district-gaps.json",
        "data/candidate-district-research.json",
    }
    initial = [name for name in initial if name not in optional or name in manifest["files"]]
    compressed = sum((root / (name + ".gz")).stat().st_size for name in initial)
    largest = max(record["bytes"] for record in manifest["files"].values())
    pairs = manifest["pair_compressed_bytes"]
    comparison = (root / "data/comparison.json").stat().st_size
    checks = {
        "release_integrity": integrity["pass"],
        "viewer_dependencies": dependencies["pass"],
        "initial_transfer_budget": compressed <= 3 * 1024**2,
        "pages_file_limit": largest <= 25 * 1024**2,
        "pair_replay_budget": max(pairs.values()) <= 20 * 1024**2,
        "comparison_budget": comparison <= 1024**2,
        "power_summary_budget": not (root / "data/power-analysis.json").exists()
        or (root / "data/power-analysis.json").stat().st_size <= 25 * 1024**2,
        "total_file_budget": len(manifest["files"]) + 1 <= 20000,
    }
    return {
        "pass": all(checks.values()),
        "checks": checks,
        "dependency_failures": dependencies["failures"],
        "first_view_gzip_bytes": compressed,
        "largest_file_bytes": largest,
        "pair_compressed_bytes": pairs,
        "comparison_bytes": comparison,
        "total_bytes": sum(r["bytes"] for r in manifest["files"].values()),
        "files": integrity["files"],
        "scope": "REVIEW_PACKAGE_ONLY",
        "map_qualification": "INCOMPLETE",
        "public_release_ready": False,
    }


def make_server(root, port, host="127.0.0.1"):
    if host not in ("127.0.0.1", "localhost"):
        raise ValueError("public bind refused")
    root = Path(root).resolve()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_HEAD(self):
            self.respond(True)

        def do_GET(self):
            self.respond(False)

        def respond(self, head):
            if self.headers.get("Host", "").split(":")[0] not in ("localhost", "127.0.0.1"):
                self.send_error(403)
                return
            name = unquote(urlsplit(self.path).path).lstrip("/") or "index.html"
            p = Path(name)
            if (
                p.is_absolute()
                or any(x in ("..", ".") or x.startswith(".") for x in p.parts)
                or "\x00" in name
            ):
                self.send_error(403)
                return
            target = root / p
            try:
                data = read_bytes(target, 26 * 1024**2)
            except (OSError, ValueError):
                self.send_error(404)
                return
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
            if name.endswith(".mjs"):
                content_type = "text/javascript"
            total = len(data)
            start = 0
            end = total - 1
            status = 200
            encoding = None
            ranged = self.headers.get("Range")
            if ranged:
                match = re.fullmatch(r"bytes=(\d*)-(\d*)", ranged)
                if not match or not any(match.groups()):
                    self.send_error(416)
                    return
                a, b = match.groups()
                if not a:
                    start = max(0, total - int(b))
                else:
                    start = int(a)
                    end = min(total - 1, int(b)) if b else total - 1
                if start >= total or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{total}")
                    self.end_headers()
                    return
                data = data[start : end + 1]
                status = 206
            elif (
                "gzip" in self.headers.get("Accept-Encoding", "")
                and Path(str(target) + ".gz").is_file()
            ):
                data = read_bytes(Path(str(target) + ".gz"))
                encoding = "gzip"
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Vary", "Accept-Encoding")
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
            if encoding:
                self.send_header("Content-Encoding", encoding)
            for k, v in HEADERS.items():
                self.send_header(k, v)
            self.end_headers()
            if not head:
                with contextlib.suppress(BrokenPipeError, ConnectionResetError):
                    self.wfile.write(data)

    return ThreadingHTTPServer((host, port), Handler)
