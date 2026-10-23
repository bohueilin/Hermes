import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.engine import run_arm
from citylib.inputs import generate_inputs
from citylib.presentation import feature_vehicles, vehicle_views
from test_engine import tiny_pack, tiny_spec


class PresentationTests(unittest.TestCase):
    def fixture(self):
        graph, spec = tiny_pack(), tiny_spec()
        spec.update(
            duration_s=1800,
            request_count=8,
            initial_kwh=18.0,
            target_kwh=24.0,
            turnaround_every=1,
            turnaround_s=30,
        )
        inputs = generate_inputs(graph, spec, 42, node_pool=["a", "b", "c", "d"])
        return graph, inputs, run_arm(graph, inputs, spec)

    def test_summary_conserves_vehicle_and_fleet_ledgers(self):
        graph, inputs, run = self.fixture()
        views = list(vehicle_views(run, inputs, graph))
        self.assertEqual(
            sum(v["summary"]["completed"] for v in views),
            sum(r["state"] == "completed" for r in run["final"]["requests"]),
        )
        for view, final in zip(views, run["final"]["vehicles"], strict=True):
            s = view["summary"]
            self.assertAlmostEqual(s["distance_m"], final["distance_m"])
            self.assertAlmostEqual(s["empty_m"], final["empty_m"])
            self.assertEqual(s["completed"], final["trips"])
            self.assertAlmostEqual(sum(i["end"] - i["start"] for i in view["intervals"]), 1800)
            self.assertEqual(view["events"][-1]["kind"], "run_end")
            self.assertEqual(view["events"][-1]["t"], 1800)
            self.assertTrue(any(e["kind"] == "state" for e in view["events"]))
            self.assertIsNone(s["injury_crash_rate_per_mm"])
            self.assertIsNone(s["remote_guidance_per_mm"])
            self.assertIsNone(s["minimum_risk_maneuvers"])
            self.assertIsNone(s["revenue"])
            self.assertEqual([s["id"] for s in view["sites"]], ["A"])
            self.assertAlmostEqual(
                sum(r["distance_m"] for r in view["routes"]["features"]), s["distance_m"]
            )

    def test_paid_population_excludes_unfinished_passenger_leg(self):
        graph, inputs, run = self.fixture()
        # A hand-calculable partial-trip fixture: 100 m completed + 50 m unfinished.
        vid = inputs["initial"][0]["id"]
        run["final"]["requests"] = [
            dict(id="paid", vehicle=vid, state="completed", boarded_at=0, completed_at=10),
            dict(id="open", vehicle=vid, state="in_progress", boarded_at=12),
        ]
        run["events"] = [
            dict(t=0, kind="leg_start", vehicle=vid, leg="p", purpose="passenger", request="paid"),
            dict(t=10, kind="leg_end", vehicle=vid, leg="p", distance_m=100),
            dict(t=12, kind="leg_start", vehicle=vid, leg="q", purpose="passenger", request="open"),
            dict(t=20, kind="run_end"),
        ]
        run["legs"] = {
            "p": dict(nodes=["a", "b"], edges=[], length_m=100),
            "q": dict(nodes=["b", "c"], edges=[], length_m=100),
        }
        run["elapsed_s"] = 20
        final = run["final"]["vehicles"][0]
        final.update(leg="q", leg_distance=50, distance_m=150, empty_m=0, trips=1)
        view = next(vehicle_views(run, inputs, graph))
        self.assertEqual(view["summary"]["completed_passenger_m"], 100)
        self.assertEqual(view["summary"]["completed_passenger_s"], 10)
        self.assertEqual(view["summary"]["in_progress"], 1)

    def test_feature_rules_deterministic_and_not_candidate_cherry_picking(self):
        rows = [
            {"vehicle": f"ev-{i:03d}", "completed": i % 7, "queue_s": i * 10} for i in range(1, 101)
        ]
        featured = feature_vehicles(rows)
        self.assertEqual(featured[0]["vehicle"], "ev-001")
        self.assertEqual(featured, feature_vehicles(list(reversed(rows))))
        self.assertIn("ev-100", [r["vehicle"] for r in featured])
        self.assertLessEqual(len(featured), 4)
