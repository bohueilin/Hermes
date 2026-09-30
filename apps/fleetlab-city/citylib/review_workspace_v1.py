"""Prepare immutable SF source-review work; never manufacture reviewer observations."""

import csv
from collections import defaultdict
from pathlib import Path

from .contracts import digest, load_json, read_bundle, save_json
from .map_review_v1 import validate_review


def candidate_identity(candidate):
    return {
        "pack": candidate["manifest.json"]["content_digest"],
        "graph": candidate["qualification-report.json"]["candidate_graph_digest"],
        "checklist": digest(candidate["human-review-checklist.json"]),
        "sources": digest(candidate["source-inventory.json"]),
    }


def prepare_review(root, destination):
    root, destination = Path(root), Path(destination)
    if destination.exists():
        raise FileExistsError("review workspace exists; select a new immutable version")
    candidate = read_bundle(root / "build/fleetlab-city/packs/sf-v2")
    identity = candidate_identity(candidate)
    checklist = candidate["human-review-checklist.json"]
    obligations = []

    def obligation(key, url):
        obligations.append(
            {
                "id": key,
                "source_url": url,
                "resolver_roles": ["independent-source-reviewer"],
                "independent_resolution": True,
            }
        )

    for road in checklist["restored_ways"]:
        obligation(
            "restored-" + road["source_way_id"],
            "https://www.openstreetmap.org/way/" + road["source_way_id"],
        )
    for relation in checklist["restriction_exceptions"]:
        obligation("restriction-" + relation["id"], relation["source_url"])
    for way in checklist["district_gap_way_ids"]:
        obligation("district-" + way, "https://www.openstreetmap.org/way/" + way)
    # Equal round-robin allocation across captured eligible road classes, ordered
    # by stable digest within a class. Selection precedes any human observations.
    groups = defaultdict(list)
    for feature in candidate["roads.geo.json"]["features"]:
        prop = feature["properties"]
        if prop["status"] != "excluded":
            groups[prop["class"]].append(prop["id"])
    for ids in groups.values():
        ids.sort(key=lambda x: digest(["sf-human-sample-v1", x]))
    samples = []
    cursor = 0
    while len(samples) < 200:
        for road_class, ids in sorted(groups.items()):
            if cursor < len(ids) and len(samples) < 200:
                feature = "way-" + ids[cursor]
                claim = "sample-" + feature
                obligation(claim, "https://www.openstreetmap.org/way/" + ids[cursor])
                samples.append(
                    {"id": feature, "kind": "segment", "claim": claim, "stratum": road_class}
                )
        cursor += 1
        if cursor > 200:
            raise ValueError("insufficient eligible source sample population")
    spec = load_json(root / "apps/fleetlab-city/experiments/sf-depots-v1.json")
    pool = sorted(
        set(spec["node_pool"]) & set(candidate["graph.json"]["nodes"]),
        key=lambda x: digest(["sf-human-od-v1", x]),
    )
    if len(pool) < 101:
        raise ValueError("insufficient OD sample population")
    for i in range(100):
        origin, target = pool[i], pool[(i + 101) % len(pool)]
        key = f"od-{origin}-{target}"
        obligation(key, "https://www.openstreetmap.org/node/" + origin)
        samples.append(
            {
                "id": key,
                "kind": "od",
                "claim": key,
                "stratum": "od",
                "origin_node": origin,
                "destination_node": target,
                "review_instructions": (
                    "Inspect the full source-supported route and stops; record no-route honestly"
                ),
            }
        )
    requirements = {
        "schema": "fleetlab.map-review-requirements/1.0.0",
        "candidate": identity,
        "obligations": obligations,
        "samples": samples,
        "required_strata": sorted(groups),
        "selection": (
            "200 class-stratified source ways and 100 deterministic OD pairs; frozen before review"
        ),
        "queue_entries": 829,
        "human_samples_required": {"segments": 200, "od": 100},
        "independence": (
            "Distinct queue categories may refer to the same road; "
            "do not inflate independent checks"
        ),
    }
    return freeze_workspace(
        destination,
        requirements,
        {
            "source_accounting": "PASS"
            if candidate["coverage.json"]["accounting_complete"]
            else "HOLD",
            "class_budgets": "HOLD",
            "district_scope": "HOLD",
            "continuity": "NOT_RUN",
        },
    )


def freeze_workspace(destination, requirements, gates):
    """Write an empty review against exact caller-supplied requirements and gates."""
    destination = Path(destination)
    if destination.exists():
        raise FileExistsError("review workspace exists; select a new immutable version")
    identity = requirements["candidate"]
    obligations, samples = requirements["obligations"], requirements["samples"]
    manifest = {"previous": None, "observations": [], "resolutions": [], "captures": []}
    history = {
        "schema": "fleetlab.map-review-history/1.0.0",
        "candidate": identity,
        "requirements_digest": digest(requirements),
        "observations": [],
        "resolutions": [],
        "captures": [],
        "manifests": [manifest],
    }
    destination.mkdir(parents=True)
    save_json(destination / "requirements.json", requirements)
    save_json(destination / "history.json", history)
    checkpoint = digest(manifest)
    save_json(
        destination / "checkpoint.json",
        {
            "requirements_digest": digest(requirements),
            "history_checkpoint": checkpoint,
            "candidate": identity,
            "status": "FROZEN_EMPTY_REVIEW; no human observations",
        },
    )
    envelope = validate_review(destination / "history.json", requirements, checkpoint, gates)
    save_json(destination / "envelope.json", envelope)
    with (destination / "inspection-worksheet.csv").open("w", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(
            [
                "obligation",
                "source_url",
                "reviewer",
                "date_time_timezone",
                "capture_revision_sha256",
                "observation",
                "disposition",
                "uncertainty",
            ]
        )
        for item in obligations:
            writer.writerow([item["id"], item["source_url"], "", "", "", "", "NOT_REVIEWED", ""])
    return {
        "requirements_digest": digest(requirements),
        "history_checkpoint": checkpoint,
        "candidate": identity,
        "obligations": len(obligations),
        "samples": len(samples),
        "qualification": envelope["qualification"],
        "output": str(destination),
    }
