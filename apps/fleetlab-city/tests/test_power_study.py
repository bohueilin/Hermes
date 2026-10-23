"""Frozen protocol identity, complete-block estimand and recorded-event diagnostics."""

import copy
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.contracts import digest, save_json, write_bundle
from citylib.engine import run_arm
from citylib.inputs import generate_inputs
from test_engine import tiny_pack, tiny_spec


class ImplementationExists(unittest.TestCase):
    def test_study_modules_exist(self):
        for name in ("power_protocol", "power_study", "power_analysis"):
            self.assertIsNotNone(importlib.util.find_spec("citylib." + name), name)


if importlib.util.find_spec("citylib.power_protocol"):
    from citylib.power_analysis import (
        classify_interval,
        paired_t_interval,
        primary_analysis,
        project_run,
    )
    from citylib.power_protocol import arm_specs, check_resources, validate_seeds
    from citylib.power_study import validate_run

    class PowerStudyTests(unittest.TestCase):
        def test_six_resource_cells_keep_controls_and_node_identity(self):
            spec = tiny_spec()
            spec["sites"] = [
                {"id": "A", "node": "a", "ports": 8, "port_kw": 50, "power_kw": 200, "slots": 4}
            ]
            spec["candidate_sites"] = [
                dict(spec["sites"][0]),
                {**spec["sites"][0], "id": "B", "node": "b"},
            ]
            arms = arm_specs(spec)
            self.assertEqual(list(arms), ["a-200", "ab-200", "b-200", "a-400", "ab-400", "b-400"])
            for name, arm in arms.items():
                self.assertEqual(sum(s["ports"] for s in arm["sites"]), 8)
                self.assertEqual(sum(s["slots"] for s in arm["sites"]), 4)
                self.assertEqual(sum(s["power_kw"] for s in arm["sites"]), int(name.split("-")[1]))
                self.assertEqual({s["port_kw"] for s in arm["sites"]}, {50})
                self.assertEqual(arm["initial_kwh"], 30)
                self.assertEqual(
                    [s["node"] for s in arm["sites"]],
                    {"a": ["a"], "ab": ["a", "b"], "b": ["b"]}[name.split("-")[0]],
                )

        def test_duplicate_disjoint_seeds_and_resource_limits(self):
            validate_seeds([1, 2, 3, 4], list(range(10, 34)))
            for pre, evaluation in [
                ([1, 1, 3, 4], list(range(10, 34))),
                ([10, 2, 3, 4], list(range(10, 34))),
            ]:
                with self.assertRaises(ValueError):
                    validate_seeds(pre, evaluation)
            with self.assertRaises(ValueError):
                check_resources(1, 4_000_000_001)
            with self.assertRaises(ValueError):
                check_resources(2_000_000_001, 1)

        def test_primary_hand_fixture_zero_variance_and_classifications(self):
            rows = []
            for seed in range(4):
                for arm, completed in [
                    ("a-200", 50),
                    ("ab-200", 51),
                    ("b-200", 49),
                    ("a-400", 50),
                    ("ab-400", 53),
                    ("b-400", 51),
                ]:
                    rows.append(
                        {
                            "seed": seed,
                            "arm": arm,
                            "eligible": True,
                            "metrics": {"created": 100, "completed": completed},
                        }
                    )
            value, reasons = primary_analysis(rows, list(range(4)))
            self.assertFalse(reasons)
            self.assertEqual((value["mean"], value["low"], value["high"]), (2, 2, 2))
            self.assertEqual(value["classification"], "MATERIAL_POSITIVE")
            self.assertEqual(classify_interval(0.2, 0.8), "BOUNDED_SMALL")
            self.assertEqual(classify_interval(0.2, 1.2), "UNRESOLVED")
            self.assertEqual(classify_interval(-2, -1.01), "MATERIAL_NEGATIVE")
            self.assertEqual(classify_interval(-1, 1), "BOUNDED_SMALL")
            self.assertEqual(classify_interval(1, 2), "UNRESOLVED")
            value = paired_t_interval([1, 2, 3, 4])
            self.assertAlmostEqual(value["low"], 0.445739743, places=7)
            self.assertAlmostEqual(value["high"], 4.554260257, places=7)
            self.assertEqual(paired_t_interval([0, 0, 0])["classification"], "BOUNDED_SMALL")
            for bad in [
                rows[:-1],
                rows + [rows[0]],
                [{**r, "eligible": False} if i == 0 else r for i, r in enumerate(rows)],
            ]:
                value, reasons = primary_analysis(bad, list(range(4)))
                self.assertIsNone(value)
                self.assertTrue(reasons)

        def test_fresh_verifier_and_identity_reject_edits(self):
            pack, spec = tiny_pack(), tiny_spec()
            inputs = generate_inputs(pack, spec, 42, ["a", "b", "c", "d"])
            run = run_arm(pack, inputs, spec)
            identity = {"pack_digest": run["pack_digest"], "model": run["model"]}
            self.assertTrue(validate_run(run, inputs, pack, spec, identity)["valid"])
            for field in ("pack_digest", "model", "input_digest"):
                bad = copy.deepcopy(run)
                bad[field] = "wrong"
                with self.assertRaises(ValueError):
                    validate_run(bad, inputs, pack, spec, identity)
            bad = copy.deepcopy(run)
            bad["spec"]["target_kwh"] = 49
            with self.assertRaises(ValueError):
                validate_run(bad, inputs, pack, spec, identity)
            bad = copy.deepcopy(run)
            bad["metrics"] = {"completed": 9999}
            self.assertFalse(validate_run(bad, inputs, pack, spec, identity)["valid"])

        def test_event_projection_accounts_for_all_vehicle_and_request_populations(self):
            pack, spec = tiny_pack(), tiny_spec()
            spec.update(
                duration_s=1800,
                request_count=8,
                initial_kwh=18,
                target_kwh=24,
                turnaround_every=1,
                turnaround_s=30,
            )
            inputs = generate_inputs(
                pack, spec, 42, ["a", "b", "c", "d"], {n: "UNASSIGNED" for n in "abcd"}
            )
            run = run_arm(pack, inputs, spec)
            result = project_run(run, inputs)
            self.assertAlmostEqual(sum(result["state_minutes"].values()), 60)
            self.assertEqual(sum(result["request_states"].values()), 8)
            self.assertEqual(result["zones"]["UNASSIGNED"]["created"], 8)
            self.assertEqual(len(result["requests"]), 8)
            self.assertTrue(all("pickup_empty_km" in r for r in result["requests"]))
            self.assertGreater(result["sites"]["A"]["charge_starts"], 0)
            self.assertAlmostEqual(
                result["sites"]["A"]["charged_kwh"],
                sum(v["charged_kwh"] for v in run["final"]["vehicles"]),
            )
            self.assertGreaterEqual(result["sites"]["A"]["unused_capacity_kwh"], 0)
            self.assertIn("conditional", result["boarded_wait"]["population"])


if importlib.util.find_spec("citylib.power_study"):
    from unittest.mock import patch

    from citylib.power_analysis import analyze_study
    from citylib.power_protocol import find_seed_collisions, make_protocol
    from citylib.power_study import capture_study, execute_study, freeze_study

    class LifecycleTests(unittest.TestCase):
        def setUp(self):
            self.tmp = tempfile.TemporaryDirectory()
            self.addCleanup(self.tmp.cleanup)
            self.root = Path(self.tmp.name).resolve()
            self.out = self.root / "study"
            self.pack, self.spec = tiny_pack(), tiny_spec()
            self.spec["candidate_sites"] = [
                self.spec["sites"][0],
                {**self.spec["sites"][0], "id": "B", "node": "b"},
            ]
            self.spec["sites"][0].update(ports=8, slots=4, power_kw=200)
            self.pack_path = "build/fleetlab-city/packs/test"
            write_bundle(
                self.root / self.pack_path, "fleetlab.city-pack/1.0.0", {"graph.json": self.pack}
            )
            self.seeds = {"preflight": [1, 2, 3, 4], "evaluate": list(range(10, 34))}
            self.tapes = {
                s: generate_inputs(self.pack, self.spec, s, ["a", "b", "c", "d"])
                for s in sum(self.seeds.values(), [])
            }
            self.protocol = {
                "id": "sf-power-headroom-v1",
                "root": str(self.root),
                "model": self.spec["model"],
                "pack_path": self.pack_path,
                "pack_digest": digest({k: self.pack[k] for k in ("nodes", "edges", "turns")}),
                "scientific_spec": self.spec,
                "node_pool": ["a", "b", "c", "d"],
                "zones": {n: "toy" for n in "abcd"},
                "arms": arm_specs(self.spec),
                "seeds": self.seeds,
                "input_digests": {str(s): digest(t) for s, t in self.tapes.items()},
                "limits": {"estimated_route_table_bytes": 1000},
            }
            self.patcher = patch(
                "citylib.power_study.make_protocol",
                side_effect=lambda root: copy.deepcopy(self.protocol),
            )
            self.patcher.start()
            self.addCleanup(self.patcher.stop)

        def test_failed_preflight_refuses_before_loading_execution_capture(self):
            with (
                patch(
                    "citylib.power_analysis.analyze_study",
                    return_value={"analysis_status": "INCOMPLETE"},
                ),
                patch(
                    "citylib.power_study.capture_study",
                    side_effect=AssertionError("execution pack captured before preflight gate"),
                ),
                self.assertRaisesRegex(ValueError, "complete valid preflight required"),
            ):
                execute_study(self.root, self.out, "evaluate")
            self.assertFalse((self.out / "evaluate").exists())

        def test_analysis_releases_raw_evidence_before_next_capture_without_output_change(self):
            import weakref

            import citylib.power_analysis as analysis

            class ObservedDict(dict):
                pass

            freeze_study(self.root, self.out)
            execute_study(self.root, self.out, "preflight")
            baseline = analyze_study(self.root, self.out, "preflight")
            real_capture, real_arm = analysis.capture_study, analysis.capture_arm
            initial_refs, arm_refs = [], []
            capture_calls = 0

            def tracked_study(*args):
                nonlocal capture_calls
                capture_calls += 1
                if capture_calls == 2:
                    self.assertTrue(all(ref() is None for ref in initial_refs))
                    self.assertTrue(all(ref() is None for ref in arm_refs))
                protocol, tapes, pack = real_capture(*args)
                if capture_calls == 1:
                    tapes, pack = ObservedDict(tapes), ObservedDict(pack)
                    initial_refs.extend([weakref.ref(tapes), weakref.ref(pack)])
                return protocol, tapes, pack

            def tracked_arm(*args):
                self.assertTrue(all(ref() is None for ref in arm_refs))
                bundle, verification = real_arm(*args)
                bundle = ObservedDict(bundle)
                bundle["run.json"] = ObservedDict(bundle["run.json"])
                arm_refs.extend([weakref.ref(bundle), weakref.ref(bundle["run.json"])])
                return bundle, verification

            # Plain replacements avoid Mock call histories retaining captured graphs.
            with (
                patch.object(analysis, "capture_study", new=tracked_study),
                patch.object(analysis, "capture_arm", new=tracked_arm),
            ):
                measured = analyze_study(self.root, self.out, "preflight")
            self.assertEqual(capture_calls, 2)
            baseline.pop("verification_and_analysis_s")
            measured.pop("verification_and_analysis_s")
            self.assertEqual(measured, baseline)

        def test_analysis_final_recapture_still_rejects_tape_mutation(self):
            import citylib.power_analysis as analysis

            freeze_study(self.root, self.out)
            execute_study(self.root, self.out, "preflight")
            real_capture = analysis.capture_study
            calls = 0

            def mutate_before_final_capture(*args):
                nonlocal calls
                calls += 1
                if calls == 2:
                    save_json(self.out / "tapes/1-inputs.json", {"seed": 1})
                return real_capture(*args)

            with (
                patch.object(analysis, "capture_study", new=mutate_before_final_capture),
                self.assertRaisesRegex(ValueError, "input digest mismatch"),
            ):
                analyze_study(self.root, self.out, "preflight")

        def test_analysis_final_stamp_still_rejects_arm_mutation(self):
            import citylib.power_analysis as analysis

            freeze_study(self.root, self.out)
            execute_study(self.root, self.out, "preflight")
            real_stamp = analysis.artifact_stamp
            calls = {}

            def mutate_before_final_stamp(path):
                calls[path] = calls.get(path, 0) + 1
                if calls[path] == 3:
                    with (path / "run.json").open("ab") as stream:
                        stream.write(b" ")
                return real_stamp(path)

            with (
                patch.object(analysis, "artifact_stamp", new=mutate_before_final_stamp),
                self.assertRaisesRegex(ValueError, "arm mutated during analysis"),
            ):
                analyze_study(self.root, self.out, "preflight")

        def test_all_tapes_frozen_before_execution_and_no_overwrite(self):
            freeze_study(self.root, self.out)
            protocol, tapes, _ = capture_study(self.root, self.out)
            self.assertEqual(len(tapes), 28)
            self.assertEqual(tapes[1], self.tapes[1])
            with self.assertRaises(FileExistsError):
                freeze_study(self.root, self.out)
            save_json(self.out / "tapes" / "1-inputs.json", {**tapes[1], "seed": 99})
            with self.assertRaisesRegex(ValueError, "input"):
                capture_study(self.root, self.out)

        def test_refuse_protocol_tamper_foreign_inventory_and_symlink(self):
            freeze_study(self.root, self.out)
            save_json(self.out / "foreign.json", {})
            with self.assertRaisesRegex(ValueError, "foreign"):
                capture_study(self.root, self.out)
            (self.out / "foreign.json").unlink()
            self.protocol["model"] = "wrong"
            with self.assertRaisesRegex(ValueError, "identity"):
                capture_study(self.root, self.out)
            self.protocol["model"] = self.spec["model"]
            tape = self.out / "tapes" / "1-inputs.json"
            tape.rename(self.root / "original.json")
            tape.symlink_to(self.root / "original.json")
            with self.assertRaisesRegex(ValueError, "symlink"):
                capture_study(self.root, self.out)

        def test_missing_schedule_null_primary_and_evaluation_blocked(self):
            freeze_study(self.root, self.out)
            result = analyze_study(self.root, self.out, "evaluate")
            self.assertIsNone(result["primary"])
            self.assertEqual(len(result["arms"]), 144)
            self.assertEqual(result["analysis_status"], "INCOMPLETE")
            self.assertEqual(result["map_eligibility"], "BLOCKED_MAP_QUALIFICATION")
            with self.assertRaisesRegex(ValueError, "preflight"):
                execute_study(self.root, self.out, "evaluate")
            self.assertFalse((self.out / "evaluate").exists())

        def test_toy_preflight_one_pass_fresh_analysis_and_tamper_refusal(self):
            freeze_study(self.root, self.out)
            result = execute_study(self.root, self.out, "preflight")
            self.assertEqual(result["status"], "COMPLETE", result.get("failure"))
            self.assertEqual(len(result["arms"]), 24)
            analysis = analyze_study(self.root, self.out, "preflight")
            self.assertEqual(analysis["analysis_status"], "COMPLETE", analysis["reasons"])
            for seed in self.seeds["preflight"]:
                rows = [r for r in analysis["arms"] if r["seed"] == seed]
                self.assertEqual(len({r["input_digest"] for r in rows}), 1)
            with self.assertRaises(FileExistsError):
                execute_study(self.root, self.out, "preflight")
            p = self.out / "preflight" / "1-a-200" / "run.json"
            value = __import__("json").loads(p.read_text())
            value["metrics"] = {"completed": 99999}
            save_json(p, value)
            changed = analyze_study(self.root, self.out, "preflight")
            self.assertEqual(changed["analysis_status"], "INCOMPLETE")
            self.assertIsNone(changed["primary"])
            self.assertEqual(changed["arms"][0]["verification"], "INVALID")
            self.assertIsNone(changed["arms"][0]["metrics"])

        def test_execution_failure_kept_and_blocks_repeat(self):
            freeze_study(self.root, self.out)
            with patch(
                "citylib.power_study.execute_arm",
                side_effect=RuntimeError("injected execution fault"),
            ):
                result = execute_study(self.root, self.out, "preflight")
            self.assertEqual(result["status"], "INCOMPLETE")
            self.assertEqual(result["failure"]["detail"], "injected execution fault")
            self.assertTrue((self.out / "preflight" / "execution.json").exists())
            with self.assertRaises(FileExistsError):
                execute_study(self.root, self.out, "preflight")

        def test_prior_seed_collision_any_build_directory(self):
            save_json(
                self.root / "build/fleetlab-city/arbitrary-recorded/seed-1-inputs.json",
                self.tapes[1],
            )
            self.assertTrue(find_seed_collisions(self.root, [1]))
            with self.assertRaisesRegex(ValueError, "collision"):
                freeze_study(self.root, self.out)
            self.assertFalse(self.out.exists())

        def test_protocol_only_nested_seed_schedule_reserves_inspected_block(self):
            prior = self.root / "prior-study" / "protocol.json"
            for mode, seed in (("preflight", 1), ("evaluate", 10)):
                with self.subTest(mode=mode):
                    save_json(
                        prior,
                        {
                            "schema": "fleetlab.power-protocol/1.0.0",
                            "id": "sf-power-headroom-v1",
                            "seeds": {"preflight": [], "evaluate": [], mode: [seed]},
                        },
                    )
                    self.assertEqual(
                        find_seed_collisions(self.root, [seed]), ["prior-study/protocol.json"]
                    )
                    self.assertEqual(find_seed_collisions(self.root, [999]), [])
                    with self.assertRaisesRegex(ValueError, "collision"):
                        freeze_study(self.root, self.out)
                    self.assertFalse(self.out.exists())

        def test_execution_ledger_digest_cannot_disagree_with_captured_arms(self):
            freeze_study(self.root, self.out)
            execute_study(self.root, self.out, "preflight")
            ledger = self.out / "preflight" / "execution.json"
            value = __import__("json").loads(ledger.read_text())
            value["arms"][0]["run_digest"] = "forged"
            save_json(ledger, value)
            result = analyze_study(self.root, self.out, "preflight")
            self.assertEqual(result["analysis_status"], "INCOMPLETE")
            self.assertIsNone(result["primary"])

        def test_secondary_comparisons_cannot_replace_primary_and_condition_waits(self):
            freeze_study(self.root, self.out)
            execute_study(self.root, self.out, "preflight")
            result = analyze_study(self.root, self.out, "preflight")
            self.assertEqual(len(result["secondary"]), 4)
            self.assertTrue(all(r["reference"].startswith("a-") for r in result["secondary"]))
            self.assertTrue(
                all(
                    "conditional" in r["common_completed_wait"]["population"]
                    for r in result["secondary"]
                )
            )
            self.assertEqual(
                result["metric_directions"]["completion_fraction"], "higher beneficial"
            )

        def test_copied_frozen_directory_is_foreign(self):
            import shutil

            freeze_study(self.root, self.out)
            copied = self.root / "copy"
            shutil.copytree(self.out, copied)
            with self.assertRaisesRegex(ValueError, "directory"):
                capture_study(self.root, copied)

        def test_seed_block_cannot_be_frozen_twice_in_different_directories(self):
            freeze_study(self.root, self.out)
            with self.assertRaisesRegex(ValueError, "collision"):
                freeze_study(self.root, self.root / "second-study")

    class FixedSFProtocolTests(unittest.TestCase):
        def test_modified_legacy_control_refused_before_pack_loading(self):
            source = Path(__file__).resolve().parents[1] / "experiments/sf-depots-v1.json"
            data = __import__("json").loads(source.read_text())
            data["reserve_kwh"] = 11
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                save_json(root / "apps/fleetlab-city/experiments/sf-depots-v1.json", data)
                with self.assertRaisesRegex(ValueError, "legacy scientific specification"):
                    make_protocol(root)
