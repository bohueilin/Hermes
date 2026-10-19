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
ROOT = (
    "/*\n  Content-Security-Policy: default-src 'none'; script-src 'self'\n"
    "  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n"
    "  Referrer-Policy: no-referrer\n  Cache-Control: public, max-age=600"
)
PATH_RULES = (
    "/city-explorer/*\n  ! Content-Security-Policy\n"
    "  Content-Security-Policy: default-src 'none'; connect-src 'self'\n"
    "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n"
    "/downloads/fleetlab-offline.html\n"
    "  Content-Disposition: attachment; filename=\"fleetlab-offline.html\"\n\n"
    "/downloads/fleetlab-offline\n"
    "  Content-Disposition: attachment; filename=\"fleetlab-offline.html\"\n\n"
    "/network-flows/sources/*\n  Content-Type: application/gzip\n  ! Cache-Control\n"
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
        manifest = {"files": ["tiles/a.webp"]}
        (self.site.parent / "review/integration-manifest.json").write_text(json.dumps(manifest))
        self.write_headers(ROOT)

    def write_headers(self, root):
        (self.site / "_headers").write_text(root + "\n\n" + PATH_RULES + "\n")

    def test_crafted_spellings_expect_only_the_root_baseline(self):
        rows = {path: (expected, status) for path, expected, status in gate.rows(self.site)}
        baseline = {
            "content-security-policy": "default-src 'none'; script-src 'self'",
            "x-frame-options": "DENY",
            "x-content-type-options": "nosniff",
        }
        for path in CRAFTED:
            self.assertEqual(rows[path], (baseline, 200), path)
        self.assertIn("permissions-policy", rows["/city-explorer/"][0])
        self.assertIn("content-disposition", rows["/downloads/fleetlab-offline"][0])

    def test_a_root_rule_without_the_baseline_fails_closed(self):
        for line in ("  X-Frame-Options: DENY\n", "  X-Content-Type-Options: nosniff\n"):
            with self.subTest(line=line.strip()):
                self.write_headers(ROOT.replace(line, ""))
                with self.assertRaisesRegex(ValueError, "security baseline"):
                    gate.rows(self.site)

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
        self.assertEqual(args[-1], "https://example.test/%63ity-explorer/")


if __name__ == "__main__":
    unittest.main()
