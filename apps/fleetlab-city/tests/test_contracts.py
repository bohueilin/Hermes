import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest, load_json, read_bundle, validate_document, write_bundle


class ContractTests(unittest.TestCase):
    def test_schema_refuses_missing_fields_and_wrong_major(self):
        for value in [{"schema": "fleetlab.city-run/1.0.0"}, {"schema": "fleetlab.city-run/2.0.0"}]:
            with self.assertRaises(ValueError):
                validate_document(value)
        from citylib.explain import explain

        self.assertEqual(validate_document(explain({"metrics": {}}))["decision_authority"], "NONE")

    def test_canonical_order_and_nonfinite(self):
        self.assertEqual(digest({"a": 1, "b": 2}), digest({"b": 2, "a": 1}))
        with self.assertRaises(ValueError):
            digest({"a": float("nan")})

    def test_hash_mismatch_and_major_refusal(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t).resolve() / "bundle"
            write_bundle(p, "fleetlab.city-run/1.0.0", {"data.json": {"n": 1}})
            self.assertEqual(read_bundle(p)["data.json"], {"n": 1})
            (p / "data.json").write_text('{"n":2}')
            with self.assertRaisesRegex(ValueError, "digest"):
                read_bundle(p)

    def test_reject_unknown_schema_and_path_escape(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t).resolve()
            with self.assertRaisesRegex(ValueError, "schema"):
                write_bundle(p / "bad", "fleetlab.city-run/2.0.0", {"data.json": {}})
            with self.assertRaises(ValueError):
                write_bundle(p / "bad2", "fleetlab.city-run/1.0.0", {"../escape.json": {}})

    def test_symlink_duplicate_json_and_oversize_refused(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t).resolve()
            (p / "a.json").write_text('{"a":1,"a":2}')
            with self.assertRaises(ValueError):
                load_json(p / "a.json")
            (p / "link.json").symlink_to(p / "a.json")
            with self.assertRaises(ValueError):
                load_json(p / "link.json")
            with self.assertRaises(ValueError):
                load_json(p / "a.json", max_bytes=2)

    def test_immutable_bundle_never_overwritten(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t).resolve() / "bundle"
            write_bundle(p, "fleetlab.city-run/1.0.0", {"data.json": {}})
            with self.assertRaises(FileExistsError):
                write_bundle(p, "fleetlab.city-run/1.0.0", {"data.json": {}})


if __name__ == "__main__":
    unittest.main()
