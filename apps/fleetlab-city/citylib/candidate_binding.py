"""Bind candidate presentation claims to captured artifacts, not merely their hashes."""

from collections import Counter

from shapely.geometry import shape

from .contracts import digest
from .pack import qualify_inventory
from .qualification import district_gap_inventory
from .restrictions import PROFILE, validate_profile
from .road_projection import project_roads

COVERAGE_FIELDS = (
    "dispositions",
    "unsupported_fraction",
    "unsupported_length_m",
    "by_class",
    "by_district",
)


def _same(actual, expected, label):
    if digest(actual) != digest(expected):
        raise ValueError(f"candidate {label} differs from captured evidence")


def validate_candidate(baseline_bundle, candidate_bundle):
    """Validate already read_bundle-captured bundles; neither input is modified.

    Recomputes inventory qualification and projected district gaps. This establishes
    internal consistency only; source authenticity and human review remain separate.
    """
    try:
        return _validate(baseline_bundle, candidate_bundle)
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("candidate binding requires complete, supported artifacts") from exc


def _validate(baseline, candidate):
    old, pack = baseline["graph.json"], candidate["graph.json"]
    report = candidate["qualification-report.json"]
    coverage = candidate["coverage.json"]
    gaps = candidate["district-gaps.json"]
    geometry = candidate["geometry.json"]
    checklist = candidate["human-review-checklist.json"]
    _same(report["schema"], "fleetlab.map-qualification-candidate/1.0.0", "report schema")
    _same(validate_profile(old), "node-via/1.0.0", "baseline profile")
    _same(validate_profile(pack), PROFILE, "candidate profile")
    _same(report["routing_profile"], pack["routing_profile"], "reported profile")
    _same(report["baseline_pack_id"], old["pack_id"], "baseline ID")
    _same(report["candidate_pack_id"], pack["pack_id"], "candidate ID")
    _same(report["city"], pack["city"], "city")
    _same(pack["city"], old["city"], "baseline city")
    _same(
        report["baseline_pack_digest"],
        baseline["manifest.json"]["content_digest"],
        "baseline digest",
    )
    graph_digest = digest({k: pack[k] for k in ("nodes", "edges", "turns")})
    _same(report["candidate_graph_digest"], graph_digest, "graph digest")
    _same(report["sources_unchanged"], True, "same-source claim")
    for key in ("osm_sha256", "districts_sha256", "boundary_sha256"):
        _same(pack["source"][key], old["source"][key], key)
    _same(geometry, baseline["geometry.json"], "geometry reused by UI")
    _same(
        pack["source"]["boundary_sha256"], digest(geometry["boundary"]), "boundary geometry digest"
    )
    _same(pack["nodes"], old["nodes"], "source node geometry")
    _same(candidate["roads.geo.json"], project_roads(pack), "road display projection")
    _same(pack["candidate_ids"], old["candidate_ids"], "source candidates")
    _same(
        pack["source_inventory_digest"], old["source_inventory_digest"], "source inventory digest"
    )
    for graph, captured, label in (
        (old, baseline["coverage.json"], "baseline coverage"),
        (pack, coverage, "candidate coverage"),
    ):
        computed = qualify_inventory(graph)
        if not computed["accounting_complete"]:
            raise ValueError(f"candidate {label} has incomplete accounting")
        _same({k: captured[k] for k in computed}, computed, label)
    _same(
        report["before"],
        {k: baseline["coverage.json"][k] for k in COVERAGE_FIELDS},
        "before metrics",
    )
    _same(report["after"], {k: coverage[k] for k in COVERAGE_FIELDS}, "after metrics")

    old_records = {r["id"]: r for r in old["inventory"]}
    records = {r["id"]: r for r in pack["inventory"]}
    _same(sorted(records), sorted(old_records), "inventory IDs")
    transitions = []
    for r in pack["inventory"]:
        before = old_records[r["id"]]
        for key in (
            "name",
            "class",
            "length_m",
            "source_nodes",
            "tags",
            "scope",
            "district_lengths_m",
        ):
            _same(r[key], before[key], f"way {r['id']} source field {key}")
        if before["status"] != r["status"]:
            transitions.append(
                {
                    "source_way_id": r["id"],
                    "class": r["class"],
                    "name": r["name"],
                    "before": before["status"],
                    "after": r["status"],
                    "length_m": r["length_m"],
                }
            )
    _same(report["way_transitions"], transitions, "way transitions")
    audit = pack["restriction_audit"]
    if any(
        r["status"] not in {"EXEMPT", "BLOCKED", "NODE_VIA", "SUPPORTED_SEQUENCE"} for r in audit
    ):
        raise ValueError("candidate restriction audit has unknown status")
    _same(
        report["restriction_counts"],
        dict(Counter(r["status"] for r in audit)),
        "restriction counts",
    )
    for status, sequence in [("SUPPORTED_SEQUENCE", True), ("NODE_VIA", False)]:
        _same(
            dict(Counter(r["id"] for r in audit if r["status"] == status)),
            dict(Counter(r["id"] for r in pack["turns"] if ("edge_sequences" in r) == sequence)),
            f"{status} restriction IDs",
        )
    blocked = [r for r in audit if r["status"] == "BLOCKED"]
    exceptions = report["restriction_exceptions"]
    _same(
        [{k: e[k] for k in ("id", "status", "reason")} for e in exceptions],
        blocked,
        "restriction exceptions",
    )
    if any(e["relation"]["id"] != e["id"] for e in exceptions):
        raise ValueError("candidate restriction exception relation ID differs")

    _same(gaps["source_sha256"], pack["source"]["districts_sha256"], "district gap source")
    _same(
        report["district_gap_summary"],
        {k: v for k, v in gaps.items() if k != "records"},
        "district gap summary",
    )
    _same(report["district_gap_way_count"], len(gaps["records"]), "district gap count")
    recomputed_gaps = district_gap_inventory(
        pack, shape(geometry["boundary"]), geometry["districts"]
    )
    _same(gaps, recomputed_gaps, "district gap geometry and measurements")
    gap_digest = digest(gaps)
    if "district_gap_digest" in report:
        _same(report["district_gap_digest"], gap_digest, "district gap digest")
    _same(checklist["restriction_exceptions"], exceptions, "review restriction exceptions")
    _same(
        checklist["restored_ways"],
        [r for r in transitions if r["after"] == "included"],
        "review restored ways",
    )
    _same(
        checklist["district_gap_way_ids"],
        [r["source_way_id"] for r in gaps["records"]],
        "review district gaps",
    )
    _same(checklist["status"], "NOT_RUN", "human review status")
    _same(checklist["review_results"], [], "human review results")
    expected_gates = {
        "routing-support": "PASS" if coverage["routing_support_pass"] else "HOLD",
        "district-policy": "HOLD",
        "semantic-map-review": "NOT_RUN",
        "fleet-leg-continuity": "NOT_RUN",
    }
    _same({g["id"]: g["status"] for g in report["gates"]}, expected_gates, "qualification gates")
    _same(len(report["gates"]), len(expected_gates), "qualification gate count")
    for key, value in [
        ("status", "HOLD"),
        ("scope", "SIMULATION_ONLY"),
        ("evidence", "NOT_EVIDENCE"),
    ]:
        _same(report[key], value, key)
    return {"pass": True, "candidate_graph_digest": graph_digest, "district_gap_digest": gap_digest}
