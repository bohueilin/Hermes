"""Independent source-rule and fractional-motion reconstruction for fleet v2.

No search, router state transition, simulator execution or claimed permission is
used. Indexes narrow source-rule comparisons without changing their semantics.
"""

import math
from collections import defaultdict
from datetime import timedelta

from .continuity_v1 import INITIAL_PLACEMENT, PROFILE, _snapshot
from .contracts import digest, finite
from .fleet_routing_v2 import MODEL, SCHEMA, start_instant


def validate_finite_json(value):
    """Bounded walk avoids allocating another full serialized run for validation."""
    stack = [iter([value])]
    count = 0
    while stack:
        item = next(stack[-1], ...)
        if item is ...:
            stack.pop()
            continue
        count += 1
        if count > 10000000 or len(stack) > 64:
            raise ValueError("run JSON resource bound")
        if isinstance(item, dict):
            if any(not isinstance(key, str) for key in item):
                raise ValueError("non-string JSON key")
            stack.append(iter(item.values()))
        elif isinstance(item, list):
            stack.append(iter(item))
        elif isinstance(item, float) and not math.isfinite(item):
            raise ValueError("nonfinite recorded value")
        elif item is not None and not isinstance(item, (str, int, float, bool)):
            raise ValueError("unsupported JSON value")


def verify_fleet_trace(run, inputs, pack):
    return _verify_fleet_trace(run, inputs, pack, pack, SCHEMA, MODEL)


def _same_position(actual, expected, edges):
    """Exact topology; at most one nanosecond of numerical representation error.

    Producer subtraction and verifier accumulation associate binary floats
    differently. Compare fraction error in seconds too, so very short edges do
    not receive an arbitrary distance/fraction allowance. No clock, edge, or
    history is rounded, substituted, or written back into the evidence.
    """
    if expected is None:
        return actual is None
    if not isinstance(actual, dict) or set(actual) != {"completed_edges", "partial_edge"}:
        return False
    if actual["completed_edges"] != expected["completed_edges"]:
        return False
    observed, target = actual["partial_edge"], expected["partial_edge"]
    if target is None:
        return observed is None
    if not isinstance(observed, dict) or set(observed) != {"id", "elapsed_s", "fraction"}:
        return False
    if observed["id"] != target["id"]:
        return False
    for field in ("elapsed_s", "fraction"):
        value = observed[field]
        if type(value) not in (int, float) or not math.isfinite(value):
            return False
    duration = edges[target["id"]]["seconds"]
    return (
        0 < observed["elapsed_s"] < duration
        and 0 < observed["fraction"] < 1
        and abs(observed["elapsed_s"] - target["elapsed_s"]) <= 1e-9
        and abs(observed["fraction"] * duration - target["elapsed_s"]) <= 1e-9
    )


def _verify_fleet_trace(run, inputs, pack, graph, schema, model):
    issues, entered_count = [], 0
    history_bound, retained_history_peak = None, 0
    try:
        validate_finite_json(run)
        validate_finite_json(inputs)
        _, edge_snapshot, rules = _snapshot(graph)
        edges = {
            e["id"]: {**dict(edge_snapshot[e["id"]]), "length_m": e["length_m"]}
            for e in graph["edges"]
        }
        identity, scenario = digest(pack), digest(run["spec"])
        start = start_instant(run["spec"].get("start_utc"))
        if (
            run.get("schema") != schema
            or run.get("model") != model
            or run["spec"].get("model") != model
            or run.get("pack_digest") != identity
            or run.get("scenario_digest") != scenario
            or run.get("routing_profile") != PROFILE
        ):
            raise ValueError("versioned run/model/pack/scenario identity mismatch")
        if run.get("input_digest") != digest(inputs):
            raise ValueError("frozen input mismatch")
        horizon = run["elapsed_s"]
        if type(horizon) is not int or not 1 <= horizon <= 86400 * 7:
            raise ValueError("unsupported horizon")
        duration = run["spec"]["duration_s"]
        if type(duration) is not int or not horizon <= duration <= 86400 * 7:
            raise ValueError("invalid scenario duration")
        expected_execution = "COMPLETE" if horizon == duration else "INCOMPLETE"
        if run.get("execution") != expected_execution:
            raise ValueError("execution status differs from declared horizon")
        if not isinstance(run["events"], list) or not 1 <= len(run["events"]) <= 1000000:
            raise ValueError("event resource bound")
        node_rules, ending_prefixes, no_ending, only_ending = (
            defaultdict(list),
            defaultdict(set),
            defaultdict(list),
            defaultdict(list),
        )
        history_bound = max([1, *[len(seq) for rule in rules for seq in rule.sequences]])
        for rule in rules:
            if not rule.sequences:
                node_rules[(rule.via, rule.from_way)].append(rule)
            for seq in rule.sequences:
                if rule.kind.startswith("no_"):
                    no_ending[seq[-1]].append((rule.id, seq))
                for k in range(1, len(seq)):
                    prefix = seq[:k]
                    ending_prefixes[prefix[-1]].add(prefix)
                    if rule.kind.startswith("only_"):
                        only_ending[prefix[-1]].append((rule.id, prefix, seq[k]))

        def suffix_matches(history, prefix):
            return len(history) >= len(prefix) and tuple(history[-len(prefix) :]) == prefix

        def state(node, history):
            candidates = ending_prefixes.get(history[-1], ()) if history else ()
            suffix = max((p for p in candidates if suffix_matches(history, p)), key=len, default=())
            return {
                "node": node,
                "pack_digest": identity,
                "profile": PROFILE,
                "incoming_edge": history[-1] if history else None,
                "restriction_prefix": list(suffix),
                "initial_placement": None if history else INITIAL_PLACEMENT,
                "connector": None,
            }

        def traverse(node, history, sequence):
            nonlocal retained_history_peak
            # Only suffixes as long as the longest source restriction can affect
            # the next edge. Retain one edge even with no sequences for node turns.
            history = list(history)
            for eid in sequence:
                edge = edges.get(eid)
                if edge is None or edge["u"] != node:
                    raise ValueError("unknown or disconnected directed edge")
                if history:
                    last = edges[history[-1]]
                    if edge["v"] == last["u"]:
                        raise ValueError("undeclared immediate reversal")
                    for rule in node_rules.get((node, last["way"]), ()):
                        forbidden = rule.kind.startswith("no_") and edge["way"] == rule.to_way
                        required = rule.kind.startswith("only_") and edge["way"] != rule.to_way
                        if forbidden or required:
                            raise ValueError("forbidden node turn " + rule.id)
                    active = defaultdict(set)
                    for rid, prefix, following in only_ending.get(history[-1], ()):
                        if suffix_matches(history, prefix):
                            active[rid].add(following)
                    for rid, allowed in active.items():
                        if eid not in allowed:
                            raise ValueError("only sequence departed " + rid)
                history.append(eid)
                history = history[-history_bound:]
                retained_history_peak = max(retained_history_peak, len(history))
                for rid, seq in no_ending.get(eid, ()):
                    if suffix_matches(history, seq):
                        raise ValueError("forbidden sequence " + rid)
                node = edge["v"]
            return node, history

        initial = {v["id"]: v for v in inputs["initial"]}
        if len(initial) != len(inputs["initial"]) or not initial:
            raise ValueError("duplicate or absent initial vehicle")
        vehicles = {}
        used_legs = set()
        planned_count = 0
        for event in run["events"]:
            vid, kind, t = event.get("vehicle"), event.get("kind"), event["t"]
            if type(t) is not int or not 0 <= t <= horizon:
                raise ValueError("invalid event clock")
            if vid is None:
                continue
            if vid not in initial:
                raise ValueError("foreign vehicle")
            if kind == "initial":
                if vid in vehicles or t != 0 or event.get("node") != initial[vid]["node"]:
                    raise ValueError("invalid/repeated initialization")
                v = {"node": initial[vid]["node"], "history": [], "open": None}
                if event.get("routing_state") != state(v["node"], []):
                    raise ValueError("initial routing state mismatch")
                vehicles[vid] = v
                continue
            if vid not in vehicles:
                raise ValueError("vehicle used before initialization")
            v = vehicles[vid]
            if kind == "leg_start":
                lid = event["leg"]
                if v["open"] is not None or lid in used_legs:
                    raise ValueError("overlapping or reused leg")
                route = run["legs"][lid]
                sequence = route["edges"]
                if not isinstance(sequence, list) or any(not isinstance(e, str) for e in sequence):
                    raise ValueError("malformed planned path")
                planned_count += len(sequence)
                if planned_count > 1000000:
                    raise ValueError("planned edge resource bound")
                if (
                    route.get("arrival_before") != state(v["node"], v["history"])
                    or route.get("scenario_digest") != scenario
                    or route.get("departure_utc") != (start + timedelta(seconds=t)).isoformat()
                ):
                    raise ValueError("route departure state/context mismatch")
                end, predicted = traverse(v["node"], v["history"], sequence)
                if route.get("arrival_after") != state(end, predicted):
                    raise ValueError("planned arrival state mismatch")
                if route["nodes"] != [v["node"], *[edges[e]["v"] for e in sequence]]:
                    raise ValueError("route nodes do not describe source edges")
                used_legs.add(lid)
                v["open"] = (lid, t)
            elif kind == "leg_end":
                if v["open"] is None or v["open"][0] != event["leg"]:
                    raise ValueError("arrival lacks owned leg")
                route = run["legs"][event["leg"]]
                duration = sum(edges[e]["seconds"] for e in route["edges"])
                if t != v["open"][1] + max(1, math.ceil(duration - 1e-10)):
                    raise ValueError("arrival time mismatch")
                v["node"], v["history"] = traverse(v["node"], v["history"], route["edges"])
                entered_count += len(route["edges"])
                if event.get("routing_state") != state(v["node"], v["history"]):
                    raise ValueError("arrival recorded history mismatch")
                v["open"] = None
            elif kind == "state":
                if event.get("routing_state") != state(v["node"], v["history"]):
                    raise ValueError("stop/state transition erased incoming history")
        if set(vehicles) != set(initial) or used_legs != set(run["legs"]):
            raise ValueError("vehicle/leg inventory mismatch")
        final = {v["id"]: v for v in run["final"]["vehicles"]}
        if set(final) != set(initial) or len(final) != len(run["final"]["vehicles"]):
            raise ValueError("final vehicle inventory mismatch")
        for vid, v in vehicles.items():
            observed = final[vid]
            if "routing_position" not in observed:
                raise ValueError("missing explicit final position availability")
            position = None
            if v["open"]:
                lid, began = v["open"]
                route = run["legs"][lid]
                elapsed = horizon - began
                if elapsed < 0 or elapsed >= max(1, math.ceil(route["seconds"] - 1e-10)):
                    raise ValueError("missing completed leg arrival or future departure")
                whole, partial = [], None
                time_used = 0.0
                for eid in route["edges"]:
                    duration = finite(edges[eid]["seconds"], 0.000001, 86400)
                    if time_used + duration <= elapsed + 1e-10:
                        whole.append(eid)
                        time_used += duration
                    else:
                        fraction = (elapsed - time_used) / duration
                        if fraction > 1e-10:
                            partial = {
                                "id": eid,
                                "elapsed_s": elapsed - time_used,
                                "fraction": fraction,
                            }
                        break
                v["node"], v["history"] = traverse(v["node"], v["history"], whole)
                entered_count += len(whole)
                if partial:
                    # Validate entering the edge, but never move the actual node to its end.
                    traverse(v["node"], v["history"], [partial["id"]])
                    entered_count += 1
                position = {"completed_edges": whole, "partial_edge": partial}
                if observed.get("leg") != lid:
                    raise ValueError("final open leg mismatch")
            elif observed.get("leg") is not None:
                raise ValueError("final leg invented")
            if not _same_position(observed.get("routing_position"), position, edges):
                raise ValueError(
                    "final partial-edge position differs from clock and source durations"
                )
            if observed.get("node") != v["node"] or observed.get("routing_state") != state(
                v["node"], v["history"]
            ):
                raise ValueError("final actual arrival/history mismatch")
    except (ValueError, KeyError, TypeError, AttributeError, OverflowError) as exc:
        issues.append(str(exc))
    return {
        "status": "INVALID_EVIDENCE" if issues else "INTERNALLY_CONSISTENT",
        "issues": issues,
        "entered_edge_count": entered_count,
        "retained_history_peak_edges": retained_history_peak,
        "history_bound_edges": history_bound,
        "verifier": "fleetlab.fleet-continuity-verifier/2.0.1",
    }
