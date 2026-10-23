import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.pack import build_graph
from citylib.routing import Graph


def source(kind="no_left_turn"):
    return {
        "nodes": {n: [i * 0.001, 0.001 if n == "x" else 0] for i, n in enumerate("abcdefx")},
        "ways": [
            {"id": name, "nodes": nodes, "tags": {"highway": "residential", "oneway": "yes"}}
            for name, nodes in [
                ("from", ["a", "b"]),
                ("via", ["b", "c", "d"]),
                ("to", ["d", "e"]),
                ("branch", ["c", "x"]),
                ("other", ["f", "b"]),
            ]
        ],
        "restrictions": [
            {"id": "r1", "from": "from", "via": None, "via_way": ["via"], "to": "to", "kind": kind}
        ],
    }


class SequenceRestrictionTests(unittest.TestCase):
    def candidate(self, s):
        return build_graph(s, routing_profile="edge-sequence/2.0.0")

    def test_no_restriction_preserves_unrelated_entries_and_early_exit(self):
        p = self.candidate(source())
        graph = Graph(p)
        self.assertIsNone(graph.route("a", "e"))
        self.assertIsNotNone(graph.route("f", "e"))
        self.assertIsNotNone(graph.route("a", "x"))
        self.assertEqual(p["inventory"][0]["status"], "included")

    def test_only_restriction_blocks_branch_but_not_other_entry(self):
        g = Graph(self.candidate(source("only_straight_on")))
        self.assertIsNotNone(g.route("a", "e"))
        self.assertIsNone(g.route("a", "x"))
        self.assertIsNotNone(g.route("f", "x"))

    def test_astar_prepared_parity_and_independent_validation(self):
        from citylib.restrictions import validate_path

        for kind in ["no_left_turn", "only_straight_on"]:
            p = self.candidate(source(kind))
            a, b = Graph(p), Graph(p)
            b.prepare(list(p["nodes"]))
            for start in p["nodes"]:
                for end in p["nodes"]:
                    x, y = a.route(start, end), b.route(start, end)
                    self.assertEqual(x is None, y is None)
                    if x:
                        self.assertAlmostEqual(x["seconds"], y["seconds"])
                        self.assertEqual(validate_path(p, x["edges"]), [])
                        self.assertEqual(validate_path(p, y["edges"]), [])
            forbidden = (
                ["from:0:f", "via:0:f", "via:1:f", "to:0:f"]
                if kind.startswith("no_")
                else ["from:0:f", "via:0:f", "branch:0:f"]
            )
            self.assertTrue(validate_path(p, forbidden))

    def test_fail_closed_and_frozen_default(self):
        original = source()
        self.assertIsNone(Graph(build_graph(original)).route("a", "x"))
        for field, value in [
            ("conditional", True),
            ("kind", "no_mystery"),
            ("via_way", ["missing"]),
        ]:
            s = copy.deepcopy(original)
            s["restrictions"][0][field] = value
            p = self.candidate(s)
            self.assertIsNone(Graph(p).route("a", "x"))
            self.assertEqual(
                next(r for r in p["inventory"] if r["id"] == "from")["status"], "unsupported"
            )

    def test_multi_via_chain_and_reverse_direction(self):
        s = source()
        s["ways"][1]["nodes"] = ["b", "c"]
        s["ways"].append(
            {"id": "via2", "nodes": ["d", "c"], "tags": {"highway": "residential", "oneway": "-1"}}
        )
        s["restrictions"][0]["via_way"] = ["via", "via2"]
        p = self.candidate(s)
        self.assertIsNone(Graph(p).route("a", "e"))
        self.assertIsNotNone(Graph(p).route("f", "e"))
        self.assertEqual(p, self.candidate(copy.deepcopy(s)))

    def test_ambiguous_connection_and_repeated_via_nodes_block(self):
        for nodes in [["b", "a", "c", "d"], ["b", "c", "b", "d"]]:
            s = source()
            s["ways"][1]["nodes"] = nodes
            p = self.candidate(s)
            self.assertEqual(
                next(r for r in p["inventory"] if r["id"] == "from")["status"], "unsupported"
            )


if __name__ == "__main__":
    unittest.main()


class ParserProfileTests(unittest.TestCase):
    def test_candidate_retains_conditional_only_and_marks_malformed(self):
        from citylib.importer import parse_osm

        xml = b"""<osm><relation id="1"><member type="way" ref="10" role="from"/>
        <member type="way" ref="11" role="from"/><member type="way" ref="12" role="to"/>
        <member type="node" ref="2" role="via"/><tag k="type" v="restriction"/>
        <tag k="restriction:conditional" v="no_left_turn @ (Mo-Fr)"/></relation></osm>"""
        self.assertEqual(parse_osm(xml)["restrictions"], [])
        restrictions = parse_osm(xml, routing_profile="edge-sequence/2.0.0")["restrictions"]
        self.assertEqual(len(restrictions), 2)
        self.assertTrue(all(r["conditional"] and r["malformed"] for r in restrictions))

    def test_unknown_profile_and_unversioned_sequences_refused(self):
        p = build_graph(source(), routing_profile="edge-sequence/2.0.0")
        for value in ["future", None]:
            q = copy.deepcopy(p)
            if value is None:
                del q["routing_profile"]
            else:
                q["routing_profile"] = value
            with self.assertRaises(ValueError):
                Graph(q)


class CandidateExecutionTests(unittest.TestCase):
    def test_candidate_cannot_run_fleet_even_with_supplied_graph(self):
        from citylib.engine import run_arm
        from citylib.inputs import generate_inputs
        from test_engine import tiny_pack, tiny_spec

        original = tiny_pack()
        spec = tiny_spec()
        inputs = generate_inputs(original, spec, 42, node_pool=["a", "b", "c", "d"])
        candidate = copy.deepcopy(original)
        candidate["routing_profile"] = "edge-sequence/2.0.0"
        with self.assertRaisesRegex(ValueError, "cross-leg"):
            run_arm(candidate, inputs, spec, graph=Graph(original))


class DistrictGapTests(unittest.TestCase):
    def test_gap_geometry_is_retained_without_nearest_assignment(self):
        from citylib.qualification import district_gap_inventory
        from shapely.geometry import Polygon, mapping

        p = build_graph(
            {
                "nodes": {"a": [0.1, 0.5], "b": [0.9, 0.5]},
                "ways": [{"id": "1", "nodes": ["a", "b"], "tags": {"highway": "residential"}}],
            }
        )
        p["source"] = {"districts_sha256": "frozen"}
        boundary = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        districts = {
            "features": [
                {
                    "properties": {"sup_dist": "1"},
                    "geometry": mapping(Polygon([(0, 0), (0.5, 0), (0.5, 1), (0, 1)])),
                }
            ]
        }
        gaps = district_gap_inventory(p, boundary, districts)
        self.assertEqual(len(gaps["records"]), 1)
        gap = gaps["records"][0]
        self.assertEqual(gap["district_assignment"], "UNASSIGNED")
        self.assertGreater(gap["gap_length_m"], 1000)
        self.assertEqual(gap["source_way_id"], "1")
        self.assertEqual(gap["nearest_districts_not_assignments"][0]["district"], "1")

    def test_overlapping_districts_do_not_hide_uncovered_geometry(self):
        from citylib.qualification import district_gap_inventory
        from shapely.geometry import Polygon, mapping

        p = build_graph(
            {
                "nodes": {"a": [0.1, 0.5], "b": [0.9, 0.5]},
                "ways": [{"id": "1", "nodes": ["a", "b"], "tags": {"highway": "residential"}}],
            }
        )
        p["source"] = {"districts_sha256": "frozen"}
        boundary = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        geometry = mapping(Polygon([(0, 0), (0.5, 0), (0.5, 1), (0, 1)]))
        districts = {
            "features": [{"properties": {"sup_dist": d}, "geometry": geometry} for d in ["1", "2"]]
        }
        self.assertGreater(
            district_gap_inventory(p, boundary, districts)["total_gap_length_m"], 1000
        )


class RestrictionAccountingTests(unittest.TestCase):
    def test_missing_from_restriction_is_counted_as_blocked(self):
        s = source()
        s["restrictions"] = [
            {
                "id": "broken",
                "from": None,
                "to": "to",
                "via": "d",
                "kind": "only_right_turn",
                "malformed": True,
            }
        ]
        p = build_graph(s, routing_profile="edge-sequence/2.0.0")
        self.assertEqual(len(p["restriction_audit"]), 1)
        self.assertEqual(p["restriction_audit"][0]["status"], "BLOCKED")


class SuppliedGraphBindingTests(unittest.TestCase):
    def setUp(self):
        from citylib.inputs import generate_inputs
        from test_engine import tiny_pack, tiny_spec

        self.pack = tiny_pack()
        self.spec = tiny_spec()
        self.inputs = generate_inputs(self.pack, self.spec, 42, node_pool=["a", "b", "c", "d"])

    def test_candidate_graph_cannot_hide_behind_original_pack(self):
        from citylib.engine import run_arm

        candidate = copy.deepcopy(self.pack)
        candidate["routing_profile"] = "edge-sequence/2.0.0"
        with self.assertRaisesRegex(ValueError, "routing|graph"):
            run_arm(self.pack, self.inputs, self.spec, graph=Graph(candidate))

    def test_supplied_graph_with_different_turn_semantics_is_rejected(self):
        from citylib.engine import run_arm

        changed = copy.deepcopy(self.pack)
        changed["turns"] = [
            {"id": "added", "from": "1", "to": "2", "via": "b", "kind": "only_right_turn"}
        ]
        with self.assertRaisesRegex(ValueError, "graph"):
            run_arm(self.pack, self.inputs, self.spec, graph=Graph(changed))

    def test_mutated_runtime_fields_are_rejected(self):
        from citylib.engine import run_arm

        for field in ["nodes", "edges", "out", "rules", "history"]:
            graph = Graph(copy.deepcopy(self.pack))
            if field == "nodes":
                graph.nodes = {**graph.nodes, "unexpected": [1, 1]}
            elif field == "edges":
                graph.edges = {}
            elif field == "out":
                graph.out["a"] = []
            elif field == "rules":
                graph.rules[("b", "1")] = [{"id": "fake"}]
            else:
                graph.history = object()
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "graph"):
                run_arm(self.pack, self.inputs, self.spec, graph=graph)

    def test_equivalent_supplied_graph_preserves_v1_run_digest(self):
        from citylib.contracts import digest
        from citylib.engine import run_arm

        a = run_arm(self.pack, self.inputs, self.spec)
        graph = Graph(copy.deepcopy(self.pack))
        self.assertEqual(digest(a), digest(run_arm(self.pack, self.inputs, self.spec, graph=graph)))


class CompiledRuleValidationTests(unittest.TestCase):
    def test_malformed_compiled_rules_are_rejected_before_routing(self):
        from citylib.restrictions import validate_path

        original = build_graph(source(), routing_profile="edge-sequence/2.0.0")
        variations = [
            ("edge_sequences", [["from:0:f", "from:0:f", "to:0:f"]]),
            ("semantics", "future/3.0.0"),
            ("kind", "only_mystery"),
            ("edge_sequences", []),
            ("edge_sequences", [["from:0:f", "to:0:f"]]),
            ("edge_sequences", [["from:0:f", *[f"via:{i}:f" for i in range(257)], "to:0:f"]]),
            ("via_way", [str(i) for i in range(9)]),
            ("edge_sequences", [["from:0:f", "other:0:f", "to:0:f"]]),
        ]
        for field, value in variations:
            pack = copy.deepcopy(original)
            pack["turns"][0][field] = value
            with self.subTest(field=field, value=str(value)[:70]):
                with self.assertRaisesRegex(ValueError, "compiled"):
                    Graph(pack)
                with self.assertRaisesRegex(ValueError, "compiled"):
                    validate_path(pack, [])
