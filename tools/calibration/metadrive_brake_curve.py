#!/usr/bin/env python3
"""Measure the pinned MetaDrive 0.4.3 full-brake curve on Hermes' ADAS map.

Simulation only. The resulting values describe this pinned simulator and configuration;
they are not real-vehicle limits, safety claims, or certification evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import statistics
import struct
import subprocess
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any, NamedTuple

ENTRY_SPEEDS_MPS = tuple(range(4, 31, 2))
PHYSICS_STEP_S = 0.02
DECISION_REPEAT = 5
DECISION_INTERVAL_S = PHYSICS_STEP_S * DECISION_REPEAT
STOP_SPEED_THRESHOLD_MPS = 0.3
CONSTRUCTION_ATTEMPTS = 5


class TracePoint(NamedTuple):
    """One observation boundary in a full-brake trace."""

    time_s: float
    speed_mps: float
    longitudinal_position_m: float


class TraceSummary(NamedTuple):
    """Metrics derived from the braking intervals between trace points."""

    peak_deceleration_mps2: float
    steady_deceleration_mps2: float
    mean_deceleration_mps2: float
    stopping_distance_m: float
    braking_interval_count: int
    steady_interval_indices: tuple[int, ...]


class CurveMeasurement(NamedTuple):
    """One entry speed's representative trace and repeat-validation evidence."""

    entry_speed_command_mps: float
    entry_speed_observed_mps: float
    summary: TraceSummary
    trace: tuple[TracePoint, ...]
    repeat_trace_sha256: tuple[str, ...]
    metadrive_config: dict[str, Any]


def binary32(value: float) -> float:
    """Project once to the IEEE-754 precision accepted by MetaDrive's action Box."""
    return struct.unpack("!f", struct.pack("!f", value))[0]


def entry_speeds_mps() -> tuple[float, ...]:
    """Return the required inclusive 4--30 m/s sweep, projected to binary32."""
    return tuple(binary32(float(value)) for value in ENTRY_SPEEDS_MPS)


def metadrive_config(*, entry_speed_mps: float, seed: int) -> dict[str, Any]:
    """Return the exact scenario-faithful MetaDrive configuration for one curve."""
    return {
        "use_render": False,
        "image_observation": False,
        "manual_control": False,
        "show_interface": False,
        "show_policy_mark": False,
        "map": "S",
        "start_seed": seed,
        "num_scenarios": 1,
        "random_agent_model": False,
        "random_spawn_lane_index": False,
        "traffic_density": 0.0,
        "random_traffic": False,
        "accident_prob": 0.0,
        "horizon": 300,
        "truncate_as_terminate": False,
        "physics_world_step_size": PHYSICS_STEP_S,
        "decision_repeat": DECISION_REPEAT,
        "action_check": True,
        "log_level": 50,
        "vehicle_config": {
            "spawn_velocity": [binary32(entry_speed_mps), binary32(0.0)],
            "spawn_velocity_car_frame": True,
            "spawn_lateral": binary32(0.0),
            "show_navi_mark": False,
            "show_dest_mark": False,
            "show_lidar": False,
            "show_lane_line_detector": False,
            "show_side_detector": False,
            "lidar": {"num_lasers": 0, "distance": 0, "num_others": 0},
        },
    }


def full_brake_action() -> Any:
    """Build the full-brake command at MetaDrive's exact float32 action precision."""
    import numpy

    return numpy.asarray([binary32(0.0), binary32(-1.0)], dtype=numpy.float32)


def construct_environment(
    environment_factory: Callable[[dict[str, Any]], Any],
    config: dict[str, Any],
    *,
    attempts: int = CONSTRUCTION_ATTEMPTS,
) -> Any:
    """Retry only MetaDrive 0.4.3's documented headless-construction IndexError."""
    last_error: IndexError | None = None
    for _attempt in range(attempts):
        try:
            return environment_factory(config)
        except IndexError as exc:
            last_error = exc
    raise RuntimeError(
        f"MetaDrive environment construction failed after {attempts} IndexError retries"
    ) from last_error


def _trace_bytes(trace: Sequence[TracePoint]) -> bytes:
    return b"".join(
        struct.pack(
            "!ddd",
            point.time_s,
            point.speed_mps,
            point.longitudinal_position_m,
        )
        for point in trace
    )


def assert_bitwise_identical(traces: Sequence[Sequence[TracePoint]]) -> bool:
    """Reject any repeat whose IEEE-754 trace bytes differ from repeat one."""
    if len(traces) < 2:
        raise ValueError("bitwise repeat validation requires at least two traces")
    expected = _trace_bytes(traces[0])
    for index, trace in enumerate(traces[1:], start=2):
        if _trace_bytes(trace) != expected:
            raise ValueError(f"repeat trace {index} differs bitwise from repeat trace 1")
    return True


def summarize_trace(
    trace: Sequence[TracePoint],
    *,
    decision_interval_s: float,
    stop_speed_threshold_mps: float,
) -> TraceSummary:
    """Derive interval-correct full-brake metrics from one stopped trace."""
    if len(trace) < 4:
        raise ValueError("a brake trace needs at least three intervals")
    if decision_interval_s <= 0.0:
        raise ValueError("decision_interval_s must be positive")
    if trace[-1].speed_mps > stop_speed_threshold_mps:
        raise ValueError("brake trace did not reach the declared stop-speed threshold")

    decelerations = tuple(
        (trace[index].speed_mps - trace[index + 1].speed_mps) / decision_interval_s
        for index in range(len(trace) - 1)
    )
    interval_count = len(decelerations)
    steady_indices = tuple(range(1, interval_count - 1))
    if not steady_indices:
        raise ValueError("brake trace has no steady intervals after endpoint exclusion")

    stopping_distance_m = trace[-1].longitudinal_position_m - trace[0].longitudinal_position_m
    if stopping_distance_m < 0.0:
        raise ValueError("brake trace has negative longitudinal stopping distance")

    return TraceSummary(
        peak_deceleration_mps2=max(decelerations),
        steady_deceleration_mps2=sum(decelerations[index] for index in steady_indices)
        / len(steady_indices),
        mean_deceleration_mps2=sum(decelerations) / interval_count,
        stopping_distance_m=stopping_distance_m,
        braking_interval_count=interval_count,
        steady_interval_indices=steady_indices,
    )


def _longitudinal_position(
    position: Sequence[float],
    *,
    origin: tuple[float, float],
    heading: tuple[float, float],
) -> float:
    return (float(position[0]) - origin[0]) * heading[0] + (
        float(position[1]) - origin[1]
    ) * heading[1]


def measure_trace(
    environment_factory: Callable[[dict[str, Any]], Any],
    *,
    config: dict[str, Any],
    seed: int,
) -> tuple[TracePoint, ...]:
    """Run one fresh full-brake episode through the raw MetaDrive Gym API."""
    environment = construct_environment(environment_factory, config)
    try:
        environment.reset(seed=seed)
        agent = environment.agent
        origin = (float(agent.position[0]), float(agent.position[1]))
        raw_heading = (float(agent.heading[0]), float(agent.heading[1]))
        heading_norm = math.hypot(*raw_heading)
        if heading_norm <= 0.0:
            raise RuntimeError("MetaDrive agent heading is undefined at reset")
        heading = (raw_heading[0] / heading_norm, raw_heading[1] / heading_norm)
        trace = [
            TracePoint(
                time_s=0.0,
                speed_mps=float(agent.speed),
                longitudinal_position_m=0.0,
            )
        ]
        action = full_brake_action()
        for step in range(1, int(config["horizon"]) + 1):
            _observation, _reward, terminated, truncated, _info = environment.step(action)
            point = TracePoint(
                time_s=step * DECISION_INTERVAL_S,
                speed_mps=float(agent.speed),
                longitudinal_position_m=_longitudinal_position(
                    agent.position,
                    origin=origin,
                    heading=heading,
                ),
            )
            trace.append(point)
            if point.speed_mps <= STOP_SPEED_THRESHOLD_MPS:
                return tuple(trace)
            if terminated or truncated:
                raise RuntimeError(
                    "MetaDrive episode ended before reaching the stop-speed threshold"
                )
        raise RuntimeError("MetaDrive full-brake trace exceeded its configured horizon")
    finally:
        environment.close()


def measure_entry_speed(
    environment_factory: Callable[[dict[str, Any]], Any],
    *,
    entry_speed_mps: float,
    seed: int,
    repeats: int,
) -> CurveMeasurement:
    """Measure one entry speed three times and reject non-identical traces."""
    if repeats != 3:
        raise ValueError("the committed calibration protocol requires exactly N=3 repeats")
    projected_speed = binary32(entry_speed_mps)
    config = metadrive_config(entry_speed_mps=projected_speed, seed=seed)
    traces = tuple(
        measure_trace(environment_factory, config=config, seed=seed) for _ in range(repeats)
    )
    assert_bitwise_identical(traces)
    summary = summarize_trace(
        traces[0],
        decision_interval_s=DECISION_INTERVAL_S,
        stop_speed_threshold_mps=STOP_SPEED_THRESHOLD_MPS,
    )
    return CurveMeasurement(
        entry_speed_command_mps=projected_speed,
        entry_speed_observed_mps=traces[0][0].speed_mps,
        summary=summary,
        trace=traces[0],
        repeat_trace_sha256=tuple(
            hashlib.sha256(_trace_bytes(trace)).hexdigest() for trace in traces
        ),
        metadrive_config=config,
    )


def _distribution(
    measurements: Sequence[CurveMeasurement],
    values: Sequence[float],
) -> dict[str, Any]:
    samples = [
        {"entry_speed_mps": measurement.entry_speed_command_mps, "value": value}
        for measurement, value in zip(measurements, values, strict=True)
    ]
    return {
        "sample_count": len(values),
        "minimum": min(values),
        "median": statistics.median(values),
        "maximum": max(values),
        "samples_by_entry_speed_mps": samples,
    }


def build_evidence(
    measurements: Sequence[CurveMeasurement],
    *,
    simulator_version: str,
    simulator_commit: str,
    simulator_source: str,
    seed: int,
    repeats: int,
    repository_commit: str | None = None,
) -> dict[str, Any]:
    """Build deterministic calibration evidence and FleetLab bridge distributions."""
    if not measurements:
        raise ValueError("calibration evidence requires at least one measured entry speed")
    if repeats != 3:
        raise ValueError("the committed calibration protocol requires exactly N=3 repeats")

    peaks = [item.summary.peak_deceleration_mps2 for item in measurements]
    steady = [item.summary.steady_deceleration_mps2 for item in measurements]
    means = [item.summary.mean_deceleration_mps2 for item in measurements]
    distances = [item.summary.stopping_distance_m for item in measurements]
    curves = []
    for measurement in measurements:
        summary = measurement.summary
        curves.append(
            {
                "entry_speed_command_mps": measurement.entry_speed_command_mps,
                "entry_speed_observed_mps": measurement.entry_speed_observed_mps,
                "peak_deceleration_mps2": summary.peak_deceleration_mps2,
                "steady_deceleration_mps2": summary.steady_deceleration_mps2,
                "mean_deceleration_mps2": summary.mean_deceleration_mps2,
                "stopping_distance_m": summary.stopping_distance_m,
                "braking_interval_count": summary.braking_interval_count,
                "steady_interval_indices": list(summary.steady_interval_indices),
                "repeat_trace_sha256": list(measurement.repeat_trace_sha256),
                "repeat_bitwise_identical": True,
                "trace": [point._asdict() for point in measurement.trace],
                "metadrive_config": measurement.metadrive_config,
            }
        )

    evidence: dict[str, Any] = {
        "schema_version": "1.0",
        "artifact_type": "metadrive_full_brake_curve",
        "simulation_only": True,
        "claim_scope": (
            "Pinned MetaDrive simulation dynamics only; not a real-vehicle limit, safety "
            "claim, certification, or regulatory threshold."
        ),
        "consumers": ["fleetlab-travel-bridge"],
        "simulator": {
            "name": "MetaDrive",
            "version": simulator_version,
            "commit": simulator_commit,
            "source": simulator_source,
        },
        "measurement_protocol": {
            "entry_speeds_mps": [item.entry_speed_command_mps for item in measurements],
            "seed": seed,
            "repeats_per_speed": repeats,
            "repeat_requirement": "representative traces are IEEE-754 bitwise identical",
            "command_precision": "IEEE-754 binary32 before every MetaDrive command path",
            "full_brake_action": full_brake_action().tolist(),
            "physics_step_s": PHYSICS_STEP_S,
            "decision_repeat": DECISION_REPEAT,
            "decision_interval_s": DECISION_INTERVAL_S,
            "stop_speed_threshold_mps": STOP_SPEED_THRESHOLD_MPS,
            "scenario_faithfulness": {
                "map": "S",
                "traffic_density": 0.0,
                "adas_scenario_destination_distance_m": 240.0,
                "destination_distance_used_by_metadrive": False,
                "destination_note": (
                    "Hermes' 240 m scenario destination is contextual metadata; MetaDrive "
                    "route geometry comes from map='S'."
                ),
            },
            "exact_config_location": "curves[*].metadrive_config",
        },
        "derivation": {
            "interval_indexing": "zero-based over consecutive trace samples",
            "interval_deceleration_mps2": "(speed[i] - speed[i+1]) / 0.1",
            "peak_deceleration_mps2": (
                "max over every braking interval i=0..n-1; interval 0 is included"
            ),
            "steady_deceleration_mps2": (
                "arithmetic mean over positive-speed interval indices 1..n-2, excluding "
                "only first transient interval 0 and final interval n-1 crossing the "
                "declared 0.3 m/s stop threshold"
            ),
            "mean_deceleration_mps2": (
                "sum of every interval deceleration divided by n braking intervals, where "
                "n = len(trace) - 1; both endpoint intervals are included"
            ),
            "stopping_distance_m": (
                "entry-heading projection from reset position to the first trace point at "
                "or below 0.3 m/s"
            ),
        },
        "control_config_decision": {
            "decision": "relabel_as_simulator_measured_envelope",
            "python_default_max_braking_mps2": 6.0,
            "python_default_changed": False,
            "scenario_authority": (
                "Each committed ADAS scenario explicitly declares the observed 20 m/s "
                "full-brake peak from this curve."
            ),
            "enforcement": (
                "No 6.0 m/s^2 command cap is claimed or added: this experiment measures "
                "full brake, not the command-to-deceleration curve required to enforce one."
            ),
        },
        "curves": curves,
        "bridge_summary": {
            "deceleration_distributions_mps2": {
                "peak": _distribution(measurements, peaks),
                "steady": _distribution(measurements, steady),
                "mean": _distribution(measurements, means),
            },
            "stopping_distance_distribution_m": _distribution(measurements, distances),
        },
    }
    if repository_commit is not None:
        evidence["repository_commit"] = repository_commit
    return evidence


def write_evidence(output_path: Path, evidence: dict[str, Any]) -> None:
    """Write one deterministic, newline-terminated JSON artifact."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(evidence, indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def _git(repository: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "git command failed")
    return completed.stdout.strip()


def simulator_provenance(repository_root: Path) -> tuple[str, str, str]:
    """Validate that the imported raw simulator is the clean pinned MetaDrive checkout."""
    import metadrive
    from metadrive.version import VERSION

    source_file = Path(metadrive.__file__).resolve()
    simulator_root = (repository_root / "third_party" / "metadrive").resolve()
    try:
        source_file.relative_to(simulator_root)
    except ValueError as exc:
        raise RuntimeError(
            f"MetaDrive import is outside the vendored source: {source_file}"
        ) from exc
    simulator_commit = _git(simulator_root, "rev-parse", "HEAD")
    pinned_commit = (repository_root / "SIMULATOR_COMMIT").read_text(encoding="utf-8").strip()
    if simulator_commit != pinned_commit:
        raise RuntimeError(
            "MetaDrive source commit differs from SIMULATOR_COMMIT: "
            f"source={simulator_commit}, pinned={pinned_commit}"
        )
    if _git(simulator_root, "status", "--porcelain", "--untracked-files=all"):
        raise RuntimeError("MetaDrive source is dirty; calibration evidence would be ambiguous")
    if VERSION != "0.4.3":
        raise RuntimeError(f"expected MetaDrive 0.4.3, observed {VERSION}")
    return VERSION, simulator_commit, "third_party/metadrive"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    repository_default = Path(__file__).resolve().parents[2]
    parser.add_argument("--repository-root", type=Path, default=repository_default)
    parser.add_argument(
        "--output",
        type=Path,
        default=repository_default
        / "evidence"
        / "calibration"
        / "metadrive-brake-curve-0.4.3.json",
    )
    parser.add_argument("--seed", type=int, default=7)
    arguments = parser.parse_args(argv)

    os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
    from metadrive import MetaDriveEnv

    repository_root = arguments.repository_root.expanduser().resolve()
    version, simulator_commit, simulator_source = simulator_provenance(repository_root)
    measurements = tuple(
        measure_entry_speed(
            MetaDriveEnv,
            entry_speed_mps=speed,
            seed=arguments.seed,
            repeats=3,
        )
        for speed in entry_speeds_mps()
    )
    evidence = build_evidence(
        measurements,
        simulator_version=version,
        simulator_commit=simulator_commit,
        simulator_source=simulator_source,
        seed=arguments.seed,
        repeats=3,
        repository_commit=_git(repository_root, "rev-parse", "HEAD"),
    )
    output_path = arguments.output.expanduser().resolve()
    write_evidence(output_path, evidence)
    print(
        json.dumps(
            {
                "output": str(output_path),
                "speeds": len(measurements),
                "repeats_per_speed": 3,
                "bitwise_identical": True,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
