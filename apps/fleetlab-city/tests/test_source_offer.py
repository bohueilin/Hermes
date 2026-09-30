"""Public diagnostics retain findings while explicitly omitting private traceback text."""

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "source_offer", Path(__file__).resolve().parents[1] / "tools/build-source-offer.py"
)
offer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offer)


class PublicReportTests(unittest.TestCase):
    def test_projection_preserves_original_and_findings_with_explicit_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "verify-report.json"
            original = json.dumps(
                {
                    "status": "STOPPED",
                    "valid": False,
                    "findings": ["clock"],
                    "traceback": "File /Users/example/private/code.py",
                }
            ).encode()
            path.write_bytes(original)
            checksum = hashlib.sha256(original).hexdigest()
            result = json.loads(offer.public_report_projection(path, checksum))
            self.assertEqual(path.read_bytes(), original)
            self.assertNotIn("traceback", result)
            self.assertEqual(result["findings"], ["clock"])
            self.assertEqual(result["status"], "STOPPED")
            self.assertFalse(result["valid"])
            self.assertEqual(result["publication_projection"]["original_sha256"], checksum)
            self.assertEqual(
                result["publication_projection"]["omitted_json_pointers"], ["/traceback"]
            )
            with self.assertRaisesRegex(ValueError, "identity"):
                offer.public_report_projection(path, "0" * 64)

    def test_projection_does_not_silently_redact_any_other_field(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "verify-report.json"
            path.write_text(json.dumps({"status": "STOPPED", "finding": "/Users/private"}))
            with self.assertRaisesRegex(ValueError, "private"):
                offer.public_report_projection(path, hashlib.sha256(path.read_bytes()).hexdigest())
