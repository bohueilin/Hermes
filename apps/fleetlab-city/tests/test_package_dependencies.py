"""Release dependencies must be present even when omitted from an edited manifest."""

import gzip
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import save_json
from citylib.package import check_dist, file_inventory


class PackageDependencyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.files = {
            "index.html": '<script type="module" src="./app.mjs"></script>',
            "app.mjs": "import './power-study.mjs';",
            "power-study.mjs": 'export const name = "power";',
            "style.css": "",
            "view-model.mjs": "",
            "city-map.mjs": "",
            "replay.mjs": "",
            "vendor/maplibre-gl.mjs": "",
            "vendor/maplibre-gl-shared.mjs": "",
            "vendor/maplibre-gl-worker.mjs": "",
            "vendor/maplibre-gl.css": "",
            "data/catalog.json": "{}",
            "data/routing-roads.geo.json": "{}",
            "data/geometry.json": "{}",
            "data/comparison.json": "{}",
        }

    def package(self):
        for name, text in self.files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            Path(str(path) + ".gz").write_bytes(gzip.compress(text.encode(), mtime=0))
        save_json(
            self.root / "release.json",
            {
                "schema": "fleetlab.city-release/1.0.0",
                "files": file_inventory(self.root, exclude=("release.json",)),
                "pair_compressed_bytes": {"1": 1},
            },
        )

    def test_imported_module_removed_from_files_and_manifest_is_rejected(self):
        self.files.pop("power-study.mjs")
        self.package()
        result = check_dist(self.root)
        self.assertFalse(result["pass"])
        self.assertFalse(result["checks"]["viewer_dependencies"])
        self.assertIn("power-study.mjs", str(result["dependency_failures"]))

    def test_older_viewer_without_power_import_stays_valid(self):
        self.files["app.mjs"] = "import './replay.mjs';"
        self.files.pop("power-study.mjs")
        self.package()
        self.assertTrue(check_dist(self.root)["pass"])

    def test_transitive_multiline_reexport_cannot_hide_missing_dependency(self):
        self.files["power-study.mjs"] = "export {\n value\n} from './missing.mjs';"
        self.package()
        self.assertFalse(check_dist(self.root)["pass"])

    def test_import_literal_escapes_are_resolved_without_executing_module(self):
        self.files["app.mjs"] = (
            "throw new Error('must not execute');\nimport './pow\\u0065r-study.mjs';"
        )
        self.files.pop("power-study.mjs")
        self.package()
        self.assertFalse(check_dist(self.root)["pass"])

    def test_linked_optional_stylesheet_omission_is_rejected(self):
        self.files["index.html"] += '<link rel="stylesheet" href="./vehicle-concepts.css">'
        self.package()
        self.assertFalse(check_dist(self.root)["pass"])

    def test_unlisted_existing_module_is_not_an_integrity_bound_dependency(self):
        self.package()
        from citylib.contracts import load_json

        manifest = load_json(self.root / "release.json")
        manifest["files"].pop("power-study.mjs")
        manifest["files"].pop("power-study.mjs.gz")
        save_json(self.root / "release.json", manifest)
        self.assertFalse(check_dist(self.root)["pass"])

    def test_dependency_parser_does_not_execute_valid_packaged_javascript(self):
        self.files["app.mjs"] = "import './power-study.mjs'; throw new Error('must not execute');"
        self.package()
        self.assertTrue(check_dist(self.root)["pass"])

    def test_nonlocal_static_module_import_is_refused(self):
        self.files["app.mjs"] = "import 'node:fs';"
        self.package()
        self.assertFalse(check_dist(self.root)["pass"])
