import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.compare import decide, paired_interval
from citylib.engine import run_arm
from citylib.inputs import generate_inputs
from citylib.verify import verify
from test_engine import tiny_pack, tiny_spec


class VerifyTests(unittest.TestCase):
    def setUp(self):
        self.pack = tiny_pack()
        self.spec = tiny_spec()
        self.inputs = generate_inputs(self.pack, self.spec, 42, node_pool=["a", "b", "c", "d"])
        self.run = run_arm(self.pack, self.inputs, self.spec)

    def test_derives_metrics_without_trusting_summary(self):
        v = verify(self.run, self.inputs, self.pack)
        self.assertTrue(v["valid"], v["findings"])
        m = v["metrics"]
        self.assertEqual(
            sum(m[k] for k in ["completed", "unserved", "waiting", "in_progress"]), m["created"]
        )
        self.run["metrics"] = {"completed": 999}
        self.assertFalse(verify(self.run, self.inputs, self.pack)["valid"])

    def test_event_loss_order_and_final_mutation(self):
        for mutate in [
            lambda r: r["events"].pop(2),
            lambda r: r["events"].reverse(),
            lambda r: r["final"]["vehicles"][0].update(energy=999),
        ]:
            r = copy.deepcopy(self.run)
            mutate(r)
            self.assertFalse(verify(r, self.inputs, self.pack)["valid"])

    def test_candidate_routing_cannot_bypass_continuity_qualification(self):
        self.pack["routing_profile"] = "edge-sequence/2.0.0"
        result = verify(self.run, self.inputs, self.pack)
        self.assertFalse(result["valid"])
        self.assertTrue(any(f["code"] == "routing_continuity" for f in result["findings"]))

    def test_unknown_routing_profile_rejected(self):
        self.pack["routing_profile"] = "future/99.0.0"
        with self.assertRaisesRegex(ValueError, "routing profile"):
            verify(self.run, self.inputs, self.pack)

    def test_missing_pose_and_fabricated_distance_are_detected(self):
        r = copy.deepcopy(self.run)
        r["poses"].pop(0)
        self.assertFalse(verify(r, self.inputs, self.pack)["valid"])
        r = copy.deepcopy(self.run)
        for e in r["events"]:
            if e["kind"] == "energy":
                e["distance_m"] += 100
                e["energy"] -= 0.018
        for v in r["final"]["vehicles"]:
            v["energy"] -= 0.018
        self.assertFalse(verify(r, self.inputs, self.pack)["valid"])

    def test_pose_disagreement_and_unknown_vehicle(self):
        r = copy.deepcopy(self.run)
        r["poses"][0][2] = 40
        self.assertFalse(verify(r, self.inputs, self.pack)["valid"])

    def test_empty_denominator_null(self):
        s = tiny_spec()
        s["request_count"] = 0
        i = generate_inputs(self.pack, s, 1, node_pool=["a", "b"])
        r = run_arm(self.pack, i, s)
        m = verify(r, i, self.pack)["metrics"]
        self.assertIsNone(m["completion_fraction"])
        self.assertIsNone(m["wait_p90_s"])
        self.assertIn("completion_fraction", m["unavailable"])

    def test_incomplete_and_teleport_not_comparable(self):
        r = run_arm(self.pack, self.inputs, self.spec, stop_at=50)
        self.assertFalse(verify(r, self.inputs, self.pack)["recommendation_eligible"])
        r = copy.deepcopy(self.run)
        r["counters"]["teleports"] = 1
        self.assertFalse(verify(r, self.inputs, self.pack)["recommendation_eligible"])


class ComparisonTests(unittest.TestCase):
    def test_null_bootstrap(self):
        self.assertEqual(paired_interval([0] * 12), {"mean": 0.0, "low": 0.0, "high": 0.0, "n": 12})

    def test_margin_and_guardrail_precedence(self):
        good = {"mean": 3, "low": 2.1, "high": 4, "n": 12}
        zero = {"mean": 0, "low": 0, "high": 0, "n": 12}
        self.assertEqual(decide(good, zero, zero, [])["outcome"], "SUPPORTED_WITHIN_MODEL")
        harm = {**zero, "low": 11, "high": 15}
        self.assertEqual(decide(good, harm, zero, [])["outcome"], "GUARDRAIL_HARMED")
        crossing = {**zero, "low": 5, "high": 15}
        self.assertEqual(decide(good, crossing, zero, [])["outcome"], "GUARDRAIL_INCONCLUSIVE")
        self.assertEqual(decide(zero, zero, zero, [])["outcome"], "NO_SUPPORTED_IMPROVEMENT")

    def test_zone_veto_and_sparse(self):
        good = {"mean": 3, "low": 2.1, "high": 4, "n": 12}
        zero = {"mean": 0, "low": 0, "high": 0, "n": 12}
        self.assertEqual(
            decide(
                good,
                zero,
                zero,
                [{"zone": "x", "baseline_n": 30, "candidate_n": 30, "delta_pp": -6}],
            )["outcome"],
            "ZONE_HARM_VETO",
        )
        self.assertEqual(
            decide(
                good,
                zero,
                zero,
                [{"zone": "x", "baseline_n": 29, "candidate_n": 30, "delta_pp": 0}],
            )["outcome"],
            "INSUFFICIENT_ZONE_DATA",
        )

    def test_undefined_guardrail_never_passes(self):
        z = {"mean": 3, "low": 3, "high": 3, "n": 12}
        self.assertEqual(decide(z, None, z, [])["outcome"], "UNAVAILABLE_GUARDRAIL")


if __name__ == "__main__":
    unittest.main()


class DegenerateGeometryTests(unittest.TestCase):
    def test_zero_length_source_edges_keep_clock_consistent(self):
        from citylib.pack import build_graph

        nodes = {str(i): [0, 0] for i in range(10)}
        nodes["end"] = [0.001, 0]
        p = build_graph(
            {
                "nodes": nodes,
                "ways": [{"id": "w", "nodes": list(nodes), "tags": {"highway": "residential"}}],
                "restrictions": [],
            }
        )
        s = tiny_spec()
        s.update(fleet_size=1, boarding_s=0, sample_s=1)
        s["sites"][0]["node"] = "0"
        i = {
            "initial": [{"id": "ev-001", "node": "0", "energy": 30.0}],
            "requests": [{"id": "r0", "t": 0, "origin": "0", "destination": "end", "zone": "toy"}],
        }
        r = run_arm(p, i, s)
        v = verify(r, i, p)
        self.assertTrue(v["valid"], v["findings"])
