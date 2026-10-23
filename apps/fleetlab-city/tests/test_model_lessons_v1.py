import copy
import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest

if importlib.util.find_spec("citylib.model_lessons_v1") is not None:
    from citylib.model_lessons_v1 import build_model_lessons, verify_model_lessons
else:
    build_model_lessons = verify_model_lessons = None


class ModelLessonsTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(build_model_lessons, "teaching projection is not implemented")

    def test_complete_fixed_population_and_expected_charge_times(self):
        data = build_model_lessons()
        self.assertEqual(len(data["station_cases"]), 12)
        by_id = {c["id"]: c for c in data["station_cases"]}
        self.assertEqual(len(by_id), 12)
        low = by_id["site-100-acceptance-20"]["result"]
        high = by_id["site-800-acceptance-80"]["result"]
        self.assertEqual(low["demand_energy_kwh"], 10)
        self.assertEqual(low["battery_charge_kwh"], 28)
        self.assertEqual(low["effective_battery_kw"], 11.25)
        self.assertAlmostEqual(low["charging_hours"], 112 / 45)
        self.assertEqual(high["effective_battery_kw"], 45)
        self.assertAlmostEqual(high["charging_hours"], 28 / 45)
        self.assertEqual(high["bottlenecks"], ["PORT_GRID_LIMIT"])
        self.assertIsNone(verify_model_lessons(data))

    def test_tampered_ledger_or_omitted_case_rejected_even_after_redigest(self):
        for mutation in ("ledger", "input", "duplicate", "missing", "direction"):
            data = build_model_lessons()
            if mutation == "ledger":
                data["station_cases"][0]["result"]["grid_charge_kwh"] += 1
            elif mutation == "input":
                data["station_cases"][0]["result"]["inputs"]["distance_km"] = 41
            elif mutation == "duplicate":
                data["station_cases"][1] = copy.deepcopy(data["station_cases"][0])
            elif mutation == "missing":
                data["station_cases"].pop()
            else:
                data["direction_cases"][-1]["result"]["options"][1]["availability"] = "COMPUTED"
            data["content_digest"] = digest({
                k: v for k, v in data.items() if k != "content_digest"
            })
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                verify_model_lessons(data)

    def test_generation_deterministic_and_separate_from_sf_evidence(self):
        a, b = build_model_lessons(), build_model_lessons()
        self.assertEqual(a, b)
        self.assertEqual(a["schema"], "fleetlab.model-lessons/1.0.0")
        self.assertEqual(a["evidence"], "ILLUSTRATIVE_CALCULATION")
        self.assertEqual(a["decision_authority"], "NONE")
        self.assertEqual(a["verification"], "INTERNALLY_CONSISTENT")
        self.assertEqual(len(a["direction_cases"]), 3)


if __name__ == "__main__":
    unittest.main()
