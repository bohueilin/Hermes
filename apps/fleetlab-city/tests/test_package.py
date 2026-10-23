import sys
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import save_json, sha
from citylib.package import make_server, require_matching_report, validate_release


class PackageTests(unittest.TestCase):
    def test_loopback_range_and_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            (root / "sample.json").write_bytes(b"0123456789")
            server = make_server(root, 0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = f"http://127.0.0.1:{server.server_address[1]}"
                with urlopen(Request(url + "/sample.json", headers={"Range": "bytes=2-5"})) as r:
                    self.assertEqual(r.status, 206)
                    self.assertEqual(r.read(), b"2345")
                    self.assertEqual(r.headers["Content-Range"], "bytes 2-5/10")
                    self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")
                with self.assertRaises(HTTPError):
                    urlopen(Request(url + "/sample.json", headers={"Range": "bytes=90-100"}))
                with self.assertRaises(HTTPError):
                    urlopen(url + "/%2e%2e/secret")
                (root / "link.json").symlink_to(root / "sample.json")
                with self.assertRaises(HTTPError):
                    urlopen(url + "/link.json")
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

    def test_unbound_comparison_or_verification_cannot_be_packaged(self):
        with self.assertRaisesRegex(ValueError, "differs"):
            require_matching_report({"completed": 100}, {"completed": 99}, "comparison")
        require_matching_report({"completed": 99}, {"completed": 99}, "comparison")

    def test_public_bind_rejected(self):
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            make_server(Path(temp), 0, host="0.0.0.0")

    def test_corrupt_release_refused_then_previous_bundle_recovered(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp).resolve()
            (p / "index.html").write_bytes(b"good")
            m = {
                "schema": "fleetlab.city-release/1.0.0",
                "files": {"index.html": {"sha256": sha(b"good"), "bytes": 4}},
            }
            save_json(p / "release.json", m)
            self.assertTrue(validate_release(p)["pass"])
            (p / "index.html").write_bytes(b"bad")
            self.assertFalse(validate_release(p)["pass"])
            (p / "index.html").write_bytes(b"good")
            self.assertTrue(validate_release(p)["pass"])

    def test_release_traversal_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp).resolve()
            save_json(
                p / "release.json",
                {
                    "schema": "fleetlab.city-release/1.0.0",
                    "files": {"../secret": {"sha256": "a", "bytes": 1}},
                },
            )
            with self.assertRaises(ValueError):
                validate_release(p)


if __name__ == "__main__":
    unittest.main()
