"""Unit checks for source direction, access and value provenance before derivation."""

import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "street_extract", Path(__file__).with_name("extract.py")
)
EXTRACT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXTRACT)


class SourceSemantics(unittest.TestCase):
    def test_direction_follows_osm_way_order_and_motorway_defaults(self):
        self.assertEqual(EXTRACT.directions({"highway": "secondary", "oneway": "-1"}), [-1])
        self.assertEqual(EXTRACT.directions({"highway": "secondary", "oneway": "yes"}), [1])
        self.assertEqual(EXTRACT.directions({"highway": "motorway"}), [1])
        self.assertEqual(EXTRACT.directions({"highway": "motorway", "oneway": "no"}), [1, -1])
        self.assertEqual(EXTRACT.directions({"highway": "motorway_link"}), [1, -1])
        self.assertEqual(EXTRACT.directions({"highway": "secondary", "oneway": "reversible"}), [])
        self.assertEqual(
            EXTRACT.directions({"highway": "secondary", "junction": "roundabout"}), [1]
        )

    def test_specific_motorcar_permissions_and_conservative_conditional_exclusion(self):
        base = {"highway": "secondary"}
        self.assertFalse(EXTRACT.allowed({**base, "access": "private"}))
        self.assertFalse(EXTRACT.allowed({**base, "motor_vehicle": "no", "bus": "yes"}))
        self.assertFalse(EXTRACT.allowed({**base, "motorcar": "destination"}))
        self.assertTrue(EXTRACT.allowed({**base, "access": "no", "motorcar": "yes"}))
        self.assertFalse(EXTRACT.allowed({**base, "motorcar:conditional": "yes @ (Mo-Fr)"}))
        self.assertEqual(
            EXTRACT.effective_access({**base, "motorcar:backward": "no"}, "backward"), "no"
        )

    def test_speed_and_lane_assumptions_are_distinct_from_source_tags(self):
        self.assertEqual(
            EXTRACT.speed({"highway": "secondary", "maxspeed": "25 mph"}, "forward"),
            (40.234, "osm:maxspeed"),
        )
        self.assertEqual(
            EXTRACT.speed({"highway": "secondary"}, "forward"), (35, "modeled:class_fallback")
        )
        self.assertEqual(
            EXTRACT.lane_count({"highway": "secondary", "lanes": "3"}, "forward", True),
            (1, "modeled:directional_share"),
        )
        self.assertEqual(
            EXTRACT.lane_count(
                {"highway": "secondary", "lanes": "3", "lanes:psv": "1"}, "forward", False
            ),
            (2, "modeled:general_lane_share"),
        )
        self.assertEqual(
            EXTRACT.lane_count({"highway": "secondary", "lanes:forward": "2"}, "forward", True),
            (2, "osm:lanes:forward"),
        )

    def test_hotspot_names_are_geographically_scoped(self):
        self.assertEqual(EXTRACT.hotspot({"name": "Van Ness Avenue"}, -122.423, 37.79), "van-ness")
        self.assertIsNone(EXTRACT.hotspot({"name": "Van Ness Avenue"}, -122.40, 37.65))
        self.assertIsNone(EXTRACT.hotspot({"name": "Lombard Street"}, -122.435, 37.80))
        self.assertEqual(
            EXTRACT.hotspot({"name": "Stockton Tunnel"}, -122.4075, 37.791), "stockton"
        )


if __name__ == "__main__":
    unittest.main()
