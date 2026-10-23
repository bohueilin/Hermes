"""Read-only, process-isolated publication projection of the selected SF candidate."""

import json
import resource
import sys
from pathlib import Path

from .contracts import decode, digest, load_json, read_bundle, read_bytes, save_json, sha
from .map_review_v1 import validate_review
from .public_notes import export_notes, export_worksheet
from .review_workspace_v1 import candidate_identity
from .temporal_candidate_v1 import validate

PACK = "build/fleetlab-city/packs/sf-temporal-v3-r2"
WORKSPACE = "build/fleetlab-city/reviews/sf-temporal-v3-review-r2"
BUNDLE_DIGEST = "8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198"
REQUIREMENTS = "4d43fb2d932b01da27d16055774dfe1b6de141ce342e1a74d9f0248b689c5ac8"
CHECKPOINT = "b1f184bdf132ebd64074333a6036ce747ac33816b5f310822c6b34f90b548ffb"
ENGINEERING = "build/fleetlab-city/validation/sf-temporal-fleet-20260930-r6"
CORRECTED = ENGINEERING + "-verifier-3.0.1"


def pinned(path, expected):
    data = read_bytes(path)
    if sha(data) != expected:
        raise ValueError("selected engineering artifact has changed: " + path.name)
    return decode(data)


def engineering(root):
    executed = pinned(
        root / ENGINEERING / "execute-report.json",
        "7a9ea250b80ee431b5028498346aca795fa7de831b097297e93b37536be55abb",
    )
    checked = pinned(
        root / CORRECTED / "verify-report.json",
        "e516bf4e0cd83669ed54652a002b3d9c901f65489706bef1370099cddf82e3e9",
    )
    verified = pinned(
        root / CORRECTED / "verification.json",
        "654bfb4d4a0345749f4ed199ff691f56b0fad025fefdfe4458f7a462c39c2bf0",
    )
    original = pinned(
        root / ENGINEERING / "verify-report.json",
        "e444d51809c598dda1e2bd60b73d6dd36e2e83b1b5b66dffa85a49e7104710dc",
    )
    freeze = load_json(root / ENGINEERING / "freeze.json")
    correction = load_json(root / CORRECTED / "freeze.json")
    if (
        digest(freeze) != executed["freeze_digest"]
        or digest(correction) != checked["freeze_digest"]
    ):
        raise ValueError("engineering freeze differs from selected reports")
    if (
        correction["pack_digest"] != freeze["pack_digest"]
        or correction["run_digest"] != executed["run_digest"]
        or checked["run_digest"] != executed["run_digest"]
    ):
        raise ValueError("engineering reports name different graphs or recordings")
    # Check original bytes, including the preserved adverse report, without
    # executing a simulator or recreating its expensive verification process.
    for artifact in correction["artifacts"].values():
        path = Path(artifact["path"])
        if (
            path.is_absolute()
            or ".." in path.parts
            or sha(read_bytes(root / path)) != artifact["sha256"]
        ):
            raise ValueError("stored engineering evidence differs from its frozen identity")
    return {
        "scope": "ONE_ENGINEERING_CASE",
        "pack_digest": freeze["pack_digest"],
        "model": freeze["spec"]["model"],
        "run_digest": executed["run_digest"],
        "fleet_size": freeze["spec"]["fleet_size"],
        "request_count": freeze["spec"]["request_count"],
        "duration_s": freeze["spec"]["duration_s"],
        "recommendation_eligible": False,
        "execution": {k: executed[k] for k in ("status", "elapsed_s", "peak_rss_bytes")},
        "verification": {
            k: checked[k] for k in ("status", "valid", "verifier", "elapsed_s", "peak_rss_bytes")
        },
        "verification_state": verified["verification"],
        "finding_count": verified["finding_count"],
        "prior_verification_status": original["status"],
        "prior_findings": len(original["findings"]),
        "limits": {"memory_bytes": freeze["memory_limit_bytes"], "wall_s": freeze["wall_limit_s"]},
        "limitations": [
            "One synthetic engineering case; not a paired study or operator prediction.",
            "Original invalid report retained; corrected verifier checked the same recording.",
            "No additional power-study evaluation. Source and human qualification remain separate.",
        ],
    }


def summary(candidate, envelope, evidence):
    if envelope["candidate"] != candidate_identity(candidate):
        raise ValueError("review evidence names another candidate")
    if evidence["pack_digest"] != candidate["qualification-report.json"]["candidate_graph_digest"]:
        raise ValueError("engineering evidence names another graph")
    if (
        envelope["qualification"] != "HOLD"
        or envelope["scope"] != "SIMULATION_ONLY"
        or envelope["deployment_permission"] != "NONE"
    ):
        raise ValueError("unexpected temporal candidate qualification/authority")
    return {
        "schema": "fleetlab.temporal-view/1.0.0",
        "scope": "SIMULATION_ONLY",
        "decision_authority": "NONE",
        "candidate": candidate_identity(candidate),
        "report": candidate["qualification-report.json"],
        "engineering": evidence,
        "review": {
            "qualification": envelope["qualification"],
            "human_samples": envelope["human_samples"],
            "obligation_count": len(envelope["obligations"]),
        },
    }


def export(root, out):
    root, out = Path(root).resolve(), Path(out).resolve()
    evidence = engineering(root)
    baseline = read_bundle(root / "build/fleetlab-city/packs/sf-v2")
    candidate = read_bundle(root / PACK)
    if candidate["manifest.json"]["content_digest"] != BUNDLE_DIGEST:
        raise ValueError("temporal candidate bundle differs from selected release")
    validate(baseline, candidate)
    workspace = root / WORKSPACE
    requirements = load_json(workspace / "requirements.json")
    if digest(requirements) != REQUIREMENTS or requirements["candidate"] != candidate_identity(
        candidate
    ):
        raise ValueError("temporal review requirements differ from frozen selection")
    envelope = validate_review(
        workspace / "history.json",
        requirements,
        CHECKPOINT,
        {
            "source_accounting": "PASS",
            "class_budgets": "PASS",
            "district_scope": "HOLD",
            "continuity": "SEPARATE_ENGINEERING_EVIDENCE",
        },
    )
    values = {
        "temporal-summary.json": summary(candidate, envelope, evidence),
        "temporal-roads.geo.json": candidate["roads.geo.json"],
        "temporal-review-envelope.json": envelope,
        "temporal-review-requirements.json": requirements,
        "temporal-human-review.json": candidate["human-review-checklist.json"],
    }
    for name in values:
        if (out / "data" / name).exists():
            raise FileExistsError("temporal viewer projection already exists")
    for name, value in values.items():
        save_json(out / "data" / name, value)
    export_notes(out)
    export_worksheet(
        workspace / "inspection-worksheet.csv", out / "notes/sf-temporal-inspection-worksheet.csv"
    )
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (
        1 if sys.platform == "darwin" else 1024
    )
    if peak > 4_000_000_000:
        raise MemoryError("temporal export exceeded 4 GB; do not publish")
    return {
        "summary_file": "data/temporal-summary.json",
        "candidate_bundle_digest": BUNDLE_DIGEST,
        "review_requirements_digest": REQUIREMENTS,
        "export_peak_rss_bytes": peak,
    }


if __name__ == "__main__":
    print(json.dumps(export(sys.argv[1], sys.argv[2])))
