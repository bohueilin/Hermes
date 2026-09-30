"""Behavioral checks for an immutable legacy-preserving launch stage."""

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / "tools/prepare-launch.py"
spec = importlib.util.spec_from_file_location("prepare_launch", TOOL)
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_release(root, label, viewer="1.1.0"):
    root.mkdir()
    content = {
        "index.html": (
            b'<!doctype html><link rel="stylesheet" href="./style.css">'
            b'<script type="module" src="./app.mjs"></script>'
        ),
        "style.css": b"body{color:#123}",
        "app.mjs": b"fetch('./data/catalog.json')",
        "data/catalog.json": ('{"label":"' + label + '"}').encode(),
        "network.json": (
            b'{"origins":["self"],"accounts":false,"analytics":false,"provider_calls":false}'
        ),
        "_headers": (
            b"/city-explorer/*\n  Content-Security-Policy: script-src 'self'; connect-src 'self'\n"
        ),
    }
    for name, data in content.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    release = {
        "schema": "fleetlab.city-release/1.0.0",
        "scope": "REVIEW_ONLY",
        "public_deployment": "NOT_PERFORMED",
        "compatibility": {
            "viewer": viewer,
            "pack": "fleetlab.city-pack/1.0.0",
            "run": "fleetlab.city-run/1.0.0",
            "metrics": "fleetlab.city-metrics/1.0.0",
        },
        "files": {
            name: {"bytes": len(data), "sha256": sha(data)} for name, data in content.items()
        },
    }
    (root / "release.json").write_text(json.dumps(release))
    return release


class LaunchPreparationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.legacy = self.base / "legacy"
        self.legacy.mkdir()
        (self.legacy / "_headers").write_bytes(
            b"/*\n  Content-Security-Policy: connect-src 'none'\n"
        )
        (self.legacy / "index.html").write_bytes(b"<h1>Original</h1>")
        for i in range(97):
            (self.legacy / f"file-{i:02d}.txt").write_bytes(f"legacy {i}".encode())
        self.readback = self.base / "readback.json"
        self.readback.write_text(
            json.dumps(
                [
                    {
                        "matched": 98,
                        "total": 98,
                        "headers_match": True,
                        "headers": {"content-security-policy": "connect-src 'none'"},
                        "legacy_headers_sha256": sha((self.legacy / "_headers").read_bytes()),
                        "files": [
                            {
                                "path": p.name,
                                "bytes": p.stat().st_size,
                                "sha256": sha(p.read_bytes()),
                                "matches": True,
                            }
                            for p in self.legacy.iterdir()
                            if p.name != "_headers"
                        ],
                    }
                ]
            )
        )
        self.viewer = self.base / "viewer"
        self.prior = self.base / "prior"
        write_release(self.viewer, "latest")
        write_release(self.prior, "prior", viewer="1.0.0")
        self.out = self.base / "stage"

    def test_stage_preserves_legacy_and_versions_both_complete_viewers(self):
        result = launch.prepare(self.legacy, self.viewer, self.out, self.prior, self.readback)
        site = self.out / "site"
        for source in self.legacy.iterdir():
            self.assertEqual((site / source.name).read_bytes(), source.read_bytes())
        self.assertEqual(result["legacy"]["files"], 99)
        self.assertFalse(result["release_ready"])
        self.assertEqual(result["rollback"]["status"], "COMPATIBLE_STAGED")
        current = result["current"]["path"]
        prior = result["rollback"]["path"]
        self.assertTrue((site / current / "data/catalog.json").exists())
        self.assertTrue((site / prior / "data/catalog.json").exists())
        stable = (site / "city-explorer/index.html").read_text()
        self.assertIn("./switch-", stable)
        self.assertNotIn("<script>", stable)
        switch = next((site / "city-explorer").glob("switch-*.mjs")).read_text()
        self.assertIn("location.hash", switch)
        self.assertIn("location.search", switch)
        self.assertIn(current.split("/")[-1], switch)
        candidate = (self.out / "review/_headers.candidate").read_text()
        self.assertIn("! Content-Security-Policy", candidate)
        self.assertEqual(candidate.count("X-Content-Type-Options:"), 0)
        self.assertEqual(candidate.count("Referrer-Policy:"), 0)
        self.assertEqual((site / "_headers").read_bytes(), (self.legacy / "_headers").read_bytes())
        nav_diff = (self.out / "review/optional-legacy-nav.diff").read_text()
        self.assertIn(
            "+  navLinks.push(el('a',{href:'/city-explorer/'},'City explorer'));", nav_diff
        )

    def test_tampered_viewer_refused_before_output_creation(self):
        (self.viewer / "app.mjs").write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "viewer.*integrity"):
            launch.prepare(self.legacy, self.viewer, self.out, self.prior, self.readback)
        self.assertFalse(self.out.exists())

    def test_tampered_hosted_legacy_refused_before_output_creation(self):
        (self.legacy / "index.html").write_bytes(b"<h1>Changed</h1>")
        with self.assertRaisesRegex(ValueError, "legacy.*readback"):
            launch.prepare(self.legacy, self.viewer, self.out, self.prior, self.readback)
        self.assertFalse(self.out.exists())

    def test_incompatible_prior_viewer_refused(self):
        write_release(self.base / "other", "other", viewer="2.0.0")
        with self.assertRaisesRegex(ValueError, "rollback.*compatible"):
            launch.prepare(self.legacy, self.viewer, self.out, self.base / "other", self.readback)
        self.assertFalse(self.out.exists())

    def test_candidate_does_not_duplicate_inherited_permissions(self):
        review = self.base / "review"
        review.mkdir()
        launch.make_candidate_headers(
            b"/*\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n",
            review,
        )
        candidate = (review / "_headers.candidate").read_text()
        self.assertEqual(candidate.count("Permissions-Policy:"), 1)
        launch.make_candidate_headers(
            b"/*\n  Permissions-Policy: geolocation=()\n",
            review,
        )
        candidate = (review / "_headers.candidate").read_text()
        self.assertIn("! Permissions-Policy", candidate)


if __name__ == "__main__":
    unittest.main()
