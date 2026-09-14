"""Parity fixtures for the FleetLab Playground, rebuilt from FleetLab and compared exactly.

The fixtures are written only by ``tools/fleet_playground/regenerate_fixtures.py``. This test
rebuilds every vector from FleetLab's own functions and requires the committed JSON to match
value for value (negative zero and int-versus-float included). It never writes a file.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

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
)


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
