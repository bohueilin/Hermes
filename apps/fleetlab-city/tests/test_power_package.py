"""Fresh scientific binding and bounded presentation-only study exports."""

import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import test_power_study as fixtures
from citylib.contracts import load_json, save_json
from citylib.power_analysis import analyze_study
from citylib.power_study import execute_study, freeze_study


class PowerPackageTests(unittest.TestCase):
    setUp = fixtures.LifecycleTests.setUp

    def exporter(self):
        self.assertIsNotNone(
            importlib.util.find_spec("citylib.power_package"), "fresh power study exporter missing"
        )
        from citylib.power_package import export_power_study

        return export_power_study

    def prepare(self):
        freeze_study(self.root, self.out)
        execute_study(self.root, self.out, "preflight")
        execute_study(self.root, self.out, "evaluate")
        save_json(
            self.out / "evaluate-analysis.json", analyze_study(self.root, self.out, "evaluate")
        )
        destination = self.root / "viewer/data"
        destination.mkdir(parents=True)
        return destination

    def test_export_all_summaries_but_only_first_seed_six_recordings(self):
        export = self.exporter()
        destination = self.prepare()
        before = {p: p.read_bytes() for p in self.out.rglob("*") if p.is_file()}
        study, budgets = export(self.root, self.out, destination)
        analysis = load_json(destination / "power-analysis.json")
        self.assertEqual(len(analysis["arms"]), 144)
        self.assertNotIn("root", load_json(destination / "power-protocol.json"))
        self.assertEqual(
            study["configurations"], ["a-200", "ab-200", "b-200", "a-400", "ab-400", "b-400"]
        )
        self.assertTrue(all("requests" not in row["diagnostics"] for row in analysis["arms"]))
        self.assertEqual({r["seed"] for r in study["recordings"]}, {10})
        self.assertEqual(len(study["recordings"]), 6)
        b = next(r for r in study["recordings"] if r["configuration"] == "b-400")
        self.assertEqual([s["id"] for s in b["sites"]], ["B"])
        self.assertEqual(b["sites"][0]["power_kw"], 400)
        self.assertEqual(b["energy"]["target_kwh"], 48)
        self.assertEqual(len(budgets), 4)
        self.assertTrue(all(0 < size < 20 * 1024**2 for size in budgets.values()))
        self.assertEqual(before, {p: p.read_bytes() for p in self.out.rglob("*") if p.is_file()})

    def test_edited_summary_cannot_be_rebound_with_new_hashes(self):
        export = self.exporter()
        destination = self.prepare()
        analysis = load_json(self.out / "evaluate-analysis.json")
        analysis["primary"]["mean"] = 999
        save_json(self.out / "evaluate-analysis.json", analysis)
        # An attacker can regenerate any catalogue hash; exporter must bind to runs first.
        with self.assertRaisesRegex(ValueError, "fresh|captured"):
            export(self.root, self.out, destination)
        self.assertFalse((destination / "power-analysis.json").exists())

    def test_missing_arm_refuses_complete_export(self):
        export = self.exporter()
        destination = self.prepare()
        (self.out / "evaluate/10-b-400/run.json").unlink()
        with self.assertRaisesRegex(ValueError, "incomplete|complete|fresh"):
            export(self.root, self.out, destination)
        self.assertFalse((destination / "power-analysis.json").exists())

    def test_export_uses_one_scientific_pass_then_digest_recapture(self):
        from unittest.mock import patch

        export = self.exporter()
        destination = self.prepare()
        with patch("citylib.power_package.analyze_study", wraps=analyze_study) as analysis:
            export(self.root, self.out, destination)
        self.assertEqual(analysis.call_count, 1)

    def test_rehashed_nonreplay_arm_mutation_during_export_refused(self):
        from unittest.mock import patch

        from citylib.contracts import canonical, digest, read_bundle, sha
        from citylib.presentation import vehicle_views

        export = self.exporter()
        destination = self.prepare()
        mutated = False

        def views(*args):
            nonlocal mutated
            for view in vehicle_views(*args):
                if not mutated:
                    mutated = True
                    path = self.out / "evaluate/33-b-400"
                    bundle = read_bundle(path)
                    bundle["run.json"]["metrics"] = {"completed": 999}
                    data = canonical(bundle["run.json"]) + b"\n"
                    (path / "run.json").write_bytes(data)
                    manifest = bundle["manifest.json"]
                    manifest["files"]["run.json"] = {"sha256": sha(data), "bytes": len(data)}
                    manifest["content_digest"] = digest(
                        {k: v for k, v in manifest.items() if k != "content_digest"}
                    )
                    save_json(path / "manifest.json", manifest)
                yield view

        with (
            patch("citylib.power_package.vehicle_views", side_effect=views),
            self.assertRaisesRegex(ValueError, "changed|incomplete"),
        ):
            export(self.root, self.out, destination)
        self.assertFalse((destination / "power-analysis.json").exists())

    def test_execution_ledger_mutation_during_projection_refused(self):
        from unittest.mock import patch

        from citylib.presentation import vehicle_views

        export = self.exporter()
        destination = self.prepare()
        mutated = False

        def views(*args):
            nonlocal mutated
            for view in vehicle_views(*args):
                if not mutated:
                    mutated = True
                    path = self.out / "evaluate/execution.json"
                    ledger = load_json(path)
                    save_json(path, {**ledger, "status": "INCOMPLETE"})
                yield view

        with (
            patch("citylib.power_package.vehicle_views", side_effect=views),
            self.assertRaisesRegex(ValueError, "changed"),
        ):
            export(self.root, self.out, destination)
