"""A fresh, deterministic review population for the separately identified temporal map."""

from collections import defaultdict

from .contracts import digest
from .review_workspace_v1 import candidate_identity, freeze_workspace
from .temporal_candidate_v1 import SCHEMA


def requirements(candidate, node_pool):
    if candidate["qualification-report.json"]["schema"] != SCHEMA:
        raise ValueError("temporal candidate report required")
    if not isinstance(node_pool, list) or not all(isinstance(n, str) for n in node_pool):
        raise ValueError("explicit string node population required")
    if len(set(node_pool)) != len(node_pool) or len(node_pool) < 102:
        raise ValueError("at least 102 distinct source nodes required for fixed OD selection")
    if not set(node_pool) <= set(candidate["graph.json"]["nodes"]):
        raise ValueError("source pool contains absent nodes; population cannot silently shrink")
    by_feature = {}

    def add(kind, feature, reason):
        if (
            not isinstance(feature, str)
            or not feature
            or any(c not in "0123456789" for c in feature)
        ):
            raise ValueError("review source feature must have a numeric OSM identity")
        key = f"{kind}-{feature}"
        if key not in by_feature:
            by_feature[key] = {
                "id": key,
                "source_url": f"https://www.openstreetmap.org/{kind}/{feature}",
                "resolver_roles": ["independent-source-reviewer"],
                "independent_resolution": True,
                "reasons": [],
            }
        if reason not in by_feature[key]["reasons"]:
            by_feature[key]["reasons"].append(reason)
        return key

    checklist = candidate["human-review-checklist.json"]
    for name, reason in [("restored_ways", "restored"), ("newly_blocked_ways", "newly-blocked")]:
        for row in checklist[name]:
            add("way", row["source_way_id"], reason)
    for name, kind, reason in [
        ("unsupported_ways", "way", "unsupported"),
        ("district_gap_way_ids", "way", "district-gap"),
        ("timed_access_ways", "way", "timed-access"),
        ("timed_turns", "relation", "timed-turn"),
        ("access_nodes", "node", "node-access"),
    ]:
        for feature in checklist[name]:
            add(kind, feature, reason)
    for row in checklist["static_restriction_exceptions"]:
        feature = row["id"]
        prefix, _, way = feature.partition(":")
        if prefix in {"unsupported-way-access", "unsupported-node-access"}:
            add("way", way, prefix)
        else:
            add("relation", feature, "static-restriction-exception")
    for row in checklist["temporal_source_audit"]:
        if row["kind"] not in {"way", "relation"}:
            raise ValueError("unknown temporal source feature kind")
        add(row["kind"], row["id"], "temporal-" + row["status"])
    queued = len(by_feature)
    groups = defaultdict(list)
    for feature in candidate["roads.geo.json"]["features"]:
        prop = feature["properties"]
        if prop["status"] != "excluded":
            groups[prop["class"]].append(prop["id"])
    if sum(len(ids) for ids in groups.values()) < 200:
        raise ValueError("insufficient eligible source sample population")
    for ids in groups.values():
        ids.sort(key=lambda x: digest(["sf-temporal-human-sample-v1", x]))
    samples = []
    for cursor in range(200):
        for road_class, ids in sorted(groups.items()):
            if cursor < len(ids) and len(samples) < 200:
                key = add("way", ids[cursor], "human-feature-sample")
                samples.append({"id": key, "kind": "segment", "claim": key, "stratum": road_class})
    if len({s["id"] for s in samples}) != 200:
        raise ValueError("source samples must be distinct")
    pool = sorted(node_pool, key=lambda x: digest(["sf-temporal-human-od-v1", x]))
    for i in range(100):
        origin, destination = pool[i], pool[(i + 101) % len(pool)]
        key = f"od-{origin}-{destination}"
        by_feature[key] = {
            "id": key,
            "source_url": f"https://www.openstreetmap.org/node/{origin}",
            "resolver_roles": ["independent-source-reviewer"],
            "independent_resolution": True,
            "reasons": ["human-OD-sample"],
        }
        samples.append(
            {
                "id": key,
                "kind": "od",
                "claim": key,
                "stratum": "od",
                "origin_node": origin,
                "destination_node": destination,
                "review_instructions": (
                    "Inspect outbound and retained-history return paths, including stops. "
                    "Check 09:59, 10:59 and 14:59 America/Los_Angeles departures on 2026-09-29; "
                    "evaluate rules at traversal times. Record no-route or ambiguity honestly."
                ),
            }
        )
    return {
        "schema": "fleetlab.map-review-requirements/1.0.0",
        "candidate": candidate_identity(candidate),
        "obligations": list(by_feature.values()),
        "samples": samples,
        "required_strata": sorted(groups),
        "queue_entries": queued,
        "node_pool_digest": digest(sorted(node_pool)),
        "selection": "200 class-stratified ways and 100 fixed OD pairs, frozen before review",
        "human_samples_required": {"segments": 200, "od": 100},
        "independence": "Feature reasons are merged; categories are not independent observations.",
    }


def prepare(out, candidate, node_pool):
    required = requirements(candidate, node_pool)
    coverage = candidate["coverage.json"]
    budgets = coverage["unsupported_fraction"] <= 0.02 and all(
        r["unsupported_fraction"] <= 0.05 for r in coverage["by_class"].values()
    )
    return freeze_workspace(
        out,
        required,
        {
            "source_accounting": "PASS" if coverage["accounting_complete"] else "HOLD",
            "class_budgets": "PASS" if budgets else "HOLD",
            "district_scope": "HOLD",
            "continuity": "SEPARATE_ENGINEERING_EVIDENCE",
        },
    )
