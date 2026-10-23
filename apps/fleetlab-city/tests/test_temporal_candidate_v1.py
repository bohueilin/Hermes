"""A new candidate cannot relabel old maps or inherit human review."""

import copy
import importlib
import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest, read_bundle, save_json, write_bundle
from citylib.pack import build_graph, qualify_inventory
from citylib.temporal_import_v3 import build_temporal_pack, parse_temporal_osm
from shapely.geometry import Polygon, mapping
from test_temporal_v3 import raw_fixture


def fixture(root):
    source = parse_temporal_osm(raw_fixture())
    old = build_graph(source, routing_profile="edge-sequence/2.0.0")
    pack = build_temporal_pack(source)
    boundary = mapping(Polygon([[-123, 37], [-122, 37], [-122, 38], [-123, 38]]))
    geometry = {
        "boundary": boundary,
        "districts": {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"sup_dist": "1"}, "geometry": boundary}
            ],
        },
        "land": boundary,
    }
    old.update(
        pack_id="prior-static",
        city="Fixture",
        source={
            "osm_sha256": pack["temporal"]["xml_sha256"],
            "districts_sha256": "b" * 64,
            "boundary_sha256": digest(boundary),
        },
    )
    pack.update(pack_id="temporal-fixture", city="Fixture", baseline_pack_digest=digest(old))
    write_bundle(
        root / "old",
        "fleetlab.city-pack/1.0.0",
        {
            "graph.json": old,
            "coverage.json": qualify_inventory(old),
            "geometry.json": geometry,
            "source-inventory.json": {"fixture": "captured source identity"},
        },
    )
    return read_bundle(root / "old"), pack


class TemporalCandidateTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("citylib.temporal_candidate_v1"))
        self.module = importlib.import_module("citylib.temporal_candidate_v1")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.baseline, self.pack = fixture(self.root)

    def test_bundle_preserves_complete_graph_and_has_new_unreviewed_identity(self):
        before = digest([self.baseline, self.pack])
        files = self.module.derive(self.baseline, self.pack)
        self.assertEqual(files["graph.json"], self.pack)
        report = files["qualification-report.json"]
        self.assertEqual(report["candidate_graph_digest"], digest(self.pack))
        self.assertEqual(report["status"], "HOLD")
        self.assertEqual(files["human-review-checklist.json"]["review_results"], [])
        self.module.write(self.root / "new", self.baseline, self.pack)
        bundle = read_bundle(self.root / "new")
        self.assertTrue(self.module.validate(self.baseline, bundle)["pass"])
        self.assertEqual(digest([self.baseline, self.pack]), before)
        with self.assertRaises(FileExistsError):
            self.module.write(self.root / "new", self.baseline, self.pack)

    def test_rehashed_report_geometry_coverage_and_review_forgeries_are_rejected(self):
        files = self.module.derive(self.baseline, self.pack)
        for index, (name, field, value) in enumerate(
            [
                ("qualification-report.json", "status", "PASS"),
                ("qualification-report.json", "candidate_graph_digest", "f" * 64),
                ("qualification-report.json", "way_transitions", []),
                ("coverage.json", "unsupported_fraction", 0.123),
                ("roads.geo.json", "features", []),
                ("district-gaps.json", "total_gap_length_m", 123),
                ("geometry.json", "districts", {}),
                ("human-review-checklist.json", "review_results", [{"result": "PASS"}]),
            ]
        ):
            altered = copy.deepcopy(files)
            altered[name][field] = value
            path = self.root / f"forgery-{index}"
            write_bundle(path, "fleetlab.city-pack/1.0.0", altered, self.module.BUNDLE_METADATA)
            with self.subTest(name=name, field=field), self.assertRaises(ValueError):
                self.module.validate(self.baseline, read_bundle(path))

    def test_changed_source_population_scope_or_identity_is_not_same_candidate(self):
        for field, value in [
            ("scope", "outside-buffer"),
            ("eligible", False),
            ("source_nodes", ["3", "2"]),
            ("tags", {}),
        ]:
            changed = copy.deepcopy(self.pack)
            changed["inventory"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.module.derive(self.baseline, changed)
        for field, value in [
            ("nodes", {}),
            ("candidate_ids", []),
            ("baseline_pack_digest", "0" * 64),
        ]:
            changed = copy.deepcopy(self.pack)
            changed[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.module.derive(self.baseline, changed)

    def test_omitted_temporal_rules_and_source_mismatch_are_rejected(self):
        for field, value in [("turns", []), ("xml_sha256", "0" * 64)]:
            changed = copy.deepcopy(self.pack)
            changed["temporal"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.module.derive(self.baseline, changed)

    def test_prior_optional_reviews_cannot_transfer_into_new_coverage(self):
        self.baseline["coverage.json"]["semantic_map_review"] = {"status": "PASS"}
        files = self.module.derive(self.baseline, self.pack)
        self.assertNotIn("semantic_map_review", files["coverage.json"])
        self.assertEqual(files["human-review-checklist.json"]["status"], "NOT_RUN")
        self.assertEqual(files["qualification-report.json"]["status"], "HOLD")

    def test_rehashed_container_type_or_trust_claim_cannot_change(self):
        for i, (field, value) in enumerate(
            [
                ("schema", "fleetlab.city-run/1.0.0"),
                ("scope", "PRODUCTION"),
                ("authenticity", "AUTHENTICATED"),
                ("decision_authority", "DEPLOY"),
                ("evidence", "REAL_WORLD"),
                ("metadata", {}),
            ]
        ):
            out = self.root / f"trust-{i}"
            self.module.write(out, self.baseline, self.pack)
            captured = read_bundle(out)
            manifest = captured["manifest.json"]
            manifest[field] = value
            manifest["content_digest"] = digest(
                {k: v for k, v in manifest.items() if k != "content_digest"}
            )
            save_json(out / "manifest.json", manifest)
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.module.validate(self.baseline, read_bundle(out))

    def test_cli_report_cannot_overwrite_new_candidate_member(self):
        out = self.root / "new"
        save_json(self.root / "graph.json", self.pack)
        command = [
            sys.executable,
            str(Path(__file__).resolve().parents[1] / "tools/package-temporal-candidate.py"),
            "build",
            "--baseline",
            str(self.root / "old"),
            "--graph",
            str(self.root / "graph.json"),
            "--candidate",
            str(out),
            "--expected-graph-digest",
            digest(self.pack),
            "--report",
            str(out / "graph.json"),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertFalse(
            out.exists(), "overlapping report path must fail before writing the bundle"
        )


if __name__ == "__main__":
    unittest.main()
