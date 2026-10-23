"""Frozen OSM + official DataSF district import; every source highway is inventoried."""

import random
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, box, mapping, shape
from shapely.ops import polygonize, transform, unary_union

from .contracts import digest, load_json, read_bytes, sha, write_bundle
from .pack import build_graph, distance, qualify_inventory
from .road_projection import project_roads


def parse_osm(data, routing_profile="node-via/1.0.0"):
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("XML declarations refused")
    root = ET.fromstring(data)
    if root.find("remark") is not None:
        raise ValueError("Overpass returned a partial/error response")
    nodes = {}
    node_tags = {}
    ways = {}
    restrictions = []
    boundary_members = []
    for e in root:
        tags = {t.attrib["k"]: t.attrib["v"] for t in e.findall("tag")}
        if e.tag == "node":
            nodes[e.attrib["id"]] = [float(e.attrib["lon"]), float(e.attrib["lat"])]
            if tags:
                node_tags[e.attrib["id"]] = tags
        elif e.tag == "way":
            ways[e.attrib["id"]] = {
                "id": e.attrib["id"],
                "nodes": [n.attrib["ref"] for n in e.findall("nd")],
                "tags": tags,
            }
        elif e.tag == "relation":
            members = [dict(m.attrib) for m in e.findall("member")]
            if e.attrib["id"] == "111968":
                boundary_members = members
            if tags.get("type") != "restriction":
                continue
            kind = next(
                (
                    tags[k]
                    for k in ("restriction:motorcar", "restriction:motor_vehicle", "restriction")
                    if k in tags
                ),
                None,
            )
            if (
                not kind
                and routing_profile == "edge-sequence/2.0.0"
                and any(
                    k in tags
                    for k in (
                        "restriction:conditional",
                        "restriction:motorcar:conditional",
                        "restriction:motor_vehicle:conditional",
                    )
                )
            ):
                kind = "UNSUPPORTED_CONDITIONAL"
            if not kind:
                continue  # exclusively other-mode relation, retained in original XML
            fm = [m["ref"] for m in members if m["role"] == "from" and m["type"] == "way"]
            to = [m["ref"] for m in members if m["role"] == "to" and m["type"] == "way"]
            via = [m["ref"] for m in members if m["role"] == "via" and m["type"] == "node"]
            vw = [m["ref"] for m in members if m["role"] == "via" and m["type"] == "way"]
            for f in fm or [None]:
                restrictions.append(
                    {
                        "id": e.attrib["id"],
                        "from": f,
                        "to": to[0] if len(to) == 1 else None,
                        "via": via[0] if len(via) == 1 else None,
                        "via_way": vw,
                        "kind": kind,
                        "conditional": any("conditional" in k for k in tags),
                        "except_motorcar": bool(
                            set(tags.get("except", "").split(";"))
                            & {"motorcar", "motor_vehicle", "vehicle"}
                        ),
                    }
                )
            if routing_profile == "edge-sequence/2.0.0":
                malformed = (
                    len(fm) != 1
                    or len(to) != 1
                    or not ((len(via) == 1 and not vw) or (vw and not via))
                )
                for rule in restrictions[-max(1, len(fm)) :]:
                    rule["malformed"] = bool(malformed)
    meta = root.find("meta")
    return {
        "nodes": nodes,
        "node_tags": node_tags,
        "all_ways": ways,
        "ways": [w for w in ways.values() if "highway" in w["tags"]],
        "restrictions": restrictions,
        "boundary_members": boundary_members,
        "osm_base": meta.attrib.get("osm_base") if meta is not None else None,
    }


def boundary_polygon(source):
    outer = []
    inner = []
    for m in source["boundary_members"]:
        if m.get("type", "way") != "way":
            continue
        w = source["all_ways"].get(m["ref"])
        if not w:
            raise ValueError("missing boundary member")
        coords = [source["nodes"][n] for n in w["nodes"]]
        (inner if m["role"] == "inner" else outer).append(LineString(coords))
    polygons = list(polygonize(outer))
    if not polygons:
        raise ValueError("boundary does not close")
    result = unary_union(polygons)
    if inner:
        result = result.difference(unary_union(list(polygonize(inner))))
    if not result.is_valid:
        raise ValueError("invalid municipal boundary")
    return result


def classify_scope(coords, boundary):
    line = LineString(coords)
    if boundary.covers(line):
        return "city"
    if boundary.intersects(line):
        return "boundary-crossing"
    return "buffer"


def import_sf(config, root):
    root = Path(root)
    source_dir = root / config["source_dir"]
    raw = read_bytes(source_dir / "sf.osm.xml", 150_000_000)
    if sha(raw) != config["osm_sha256"]:
        raise ValueError("source digest mismatch")
    db = read_bytes(source_dir / "districts.json")
    if sha(db) != config["districts_sha256"]:
        raise ValueError("district digest mismatch")
    routing_profile = config.get("routing_profile", "node-via/1.0.0")
    source = parse_osm(raw, routing_profile=routing_profile)
    boundary = boundary_polygon(source)
    districts = load_json(source_dir / "districts.json")
    forward = Transformer.from_crs("EPSG:4326", "EPSG:32610", always_xy=True)
    reverse = Transformer.from_crs("EPSG:32610", "EPSG:4326", always_xy=True)
    district_polys = [
        (f["properties"]["sup_dist"], transform(forward.transform, shape(f["geometry"])))
        for f in districts["features"]
    ]
    routing_buffer = box(*config["routing_buffer_bbox"])
    # This witness is computed directly from raw source records, before profile/support filtering.
    witness = {
        "source_sha256": sha(raw),
        "candidate_ids": sorted(w["id"] for w in source["ways"]),
        "definition": (
            "Every highway-tagged way in frozen source response, including "
            "recursive relation dependencies."
        ),
    }
    for w in source["ways"]:
        coords = [source["nodes"][n] for n in w["nodes"] if n in source["nodes"]]
        if len(coords) < 2:
            continue
        line = LineString(coords)
        w["scope"] = classify_scope(coords, boundary)
        if w["scope"] == "buffer" and not routing_buffer.intersects(line):
            w["scope"] = "outside-buffer"
        projected = transform(forward.transform, line)
        # Clip district report to the municipal portion, retaining outside road geometry explicitly.
        cityline = transform(forward.transform, line.intersection(boundary))
        dl = {
            did: cityline.intersection(poly).length
            for did, poly in district_polys
            if poly.intersects(projected)
        }
        dl = {k: v for k, v in dl.items() if v > 0.001}
        known = sum(dl.values())
        missing = cityline.length - known
        if missing > 1:
            dl["UNASSIGNED"] = missing
        w["district_lengths_m"] = dl
        if w["scope"] == "outside-buffer":
            w["force_exclude"] = "outside declared city and routing buffer"
    pack = build_graph(source, routing_profile=routing_profile)
    if pack["candidate_ids"] != witness["candidate_ids"]:
        raise ValueError("source witness mismatch")
    # Geometry retained once; inventories carry IDs, never a different simplified routing network.
    used = {n for w in source["ways"] for n in w["nodes"]}
    pack["nodes"] = {k: v for k, v in pack["nodes"].items() if k in used}
    pack["city"] = "San Francisco"
    pack["timezone"] = "America/Los_Angeles"
    pack["pack_id"] = config.get("pack_id", "sf-v1")
    pack["source"] = {
        "osm_base": source["osm_base"],
        "osm_sha256": sha(raw),
        "districts_sha256": sha(db),
        "boundary_relation": "111968",
        "boundary_sha256": digest(mapping(boundary)),
        "licenses": ["ODbL-1.0", "CC0-1.0"],
        "attribution": "© OpenStreetMap contributors; DataSF Supervisor Districts (2022)",
        "urls": config["source_urls"],
    }
    pack["coordinates"] = {
        "source_crs": "EPSG:4326",
        "horizontal_datum": "WGS84",
        "vertical_datum": "NOT_AVAILABLE",
        "analysis_crs": "EPSG:32610",
        "units": "metres",
        "origin": [-122.4194, 37.7749],
    }
    controls = [[-122.51, 37.71], [-122.40, 37.80], [-122.37, 37.82], [-123.0, 37.7]]
    errors = [distance(p, reverse.transform(*forward.transform(*p))) for p in controls]
    coverage = qualify_inventory(pack)
    coverage["coordinate_roundtrip"] = {
        "max_error_m": max(errors),
        "controls": controls,
        "pass": max(errors) <= 0.5,
    }
    coverage["scope_counts"] = dict(Counter(r["scope"] for r in pack["inventory"]))
    coverage["boundary_area_m2"] = transform(forward.transform, boundary).area
    coverage["source_inventory_witness_digest"] = digest(witness)
    # Deterministic independent source sample, stratified round-robin across district/class buckets.
    buckets = {}
    byid = {r["id"]: r for r in pack["inventory"]}
    for w in source["ways"]:
        r = byid[w["id"]]
        if r["scope"] == "outside-buffer":
            continue
        for district in r["district_lengths_m"] or ["UNASSIGNED"]:
            buckets.setdefault((district, r["class"]), []).append(w)
    checks = []
    rng = random.Random(529)
    for bucket in buckets.values():
        rng.shuffle(bucket)
    while len(checks) < 200 and any(buckets.values()):
        for key, bucket in sorted(buckets.items()):
            if not bucket or len(checks) >= 200:
                continue
            w = bucket.pop()
            r = byid[w["id"]]
            checks.append(
                {
                    "source_id": w["id"],
                    "district": key[0],
                    "class": key[1],
                    "source_nodes_match": r["source_nodes"] == w["nodes"],
                    "all_node_ids_available": all(n in source["nodes"] for n in w["nodes"]),
                    "status": r["status"],
                    "method": "automated source-ID audit; not human semantic inspection",
                }
            )
    coverage["source_checks"] = checks
    coverage["semantic_map_review"] = {
        "status": "NOT_RUN",
        "reason": "Independent human/topology-semantic inspection remains a qualification gate.",
    }
    # Display all city/buffer source roads, including unsupported/excluded ones.
    # Generalization is display-only.
    display = project_roads(pack)
    land = unary_union([shape(f["geometry"]) for f in districts["features"]])
    geometry = {"boundary": mapping(boundary), "land": mapping(land), "districts": districts}
    out = root / config["output"]
    files = {
        "graph.json": pack,
        "coverage.json": coverage,
        "source-inventory.json": witness,
        "roads.geo.json": display,
        "geometry.json": geometry,
        "import-config.json": config,
    }
    if routing_profile == "edge-sequence/2.0.0":
        from .qualification import candidate_report

        files.update(candidate_report(pack, coverage, source, boundary, districts, config, root))
    manifest = write_bundle(out, "fleetlab.city-pack/1.0.0", files, pack["source"])
    return {"manifest": manifest, "coverage": coverage, "output": str(out)}
