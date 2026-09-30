"""Review observations cannot qualify themselves or rewrite retained history."""

import copy
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest, save_json, sha
from citylib.map_review_v1 import validate_review


def example():
    identity = {k: "a" * 64 for k in ("pack", "graph", "checklist", "sources")}
    requirements = {
        "schema": "fleetlab.map-review-requirements/1.0.0",
        "candidate": identity,
        "obligations": [
            {"id": "turn-1", "resolver_roles": ["source-reviewer"], "independent_resolution": True}
        ],
        "required_strata": ["trunk", "living_street"],
        "samples": [{"id": "way-1", "kind": "segment", "claim": "turn-1", "stratum": "trunk"}],
    }
    capture = {
        "id": "source-1",
        "url": "https://example.org/source",
        "revision": "r1",
        "text": "captured source",
        "sha256": sha(b"captured source"),
    }
    observation = {
        "schema": "fleetlab.map-review-result/1.0.0",
        "id": "o1",
        "candidate": identity,
        "claim": "turn-1",
        "source_snapshot": "a" * 64,
        "reviewer": {"id": "tool-1", "kind": "AUTOMATION", "role": "source-reviewer"},
        "method": "automated reconciliation",
        "timestamp": "2026-09-29T12:00:00-07:00",
        "feature": "way-1",
        "sample_type": "segment",
        "stratum": "trunk",
        "disposition": "SOURCE_CONFIRMED",
        "interpretation": "restricted",
        "evidence": ["source-1"],
        "rationale": "Matches captured source",
        "proposed_action": "retain conservative block",
    }
    doc = {
        "schema": "fleetlab.map-review-history/1.0.0",
        "candidate": identity,
        "requirements_digest": digest(requirements),
        "observations": [observation],
        "resolutions": [],
        "captures": [capture],
        "manifests": [],
    }
    append_manifest(doc)
    return requirements, doc


def append_manifest(doc):
    previous = digest(doc["manifests"][-1]) if doc["manifests"] else None
    doc["manifests"].append(
        {
            "previous": previous,
            **{
                field: [{"id": x["id"], "digest": digest(x)} for x in doc[field]]
                for field in ("observations", "resolutions", "captures")
            },
        }
    )


class ReviewTests(unittest.TestCase):
    def test_complete_claimed_human_population_still_needs_external_gates(self):
        req, doc = example()
        original = doc["observations"][0]
        original["reviewer"] = {"id": "person", "kind": "HUMAN", "role": "source-reviewer"}
        original["method"] = "human source inspection"
        req["samples"], doc["observations"] = [], []
        for i in range(300):
            kind = "segment" if i < 200 else "od"
            stratum = "trunk" if i % 2 else "living_street"
            feature = f"{kind}-{i}"
            req["samples"].append(
                {"id": feature, "kind": kind, "claim": "turn-1", "stratum": stratum}
            )
            doc["observations"].append(
                {
                    **copy.deepcopy(original),
                    "id": f"o{i}",
                    "feature": feature,
                    "sample_type": kind,
                    "stratum": stratum,
                }
            )
        doc["requirements_digest"] = digest(req)
        doc["manifests"] = []
        append_manifest(doc)
        self.assertEqual(self.review(req, doc)["qualification"], "HOLD")
        gates = {
            k: "PASS"
            for k in ("source_accounting", "class_budgets", "district_scope", "continuity")
        }
        self.assertEqual(self.review(req, doc, gates=gates)["qualification"], "PASS")
        req["samples"][0]["id"] = "different-feature"
        doc["requirements_digest"] = digest(req)
        with self.assertRaisesRegex(ValueError, "frozen sampling"):
            self.review(req, doc, gates=gates)

    def review(self, requirements, doc, checkpoint=True, gates=None):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d).resolve() / "review.json"
            save_json(path, doc)
            return validate_review(
                path,
                requirements,
                digest(doc["manifests"][-1]) if checkpoint else None,
                gates or {},
            )

    def test_automated_priority_confirmation_never_fills_human_sample(self):
        req, doc = example()
        result = self.review(req, doc)
        self.assertEqual(result["integrity"], "INTERNALLY_CONSISTENT")
        self.assertEqual(result["qualification"], "HOLD")
        self.assertEqual(result["human_samples"], {"segments": 0, "od": 0, "strata": []})
        self.assertEqual(result["deployment_permission"], "NONE")
        self.assertEqual(result["authenticity"], "NOT_AUTHENTICATED")

    def test_mislabeled_machine_stale_source_and_duplicate_id_reject(self):
        req, doc = example()
        for change in ("machine", "stale", "duplicate"):
            bad = copy.deepcopy(doc)
            if change == "machine":
                bad["observations"][0]["method"] = "human source inspection"
            elif change == "stale":
                bad["observations"][0]["source_snapshot"] = "b" * 64
            else:
                bad["observations"].append(copy.deepcopy(bad["observations"][0]))
            bad["manifests"] = []
            append_manifest(bad)
            with self.assertRaises(ValueError):
                self.review(req, bad)

    def test_checkpoint_and_capture_mutation_cannot_be_rehashed_away(self):
        req, doc = example()
        checkpoint = digest(doc["manifests"][-1])
        doc["observations"][0]["rationale"] = "changed"
        doc["manifests"] = []
        append_manifest(doc)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d).resolve() / "review.json"
            save_json(path, doc)
            with self.assertRaisesRegex(ValueError, "checkpoint"):
                validate_review(path, req, checkpoint, {})
        doc["captures"][0]["text"] = "changed"
        doc["manifests"] = []
        append_manifest(doc)
        with self.assertRaisesRegex(ValueError, "capture"):
            self.review(req, doc)

    def test_unanchored_history_is_not_complete(self):
        req, doc = example()
        result = self.review(req, doc, False)
        self.assertEqual(result["history"], "UNANCHORED")
        self.assertEqual(result["qualification"], "HOLD")

    def test_confirmation_does_not_erase_conflict_and_full_resolution_required(self):
        req, doc = example()
        conflict = {
            **copy.deepcopy(doc["observations"][0]),
            "id": "o2",
            "disposition": "SOURCE_CONFLICT",
            "interpretation": "unrestricted",
        }
        doc["observations"].append(conflict)
        append_manifest(doc)
        self.assertEqual(self.review(req, doc)["obligations"]["turn-1"], "CONFLICT")
        resolution = {
            "schema": "fleetlab.map-review-resolution/1.0.0",
            "id": "r1",
            "candidate": doc["candidate"],
            "source_snapshot": "a" * 64,
            "claim": "turn-1",
            "observations": [{"id": o["id"], "digest": digest(o)} for o in doc["observations"]],
            "resolver": {"id": "second-reviewer", "role": "source-reviewer", "kind": "HUMAN"},
            "interpretation": "restricted",
            "evidence": ["source-1"],
            "rationale": "Explicitly reconciled captured source",
            "uncertainty": "Not road legality",
            "timestamp": "2026-09-29T13:00:00-07:00",
        }
        doc["resolutions"].append(resolution)
        append_manifest(doc)
        self.assertEqual(self.review(req, doc)["obligations"]["turn-1"], "SOURCE_CONFIRMED")
        doc["observations"].append({**copy.deepcopy(conflict), "id": "o3"})
        append_manifest(doc)
        self.assertEqual(self.review(req, doc)["obligations"]["turn-1"], "CONFLICT")

    def test_history_prefix_deletion_reorder_and_symlink_rejected(self):
        req, doc = example()
        doc["observations"].append({**copy.deepcopy(doc["observations"][0]), "id": "o2"})
        append_manifest(doc)
        doc["manifests"][-1]["observations"].reverse()
        with self.assertRaises(ValueError):
            self.review(req, doc)
        req, doc = example()
        with tempfile.TemporaryDirectory() as d:
            source = Path(d).resolve() / "review.json"
            save_json(source, doc)
            link = Path(d).resolve() / "link.json"
            link.symlink_to(source)
            with self.assertRaises(ValueError):
                validate_review(link, req, None, {})

    def test_many_duplicate_feature_observations_count_once(self):
        req, doc = example()
        original = doc["observations"][0]
        original["reviewer"] = {"id": "person", "kind": "HUMAN", "role": "source-reviewer"}
        original["method"] = "human source inspection"
        doc["observations"] = [{**copy.deepcopy(original), "id": f"o{i}"} for i in range(210)]
        doc["manifests"] = []
        append_manifest(doc)
        result = self.review(req, doc)
        self.assertEqual(result["human_samples"]["segments"], 1)
        self.assertEqual(result["qualification"], "HOLD")

    def resolution(self, doc, observations, interpretation="restricted", record_id="r1"):
        return {
            "schema": "fleetlab.map-review-resolution/1.0.0",
            "id": record_id,
            "candidate": doc["candidate"],
            "source_snapshot": doc["candidate"]["sources"],
            "claim": "turn-1",
            "observations": [{"id": o["id"], "digest": digest(o)} for o in observations],
            "resolver": {"id": "independent-person", "role": "source-reviewer", "kind": "HUMAN"},
            "interpretation": interpretation,
            "evidence": ["source-1"],
            "rationale": "Synthetic validator fixture only",
            "uncertainty": "Not an actual source review",
            "timestamp": "2026-09-29T13:00:00-07:00",
        }

    def test_resolution_cannot_predeclare_future_conflicting_observation(self):
        req, doc = example()
        future = {
            **copy.deepcopy(doc["observations"][0]),
            "id": "future-conflict",
            "disposition": "SOURCE_CONFLICT",
            "interpretation": "unrestricted",
        }
        doc["resolutions"].append(self.resolution(doc, [*doc["observations"], future]))
        append_manifest(doc)
        doc["observations"].append(future)
        append_manifest(doc)
        with self.assertRaisesRegex(ValueError, "future observation reference"):
            self.review(req, doc)

    def test_observation_and_resolution_cannot_use_future_capture(self):
        for record_kind in ("observation", "resolution"):
            with self.subTest(record_kind=record_kind):
                req, doc = example()
                future = {**copy.deepcopy(doc["captures"][0]), "id": "future-source"}
                if record_kind == "observation":
                    record = {**copy.deepcopy(doc["observations"][0]), "id": "o2"}
                    doc["observations"].append(record)
                else:
                    record = self.resolution(doc, doc["observations"])
                    doc["resolutions"].append(record)
                record["evidence"] = [future["id"]]
                append_manifest(doc)
                doc["captures"].append(future)
                append_manifest(doc)
                with self.assertRaisesRegex(ValueError, "future capture reference"):
                    self.review(req, doc)

    def test_unreviewed_or_unresolved_interpretation_cannot_support_resolution(self):
        for disposition in ("NOT_REVIEWED", "UNRESOLVED", "SOURCE_CONFLICT"):
            with self.subTest(disposition=disposition):
                req, doc = example()
                doc["observations"].append(
                    {
                        **copy.deepcopy(doc["observations"][0]),
                        "id": "unsupported-interpretation",
                        "disposition": disposition,
                        "interpretation": "undetermined",
                    }
                )
                append_manifest(doc)
                doc["resolutions"].append(self.resolution(doc, doc["observations"], "undetermined"))
                append_manifest(doc)
                with self.assertRaisesRegex(ValueError, "unsupported resolution interpretation"):
                    self.review(req, doc)

    def test_conflicting_complete_supported_resolutions_remain_blocked(self):
        req, doc = example()
        doc["observations"].append(
            {
                **copy.deepcopy(doc["observations"][0]),
                "id": "opposite-confirmation",
                "interpretation": "unrestricted",
            }
        )
        append_manifest(doc)
        doc["resolutions"].extend(
            [
                self.resolution(doc, doc["observations"], "restricted", "r1"),
                self.resolution(doc, doc["observations"], "unrestricted", "r2"),
            ]
        )
        append_manifest(doc)
        result = self.review(req, doc)
        self.assertEqual(result["obligations"]["turn-1"], "CONFLICT")
        self.assertIn("Source obligations unresolved", result["reasons"])

    def test_malformed_unhashable_record_fields_raise_validation_error(self):
        for field in ("method", "disposition", "sample_type"):
            with self.subTest(field=field):
                req, doc = example()
                doc["observations"][0][field] = []
                doc["manifests"] = []
                append_manifest(doc)
                with self.assertRaises(ValueError):
                    self.review(req, doc)
