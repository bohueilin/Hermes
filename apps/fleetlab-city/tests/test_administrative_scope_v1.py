"""Administrative reporting cannot change routes, erase demand or claim acceptance."""

import copy
import importlib
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import canonical, digest, read_bundle, sha, write_bundle
from shapely.geometry import box, mapping


def fixture(root):
    x, y = -122.42, 37.77
    districts = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": [
            {
                "type": "Feature",
                "properties": {"DISTRICT": str(i + 1)},
                "geometry": mapping(box(x + i * 0.001, y, x + (i + 1) * 0.001, y + 0.001)),
            }
            for i in range(11)
        ],
    }
    nodes = {
        "a": [x + 0.0005, y + 0.0005],
        "b": [x + 0.0115, y + 0.0005],
        "c": [x + 0.013, y + 0.0005],
        "s0": [x + 0.001, y],
        "s1": [x + 0.001, y + 0.001],
    }
    rows = [
        {
            "id": "cross",
            "eligible": True,
            "source_nodes": ["a", "b", "c"],
            "scope": "boundary-crossing",
            "length_m": 1234,
            "status": "included",
            "class": "residential",
            "name": "Crossing",
        },
        {
            "id": "shared",
            "eligible": True,
            "source_nodes": ["s0", "s1"],
            "scope": "city",
            "length_m": 100,
            "status": "unsupported",
            "class": "residential",
            "name": "Shared",
        },
    ]
    graph = {"inventory": rows, "nodes": nodes, "candidate_ids": ["cross", "shared"]}
    source_inventory = {"candidate_ids": graph["candidate_ids"], "source_sha256": "a" * 64}
    graph["source_inventory_digest"] = digest(sorted(graph["candidate_ids"]))
    write_bundle(
        root / "candidate",
        "fleetlab.city-pack/1.0.0",
        {
            "graph.json": graph,
            "geometry.json": {"boundary": mapping(box(x, y, x + 0.012, y + 0.001))},
            "source-inventory.json": source_inventory,
            "qualification-report.json": {"candidate_graph_digest": digest(graph)},
            "human-review-checklist.json": {"review_results": []},
        },
    )
    candidate = read_bundle(root / "candidate")
    raw = canonical(districts)
    provenance = {
        "schema": "fleetlab.administrative-source/1.0.0",
        "source_url": "https://example.org/official-district-query",
        "captured_at": "2026-09-30T12:00:00Z",
        "raw_sha256": sha(raw),
        "license_status": "NOT_ESTABLISHED",
        "context": "Fixture only; no assertion of a redistribution grant",
        "chain": [{"url": "https://example.org/final-map", "sha256": "b" * 64}],
    }
    tape = {
        "node_pool": ["a", "b", "c"],
        "requests": [
            {"id": "r1", "origin": "a", "destination": "b"},
            {"id": "r2", "origin": "a", "destination": "c"},
        ],
        "initial": [{"id": "ev-001", "node": "b"}, {"id": "ev-002", "node": "a"}],
    }
    return candidate, raw, provenance, tape


def rehash_candidate(candidate):
    """Model an honestly re-encoded but semantically malformed candidate."""
    candidate["qualification-report.json"]["candidate_graph_digest"] = digest(
        candidate["graph.json"]
    )
    manifest = candidate["manifest.json"]
    for name in manifest["files"]:
        raw = canonical(candidate[name]) + b"\n"
        manifest["files"][name] = {"sha256": sha(raw), "bytes": len(raw)}
    manifest["content_digest"] = digest(
        {k: v for k, v in manifest.items() if k != "content_digest"}
    )


class AdministrativeScopeTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("citylib.administrative_scope_v1"))
        self.module = importlib.import_module("citylib.administrative_scope_v1")
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.candidate, self.raw, self.provenance, self.tape = fixture(self.root)

    def derive(self):
        return self.module.derive(self.candidate, self.raw, self.provenance, self.tape)

    def test_partition_conserves_length_counts_shared_once_and_keeps_context(self):
        result = self.derive()
        totals = result["accounting.json"]["totals"]
        self.assertAlmostEqual(
            totals["municipal_m"],
            totals["exclusive_m"] + totals["shared_m"] + totals["outside_districts_m"],
            places=6,
        )
        self.assertGreater(totals["outside_districts_m"], 80)
        self.assertGreater(totals["outside_municipality_m"], 80)
        self.assertGreater(totals["shared_m"], 110)
        self.assertLess(totals["shared_m"], 112)
        self.assertEqual(totals["frozen_eligible_length_m"], 1334)
        rows = {r["source_way_id"]: r for r in result["accounting.json"]["roads"]}
        self.assertEqual(rows["shared"]["exclusive_m"], 0)
        self.assertEqual(set(rows["shared"]["district_membership_m"]), {"1", "2"})
        self.assertEqual(result["report.json"]["qualification"], "HOLD")
        self.assertEqual(result["report.json"]["adoption"], "PROPOSED")
        self.assertEqual(result["report.json"]["human_observations"], 0)

    def test_all_population_retained_and_exact_affected_requests_identified(self):
        before = digest([self.candidate, self.tape])
        result = self.derive()["population.json"]
        self.assertEqual(result["counts"], {"pool": 3, "requests": 2, "initial": 2})
        self.assertEqual(result["changed_pool_nodes"], ["b"])
        self.assertEqual(result["affected_request_ids"], ["r1"])
        self.assertEqual(result["affected_initial_ids"], ["ev-001"])
        self.assertEqual(result["outside_proposed_pool_nodes"], ["b", "c"])
        self.assertEqual(result["outside_proposed_request_ids"], ["r1", "r2"])
        self.assertEqual(len(result["requests"]), 2)
        self.assertEqual(before, digest([self.candidate, self.tape]))

    def test_invalid_duplicate_missing_overlapping_districts_fail_closed(self):
        for mode in ("missing", "duplicate", "overlap", "invalid", "crs"):
            document = json.loads(self.raw)
            if mode == "missing":
                document["features"].pop()
            elif mode == "duplicate":
                document["features"][1]["properties"]["DISTRICT"] = "1"
            elif mode == "overlap":
                document["features"][1]["geometry"] = document["features"][0]["geometry"]
            elif mode == "invalid":
                document["features"][0]["geometry"]["coordinates"] = []
            else:
                document["crs"] = {"type": "name", "properties": {"name": "EPSG:3857"}}
            self.raw = canonical(document)
            self.provenance["raw_sha256"] = sha(self.raw)
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                self.derive()
            _, self.raw, self.provenance, _ = fixture(self.root / mode)

    def test_missing_geometry_inventory_or_tape_never_becomes_zero_impact(self):
        for mode in ("node", "source_ids", "pool", "request_node", "duplicate_request", "initial"):
            candidate, raw, provenance, tape = fixture(self.root / mode)
            if mode == "node":
                del candidate["graph.json"]["nodes"]["s0"]
            elif mode == "source_ids":
                candidate["graph.json"]["candidate_ids"].pop()
            elif mode == "pool":
                tape["node_pool"] = []
            elif mode == "request_node":
                tape["requests"][0]["origin"] = "absent"
            elif mode == "duplicate_request":
                tape["requests"].append(tape["requests"][0])
            else:
                del tape["initial"]
            rehash_candidate(candidate)
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                self.module.derive(candidate, raw, provenance, tape)

    def test_rehashed_accounting_policy_population_or_trust_forgeries_rejected(self):
        original = self.derive()
        for name, key, value in [
            ("accounting.json", "roads", []),
            ("population.json", "affected_request_ids", []),
            ("policy.json", "snap_m", 10),
            ("report.json", "qualification", "PASS"),
            ("report.json", "adoption", "ADOPTED"),
            ("report.json", "human_observations", 1),
            ("requirements.json", "obligations", []),
        ]:
            changed = copy.deepcopy(original)
            changed[name][key] = value
            with self.subTest(name=name, key=key), self.assertRaises(ValueError):
                self.module.validate(changed, self.candidate, self.raw, self.provenance, self.tape)

    def test_source_tape_and_provenance_identity_changes_invalidate_report(self):
        files = self.derive()
        for mode in ("source", "tape", "provenance"):
            raw, provenance, tape = (
                self.raw,
                copy.deepcopy(self.provenance),
                copy.deepcopy(self.tape),
            )
            if mode == "source":
                raw += b"\n"
                provenance["raw_sha256"] = sha(raw)
            elif mode == "tape":
                tape["requests"][0]["t"] = 1
            else:
                provenance["context"] = "A different asserted source context"
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                self.module.validate(files, self.candidate, raw, provenance, tape)

    def test_atomic_bundle_refuses_overwrite_and_detects_rehashed_gate(self):
        out = self.root / "proposal"
        files = self.derive()
        self.module.write(out, files)
        captured = self.module.read(out)
        self.assertTrue(
            self.module.validate(captured, self.candidate, self.raw, self.provenance, self.tape)[
                "pass"
            ]
        )
        before = {p.name: p.read_bytes() for p in out.iterdir()}
        with self.assertRaises(FileExistsError):
            self.module.write(out, files)
        self.assertEqual(before, {p.name: p.read_bytes() for p in out.iterdir()})
        manifest = json.loads((out / "manifest.json").read_bytes())
        manifest["scope"] = "PRODUCTION"
        manifest["content_digest"] = digest(
            {k: v for k, v in manifest.items() if k != "content_digest"}
        )
        (out / "manifest.json").write_bytes(canonical(manifest))
        with self.assertRaises(ValueError):
            self.module.read(out)

    def test_cli_rejects_report_overlap_before_writing_inputs(self):
        for name, data in (
            ("districts.geojson", self.raw),
            ("tape.json", canonical(self.tape)),
            ("provenance.json", canonical(self.provenance)),
        ):
            (self.root / name).write_bytes(data)
        before = (self.root / "tape.json").read_bytes()
        command = [
            sys.executable,
            str(Path(__file__).resolve().parents[1] / "tools/administrative-scope.py"),
            "build",
            "--candidate",
            str(self.root / "candidate"),
            "--districts",
            str(self.root / "districts.geojson"),
            "--tape",
            str(self.root / "tape.json"),
            "--provenance",
            str(self.root / "provenance.json"),
            "--output",
            str(self.root / "proposal"),
            "--report",
            str(self.root / "tape.json"),
            "--expected-candidate-digest",
            self.candidate["manifest.json"]["content_digest"],
            "--expected-source-sha256",
            sha(self.raw),
            "--expected-tape-sha256",
            sha(before),
            "--expected-provenance-sha256",
            sha(canonical(self.provenance)),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "proposal").exists())
        self.assertEqual(before, (self.root / "tape.json").read_bytes())

    def test_cli_build_then_fresh_process_recompute_and_wrong_pin_rejection(self):
        script = Path(__file__).resolve().parents[1] / "tools/administrative-scope.py"
        for name, data in (
            ("districts.geojson", self.raw),
            ("tape.json", canonical(self.tape)),
            ("provenance.json", canonical(self.provenance)),
        ):
            (self.root / name).write_bytes(data)
        args = [
            "--candidate",
            str(self.root / "candidate"),
            "--districts",
            str(self.root / "districts.geojson"),
            "--tape",
            str(self.root / "tape.json"),
            "--provenance",
            str(self.root / "provenance.json"),
            "--output",
            str(self.root / "proposal"),
            "--expected-candidate-digest",
            self.candidate["manifest.json"]["content_digest"],
            "--expected-source-sha256",
            sha(self.raw),
            "--expected-tape-sha256",
            sha(canonical(self.tape)),
            "--expected-provenance-sha256",
            sha(canonical(self.provenance)),
        ]
        for mode in ("build", "validate"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    mode,
                    *args,
                    "--report",
                    str(self.root / f"{mode}.json"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((self.root / f"{mode}.json").read_bytes())
            self.assertTrue(report["inputs_unchanged"])
            self.assertEqual(report["qualification"], "HOLD")
        bad = args.copy()
        bad[bad.index("--expected-source-sha256") + 1] = "0" * 64
        result = subprocess.run(
            [
                sys.executable,
                str(script),
                "validate",
                *bad,
                "--report",
                str(self.root / "bad.json"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)

    def test_returned_policy_cannot_mutate_future_recomputation(self):
        first = self.derive()
        first["policy.json"]["snap_m"] = 20
        self.assertEqual(self.derive()["policy.json"]["snap_m"], 0)

    def test_repeated_source_segments_keep_multiplicity(self):
        row = self.candidate["graph.json"]["inventory"][1]
        row["source_nodes"] = ["s0", "s1", "s0"]
        rehash_candidate(self.candidate)
        accounting = self.derive()["accounting.json"]
        self.assertGreater(accounting["totals"]["shared_m"], 220)
        self.assertLess(accounting["totals"]["shared_m"], 224)

    def test_submillimeter_gap_is_kept_in_accounting_and_obligations(self):
        graph = self.candidate["graph.json"]
        graph["nodes"]["tiny0"] = [-122.4085, 37.7705]
        graph["nodes"]["tiny1"] = [-122.4085 + 1e-9, 37.7705]
        row = graph["inventory"][0]
        row["source_nodes"] = ["tiny0", "tiny1"]
        rehash_candidate(self.candidate)
        files = self.derive()
        length = files["accounting.json"]["totals"]["outside_districts_m"]
        self.assertGreater(length, 0)
        self.assertLess(length, 0.001)
        obligation = next(
            x
            for x in files["requirements.json"]["obligations"]
            if x["id"] == "outside_districts_m-cross"
        )
        self.assertFalse(obligation["above_display_threshold"])

    def test_buffer_source_context_does_not_change_frozen_denominator(self):
        graph = self.candidate["graph.json"]
        graph["inventory"][0]["scope"] = "buffer"
        rehash_candidate(self.candidate)
        totals = self.derive()["accounting.json"]["totals"]
        self.assertEqual(totals["frozen_eligible_length_m"], 100)
        self.assertEqual(totals["all_eligible_source_length_m"], 1334)
        self.assertGreater(totals["outside_municipality_m"], 80)

    def test_atomic_publish_cannot_replace_an_existing_empty_directory(self):
        self.assertTrue(callable(getattr(self.module, "publish_noreplace", None)))
        staged, existing = self.root / "staged", self.root / "existing"
        staged.mkdir()
        (staged / "retained.txt").write_text("staged content")
        existing.mkdir()
        inode = existing.stat().st_ino
        with self.assertRaises(FileExistsError):
            self.module.publish_noreplace(staged, existing)
        self.assertEqual(existing.stat().st_ino, inode)
        self.assertEqual(list(existing.iterdir()), [])
        self.assertEqual((staged / "retained.txt").read_text(), "staged content")

    def test_member_mutation_during_capture_invalidates_read(self):
        out = self.root / "proposal"
        self.module.write(out, self.derive())
        capture = self.module.read_bytes
        mutated = False

        def mutate_after_read(path, *args):
            nonlocal mutated
            data = capture(path, *args)
            if Path(path).name == "accounting.json" and not mutated:
                mutated = True
                Path(path).write_bytes(data + b" ")
            return data

        with (
            patch.object(self.module, "read_bytes", mutate_after_read),
            self.assertRaises(ValueError),
        ):
            self.module.read(out)

    def cli_fixture(self, mode, output=None, report=None):
        script = Path(__file__).resolve().parents[1] / "tools/administrative-scope.py"
        spec = importlib.util.spec_from_file_location("administrative_cli_test", script)
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        for name, data in (
            ("districts.geojson", self.raw),
            ("tape.json", canonical(self.tape)),
            ("provenance.json", canonical(self.provenance)),
        ):
            (self.root / name).write_bytes(data)
        args = [
            str(script),
            mode,
            "--candidate",
            str(self.root / "candidate"),
            "--districts",
            str(self.root / "districts.geojson"),
            "--tape",
            str(self.root / "tape.json"),
            "--provenance",
            str(self.root / "provenance.json"),
            "--output",
            str(output or self.root / "proposal"),
            "--report",
            str(report or self.root / "process.json"),
            "--expected-candidate-digest",
            self.candidate["manifest.json"]["content_digest"],
            "--expected-source-sha256",
            sha(self.raw),
            "--expected-tape-sha256",
            sha(canonical(self.tape)),
            "--expected-provenance-sha256",
            sha(canonical(self.provenance)),
        ]
        return cli, args

    def check_cli_dotdot(self, mode):
        (self.root / "alias").mkdir()
        if mode == "build":
            output = self.root / "alias/../candidate/overlay"
            report = self.root / "alias/../candidate/build-report.json"
        else:
            self.module.write(self.root / "proposal", self.derive())
            output = self.root / "proposal"
            report = self.root / "alias/../proposal/validation.json"
        cli, args = self.cli_fixture(mode, output, report)
        with (
            redirect_stdout(io.StringIO()),
            patch.object(sys, "argv", args),
            self.assertRaises(ValueError),
        ):
            cli.main()
        self.assertFalse(report.exists())
        self.assertFalse((self.root / "candidate/overlay").exists())
        if mode == "validate":
            self.module.read(self.root / "proposal")

    def test_cli_dotdot_cannot_write_into_candidate(self):
        self.check_cli_dotdot("build")

    def test_cli_dotdot_cannot_write_into_proposal(self):
        self.check_cli_dotdot("validate")

    def check_cli_mutation(self, mode):
        cli, args = self.cli_fixture(mode, report=self.root / f"{mode}-mutation.json")
        if mode == "build":
            compute = cli.derive

            def mutate(*args):
                result = compute(*args)
                (self.root / "candidate/unexpected.json").write_text("{}")
                return result
        else:
            self.module.write(self.root / "proposal", self.derive())
            compute = cli.validate

            def mutate(*args):
                result = compute(*args)
                member = self.root / "proposal/accounting.json"
                member.write_bytes(member.read_bytes() + b" ")
                return result

        name = "derive" if mode == "build" else "validate"
        with (
            redirect_stdout(io.StringIO()),
            patch.object(sys, "argv", args),
            patch.object(cli, name, mutate),
            self.assertRaises(ValueError),
        ):
            cli.main()
        report = json.loads((self.root / f"{mode}-mutation.json").read_bytes())
        self.assertFalse(report["pass"])
        if mode == "build":
            self.assertFalse((self.root / "proposal").exists())

    def test_cli_detects_new_input_member(self):
        self.check_cli_mutation("build")

    def test_cli_detects_proposal_mutation_during_recomputation(self):
        self.check_cli_mutation("validate")


if __name__ == "__main__":
    unittest.main()
