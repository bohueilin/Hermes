"""Hand-checkable stop-history fixtures for a standalone, unintegrated router."""

import importlib
import importlib.util
import sys
import unittest
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def tiny_pack(kind="no_left_turn"):
    nodes = {n: [i * 0.001, 0] for i, n in enumerate("abcdfx")}
    specs = [
        ("from:0:f", "a", "b", "from"),
        ("via:0:f", "b", "c", "via"),
        ("to:0:f", "c", "d", "to"),
        ("other:0:f", "f", "b", "other"),
        ("branch:0:f", "c", "x", "branch"),
        ("exit:0:f", "x", "d", "exit"),
        ("via:0:r", "c", "b", "via"),
    ]
    return {
        "schema": "fleetlab.city-pack/1.0.0",
        "routing_profile": "edge-sequence/2.0.0",
        "nodes": nodes,
        "edges": [
            {
                "id": e,
                "u": u,
                "v": v,
                "way": w,
                "seconds": 10.0,
                "length_m": 100.0,
                "speed_mps": 10.0,
            }
            for e, u, v, w in specs
        ],
        "turns": [
            {
                "id": "r1",
                "from": "from",
                "to": "to",
                "via": None,
                "via_way": ["via"],
                "kind": kind,
                "semantics": "edge-sequence/2.0.0",
                "edge_sequences": [["from:0:f", "via:0:f", "to:0:f"]],
            }
        ],
    }


class ContinuityTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("citylib.continuity_v1"))
        self.api = importlib.import_module("citylib.continuity_v1")
        self.pack = tiny_pack()
        self.router = self.api.ContinuityRouter(self.pack, scenario_digest="1" * 64)
        self.context = self.router.context(datetime(2026, 9, 29, 14, tzinfo=UTC))

    def route(self, start, end, arrival=None, **kwargs):
        return self.router.route(
            start, end, arrival or self.router.initial(start), self.context, **kwargs
        )

    def initial_event(self, node="a", vehicle="v"):
        return {
            "kind": "initial",
            "vehicle": vehicle,
            "node": node,
            "initial_placement": "DECLARED_INITIAL_NODE_PLACEMENT",
        }

    def leg(
        self,
        start,
        end,
        executed,
        before=None,
        after=None,
        prefix_before=(),
        prefix_after=(),
        planned=None,
        completed=True,
        vehicle="v",
    ):
        return {
            "kind": "leg",
            "vehicle": vehicle,
            "start": start,
            "end": end,
            "executed_edges": list(executed),
            "planned_edges": list(executed if planned is None else planned),
            "completed": completed,
            "incoming_before": before,
            "incoming_after": after,
            "prefix_before": list(prefix_before),
            "prefix_after": list(prefix_after),
        }

    def verify(self, events):
        return self.api.verify_executed_prefix(self.pack, self.context, events)

    def test_prohibited_sequence_split_at_pickup_still_fails_verification(self):
        path = ["from:0:f", "via:0:f", "to:0:f"]
        whole = [self.initial_event(), self.leg("a", "d", path, after="to:0:f")]
        split = [
            self.initial_event(),
            self.leg("a", "c", path[:2], after="via:0:f", prefix_after=path[:2]),
            {
                "kind": "stop",
                "vehicle": "v",
                "node": "c",
                "incoming_before": "via:0:f",
                "incoming_after": "via:0:f",
                "prefix_before": path[:2],
                "prefix_after": path[:2],
                "reason": "pickup",
            },
            self.leg("c", "d", path[2:], before="via:0:f", after="to:0:f", prefix_before=path[:2]),
        ]
        for events in [whole, split]:
            for event in events:
                event["legal"] = True
            result = self.verify(events)
            self.assertEqual(result.status, "INVALID_EVIDENCE")
            self.assertTrue(any("r1" in i for i in result.issues))

    def test_only_prefix_survives_zero_leg_and_boarding(self):
        self.pack = tiny_pack("only_straight_on")
        self.router = self.api.ContinuityRouter(self.pack, scenario_digest="1" * 64)
        self.context = self.router.context(self.context.departure)
        arrived = self.route("a", "c").arrival
        zero = self.route("c", "c", arrived)
        self.assertEqual(zero.arrival, arrived)
        self.assertEqual(zero.seconds, 0.0)
        self.assertEqual(self.route("c", "x", zero.arrival).status, "NO_MODELED_CONTINUATION")
        self.assertEqual(self.route("c", "d", zero.arrival).edges, ("to:0:f",))
        events = [
            self.initial_event(),
            self.leg(
                "a",
                "c",
                ["from:0:f", "via:0:f"],
                after="via:0:f",
                prefix_after=["from:0:f", "via:0:f"],
            ),
            self.leg(
                "c",
                "c",
                [],
                before="via:0:f",
                after="via:0:f",
                prefix_before=["from:0:f", "via:0:f"],
                prefix_after=["from:0:f", "via:0:f"],
            ),
            {
                "kind": "stop",
                "vehicle": "v",
                "node": "c",
                "incoming_before": "via:0:f",
                "incoming_after": "via:0:f",
                "prefix_before": ["from:0:f", "via:0:f"],
                "prefix_after": ["from:0:f", "via:0:f"],
                "reason": "boarding",
            },
            self.leg(
                "c",
                "x",
                ["branch:0:f"],
                before="via:0:f",
                after="branch:0:f",
                prefix_before=["from:0:f", "via:0:f"],
            ),
        ]
        self.assertEqual(self.verify(events).status, "INVALID_EVIDENCE")

    def test_valid_dropoff_continuation_equals_unsplit_path_and_cost(self):
        first = self.route("a", "c")
        next_leg = self.route("c", "d", first.arrival)
        whole = self.route("a", "d")
        self.assertEqual(first.edges, ("from:0:f", "via:0:f"))
        self.assertEqual(next_leg.edges, ("branch:0:f", "exit:0:f"))
        self.assertEqual(first.edges + next_leg.edges, whole.edges)
        self.assertEqual(first.seconds + next_leg.seconds, whole.seconds)
        self.assertEqual(whole.seconds, 40.0)

    def test_incoming_state_cache_separates_two_vehicles_at_one_node(self):
        a = self.route("a", "c").arrival
        b = self.route("f", "c").arrival
        self.assertEqual(self.route("c", "d", a).edges, ("branch:0:f", "exit:0:f"))
        self.assertEqual(self.route("c", "d", b).edges, ("to:0:f",))
        self.assertEqual(self.route("c", "d", a).seconds, 20.0)

    def test_dead_end_has_no_implicit_reversal(self):
        pack = tiny_pack()
        pack["turns"] = []
        pack["edges"] = [e for e in pack["edges"] if e["way"] == "via"]
        self.router = self.api.ContinuityRouter(pack, scenario_digest="1" * 64)
        self.context = self.router.context(self.context.departure)
        arrived = self.route("b", "c").arrival
        result = self.route("c", "b", arrived)
        self.assertEqual(result.status, "NO_MODELED_CONTINUATION")
        self.assertIn("immediate reversal", str(result.rejected_choices))
        self.assertEqual(self.route("c", "b").status, "ROUTE")

    def test_connectors_are_explicitly_unsupported_even_with_matching_identity(self):
        arrived = self.route("a", "c").arrival
        for record in [
            {
                "id": "depot",
                "pack_digest": self.context.pack_digest,
                "scenario_digest": self.context.scenario_digest,
                "seconds": 0.0,
            },
            {"id": "stale"},
            {},
        ]:
            changed = replace(arrived, connector=record)
            self.assertEqual(self.route("c", "d", changed).status, "UNSUPPORTED_CONTEXT")
        self.assertEqual(
            self.verify(
                [self.initial_event(), {"kind": "connector", "vehicle": "v", "id": "depot"}]
            ).status,
            "INVALID_EVIDENCE",
        )

    def test_horizon_verifies_only_executed_prefix_and_stops_that_vehicle(self):
        events = [
            self.initial_event(),
            self.leg(
                "a",
                "c",
                ["from:0:f", "via:0:f"],
                after="via:0:f",
                prefix_after=["from:0:f", "via:0:f"],
                planned=["from:0:f", "via:0:f", "to:0:f"],
                completed=False,
            ),
        ]
        result = self.verify(events)
        self.assertEqual(result.status, "INTERNALLY_CONSISTENT")
        self.assertEqual(result.executed_edge_count, 2)
        self.assertEqual(
            self.verify(events + [self.leg("c", "d", ["to:0:f"])]).status, "INVALID_EVIDENCE"
        )
        events[1]["executed_edges"] = ["other:0:f"]
        self.assertEqual(self.verify(events).status, "INVALID_EVIDENCE")

    def test_identity_history_mismatch_and_search_overflow_fail_closed(self):
        arrived = self.route("a", "c").arrival
        for changed in [
            replace(arrived, pack_digest="0" * 64),
            replace(arrived, profile="future"),
            replace(arrived, restriction_prefix=("missing",)),
            replace(arrived, restriction_prefix=("from:0:f",)),
            replace(arrived, restriction_prefix=("from:0:f",) * 300),
        ]:
            self.assertEqual(self.route("c", "d", changed).status, "UNSUPPORTED_CONTEXT")
        for context in [
            replace(self.context, scenario_digest="0" * 64),
            replace(self.context, profile="future"),
            replace(self.context, vehicle_class="psv"),
        ]:
            self.assertEqual(
                self.router.route("a", "d", self.router.initial("a"), context).status,
                "UNSUPPORTED_CONTEXT",
            )
        small = self.api.ContinuityRouter(self.pack, scenario_digest="1" * 64, max_states=1)
        result = small.route("a", "d", small.initial("a"), small.context(self.context.departure))
        self.assertEqual(result.status, "UNSUPPORTED_CONTEXT")
        self.assertIn("budget", result.reason)

    def test_astar_and_dijkstra_match_for_every_pair_and_arrival_context(self):
        for start in self.pack["nodes"]:
            for end in self.pack["nodes"]:
                a = self.route(start, end, algorithm="astar")
                d = self.route(start, end, algorithm="dijkstra")
                self.assertEqual((a.status, a.seconds), (d.status, d.seconds))
        at_c = self.route("a", "c").arrival
        a = self.route("c", "d", at_c, algorithm="astar")
        d = self.route("c", "d", at_c, algorithm="dijkstra")
        self.assertEqual((a.status, a.seconds), (d.status, d.seconds))

    def test_verifier_detects_reset_disconnection_and_repeat_initial(self):
        first = self.leg(
            "a", "c", ["from:0:f", "via:0:f"], after="via:0:f", prefix_after=["from:0:f", "via:0:f"]
        )
        for bad in [
            self.initial_event("c"),
            self.leg("c", "d", ["to:0:f"], after="to:0:f"),
            self.leg("x", "d", ["exit:0:f"], before="via:0:f", after="exit:0:f"),
        ]:
            self.assertEqual(
                self.verify([self.initial_event(), first, bad]).status, "INVALID_EVIDENCE"
            )

    def test_verifier_accepts_interleaved_vehicles_and_preserved_stop(self):
        events = [
            self.initial_event(),
            self.initial_event("f", "w"),
            self.leg("a", "b", ["from:0:f"], after="from:0:f", prefix_after=["from:0:f"]),
            self.leg("f", "d", ["other:0:f", "via:0:f", "to:0:f"], after="to:0:f", vehicle="w"),
            {
                "kind": "stop",
                "vehicle": "v",
                "node": "b",
                "incoming_before": "from:0:f",
                "incoming_after": "from:0:f",
                "prefix_before": ["from:0:f"],
                "prefix_after": ["from:0:f"],
            },
        ]
        self.assertEqual(self.verify(events).status, "INTERNALLY_CONSISTENT")
        events[-1]["prefix_after"] = []
        self.assertEqual(self.verify(events).status, "INVALID_EVIDENCE")

    def test_unsupported_conditional_graph_is_not_silently_used(self):
        pack = tiny_pack()
        pack["turns"][0]["conditional"] = True
        with self.assertRaises(ValueError):
            self.api.ContinuityRouter(pack, scenario_digest="1" * 64)
        with self.assertRaises(ValueError):
            self.api.ContinuityRouter(tiny_pack(), scenario_digest="not-a-digest")

    def test_router_snapshot_cannot_be_mutated_through_original_pack_or_result(self):
        self.pack["edges"].clear()
        self.assertEqual(self.route("a", "d").seconds, 40.0)
        result = self.route("a", "c")
        with self.assertRaises((AttributeError, TypeError)):
            result.edges += ("to:0:f",)
        self.assertEqual(self.route("c", "d", result.arrival).seconds, 20.0)

    def test_verifier_rejects_context_mismatch_and_resource_overflow(self):
        wrong = replace(self.context, pack_digest="0" * 64)
        self.assertEqual(
            self.api.verify_executed_prefix(self.pack, wrong, [self.initial_event()]).status,
            "INVALID_EVIDENCE",
        )
        self.assertEqual(
            self.api.verify_executed_prefix(
                self.pack, self.context, [self.initial_event()], max_events=0
            ).status,
            "INVALID_EVIDENCE",
        )

    def test_node_via_rule_keeps_incoming_way_across_stop(self):
        pack = tiny_pack()
        pack["turns"] = [
            {"id": "node", "from": "via", "to": "to", "via": "c", "kind": "no_left_turn"}
        ]
        self.router = self.api.ContinuityRouter(pack, scenario_digest="1" * 64)
        self.context = self.router.context(self.context.departure)
        first = self.route("a", "c")
        self.assertEqual(self.route("c", "d", first.arrival).edges, ("branch:0:f", "exit:0:f"))
        self.assertEqual(self.route("c", "d").edges, ("to:0:f",))

    def test_missing_required_trace_fields_and_empty_trace_are_not_valid_evidence(self):
        self.assertEqual(self.verify([]).status, "INVALID_EVIDENCE")
        leg = self.leg("a", "b", ["from:0:f"], after="from:0:f", prefix_after=["from:0:f"])
        del leg["incoming_before"]
        self.assertEqual(self.verify([self.initial_event(), leg]).status, "INVALID_EVIDENCE")

    def test_known_restriction_start_cannot_have_an_empty_arrival_prefix(self):
        arrived = self.route("a", "b").arrival
        self.assertEqual(
            self.route("b", "d", replace(arrived, restriction_prefix=())).status,
            "UNSUPPORTED_CONTEXT",
        )

    def test_work_budget_bounds_router_and_independent_verifier(self):
        limited = self.api.ContinuityRouter(self.pack, scenario_digest="1" * 64, max_checks=1)
        result = limited.route(
            "a", "d", limited.initial("a"), limited.context(self.context.departure)
        )
        self.assertEqual(result.status, "UNSUPPORTED_CONTEXT")
        self.assertIn("budget", result.reason)
        events = [
            self.initial_event(),
            self.leg(
                "a",
                "c",
                ["from:0:f", "via:0:f"],
                after="via:0:f",
                prefix_after=["from:0:f", "via:0:f"],
            ),
        ]
        result = self.api.verify_executed_prefix(self.pack, self.context, events, max_checks=1)
        self.assertEqual(result.status, "INVALID_EVIDENCE")
        self.assertIn("budget", str(result.issues))

    def test_uncompiled_conditionals_and_nonfinite_costs_fail_before_search(self):
        for mutate in [
            lambda p: p["turns"][0].update({"restriction:conditional": "no @ (Mo-Fr)"}),
            lambda p: p.update({"conditional_access": {"from:0:f": "no @ (11:00-18:00)"}}),
            lambda p: p["edges"][0].update(seconds=float("nan")),
        ]:
            pack = tiny_pack()
            mutate(pack)
            with self.assertRaises(ValueError):
                self.api.ContinuityRouter(pack, scenario_digest="1" * 64)

    def test_cache_retains_only_bounded_total_path_edges(self):
        router = self.api.ContinuityRouter(self.pack, scenario_digest="1" * 64, max_cache_edges=2)
        context = router.context(self.context.departure)
        for start in self.pack["nodes"]:
            for end in self.pack["nodes"]:
                router.route(start, end, router.initial(start), context)
        self.assertLessEqual(sum(len(r.edges) for r in router._cache.values()), 2)
        self.assertEqual(router.route("a", "d", router.initial("a"), context).seconds, 40.0)

    def test_malformed_node_rule_cannot_silently_disappear(self):
        pack = tiny_pack()
        pack["turns"] = [
            {"id": "node", "from": ["via"], "to": "to", "via": "c", "kind": "no_left_turn"}
        ]
        with self.assertRaises(ValueError):
            self.api.ContinuityRouter(pack, scenario_digest="1" * 64)
