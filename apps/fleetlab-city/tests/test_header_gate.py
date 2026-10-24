"""The release header gate checks percent-encoded spellings against the root baseline only."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

TOOL = Path(__file__).resolve().parents[1] / "tools/check-headers.py"
spec = importlib.util.spec_from_file_location("check_headers", TOOL)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

ROLLBACK = "city-explorer/releases/aaaaaaaaaaaaaaaa"
SOURCE = "network-flows/sources/" + "e" * 64 + ".json.gz"
PERMISSION = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
ROOT = (
    "/*\n  Content-Security-Policy: default-src 'none'; script-src 'self'\n"
    "  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n"
    f"  Permissions-Policy: {PERMISSION}\n"
    "  Referrer-Policy: no-referrer\n  Cache-Control: public, max-age=600"
)
PATH_RULES = (
    "/city-explorer/*\n  ! Content-Security-Policy\n"
    "  Content-Security-Policy: default-src 'none'; connect-src 'self'\n"
    "\n"
    "/downloads/fleetlab-offline.html\n"
    "  Content-Disposition: attachment; filename=\"fleetlab-offline.html\"\n\n"
    "/downloads/fleetlab-offline\n"
    "  Content-Disposition: attachment; filename=\"fleetlab-offline.html\"\n\n"
    f"/{SOURCE}\n  Content-Type: application/gzip\n  ! Cache-Control\n"
    '  Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"\n'
    "  Cache-Control: public, max-age=31536000, immutable\n\n"
    "/downloads/teaching-package.json\n  Content-Type: application/json\n\n"
    f"/{ROLLBACK}/*\n  ! Content-Security-Policy\n  Content-Security-Policy: default-src 'none'"
)
CRAFTED = [
    "/%63ity-explorer/",
    "/%63ity-explorer/releases/aaaaaaaaaaaaaaaa/",
    "/%64ownloads/fleetlab-offline",
    "/downloads/fleetlab%2Doffline",
    "/%6Eetwork-flows/sources/" + "e" * 64 + ".json.gz",
]


class HeaderGateTests(unittest.TestCase):
    def test_missing_source_urls_are_html_without_download_headers(self):
        rows = gate.rows(self.site)
        missing = [
            row for row in rows if row[0].startswith("/network-flows/sources/") and row[2] == 404
        ]
        self.assertEqual(len(missing), 2)
        self.assertIn("/network-flows/sources/", [row[0] for row in missing])
        for row in missing:
            served = {
                **gate.fields(ROOT), "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
            }
            self.assertTrue(gate.check(
                "https://example.test", [row], head=lambda _, served=served: (True, "404", served),
            )[0]["matches"])
            for extra in (
                {"content-type": "application/gzip"}, {"content-disposition": "attachment"},
            ):
                self.assertFalse(gate.check(
                    "https://example.test", [row],
                    head=lambda _, served=served, extra=extra: (True, "404", {**served, **extra}),
                )[0]["matches"])

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.site = Path(temp.name) / "site"
        (self.site / "downloads").mkdir(parents=True)
        (self.site.parent / "review").mkdir()
        current = {"path": "city-explorer/releases/bbbbbbbbbbbbbbbb"}
        selection = {"current": current, "rollback": {"path": ROLLBACK}}
        (self.site / "publication.json").write_text(json.dumps(selection))
        package = {"source_offer": {"path": SOURCE}}
        (self.site / "downloads/teaching-package.json").write_text(json.dumps(package))
        manifest = {"files": ["tiles/a.webp", "enhancement-media/FL-A2-one-fleet-day-panorama.webp",
                              "enhancement-media/FL-V2-deadhead-explainer.mp4"]}
        (self.site.parent / "review/integration-manifest.json").write_text(json.dumps(manifest))
        self.write_headers(ROOT)

    def write_headers(self, root):
        (self.site / "_headers").write_text(root + "\n\n" + PATH_RULES + "\n")

    def test_enhancement_surfaces_and_owned_media_receive_header_checks(self):
        rows = {path: (expected, status) for path, expected, status in gate.rows(self.site)}
        for path in (
            "/network-flows/", "/network-flows/ota-sharing/", "/sitemap.xml",
            "/enhancement-media.mjs", "/enhancement-motion.mjs", "/enhancement-media.css",
            "/network-flows/hub.css", "/enhancement-media/FL-A2-one-fleet-day-panorama.webp",
            "/enhancement-media/FL-V2-deadhead-explainer.mp4",
        ):
            self.assertEqual(rows.get(path), (gate.fields(ROOT), 200), path)
        self.assertNotIn("/network-hub.css", rows)

    def test_depot_lab_route_files_and_worker_receive_the_root_baseline(self):
        rows = {path: (expected, status) for path, expected, status in gate.rows(self.site)}
        for path in (
            "/depot-readiness/", "/depot-readiness/boot.js", "/depot-readiness/release.json",
            "/depot-readiness/visual.css", "/src/runtime/depot-lab-worker.js",
        ):
            self.assertEqual(rows.get(path), (gate.fields(ROOT), 200), path)
        self.assertNotIn("/network-flows/depot-readiness/", rows)

    def test_crafted_spellings_expect_only_the_root_baseline(self):
        rows = {path: (expected, status) for path, expected, status in gate.rows(self.site)}
        baseline = {
            "content-security-policy": "default-src 'none'; script-src 'self'",
            "x-frame-options": "DENY",
            "x-content-type-options": "nosniff",
            "permissions-policy": PERMISSION,
        }
        for path in CRAFTED:
            self.assertEqual(rows[path], (baseline, 200), path)
        self.assertIn("permissions-policy", rows["/city-explorer/"][0])
        self.assertIn("content-disposition", rows["/downloads/fleetlab-offline"][0])

    def test_a_root_rule_without_the_baseline_fails_closed(self):
        for line in ("  X-Frame-Options: DENY\n", "  X-Content-Type-Options: nosniff\n",
                     f"  Permissions-Policy: {PERMISSION}\n"):
            with self.subTest(line=line.strip()):
                self.write_headers(ROOT.replace(line, ""))
                with self.assertRaisesRegex(ValueError, "security baseline"):
                    gate.rows(self.site)

    def test_missing_permissions_on_root_lesson_or_404_is_reported(self):
        rows = gate.rows(self.site)
        for path in ("/", "/network-flows/capacity/", "/__fleetlab_missing_page__"):
            with self.subTest(path=path):
                row = next(row for row in rows if row[0] == path)
                served = {
                    key: value for key, value in row[1].items() if key != "permissions-policy"
                }
                result = gate.check(
                    "https://example.test", [row],
                    head=lambda _, row=row, served=served: (True, str(row[2]), served),
                )
                self.assertFalse(result[0]["matches"])
                self.assertIn("permissions-policy", result[0]["mismatches"])

    def test_a_crafted_spelling_served_without_nosniff_is_reported(self):
        rows = gate.rows(self.site)
        root = gate.fields(ROOT)

        def head(url):
            served = dict(root)
            if url.endswith("/downloads/fleetlab%2Doffline"):
                served.pop("x-content-type-options")
            return True, "404" if url.endswith("__fleetlab_missing_page__") else "200", served

        checked = gate.check("https://example.test", rows, head=head)
        report = {row["path"]: row for row in checked}
        self.assertTrue(report["/%63ity-explorer/"]["matches"])
        failed = report["/downloads/fleetlab%2Doffline"]
        self.assertFalse(failed["matches"])
        expected = {"x-content-type-options": {"expected": "nosniff", "actual": None}}
        self.assertEqual(failed["mismatches"], expected)

    def test_curl_sends_the_encoded_path_unchanged(self):
        stdout = "HTTP/2 200\r\nx-frame-options: DENY\r\n\r\n\n200"
        completed = mock.Mock(returncode=0, stdout=stdout)
        with mock.patch.object(gate.subprocess, "run", return_value=completed) as run:
            result = gate.curl_head("https://example.test/%63ity-explorer/")
        self.assertEqual(result, (True, "200", {"x-frame-options": "DENY"}))
        args = run.call_args.args[0]
        self.assertIn("--path-as-is", args)
        self.assertIn("--cacert", args)
        self.assertEqual(args[args.index("--cacert") + 1], gate.certifi.where())
        self.assertEqual(args[-1], "https://example.test/%63ity-explorer/")


if __name__ == "__main__":
    unittest.main()
