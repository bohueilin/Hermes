"""Unit contract for the committed MetaDrive brake-curve measurement tool."""

from __future__ import annotations

import importlib.util
import json
import struct
from pathlib import Path
from types import ModuleType

import numpy as np
import pytest

TOOL_PATH = Path(__file__).parents[2] / "tools" / "calibration" / "metadrive_brake_curve.py"


def _load_tool() -> ModuleType:
    assert TOOL_PATH.is_file(), "the committed MetaDrive brake-curve tool is missing"
    spec = importlib.util.spec_from_file_location("metadrive_brake_curve", TOOL_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_summary_includes_first_interval_and_divides_mean_by_intervals() -> None:
    """Removing interval zero or dividing by four samples must break this hand-worked case."""
    tool = _load_tool()
    points = (
        tool.TracePoint(time_s=0.0, speed_mps=3.0, longitudinal_position_m=0.0),
        tool.TracePoint(time_s=0.1, speed_mps=1.7, longitudinal_position_m=0.25),
        tool.TracePoint(time_s=0.2, speed_mps=0.58, longitudinal_position_m=0.40),
        tool.TracePoint(time_s=0.3, speed_mps=0.20, longitudinal_position_m=0.45),
    )

    summary = tool.summarize_trace(
        points,
        decision_interval_s=0.1,
        stop_speed_threshold_mps=0.3,
    )

    # Intervals are 13.0, 11.2, and 3.8 m/s^2. The steady window is interval 1.
    assert summary.peak_deceleration_mps2 == pytest.approx(13.0)
    assert summary.steady_deceleration_mps2 == pytest.approx(11.2)
    assert summary.mean_deceleration_mps2 == pytest.approx(28.0 / 3.0)
    assert summary.braking_interval_count == 3
    assert summary.steady_interval_indices == (1,)
    assert summary.stopping_distance_m == pytest.approx(0.45)


def test_speed_sweep_config_and_action_are_binary32_projected() -> None:
    """A new command path must not send binary64 values into MetaDrive's float32 Box."""
    tool = _load_tool()

    assert tool.entry_speeds_mps() == tuple(float(value) for value in range(4, 31, 2))
    assert 20.0 in tool.entry_speeds_mps()

    entry_speed = 20.1
    projected = struct.unpack("!f", struct.pack("!f", entry_speed))[0]
    config = tool.metadrive_config(entry_speed_mps=entry_speed, seed=7)
    action = tool.full_brake_action()

    assert config["map"] == "S"
    assert config["traffic_density"] == 0.0
    assert config["start_seed"] == 7
    assert config["num_scenarios"] == 1
    assert config["physics_world_step_size"] == 0.02
    assert config["decision_repeat"] == 5
    assert config["vehicle_config"]["spawn_velocity"] == [projected, 0.0]
    assert action.dtype.name == "float32"
    assert action.tolist() == [0.0, -1.0]


def test_repeat_identity_compares_float_bits_not_numeric_equality() -> None:
    """A signed-zero bit change must fail even though Python says the values are equal."""
    tool = _load_tool()
    positive_zero = (
        tool.TracePoint(time_s=0.0, speed_mps=2.0, longitudinal_position_m=0.0),
        tool.TracePoint(time_s=0.1, speed_mps=0.0, longitudinal_position_m=1.0),
    )
    negative_zero = (
        tool.TracePoint(time_s=0.0, speed_mps=2.0, longitudinal_position_m=-0.0),
        tool.TracePoint(time_s=0.1, speed_mps=0.0, longitudinal_position_m=1.0),
    )

    assert tool.assert_bitwise_identical((positive_zero, positive_zero))
    with pytest.raises(ValueError, match="repeat trace 2 differs bitwise"):
        tool.assert_bitwise_identical((positive_zero, negative_zero))


def test_environment_construction_retries_only_index_error() -> None:
    """The documented headless graphics-pipe IndexError is the sole retryable failure."""
    tool = _load_tool()
    sentinel = object()
    attempts = 0

    def flaky_factory(_config: dict[str, object]) -> object:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise IndexError("engine_core.py:213")
        return sentinel

    assert tool.construct_environment(flaky_factory, {}) is sentinel
    assert attempts == 3

    def invalid_factory(_config: dict[str, object]) -> object:
        raise ValueError("invalid MetaDrive config")

    with pytest.raises(ValueError, match="invalid MetaDrive config"):
        tool.construct_environment(invalid_factory, {})


def test_measurement_runs_three_fresh_episodes_and_emits_bridge_distributions(
    tmp_path: Path,
) -> None:
    """Removing repeat validation or the bridge payload must break the committed contract."""
    tool = _load_tool()
    created: list[object] = []

    class Agent:
        def __init__(self) -> None:
            self.speed = 3.0
            self.position = np.asarray([0.0, 0.0])
            self.heading = np.asarray([1.0, 0.0])

    class Environment:
        def __init__(self, config: dict[str, object]) -> None:
            self.config = config
            self.agent = Agent()
            self._step = 0
            self.closed = False

        def reset(self, *, seed: int) -> tuple[object, dict[str, object]]:
            assert seed == 7
            return object(), {"velocity": self.agent.speed}

        def step(
            self, action: np.ndarray
        ) -> tuple[object, float, bool, bool, dict[str, object]]:
            assert action.dtype.name == "float32"
            assert action.tolist() == [0.0, -1.0]
            speeds = (1.7, 0.58, 0.20)
            positions = (0.25, 0.40, 0.45)
            self.agent.speed = speeds[self._step]
            self.agent.position = np.asarray([positions[self._step], 0.0])
            self._step += 1
            return object(), 0.0, False, False, {"velocity": self.agent.speed}

        def close(self) -> None:
            self.closed = True

    def factory(config: dict[str, object]) -> Environment:
        environment = Environment(config)
        created.append(environment)
        return environment

    measurement = tool.measure_entry_speed(
        factory,
        entry_speed_mps=3.0,
        seed=7,
        repeats=3,
    )

    assert len(created) == 3
    assert all(environment.closed for environment in created)
    assert measurement.entry_speed_command_mps == 3.0
    assert measurement.summary.peak_deceleration_mps2 == pytest.approx(13.0)
    assert len(set(measurement.repeat_trace_sha256)) == 1

    evidence = tool.build_evidence(
        (measurement,),
        simulator_version="0.4.3",
        simulator_commit="a" * 40,
        simulator_source="third_party/metadrive",
        seed=7,
        repeats=3,
    )

    assert evidence["consumers"] == ["fleetlab-travel-bridge"]
    assert evidence["measurement_protocol"]["entry_speeds_mps"] == [3.0]
    assert evidence["measurement_protocol"]["repeats_per_speed"] == 3
    assert evidence["curves"][0]["braking_interval_count"] == 3
    assert evidence["curves"][0]["steady_interval_indices"] == [1]
    assert evidence["curves"][0]["metadrive_config"]["map"] == "S"
    assert evidence["bridge_summary"]["deceleration_distributions_mps2"]["peak"][
        "samples_by_entry_speed_mps"
    ] == [{"entry_speed_mps": 3.0, "value": 13.0}]
    assert evidence["bridge_summary"]["stopping_distance_distribution_m"][
        "samples_by_entry_speed_mps"
    ] == [{"entry_speed_mps": 3.0, "value": 0.45}]

    output = tmp_path / "curve.json"
    tool.write_evidence(output, evidence)
    assert json.loads(output.read_text(encoding="utf-8")) == evidence
    assert output.read_bytes().endswith(b"\n")
