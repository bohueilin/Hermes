#!/usr/bin/env python3
"""Reproduce the bounded OSM route corpus. Standard-library only; see map-data docs.
Run --fetch to download saved queries, then --derive to build the checked-in data.
After initial derivation, --labels fetches tags for retained ways; derive again.
"""

import argparse
import hashlib
import heapq
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "artifacts/bay-area-map"
DEST = ROOT / "playground/fleetlab/src/data/bay-area-map.js"
HERE = Path(__file__).parent
ENDPOINT = "https://overpass-api.de/api/interpreter"
BOUNDS = [37.25, -122.55, 37.84, -121.80]
PLACES = [
    ("san-francisco", "San Francisco", 26819236),
    ("sfo", "SFO Airport", 545819287),
    ("daly-city", "Daly City", 140983265),
    ("colma", "Colma", 140982808),
    ("broadmoor", "Broadmoor", 140983130),
    ("brisbane", "Brisbane", 140982915),
    ("south-san-francisco", "South San Francisco", 150938939),
    ("san-bruno", "San Bruno", 150963100),
    ("millbrae", "Millbrae", 150954849),
    ("burlingame", "Burlingame", 150942279),
    ("san-mateo", "San Mateo", 1696924414),
    ("menlo-park", "Menlo Park", 150981209),
    ("palo-alto", "Palo Alto", 81008084),
    ("los-altos", "Los Altos", 1283669332),
    ("mountain-view", "Mountain View", 81013838),
    ("sunnyvale", "Sunnyvale", 150963377),
    ("san-jose", "San Jose", 1690212988),
    ("sjc", "SJC Airport", 648903263),
]


def project(lon, lat):
    return (
        (lon + 122.55) * math.pi / 180 * 6371.0088 * math.cos(37.55 * math.pi / 180),
        (lat - 37.25) * math.pi / 180 * 6371.0088,
    )


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def download(name, query):
    request = urllib.request.Request(
        ENDPOINT,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "HermesFleetLabMapExtract/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read(30_000_001)
    if len(raw) > 30_000_000:
        raise ValueError("Source response exceeded the 30 MB per-request bound")
    value = json.loads(raw)
    if value.get("remark"):
        raise ValueError(value["remark"])
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"{name}.json").write_bytes(raw)
    print(name, len(raw), "bytes")


def simplify(seq, coordinates, tolerance):
    if len(seq) < 3:
        return seq
    a, b = coordinates[seq[0]], coordinates[seq[-1]]
    dx, dy = b[0] - a[0], b[1] - a[1]
    denom = dx * dx + dy * dy
    best, index = -1, 0
    for i in range(1, len(seq) - 1):
        p = coordinates[seq[i]]
        ratio = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom)) if denom else 0
        error = dist(p, (a[0] + ratio * dx, a[1] + ratio * dy))
        if error > best:
            best, index = error, i
    if best <= tolerance:
        return [seq[0], seq[-1]]
    return simplify(seq[: index + 1], coordinates, tolerance)[:-1] + simplify(
        seq[index:], coordinates, tolerance
    )


def derive():
    roads = json.loads((CACHE / "roads.json").read_text())
    places_source = {
        e["id"]: e for e in json.loads((CACHE / "places.json").read_text())["elements"]
    }
    nodes, graph, edge_way = {}, {}, {}
    for way in roads["elements"]:
        for node, point in zip(way["nodes"], way["geometry"], strict=False):
            if point is not None:
                nodes[node] = (point["lon"], point["lat"])
        for a, b in zip(way["nodes"], way["nodes"][1:], strict=False):
            if a == b or a not in nodes or b not in nodes:
                continue
            # Keep topology inside the query boundary; no out-of-region detours.
            if any(
                not (-122.55 <= nodes[n][0] <= -121.8 and 37.25 <= nodes[n][1] <= 37.84)
                for n in (a, b)
            ):
                continue
            key = tuple(sorted((a, b)))
            edge_way.setdefault(key, way["id"])
            graph.setdefault(a, set()).add(b)
            graph.setdefault(b, set()).add(a)
    xy = {n: project(*p) for n, p in nodes.items()}
    remaining, components = set(graph), []
    while remaining:
        pending = [min(remaining)]
        component = set(pending)
        remaining.difference_update(pending)
        while pending:
            n = pending.pop()
            for nxt in graph[n]:
                if nxt in remaining:
                    remaining.remove(nxt)
                    component.add(nxt)
                    pending.append(nxt)
        components.append(component)
    connected = max(components, key=len)
    places, anchors = [], []
    for id_, label, source_id in PLACES:
        e = places_source[source_id]
        point = e.get("center", e)
        lon, lat = point["lon"], point["lat"]
        pxy = project(lon, lat)
        nearest = min(connected, key=lambda n: (dist(xy[n], pxy), n))
        if dist(xy[nearest], pxy) > 3:
            raise ValueError(f"{id_}: road anchor farther than3 km")
        anchors.append(nearest)
        places.append(
            {
                "id": id_,
                "label": label,
                "lat": lat,
                "lon": lon,
                "kind": "airport" if id_ in ("sfo", "sjc") else "city",
                "source": f"https://www.openstreetmap.org/{e['type']}/{source_id}",
                "anchor_node": nearest,
            }
        )
    if len(set(anchors)) != 18:
        raise ValueError("Two representative places snapped to the same anchor")
    paths, selected_edges = {}, set()
    for source_index, start in enumerate(anchors):
        costs = {start: 0}
        prev = {}
        queue = [(0, start)]
        targets = set(anchors[source_index + 1 :])
        while queue and targets:
            cost, n = heapq.heappop(queue)
            if cost != costs[n]:
                continue
            targets.discard(n)
            for nxt in sorted(graph[n]):
                trial = cost + dist(xy[n], xy[nxt])
                if trial < costs.get(nxt, float("inf")):
                    costs[nxt] = trial
                    prev[nxt] = n
                    heapq.heappush(queue, (trial, nxt))
        for target_index in range(source_index + 1, len(anchors)):
            node = anchors[target_index]
            path = [node]
            while node != start:
                if node not in prev:
                    raise ValueError("Disconnected route: no synthetic bridge allowed")
                node = prev[node]
                path.append(node)
            path.reverse()
            paths[(source_index, target_index)] = path
            selected_edges.update(tuple(sorted(e)) for e in zip(path, path[1:], strict=False))
    selected_graph = {}
    for a, b in selected_edges:
        selected_graph.setdefault(a, set()).add(b)
        selected_graph.setdefault(b, set()).add(a)
    # Stop chains at every branch and anchor; carry all OSM way ids across degree-two joins.
    ends = set(anchors)
    for n, neighbors in selected_graph.items():
        if len(neighbors) != 2:
            ends.add(n)
    visited = set()
    chains = []
    lookup = {}
    for a in sorted(ends):
        for b in sorted(selected_graph[a]):
            first = tuple(sorted((a, b)))
            if first in visited:
                continue
            chain = [a, b]
            visited.add(first)
            while chain[-1] not in ends:
                nxt = next(k for k in selected_graph[chain[-1]] if k != chain[-2])
                visited.add(tuple(sorted((chain[-1], nxt))))
                chain.append(nxt)
            index = len(chains)
            for u, v in zip(chain, chain[1:], strict=False):
                lookup[(u, v)] = index + 1
                lookup[(v, u)] = -(index + 1)
            chains.append(
                (
                    list(
                        dict.fromkeys(
                            edge_way[tuple(sorted((u, v)))]
                            for u, v in zip(chain, chain[1:], strict=False)
                        )
                    ),
                    simplify(chain, xy, 0.008),
                )
            )
    if visited != selected_edges:
        raise ValueError("Unrepresented cycle in selected corpus")
    compact_paths = []
    for (i, j), path in paths.items():
        edges = []
        for a, b in zip(path, path[1:], strict=False):
            segment = lookup[(a, b)]
            if not edges or segment != edges[-1]:
                edges.append(segment)
        compact_paths.append([i, j, edges])
    retained = sorted(set(n for _, chain in chains for n in chain))
    indexes = {n: i for i, n in enumerate(retained)}
    label_path = CACHE / "labels.json"
    labels = (
        {e["id"]: e.get("tags", {}) for e in json.loads(label_path.read_text())["elements"]}
        if label_path.exists()
        else {}
    )
    way_ids = sorted(set(way for ways, _ in chains for way in ways))
    (CACHE / "selected-ways.json").write_text(json.dumps(way_ids))
    coast_source = json.loads((CACHE / "coast.json").read_text())
    coastlines = []
    for way in coast_source["elements"]:
        current = []

        def append_current(line):
            if len(line) < 2:
                return
            pxy = {i: project(*p) for i, p in enumerate(line)}
            keep = simplify(list(range(len(line))), pxy, 0.025)
            coastlines.append([line[i] for i in keep])

        for p in way["geometry"]:
            if p is not None and -122.55 <= p["lon"] <= -121.8 and 37.25 <= p["lat"] <= 37.84:
                current.append([p["lon"], p["lat"]])
            else:
                append_current(current)
                current = []
        append_current(current)
    raw = {
        "source": "OpenStreetMap via Overpass API; frozen major-road route corpus",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL 1.0 — https://opendatacommons.org/licenses/odbl/1-0/",
        "retrieved": roads["osm3s"]["timestamp_osm_base"],
        "bounds": {"south": 37.25, "west": -122.55, "north": 37.84, "east": -121.8},
        "places": places,
        "nodes": [[n, *nodes[n]] for n in retained],
        "roads": [
            [
                ways,
                " / ".join(
                    list(
                        dict.fromkeys(
                            labels.get(way, {}).get(
                                "name", labels.get(way, {}).get("ref", "Mapped road")
                            )
                            for way in ways
                        )
                    )[:3]
                ),
                labels.get(ways[0], {}).get("highway", "major_road"),
                [indexes[n] for n in chain],
            ]
            for ways, chain in chains
        ],
        "paths": compact_paths,
        "coastlines": coastlines,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    data = (
        "// Derived OpenStreetMap database, ODbL 1.0. "
        "Reproduce with tools/map-data/extract.py.\nexport const BAY_AREA_DATA = "
        + json.dumps(raw, separators=(",", ":"), ensure_ascii=False)
        + ";\n"
    )
    if len(data.encode()) > 300_000:
        print({k: len(json.dumps(v, separators=(",", ":")).encode()) for k, v in raw.items()})
        raise ValueError(f"Packed data too large: {len(data.encode())}")
    DEST.write_text(data)
    summary = {
        "endpoint": ENDPOINT,
        "osm_base": roads["osm3s"]["timestamp_osm_base"],
        "source_ways": len(roads["elements"]),
        "source_graph_nodes": len(graph),
        "largest_connected_component": len(connected),
        "component_count": len(components),
        "route_pairs": len(paths),
        "retained_nodes": len(retained),
        "retained_chains": len(chains),
        "retained_ways": len(way_ids),
        "coastline_fragments": len(coastlines),
        "data_bytes": len(data.encode()),
        "data_sha256": hashlib.sha256(data.encode()).hexdigest(),
        "source_sha256": {
            name: hashlib.sha256((CACHE / f"{name}.json").read_bytes()).hexdigest()
            for name in ["places", "roads", "coast", "labels"]
            if (CACHE / f"{name}.json").exists()
        },
        "anchor_offsets_km": {
            p["id"]: round(dist(project(p["lon"], p["lat"]), xy[n]), 6)
            for p, n in zip(places, anchors, strict=False)
        },
    }
    (HERE / "manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--derive", action="store_true")
    parser.add_argument("--labels", action="store_true")
    args = parser.parse_args()
    if args.fetch:
        for name in ["places", "roads", "coast"]:
            download(name, (HERE / f"{name}-query.txt").read_text())
    if args.labels:
        ids = json.loads((CACHE / "selected-ways.json").read_text())
        query = "[out:json][timeout:60];way(id:" + ",".join(map(str, ids)) + ");out tags;"
        (HERE / "labels-query.txt").write_text(query)
        download("labels", query)
    if args.derive:
        derive()
