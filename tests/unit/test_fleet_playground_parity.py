"""Parity fixtures for the FleetLab Playground, rebuilt from FleetLab and compared exactly.

The fixtures are written only by ``tools/fleet_playground/regenerate_fixtures.py``. This test
rebuilds every vector and legacy world from FleetLab's own functions and requires the committed
JSON to match value for value (negative zero and int-versus-float included). It never writes a
file.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

import hermes.fleet.engine as fleet_engine
import hermes.fleet.experiment as fleet_experiment
from hermes.fleet.contracts import FleetScenarioConfig
from hermes.fleet.engine import run_fleet
from hermes.fleet.invariants import check_invariants
from hermes.fleet.world import RequestEvent, WorldTape, build_tape

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
REGENERATOR_PATH = REPOSITORY_ROOT / "tools" / "fleet_playground" / "regenerate_fixtures.py"
FIXTURE_DIR = REPOSITORY_ROOT / "tests" / "fixtures" / "fleet_playground"
INSTRUMENT_VECTORS = FIXTURE_DIR / "instrument_vectors.json"

VECTOR_GROUPS = (
    "u64",
    "bootstrap_indices",
    "percentile",
    "sum_left_to_right",
    "compare",
    "bootstrap",
    "outcome",
    "guardrails",
    "recommendation",
    "end_to_end",
    "verdict",
    "invalid",
    "detail_truncation",
)

#: Legacy fixture file -> its world names, in file order (ARCHITECTURE.md section 5.1).
LEGACY_WORLDS = {
    "legacy_fleet005_seed101.json": ("baseline", "candidate"),
    "legacy_analytical.json": ("analytical",),
    "legacy_collision.json": ("collision",),
    "legacy_precheck_world_fed_axis.json": ("precheck", "paired"),
    "legacy_fl11_horizon_crash.json": ("crash",),
    "legacy_defect.json": ("defect", "defect_seed101"),
}
WORLD_KEYS = {"name", "origin", "scenario", "tape", "dispatch_mode", "expected"}
EXPECTED_KEYS = {
    "error",
    "events",
    "events_digest",
    "event_counts",
    "metrics",
    "invariant_violations",
}
INVALIDITY_REASONS = ("INVARIANT_VIOLATION", "NOT_COMPARABLE", "REPLICATION_MISMATCH")


def _canonical(value: Any) -> str:
    """Text form that keeps -0.0 distinct from 0.0 and 1.0 distinct from 1."""
    return json.dumps(value, ensure_ascii=False, sort_keys=False)


def test_python_is_the_pinned_minor_version() -> None:
    assert sys.version_info[:2] == (3, 11), (
        "FleetLab pins Python 3.11 and its builtin sum() adds left to right only on 3.11; "
        f"parity vectors must be rebuilt and checked on 3.11, not {sys.version.split()[0]}"
    )


@pytest.fixture(scope="module")
def regenerator() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "fleet_playground_regenerate_fixtures", REGENERATOR_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def rebuilt_vectors(regenerator: ModuleType) -> dict[str, Any]:
    if sys.version_info[:2] != (3, 11):
        pytest.skip("instrument vectors are defined only under Python 3.11")
    return regenerator.build_instrument_vectors()


@pytest.fixture(scope="module")
def committed_text() -> str:
    assert INSTRUMENT_VECTORS.is_file(), f"missing committed fixture {INSTRUMENT_VECTORS}"
    return INSTRUMENT_VECTORS.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def committed_vectors(committed_text: str) -> dict[str, Any]:
    return json.loads(committed_text)


def test_instrument_vectors_registered(regenerator: ModuleType) -> None:
    assert regenerator.FIXTURES["instrument_vectors.json"] is regenerator.build_instrument_vectors


def test_instrument_vector_header(
    rebuilt_vectors: dict[str, Any], committed_vectors: dict[str, Any]
) -> None:
    assert committed_vectors["format"] == "fleet-playground-instrument-vectors"
    assert committed_vectors["format_version"] == 1
    assert committed_vectors["python_version"] == "3.11"
    for key in ("format", "format_version", "python_version", "fleet_005_spec_digest"):
        assert _canonical(rebuilt_vectors[key]) == _canonical(committed_vectors[key]), key


def test_instrument_vector_groups_are_complete(
    rebuilt_vectors: dict[str, Any], committed_vectors: dict[str, Any]
) -> None:
    header = {"format", "format_version", "python_version", "fleet_005_spec_digest"}
    assert set(committed_vectors) == header | set(VECTOR_GROUPS)
    assert set(rebuilt_vectors) == set(committed_vectors)


@pytest.mark.parametrize("group", VECTOR_GROUPS)
def test_instrument_vector_group_matches_fleetlab(
    group: str, rebuilt_vectors: dict[str, Any], committed_vectors: dict[str, Any]
) -> None:
    rebuilt = rebuilt_vectors[group]
    committed = committed_vectors[group]
    assert len(rebuilt) == len(committed), f"{group}: row count differs"
    for index, (new_row, old_row) in enumerate(zip(rebuilt, committed, strict=True)):
        assert _canonical(new_row) == _canonical(old_row), f"{group}[{index}] differs"


def test_instrument_vectors_file_is_byte_identical(
    regenerator: ModuleType, rebuilt_vectors: dict[str, Any], committed_text: str
) -> None:
    assert regenerator.serialize(rebuilt_vectors) == committed_text


def test_rounding_trap_rows_separate_the_rules(
    regenerator: ModuleType, committed_vectors: dict[str, Any]
) -> None:
    """Design P-6: at R = 1020 and R = 1060 some bootstrap row must fail under round-half-up.

    A row whose sorted resample means tie at the two candidate indices passes under either
    rule, so the resample means are rebuilt with FleetLab's ``_u64`` and checked per R.
    """
    for resamples in (1_020, 1_060):
        rows = [row for row in committed_vectors["bootstrap"] if row["resamples"] == resamples]
        assert rows, f"no bootstrap row at R = {resamples}"
        low_index, high_index = regenerator.half_up_index_pair(resamples)
        separating = []
        for row in rows:
            means = regenerator.sorted_resample_means(row["deltas"], resamples, row["key"])
            if _canonical([means[low_index], means[high_index]]) != _canonical(
                [row["low"], row["high"]]
            ):
                separating.append(row["name"])
        assert separating, f"no bootstrap row at R = {resamples} separates the rounding rules"


def test_required_cases_are_present(committed_vectors: dict[str, Any]) -> None:
    bootstrap = {row["name"]: row for row in committed_vectors["bootstrap"]}
    digest = committed_vectors["fleet_005_spec_digest"]
    assert bootstrap["fleet-005-primary"]["resamples"] == 2_000
    assert bootstrap["fleet-005-primary"]["key"] == digest
    resamples = {row["resamples"] for row in committed_vectors["bootstrap"]}
    assert {1_020, 1_060, 100_000} <= resamples
    assert any(
        row["resamples"] == 100_000 and len(row["deltas"]) == 20
        for row in committed_vectors["bootstrap"]
    )
    assert any(
        row["resamples"] == 2_000 and len(row["deltas"]) == 200
        for row in committed_vectors["bootstrap"]
    )
    assert any(len(row["deltas"]) == 1 for row in committed_vectors["bootstrap"])
    assert any(
        len(row["deltas"]) > 1 and len(set(row["deltas"])) == 1
        for row in committed_vectors["bootstrap"]
    )
    assert "-0.0" in _canonical(committed_vectors["bootstrap"])
    assert [1e16, 1.0, -1e16] in [row["values"] for row in committed_vectors["sum_left_to_right"]]

    outcomes = committed_vectors["outcome"]
    assert any(row["ci_high"] == -row["margin"] for row in outcomes)
    assert any(row["ci_high"] == row["margin"] for row in outcomes)
    assert any(row["direction"] == "higher_is_better" for row in outcomes)

    guardrails = committed_vectors["guardrails"]
    assert any(
        len(row["results"]) == 1
        and row["results"][0]["mean_delta"] == row["guardrails"][0]["max_harm"]
        and row["regressions"] == []
        for row in guardrails
    )
    assert any(
        {g["metric"] for g in row["guardrails"]} - {r["metric"] for r in row["results"]}
        for row in guardrails
    )

    outcome_names = {"IMPROVED", "REGRESSED", "MIXED", "UNCHANGED", "INCONCLUSIVE"}
    rows = committed_vectors["recommendation"]
    assert {row["outcome"] for row in rows} == outcome_names
    assert {(row["outcome"], bool(row["regressions"])) for row in rows} == {
        (name, flag) for name in outcome_names for flag in (False, True)
    }

    percentile = committed_vectors["percentile"]
    assert {row["q"] for row in percentile} == {0.5, 0.9}
    lengths = {len(row["values"]) for row in percentile}
    assert 1 in lengths
    assert any(n % 2 for n in lengths if n > 1)
    assert any(n % 2 == 0 for n in lengths)
    assert any(len(set(row["values"])) < len(row["values"]) for row in percentile)

    for row in committed_vectors["end_to_end"]:
        assert len(row["baseline_runs"]) == len(row["deltas"]) == len(row["candidate_runs"])

    verdicts = {row["name"]: row for row in committed_vectors["verdict"]}
    fleet = verdicts["fleet-005"]
    assert fleet["key"] == digest
    assert fleet["record"]["guardrail_results"] and fleet["record"]["descriptives"]
    assert any(
        len(row["record"]["guardrail_results"]) >= 2
        and row["record"]["guardrail_results"][0]["metric"]
        not in row["record"]["guardrail_regressions"]
        and row["record"]["guardrail_regressions"]
        for row in committed_vectors["verdict"]
    ), "a verdict row needs a later available guardrail regressing after a first one within"

    u64_rows = committed_vectors["u64"]
    assert len(u64_rows) >= 50
    assert any(any(isinstance(part, int) for part in row["parts"]) for row in u64_rows)
    assert any(
        any(isinstance(part, str) and not part.isascii() for part in row["parts"])
        for row in u64_rows
    )


# --- invalid verdicts and detail truncation (phase 2 follow-up to section 4.1) --------------


def test_invalid_vectors_cover_every_reason_as_fleetlab_records_them(
    committed_vectors: dict[str, Any],
) -> None:
    rows = committed_vectors["invalid"]
    by_reason = {row["record"]["invalidity_reason"]: row for row in rows}
    assert sorted(by_reason) == sorted(INVALIDITY_REASONS)
    assert len(rows) == len(by_reason)
    for row in rows:
        record = row["record"]
        assert record["validity"] == "INVALID_EXPERIMENT"
        assert record["outcome"] is None
        assert record["primary"] is None
        assert record["recommendation"] == "NO_RECOMMENDATION"
        assert record["guardrail_results"] == []
        assert record["guardrail_regressions"] == []
        assert record["descriptives"] == []
        assert len(record["invalidity_detail"]) <= 300
        assert len(row["key"]) == 64
        assert row["descriptive_names"]

    mismatch = by_reason["REPLICATION_MISMATCH"]
    assert mismatch["precheck_matched"] is False
    assert mismatch["invariant_violation"] is None
    assert mismatch["baseline_runs"] == [] and mismatch["candidate_runs"] == []
    assert (
        mismatch["record"]["invalidity_detail"]
        == "identical seed produced different metrics on replay"
    )

    violation = by_reason["INVARIANT_VIOLATION"]
    assert violation["dispatch_mode"] == "defect_double_assign"
    assert violation["precheck_matched"] is True
    assert violation["invariant_violation"].startswith("seed ")
    assert violation["record"]["invalidity_detail"] == violation["invariant_violation"][:300]

    absent = by_reason["NOT_COMPARABLE"]
    primary = absent["primary"]["name"]
    assert absent["precheck_matched"] is True
    assert absent["invariant_violation"] is None
    runs = absent["baseline_runs"] + absent["candidate_runs"]
    assert len(absent["baseline_runs"]) == len(absent["candidate_runs"]) == 10
    present = [primary in run for run in runs]
    assert any(present) and not all(present), "the primary must be absent in some replication"
    assert (
        absent["record"]["invalidity_detail"]
        == f"primary metric {primary} unavailable in some replication"
    )


def test_building_invalid_vectors_restores_run_metrics(rebuilt_vectors: dict[str, Any]) -> None:
    assert rebuilt_vectors["invalid"]
    assert fleet_experiment.run_metrics is fleet_engine.run_metrics


def test_detail_truncation_vectors_are_python_slices(committed_vectors: dict[str, Any]) -> None:
    rows = committed_vectors["detail_truncation"]
    assert len(rows) >= 6
    for row in rows:
        assert row["truncated"] == row["text"][:300], row["name"]
    texts = [row["text"] for row in rows]
    assert any(text.isascii() and len(text) > 300 for text in texts)
    assert any(
        len(text) > 300 and any(0x80 <= ord(char) <= 0xFFFF for char in text[295:305])
        for text in texts
    ), "a row needs BMP non-ASCII text around code point 300"
    assert any(
        len(text) > 300 and any(ord(char) > 0xFFFF for char in text[295:305])
        for text in texts
    ), "a row needs astral characters around code point 300"

    def utf16_cut(text: str) -> str:
        return text.encode("utf-16-le")[:600].decode("utf-16-le", errors="replace")

    assert any(utf16_cut(text) != text[:300] for text in texts), (
        "some row must tell a code point cut from a UTF-16 code unit cut"
    )


# --- legacy worlds (phase 2, ARCHITECTURE.md section 5.1) ------------------------------------


@pytest.fixture(scope="module")
def rebuilt_legacy(regenerator: ModuleType) -> dict[str, dict[str, Any]]:
    if sys.version_info[:2] != (3, 11):
        pytest.skip("legacy worlds are defined only under Python 3.11")
    return {name: regenerator.FIXTURES[name]() for name in LEGACY_WORLDS}


def _legacy_text(name: str) -> str:
    path = FIXTURE_DIR / name
    assert path.is_file(), f"missing committed fixture {path}"
    return path.read_text(encoding="utf-8")


def _legacy_worlds(name: str) -> dict[str, Any]:
    return json.loads(_legacy_text(name))["worlds"]


def _scenario(world: dict[str, Any]) -> FleetScenarioConfig:
    """The world's scenario, validated from JSON text (the model is strict about tuples)."""
    return FleetScenarioConfig.model_validate_json(json.dumps(world["scenario"]))


def _tape(world: dict[str, Any]) -> WorldTape:
    tape = world["tape"]
    return WorldTape(
        seed=tape["seed"],
        demand=tuple(RequestEvent(*row) for row in tape["demand"]),
        travel_multiplier=dict(tape["travel_multiplier"]),
    )


def test_legacy_files_are_registered(regenerator: ModuleType) -> None:
    assert set(LEGACY_WORLDS) <= set(regenerator.FIXTURES)


@pytest.mark.parametrize("name", sorted(LEGACY_WORLDS))
def test_legacy_file_is_byte_identical(
    name: str, regenerator: ModuleType, rebuilt_legacy: dict[str, dict[str, Any]]
) -> None:
    assert regenerator.serialize(rebuilt_legacy[name]) == _legacy_text(name)


@pytest.mark.parametrize("name", sorted(LEGACY_WORLDS))
def test_legacy_file_shape_and_digests(name: str) -> None:
    data = json.loads(_legacy_text(name))
    assert data["format"] == "fleet-playground-legacy-worlds"
    assert data["format_version"] == 1
    assert tuple(data["worlds"]) == LEGACY_WORLDS[name]
    for world in data["worlds"].values():
        assert set(world) == WORLD_KEYS
        assert set(world["expected"]) == EXPECTED_KEYS
        assert [row[0] for row in world["tape"]["demand"]] == list(
            world["tape"]["travel_multiplier"]
        )
        expected = world["expected"]
        if expected["error"] is not None:
            assert all(expected[key] is None for key in EXPECTED_KEYS - {"error"})
            continue
        events = expected["events"]
        assert events
        for time_s, kind, entity_id in events:
            assert isinstance(time_s, int)
            assert kind.isascii() and entity_id.isascii()
        compact = json.dumps(events, separators=(",", ":"), ensure_ascii=True)
        assert hashlib.sha256(compact.encode("ascii")).hexdigest() == expected["events_digest"]
        assert list(expected["event_counts"]) == sorted(expected["event_counts"])
        assert expected["event_counts"] == dict(Counter(kind for _, kind, _ in events))
        # Only the seeded dispatcher defect can make FleetLab's invariants fire on engine output.
        assert (expected["invariant_violations"] != []) == (
            world["dispatch_mode"] == "defect_double_assign"
        )


def test_legacy_fleet005_arms_share_the_declared_tape() -> None:
    worlds = _legacy_worlds("legacy_fleet005_seed101.json")
    baseline, candidate = worlds["baseline"], worlds["candidate"]
    assert baseline["tape"] == candidate["tape"]
    assert baseline["tape"]["seed"] == 101
    assert baseline["scenario"]["service_duration_s"] == 1800
    assert candidate["scenario"]["service_duration_s"] == 2250
    assert baseline["expected"]["metrics"] != candidate["expected"]["metrics"]


def test_legacy_analytical_world_is_the_analytical_fixture_test_world() -> None:
    from tests.unit import test_fleet_analytical_fixture as analytical

    world = _legacy_worlds("legacy_analytical.json")["analytical"]
    scenario = analytical.small_scenario(**analytical._SCENARIO)
    assert world["scenario"] == scenario.model_dump(mode="json")
    tape = analytical._hand_written_tape()
    assert world["tape"] == {
        "seed": tape.seed,
        "demand": [[e.request_id, e.time_s, e.origin, e.destination] for e in tape.demand],
        "travel_multiplier": dict(tape.travel_multiplier),
    }
    metrics = world["expected"]["metrics"]
    assert metrics["wait.p50_s"] == 120.0
    assert metrics["wait.p90_s"] == 616.0
    assert metrics["fleet.utilization_fraction"] == 2160 / 4000
    assert metrics["depot.queue_p90_s"] == 0.0


def test_legacy_collision_world_proves_both_string_order_collisions(
    regenerator: ModuleType,
) -> None:
    world = _legacy_worlds("legacy_collision.json")["collision"]
    scenario = _scenario(world)
    tape = _tape(world)
    assert scenario.vehicle_count == 12 and len(scenario.zones) == 2
    assert scenario.service_bays == 1
    log = run_fleet(scenario, tape)
    assert [list(event) for event in log.events] == world["expected"]["events"]
    assert regenerator.collisions_in_log(scenario, tape, log) == {
        "dispatch_tie_broken_by_string_order",
        "same_second_bay_retries_in_string_order",
    }


def test_legacy_precheck_worlds_differ_only_in_their_tape() -> None:
    worlds = _legacy_worlds("legacy_precheck_world_fed_axis.json")
    precheck, paired = worlds["precheck"], worlds["paired"]
    assert precheck["scenario"] == paired["scenario"]
    assert precheck["scenario"]["horizon_s"] == 3600
    scenario = _scenario(precheck)
    assert _tape(precheck) == build_tape(scenario, 101)
    assert _tape(paired) == build_tape(scenario.model_copy(update={"horizon_s": 1800}), 101)
    assert len(precheck["tape"]["demand"]) > len(paired["tape"]["demand"])
    assert all(row[1] < 1800 for row in paired["tape"]["demand"])
    assert precheck["expected"]["metrics"] != paired["expected"]["metrics"]


def test_legacy_fl11_world_crashes_with_arrivals_past_the_arm_horizon() -> None:
    world = _legacy_worlds("legacy_fl11_horizon_crash.json")["crash"]
    assert world["expected"]["error"] == "ValueError"
    assert world["scenario"]["horizon_s"] == 1800
    assert any(row[1] > 1800 for row in world["tape"]["demand"])
    scenario = _scenario(world)
    with pytest.raises(ValueError, match="not in list"):
        run_fleet(scenario, _tape(world))


def test_legacy_defect_worlds_fire_invariant_two() -> None:
    worlds = _legacy_worlds("legacy_defect.json")
    defect, seeded = worlds["defect"], worlds["defect_seed101"]
    assert defect["dispatch_mode"] == seeded["dispatch_mode"] == "defect_double_assign"
    # One car: r1 is assigned at 0 and dropped at 0 + 600 + 600 = 1200; the defect assigns r2
    # to the same car at 700, and 700 < 1200.
    assert defect["expected"]["invariant_violations"] == [
        "I2: vehicle v-0 overlaps r1 and r2 (700 < 1200)"
    ]
    log = run_fleet(_scenario(defect), _tape(defect), dispatch_mode="defect_double_assign")
    assert [request.pickup_time_s for request in log.requests.values()] == [600, 1300]
    # Nearest dispatch on the same tape waits for r1, so nothing overlaps.
    assert check_invariants(run_fleet(_scenario(defect), _tape(defect))) == []
    # The invalid-verdict vector's INVARIANT_VIOLATION detail is this world's first violation.
    vectors = json.loads(INSTRUMENT_VECTORS.read_text(encoding="utf-8"))
    row = next(row for row in vectors["invalid"] if row["name"] == "invariant-violation")
    violations = seeded["expected"]["invariant_violations"]
    assert row["invariant_violation"] == f"seed 101: {violations[0]}"
