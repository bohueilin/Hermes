#!/usr/bin/env python3
"""Local-only city lab command contract. All outputs are review artifacts."""

import argparse
import json
import resource
import subprocess
import sys
import time
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parents[1]
sys.path.insert(0, str(APP))
from citylib.contracts import load_json, read_bundle, save_json  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("validate-fixtures")
    p = commands.add_parser("import-sf")
    p.add_argument("--config", type=Path, required=True)
    p = commands.add_parser("qualify-pack")
    p.add_argument("--manifest", type=Path, required=True)
    p = commands.add_parser("benchmark")
    p.add_argument("--spec", type=Path, required=True)
    p = commands.add_parser("run-pair")
    p.add_argument("--spec", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--tuning", action="store_true")
    p = commands.add_parser("verify-run")
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--pack", type=Path, default=ROOT / "build/fleetlab-city/packs/sf-v1")
    p = commands.add_parser("build-viewer")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--runs", type=Path)
    p.add_argument(
        "--power-status",
        type=Path,
        help="Fresh status of a stopped power study; no primary estimate",
    )
    p.add_argument(
        "--power-study",
        type=Path,
        help="Explicit frozen power study directory; freshly verified before export",
    )
    p = commands.add_parser("check-dist")
    p.add_argument("--site", type=Path, required=True)
    p = commands.add_parser("serve")
    p.add_argument("--site", type=Path, required=True)
    p.add_argument("--port", type=int, default=4173)
    p.add_argument("--host", default="127.0.0.1")
    p = commands.add_parser("explain")
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--provider", choices=["template", "fireworks"], default="template")
    p.add_argument("--allow-paid", action="store_true")
    p.add_argument("--max-cost-usd", type=float, default=0)
    args = parser.parse_args()
    code = 0
    if args.command == "validate-fixtures":
        r = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", str(APP / "tests"), "-v"],
            capture_output=True,
            text=True,
        )
        out = ROOT / "build/fleetlab-city/validation"
        out.mkdir(parents=True, exist_ok=True)
        (out / "fixtures-latest.log").write_text(r.stdout + r.stderr)
        result = {"pass": r.returncode == 0, "log": str(out / "fixtures-latest.log")}
        code = r.returncode
    elif args.command == "import-sf":
        from citylib.importer import import_sf

        r = import_sf(load_json(args.config), ROOT)
        result = {
            "output": r["output"],
            "content_digest": r["manifest"]["content_digest"],
            "accounting_complete": r["coverage"]["accounting_complete"],
        }
    elif args.command == "qualify-pack":
        from citylib.pack import qualify_inventory

        b = read_bundle(args.manifest.parent)
        q = qualify_inventory(b["graph.json"])
        coverage = b["coverage.json"]
        witness = b["source-inventory.json"]
        accounting = (
            q["accounting_complete"]
            and witness["candidate_ids"] == b["graph.json"]["candidate_ids"]
        )
        passed = (
            accounting
            and q["routing_support_pass"]
            and coverage["coordinate_roundtrip"]["pass"]
            and coverage["semantic_map_review"]["status"] == "PASS"
        )
        result = {
            "pass": passed,
            "accounting_complete": accounting,
            "routing_support_pass": q["routing_support_pass"],
            "unsupported_fraction": q["unsupported_fraction"],
            "semantic_review": coverage["semantic_map_review"],
            "status": "QUALIFIED" if passed else "UNQUALIFIED_REVIEW_PACK",
        }
        code = 0 if passed else 1
    elif args.command == "benchmark":
        from citylib.engine import run_arm
        from citylib.inputs import generate_inputs
        from citylib.routing import Graph
        from citylib.verify import verify

        s = load_json(args.spec)
        p = read_bundle(ROOT / s["pack_path"])["graph.json"]
        g = Graph(p)
        t = time.monotonic()
        g.prepare(s["node_pool"])
        prepare = time.monotonic() - t
        i = generate_inputs(p, s, 42, s["node_pool"], s["zones"])
        t = time.monotonic()
        r = run_arm(p, i, s, graph=g)
        wall = time.monotonic() - t
        v = verify(r, i, p)
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        passed = wall + prepare <= 300 and peak <= 4 * 1024**3 and v["valid"]
        result = {
            "pass": passed,
            "simulated_s": s["duration_s"],
            "fleet": s["fleet_size"],
            "background_arrivals_per_hour": s["background_per_hour"],
            "wall_s": wall,
            "prepare_s": prepare,
            "peak_rss_bytes": peak,
            "verification_valid": v["valid"],
            "engine": r["model"],
        }
        code = 0 if passed else 1
    elif args.command == "run-pair":
        from citylib.runner import run_schedule

        r = run_schedule(args.spec, args.out, args.tuning)
        result = {k: v for k, v in r.items() if k != "comparison"}
        result["eligibility"] = r["comparison"]["eligibility"]
        result["outcome"] = r["comparison"]["outcome"]
        code = 0 if r["all_runs_valid"] and r["comparison"]["eligibility"] == "ELIGIBLE" else 1
    elif args.command == "verify-run":
        from citylib.runner import verify_directory

        result = verify_directory(args.run, args.pack)
        code = 0 if result["pass"] else 1
    elif args.command == "build-viewer":
        from citylib.package import build_viewer

        result = build_viewer(ROOT, args.out, args.runs, args.power_study, args.power_status)
        code = 0 if result["pass"] else 1
    elif args.command == "check-dist":
        from citylib.package import check_dist

        result = check_dist(args.site)
        code = 0 if result["pass"] else 1
    elif args.command == "serve":
        from citylib.package import make_server

        server = make_server(args.site, args.port, args.host)
        print(f"Local review: http://127.0.0.1:{server.server_address[1]}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return 0
    elif args.command == "explain":
        from citylib.explain import explain

        b = read_bundle(args.run)
        result = explain(b["verification.json"], args.provider, args.allow_paid)
        if args.provider == "fireworks":
            code = 2  # Explicitly unqualified; never starts paid network activity.
    print(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False))
    save_json(ROOT / f"build/fleetlab-city/validation/command-{args.command}.json", result)
    return code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError) as exc:
        print(
            json.dumps({"pass": False, "status": "FAILED_OR_BLOCKED", "error": str(exc)}),
            file=sys.stderr,
        )
        sys.exit(2)
