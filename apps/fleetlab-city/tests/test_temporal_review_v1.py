"""Freeze new obligations without borrowing earlier human review or dropping inputs."""

import copy
import importlib
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest, load_json


def sample_candidate():
    return {
        "manifest.json": {"content_digest": "a" * 64},
        "qualification-report.json": {
            "schema": "fleetlab.temporal-map-candidate/1.0.0",
            "candidate_graph_digest": "b" * 64,
        },
        "source-inventory.json": {"fixture": True},
        "graph.json": {"nodes": {str(i): [0, 0] for i in range(250)}},
        "roads.geo.json": {
            "features": [
                {
                    "properties": {
                        "id": str(i),
                        "class": "trunk" if i % 2 else "service",
                        "status": "included",
                    }
                }
                for i in range(220)
            ]
        },
        "human-review-checklist.json": {
            "restored_ways": [{"source_way_id": "1"}],
            "newly_blocked_ways": [],
            "unsupported_ways": ["1"],
            "static_restriction_exceptions": [{"id": "1"}],
            "temporal_source_audit": [{"id": "1", "kind": "relation", "status": "UNSUPPORTED"}],
            "timed_turns": [],
            "timed_access_ways": [],
            "access_nodes": ["2"],
            "district_gap_way_ids": ["1"],
        },
        "coverage.json": {
            "accounting_complete": True,
            "unsupported_fraction": 0.01,
            "by_class": {"service": {"unsupported_fraction": 0.01}},
        },
    }


class TemporalReviewTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("citylib.temporal_review_v1"))
        self.module = importlib.import_module("citylib.temporal_review_v1")
        self.candidate = sample_candidate()
        self.pool = list(self.candidate["graph.json"]["nodes"])

    def test_new_identity_exact_population_and_deterministic_distinct_samples(self):
        requirements = self.module.requirements(self.candidate, self.pool)
        self.assertEqual(
            requirements, self.module.requirements(self.candidate, list(reversed(self.pool)))
        )
        segments = [s for s in requirements["samples"] if s["kind"] == "segment"]
        od = [s for s in requirements["samples"] if s["kind"] == "od"]
        self.assertEqual(len(segments), 200)
        self.assertEqual(len(od), 100)
        self.assertEqual(len({s["id"] for s in segments}), 200)
        self.assertTrue(all(s["origin_node"] != s["destination_node"] for s in od))
        self.assertEqual(requirements["candidate"]["pack"], "a" * 64)
        changed = copy.deepcopy(self.candidate)
        changed["manifest.json"]["content_digest"] = "f" * 64
        self.assertNotEqual(
            digest(requirements), digest(self.module.requirements(changed, self.pool))
        )

    def test_duplicate_feature_categories_merge_without_omitting_reasons(self):
        requirements = self.module.requirements(self.candidate, self.pool)
        by_id = {r["id"]: r for r in requirements["obligations"]}
        self.assertEqual(len(by_id), len(requirements["obligations"]))
        self.assertTrue(
            {"restored", "unsupported", "district-gap"} <= set(by_id["way-1"]["reasons"])
        )
        self.assertTrue(
            {"static-restriction-exception", "temporal-UNSUPPORTED"}
            <= set(by_id["relation-1"]["reasons"])
        )
        self.assertIn("node-2", by_id)

    def test_missing_pool_nodes_and_insufficient_population_fail_without_shrinking(self):
        for pool in [self.pool + ["missing"], self.pool[:100], self.pool[:101]]:
            # 101 nodes caused the historical +101 offset to form self-ODs.
            with self.subTest(size=len(pool)), self.assertRaises(ValueError):
                self.module.requirements(self.candidate, pool)
        self.candidate["roads.geo.json"]["features"] = []
        with self.assertRaises(ValueError):
            self.module.requirements(self.candidate, self.pool)

    def test_workspace_starts_empty_and_cannot_overwrite_reviews(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp).resolve() / "review"
            report = self.module.prepare(out, self.candidate, self.pool)
            envelope = load_json(out / "envelope.json")
            self.assertEqual(report["qualification"], "HOLD")
            self.assertEqual(envelope["human_samples"]["segments"], 0)
            self.assertEqual(envelope["human_samples"]["od"], 0)
            self.assertEqual(load_json(out / "history.json")["observations"], [])
            with self.assertRaises(FileExistsError):
                self.module.prepare(out, self.candidate, self.pool)

    def test_synthetic_access_blocks_bind_real_source_ways_not_fake_relations(self):
        self.candidate["human-review-checklist.json"]["static_restriction_exceptions"] += [
            {"id": "unsupported-way-access:1"},
            {"id": "unsupported-node-access:1"},
        ]
        required = self.module.requirements(self.candidate, self.pool)
        by_id = {r["id"]: r for r in required["obligations"]}
        self.assertFalse("relation-unsupported-way-access:1" in by_id)
        self.assertFalse("relation-unsupported-node-access:1" in by_id)
        self.assertTrue(
            {"unsupported-way-access", "unsupported-node-access"} <= set(by_id["way-1"]["reasons"])
        )
        self.assertEqual(by_id["way-1"]["source_url"], "https://www.openstreetmap.org/way/1")
        self.assertIn("relation-1", by_id)


if __name__ == "__main__":
    unittest.main()
