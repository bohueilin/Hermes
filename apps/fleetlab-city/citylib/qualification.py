"""Candidate qualification artifacts: explicit changes, exact gaps, and review work."""

from collections import Counter

from pyproj import Transformer
from shapely.geometry import LineString, mapping, shape
from shapely.ops import transform, unary_union

from .contracts import digest, read_bundle

RESEARCH = [
    {
        "title": "OpenStreetMap restriction relation specification",
        "url": "https://wiki.openstreetmap.org/wiki/Relation:restriction",
    },
    {
        "title": "OSRM edge-expanded graph representation",
        "url": "https://github.com/Project-OSRM/osrm-backend/wiki/Graph-representation",
    },
    {
        "title": "DataSF Supervisor Districts 2022",
        "url": "https://data.sfgov.org/api/views/f2zs-jevy",
    },
]


def district_gap_inventory(pack, boundary, districts):
    project = Transformer.from_crs("EPSG:4326", "EPSG:32610", always_xy=True).transform
    inverse = Transformer.from_crs("EPSG:32610", "EPSG:4326", always_xy=True).transform
    polygons = [
        (f["properties"]["sup_dist"], transform(project, shape(f["geometry"])))
        for f in districts["features"]
    ]
    union = unary_union([p for _, p in polygons])
    records = []
    for r in pack["inventory"]:
        if not r["eligible"] or r["scope"] in {"buffer", "outside-buffer"}:
            continue
        coords = [pack["nodes"][n] for n in r["source_nodes"] if n in pack["nodes"]]
        if len(coords) < 2:
            continue
        cityline = transform(project, LineString(coords).intersection(boundary))
        gap = cityline.difference(union)
        if gap.is_empty or gap.length <= 0.001:
            continue
        nearest = sorted(
            ({"district": d, "distance_m": gap.distance(p)} for d, p in polygons),
            key=lambda v: (v["distance_m"], str(v["district"])),
        )[:3]
        records.append(
            {
                "source_way_id": r["id"],
                "name": r["name"],
                "class": r["class"],
                "status": r["status"],
                "gap_length_m": gap.length,
                "reported_unassigned_m": r["district_lengths_m"].get("UNASSIGNED", 0),
                "reason": "Road portion lies outside frozen official district polygons",
                "district_assignment": "UNASSIGNED",
                "nearest_districts_not_assignments": nearest,
                "geometry": mapping(transform(inverse, gap)),
                "source_url": f"https://www.openstreetmap.org/way/{r['id']}",
            }
        )
    return {
        "schema": "fleetlab.district-gap-inventory/1.0.0",
        "method": "Exact projected line difference, EPSG:32610; no snapping or nearest assignment",
        "source_sha256": pack["source"]["districts_sha256"],
        "records": records,
        "total_gap_length_m": sum(r["gap_length_m"] for r in records),
        "note": "Includes small gaps omitted by original tolerance. Uses polygon union.",
    }


def candidate_report(pack, coverage, source, boundary, districts, config, root):
    baseline = read_bundle(root / config["baseline_pack_path"])
    previous = baseline["coverage.json"]
    gaps = district_gap_inventory(pack, boundary, districts)
    restrictions = {r["id"]: r for r in source["restrictions"]}
    exceptions = []
    for audit in pack["restriction_audit"]:
        if audit["status"] == "BLOCKED":
            rule = restrictions[audit["id"]]
            exceptions.append(
                {
                    **audit,
                    "relation": rule,
                    "source_url": f"https://www.openstreetmap.org/relation/{audit['id']}",
                }
            )
    transitions = []
    old_inventory = {r["id"]: r for r in baseline["graph.json"]["inventory"]}
    for r in pack["inventory"]:
        old = old_inventory[r["id"]]
        if old["status"] != r["status"]:
            transitions.append(
                {
                    "source_way_id": r["id"],
                    "class": r["class"],
                    "name": r["name"],
                    "before": old["status"],
                    "after": r["status"],
                    "length_m": r["length_m"],
                }
            )
    checks = [
        {
            "id": "routing-support",
            "status": "PASS" if coverage["routing_support_pass"] else "HOLD",
            "reason": "Unchanged 2% overall / 5% each class and district; full district assignment",
        },
        {
            "id": "district-policy",
            "status": "HOLD",
            "reason": "Geometry stays UNASSIGNED pending official boundary reconciliation",
        },
        {
            "id": "semantic-map-review",
            "status": "NOT_RUN",
            "reason": "Human topology, legal-access, geometry and turn-direction review required",
        },
        {
            "id": "fleet-leg-continuity",
            "status": "NOT_RUN",
            "reason": "Map-only candidate. Fleet experiments require turn history across trip legs",
        },
    ]
    report = {
        "schema": "fleetlab.map-qualification-candidate/1.0.0",
        "city": "San Francisco",
        "baseline_pack_id": baseline["graph.json"]["pack_id"],
        "candidate_pack_id": pack["pack_id"],
        "routing_profile": pack["routing_profile"],
        "status": "HOLD",
        "scope": "SIMULATION_ONLY",
        "evidence": "NOT_EVIDENCE",
        "baseline_pack_digest": baseline["manifest.json"]["content_digest"],
        "candidate_graph_digest": digest({k: pack[k] for k in ("nodes", "edges", "turns")}),
        "sources_unchanged": pack["source"]["osm_sha256"]
        == baseline["graph.json"]["source"]["osm_sha256"],
        "before": {
            k: previous[k]
            for k in (
                "dispositions",
                "unsupported_fraction",
                "unsupported_length_m",
                "by_class",
                "by_district",
            )
        },
        "after": {
            k: coverage[k]
            for k in (
                "dispositions",
                "unsupported_fraction",
                "unsupported_length_m",
                "by_class",
                "by_district",
            )
        },
        "restriction_counts": dict(Counter(r["status"] for r in pack["restriction_audit"])),
        "restriction_exceptions": exceptions,
        "way_transitions": transitions,
        "district_gap_summary": {k: v for k, v in gaps.items() if k != "records"},
        "district_gap_way_count": len(gaps["records"]),
        "gates": checks,
        "research": RESEARCH,
        "limitations": [
            "No live navigation, legal-access or real-world completeness claim",
            "Only unique connectors and simple ordered 1–8 via-way chains supported",
            "Conditional, unknown, malformed and ambiguous restrictions remain blocked",
            "Independent validator shares compiled graph; not independent source truth",
            "Original sf-v1 experiment continues to reference its own frozen graph",
        ],
    }
    checklist = {
        "schema": "fleetlab.map-human-review/1.0.0",
        "status": "NOT_RUN",
        "instructions": [
            "Review source relation members against direction and connectivity",
            "Inspect restored major-class roads before accepting threshold change",
            "Resolve official district boundary mismatch without guessed assignments",
            "Record reviewer, date, exact source references and pass/fail rationale",
        ],
        "restriction_exceptions": exceptions,
        "restored_ways": [r for r in transitions if r["after"] == "included"],
        "district_gap_way_ids": [r["source_way_id"] for r in gaps["records"]],
        "review_results": [],
    }
    return {
        "qualification-report.json": report,
        "district-gaps.json": gaps,
        "human-review-checklist.json": checklist,
    }
