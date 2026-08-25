"""Self-consistency contract for the committed MetaDrive calibration record."""

from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

import pytest

CURVE_PATH = (
    Path(__file__).parents[2]
    / "evidence"
    / "calibration"
    / "metadrive-brake-curve-0.4.3.json"
)


def _trace_digest(trace: list[dict[str, float]]) -> str:
    return hashlib.sha256(
        b"".join(
            struct.pack(
                "!ddd",
                point["time_s"],
                point["speed_mps"],
                point["longitudinal_position_m"],
            )
            for point in trace
        )
    ).hexdigest()


def test_committed_metadrive_curve_is_self_consistent() -> None:
    """Every committed sweep point must match its repeat digests and embedded trace."""
    evidence = json.loads(CURVE_PATH.read_text(encoding="utf-8"))
    curves = evidence["curves"]

    assert [curve["entry_speed_command_mps"] for curve in curves] == list(
        range(4, 31, 2)
    )

    for curve in curves:
        trace = curve["trace"]
        repeat_digests = curve["repeat_trace_sha256"]
        assert len(repeat_digests) == 3
        assert len(set(repeat_digests)) == 1
        assert curve["repeat_bitwise_identical"] is True
        assert _trace_digest(trace) == repeat_digests[0]

        decelerations = [
            (trace[index]["speed_mps"] - trace[index + 1]["speed_mps"])
            / (trace[index + 1]["time_s"] - trace[index]["time_s"])
            for index in range(len(trace) - 1)
        ]
        steady_indices = curve["steady_interval_indices"]
        assert curve["braking_interval_count"] == len(decelerations)
        assert curve["peak_deceleration_mps2"] == pytest.approx(max(decelerations))
        assert curve["steady_deceleration_mps2"] == pytest.approx(
            sum(decelerations[index] for index in steady_indices) / len(steady_indices)
        )
        assert curve["mean_deceleration_mps2"] == pytest.approx(
            sum(decelerations) / len(decelerations)
        )
        assert curve["stopping_distance_m"] == pytest.approx(
            trace[-1]["longitudinal_position_m"] - trace[0]["longitudinal_position_m"]
        )
