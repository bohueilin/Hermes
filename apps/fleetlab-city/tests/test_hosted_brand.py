"""A public presentation release must not rewrite its source or scientific data."""

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from test_launch import launch, write_release

TOOL = Path(__file__).resolve().parents[1] / "tools/hosted-brand.py"
spec = importlib.util.spec_from_file_location("hosted_brand", TOOL)
brand = importlib.util.module_from_spec(spec)
spec.loader.exec_module(brand)


def write_base(base):
    """An analytics-free review release with a complete page, as the hosted transform needs."""
    write_release(base, "current")
    (base / "index.html").write_text("<html><head></head><body>City</body></html>")
    release = json.loads((base / "release.json").read_text())
    release["files"] = {k: v for k, v in launch.inventory(base).items() if k != "release.json"}
    launch.write_json(base / "release.json", release)


class HostedBrandTest(unittest.TestCase):
    def test_new_city_generation_preserves_input_and_recorded_data(self):
        self.assertTrue(callable(getattr(brand, "derive_viewer", None)))
        with tempfile.TemporaryDirectory() as tmp:
            base, out = Path(tmp) / "base", Path(tmp) / "new"
            write_base(base)
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

    def test_analytics_generation_declares_its_cookies_in_both_implementations(self):
        with tempfile.TemporaryDirectory() as tmp:
            base, out = Path(tmp) / "base", Path(tmp) / "new"
            write_base(base)
            brand.derive_viewer(base, out, "a" * 40)
            network = json.loads((out / "network.json").read_text())
            self.assertTrue(network["analytics"])
            self.assertEqual(network["storage"], launch.ANALYTICS_STORAGE)
            # The upload guard reproduces the same document from the analytics-free base.
            script = (
                "const [base]=process.argv.slice(1);"
                "const {hostedNetwork}=await import('./deploy/branded-city.mjs');"
                "process.stdout.write(JSON.stringify(hostedNetwork(JSON.parse(base))));"
            )
            reproduced = subprocess.run(
                ["node", "--input-type=module", "-e", script, (base / "network.json").read_text()],
                cwd=TOOL.parents[1], capture_output=True, text=True, check=True,
            )
            self.assertEqual(json.loads(reproduced.stdout), network)

    def test_analytics_generation_cannot_claim_no_storage(self):
        with tempfile.TemporaryDirectory() as tmp:
            base, out = Path(tmp) / "base", Path(tmp) / "new"
            write_base(base)
            brand.derive_viewer(base, out, "a" * 40)
            network = json.loads((out / "network.json").read_text())
            launch.write_json(out / "network.json", {**network, "storage": False})
            release = json.loads((out / "release.json").read_text())
            release["files"]["network.json"] = launch.inventory(out)["network.json"]
            launch.write_json(out / "release.json", release)
            with self.assertRaisesRegex(ValueError, "network contract"):
                launch.verify_viewer(out, "branded")
