"""Actual resource-runner fixtures for continuity across operating boundaries."""

import copy
import importlib
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest
from test_continuity_v1 import tiny_pack
from test_engine import tiny_spec


def fleet_fixture():
    pack = tiny_pack()
    pack["edges"].append(
        {
            "id": "return:0:f",
            "u": "d",
            "v": "a",
            "way": "return",
            "seconds": 10.0,
            "length_m": 100.0,
            "speed_mps": 10.0,
        }
    )
    spec = tiny_spec()
    spec.update(
        model="fleetlab.graph-resource-continuity/2.0.0",
        fleet_size=1,
        request_count=1,
        start_utc="2026-09-29T14:00:00+00:00",
        duration_s=100,
        turnaround_every=1,
        turnaround_s=10,
    )
    inputs = {
        "seed": 501,
        "initial": [{"id": "v1", "node": "a", "energy": 30.0}],
        "requests": [{"id": "r1", "t": 0, "origin": "c", "destination": "d", "zone": "toy"}],
    }
    return pack, inputs, spec


class FleetContinuityTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(
            importlib.util.find_spec("citylib.engine_continuity_v2"),
            "versioned fleet integration not installed",
        )
        self.engine = importlib.import_module("citylib.engine_continuity_v2")
        self.verifier = importlib.import_module("citylib.verify_continuity_v2")
        self.pack, self.inputs, self.spec = fleet_fixture()

    def run_fleet(self, stop_at=None):
        return self.engine.run_arm(self.pack, self.inputs, self.spec, stop_at=stop_at)

    def verify(self, run):
        return self.verifier.verify(run, self.inputs, self.pack)

    def test_pickup_passenger_depot_routes_keep_incoming_history(self):
        run = self.run_fleet()
        routes = list(run["legs"].values())
        self.assertEqual(routes[0]["edges"], ["from:0:f", "via:0:f"])
        self.assertEqual(routes[1]["edges"], ["branch:0:f", "exit:0:f"])
        self.assertEqual(routes[2]["edges"], ["return:0:f"])
        self.assertEqual(run["final"]["requests"][0]["state"], "completed")
        self.assertEqual(routes[1]["arrival_before"]["restriction_prefix"], ["from:0:f", "via:0:f"])
        report = self.verify(run)
        self.assertTrue(report["valid"], report["findings"])
        self.assertFalse(report["recommendation_eligible"])
        self.assertEqual(report["map_qualification"], "NOT_EVALUATED")

    def test_zero_length_passenger_leg_does_not_erase_restriction(self):
        self.inputs["requests"][0]["destination"] = "c"
        run = self.run_fleet()
        routes = list(run["legs"].values())
        self.assertEqual(routes[1]["edges"], [])
        self.assertEqual(routes[1]["arrival_before"], routes[1]["arrival_after"])
        self.assertEqual(routes[2]["edges"], ["branch:0:f", "exit:0:f", "return:0:f"])
        self.assertTrue(self.verify(run)["valid"])

    def test_dispatch_checks_passenger_and_depot_from_each_pickup_arrival(self):
        self.pack["edges"] = [e for e in self.pack["edges"] if e["way"] not in {"branch", "exit"}]
        # v1's pickup reaches a restricted incoming context; v2 can serve it.
        self.inputs["initial"].append({"id": "v2", "node": "f", "energy": 30.0})
        self.spec["fleet_size"] = 2
        run = self.run_fleet()
        assigned = [e for e in run["events"] if e["kind"] == "assigned"]
        self.assertEqual([e["vehicle"] for e in assigned], ["v2"])
        self.assertTrue(self.verify(run)["valid"])

    def test_unreachable_forecast_does_not_mark_another_vehicle_context_unreachable(self):
        self.pack["edges"] = [e for e in self.pack["edges"] if e["way"] not in {"branch", "exit"}]
        run = self.run_fleet()
        self.assertFalse(any(e["kind"] == "assigned" for e in run["events"]))
        self.assertEqual(run["final"]["requests"][0]["state"], "waiting")
        self.assertTrue(self.verify(run)["valid"])

    def test_proven_terminal_destination_avoids_search_but_preserves_entire_recording(self):
        from citylib.fleet_routing_v2 import MODEL, SCHEMA, FleetRouter

        class CountingRouter(FleetRouter):
            calls = 0

            def route(self, *args, **kwargs):
                self.calls += 1
                return super().route(*args, **kwargs)

        class UnoptimizedRouter(CountingRouter):
            def is_terminal_arrival(self, node):
                return False

        for reverse_only in [False, True]:
            with self.subTest(reverse_only=reverse_only):
                pack, inputs, spec = fleet_fixture()
                pack["edges"] = [e for e in pack["edges"] if e["way"] not in {"return", "to"}]
                if reverse_only:
                    pack["edges"].append(
                        {
                            "id": "exit:0:r",
                            "way": "exit",
                            "u": "d",
                            "v": "x",
                            "seconds": 10.0,
                            "length_m": 100.0,
                            "speed_mps": 10.0,
                        }
                    )
                inputs["initial"] = [{"id": f"v{i}", "node": "a", "energy": 30.0} for i in range(6)]
                spec.update(fleet_size=6, patience_s=20)
                reference = UnoptimizedRouter(pack, spec)
                expected = self.engine._run_arm(pack, inputs, spec, reference, MODEL, SCHEMA)
                router = CountingRouter(pack, spec)
                actual = self.engine._run_arm(pack, inputs, spec, router, MODEL, SCHEMA)
                self.assertEqual(digest(actual), digest(expected))
                self.assertEqual(actual["final"]["requests"][0]["state"], "unserved")
                self.assertLess(router.calls, reference.calls)
                self.assertTrue(self.verifier.verify(actual, inputs, pack)["valid"])

    def test_terminal_proof_never_discards_depot_destination_or_initial_zero_trip(self):
        # Nonempty arrival can end at a depot without needing an outgoing edge.
        self.pack["edges"] = [e for e in self.pack["edges"] if e["way"] != "return"]
        self.spec["sites"][0]["node"] = "d"
        run = self.run_fleet()
        self.assertEqual(run["final"]["requests"][0]["state"], "completed")
        self.assertTrue(self.verify(run)["valid"])
        # Initial placement at a cul-de-sac may legally leave. No nonempty
        # arrival took place, so the post-arrival proof is inapplicable.
        self.pack, self.inputs, self.spec = fleet_fixture()
        self.pack["edges"] = [e for e in self.pack["edges"] if e["way"] != "to"]
        self.pack["edges"] = [e for e in self.pack["edges"] if e["way"] != "return"]
        self.pack["edges"].append(
            {
                "id": "exit:0:r",
                "way": "exit",
                "u": "d",
                "v": "x",
                "seconds": 10.0,
                "length_m": 100.0,
                "speed_mps": 10.0,
            }
        )
        self.inputs["initial"][0]["node"] = "d"
        self.inputs["requests"][0].update(origin="d", destination="d")
        self.spec["sites"][0]["node"] = "x"
        run = self.run_fleet()
        self.assertEqual(run["final"]["requests"][0]["state"], "completed")
        self.assertTrue(self.verify(run)["valid"])

    def test_fractional_horizon_contains_only_executed_prefix(self):
        run = self.run_fleet(stop_at=15)
        final = run["final"]["vehicles"][0]
        self.assertEqual(final["node"], "b")
        self.assertEqual(final["routing_state"]["incoming_edge"], "from:0:f")
        travel = final["routing_position"]
        self.assertEqual(travel["completed_edges"], ["from:0:f"])
        self.assertEqual(
            travel["partial_edge"], {"id": "via:0:f", "elapsed_s": 5.0, "fraction": 0.5}
        )
        self.assertAlmostEqual(final["distance_m"], 150.0)
        report = self.verify(run)
        self.assertTrue(report["valid"], report["findings"])
        self.assertEqual(report["routing"]["entered_edge_count"], 2)
        self.assertEqual(report["execution"], "INCOMPLETE")

    def test_fractional_edge_after_boarding_uses_retained_prefix(self):
        run = self.run_fleet(stop_at=35)
        final = run["final"]["vehicles"][0]
        self.assertEqual(final["routing_position"]["partial_edge"]["id"], "branch:0:f")
        self.assertEqual(final["routing_state"]["incoming_edge"], "via:0:f")
        self.assertEqual(final["routing_state"]["restriction_prefix"], ["from:0:f", "via:0:f"])
        self.assertTrue(self.verify(run)["valid"])

    def test_partial_fraction_forgery_fails(self):
        run = self.run_fleet(stop_at=35)
        run["final"]["vehicles"][0]["routing_position"]["partial_edge"]["fraction"] = 0.0
        report = self.verify(run)
        self.assertFalse(report["valid"])
        self.assertIn("partial", str(report["findings"]).lower())

    def test_boundary_history_reset_fails(self):
        run = self.run_fleet()
        route = list(run["legs"].values())[1]
        route["arrival_before"]["incoming_edge"] = None
        route["arrival_before"]["restriction_prefix"] = []
        self.assertFalse(self.verify(run)["valid"])

    def test_recorded_stop_state_cannot_reset_history(self):
        run = self.run_fleet()
        boarding = next(
            e for e in run["events"] if e["kind"] == "state" and e["after"] == "boarding"
        )
        boarding["routing_state"]["incoming_edge"] = None
        self.assertFalse(self.verify(run)["valid"])

    def test_foreign_model_scenario_pack_and_departure_fail(self):
        original = self.run_fleet()
        for field, value in [
            ("model", "fleetlab.graph-resource/1.0.0"),
            ("schema", "fleetlab.city-run/1.0.0"),
            ("pack_digest", "0" * 64),
            ("scenario_digest", "0" * 64),
        ]:
            with self.subTest(field=field):
                altered = copy.deepcopy(original)
                altered[field] = value
                self.assertFalse(self.verify(altered)["valid"])
        altered = copy.deepcopy(original)
        next(iter(altered["legs"].values()))["departure_utc"] = "2026-09-29T15:00:00+00:00"
        self.assertFalse(self.verify(altered)["valid"])

    def test_verifier_never_calls_route_search(self):
        run = self.run_fleet()
        with patch(
            "citylib.continuity_v1.ContinuityRouter.route",
            side_effect=AssertionError("search forbidden"),
        ):
            self.assertTrue(self.verify(run)["valid"])

    def test_duplicate_run_is_deterministic_and_does_not_mutate_inputs(self):
        before = digest([self.pack, self.inputs, self.spec])
        self.assertEqual(digest(self.run_fleet()), digest(self.run_fleet()))
        self.assertEqual(digest([self.pack, self.inputs, self.spec]), before)

    def test_unqualified_old_runner_still_rejects_candidate(self):
        from citylib.engine import run_arm

        with self.assertRaisesRegex(ValueError, "cross-leg"):
            run_arm(self.pack, self.inputs, {**self.spec, "model": "fleetlab.graph-resource/1.0.0"})

    def test_missing_naive_or_invalid_instant_rejected(self):
        for value in [None, "2026-09-29T07:00:00", "not-a-time"]:
            with self.subTest(value=value):
                self.spec["start_utc"] = value
                with self.assertRaises(ValueError):
                    self.run_fleet()

    def test_nonfinite_final_values_fail_closed(self):
        for value in [float("nan"), float("inf"), -float("inf")]:
            run = self.run_fleet()
            run["final"]["vehicles"][0]["energy"] = value
            self.assertFalse(self.verify(run)["valid"], value)

    def test_missing_final_position_field_is_not_accepted_as_explicit_null(self):
        run = self.run_fleet()
        del run["final"]["vehicles"][0]["routing_position"]
        self.assertFalse(self.verify(run)["valid"])

    def test_incomplete_horizon_cannot_claim_complete_execution(self):
        run = self.run_fleet(stop_at=35)
        run["execution"] = "COMPLETE"
        run["events"][-1]["execution"] = "COMPLETE"
        self.assertFalse(self.verify(run)["valid"])

    def test_final_departure_node_cannot_replace_actual_partial_edge_endpoint(self):
        run = self.run_fleet(stop_at=15)
        run["final"]["vehicles"][0]["node"] = "a"
        self.assertFalse(self.verify(run)["valid"])

    def test_sf_source_node_inventory_fits_declared_structural_bound(self):
        # Frozen SF v2 has 261,455 source nodes, including non-routable context.
        self.pack["nodes"].update({f"context-{i}": [0.0, 0.0] for i in range(261455)})
        from citylib.fleet_routing_v2 import FleetRouter

        router = FleetRouter(self.pack, self.spec)
        self.assertIsNotNone(router.plan(router.initial_state("a"), "c", 0))

    def test_structural_bound_still_rejects_excessive_graph(self):
        self.pack["nodes"].update({f"context-{i}": [0.0, 0.0] for i in range(300001)})
        with self.assertRaisesRegex(ValueError, "bounds"):
            self.run_fleet()

    def test_untraversable_no_sequence_is_retained_without_restoring_missing_edge(self):
        from citylib.fleet_routing_v2 import FleetRouter

        self.pack["edges"] = [e for e in self.pack["edges"] if e["id"] != "via:0:f"]
        router = FleetRouter(self.pack, self.spec)
        self.assertEqual(router.inactive_no_sequences, (("r1", ("from:0:f", "via:0:f", "to:0:f")),))
        self.assertIsNone(router.plan(router.initial_state("a"), "d", 0))
        self.assertNotIn("via:0:f", router.edges)

    def test_missing_required_only_sequence_remains_rejected(self):
        from citylib.fleet_routing_v2 import FleetRouter

        self.pack["turns"][0]["kind"] = "only_straight_on"
        self.pack["edges"] = [e for e in self.pack["edges"] if e["id"] != "via:0:f"]
        with self.assertRaisesRegex(ValueError, "absent"):
            FleetRouter(self.pack, self.spec)

    def test_present_but_disconnected_no_sequence_is_rejected(self):
        from citylib.fleet_routing_v2 import FleetRouter

        self.pack["edges"][1]["u"] = "f"
        with self.assertRaisesRegex(ValueError, "disconnected"):
            FleetRouter(self.pack, self.spec)

    def test_rule_index_does_not_spend_route_budget_on_unrelated_turns(self):
        from citylib.fleet_routing_v2 import FleetRouter

        self.pack["turns"].extend(
            [
                {
                    "id": f"unrelated-{i}",
                    "kind": "no_left_turn",
                    "from": f"absent-{i}",
                    "to": "to",
                    "via": "f",
                }
                for i in range(2200)
            ]
        )
        router = FleetRouter(self.pack, self.spec)
        router.max_checks = 200
        route = router.plan(router.initial_state("a"), "d", 0)
        self.assertEqual(route["edges"], ["from:0:f", "via:0:f", "branch:0:f", "exit:0:f"])

    def test_indexed_transitions_agree_with_direct_rule_scan(self):
        from citylib.continuity_v1 import ContinuityRouter
        from citylib.fleet_routing_v2 import FleetRouter

        for kind in ["no_left_turn", "only_straight_on"]:
            self.pack["turns"][0]["kind"] = kind
            fast = FleetRouter(self.pack, self.spec)
            reference = ContinuityRouter(self.pack, scenario_digest=digest(self.spec))
            ctx = fast.context(fast.start)
            for source in self.pack["nodes"]:
                for target in self.pack["nodes"]:
                    for algorithm in ["astar", "dijkstra"]:
                        state = fast.initial(source)
                        a = fast.route(source, target, state, ctx, algorithm=algorithm)
                        b = reference.route(source, target, state, ctx, algorithm=algorithm)
                        self.assertEqual(
                            (a.status, a.edges, a.seconds, a.arrival),
                            (b.status, b.edges, b.seconds, b.arrival),
                        )
            for origin in ["a", "f"]:
                first = reference.route(origin, "c", reference.initial(origin), ctx)
                for target in self.pack["nodes"]:
                    a = fast.route("c", target, first.arrival, ctx)
                    b = reference.route("c", target, first.arrival, ctx)
                    self.assertEqual((a.status, a.edges, a.seconds), (b.status, b.edges, b.seconds))

    def test_sf_sized_state_space_uses_bounded_on_demand_search(self):
        from citylib.fleet_routing_v2 import FleetRouter

        count = 100001
        pack = {
            "schema": "fleetlab.city-pack/1.0.0",
            "routing_profile": "node-via/1.0.0",
            "nodes": {str(i): [i * 0.000001, 0] for i in range(count + 1)},
            "edges": [
                {
                    "id": f"way:{i}:f",
                    "way": "way",
                    "u": str(i),
                    "v": str(i + 1),
                    "seconds": 1.0,
                    "length_m": 1.0,
                }
                for i in range(count)
            ],
            "turns": [],
        }
        router = FleetRouter(pack, self.spec)
        result = router.route(
            "0", str(count), router.initial("0"), router.context(router.start), algorithm="dijkstra"
        )
        self.assertEqual(result.status, "ROUTE", result.reason)
        self.assertEqual(len(result.edges), count)
        self.assertLessEqual(router.max_states, 300000)

    def test_malformed_json_containers_return_invalid(self):
        original = self.run_fleet()
        for field in ["legs", "counters", "spec", "final", "events", "poses"]:
            for value in [None, [], {}, "wrong"]:
                if value == original[field]:
                    continue
                run = copy.deepcopy(original)
                run[field] = value
                with self.subTest(field=field, value=value):
                    self.assertFalse(self.verify(run)["valid"])

    def test_final_request_inventory_fields_and_owner_match_events(self):
        original = self.run_fleet()
        duplicate = copy.deepcopy(original)
        duplicate["final"]["requests"].append(copy.deepcopy(duplicate["final"]["requests"][0]))
        self.assertFalse(self.verify(duplicate)["valid"])
        for field, value in [
            ("vehicle", "foreign"),
            ("origin", "f"),
            ("zone", "fake"),
            ("assigned_at", 55),
            ("boarded_at", 56),
            ("completed_at", 57),
        ]:
            run = copy.deepcopy(original)
            run["final"]["requests"][0][field] = value
            with self.subTest(field=field):
                self.assertFalse(self.verify(run)["valid"])
        run = copy.deepcopy(original)
        run["final"]["vehicles"][0]["request"] = "invented"
        self.assertFalse(self.verify(run)["valid"])

    def test_verifier_retains_only_sufficient_bounded_history(self):
        self.spec.update(duration_s=500, turnaround_every=100, request_count=5)
        self.inputs["requests"] = [
            {"id": f"r{i}", "t": i * 100, "origin": "c", "destination": "d", "zone": "toy"}
            for i in range(5)
        ]
        report = self.verify(self.run_fleet())
        self.assertTrue(report["valid"], report["findings"])
        self.assertGreater(report["routing"]["entered_edge_count"], 20)
        self.assertLessEqual(report["routing"]["retained_history_peak_edges"], 3)
        self.assertEqual(report["routing"]["history_bound_edges"], 3)


if __name__ == "__main__":
    unittest.main()
