#!/usr/bin/env python3
"""Build or independently recapture/recompute an SF reporting proposal; no simulation."""

import argparse
import json
import resource
import sys
import time
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from citylib.administrative_scope_v1 import (  # noqa: E402
    derive,
    directory_snapshot,
    read,
    validate,
    write,
)
from citylib.contracts import canonical, decode, read_bundle, read_bytes, sha  # noqa: E402


def peak_bytes():
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak if sys.platform == "darwin" else peak * 1024


def snapshot(paths):
    return {str(p): sha(read_bytes(p)) for p in paths}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["build", "validate"])
    for name in ("candidate", "districts", "provenance", "tape", "output", "report"):
        parser.add_argument("--" + name, required=True, type=Path)
    for name in ("candidate-digest", "source-sha256", "provenance-sha256", "tape-sha256"):
        parser.add_argument("--expected-" + name, required=True)
    args = parser.parse_args()
    paths = {
        k: getattr(args, k).absolute()
        for k in ("candidate", "districts", "provenance", "tape", "output", "report")
    }
    for path in paths.values():
        if ".." in path.parts:
            raise ValueError("parent traversal refused; supply normalized paths")
        if any(p.is_symlink() for p in [path, *path.parents]):
            raise ValueError("symlink input/output path refused")
    protected = [paths[k] for k in ("candidate", "districts", "provenance", "tape")]
    for writable in (paths["output"], paths["report"]):
        for other in protected:
            if writable.is_relative_to(other) or other.is_relative_to(writable):
                raise ValueError("output/report must not overlap inputs")
    if paths["report"].is_relative_to(paths["output"]) or paths["output"].is_relative_to(
        paths["report"]
    ):
        raise ValueError("report must be separate from proposal")
    if paths["report"].exists() or (args.mode == "build" and paths["output"].exists()):
        raise FileExistsError("preserve previous proposal/report; choose a new destination")
    started = time.monotonic()
    sources = [Path(__file__), *sorted((APP / "citylib").glob("*.py"))]
    source_before = snapshot(sources)
    candidate_before = directory_snapshot(paths["candidate"])
    input_paths = sorted(p for p in paths["candidate"].iterdir() if p.is_file()) + protected[1:]
    before = snapshot(input_paths)
    proposal_before = directory_snapshot(paths["output"]) if args.mode == "validate" else None
    proposal_hashes = snapshot(sorted(paths["output"].iterdir())) if proposal_before else None
    error = None
    result = {"pass": False, "status": "FAILED", "qualification": "HOLD"}
    try:
        candidate = read_bundle(paths["candidate"])
        if candidate["manifest.json"]["content_digest"] != args.expected_candidate_digest:
            raise ValueError("candidate differs from independently selected identity")
        captures = {k: read_bytes(paths[k]) for k in ("districts", "provenance", "tape")}
        for key, pin in (
            ("districts", args.expected_source_sha256),
            ("provenance", args.expected_provenance_sha256),
            ("tape", args.expected_tape_sha256),
        ):
            if sha(captures[key]) != pin:
                raise ValueError(f"{key} differs from independently selected identity")
        provenance, tape = decode(captures["provenance"]), decode(captures["tape"])
        if args.mode == "build":
            files = derive(candidate, captures["districts"], provenance, tape)
            result = {
                "pass": True,
                "status": "BUILT_REQUIRES_FRESH_RECOMPUTATION",
                "qualification": "HOLD",
            }
        else:
            result = validate(
                read(paths["output"]), candidate, captures["districts"], provenance, tape
            )
        # Release the captured graph before final raw-input recapture.
        del candidate, captures, tape
    except Exception as exc:
        error = exc
        result.update(error=str(exc))
    try:
        inputs_unchanged = candidate_before == directory_snapshot(
            paths["candidate"]
        ) and before == snapshot(input_paths)
        proposal_unchanged = (
            proposal_before == directory_snapshot(paths["output"])
            and proposal_hashes == snapshot(sorted(paths["output"].iterdir()))
            if proposal_before
            else None
        )
        sources_unchanged = source_before == snapshot(sources)
    except (ValueError, OSError):
        inputs_unchanged = sources_unchanged = False
        proposal_unchanged = False if proposal_before else None
    peak = peak_bytes()
    if (
        not inputs_unchanged
        or not sources_unchanged
        or proposal_unchanged is False
        or peak > 4_000_000_000
    ):
        error = ValueError("input/source/resource check failed; no valid proposal")
    if error is None and args.mode == "build":
        manifest = write(paths["output"], files)
        result["proposal_manifest_digest"] = manifest["content_digest"]
    if error is not None:
        result.update({"pass": False, "status": "FAILED", "error": str(error)})
    result.update(
        elapsed_s=time.monotonic() - started,
        peak_rss_bytes=peak_bytes(),
        inputs_unchanged=inputs_unchanged,
        proposal_unchanged=proposal_unchanged,
        sources_unchanged=sources_unchanged,
        within_4GB_resource_limit=peak_bytes() <= 4_000_000_000,
        input_files={
            str(p.relative_to(paths["candidate"]))
            if p.is_relative_to(paths["candidate"])
            else p.name: before[str(p)]
            for p in input_paths
        },
        tool_sources={str(p.relative_to(APP)): source_before[str(p)] for p in sources},
        scope="ADMINISTRATIVE_REPORT_ONLY; NO_SIMULATION; NO_HUMAN_OBSERVATIONS",
    )
    paths["report"].parent.mkdir(parents=True, exist_ok=True)
    with paths["report"].open("xb") as stream:
        stream.write(canonical(result) + b"\n")
    print(
        json.dumps(
            {k: v for k, v in result.items() if k not in {"tool_sources", "input_files"}}, indent=2
        )
    )
    if error is not None:
        raise error


if __name__ == "__main__":
    main()
