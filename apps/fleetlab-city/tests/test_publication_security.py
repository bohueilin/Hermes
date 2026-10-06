"""Publication boundaries cover both viewers, private observations and outgoing commits."""

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.public_notes import PUBLIC_NOTES, check_worksheet, export_notes, verify_notes
from test_launch import launch, write_release

TOOL = Path(__file__).resolve().parents[1] / "tools/publication-guard.py"
spec = importlib.util.spec_from_file_location("publication_guard", TOOL)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class PublicationSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_public_notes_allowlist_is_identical_for_current_and_rollback(self):
        for role in ("current", "rollback"):
            with self.subTest(role=role):
                root = self.root / role
                write_release(root, role)
                export_notes(root)
                verify_notes(root)
                extra = root / "notes/internal-handoff.md"
                extra.write_text("private working notes")
                with self.assertRaisesRegex(ValueError, "allowlist"):
                    launch.verify_viewer(root, role)
                extra.unlink()
                (root / "notes" / sorted(PUBLIC_NOTES)[0]).write_text("file:///private/example")
                with self.assertRaisesRegex(ValueError, "private marker"):
                    launch.verify_viewer(root, role)

    def test_only_blank_worksheet_may_be_published(self):
        header = (
            "obligation,source_url,reviewer,date_time_timezone,"
            "capture_revision_sha256,observation,disposition,uncertainty\n"
        )
        check_worksheet(header + "sample,https://example.org,,,,,NOT_REVIEWED,\n")
        for row in (
            "sample,https://example.org,Alice,,,,NOT_REVIEWED,\n",
            "sample,https://example.org,,,,note,NOT_REVIEWED,\n",
            "sample,https://example.org,,,,,PASS,\n",
        ):
            with self.assertRaisesRegex(ValueError, "blank"):
                check_worksheet(header + row)

    def test_staging_guard_rejects_force_added_tool_state_but_allows_map_coordinates(self):
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        private = self.root / ".wrangler/cache"
        private.mkdir(parents=True)
        (private / "cf.json").write_text('{"latitude":0,"longitude":0}')
        (self.root / ".gitignore").write_text(".wrangler/\n")
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        self.assertEqual(guard.check(staged=True, cwd=self.root), (0, 0))
        subprocess.run(["git", "add", "-f", ".wrangler/cache/cf.json"], cwd=self.root, check=True)
        self.assertEqual(guard.check(staged=True, cwd=self.root)[0], 1)
        subprocess.run(
            [
                "git",
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.invalid",
                "commit",
                "-qm",
                "synthetic rejected publication",
            ],
            cwd=self.root,
            check=True,
        )
        self.assertEqual(guard.check(revision="HEAD", cwd=self.root)[0], 1)
        self.assertEqual(guard.inspect_diff(["map.json"], '+{"latitude":37.77}'), (0, 0))
        self.assertEqual(
            guard.inspect_diff(["private-note.md"], "+ordinary", ["private-note.md"])[0], 1
        )

    def test_guard_checks_added_lines_without_rejecting_historical_context(self):
        home = "/" + "Users" + "/sample/private"
        hunk = "@@ -1 +1 @@\n"
        self.assertEqual(
            guard.inspect_diff(["README.md"], hunk + "-" + home + "\n+public description"), (0, 0)
        )
        for prefix in ("+", "+++", "+++ b/"):
            self.assertEqual(guard.inspect_diff(["README.md"], hunk + prefix + home), (0, 1))

    def test_binary_and_utf16_added_secrets_cannot_bypass_text_diff_checks(self):
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        home = "/" + "Users" + "/sample/private"
        for encoding in ("utf-16-le", "utf-16-be"):
            (self.root / "sample.bin").write_bytes(home.encode(encoding))
            subprocess.run(["git", "add", "sample.bin"], cwd=self.root, check=True)
            self.assertEqual(guard.check(staged=True, cwd=self.root)[1], 1)
        (self.root / "sample.bin").write_bytes(b"\0" + home.encode())
        subprocess.run(["git", "add", "sample.bin"], cwd=self.root, check=True)
        self.assertEqual(guard.check(staged=True, cwd=self.root)[1], 1)


if __name__ == "__main__":
    unittest.main()
