"""Bounded scenario declarations; review identity is not authentication or permission."""

import copy
import math

from .contracts import digest

MODEL = "fleetlab.graph-resource-depot-connectors/4.0.0"
SCHEMA = "fleetlab.city-depot-connector-run/4.0.0"
FIELDS = {"depot_connectors", "connector_reviews"}


def scenario_core(spec):
    return {k: v for k, v in spec.items() if k not in FIELDS}


def _text(value):
    return isinstance(value, str) and 0 < len(value) <= 512


def registry(pack, spec):
    """Validate declarations against an already validated temporal graph.

    This checks structure and identity, never turn/access permission. Execution
    and verification check those independently from the graph's source rules.
    """
    try:
        return _registry(pack, spec)
    except (KeyError, TypeError, AttributeError, OverflowError) as exc:
        raise ValueError("malformed connector declaration or review") from exc


def _registry(pack, spec):
    if spec.get("model") != MODEL:
        raise ValueError("connector model identity required")
    declarations, reviews = spec.get("depot_connectors"), spec.get("connector_reviews")
    if not isinstance(declarations, list) or not 1 <= len(declarations) <= 32:
        raise ValueError("one to 32 explicit connector declarations required")
    if not isinstance(reviews, list) or len(reviews) != len(declarations):
        raise ValueError("one review per connector required")
    sites = {s["id"]: s["node"] for s in spec["sites"]}
    if len(sites) != len(spec["sites"]):
        raise ValueError("duplicate depot identity")
    edges = {e["id"]: e for e in pack["edges"]}
    identity, core_digest = digest(pack), digest(scenario_core(spec))
    prefixes = {
        tuple(s[:k])
        for rule in pack["turns"]
        for s in rule.get("edge_sequences", [])
        for k in range(1, len(s))
    }
    accepted = {}
    for review in reviews:
        if (
            not isinstance(review, dict)
            or set(review)
            != {"connector_id", "declaration_digest", "method", "decision", "reference"}
            or review["method"] not in {"CONTRACT_FIXTURE", "RECORDED_REVIEW"}
            or review["decision"] != "ACCEPTED_AS_MODEL_ASSUMPTION"
            or not _text(review["reference"])
            or not _text(review["connector_id"])
            or review["connector_id"] in accepted
        ):
            raise ValueError("unsupported or duplicate connector review")
        accepted[review["connector_id"]] = review
    rows, ids, triggers = [], set(), set()
    for d in declarations:
        if (
            not isinstance(d, dict)
            or set(d)
            != {
                "id",
                "pack_digest",
                "scenario_core_digest",
                "site_id",
                "trigger",
                "edges",
                "duration_ms",
                "length_m",
                "provenance",
            }
            or not _text(d["id"])
            or d["id"] in ids
            or d["pack_digest"] != identity
            or d["scenario_core_digest"] != core_digest
            or d["site_id"] not in sites
        ):
            raise ValueError("connector identity or scenario mismatch")
        ids.add(d["id"])
        node, trigger = sites[d["site_id"]], d["trigger"]
        if not isinstance(trigger, dict) or set(trigger) != {"incoming_edge", "restriction_prefix"}:
            raise ValueError("exact connector trigger required")
        incoming, prefix = trigger["incoming_edge"], trigger["restriction_prefix"]
        if (
            not isinstance(incoming, str)
            or incoming not in edges
            or edges[incoming]["v"] != node
            or not isinstance(prefix, list)
            or len(prefix) > 257
            or any(not isinstance(e, str) for e in prefix)
            or prefix
            and (tuple(prefix) not in prefixes or prefix[-1] != incoming)
            or not prefix
            and (incoming,) in prefixes
        ):
            raise ValueError("invalid connector arrival trigger")
        key = (node, incoming, tuple(prefix))
        if key in triggers:
            raise ValueError("ambiguous connector trigger")
        triggers.add(key)
        sequence = d["edges"]
        if not isinstance(sequence, list) or not 1 <= len(sequence) <= 256:
            raise ValueError("connector path bound")
        cursor, milliseconds, metres = node, 0, 0.0
        for eid in sequence:
            if not isinstance(eid, str) or eid not in edges or edges[eid]["u"] != cursor:
                raise ValueError("connector is not a connected source path")
            e = edges[eid]
            cursor = e["v"]
            milliseconds += e["duration_ms"]
            metres += e["length_m"]
        if (
            cursor != node
            or type(d["duration_ms"]) is not int
            or d["duration_ms"] != milliseconds
            or milliseconds > spec["route_horizon_s"] * 1000
            or type(d["length_m"]) not in (int, float)
            or not math.isfinite(d["length_m"])
            or d["length_m"] != metres
        ):
            raise ValueError("connector endpoint or declared source cost differs")
        provenance = d["provenance"]
        if (
            not isinstance(provenance, dict)
            or set(provenance) != {"kind", "reference", "limitations"}
            or provenance["kind"] != "DECLARED_SCENARIO_ASSUMPTION"
            or not all(_text(provenance[k]) for k in ("reference", "limitations"))
        ):
            raise ValueError("explicit bounded connector provenance required")
        review = accepted.get(d["id"])
        if review is None or review["declaration_digest"] != digest(d):
            raise ValueError("missing or stale connector review")
        rows.append((key, copy.deepcopy(d), copy.deepcopy(review)))
    if set(accepted) != ids:
        raise ValueError("review/declaration inventory mismatch")
    return rows
