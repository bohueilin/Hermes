"""Focused contracts for the simulation-only esmini/OpenSCENARIO audition."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from types import ModuleType

import pytest

from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.domain.models import ArtifactVerification
from hermes.evidence.artifacts import bundle_digest

TOOL_PATH = (
    Path(__file__).parents[2] / "tools" / "openscenario" / "esmini_cutin_audition.py"
)
SCENARIO_PATH = TOOL_PATH.with_name("adas_cut_in_near.xosc")
ROAD_PATH = TOOL_PATH.with_name("adas_cut_in_near.xodr")
SCENARIO_DIGEST = "989e948e5e49805125c895d21e889d33bc6c45b33c58cf151377888683b56904"
GATE_DIGEST = "026fed87eb047c4c9f2bafcf3383387919f2b0ed9874a0c67227c53f313175d8"
POLICY_DIGEST = "1e01c56e46beb4722015d336e8808849e0065b96fad562465870f2f152807da6"
SHIELD_DIGEST = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
ADAPTER_DIGEST = "eb7fd485e7219d2d3fb2e0a486d1c2b5dc1446c30fe3cf8fa462874d2f3a2ee9"


def _load_tool() -> ModuleType:
    assert TOOL_PATH.is_file(), "the committed esmini audition tool is missing"
    spec = importlib.util.spec_from_file_location("esmini_cutin_audition", TOOL_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _canonical(payload: object) -> bytes:
    return (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _authorize_synthetic_metadrive_fixture(
    monkeypatch: pytest.MonkeyPatch,
    tool: ModuleType,
) -> None:
    """Keep parser-unit fixtures narrow; a separate test uses the real verifier."""

    def internally_consistent(path: Path) -> ArtifactVerification:
        return ArtifactVerification(
            artifact_path=str(path),
            integrity=IntegrityStatus.INTERNALLY_CONSISTENT,
            verdict=Verdict.CONDITIONAL,
        )

    monkeypatch.setattr(tool, "verify_artifact", internally_consistent)


def _write_metadrive_fixture(root: Path, *, simulator_version: str = "0.4.3") -> Path:
    root.mkdir()
    context = {
        "evidence_schema_version": "1.0",
        "run_context": {
            "adapter_name": "metadrive",
            "control_frequency_hz": 10,
            "horizon_steps": 300,
            "scenario_digest": SCENARIO_DIGEST,
            "adapter_config_digest": ADAPTER_DIGEST,
            "gate_config_digest": GATE_DIGEST,
            "policy_name": "adas-longitudinal",
            "policy_version": "1.0",
            "policy_config_digest": POLICY_DIGEST,
            "shield_name": "noop",
            "shield_version": "1.0",
            "shield_config_digest": SHIELD_DIGEST,
            "seed": 7,
        },
        "adapter": {
            "name": "metadrive",
            "version": "1.1",
            "config_digest": ADAPTER_DIGEST,
            "config": {
                "simulator_name": "metadrive",
                "simulator_version": simulator_version,
                "simulator_commit": "85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
                "challenge": {
                    "kind": "cut_in_near_field",
                    "actor_control_mode": "scripted_kinematic_replay",
                    "behavior_realism_claim": False,
                    "initial_gap_m": 32.0,
                    "actor_speed_mps": 12.0,
                    "initial_lane_delta": 1,
                    "trigger_step": 10,
                    "transition_steps": 10,
                },
            },
        },
        "policy": {
            "name": "adas-longitudinal",
            "version": "1.0",
            "config_digest": POLICY_DIGEST,
        },
        "shield": {
            "name": "noop",
            "version": "1.0",
            "config_digest": SHIELD_DIGEST,
        },
    }
    events = [
        {
            "sequence": 0,
            "simulation_time_s": 0.1,
            "run_context": context["run_context"],
            "observation_summary": {
                "input_simulation_time_s": 0.0,
                "speed_mps": 20.0,
                "lateral_offset_m": 0.0,
                "challenge_actor_longitudinal_m": 36.51499938964844,
                "challenge_actor_lateral_offset_m": -3.5,
                "challenge_actor_speed_mps": 12.0,
                "front_distance_m": None,
                "front_relative_speed_mps": None,
                "result_challenge_actor_longitudinal_m": 34.915,
                "result_challenge_actor_lateral_offset_m": -3.5,
                "result_challenge_actor_speed_mps": 12.0,
                "result_front_distance_m": None,
                "result_front_relative_speed_mps": None,
            },
            "candidate_action": {"brake": 0.0, "steering": 0.0, "throttle": 0.0},
            "executed_action": {"brake": 0.0, "steering": 0.0, "throttle": 0.0},
            "vehicle_state": {
                "position_m": 1.6,
                "lateral_offset_m": 0.0,
                "speed_mps": 20.0,
            },
            "terminated": False,
            "truncated": False,
            "termination_reason": "NONE",
            "current_hash": "a" * 64,
        },
        {
            "sequence": 1,
            "simulation_time_s": 0.2,
            "run_context": context["run_context"],
            "observation_summary": {
                "input_simulation_time_s": 0.1,
                "front_distance_m": 19.444827508048217,
                "front_relative_speed_mps": -7.790153503440953,
                "result_challenge_actor_longitudinal_m": 23.17991022886169,
                "result_challenge_actor_lateral_offset_m": -1.2319558823267585,
                "result_challenge_actor_speed_mps": 12.0,
                "result_front_distance_m": 18.664974496973613,
                "result_front_relative_speed_mps": -7.819297790550253,
            },
            "candidate_action": {"brake": 0.0, "steering": 0.0, "throttle": 0.1},
            "executed_action": {"brake": 0.25, "steering": 0.0, "throttle": 0.0},
            "vehicle_state": {
                "position_m": 31.335090637216567,
                "lateral_offset_m": 0.00001621246337890625,
                "speed_mps": 19.819297790541636,
            },
            "terminated": True,
            "truncated": False,
            "termination_reason": "DESTINATION_REACHED",
            "current_hash": "b" * 64,
        },
    ]
    context_bytes = _canonical(context)
    event_bytes = b"".join(_canonical(event) for event in events)
    (root / "execution-context.json").write_bytes(context_bytes)
    (root / "events.jsonl").write_bytes(event_bytes)
    manifest = {
        "scenario_name": "adas_cut_in_near",
        "scenario_schema_version": "4.0",
        "scenario_digest": SCENARIO_DIGEST,
        "seed": 7,
        "control_frequency_hz": 10,
        "horizon_steps": 300,
        "adapter_config_digest": ADAPTER_DIGEST,
        "simulator_name": "metadrive",
        "simulator_version": simulator_version,
        "simulator_commit": "85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
        "repository_commit": "8" * 40,
        "repository_dirty": False,
        "gate_name": "adas_p0",
        "gate_version": "1.0",
        "gate_config_digest": GATE_DIGEST,
        "policy_name": "adas-longitudinal",
        "policy_version": "1.0",
        "policy_config_digest": POLICY_DIGEST,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": SHIELD_DIGEST,
        "trace_digest": "b" * 64,
        "file_digests": {
            "execution-context.json": hashlib.sha256(context_bytes).hexdigest(),
            "events.jsonl": hashlib.sha256(event_bytes).hexdigest(),
        },
    }
    (root / "manifest.json").write_bytes(_canonical(manifest))
    return root


def _replace_metadrive_events(artifact: Path, events: list[dict[str, object]]) -> None:
    event_bytes = b"".join(_canonical(event) for event in events)
    (artifact / "events.jsonl").write_bytes(event_bytes)
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["file_digests"]["events.jsonl"] = hashlib.sha256(event_bytes).hexdigest()
    manifest_path.write_bytes(_canonical(manifest))


def _write_esmini_fixture(
    path: Path,
    *,
    tag: str = "v3.7.1",
    reverse_entities: bool = False,
    actor_length: float = 4.515,
    rotated_actor: bool = False,
) -> Path:
    fields = (
        "Entity_Name [-]",
        "Entity_ID [-]",
        "Current_Speed [m/s]",
        "Wheel_Angle [deg]",
        "Wheel_Rotation [-]",
        "bb_x [m]",
        "bb_y [m]",
        "bb_z [m]",
        "bb_length [m]",
        "bb_width [m]",
        "bb_height [m]",
        "World_Position_X [m]",
        "World_Position_Y [m]",
        "World_Position_Z [m]",
        "Vel_X [m/s]",
        "Vel_Y [m/s]",
        "Vel_Z [m/s]",
        "Acc_X [m/s2]",
        "Acc_Y [m/s2]",
        "Acc_Z [m/s2]",
        "Distance_Travelled_Along_Road_Segment [m]",
        "Lateral_Distance_Lanem [m]",
        "lane_id",
        "lane_offset[m]",
        "World_Heading_Angle [rad]",
        "Heading_Angle_Rate [rad/s]",
        "Relative_Heading_Angle [rad]",
        "Relative_Heading_Angle_Drive_Direction [rad]",
        "World_Pitch_Angle [rad]",
        "Road_Curvature [1/m]",
        "collision_ids",
    )
    header = ["Index [-]", "TimeStamp [s]"]
    for entity_index in (1, 2):
        header.extend(f"#{entity_index} {field}" for field in fields)

    def entity(
        name: str,
        entity_id: int,
        speed: float,
        x: float,
        y: float,
        vx: float,
        vy: float,
        lane_id: int,
        *,
        box_x: float = 0.0,
        heading: float = 0.0,
    ) -> list[object]:
        length = actor_length if name == "CutInActor" else 4.515
        return [
            name,
            entity_id,
            speed,
            0,
            0,
            box_x,
            0,
            0.75,
            length,
            1.852,
            1.5,
            x,
            y,
            0,
            vx,
            vy,
            0,
            0,
            0,
            0,
            x,
            y,
            lane_id,
            0,
            heading,
            0,
            0,
            0,
            0,
            0,
            "",
        ]

    if rotated_actor:
        actor_rows = (
            entity(
                "CutInActor",
                1,
                12.0,
                85.637417562,
                -5.729425539,
                12.0,
                0.0,
                -2,
                box_x=1.0,
                heading=0.5,
            ),
            entity(
                "CutInActor",
                1,
                12.0,
                104.302417562,
                -4.229425539,
                12.0,
                0.0,
                -1,
                box_x=1.0,
                heading=0.5,
            ),
        )
    else:
        actor_rows = (
            entity("CutInActor", 1, 12.0, 86.515, -5.25, 12.0, 0.0, -2),
            entity("CutInActor", 1, 12.0, 105.18, -2.98194, 12.0, 0.0, -1),
        )
    entity_rows = [
        (
            entity("Ego", 0, 20.0, 50.0, -1.75, 20.0, 0.0, -1),
            actor_rows[0],
        ),
        (
            entity("Ego", 0, 20.0, 82.0, -1.75, 20.0, 0.0, -1),
            actor_rows[1],
        ),
    ]
    if reverse_entities:
        entity_rows = [(second, first) for first, second in entity_rows]
    rows = [
        [index, f"{index / 10:.6f}", *first, *second]
        for index, (first, second) in enumerate(entity_rows)
    ]
    lines = [
        "esmini GIT REV: v3.7.1-0-b848e291",
        f"esmini GIT TAG: {tag}",
        "esmini GIT BRANCH: tags/v3.7.1^0",
        "esmini BUILD VERSION: 6348",
        "Scenario File Name: adas_cut_in_near.xosc",
        "Number of Vehicles: 2",
        ", ".join(str(value) for value in header) + ", ",
    ]
    lines.extend(", ".join(str(value) for value in row) + ", " for row in rows)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def test_metadrive_parser_binds_identity_and_uses_recorded_geometry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Wrong bundles or recomputed stand-in geometry must not enter the comparison."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "artifact")

    trace = tool.load_metadrive_trace(artifact)

    assert trace.backend == "metadrive"
    assert trace.identity["scenario_name"] == "adas_cut_in_near"
    assert trace.identity["seed"] == 7
    assert trace.samples[1].ego_route_axis_proxy_m == pytest.approx(31.335090637216567)
    assert trace.samples[1].actor_route_axis_proxy_m == pytest.approx(54.51500086607826)
    assert not hasattr(trace.samples[1], "ego_longitudinal_m")
    assert not hasattr(trace.samples[1], "actor_longitudinal_m")
    assert trace.samples[1].actor_lateral_m == pytest.approx(-1.2319396698633796)
    assert trace.samples[1].bumper_gap_m == pytest.approx(18.664974496973613)
    assert trace.samples[1].closing_speed_mps == pytest.approx(7.819297790550253)
    assert trace.samples[1].controller_observation_ttc_s == pytest.approx(
        19.444827508048217 / 7.790153503440953
    )
    assert trace.samples[1].brake_command == pytest.approx(0.25)


def test_metadrive_parser_rejects_wrong_simulator_version(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Accepting a similarly shaped non-0.4.3 run would invalidate the audition."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(
        tmp_path / "wrong-producer", simulator_version="0.4.2"
    )

    with pytest.raises(tool.AuditionError, match="simulator_version"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_refuses_to_invent_missing_actor_speed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing recorded physical metric must fail, never inherit the scenario declaration."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "missing-speed")
    events_path = artifact / "events.jsonl"
    events = [json.loads(line) for line in events_path.read_text().splitlines()]
    del events[1]["observation_summary"]["result_challenge_actor_speed_mps"]
    event_bytes = b"".join(_canonical(event) for event in events)
    events_path.write_bytes(event_bytes)
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["file_digests"]["events.jsonl"] = hashlib.sha256(event_bytes).hexdigest()
    manifest_path.write_bytes(_canonical(manifest))

    with pytest.raises(tool.AuditionError, match="result actor speed"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_rejects_missing_trace_digests(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing digest fields must not authorize each other through ``None == None``."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "missing-digests")
    events_path = artifact / "events.jsonl"
    events = [json.loads(line) for line in events_path.read_text().splitlines()]
    del events[-1]["current_hash"]
    event_bytes = b"".join(_canonical(event) for event in events)
    events_path.write_bytes(event_bytes)
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    del manifest["trace_digest"]
    manifest["file_digests"]["events.jsonl"] = hashlib.sha256(event_bytes).hexdigest()
    manifest_path.write_bytes(_canonical(manifest))

    with pytest.raises(tool.AuditionError, match="trace_digest"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_rejects_stale_event_hash_after_outer_digest_refresh(
    tmp_path: Path,
    fake_artifact_factory,
) -> None:
    """A refreshed file inventory must not hide stale event-chain geometry."""
    tool = _load_tool()
    source = fake_artifact_factory().artifact_path
    artifact = tmp_path / "stale-event-chain"
    shutil.copytree(source, artifact)

    events_path = artifact / "events.jsonl"
    events = [json.loads(line) for line in events_path.read_text().splitlines()]
    events[0]["vehicle_state"]["position_m"] += 1.0
    event_bytes = b"".join(_canonical(event) for event in events)
    events_path.write_bytes(event_bytes)

    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["file_digests"]["events.jsonl"] = hashlib.sha256(event_bytes).hexdigest()
    manifest_path.write_bytes(_canonical(manifest))
    bundle_payloads = {
        path.name: path.read_bytes()
        for path in artifact.iterdir()
        if path.name != "bundle.sha256"
    }
    (artifact / "bundle.sha256").write_text(
        bundle_digest(bundle_payloads) + "\n",
        encoding="ascii",
    )
    bytes_before_verification = {
        path.name: path.read_bytes() for path in artifact.iterdir()
    }

    with pytest.raises(tool.AuditionError, match="current hash mismatch at sequence 0"):
        tool.load_metadrive_trace(artifact)

    assert {
        path.name: path.read_bytes() for path in artifact.iterdir()
    } == bytes_before_verification


def test_metadrive_parser_rejects_misaligned_result_clock(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Mixing controller-input and result clocks would shift every event marker by one step."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "bad-clock")
    events_path = artifact / "events.jsonl"
    events = [json.loads(line) for line in events_path.read_text().splitlines()]
    events[1]["simulation_time_s"] = 0.25
    event_bytes = b"".join(_canonical(event) for event in events)
    events_path.write_bytes(event_bytes)
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["file_digests"]["events.jsonl"] = hashlib.sha256(event_bytes).hexdigest()
    manifest_path.write_bytes(_canonical(manifest))

    with pytest.raises(tool.AuditionError, match="result clock"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_rejects_wrong_final_termination_reason(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A same-clock collision must not masquerade as the expected destination completion."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "wrong-terminal-reason")
    events = [json.loads(line) for line in (artifact / "events.jsonl").read_text().splitlines()]
    events[-1]["termination_reason"] = "COLLISION"
    _replace_metadrive_events(artifact, events)

    with pytest.raises(tool.AuditionError, match="final terminal tuple"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_rejects_early_terminal_event(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Only the final event may carry the expected terminal tuple."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "early-terminal")
    events = [json.loads(line) for line in (artifact / "events.jsonl").read_text().splitlines()]
    events[0].update(
        terminated=True,
        truncated=False,
        termination_reason="DESTINATION_REACHED",
    )
    _replace_metadrive_events(artifact, events)

    with pytest.raises(tool.AuditionError, match="pre-final terminal tuple"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_rejects_missing_terminal_field(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing terminal fields must fail closed instead of inheriting falsey defaults."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "missing-terminal")
    events = [json.loads(line) for line in (artifact / "events.jsonl").read_text().splitlines()]
    del events[-1]["truncated"]
    _replace_metadrive_events(artifact, events)

    with pytest.raises(tool.AuditionError, match="truncated must be boolean"):
        tool.load_metadrive_trace(artifact)


def test_metadrive_parser_rejects_wrong_recorded_reset_geometry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pinned config identity is insufficient if the recorded reset state is inconsistent."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    artifact = _write_metadrive_fixture(tmp_path / "bad-reset")
    events_path = artifact / "events.jsonl"
    events = [json.loads(line) for line in events_path.read_text().splitlines()]
    # Adjacent binary32 value above binary32(36.515); a chosen 1e-5 tolerance accepts it.
    events[0]["observation_summary"]["challenge_actor_longitudinal_m"] = 36.5150032043457
    event_bytes = b"".join(_canonical(event) for event in events)
    events_path.write_bytes(event_bytes)
    manifest_path = artifact / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["file_digests"]["events.jsonl"] = hashlib.sha256(event_bytes).hexdigest()
    manifest_path.write_bytes(_canonical(manifest))

    with pytest.raises(tool.AuditionError, match="reset actor center separation"):
        tool.load_metadrive_trace(artifact)


def test_esmini_parser_uses_csv_boxes_and_velocities_for_exposure(tmp_path: Path) -> None:
    """Ignoring CSV box geometry or velocity fields must change this hand-worked TTC."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "esmini.csv")

    trace = tool.load_esmini_csv(csv_path)

    assert trace.backend == "esmini"
    assert trace.identity["git_revision"] == "v3.7.1-0-b848e291"
    assert trace.samples[0].in_path is False
    assert trace.samples[1].in_path is True
    assert trace.samples[1].bumper_gap_m == pytest.approx(18.665)
    assert trace.samples[1].closing_speed_mps == pytest.approx(8.0)
    assert trace.samples[1].ttc_s == pytest.approx(18.665 / 8.0)


def test_esmini_parser_rejects_wrong_embedded_version(tmp_path: Path) -> None:
    """CSV shape alone cannot authorize output from an unpinned esmini producer."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "wrong-version.csv", tag="v3.7.0")

    with pytest.raises(tool.AuditionError, match="GIT TAG"):
        tool.load_esmini_csv(csv_path)


def test_esmini_parser_rejects_noncanonical_timestamp_precision(tmp_path: Path) -> None:
    """The v3.7.1 logger contract is exactly six decimals, not any float-equivalent spelling."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "high-precision.csv")
    csv_path.write_text(
        csv_path.read_text().replace("1, 0.100000,", "1, 0.1000000,"),
        encoding="utf-8",
    )

    with pytest.raises(tool.AuditionError, match="canonical six-decimal"):
        tool.load_esmini_csv(csv_path)


def test_esmini_parser_rejects_canonical_timestamp_off_exact_grid(tmp_path: Path) -> None:
    """Six-decimal spelling alone must not authorize a value off the exact 0.1-second grid."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "off-grid.csv")
    csv_path.write_text(
        csv_path.read_text().replace("1, 0.100000,", "1, 0.100001,"),
        encoding="utf-8",
    )

    with pytest.raises(tool.AuditionError):
        tool.load_esmini_csv(csv_path)


def test_esmini_execution_hash_rejects_csv_mutated_before_parse(tmp_path: Path) -> None:
    """A valid CSV substituted after execution must not enter the comparison."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "mutated-after-execution.csv")
    execution = {"raw_csv_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest()}
    csv_path.write_text(
        csv_path.read_text().replace("105.18", "105.19", 1),
        encoding="utf-8",
    )

    parsed = tool.load_esmini_csv(csv_path)

    with pytest.raises(tool.AuditionError, match="execution-to-parse SHA-256"):
        tool.bind_execution_csv_hash(execution, parsed)


def test_esmini_parser_uses_entity_names_not_numbered_block_order(tmp_path: Path) -> None:
    """Reordering valid producer blocks must not silently swap ego and actor geometry."""
    tool = _load_tool()
    normal = tool.load_esmini_csv(_write_esmini_fixture(tmp_path / "normal.csv"))
    reversed_trace = tool.load_esmini_csv(
        _write_esmini_fixture(tmp_path / "reversed.csv", reverse_entities=True)
    )

    assert reversed_trace.samples == normal.samples


def test_esmini_parser_rejects_geometry_that_biases_bumper_gap(tmp_path: Path) -> None:
    """A generic five-metre actor would move every gap/TTC threshold in the comparison."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "wrong-box.csv", actor_length=5.0)

    with pytest.raises(tool.AuditionError, match="box dimensions"):
        tool.load_esmini_csv(csv_path)


def test_esmini_parser_projects_rotated_box_and_nonzero_local_center(tmp_path: Path) -> None:
    """Axis-aligned widths miss this overlap; ignoring local bb_x shifts the actor center."""
    tool = _load_tool()
    csv_path = _write_esmini_fixture(tmp_path / "rotated.csv", rotated_actor=True)

    sample = tool.load_esmini_csv(csv_path).samples[1]

    # esmini CSV emits six decimal places, so the producer's quantization floor is 0.5e-6.
    assert sample.actor_route_axis_proxy_m == pytest.approx(55.18, abs=5e-7)
    assert sample.actor_lateral_m == pytest.approx(-2.0, abs=5e-7)
    assert abs(sample.actor_lateral_m) > 1.852
    assert sample.in_path is True
    expected_actor_half_length = (
        math.cos(0.5) * 4.515 / 2.0 + math.sin(0.5) * 1.852 / 2.0
    )
    assert sample.bumper_gap_m == pytest.approx(23.18 - 4.515 / 2.0 - expected_actor_half_length)


def test_esmini_producer_validation_accepts_only_pinned_native_runtime() -> None:
    """A matching banner without the exact bits and arm64 slice is not this producer."""
    tool = _load_tool()
    raw_file_output = (
        "Mach-O universal binary with 2 architectures: "
        "[x86_64:Mach-O 64-bit executable x86_64] [arm64]\n"
        "/tmp/esmini/bin/esmini (for architecture x86_64): "
        "Mach-O 64-bit executable x86_64\n"
        "/tmp/esmini/bin/esmini (for architecture arm64): "
        "Mach-O 64-bit executable arm64"
    )
    provenance = tool.validate_esmini_producer(
        version_stdout=(
            "esmini GIT REV: v3.7.1-0-b848e291\n"
            "esmini GIT TAG: v3.7.1\n"
            "esmini GIT BRANCH: tags/v3.7.1^0\n"
            "esmini BUILD VERSION: 6348\n"
        ),
        version_stderr="",
        version_returncode=255,
        file_output=raw_file_output,
        lipo_output="x86_64 arm64",
        host_system="Darwin",
        host_machine="arm64",
        archive_sha256="b69e08691319fe8041027687a5b678a5e18e4c5775cb5708362707940c534079",
        binary_sha256="20d53493cee342cd4dd1b5139d1bafc0ebb5e7793ac8991457d13aa53115e999",
    )

    assert provenance["native_architecture"] == "arm64"
    assert provenance["host_system"] == "Darwin"
    assert provenance["host_machine"] == "arm64"
    assert provenance["version_probe_returncode"] == 255
    assert "/tmp/esmini" not in provenance["file_output"]
    assert provenance["file_output"].count("<ESMINI_BIN>") == 2
    assert provenance["file_output_sha256"] == hashlib.sha256(
        raw_file_output.encode()
    ).hexdigest()

    with pytest.raises(tool.AuditionError, match="arm64"):
        tool.validate_esmini_producer(
            version_stdout=provenance["version_output"],
            version_stderr="",
            version_returncode=255,
            file_output="Mach-O 64-bit executable x86_64",
            lipo_output="x86_64",
            host_system="Darwin",
            host_machine="arm64",
            archive_sha256=provenance["archive_sha256"],
            binary_sha256=provenance["executable_sha256"],
        )


def test_native_invocation_is_fixed_step_seeded_and_sanitizes_config(tmp_path: Path) -> None:
    """Ambient esmini config or a non-arm64 launch would make the producer non-reproducible."""
    tool = _load_tool()
    command = tool.esmini_command(
        binary=tmp_path / "esmini",
        scenario=SCENARIO_PATH,
        raw_csv=tmp_path / "raw.csv",
    )
    environment = tool.sanitized_esmini_environment(
        {"PATH": "/usr/bin", "ESMINI_CONFIG_FILE": "/tmp/ambient.yml"}
    )

    assert command[:3] == ["/usr/bin/arch", "-arm64", str(tmp_path / "esmini")]
    assert command[3:] == [
        "--headless",
        "--fixed_timestep",
        "0.1",
        "--seed",
        "7",
        "--csv_logger",
        str(tmp_path / "raw.csv"),
        "--disable_log",
        "--disable_stdout",
        "--osc",
        str(SCENARIO_PATH.resolve()),
    ]
    assert environment == {"PATH": "/usr/bin"}


def test_summary_and_svg_are_deterministic_and_bound_response_attribution(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Controller-confounded post-brake deltas must not be labelled scenario semantics."""
    tool = _load_tool()
    _authorize_synthetic_metadrive_fixture(monkeypatch, tool)
    metadrive = tool.load_metadrive_trace(_write_metadrive_fixture(tmp_path / "metadrive"))
    esmini = tool.load_esmini_csv(_write_esmini_fixture(tmp_path / "esmini.csv"))
    provenance = tool.validate_esmini_producer(
        version_stdout=tool.EXPECTED_ESMINI_VERSION_OUTPUT,
        version_stderr="",
        version_returncode=255,
        file_output="Mach-O universal binary arm64 x86_64",
        lipo_output="x86_64 arm64",
        host_system="Darwin",
        host_machine="arm64",
        archive_sha256=tool.EXPECTED_ESMINI_ARCHIVE_SHA256,
        binary_sha256=tool.EXPECTED_ESMINI_EXECUTABLE_SHA256,
    )
    sources = {
        "openscenario_sha256": "a" * 64,
        "opendrive_sha256": "b" * 64,
        "metadrive_manifest_sha256": "c" * 64,
    }

    first = tool.build_comparison_summary(
        metadrive,
        esmini,
        producer_provenance=provenance,
        source_hashes=sources,
        expected_metadrive_horizon_s=0.2,
        expected_esmini_horizon_s=0.1,
    )
    second = tool.build_comparison_summary(
        metadrive,
        esmini,
        producer_provenance=provenance,
        source_hashes=sources,
        expected_metadrive_horizon_s=0.2,
        expected_esmini_horizon_s=0.1,
    )
    summary_bytes = tool.summary_json_bytes(first)
    svg_bytes = tool.comparison_svg_bytes(metadrive, esmini, first)

    assert summary_bytes == tool.summary_json_bytes(second)
    assert svg_bytes == tool.comparison_svg_bytes(metadrive, esmini, second)
    assert first["scope"] == "SIMULATION-ONLY / NOT HERMES EVIDENCE"
    response = first["controller_response"]
    assert response["first_executed_brake_input_time_s"] == pytest.approx(0.1)
    assert response["first_executed_brake_result_time_s"] == pytest.approx(0.2)
    assert first["comparison"]["pre_response_comparison_cutoff_s"] == pytest.approx(0.1)
    assert "scenario_semantics_attribution_through_s" not in first["comparison"]
    assert first["backends"]["metadrive"]["terminal_event"] == {
        "terminated": True,
        "truncated": False,
        "termination_reason": "DESTINATION_REACHED",
    }
    assert "terminal_event" not in first["backends"]["esmini"]
    assert first["comparison"]["post_cutoff_label"] == "CONTROLLER_RESPONSE_CONFOUNDED"
    assert first["comparison"]["pre_cutoff_label"] == (
        "SCENARIO_BACKEND_AND_NON_BRAKING_CONTROLLER_DYNAMICS"
    )
    assert first["comparison"]["route_axis_proxy"] == {
        "claim_boundary": "straight-road comparison proxy; not exact cross-backend world position",
        "metadrive_ego_source": "VehicleState.position_m cumulative traveled path distance",
        "metadrive_actor_source": (
            "ego path-distance proxy plus recorded actor center longitudinal relative to ego"
        ),
        "esmini_source": (
            "recorded bounding-box center world X relative to initial ego on the straight road"
        ),
    }
    delta_fields = first["comparison"]["maximum_deltas_through_cutoff"]
    assert "ego_route_axis_proxy_m" in delta_fields
    assert "actor_route_axis_proxy_m" in delta_fields
    assert "ego_longitudinal_m" not in delta_fields
    assert "actor_longitudinal_m" not in delta_fields
    assert set(first["semantic_findings"]) >= {
        "lateral_interpolation",
        "oriented_pose_mismatch",
        "metadrive_actor_first_interval",
        "pre_brake_ego_mismatch",
    }
    assert b"not backend parity" in svg_bytes
    assert b"executed brake input" in svg_bytes
    assert b'aria-label="time tick 0.100 s"' in svg_bytes
    assert b'aria-label="lateral tick -4.0 m"' in svg_bytes
    assert b'aria-label="gap tick 35 m"' in svg_bytes


def test_output_writer_reports_hashes_of_exact_written_bytes(tmp_path: Path) -> None:
    """Hashing a reserialized stand-in would not prove the reviewable files deterministic."""
    tool = _load_tool()
    summary_bytes = b'{"scope":"SIMULATION-ONLY / NOT HERMES EVIDENCE"}\n'
    svg_bytes = b"<svg><!-- SIMULATION-ONLY / NOT HERMES EVIDENCE --></svg>\n"
    summary_path = tmp_path / "summary.json"
    svg_path = tmp_path / "plot.svg"

    first = tool.write_outputs(summary_path, svg_path, summary_bytes, svg_bytes)
    second = tool.write_outputs(summary_path, svg_path, summary_bytes, svg_bytes)

    assert summary_path.read_bytes() == summary_bytes
    assert svg_path.read_bytes() == svg_bytes
    assert first == second == {
        "summary_sha256": hashlib.sha256(summary_bytes).hexdigest(),
        "svg_sha256": hashlib.sha256(svg_bytes).hexdigest(),
    }


def test_output_paths_cannot_alias_each_other_or_raw_csv(tmp_path: Path) -> None:
    """An output-path typo must not erase the raw producer trace or the other review output."""
    tool = _load_tool()
    same_path = tmp_path / "same-output"

    with pytest.raises(tool.AuditionError, match="distinct"):
        tool.write_outputs(same_path, same_path, b"summary", b"svg")
    with pytest.raises(tool.AuditionError, match="distinct"):
        tool.validate_output_paths(
            raw_csv=same_path,
            summary_path=same_path,
            svg_path=tmp_path / "plot.svg",
        )


@pytest.mark.parametrize("protected_option", ["--raw-csv", "--summary-out", "--svg-out"])
def test_cli_rejects_any_output_under_comparator_artifact_root(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    protected_option: str,
) -> None:
    """No output may add or overwrite any file inside the comparator bundle."""
    tool = _load_tool()
    artifact = tmp_path / "artifact"
    artifact.mkdir()
    outputs = {
        "--raw-csv": tmp_path / "raw.csv",
        "--summary-out": tmp_path / "summary.json",
        "--svg-out": tmp_path / "plot.svg",
    }
    outputs[protected_option] = artifact / "findings.json"
    argv = [
        "--esmini-bin",
        str(tmp_path / "missing-esmini"),
        "--esmini-archive",
        str(tmp_path / "missing-archive.zip"),
        "--hermes-artifact",
        str(artifact),
    ]
    for option, path in outputs.items():
        argv.extend((option, str(path)))

    assert tool.main(argv) == 2
    assert "comparator artifact root" in capsys.readouterr().err


def test_normalized_esmini_trace_bytes_are_canonical_and_path_free(tmp_path: Path) -> None:
    """A stable summary hash alone does not prove the normalized trajectory bytes stable."""
    tool = _load_tool()
    trace = tool.load_esmini_csv(_write_esmini_fixture(tmp_path / "raw.csv"))

    first = tool.normalized_trace_jsonl_bytes(trace)
    second = tool.normalized_trace_jsonl_bytes(trace)

    assert first == second
    assert len(first.splitlines()) == 2
    assert str(tmp_path).encode() not in first
    payload = json.loads(first.splitlines()[1])
    assert payload["time_s"] == pytest.approx(0.1)
    assert payload["actor_lateral_m"] == pytest.approx(-1.23194)
    assert payload["actor_route_axis_proxy_m"] == pytest.approx(55.18)
    assert "actor_longitudinal_m" not in payload


def test_openscenario_translation_preserves_cut_in_contract() -> None:
    """Wrong speed, geometry, trigger, or interpolation changes the translated scenario."""
    assert SCENARIO_PATH.is_file(), "the OpenSCENARIO translation is missing"
    root = ET.parse(SCENARIO_PATH).getroot()

    header = root.find("FileHeader")
    assert header is not None
    assert "SIMULATION-ONLY / NOT HERMES EVIDENCE" in header.attrib["description"]
    logic_file = root.find("./RoadNetwork/LogicFile")
    assert logic_file is not None
    assert logic_file.attrib["filepath"] == ROAD_PATH.name

    objects = {item.attrib["name"]: item for item in root.findall("./Entities/ScenarioObject")}
    assert set(objects) == {"Ego", "CutInActor"}
    for item in objects.values():
        center = item.find("./Vehicle/BoundingBox/Center")
        dimensions = item.find("./Vehicle/BoundingBox/Dimensions")
        front_axle = item.find("./Vehicle/Axles/FrontAxle")
        rear_axle = item.find("./Vehicle/Axles/RearAxle")
        assert center is not None and dimensions is not None
        assert front_axle is not None and rear_axle is not None
        assert float(center.attrib["x"]) == 0.0
        assert float(dimensions.attrib["length"]) == 4.515
        assert float(dimensions.attrib["width"]) == 1.852
        assert float(front_axle.attrib["positionX"]) == 2.46894
        assert float(rear_axle.attrib["positionX"]) == 0.0

    private = {
        item.attrib["entityRef"]: item for item in root.findall("./Storyboard/Init/Actions/Private")
    }
    ego_lane = private["Ego"].find("./PrivateAction/TeleportAction/Position/LanePosition")
    actor_lane = private["CutInActor"].find(
        "./PrivateAction/TeleportAction/Position/LanePosition"
    )
    assert ego_lane is not None and actor_lane is not None
    assert (ego_lane.attrib["laneId"], float(ego_lane.attrib["s"])) == ("-1", 50.0)
    assert (actor_lane.attrib["laneId"], float(actor_lane.attrib["s"])) == (
        "-2",
        86.515,
    )
    assert float(actor_lane.attrib["s"]) - float(ego_lane.attrib["s"]) - 4.515 == 32.0

    speeds = {
        name: float(
            item.find(
                "./PrivateAction/LongitudinalAction/SpeedAction/SpeedActionTarget/"
                "AbsoluteTargetSpeed"
            ).attrib["value"]
        )
        for name, item in private.items()
    }
    assert speeds == {"Ego": 20.0, "CutInActor": 12.0}

    dynamics = root.find(".//LaneChangeActionDynamics")
    target = root.find(".//LaneChangeTarget/AbsoluteTargetLane")
    cut_in_trigger = root.find(
        ".//Condition[@name='CutInAtOneSecond']/ByValueCondition/SimulationTimeCondition"
    )
    assert dynamics is not None and target is not None and cut_in_trigger is not None
    assert dynamics.attrib == {
        "dynamicsShape": "cubic",
        "dynamicsDimension": "time",
        "value": "1.0",
    }
    assert target.attrib["value"] == "-1"
    assert cut_in_trigger.attrib == {"value": "1.0", "rule": "greaterOrEqual"}
    act_trigger = root.find(
        ".//Condition[@name='ActStarts']/ByValueCondition/SimulationTimeCondition"
    )
    assert act_trigger is not None
    assert act_trigger.attrib == {"value": "0", "rule": "greaterThan"}


def test_opendrive_input_is_a_two_lane_straight_3_5_m_road() -> None:
    """A lane-width or curvature change biases the lateral-overlap comparison."""
    assert ROAD_PATH.is_file(), "the required local OpenDRIVE road is missing"
    root = ET.parse(ROAD_PATH).getroot()
    road = root.find("road")
    assert road is not None
    assert float(road.attrib["length"]) == 300.0
    geometry = road.find("./planView/geometry")
    assert geometry is not None and geometry.find("line") is not None
    lanes = road.findall("./lanes/laneSection/right/lane")
    assert [lane.attrib["id"] for lane in lanes] == ["-1", "-2"]
    assert [float(lane.find("width").attrib["a"]) for lane in lanes] == [3.5, 3.5]
