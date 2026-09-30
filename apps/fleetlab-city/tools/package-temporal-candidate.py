#!/usr/bin/env python3
"""Package or verify a frozen temporal map. Never execute a fleet or study."""

import argparse
import json
import resource
import sys
import time
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from citylib.contracts import (  # noqa: E402
    digest,
    load_json,
    read_bundle,
    read_bytes,
    save_json,
    sha,
)
from citylib.temporal_candidate_v1 import validate, write  # noqa: E402
from citylib.temporal_review_v1 import prepare  # noqa: E402


def execute(args):
    baseline = read_bundle(args.baseline)
    if args.mode == "build":
        if args.graph is None:
            raise ValueError("build requires the exact captured graph")
        pack = load_json(args.graph)
        if digest(pack) != args.expected_graph_digest:
            raise ValueError("graph differs from the independently selected identity")
        manifest = write(args.candidate, baseline, pack)
        return {
            "candidate_manifest_digest": manifest["content_digest"],
            "candidate_graph_digest": digest(pack),
            "qualification": "HOLD",
            "status": "BUILT; independent bundle validation required",
        }
    bundle = read_bundle(args.candidate)
    if digest(bundle["graph.json"]) != args.expected_graph_digest:
        raise ValueError("candidate differs from independently selected graph")
    result = {
        **validate(baseline, bundle),
        "status": "INTERNALLY_CONSISTENT",
        "candidate_manifest_digest": bundle["manifest.json"]["content_digest"],
    }
    if args.mode == "review":
        scenario = load_json(args.scenario)
        result["review"] = prepare(args.review_out, bundle, scenario["node_pool"])
        result["review_source_scenario_digest"] = digest(scenario)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["build", "validate", "review"])
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--graph", type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--expected-graph-digest", required=True)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--review-out", type=Path)
    parser.add_argument("--scenario", type=Path)
    args = parser.parse_args()
    if args.report.exists():
        raise FileExistsError("report exists; preserve the earlier result")
    report_path = args.report.resolve()
    if any(report_path.is_relative_to(p.resolve()) for p in (args.candidate, args.baseline)):
        raise ValueError("report must be outside candidate and input bundle directories")
    if args.mode == "review":
        if args.review_out is None or args.scenario is None:
            raise ValueError("review requires a new workspace and explicit node-pool scenario")
        review_path = args.review_out.resolve()
        if any(
            review_path.is_relative_to(p.resolve()) or p.resolve().is_relative_to(review_path)
            for p in (args.candidate, args.baseline, args.report, args.scenario)
        ):
            raise ValueError("review workspace must not overlap input bundles, scenario or report")
    began = time.monotonic()
    files = [Path(__file__), *sorted((APP / "citylib").glob("*.py"))]
    before = {p.relative_to(APP).as_posix(): sha(read_bytes(p)) for p in files}
    error = None
    try:
        result = execute(args)
    except Exception as exc:
        error = exc
        result = {"status": "FAILED", "pass": False, "error": str(exc)}
    after = {p.relative_to(APP).as_posix(): sha(read_bytes(p)) for p in files}
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform != "darwin":
        peak *= 1024  # Linux reports KiB; the deployed authoring host reports bytes.
    result.update(
        elapsed_s=time.monotonic() - began,
        peak_rss_bytes=peak,
        within_4GB_resource_limit=peak <= 4_000_000_000,
        sources=before,
        sources_unchanged=before == after,
        scope="PACKAGING_ONLY; NO_SIMULATION; NO_HUMAN_OBSERVATIONS",
    )
    if peak > 4_000_000_000 or before != after:
        error = ValueError("packaging resource/source check failed; do not publish")
        result.update(status="FAILED", **{"pass": False})
    save_json(args.report, result)
    print(json.dumps({k: v for k, v in result.items() if k != "sources"}, indent=2))
    if error is not None:
        raise error


if __name__ == "__main__":
    main()
