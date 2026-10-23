"""Partial study status must preserve missing cells and freshly check completed arms."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import test_power_study as fixtures
from citylib.contracts import load_json, save_json
from citylib.power_status import export_power_status
from citylib.power_study import execute_study, freeze_study
from citylib.runner import execute_arm


class PartialStatusTests(unittest.TestCase):
    setUp = fixtures.LifecycleTests.setUp

    def prepare(self):
        freeze_study(self.root, self.out)
        execute_study(self.root, self.out, "preflight")
        calls = 0

        def stop_after_first(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls > 1:
                raise ValueError("resource stop fixture")
            return execute_arm(*args, **kwargs)

        with patch("citylib.power_study.execute_arm", new=stop_after_first):
            execute_study(self.root, self.out, "evaluate")

    def test_one_arm_is_not_a_primary_or_complete_study(self):
        self.prepare()
        status = export_power_status(self.root, self.out)
        self.assertEqual(status["analysis_status"], "INCOMPLETE")
        self.assertEqual(status["completed_arms"], 1)
        self.assertEqual(status["scheduled_arms"], 144)
        self.assertEqual(status["not_run_arms"], 143)
        self.assertIsNone(status["primary"])
        self.assertEqual(len(status["cells"]), 144)
        self.assertNotIn("metrics", status["cells"][0])
        self.assertEqual(status["decision_authority"], "NONE")

    def test_tampered_completed_run_or_false_count_rejected(self):
        self.prepare()
        execution = load_json(self.out / "evaluate/execution.json")
        execution["arms"].append(execution["arms"][0])
        save_json(self.out / "evaluate/execution.json", execution)
        with self.assertRaises(ValueError):
            export_power_status(self.root, self.out)

    def test_missing_completed_arm_cannot_be_relabeled_not_run(self):
        self.prepare()
        (self.out / "evaluate/10-a-200/run.json").unlink()
        with self.assertRaises(ValueError):
            export_power_status(self.root, self.out)
