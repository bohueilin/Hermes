"""Exact, immutable administrative reporting; no route or scenario modification."""

import ctypes
import itertools
import math
import os
import re
import shutil
import stat
import sys
import tempfile
from collections import Counter
from pathlib import Path

import pyproj
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform, unary_union

from .contracts import canonical, decode, digest, finite, read_bytes, sha
from .review_workspace_v1 import candidate_identity

SCHEMA = "fleetlab.administrative-proposal/1.0.0"
TRUST = {
    "scope": "SIMULATION_ONLY",
    "authenticity": "NOT_AUTHENTICATED",
    "decision_authority": "NONE",
    "qualification": "HOLD",
    "adoption": "PROPOSED",
}
POLICY = {
    "schema": "fleetlab.administrative-policy/1.0.0",
    "crs": "EPSG:32610",
    "district_ids": [str(i) for i in range(1, 12)],
    "district_property": "DISTRICT",
    "snap_m": 0,
    "area_overlap_max_m2": 1e-6,
    "review_display_threshold_m": 0.001,
    "geometry": "Clip each source segment in EPSG:4326, then project; retain multiplicity",
    "partition": ["exclusive_m", "shared_m", "outside_districts_m"],
    "district_membership": "Includes shared boundaries in each district; not additive",
    "population": "Preserve full tape; covers includes boundary points; no node reassignment",
    "denominator": "Frozen graph length; projected geometry is a separate measurement",
}
MEMBERS = {
    "policy.json",
    "provenance.json",
    "districts.geo.json",
    "accounting.json",
    "population.json",
    "requirements.json",
    "report.json",
}


def _same(actual, expected, label):
    if digest(actual) != digest(expected):
        raise ValueError(f"administrative proposal {label} mismatch")


def _ids(rows, label, key="id"):
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"missing {label}")
    ids = [r[key] for r in rows]
    if any(not isinstance(x, str) or not x for x in ids) or len(ids) != len(set(ids)):
        raise ValueError(f"invalid or duplicate {label} IDs")
    return ids


def _point(nodes, key):
    point = nodes[key]
    if not isinstance(point, list) or len(point) != 2:
        raise ValueError("invalid coordinate")
    finite(point[0], -180, 180)
    finite(point[1], -90, 90)
    return point


def _polygon(value):
    result = shape(value)
    if (
        result.geom_type not in {"Polygon", "MultiPolygon"}
        or result.is_empty
        or not result.is_valid
    ):
        raise ValueError("invalid administrative polygon")
    if not all(math.isfinite(x) for x in result.bounds):
        raise ValueError("nonfinite polygon bounds")
    left, bottom, right, top = result.bounds
    if not (-180 <= left <= right <= 180 and -90 <= bottom <= top <= 90):
        raise ValueError("administrative geometry must use longitude/latitude")
    return result


def _districts(raw, provenance, project):
    if provenance["schema"] != "fleetlab.administrative-source/1.0.0":
        raise ValueError("unsupported source provenance")
    _same(sha(raw), provenance["raw_sha256"], "raw district source")
    if provenance["license_status"] != "NOT_ESTABLISHED":
        raise ValueError("v1 proposal cannot establish redistribution permission")
    for field in ("source_url", "captured_at", "context"):
        if not isinstance(provenance[field], str) or not provenance[field].strip():
            raise ValueError("missing source provenance")
    if not provenance["source_url"].startswith("https://") or not provenance["chain"]:
        raise ValueError("missing official-source chain")
    for item in provenance["chain"]:
        if not item["url"].startswith("https://") or not re.fullmatch(
            "[a-f0-9]{64}", item["sha256"]
        ):
            raise ValueError("invalid source-chain reference")
    geo = decode(raw)
    if geo["type"] != "FeatureCollection":
        raise ValueError("expected district FeatureCollection")
    # RFC 7946 coordinates; legacy named CRS84 is also the captured ArcGIS output.
    crs = geo.get("crs")
    if crs is not None and crs not in [
        {"type": "name", "properties": {"name": name}}
        for name in ("urn:ogc:def:crs:OGC:1.3:CRS84", "EPSG:4326")
    ]:
        raise ValueError("unsupported district coordinate reference system")
    polygons = {}
    for feature in geo["features"]:
        key = feature["properties"]["DISTRICT"]
        if key not in POLICY["district_ids"] or key in polygons:
            raise ValueError("invalid or duplicate district ID")
        polygons[key] = transform(project, _polygon(feature["geometry"]))
        if not polygons[key].is_valid:
            raise ValueError("projection produced invalid district")
    _same(sorted(polygons), sorted(POLICY["district_ids"]), "eleven district population")
    intersections = []
    overlaps = []
    for (a, pa), (b, pb) in itertools.combinations(sorted(polygons.items()), 2):
        both = pa.intersection(pb)
        if both.area > POLICY["area_overlap_max_m2"]:
            raise ValueError(f"district interiors overlap: {a}, {b}")
        if both.area > 0:
            overlaps.append({"a": a, "b": b, "m2": both.area})
        if not both.is_empty:
            intersections.append(both)
    return geo, polygons, unary_union(list(polygons.values())), unary_union(intersections), overlaps


def _candidate(candidate):
    manifest = candidate["manifest.json"]
    _same(
        manifest["content_digest"],
        digest({k: v for k, v in manifest.items() if k != "content_digest"}),
        "candidate manifest",
    )
    _same(set_as_list(candidate, "manifest.json"), sorted(manifest["files"]), "candidate members")
    for name, record in manifest["files"].items():
        data = canonical(candidate[name]) + b"\n"
        _same({"sha256": sha(data), "bytes": len(data)}, record, f"candidate {name}")
    graph = candidate["graph.json"]
    _same(
        digest(graph),
        candidate["qualification-report.json"]["candidate_graph_digest"],
        "candidate graph",
    )
    ids = _ids(graph["inventory"], "source inventory")
    _same(sorted(ids), sorted(graph["candidate_ids"]), "complete graph IDs")
    _same(
        sorted(ids),
        sorted(candidate["source-inventory.json"]["candidate_ids"]),
        "complete source IDs",
    )
    _same(graph["source_inventory_digest"], digest(sorted(ids)), "source ID inventory")
    return graph


def set_as_list(value, exclude):
    return sorted(k for k in value if k != exclude)


def _account(graph, boundary, polygons, union, shared, project):
    roads, totals = [], Counter()
    by_district = {d: Counter() for d in sorted(polygons)}
    for row in sorted(graph["inventory"], key=lambda r: r["id"]):
        if not isinstance(row["eligible"], bool):
            raise ValueError("source eligibility is not boolean")
        if not row["eligible"]:
            continue
        finite(row["length_m"], 0)
        if row["scope"] not in {"city", "boundary-crossing", "buffer", "outside-buffer"}:
            raise ValueError("unknown captured source scope")
        if row["status"] not in {"included", "unsupported", "excluded", "quarantined"}:
            raise ValueError("unknown captured routing status")
        if len(row["source_nodes"]) < 2:
            raise ValueError("eligible road has incomplete geometry")
        coords = [_point(graph["nodes"], n) for n in row["source_nodes"]]
        sums, membership = Counter(), Counter()
        # Segmentwise clipping keeps repeated traversals, unlike GEOS line union.
        for a, b in itertools.pairwise(coords):
            segment = LineString([a, b])
            city = transform(project, segment.intersection(boundary))
            outside = transform(project, segment.difference(boundary))
            sums["outside_municipality_m"] += outside.length
            sums["municipal_m"] += city.length
            shared_part = city.intersection(shared)
            sums["shared_m"] += shared_part.length
            sums["outside_districts_m"] += city.difference(union).length
            sums["exclusive_m"] += city.intersection(union).difference(shared).length
            for district, poly in polygons.items():
                if poly.intersects(city):
                    length = city.intersection(poly).length
                    if length > 0:
                        membership[district] += length
        partition = math.fsum(sums[k] for k in POLICY["partition"])
        if not math.isclose(partition, sums["municipal_m"], abs_tol=1e-6, rel_tol=1e-10):
            raise ValueError(f"nonconserved municipal partition: {row['id']}")
        for key, length in sums.items():
            totals[key] += length
        totals["all_eligible_source_length_m"] += row["length_m"]
        if row["scope"] not in {"buffer", "outside-buffer"}:
            totals["frozen_eligible_length_m"] += row["length_m"]
        for district, length in membership.items():
            by_district[district]["membership_m"] += length
            if row["status"] in {"unsupported", "quarantined"}:
                by_district[district]["unsupported_m"] += length
        roads.append(
            {
                "source_way_id": row["id"],
                "name": row["name"],
                "class": row["class"],
                "captured_scope": row["scope"],
                "routing_status": row["status"],
                "frozen_length_m": row["length_m"],
                **dict(sums),
                "district_membership_m": dict(sorted(membership.items())),
            }
        )
    if not roads:
        raise ValueError("no eligible source roads")
    for values in by_district.values():
        values.setdefault("membership_m", 0.0)
        values.setdefault("unsupported_m", 0.0)
        values["unsupported_fraction"] = (
            values["unsupported_m"] / values["membership_m"] if values["membership_m"] else None
        )
    return {
        "roads": roads,
        "totals": dict(totals),
        "by_district": by_district,
        "source_count": len(graph["inventory"]),
        "eligible_source_count": len(roads),
        "excluded_source_count": len(graph["inventory"]) - len(roads),
        "district_membership_is_additive": False,
    }


def _population(graph, tape, boundary, polygons, union, project):
    pool = tape["node_pool"]
    if not isinstance(pool, list) or not pool or len(set(pool)) != len(pool):
        raise ValueError("missing or duplicate frozen node pool")
    _ids(tape["requests"], "request")
    _ids(tape["initial"], "initial vehicle")
    population = set(pool)
    for request in tape["requests"]:
        if request["origin"] not in population or request["destination"] not in population:
            raise ValueError("request endpoint absent from frozen pool")
    all_nodes = population | {r["node"] for r in tape["initial"]}
    membership = {}
    for node in sorted(all_nodes):
        original = Point(_point(graph["nodes"], node))
        point = transform(project, original)
        membership[node] = {
            "node": node,
            "in_pool": node in population,
            "old_municipality": bool(boundary.covers(original)),
            "proposed_union": bool(union.covers(point)),
            "districts": sorted(d for d, p in polygons.items() if p.covers(point)),
        }
    changed = {n for n, m in membership.items() if m["old_municipality"] != m["proposed_union"]}
    outside = {n for n, m in membership.items() if not m["proposed_union"]}
    requests = []
    for r in tape["requests"]:
        a, b = membership[r["origin"]], membership[r["destination"]]
        requests.append(
            {
                "id": r["id"],
                "origin": r["origin"],
                "destination": r["destination"],
                "old_both_inside": a["old_municipality"] and b["old_municipality"],
                "proposed_both_inside": a["proposed_union"] and b["proposed_union"],
                "membership_changed": r["origin"] in changed or r["destination"] in changed,
            }
        )
    return {
        "counts": {"pool": len(pool), "requests": len(requests), "initial": len(tape["initial"])},
        "nodes": list(membership.values()),
        "requests": requests,
        "initial": [
            {"id": r["id"], "node": r["node"], "membership_changed": r["node"] in changed}
            for r in tape["initial"]
        ],
        "changed_pool_nodes": sorted(changed & population),
        "affected_request_ids": sorted(r["id"] for r in requests if r["membership_changed"]),
        "affected_initial_ids": sorted(r["id"] for r in tape["initial"] if r["node"] in changed),
        "outside_proposed_pool_nodes": sorted(outside & population),
        "outside_proposed_request_ids": sorted(
            r["id"] for r in requests if not r["proposed_both_inside"]
        ),
        "requests_changing_both_inside": sorted(
            r["id"] for r in requests if r["old_both_inside"] != r["proposed_both_inside"]
        ),
    }


def derive(candidate, raw, provenance, tape):
    """Recompute a proposal from explicitly captured inputs, without mutations."""
    try:
        return _derive(candidate, raw, provenance, tape)
    except (KeyError, TypeError, AttributeError, IndexError) as exc:
        raise ValueError("incomplete administrative proposal inputs") from exc


def _derive(candidate, raw, provenance, tape):
    graph = _candidate(candidate)
    project = Transformer.from_crs(4326, 32610, always_xy=True).transform
    geo, polygons, union, shared, overlaps = _districts(raw, provenance, project)
    boundary = _polygon(candidate["geometry.json"]["boundary"])
    accounting = _account(graph, boundary, polygons, union, shared, project)
    population = _population(graph, tape, boundary, polygons, union, project)
    identity = {
        "candidate": candidate_identity(candidate),
        "district_raw_sha256": sha(raw),
        "district_geometry_digest": digest(geo),
        "boundary_digest": digest(candidate["geometry.json"]["boundary"]),
        "provenance_digest": digest(provenance),
        "policy_digest": digest(POLICY),
        "input_tape_digest": digest(tape),
    }
    obligations = [
        {"id": "source-redistribution", "kind": "SOURCE_TERMS", "status": "NOT_REVIEWED"},
        {"id": "administrative-adoption", "kind": "SCOPE_DECISION", "status": "NOT_REVIEWED"},
    ]
    for row in accounting["roads"]:
        for key in ("outside_districts_m", "shared_m"):
            if row[key] > 0:
                obligations.append(
                    {
                        "id": f"{key}-{row['source_way_id']}",
                        "kind": key,
                        "source_way_id": row["source_way_id"],
                        "length_m": row[key],
                        "above_display_threshold": row[key] > POLICY["review_display_threshold_m"],
                        "status": "NOT_REVIEWED",
                    }
                )
    for node in population["nodes"]:
        if node["old_municipality"] != node["proposed_union"]:
            obligations.append(
                {
                    "id": f"population-{node['node']}",
                    "kind": "POPULATION_MEMBERSHIP",
                    "node": node["node"],
                    "status": "NOT_REVIEWED",
                }
            )
    requirements = {"identity": identity, "obligations": obligations, "observations": []}
    report = {
        "schema": SCHEMA,
        **TRUST,
        "identity": identity,
        "accounting_pass": True,
        "human_observations": 0,
        "license_status": "NOT_ESTABLISHED",
        "graph_changed": False,
        "tape_changed": False,
        "routing_qualification_changed": False,
        "requirements_digest": digest(requirements),
        "accounting_digest": digest(accounting),
        "population_digest": digest(population),
        "subthreshold_polygon_overlaps": overlaps,
        "runtime": {
            "shapely": shapely.__version__,
            "geos": shapely.geos_version_string,
            "pyproj": pyproj.__version__,
            "proj": pyproj.proj_version_str,
        },
        "limitations": [
            "Computational accounting is not source qualification or a human review.",
            "Unknown redistribution basis: retain full geometry locally.",
            "No route, recorded request or existing source denominator changed.",
        ],
    }
    return {
        "policy.json": decode(canonical(POLICY)),
        "provenance.json": decode(canonical(provenance)),
        "districts.geo.json": geo,
        "accounting.json": accounting,
        "population.json": population,
        "requirements.json": requirements,
        "report.json": report,
    }


def validate(files, candidate, raw, provenance, tape):
    expected = derive(candidate, raw, provenance, tape)
    _same(sorted(files), sorted(expected), "member inventory")
    for name, value in expected.items():
        _same(files[name], value, name)
    return {
        "pass": True,
        "status": "INTERNALLY_CONSISTENT",
        **TRUST,
        "report_digest": digest(expected["report.json"]),
    }


def _path(path):
    path = Path(path).absolute()
    if ".." in path.parts:
        raise ValueError("parent traversal refused; supply a normalized path")
    if any(p.is_symlink() for p in [path, *path.parents]):
        raise ValueError("symlink refused")
    return path


def directory_snapshot(path):
    """Bind complete names, no-follow members and the original directory inode."""
    path = _path(path)
    fields = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")

    def stamp(p, directory=False):
        info = p.lstat()
        if not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
            raise ValueError("snapshot requires a directory with regular files only")
        return tuple(getattr(info, field) for field in fields)

    return {
        "directory": stamp(path, True),
        "members": {p.name: stamp(p) for p in sorted(path.iterdir())},
    }


def publish_noreplace(staged, destination):
    """Atomic directory publication with no check/rename overwrite window."""
    library = ctypes.CDLL(None, use_errno=True)
    if sys.platform == "darwin":
        rename = library.renamex_np
        rename.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
        args = (os.fsencode(staged), os.fsencode(destination), 0x4)  # RENAME_EXCL
    elif sys.platform.startswith("linux") and hasattr(library, "renameat2"):
        rename = library.renameat2
        rename.argtypes = [
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_uint,
        ]
        args = (-100, os.fsencode(staged), -100, os.fsencode(destination), 1)  # NOREPLACE
    else:
        raise ValueError("atomic no-replace directory publication unavailable on this host")
    rename.restype = ctypes.c_int
    if rename(*args) != 0:
        number = ctypes.get_errno()
        raise OSError(number, os.strerror(number), str(destination))


def write(out, files):
    """Create a complete new directory; never replace an existing proposal."""
    out = _path(out)
    if out.exists():
        raise FileExistsError("proposal exists; preserve it and choose a new version")
    if set(files) != MEMBERS:
        raise ValueError("incorrect administrative member inventory")
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".administrative-", dir=out.parent))
    try:
        inventory = {}
        for name, value in sorted(files.items()):
            data = canonical(value) + b"\n"
            (temporary / name).write_bytes(data)
            inventory[name] = {"sha256": sha(data), "bytes": len(data)}
        manifest = {"schema": SCHEMA, **TRUST, "files": inventory}
        manifest["content_digest"] = digest(manifest)
        (temporary / "manifest.json").write_bytes(canonical(manifest) + b"\n")
        publish_noreplace(temporary, out)
        return manifest
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def read(out):
    out = _path(out)
    before = directory_snapshot(out)
    first = read_bytes(out / "manifest.json", 1024 * 1024)
    manifest = decode(first)
    _same(
        manifest["content_digest"],
        digest({k: v for k, v in manifest.items() if k != "content_digest"}),
        "manifest digest",
    )
    _same({k: manifest[k] for k in TRUST}, TRUST, "manifest trust")
    _same(manifest["schema"], SCHEMA, "manifest schema")
    _same(sorted(manifest["files"]), sorted(MEMBERS), "manifest inventory")
    _same(
        sorted(p.name for p in out.iterdir()),
        sorted(MEMBERS | {"manifest.json"}),
        "directory inventory",
    )
    files = {}
    for name, record in manifest["files"].items():
        data = read_bytes(out / name)
        _same({"sha256": sha(data), "bytes": len(data)}, record, f"member {name}")
        files[name] = decode(data)
    if read_bytes(out / "manifest.json") != first or directory_snapshot(out) != before:
        raise ValueError("proposal changed during capture")
    return files
