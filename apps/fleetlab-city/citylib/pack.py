"""Source-ID road graph. Unsupported access/turn semantics are blocked, never ignored."""

import math
from collections import Counter, defaultdict

from .contracts import digest, finite

MOTOR = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "living_street",
    "service",
    "motorway_link",
    "trunk_link",
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "road",
}
SPEED_KPH = {
    "motorway": 80,
    "trunk": 65,
    "primary": 40,
    "secondary": 35,
    "tertiary": 30,
    "residential": 25,
    "service": 15,
    "living_street": 10,
}


def distance(a, b):
    r = 6371008.8
    x1, y1, x2, y2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((y2 - y1) / 2) ** 2 + math.cos(y1) * math.cos(y2) * math.sin((x2 - x1) / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


def build_graph(source, routing_profile="node-via/1.0.0"):
    if routing_profile not in {"node-via/1.0.0", "edge-sequence/2.0.0"}:
        raise ValueError("unsupported routing profile")
    nodes = source["nodes"]
    for coords in nodes.values():
        finite(coords[0], -180, 180)
        finite(coords[1], -90, 90)
    ways = sorted(source["ways"], key=lambda x: x["id"])
    ids = [w["id"] for w in ways]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate source way ID")
    blocked = defaultdict(list)
    turns = []
    restriction_audit = []
    way_lookup = {w["id"]: w for w in ways}
    for r in source.get("restrictions", []):
        if r.get("except_motorcar"):
            restriction_audit.append({"id": r["id"], "status": "EXEMPT"})
            continue
        if routing_profile == "edge-sequence/2.0.0":
            from .restrictions import KINDS, compile_sequence

            if r.get("via_way"):
                try:
                    turns.append(compile_sequence(r, way_lookup))
                    restriction_audit.append({"id": r["id"], "status": "SUPPORTED_SEQUENCE"})
                    continue
                except ValueError as exc:
                    restriction_audit.append(
                        {"id": r["id"], "status": "BLOCKED", "reason": str(exc)}
                    )
            elif r.get("conditional") or r.get("malformed") or r.get("kind") not in KINDS:
                if r.get("from"):
                    blocked[r["from"]].append(
                        "conditional/malformed/unknown restriction unsupported"
                    )
                    restriction_audit.append(
                        {
                            "id": r["id"],
                            "status": "BLOCKED",
                            "reason": "conditional/malformed/unknown restriction",
                        }
                    )
                    continue
            else:
                restriction_audit.append({"id": r["id"], "status": "NODE_VIA"})
        if not r.get("from"):
            if routing_profile == "edge-sequence/2.0.0" and not any(
                a["id"] == r["id"] for a in restriction_audit
            ):
                restriction_audit.append(
                    {
                        "id": r["id"],
                        "status": "BLOCKED",
                        "reason": "missing from; incident ways blocked",
                    }
                )
            affected = [
                w["id"] for w in ways if r.get("via") in w["nodes"] or w["id"] == r.get("to")
            ]
            if not affected:
                raise ValueError("restriction cannot be localized")
            for way_id in affected:
                blocked[way_id].append("malformed restriction: conservative incident-way block")
            continue
        if r.get("conditional") or r.get("via_way") or not r.get("via") or not r.get("to"):
            reason = (
                "via-way restriction unsupported"
                if r.get("via_way")
                else "conditional/malformed restriction unsupported"
            )
            if not r.get("from"):
                raise ValueError("restriction has no identifiable from way")
            blocked[r["from"]].append(reason)
        elif r.get("kind", "").startswith(("no_", "only_")):
            turns.append(r)
        else:
            blocked[r["from"]].append("restriction kind unsupported")
    inventory, edges = [], []
    for w in ways:
        tags = w.get("tags", {})
        nids = w["nodes"]
        road_class = tags.get("highway", "unknown")
        good = len(nids) >= 2 and all(n in nodes for n in nids)
        length = (
            sum(distance(nodes[a], nodes[b]) for a, b in zip(nids, nids[1:], strict=False))
            if good
            else None
        )
        status, reason = "included", "supported passenger-car profile"
        eligible = road_class in MOTOR
        access = next(
            (tags[k] for k in ("motorcar", "motor_vehicle", "vehicle", "access") if k in tags),
            "yes",
        )
        if w.get("force_exclude"):
            status, reason, eligible = "excluded", w["force_exclude"], False
        elif not good:
            status, reason = "quarantined", "missing source nodes or degenerate way"
        elif not eligible:
            status, reason = "excluded", "not a passenger-car motor road"
        elif access in {
            "no",
            "private",
            "agricultural",
            "forestry",
            "delivery",
            "destination",
            "customers",
            "permit",
        }:
            status, reason, eligible = "excluded", f"restricted access: {access}", False
        elif access not in {"yes", "permissive", "designated"}:
            status, reason = "unsupported", f"unknown access: {access}"
        elif any(
            "conditional" in k
            and any(x in k for x in ("access", "vehicle", "motorcar", "oneway", "restriction"))
            for k in tags
        ):
            status, reason = "unsupported", "conditional access/direction unsupported"
        elif blocked[w["id"]]:
            status, reason = "unsupported", "; ".join(sorted(set(blocked[w["id"]])))
        elif tags.get("oneway", "no") not in {"yes", "no", "1", "0", "-1", "true", "false"}:
            status, reason = "unsupported", "oneway value unsupported"
        elif any(
            source.get("node_tags", {}).get(n, {}).get("access") in {"no", "private"} for n in nids
        ):
            status, reason = "excluded", "restricted node access"
        record = {
            "id": w["id"],
            "name": tags.get("name", "Unnamed road"),
            "class": road_class,
            "status": status,
            "reason": reason,
            "eligible": eligible,
            "length_m": length,
            "scope": w.get("scope", "city"),
            "district_lengths_m": w.get("district_lengths_m", {}),
            "source_nodes": nids,
            "tags": tags,
        }
        inventory.append(record)
        if status != "included":
            continue
        speed = SPEED_KPH.get(road_class.removesuffix("_link"), 25) / 3.6
        oneway = tags.get("oneway", "yes" if tags.get("junction") == "roundabout" else "no")
        for i, (a, b) in enumerate(zip(nids, nids[1:], strict=False)):
            if a == b:
                continue
            length_m = distance(nodes[a], nodes[b])
            for u, v, suffix in [(a, b, "f"), (b, a, "r")]:
                if (
                    oneway in {"yes", "1", "true"}
                    and suffix == "r"
                    or oneway == "-1"
                    and suffix == "f"
                ):
                    continue
                edges.append(
                    {
                        "id": f"{w['id']}:{i}:{suffix}",
                        "u": u,
                        "v": v,
                        "way": w["id"],
                        "length_m": length_m,
                        "seconds": max(0.01, length_m / speed),
                        "speed_mps": speed,
                        "speed_provenance": "ASSUMPTION: class free-flow speed",
                        "name": tags.get("name", "Unnamed road"),
                        "class": road_class,
                    }
                )
    result = {
        "schema": "fleetlab.city-pack/1.0.0",
        "nodes": nodes,
        "edges": edges,
        "turns": turns,
        "inventory": inventory,
        "candidate_ids": ids,
        "source_inventory_digest": digest(ids),
        "drive_side": source.get("drive_side", "right"),
        "distance_method": "spherical geodesic, R=6371008.8 m",
        "routing_assumptions": [
            "No immediate U-turns",
            "Class-based free-flow speeds, not posted speed limits",
        ],
    }
    if routing_profile != "node-via/1.0.0":
        result["routing_profile"] = routing_profile
        result["restriction_audit"] = restriction_audit
        result["qualification_stage"] = "CANDIDATE_MAP_ONLY"
    return result


def qualify_inventory(pack):
    ids = pack["candidate_ids"]
    records = pack["inventory"]
    counts = Counter(r["id"] for r in records)
    missing = sorted(set(ids) - set(counts))
    extra = sorted(set(counts) - set(ids))
    duplicates = sorted(k for k, v in counts.items() if v != 1)
    accounting = (
        not (missing or extra or duplicates) and digest(ids) == pack["source_inventory_digest"]
    )
    by_class = defaultdict(lambda: {"eligible_m": 0.0, "unsupported_m": 0.0, "count": 0})
    by_district = defaultdict(lambda: {"eligible_m": 0.0, "unsupported_m": 0.0, "count": 0})
    total, unsupported = 0.0, 0.0
    for r in records:
        if r["status"] not in {"included", "excluded", "unsupported", "quarantined"} or not r.get(
            "reason"
        ):
            accounting = False
        if not r["eligible"] or r["scope"] == "buffer":
            continue
        length = r["length_m"] or 0
        bad = r["status"] in {"unsupported", "quarantined"}
        total += length
        unsupported += length if bad else 0
        bucket = by_class[r["class"]]
        bucket["count"] += 1
        bucket["eligible_m"] += length
        bucket["unsupported_m"] += length if bad else 0
        for district, dlength in r["district_lengths_m"].items():
            bucket = by_district[district]
            bucket["count"] += 1
            bucket["eligible_m"] += dlength
            bucket["unsupported_m"] += dlength if bad else 0
    for buckets in (by_class, by_district):
        for b in buckets.values():
            b["unsupported_fraction"] = (
                b["unsupported_m"] / b["eligible_m"] if b["eligible_m"] else None
            )
    fraction = unsupported / total if total else None
    distribution = all(
        b["unsupported_fraction"] is not None and b["unsupported_fraction"] <= 0.05
        for buckets in (by_class, by_district)
        for b in buckets.values()
    )
    district_available = bool(by_district) and not by_district.get("UNASSIGNED", {}).get(
        "eligible_m", 0
    )
    return {
        "accounting_complete": accounting,
        "candidate_count": len(ids),
        "missing_ids": missing,
        "extra_ids": extra,
        "duplicate_ids": duplicates,
        "dispositions": dict(Counter(r["status"] for r in records)),
        "eligible_length_m": total,
        "unsupported_length_m": unsupported,
        "unsupported_fraction": fraction,
        "by_class": dict(by_class),
        "by_district": dict(by_district),
        "district_coverage_available": district_available,
        "routing_support_pass": accounting
        and fraction is not None
        and fraction <= 0.02
        and distribution
        and district_available
        and not any(r["status"] == "quarantined" for r in records),
        "thresholds": {"overall": 0.02, "each_district_and_class": 0.05},
        "meaning": (
            "Completeness relative to captured source; no real-world completeness "
            "or navigation claim."
        ),
    }
