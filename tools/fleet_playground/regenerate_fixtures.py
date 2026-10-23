"""Explicitly invoked regenerator for the FleetLab Playground parity fixtures.

Every number in a fixture comes from calling FleetLab's own functions; nothing here
re-implements a verdict rule. Default mode rebuilds every registered payload and compares
it with the committed file (exit 1 on any difference). ``--write --reason TEXT`` rewrites
the files. The script uses no randomness and no clock, and its output order is stable.

Run from the repository root:

    PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python \
        tools/fleet_playground/regenerate_fixtures.py [--write --reason TEXT]
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import math
import sys
from collections import Counter
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import hermes.fleet.experiment as fleet_experiment
from hermes.fleet.cli import fleet_005_spec
from hermes.fleet.contracts import (
    ExperimentOutcome,
    ExperimentSpec,
    FleetScenarioConfig,
    Guardrail,
    MetricComparison,
    PrimaryMetric,
)
from hermes.fleet.engine import (
    RequestState,
    RunLog,
    _Request,
    _travel_s,
    _Vehicle,
    run_fleet,
    run_metrics,
)
from hermes.fleet.experiment import (
    _bootstrap_ci,
    _compare,
    _guardrail_regressions,
    _resolve_outcome,
    apply_axis,
    descriptive_metrics_for,
    resolve_recommendation,
    run_experiment,
)
from hermes.fleet.invariants import check_invariants
from hermes.fleet.world import RequestEvent, WorldTape, _u64, build_tape

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = REPOSITORY_ROOT / "tests" / "fixtures" / "fleet_playground"
REQUIRED_PYTHON = (3, 11)

Payload = dict[str, Any]


def _hex_key(name: str) -> str:
    """A stable 64-character hex key for a synthetic vector (an input, not a result)."""
    return hashlib.sha256(f"fleet-playground-vector|{name}".encode()).hexdigest()


def _spread_deltas(name: str, count: int, center: float, half_width_centi: int) -> list[float]:
    """Deterministic input deltas: ``center`` plus a keyed offset in hundredths."""
    span = 2 * half_width_centi + 1
    return [
        center + ((_u64("fleet-playground-vector", name, "delta", k) % span) - half_width_centi)
        / 100
        for k in range(count)
    ]


# --- FLEET-005 ---------------------------------------------------------------------------


def _experiment(spec: ExperimentSpec) -> dict[str, Any]:
    """A spec's in-memory record and per-seed metric maps, all from FleetLab itself."""
    record = run_experiment(spec)
    if record.primary is None:
        raise RuntimeError(f"{spec.experiment_id} produced no primary comparison")
    baseline_scenario = apply_axis(spec, spec.baseline_value)
    candidate_scenario = apply_axis(spec, spec.candidate_value)
    baseline_runs: list[dict[str, float]] = []
    candidate_runs: list[dict[str, float]] = []
    for seed in spec.seeds:
        tape = build_tape(spec.scenario, seed)
        baseline_runs.append(run_metrics(run_fleet(baseline_scenario, tape)))
        candidate_runs.append(run_metrics(run_fleet(candidate_scenario, tape)))
    recomputed = _compare(spec.primary_metric.name, "PRIMARY", baseline_runs, candidate_runs)
    expected = record.primary.model_copy(update={"ci_low": None, "ci_high": None})
    if recomputed != expected:
        raise RuntimeError(
            f"{spec.experiment_id}: per-seed runs do not reproduce the record's primary"
        )
    return {
        "spec": spec,
        "record": record,
        "digest": spec.spec_digest(),
        "deltas": list(record.primary.paired_deltas),
        "baseline_runs": baseline_runs,
        "candidate_runs": candidate_runs,
    }


def _fleet_005() -> dict[str, Any]:
    """FLEET-005's spec, in-memory record, and per-seed metric maps from FleetLab itself."""
    return _experiment(fleet_005_spec())


def _guardrail_order_spec() -> ExperimentSpec:
    """FLEET-005 with three available guardrails where only the later two regress.

    The first guardrail tolerates any harm, so a port that evaluated only the first available
    guardrail, or stopped at the first regression, would disagree with FleetLab.
    """
    spec = fleet_005_spec()
    lower = "lower_is_better"
    return ExperimentSpec.model_validate(
        {
            **spec.model_dump(),
            "experiment_id": "fleet-005-guardrail-order",
            "guardrails": (
                Guardrail(metric="unserved.fraction", max_harm=0.5, direction=lower),
                Guardrail(metric="depot.queue_p90_s", max_harm=0.0, direction=lower),
                Guardrail(metric="wait.p50_s", max_harm=0.0, direction=lower),
            ),
        }
    )


# --- groups ------------------------------------------------------------------------------


def _u64_vectors(fleet_digest: str) -> list[Payload]:
    parts_list: list[list[Any]] = []
    for i in range(3):
        for j in range(4):
            parts_list.append([fleet_digest, "bootstrap", i, j])
    for i, j in ((1999, 9), (99999, 19), (1019, 0), (1059, 199)):
        parts_list.append([fleet_digest, "bootstrap", i, j])
    for i in range(6):
        parts_list.append(["key", "bootstrap", 0, i])
    parts_list += [
        [""],
        ["", ""],
        ["|"],
        ["a|b"],
        ["a", "b"],
        [0],
        [-1],
        [1],
        [2**31 - 1],
        [2**32],
        [2**53 - 1],
        [-(2**53 - 1)],
        ["bay_teaching_map", "gap", "SF", 0],
        ["bay_teaching_map", "thin", "PEN", 17],
        ["bay_teaching_map", "dest", "SJ", 123456],
        [1001, "traffic", "H2", "SF>PEN", 74],
        [1001, "ride", "r-EB-42"],
        ["fleet_005_longer_turnaround", "arrival", "downtown", 0],
        [101, "travel", "r-0-0"],
        ["José"],
        ["区域", "gap", 3],
        ["café", "über", "naïve"],
        ["\U0001f697", 7],
        ["Δt", "λ", 1000],
        ["line\nbreak", "tab\tstop"],
        ["quote\"back\\slash"],
        ["\u00a0nbsp", "\u2028sep"],
        ["x" * 55],
        ["x" * 56],
        ["x" * 63],
        ["x" * 64],
        ["x" * 65],
        ["y" * 200, 5],
    ]
    return [
        {"parts": parts, "value": str(_u64(*parts))}
        for parts in parts_list
    ]


def _bootstrap_index_pair(resamples: int) -> tuple[int, int]:
    """The (low, high) index expression written inline inside ``_bootstrap_ci``.

    FleetLab exposes no function for it, so this is the one copy in the regenerator (an
    exception recorded in ARCHITECTURE.md section 12). ``_bootstrap_vectors`` ties it to
    ``_bootstrap_ci`` at every bootstrap row and raises when they disagree.
    """
    return (
        max(0, int(round(0.025 * resamples)) - 1),
        min(resamples - 1, int(round(0.975 * resamples))),
    )


def half_up_index_pair(resamples: int) -> tuple[int, int]:
    """The index pair a round-half-up port (``Math.round``) would pick. Verification only."""
    return (
        max(0, math.floor(0.025 * resamples + 0.5) - 1),
        min(resamples - 1, math.floor(0.975 * resamples + 0.5)),
    )


def sorted_resample_means(deltas: list[float], resamples: int, key: str) -> list[float]:
    """The sorted resample means ``_bootstrap_ci`` selects from, rebuilt with FleetLab's ``_u64``.

    Verification only: no fixture value is taken from here. It lets the regenerator and the
    pytest parity test check which rows tell the two rounding rules apart.
    """
    n = len(deltas)
    means: list[float] = []
    for i in range(resamples):
        total = 0.0
        for j in range(n):
            total += deltas[_u64(key, "bootstrap", i, j) % n]
        means.append(total / n)
    means.sort()
    return means


def _bootstrap_indices_vectors() -> list[Payload]:
    """Index pairs for resample counts, including exact-half cases.

    The index expression is inline inside ``_bootstrap_ci``; these rows evaluate the copy in
    ``_bootstrap_index_pair``, which ``_bootstrap_vectors`` checks against ``_bootstrap_ci``
    itself at every bootstrap row (R = 1000, 1020, 1060, 2000 and 100000).
    """
    # Selection only: exact halves where round-half-to-even and round-half-up disagree
    # are the cross-language trap, so those are preferred; agreeing halves are sampled too.
    disagreeing: list[int] = []
    agreeing: list[int] = []
    for resamples in range(1_000, 100_001):
        is_trap = False
        is_half = False
        for x in (0.025 * resamples, 0.975 * resamples):
            if x - int(x) == 0.5:
                is_half = True
                is_trap = is_trap or round(x) != int(x) + 1
        if is_trap:
            disagreeing.append(resamples)
        elif is_half:
            agreeing.append(resamples)
    chosen = sorted(
        {1_000, 1_001, 1_020, 1_060, 1_999, 2_000, 2_001, 9_999, 10_000, 99_999, 100_000}
        | set(disagreeing[:20])
        | set(disagreeing[-8:])
        | set(agreeing[:6])
    )
    rows = []
    for resamples in chosen:
        low_index, high_index = _bootstrap_index_pair(resamples)
        rows.append({"resamples": resamples, "low_index": low_index, "high_index": high_index})
    return rows


_PERCENTILE_SCENARIO = FleetScenarioConfig(
    name="parity_percentile_probe",
    horizon_s=600,
    zones=("a", "b"),
    travel_time_s={"a->b": 60, "b->a": 60},
    vehicle_count=1,
    demand_per_zone_per_hour=1,
    max_wait_s=60,
    trips_between_service=1,
    service_bays=1,
    service_duration_s=60,
    in_zone_pickup_s=30,
    travel_sigma=0.0,
)


def _run_metrics_for_waits(waits: list[int]) -> dict[str, float]:
    """A minimal run log whose completed requests have exactly the given waits."""
    log = RunLog(scenario=_PERCENTILE_SCENARIO)
    log.vehicles["v-0"] = _Vehicle(vehicle_id="v-0", zone="a")
    for index, wait in enumerate(waits):
        request_id = f"r-{index}"
        log.requests[request_id] = _Request(
            request_id=request_id,
            time_s=0,
            origin="a",
            destination="b",
            state=RequestState.COMPLETED,
            assigned_vehicle_id="v-0",
            pickup_time_s=wait,
        )
    return run_metrics(log)


def _percentile_vectors() -> list[Payload]:
    inputs = [
        [300],
        [0, 1],
        [120, 120, 740],
        [100, 200, 300, 400],
        [740, 120, 300, 50, 999],
        [500, 500, 500, 500],
        [7, 7, 7, 9, 9, 11],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 3600],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [86_400, 1, 43_200, 2, 21_600, 3, 10_800],
    ]
    rows = []
    for values in inputs:
        metrics = _run_metrics_for_waits(values)
        rows.append({"values": values, "q": 0.5, "value": metrics["wait.p50_s"]})
        rows.append({"values": values, "q": 0.9, "value": metrics["wait.p90_s"]})
    return rows


def _sum_vectors(fleet_deltas: list[float]) -> list[Payload]:
    inputs: list[list[float]] = [
        [1e16, 1.0, -1e16],
        [1e16, 1.0, 1.0, -1e16],
        [3.0, 1e100, -1e100],
        [0.1] * 10,
        [0.1, 0.2, 0.3],
        [-0.0],
        [-0.0, -0.0],
        [1.0],
        [2.5, -2.5],
        [1e-300, 1e-300, -1e-300],
        fleet_deltas,
    ]
    return [{"values": values, "value": sum(values)} for values in inputs]


def _comparison_json(result: MetricComparison | None) -> Payload | None:
    if result is None:
        return None
    return result.model_dump(mode="json", exclude={"ci_low", "ci_high"})


def _compare_vectors(fleet: dict[str, Any]) -> list[Payload]:
    def runs(metric: str, values: list[float]) -> list[dict[str, float]]:
        return [{metric: value} for value in values]

    cases: list[tuple[str, str, list[dict[str, float]], list[dict[str, float]]]] = [
        ("m", "PRIMARY", runs("m", [1.0]), runs("m", [2.0])),
        ("m", "PRIMARY", runs("m", [10.0, 20.0, 30.0]), runs("m", [12.0, 19.0, 45.0])),
        (
            "m",
            "GUARDRAIL",
            runs("m", [0.1, 0.2, 0.3, 0.4]),
            runs("m", [0.15, 0.2, 0.25, 0.7]),
        ),
        ("m", "DESCRIPTIVE", runs("m", [0.0, 5.0]), runs("m", [-0.0, 5.0])),
        ("m", "PRIMARY", runs("m", [1e16, 1.0, -1e16]), runs("m", [0.0, 0.0, 0.0])),
        ("m", "PRIMARY", runs("m", [7.5] * 6), runs("m", [7.5] * 6)),
        (
            "m",
            "PRIMARY",
            [{"m": 1.0}, {"m": 2.0}],
            [{"m": 1.5}, {"other": 2.0}],
        ),
        (
            "m",
            "GUARDRAIL",
            [{"other": 1.0}, {"m": 2.0}],
            [{"m": 1.5}, {"m": 2.0}],
        ),
        (
            "wait.p90_s",
            "PRIMARY",
            [{"wait.p90_s": run["wait.p90_s"]} for run in fleet["baseline_runs"]],
            [{"wait.p90_s": run["wait.p90_s"]} for run in fleet["candidate_runs"]],
        ),
        (
            "unserved.fraction",
            "GUARDRAIL",
            [{"unserved.fraction": run["unserved.fraction"]} for run in fleet["baseline_runs"]],
            [{"unserved.fraction": run["unserved.fraction"]} for run in fleet["candidate_runs"]],
        ),
    ]
    rows = []
    for metric, role, baseline_runs, candidate_runs in cases:
        rows.append(
            {
                "metric": metric,
                "role": role,
                "baseline_runs": baseline_runs,
                "candidate_runs": candidate_runs,
                "result": _comparison_json(_compare(metric, role, baseline_runs, candidate_runs)),
            }
        )
    return rows


def _bootstrap_cases(fleet: dict[str, Any]) -> list[tuple[str, list[float], int, str]]:
    digest = fleet["digest"]
    deltas = fleet["deltas"]
    return [
        ("fleet-005-primary", deltas, 2_000, digest),
        ("fleet-005-r1020", deltas, 1_020, digest),
        ("fleet-005-r1060", deltas, 1_060, digest),
        ("fleet-005-r1000", deltas, 1_000, digest),
        (
            "r100000-n20",
            _spread_deltas("r100000-n20", 20, 0.0, 5_000),
            100_000,
            _hex_key("r100000-n20"),
        ),
        (
            "n200-r2000",
            _spread_deltas("n200-r2000", 200, 12.5, 9_000),
            2_000,
            _hex_key("n200-r2000"),
        ),
        ("single-delta", [42.5], 2_000, _hex_key("single-delta")),
        ("all-equal", [7.25] * 10, 2_000, _hex_key("all-equal")),
        ("all-negative-zero", [-0.0] * 10, 2_000, _hex_key("all-negative-zero")),
        (
            "mixed-negative-zero",
            [-0.0, 1.5, -2.25, 0.0, -0.0, 3.0, -1.0, 0.5, -0.0, 2.0],
            2_000,
            _hex_key("mixed-negative-zero"),
        ),
        ("compensated-sum", [1e16, 1.0, -1e16], 2_000, _hex_key("compensated-sum")),
        # At R = 1060 the FLEET-005 means at indices 25 and 26 are tied; these deltas are not,
        # so this row separates round-half-to-even from round-half-up at R = 1060.
        (
            "higher-r1060",
            _spread_deltas("higher", 15, 45.0, 800),
            1_060,
            _hex_key("higher"),
        ),
    ]


def _bootstrap_vectors(fleet: dict[str, Any]) -> list[Payload]:
    rows = []
    for name, deltas, resamples, key in _bootstrap_cases(fleet):
        low, high = _bootstrap_ci(list(deltas), resamples, key)
        means = sorted_resample_means(list(deltas), resamples, key)
        low_index, high_index = _bootstrap_index_pair(resamples)
        if (means[low_index], means[high_index]) != (low, high):
            raise RuntimeError(
                f"bootstrap vector {name}: the copied index expression no longer matches "
                "_bootstrap_ci; update _bootstrap_index_pair from experiment.py"
            )
        rows.append(
            {
                "name": name,
                "deltas": list(deltas),
                "resamples": resamples,
                "key": key,
                "low": low,
                "high": high,
            }
        )
    record = fleet["record"]
    first = rows[0]
    if (first["low"], first["high"]) != (record.primary.ci_low, record.primary.ci_high):
        raise RuntimeError("FLEET-005 bootstrap vector disagrees with run_experiment")
    return rows


def _primary_metric(direction: str, margin: float) -> PrimaryMetric:
    if direction == "lower_is_better":
        name, unit = "wait.p90_s", "s"
    else:
        name, unit = "requests.served", "count"
    return PrimaryMetric(name=name, unit=unit, direction=direction, equivalence_margin=margin)


def _with_interval(low: float, high: float) -> MetricComparison:
    return MetricComparison(
        metric="probe",
        role="PRIMARY",
        baseline_mean=0.0,
        candidate_mean=0.0,
        paired_deltas=(0.0,),
        mean_delta=0.0,
        median_delta=0.0,
        ci_low=low,
        ci_high=high,
    )


def _outcome_vectors(fleet: dict[str, Any]) -> list[Payload]:
    record = fleet["record"]
    lower, higher = "lower_is_better", "higher_is_better"
    cases: list[tuple[float, float, str, float]] = [
        (-31.0, -30.0, lower, 30.0),
        (-31.0, -30.000001, lower, 30.0),
        (-30.0, -10.0, lower, 30.0),
        (10.0, 30.0, lower, 30.0),
        (30.0, 31.0, lower, 30.0),
        (30.000001, 40.0, lower, 30.0),
        (-30.0, 30.0, lower, 30.0),
        (-10.0, 10.0, lower, 30.0),
        (-5.0, 50.0, lower, 30.0),
        (-50.0, 50.0, lower, 30.0),
        (0.0, 0.0, lower, 30.0),
        (-0.0, 0.0, lower, 30.0),
        (-0.0, -0.0, higher, 30.0),
        (30.5, 40.0, higher, 30.0),
        (-40.0, -30.5, higher, 30.0),
        (-30.0, 30.0, higher, 30.0),
        (30.0, 40.0, higher, 30.0),
        (-40.0, -30.0, higher, 30.0),
        (-10.0, 30.0, higher, 30.0),
        (-(0.1 + 0.2), 0.1, lower, 0.3),
        (-0.3, 0.1, lower, 0.3),
        (-0.02, 0.02, higher, 0.02),
        (record.primary.ci_low, record.primary.ci_high, lower, 30.0),
    ]
    rows = []
    for low, high, direction, margin in cases:
        outcome = _resolve_outcome(_with_interval(low, high), _primary_metric(direction, margin))
        rows.append(
            {
                "ci_low": low,
                "ci_high": high,
                "direction": direction,
                "margin": margin,
                "outcome": outcome.value,
            }
        )
    if rows[-1]["outcome"] != record.outcome.value:
        raise RuntimeError("FLEET-005 outcome vector disagrees with run_experiment")
    return rows


def _guardrail_result(metric: str, mean_delta: float) -> MetricComparison:
    return MetricComparison(
        metric=metric,
        role="GUARDRAIL",
        baseline_mean=0.0,
        candidate_mean=mean_delta,
        paired_deltas=(mean_delta,),
        mean_delta=mean_delta,
        median_delta=mean_delta,
    )


def _regressions(
    results: list[Payload], guardrails: list[Payload]
) -> list[str]:
    return _guardrail_regressions(
        [_guardrail_result(item["metric"], item["mean_delta"]) for item in results],
        tuple(
            Guardrail(metric=g["metric"], max_harm=g["max_harm"], direction=g["direction"])
            for g in guardrails
        ),
    )


def _guardrail_cases(fleet: dict[str, Any]) -> list[tuple[list[Payload], list[Payload]]]:
    lower, higher = "lower_is_better", "higher_is_better"
    unserved = "unserved.fraction"
    served = "requests.served"
    fleet_result = next(
        r for r in fleet["record"].guardrail_results if r.metric == unserved
    )

    def res(metric: str, mean_delta: float) -> Payload:
        return {"metric": metric, "mean_delta": mean_delta}

    def rail(metric: str, max_harm: float, direction: str) -> Payload:
        return {"metric": metric, "max_harm": max_harm, "direction": direction}

    return [
        ([res(unserved, 0.02)], [rail(unserved, 0.02, lower)]),
        ([res(unserved, 0.020000000000000004)], [rail(unserved, 0.02, lower)]),
        ([res(unserved, 0.01 + 0.01)], [rail(unserved, 0.02, lower)]),
        ([res(unserved, -0.5)], [rail(unserved, 0.02, lower)]),
        ([res(served, -3.0)], [rail(served, 2.0, higher)]),
        ([res(served, -2.0)], [rail(served, 2.0, higher)]),
        ([res(served, 5.0)], [rail(served, 0.0, higher)]),
        ([res(served, -0.0)], [rail(served, 0.0, higher)]),
        ([res(unserved, 0.0)], [rail(unserved, 0.0, lower)]),
        ([res(unserved, 1e-300)], [rail(unserved, 0.0, lower)]),
        ([], [rail(unserved, 0.02, lower)]),
        ([res(served, -9.0)], [rail(unserved, 0.02, lower), rail(served, 1.0, higher)]),
        (
            [res(served, -9.0), res(unserved, 0.5)],
            [rail(unserved, 0.02, lower), rail(served, 1.0, higher)],
        ),
        (
            [res(unserved, 0.5), res(served, -9.0)],
            [rail(served, 1.0, higher), rail(unserved, 0.02, lower)],
        ),
        (
            [res(unserved, 0.05), res(unserved, 0.05)],
            [rail(unserved, 0.02, lower), rail(unserved, 0.1, lower)],
        ),
        (
            [res(unserved, 0.05), res(unserved, 0.05)],
            [rail(unserved, 0.02, lower), rail(unserved, 0.01, lower)],
        ),
        ([res(unserved, fleet_result.mean_delta)], [rail(unserved, 0.02, lower)]),
    ]


def _guardrail_vectors(fleet: dict[str, Any]) -> list[Payload]:
    rows = []
    for results, guardrails in _guardrail_cases(fleet):
        rows.append(
            {
                "results": results,
                "guardrails": guardrails,
                "regressions": _regressions(results, guardrails),
            }
        )
    if tuple(rows[-1]["regressions"]) != fleet["record"].guardrail_regressions:
        raise RuntimeError("FLEET-005 guardrail vector disagrees with run_experiment")
    return rows


def _recommendation_vectors() -> list[Payload]:
    rows = []
    for outcome in ExperimentOutcome:
        for regressions in ((), ("unserved.fraction",), ("unserved.fraction", "requests.served")):
            rows.append(
                {
                    "outcome": outcome.value,
                    "regressions": list(regressions),
                    "recommendation": resolve_recommendation(outcome, regressions).value,
                }
            )
    return rows


def _guardrail_values(
    name: str, metric: str, mean_delta: float, count: int
) -> tuple[list[float], list[float]]:
    """Baseline and candidate values whose ``_compare`` mean delta is exactly ``mean_delta``.

    The candidate is ``[x, 0.0, ...]`` over a zero baseline; ``x`` starts at
    ``mean_delta * count`` and steps by one double until FleetLab's ``_compare`` returns
    ``mean_delta`` itself, so the number is still FleetLab's, never assumed.
    """
    baseline = [{metric: 0.0} for _ in range(count)]
    start = mean_delta * count
    candidates = [start]
    up = down = start
    for _ in range(8):
        up, down = math.nextafter(up, math.inf), math.nextafter(down, -math.inf)
        candidates += [up, down]
    for x in candidates:
        values = [x] + [0.0] * (count - 1)
        result = _compare(metric, "GUARDRAIL", baseline, [{metric: v} for v in values])
        if result is not None and repr(result.mean_delta) == repr(mean_delta):
            return [0.0] * count, values
    raise RuntimeError(f"end-to-end vector {name}: no runs reproduce {metric} {mean_delta!r}")


def _end_to_end_row(
    name: str,
    deltas: list[float],
    resamples: int,
    key: str,
    direction: str,
    margin: float,
    guardrails: list[Payload],
    guardrail_results: list[Payload],
    guardrail_runs: dict[str, tuple[list[float], list[float]]] | None = None,
) -> Payload:
    baseline_runs: list[dict[str, float]] = [{"primary": 0.0} for _ in deltas]
    candidate_runs: list[dict[str, float]] = [{"primary": delta} for delta in deltas]
    for item in guardrail_results:
        metric = item["metric"]
        if guardrail_runs is not None and metric in guardrail_runs:
            baseline_values, candidate_values = guardrail_runs[metric]
        else:
            baseline_values, candidate_values = _guardrail_values(
                name, metric, item["mean_delta"], len(deltas)
            )
        for run, value in zip(baseline_runs, baseline_values, strict=True):
            run[metric] = value
        for run, value in zip(candidate_runs, candidate_values, strict=True):
            run[metric] = value
    primary = _compare("primary", "PRIMARY", baseline_runs, candidate_runs)
    if primary is None or list(primary.paired_deltas) != list(deltas):
        raise RuntimeError(f"end-to-end vector {name}: deltas did not survive _compare")
    for item in guardrail_results:
        result = _compare(item["metric"], "GUARDRAIL", baseline_runs, candidate_runs)
        if result is None or repr(result.mean_delta) != repr(item["mean_delta"]):
            raise RuntimeError(f"end-to-end vector {name}: runs do not give {item['metric']}")
    low, high = _bootstrap_ci(list(primary.paired_deltas), resamples, key)
    primary = primary.model_copy(update={"ci_low": low, "ci_high": high})
    outcome = _resolve_outcome(primary, _primary_metric(direction, margin))
    regressions = _regressions(guardrail_results, guardrails)
    recommendation = resolve_recommendation(outcome, tuple(regressions))
    return {
        "name": name,
        "deltas": list(deltas),
        "resamples": resamples,
        "key": key,
        "direction": direction,
        "margin": margin,
        "guardrails": guardrails,
        "guardrail_results": guardrail_results,
        "baseline_runs": baseline_runs,
        "candidate_runs": candidate_runs,
        "low": low,
        "high": high,
        "outcome": outcome.value,
        "regressions": regressions,
        "recommendation": recommendation.value,
    }


def _end_to_end_vectors(fleet: dict[str, Any]) -> list[Payload]:
    lower, higher = "lower_is_better", "higher_is_better"
    unserved_rail = {"metric": "unserved.fraction", "max_harm": 0.02, "direction": lower}
    record = fleet["record"]
    fleet_guardrail_results = [
        {"metric": r.metric, "mean_delta": r.mean_delta} for r in record.guardrail_results
    ]
    fleet_guardrail_runs = {
        r.metric: (
            [run[r.metric] for run in fleet["baseline_runs"]],
            [run[r.metric] for run in fleet["candidate_runs"]],
        )
        for r in record.guardrail_results
    }

    def within(mean_delta: float) -> list[Payload]:
        return [{"metric": "unserved.fraction", "mean_delta": mean_delta}]

    # (name, deltas, R, key, direction, margin, guardrails, results, expected outcome)
    cases: list[tuple[str, list[float], int, str, str, float, list, list, str]] = [
        (
            "fleet-005",
            fleet["deltas"], 2_000, fleet["digest"], lower, 30.0,
            [unserved_rail], fleet_guardrail_results, record.outcome.value,
        ),
        (
            "fleet-005-r1020",
            fleet["deltas"], 1_020, fleet["digest"], lower, 30.0,
            [unserved_rail], fleet_guardrail_results, "REGRESSED",
        ),
        (
            "fleet-005-r1060",
            fleet["deltas"], 1_060, fleet["digest"], lower, 30.0,
            [unserved_rail], fleet_guardrail_results, "REGRESSED",
        ),
        (
            "improved-guardrail-within",
            _spread_deltas("improved", 20, -60.0, 1_000), 2_000, _hex_key("improved"),
            lower, 30.0, [unserved_rail], within(0.02), "IMPROVED",
        ),
        (
            "improved-guardrail-regressed",
            _spread_deltas("improved", 20, -60.0, 1_000), 2_000, _hex_key("improved"),
            lower, 30.0, [unserved_rail], within(0.03), "IMPROVED",
        ),
        (
            "improved-guardrail-absent",
            _spread_deltas("improved", 20, -60.0, 1_000), 2_000, _hex_key("improved"),
            lower, 30.0, [unserved_rail], [], "IMPROVED",
        ),
        (
            "unchanged",
            _spread_deltas("unchanged", 30, 0.0, 1_000), 2_000, _hex_key("unchanged"),
            lower, 30.0, [unserved_rail], within(0.0), "UNCHANGED",
        ),
        (
            "inconclusive",
            _spread_deltas("inconclusive", 12, 25.0, 6_000), 2_000, _hex_key("inconclusive"),
            lower, 30.0, [unserved_rail], within(-0.01), "INCONCLUSIVE",
        ),
        (
            "higher-is-better-improved",
            _spread_deltas("higher", 15, 45.0, 800), 1_060, _hex_key("higher"),
            higher, 30.0, [], [], "IMPROVED",
        ),
        (
            "higher-is-better-regressed",
            _spread_deltas("higher-down", 15, -45.0, 800), 1_020, _hex_key("higher-down"),
            higher, 30.0, [], [], "REGRESSED",
        ),
        (
            "single-delta",
            [-45.0], 2_000, _hex_key("e2e-single"), lower, 30.0, [], [], "IMPROVED",
        ),
        (
            "negative-zero-unchanged",
            [-0.0] * 10, 2_000, _hex_key("e2e-negative-zero"), higher, 0.5, [], [], "UNCHANGED",
        ),
    ]
    rows = []
    for name, deltas, resamples, key, direction, margin, rails, results, expected in cases:
        row = _end_to_end_row(
            name, deltas, resamples, key, direction, margin, rails, results,
            fleet_guardrail_runs if name.startswith("fleet-005") else None,
        )
        if row["outcome"] != expected:
            raise RuntimeError(
                f"end-to-end vector {name}: expected {expected}, FleetLab gave {row['outcome']}"
            )
        rows.append(row)
    first = rows[0]
    if (
        (first["low"], first["high"]) != (record.primary.ci_low, record.primary.ci_high)
        or first["recommendation"] != record.recommendation.value
        or tuple(first["regressions"]) != record.guardrail_regressions
    ):
        raise RuntimeError("FLEET-005 end-to-end vector disagrees with run_experiment")
    return rows


#: The ``DecisionRecord`` fields a playground verdict must reproduce exactly.
VERDICT_RECORD_FIELDS = (
    "validity",
    "outcome",
    "recommendation",
    "primary",
    "guardrail_results",
    "guardrail_regressions",
    "descriptives",
)


def _verdict_row(name: str, experiment: dict[str, Any]) -> Payload:
    """Per-seed runs and the record ``run_experiment`` assembled from them."""
    spec = experiment["spec"]
    record = experiment["record"].model_dump(mode="json")
    return {
        "name": name,
        "primary": {
            "name": spec.primary_metric.name,
            "direction": spec.primary_metric.direction,
            "equivalence_margin": spec.primary_metric.equivalence_margin,
        },
        "guardrails": [rail.model_dump(mode="json") for rail in spec.guardrails],
        "descriptive_names": list(descriptive_metrics_for(spec)),
        "resamples": spec.bootstrap_resamples,
        "key": experiment["digest"],
        "baseline_runs": experiment["baseline_runs"],
        "candidate_runs": experiment["candidate_runs"],
        "record": {field: record[field] for field in VERDICT_RECORD_FIELDS},
    }


def _verdict_vectors(fleet: dict[str, Any]) -> list[Payload]:
    ordered = _experiment(_guardrail_order_spec())
    rows = [_verdict_row("fleet-005", fleet), _verdict_row("guardrail-order", ordered)]
    record = rows[1]["record"]
    available = [result["metric"] for result in record["guardrail_results"]]
    regressed = record["guardrail_regressions"]
    if len(available) < 2 or available[0] in regressed or not regressed:
        raise RuntimeError(
            "guardrail-order verdict no longer has a later available guardrail regressing "
            f"after a first one within its limit: available {available}, regressed {regressed}"
        )
    return rows


# --- invalid verdicts ----------------------------------------------------------------------

#: The ``DecisionRecord`` fields an invalid playground verdict must reproduce exactly.
INVALID_RECORD_FIELDS = (
    "validity",
    "invalidity_reason",
    "invalidity_detail",
    *VERDICT_RECORD_FIELDS[1:],
)

#: A small two-zone world (the shape of the unit tests' probe scenario) so every invalid
#: record runs in well under a second.
_INVALID_SCENARIO: dict[str, Any] = {
    "name": "parity_invalid_probe",
    "horizon_s": 1800,
    "zones": ("a", "b"),
    "travel_time_s": {"a->b": 300, "b->a": 300},
    "vehicle_count": 4,
    "demand_per_zone_per_hour": 12,
    "max_wait_s": 600,
    "trips_between_service": 3,
    "service_bays": 1,
    "service_duration_s": 300,
    "in_zone_pickup_s": 120,
    "travel_sigma": 0.2,
}


def _invalid_spec(
    experiment_id: str, primary_name: str, **scenario_overrides: Any
) -> ExperimentSpec:
    lower = "lower_is_better"
    return ExperimentSpec(
        experiment_id=experiment_id,
        decision_owner="AUTHOR_SELF_TEST",
        question="Does a longer service duration degrade the primary metric beyond the margin?",
        scenario=FleetScenarioConfig(**{**_INVALID_SCENARIO, **scenario_overrides}),
        variation_axis="parameter:service_duration_s",
        baseline_value=300,
        candidate_value=450,
        primary_metric=PrimaryMetric(
            name=primary_name, unit="s", direction=lower, equivalence_margin=30.0
        ),
        guardrails=(Guardrail(metric="unserved.fraction", max_harm=0.02, direction=lower),),
        seeds=tuple(range(101, 111)),
    )


@contextlib.contextmanager
def _second_precheck_metrics_changed() -> Iterator[None]:
    """Make the second ``run_metrics`` call inside ``hermes.fleet.experiment`` differ.

    ``run_experiment`` calls ``run_metrics`` twice for its determinism precheck before any
    other call, so the second call is the replay. Only this regenerator patches it, only for
    the duration of the block, and the original is restored in ``finally``.
    """
    original = fleet_experiment.run_metrics
    calls = 0

    def replay_differs(log: RunLog) -> dict[str, float]:
        nonlocal calls
        calls += 1
        metrics = original(log)
        if calls == 2:
            metrics = {**metrics, "requests.total": metrics["requests.total"] + 1.0}
        return metrics

    fleet_experiment.run_metrics = replay_differs  # type: ignore[assignment]
    try:
        yield
    finally:
        fleet_experiment.run_metrics = original  # type: ignore[assignment]


def _runs_until_failure(spec: ExperimentSpec, dispatch_mode: str) -> Payload:
    """The per-seed runs ``run_experiment`` gathered before it stopped, in its own order.

    This follows ``run_experiment``'s run order (precheck, then each seed's baseline and
    candidate arm) only to collect the inputs ``computeVerdict`` receives; the record itself
    always comes from ``run_experiment``, and ``_invalid_row`` checks that both stop at the
    same point. ``run_metrics`` is looked up on the experiment module, so a precheck patch
    applies here exactly as it does there.
    """
    baseline_scenario = apply_axis(spec, spec.baseline_value)
    candidate_scenario = apply_axis(spec, spec.candidate_value)
    probe = build_tape(baseline_scenario, spec.seeds[0])
    first = fleet_experiment.run_metrics(
        run_fleet(baseline_scenario, probe, dispatch_mode=dispatch_mode)
    )
    second = fleet_experiment.run_metrics(
        run_fleet(baseline_scenario, probe, dispatch_mode=dispatch_mode)
    )
    baseline_runs: list[dict[str, float]] = []
    candidate_runs: list[dict[str, float]] = []
    gathered: Payload = {
        "precheck_matched": first == second,
        "invariant_violation": None,
        "baseline_runs": baseline_runs,
        "candidate_runs": candidate_runs,
    }
    if not gathered["precheck_matched"]:
        return gathered
    for seed in spec.seeds:
        tape = build_tape(spec.scenario, seed)
        for scenario, runs in (
            (baseline_scenario, baseline_runs),
            (candidate_scenario, candidate_runs),
        ):
            log = run_fleet(scenario, tape, dispatch_mode=dispatch_mode)
            violations = check_invariants(log)
            if violations:
                gathered["invariant_violation"] = f"seed {seed}: {violations[0]}"
                return gathered
            runs.append(fleet_experiment.run_metrics(log))
    return gathered


def _invalid_row(
    name: str,
    spec: ExperimentSpec,
    expected_reason: str,
    *,
    dispatch_mode: str = "nearest",
    replay_differs: bool = False,
) -> Payload:
    """One invalid ``run_experiment`` record beside the inputs ``computeVerdict`` needs."""

    def patched() -> contextlib.AbstractContextManager[None]:
        if replay_differs:
            return _second_precheck_metrics_changed()
        return contextlib.nullcontext()

    with patched():
        record = run_experiment(spec, dispatch_mode=dispatch_mode).model_dump(mode="json")
    with patched():
        gathered = _runs_until_failure(spec, dispatch_mode)
    if fleet_experiment.run_metrics is not run_metrics:
        raise RuntimeError("run_metrics was not restored on hermes.fleet.experiment")

    if record["validity"] != "INVALID_EXPERIMENT" or record["invalidity_reason"] != expected_reason:
        raise RuntimeError(
            f"invalid vector {name}: expected {expected_reason}, FleetLab gave "
            f"{record['validity']} {record['invalidity_reason']}"
        )
    if not gathered["precheck_matched"]:
        stopped_at = "REPLICATION_MISMATCH"
    elif gathered["invariant_violation"] is not None:
        stopped_at = "INVARIANT_VIOLATION"
        if record["invalidity_detail"] != gathered["invariant_violation"][:300]:
            raise RuntimeError(f"invalid vector {name}: violation text differs from the record")
    elif (
        _compare(
            spec.primary_metric.name,
            "PRIMARY",
            gathered["baseline_runs"],
            gathered["candidate_runs"],
        )
        is None
    ):
        stopped_at = "NOT_COMPARABLE"
    else:
        stopped_at = "VALID"
    if stopped_at != expected_reason:
        raise RuntimeError(
            f"invalid vector {name}: gathered runs stop at {stopped_at}, "
            f"run_experiment stopped at {expected_reason}"
        )
    return {
        "name": name,
        "dispatch_mode": dispatch_mode,
        "primary": {
            "name": spec.primary_metric.name,
            "direction": spec.primary_metric.direction,
            "equivalence_margin": spec.primary_metric.equivalence_margin,
        },
        "guardrails": [rail.model_dump(mode="json") for rail in spec.guardrails],
        "descriptive_names": list(descriptive_metrics_for(spec)),
        "resamples": spec.bootstrap_resamples,
        "key": spec.spec_digest(),
        "precheck_matched": gathered["precheck_matched"],
        "invariant_violation": gathered["invariant_violation"],
        "baseline_runs": gathered["baseline_runs"],
        "candidate_runs": gathered["candidate_runs"],
        "record": {field: record[field] for field in INVALID_RECORD_FIELDS},
    }


def _invalid_vectors() -> list[Payload]:
    """``run_experiment`` records for each invalidity reason (ARCHITECTURE.md section 4.1)."""
    rows = [
        # The seeded dispatcher defect assigns a busy vehicle once; invariant I2 catches it.
        _invalid_row(
            "invariant-violation",
            _invalid_spec("parity-invariant-violation", "wait.p90_s"),
            "INVARIANT_VIOLATION",
            dispatch_mode="defect_double_assign",
        ),
        # Three cars, a service after every second trip and very little demand: at seed 102 no car
        # ever starts a service, so depot.queue_p90_s is absent there and present elsewhere.
        _invalid_row(
            "not-comparable",
            _invalid_spec(
                "parity-not-comparable",
                "depot.queue_p90_s",
                trips_between_service=2,
                vehicle_count=3,
                demand_per_zone_per_hour=2,
                travel_sigma=1.0,
                max_wait_s=300,
            ),
            "NOT_COMPARABLE",
        ),
        # The regenerator makes FleetLab's second precheck run return a different metric map.
        _invalid_row(
            "replication-mismatch",
            _invalid_spec("parity-replication-mismatch", "wait.p90_s"),
            "REPLICATION_MISMATCH",
            replay_differs=True,
        ),
    ]
    runs = rows[1]["baseline_runs"] + rows[1]["candidate_runs"]
    present = ["depot.queue_p90_s" in run for run in runs]
    if all(present) or not any(present):
        raise RuntimeError(
            "not-comparable vector: the primary must be absent in some replication and "
            f"present in another, got {present}"
        )
    return rows


def _detail_truncation_vectors() -> list[Payload]:
    """Strings beside Python's ``text[:300]``, the cut ``run_experiment`` applies to details.

    Python slices by code point; a port that slices UTF-16 code units splits astral
    characters, so astral text sits on both sides of code point 300.
    """
    car = "\U0001f697"
    cases = [
        ("ascii-301", "x" * 301),
        ("ascii-long-detail", "seed 101: I2: " + "vehicle v-10 overlaps r-1-0 and r-1-1; " * 12),
        ("ascii-exactly-300", "y" * 300),
        ("bmp-at-299-and-300", "a" * 299 + "éé" + "b" * 10),
        ("bmp-cjk-350", "車両" * 175),
        ("bmp-mixed-near-300", "a" * 297 + "Δt λ " + "z" * 20),
        ("astral-last-kept", "a" * 299 + car + "tail"),
        ("astral-first-dropped", "a" * 300 + car),
        ("astral-straddles-300", "a" * 298 + car * 4),
        ("astral-only-301", car * 301),
        ("astral-exactly-300", "seed 7: " + car * 292),
        ("short-non-ascii", "café " + car),
    ]
    return [{"name": name, "text": text, "truncated": text[:300]} for name, text in cases]


def build_instrument_vectors() -> Payload:
    """Every instrument vector group of ARCHITECTURE.md section 4.1, from FleetLab."""
    fleet = _fleet_005()
    return {
        "format": "fleet-playground-instrument-vectors",
        "format_version": 1,
        "python_version": f"{sys.version_info[0]}.{sys.version_info[1]}",
        "fleet_005_spec_digest": fleet["digest"],
        "u64": _u64_vectors(fleet["digest"]),
        "bootstrap_indices": _bootstrap_indices_vectors(),
        "percentile": _percentile_vectors(),
        "sum_left_to_right": _sum_vectors(fleet["deltas"]),
        "compare": _compare_vectors(fleet),
        "bootstrap": _bootstrap_vectors(fleet),
        "outcome": _outcome_vectors(fleet),
        "guardrails": _guardrail_vectors(fleet),
        "recommendation": _recommendation_vectors(),
        "end_to_end": _end_to_end_vectors(fleet),
        "verdict": _verdict_vectors(fleet),
        "invalid": _invalid_vectors(),
        "detail_truncation": _detail_truncation_vectors(),
    }


# --- legacy worlds (ARCHITECTURE.md section 5.1) ---------------------------------------------

LEGACY_FORMAT = "fleet-playground-legacy-worlds"


def _tape_json(tape: WorldTape) -> Payload:
    return {
        "seed": tape.seed,
        "demand": [
            [event.request_id, event.time_s, event.origin, event.destination]
            for event in tape.demand
        ],
        "travel_multiplier": dict(tape.travel_multiplier),
    }


def events_digest(events: list[list[Any]]) -> str:
    """SHA-256 of the compact ASCII JSON of the event log (JavaScript ``JSON.stringify`` bytes)."""
    for entry in events:
        for part in entry:
            if isinstance(part, str) and not part.isascii():
                raise RuntimeError(f"event {entry} is not ASCII; the digest would differ in JS")
    text = json.dumps(events, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(text.encode("ascii")).hexdigest()


def _legacy_world(
    name: str,
    origin: str,
    scenario: FleetScenarioConfig,
    tape: WorldTape,
    dispatch_mode: str = "nearest",
) -> tuple[Payload, RunLog | None]:
    """One named world: FleetLab's run of ``scenario`` over ``tape`` and what it produced."""
    log: RunLog | None
    try:
        log = run_fleet(scenario, tape, dispatch_mode=dispatch_mode)
    except Exception as exc:  # the crash world records FleetLab's exception type
        log = None
        expected: Payload = {
            "error": type(exc).__name__,
            "events": None,
            "events_digest": None,
            "event_counts": None,
            "metrics": None,
            "invariant_violations": None,
        }
    else:
        events = [[time_s, kind, entity_id] for time_s, kind, entity_id in log.events]
        counts = Counter(kind for _, kind, _ in log.events)
        expected = {
            "error": None,
            "events": events,
            "events_digest": events_digest(events),
            "event_counts": {kind: counts[kind] for kind in sorted(counts)},
            "metrics": run_metrics(log),
            "invariant_violations": check_invariants(log),
        }
    world = {
        "name": name,
        "origin": origin,
        "scenario": scenario.model_dump(mode="json"),
        "tape": _tape_json(tape),
        "dispatch_mode": dispatch_mode,
        "expected": expected,
    }
    return world, log


def _legacy_file(worlds: dict[str, Payload]) -> Payload:
    return {"format": LEGACY_FORMAT, "format_version": 1, "worlds": worlds}


def _require_clean(world: Payload) -> None:
    expected = world["expected"]
    if expected["error"] is not None or expected["invariant_violations"]:
        raise RuntimeError(
            f"legacy world {world['name']}: expected a clean run, got error "
            f"{expected['error']} and violations {expected['invariant_violations']}"
        )


def build_legacy_fleet005_seed101() -> Payload:
    """FLEET-005's baseline and candidate arms over the declared tape at seed 101."""
    spec = fleet_005_spec()
    tape = build_tape(spec.scenario, 101)
    worlds = {}
    for arm, value in (("baseline", spec.baseline_value), ("candidate", spec.candidate_value)):
        world, _ = _legacy_world(
            f"fleet005-seed101-{arm}",
            f"FLEET-005 {arm} arm from apply_axis; tape from the declared scenario at seed 101",
            apply_axis(spec, value),
            tape,
        )
        _require_clean(world)
        worlds[arm] = world
    return _legacy_file(worlds)


#: The hand-computed world of ``tests/unit/test_fleet_analytical_fixture.py``: that test's
#: overrides applied to its ``small_scenario`` defaults, and its three hand-written requests.
_ANALYTICAL_SCENARIO: dict[str, Any] = {
    "name": "fleet_probe",
    "horizon_s": 4000,
    "zones": ("a", "b"),
    "travel_time_s": {"a->b": 600, "b->a": 600},
    "vehicle_count": 1,
    "demand_per_zone_per_hour": 12,
    "max_wait_s": 1000,
    "trips_between_service": 2,
    "service_bays": 1,
    "service_duration_s": 500,
    "in_zone_pickup_s": 120,
    "travel_sigma": 0.0,
}
_ANALYTICAL_DEMAND = (
    ("r1", 0, "a", "b"),
    ("r2", 100, "b", "a"),
    ("r3", 2000, "a", "b"),
)


def build_legacy_analytical() -> Payload:
    """The analytical reduction; its hand-derived numbers are asserted, not copied from a run."""
    demand = tuple(
        RequestEvent(request_id=rid, time_s=t, origin=o, destination=d)
        for rid, t, o, d in _ANALYTICAL_DEMAND
    )
    tape = WorldTape(
        seed=0, demand=demand, travel_multiplier={e.request_id: 1.0 for e in demand}
    )
    world, _ = _legacy_world(
        "analytical",
        "the hand-written three-request world of the FleetLab analytical fixture test",
        FleetScenarioConfig(**_ANALYTICAL_SCENARIO),
        tape,
    )
    _require_clean(world)
    metrics = world["expected"]["metrics"]
    hand_derived = {
        "wait.p50_s": 120.0,
        "wait.p90_s": 616.0,
        "fleet.utilization_fraction": 2160 / 4000,
        "depot.queue_p90_s": 0.0,
    }
    if any(metrics[name] != value for name, value in hand_derived.items()):
        raise RuntimeError(f"analytical world no longer matches the hand derivation: {metrics}")
    return _legacy_file({"analytical": world})


# The collision world. Twelve cars in two zones are placed round-robin, so zone "a" holds
# v-0, v-2, v-4, v-6, v-8, v-10 and zone "b" holds v-1, v-3, v-5, v-7, v-9, v-11. FleetLab
# breaks travel-time ties with the vehicle id as a string, where "v-10" < "v-11" < "v-2".
# Every trip sends its car to the single service bay (trips_between_service 1).
#
# At t = 0 six requests arrive, each dispatched on arrival (pickup in the same zone, 60 s x
# multiplier; trip 600 s x multiplier):
#   r-00 a->b x1.0  idle in a: v-0 v-2 v-4 v-6 v-8 v-10, all 60 s  -> v-0,  drop-off 660
#   r-01 b->a x1.0  idle in b: v-1 ... v-11, all 60 s              -> v-1,  drop-off 660
#   r-02 a->b x1.5  idle in a: v-10 v-2 v-4 v-6 v-8, all 90 s      -> v-10 (not v-2), 990
#   r-03 b->a x1.5  idle in b: v-11 v-3 v-5 v-7 v-9, all 90 s      -> v-11 (not v-3), 990
#   r-04 a->b x1.0  idle in a: v-2 v-4 v-6 v-8                     -> v-2,  drop-off 660
#   r-05 b->a x1.0  idle in b: v-3 v-5 v-7 v-9                     -> v-3,  drop-off 660
# Collision (a) is r-02 and r-03: string order of ids picks v-10 and v-11.
#
# Service (300 s, one bay):
#   660   v-0, v-1, v-2, v-3 enter the queue in that order; v-0's try wins the bay (to 960).
#   960   v-0 completes; queued v-1, v-2, v-3 retry at 960 in string order; v-1 starts.
#   990   v-10 and v-11 enter the queue behind v-2 and v-3.
#   1260  v-1 completes; queued v-10, v-11, v-2, v-3 all retry at 1260 in string order and
#         v-10 starts, although v-2 is numerically first and queued 330 s earlier.
# Collision (b) is the retry at 1260. At 960 three cars also retry in one second, but there
# string, numeric and queue order agree, so that retry alone would not tell them apart.
# Two late requests at 1500 reuse serviced cars, with idle cars in both zones at unequal
# travel; r-06's car returns to the queue at 2160, the second in which v-2's service ends.
_COLLISION_SCENARIO: dict[str, Any] = {
    "name": "parity_collision_probe",
    "horizon_s": 7200,
    "zones": ("a", "b"),
    "travel_time_s": {"a->b": 600, "b->a": 600},
    "vehicle_count": 12,
    "demand_per_zone_per_hour": 1,
    "max_wait_s": 3600,
    "trips_between_service": 1,
    "service_bays": 1,
    "service_duration_s": 300,
    "in_zone_pickup_s": 60,
    "travel_sigma": 0.0,
}
_COLLISION_DEMAND = (
    ("r-00", 0, "a", "b", 1.0),
    ("r-01", 0, "b", "a", 1.0),
    ("r-02", 0, "a", "b", 1.5),
    ("r-03", 0, "b", "a", 1.5),
    ("r-04", 0, "a", "b", 1.0),
    ("r-05", 0, "b", "a", 1.0),
    ("r-06", 1500, "a", "b", 1.0),
    ("r-07", 1500, "b", "a", 1.25),
)


def _vehicle_number(vehicle_id: str) -> int:
    return int(vehicle_id.removeprefix("v-"))


def collisions_in_log(scenario: FleetScenarioConfig, tape: WorldTape, log: RunLog) -> set[str]:
    """Which string-order collisions FleetLab's log proves, replaying car state from events.

    The replay tracks each car's zone and state from the event log alone (assignment, pickup,
    drop-off, queue entry, service start and completion) and checks that it reproduces every
    dispatch choice FleetLab made, so the collision claims rest on FleetLab's own output.
    Service retries are heap entries, not log entries, so a same-second retry is proven by
    two or more cars still queued when a service completes, and by which of them FleetLab's
    log shows starting at that second.
    """
    count = len(scenario.zones)
    zones = {f"v-{i}": scenario.zones[i % count] for i in range(scenario.vehicle_count)}
    state = dict.fromkeys(zones, "IDLE")
    queued_at: dict[str, int] = {}
    found: set[str] = set()
    for index, (now_s, kind, entity_id) in enumerate(log.events):
        if kind.startswith("SERVICE"):
            vehicle_id = entity_id
        else:
            request = log.requests[entity_id]
            vehicle_id = request.assigned_vehicle_id or ""
        if kind == "REQUEST_ASSIGNED":
            multiplier = tape.travel_multiplier[entity_id]

            def travel(car: str, origin: str = request.origin, m: float = multiplier) -> int:
                return _travel_s(scenario, zones[car], origin, m)

            idle = [car for car in zones if state[car] == "IDLE"]
            if min(idle, key=lambda car: (travel(car), car)) != vehicle_id:
                raise RuntimeError(f"collision replay disagrees with FleetLab at {entity_id}")
            if any(
                travel(car) == travel(vehicle_id)
                and _vehicle_number(car) < _vehicle_number(vehicle_id)
                for car in idle
            ):
                found.add("dispatch_tie_broken_by_string_order")
            state[vehicle_id] = "BUSY"
        elif kind == "PICKUP_COMPLETED":
            zones[vehicle_id] = request.origin
        elif kind == "TRIP_COMPLETED":
            zones[vehicle_id] = request.destination
            state[vehicle_id] = "IDLE"
        elif kind == "SERVICE_QUEUE_ENTERED":
            state[vehicle_id] = "QUEUED"
            queued_at[vehicle_id] = now_s
        elif kind == "SERVICE_STARTED":
            state[vehicle_id] = "IN_SERVICE"
        elif kind == "SERVICE_COMPLETED":
            state[vehicle_id] = "IDLE"
            queued = sorted(car for car in zones if state[car] == "QUEUED")
            if len(queued) < 2:
                continue
            started = next(
                (e for t, k, e in log.events[index + 1 :] if k == "SERVICE_STARTED" and t == now_s),
                None,
            )
            if started != queued[0]:
                raise RuntimeError(
                    f"collision replay: {started} started at {now_s}, not {queued[0]}"
                )
            numeric_first = min(queued, key=_vehicle_number)
            fifo_first = min(queued, key=lambda car: (queued_at[car], _vehicle_number(car)))
            if started not in (numeric_first, fifo_first):
                found.add("same_second_bay_retries_in_string_order")
    return found


def build_legacy_collision() -> Payload:
    """A hand-written world where string-ordered ids decide a dispatch tie and a bay retry."""
    demand = tuple(
        RequestEvent(request_id=rid, time_s=t, origin=o, destination=d)
        for rid, t, o, d, _ in _COLLISION_DEMAND
    )
    tape = WorldTape(
        seed=0,
        demand=demand,
        travel_multiplier={rid: multiplier for rid, _, _, _, multiplier in _COLLISION_DEMAND},
    )
    scenario = FleetScenarioConfig(**_COLLISION_SCENARIO)
    world, log = _legacy_world(
        "collision",
        "hand-written tape: twelve cars in two zones, one service bay, string-ordered ids",
        scenario,
        tape,
    )
    _require_clean(world)
    assert log is not None
    found = collisions_in_log(scenario, tape, log)
    required = {"dispatch_tie_broken_by_string_order", "same_second_bay_retries_in_string_order"}
    if found != required:
        raise RuntimeError(f"collision world proves {sorted(found)}, needs {sorted(required)}")
    return _legacy_file({"collision": world})


def _horizon_axis_spec(
    declared_horizon_s: int, baseline_s: int, candidate_s: int
) -> ExperimentSpec:
    """FLEET-005 with a declared horizon and a ``parameter:horizon_s`` axis (design FL-1, FL-11)."""
    spec = fleet_005_spec()
    return ExperimentSpec.model_validate(
        {
            **spec.model_dump(),
            "experiment_id": "fleet-005-horizon-axis",
            "scenario": {**spec.scenario.model_dump(), "horizon_s": declared_horizon_s},
            "variation_axis": "parameter:horizon_s",
            "baseline_value": baseline_s,
            "candidate_value": candidate_s,
        }
    )


def build_legacy_precheck_world_fed_axis() -> Payload:
    """Design P-3: the precheck world and the paired world differ for a world-fed axis."""
    spec = _horizon_axis_spec(1800, 3600, 1800)
    baseline_arm = apply_axis(spec, spec.baseline_value)
    seed = spec.seeds[0]
    precheck_tape = build_tape(baseline_arm, seed)  # run_experiment's precheck probe
    paired_tape = build_tape(spec.scenario, seed)  # run_experiment's paired loop
    if len(precheck_tape.demand) <= len(paired_tape.demand):
        raise RuntimeError("the precheck world should hold more requests than the paired world")
    precheck, _ = _legacy_world(
        "precheck",
        "baseline arm (horizon_s 3600) over build_tape(baseline arm, 101), the precheck world",
        baseline_arm,
        precheck_tape,
    )
    paired, _ = _legacy_world(
        "paired",
        "baseline arm (horizon_s 3600) over build_tape(declared scenario, horizon_s 1800, 101)",
        baseline_arm,
        paired_tape,
    )
    _require_clean(precheck)
    _require_clean(paired)
    return _legacy_file({"precheck": precheck, "paired": paired})


def build_legacy_fl11_horizon_crash() -> Payload:
    """Design FL-11: an arm horizon below the declared one crashes FleetLab's engine."""
    spec = _horizon_axis_spec(3600, 3600, 1800)
    world, _ = _legacy_world(
        "crash",
        "arm horizon_s 1800 over build_tape(declared scenario, horizon_s 3600, 101)",
        apply_axis(spec, spec.candidate_value),
        build_tape(spec.scenario, spec.seeds[0]),
    )
    if world["expected"]["error"] != "ValueError":
        raise RuntimeError(f"FL-11 world: expected ValueError, got {world['expected']['error']}")
    return _legacy_file({"crash": world})


# The seeded-defect world. One car, v-0, starts in zone a; every multiplier is 1.0.
#   0     r1 (b->a) created; v-0 is idle in a: pickup 0 + 600 (a->b) = 600, drop-off
#         600 + 600 = 1200.
#   600   r1's pickup sets v-0 ON_TRIP and moves it to r1's origin, b.
#   700   r2 (a->b) created. No car is idle, and the defect takes the smallest-id busy car
#         once: v-0, still on r1, in b. Pickup 700 + 600 (b->a) = 1300, drop-off 1900.
#   1200  r1 drops off. r1 spans [0, 1200] and r2 starts at 700 on the same car, so invariant
#         I2 reports the overlap (700 < 1200).
# Without the zone update at pickup r2's pickup would be 700 + 120 = 820, and without the
# defect r2 would wait for r1 and be assigned at 1200.
_DEFECT_DEMAND = (
    ("r1", 0, "b", "a"),
    ("r2", 700, "a", "b"),
)
_DEFECT_VIOLATION = "I2: vehicle v-0 overlaps r1 and r2 (700 < 1200)"


def build_legacy_defect() -> Payload:
    """The seeded dispatcher defect, the only engine path where FleetLab's invariants fire."""
    demand = tuple(
        RequestEvent(request_id=rid, time_s=t, origin=o, destination=d)
        for rid, t, o, d in _DEFECT_DEMAND
    )
    tape = WorldTape(
        seed=0, demand=demand, travel_multiplier={e.request_id: 1.0 for e in demand}
    )
    defect, log = _legacy_world(
        "defect",
        "hand-written tape: one car, the seeded double-assign defect takes it mid-trip",
        FleetScenarioConfig(**_ANALYTICAL_SCENARIO),
        tape,
        dispatch_mode="defect_double_assign",
    )
    assert log is not None
    pickups = [request.pickup_time_s for request in log.requests.values()]
    if defect["expected"]["invariant_violations"] != [_DEFECT_VIOLATION] or pickups != [600, 1300]:
        raise RuntimeError(
            f"defect world no longer matches the hand derivation: pickups {pickups}, "
            f"violations {defect['expected']['invariant_violations']}"
        )
    scenario = FleetScenarioConfig(**_INVALID_SCENARIO)
    seeded, _ = _legacy_world(
        "defect-seed101",
        "the invalid-verdict probe scenario over build_tape(scenario, 101), seeded defect",
        scenario,
        build_tape(scenario, 101),
        dispatch_mode="defect_double_assign",
    )
    violations = seeded["expected"]["invariant_violations"]
    if (
        seeded["expected"]["error"] is not None
        or not violations
        or not all(text.startswith("I2: ") for text in violations)
    ):
        raise RuntimeError(
            f"defect-seed101 world: expected I2 violations, got {seeded['expected']}"
        )
    return _legacy_file({"defect": defect, "defect_seed101": seeded})


# --- reference panels (ARCHITECTURE.md section 5.2) ----------------------------------------

REFERENCE_PANELS_FORMAT = "fleet-playground-reference-panels"

#: Descriptive metrics whose values a panel never shows (design sections 5.7 and 7.2, FL-2).
SUPPRESSED_METRICS = (
    "fleet.utilization_fraction",
    "business_proxy.served_trips",
    "business_proxy.unserved_demand",
)

#: The exploratory two-zone probe, exactly as design Appendix A.9 writes it.
PROBE_SPEC: Payload = {
    "schema_version": "0.1",
    "experiment_id": "bay-area-bay-outage-probe",
    "decision_owner": "AUTHOR_SELF_TEST",
    "question": (
        "If the shared depot loses half its service bays, does rider wait p90 across "
        "San Francisco and San Jose degrade beyond the declared margin?"
    ),
    "scenario": {
        "schema_version": "0.1",
        "name": "bay_area_two_zone_probe",
        "label": "synthetic_fleet_scenario_not_calibrated_to_any_real_operation",
        "horizon_s": 21600,
        "zones": ["san_francisco", "san_jose"],
        "travel_time_s": {"san_francisco->san_jose": 3000, "san_jose->san_francisco": 3000},
        "vehicle_count": 25,
        "demand_per_zone_per_hour": 18,
        "max_wait_s": 1200,
        "trips_between_service": 6,
        "service_bays": 4,
        "service_duration_s": 1800,
        "in_zone_pickup_s": 300,
        "travel_sigma": 0.25,
    },
    "variation_axis": "parameter:service_bays",
    "baseline_value": 4.0,
    "candidate_value": 2.0,
    "primary_metric": {
        "name": "wait.p90_s",
        "unit": "s",
        "direction": "lower_is_better",
        "equivalence_margin": 60.0,
    },
    "guardrails": [
        {"metric": "unserved.fraction", "max_harm": 0.02, "direction": "lower_is_better"}
    ],
    "seeds": [301, 302, 303, 304, 305, 306, 307, 308, 309, 310],
    "bootstrap_resamples": 2000,
    "calibration_state": "SYNTHETIC_UNCALIBRATED",
}
#: The spec digest prefix design Appendix A.9 records for the probe.
PROBE_SPEC_DIGEST_PREFIX = "e8f30fec61b7"


def probe_spec() -> ExperimentSpec:
    """The Appendix A.9 spec, validated from JSON as FleetLab reads a spec file."""
    spec = ExperimentSpec.model_validate_json(json.dumps(PROBE_SPEC))
    digest = spec.spec_digest()
    if not digest.startswith(PROBE_SPEC_DIGEST_PREFIX):
        raise RuntimeError(
            f"probe spec digest {digest[:12]} is not the design's {PROBE_SPEC_DIGEST_PREFIX}"
        )
    return spec


def _reference_panel(spec: ExperimentSpec) -> Payload:
    """Design section 7.2 projection of ``run_experiment(spec)``: values unmodified, no digests."""
    record = run_experiment(spec)
    declared = {spec.primary_metric.name, *(rail.metric for rail in spec.guardrails)}
    suppressed = [row.metric for row in record.descriptives if row.metric in SUPPRESSED_METRICS]
    if sorted(suppressed) != sorted(SUPPRESSED_METRICS) or declared & set(SUPPRESSED_METRICS):
        raise RuntimeError(
            f"{spec.experiment_id}: suppressed metrics must be descriptive rows only: {suppressed}"
        )
    results = {row.metric: row for row in record.guardrail_results}
    primary = record.primary
    reason = record.invalidity_reason
    return {
        "experiment_id": record.experiment_id,
        "question": record.question,
        "variation_axis": record.variation_axis,
        "baseline_value": record.baseline_value,
        "candidate_value": record.candidate_value,
        "replications": record.replications,
        "validity": record.validity.value,
        "invalidity_reason": None if reason is None else reason.value,
        "outcome": None if record.outcome is None else record.outcome.value,
        "recommendation": record.recommendation.value,
        "primary": None
        if primary is None
        else {
            "metric": primary.metric,
            "direction": spec.primary_metric.direction,
            "equivalence_margin": spec.primary_metric.equivalence_margin,
            "baseline_mean": primary.baseline_mean,
            "candidate_mean": primary.candidate_mean,
            "mean_delta": primary.mean_delta,
            "median_delta": primary.median_delta,
            "ci_low": primary.ci_low,
            "ci_high": primary.ci_high,
        },
        "guardrails": [
            {
                "metric": rail.metric,
                "direction": rail.direction,
                "max_harm": rail.max_harm,
                "mean_delta": results[rail.metric].mean_delta if rail.metric in results else None,
                "regressed": rail.metric in record.guardrail_regressions,
            }
            for rail in spec.guardrails
        ],
        "descriptives": [
            {
                "metric": row.metric,
                "baseline_mean": row.baseline_mean,
                "candidate_mean": row.candidate_mean,
                "mean_delta": row.mean_delta,
            }
            for row in record.descriptives
            if row.metric not in SUPPRESSED_METRICS
        ],
        "suppressed": suppressed,
    }


def build_reference_panels() -> Payload:
    """The quoted FLEET-005 panel and the exploratory two-zone probe panel."""
    return {
        "format": REFERENCE_PANELS_FORMAT,
        "format_version": 1,
        "fleet005": _reference_panel(fleet_005_spec()),
        "probe": _reference_panel(probe_spec()),
    }


#: Fixture file name -> builder.
FIXTURES: dict[str, Callable[[], Payload]] = {
    "instrument_vectors.json": build_instrument_vectors,
    "legacy_fleet005_seed101.json": build_legacy_fleet005_seed101,
    "legacy_analytical.json": build_legacy_analytical,
    "legacy_collision.json": build_legacy_collision,
    "legacy_precheck_world_fed_axis.json": build_legacy_precheck_world_fed_axis,
    "legacy_fl11_horizon_crash.json": build_legacy_fl11_horizon_crash,
    "legacy_defect.json": build_legacy_defect,
    "reference_panels.json": build_reference_panels,
}


def serialize(payload: Payload) -> str:
    """The exact committed text of a fixture payload."""
    return json.dumps(payload, indent=1, ensure_ascii=False) + "\n"


def _mismatch_summary(name: str, payload: Payload, path: Path) -> list[str]:
    if not path.exists():
        return [f"{name}: committed file is missing"]
    committed_text = path.read_text(encoding="utf-8")
    if committed_text == serialize(payload):
        return []
    try:
        committed = json.loads(committed_text)
    except json.JSONDecodeError as exc:
        return [f"{name}: committed file is not JSON ({exc})"]
    if not isinstance(committed, dict):
        return [f"{name}: committed file is not a JSON object"]
    lines = []
    for key in sorted(set(payload) | set(committed)):
        if key not in committed:
            lines.append(f"{name}: key '{key}' missing from committed file")
        elif key not in payload:
            lines.append(f"{name}: key '{key}' no longer produced")
        elif json.dumps(payload[key], ensure_ascii=False) != json.dumps(
            committed[key], ensure_ascii=False
        ):
            lines.append(f"{name}: group '{key}' differs")
    return lines or [f"{name}: formatting differs"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true", help="rewrite the committed fixtures")
    parser.add_argument("--reason", help="why the fixtures change (required with --write)")
    args = parser.parse_args(argv)
    if args.write and not (args.reason and args.reason.strip()):
        parser.error("--write requires --reason TEXT")
    if sys.version_info[:2] != REQUIRED_PYTHON:
        print(
            f"Python {REQUIRED_PYTHON[0]}.{REQUIRED_PYTHON[1]} is required (FleetLab's pin); "
            f"this is {sys.version_info[0]}.{sys.version_info[1]}",
            file=sys.stderr,
        )
        return 2

    mismatches: list[str] = []
    for name, builder in FIXTURES.items():
        payload = builder()
        path = FIXTURE_DIR / name
        if args.write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(serialize(payload), encoding="utf-8")
            print(f"wrote {path.relative_to(REPOSITORY_ROOT)}")
        else:
            mismatches += _mismatch_summary(name, payload, path)

    if args.write:
        print(f"reason: {args.reason.strip()}")
        return 0
    if mismatches:
        print("fixture mismatch:")
        for line in mismatches:
            print(f"  {line}")
        return 1
    print(f"{len(FIXTURES)} fixture file(s) match")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
