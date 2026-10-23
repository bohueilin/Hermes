"""Presentation must not attach a different map's engineering or human evidence."""

import copy
import importlib
import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.review_workspace_v1 import candidate_identity
from test_temporal_review_v1 import sample_candidate


class TemporalExportTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("citylib.temporal_export_v1"))
        self.module = importlib.import_module("citylib.temporal_export_v1")
        self.candidate = sample_candidate()
        self.envelope = {
            "candidate": candidate_identity(self.candidate),
            "qualification": "HOLD",
            "schema": "fleetlab.map-review-envelope/1.0.0",
            "scope": "SIMULATION_ONLY",
            "deployment_permission": "NONE",
            "obligations": {"one": "UNRESOLVED"},
            "human_samples": {"segments": 0, "od": 0},
        }
        self.engineering = {
            "pack_digest": "b" * 64,
            "scope": "ONE_ENGINEERING_CASE",
            "run_digest": "c" * 64,
            "recommendation_eligible": False,
        }

    def test_summary_retains_limits_and_explicit_evidence_identity(self):
        result = self.module.summary(self.candidate, self.envelope, self.engineering)
        self.assertEqual(result["engineering"], self.engineering)
        self.assertEqual(result["review"]["human_samples"], {"segments": 0, "od": 0})
        self.assertEqual(result["review"]["obligation_count"], 1)
        self.assertEqual(result["scope"], "SIMULATION_ONLY")
        self.assertEqual(result["decision_authority"], "NONE")

    def test_evidence_for_another_map_or_elevated_permission_fails(self):
        for item in ["engineering", "review", "authority", "qualified"]:
            envelope, engineering = copy.deepcopy(self.envelope), copy.deepcopy(self.engineering)
            if item == "engineering":
                engineering["pack_digest"] = "f" * 64
            elif item == "review":
                envelope["candidate"]["graph"] = "f" * 64
            elif item == "authority":
                envelope["deployment_permission"] = "DEPLOY"
            else:
                envelope["qualification"] = "PASS"
            with self.subTest(item=item), self.assertRaises(ValueError):
                self.module.summary(self.candidate, envelope, engineering)


if __name__ == "__main__":
    unittest.main()
