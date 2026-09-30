"""Independent per-edge time/access replay plus shared fleet accounting.

Does not import or instantiate the temporal router, its schedules or its search.
Raw expressions are evaluated at reconstructed UTC instants and every intervening
minute boundary; producer entry/exit clocks are evidence to check, not authority.
"""

from collections import defaultdict
from datetime import timedelta

from .conditional_access_v1 import evaluate_condition, parse_condition
from .fleet_routing_v2 import start_instant
from .fleet_trace_v2 import _verify_fleet_trace
from .temporal_import_v3 import ALLOW, CONTEXT, MODES, validated_graph
from .verify_continuity_v2 import _verify_core

MODEL = "fleetlab.graph-resource-temporal/3.0.0"
SCHEMA = "fleetlab.city-temporal-run/3.0.0"


def _verify_routing(run, inputs, pack):
    graph = validated_graph(pack)
    result = _verify_fleet_trace(run, inputs, pack, graph, SCHEMA, MODEL)
    try:
        spec = run["spec"]
        if (
            spec.get("vehicle_class") != "passenger_car"
            or spec.get("timezone") != CONTEXT["timezone"]
        ):
            raise ValueError("temporal class/timezone mismatch")
        horizon = spec["route_horizon_s"]
        if type(horizon) is not int or not 1 <= horizon <= 7200:
            raise ValueError("unsupported temporal journey horizon")
        edges = {e["id"]: e for e in graph["edges"]}
        turns, access = defaultdict(list), {r["way"]: r["tags"] for r in pack["temporal"]["access"]}
        node_access = {r["node"]: r["tags"] for r in pack["temporal"]["nodes"]}
        predicates = {}
        for rule in pack["temporal"]["turns"]:
            turns[(rule["via"], rule["from"], rule["to"])].append(rule["raw"]["tags"][rule["key"]])

        def active(expression, at):
            if expression not in predicates:
                predicates[expression] = parse_condition(expression)
            return evaluate_condition(
                predicates[expression],
                at,
                vehicle_class="passenger_car",
                timezone_name=CONTEXT["timezone"],
            ).active

        start = start_instant(spec["start_utc"])
        starts = {e["leg"]: e for e in run["events"] if e["kind"] == "leg_start"}
        checked = 0
        for lid, route in run["legs"].items():
            t = start + timedelta(seconds=starts[lid]["t"])
            incoming = route["arrival_before"]["incoming_edge"]
            expected, elapsed_ms = [], 0
            for eid in route["edges"]:
                edge = edges[eid]
                at = t + timedelta(milliseconds=elapsed_ms)
                exit_at = at + timedelta(milliseconds=edge["duration_ms"])
                for node, point in ((edge["u"], at), (edge["v"], exit_at)):
                    tags = node_access.get(node, {})
                    for mode in MODES:
                        raw = tags.get(mode + ":conditional")
                        if raw and active(raw, point):
                            raise ValueError("node access prohibited at reconstructed passage")
                        if mode in tags:
                            if tags[mode] not in ALLOW:
                                raise ValueError("node base access prohibited")
                            break
                expected.append(
                    {"edge": eid, "entry_utc": at.isoformat(), "exit_utc": exit_at.isoformat()}
                )
                if incoming and any(
                    active(raw, at)
                    for raw in turns.get((edge["u"], edges[incoming]["way"], edge["way"]), ())
                ):
                    raise ValueError("conditional turn prohibited at reconstructed entry")
                tags = access.get(edge["way"])
                if tags:
                    points = [at]
                    cursor = at.replace(second=0, microsecond=0) + timedelta(minutes=1)
                    while cursor < exit_at:
                        points.append(cursor)
                        cursor += timedelta(minutes=1)
                    for point in points:
                        value = "yes"
                        for mode in MODES:
                            raw = tags.get(mode + ":conditional")
                            if raw and active(raw, point):
                                value = "no"
                                break
                            if mode in tags:
                                value = tags[mode]
                                break
                        if value not in ALLOW:
                            raise ValueError(
                                "conditional access overlaps reconstructed edge occupancy"
                            )
                elapsed_ms += edge["duration_ms"]
                incoming = eid
                checked += 1
            if elapsed_ms > horizon * 1000 or route.get("temporal_entries") != expected:
                raise ValueError("temporal edge clocks/horizon mismatch")
        result["planned_temporal_edge_checks"] = checked
    except (ValueError, KeyError, TypeError, AttributeError, OverflowError) as exc:
        result["issues"].append(str(exc))
    result["status"] = "INVALID_EVIDENCE" if result["issues"] else "INTERNALLY_CONSISTENT"
    return result


def verify(run, inputs, pack):
    try:
        report = _verify_core(
            run,
            inputs,
            pack,
            graph=validated_graph(pack),
            schema=SCHEMA,
            routing_verifier=_verify_routing,
        )
        report["verifier"] = "fleetlab.city-temporal-event-verifier/3.0.0"
        return report
    except (
        KeyError,
        TypeError,
        ValueError,
        IndexError,
        ZeroDivisionError,
        OverflowError,
        AttributeError,
    ) as exc:
        return {
            "valid": False,
            "verification": "INVALID",
            "execution": "NOT_AVAILABLE",
            "model_checks_passed": False,
            "recommendation_eligible": False,
            "map_qualification": "NOT_EVALUATED",
            "metrics": None,
            "findings": [{"code": "malformed_temporal_run", "detail": str(exc)}],
            "finding_count": 1,
            "authenticity": "NOT_AUTHENTICATED",
            "scope": "SIMULATION_ONLY",
            "decision_authority": "NONE",
            "verifier": "fleetlab.city-temporal-event-verifier/3.0.0",
        }
