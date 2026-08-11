"""Independent stored-only verification; this module never imports runtime adapters."""

from __future__ import annotations

import json
import math
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from hermes.adapters.metadrive_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_SOURCE,
    SUPPORTED_METADRIVE_VERSION,
)
from hermes.domain.enums import AuthenticityStatus, IntegrityStatus, Verdict
from hermes.domain.models import (
    ArtifactManifest,
    ArtifactVerification,
    ExecutionContext,
    FindingsDocument,
    GateResult,
    Observation,
    RunMetrics,
    ScenarioDefinition,
    TraceEvent,
    VehicleState,
)
from hermes.evidence.artifacts import (
    COMPANION_DIGEST_FILES,
    INTEGRITY_LIMITATION,
    REQUIRED_ARTIFACT_FILES,
    bundle_digest,
    config_digest,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.metrics import compute_metrics
from hermes.evidence.trace import TraceIntegrityError, verify_complete_trace
from hermes.gates.config import (
    GateConfig,
    GateConfigError,
    gate_config_digest,
    parse_gate_config_yaml,
    resolved_gate_config_yaml,
)
from hermes.gates.release import apply_release_gate
from hermes.scenarios.loader import (
    ScenarioLoadError,
    parse_scenario_yaml,
    resolved_scenario_yaml,
    scenario_digest,
)
from hermes.shields.config import ShieldConfig
from hermes.shields.deterministic import DeterministicSafetyShield
from hermes.verifiers import PHASE1_VERIFIER_IDENTITIES, run_phase1_verifiers

MAX_ARTIFACT_FILE_BYTES = 16 * 1024 * 1024
MAX_ARTIFACT_TOTAL_BYTES = 64 * 1024 * 1024
MAX_EVENT_COUNT = 10_000
MAX_EVENT_LINE_BYTES = 1 * 1024 * 1024
_ModelT = TypeVar("_ModelT", bound=BaseModel)


@dataclass(frozen=True, slots=True)
class VerifiedArtifactSnapshot:
    """Parsed immutable evidence captured and verified from one descriptor snapshot."""

    path: Path
    manifest: ArtifactManifest
    context: ExecutionContext
    scenario: ScenarioDefinition
    gate_config: GateConfig
    events: tuple[TraceEvent, ...]
    metrics: RunMetrics
    findings: FindingsDocument
    verdict: GateResult


@dataclass(frozen=True, slots=True)
class ArtifactInspection:
    """Stored verification result and its snapshot when internally consistent."""

    verification: ArtifactVerification
    snapshot: VerifiedArtifactSnapshot | None


class _DuplicateJsonKey(ValueError):
    pass


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON constant is unsupported: {value}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise _DuplicateJsonKey(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _strict_json(data: bytes, filename: str) -> Any:
    if data.startswith(b"\xef\xbb\xbf"):
        raise ValueError(f"{filename} must not contain a UTF-8 BOM")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"{filename} is not valid UTF-8: {exc}") from exc
    try:
        return json.loads(
            text,
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except (json.JSONDecodeError, _DuplicateJsonKey, RecursionError, ValueError) as exc:
        raise ValueError(f"{filename} is malformed JSON: {exc}") from exc


def _parse_canonical_model(
    data: bytes,
    filename: str,
    model_type: type[_ModelT],
) -> _ModelT:
    payload = _strict_json(data, filename)
    canonical = canonical_json_bytes(payload) + b"\n"
    if data != canonical:
        raise ValueError(f"{filename} is not canonical JSON")
    try:
        return model_type.model_validate_json(canonical_json_bytes(payload))
    except ValidationError as exc:
        raise ValueError(f"{filename} schema validation failed: {exc}") from exc


def _invalid(
    path: Path,
    errors: list[str],
    *,
    first_mismatch_sequence: int | None = None,
    trace_digest: str | None = None,
) -> ArtifactVerification:
    return ArtifactVerification(
        artifact_path=str(path),
        integrity=IntegrityStatus.INVALID,
        authenticity=AuthenticityStatus.NOT_AUTHENTICATED,
        verdict=Verdict.INVALID_EVIDENCE,
        errors=tuple(errors or ["artifact verification failed"]),
        first_mismatch_sequence=first_mismatch_sequence,
        trace_digest=trace_digest,
    )


def _metadata_identity(metadata: os.stat_result) -> tuple[int, ...]:
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_mode,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
    )


def _read_descriptor(file_descriptor: int) -> bytes:
    os.lseek(file_descriptor, 0, os.SEEK_SET)
    chunks: list[bytes] = []
    while True:
        chunk = os.read(file_descriptor, 1024 * 1024)
        if not chunk:
            return b"".join(chunks)
        chunks.append(chunk)


def _read_exact_files(path: Path) -> tuple[dict[str, bytes], list[str]]:
    """Capture a stable no-follow snapshot through directory-relative descriptors."""
    errors: list[str] = []
    payloads: dict[str, bytes] = {}
    if not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY"):
        return {}, ["descriptor-safe artifact verification is unavailable on this platform"]
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory_flags |= getattr(os, "O_CLOEXEC", 0)
    try:
        directory_fd = os.open(path, directory_flags)
    except OSError as exc:
        return {}, [f"cannot open real artifact directory without following links: {exc}"]

    opened: dict[str, tuple[int, os.stat_result]] = {}
    try:
        try:
            initial_names = set(os.listdir(directory_fd))
        except OSError as exc:
            return {}, [f"cannot enumerate artifact directory descriptor: {exc}"]
        expected_names = set(REQUIRED_ARTIFACT_FILES)
        missing = sorted(expected_names - initial_names)
        unexpected = sorted(initial_names - expected_names)
        if missing:
            errors.append("missing required files: " + ", ".join(missing))
        if unexpected:
            errors.append("unexpected artifact entries: " + ", ".join(unexpected))

        file_flags = (
            os.O_RDONLY
            | os.O_NOFOLLOW
            | os.O_NONBLOCK
            | getattr(os, "O_CLOEXEC", 0)
        )
        total_size = 0
        for name in sorted(expected_names & initial_names):
            try:
                file_descriptor = os.open(
                    name,
                    file_flags,
                    dir_fd=directory_fd,
                )
            except OSError as exc:
                errors.append(f"cannot open {name} without following links: {exc}")
                continue
            try:
                metadata = os.fstat(file_descriptor)
            except OSError as exc:
                os.close(file_descriptor)
                errors.append(f"cannot stat opened {name}: {exc}")
                continue
            opened[name] = (file_descriptor, metadata)
            if not stat.S_ISREG(metadata.st_mode):
                errors.append(f"{name} must be a regular non-symlink file")
                continue
            if metadata.st_size > MAX_ARTIFACT_FILE_BYTES:
                errors.append(
                    f"{name} exceeds maximum size of {MAX_ARTIFACT_FILE_BYTES} bytes"
                )
                continue
            total_size += metadata.st_size
            if total_size > MAX_ARTIFACT_TOTAL_BYTES:
                errors.append(
                    f"artifact exceeds maximum total size of {MAX_ARTIFACT_TOTAL_BYTES} bytes"
                )
                continue
            try:
                first_read = _read_descriptor(file_descriptor)
                second_read = _read_descriptor(file_descriptor)
                final_metadata = os.fstat(file_descriptor)
            except OSError as exc:
                errors.append(f"cannot read stable snapshot of {name}: {exc}")
                continue
            if len(first_read) != metadata.st_size:
                errors.append(f"{name} size changed while being read")
                continue
            if first_read != second_read or _metadata_identity(metadata) != _metadata_identity(
                final_metadata
            ):
                errors.append(f"{name} changed while artifact snapshot was captured")
                continue
            payloads[name] = first_read

        try:
            final_names = set(os.listdir(directory_fd))
        except OSError as exc:
            errors.append(f"cannot re-enumerate artifact directory descriptor: {exc}")
            final_names = set()
        if final_names != initial_names:
            errors.append("artifact directory entries changed during verification")
        for name, (_, opened_metadata) in opened.items():
            try:
                current_metadata = os.stat(
                    name,
                    dir_fd=directory_fd,
                    follow_symlinks=False,
                )
            except OSError as exc:
                errors.append(f"artifact entry {name} changed during verification: {exc}")
                continue
            if _metadata_identity(opened_metadata) != _metadata_identity(current_metadata):
                errors.append(f"artifact entry {name} was replaced during verification")
    finally:
        for file_descriptor, _ in opened.values():
            os.close(file_descriptor)
        os.close(directory_fd)
    return payloads, errors


def _parse_events(data: bytes) -> tuple[TraceEvent, ...]:
    if not data.endswith(b"\n"):
        raise ValueError("events.jsonl must end with exactly one complete event line")
    raw_lines = data.splitlines()
    if not raw_lines:
        raise ValueError("events.jsonl contains no events")
    if len(raw_lines) > MAX_EVENT_COUNT:
        raise ValueError(f"events.jsonl exceeds maximum event count of {MAX_EVENT_COUNT}")
    events: list[TraceEvent] = []
    for line_number, line in enumerate(raw_lines, start=1):
        if not line:
            raise ValueError(f"events.jsonl contains a blank line at line {line_number}")
        if len(line) > MAX_EVENT_LINE_BYTES:
            raise ValueError(
                f"events.jsonl line {line_number} exceeds {MAX_EVENT_LINE_BYTES} bytes"
            )
        payload = _strict_json(line, f"events.jsonl line {line_number}")
        canonical = canonical_json_bytes(payload)
        if line != canonical:
            raise ValueError(f"events.jsonl line {line_number} is not canonical JSON")
        try:
            events.append(TraceEvent.model_validate_json(canonical))
        except ValidationError as exc:
            raise ValueError(
                f"events.jsonl line {line_number} schema validation failed: {exc}"
            ) from exc
    return tuple(events)


def _first_sequence(message: str) -> int | None:
    match = re.search(r"sequence (\d+)", message)
    return int(match.group(1)) if match else None


def _profile_errors(
    context: ExecutionContext,
    scenario: ScenarioDefinition,
    events: tuple[TraceEvent, ...] | None,
) -> list[str]:
    """Validate supported runtime profiles without importing a simulator or policy."""
    errors: list[str] = []
    shield: DeterministicSafetyShield | None = None
    if context.shield.name == "noop" and context.shield.version == "1.0":
        if canonical_json_bytes(context.shield.config) != canonical_json_bytes({}):
            errors.append("execution-context.json no-op shield configuration is unsupported")
    elif context.shield.name == "deterministic" and context.shield.version == "1.0":
        try:
            shield_config = ShieldConfig.model_validate(context.shield.config)
            shield = DeterministicSafetyShield(shield_config)
            shield.reset(scenario, context.run_context.seed)
        except (ValidationError, ValueError) as exc:
            errors.append(
                "execution-context.json deterministic shield configuration is unsupported: "
                f"{exc}"
            )
    else:
        errors.append("execution-context.json contains an unsupported shield")
    if context.adapter.name != scenario.adapter:
        errors.append("scenario adapter does not match execution-context.json adapter")

    if shield is not None and events is not None:
        for event in events:
            summary = event.observation_summary
            try:
                observation = Observation(
                    sequence=summary["input_sequence"],
                    simulation_time_s=summary["input_simulation_time_s"],
                    vehicle_state=VehicleState(
                        position_m=0.0,
                        speed_mps=summary["speed_mps"],
                        acceleration_mps2=0.0,
                        lateral_offset_m=summary["lateral_offset_m"],
                        route_progress_pct=summary["route_progress_pct"],
                        collision_count=0,
                        offroad=False,
                        destination_reached=False,
                    ),
                    front_distance_m=summary.get("front_distance_m"),
                    front_relative_speed_mps=summary.get("front_relative_speed_mps"),
                    observation_age_s=summary["observation_age_s"],
                )
                expected_action, expected_reasons = shield.apply(
                    observation, event.candidate_action
                )
            except (KeyError, ValidationError, ValueError, RuntimeError) as exc:
                errors.append(
                    "stored deterministic shield replay failed at sequence "
                    f"{event.sequence}: {exc}"
                )
                break
            if (
                event.executed_action != expected_action
                or event.override_reasons != expected_reasons
            ):
                errors.append(
                    "stored deterministic shield decision mismatch at sequence "
                    f"{event.sequence}"
                )
                break

    expected_latency = scenario.control.simulated_policy_latency_ms
    if context.adapter.name == "fake":
        expected_adapter_config = {
            "model": "deterministic_architectural_test_double_v1"
        }
        expected_policy_config = {
            "target_speed_mps": scenario.control.target_speed_mps,
            "simulated_policy_latency_ms": expected_latency,
        }
        if context.adapter.version != "1.0":
            errors.append("execution-context.json contains an unsupported fake adapter version")
        if context.policy.name != "baseline" or context.policy.version != "1.0":
            errors.append("execution-context.json contains an unsupported fake policy")
        if canonical_json_bytes(context.adapter.config) != canonical_json_bytes(
            expected_adapter_config
        ):
            errors.append("execution-context.json fake adapter configuration is unsupported")
        if canonical_json_bytes(context.policy.config) != canonical_json_bytes(
            expected_policy_config
        ):
            errors.append("execution-context.json baseline policy configuration is unsupported")
    elif context.adapter.name == "metadrive":
        adapter_config = context.adapter.config
        simulator_commit = adapter_config.get("simulator_commit")
        simulator_version = adapter_config.get("simulator_version")
        decision_repeat_raw = 1.0 / (scenario.control.frequency_hz * 0.02)
        decision_repeat = round(decision_repeat_raw)
        if not math.isclose(
            decision_repeat_raw,
            decision_repeat,
            rel_tol=0.0,
            abs_tol=1e-12,
        ):
            errors.append("scenario frequency has no supported MetaDrive decision interval")
        expected_metadrive_config = {
            "use_render": False,
            "image_observation": False,
            "manual_control": False,
            "show_interface": False,
            "show_policy_mark": False,
            "map": "S",
            "start_seed": context.run_context.seed,
            "num_scenarios": 1,
            "random_agent_model": False,
            "random_spawn_lane_index": False,
            "traffic_density": 0.0,
            "random_traffic": False,
            "accident_prob": 0.0,
            "horizon": scenario.control.horizon_steps,
            "truncate_as_terminate": False,
            "physics_world_step_size": 0.02,
            "decision_repeat": decision_repeat,
            "action_check": True,
            "log_level": 50,
            "vehicle_config": {
                "spawn_lateral": scenario.initial_state.lateral_offset_m,
                "show_navi_mark": False,
                "show_dest_mark": False,
                "show_lidar": False,
                "show_lane_line_detector": False,
                "show_side_detector": False,
                "lidar": {"num_lasers": 0, "distance": 0, "num_others": 0},
            },
        }
        expected_adapter_config = {
            "headless": True,
            "agent_policy": "metadrive.policy.env_input_policy.EnvInputPolicy",
            "simulator_name": "metadrive",
            "simulator_version": SUPPORTED_METADRIVE_VERSION,
            "simulator_commit": simulator_commit,
            "simulator_source": SUPPORTED_METADRIVE_SOURCE,
            "lateral_offset_mapping": {
                "source": "agent.lane.local_coordinates(agent.position)[1]",
                "mapping": "direct_meters",
                "reset_validation_abs_tolerance_m": 1e-6,
            },
            "route_progress_mapping": {
                "source": "info.route_completion_then_agent.navigation.route_completion",
                "normalization": "100*(raw-reset_raw)/(1-reset_raw)",
                "clamp_min_pct": 0.0,
                "clamp_max_pct": 100.0,
                "destination_override": False,
            },
            "signal_availability": {
                "front_distance_m": {
                    "status": "NOT_AVAILABLE",
                    "reason": "no stable named MetaDrive 0.4.3 info signal selected",
                },
                "front_relative_speed_mps": {
                    "status": "NOT_AVAILABLE",
                    "reason": "no stable named MetaDrive 0.4.3 info signal selected",
                },
            },
            "metadrive_config": expected_metadrive_config,
        }
        expected_adapter_version = "1.0"
        if scenario.challenge is not None:
            expected_adapter_version = "1.1"
            expected_adapter_config["signal_availability"] = {
                "front_distance_m": {
                    "status": "AVAILABLE",
                    "source": (
                        "hermes_challenge_manager.actual_oriented_bounding_boxes"
                    ),
                },
                "front_relative_speed_mps": {
                    "status": "AVAILABLE",
                    "source": "hermes_challenge_manager.actual_velocity_projection",
                },
            }
            expected_adapter_config["challenge_manager"] = {
                "environment_class": (
                    "hermes.adapters.metadrive_challenge.HermesChallengeMetaDriveEnv"
                ),
                "manager_class": (
                    "hermes.adapters.metadrive_challenge.HermesChallengeManager"
                ),
                "manager_version": "1.0",
                "priority": 20,
                "actor_name": "hermes_challenge_actor",
                "actor_seed": context.run_context.seed,
            }
            expected_adapter_config["challenge"] = scenario.challenge.model_dump(mode="json")
            expected_adapter_config["front_signal_mapping"] = {
                "source": "HermesChallengeManager.actual_actor_ground_truth",
                "distance": (
                    "oriented_bounding_boxes_projected_into_ego_frame_"
                    "bumper_gap_when_laterally_overlapping"
                ),
                "relative_speed": (
                    "(actor_velocity-ego_velocity)_projected_onto_ego_heading"
                ),
                "no_lateral_overlap": None,
            }
        expected_policy_config = {
            "backend": "metadrive.policy.idm_policy.IDMPolicy",
            "backend_version": SUPPORTED_METADRIVE_VERSION,
            "deceleration_enabled": True,
            "known_limitation": "upstream IDM internal fallback is not structurally surfaced",
            "lane_change_enabled": False,
            "output_clipping": "componentwise_bounds_then_ieee754_binary32",
            "simulated_policy_latency_ms": expected_latency,
            "target_speed_km_h": scenario.control.target_speed_mps * 3.6,
            "target_speed_mps": scenario.control.target_speed_mps,
        }
        if context.adapter.version != expected_adapter_version:
            errors.append(
                "execution-context.json contains an unsupported MetaDrive adapter version"
            )
        if context.policy.name != "metadrive-idm" or context.policy.version != "1.0":
            errors.append("execution-context.json contains an unsupported MetaDrive policy")
        if simulator_version != SUPPORTED_METADRIVE_VERSION:
            errors.append("execution-context.json MetaDrive version is unsupported")
        if simulator_commit != SUPPORTED_METADRIVE_COMMIT:
            errors.append("execution-context.json MetaDrive commit is unsupported")
        if canonical_json_bytes(adapter_config) != canonical_json_bytes(
            expected_adapter_config
        ):
            errors.append("execution-context.json MetaDrive adapter configuration is unsupported")
        if canonical_json_bytes(context.policy.config) != canonical_json_bytes(
            expected_policy_config
        ):
            errors.append(
                "execution-context.json MetaDrive IDM policy configuration is unsupported"
            )
    else:
        errors.append("execution-context.json contains an unsupported adapter")

    simulated_latency = context.policy.config.get("simulated_policy_latency_ms")
    if (
        isinstance(simulated_latency, bool)
        or not isinstance(simulated_latency, (int, float))
        or not math.isfinite(simulated_latency)
        or simulated_latency < 0.0
    ):
        errors.append("execution-context.json simulated policy latency is invalid")
    elif events is not None:
        for event in events:
            if event.latency_source != "simulated":
                profile_label = (
                    "fake adapter" if context.adapter.name == "fake" else "MetaDrive adapter"
                )
                errors.append(
                    f"{profile_label} latency_source must be simulated at sequence "
                    f"{event.sequence}"
                )
                break
            if not math.isclose(
                event.policy_latency_ms,
                float(simulated_latency),
                rel_tol=0.0,
                abs_tol=1e-12,
            ):
                errors.append(
                    "policy latency does not match policy configuration at sequence "
                    f"{event.sequence}"
                )
                break
    return errors


def _inspect_captured_artifact(
    path: Path,
    payloads: dict[str, bytes],
    errors: list[str],
) -> ArtifactInspection:
    """Verify and parse one already captured immutable artifact payload set."""
    if set(REQUIRED_ARTIFACT_FILES) - payloads.keys():
        return ArtifactInspection(_invalid(path, errors), None)

    observed_bundle = payloads["bundle.sha256"]
    try:
        bundle_text = observed_bundle.decode("ascii")
    except UnicodeDecodeError as exc:
        errors.append(f"bundle.sha256 is not ASCII: {exc}")
        bundle_text = ""
    if not re.fullmatch(r"[0-9a-f]{64}\n", bundle_text):
        errors.append("bundle.sha256 must contain one lowercase SHA-256 digest")
    else:
        computed_bundle = bundle_digest(
            {name: data for name, data in payloads.items() if name != "bundle.sha256"}
        )
        if bundle_text.strip() != computed_bundle:
            errors.append("bundle.sha256 does not match manifest and companion bytes")

    manifest: ArtifactManifest | None = None
    context: ExecutionContext | None = None
    metrics: RunMetrics | None = None
    findings_document: FindingsDocument | None = None
    stored_verdict: GateResult | None = None
    for filename, model_type in (
        ("manifest.json", ArtifactManifest),
        ("execution-context.json", ExecutionContext),
        ("metrics.json", RunMetrics),
        ("findings.json", FindingsDocument),
        ("verdict.json", GateResult),
    ):
        try:
            parsed = _parse_canonical_model(payloads[filename], filename, model_type)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if filename == "manifest.json":
            manifest = parsed  # type: ignore[assignment]
        elif filename == "execution-context.json":
            context = parsed  # type: ignore[assignment]
        elif filename == "metrics.json":
            metrics = parsed  # type: ignore[assignment]
        elif filename == "findings.json":
            findings_document = parsed  # type: ignore[assignment]
        else:
            stored_verdict = parsed  # type: ignore[assignment]

    if manifest is not None:
        if manifest.required_files != REQUIRED_ARTIFACT_FILES:
            errors.append("manifest.json required_files does not match the exact bundle contract")
        if set(manifest.file_digests) != set(COMPANION_DIGEST_FILES):
            errors.append("manifest.json file_digests does not match companion inventory")
        else:
            for filename in COMPANION_DIGEST_FILES:
                observed = sha256_hex(payloads[filename])
                if manifest.file_digests[filename] != observed:
                    errors.append(f"{filename} digest does not match manifest.json")
        if manifest.integrity_limitation != INTEGRITY_LIMITATION:
            errors.append("manifest.json integrity limitation is unsupported")

    scenario = None
    gate_config = None
    try:
        scenario_text = payloads["scenario.resolved.yaml"].decode("utf-8")
        scenario = parse_scenario_yaml(scenario_text)
        if payloads["scenario.resolved.yaml"] != resolved_scenario_yaml(scenario).encode("utf-8"):
            errors.append("scenario.resolved.yaml is not canonical resolved YAML")
    except UnicodeDecodeError as exc:
        errors.append(f"scenario.resolved.yaml is not valid UTF-8: {exc}")
    except ScenarioLoadError as exc:
        errors.append(f"scenario.resolved.yaml is invalid: {exc}")
    try:
        gate_text = payloads["gate-config.resolved.yaml"].decode("utf-8")
        gate_config = parse_gate_config_yaml(gate_text)
        if payloads["gate-config.resolved.yaml"] != resolved_gate_config_yaml(gate_config).encode(
            "utf-8"
        ):
            errors.append("gate-config.resolved.yaml is not canonical resolved YAML")
    except UnicodeDecodeError as exc:
        errors.append(f"gate-config.resolved.yaml is not valid UTF-8: {exc}")
    except GateConfigError as exc:
        errors.append(f"gate-config.resolved.yaml is invalid: {exc}")

    events: tuple[TraceEvent, ...] | None = None
    first_mismatch_sequence: int | None = None
    trace_digest: str | None = None
    try:
        events = _parse_events(payloads["events.jsonl"])
        trace_digest = verify_complete_trace(events, scenario)
    except (ArithmeticError, RecursionError, ValueError, TraceIntegrityError) as exc:
        message = str(exc)
        errors.append(message)
        first_mismatch_sequence = _first_sequence(message)

    trace_text = ""
    try:
        trace_text = payloads["trace.sha256"].decode("ascii")
    except UnicodeDecodeError as exc:
        errors.append(f"trace.sha256 is not ASCII: {exc}")
    if not re.fullmatch(r"[0-9a-f]{64}\n", trace_text):
        errors.append("trace.sha256 must contain one lowercase SHA-256 digest")
    elif trace_digest is not None and trace_text.strip() != trace_digest:
        errors.append("trace.sha256 does not match the final event hash")

    if context is not None:
        for component_name, component in (
            ("adapter", context.adapter),
            ("policy", context.policy),
            ("shield", context.shield),
        ):
            if component.config_digest != config_digest(component.config):
                errors.append(f"execution-context.json {component_name} config digest mismatch")
            run_context_identity = (
                getattr(context.run_context, f"{component_name}_name"),
                getattr(context.run_context, f"{component_name}_version"),
                getattr(context.run_context, f"{component_name}_config_digest"),
            )
            component_identity = (
                component.name,
                component.version,
                component.config_digest,
            )
            if component_identity != run_context_identity:
                errors.append(
                    f"execution-context.json {component_name} component does not match "
                    "hashed run context"
                )
        suite_payload = [identity.model_dump(mode="json") for identity in context.verifier_suite]
        if context.run_context.verifier_suite_digest != config_digest(suite_payload):
            errors.append("execution-context.json verifier suite digest mismatch")
        if context.verifier_suite != PHASE1_VERIFIER_IDENTITIES:
            errors.append("execution-context.json contains an unsupported verifier suite")
        if events is not None and events[0].run_context != context.run_context:
            errors.append("execution-context.json does not match the trace run context")
        if scenario is not None:
            errors.extend(_profile_errors(context, scenario, events))
            if context.run_context.scenario_digest != scenario_digest(scenario):
                errors.append("scenario digest does not match the trace run context")
            if context.run_context.control_frequency_hz != scenario.control.frequency_hz:
                errors.append("scenario control frequency does not match trace context")
            if context.run_context.horizon_steps != scenario.control.horizon_steps:
                errors.append("scenario horizon does not match trace context")
        if gate_config is not None and (
            context.run_context.gate_config_digest != gate_config_digest(gate_config)
        ):
            errors.append("gate configuration digest does not match trace context")

    if (
        manifest is not None
        and context is not None
        and scenario is not None
        and gate_config is not None
    ):
        expected_manifest_values = {
            "adapter_name": context.adapter.name,
            "adapter_version": context.adapter.version,
            "adapter_config_digest": context.adapter.config_digest,
            "scenario_name": scenario.name,
            "scenario_version": scenario.version,
            "scenario_schema_version": scenario.schema_version,
            "scenario_digest": context.run_context.scenario_digest,
            "policy_name": context.policy.name,
            "policy_version": context.policy.version,
            "policy_config_digest": context.policy.config_digest,
            "shield_name": context.shield.name,
            "shield_version": context.shield.version,
            "shield_config_digest": context.shield.config_digest,
            "gate_name": gate_config.name,
            "gate_version": gate_config.version,
            "gate_config_digest": context.run_context.gate_config_digest,
            "verifier_suite_digest": context.run_context.verifier_suite_digest,
            "seed": context.run_context.seed,
            "control_frequency_hz": context.run_context.control_frequency_hz,
            "horizon_steps": context.run_context.horizon_steps,
        }
        for field_name, expected in expected_manifest_values.items():
            if getattr(manifest, field_name) != expected:
                errors.append(f"manifest.json {field_name} does not match execution context")
        if trace_digest is not None and manifest.trace_digest != trace_digest:
            errors.append("manifest.json trace_digest does not match the event chain")
        if context.adapter.name == "fake":
            if any(
                value is not None
                for value in (
                    manifest.simulator_name,
                    manifest.simulator_version,
                    manifest.simulator_commit,
                )
            ):
                errors.append("fake adapter manifest must not claim external simulator provenance")
        elif context.adapter.name == "metadrive":
            expected_simulator_provenance = (
                context.adapter.config.get("simulator_name"),
                context.adapter.config.get("simulator_version"),
                context.adapter.config.get("simulator_commit"),
            )
            observed_simulator_provenance = (
                manifest.simulator_name,
                manifest.simulator_version,
                manifest.simulator_commit,
            )
            if observed_simulator_provenance != expected_simulator_provenance:
                errors.append(
                    "manifest.json simulator provenance does not match trace-bound adapter config"
                )

    recomputed_verdict: GateResult | None = None
    if events is not None and scenario is not None and gate_config is not None:
        recomputed_metrics = compute_metrics(events)
        recomputed_findings = run_phase1_verifiers(events, scenario, gate_config)
        adapter_name = context.adapter.name if context is not None else "fake"
        recomputed_verdict = apply_release_gate(
            recomputed_findings,
            gate_config,
            adapter_name=adapter_name,
        )
        if metrics is not None and metrics != recomputed_metrics:
            errors.append("metrics.json does not match metrics recomputed from stored events")
        expected_findings = FindingsDocument(findings=recomputed_findings)
        if findings_document is not None and findings_document != expected_findings:
            errors.append("findings.json does not match verifiers rerun from stored events")
        if stored_verdict is not None and stored_verdict != recomputed_verdict:
            errors.append("verdict.json does not match the recomputed release gate")

    if errors:
        return ArtifactInspection(
            _invalid(
                path,
                errors,
                first_mismatch_sequence=first_mismatch_sequence,
                trace_digest=trace_digest,
            ),
            None,
        )
    assert recomputed_verdict is not None
    assert manifest is not None
    assert context is not None
    assert scenario is not None
    assert gate_config is not None
    assert events is not None
    assert metrics is not None
    assert findings_document is not None
    assert stored_verdict is not None
    verification = ArtifactVerification(
        artifact_path=str(path),
        integrity=IntegrityStatus.INTERNALLY_CONSISTENT,
        authenticity=AuthenticityStatus.NOT_AUTHENTICATED,
        verdict=recomputed_verdict.verdict,
        trace_digest=trace_digest,
        rationale=recomputed_verdict.rationale,
        supporting_finding_ids=recomputed_verdict.supporting_finding_ids,
        residual_limitations=recomputed_verdict.residual_limitations,
    )
    return ArtifactInspection(
        verification=verification,
        snapshot=VerifiedArtifactSnapshot(
            path=path,
            manifest=manifest,
            context=context,
            scenario=scenario,
            gate_config=gate_config,
            events=events,
            metrics=metrics,
            findings=findings_document,
            verdict=stored_verdict,
        ),
    )


def inspect_artifact(artifact_path: Path) -> ArtifactInspection:
    """Capture and verify an artifact once, returning a comparison-safe snapshot."""
    path = Path(os.path.abspath(os.fspath(artifact_path.expanduser())))
    payloads, errors = _read_exact_files(path)
    return _inspect_captured_artifact(path, payloads, errors)


def verify_artifact(artifact_path: Path) -> ArtifactVerification:
    """Recompute a complete evidence decision from stored bytes without simulator execution."""
    return inspect_artifact(artifact_path).verification
