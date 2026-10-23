"""Narrow source-preserving temporal graph compiler; static consumers reject it."""

import copy
import io
import math
import xml.etree.ElementTree as ET

from .conditional_access_v1 import parse_condition
from .contracts import digest, finite, sha
from .importer import parse_osm
from .pack import build_graph
from .restrictions import directed_segments

SCHEMA = "fleetlab.city-temporal-pack/3.0.0"
PROFILE = "fleetlab.temporal-node-access/3.0.0"
MODES = ("motorcar", "motor_vehicle", "vehicle", "access")
ALLOW = frozenset({"yes", "permissive", "designated"})
DENY = frozenset(
    {"no", "private", "agricultural", "forestry", "delivery", "destination", "customers", "permit"}
)
CONTEXT = {
    "vehicle_class": "passenger_car",
    "timezone": "America/Los_Angeles",
    "occupancy": "OPEN_THROUGH_EDGE_EXIT",
    "waiting": "NONE",
    "clock_unit": "millisecond",
}


def parse_temporal_osm(data):
    if not isinstance(data, bytes) or len(data) > 150_000_000:
        raise ValueError("source byte bound")
    # The historical parser performs declaration/error-response checks.
    source = parse_osm(data, routing_profile="edge-sequence/2.0.0")
    seen, raw = set(), {}
    for _, e in ET.iterparse(io.BytesIO(data), events=("end",)):
        if e.tag not in {"node", "way", "relation"}:
            continue
        key = (e.tag, e.attrib["id"])
        if key in seen:
            raise ValueError("duplicate source object")
        seen.add(key)
        tags = [(t.attrib["k"], t.attrib["v"]) for t in e.findall("tag")]
        if len(dict(tags)) != len(tags):
            raise ValueError("duplicate source tag")
        tags = dict(tags)
        if e.tag == "relation" and tags.get("type") == "restriction":
            raw[e.attrib["id"]] = {
                "tags": tags,
                "members": [dict(m.attrib) for m in e.findall("member")],
            }
        e.clear()
    represented = {r["id"] for r in source["restrictions"]}
    for rid, record in raw.items():
        # Unknown conditional restriction modes/directions are not silently lost
        # just because the historical parser has no recognized base key.
        if rid in represented or not any("conditional" in k for k in record["tags"]):
            continue
        ms = record["members"]
        fm = [m["ref"] for m in ms if m.get("role") == "from" and m.get("type") == "way"]
        to = [m["ref"] for m in ms if m.get("role") == "to" and m.get("type") == "way"]
        via = [m["ref"] for m in ms if m.get("role") == "via" and m.get("type") == "node"]
        for f in fm or [None]:
            source["restrictions"].append(
                {
                    "id": rid,
                    "from": f,
                    "to": to[0] if len(to) == 1 else None,
                    "via": via[0] if len(via) == 1 else None,
                    "kind": "UNSUPPORTED_CONDITIONAL",
                    "conditional": True,
                    "malformed": True,
                }
            )
    source["raw_restrictions"] = raw
    source["xml_sha256"] = sha(data)
    return source


def compile_turn(rule, raw, ways):
    tags, members = raw["tags"], raw["members"]
    keys = [k for k in tags if "conditional" in k]
    supported = {
        "restriction:conditional",
        "restriction:motorcar:conditional",
        "restriction:motor_vehicle:conditional",
    }
    if (
        len(keys) != 1
        or keys[0] not in supported
        or rule.get("malformed")
        or rule.get("via_way")
        or rule.get("except_motorcar")
        or any(k.startswith("restriction") and k != keys[0] for k in tags)
    ):
        raise ValueError("unsupported conditional restriction override/member form")
    condition = parse_condition(tags[keys[0]])
    if condition.value == "no":
        raise ValueError("access value is not a turn rule")
    expected = [
        {"type": "way", "ref": rule["from"], "role": "from"},
        {"type": "node", "ref": rule["via"], "role": "via"},
        {"type": "way", "ref": rule["to"], "role": "to"},
    ]
    if (
        len(members) != 3
        or rule["from"] == rule["to"]
        or sorted(tuple(sorted(m.items())) for m in members)
        != sorted(tuple(sorted(m.items())) for m in expected)
    ):
        raise ValueError("restriction members differ from named node-via topology")
    before, after = ways[rule["from"]], ways[rule["to"]]
    if not (
        sum(v == rule["via"] for _, v, _ in directed_segments(before)) == 1
        and sum(u == rule["via"] for u, _, _ in directed_segments(after)) == 1
    ):
        raise ValueError("named via lacks directed incoming/outgoing source edges")
    return {
        "id": rule["id"],
        "from": rule["from"],
        "to": rule["to"],
        "via": rule["via"],
        "expression": condition.raw,
        "key": keys[0],
        "raw": copy.deepcopy(raw),
    }


def access_tags(tags):
    if any(k.startswith(mode + ":") and k != mode + ":conditional" for k in tags for mode in MODES):
        raise ValueError("unsupported mode/direction access override")
    if any(k in tags for k in ("oneway:motorcar", "oneway:motor_vehicle", "oneway:vehicle")):
        raise ValueError("unsupported vehicle direction override")
    timed = [
        k
        for k in tags
        if "conditional" in k
        and any(word in k for word in ("access", "vehicle", "motorcar", "oneway", "restriction"))
    ]
    if any(k not in {m + ":conditional" for m in MODES} for k in timed):
        raise ValueError("unsupported access/direction conditional key")
    result = {k: v for k, v in tags.items() if k in MODES or k in timed}
    for key, value in result.items():
        if key.endswith(":conditional"):
            if parse_condition(value).value != "no":
                raise ValueError("only restrictive access expressions supported")
        elif value not in ALLOW | DENY:
            raise ValueError("unsupported base access")
    return result


def build_temporal_pack(source):
    original = digest(source)
    ways = {w["id"]: w for w in source["ways"]}
    rules, timed_turns, timed_access, audit = [], [], [], []
    for rule in source.get("restrictions", []):
        if not rule.get("conditional"):
            rules.append(rule)
            continue
        try:
            temporal = compile_turn(rule, source["raw_restrictions"][rule["id"]], ways)
        except (ValueError, KeyError, TypeError) as exc:
            rules.append(rule)
            audit.append(
                {"kind": "relation", "id": rule["id"], "status": "UNSUPPORTED", "reason": str(exc)}
            )
        else:
            timed_turns.append(temporal)
            audit.append({"kind": "relation", "id": rule["id"], "status": "TIMED_NODE_RULE"})
    adjusted = []
    for way in source["ways"]:
        tags = way.get("tags", {})
        try:
            access = access_tags(tags)
            conditional = [k for k in access if k.endswith(":conditional")]
        except ValueError as exc:
            rules.append(
                {
                    "id": "unsupported-way-access:" + way["id"],
                    "from": way["id"],
                    "kind": "UNSUPPORTED_ACCESS",
                    "conditional": True,
                }
            )
            adjusted.append(way)
            audit.append(
                {"kind": "way", "id": way["id"], "status": "UNSUPPORTED", "reason": str(exc)}
            )
            continue
        if conditional:
            timed_access.append({"way": way["id"], "tags": access})
            adjusted.append(
                {**way, "tags": {k: v for k, v in tags.items() if k not in conditional}}
            )
            audit.append({"kind": "way", "id": way["id"], "status": "TIMED_ACCESS"})
        else:
            adjusted.append(way)
    used_nodes = {n for way in source["ways"] for n in way["nodes"]}
    node_source, node_access, unsupported_nodes = {}, [], set()
    for node, tags in source.get("node_tags", {}).items():
        if node not in used_nodes or not any(
            k in MODES or "conditional" in k or any(k.startswith(m + ":") for m in MODES)
            for k in tags
        ):
            continue
        node_source[node] = copy.deepcopy(tags)
        try:
            access = access_tags(tags)
        except ValueError:
            unsupported_nodes.add(node)
        else:
            if access:
                node_access.append({"node": node, "tags": access})
    for way in source["ways"]:
        unknown_nodes = sorted(set(way["nodes"]) & unsupported_nodes)
        if unknown_nodes:
            rules.append(
                {
                    "id": "unsupported-node-access:" + way["id"],
                    "from": way["id"],
                    "kind": "UNSUPPORTED_NODE_ACCESS",
                    "conditional": True,
                }
            )
            audit.append(
                {
                    "kind": "way",
                    "id": way["id"],
                    "status": "UNSUPPORTED",
                    "reason": "node access unsupported",
                    "nodes": unknown_nodes,
                }
            )
    graph = build_graph(
        {**source, "ways": adjusted, "restrictions": rules}, routing_profile="edge-sequence/2.0.0"
    )
    # Inventory is original source evidence, not the compiler's temporary projection.
    for row in graph["inventory"]:
        row["tags"] = copy.deepcopy(ways[row["id"]].get("tags", {}))
        if row["status"] == "included" and any(x["way"] == row["id"] for x in timed_access):
            row["reason"] = "supported timed passenger-car access; traversal context required"
    for edge in graph["edges"]:
        edge["source_seconds"] = edge["seconds"]
        edge["duration_ms"] = math.ceil(edge["seconds"] * 1000)
        edge["seconds"] = edge["duration_ms"] / 1000
    graph["schema"] = SCHEMA
    graph["temporal"] = {
        "profile": PROFILE,
        **CONTEXT,
        "source_digest": original,
        "xml_sha256": source.get("xml_sha256"),
        "turns": timed_turns,
        "access": timed_access,
        "audit": audit,
        "nodes": node_access,
        "node_source": node_source,
        "source_rules": [
            {
                "rule": copy.deepcopy(r),
                "raw": copy.deepcopy(source.get("raw_restrictions", {}).get(r["id"])),
            }
            for r in source.get("restrictions", [])
            if r.get("conditional")
        ],
    }
    return graph


def static_view(pack):
    """Structural adapter for shared static accounting; never public routing permission."""
    if pack.get("schema") != SCHEMA:
        raise ValueError("unsupported temporal pack schema")
    temporal = pack["temporal"]
    if temporal.get("profile") != PROFILE or any(temporal.get(k) != v for k, v in CONTEXT.items()):
        raise ValueError("unsupported temporal policy")
    if len(temporal["turns"]) > 10000 or len(temporal["access"]) > 10000:
        raise ValueError("temporal inventory bound")
    for edge in pack["edges"]:
        source = finite(edge["source_seconds"], 0.000001, 86400)
        if (
            type(edge["duration_ms"]) is not int
            or edge["duration_ms"] != math.ceil(source * 1000)
            or edge["seconds"] != edge["duration_ms"] / 1000
        ):
            raise ValueError("temporal edge clock differs from source transformation")
    return {
        k: ("fleetlab.city-pack/1.0.0" if k == "schema" else v)
        for k, v in pack.items()
        if k != "temporal"
    }


def validated_graph(pack):
    graph = static_view(pack)
    ways = {
        r["id"]: {"id": r["id"], "nodes": r["source_nodes"], "tags": r["tags"]}
        for r in pack["inventory"]
    }
    expected_turns = []
    for entry in pack["temporal"]["source_rules"]:
        try:
            expected_turns.append(compile_turn(entry["rule"], entry["raw"], ways))
        except (ValueError, KeyError, TypeError):
            continue
    if sorted(expected_turns, key=lambda r: r["id"]) != sorted(
        pack["temporal"]["turns"], key=lambda r: r["id"]
    ):
        raise ValueError("missing/changed temporal turn relative to retained source")
    if len({r["id"] for r in expected_turns}) != len(expected_turns):
        raise ValueError("duplicate temporal turn")
    declared_turns = [
        r["id"] for r in pack["temporal"]["audit"] if r["status"] == "TIMED_NODE_RULE"
    ]
    if sorted(declared_turns) != sorted(r["id"] for r in expected_turns):
        raise ValueError("temporal source/audit inventory mismatch")
    expected_access = []
    for way, record in ways.items():
        try:
            tags = access_tags(record["tags"])
        except ValueError:
            continue
        if any(k.endswith(":conditional") for k in tags):
            expected_access.append({"way": way, "tags": tags})
    if sorted(expected_access, key=lambda r: r["way"]) != sorted(
        pack["temporal"]["access"], key=lambda r: r["way"]
    ):
        raise ValueError("missing/changed temporal access relative to retained source")
    expected_nodes = []
    for node, raw in pack["temporal"]["node_source"].items():
        if node not in pack["nodes"]:
            raise ValueError("unknown node access source")
        try:
            tags = access_tags(raw)
        except ValueError:
            continue
        if tags:
            expected_nodes.append({"node": node, "tags": tags})
    if sorted(expected_nodes, key=lambda r: r["node"]) != sorted(
        pack["temporal"]["nodes"], key=lambda r: r["node"]
    ):
        raise ValueError("missing/changed node access relative to retained source")
    return graph
