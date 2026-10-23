"""Versioned bounded OSM way-chain compilation and independent path inspection.

Only unique connectors and simple ordered via ways are supported. Conditional,
ambiguous, disconnected, or unknown forms retain conservative from-way blocking.
"""

from collections import defaultdict
from itertools import groupby

PROFILE = "edge-sequence/2.0.0"
KINDS = {
    "no_left_turn",
    "no_right_turn",
    "no_straight_on",
    "no_u_turn",
    "only_left_turn",
    "only_right_turn",
    "only_straight_on",
    "only_u_turn",
}


def directed_segments(way):
    tags = way.get("tags", {})
    direction = tags.get("oneway", "yes" if tags.get("junction") == "roundabout" else "no")
    if direction not in {"yes", "no", "1", "0", "-1", "true", "false"}:
        raise ValueError("unsupported member direction")
    for i, (a, b) in enumerate(zip(way["nodes"], way["nodes"][1:], strict=False)):
        if a == b:
            continue
        if direction not in {"-1"}:
            yield a, b, f"{way['id']}:{i}:f"
        if direction not in {"yes", "1", "true"}:
            yield b, a, f"{way['id']}:{i}:r"


def compile_sequence(rule, ways):
    """Return exact directed alternatives or raise; never guess relation geometry."""
    via = rule.get("via_way", [])
    if (
        rule.get("conditional")
        or rule.get("malformed")
        or rule.get("via")
        or rule.get("kind") not in KINDS
        or not 1 <= len(via) <= 8
    ):
        raise ValueError("unsupported restriction form")
    ids = [rule.get("from"), *via, rule.get("to")]
    if len(set(ids)) != len(ids) or any(i not in ways for i in ids):
        raise ValueError("missing or repeated member way")
    members = [ways[i] for i in ids]
    if any(len(w["nodes"]) != len(set(w["nodes"])) for w in members):
        raise ValueError("non-simple member geometry")
    joins = [set(a["nodes"]) & set(b["nodes"]) for a, b in zip(members, members[1:], strict=False)]
    if any(len(j) != 1 for j in joins):
        raise ValueError("disconnected or ambiguous member connector")
    connectors = [next(iter(j)) for j in joins]
    if len(set(connectors)) != len(connectors):
        raise ValueError("repeated connector")
    middle = []
    for way, start, end in zip(members[1:-1], connectors, connectors[1:], strict=False):
        ns = way["nodes"]
        i, j = ns.index(start), ns.index(end)
        step = 1 if j > i else -1
        segment = ns[i : j + step : step] if j + step >= 0 else ns[i::-1]
        edge_map = {(a, b): eid for a, b, eid in directed_segments(way)}
        try:
            middle.extend(edge_map[(a, b)] for a, b in zip(segment, segment[1:], strict=False))
        except KeyError as exc:
            raise ValueError("via chain opposes declared direction") from exc
    incoming = [eid for _, v, eid in directed_segments(members[0]) if v == connectors[0]]
    outgoing = [eid for u, _, eid in directed_segments(members[-1]) if u == connectors[-1]]
    if not incoming or not outgoing or not middle or len(middle) > 256:
        raise ValueError("untraversable or excessive member chain")
    sequences = sorted([a, *middle, b] for a in incoming for b in outgoing)
    return {**rule, "edge_sequences": sequences, "semantics": PROFILE}


def validate_profile(pack):
    profile = pack.get("routing_profile", "node-via/1.0.0")
    if profile not in {"node-via/1.0.0", PROFILE}:
        raise ValueError("unsupported routing profile")
    if pack.get("schema") != "fleetlab.city-pack/1.0.0":
        raise ValueError("unsupported graph schema")
    if any("edge_sequences" in r for r in pack["turns"]) and profile != PROFILE:
        raise ValueError("sequence rules require versioned routing profile")
    for rule in pack["turns"]:
        if "edge_sequences" in rule:
            validate_compiled_rule(rule)
    return profile


def validate_compiled_rule(rule):
    """Reject anything beyond compile_sequence's simple, bounded output subset."""
    sequences = rule.get("edge_sequences")
    via = rule.get("via_way")
    if (
        rule.get("semantics") != PROFILE
        or rule.get("kind") not in KINDS
        or rule.get("conditional")
        or rule.get("malformed")
        or rule.get("via")
        or not isinstance(via, list)
        or not 1 <= len(via) <= 8
        or not all(isinstance(w, str) and w for w in via)
        or not isinstance(sequences, list)
        or not 1 <= len(sequences) <= 4
    ):
        raise ValueError("unsupported compiled restriction schema or bounds")
    members = [rule.get("from"), *via, rule.get("to")]
    if not all(isinstance(w, str) and w for w in members) or len(set(members)) != len(members):
        raise ValueError("invalid compiled restriction members")
    middle = None
    seen = set()
    for seq in sequences:
        if not isinstance(seq, list) or not 3 <= len(seq) <= 258:
            raise ValueError("compiled restriction sequence exceeds bounds")
        if not all(isinstance(e, str) for e in seq) or len(set(seq)) != len(seq):
            raise ValueError("compiled restriction sequence repeats an edge")
        if tuple(seq) in seen:
            raise ValueError("duplicate compiled restriction sequence")
        seen.add(tuple(seq))
        parts = [e.rsplit(":", 2) for e in seq]
        if any(len(p) != 3 or not p[1].isdigit() or p[2] not in {"f", "r"} for p in parts):
            raise ValueError("invalid compiled source edge ID")
        if (
            parts[0][0] != members[0]
            or parts[-1][0] != members[-1]
            or [way for way, _ in groupby(p[0] for p in parts[1:-1])] != via
        ):
            raise ValueError("compiled sequence differs from declared member order")
        if middle is not None and seq[1:-1] != middle:
            raise ValueError("compiled alternatives have different via chains")
        middle = seq[1:-1]


def validate_path(pack, edge_ids):
    """Return violation strings using direct sequence comparison, not router state.

    A path may end partway through an only restriction. Independent trip legs do
    not carry incoming history; fleet execution requires a separate continuity gate.
    """
    validate_profile(pack)
    edges = {e["id"]: e for e in pack["edges"]}
    issues = []
    node_rules = defaultdict(list)
    for r in pack["turns"]:
        if "edge_sequences" not in r:
            node_rules[(r["via"], r["from"])].append(r)
    last = None
    for eid in edge_ids:
        edge = edges.get(eid)
        if edge is None:
            issues.append("unknown source edge")
            last = None
            continue
        if last:
            if last["v"] != edge["u"]:
                issues.append("disconnected edge sequence")
            if last["u"] == edge["v"]:
                issues.append("undeclared immediate U-turn")
            for r in node_rules[(edge["u"], last["way"])]:
                if (r["kind"].startswith("no_") and r["to"] == edge["way"]) or (
                    r["kind"].startswith("only_") and r["to"] != edge["way"]
                ):
                    issues.append(f"forbidden node turn: {r['id']}")
        last = edge
    for r in pack["turns"]:
        sequences = r.get("edge_sequences", [])
        for i, eid in enumerate(edge_ids):
            matches = [s for s in sequences if s[0] == eid]
            if not matches:
                continue
            if r["kind"].startswith("no_"):
                if any(edge_ids[i : i + len(s)] == s for s in matches):
                    issues.append(f"forbidden via-way sequence: {r['id']}")
            elif not any(edge_ids[i : i + len(s)] == s[: len(edge_ids) - i] for s in matches):
                issues.append(f"required via-way sequence departed: {r['id']}")
    return issues


class SequenceMachine:
    """Finite active-prefix state; alternatives within each relation are a union."""

    def __init__(self, rules):
        self.rules = [r for r in rules if "edge_sequences" in r]
        self.starts = defaultdict(list)
        for ri, rule in enumerate(self.rules):
            for si, seq in enumerate(rule["edge_sequences"]):
                self.starts[seq[0]].append((ri, si, 1))

    def advance(self, active, eid):
        next_active = []
        only = defaultdict(list)
        for ri, si, pos in active:
            rule = self.rules[ri]
            seq = rule["edge_sequences"][si]
            matches = seq[pos] == eid
            if rule["kind"].startswith("only_"):
                only[ri].append(matches)
            if matches:
                if pos + 1 == len(seq):
                    if rule["kind"].startswith("no_"):
                        return None
                else:
                    next_active.append((ri, si, pos + 1))
        if any(not any(allowed) for allowed in only.values()):
            return None
        return tuple(sorted(set(next_active + self.starts[eid])))
