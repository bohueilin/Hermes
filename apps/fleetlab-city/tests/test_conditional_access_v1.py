"""Literal time-boundary expectations; no real street-access claims."""

import importlib
import importlib.util
import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class ConditionalAccessTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("citylib.conditional_access_v1"))
        self.api = importlib.import_module("citylib.conditional_access_v1")

    def evaluate(self, expression, instant):
        return self.api.evaluate_condition(
            self.api.parse_condition(expression),
            datetime.fromisoformat(instant),
            vehicle_class="passenger_car",
            timezone_name="America/Los_Angeles",
        )

    def test_rush_hour_uses_each_traversal_instant_and_two_windows(self):
        expression = "no_left_turn @ (Mo-Fr 07:00-10:00,15:00-19:00)"
        for time, want in [
            ("06:59:59", False),
            ("07:00:00", True),
            ("09:59:59", True),
            ("10:00:00", False),
            ("14:59:59", False),
            ("15:00:00", True),
            ("18:59:59", True),
            ("19:00:00", False),
        ]:
            with self.subTest(time=time):
                r = self.evaluate(expression, f"2026-09-29T{time}-07:00")
                self.assertEqual(r.active, want)
                self.assertEqual(r.value, "no_left_turn" if want else None)
        self.assertFalse(self.evaluate(expression, "2026-10-03T08:00:00-07:00").active)

    def test_daily_access_and_overnight_wrap_are_half_open(self):
        for expression, examples in [
            (
                "no @ (11:00-18:00)",
                [("10:59:59", False), ("11:00:00", True), ("17:59:59", True), ("18:00:00", False)],
            ),
            (
                "no @ (23:00-05:00)",
                [
                    ("22:59:59", False),
                    ("23:00:00", True),
                    ("00:00:00", True),
                    ("04:59:59", True),
                    ("05:00:00", False),
                ],
            ),
        ]:
            for time, want in examples:
                with self.subTest(expression=expression, time=time):
                    self.assertEqual(
                        self.evaluate(expression, f"2026-09-29T{time}-07:00").active, want
                    )

    def test_overnight_weekday_is_the_start_day(self):
        expression = "no @ (Mo 23:00-05:00)"
        self.assertFalse(self.evaluate(expression, "2026-09-28T04:00:00-07:00").active)
        self.assertTrue(self.evaluate(expression, "2026-09-29T04:00:00-07:00").active)
        self.assertFalse(self.evaluate(expression, "2026-09-30T04:00:00-07:00").active)

    def test_utc_instant_and_local_offset_have_same_result(self):
        expression = "no @ (11:00-18:00)"
        a = self.evaluate(expression, "2026-09-29T18:00:00+00:00")
        b = self.evaluate(expression, "2026-09-29T11:00:00-07:00")
        self.assertEqual(a, b)
        self.assertEqual(a.local_timestamp, "2026-09-29T11:00:00-07:00")

    def test_unsupported_and_ambiguous_expressions_never_become_permission(self):
        for expr in [
            "yes @ (07:00-10:00)",
            "psv @ (Mo-Su 15:00-19:00)",
            "no @ (PH 07:00-10:00)",
            "no @ (Mo-Fr 07:00-10:00); yes @ (11:00-12:00)",
            "no @ (sunrise-sunset)",
            "no @ (Mo-Fr AND wet)",
            "no @ (24:00-05:00)",
            "no @ (07:00-07:00)",
            "no @ (Fr-Mo 07:00-10:00)",
            "no @ (07:00-11:00,10:00-12:00)",
            "no @ (07:60-10:00)",
            "no @ (07:00-10:00) trailing",
            "no @ (07:00-10:00)" * 100,
        ]:
            with self.subTest(expr=expr), self.assertRaises(ValueError):
                self.api.parse_condition(expr)

    def test_missing_or_wrong_vehicle_and_timezone_are_unsupported(self):
        rule = self.api.parse_condition("no @ (11:00-18:00)")
        instant = datetime(2026, 9, 29, 18, tzinfo=UTC)
        for kwargs in [
            {"vehicle_class": "psv", "timezone_name": "America/Los_Angeles"},
            {"vehicle_class": "robotaxi", "timezone_name": "America/Los_Angeles"},
            {"vehicle_class": "passenger_car", "timezone_name": "UTC"},
        ]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.api.evaluate_condition(rule, instant, **kwargs)
        with self.assertRaises(ValueError):
            self.api.evaluate_condition(
                rule,
                datetime(2026, 9, 29, 11),
                vehicle_class="passenger_car",
                timezone_name="America/Los_Angeles",
            )

    def test_local_dst_gap_and_ambiguous_fold_need_explicit_instant(self):
        rule = self.api.parse_condition("no @ (23:00-05:00)")
        for instant in [
            datetime(2026, 3, 8, 2, 30, tzinfo=ZoneInfo("America/Los_Angeles")),
            datetime(2026, 11, 1, 1, 30, tzinfo=ZoneInfo("America/Los_Angeles")),
        ]:
            with self.subTest(instant=instant), self.assertRaises(ValueError):
                self.api.evaluate_condition(
                    rule,
                    instant,
                    vehicle_class="passenger_car",
                    timezone_name="America/Los_Angeles",
                )
        self.assertTrue(self.evaluate("no @ (23:00-05:00)", "2026-11-01T08:30:00+00:00").active)
        self.assertTrue(self.evaluate("no @ (23:00-05:00)", "2026-11-01T09:30:00+00:00").active)

    def test_forged_parsed_rule_does_not_bypass_validation(self):
        from dataclasses import replace

        rule = self.api.parse_condition("no @ (11:00-18:00)")
        with self.assertRaises(ValueError):
            self.api.evaluate_condition(
                replace(rule, value="yes"),
                datetime(2026, 9, 29, 18, tzinfo=UTC),
                vehicle_class="passenger_car",
                timezone_name="America/Los_Angeles",
            )
