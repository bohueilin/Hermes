"""A public presentation release must not rewrite its source or scientific data."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_launch import launch, write_release

TOOL = Path(__file__).resolve().parents[1] / "tools/hosted-brand.py"
spec = importlib.util.spec_from_file_location("hosted_brand", TOOL)
brand = importlib.util.module_from_spec(spec)
spec.loader.exec_module(brand)


class HostedBrandTest(unittest.TestCase):
    def test_enhancement_inventory_rejects_unlisted_media_and_changed_hashes(self):
        inventory = brand.launch.inventory
        folder = brand.ROOT / "apps/fleetlab-city/enhancement-media"
        def added(path):
            records = inventory(path)
            if path == folder:
                records["FL-V1-unapproved.mp4"] = {"bytes": 1, "sha256": "0" * 64}
            return records
        with patch.object(brand, "TEXT", ()):
            self.assertEqual(len([p for p in brand.asset_inventory()
                                  if p.startswith("enhancement-media/")]), 7)
            with patch.object(brand.launch, "inventory", side_effect=added), \
                    self.assertRaisesRegex(ValueError, "enhancement-media.*inventory"):
                brand.asset_inventory()
            media = {k: dict(v) for k, v in brand.MEDIA.items()}
            media["enhancement-media/FL-A1-people-between-rides.webp"]["sha256"] = "0" * 64
            with patch.object(brand, "MEDIA", media), \
                    self.assertRaisesRegex(ValueError, "enhancement-media.*inventory"):
                brand.asset_inventory()

    def test_new_city_generation_preserves_input_and_recorded_data(self):
        self.assertTrue(callable(getattr(brand, "derive_viewer", None)))
        with tempfile.TemporaryDirectory() as tmp:
            base, out = Path(tmp) / "base", Path(tmp) / "new"
            write_release(base, "current")
            (base / "index.html").write_text("<html><head></head><body>City</body></html>")
            release = json.loads((base / "release.json").read_text())
            release["files"] = {
                k: v for k, v in launch.inventory(base).items() if k != "release.json"
            }
            launch.write_json(base / "release.json", release)
            before = launch.inventory(base)
            brand.derive_viewer(base, out, "a" * 40)
            self.assertEqual(launch.inventory(base), before)
            self.assertNotEqual(
                launch.sha_file(base / "release.json"), launch.sha_file(out / "release.json")
            )
            new, files = launch.verify_viewer(out, "branded")
            self.assertEqual(files["app.mjs"], before["app.mjs"])
            self.assertEqual(
                new["hosted_presentation"]["base_release_sha256"], before["release.json"]["sha256"]
            )
            self.assertTrue(json.loads((out / "network.json").read_text())["analytics"])
            html = (out / "index.html").read_text()
            self.assertEqual(
                html.count('src="https://www.googletagmanager.com/gtag/js?id=G-04EZ8EZWQ2"'), 1
            )
            with self.assertRaisesRegex(ValueError, "exists"):
                brand.derive_viewer(base, out, "a" * 40)
