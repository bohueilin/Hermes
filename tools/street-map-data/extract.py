#!/usr/bin/env python3
"""Derive the frozen directed OSM teaching network. No invented connecting edges.

Fetch source with fetch.py first; regenerate with python3 tools/street-map-data/extract.py.
The JS facade expands compact tables without changing routing semantics.
"""

import collections
import hashlib
import heapq
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
CACHE = ROOT / "artifacts/street-map"
DEST = ROOT / "playground/fleetlab/src/data/sf-streets.js"
BOUNDS = [37.604, -122.475, 37.837, -122.267]
SPEEDS = {
    "motorway": 90,
    "motorway_link": 45,
    "trunk": 45,
    "trunk_link": 35,
    "primary": 40,
    "primary_link": 30,
    "secondary": 35,
    "secondary_link": 25,
    "tertiary": 30,
    "tertiary_link": 25,
    "residential": 25,
    "unclassified": 25,
}
ANCHORS = [
    ("fidi", "Financial District", -122.3991, 37.7905, "representative street node"),
    ("soma", "SoMa / 4th and Harrison", -122.4011, 37.7809, "representative street node"),
    ("chinatown", "Chinatown / Stockton", -122.4084, 37.7964, "representative street node"),
    ("van-ness", "Van Ness / Civic Center", -122.4210, 37.7821, "representative street node"),
    ("waterfront", "Ferry Building approach", -122.3937, 37.7949, "representative street node"),
    ("lombard", "Lombard / Russian Hill", -122.4197, 37.8021, "representative street node"),
    (
        "sfo",
        "SFO approach handoff",
        -122.4035,
        37.6365,
        "modeled airport approach handoff; not an official pickup curb",
    ),
    (
        "east-bay",
        "Oakland-side gateway",
        -122.2919,
        37.8042,
        "modeled Oakland street gateway; not a pickup curb",
    ),
    ("oracle", "Oracle Park approach", -122.3901, 37.7804, "representative street node"),
]
HOTSPOTS = [
    (
        "first",
        "1st / Bay Bridge approach",
        "1st Street from Market toward Harrison and the I-80 approach.",
        -122.3962,
        37.7882,
    ),
    (
        "harrison",
        "Harrison / Bryant / Essex / 4th",
        "Connected SoMa approach streets near the bridge ramps.",
        -122.3975,
        37.7844,
    ),
    (
        "stockton",
        "Stockton / tunnel / Chinatown",
        "Stockton from Post through the tunnel into Chinatown.",
        -122.4077,
        37.7923,
    ),
    (
        "van-ness",
        "Van Ness signal corridor",
        "Van Ness from Market toward Lombard; imported general-traffic carriageways.",
        -122.4227,
        37.7883,
    ),
    (
        "embarcadero",
        "Embarcadero / waterfront",
        "The Embarcadero from the Ferry Building toward Oracle Park.",
        -122.3899,
        37.7883,
    ),
    (
        "lombard",
        "Lombard / Russian Hill",
        "Lombard east of Van Ness, including the crooked block.",
        -122.4202,
        37.8019,
    ),
]


def project(lon, lat):
    return (
        (lon + 122.45) * math.pi / 180 * 6371.0088 * math.cos(math.radians(37.75)),
        (lat - 37.6) * math.pi / 180 * 6371.0088,
    )


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def simplify(points, tolerance=0.001):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    denom = dx * dx + dy * dy
    errors = []
    for p in points[1:-1]:
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom)) if denom else 0
        errors.append(distance(p, (a[0] + t * dx, a[1] + t * dy)))
    index = max(range(len(errors)), key=errors.__getitem__) + 1
    if errors[index - 1] <= tolerance:
        return [a, b]
    return simplify(points[: index + 1])[:-1] + simplify(points[index:])


def effective_access(tags, direction=None):
    suffix = ":" + direction if direction else ""
    for mode in ("motorcar", "motor_vehicle", "vehicle", "access"):
        if mode + suffix in tags:
            return tags[mode + suffix]
    return effective_access(tags) if direction else "yes"


def allowed(tags):
    if tags.get("highway") not in SPEEDS or tags.get("area") == "yes":
        return False
    if effective_access(tags) not in ("yes", "permissive", "designated"):
        return False
    # Time and vehicle permissions are intentionally not inferred in a frozen teaching model.
    if any(
        k.endswith(":conditional")
        and k.split(":")[0] in ("access", "vehicle", "motor_vehicle", "motorcar", "oneway")
        for k in tags
    ):
        return False
    return tags.get("oneway") not in ("reversible", "alternating")


def directions(tags):
    one = tags.get("oneway:motorcar", tags.get("oneway:motor_vehicle", tags.get("oneway")))
    if one in ("yes", "1", "true"):
        return [1]
    if one in ("-1", "reverse"):
        return [-1]
    if one in ("no", "0", "false"):
        return [1, -1]
    if one is not None:
        return []
    return (
        [1]
        if tags.get("highway") == "motorway" or tags.get("junction") in ("roundabout", "circular")
        else [1, -1]
    )


def speed(tags, direction):
    key = "maxspeed:" + direction
    if key not in tags:
        key = "maxspeed"
    value = tags.get(key, "")
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(mph|km/h|kph)?", value)
    if match and float(match[1]) > 0:
        return round(float(match[1]) * (1.609344 if match[2] == "mph" else 1), 3), "osm:" + key
    return SPEEDS[tags["highway"]], "modeled:class_fallback"


def lane_count(tags, direction, two_way):
    key = "lanes:" + direction
    if tags.get(key, "").isdigit() and int(tags[key]) > 0:
        return int(tags[key]), "osm:" + key
    if tags.get("lanes", "").isdigit() and int(tags["lanes"]) > 0:
        total = int(tags["lanes"])
        if two_way:
            return max(1, total // 2), "modeled:directional_share"
        reserved = int(tags.get("lanes:psv", "0")) if tags.get("lanes:psv", "0").isdigit() else 0
        return max(1, total - reserved), "modeled:general_lane_share" if reserved else "osm:lanes"
    return (2 if tags["highway"] == "motorway" else 1), "modeled:class_fallback"


def hotspot(tags, lon, lat):
    name = tags.get("name", "")
    if not (-122.43 < lon < -122.385 and 37.775 < lat < 37.804):
        return None
    if name == "1st Street" and 37.7858 < lat < 37.7912:
        return "first"
    if (
        name in ("Harrison Street", "Bryant Street", "Essex Street", "4th Street")
        and -122.4065 < lon < -122.3915
        and 37.7785 < lat < 37.788
    ):
        return "harrison"
    if name in ("Stockton Street", "Stockton Tunnel") and 37.7873 < lat < 37.7985:
        return "stockton"
    if name == "Van Ness Avenue" and 37.775 < lat < 37.8025:
        return "van-ness"
    if name == "The Embarcadero" and 37.7817 < lat < 37.796:
        return "embarcadero"
    if name == "Lombard Street" and -122.4255 < lon < -122.4170:
        return "lombard"
    return None


def main():
    elements, timestamps, hashes = {}, {}, {}
    for source in ("downtown", "corridors"):
        raw = (CACHE / f"{source}.json").read_bytes()
        hashes[source] = hashlib.sha256(raw).hexdigest()
        body = json.loads(raw)
        timestamps[source] = body["osm3s"]["timestamp_osm_base"]
        for e in body["elements"]:
            elements[e["type"], e["id"]] = e
    source_ways = {e["id"]: e for e in elements.values() if e["type"] == "way"}
    relations = [e for e in elements.values() if e["type"] == "relation"]
    signals = {
        e["id"]
        for e in elements.values()
        if e["type"] == "node" and e.get("tags", {}).get("highway") == "traffic_signals"
    }
    ways, excluded = {}, collections.defaultdict(list)
    for wid, w in source_ways.items():
        t = w["tags"]
        if not allowed(t):
            excluded["access_or_conditional"].append(wid)
            continue
        # Exclude SF downtown Market conservatively as model scope, not a statement of current law.
        p = w["geometry"][len(w["geometry"]) // 2]
        if t.get("name") == "Market Street" and p and p["lon"] < -122.38 and p["lat"] > 37.77:
            excluded["market_scope"].append(wid)
            continue
        ways[wid] = w
    coordinates, memberships = {}, collections.Counter()
    for w in ways.values():
        memberships.update(set(w["nodes"]))
        for nid, p in zip(w["nodes"], w["geometry"], strict=True):
            if p:
                coordinates[nid] = (p["lon"], p["lat"])
    xy = {nid: project(*point) for nid, point in coordinates.items()}
    ends = {n for n, count in memberships.items() if count > 1} | signals
    for r in relations:
        ends.update(m["ref"] for m in r["members"] if m["role"] == "via" and m["type"] == "node")
    segments, edges, outgoing, incoming_way = (
        [],
        {},
        collections.defaultdict(list),
        collections.defaultdict(list),
    )
    for wid, w in sorted(ways.items()):
        seq = w["nodes"]
        cuts = sorted({0, len(seq) - 1} | {i for i, n in enumerate(seq) if n in ends})
        for a, b in zip(cuts, cuts[1:], strict=False):
            ns = seq[a : b + 1]
            if len(ns) < 2 or ns[0] == ns[-1] or any(n not in xy for n in ns):
                continue
            if any(
                not (
                    BOUNDS[1] <= coordinates[n][0] <= BOUNDS[3]
                    and BOUNDS[0] <= coordinates[n][1] <= BOUNDS[2]
                )
                for n in ns
            ):
                continue
            length = sum(distance(xy[u], xy[v]) * 1000 for u, v in zip(ns, ns[1:], strict=False))
            if length < 0.01:
                continue
            sid = len(segments)
            segments.append(
                {
                    "from": ns[0],
                    "to": ns[-1],
                    "way_id": wid,
                    "nodes": ns,
                    "length_m": round(length, 3),
                }
            )
            t = w["tags"]
            for direction in directions(t):
                dname = "forward" if direction == 1 else "backward"
                if effective_access(t, dname) not in ("yes", "permissive", "designated"):
                    continue
                start, end = (ns[0], ns[-1]) if direction == 1 else (ns[-1], ns[0])
                eid = f"{wid}:{start}:{end}"
                sp, sp_source = speed(t, dname)
                lanes, lanes_source = lane_count(t, dname, len(directions(t)) == 2)
                middle = coordinates[ns[len(ns) // 2]]
                edge = {
                    "id": eid,
                    "from": start,
                    "to": end,
                    "way_id": wid,
                    "segment": sid,
                    "direction": direction,
                    "length_m": round(length, 3),
                    "speed_kph": sp,
                    "lanes": lanes,
                    "speed_source": sp_source,
                    "lanes_source": lanes_source,
                    "signal": end in signals,
                    "hotspot": hotspot(t, *middle),
                }
                edges[eid] = edge
                outgoing[start].append(eid)
                incoming_way[wid, end].append(eid)
    for values in outgoing.values():
        values.sort()
    restrictions, ignored = [], collections.defaultdict(list)
    for r in sorted(relations, key=lambda r: r["id"]):
        t = r["tags"]
        exceptions = set(t.get("except", "").replace(",", ";").split(";"))
        if exceptions.intersection({"motorcar", "motor_vehicle", "vehicle"}):
            ignored["motorcar_excepted"].append(r["id"])
            continue
        kind = t.get(
            "restriction:motorcar", t.get("restriction:motor_vehicle", t.get("restriction"))
        )
        via = [m for m in r["members"] if m["role"] == "via"]
        if len(via) != 1 or via[0]["type"] != "node":
            ignored["via_way_or_missing_via"].append(r["id"])
            continue
        if not kind or kind.endswith("_on_red") or not kind.startswith(("no_", "only_")):
            ignored["conditional_or_unsupported_kind"].append(r["id"])
            continue
        # A permanent general restriction remains in force unless a motorcar exception is explicit.
        n = via[0]["ref"]
        from_ways = [m["ref"] for m in r["members"] if m["role"] == "from" and m["type"] == "way"]
        to_ways = [m["ref"] for m in r["members"] if m["role"] == "to" and m["type"] == "way"]
        if not from_ways or not to_ways:
            ignored["malformed_members"].append(r["id"])
            continue
        found = False
        for fw in from_ways:
            for ei in incoming_way[fw, n]:
                matches = []
                for eo in outgoing[n]:
                    out = edges[eo]
                    if out["way_id"] not in to_ways:
                        continue
                    if (
                        fw == out["way_id"]
                        and kind == "no_u_turn"
                        and out["to"] != edges[ei]["from"]
                    ):
                        continue
                    if (
                        fw == out["way_id"]
                        and kind == "only_straight_on"
                        and out["to"] == edges[ei]["from"]
                    ):
                        continue
                    matches.append(eo)
                if not matches and kind.startswith("only_"):
                    matches = [
                        f"outside:{r['id']}"
                    ]  # Pruned/access-excluded mandatory turn fails closed.
                for eo in matches:
                    restrictions.append(
                        {
                            "id": str(r["id"]),
                            "from": ei,
                            "via": n,
                            "to": eo,
                            "kind": "no" if kind.startswith("no_") else "only",
                            "restriction": kind,
                        }
                    )
                    found = True
        if not found:
            ignored["outside_access_filtered_graph"].append(r["id"])
    turn_rules = collections.defaultdict(lambda: {"no": set(), "only": set()})
    for r in restrictions:
        turn_rules[r["from"]][r["kind"]].add(r["to"])

    def route(start, target, block=None, penalty=None, initial=""):
        if start == target:
            return []
        queue = [(0, initial, start)]
        costs, prev = {initial: 0}, {}
        while queue:
            cost, ei, node = heapq.heappop(queue)
            if cost != costs[ei]:
                continue
            if node == target:
                path = []
                while ei != initial:
                    path.append(ei)
                    ei = prev[ei]
                return path[::-1]
            rules = turn_rules.get(ei)
            for eo in outgoing[node]:
                if block and eo in block:
                    continue
                if rules and (eo in rules["no"] or (rules["only"] and eo not in rules["only"])):
                    continue
                e = edges[eo]
                weight = e["length_m"] / (e["speed_kph"] / 3.6)
                trial = cost + weight * (4 if penalty and eo in penalty else 1)
                if trial < costs.get(eo, math.inf):
                    costs[eo], prev[eo] = trial, ei
                    heapq.heappush(queue, (trial, eo, e["to"]))
        return None

    # Street anchors are explicit representative requests snapped to actual source nodes.
    street_nodes = {
        e["from"]
        for e in edges.values()
        if ways[e["way_id"]]["tags"]["highway"] not in ("motorway", "motorway_link", "trunk_link")
    }
    incoming = {e["to"] for e in edges.values()}
    candidates = street_nodes & incoming
    anchors = []
    for aid, label, lon, lat, kind in ANCHORS:
        p = project(lon, lat)
        nearest = sorted(candidates, key=lambda n: (distance(xy[n], p), n))[:30]
        if not anchors:
            node = nearest[0]
        else:
            node = next(
                (
                    n
                    for n in nearest
                    if route(anchors[0]["node"], n) is not None
                    and route(n, anchors[0]["node"]) is not None
                ),
                None,
            )
        if node is None or distance(xy[node], p) > 0.7:
            raise ValueError(f"No bidirectionally reachable street anchor for {aid}")
        anchors.append(
            {
                "id": aid,
                "label": label,
                "node": node,
                "kind": kind,
                "requested_lon": lon,
                "requested_lat": lat,
                "offset_m": round(distance(xy[node], p) * 1000, 3),
            }
        )
    print("graph", len(edges), "edges", len(restrictions), "turn pairs", flush=True)
    print("anchors", [(a["id"], a["node"], a["offset_m"]) for a in anchors], flush=True)
    selected = set()
    for a in anchors:
        for b in anchors:
            if a == b:
                continue
            path = route(a["node"], b["node"])
            if path is None:
                raise ValueError(f"Anchor route unavailable: {a['id']} -> {b['id']}")
            selected.update(path)
            # Keep a real alternate route, favoring paths beyond the original edge set.
            if a["id"] in ("fidi", "soma") and b["id"] not in ("sfo", "east-bay"):
                alt = route(a["node"], b["node"], penalty=set(path))
                if alt:
                    selected.update(alt)
    print("anchor routes retained", len(selected), "edges", flush=True)
    center = anchors[0]["node"]
    desired = [e for e in edges.values() if e["hotspot"]]
    unavailable_hotspot = []
    for e in desired:
        into = route(center, e["from"])
        away = route(e["to"], center, initial=e["id"])
        if into is None or away is None:
            unavailable_hotspot.append(e["id"])
            continue
        selected.update(into)
        selected.add(e["id"])
        selected.update(away)
    # Preserve all selected bidirectional segment counterparts; they are genuine OSM directions.
    selected_segments = {edges[e]["segment"] for e in selected}
    selected.update(e["id"] for e in edges.values() if e["segment"] in selected_segments)
    kept_edges = [edges[e] for e in sorted(selected)]
    kept_nodes = sorted({e[k] for e in kept_edges for k in ("from", "to")})
    selected_ways = sorted({e["way_id"] for e in kept_edges})
    selected_segments = sorted({e["segment"] for e in kept_edges})
    ni, wi, si = (
        {x: i for i, x in enumerate(values)}
        for values in (kept_nodes, selected_ways, selected_segments)
    )
    retained_restrictions = [
        r
        for r in restrictions
        if r["from"] in selected and (r["kind"] == "only" or r["to"] in selected)
    ]
    hi = {h[0]: i for i, h in enumerate(HOTSPOTS)}
    names = sorted(
        {
            ways[w]["tags"].get("name", ways[w]["tags"].get("ref", "Road ramp"))
            for w in selected_ways
        }
    )
    name_index = {name: i for i, name in enumerate(names)}
    tag_keys = [
        "highway",
        "oneway",
        "oneway:motorcar",
        "oneway:motor_vehicle",
        "junction",
        "ref",
        "access",
        "vehicle",
        "motor_vehicle",
        "motorcar",
        "access:forward",
        "access:backward",
        "vehicle:forward",
        "vehicle:backward",
        "motor_vehicle:forward",
        "motor_vehicle:backward",
        "motorcar:forward",
        "motorcar:backward",
        "maxspeed",
        "maxspeed:forward",
        "maxspeed:backward",
        "lanes",
        "lanes:forward",
        "lanes:backward",
        "lanes:psv",
        "tunnel",
        "bridge",
        "layer",
    ]
    sources = sorted({e[k] for e in kept_edges for k in ("speed_source", "lanes_source")})
    source_index = {s: i for i, s in enumerate(sources)}
    packed = {
        "version": "osm-street-network-1",
        "metadata": {
            "attribution": "© OpenStreetMap contributors",
            "license": "ODbL-1.0",
            "source": "https://www.openstreetmap.org/copyright",
            "osm_base": timestamps,
            "source_sha256": hashes,
            "projection": {
                "origin_lon": -122.45,
                "origin_lat": 37.6,
                "cosine_lat": 37.75,
                "earth_radius_km": 6371.0088,
                "unit": "km",
            },
            "bounds": BOUNDS,
            "geometry_tolerance_m": 1,
            "coordinate_rounding_m": 0.1,
            "access_profile": (
                "ordinary motorcar; restrictive and time-conditional ways excluded conservatively"
            ),
            "market_scope": (
                "SF downtown Market excluded as model scope, not a statement of current law "
                "or pilot permissions"
            ),
            "turn_scope": (
                "Usable unconditional node-via no/only restrictions; via-way and conditional "
                "restrictions are not implemented. Not legally complete navigation."
            ),
            "speed_fallback_kph": SPEEDS,
            "signals": (
                "OSM traffic_signals presence; timings and discharge capacities are synthetic"
            ),
            "lanes": (
                "Directional OSM lane tags when available; otherwise modeled directional/"
                "general-traffic share or class fallback. Capacity is synthetic."
            ),
            "limitations": [
                "Frozen incomplete OSM source; no live conditions or turn legality assurance.",
                "No observed demand, calibrated queues, curb permission "
                "or commercial AV operating authority.",
                "SFO and East Bay are modeled boundary handoffs, not official pickup locations.",
                "Only selected real directed corridors and alternate paths are retained; "
                "unavailable routes stay unavailable.",
            ],
            "unsupported_restrictions": {
                k: sorted(v) for k, v in ignored.items() if k != "outside_access_filtered_graph"
            },
            "excluded_way_counts": {k: len(v) for k, v in excluded.items()},
            "unavailable_hotspot_edges": unavailable_hotspot,
            "source_counts": {
                "ways": len(source_ways),
                "relations": len(relations),
                "directed_edges": len(edges),
            },
            "retained_counts": {
                "nodes": len(kept_nodes),
                "ways": len(selected_ways),
                "segments": len(selected_segments),
                "edges": len(kept_edges),
                "turn_pairs": len(retained_restrictions),
            },
        },
        "names": names,
        "tag_keys": tag_keys,
        "sources": sources,
        "nodes": [[n, *coordinates[n]] for n in kept_nodes],
        "ways": [
            [
                w,
                name_index[ways[w]["tags"].get("name", ways[w]["tags"].get("ref", "Road ramp"))],
                [[i, ways[w]["tags"][k]] for i, k in enumerate(tag_keys) if k in ways[w]["tags"]],
            ]
            for w in selected_ways
        ],
        "segments": [
            [
                ni[segments[s]["from"]],
                ni[segments[s]["to"]],
                wi[segments[s]["way_id"]],
                [
                    [round(v, 4) for v in p]
                    for p in simplify([xy[n] for n in segments[s]["nodes"]])[1:-1]
                ],
                segments[s]["length_m"],
            ]
            for s in selected_segments
        ],
        "edges": [
            [
                si[e["segment"]],
                e["direction"],
                e["speed_kph"],
                e["lanes"],
                int(e["signal"]),
                hi.get(e["hotspot"], -1),
                source_index[e["speed_source"]],
                source_index[e["lanes_source"]],
            ]
            for e in kept_edges
        ],
        "anchors": [{**a, "node": str(a["node"])} for a in anchors],
        "hotspots": [
            {
                "id": h[0],
                "label": h[1],
                "description": h[2],
                "x": round(project(h[3], h[4])[0], 4),
                "y": round(project(h[3], h[4])[1], 4),
            }
            for h in HOTSPOTS
        ],
        "restrictions": retained_restrictions,
    }
    # Longest shortest legal path confined to a hotspot supplies reproducible background demand.
    original_outgoing = outgoing
    for h in packed["hotspots"]:
        ids = {e["id"] for e in kept_edges if e["hotspot"] == h["id"]}
        hs_nodes = {edges[e][k] for e in ids for k in ("from", "to")}
        outgoing = collections.defaultdict(list)
        for eid in sorted(ids):
            outgoing[edges[eid]["from"]].append(eid)
        best, best_length = [], 0
        for a in sorted(hs_nodes):
            for b in sorted(hs_nodes):
                p = route(a, b)
                if p:
                    length = sum(edges[e]["length_m"] for e in p)
                    if length > best_length:
                        best, best_length = p, length
        h["sample_route"] = best
        print(
            "hotspot",
            h["id"],
            len(ids),
            "edges, sample",
            len(best),
            round(best_length),
            "m",
            flush=True,
        )
    outgoing = original_outgoing
    content = (
        "// Generated from bounded OpenStreetMap extracts; "
        "© OpenStreetMap contributors, ODbL-1.0.\n"
        "// Reproduce with tools/street-map-data/extract.py; schema and limitations in "
        "docs/FLEETLAB_STREET_MAP_DATA.md.\nexport const SF_STREETS_DATA = "
        + json.dumps(packed, separators=(",", ":"), ensure_ascii=False)
        + ";\n"
    )
    DEST.write_text(content)
    manifest = {
        "source_sha256": hashes,
        "osm_base": timestamps,
        "data_bytes": len(content.encode()),
        "data_sha256": hashlib.sha256(content.encode()).hexdigest(),
        **packed["metadata"]["retained_counts"],
        "restriction_exclusions": {k: len(v) for k, v in ignored.items()},
        "way_exclusions": {k: len(v) for k, v in excluded.items()},
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (CACHE / "derivation-audit.json").write_text(
        json.dumps(
            {
                "excluded_ways": excluded,
                "excluded_relations": ignored,
                "hotspot_unavailable": unavailable_hotspot,
            },
            indent=2,
        )
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
