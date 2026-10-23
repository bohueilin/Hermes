import copy
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest, read_bundle, write_bundle
from citylib.pack import build_graph, qualify_inventory
from citylib.qualification import candidate_report
from shapely.geometry import Polygon, mapping
from test_restrictions_v2 import source


def fixture_roads(pack):
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": r["id"],
                "properties": {k: r[k] for k in ("id", "name", "class", "status", "scope")},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [round(v, 6) for v in pack["nodes"][n]] for n in r["source_nodes"]
                    ],
                },
            }
            for r in pack["inventory"]
        ],
    }


def fixture(root):
    raw = source()
    boundary = Polygon([[-1, -1], [1, -1], [1, 1], [-1, 1]])
    districts = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"sup_dist": "1"}, "geometry": mapping(boundary)}
        ],
    }
    geometry = {"boundary": mapping(boundary), "districts": districts, "land": mapping(boundary)}
    packs = [build_graph(raw), build_graph(raw, routing_profile="edge-sequence/2.0.0")]
    for i, p in enumerate(packs):
        p.update(pack_id=f"sf-v{i + 1}", city="San Francisco")
        p["source"] = {
            "osm_sha256": "a" * 64,
            "districts_sha256": "b" * 64,
            "boundary_sha256": digest(mapping(boundary)),
        }
    baseline = {
        "graph.json": packs[0],
        "coverage.json": qualify_inventory(packs[0]),
        "geometry.json": geometry,
        "roads.geo.json": fixture_roads(packs[0]),
    }
    write_bundle(root / "baseline", "fleetlab.city-pack/1.0.0", baseline)
    base = read_bundle(root / "baseline")
    coverage = qualify_inventory(packs[1])
    candidate = {"graph.json": packs[1], "coverage.json": coverage, "geometry.json": geometry}
    candidate["roads.geo.json"] = fixture_roads(packs[1])
    candidate.update(
        candidate_report(
            packs[1], coverage, raw, boundary, districts, {"baseline_pack_path": "baseline"}, root
        )
    )
    write_bundle(root / "candidate", "fleetlab.city-pack/1.0.0", candidate)
    return base, read_bundle(root / "candidate")


class CandidateBindingTests(unittest.TestCase):
    def test_captured_candidate_is_accepted(self):
        from citylib.candidate_binding import validate_candidate

        with tempfile.TemporaryDirectory() as temp:
            baseline, candidate = fixture(Path(temp).resolve())
            validate_candidate(baseline, candidate)

    def test_rehashed_cross_artifact_claims_are_rejected(self):
        from citylib.candidate_binding import validate_candidate

        changes = [
            ("qualification-report.json", "candidate_graph_digest", "f" * 64),
            ("qualification-report.json", "routing_profile", "node-via/1.0.0"),
            ("qualification-report.json", "candidate_pack_id", "another-city"),
            ("qualification-report.json", "before", {}),
            ("qualification-report.json", "after", {}),
            ("qualification-report.json", "restriction_counts", {}),
            ("qualification-report.json", "way_transitions", []),
            ("qualification-report.json", "district_gap_way_count", 999),
            ("qualification-report.json", "district_gap_summary", {}),
            ("qualification-report.json", "district_gap_digest", "f" * 64),
            ("qualification-report.json", "status", "PASS"),
            ("district-gaps.json", "total_gap_length_m", 999),
            ("coverage.json", "unsupported_fraction", 0.999),
        ]
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            baseline, candidate = fixture(root)
            for i, (file, field, value) in enumerate(changes):
                changed = copy.deepcopy(candidate)
                changed[file][field] = value
                files = {k: v for k, v in changed.items() if k != "manifest.json"}
                path = root / f"altered-{i}"
                write_bundle(path, "fleetlab.city-pack/1.0.0", files)
                with self.subTest(file=file, field=field), self.assertRaises(ValueError):
                    validate_candidate(baseline, read_bundle(path))

    def test_sources_and_geometry_cannot_change_under_same_source_claim(self):
        from citylib.candidate_binding import validate_candidate

        with tempfile.TemporaryDirectory() as temp:
            baseline, candidate = fixture(Path(temp).resolve())
            for field in ["osm_sha256", "districts_sha256", "boundary_sha256"]:
                altered = copy.deepcopy(candidate)
                altered["graph.json"]["source"][field] = "f" * 64
                with self.subTest(field=field), self.assertRaises(ValueError):
                    validate_candidate(baseline, altered)
            altered = copy.deepcopy(candidate)
            altered["geometry.json"]["land"]["coordinates"] = []
            with self.assertRaises(ValueError):
                validate_candidate(baseline, altered)

    def test_coordinated_false_coverage_and_gap_claims_are_recomputed(self):
        from citylib.candidate_binding import validate_candidate

        with tempfile.TemporaryDirectory() as temp:
            baseline, candidate = fixture(Path(temp).resolve())
            altered = copy.deepcopy(candidate)
            altered["coverage.json"]["unsupported_fraction"] = 0.999
            altered["qualification-report.json"]["after"]["unsupported_fraction"] = 0.999
            with self.assertRaises(ValueError):
                validate_candidate(baseline, altered)
            altered = copy.deepcopy(candidate)
            altered["district-gaps.json"]["total_gap_length_m"] = 999
            altered["qualification-report.json"]["district_gap_summary"]["total_gap_length_m"] = 999
            with self.assertRaises(ValueError):
                validate_candidate(baseline, altered)


class RoadDisplayBindingTests(unittest.TestCase):
    def test_rehashed_road_display_must_match_inventory(self):
        from citylib.candidate_binding import validate_candidate

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            baseline, candidate = fixture(root)
            for case in ["empty", "swapped", "status", "geometry", "name", "class", "scope", "id"]:
                altered = copy.deepcopy(candidate)
                display = altered["roads.geo.json"]
                if case == "empty":
                    display["features"] = []
                elif case == "swapped":
                    altered["roads.geo.json"] = copy.deepcopy(baseline["roads.geo.json"])
                elif case == "geometry":
                    display["features"][0]["geometry"]["coordinates"][0][0] += 0.5
                elif case == "id":
                    display["features"][0]["id"] = "unknown"
                else:
                    display["features"][0]["properties"][case] = "wrong"
                files = {k: v for k, v in altered.items() if k != "manifest.json"}
                path = root / ("bad-roads-" + case)
                write_bundle(path, "fleetlab.city-pack/1.0.0", files)
                with self.subTest(case=case), self.assertRaisesRegex(ValueError, "road display"):
                    validate_candidate(baseline, read_bundle(path))
