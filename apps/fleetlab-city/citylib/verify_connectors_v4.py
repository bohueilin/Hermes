"""Independent connector records plus full source-rule/time/energy verification."""

from .continuity_v1 import PROFILE
from .contracts import digest
from .depot_connectors_v1 import MODEL, SCHEMA, registry
from .ledger_temporal_v3 import check_ledger
from .temporal_import_v3 import validated_graph
from .verify_continuity_v2 import _verify_core
from .verify_temporal_v3 import _verify_routing


def _routing(run, inputs, pack):
    result = _verify_routing(
        run, inputs, pack, schema=SCHEMA, model=MODEL, connector_declarations=True
    )
    counts = {"planned": 0, "completed": 0, "partial": 0, "not_entered": 0}
    try:
        declared = {key: (d, review) for key, d, review in registry(pack, run["spec"])}
        identity = digest(pack)
        starts = {e["leg"]: e["t"] for e in run["events"] if e["kind"] == "leg_start"}
        prefixes = {
            tuple(s[:k])
            for rule in pack["turns"]
            for s in rule.get("edge_sequences", [])
            for k in range(1, len(s))
        }
        for lid, route in run["legs"].items():
            before = route["arrival_before"]
            if route["nodes"][-1] == before["node"] and route["edges"]:
                raise ValueError("nonempty same-endpoint leg cannot substitute for a zero leg")
            key = (before["node"], before["incoming_edge"], tuple(before["restriction_prefix"]))
            matched = declared.get(key) if route["nodes"][-1] != before["node"] else None
            expected = None
            if matched is not None:
                declaration, review = matched
                path = declaration["edges"]
                if route["edges"][: len(path)] != path:
                    raise ValueError("required connector path omitted or substituted")
                history = list(before["restriction_prefix"] or [before["incoming_edge"]]) + path
                prefix = max(
                    (
                        p
                        for p in prefixes
                        if len(p) <= len(history) and tuple(history[-len(p) :]) == p
                    ),
                    key=len,
                    default=(),
                )
                after = {
                    "node": before["node"],
                    "pack_digest": identity,
                    "profile": PROFILE,
                    "incoming_edge": path[-1],
                    "restriction_prefix": list(prefix),
                    "initial_placement": None,
                    "connector": None,
                }
                expected = {
                    "evidence": "PLANNED_PREFIX",
                    "id": declaration["id"],
                    "declaration_digest": digest(declaration),
                    "review_digest": digest(review),
                    "pack_digest": identity,
                    "scenario_core_digest": declaration["scenario_core_digest"],
                    "arrival_before": before,
                    "arrival_after": after,
                    "duration_ms": declaration["duration_ms"],
                    "length_m": declaration["length_m"],
                    "provenance": declaration["provenance"],
                }
                counts["planned"] += 1
                elapsed_ms = (run["elapsed_s"] - starts[lid]) * 1000
                counts[
                    "completed"
                    if elapsed_ms >= declaration["duration_ms"]
                    else "partial"
                    if elapsed_ms > 0
                    else "not_entered"
                ] += 1
            if "connector_transition" not in route or route["connector_transition"] != expected:
                raise ValueError("connector transition differs from scenario and source history")
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        result["issues"].append(str(exc))
    result["connectors"] = counts
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
            routing_verifier=_routing,
            ledger_reducer=check_ledger,
        )
        report["verifier"] = "fleetlab.city-depot-connector-verifier/4.0.0"
        return report
    except (
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        IndexError,
        OverflowError,
        ZeroDivisionError,
    ) as exc:
        return {
            "valid": False,
            "verification": "INVALID",
            "execution": "NOT_AVAILABLE",
            "model_checks_passed": False,
            "recommendation_eligible": False,
            "map_qualification": "NOT_EVALUATED",
            "metrics": None,
            "findings": [{"code": "malformed_connector_run", "detail": str(exc)}],
            "finding_count": 1,
            "authenticity": "NOT_AUTHENTICATED",
            "scope": "SIMULATION_ONLY",
            "decision_authority": "NONE",
            "verifier": "fleetlab.city-depot-connector-verifier/4.0.0",
        }
