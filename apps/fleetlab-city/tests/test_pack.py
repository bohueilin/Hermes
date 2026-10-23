"""Hand-computed topology fixtures; these are not SF map qualification."""

import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.pack import build_graph, qualify_inventory
from citylib.routing import Graph


def fixture():
    return {
        "nodes": {
            "1": [0, 0],
            "2": [0.001, 0],
            "3": [0.002, 0],
            "4": [0.001, -0.001],
            "5": [0.001, 0.001],
            "6": [0.003, 0],
        },
        "ways": [
            {"id": "10", "nodes": ["1", "2", "3"], "tags": {"highway": "residential"}},
            {
                "id": "20",
                "nodes": ["4", "5"],
                "tags": {"highway": "primary", "bridge": "yes", "layer": "1"},
            },
            {
                "id": "30",
                "nodes": ["3", "6"],
                "tags": {"highway": "residential", "name": "新宿通り"},
            },
        ],
        "restrictions": [],
        "node_tags": {},
    }


class PackTests(unittest.TestCase):
    def test_prepared_router_preserves_turn_cost_and_disconnection(self):
        g = Graph(build_graph(fixture()))
        before = g.route("1", "6")
        g.prepare(["1", "4", "6"])
        g.cache.clear()
        self.assertAlmostEqual(g.route("1", "6")["seconds"], before["seconds"], places=8)
        self.assertEqual(g.route("1", "6")["nodes"], before["nodes"])
        self.assertIsNone(g.route("1", "4"))

    def test_grade_separation_has_no_geometric_join(self):
        g = Graph(build_graph(fixture()))
        self.assertIsNone(g.route("1", "4"))
        self.assertEqual(g.route("1", "6")["nodes"], ["1", "2", "3", "6"])

    def test_oneway_and_reverse(self):
        f = fixture()
        f["ways"][0]["tags"]["oneway"] = "-1"
        g = Graph(build_graph(f))
        self.assertIsNone(g.route("1", "3"))
        self.assertEqual(g.route("3", "1")["nodes"], ["3", "2", "1"])

    def test_private_and_conditional_are_accounted_and_blocked(self):
        for tags, status in [
            ({"access": "private"}, "excluded"),
            ({"motor_vehicle:conditional": "no @ (Mo-Fr)"}, "unsupported"),
        ]:
            f = fixture()
            f["ways"][2]["tags"].update(tags)
            p = build_graph(f)
            self.assertEqual(next(x for x in p["inventory"] if x["id"] == "30")["status"], status)
            self.assertIsNone(Graph(p).route("1", "6"))
            self.assertTrue(qualify_inventory(p)["accounting_complete"])

    def test_no_turn_and_only_turn(self):
        for kind in ["no_right_turn", "only_straight_on"]:
            f = fixture()
            f["ways"].append(
                {
                    "id": "40",
                    "nodes": ["3", "5"],
                    "tags": {"highway": "residential", "oneway": "yes"},
                }
            )
            f["restrictions"] = [
                {
                    "id": "r1",
                    "from": "10",
                    "to": "30" if kind.startswith("no_") else "40",
                    "via": "3",
                    "kind": kind,
                }
            ]
            self.assertIsNone(Graph(build_graph(f)).route("1", "6"))

    def test_via_way_blocks_affected_from_way_with_reason(self):
        f = fixture()
        f["restrictions"] = [
            {"id": "r1", "from": "10", "to": "30", "via_way": ["20"], "kind": "no_right_turn"}
        ]
        p = build_graph(f)
        self.assertIsNone(Graph(p).route("1", "6"))
        self.assertEqual(p["inventory"][0]["status"], "unsupported")
        self.assertIn("via-way", p["inventory"][0]["reason"])

    def test_inventory_loss_does_not_redefine_denominator(self):
        p = build_graph(fixture())
        p["inventory"].pop()
        q = qualify_inventory(p)
        self.assertFalse(q["accounting_complete"])
        self.assertEqual(q["missing_ids"], ["30"])

    def test_duplicate_inventory_rejected(self):
        p = build_graph(fixture())
        p["inventory"].append(copy.deepcopy(p["inventory"][0]))
        self.assertFalse(qualify_inventory(p)["accounting_complete"])

    def test_island_buffer_and_unicode_left_hand(self):
        f = fixture()
        f["drive_side"] = "left"
        f["ways"][1]["scope"] = "island"
        f["ways"][2]["scope"] = "buffer"
        p = build_graph(f)
        self.assertEqual(p["drive_side"], "left")
        self.assertEqual(p["inventory"][1]["scope"], "island")
        self.assertEqual(p["inventory"][2]["name"], "新宿通り")
        self.assertIsNone(Graph(p).route("4", "6"))

    def test_unknown_oneway_never_becomes_bidirectional(self):
        f = fixture()
        f["ways"][0]["tags"]["oneway"] = "reversible"
        self.assertIsNone(Graph(build_graph(f)).route("1", "3"))

    def test_malformed_only_turn_blocks_all_incident_ways(self):
        f = fixture()
        f["restrictions"] = [
            {"id": "broken", "from": None, "to": "30", "via": "3", "kind": "only_right_turn"}
        ]
        p = build_graph(f)
        self.assertIsNone(Graph(p).route("1", "6"))
        self.assertEqual(p["inventory"][0]["status"], "unsupported")

    def test_missing_node_quarantines_way(self):
        f = fixture()
        f["ways"][0]["nodes"].append("missing")
        p = build_graph(f)
        self.assertEqual(p["inventory"][0]["status"], "quarantined")
        self.assertTrue(qualify_inventory(p)["accounting_complete"])


if __name__ == "__main__":
    unittest.main()
