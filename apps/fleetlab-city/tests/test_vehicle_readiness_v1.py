"""Hand-computed cases for the separate, anonymous teaching calculator."""

import copy
import importlib.util
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
MODULE = "citylib.vehicle_readiness_v1"
if importlib.util.find_spec(MODULE) is not None:
    from citylib.vehicle_readiness_v1 import direction_fixture, station_sensitivity
else:
    direction_fixture = station_sensitivity = None


def station_inputs():
    return {
        "distance_km": 40,
        "battery_kwh_per_km": 0.2,
        "service_hours": 2,
        "aux_battery_kw": 1,
        "usable_capacity_kwh": 60,
        "start_kwh": 30,
        "target_kwh": 40,
        "site_grid_kw": 100,
        "ports": 4,
        "active_ports": 2,
        "port_grid_kw": 60,
        "vehicle_acceptance_battery_kw": 50,
        "charging_efficiency": 0.8,
    }


def direction_inputs():
    return {
        "body_heading_deg": 90,
        "bidirectional": False,
        "vehicle_length_m": 4,
        "vehicle_width_m": 2,
        "bay_length_m": 6,
        "bay_width_m": 3,
        "exits": [
            {
                "id": "ahead",
                "heading_deg": 90,
                "motion": "forward",
                "permitted": True,
                "dwell_s": 12,
                "dwell_basis": "USER_SUPPLIED",
            },
            {
                "id": "behind",
                "heading_deg": 270,
                "motion": "reverse",
                "permitted": False,
                "dwell_s": 4,
                "dwell_basis": "USER_SUPPLIED",
            },
        ],
    }


class VehicleReadinessTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(station_sensitivity, "anonymous calculator has not been implemented")

    def test_grid_battery_and_loss_ledgers_conserve_one_service_and_charge_cycle(self):
        r = station_sensitivity(station_inputs())
        self.assertEqual(r["availability"], "COMPUTED")
        self.assertEqual(r["demand_energy_kwh"], 10)
        self.assertEqual(r["after_service_kwh"], 20)
        self.assertEqual(r["battery_charge_kwh"], 20)
        self.assertEqual(r["grid_charge_kwh"], 25)
        self.assertEqual(r["charging_loss_kwh"], 5)
        self.assertEqual(r["final_kwh"], 40)
        self.assertEqual(r["effective_battery_kw"], 40)
        self.assertEqual(r["charging_hours"], 0.5)
        self.assertEqual(r["cycle_hours"], 2.5)
        self.assertEqual(r["bottlenecks"], ["SITE_GRID_SHARE"])

    def test_acceptance_caps_battery_power_and_reports_unused_grid_share(self):
        p = station_inputs()
        p.update(site_grid_kw=400, vehicle_acceptance_battery_kw=24)
        r = station_sensitivity(p)
        self.assertEqual(r["effective_battery_kw"], 24)
        self.assertEqual(r["effective_grid_kw"], 30)
        self.assertEqual(r["bottlenecks"], ["VEHICLE_BATTERY_ACCEPTANCE"])
        self.assertEqual(r["site_grid_saturation_kw"], 60)
        self.assertAlmostEqual(r["charging_hours"], 5 / 6)

    def test_port_cap_and_bottleneck_ties_are_not_hidden(self):
        p = station_inputs()
        p.update(site_grid_kw=120, port_grid_kw=60, vehicle_acceptance_battery_kw=48)
        r = station_sensitivity(p)
        self.assertEqual(r["effective_battery_kw"], 48)
        self.assertEqual(
            r["bottlenecks"],
            ["SITE_GRID_SHARE", "PORT_GRID_LIMIT", "VEHICLE_BATTERY_ACCEPTANCE"],
        )
        self.assertEqual(r["site_grid_saturation_kw"], 120)
        p.update(site_grid_kw=400, vehicle_acceptance_battery_kw=100)
        self.assertEqual(station_sensitivity(p)["bottlenecks"], ["PORT_GRID_LIMIT"])

    def test_higher_site_power_only_helps_until_the_declared_crossover(self):
        values = []
        for power in (60, 120, 240):
            p = station_inputs()
            p.update(site_grid_kw=power, vehicle_acceptance_battery_kw=48)
            values.append(station_sensitivity(p)["charging_hours"])
        self.assertGreater(values[0], values[1])
        self.assertEqual(values[1], values[2])

    def test_missing_inputs_are_unavailable_instead_of_defaulted(self):
        for key in station_inputs():
            with self.subTest(key=key):
                p = station_inputs()
                p[key] = None
                r = station_sensitivity(p)
                self.assertEqual(r["availability"], "NOT_AVAILABLE")
                self.assertIn(key, r["missing_fields"])
                self.assertIsNone(r["charging_hours"])
                self.assertIsNone(r["demand_energy_kwh"])

    def test_nonfinite_boolean_wrong_unit_and_out_of_bounds_inputs_rejected(self):
        cases = [
            ("distance_km", -1), ("battery_kwh_per_km", 0),
            ("charging_efficiency", 0), ("charging_efficiency", 1.1),
            ("service_hours", math.inf), ("start_kwh", math.nan),
            ("ports", True), ("ports", 1.5), ("active_ports", 0),
            ("site_grid_kw", 0), ("vehicle_acceptance_battery_kw", -1),
            ("battery_kwh_per_km", "0.2 kWh/km"),
        ]
        for key, value in cases:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                station_sensitivity({**station_inputs(), key: value})
        with self.assertRaises(ValueError):
            station_sensitivity({**station_inputs(), "kwh_per_mile": 0.3})

    def test_huge_numeric_input_is_rejected_as_validation_error(self):
        with self.assertRaises(ValueError):
            station_sensitivity({**station_inputs(), "site_grid_kw": 10**1000})

    def test_energy_target_capacity_and_port_population_relationships_validated(self):
        for update in (
            {"target_kwh": 61}, {"start_kwh": 45}, {"active_ports": 5},
            {"distance_km": 1, "service_hours": 0},
        ):
            with self.subTest(update=update), self.assertRaises(ValueError):
                station_sensitivity({**station_inputs(), **update})

    def test_insufficient_energy_is_not_repaired_with_an_invented_charge_stop(self):
        r = station_sensitivity({**station_inputs(), "start_kwh": 5})
        self.assertEqual(r["availability"], "NOT_FEASIBLE")
        self.assertEqual(r["energy_deficit_kwh"], 5)
        self.assertIsNone(r["after_service_kwh"])
        self.assertIsNone(r["charging_hours"])
        self.assertIsNone(r["final_kwh"])

    def test_explicit_zero_demand_and_equal_target_require_no_charge(self):
        p = station_inputs()
        p.update(distance_km=0, service_hours=0, target_kwh=30)
        r = station_sensitivity(p)
        self.assertEqual(r["demand_energy_kwh"], 0)
        self.assertEqual(r["charging_hours"], 0)
        self.assertEqual(r["cycle_hours"], 0)
        self.assertIsNone(r["service_time_fraction"])

    def test_calculator_is_deterministic_does_not_mutate_or_claim_operator_evidence(self):
        p = station_inputs()
        before = copy.deepcopy(p)
        a, b = station_sensitivity(p), station_sensitivity(p)
        self.assertEqual(a, b)
        self.assertEqual(p, before)
        self.assertEqual(a["scope"], "SIMULATION_ONLY")
        self.assertEqual(a["deployment_permission"], "NONE")
        self.assertEqual(a["authenticity"], "NOT_AUTHENTICATED")
        self.assertEqual(a["evidence"], "ILLUSTRATIVE_CALCULATION")


class DirectionChoiceTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(direction_fixture, "direction fixture has not been implemented")

    def test_bidirectional_label_does_not_grant_forbidden_reverse_exit(self):
        p = direction_inputs()
        p["bidirectional"] = True
        r = direction_fixture(p)
        self.assertEqual(r["options"][0]["availability"], "COMPUTED")
        self.assertEqual(r["options"][1]["availability"], "NOT_AVAILABLE")
        self.assertEqual(r["options"][1]["reason"], "EXIT_NOT_PERMITTED")
        self.assertIsNone(r["options"][1]["dwell_s"])
        self.assertEqual(r["body_heading_deg"], 90)

    def test_conventional_vehicle_can_reverse_when_explicitly_permitted(self):
        p = direction_inputs()
        p["exits"][1]["permitted"] = True
        r = direction_fixture(p)
        self.assertEqual(r["options"][1]["availability"], "COMPUTED")
        self.assertEqual(r["options"][1]["travel_heading_deg"], 270)
        self.assertEqual(r["options"][1]["dwell_s"], 4)
        self.assertEqual(r["body_heading_deg"], 90)

    def test_no_heading_rotation_or_turning_path_is_invented(self):
        p = direction_inputs()
        p["exits"][0]["heading_deg"] = 180
        r = direction_fixture(p)
        self.assertEqual(r["options"][0]["availability"], "NOT_AVAILABLE")
        self.assertEqual(r["options"][0]["reason"], "HEADING_CHANGE_NOT_MODELED")
        self.assertEqual(r["availability"], "NOT_AVAILABLE")

    def test_missing_dwell_or_permission_cannot_become_zero_or_success(self):
        for key in ("dwell_s", "dwell_basis", "permitted"):
            with self.subTest(key=key):
                p = direction_inputs()
                del p["exits"][0][key]
                r = direction_fixture(p)
                self.assertEqual(r["options"][0]["availability"], "NOT_AVAILABLE")
                self.assertIsNone(r["options"][0]["dwell_s"])

    def test_static_nonfit_does_not_claim_available_exit(self):
        p = direction_inputs()
        p["bay_width_m"] = 1.9
        r = direction_fixture(p)
        self.assertFalse(r["static_footprint_fits"])
        self.assertTrue(all(x["availability"] == "NOT_AVAILABLE" for x in r["options"]))
        self.assertEqual(r["geometric_maneuver_feasibility"], "NOT_EVALUATED")

    def test_equal_footprint_has_zero_margin_but_still_no_maneuver_authority(self):
        p = direction_inputs()
        p.update(bay_width_m=2, bay_length_m=4)
        r = direction_fixture(p)
        self.assertTrue(r["static_footprint_fits"])
        self.assertEqual(r["lateral_total_margin_m"], 0)
        self.assertEqual(r["longitudinal_total_margin_m"], 0)
        self.assertEqual(r["geometric_maneuver_feasibility"], "NOT_EVALUATED")

    def test_bad_dimensions_headings_costs_and_duplicate_exits_rejected(self):
        for key, value in (
            ("vehicle_width_m", 0), ("bay_length_m", -1),
            ("body_heading_deg", 360), ("body_heading_deg", math.nan),
            ("bidirectional", "true"),
        ):
            with self.subTest(key=key), self.assertRaises(ValueError):
                direction_fixture({**direction_inputs(), key: value})
        for key, value in (("dwell_s", -1), ("motion", "crab"), ("permitted", 1)):
            p = direction_inputs()
            p["exits"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                direction_fixture(p)
        p = direction_inputs()
        p["exits"].append(copy.deepcopy(p["exits"][0]))
        with self.assertRaises(ValueError):
            direction_fixture(p)

    def test_fixture_missing_geometry_is_unavailable_and_caller_data_unchanged(self):
        p = direction_inputs()
        del p["vehicle_width_m"]
        before = copy.deepcopy(p)
        r = direction_fixture(p)
        self.assertEqual(r["availability"], "NOT_AVAILABLE")
        self.assertIsNone(r["static_footprint_fits"])
        self.assertEqual(p, before)


if __name__ == "__main__":
    unittest.main()
