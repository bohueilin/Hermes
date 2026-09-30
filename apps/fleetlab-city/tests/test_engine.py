import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest
from citylib.engine import capacity_schedule, charge_allocation, reserve_feasible, run_arm
from citylib.inputs import generate_inputs
from citylib.pack import build_graph


def tiny_pack():
    p = build_graph(
        {
            "nodes": {"a": [0, 0], "b": [0.001, 0], "c": [0.002, 0], "d": [0.001, 0.001]},
            "ways": [
                {"id": "1", "nodes": ["a", "b", "c"], "tags": {"highway": "residential"}},
                {"id": "2", "nodes": ["b", "d", "c"], "tags": {"highway": "residential"}},
            ],
            "restrictions": [],
        }
    )
    p["pack_id"] = "toy"
    return p


def tiny_spec():
    return {
        "model": "fleetlab.graph-resource/1.0.0",
        "duration_s": 120,
        "fleet_size": 2,
        "request_count": 2,
        "initial_kwh": 30.0,
        "capacity_kwh": 60.0,
        "reserve_kwh": 12.0,
        "return_kwh": 21.0,
        "target_kwh": 48.0,
        "drive_kwh_per_km": 0.18,
        "aux_kw": 1.0,
        "boarding_s": 10,
        "dispatch_s": 5,
        "patience_s": 900,
        "turnaround_every": 4,
        "turnaround_s": 360,
        "sample_s": 5,
        "background_per_hour": 0,
        "sites": [{"id": "A", "node": "a", "ports": 2, "power_kw": 100, "slots": 2, "port_kw": 50}],
    }


class EngineTests(unittest.TestCase):
    def test_unsupported_traffic_and_incidents_fail_explicitly(self):
        p, s = tiny_pack(), tiny_spec()
        i = generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"])
        for field in ("background", "incidents"):
            altered = copy.deepcopy(i)
            altered[field] = [{"t": 1}]
            with self.assertRaisesRegex(ValueError, "not modeled"):
                run_arm(p, altered, s)
        with self.assertRaisesRegex(ValueError, "not modeled"):
            run_arm(p, i, {**s, "background_per_hour": 100})

    def test_known_capacity_harm(self):
        self.assertEqual(capacity_schedule([0, 0], 60, 2), [60, 60])
        self.assertEqual(capacity_schedule([0, 0], 60, 1), [60, 120])

    def test_power_and_reserve_boundaries(self):
        self.assertEqual(charge_allocation(4, 100, 50), [25.0, 25.0, 25.0, 25.0])
        self.assertTrue(reserve_feasible(13, 1000, 0, 0.001, 0, 12))
        self.assertFalse(reserve_feasible(12.999, 1000, 0, 0.001, 0, 12))

    def test_run_spec_does_not_include_mutable_runtime_state(self):
        p = tiny_pack()
        s = tiny_spec()
        i = generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"])
        self.assertEqual(run_arm(p, i, s)["spec"], s)

    def test_null_pair_identical_and_ledger_conserved(self):
        p = tiny_pack()
        s = tiny_spec()
        i = generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"])
        a = run_arm(p, i, s)
        b = run_arm(p, copy.deepcopy(i), copy.deepcopy(s))
        self.assertEqual(digest(a), digest(b))
        self.assertEqual(a["execution"], "COMPLETE")
        self.assertEqual(len(a["final"]["vehicles"]), 2)
        self.assertEqual(len(a["final"]["requests"]), 2)
        self.assertEqual([e["seq"] for e in a["events"]], list(range(len(a["events"]))))

    def test_late_requests_and_interruption_remain_counted(self):
        p = tiny_pack()
        s = tiny_spec()
        i = generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"])
        i["requests"] = [{"id": "r0", "t": 119, "origin": "a", "destination": "c", "zone": "toy"}]
        a = run_arm(p, i, s)
        self.assertEqual(a["final"]["requests"][0]["state"], "waiting")
        b = run_arm(p, i, s, stop_at=50)
        self.assertEqual(b["execution"], "INCOMPLETE")
        self.assertEqual(b["counters"]["teleports"], 0)

    def test_input_generation_independent_of_policy(self):
        p = tiny_pack()
        s = tiny_spec()
        a = generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"])
        s["sites"][0]["ports"] = 1
        self.assertEqual(a, generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"]))

    def test_charging_and_turnaround_exercised(self):
        p = tiny_pack()
        s = tiny_spec()
        s.update(
            duration_s=1800,
            request_count=8,
            initial_kwh=18.0,
            target_kwh=24.0,
            turnaround_every=1,
            turnaround_s=30,
        )
        i = generate_inputs(p, s, 42, node_pool=["a", "b", "c", "d"])
        a = run_arm(p, i, s)
        kinds = {e["kind"] for e in a["events"]}
        self.assertIn("charge", kinds)
        self.assertIn("turnaround_start", kinds)
        self.assertTrue(all(0 <= v["energy"] <= 60 for v in a["final"]["vehicles"]))


if __name__ == "__main__":
    unittest.main()
