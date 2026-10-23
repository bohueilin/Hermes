"""Immutable temporal-map projection; never a fleet study or human qualification."""

from collections import Counter

from shapely.geometry import shape

from .contracts import digest, write_bundle
from .pack import qualify_inventory
from .qualification import district_gap_inventory
from .restrictions import PROFILE, validate_profile
from .road_projection import project_roads
from .temporal_import_v3 import validated_graph

SCHEMA = "fleetlab.temporal-map-candidate/1.0.0"
BUNDLE_METADATA = {"kind": "TEMPORAL_ENGINEERING_CANDIDATE", "report_schema": SCHEMA}
SOURCE_FIELDS = (
    "id",
    "name",
    "class",
    "eligible",
    "length_m",
    "scope",
    "district_lengths_m",
    "source_nodes",
    "tags",
)


def _same(actual, expected, label):
    if digest(actual) != digest(expected):
        raise ValueError(f"temporal candidate {label} differs from captured evidence")


def derive(baseline, pack):
    """Derive display and review files from captured maps, without changing either."""
    try:
        return _derive(baseline, pack)
    except (KeyError, TypeError, AttributeError, IndexError) as exc:
        raise ValueError("incomplete temporal candidate inputs") from exc


def _derive(baseline, pack):
    old = baseline["graph.json"]
    _same(validate_profile(old), PROFILE, "prior static profile")
    _same(pack["baseline_pack_digest"], digest(old), "prior complete graph identity")
    _same(pack["city"], old["city"], "city")
    _same(pack["nodes"], old["nodes"], "source geometry")
    _same(pack["candidate_ids"], old["candidate_ids"], "source candidate population")
    _same(pack["source_inventory_digest"], old["source_inventory_digest"], "source inventory")
    _same(pack["temporal"]["xml_sha256"], old["source"]["osm_sha256"], "captured XML")
    validated_graph(pack)
    geometry = baseline["geometry.json"]
    _same(digest(geometry["boundary"]), old["source"]["boundary_sha256"], "municipal boundary")
    old_rows = {r["id"]: r for r in old["inventory"]}
    _same(sorted(r["id"] for r in pack["inventory"]), sorted(old_rows), "inventory IDs")
    transitions = []
    for row in pack["inventory"]:
        previous = old_rows[row["id"]]
        _same(
            {k: row[k] for k in SOURCE_FIELDS},
            {k: previous[k] for k in SOURCE_FIELDS},
            f"source way {row['id']}",
        )
        if row["status"] != previous["status"]:
            transitions.append(
                {
                    "source_way_id": row["id"],
                    "class": row["class"],
                    "name": row["name"],
                    "before": previous["status"],
                    "after": row["status"],
                    "reason": row["reason"],
                    "length_m": row["length_m"],
                }
            )
    before, after = qualify_inventory(old), qualify_inventory(pack)
    for label, coverage in [("prior", before), ("new", after)]:
        if not coverage["accounting_complete"]:
            raise ValueError(f"{label} source accounting is incomplete")
    _same({k: baseline["coverage.json"][k] for k in before}, before, "prior source coverage")
    _same(after["eligible_length_m"], before["eligible_length_m"], "eligible denominator")
    # Only the projection needs the retained source metadata. Never alter the
    # recorded graph to add it: that would change the full fleet run's identity.
    gaps = district_gap_inventory(
        {**pack, "source": old["source"]}, shape(geometry["boundary"]), geometry["districts"]
    )
    checklist = {
        "schema": "fleetlab.temporal-map-review-checklist/1.0.0",
        "status": "NOT_RUN",
        "review_results": [],
        "restored_ways": [r for r in transitions if r["after"] == "included"],
        "newly_blocked_ways": [r for r in transitions if r["before"] == "included"],
        "unsupported_ways": [r["id"] for r in pack["inventory"] if r["status"] == "unsupported"],
        "static_restriction_exceptions": [
            r for r in pack["restriction_audit"] if r["status"] == "BLOCKED"
        ],
        "temporal_source_audit": pack["temporal"]["audit"],
        "timed_turns": [r["id"] for r in pack["temporal"]["turns"]],
        "timed_access_ways": [r["way"] for r in pack["temporal"]["access"]],
        "access_nodes": sorted(pack["temporal"]["node_source"]),
        "district_gap_way_ids": [r["source_way_id"] for r in gaps["records"]],
        "instructions": [
            "New candidate: prior map observations do not transfer automatically.",
            "Inspect actual-time access, direction and continuity at pickup/depot stops.",
            "Retain unsupported features and no-route outcomes; do not infer road permission.",
            "Independent human observations are required; this generated checklist supplies none.",
        ],
    }
    report = {
        "schema": SCHEMA,
        "city": pack["city"],
        "status": "HOLD",
        "scope": "SIMULATION_ONLY",
        "authenticity": "NOT_AUTHENTICATED",
        "decision_authority": "NONE",
        "recommendation_eligible": False,
        "baseline_pack_id": old["pack_id"],
        "candidate_pack_id": pack["pack_id"],
        "baseline_bundle_digest": baseline["manifest.json"]["content_digest"],
        "baseline_graph_digest": digest(old),
        "candidate_graph_digest": digest(pack),
        "sources_unchanged": True,
        "geography_unchanged": True,
        "source": old["source"],
        "routing_profile": pack["routing_profile"],
        "temporal_profile": pack["temporal"]["profile"],
        "before": before,
        "after": after,
        "way_transitions": transitions,
        "static_restriction_counts": dict(Counter(r["status"] for r in pack["restriction_audit"])),
        "timed_turn_count": len(pack["temporal"]["turns"]),
        "timed_access_count": len(pack["temporal"]["access"]),
        "district_gap_digest": digest(gaps),
        "district_gap_way_count": len(gaps["records"]),
        "district_gap_length_m": gaps["total_gap_length_m"],
        "gates": {
            "source_accounting": "PASS",
            "routing_support": "PASS" if after["routing_support_pass"] else "HOLD",
            "district_policy": "HOLD",
            "independent_map_review": "NOT_RUN",
            "fleet_evidence": "SEPARATE_ARTIFACT",
        },
        "limitations": [
            "Source-supported map candidate; current physical road access is not established.",
            "Unsupported syntax remains blocked; district gaps remain UNASSIGNED.",
            "Original recorded comparisons retain their original graph and model.",
            "Packaging does not execute a fleet, qualify a scenario or authenticate a reviewer.",
        ],
    }
    return {
        "graph.json": pack,
        "geometry.json": geometry,
        "coverage.json": after,
        "roads.geo.json": project_roads(pack),
        "district-gaps.json": gaps,
        "source-inventory.json": baseline["source-inventory.json"],
        "qualification-report.json": report,
        "human-review-checklist.json": checklist,
    }


def validate(baseline, candidate):
    try:
        for key, value in {
            "schema": "fleetlab.city-pack/1.0.0",
            "metadata": BUNDLE_METADATA,
            "scope": "SIMULATION_ONLY",
            "evidence": "NOT_EVIDENCE",
            "authenticity": "NOT_AUTHENTICATED",
            "decision_authority": "NONE",
        }.items():
            _same(candidate["manifest.json"][key], value, f"manifest {key}")
        expected = derive(baseline, candidate["graph.json"])
        _same(sorted(set(candidate) - {"manifest.json"}), sorted(expected), "member names")
        for name, value in expected.items():
            _same(candidate[name], value, name)
        return {
            "pass": True,
            "candidate_graph_digest": digest(candidate["graph.json"]),
            "qualification": "HOLD",
        }
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("incomplete temporal candidate bundle") from exc


def write(out, baseline, pack):
    files = derive(baseline, pack)
    return write_bundle(
        out,
        "fleetlab.city-pack/1.0.0",
        files,
        BUNDLE_METADATA,
    )
