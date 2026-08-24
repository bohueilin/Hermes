"""Behavior contract for the optional MuJoCo brake-reference instrument."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tomllib
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).parents[2]
TOOL_PATH = REPO_ROOT / "tools" / "calibration" / "mujoco_brake_reference.py"
MODEL_PATH = REPO_ROOT / "tools" / "calibration" / "mujoco_brake_reference.xml"
METADRIVE_CURVE_PATH = (
    REPO_ROOT / "evidence" / "calibration" / "metadrive-brake-curve-0.4.3.json"
)


def _load_tool() -> ModuleType:
    assert TOOL_PATH.is_file(), "the committed MuJoCo brake-reference tool is missing"
    spec = importlib.util.spec_from_file_location("mujoco_brake_reference", TOOL_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_mujoco_dependency_is_exactly_pinned_behind_optional_extra() -> None:
    """Moving MuJoCo into core or loosening its version must break this dependency boundary."""
    project = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())

    assert "mujoco" not in " ".join(project["project"]["dependencies"]).lower()
    assert project["project"]["optional-dependencies"]["mujoco-cal"] == ["mujoco==3.12.0"]


def test_missing_optional_dependency_refuses_loudly_with_install_guidance() -> None:
    """Running without site packages must fail before producing fabricated measurements."""
    result = subprocess.run(
        [sys.executable, "-S", str(TOOL_PATH)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    assert "mujoco==3.12.0" in result.stderr
    assert "pip install -e '.[mujoco-cal]'" in result.stderr


def test_speed_contract_is_consumed_from_the_committed_wp_a_curve() -> None:
    """A missing, reordered, or substituted WP-A speed sweep must fail closed."""
    tool = _load_tool()

    speeds = tool.load_entry_speeds(METADRIVE_CURVE_PATH)

    assert speeds == tuple(float(value) for value in range(4, 31, 2))
    assert len(speeds) == 14
    assert speeds[8] == 20.0


def test_compiled_model_freezes_required_physics_defaults() -> None:
    """Regression to Euler, autoreset, zero armature, or disabled fwdinv must fail."""
    tool = _load_tool()
    mujoco = tool.require_mujoco()
    model = tool.load_model(MODEL_PATH, mujoco=mujoco)

    assert mujoco.mjtIntegrator(model.opt.integrator) == mujoco.mjtIntegrator.mjINT_IMPLICITFAST
    assert model.opt.enableflags & int(mujoco.mjtEnableBit.mjENBL_FWDINV)
    assert model.opt.disableflags & int(mujoco.mjtDisableBit.mjDSBL_AUTORESET)
    assert model.nu == 2
    assert all(float(value) > 0.0 for value in model.dof_armature)

    assumptions = tool.model_assumptions(model, mujoco=mujoco)
    assert assumptions["lead_actor_role"] == "scripted-kinematic"
    assert assumptions["lead_behavior_realism_claim"] is False
    assert assumptions["ego_full_brake_force_n"] == 8000.0


def test_real_measurement_hashes_full_integration_state_and_logs_fwdinv() -> None:
    """Dropping warmstart state, repeat checks, or either fwdinv residual must fail."""
    tool = _load_tool()
    mujoco = tool.require_mujoco()
    model = tool.load_model(MODEL_PATH, mujoco=mujoco)

    measurement = tool.measure_entry_speed(
        model,
        entry_speed_mps=4.0,
        seed=7,
        repeats=3,
        mujoco=mujoco,
    )

    assert measurement.entry_speed_mps == 4.0
    assert measurement.summary.stopping_distance_m > 0.0
    assert measurement.summary.peak_deceleration_mps2 > 0.0
    assert measurement.integration_state_name == "mjSTATE_INTEGRATION"
    assert measurement.integration_state_size > model.nq + model.nv
    assert len(set(measurement.repeat_integration_state_trace_sha256)) == 1
    assert len(set(measurement.repeat_observation_trace_sha256)) == 1
    assert measurement.warning_count == 0
    assert measurement.fwdinv_residual.maximum_joint_space_relative >= 0.0
    assert measurement.fwdinv_residual.maximum_constraint_space_relative >= 0.0
    assert measurement.trace[-1].speed_mps <= tool.STOP_SPEED_THRESHOLD_MPS
    assert all(point.integration_state_sha256 for point in measurement.trace)


def test_evidence_is_deterministic_and_emits_distribution_not_trajectory_claims() -> None:
    """The calibration output must expose distributions and its non-release scope."""
    tool = _load_tool()
    mujoco = tool.require_mujoco()
    model = tool.load_model(MODEL_PATH, mujoco=mujoco)
    measurement = tool.measure_entry_speed(
        model,
        entry_speed_mps=4.0,
        seed=7,
        repeats=3,
        mujoco=mujoco,
    )

    evidence = tool.build_evidence(
        (measurement,),
        model_path=MODEL_PATH,
        metadrive_curve_path=METADRIVE_CURVE_PATH,
        repository_commit="a" * 40,
        repository_dirty=False,
        mujoco=mujoco,
        model=model,
    )
    encoded_a = tool.encode_evidence(evidence)
    encoded_b = tool.encode_evidence(evidence)
    decoded = json.loads(encoded_a)

    assert encoded_a == encoded_b
    assert decoded["instrument_role"] == "optional_calibration_instrument"
    assert decoded["release_evidence_lane"] is False
    assert decoded["simulator_adapter"] is False
    assert decoded["measurement_protocol"]["state_signature"] == "mjSTATE_INTEGRATION"
    assert decoded["model_assumptions"]["lead_actor_role"] == "scripted-kinematic"
    assert "representative_trace" not in decoded["curves"][0]
    assert decoded["curves"][0]["trace_retention"] == (
        "replay inputs plus observation and mjSTATE_INTEGRATION trace SHA-256 digests"
    )
    assert decoded["curves"][0]["fwdinv_residual"]["semantics"][0].startswith(
        "joint-space relative norm"
    )
    assert decoded["distribution_summary"]["sample_axis"] == "entry_speed_mps"
    assert decoded["distribution_summary"]["stopping_distance_m"]["sample_count"] == 1
    assert "trajectory" not in decoded["cross_backend_claim_contract"].lower()
    assert decoded["simulator"]["version"] == "3.12.0"


def test_measurement_rejects_any_repeat_count_other_than_three() -> None:
    """Weakening N=3 to a single deterministic run must fail before simulation."""
    tool = _load_tool()
    mujoco = tool.require_mujoco()
    model = tool.load_model(MODEL_PATH, mujoco=mujoco)

    with pytest.raises(ValueError, match="exactly N=3"):
        tool.measure_entry_speed(
            model,
            entry_speed_mps=4.0,
            seed=7,
            repeats=1,
            mujoco=mujoco,
        )
