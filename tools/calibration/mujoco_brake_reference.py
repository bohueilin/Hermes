#!/usr/bin/env python3
"""Measure a pinned MuJoCo actuator-level full-brake reference curve.

Simulation only. This optional calibration instrument is neither a Hermes simulator adapter
nor release evidence, and its values are not real-vehicle limits or safety thresholds.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.metadata
import json
import platform
import statistics
import struct
import subprocess
import sys
import sysconfig
from collections.abc import Sequence
from pathlib import Path
from typing import Any, NamedTuple

EXPECTED_MUJOCO_VERSION = "3.12.0"
ENTRY_SPEEDS_MPS = tuple(float(value) for value in range(4, 31, 2))
REPEATS_PER_SPEED = 3
STOP_SPEED_THRESHOLD_MPS = 0.3
MAX_STEPS = 10_000

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = Path(__file__).with_suffix(".xml")
DEFAULT_METADRIVE_CURVE_PATH = (
    REPO_ROOT / "evidence" / "calibration" / "metadrive-brake-curve-0.4.3.json"
)
DEFAULT_OUTPUT_PATH = (
    REPO_ROOT / "evidence" / "calibration" / "mujoco-brake-reference-3.12.0.json"
)


class MujocoDependencyError(RuntimeError):
    """The exact optional calibration dependency is unavailable."""


class TracePoint(NamedTuple):
    """One observed integration boundary from the representative repeat."""

    time_s: float
    position_m: float
    speed_mps: float
    fwdinv_joint_space_l2_norm: float
    fwdinv_constraint_space_l2_norm: float
    active_constraint_count: int
    fwdinv_comparison_exercised: bool
    integration_state_sha256: str


class TraceSummary(NamedTuple):
    """Interval-derived braking outcomes for one entry speed."""

    peak_deceleration_mps2: float
    steady_deceleration_mps2: float
    mean_deceleration_mps2: float
    stopping_distance_m: float
    braking_interval_count: int
    steady_interval_indices: tuple[int, ...]


class FwdInvSample(NamedTuple):
    """One read of MuJoCo's two-element forward/inverse diagnostic array."""

    active_constraint_count: int
    comparison_exercised: bool
    joint_space_l2_norm: float
    constraint_space_l2_norm: float


class FwdInvDiagnosticSummary(NamedTuple):
    """Availability and L2 norms for MuJoCo's constraint-gated diagnostic."""

    comparison_exercised: bool
    minimum_active_constraint_count: int
    maximum_active_constraint_count: int
    exercised_sample_count: int
    unexercised_sample_count: int
    maximum_joint_space_l2_norm: float | None
    median_joint_space_l2_norm: float | None
    maximum_constraint_space_l2_norm: float | None
    median_constraint_space_l2_norm: float | None
    unexercised_joint_space_raw_values: tuple[float, ...]
    unexercised_constraint_space_raw_values: tuple[float, ...]


class StateCapture(NamedTuple):
    """One exact MuJoCo state capture and the API signature that produced it."""

    state_bytes: bytes
    sha256: str
    signature_name: str
    size: int


class CurveMeasurement(NamedTuple):
    """One speed's outcomes plus N=3 same-host determinism evidence."""

    entry_speed_mps: float
    summary: TraceSummary
    fwdinv_diagnostic: FwdInvDiagnosticSummary
    trace: tuple[TracePoint, ...]
    integration_state_name: str
    integration_state_size: int
    repeat_integration_state_trace_sha256: tuple[str, ...]
    repeat_observation_trace_sha256: tuple[str, ...]
    warning_count: int


class _RepeatResult(NamedTuple):
    trace: tuple[TracePoint, ...]
    integration_state_size: int
    integration_state_trace_sha256: str
    observation_trace_sha256: str
    warning_count: int


def require_mujoco() -> Any:
    """Import the exact optional dependency or fail with actionable install guidance."""
    try:
        mujoco = importlib.import_module("mujoco")
    except ModuleNotFoundError as exc:
        if exc.name != "mujoco":
            raise
        raise MujocoDependencyError(
            "MuJoCo calibration requires mujoco==3.12.0. Install the optional extra with "
            "pip install -e '.[mujoco-cal]'."
        ) from exc
    if mujoco.__version__ != EXPECTED_MUJOCO_VERSION:
        raise MujocoDependencyError(
            f"MuJoCo calibration requires mujoco=={EXPECTED_MUJOCO_VERSION}; found "
            f"{mujoco.__version__}. Install the exact optional extra with "
            "pip install -e '.[mujoco-cal]'."
        )
    return mujoco


def load_entry_speeds(metadrive_curve_path: Path) -> tuple[float, ...]:
    """Consume and fail-closed validate WP-A's sole committed speed-sweep source."""
    payload = json.loads(metadrive_curve_path.read_text())
    if payload.get("artifact_type") != "metadrive_full_brake_curve":
        raise ValueError("WP-A source is not a MetaDrive full-brake curve")
    simulator = payload.get("simulator", {})
    if simulator.get("version") != "0.4.3":
        raise ValueError("WP-A source is not the pinned MetaDrive 0.4.3 curve")
    if "bridge_summary" not in payload:
        raise ValueError("WP-A source lacks its bridge-consumable distributions")
    speeds = tuple(float(value) for value in payload["measurement_protocol"]["entry_speeds_mps"])
    if speeds != ENTRY_SPEEDS_MPS:
        raise ValueError(
            "WP-A entry speeds must be exactly 4..30 m/s inclusive in 2 m/s increments"
        )
    return speeds


def load_model(model_path: Path, *, mujoco: Any) -> Any:
    """Compile the committed MJCF and verify its frozen calibration defaults."""
    model = mujoco.MjModel.from_xml_path(str(model_path))
    if mujoco.mjtIntegrator(model.opt.integrator) != mujoco.mjtIntegrator.mjINT_IMPLICITFAST:
        raise ValueError("MuJoCo calibration model must use implicitfast")
    if not model.opt.enableflags & int(mujoco.mjtEnableBit.mjENBL_FWDINV):
        raise ValueError("MuJoCo calibration model must enable fwdinv")
    if not model.opt.disableflags & int(mujoco.mjtDisableBit.mjDSBL_AUTORESET):
        raise ValueError("MuJoCo calibration model must disable autoreset")
    if any(float(value) <= 0.0 for value in model.dof_armature):
        raise ValueError("every calibration degree of freedom must have nonzero armature")
    return model


def _object_id(model: Any, name: str, kind: Any, *, mujoco: Any) -> int:
    object_id = int(mujoco.mj_name2id(model, kind, name))
    if object_id < 0:
        raise ValueError(f"MuJoCo model is missing required object {name!r}")
    return object_id


def model_assumptions(model: Any, *, mujoco: Any) -> dict[str, Any]:
    """Expose the model choices that constrain interpretation of this reference."""
    ego_body = _object_id(model, "ego", mujoco.mjtObj.mjOBJ_BODY, mujoco=mujoco)
    lead_body = _object_id(model, "lead", mujoco.mjtObj.mjOBJ_BODY, mujoco=mujoco)
    ego_joint = _object_id(model, "ego_drive", mujoco.mjtObj.mjOBJ_JOINT, mujoco=mujoco)
    lead_joint = _object_id(model, "lead_drive", mujoco.mjtObj.mjOBJ_JOINT, mujoco=mujoco)
    ego_motor = _object_id(model, "ego_motor", mujoco.mjtObj.mjOBJ_ACTUATOR, mujoco=mujoco)
    lead_servo = _object_id(
        model,
        "lead_velocity_servo",
        mujoco.mjtObj.mjOBJ_ACTUATOR,
        mujoco=mujoco,
    )
    ego_dof = int(model.jnt_dofadr[ego_joint])
    lead_dof = int(model.jnt_dofadr[lead_joint])
    return {
        "model_scope": "one-dimensional actuator-level simulation reference",
        "contact_claim": (
            "none for this sweep; the separated rail bodies do not exercise vehicle contact"
        ),
        "ego_mass_kg": float(model.body_mass[ego_body]),
        "lead_mass_kg": float(model.body_mass[lead_body]),
        "ego_full_brake_force_n": abs(float(model.actuator_ctrlrange[ego_motor, 0])),
        "ego_max_throttle_force_n": float(model.actuator_ctrlrange[ego_motor, 1]),
        "ego_joint_damping_n_s_per_m": float(model.dof_damping[ego_dof]),
        "ego_joint_armature_kg": float(model.dof_armature[ego_dof]),
        "lead_joint_armature_kg": float(model.dof_armature[lead_dof]),
        "lead_velocity_servo_kv": float(model.actuator_gainprm[lead_servo, 0]),
        "lead_actor_role": "scripted-kinematic",
        "lead_behavior_realism_claim": False,
        "lead_sweep_behavior": "same-speed non-interacting reference 100 m ahead",
        "parameter_status": (
            "illustrative pilot assumptions adapted from the prior 1-D AEB sandbox; not "
            "identified from a real vehicle"
        ),
    }


def _joint_addresses(model: Any, *, mujoco: Any) -> tuple[int, int, int, int, int, int]:
    ego_joint = _object_id(model, "ego_drive", mujoco.mjtObj.mjOBJ_JOINT, mujoco=mujoco)
    lead_joint = _object_id(model, "lead_drive", mujoco.mjtObj.mjOBJ_JOINT, mujoco=mujoco)
    ego_motor = _object_id(model, "ego_motor", mujoco.mjtObj.mjOBJ_ACTUATOR, mujoco=mujoco)
    lead_servo = _object_id(
        model,
        "lead_velocity_servo",
        mujoco.mjtObj.mjOBJ_ACTUATOR,
        mujoco=mujoco,
    )
    return (
        int(model.jnt_qposadr[ego_joint]),
        int(model.jnt_dofadr[ego_joint]),
        int(model.jnt_qposadr[lead_joint]),
        int(model.jnt_dofadr[lead_joint]),
        ego_motor,
        lead_servo,
    )


def _capture_state(model: Any, data: Any, *, mujoco: Any) -> StateCapture:
    import numpy

    state_signature = mujoco.mjtState.mjSTATE_INTEGRATION
    signature = int(state_signature)
    state = numpy.empty(mujoco.mj_stateSize(model, signature), dtype=numpy.float64)
    mujoco.mj_getState(model, data, state, signature)
    state_bytes = state.tobytes(order="C")
    return StateCapture(
        state_bytes=state_bytes,
        sha256=hashlib.sha256(state_bytes).hexdigest(),
        signature_name=state_signature.name,
        size=state.size,
    )


def _capture_fwdinv_sample(data: Any) -> FwdInvSample:
    """Read both slots and state whether MuJoCo exercised the comparison."""
    active_constraint_count = int(data.nefc)
    return FwdInvSample(
        active_constraint_count=active_constraint_count,
        comparison_exercised=active_constraint_count > 0,
        joint_space_l2_norm=float(data.solver_fwdinv[0]),
        constraint_space_l2_norm=float(data.solver_fwdinv[1]),
    )


def _observation_trace_sha256(trace: Sequence[TracePoint]) -> str:
    digest = hashlib.sha256()
    for point in trace:
        digest.update(
            struct.pack(
                "!ddddd",
                point.time_s,
                point.position_m,
                point.speed_mps,
                point.fwdinv_joint_space_l2_norm,
                point.fwdinv_constraint_space_l2_norm,
            )
        )
        digest.update(
            struct.pack(
                "!q?",
                point.active_constraint_count,
                point.fwdinv_comparison_exercised,
            )
        )
        digest.update(bytes.fromhex(point.integration_state_sha256))
    return digest.hexdigest()


def _measure_repeat(
    model: Any,
    *,
    entry_speed_mps: float,
    mujoco: Any,
) -> _RepeatResult:
    data = mujoco.MjData(model)
    ego_qpos, ego_dof, lead_qpos, lead_dof, ego_motor, lead_servo = _joint_addresses(
        model, mujoco=mujoco
    )
    data.qpos[ego_qpos] = 0.0
    data.qpos[lead_qpos] = 0.0
    data.qvel[ego_dof] = entry_speed_mps
    data.qvel[lead_dof] = entry_speed_mps
    data.ctrl[ego_motor] = 0.0
    data.ctrl[lead_servo] = entry_speed_mps
    mujoco.mj_forward(model, data)

    state_trace_digest = hashlib.sha256()
    initial_state = _capture_state(model, data, mujoco=mujoco)
    initial_fwdinv = _capture_fwdinv_sample(data)
    state_trace_digest.update(initial_state.state_bytes)
    trace = [
        TracePoint(
            time_s=float(data.time),
            position_m=float(data.qpos[ego_qpos]),
            speed_mps=float(data.qvel[ego_dof]),
            fwdinv_joint_space_l2_norm=initial_fwdinv.joint_space_l2_norm,
            fwdinv_constraint_space_l2_norm=initial_fwdinv.constraint_space_l2_norm,
            active_constraint_count=initial_fwdinv.active_constraint_count,
            fwdinv_comparison_exercised=initial_fwdinv.comparison_exercised,
            integration_state_sha256=initial_state.sha256,
        )
    ]

    full_brake_command = float(model.actuator_ctrlrange[ego_motor, 0])
    for _step in range(MAX_STEPS):
        data.ctrl[ego_motor] = full_brake_command
        data.ctrl[lead_servo] = entry_speed_mps
        mujoco.mj_step(model, data)
        state = _capture_state(model, data, mujoco=mujoco)
        fwdinv = _capture_fwdinv_sample(data)
        state_trace_digest.update(state.state_bytes)
        point = TracePoint(
            time_s=float(data.time),
            position_m=float(data.qpos[ego_qpos]),
            speed_mps=float(data.qvel[ego_dof]),
            fwdinv_joint_space_l2_norm=fwdinv.joint_space_l2_norm,
            fwdinv_constraint_space_l2_norm=fwdinv.constraint_space_l2_norm,
            active_constraint_count=fwdinv.active_constraint_count,
            fwdinv_comparison_exercised=fwdinv.comparison_exercised,
            integration_state_sha256=state.sha256,
        )
        trace.append(point)
        if point.speed_mps <= STOP_SPEED_THRESHOLD_MPS:
            break
    else:
        raise RuntimeError("MuJoCo brake reference exceeded its configured step bound")

    warning_count = sum(int(item.number) for item in data.warning)
    if warning_count:
        raise RuntimeError(f"MuJoCo emitted {warning_count} numerical warning(s)")
    resolved_trace = tuple(trace)
    return _RepeatResult(
        trace=resolved_trace,
        integration_state_size=initial_state.size,
        integration_state_trace_sha256=state_trace_digest.hexdigest(),
        observation_trace_sha256=_observation_trace_sha256(resolved_trace),
        warning_count=warning_count,
    )


def _summarize_trace(trace: Sequence[TracePoint], *, timestep_s: float) -> TraceSummary:
    if len(trace) < 4:
        raise ValueError("a brake trace needs at least three intervals")
    decelerations = tuple(
        (trace[index].speed_mps - trace[index + 1].speed_mps) / timestep_s
        for index in range(len(trace) - 1)
    )
    steady_indices = tuple(range(1, len(decelerations) - 1))
    if not steady_indices:
        raise ValueError("a brake trace needs at least one steady interval")
    return TraceSummary(
        peak_deceleration_mps2=max(decelerations),
        steady_deceleration_mps2=sum(decelerations[index] for index in steady_indices)
        / len(steady_indices),
        mean_deceleration_mps2=sum(decelerations) / len(decelerations),
        stopping_distance_m=trace[-1].position_m - trace[0].position_m,
        braking_interval_count=len(decelerations),
        steady_interval_indices=steady_indices,
    )


def _summarize_fwdinv(trace: Sequence[TracePoint]) -> FwdInvDiagnosticSummary:
    exercised = [point for point in trace if point.fwdinv_comparison_exercised]
    unexercised = [point for point in trace if not point.fwdinv_comparison_exercised]
    joint_values = [point.fwdinv_joint_space_l2_norm for point in exercised]
    constraint_values = [point.fwdinv_constraint_space_l2_norm for point in exercised]
    return FwdInvDiagnosticSummary(
        comparison_exercised=bool(exercised),
        minimum_active_constraint_count=min(point.active_constraint_count for point in trace),
        maximum_active_constraint_count=max(point.active_constraint_count for point in trace),
        exercised_sample_count=len(exercised),
        unexercised_sample_count=len(unexercised),
        maximum_joint_space_l2_norm=max(joint_values) if joint_values else None,
        median_joint_space_l2_norm=statistics.median(joint_values) if joint_values else None,
        maximum_constraint_space_l2_norm=max(constraint_values) if constraint_values else None,
        median_constraint_space_l2_norm=(
            statistics.median(constraint_values) if constraint_values else None
        ),
        unexercised_joint_space_raw_values=tuple(
            sorted({point.fwdinv_joint_space_l2_norm for point in unexercised})
        ),
        unexercised_constraint_space_raw_values=tuple(
            sorted({point.fwdinv_constraint_space_l2_norm for point in unexercised})
        ),
    )


def measure_entry_speed(
    model: Any,
    *,
    entry_speed_mps: float,
    seed: int,
    repeats: int,
    mujoco: Any,
) -> CurveMeasurement:
    """Measure one entry speed with exactly three fresh deterministic states."""
    if repeats != REPEATS_PER_SPEED:
        raise ValueError("the committed MuJoCo protocol requires exactly N=3 repeats")
    if entry_speed_mps not in ENTRY_SPEEDS_MPS:
        raise ValueError("entry speed is outside the WP-A calibration sweep")
    if seed != 7:
        raise ValueError("the committed MuJoCo protocol requires deterministic seed 7")
    repeat_results = tuple(
        _measure_repeat(model, entry_speed_mps=entry_speed_mps, mujoco=mujoco)
        for _repeat in range(repeats)
    )
    integration_hashes = tuple(
        item.integration_state_trace_sha256 for item in repeat_results
    )
    observation_hashes = tuple(item.observation_trace_sha256 for item in repeat_results)
    if len(set(integration_hashes)) != 1 or len(set(observation_hashes)) != 1:
        raise ValueError("MuJoCo N=3 repeats are not bitwise identical")
    representative = repeat_results[0]
    return CurveMeasurement(
        entry_speed_mps=entry_speed_mps,
        summary=_summarize_trace(
            representative.trace,
            timestep_s=float(model.opt.timestep),
        ),
        fwdinv_diagnostic=_summarize_fwdinv(representative.trace),
        trace=representative.trace,
        integration_state_name=mujoco.mjtState.mjSTATE_INTEGRATION.name,
        integration_state_size=representative.integration_state_size,
        repeat_integration_state_trace_sha256=integration_hashes,
        repeat_observation_trace_sha256=observation_hashes,
        warning_count=sum(item.warning_count for item in repeat_results),
    )


def _distribution(
    measurements: Sequence[CurveMeasurement], values: Sequence[float]
) -> dict[str, Any]:
    return {
        "sample_count": len(values),
        "minimum": min(values),
        "median": statistics.median(values),
        "maximum": max(values),
        "samples_by_entry_speed_mps": [
            {"entry_speed_mps": item.entry_speed_mps, "value": value}
            for item, value in zip(measurements, values, strict=True)
        ],
    }


def _relative_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(REPO_ROOT))
    except ValueError:
        return str(resolved)


def _file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _distribution_metadata_file(distribution: Any, filename: str) -> Path:
    candidates = [
        item
        for item in distribution.files or ()
        if item.name == filename and ".dist-info" in str(item)
    ]
    if len(candidates) != 1:
        raise RuntimeError(f"MuJoCo distribution has {len(candidates)} {filename} files")
    return Path(distribution.locate_file(candidates[0])).resolve()


def runtime_identity(*, mujoco: Any) -> dict[str, Any]:
    """Fingerprint the interpreter, host, wheel metadata, and native MuJoCo library."""
    distribution = importlib.metadata.distribution("mujoco")
    wheel_path = _distribution_metadata_file(distribution, "WHEEL")
    metadata_path = _distribution_metadata_file(distribution, "METADATA")
    wheel_lines = wheel_path.read_text().splitlines()
    wheel_tags = sorted(
        line.partition(":")[2].strip() for line in wheel_lines if line.startswith("Tag:")
    )
    package_dir = Path(mujoco.__file__).resolve().parent
    native_candidates = sorted(
        path
        for pattern in ("libmujoco*", "mujoco.dll")
        for path in package_dir.glob(pattern)
        if path.is_file()
    )
    if len(native_candidates) != 1:
        raise RuntimeError(
            f"MuJoCo package has {len(native_candidates)} candidate native core libraries"
        )
    native_library = native_candidates[0]
    return {
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
            "abi": sysconfig.get_config_var("SOABI"),
            "byteorder": sys.byteorder,
        },
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "descriptor": platform.platform(aliased=False, terse=False),
        },
        "mujoco_distribution": {
            "name": distribution.metadata["Name"],
            "version": distribution.version,
            "wheel_tags": wheel_tags,
            "wheel_metadata_sha256": _file_sha256(wheel_path),
            "package_metadata_sha256": _file_sha256(metadata_path),
        },
        "mujoco_native_library": {
            "filename": native_library.name,
            "size_bytes": native_library.stat().st_size,
            "sha256": _file_sha256(native_library),
        },
    }


def _unavailable_l2_distribution(*, reason: str) -> dict[str, Any]:
    return {
        "sample_count": 0,
        "minimum": None,
        "median": None,
        "maximum": None,
        "samples_by_entry_speed_mps": [],
        "availability": "NOT_EXERCISED",
        "reason": reason,
    }


def _curve_payload(item: CurveMeasurement) -> dict[str, Any]:
    summary = item.summary
    diagnostic = item.fwdinv_diagnostic
    return {
        "entry_speed_mps": item.entry_speed_mps,
        "peak_deceleration_mps2": summary.peak_deceleration_mps2,
        "steady_deceleration_mps2": summary.steady_deceleration_mps2,
        "mean_deceleration_mps2": summary.mean_deceleration_mps2,
        "stopping_distance_m": summary.stopping_distance_m,
        "braking_interval_count": summary.braking_interval_count,
        "steady_interval_indices": list(summary.steady_interval_indices),
        "integration_state_name": item.integration_state_name,
        "integration_state_size": item.integration_state_size,
        "repeat_integration_state_trace_sha256": list(
            item.repeat_integration_state_trace_sha256
        ),
        "repeat_observation_trace_sha256": list(item.repeat_observation_trace_sha256),
        "repeat_bitwise_identical": True,
        "trace_retention": (
            "replay inputs plus observation and mjSTATE_INTEGRATION trace SHA-256 digests"
        ),
        "warning_count": item.warning_count,
        "fwdinv_diagnostic": {
            "array_api": (
                "MjData.solver_fwdinv is a two-element array; index 0 is joint-space L2 norm "
                "and index 1 is constraint-space L2 norm"
            ),
            "comparison_exercised": diagnostic.comparison_exercised,
            "active_constraint_count": {
                "minimum": diagnostic.minimum_active_constraint_count,
                "maximum": diagnostic.maximum_active_constraint_count,
            },
            "sample_counts": {
                "exercised": diagnostic.exercised_sample_count,
                "not_exercised": diagnostic.unexercised_sample_count,
            },
            "l2_norms_when_exercised": {
                "joint_space": {
                    "maximum": diagnostic.maximum_joint_space_l2_norm,
                    "median": diagnostic.median_joint_space_l2_norm,
                },
                "constraint_space": {
                    "maximum": diagnostic.maximum_constraint_space_l2_norm,
                    "median": diagnostic.median_constraint_space_l2_norm,
                },
            },
            "unexercised_raw_array_values": {
                "joint_space_l2_norm": list(
                    diagnostic.unexercised_joint_space_raw_values
                ),
                "constraint_space_l2_norm": list(
                    diagnostic.unexercised_constraint_space_raw_values
                ),
            },
            "interpretation": (
                "MuJoCo clears both raw slots and returns without comparing when the active "
                "constraint count is zero; raw zeros in that state are not L2-norm results"
            ),
        },
    }


def build_evidence(
    measurements: Sequence[CurveMeasurement],
    *,
    model_path: Path,
    metadrive_curve_path: Path,
    repository_commit: str,
    repository_dirty: bool,
    mujoco: Any,
    model: Any,
) -> dict[str, Any]:
    """Build deterministic, replayable calibration evidence and distributions."""
    if not measurements:
        raise ValueError("MuJoCo calibration evidence requires measurements")
    peaks = [item.summary.peak_deceleration_mps2 for item in measurements]
    steady = [item.summary.steady_deceleration_mps2 for item in measurements]
    means = [item.summary.mean_deceleration_mps2 for item in measurements]
    distances = [item.summary.stopping_distance_m for item in measurements]
    compared_measurements = [
        item for item in measurements if item.fwdinv_diagnostic.comparison_exercised
    ]
    maximum_active_constraints = [
        float(item.fwdinv_diagnostic.maximum_active_constraint_count)
        for item in measurements
    ]
    no_comparison_reason = (
        "No speed exercised mj_compareFwdInv because every recorded active-constraint count "
        "was zero; MuJoCo cleared both raw array slots without computing L2 norms."
    )
    return {
        "schema_version": "1.1",
        "artifact_type": "mujoco_full_brake_reference",
        "simulation_only": True,
        "claim_scope": (
            "Pinned MuJoCo model outcomes only; not a real-vehicle limit, safety claim, "
            "certification, regulatory threshold, or deployment permission."
        ),
        "instrument_role": "optional_calibration_instrument",
        "simulator_adapter": False,
        "release_evidence_lane": False,
        "cross_backend_claim_contract": (
            "Compare empirical outcome distributions by matched entry-speed support only."
        ),
        "simulator": {
            "name": "MuJoCo",
            "version": mujoco.__version__,
            "dependency": f"mujoco=={EXPECTED_MUJOCO_VERSION}",
            "source": "pinned Python wheel; no simulator source commit is claimed",
            "commit": None,
        },
        "repository": {
            "commit": repository_commit,
            "dirty_before_output_write": repository_dirty,
        },
        "producer": {
            "command": ["python3.11", "tools/calibration/mujoco_brake_reference.py"],
            "working_directory": "repository root",
        },
        "runtime": runtime_identity(mujoco=mujoco),
        "model": {
            "path": _relative_path(model_path),
            "sha256": _file_sha256(model_path),
            "integrator": mujoco.mjtIntegrator(model.opt.integrator).name,
            "timestep_s": float(model.opt.timestep),
            "fwdinv_enabled": True,
            "autoreset_disabled": True,
        },
        "model_assumptions": model_assumptions(model, mujoco=mujoco),
        "measurement_protocol": {
            "entry_speeds_mps": [item.entry_speed_mps for item in measurements],
            "entry_speed_source": _relative_path(metadrive_curve_path),
            "entry_speed_source_sha256": _file_sha256(metadrive_curve_path),
            "seed": 7,
            "seed_consumption": "recorded; this deterministic model has no stochastic terms",
            "repeats_per_speed": REPEATS_PER_SPEED,
            "repeat_requirement": (
                "observation trace and full mjSTATE_INTEGRATION trace are bitwise identical"
            ),
            "state_signature": "mjSTATE_INTEGRATION",
            "stop_speed_threshold_mps": STOP_SPEED_THRESHOLD_MPS,
            "full_brake_command": "ego_motor ctrl=-8000 N on every integration step",
        },
        "api_contract": {
            "model_load": "mujoco.MjModel.from_xml_path",
            "fresh_state": "mujoco.MjData",
            "advance": "mujoco.mj_step",
            "state_size": "mujoco.mj_stateSize",
            "state_capture": "mujoco.mj_getState(..., mjSTATE_INTEGRATION)",
            "fwdinv_output": (
                "mujoco.MjData.solver_fwdinv two-element array at indices 0 and 1"
            ),
        },
        "curves": [_curve_payload(item) for item in measurements],
        "distribution_summary": {
            "sample_axis": "entry_speed_mps",
            "interpretation": (
                "empirical cross-speed distributions; the N=3 repeats are deterministic "
                "replication checks, not independent stochastic samples"
            ),
            "peak_deceleration_mps2": _distribution(measurements, peaks),
            "steady_deceleration_mps2": _distribution(measurements, steady),
            "mean_deceleration_mps2": _distribution(measurements, means),
            "stopping_distance_m": _distribution(measurements, distances),
            "fwdinv_diagnostic": {
                "speeds_with_comparison_exercised": len(compared_measurements),
                "speeds_without_comparison_exercised": (
                    len(measurements) - len(compared_measurements)
                ),
                "maximum_active_constraint_count": _distribution(
                    measurements, maximum_active_constraints
                ),
                "maximum_joint_space_l2_norm_when_exercised": (
                    _distribution(
                        compared_measurements,
                        [
                            item.fwdinv_diagnostic.maximum_joint_space_l2_norm
                            for item in compared_measurements
                        ],
                    )
                    if compared_measurements
                    else _unavailable_l2_distribution(reason=no_comparison_reason)
                ),
                "maximum_constraint_space_l2_norm_when_exercised": (
                    _distribution(
                        compared_measurements,
                        [
                            item.fwdinv_diagnostic.maximum_constraint_space_l2_norm
                            for item in compared_measurements
                        ],
                    )
                    if compared_measurements
                    else _unavailable_l2_distribution(reason=no_comparison_reason)
                ),
            },
        },
    }


def encode_evidence(evidence: dict[str, Any]) -> str:
    """Return canonical deterministic JSON for the committed calibration record."""
    return json.dumps(evidence, indent=2, sort_keys=True, allow_nan=False) + "\n"


def _repository_state() -> tuple[str, bool]:
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    status = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return commit, bool(status.strip())


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--metadrive-curve", type=Path, default=DEFAULT_METADRIVE_CURVE_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--repeats", type=int, default=REPEATS_PER_SPEED)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        mujoco = require_mujoco()
        speeds = load_entry_speeds(args.metadrive_curve)
        model = load_model(args.model, mujoco=mujoco)
        measurements = tuple(
            measure_entry_speed(
                model,
                entry_speed_mps=speed,
                seed=args.seed,
                repeats=args.repeats,
                mujoco=mujoco,
            )
            for speed in speeds
        )
        repository_commit, repository_dirty = _repository_state()
        evidence = build_evidence(
            measurements,
            model_path=args.model,
            metadrive_curve_path=args.metadrive_curve,
            repository_commit=repository_commit,
            repository_dirty=repository_dirty,
            mujoco=mujoco,
            model=model,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encode_evidence(evidence))
    except (MujocoDependencyError, OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(
        json.dumps(
            {
                "bitwise_identical": True,
                "fwdinv_logged": True,
                "mujoco_version": mujoco.__version__,
                "output": str(args.output.resolve()),
                "repeats_per_speed": args.repeats,
                "speeds": len(measurements),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
