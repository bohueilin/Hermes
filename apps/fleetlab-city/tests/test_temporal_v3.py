"""Literal time-boundary and source fixtures; no SF qualification claims."""

import copy
import importlib
import importlib.util
import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest
from citylib.fleet_routing_v2 import state_object
from test_fleet_continuity_v2 import fleet_fixture


def raw_fixture(expression="no_left_turn @ (Mo-Fr 07:00-10:00,15:00-19:00)"):
    return f'''<osm>
      <node id="1" lon="-122.42" lat="37.77"/>
      <node id="2" lon="-122.419" lat="37.77"/>
      <node id="3" lon="-122.418" lat="37.77"/>
      <node id="4" lon="-122.419" lat="37.771"/>
      <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="trunk"/>
        <tag k="oneway" v="yes"/></way>
      <way id="20"><nd ref="2"/><nd ref="3"/><tag k="highway" v="residential"/>
        <tag k="oneway" v="yes"/></way>
      <way id="30"><nd ref="2"/><nd ref="4"/><nd ref="3"/><tag k="highway" v="residential"/>
        <tag k="oneway" v="yes"/></way>
      <relation id="1274895"><member type="way" ref="10" role="from"/>
        <member type="node" ref="2" role="via"/><member type="way" ref="20" role="to"/>
        <tag k="type" v="restriction"/><tag k="restriction:conditional" v="{expression}"/>
      </relation></osm>'''.encode()


def spec():
    return {
        "model": "fleetlab.graph-resource-temporal/3.0.0",
        "start_utc": "2026-09-29T13:00:00+00:00",
        "duration_s": 36000,
        "route_horizon_s": 3600,
        "vehicle_class": "passenger_car",
        "timezone": "America/Los_Angeles",
    }


class TemporalTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(
            importlib.util.find_spec("citylib.temporal_import_v3"),
            "source-bound temporal importer not installed",
        )
        self.imp = importlib.import_module("citylib.temporal_import_v3")
        self.assertIsNotNone(
            importlib.util.find_spec("citylib.temporal_routing_v3"),
            "time-dependent routing not installed",
        )
        self.routing = importlib.import_module("citylib.temporal_routing_v3")

    def pack(self, raw=None):
        return self.imp.build_temporal_pack(self.imp.parse_temporal_osm(raw or raw_fixture()))

    def router(self, pack=None, scenario=None):
        return self.routing.TemporalRouter(pack or self.pack(), scenario or spec())

    def test_raw_members_tags_and_source_digest_survive_import(self):
        raw = raw_fixture()
        source = self.imp.parse_temporal_osm(raw)
        pack = self.imp.build_temporal_pack(source)
        self.assertEqual(pack["temporal"]["turns"][0]["via"], "2")
        self.assertEqual(
            pack["temporal"]["turns"][0]["raw"]["members"][1],
            {"type": "node", "ref": "2", "role": "via"},
        )
        self.assertEqual(pack["candidate_ids"], ["10", "20", "30"])
        self.assertEqual(len(pack["temporal"]["turns"]), 1)
        self.assertTrue(all(r["status"] == "included" for r in pack["inventory"]))
        self.assertEqual(pack["temporal"]["source_digest"], digest(source))
        self.assertEqual(self.imp.parse_temporal_osm(raw), source)

    def test_unknown_condition_and_malformed_via_keep_from_way_blocked(self):
        for raw in [
            raw_fixture("no_left_turn @ (PH)"),
            raw_fixture().replace(b'ref="2" role="via"', b'ref="4" role="via"'),
        ]:
            pack = self.pack(raw)
            self.assertEqual(pack["temporal"]["turns"], [])
            self.assertEqual(pack["inventory"][0]["status"], "unsupported")
            self.assertFalse(any(e["way"] == "10" for e in pack["edges"]))

    def test_duplicate_source_objects_and_tags_are_rejected(self):
        for raw in [
            raw_fixture().replace(b"</osm>", b'<node id="1" lon="0" lat="0"/></osm>'),
            raw_fixture().replace(
                b'<tag k="oneway" v="yes"/>',
                b'<tag k="oneway" v="yes"/><tag k="oneway" v="no"/>',
                1,
            ),
        ]:
            with self.assertRaises(ValueError):
                self.pack(raw)

    def test_node_turn_uses_arrival_time_not_shift_start(self):
        router = self.router()
        for stamp, forbidden in [
            ("2026-09-29T13:59:59+00:00", False),
            ("2026-09-29T14:00:00+00:00", True),
            ("2026-09-29T16:59:59+00:00", True),
            ("2026-09-29T17:00:00+00:00", False),
            ("2026-09-29T22:00:00+00:00", True),
        ]:
            # Arrive at the named via along the actual incoming edge.
            arrival = router.actual_arrival(
                {"arrival_before": router.initial_state("1")}, ["10:0:f"]
            )
            dt = datetime.fromisoformat(stamp)
            route = router.route("2", "3", state_object(arrival), router.context(dt))
            self.assertEqual(route.status, "ROUTE", route.reason)
            self.assertEqual(route.edges[0] == "20:0:f", not forbidden, stamp)

    def test_legal_cycle_after_boundary_preserves_later_initial_arrival(self):
        # A 65-second cycle returns along the same retained incoming edge. It
        # must survive dominance so the vehicle reaches an opening road after
        # 07:03. The disconnected schedule must not affect route availability.
        nodes = "".join(
            f'<node id="{i}" lon="{-122.42 + i * 0.0001}" lat="37.77"/>' for i in range(7)
        )
        records = [
            ("100", "0", "1", 10, None),
            ("101", "1", "2", 15, None),
            ("102", "2", "0", 40, None),
            ("103", "1", "3", 40, None),
            ("104", "3", "4", 40, "07:02-07:03"),
            ("105", "5", "6", 10, "07:03-07:04"),
        ]
        ways = []
        for way, u, v, _, condition in records:
            tag = f'<tag k="vehicle:conditional" v="no @ ({condition})"/>' if condition else ""
            ways.append(
                f'<way id="{way}"><nd ref="{u}"/><nd ref="{v}"/>'
                f'<tag k="highway" v="residential"/><tag k="oneway" v="yes"/>{tag}</way>'
            )
        pack = self.pack(("<osm>" + nodes + "".join(ways) + "</osm>").encode())
        seconds_by_way = {way: seconds for way, _, _, seconds, _ in records}
        for edge in pack["edges"]:
            seconds = seconds_by_way[edge["way"]]
            edge.update(seconds=seconds, source_seconds=seconds, duration_ms=seconds * 1000)
        scenario = dict(spec(), route_horizon_s=180)
        router = self.router(pack, scenario)
        arrival = state_object(
            router.actual_arrival({"arrival_before": router.initial_state("2")}, ["102:0:f"])
        )
        context = router.context(datetime.fromisoformat("2026-09-29T14:01:59+00:00"))
        for algorithm in ("astar", "dijkstra"):
            with self.subTest(algorithm=algorithm):
                route = router.route("0", "4", arrival, context, algorithm=algorithm)
                self.assertEqual(route.status, "ROUTE", route.reason)
                self.assertEqual(route.seconds, 155)
                self.assertEqual(
                    route.edges,
                    ("100:0:f", "101:0:f", "102:0:f", "100:0:f", "103:0:f", "104:0:f"),
                )

    def test_repeated_destination_reuses_bounded_static_potential(self):
        nodes = "".join(
            f'<node id="{i}" lon="{-122.42 + i * 0.0001}" lat="37.77"/>' for i in range(51)
        )
        refs = "".join(f'<nd ref="{i}"/>' for i in range(51))
        pack = self.pack(
            (
                f'<osm>{nodes}<way id="10">{refs}<tag k="highway" v="residential"/>'
                '<tag k="oneway" v="yes"/></way></osm>'
            ).encode()
        )
        router = self.router(pack)
        context = router.context(router.start)
        self.assertEqual(router.route("0", "50", router.initial("0"), context).status, "ROUTE")
        # A second origin needs a different route, but the same lower bound.
        # Its budget covers the actual route search/checks, not rebuilding all
        # 50 reverse labels. No exact route or static path certificate is reused.
        router.max_checks = 120
        result = router.route("1", "50", router.initial("1"), context)
        self.assertEqual(result.status, "ROUTE", result.reason)
        self.assertEqual(result.edges, tuple(f"10:{i}:f" for i in range(1, 50)))
        cold = self.router(pack)
        cold.max_checks = 120
        self.assertEqual(
            cold.route("1", "50", cold.initial("1"), cold.context(cold.start)).status,
            "UNSUPPORTED_CONTEXT",
        )

    def test_permanently_closed_node_proves_unreachable_without_time_expansion(self):
        def graph(override):
            nodes = "".join(
                f'<node id="{i}" lon="{-122.42 + i * 0.0001}" lat="37.77">'
                + ('<tag k="motor_vehicle" v="no"/>' + override if i == 49 else "")
                + "</node>"
                for i in range(51)
            )
            refs = "".join(f'<nd ref="{i}"/>' for i in range(51))
            return self.pack(
                (
                    f'<osm>{nodes}<way id="10">{refs}<tag k="highway" v="residential"/>'
                    '<tag k="oneway" v="yes"/></way></osm>'
                ).encode()
            )

        router = self.router(graph(""))
        router.max_checks = 120
        result = router.route("0", "50", router.initial("0"), router.context(router.start))
        self.assertEqual(result.status, "NO_MODELED_CONTINUATION", result.reason)
        # A more specific base grant defeats the lower-priority denial; the
        # same graph must then remain connected in the relaxed potential.
        allowed = self.router(graph('<tag k="motorcar" v="yes"/>'))
        route = allowed.route("0", "50", allowed.initial("0"), allowed.context(allowed.start))
        self.assertEqual(route.status, "ROUTE", route.reason)

    def test_potential_cache_bounds_and_horizon_identity(self):
        from citylib.continuity_v1 import _Budget

        router = self.router()
        self.assertTrue(hasattr(router, "_potential_cache"), "bounded potential cache required")
        router._max_potential_entries = 2
        router._max_potential_nodes = 5
        for destination in ("3", "4", "2", "3"):
            expected = self.router()._lower_distances(destination, _Budget(1000))
            self.assertEqual(router._lower_distances(destination, _Budget(1000)), expected)
            self.assertLessEqual(len(router._potential_cache), 2)
            self.assertLessEqual(router._potential_nodes, 5)
            self.assertEqual(
                router._potential_nodes, sum(len(v) for v in router._potential_cache.values())
            )
        router.horizon_ms = 1
        self.assertEqual(router._lower_distances("3", _Budget(1000)), {"3": 0})
        uncached_router = self.router()
        uncached_router._max_potential_nodes = 0
        uncached = uncached_router._lower_distances("1", _Budget(1000))
        self.assertEqual(uncached, {"1": 0})
        self.assertEqual(len(uncached_router._potential_cache), 0)

    def test_route_crossing_boundary_evaluates_each_entry(self):
        router = self.router()
        dt = datetime(2026, 9, 29, 13, 59, 59, tzinfo=UTC)
        result = router.route("1", "3", router.initial("1"), router.context(dt))
        self.assertEqual(result.status, "ROUTE")
        self.assertNotIn("20:0:f", result.edges)

    def test_access_precedence_and_closing_mid_edge(self):
        source = self.imp.parse_temporal_osm(raw_fixture())
        source["restrictions"] = []
        source["raw_restrictions"] = {}
        source["ways"][0]["tags"]["vehicle:conditional"] = "no @ (11:00-18:00)"
        pack = self.imp.build_temporal_pack(source)
        router = self.router(pack)
        for stamp, allowed in [
            ("2026-09-29T17:59:00+00:00", True),
            ("2026-09-29T17:59:59+00:00", False),
            ("2026-09-29T18:00:00+00:00", False),
        ]:
            route = router.route(
                "1", "2", router.initial("1"), router.context(datetime.fromisoformat(stamp))
            )
            self.assertEqual(route.status == "ROUTE", allowed)
        source["ways"][0]["tags"]["motorcar"] = "yes"
        router = self.router(self.imp.build_temporal_pack(source))
        route = router.route(
            "1", "2", router.initial("1"), router.context(datetime(2026, 9, 29, 18, tzinfo=UTC))
        )
        self.assertEqual(route.status, "ROUTE")

    def test_overnight_access_and_unknown_keys(self):
        source = self.imp.parse_temporal_osm(raw_fixture())
        source["restrictions"] = []
        source["raw_restrictions"] = {}
        source["ways"][0]["tags"]["access:conditional"] = "no @ (23:00-05:00)"
        ss = spec()
        ss["start_utc"] = "2026-09-30T05:00:00+00:00"
        router = self.router(self.imp.build_temporal_pack(source), ss)
        for hour, allowed in [(5, True), (6, False), (10, False), (12, True)]:
            route = router.route(
                "1",
                "2",
                router.initial("1"),
                router.context(datetime(2026, 9, 30, hour, tzinfo=UTC)),
            )
            self.assertEqual(route.status == "ROUTE", allowed)
        source["ways"][0]["tags"]["motor_vehicle:forward:conditional"] = "yes @ (09:00-10:00)"
        self.assertEqual(
            self.imp.build_temporal_pack(source)["inventory"][0]["status"], "unsupported"
        )

    def test_exact_same_context_algorithms_agree_and_cache_does_not_cross_time(self):
        router = self.router()
        for hour in [14, 17]:
            results = [
                router.route(
                    "1",
                    "3",
                    router.initial("1"),
                    router.context(datetime(2026, 9, 29, hour, tzinfo=UTC)),
                    algorithm=a,
                )
                for a in ["astar", "dijkstra"]
            ]
            self.assertEqual(
                (results[0].status, results[0].seconds, results[0].edges),
                (results[1].status, results[1].seconds, results[1].edges),
            )
            self.assertEqual("20:0:f" in results[0].edges, hour == 17)

    def test_legacy_consumers_reject_temporal_pack(self):
        from citylib.fleet_routing_v2 import FleetRouter
        from citylib.routing import Graph

        pack = self.pack()
        for cls in [lambda: FleetRouter(pack, spec()), lambda: Graph(pack)]:
            with self.assertRaises(ValueError):
                cls()

    def test_foreign_context_and_budget_fail_without_unconstrained_fallback(self):
        router = self.router()
        router.max_states = 1
        route = router.route("1", "3", router.initial("1"), router.context(router.start))
        self.assertEqual(route.status, "UNSUPPORTED_CONTEXT")
        ss = spec()
        ss["vehicle_class"] = "psv"
        with self.assertRaises(ValueError):
            self.router(scenario=ss)

    def test_millisecond_rounding_and_source_cost_forgery(self):
        pack = self.pack()
        for edge in pack["edges"]:
            self.assertGreaterEqual(edge["seconds"], edge["source_seconds"])
            self.assertLess(edge["seconds"] - edge["source_seconds"], 0.001)
        pack["edges"][0]["seconds"] = 0.001
        with self.assertRaises(ValueError):
            self.router(pack)

    def test_later_arrival_label_is_not_discarded_at_same_incoming_edge(self):
        # Early a->c reaches the prohibition while active. Slow a->b->c can
        # traverse the same last incoming edge after it opens; no waiting.
        pack = self.pack(raw_fixture("no_left_turn @ (07:00-07:01)"))
        pack["nodes"]["5"] = [-122.421, 37.77]
        pack["nodes"]["6"] = [-122.421, 37.771]
        pack["edges"] = []
        for eid, way, u, v, seconds in [
            ("fast:0:f", "fast", "5", "1", 10),
            ("slow:0:f", "slow", "5", "6", 30),
            ("slow:1:f", "slow", "6", "1", 40),
            ("10:0:f", "10", "1", "2", 5),
            ("20:0:f", "20", "2", "3", 10),
        ]:
            pack["edges"].append(
                {
                    "id": eid,
                    "way": way,
                    "u": u,
                    "v": v,
                    "length_m": 100,
                    "source_seconds": seconds,
                    "duration_ms": seconds * 1000,
                    "seconds": seconds,
                }
            )
        router = self.router(pack)
        for algorithm in ["astar", "dijkstra"]:
            r = router.route(
                "5",
                "3",
                router.initial("5"),
                router.context(datetime(2026, 9, 29, 14, tzinfo=UTC)),
                algorithm=algorithm,
            )
            self.assertEqual(r.status, "ROUTE", r.reason)
            self.assertEqual(r.edges, ("slow:0:f", "slow:1:f", "10:0:f", "20:0:f"))
            self.assertEqual(r.seconds, 85)

    def test_actual_fleet_and_independent_temporal_verifier(self):
        self.assertIsNotNone(
            importlib.util.find_spec("citylib.engine_temporal_v3"),
            "temporal fleet integration missing",
        )
        engine = importlib.import_module("citylib.engine_temporal_v3")
        verifier = importlib.import_module("citylib.verify_temporal_v3")
        pack = self.pack()
        _, _, ss = fleet_fixture()
        ss.update(spec())
        ss.update(
            duration_s=100,
            fleet_size=1,
            turnaround_every=100,
            start_utc="2026-09-29T14:00:00+00:00",
        )
        ss["sites"][0]["node"] = "3"
        inputs = {
            "seed": 601,
            "initial": [{"id": "v1", "node": "1", "energy": 30}],
            "requests": [{"id": "r1", "t": 0, "origin": "2", "destination": "3", "zone": "toy"}],
        }
        run = engine.run_arm(pack, inputs, ss)
        self.assertEqual(run["final"]["requests"][0]["state"], "completed")
        paths = [r["edges"] for r in run["legs"].values()]
        self.assertNotIn("20:0:f", sum(paths, []))
        report = verifier.verify(run, inputs, pack)
        self.assertTrue(report["valid"], report["findings"])
        self.assertFalse(report["recommendation_eligible"])
        from unittest.mock import patch

        with patch.object(
            self.routing.TemporalRouter,
            "_allowed",
            side_effect=AssertionError("producer decisions forbidden"),
        ):
            self.assertTrue(verifier.verify(run, inputs, pack)["valid"])
        bad = copy.deepcopy(run)
        next(iter(bad["legs"].values()))["temporal_entries"][0]["entry_utc"] = (
            "2026-09-29T17:00:00+00:00"
        )
        self.assertFalse(verifier.verify(bad, inputs, pack)["valid"])

    def test_source_unknown_conditional_mode_is_never_ignored(self):
        raw = raw_fixture().replace(
            b"restriction:conditional", b"restriction:motorcar:forward:conditional"
        )
        pack = self.pack(raw)
        self.assertEqual(pack["inventory"][0]["status"], "unsupported")

    def test_verifier_rejects_producer_bypass_of_turn_condition(self):
        from unittest.mock import patch

        from citylib.engine_temporal_v3 import run_arm
        from citylib.verify_temporal_v3 import verify

        pack = self.pack()
        _, _, ss = fleet_fixture()
        ss.update(spec())
        ss.update(duration_s=100, start_utc="2026-09-29T14:00:00+00:00", turnaround_every=100)
        ss["sites"][0]["node"] = "3"
        inputs = {
            "seed": 601,
            "initial": [{"id": "v1", "node": "1", "energy": 30}],
            "requests": [{"id": "r1", "t": 0, "origin": "2", "destination": "3", "zone": "toy"}],
        }
        with patch.object(self.routing.TemporalRouter, "_allowed", return_value=True):
            run = run_arm(pack, inputs, ss)
        report = verify(run, inputs, pack)
        self.assertFalse(report["valid"])
        self.assertIn("conditional turn", str(report["findings"]))

    def test_partial_temporal_leg_and_zero_trip_retain_history(self):
        from citylib.engine_temporal_v3 import run_arm
        from citylib.verify_temporal_v3 import verify

        pack = self.pack()
        _, _, ss = fleet_fixture()
        ss.update(spec())
        ss.update(duration_s=100, start_utc="2026-09-29T14:00:00+00:00", turnaround_every=1)
        ss["sites"][0]["node"] = "3"
        inputs = {
            "seed": 601,
            "initial": [{"id": "v1", "node": "1", "energy": 30}],
            "requests": [{"id": "r1", "t": 0, "origin": "2", "destination": "2", "zone": "toy"}],
        }
        for horizon in [3, 21, 100]:
            run = run_arm(pack, inputs, ss, stop_at=horizon)
            report = verify(run, inputs, pack)
            self.assertTrue(report["valid"], report["findings"])
        paths = [r["edges"] for r in run["legs"].values()]
        self.assertIn([], paths)
        self.assertNotIn("20:0:f", sum(paths, []))

    def test_unknown_node_condition_blocks_incident_way_without_denominator_loss(self):
        raw = raw_fixture().replace(
            b'lon="-122.42" lat="37.77"/>',
            b'lon="-122.42" lat="37.77"><tag k="access:conditional" v="no @ (PH)"/></node>',
        )
        pack = self.pack(raw)
        first = pack["inventory"][0]
        self.assertEqual(first["status"], "unsupported")
        self.assertTrue(first["eligible"])
        self.assertEqual(pack["candidate_ids"], ["10", "20", "30"])

    def test_known_node_gate_is_evaluated_at_arrival_including_route_end(self):
        raw = raw_fixture().replace(
            b'lon="-122.419" lat="37.77"/>',
            b'lon="-122.419" lat="37.77"><tag k="access" v="yes"/>'
            b'<tag k="barrier" v="gate"/>'
            b'<tag k="vehicle:conditional" v="no @ (07:00-10:00)"/></node>',
        )
        pack = self.pack(raw)
        self.assertEqual(pack["inventory"][0]["status"], "included")
        router = self.router(pack)
        for stamp, status in [
            ("2026-09-29T13:59:59+00:00", "NO_MODELED_CONTINUATION"),
            ("2026-09-29T17:00:00+00:00", "ROUTE"),
        ]:
            result = router.route(
                "1", "2", router.initial("1"), router.context(datetime.fromisoformat(stamp))
            )
            self.assertEqual(result.status, status)

    def test_removing_timed_rules_cannot_make_retained_source_unconstrained(self):
        pack = self.pack()
        pack["temporal"]["turns"] = []
        with self.assertRaises(ValueError):
            self.router(pack)
        source = self.imp.parse_temporal_osm(raw_fixture())
        source["ways"][0]["tags"]["access:conditional"] = "no @ (11:00-18:00)"
        pack = self.imp.build_temporal_pack(source)
        pack["temporal"]["access"] = []
        with self.assertRaises(ValueError):
            self.router(pack)

    def test_static_direction_or_mode_override_cannot_be_erased_by_temporal_import(self):
        raw = raw_fixture().replace(
            b'<tag k="type" v="restriction"/>',
            b'<tag k="type" v="restriction"/><tag k="restriction:vehicle" v="no_left_turn"/>',
        )
        self.assertEqual(self.pack(raw)["inventory"][0]["status"], "unsupported")
        source = self.imp.parse_temporal_osm(raw_fixture())
        source["ways"][0]["tags"].update(
            {"motorcar:forward": "no", "vehicle:conditional": "no @ (11:00-18:00)"}
        )
        self.assertEqual(
            self.imp.build_temporal_pack(source)["inventory"][0]["status"], "unsupported"
        )

    def test_ambiguous_node_approach_remains_unsupported(self):
        source = self.imp.parse_temporal_osm(raw_fixture())
        source["ways"][0]["nodes"] = ["1", "2", "4"]
        source["ways"][0]["tags"]["oneway"] = "no"
        self.assertEqual(
            self.imp.build_temporal_pack(source)["inventory"][0]["status"], "unsupported"
        )

    def test_node_opening_exactly_at_journey_horizon_retains_later_label(self):
        source = self.imp.parse_temporal_osm(raw_fixture())
        source["restrictions"] = []
        source["raw_restrictions"] = {}
        source["node_tags"] = {"3": {"vehicle:conditional": "no @ (07:00-07:01)"}}
        pack = self.imp.build_temporal_pack(source)
        pack["nodes"].update({"5": [-122.421, 37.77], "6": [-122.421, 37.771]})
        pack["edges"] = []
        for eid, way, u, v, seconds in [
            ("fast:0:f", "fast", "5", "1", 10),
            ("slow:0:f", "slow", "5", "6", 30),
            ("slow:1:f", "slow", "6", "1", 15),
            ("10:0:f", "10", "1", "2", 5),
            ("20:0:f", "20", "2", "3", 10),
        ]:
            pack["edges"].append(
                {
                    "id": eid,
                    "way": way,
                    "u": u,
                    "v": v,
                    "length_m": 100,
                    "source_seconds": seconds,
                    "duration_ms": seconds * 1000,
                    "seconds": seconds,
                }
            )
        ss = spec()
        ss["route_horizon_s"] = 60
        router = self.router(pack, ss)
        for algorithm in ["astar", "dijkstra"]:
            result = router.route(
                "5",
                "3",
                router.initial("5"),
                router.context(datetime(2026, 9, 29, 14, tzinfo=UTC)),
                algorithm=algorithm,
            )
            self.assertEqual(result.status, "ROUTE", result.reason)
            self.assertEqual(result.seconds, 60)

    def test_all18_captured_lombard_relations_compile_and_obey_literal_boundaries(self):
        raw = (Path(__file__).parent / "fixtures/sf-lombard-conditional.xml").read_bytes()
        pack = self.pack(raw)
        self.assertEqual(len(pack["temporal"]["turns"]), 18)
        self.assertFalse(any(r["status"] == "unsupported" for r in pack["inventory"]))
        scenario = spec()
        scenario["duration_s"] = 16 * 3600
        router = self.router(pack, scenario)
        edges = {e["id"]: e for e in pack["edges"]}
        for rule in pack["temporal"]["turns"]:
            incoming = next(
                e for e in edges.values() if e["way"] == rule["from"] and e["v"] == rule["via"]
            )
            outgoing = next(
                e for e in edges.values() if e["way"] == rule["to"] and e["u"] == rule["via"]
            )
            for stamp, allowed in [
                ("2026-09-29T13:59:59+00:00", True),
                ("2026-09-29T14:00:00+00:00", False),
                ("2026-09-29T16:59:59+00:00", False),
                ("2026-09-29T17:00:00+00:00", True),
                ("2026-09-29T21:59:59+00:00", True),
                ("2026-09-29T22:00:00+00:00", False),
                ("2026-09-30T01:59:59+00:00", False),
                ("2026-09-30T02:00:00+00:00", True),
            ]:
                self.assertEqual(
                    router._allowed(incoming["id"], outgoing["id"], datetime.fromisoformat(stamp)),
                    allowed,
                    rule["id"],
                )

    def test_feasible_journey_bound_avoids_irrelevant_later_schedule_expansion(self):
        pack = self.pack(raw_fixture("no_left_turn @ (07:01-07:02)"))
        pack["edges"] = []
        for i in range(15):
            pack["nodes"][f"s{i}"] = [-122.42 + i * 0.000001, 37.77]
        for i in range(14):
            for branch, extra in [("a", 0), ("b", 2**i)]:
                mid = f"{branch}{i}"
                pack["nodes"][mid] = [-122.42 + (i + 0.5) * 0.000001, 37.77]
                for j, (u, v, ms) in enumerate(
                    [(f"s{i}", mid, 1000 + extra), (mid, f"s{i + 1}", 1000)]
                ):
                    pack["edges"].append(
                        {
                            "id": f"{mid}:{j}:f",
                            "way": mid,
                            "u": u,
                            "v": v,
                            "length_m": 1,
                            "source_seconds": ms / 1000,
                            "duration_ms": ms,
                            "seconds": ms / 1000,
                        }
                    )
        router = self.router(pack)
        router.max_states = 150
        for algorithm in ["astar", "dijkstra"]:
            r = router.route(
                "s0",
                "s14",
                router.initial("s0"),
                router.context(datetime(2026, 9, 29, 14, tzinfo=UTC)),
                algorithm=algorithm,
            )
            self.assertEqual(r.status, "ROUTE", r.reason)
            self.assertEqual(r.seconds, 28)

    def test_static_node_override_is_not_lost_when_no_base_access_tag_exists(self):
        raw = raw_fixture().replace(
            b'lon="-122.419" lat="37.77"/>',
            b'lon="-122.419" lat="37.77"><tag k="motorcar:forward" v="no"/></node>',
        )
        pack = self.pack(raw)
        self.assertEqual(pack["inventory"][0]["status"], "unsupported")
        self.assertTrue(pack["inventory"][0]["eligible"])

    def branching_pack(self, source):
        pack = self.imp.build_temporal_pack(source)
        pack["edges"] = []

        def add(eid, way, u, v, ms):
            for node in (u, v):
                pack["nodes"].setdefault(node, [-122.42, 37.77])
            pack["edges"].append(
                {
                    "id": eid,
                    "way": way,
                    "u": u,
                    "v": v,
                    "length_m": 1,
                    "source_seconds": ms / 1000,
                    "duration_ms": ms,
                    "seconds": ms / 1000,
                }
            )

        # All branching starts after the final boundary relevant to the feasible
        # journey. The blocked shortcut leaves slack in the lower bound: keeping
        # every subset of branch delays would exceed this modest state budget.
        add("entry:0:f", "entry", "start", "s0", 61000)
        for i in range(14):
            for branch, extra in [("a", 0), ("b", 2**i)]:
                mid = f"{branch}{i}"
                add(f"{mid}:0:f", mid, f"s{i}", mid, 1000 + extra)
                add(f"{mid}:1:f", mid, mid, f"s{i + 1}", 1000)
        add("join:0:f", "join", "s14", "1", 1000)
        add("10:0:f", "10", "1", "2", 1000)
        add("20:0:f", "20", "2", "3", 1000)
        add("30:0:f", "30", "2", "4", 20000)
        add("30:1:f", "30", "4", "3", 20000)
        return pack

    def test_arrivals_after_last_boundary_share_static_labels_without_losing_optimum(self):
        source = self.imp.parse_temporal_osm(raw_fixture("no_left_turn @ (07:00-07:01)"))
        source["ways"][1]["tags"]["vehicle:conditional"] = "no @ (07:00-08:00)"
        pack = self.branching_pack(source)
        router = self.router(pack)
        router.max_states = 150
        for algorithm in ["astar", "dijkstra"]:
            result = router.route(
                "start",
                "3",
                router.initial("start"),
                router.context(datetime(2026, 9, 29, 14, tzinfo=UTC)),
                algorithm=algorithm,
            )
            self.assertEqual(result.status, "ROUTE", result.reason)
            self.assertEqual(result.seconds, 131)
            self.assertNotIn("20:0:f", result.edges)
            self.assertFalse(any(edge.startswith("b") for edge in result.edges))

    def test_valid_static_optimum_does_not_expand_for_unrelated_schedule(self):
        raw = raw_fixture("no_left_turn").replace(b"restriction:conditional", b"restriction")
        raw = raw.replace(
            b"</osm>",
            b"""
          <node id="99" lon="-122.43" lat="37.77"/>
          <node id="100" lon="-122.431" lat="37.77"/>
          <way id="40"><nd ref="99"/><nd ref="100"/>
            <tag k="highway" v="residential"/>
            <tag k="vehicle:conditional" v="no @ (07:01-07:02)"/>
          </way></osm>""",
        )
        pack = self.branching_pack(self.imp.parse_temporal_osm(raw))
        router = self.router(pack)
        router.max_states = 150
        for algorithm in ["astar", "dijkstra"]:
            result = router.route(
                "start",
                "3",
                router.initial("start"),
                router.context(datetime(2026, 9, 29, 14, tzinfo=UTC)),
                algorithm=algorithm,
            )
            self.assertEqual(result.status, "ROUTE", result.reason)
            self.assertEqual(result.seconds, 131)
            self.assertNotIn("20:0:f", result.edges)

    def test_unreachable_schedule_changes_do_not_expand_temporal_labels(self):
        for kind in ["way", "node", "turn"]:
            with self.subTest(kind=kind):
                condition = '<tag k="vehicle:conditional" v="no @ (07:01-07:02)"/>'
                extra = f"""
                  <node id="99" lon="-122.43" lat="37.77">
                    {condition if kind == "node" else ""}</node>
                  <node id="100" lon="-122.431" lat="37.77"/>
                  <way id="40"><nd ref="99"/><nd ref="100"/>
                    <tag k="highway" v="residential"/><tag k="oneway" v="yes"/>
                    {condition if kind == "way" else ""}</way>
                  <way id="50"><nd ref="1"/><nd ref="99"/>
                    <tag k="highway" v="residential"/><tag k="oneway" v="yes"/>
                  </way>"""
                if kind == "turn":
                    extra += """<relation id="990"><member type="way" ref="50" role="from"/>
                      <member type="node" ref="99" role="via"/>
                      <member type="way" ref="40" role="to"/>
                      <tag k="type" v="restriction"/>
                      <tag k="restriction:conditional" v="no_left_turn @ (07:01-07:02)"/>
                    </relation>"""
                raw = raw_fixture("no_left_turn @ (07:00-08:00)")
                raw = raw.replace(b"</osm>", extra.encode() + b"</osm>")
                pack = self.branching_pack(self.imp.parse_temporal_osm(raw))
                # Reachable, but too far away for any route within the known
                # feasible 131-second journey. Its 07:02 change is irrelevant.
                for eid, way, u, v, seconds in [
                    ("50:0:f", "50", "1", "99", 500),
                    ("40:0:f", "40", "99", "100", 1),
                    ("exit:0:f", "exit", "100", "3", 1),
                ]:
                    pack["edges"].append(
                        {
                            "id": eid,
                            "way": way,
                            "u": u,
                            "v": v,
                            "length_m": 1,
                            "source_seconds": seconds,
                            "duration_ms": seconds * 1000,
                            "seconds": seconds,
                        }
                    )
                router = self.router(pack)
                router.max_states = 150
                for algorithm in ["astar", "dijkstra"]:
                    result = router.route(
                        "start",
                        "3",
                        router.initial("start"),
                        router.context(datetime(2026, 9, 29, 14, tzinfo=UTC)),
                        algorithm=algorithm,
                    )
                    self.assertEqual(result.status, "ROUTE", result.reason)
                    self.assertEqual(result.seconds, 131)
                    self.assertNotIn("20:0:f", result.edges)

    def test_static_proof_reuse_checks_new_time_with_bounded_work(self):
        router = self.router()
        first = router.route(
            "1",
            "3",
            router.initial("1"),
            router.context(datetime(2026, 9, 29, 17, tzinfo=UTC)),
        )
        self.assertEqual(first.status, "ROUTE")
        # Enough work to check this two-edge route at another departure, but
        # not enough to repeat a graph search. This is a new temporal context.
        router.max_checks = 4
        second = router.route(
            "1",
            "3",
            router.initial("1"),
            router.context(datetime(2026, 9, 29, 17, 1, tzinfo=UTC)),
        )
        self.assertEqual(second.status, "ROUTE", second.reason)
        self.assertEqual(second.edges, first.edges)
        router.max_checks = 2_000_000
        closed = router.route(
            "1",
            "3",
            router.initial("1"),
            router.context(datetime(2026, 9, 29, 22, tzinfo=UTC)),
        )
        self.assertEqual(closed.status, "ROUTE", closed.reason)
        self.assertNotIn("20:0:f", closed.edges)

    def test_static_no_route_proof_reused_across_departure_times(self):
        raw = raw_fixture().replace(b'<tag k="oneway" v="yes"/>', b'<tag k="oneway" v="no"/>', 1)
        router = self.router(self.pack(raw))
        arrival = state_object(
            router.actual_arrival({"arrival_before": router.initial_state("1")}, ["10:0:f"])
        )
        stamp = datetime(2026, 9, 29, 17, tzinfo=UTC)
        first = router.route("2", "1", arrival, router.context(stamp))
        self.assertEqual(first.status, "NO_MODELED_CONTINUATION")
        router.max_checks = 1
        stamp = stamp.replace(minute=1)
        second = router.route("2", "1", arrival, router.context(stamp))
        self.assertEqual(second.status, "NO_MODELED_CONTINUATION", second.reason)

    def test_route_and_static_proofs_share_existing_cache_bounds(self):
        router = self.router()
        router.max_cache_entries = 3
        router._max_cache_edges = 6
        for minute in range(8):
            result = router.route(
                "1",
                "3",
                router.initial("1"),
                router.context(datetime(2026, 9, 29, 17, minute, tzinfo=UTC)),
            )
            self.assertEqual(result.status, "ROUTE", result.reason)
            self.assertLessEqual(len(router._cache), 3)
            self.assertLessEqual(router._cached_edges, 6)
            self.assertEqual(
                router._cached_edges, sum(len(r.edges) for r in router._cache.values())
            )
        # The frequently used proof must remain useful after exact-time entries
        # have churned, while sharing the same total storage ceiling.
        router.max_checks = 4
        result = router.route(
            "1",
            "3",
            router.initial("1"),
            router.context(datetime(2026, 9, 29, 17, 9, tzinfo=UTC)),
        )
        self.assertEqual(result.status, "ROUTE", result.reason)


if __name__ == "__main__":
    unittest.main()
