"""Public packaging is additive; unexpected established-file edits fail closed."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from test_launch import launch, write_release

TOOL = Path(__file__).resolve().parents[1] / "tools/integrate-site.py"
spec = importlib.util.spec_from_file_location("integrate_site", TOOL)
integration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integration)


class IntegrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.legacy = self.base / "legacy"
        self.legacy.mkdir()
        (self.legacy / "_headers").write_text("/*\n  Content-Security-Policy: connect-src 'none'\n")
        (self.legacy / "index.html").write_text('<link rel="stylesheet" href="./styles.css">')
        (self.legacy / "boot.js").write_text(
            'import { start } from "./src/ui/app.js";\nstart({ studio: true });\n'
        )
        for i in range(96):
            (self.legacy / f"original-{i}.txt").write_text(f"Original content {i}")
        self.viewer = self.base / "viewer"
        self.prior = self.base / "prior"
        write_release(self.viewer, "current")
        write_release(self.prior, "prior")
        self.offer = self.base / "offer"
        self.offer.mkdir()
        for name in ("index.html", "ODbL-1.0.txt", "database.tar.gz"):
            (self.offer / name).write_text(f"source offer {name}")
        (self.offer / "manifest.json").write_text(
            json.dumps({"files": launch.inventory(self.offer)})
        )
        self.offline = self.base / "offline.html"
        self.offline.write_text("preserved offline edition")

    def prepare(self):
        return integration.integrate(
            self.legacy, self.viewer, self.prior, self.offer, self.base / "out", self.offline
        )

    def test_only_three_declared_root_files_change_and_offline_is_untouched(self):
        before = launch.inventory(self.legacy)
        offline = self.offline.read_bytes()
        report = self.prepare()
        site = self.base / "out/site"
        self.assertEqual(set(report["modified_existing"]), {"index.html", "boot.js", "_headers"})
        self.assertEqual(len(report["preserved_existing"]), 96)
        self.assertEqual(launch.inventory(self.legacy), before)
        self.assertEqual(self.offline.read_bytes(), offline)
        for name in report["preserved_existing"]:
            self.assertEqual((site / name).read_bytes(), (self.legacy / name).read_bytes())
        self.assertIn("mountCityEntry", (site / "boot.js").read_text())
        self.assertIn("/city-explorer/*", (site / "_headers").read_text())
        self.assertTrue((site / "city-explorer/sources/index.html").is_file())
        self.assertTrue((site / report["rollback"]["path"] / "release.json").is_file())

    def test_unexpected_existing_file_change_is_rejected(self):
        before = launch.inventory(self.legacy)
        (self.legacy / "original-0.txt").write_text("unexpected replacement")
        with self.assertRaisesRegex(ValueError, "unexpected established"):
            integration.check_preservation(before, launch.inventory(self.legacy))

    def test_source_offer_tamper_is_rejected_without_partial_output(self):
        (self.offer / "database.tar.gz").write_text("changed")
        with self.assertRaisesRegex(ValueError, "source offer integrity"):
            self.prepare()
        self.assertFalse((self.base / "out").exists())

    def test_changed_boot_contract_is_rejected(self):
        (self.legacy / "boot.js").write_text("a_different_bootstrap();")
        with self.assertRaisesRegex(ValueError, "bootstrap contract"):
            self.prepare()
        self.assertFalse((self.base / "out").exists())

    def test_temporal_viewer_rejects_missing_or_foreign_corresponding_database(self):
        for identity in (None, "b" * 64):
            with (
                self.subTest(identity=identity),
                self.assertRaisesRegex(ValueError, "temporal source offer"),
            ):
                integration.check_temporal_offer(
                    {"temporal_candidate": {"candidate_bundle_digest": "a" * 64}},
                    {"temporal_candidate_bundle_digest": identity},
                    self.offer,
                )

    def test_temporal_source_offer_requires_actual_complete_archive(self):
        with self.assertRaisesRegex(ValueError, "temporal source offer"):
            integration.check_temporal_offer(
                {"temporal_candidate": {"candidate_bundle_digest": "a" * 64}},
                {"temporal_candidate_bundle_digest": "a" * 64},
                self.offer,
            )
