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
import hashlib
import json
import math
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

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
from hermes.fleet.world import _u64, build_tape

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
        ["San José"],
        ["東京", "gap", 3],
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
    }


#: Fixture file name -> builder. Later phases register legacy worlds and projections here.
FIXTURES: dict[str, Callable[[], Payload]] = {
    "instrument_vectors.json": build_instrument_vectors,
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
