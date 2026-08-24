#!/usr/bin/env python3
"""Deterministic esmini/OpenSCENARIO audition against one Hermes MetaDrive run.

SIMULATION-ONLY / NOT HERMES EVIDENCE. This tool compares recorded simulation geometry;
it does not establish backend parity, real-world safety, certification, or production fitness.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import platform
import subprocess
import sys
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

EXPECTED_METADRIVE_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"
EXPECTED_SCENARIO_DIGEST = (
    "989e948e5e49805125c895d21e889d33bc6c45b33c58cf151377888683b56904"
)
EXPECTED_GATE_DIGEST = "026fed87eb047c4c9f2bafcf3383387919f2b0ed9874a0c67227c53f313175d8"
EXPECTED_POLICY_DIGEST = "1e01c56e46beb4722015d336e8808849e0065b96fad562465870f2f152807da6"
EXPECTED_SHIELD_DIGEST = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
EXPECTED_ADAPTER_DIGEST = "eb7fd485e7219d2d3fb2e0a486d1c2b5dc1446c30fe3cf8fa462874d2f3a2ee9"
ESMINI_ASSET_URL = "https://github.com/esmini/esmini/releases/download/v3.7.1/esmini-bin_macOS.zip"
EXPECTED_ESMINI_ARCHIVE_SHA256 = (
    "b69e08691319fe8041027687a5b678a5e18e4c5775cb5708362707940c534079"
)
EXPECTED_ESMINI_EXECUTABLE_SHA256 = (
    "20d53493cee342cd4dd1b5139d1bafc0ebb5e7793ac8991457d13aa53115e999"
)
EXPECTED_ESMINI_VERSION_OUTPUT = (
    "esmini GIT REV: v3.7.1-0-b848e291\n"
    "esmini GIT TAG: v3.7.1\n"
    "esmini GIT BRANCH: tags/v3.7.1^0\n"
    "esmini BUILD VERSION: 6348\n"
)
EXPECTED_CHALLENGE: dict[str, object] = {
    "kind": "cut_in_near_field",
    "actor_control_mode": "scripted_kinematic_replay",
    "behavior_realism_claim": False,
    "initial_gap_m": 32.0,
    "actor_speed_mps": 12.0,
    "initial_lane_delta": 1,
    "trigger_step": 10,
    "transition_steps": 10,
}


class AuditionError(ValueError):
    """A fail-closed input, producer, or comparison-contract violation."""


@dataclass(frozen=True, slots=True)
class TrajectorySample:
    """One backend sample normalized to the straight-road comparison frame."""

    time_s: float
    ego_longitudinal_m: float
    ego_lateral_m: float
    ego_speed_mps: float
    actor_longitudinal_m: float
    actor_lateral_m: float
    actor_speed_mps: float
    in_path: bool
    bumper_gap_m: float | None
    closing_speed_mps: float | None
    ttc_s: float | None
    controller_observation_time_s: float | None = None
    controller_observation_ttc_s: float | None = None
    brake_command: float | None = None


@dataclass(frozen=True, slots=True)
class BackendTrace:
    """Normalized samples plus the producer identity that authorized them."""

    backend: str
    identity: dict[str, object]
    samples: tuple[TrajectorySample, ...]


def validate_esmini_producer(
    *,
    version_stdout: str,
    version_stderr: str,
    version_returncode: int,
    file_output: str,
    lipo_output: str,
    host_system: str,
    host_machine: str,
    archive_sha256: str,
    binary_sha256: str,
) -> dict[str, object]:
    """Authorize exactly the official native-arm64 esmini 3.7.1 producer."""

    _expect_equal("esmini version stdout", version_stdout, EXPECTED_ESMINI_VERSION_OUTPUT)
    _expect_equal("esmini version stderr", version_stderr, "")
    # v3.7.1 has the unusual but observed contract of returning 255 for --version.
    _expect_equal("esmini version return code", version_returncode, 255)
    _expect_equal("host system", host_system, "Darwin")
    _expect_equal("host machine", host_machine, "arm64")
    if "arm64" not in file_output or "arm64" not in lipo_output.split():
        raise AuditionError("esmini executable must contain an arm64 Mach-O slice")
    _expect_equal("esmini archive SHA-256", archive_sha256, EXPECTED_ESMINI_ARCHIVE_SHA256)
    _expect_equal("esmini executable SHA-256", binary_sha256, EXPECTED_ESMINI_EXECUTABLE_SHA256)
    normalized_file_lines = []
    for line in file_output.splitlines():
        marker = " (for architecture "
        normalized_file_lines.append(
            f"<ESMINI_BIN>{line[line.index(marker):]}" if marker in line else line
        )
    return {
        "asset_url": ESMINI_ASSET_URL,
        "archive_sha256": archive_sha256,
        "executable_sha256": binary_sha256,
        "file_output": "\n".join(normalized_file_lines),
        "file_output_sha256": hashlib.sha256(file_output.encode("utf-8")).hexdigest(),
        "lipo_architectures": lipo_output,
        "native_architecture": "arm64",
        "host_system": host_system,
        "host_machine": host_machine,
        "version_output": version_stdout,
        "version_probe_returncode": version_returncode,
    }


def esmini_command(*, binary: Path, scenario: Path, raw_csv: Path) -> list[str]:
    """Build the complete forced-native, fixed-step producer command."""

    return [
        "/usr/bin/arch",
        "-arm64",
        str(binary.resolve()),
        "--headless",
        "--fixed_timestep",
        "0.1",
        "--seed",
        "7",
        "--csv_logger",
        str(raw_csv.resolve()),
        "--disable_log",
        "--disable_stdout",
        "--osc",
        str(scenario),
    ]


def sanitized_esmini_environment(environment: Mapping[str, str]) -> dict[str, str]:
    """Remove the documented ambient config injection path from producer execution."""

    return {key: value for key, value in environment.items() if key != "ESMINI_CONFIG_FILE"}


def probe_esmini_producer(binary: Path, archive: Path) -> dict[str, object]:
    """Collect and authorize runtime provenance from actual local producer files."""

    binary = binary.resolve()
    archive = archive.resolve()
    if not binary.is_file() or not archive.is_file():
        raise AuditionError("esmini binary and official release archive must both exist")
    file_probe = subprocess.run(
        ["/usr/bin/file", "-b", str(binary)],
        text=True,
        capture_output=True,
        check=False,
    )
    lipo_probe = subprocess.run(
        ["/usr/bin/lipo", "-archs", str(binary)],
        text=True,
        capture_output=True,
        check=False,
    )
    version_probe = subprocess.run(
        [str(binary), "--version"],
        text=True,
        capture_output=True,
        check=False,
    )
    _expect_equal("file probe return code", file_probe.returncode, 0)
    _expect_equal("file probe stderr", file_probe.stderr, "")
    _expect_equal("lipo probe return code", lipo_probe.returncode, 0)
    _expect_equal("lipo probe stderr", lipo_probe.stderr, "")
    return validate_esmini_producer(
        version_stdout=version_probe.stdout,
        version_stderr=version_probe.stderr,
        version_returncode=version_probe.returncode,
        file_output=file_probe.stdout.strip(),
        lipo_output=lipo_probe.stdout.strip(),
        host_system=platform.system(),
        host_machine=platform.machine(),
        archive_sha256=_sha256(archive),
        binary_sha256=_sha256(binary),
    )


def run_esmini(*, binary: Path, scenario: Path, raw_csv: Path, cwd: Path) -> dict[str, object]:
    """Execute one clean native-arm64 audition run and require well-formed output."""

    raw_csv = raw_csv.resolve()
    if raw_csv.exists():
        raise AuditionError(f"refusing to overwrite existing raw CSV: {raw_csv}")
    if not raw_csv.parent.is_dir():
        raise AuditionError(f"raw CSV parent does not exist: {raw_csv.parent}")
    cwd = cwd.resolve()
    try:
        scenario_argument = scenario.resolve().relative_to(cwd)
    except ValueError as exc:
        raise AuditionError("audition scenario must be inside the repository root") from exc
    command = esmini_command(binary=binary, scenario=scenario_argument, raw_csv=raw_csv)
    result = subprocess.run(
        command,
        cwd=cwd,
        env=sanitized_esmini_environment(os.environ),
        text=True,
        capture_output=True,
        check=False,
    )
    _expect_equal("esmini scenario return code", result.returncode, 0)
    _expect_equal("esmini scenario stderr", result.stderr, "")
    if not raw_csv.is_file():
        raise AuditionError("esmini exited without producing the requested CSV")
    return {
        "command": command,
        "stdout_sha256": hashlib.sha256(result.stdout.encode("utf-8")).hexdigest(),
        "stderr_sha256": hashlib.sha256(result.stderr.encode("utf-8")).hexdigest(),
        "raw_csv_sha256": _sha256(raw_csv),
    }


def _reject_nonstandard_number(value: str) -> None:
    raise AuditionError(f"non-standard JSON number {value!r}")


def _read_json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=_reject_nonstandard_number,
        )
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AuditionError(f"cannot read JSON object {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise AuditionError(f"{path} must contain one JSON object")
    return value


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as exc:
        raise AuditionError(f"cannot hash {path}: {exc}") from exc
    return digest.hexdigest()


def _expect_equal(label: str, observed: object, expected: object) -> None:
    if observed != expected:
        raise AuditionError(f"{label} mismatch: observed={observed!r}, expected={expected!r}")


def _mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AuditionError(f"{label} must be an object")
    return value


def _finite(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AuditionError(f"{label} must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise AuditionError(f"{label} must be finite")
    return result


def _optional_finite(value: object, label: str) -> float | None:
    return None if value is None else _finite(value, label)


def _ttc(
    gap_m: float | None,
    relative_speed_mps: float | None,
) -> tuple[float | None, float | None]:
    if gap_m is None or relative_speed_mps is None:
        return None, None
    closing_speed = max(0.0, -relative_speed_mps)
    if gap_m < 0.0 or closing_speed == 0.0:
        return closing_speed, None
    return closing_speed, gap_m / closing_speed


def _validate_metadrive_identity(
    manifest: dict[str, Any], context: dict[str, Any]
) -> dict[str, object]:
    expected_manifest = {
        "scenario_name": "adas_cut_in_near",
        "scenario_schema_version": "4.0",
        "seed": 7,
        "control_frequency_hz": 10,
        "horizon_steps": 300,
        "simulator_name": "metadrive",
        "simulator_version": "0.4.3",
        "simulator_commit": EXPECTED_METADRIVE_COMMIT,
        "repository_dirty": False,
        "gate_name": "adas_p0",
        "gate_version": "1.0",
        "gate_config_digest": EXPECTED_GATE_DIGEST,
        "policy_name": "adas-longitudinal",
        "policy_version": "1.0",
        "policy_config_digest": EXPECTED_POLICY_DIGEST,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": EXPECTED_SHIELD_DIGEST,
        "adapter_config_digest": EXPECTED_ADAPTER_DIGEST,
    }
    for field, expected in expected_manifest.items():
        _expect_equal(f"manifest {field}", manifest.get(field), expected)
    scenario_digest = manifest.get("scenario_digest")
    if not isinstance(scenario_digest, str) or len(scenario_digest) != 64:
        raise AuditionError("manifest scenario_digest must be a 64-character string")
    _expect_equal("manifest scenario_digest", scenario_digest, EXPECTED_SCENARIO_DIGEST)
    repository_commit = manifest.get("repository_commit")
    if not isinstance(repository_commit, str) or len(repository_commit) != 40:
        raise AuditionError("manifest repository_commit must be a 40-character string")

    run_context = _mapping(context.get("run_context"), "execution context run_context")
    _expect_equal("context adapter_name", run_context.get("adapter_name"), "metadrive")
    _expect_equal("context control_frequency_hz", run_context.get("control_frequency_hz"), 10)
    _expect_equal("context horizon_steps", run_context.get("horizon_steps"), 300)
    _expect_equal("context seed", run_context.get("seed"), 7)
    _expect_equal("context scenario_digest", run_context.get("scenario_digest"), scenario_digest)
    for field, expected in {
        "gate_config_digest": EXPECTED_GATE_DIGEST,
        "policy_name": "adas-longitudinal",
        "policy_version": "1.0",
        "policy_config_digest": EXPECTED_POLICY_DIGEST,
        "shield_name": "noop",
        "shield_version": "1.0",
        "shield_config_digest": EXPECTED_SHIELD_DIGEST,
        "adapter_config_digest": EXPECTED_ADAPTER_DIGEST,
    }.items():
        _expect_equal(f"context {field}", run_context.get(field), expected)

    adapter = _mapping(context.get("adapter"), "execution context adapter")
    _expect_equal("adapter name", adapter.get("name"), "metadrive")
    _expect_equal("adapter config_digest", adapter.get("config_digest"), EXPECTED_ADAPTER_DIGEST)
    adapter_config = _mapping(adapter.get("config"), "execution context adapter config")
    for field, expected in {
        "simulator_name": "metadrive",
        "simulator_version": "0.4.3",
        "simulator_commit": EXPECTED_METADRIVE_COMMIT,
    }.items():
        _expect_equal(f"adapter config {field}", adapter_config.get(field), expected)
    challenge = _mapping(adapter_config.get("challenge"), "adapter challenge")
    _expect_equal("adapter challenge", challenge, EXPECTED_CHALLENGE)
    policy = _mapping(context.get("policy"), "execution context policy")
    _expect_equal("policy name", policy.get("name"), "adas-longitudinal")
    _expect_equal("policy version", policy.get("version"), "1.0")
    _expect_equal("policy config_digest", policy.get("config_digest"), EXPECTED_POLICY_DIGEST)
    shield = _mapping(context.get("shield"), "execution context shield")
    _expect_equal("shield name", shield.get("name"), "noop")
    _expect_equal("shield version", shield.get("version"), "1.0")
    _expect_equal("shield config_digest", shield.get("config_digest"), EXPECTED_SHIELD_DIGEST)
    return {
        "scenario_name": "adas_cut_in_near",
        "scenario_schema_version": "4.0",
        "scenario_digest": scenario_digest,
        "seed": 7,
        "simulator_name": "metadrive",
        "simulator_version": "0.4.3",
        "simulator_commit": EXPECTED_METADRIVE_COMMIT,
        "repository_commit": repository_commit,
        "repository_dirty": False,
        "trace_digest": manifest.get("trace_digest"),
    }


def load_metadrive_trace(artifact_root: Path) -> BackendTrace:
    """Load and authorize the exact current Hermes cut-in comparator bundle."""

    artifact_root = artifact_root.resolve()
    manifest_path = artifact_root / "manifest.json"
    context_path = artifact_root / "execution-context.json"
    events_path = artifact_root / "events.jsonl"
    manifest = _read_json_object(manifest_path)
    context = _read_json_object(context_path)

    file_digests = _mapping(manifest.get("file_digests"), "manifest file_digests")
    for path in (context_path, events_path):
        expected_digest = file_digests.get(path.name)
        if not isinstance(expected_digest, str):
            raise AuditionError(f"manifest lacks digest for {path.name}")
        _expect_equal(f"{path.name} SHA-256", _sha256(path), expected_digest)
    identity = _validate_metadrive_identity(manifest, context)

    samples: list[TrajectorySample] = []
    try:
        lines = events_path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise AuditionError(f"cannot read {events_path}: {exc}") from exc
    if not lines:
        raise AuditionError("events.jsonl contains no events")
    previous_time = -math.inf
    final_hash: object = None
    expected_context = _mapping(context.get("run_context"), "execution context run_context")
    for expected_sequence, line in enumerate(lines):
        try:
            event = json.loads(line, parse_constant=_reject_nonstandard_number)
        except json.JSONDecodeError as exc:
            raise AuditionError(f"events.jsonl line {expected_sequence + 1}: {exc}") from exc
        event = _mapping(event, f"events.jsonl line {expected_sequence + 1}")
        _expect_equal("event sequence", event.get("sequence"), expected_sequence)
        _expect_equal("event run_context", event.get("run_context"), expected_context)
        time_s = _finite(event.get("simulation_time_s"), "event simulation_time_s")
        expected_result_time = (expected_sequence + 1) / 10.0
        result_clock_budget = 2.0 * max(math.ulp(time_s), math.ulp(expected_result_time))
        if abs(time_s - expected_result_time) > result_clock_budget:
            raise AuditionError(
                "event result clock mismatch: "
                f"sequence={expected_sequence}, observed={time_s}, "
                f"expected={expected_result_time}"
            )
        if time_s <= previous_time:
            raise AuditionError("event simulation times must be strictly increasing")
        previous_time = time_s
        observation = _mapping(event.get("observation_summary"), "event observation_summary")
        vehicle = _mapping(event.get("vehicle_state"), "event vehicle_state")
        executed = _mapping(event.get("executed_action"), "event executed_action")
        ego_longitudinal = _finite(vehicle.get("position_m"), "vehicle position_m")
        ego_lateral = _finite(vehicle.get("lateral_offset_m"), "vehicle lateral_offset_m")
        actor_relative_longitudinal = _finite(
            observation.get("result_challenge_actor_longitudinal_m"),
            "result actor longitudinal",
        )
        actor_relative_lateral = _finite(
            observation.get("result_challenge_actor_lateral_offset_m"),
            "result actor lateral",
        )
        result_gap = _optional_finite(
            observation.get("result_front_distance_m"), "result front distance"
        )
        result_relative_speed = _optional_finite(
            observation.get("result_front_relative_speed_mps"),
            "result front relative speed",
        )
        closing_speed, ttc_s = _ttc(result_gap, result_relative_speed)
        observed_gap = _optional_finite(
            observation.get("front_distance_m"), "controller-observed front distance"
        )
        observed_relative_speed = _optional_finite(
            observation.get("front_relative_speed_mps"),
            "controller-observed front relative speed",
        )
        _, observed_ttc = _ttc(observed_gap, observed_relative_speed)
        input_time = _finite(
            observation.get("input_simulation_time_s"), "input simulation time"
        )
        expected_input_time = expected_sequence / 10.0
        input_clock_budget = 2.0 * max(math.ulp(input_time), math.ulp(expected_input_time))
        if abs(input_time - expected_input_time) > input_clock_budget:
            raise AuditionError(
                "controller input clock mismatch: "
                f"sequence={expected_sequence}, observed={input_time}, "
                f"expected={expected_input_time}"
            )
        if expected_sequence == 0:
            reset_contract = {
                "ego speed": (observation.get("speed_mps"), 20.0),
                "ego lateral offset": (observation.get("lateral_offset_m"), 0.0),
                "actor center separation": (
                    observation.get("challenge_actor_longitudinal_m"),
                    36.515,
                ),
                "actor lateral offset": (
                    observation.get("challenge_actor_lateral_offset_m"),
                    -3.5,
                ),
                "actor speed": (observation.get("challenge_actor_speed_mps"), 12.0),
            }
            for label, (value, expected) in reset_contract.items():
                observed = _finite(value, f"recorded reset {label}")
                if not math.isclose(observed, expected, rel_tol=0.0, abs_tol=1e-5):
                    raise AuditionError(
                        f"recorded reset {label} mismatch: "
                        f"observed={observed}, expected={expected}"
                    )
        samples.append(
            TrajectorySample(
                time_s=time_s,
                ego_longitudinal_m=ego_longitudinal,
                ego_lateral_m=ego_lateral,
                ego_speed_mps=_finite(vehicle.get("speed_mps"), "vehicle speed_mps"),
                actor_longitudinal_m=ego_longitudinal + actor_relative_longitudinal,
                actor_lateral_m=ego_lateral + actor_relative_lateral,
                actor_speed_mps=_finite(
                    observation.get("result_challenge_actor_speed_mps"),
                    "result actor speed",
                ),
                in_path=result_gap is not None,
                bumper_gap_m=result_gap,
                closing_speed_mps=closing_speed,
                ttc_s=ttc_s,
                controller_observation_time_s=input_time,
                controller_observation_ttc_s=observed_ttc,
                brake_command=_finite(executed.get("brake"), "executed brake"),
            )
        )
        final_hash = event.get("current_hash")
    _expect_equal("final event hash", final_hash, manifest.get("trace_digest"))
    return BackendTrace(backend="metadrive", identity=identity, samples=tuple(samples))


def _csv_value(row: dict[str, str], key: str, label: str) -> str:
    try:
        value = row[key]
    except KeyError as exc:
        raise AuditionError(f"esmini CSV lacks {key!r}") from exc
    if value == "":
        raise AuditionError(f"esmini CSV {label} is empty")
    return value


def _csv_float(row: dict[str, str], key: str, label: str) -> float:
    try:
        value = float(_csv_value(row, key, label))
    except ValueError as exc:
        raise AuditionError(f"esmini CSV {label} is not numeric") from exc
    if not math.isfinite(value):
        raise AuditionError(f"esmini CSV {label} is not finite")
    return value


def _entity_geometry(row: dict[str, str], prefix: str) -> dict[str, float | str]:
    name = _csv_value(row, f"{prefix} Entity_Name [-]", f"{prefix} entity name")
    entity_id_text = _csv_value(row, f"{prefix} Entity_ID [-]", f"{prefix} entity ID")
    try:
        entity_id = int(entity_id_text)
    except ValueError as exc:
        raise AuditionError(f"esmini CSV {prefix} entity ID is not an integer") from exc
    heading = _csv_float(
        row,
        f"{prefix} World_Heading_Angle [rad]",
        f"{prefix} world heading",
    )
    box_x = _csv_float(row, f"{prefix} bb_x [m]", f"{prefix} box x")
    box_y = _csv_float(row, f"{prefix} bb_y [m]", f"{prefix} box y")
    reference_x = _csv_float(
        row,
        f"{prefix} World_Position_X [m]",
        f"{prefix} world x",
    )
    reference_y = _csv_float(
        row,
        f"{prefix} World_Position_Y [m]",
        f"{prefix} world y",
    )
    cosine = math.cos(heading)
    sine = math.sin(heading)
    length = _csv_float(row, f"{prefix} bb_length [m]", f"{prefix} box length")
    width = _csv_float(row, f"{prefix} bb_width [m]", f"{prefix} box width")
    if length != 4.515 or width != 1.852:
        raise AuditionError(
            f"esmini CSV {prefix} box dimensions mismatch: "
            f"observed=({length}, {width}), expected=(4.515, 1.852)"
        )
    return {
        "name": name,
        "entity_id": entity_id,
        "center_x": reference_x + cosine * box_x - sine * box_y,
        "center_y": reference_y + sine * box_x + cosine * box_y,
        "heading": heading,
        "length": length,
        "width": width,
        "reported_speed": _csv_float(
            row, f"{prefix} Current_Speed [m/s]", f"{prefix} speed"
        ),
        "velocity_x": _csv_float(row, f"{prefix} Vel_X [m/s]", f"{prefix} velocity x"),
        "velocity_y": _csv_float(row, f"{prefix} Vel_Y [m/s]", f"{prefix} velocity y"),
    }


def load_esmini_csv(
    csv_path: Path,
    *,
    expected_scenario_name: str = "adas_cut_in_near.xosc",
) -> BackendTrace:
    """Parse esmini 3.7.1's deterministic two-entity CSV without inferred fields."""

    csv_path = csv_path.resolve()
    try:
        lines = csv_path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise AuditionError(f"cannot read esmini CSV {csv_path}: {exc}") from exc
    if len(lines) < 8:
        raise AuditionError("esmini CSV is truncated")
    expected_metadata = (
        "esmini GIT REV: v3.7.1-0-b848e291",
        "esmini GIT TAG: v3.7.1",
        "esmini GIT BRANCH: tags/v3.7.1^0",
        "esmini BUILD VERSION: 6348",
    )
    for expected, observed in zip(expected_metadata, lines[:4], strict=True):
        _expect_equal(expected.split(":", 1)[0], observed.strip(), expected)
    scenario_prefix = "Scenario File Name: "
    if not lines[4].startswith(scenario_prefix):
        raise AuditionError("esmini CSV lacks Scenario File Name metadata")
    scenario_path = lines[4][len(scenario_prefix) :].strip()
    _expect_equal("esmini CSV scenario basename", Path(scenario_path).name, expected_scenario_name)
    _expect_equal("esmini CSV Number of Vehicles", lines[5].strip(), "Number of Vehicles: 2")

    parsed_rows = list(csv.reader(lines[6:], skipinitialspace=True))
    if len(parsed_rows) < 2:
        raise AuditionError("esmini CSV contains no data rows")
    headers = [cell.strip() for cell in parsed_rows[0]]
    if headers and headers[-1] == "":
        headers.pop()
    if len(set(headers)) != len(headers):
        raise AuditionError("esmini CSV contains duplicate headers")
    entity_prefixes = sorted(
        header.removesuffix(" Entity_Name [-]")
        for header in headers
        if header.startswith("#") and header.endswith(" Entity_Name [-]")
    )
    _expect_equal("esmini CSV entity block count", len(entity_prefixes), 2)
    required_headers = {
        "Index [-]",
        "TimeStamp [s]",
        *{
            f"{prefix} {field}"
            for prefix in entity_prefixes
            for field in (
                "Entity_Name [-]",
                "Entity_ID [-]",
                "Current_Speed [m/s]",
                "bb_x [m]",
                "bb_y [m]",
                "bb_length [m]",
                "bb_width [m]",
                "World_Position_X [m]",
                "World_Position_Y [m]",
                "Vel_X [m/s]",
                "Vel_Y [m/s]",
                "World_Heading_Angle [rad]",
            )
        },
    }
    missing = sorted(required_headers - set(headers))
    if missing:
        raise AuditionError(f"esmini CSV lacks required headers: {missing}")

    rows: list[dict[str, str]] = []
    for row_number, cells in enumerate(parsed_rows[1:], start=8):
        cells = [cell.strip() for cell in cells]
        if cells and cells[-1] == "":
            cells.pop()
        if len(cells) != len(headers):
            raise AuditionError(
                f"esmini CSV line {row_number} has {len(cells)} cells, expected {len(headers)}"
            )
        rows.append(dict(zip(headers, cells, strict=True)))

    samples: list[TrajectorySample] = []
    initial_ego_x: float | None = None
    initial_ego_y: float | None = None
    expected_entity_ids: dict[str, int] | None = None
    for expected_index, row in enumerate(rows):
        index_text = _csv_value(row, "Index [-]", "index")
        try:
            index = int(index_text)
        except ValueError as exc:
            raise AuditionError("esmini CSV index is not an integer") from exc
        _expect_equal("esmini CSV index", index, expected_index)
        time_s = _csv_float(row, "TimeStamp [s]", "timestamp")
        expected_time = expected_index / 10.0
        if not math.isclose(time_s, expected_time, rel_tol=0.0, abs_tol=1e-12):
            raise AuditionError(
                f"esmini CSV timestamp mismatch: observed={time_s}, expected={expected_time}"
            )
        entities = [_entity_geometry(row, prefix) for prefix in entity_prefixes]
        by_name = {str(entity["name"]): entity for entity in entities}
        if len(by_name) != 2:
            raise AuditionError("esmini CSV entity names must be unique in every row")
        _expect_equal("esmini CSV entity names", set(by_name), {"Ego", "CutInActor"})
        ego = by_name["Ego"]
        actor = by_name["CutInActor"]
        observed_entity_ids = {
            name: int(entity["entity_id"]) for name, entity in by_name.items()
        }
        _expect_equal("esmini entity IDs", observed_entity_ids, {"Ego": 0, "CutInActor": 1})
        if expected_entity_ids is None:
            expected_entity_ids = observed_entity_ids
        _expect_equal("esmini stable entity IDs", observed_entity_ids, expected_entity_ids)
        ego_x = float(ego["center_x"])
        ego_y = float(ego["center_y"])
        actor_x = float(actor["center_x"])
        actor_y = float(actor["center_y"])
        if initial_ego_x is None:
            initial_ego_x = ego_x
            initial_ego_y = ego_y
        assert initial_ego_y is not None
        ego_heading = float(ego["heading"])
        forward = (math.cos(ego_heading), math.sin(ego_heading))
        lateral = (-forward[1], forward[0])
        delta = (actor_x - ego_x, actor_y - ego_y)
        longitudinal_separation = delta[0] * forward[0] + delta[1] * forward[1]
        lateral_separation = delta[0] * lateral[0] + delta[1] * lateral[1]
        relative_heading = float(actor["heading"]) - ego_heading
        relative_cosine = math.cos(relative_heading)
        relative_sine = math.sin(relative_heading)
        ego_longitudinal_half_extent = float(ego["length"]) / 2.0
        ego_lateral_half_extent = float(ego["width"]) / 2.0
        actor_longitudinal_half_extent = (
            abs(relative_cosine) * float(actor["length"])
            + abs(relative_sine) * float(actor["width"])
        ) / 2.0
        actor_lateral_half_extent = (
            abs(relative_sine) * float(actor["length"])
            + abs(relative_cosine) * float(actor["width"])
        ) / 2.0
        in_path = abs(lateral_separation) <= (
            ego_lateral_half_extent + actor_lateral_half_extent
        )
        ahead = longitudinal_separation > 0.0
        gap = (
            max(
                0.0,
                longitudinal_separation
                - ego_longitudinal_half_extent
                - actor_longitudinal_half_extent,
            )
            if in_path and ahead
            else None
        )
        relative_velocity = (
            float(actor["velocity_x"]) - float(ego["velocity_x"]),
            float(actor["velocity_y"]) - float(ego["velocity_y"]),
        )
        relative_speed = relative_velocity[0] * forward[0] + relative_velocity[1] * forward[1]
        closing_speed, ttc_s = _ttc(gap, relative_speed)
        samples.append(
            TrajectorySample(
                time_s=time_s,
                ego_longitudinal_m=ego_x - initial_ego_x,
                ego_lateral_m=ego_y - initial_ego_y,
                ego_speed_mps=math.hypot(
                    float(ego["velocity_x"]), float(ego["velocity_y"])
                ),
                actor_longitudinal_m=actor_x - initial_ego_x,
                actor_lateral_m=actor_y - initial_ego_y,
                actor_speed_mps=math.hypot(
                    float(actor["velocity_x"]), float(actor["velocity_y"])
                ),
                in_path=in_path and ahead,
                bumper_gap_m=gap,
                closing_speed_mps=closing_speed if in_path and ahead else None,
                ttc_s=ttc_s,
            )
        )
    identity: dict[str, object] = {
        "git_revision": "v3.7.1-0-b848e291",
        "git_tag": "v3.7.1",
        "git_branch": "tags/v3.7.1^0",
        "build_version": "6348",
        "scenario_file": Path(scenario_path).name,
        "scenario_file_metadata_sha256": hashlib.sha256(
            scenario_path.encode("utf-8")
        ).hexdigest(),
        "csv_sha256": _sha256(csv_path),
    }
    return BackendTrace(backend="esmini", identity=identity, samples=tuple(samples))


def _clock_matches(observed: float, expected: float) -> bool:
    budget = 2.0 * max(math.ulp(observed), math.ulp(expected))
    return abs(observed - expected) <= budget


def _sample_event(sample: TrajectorySample | None) -> dict[str, float] | None:
    if sample is None:
        return None
    event: dict[str, float] = {"time_s": sample.time_s}
    if sample.bumper_gap_m is not None:
        event["bumper_gap_m"] = sample.bumper_gap_m
    if sample.closing_speed_mps is not None:
        event["closing_speed_mps"] = sample.closing_speed_mps
    if sample.ttc_s is not None:
        event["ttc_s"] = sample.ttc_s
    return event


def _first_sample(
    samples: tuple[TrajectorySample, ...],
    predicate,
) -> TrajectorySample | None:
    return next((sample for sample in samples if predicate(sample)), None)


def _minimum_ttc_event(
    samples: tuple[TrajectorySample, ...], *, through_s: float | None = None
) -> dict[str, float] | None:
    eligible = [
        sample
        for sample in samples
        if sample.ttc_s is not None and (through_s is None or sample.time_s <= through_s)
    ]
    if not eligible:
        return None
    return _sample_event(min(eligible, key=lambda sample: (sample.ttc_s, sample.time_s)))


def _backend_summary(
    trace: BackendTrace, *, pre_response_cutoff_s: float
) -> dict[str, object]:
    first_in_path = _first_sample(trace.samples, lambda sample: sample.in_path)
    first_exposure = _first_sample(
        trace.samples,
        lambda sample: sample.ttc_s is not None and sample.ttc_s <= 2.6,
    )
    return {
        "identity": trace.identity,
        "sample_count": len(trace.samples),
        "first_time_s": trace.samples[0].time_s,
        "last_time_s": trace.samples[-1].time_s,
        "first_in_path": _sample_event(first_in_path),
        "first_ttc_le_2_6_exposure": _sample_event(first_exposure),
        "minimum_ttc_overall": _minimum_ttc_event(trace.samples),
        "minimum_ttc_through_pre_response_cutoff": _minimum_ttc_event(
            trace.samples, through_s=pre_response_cutoff_s
        ),
    }


def _maximum_delta(
    metadrive: dict[int, TrajectorySample],
    esmini: dict[int, TrajectorySample],
    *,
    through_tick: int,
    field: str,
) -> dict[str, float] | None:
    candidates: list[tuple[float, float, float]] = []
    for tick in sorted(set(metadrive) & set(esmini)):
        if tick > through_tick:
            continue
        metadrive_value = getattr(metadrive[tick], field)
        esmini_value = getattr(esmini[tick], field)
        if metadrive_value is None or esmini_value is None:
            continue
        delta = float(esmini_value) - float(metadrive_value)
        candidates.append((abs(delta), tick / 10.0, delta))
    if not candidates:
        return None
    maximum, time_s, signed_delta = max(candidates, key=lambda item: (item[0], -item[1]))
    return {"max_abs_delta": maximum, "time_s": time_s, "esmini_minus_metadrive": signed_delta}


def build_comparison_summary(
    metadrive: BackendTrace,
    esmini: BackendTrace,
    *,
    producer_provenance: dict[str, object],
    source_hashes: dict[str, str],
    expected_metadrive_horizon_s: float,
    expected_esmini_horizon_s: float,
) -> dict[str, object]:
    """Build the deterministic, explicitly non-parity audition summary."""

    _expect_equal("MetaDrive backend label", metadrive.backend, "metadrive")
    _expect_equal("esmini backend label", esmini.backend, "esmini")
    if not metadrive.samples or not esmini.samples:
        raise AuditionError("both backend traces must contain samples")
    if not _clock_matches(metadrive.samples[-1].time_s, expected_metadrive_horizon_s):
        raise AuditionError("MetaDrive trace does not reach the expected comparator horizon")
    if not _clock_matches(esmini.samples[-1].time_s, expected_esmini_horizon_s):
        raise AuditionError("esmini trace does not reach the expected comparator horizon")

    initial_esmini = esmini.samples[0]
    csv_floor = 0.5e-6
    reset_values = {
        "time_s": (initial_esmini.time_s, 0.0),
        "ego_speed_mps": (initial_esmini.ego_speed_mps, 20.0),
        "actor_speed_mps": (initial_esmini.actor_speed_mps, 12.0),
        "center_separation_m": (
            initial_esmini.actor_longitudinal_m - initial_esmini.ego_longitudinal_m,
            36.515,
        ),
        "lateral_delta_m": (
            initial_esmini.actor_lateral_m - initial_esmini.ego_lateral_m,
            -3.5,
        ),
    }
    for label, (observed, expected) in reset_values.items():
        if abs(observed - expected) > csv_floor:
            raise AuditionError(
                f"esmini reset {label} mismatch: observed={observed}, expected={expected}"
            )

    first_brake = _first_sample(
        metadrive.samples,
        lambda sample: sample.brake_command is not None and sample.brake_command > 0.0,
    )
    if first_brake is None or first_brake.controller_observation_time_s is None:
        raise AuditionError("MetaDrive comparator contains no recorded executed-brake response")
    attribution_cutoff = first_brake.controller_observation_time_s
    first_controller_exposure = _first_sample(
        metadrive.samples,
        lambda sample: (
            sample.controller_observation_ttc_s is not None
            and sample.controller_observation_ttc_s <= 2.6
        ),
    )
    if first_controller_exposure is None:
        raise AuditionError("MetaDrive comparator contains no TTC<=2.6 controller exposure")

    metadrive_by_tick = {round(sample.time_s * 10): sample for sample in metadrive.samples}
    esmini_by_tick = {round(sample.time_s * 10): sample for sample in esmini.samples}
    cutoff_tick = round(attribution_cutoff * 10)
    fields = (
        "ego_longitudinal_m",
        "actor_longitudinal_m",
        "ego_lateral_m",
        "actor_lateral_m",
        "bumper_gap_m",
        "ttc_s",
    )
    deltas = {
        field: _maximum_delta(
            metadrive_by_tick,
            esmini_by_tick,
            through_tick=cutoff_tick,
            field=field,
        )
        for field in fields
    }
    metadrive_first_in_path = _first_sample(metadrive.samples, lambda sample: sample.in_path)
    esmini_first_in_path = _first_sample(esmini.samples, lambda sample: sample.in_path)
    metadrive_first_exposure = _first_sample(
        metadrive.samples, lambda sample: sample.ttc_s is not None and sample.ttc_s <= 2.6
    )
    esmini_first_exposure = _first_sample(
        esmini.samples, lambda sample: sample.ttc_s is not None and sample.ttc_s <= 2.6
    )

    def timing_delta(
        first: TrajectorySample | None, second: TrajectorySample | None
    ) -> float | None:
        if first is None or second is None:
            return None
        return second.time_s - first.time_s

    return {
        "schema_version": "1.0",
        "scope": "SIMULATION-ONLY / NOT HERMES EVIDENCE",
        "claim_boundary": (
            "Deterministic trajectory/timing audition only; not backend parity, real-world "
            "safety evidence, certification, or production validation."
        ),
        "threshold": {
            "ttc_s": 2.6,
            "meaning": "illustrative scenario exposure only",
            "fcw_signal_recorded": False,
        },
        "sampling": {
            "fixed_step_s": 0.1,
            "event_times_are_grid_samples_without_interpolation": True,
            "esmini_csv_decimal_places": 6,
            "esmini_numeric_quantization_floor_abs": csv_floor,
        },
        "sources": source_hashes,
        "producer": producer_provenance,
        "backends": {
            "metadrive": _backend_summary(
                metadrive, pre_response_cutoff_s=attribution_cutoff
            ),
            "esmini": _backend_summary(esmini, pre_response_cutoff_s=attribution_cutoff),
        },
        "controller_response": {
            "first_controller_observed_ttc_le_2_6_input_time_s": (
                first_controller_exposure.controller_observation_time_s
            ),
            "first_controller_observed_ttc_s": (
                first_controller_exposure.controller_observation_ttc_s
            ),
            "first_executed_brake_input_time_s": attribution_cutoff,
            "first_executed_brake_result_time_s": first_brake.time_s,
            "first_executed_brake_command": first_brake.brake_command,
        },
        "comparison": {
            "scenario_semantics_attribution_through_s": attribution_cutoff,
            "pre_cutoff_label": "SCENARIO_BACKEND_AND_NON_BRAKING_CONTROLLER_DYNAMICS",
            "post_cutoff_label": "CONTROLLER_RESPONSE_CONFOUNDED",
            "matched_grid_sample_count_through_cutoff": sum(
                1
                for tick in set(metadrive_by_tick) & set(esmini_by_tick)
                if tick <= cutoff_tick
            ),
            "esmini_minus_metadrive_first_in_path_time_s": timing_delta(
                metadrive_first_in_path, esmini_first_in_path
            ),
            "esmini_minus_metadrive_first_ttc_le_2_6_time_s": timing_delta(
                metadrive_first_exposure, esmini_first_exposure
            ),
            "maximum_deltas_through_cutoff": deltas,
        },
        "semantic_findings": {
            "lateral_interpolation": (
                "esmini 3.7.1 cubic and Hermes replay both use u^2*(3-2u)"
            ),
            "longitudinal_mismatch": (
                "esmini advances 12 m/s along the yawed lane-change path; Hermes independently "
                "advances longitudinal position at 12 m/s while replaying lateral position"
            ),
            "oriented_pose_mismatch": (
                "esmini yaws the actor along the lane-change path, expanding its projected "
                "lateral box extent; Hermes replays lateral position at road heading"
            ),
            "metadrive_actor_first_interval": (
                "Hermes result event 0 at 0.1 s retains actor step index 0, placing actor "
                "longitudinal progress one 1.2 m interval behind the esmini time grid"
            ),
            "pre_brake_ego_mismatch": (
                "esmini scripts ego at 20 m/s while MetaDrive runs the baseline speed policy "
                "and vehicle dynamics; pre-brake ego/gap/TTC deltas are not pure actor semantics"
            ),
            "controller_mismatch": (
                "esmini has no Hermes ADAS controller in this audition; post-cutoff deltas "
                "combine backend semantics with MetaDrive controller response"
            ),
        },
    }


def summary_json_bytes(summary: dict[str, object]) -> bytes:
    """Serialize the summary canonically enough for byte-for-byte repeat checks."""

    return (
        json.dumps(summary, sort_keys=True, indent=2, allow_nan=False, ensure_ascii=False) + "\n"
    ).encode("utf-8")


def normalized_trace_jsonl_bytes(trace: BackendTrace) -> bytes:
    """Serialize only path-free normalized samples for an independent determinism hash."""

    return b"".join(
        (
            json.dumps(
                asdict(sample),
                sort_keys=True,
                separators=(",", ":"),
                allow_nan=False,
            )
            + "\n"
        ).encode("utf-8")
        for sample in trace.samples
    )


def comparison_svg_bytes(
    metadrive: BackendTrace,
    esmini: BackendTrace,
    summary: dict[str, object],
) -> bytes:
    """Render a deterministic dependency-free two-panel trajectory/timing plot."""

    width, height = 1000.0, 700.0
    left, right = 90.0, 960.0
    top_a, bottom_a = 105.0, 330.0
    top_b, bottom_b = 410.0, 635.0
    max_time = max(metadrive.samples[-1].time_s, esmini.samples[-1].time_s)

    def x_coord(value: float) -> float:
        return left + (right - left) * value / max_time

    def y_lateral(value: float) -> float:
        return bottom_a - (bottom_a - top_a) * (value + 4.0) / 5.0

    def y_gap(value: float) -> float:
        return bottom_b - (bottom_b - top_b) * max(0.0, min(35.0, value)) / 35.0

    def points(trace: BackendTrace, field: str, y_transform) -> str:
        return " ".join(
            f"{x_coord(sample.time_s):.3f},{y_transform(float(getattr(sample, field))):.3f}"
            for sample in trace.samples
            if getattr(sample, field) is not None
        )

    response = summary["controller_response"]
    assert isinstance(response, dict)
    brake_time = float(response["first_executed_brake_input_time_s"])
    backend_summary = summary["backends"]
    assert isinstance(backend_summary, dict)
    markers: list[tuple[float, str, str]] = [(brake_time, "executed brake input", "#7a3db8")]
    for backend, color in (("metadrive", "#0067b8"), ("esmini", "#d04a35")):
        item = backend_summary[backend]
        assert isinstance(item, dict)
        exposure = item["first_ttc_le_2_6_exposure"]
        if isinstance(exposure, dict):
            markers.append((float(exposure["time_s"]), f"{backend} TTC≤2.6", color))
    if max_time >= 1.0:
        markers.append((1.0, "cut-in action start", "#555555"))

    svg = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.0f}" '
            f'height="{height:.0f}" viewBox="0 0 {width:.0f} {height:.0f}">'
        ),
        "<title>Hermes WP-D deterministic cut-in audition</title>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="40" y="34" font-family="sans-serif" font-size="20" font-weight="bold">'
        "FCW cut-in: MetaDrive vs esmini 3.7.1</text>",
        '<text x="40" y="58" font-family="sans-serif" font-size="13" fill="#9b1c1c">'
        "SIMULATION-ONLY / NOT HERMES EVIDENCE — not backend parity</text>",
        f'<rect x="{left}" y="{top_a}" width="{right-left}" height="{bottom_a-top_a}" '
        'fill="none" stroke="#444"/>',
        f'<rect x="{left}" y="{top_b}" width="{right-left}" height="{bottom_b-top_b}" '
        'fill="none" stroke="#444"/>',
        '<text x="20" y="220" transform="rotate(-90 20 220)" font-family="sans-serif" '
        'font-size="13">Actor lateral offset from initial ego lane (m)</text>',
        '<text x="20" y="550" transform="rotate(-90 20 550)" font-family="sans-serif" '
        'font-size="13">In-path bumper gap (m)</text>',
        f'<text x="{(left+right)/2:.1f}" y="682" text-anchor="middle" '
        'font-family="sans-serif" font-size="13">simulation time (s)</text>',
    ]
    for tick_index in range(5):
        tick = max_time * tick_index / 4.0
        x = x_coord(tick)
        svg.extend(
            [
                f'<line x1="{x:.3f}" y1="{top_a}" x2="{x:.3f}" y2="{bottom_a}" '
                'stroke="#e2e2e2"/>',
                f'<line x1="{x:.3f}" y1="{top_b}" x2="{x:.3f}" y2="{bottom_b}" '
                'stroke="#e2e2e2"/>',
                f'<text x="{x:.3f}" y="{bottom_b+18}" text-anchor="middle" '
                f'aria-label="time tick {tick:.3f} s" font-family="sans-serif" '
                f'font-size="10">{tick:.2f}</text>',
            ]
        )
    for tick in (-4.0, -3.0, -2.0, -1.0, 0.0, 1.0):
        y = y_lateral(tick)
        svg.extend(
            [
                f'<line x1="{left}" y1="{y:.3f}" x2="{right}" y2="{y:.3f}" '
                'stroke="#eeeeee"/>',
                f'<text x="{left-7}" y="{y+3:.3f}" text-anchor="end" '
                f'aria-label="lateral tick {tick:.1f} m" font-family="sans-serif" '
                f'font-size="10">{tick:.1f}</text>',
            ]
        )
    for tick in (0, 10, 20, 30, 35):
        y = y_gap(float(tick))
        svg.extend(
            [
                f'<line x1="{left}" y1="{y:.3f}" x2="{right}" y2="{y:.3f}" '
                'stroke="#eeeeee"/>',
                f'<text x="{left-7}" y="{y+3:.3f}" text-anchor="end" '
                f'aria-label="gap tick {tick} m" font-family="sans-serif" '
                f'font-size="10">{tick}</text>',
            ]
        )
    for trace, color in ((metadrive, "#0067b8"), (esmini, "#d04a35")):
        svg.append(
            f'<polyline fill="none" stroke="{color}" stroke-width="2.2" '
            f'points="{points(trace, "actor_lateral_m", y_lateral)}"/>'
        )
        svg.append(
            f'<polyline fill="none" stroke="{color}" stroke-width="2.2" '
            f'points="{points(trace, "bumper_gap_m", y_gap)}"/>'
        )
    for index, (time_s, label, color) in enumerate(markers):
        if time_s > max_time:
            continue
        x = x_coord(time_s)
        svg.extend(
            [
                f'<line x1="{x:.3f}" y1="80" x2="{x:.3f}" y2="{bottom_b}" '
                f'stroke="{color}" stroke-dasharray="5,4" opacity="0.7"/>',
                f'<text x="{x+4:.3f}" y="{82+14*index}" font-family="sans-serif" '
                f'font-size="11" fill="{color}">{label}</text>',
            ]
        )
    legend = (("MetaDrive result geometry", "#0067b8"), ("esmini", "#d04a35"))
    for index, (label, color) in enumerate(legend):
        y = 358 + 20 * index
        svg.append(
            f'<line x1="{left}" y1="{y}" x2="{left+28}" y2="{y}" '
            f'stroke="{color}" stroke-width="3"/>'
        )
        svg.append(
            f'<text x="{left+36}" y="{y+4}" font-family="sans-serif" '
            f'font-size="12">{label}</text>'
        )
    svg.append("</svg>")
    return ("\n".join(svg) + "\n").encode("utf-8")


def write_outputs(
    summary_path: Path,
    svg_path: Path,
    summary_bytes: bytes,
    svg_bytes: bytes,
) -> dict[str, str]:
    """Write exactly the bytes whose hashes are returned for repeat comparison."""

    summary_path = summary_path.resolve()
    svg_path = svg_path.resolve()
    if not summary_path.parent.is_dir() or not svg_path.parent.is_dir():
        raise AuditionError("summary and SVG parent directories must already exist")
    summary_path.write_bytes(summary_bytes)
    svg_path.write_bytes(svg_bytes)
    return {
        "summary_sha256": _sha256(summary_path),
        "svg_sha256": _sha256(svg_path),
    }


def _argument_parser() -> argparse.ArgumentParser:
    tool_directory = Path(__file__).resolve().parent
    repository_root = tool_directory.parents[1]
    parser = argparse.ArgumentParser(
        description=(
            "Run the simulation-only esmini 3.7.1 cut-in audition and compare an actual "
            "current MetaDrive artifact. Outputs are NOT HERMES EVIDENCE."
        )
    )
    parser.add_argument("--esmini-bin", type=Path, required=True)
    parser.add_argument("--esmini-archive", type=Path, required=True)
    parser.add_argument("--hermes-artifact", type=Path, required=True)
    parser.add_argument("--raw-csv", type=Path, required=True)
    parser.add_argument("--summary-out", type=Path, required=True)
    parser.add_argument("--svg-out", type=Path, required=True)
    parser.add_argument(
        "--scenario",
        type=Path,
        default=tool_directory / "adas_cut_in_near.xosc",
    )
    parser.add_argument("--repository-root", type=Path, default=repository_root)
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entry point for one clean producer execution and deterministic comparison."""

    args = _argument_parser().parse_args(argv)
    try:
        committed_scenario = Path(__file__).resolve().with_name("adas_cut_in_near.xosc")
        _expect_equal("audition scenario path", args.scenario.resolve(), committed_scenario)
        road_path = committed_scenario.with_suffix(".xodr")
        if not road_path.is_file():
            raise AuditionError(f"required OpenDRIVE input is missing: {road_path}")
        provenance = probe_esmini_producer(args.esmini_bin, args.esmini_archive)
        execution = run_esmini(
            binary=args.esmini_bin,
            scenario=committed_scenario,
            raw_csv=args.raw_csv,
            cwd=args.repository_root,
        )
        metadrive = load_metadrive_trace(args.hermes_artifact)
        esmini = load_esmini_csv(args.raw_csv)
        provenance = {
            **provenance,
            "runtime_execution": {
                "command_contract": [
                    "/usr/bin/arch",
                    "-arm64",
                    "<authorized-esmini-binary>",
                    "--headless",
                    "--fixed_timestep",
                    "0.1",
                    "--seed",
                    "7",
                    "--csv_logger",
                    "<clean-raw-csv>",
                    "--disable_log",
                    "--disable_stdout",
                    "--osc",
                    "tools/openscenario/adas_cut_in_near.xosc",
                ],
                "stdout_sha256": execution["stdout_sha256"],
                "stderr_sha256": execution["stderr_sha256"],
                "raw_csv_sha256": execution["raw_csv_sha256"],
                "ambient_esmini_config_removed": True,
            },
        }
        artifact = args.hermes_artifact.resolve()
        source_hashes = {
            "openscenario_sha256": _sha256(committed_scenario),
            "opendrive_sha256": _sha256(road_path),
            "esmini_raw_csv_sha256": _sha256(args.raw_csv.resolve()),
            "esmini_normalized_trace_sha256": hashlib.sha256(
                normalized_trace_jsonl_bytes(esmini)
            ).hexdigest(),
            "metadrive_manifest_sha256": _sha256(artifact / "manifest.json"),
            "metadrive_execution_context_sha256": _sha256(
                artifact / "execution-context.json"
            ),
            "metadrive_events_sha256": _sha256(artifact / "events.jsonl"),
        }
        summary = build_comparison_summary(
            metadrive,
            esmini,
            producer_provenance=provenance,
            source_hashes=source_hashes,
            expected_metadrive_horizon_s=7.8,
            expected_esmini_horizon_s=7.8,
        )
        summary_bytes = summary_json_bytes(summary)
        svg_bytes = comparison_svg_bytes(metadrive, esmini, summary)
        output_hashes = write_outputs(
            args.summary_out,
            args.svg_out,
            summary_bytes,
            svg_bytes,
        )
    except (AuditionError, OSError) as exc:
        print(f"WP-D audition failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(output_hashes, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
