"""Explicit graph-circulation fixtures; no human or physical-depot evidence."""

import copy
import importlib
import importlib.util
import sys
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest
from citylib.temporal_import_v3 import build_temporal_pack, parse_temporal_osm
from test_engine import tiny_spec


def fixture():
    raw = b"""<osm>
      <node id="1" lon="-122.42001" lat="37.77"/>
      <node id="2" lon="-122.42" lat="37.77"/>
      <node id="3" lon="-122.42" lat="37.77001"/>
      <node id="4" lon="-122.42001" lat="37.77001"/>
      <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/></way>
      <way id="20"><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="2"/>
        <tag k="highway" v="residential"/><tag k="oneway" v="yes"/></way>
    </osm>"""
    pack = build_temporal_pack(parse_temporal_osm(raw))
    for edge in pack["edges"]:
        edge.update(source_seconds=2, seconds=2, duration_ms=2000)
    scenario = dict(
        tiny_spec(),
        model="fleetlab.graph-resource-depot-connectors/4.0.0",
        start_utc="2026-09-29T14:00:00+00:00",
        duration_s=40,
        vehicle_class="passenger_car",
        timezone="America/Los_Angeles",
        route_horizon_s=60,
        fleet_size=1,
        request_count=2,
        sample_s=1,
        boarding_s=1,
        dispatch_s=1,
        turnaround_every=1,
        turnaround_s=3,
    )
    scenario["sites"][0]["node"] = "2"
    sequence = ["20:0:f", "20:1:f", "20:2:f"]
    edges = {e["id"]: e for e in pack["edges"]}
    declaration = {
        "id": "depot-A-circulation",
        "pack_digest": digest(pack),
        "scenario_core_digest": digest(scenario),
        "site_id": "A",
        "trigger": {"incoming_edge": "10:0:f", "restriction_prefix": []},
        "edges": sequence,
        "duration_ms": 6000,
        "length_m": sum(edges[e]["length_m"] for e in sequence),
        "provenance": {
            "kind": "DECLARED_SCENARIO_ASSUMPTION",
            "reference": "fixture:four-node-circulation",
            "limitations": "No human review or physical maneuver claim",
        },
    }
    scenario["depot_connectors"] = [declaration]
    scenario["connector_reviews"] = [
        {
            "connector_id": declaration["id"],
            "declaration_digest": digest(declaration),
            "method": "CONTRACT_FIXTURE",
            "decision": "ACCEPTED_AS_MODEL_ASSUMPTION",
            "reference": "fixture:literal-path-review",
        }
    ]
    inputs = {
        "seed": 501,
        "initial": [{"id": "v", "node": "1", "energy": 30.0}],
        "requests": [
            {"id": "r0", "t": 0, "origin": "1", "destination": "2", "zone": "toy"},
            {"id": "r1", "t": 12, "origin": "3", "destination": "4", "zone": "toy"},
        ],
    }
    return pack, inputs, scenario


class DepotConnectorTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(
            importlib.util.find_spec("citylib.engine_connectors_v4"),
            "explicit connector fleet integration is not installed",
        )
        self.engine = importlib.import_module("citylib.engine_connectors_v4")
        self.verify = importlib.import_module("citylib.verify_connectors_v4").verify
        self.Router = importlib.import_module("citylib.connector_routing_v4").ConnectorRouter
        self.pack, self.inputs, self.spec = fixture()

    def arrived(self, router):
        return router.actual_arrival({"arrival_before": router.initial_state("1")}, ["10:0:f"])

    def test_reviewed_connector_runs_across_service_with_continuous_history_and_cost(self):
        run = self.engine.run_arm(self.pack, self.inputs, self.spec)
        connected = [r for r in run["legs"].values() if r["connector_transition"] is not None]
        self.assertEqual(len(connected), 1)
        route = connected[0]
        self.assertEqual(route["edges"], ["20:0:f", "20:1:f", "20:2:f", "20:0:f"])
        transition = route["connector_transition"]
        self.assertEqual(transition["arrival_before"]["incoming_edge"], "10:0:f")
        self.assertEqual(transition["arrival_after"]["incoming_edge"], "20:2:f")
        self.assertEqual(transition["duration_ms"], 6000)
        self.assertEqual(route["seconds"], 8)
        self.assertEqual([r["state"] for r in run["final"]["requests"]], ["completed", "completed"])
        with patch.object(self.Router, "route", side_effect=AssertionError("verifier searched")):
            report = self.verify(run, self.inputs, self.pack)
        self.assertTrue(report["valid"], report["findings"])
        self.assertEqual(
            report["routing"]["connectors"],
            {"planned": 1, "completed": 1, "partial": 0, "not_entered": 0},
        )
        self.assertFalse(report["recommendation_eligible"])

    def test_stale_missing_and_duplicate_declarations_or_reviews_are_rejected(self):
        for case in ["pack", "scenario", "cost", "review", "missing", "duplicate", "trigger"]:
            changed = copy.deepcopy(self.spec)
            declaration = changed["depot_connectors"][0]
            if case == "pack":
                declaration["pack_digest"] = "0" * 64
            elif case == "scenario":
                changed["duration_s"] += 1
            elif case == "cost":
                declaration["duration_ms"] += 1
            elif case == "review":
                changed["connector_reviews"][0]["declaration_digest"] = "0" * 64
            elif case == "missing":
                changed["connector_reviews"] = []
            elif case == "duplicate":
                changed["depot_connectors"].append(copy.deepcopy(declaration))
            else:
                declaration["trigger"]["incoming_edge"] = "10:0:r"
            with self.subTest(case=case), self.assertRaises(ValueError):
                self.Router(self.pack, changed)

    def test_zero_length_initial_and_other_arrivals_do_not_trigger_connector(self):
        router = self.Router(self.pack, self.spec)
        before = self.arrived(router)
        zero = router.plan(before, "2", 10)
        self.assertEqual(zero["arrival_after"], before)
        self.assertIsNone(zero["connector_transition"])
        self.assertIsNone(router.plan(router.initial_state("2"), "1", 10)["connector_transition"])
        other = router.actual_arrival({"arrival_before": router.initial_state("4")}, ["20:2:f"])
        self.assertIsNone(router.plan(other, "1", 10)["connector_transition"])

    def test_temporal_closure_and_short_horizon_never_bypass_connector(self):
        for case in ["closed", "horizon"]:
            pack, inputs, scenario = fixture()
            if case == "horizon":
                scenario["route_horizon_s"] = 7
            else:
                tags = {"motor_vehicle:conditional": "no @ (07:00-08:00)"}
                pack["temporal"]["nodes"].append({"node": "3", "tags": tags})
                pack["temporal"]["node_source"]["3"] = tags
            declaration = scenario["depot_connectors"][0]
            declaration["pack_digest"] = digest(pack)
            declaration["scenario_core_digest"] = digest(
                {
                    k: v
                    for k, v in scenario.items()
                    if k not in {"depot_connectors", "connector_reviews"}
                }
            )
            scenario["connector_reviews"][0]["declaration_digest"] = digest(declaration)
            with self.subTest(case=case):
                router = self.Router(pack, scenario)
                self.assertIsNone(router.plan(self.arrived(router), "1", 10))

    def test_partial_connector_keeps_executed_prefix_separate(self):
        run = self.engine.run_arm(self.pack, self.inputs, self.spec, stop_at=15)
        final = run["final"]["vehicles"][0]
        self.assertEqual(final["routing_position"]["completed_edges"], ["20:0:f"])
        self.assertEqual(final["routing_position"]["partial_edge"]["id"], "20:1:f")
        self.assertEqual(final["routing_state"]["incoming_edge"], "20:0:f")
        report = self.verify(run, self.inputs, self.pack)
        self.assertTrue(report["valid"], report["findings"])
        self.assertEqual(report["execution"], "INCOMPLETE")
        self.assertEqual(
            report["routing"]["connectors"],
            {"planned": 1, "completed": 0, "partial": 1, "not_entered": 0},
        )

    def test_review_does_not_permit_a_prohibited_reversal(self):
        declaration = self.spec["depot_connectors"][0]
        declaration["edges"] = ["10:0:r", "10:0:f"]
        declaration["duration_ms"] = 4000
        edges = {e["id"]: e for e in self.pack["edges"]}
        declaration["length_m"] = sum(edges[e]["length_m"] for e in declaration["edges"])
        self.spec["connector_reviews"][0]["declaration_digest"] = digest(declaration)
        router = self.Router(self.pack, self.spec)
        self.assertIsNone(router.plan(self.arrived(router), "3", 12))

    def test_independent_verifier_rejects_producer_bypass_of_closed_connector(self):
        tags = {"motor_vehicle:conditional": "no @ (07:00-08:00)"}
        self.pack["temporal"]["nodes"].append({"node": "3", "tags": tags})
        self.pack["temporal"]["node_source"]["3"] = tags
        declaration = self.spec["depot_connectors"][0]
        declaration["pack_digest"] = digest(self.pack)
        self.spec["connector_reviews"][0]["declaration_digest"] = digest(declaration)
        with patch.object(self.Router, "_allowed", return_value=True):
            run = self.engine.run_arm(self.pack, self.inputs, self.spec)
        self.assertTrue(any(r["connector_transition"] for r in run["legs"].values()))
        report = self.verify(run, self.inputs, self.pack)
        self.assertFalse(report["valid"])
        self.assertTrue(report["routing"]["issues"])

    def test_forged_connector_metadata_fails_independent_verifier(self):
        run = self.engine.run_arm(self.pack, self.inputs, self.spec)
        lid = next(k for k, r in run["legs"].items() if r["connector_transition"] is not None)
        for field, value in [
            ("duration_ms", 1),
            ("id", "foreign"),
            ("arrival_after", {}),
            ("provenance", {}),
            ("review_digest", "0" * 64),
        ]:
            altered = copy.deepcopy(run)
            altered["legs"][lid]["connector_transition"][field] = value
            with self.subTest(field=field):
                self.assertFalse(self.verify(altered, self.inputs, self.pack)["valid"])
        altered = copy.deepcopy(run)
        altered["legs"][lid]["connector_transition"] = None
        self.assertFalse(self.verify(altered, self.inputs, self.pack)["valid"])

    def test_nonempty_same_endpoint_loop_cannot_hide_as_zero_leg(self):
        declaration = self.spec["depot_connectors"][0]
        declaration["edges"] *= 2
        declaration["duration_ms"] *= 2
        edges = {e["id"]: e for e in self.pack["edges"]}
        declaration["length_m"] = sum(edges[e]["length_m"] for e in declaration["edges"])
        self.spec["connector_reviews"][0]["declaration_digest"] = digest(declaration)
        original = self.Router.plan

        def hide_loop(router, arrival, destination, elapsed):
            if not (arrival["node"] == destination == "2" and arrival["incoming_edge"] == "10:0:f"):
                return original(router, arrival, destination, elapsed)
            path = ["20:0:f", "20:1:f", "20:2:f"]
            departure = router.instant(elapsed)
            return {
                "edges": path,
                "nodes": ["2", "3", "4", "2"],
                "seconds": 6.0,
                "length_m": sum(edges[e]["length_m"] for e in path),
                "departure_utc": departure.isoformat(),
                "arrival_before": copy.deepcopy(arrival),
                "arrival_after": router.actual_arrival({"arrival_before": arrival}, path),
                "temporal_entries": [
                    {
                        "edge": eid,
                        "entry_utc": (departure + timedelta(seconds=i * 2)).isoformat(),
                        "exit_utc": (departure + timedelta(seconds=(i + 1) * 2)).isoformat(),
                    }
                    for i, eid in enumerate(path)
                ],
                "scenario_digest": router.spec_digest,
                "connector_transition": None,
            }

        with patch.object(self.Router, "plan", hide_loop):
            run = self.engine.run_arm(self.pack, self.inputs, self.spec)
        report = self.verify(run, self.inputs, self.pack)
        self.assertFalse(report["valid"], "a circulation loop was mistaken for a zero-length leg")
        self.assertIn("nonempty same-endpoint", " ".join(report["routing"]["issues"]))

    def test_old_temporal_model_rejects_connector_fields(self):
        from citylib.temporal_routing_v3 import MODEL, TemporalRouter

        with self.assertRaises(ValueError):
            TemporalRouter(self.pack, dict(self.spec, model=MODEL))

    def test_connector_and_onward_search_share_one_work_limit(self):
        router = self.Router(self.pack, self.spec)
        before = self.arrived(router)
        # This literal path spends 3 static connector transitions plus 9 units
        # in the onward query even before timed permission checks are counted.
        # Separate budgets wrongly let this combined query pass a ten-unit cap.
        router.max_checks = 10
        with self.assertRaisesRegex(ValueError, "work budget"):
            router.plan(before, "3", 12)

    def test_old_verifier_cannot_ignore_connector_declarations_after_redigest(self):
        from citylib.engine_temporal_v3 import run_arm
        from citylib.temporal_routing_v3 import MODEL
        from citylib.verify_temporal_v3 import verify

        scenario = {
            k: v for k, v in self.spec.items() if k not in {"depot_connectors", "connector_reviews"}
        }
        scenario["model"] = MODEL
        run = run_arm(self.pack, self.inputs, scenario)
        self.assertTrue(verify(run, self.inputs, self.pack)["valid"])
        run["spec"]["depot_connectors"] = self.spec["depot_connectors"]
        run["spec"]["connector_reviews"] = self.spec["connector_reviews"]
        run["scenario_digest"] = digest(run["spec"])
        for route in run["legs"].values():
            route["scenario_digest"] = run["scenario_digest"]
        self.assertFalse(verify(run, self.inputs, self.pack)["valid"])


if __name__ == "__main__":
    unittest.main()
