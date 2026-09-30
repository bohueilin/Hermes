import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest
from citylib.engine import run_arm
from citylib.inputs import generate_inputs
from citylib.verify import verify
from test_engine import tiny_pack, tiny_spec


class ReviewIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.pack, self.spec = tiny_pack(), tiny_spec()
        self.inputs = generate_inputs(self.pack, self.spec, 42, node_pool=["a", "b", "c", "d"])
        self.run = run_arm(self.pack, self.inputs, self.spec)

    def test_unearned_charge_and_fabricated_queue_time(self):
        for mode in ("charge", "queue"):
            r = copy.deepcopy(self.run)
            for e in r["events"]:
                if e["kind"] == "energy":
                    if mode == "charge":
                        e["charged_kwh"] += 1
                        e["energy"] += 1
                    else:
                        e.update(queue_s=e["t"], idle_s=0, busy_s=0)
            if mode == "charge":
                for v in r["final"]["vehicles"]:
                    v["energy"] += 1
            self.assertFalse(verify(r, self.inputs, self.pack)["valid"], mode)

    def test_pose_state_energy_heading_must_match_ledger(self):
        for index, value in [(5, "charging"), (6, 60), (4, 181)]:
            r = copy.deepcopy(self.run)
            for p in r["poses"]:
                p[index] = value
            self.assertFalse(verify(r, self.inputs, self.pack)["valid"], index)

    def test_completion_must_visit_frozen_request_endpoints(self):
        inputs = copy.deepcopy(self.inputs)
        for request in inputs["requests"]:
            request["origin"] = request["destination"] = "a"
        r = copy.deepcopy(self.run)
        r["input_digest"] = digest(inputs)
        self.assertFalse(verify(r, inputs, self.pack)["valid"])

    def test_counter_and_final_inventory_mismatch_rejected(self):
        for field in ("counters", "inventory"):
            r = copy.deepcopy(self.run)
            if field == "counters":
                r["counters"]["unreachable_requests"] += 1
            else:
                r["final"]["vehicles"].pop()
            self.assertFalse(verify(r, self.inputs, self.pack)["valid"])

    def test_valid_charge_release_and_dispatch_same_tick(self):
        s = dict(
            self.spec,
            duration_s=1800,
            request_count=8,
            initial_kwh=18.0,
            target_kwh=24.0,
            turnaround_every=1,
            turnaround_s=30,
        )
        i = generate_inputs(self.pack, s, 42, node_pool=["a", "b", "c", "d"])
        r = run_arm(self.pack, i, s)
        v = verify(r, i, self.pack)
        self.assertTrue(v["valid"], v["findings"])
