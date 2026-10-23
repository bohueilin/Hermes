import sys
import unittest
from pathlib import Path

from shapely.geometry import Polygon

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.importer import boundary_polygon, classify_scope


class ImportTests(unittest.TestCase):
    def test_boundary_from_source_ids_and_hole(self):
        source = {
            "nodes": {"1": [0, 0], "2": [1, 0], "3": [1, 1], "4": [0, 1]},
            "all_ways": {"10": {"nodes": ["1", "2", "3"]}, "20": {"nodes": ["3", "4", "1"]}},
            "boundary_members": [{"ref": "10", "role": "outer"}, {"ref": "20", "role": "outer"}],
        }
        self.assertEqual(boundary_polygon(source).area, 1)

    def test_crossing_buffer_and_disconnected_island(self):
        boundary = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        self.assertEqual(classify_scope([[-1, 0.5], [0.5, 0.5]], boundary), "boundary-crossing")
        self.assertEqual(classify_scope([[2, 2], [3, 3]], boundary), "buffer")
        self.assertEqual(classify_scope([[0.2, 0.2], [0.8, 0.8]], boundary), "city")

    def test_incomplete_boundary_is_refused(self):
        with self.assertRaises(ValueError):
            boundary_polygon({"nodes": {}, "all_ways": {}, "boundary_members": []})


if __name__ == "__main__":
    unittest.main()
