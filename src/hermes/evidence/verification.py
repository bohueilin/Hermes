"""Independent stored-only verification; this module never imports runtime adapters."""

from __future__ import annotations

import json
import math
import os
import re
import stat
import struct
from collections.abc import Mapping
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from hermes.adas.decision import AdasLongitudinalDecisionKernel
from hermes.adas.interfaces import AdasControllerConfig
from hermes.domain.enums import (
    AuthenticityStatus,
    EvidenceAvailability,
    IntegrityStatus,
    Verdict,
)
from hermes.domain.models import (
    Action,
    AdasDecisionEvidence,
    ArtifactManifest,
    ArtifactManifestV2,
    ArtifactManifestV3,
    ArtifactVerification,
    ControlFaultEvidence,
    ExecutionContext,
    ExecutionContextV2,
    ExecutionContextV3,
    FaultConfig,
    FindingsDocument,
    FindingsDocumentV2,
    FindingsDocumentV3,
    GateResult,
    Measurement,
    Observation,
    ObservationFaultEvidence,
    RunMetrics,
    RunMetricsV2,
    RunMetricsV3,
    ScenarioDefinition,
    TraceEvent,
    TraceEventV2,
    TraceEventV3,
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
from hermes.evidence.schema_registry import (
    ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA,
    EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA,
    FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA,
    RUN_METRICS_BY_EVIDENCE_SCHEMA,
    TRACE_EVENT_BY_EVIDENCE_SCHEMA,
)
from hermes.evidence.trace import TraceEventLike, TraceIntegrityError, verify_complete_trace
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.faults.eligibility import (
    has_observation_faults,
    metadrive_observation_fault_policy_error,
    supports_metadrive_observation_faults,
)
from hermes.gates.config import (
    GateConfig,
    GateConfigError,
    gate_config_digest,
    parse_gate_config_yaml,
    resolved_gate_config_yaml,
)
from hermes.gates.release import (
    VerifierProfile,
    apply_release_gate,
    select_verifier_profile,
)
from hermes.scenarios.loader import (
    ScenarioLoadError,
    parse_scenario_yaml,
    resolved_scenario_yaml,
    scenario_digest,
)
from hermes.shields.config import ShieldConfig
from hermes.shields.deterministic import DeterministicSafetyShield
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_SOURCE,
    SUPPORTED_METADRIVE_VERSION,
)
from hermes.verifiers import (
    run_verifiers_for_profile,
    verifier_identities_for_profile,
)

MAX_ARTIFACT_FILE_BYTES = 16 * 1024 * 1024
MAX_ARTIFACT_TOTAL_BYTES = 64 * 1024 * 1024
MAX_EVENT_COUNT = 10_000
MAX_EVENT_LINE_BYTES = 1 * 1024 * 1024
_ModelT = TypeVar("_ModelT", bound=BaseModel)
_DESCRIPTOR_ERRORS = (OSError, NotImplementedError, TypeError)


@dataclass(frozen=True, slots=True)
class VerifiedArtifactSnapshot:
    """Parsed immutable evidence captured and verified from one descriptor snapshot."""

    path: Path
    manifest: ArtifactManifest | ArtifactManifestV2 | ArtifactManifestV3
    context: ExecutionContext | ExecutionContextV2 | ExecutionContextV3
    scenario: ScenarioDefinition
    gate_config: GateConfig
    events: tuple[TraceEventLike, ...]
    metrics: RunMetrics | RunMetricsV2 | RunMetricsV3
    findings: FindingsDocument | FindingsDocumentV2 | FindingsDocumentV3
    verdict: GateResult
    verifier_profile: VerifierProfile


@dataclass(frozen=True, slots=True)
class _CapturedFileState:
    """Private descriptor identity retained only for a review-session handoff."""

    file_name: str
    size_bytes: int
    observed_sha256: str
    metadata_identity: tuple[int, int, int, int, int, int]


@dataclass(frozen=True, slots=True)
class _SafeManifestIdentity:
    """Narrow manifest identity retained after same-capture schema validation."""

    run_id: str
    created_at_utc: str
    evidence_schema_version: str
    scenario_schema_version: str


@dataclass(frozen=True, slots=True)
class ArtifactFileInventory:
    """Portable capture observation that deliberately excludes filesystem identity."""

    file_name: str
    size_bytes: int
    observed_sha256: str


@dataclass(frozen=True, slots=True)
class _ArtifactCapture:
    """One immutable descriptor-relative capture; payload bytes never leave verification."""

    _payloads: tuple[tuple[str, bytes], ...]
    captured_files: tuple[_CapturedFileState, ...]
    errors: tuple[str, ...]

    def payload_map(self) -> dict[str, bytes]:
        return dict(self._payloads)


@dataclass(frozen=True, slots=True)
class ArtifactInspection:
    """Stored verification result and its snapshot when internally consistent."""

    verification: ArtifactVerification
    snapshot: VerifiedArtifactSnapshot | None
    source_inventory: tuple[ArtifactFileInventory, ...]
    observed_bundle_digest: str | None
    computed_bundle_digest: str | None
    observed_trace_digest: str | None
    computed_trace_digest: str | None
    stored_claim_files: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class _InspectionCapture:
    """Private verification-to-review handoff retaining descriptor identity in memory only."""

    inspection: ArtifactInspection
    captured_files: tuple[_CapturedFileState, ...]
    safe_manifest_identity: _SafeManifestIdentity | None


def _binary32(value: float) -> float:
    """Mirror the adapter's float32 projection of the spawn velocity."""
    return struct.unpack("!f", struct.pack("!f", value))[0]


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


def _parse_versioned_model(
    data: bytes,
    filename: str,
    model_types: Mapping[str, type[_ModelT]],
) -> _ModelT:
    payload = _strict_json(data, filename)
    if not isinstance(payload, dict):
        raise ValueError(f"{filename} must contain a JSON object")
    if "evidence_schema_version" not in payload:
        raise ValueError(f"{filename} is missing required evidence_schema_version")
    version = payload["evidence_schema_version"]
    if not isinstance(version, str) or version not in model_types:
        supported = ", ".join(sorted(model_types))
        raise ValueError(
            f"{filename} evidence_schema_version {version!r} is unsupported; "
            f"supported versions: {supported}"
        )
    if filename == "execution-context.json":
        run_context = payload.get("run_context")
        if not isinstance(run_context, dict) or "evidence_schema_version" not in run_context:
            raise ValueError(
                "execution-context.json run_context is missing required "
                "evidence_schema_version"
            )
        if run_context["evidence_schema_version"] != version:
            raise ValueError(
                "execution-context.json run_context evidence schema differs from its parent"
            )
    canonical = canonical_json_bytes(payload) + b"\n"
    if data != canonical:
        raise ValueError(f"{filename} is not canonical JSON")
    model_type = model_types[version]
    try:
        parsed = model_type.model_validate_json(canonical_json_bytes(payload))
    except ValidationError as exc:
        raise ValueError(f"{filename} schema validation failed: {exc}") from exc
    if type(parsed) is not model_type:
        raise ValueError(f"{filename} did not return the exact declared-version model")
    return parsed


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


def _directory_identity(metadata: os.stat_result) -> tuple[int, int, int, int, int, int]:
    return _metadata_identity(metadata)


class _ArtifactReadLimitExceeded(ValueError):
    pass


def _read_descriptor(file_descriptor: int, byte_limit: int) -> bytes:
    os.lseek(file_descriptor, 0, os.SEEK_SET)
    chunks: list[bytes] = []
    remaining = byte_limit
    while True:
        chunk = os.read(file_descriptor, min(1024 * 1024, remaining + 1))
        if not chunk:
            return b"".join(chunks)
        if len(chunk) > remaining:
            raise _ArtifactReadLimitExceeded(
                f"artifact read exceeds maximum size of {byte_limit} bytes"
            )
        chunks.append(chunk)
        remaining -= len(chunk)


def _descriptor_capture_is_supported() -> bool:
    """Require every descriptor-relative primitive; no pathname fallback exists."""
    try:
        return (
            hasattr(os, "O_NOFOLLOW")
            and hasattr(os, "O_DIRECTORY")
            and os.open in os.supports_dir_fd
            and os.stat in os.supports_dir_fd
            and os.stat in os.supports_follow_symlinks
            and os.listdir in os.supports_fd
        )
    except (AttributeError, TypeError):
        return False


def _close_descriptor(file_descriptor: int) -> None:
    with suppress(*_DESCRIPTOR_ERRORS):
        os.close(file_descriptor)


def _empty_capture(errors: list[str]) -> _ArtifactCapture:
    return _ArtifactCapture((), (), tuple(errors))


def _capture_exact_files(directory_fd: int) -> _ArtifactCapture:
    """Capture a stable no-follow snapshot through one already-open directory."""
    errors: list[str] = []
    payloads: dict[str, bytes] = {}
    opened: dict[str, tuple[int, os.stat_result]] = {}
    captured_files: dict[str, _CapturedFileState] = {}
    try:
        try:
            initial_names = set(os.listdir(directory_fd))
        except _DESCRIPTOR_ERRORS as exc:
            return _empty_capture([f"cannot enumerate artifact directory descriptor: {exc}"])
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
        captured_total_bytes = 0
        for name in (name for name in REQUIRED_ARTIFACT_FILES if name in initial_names):
            try:
                file_descriptor = os.open(
                    name,
                    file_flags,
                    dir_fd=directory_fd,
                )
            except _DESCRIPTOR_ERRORS as exc:
                errors.append(f"cannot open {name} without following links: {exc}")
                continue
            try:
                metadata = os.fstat(file_descriptor)
            except _DESCRIPTOR_ERRORS as exc:
                _close_descriptor(file_descriptor)
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
            remaining_total_bytes = MAX_ARTIFACT_TOTAL_BYTES - captured_total_bytes
            if metadata.st_size > remaining_total_bytes:
                errors.append(
                    f"artifact exceeds maximum total size of {MAX_ARTIFACT_TOTAL_BYTES} bytes"
                )
                continue
            captured_total_bytes += metadata.st_size
            try:
                first_read = _read_descriptor(file_descriptor, metadata.st_size)
                second_read = _read_descriptor(file_descriptor, len(first_read))
                final_metadata = os.fstat(file_descriptor)
            except _ArtifactReadLimitExceeded as exc:
                errors.append(f"{name} changed while artifact snapshot was captured: {exc}")
                break
            except _DESCRIPTOR_ERRORS as exc:
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
            captured_files[name] = _CapturedFileState(
                file_name=name,
                size_bytes=metadata.st_size,
                observed_sha256=sha256_hex(first_read),
                metadata_identity=_metadata_identity(metadata),
            )

        try:
            final_names = set(os.listdir(directory_fd))
        except _DESCRIPTOR_ERRORS as exc:
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
            except _DESCRIPTOR_ERRORS as exc:
                errors.append(f"artifact entry {name} changed during verification: {exc}")
                continue
            if _metadata_identity(opened_metadata) != _metadata_identity(current_metadata):
                errors.append(f"artifact entry {name} was replaced during verification")
    finally:
        for file_descriptor, _ in opened.values():
            _close_descriptor(file_descriptor)
    return _ArtifactCapture(
        _payloads=tuple(
            (name, payloads[name]) for name in REQUIRED_ARTIFACT_FILES if name in payloads
        ),
        captured_files=tuple(
            captured_files[name]
            for name in REQUIRED_ARTIFACT_FILES
            if name in captured_files
        ),
        errors=tuple(errors),
    )


def _read_exact_files(path: Path) -> _ArtifactCapture:
    """Capture a stable no-follow snapshot through directory-relative descriptors."""
    if not _descriptor_capture_is_supported():
        return _empty_capture(
            ["descriptor-safe artifact verification is unavailable on this platform"]
        )
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory_flags |= getattr(os, "O_CLOEXEC", 0)
    try:
        directory_fd = os.open(path, directory_flags)
    except _DESCRIPTOR_ERRORS as exc:
        return _empty_capture(
            [f"cannot open real artifact directory without following links: {exc}"]
        )
    try:
        return _capture_exact_files(directory_fd)
    finally:
        _close_descriptor(directory_fd)


def _parse_events(data: bytes) -> tuple[TraceEventLike, ...]:
    if not data.endswith(b"\n"):
        raise ValueError("events.jsonl must end with exactly one complete event line")
    raw_lines = data.splitlines()
    if not raw_lines:
        raise ValueError("events.jsonl contains no events")
    if len(raw_lines) > MAX_EVENT_COUNT:
        raise ValueError(f"events.jsonl exceeds maximum event count of {MAX_EVENT_COUNT}")
    events: list[TraceEventLike] = []
    for line_number, line in enumerate(raw_lines, start=1):
        if not line:
            raise ValueError(f"events.jsonl contains a blank line at line {line_number}")
        if len(line) > MAX_EVENT_LINE_BYTES:
            raise ValueError(
                f"events.jsonl line {line_number} exceeds {MAX_EVENT_LINE_BYTES} bytes"
            )
        payload = _strict_json(line, f"events.jsonl line {line_number}")
        if not isinstance(payload, dict):
            raise ValueError(f"events.jsonl line {line_number} must be a JSON object")
        if "evidence_schema_version" not in payload:
            raise ValueError(
                f"events.jsonl line {line_number} is missing required "
                "evidence_schema_version"
            )
        version = payload["evidence_schema_version"]
        model_type = (
            TRACE_EVENT_BY_EVIDENCE_SCHEMA.get(version)
            if isinstance(version, str)
            else None
        )
        if model_type is None:
            supported = ", ".join(TRACE_EVENT_BY_EVIDENCE_SCHEMA)
            raise ValueError(
                f"events.jsonl line {line_number} evidence_schema_version "
                f"{version!r} is unsupported; supported versions: {supported}"
            )
        run_context = payload.get("run_context")
        if not isinstance(run_context, dict) or "evidence_schema_version" not in run_context:
            raise ValueError(
                f"events.jsonl line {line_number} run_context is missing required "
                "evidence_schema_version"
            )
        if run_context["evidence_schema_version"] != version:
            raise ValueError(
                f"events.jsonl line {line_number} run_context evidence schema differs "
                "from the event"
            )
        canonical = canonical_json_bytes(payload)
        if line != canonical:
            raise ValueError(f"events.jsonl line {line_number} is not canonical JSON")
        try:
            parsed = model_type.model_validate_json(canonical)
        except ValidationError as exc:
            raise ValueError(
                f"events.jsonl line {line_number} schema validation failed: {exc}"
            ) from exc
        if type(parsed) is not model_type:
            raise ValueError(
                f"events.jsonl line {line_number} did not return the exact "
                "declared-version model"
            )
        events.append(parsed)
    return tuple(events)


def _first_sequence(message: str) -> int | None:
    match = re.search(r"sequence (\d+)", message)
    return int(match.group(1)) if match else None


def _strict_adas_controller_config(
    context: ExecutionContextV3,
    scenario: ScenarioDefinition,
) -> AdasControllerConfig:
    policy_config = dict(context.policy.config)
    target_speed_mps = policy_config.pop("target_speed_mps", None)
    simulated_latency_ms = policy_config.pop("simulated_policy_latency_ms", None)
    if target_speed_mps != scenario.control.target_speed_mps:
        raise ValueError("stored target speed does not match the scenario")
    if simulated_latency_ms != scenario.control.simulated_policy_latency_ms:
        raise ValueError("stored simulated latency does not match the scenario")
    return AdasControllerConfig.model_validate(policy_config)


def _expected_control_evidence(
    *,
    candidate_time_s: float,
    source_sequence: int | None,
    source_time_s: float | None,
    execution_time_s: float,
    pre_saturation_action: Action,
    reason_codes: tuple[str, ...],
) -> ControlFaultEvidence:
    latency = (
        Measurement(
            availability=EvidenceAvailability.NOT_AVAILABLE,
            unit="ms",
            reason="control-delay startup fill has no originating candidate",
        )
        if source_time_s is None
        else Measurement(
            availability=EvidenceAvailability.AVAILABLE,
            value=(execution_time_s - source_time_s) * 1000.0,
            unit="ms",
        )
    )
    return ControlFaultEvidence(
        candidate_time_s=candidate_time_s,
        executed_from_sequence=source_sequence,
        executed_from_candidate_time_s=source_time_s,
        execution_time_s=execution_time_s,
        pre_saturation_action=pre_saturation_action,
        applied_faults=reason_codes,
        control_latency_ms=latency,
        latency_source="simulated",
    )


def _replay_v3_profile(
    context: ExecutionContextV3,
    scenario: ScenarioDefinition,
    events: tuple[TraceEventLike, ...],
    *,
    shield: DeterministicSafetyShield | None,
    fault_injector: DeterministicFaultInjector | None,
    controller_config: AdasControllerConfig,
) -> list[str]:
    """Independently replay the complete stored ADAS input-to-execution kernel."""
    errors: list[str] = []
    kernel = AdasLongitudinalDecisionKernel(controller_config)
    kernel.reset(scenario)
    for event in events:
        if type(event) is not TraceEventV3:
            errors.append("stored V3 replay encountered a non-schema-3 trace event")
            break
        raw = event.observation_fault_evidence.raw_observation
        try:
            if fault_injector is None:
                delivered = raw
                expected_observation_evidence = ObservationFaultEvidence(
                    raw_observation=raw,
                    delivered_observation=raw,
                    delivered_from_sequence=raw.sequence,
                    delivered_from_time_s=raw.simulation_time_s,
                    delivery_time_s=raw.simulation_time_s,
                    applied_faults=(),
                    speed_noise_delta_mps=0.0,
                    lateral_noise_delta_m=0.0,
                )
            else:
                faulted_observation = fault_injector.process_observation(raw)
                delivered = faulted_observation.observation
                expected_observation_evidence = ObservationFaultEvidence(
                    raw_observation=raw,
                    delivered_observation=delivered,
                    delivered_from_sequence=faulted_observation.source_sequence,
                    delivered_from_time_s=faulted_observation.source_simulation_time_s,
                    delivery_time_s=faulted_observation.delivery_time_s,
                    applied_faults=faulted_observation.reason_codes,
                    speed_noise_delta_mps=faulted_observation.noise_deltas.speed_mps,
                    lateral_noise_delta_m=faulted_observation.noise_deltas.lateral_offset_m,
                )
        except (ValidationError, ValueError, RuntimeError) as exc:
            errors.append(
                f"stored deterministic fault observation replay failed at sequence "
                f"{event.sequence}: {exc}"
            )
            break
        if event.observation_fault_evidence != expected_observation_evidence:
            errors.append(
                f"stored deterministic fault observation mismatch at sequence {event.sequence}"
            )
            break

        try:
            expected_candidate, expected_decision = kernel.step(delivered)
        except (ValidationError, ValueError, RuntimeError) as exc:
            errors.append(
                f"stored ADAS policy replay failed at sequence {event.sequence}: {exc}"
            )
            break
        stored_decision = AdasDecisionEvidence(
            input_sequence=event.adas_decision_input_sequence,
            input_time_s=event.adas_decision_input_time_s,
            decision=event.adas_decision,
        )
        if (
            event.candidate_action != expected_candidate
            or stored_decision != expected_decision
        ):
            errors.append(f"stored ADAS policy replay mismatch at sequence {event.sequence}")
            break

        try:
            expected_permitted, expected_override_reasons = (
                shield.apply(delivered, expected_candidate)
                if shield is not None
                else (expected_candidate, ())
            )
            if fault_injector is None:
                expected_executed = expected_permitted
                expected_control_evidence = _expected_control_evidence(
                    candidate_time_s=raw.simulation_time_s,
                    source_sequence=event.sequence,
                    source_time_s=raw.simulation_time_s,
                    execution_time_s=raw.simulation_time_s,
                    pre_saturation_action=expected_permitted,
                    reason_codes=(),
                )
            else:
                faulted_action = fault_injector.process_action(
                    expected_permitted,
                    sequence=event.sequence,
                    simulation_time_s=raw.simulation_time_s,
                )
                expected_executed = faulted_action.action
                expected_control_evidence = _expected_control_evidence(
                    candidate_time_s=raw.simulation_time_s,
                    source_sequence=faulted_action.source_sequence,
                    source_time_s=faulted_action.source_simulation_time_s,
                    execution_time_s=faulted_action.execution_time_s,
                    pre_saturation_action=faulted_action.pre_saturation_action,
                    reason_codes=faulted_action.reason_codes,
                )
        except (ValidationError, ValueError, RuntimeError) as exc:
            errors.append(
                f"stored V3 shield/control replay failed at sequence {event.sequence}: {exc}"
            )
            break
        if (
            event.permitted_action != expected_permitted
            or event.override_reasons != expected_override_reasons
        ):
            errors.append(
                f"stored deterministic shield decision mismatch at sequence {event.sequence}"
            )
            break
        if (
            event.executed_action != expected_executed
            or event.control_fault_evidence != expected_control_evidence
        ):
            errors.append(
                f"stored deterministic fault control mismatch at sequence {event.sequence}"
            )
            break
    return errors


def _profile_errors(
    context: ExecutionContext | ExecutionContextV2 | ExecutionContextV3,
    scenario: ScenarioDefinition,
    events: tuple[TraceEventLike, ...] | None,
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

    fault_injector: DeterministicFaultInjector | None = None
    has_fault_component = (
        type(context) is ExecutionContextV2
        or (type(context) is ExecutionContextV3 and context.faults is not None)
    )
    if has_fault_component:
        assert context.faults is not None
        try:
            fault_config = FaultConfig.model_validate(context.faults.config)
            fault_injector = DeterministicFaultInjector(fault_config)
            fault_injector.reset(scenario, context.run_context.seed)
        except (ValidationError, ValueError) as exc:
            errors.append(
                "execution-context.json deterministic fault configuration is unsupported: "
                f"{exc}"
            )
        if (
            context.faults.name != "deterministic-faults"
            or context.faults.version != "1.0"
        ):
            errors.append("execution-context.json contains an unsupported fault component")
        if scenario.faults is None or canonical_json_bytes(
            context.faults.config
        ) != canonical_json_bytes(scenario.faults.model_dump(mode="json")):
            errors.append(
                "execution-context.json fault configuration does not match the scenario"
            )
    elif scenario.faults is not None:
        errors.append("fault scenario requires a declared fault execution component")

    if type(context) is ExecutionContextV3:
        if (context.faults is not None) != (scenario.faults is not None):
            errors.append(
                "execution-context.json V3 fault identity presence does not match the scenario"
            )
        try:
            controller_config = _strict_adas_controller_config(context, scenario)
        except (ValidationError, ValueError) as exc:
            errors.append(
                "execution-context.json ADAS policy configuration is unsupported: "
                f"{exc}"
            )
        else:
            if events is not None and not errors:
                errors.extend(
                    _replay_v3_profile(
                        context,
                        scenario,
                        events,
                        shield=shield,
                        fault_injector=fault_injector,
                        controller_config=controller_config,
                    )
                )

    if (
        type(context) is not ExecutionContextV3
        and fault_injector is not None
        and events is not None
    ):
        for event in events:
            if not isinstance(event, TraceEventV2):
                errors.append("stored fault replay encountered a legacy trace event")
                break
            try:
                expected_observation = fault_injector.process_observation(
                    event.observation_fault_evidence.raw_observation
                )
                expected_observation_evidence = ObservationFaultEvidence(
                    raw_observation=event.observation_fault_evidence.raw_observation,
                    delivered_observation=expected_observation.observation,
                    delivered_from_sequence=expected_observation.source_sequence,
                    delivered_from_time_s=(
                        expected_observation.source_simulation_time_s
                    ),
                    delivery_time_s=expected_observation.delivery_time_s,
                    applied_faults=expected_observation.reason_codes,
                    speed_noise_delta_mps=expected_observation.noise_deltas.speed_mps,
                    lateral_noise_delta_m=(
                        expected_observation.noise_deltas.lateral_offset_m
                    ),
                )
                expected_permitted, expected_override_reasons = (
                    shield.apply(expected_observation.observation, event.candidate_action)
                    if shield is not None
                    else (event.candidate_action, ())
                )
                expected_action = fault_injector.process_action(
                    expected_permitted,
                    sequence=event.sequence,
                    simulation_time_s=(
                        event.observation_fault_evidence.raw_observation.simulation_time_s
                    ),
                )
                expected_latency = (
                    Measurement(
                        availability=EvidenceAvailability.NOT_AVAILABLE,
                        unit="ms",
                        reason=(
                            "control-delay startup fill has no originating candidate"
                        ),
                    )
                    if expected_action.source_simulation_time_s is None
                    else Measurement(
                        availability=EvidenceAvailability.AVAILABLE,
                        value=(
                            event.observation_fault_evidence.raw_observation.simulation_time_s
                            - expected_action.source_simulation_time_s
                        )
                        * 1000.0,
                        unit="ms",
                    )
                )
                expected_control_evidence = ControlFaultEvidence(
                    candidate_time_s=(
                        event.observation_fault_evidence.raw_observation.simulation_time_s
                    ),
                    executed_from_sequence=expected_action.source_sequence,
                    executed_from_candidate_time_s=(
                        expected_action.source_simulation_time_s
                    ),
                    execution_time_s=expected_action.execution_time_s,
                    pre_saturation_action=expected_action.pre_saturation_action,
                    applied_faults=expected_action.reason_codes,
                    control_latency_ms=expected_latency,
                    latency_source="simulated",
                )
            except (ValidationError, ValueError, RuntimeError) as exc:
                errors.append(
                    f"stored deterministic fault replay failed at sequence "
                    f"{event.sequence}: {exc}"
                )
                break
            if (
                event.observation_fault_evidence != expected_observation_evidence
                or event.permitted_action != expected_permitted
                or event.override_reasons != expected_override_reasons
                or event.executed_action != expected_action.action
                or event.control_fault_evidence != expected_control_evidence
            ):
                errors.append(
                    "stored deterministic fault decision mismatch at sequence "
                    f"{event.sequence}"
                )
                break
    elif type(context) is not ExecutionContextV3 and shield is not None and events is not None:
        for event in events:
            if isinstance(event, TraceEventV2):
                errors.append("stored shield replay encountered a schema-2 fault event")
                break
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
    adas_policy = context.policy.name == "adas-longitudinal"
    if adas_policy:
        # Schema 4.0 introduces controllers whose configuration is a tuning surface rather
        # than a fixed literal, so it cannot be mirrored here the way the two pre-4.0
        # policies are. Verification instead pins identity, the simulation-only label, and
        # the fields a run is entitled to vary - the configuration itself stays bound by
        # policy_config_digest, which the comparison compatibility check still compares.
        if scenario.schema_version != "4.0":
            errors.append(
                "execution-context.json uses an ADAS policy below scenario schema_version 4.0"
            )
        if context.policy.version != "1.0":
            errors.append("execution-context.json contains an unsupported ADAS policy version")
        policy_config = context.policy.config
        if not isinstance(policy_config, dict):
            errors.append("execution-context.json ADAS policy configuration is malformed")
        elif (
            policy_config.get("label")
            != "illustrative_simulation_adas_not_real_vehicle_limits"
        ):
            errors.append("execution-context.json ADAS policy configuration is unlabelled")
        elif not policy_config.get("functions"):
            errors.append("execution-context.json ADAS policy enables no function")

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
        if not adas_policy and (
            context.policy.name != "baseline" or context.policy.version != "1.0"
        ):
            errors.append("execution-context.json contains an unsupported fake policy")
        if canonical_json_bytes(context.adapter.config) != canonical_json_bytes(
            expected_adapter_config
        ):
            errors.append("execution-context.json fake adapter configuration is unsupported")
        if not adas_policy and canonical_json_bytes(
            context.policy.config
        ) != canonical_json_bytes(expected_policy_config):
            errors.append("execution-context.json baseline policy configuration is unsupported")
    elif context.adapter.name == "metadrive":
        if has_observation_faults(scenario.faults) and not (
            supports_metadrive_observation_faults(
                context.policy.name, context.policy.version
            )
        ):
            errors.append(
                metadrive_observation_fault_policy_error(
                    context.policy.name, context.policy.version
                )
            )
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
        expected_vehicle_config: dict[str, Any] = {
            "spawn_lateral": scenario.initial_state.lateral_offset_m,
            "show_navi_mark": False,
            "show_dest_mark": False,
            "show_lidar": False,
            "show_lane_line_detector": False,
            "show_side_detector": False,
            "lidar": {"num_lasers": 0, "distance": 0, "num_others": 0},
        }
        if not math.isclose(
            scenario.initial_state.speed_mps, 0.0, rel_tol=0.0, abs_tol=1e-12
        ):
            # Mirrors MetaDriveAdapter._resolved_config: a nonzero spawn speed is a
            # schema-4.0 capability and adds exactly these two keys.
            if scenario.schema_version != "4.0":
                errors.append(
                    "scenario.resolved.yaml declares a nonzero MetaDrive spawn speed below "
                    "schema_version 4.0"
                )
            expected_vehicle_config["spawn_velocity"] = [
                _binary32(scenario.initial_state.speed_mps),
                0.0,
            ]
            expected_vehicle_config["spawn_velocity_car_frame"] = True
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
            "vehicle_config": expected_vehicle_config,
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
        if not adas_policy and (
            context.policy.name != "metadrive-idm" or context.policy.version != "1.0"
        ):
            errors.append("execution-context.json contains an unsupported MetaDrive policy")
        if simulator_version != SUPPORTED_METADRIVE_VERSION:
            errors.append("execution-context.json MetaDrive version is unsupported")
        if simulator_commit != SUPPORTED_METADRIVE_COMMIT:
            errors.append("execution-context.json MetaDrive commit is unsupported")
        if canonical_json_bytes(adapter_config) != canonical_json_bytes(
            expected_adapter_config
        ):
            errors.append("execution-context.json MetaDrive adapter configuration is unsupported")
        if not adas_policy and canonical_json_bytes(
            context.policy.config
        ) != canonical_json_bytes(expected_policy_config):
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


def _digest_claim(payload: bytes | None) -> str | None:
    if payload is None:
        return None
    try:
        text = payload.decode("ascii")
    except UnicodeDecodeError:
        return None
    return text.strip() if re.fullmatch(r"[0-9a-f]{64}\n", text) else None


def _inspection_result(
    verification: ArtifactVerification,
    snapshot: VerifiedArtifactSnapshot | None,
    capture: _ArtifactCapture,
    *,
    observed_bundle_digest: str | None,
    computed_bundle_digest: str | None,
    observed_trace_digest: str | None,
    computed_trace_digest: str | None,
    safe_manifest_identity: _SafeManifestIdentity | None,
) -> _InspectionCapture:
    inspection = ArtifactInspection(
        verification=verification,
        snapshot=snapshot,
        source_inventory=tuple(
            ArtifactFileInventory(
                file_name=item.file_name,
                size_bytes=item.size_bytes,
                observed_sha256=item.observed_sha256,
            )
            for item in capture.captured_files
        ),
        observed_bundle_digest=observed_bundle_digest,
        computed_bundle_digest=computed_bundle_digest,
        observed_trace_digest=observed_trace_digest,
        computed_trace_digest=computed_trace_digest,
        stored_claim_files=tuple(
            name
            for name in ("metrics.json", "findings.json", "verdict.json")
            if name in dict(capture._payloads)
        ),
    )
    return _InspectionCapture(inspection, capture.captured_files, safe_manifest_identity)


def _inspect_captured_artifact(path: Path, capture: _ArtifactCapture) -> _InspectionCapture:
    """Verify and parse one already captured immutable artifact payload set."""
    payloads = capture.payload_map()
    errors = list(capture.errors)
    observed_bundle_digest = _digest_claim(payloads.get("bundle.sha256"))
    observed_trace_digest = _digest_claim(payloads.get("trace.sha256"))
    required_bundle_inputs = set(REQUIRED_ARTIFACT_FILES) - {"bundle.sha256"}
    computed_bundle_digest = (
        bundle_digest(
            {name: payloads[name] for name in required_bundle_inputs}
        )
        if required_bundle_inputs.issubset(payloads)
        else None
    )
    manifest: ArtifactManifest | ArtifactManifestV2 | ArtifactManifestV3 | None = None
    safe_manifest_identity: _SafeManifestIdentity | None = None
    manifest_payload = payloads.get("manifest.json")
    if manifest_payload is not None:
        try:
            manifest = _parse_versioned_model(
                manifest_payload,
                "manifest.json",
                ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA,
            )
        except ValueError as exc:
            errors.append(str(exc))
        else:
            manifest_json = manifest.model_dump(mode="json")
            safe_manifest_identity = _SafeManifestIdentity(
                run_id=manifest.run_id,
                created_at_utc=manifest_json["created_at_utc"],
                evidence_schema_version=manifest.evidence_schema_version,
                scenario_schema_version=manifest.scenario_schema_version,
            )
    if set(REQUIRED_ARTIFACT_FILES) - payloads.keys():
        return _inspection_result(
            _invalid(path, errors),
            None,
            capture,
            observed_bundle_digest=observed_bundle_digest,
            computed_bundle_digest=computed_bundle_digest,
            observed_trace_digest=observed_trace_digest,
            computed_trace_digest=None,
            safe_manifest_identity=safe_manifest_identity,
        )

    observed_bundle = payloads["bundle.sha256"]
    try:
        bundle_text = observed_bundle.decode("ascii")
    except UnicodeDecodeError as exc:
        errors.append(f"bundle.sha256 is not ASCII: {exc}")
        bundle_text = ""
    if not re.fullmatch(r"[0-9a-f]{64}\n", bundle_text):
        errors.append("bundle.sha256 must contain one lowercase SHA-256 digest")
    else:
        assert computed_bundle_digest is not None
        if bundle_text.strip() != computed_bundle_digest:
            errors.append("bundle.sha256 does not match manifest and companion bytes")

    context: ExecutionContext | ExecutionContextV2 | ExecutionContextV3 | None = None
    metrics: RunMetrics | RunMetricsV2 | RunMetricsV3 | None = None
    findings_document: FindingsDocument | FindingsDocumentV2 | FindingsDocumentV3 | None = None
    stored_verdict: GateResult | None = None
    versioned_documents = (
        (
            "execution-context.json",
            EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA,
        ),
        ("metrics.json", RUN_METRICS_BY_EVIDENCE_SCHEMA),
        (
            "findings.json",
            FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA,
        ),
    )
    for filename, model_types in versioned_documents:
        try:
            parsed = _parse_versioned_model(payloads[filename], filename, model_types)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if filename == "execution-context.json":
            context = parsed  # type: ignore[assignment]
        elif filename == "metrics.json":
            metrics = parsed  # type: ignore[assignment]
        elif filename == "findings.json":
            findings_document = parsed  # type: ignore[assignment]
    try:
        stored_verdict = _parse_canonical_model(
            payloads["verdict.json"], "verdict.json", GateResult
        )
    except ValueError as exc:
        errors.append(str(exc))

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
    except UnicodeDecodeError as exc:
        errors.append(f"scenario.resolved.yaml is not valid UTF-8: {exc}")
    else:
        try:
            scenario = parse_scenario_yaml(scenario_text)
        except ScenarioLoadError as exc:
            errors.append(f"scenario.resolved.yaml is invalid: {exc}")
        except ValueError as exc:
            errors.append(
                "scenario.resolved.yaml is invalid: "
                f"YAML scalar construction failed ({type(exc).__name__})"
            )
        else:
            if payloads["scenario.resolved.yaml"] != resolved_scenario_yaml(
                scenario
            ).encode("utf-8"):
                errors.append("scenario.resolved.yaml is not canonical resolved YAML")
    try:
        gate_text = payloads["gate-config.resolved.yaml"].decode("utf-8")
    except UnicodeDecodeError as exc:
        errors.append(f"gate-config.resolved.yaml is not valid UTF-8: {exc}")
    else:
        try:
            gate_config = parse_gate_config_yaml(gate_text)
        except GateConfigError as exc:
            errors.append(f"gate-config.resolved.yaml is invalid: {exc}")
        except ValueError as exc:
            errors.append(
                "gate-config.resolved.yaml is invalid: "
                f"YAML scalar construction failed ({type(exc).__name__})"
            )
        else:
            if payloads[
                "gate-config.resolved.yaml"
            ] != resolved_gate_config_yaml(gate_config).encode("utf-8"):
                errors.append("gate-config.resolved.yaml is not canonical resolved YAML")

    events: tuple[TraceEventLike, ...] | None = None
    first_mismatch_sequence: int | None = None
    trace_digest: str | None = None
    trace_shield_config: ShieldConfig | None = None
    if (
        context is not None
        and context.shield.name == "deterministic"
        and context.shield.version == "1.0"
    ):
        with suppress(ValidationError):
            trace_shield_config = ShieldConfig.model_validate(context.shield.config)
    try:
        events = _parse_events(payloads["events.jsonl"])
        trace_digest = verify_complete_trace(
            events,
            scenario,
            shield_config=trace_shield_config,
        )
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
        components = [
            ("adapter", context.adapter),
            ("policy", context.policy),
            ("shield", context.shield),
        ]
        if type(context) is ExecutionContextV2 or (
            type(context) is ExecutionContextV3 and context.faults is not None
        ):
            assert context.faults is not None
            components.append(("fault", context.faults))
        for component_name, component in components:
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
        expected_suite = (
            verifier_identities_for_profile(
                select_verifier_profile(scenario),
                evidence_schema_version=context.evidence_schema_version,
            )
            if scenario is not None
            else ()
        )
        if context.verifier_suite != expected_suite:
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

    versioned_objects = [manifest, context, metrics, findings_document]
    observed_versions = {
        item.evidence_schema_version for item in versioned_objects if item is not None
    }
    if events is not None:
        observed_versions.update(event.evidence_schema_version for event in events)
    if len(observed_versions) > 1:
        errors.append("artifact files contain mixed evidence_schema_version values")
    is_v3_bundle = "3.0" in observed_versions

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
        if type(context) is ExecutionContextV2:
            if type(manifest) is not ArtifactManifestV2:
                errors.append("schema-2 execution context requires a schema-2 manifest")
            else:
                for field_name, expected in (
                    ("fault_name", context.faults.name),
                    ("fault_version", context.faults.version),
                    ("fault_config_digest", context.faults.config_digest),
                ):
                    if getattr(manifest, field_name) != expected:
                        errors.append(
                            f"manifest.json {field_name} does not match execution context"
                        )
        elif type(context) is ExecutionContextV3:
            if type(manifest) is not ArtifactManifestV3:
                errors.append("schema-3 execution context requires a schema-3 manifest")
            else:
                expected_fault_values = (
                    (None, None, None)
                    if context.faults is None
                    else (
                        context.faults.name,
                        context.faults.version,
                        context.faults.config_digest,
                    )
                )
                for field_name, expected in zip(
                    ("fault_name", "fault_version", "fault_config_digest"),
                    expected_fault_values,
                    strict=True,
                ):
                    if getattr(manifest, field_name) != expected:
                        errors.append(
                            f"manifest.json {field_name} does not match execution context"
                        )
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
    verifier_profile: VerifierProfile | None = None
    if (
        events is not None
        and trace_digest is not None
        and scenario is not None
        and gate_config is not None
        and context is not None
    ):
        try:
            recomputed_metrics = compute_metrics(
                events,
                scenario=scenario,
                gate_config=gate_config,
            )
            verifier_profile = select_verifier_profile(scenario)
            if (
                verifier_profile is VerifierProfile.LEGACY
                and type(context) is ExecutionContextV2
            ):
                # Preserved from before the shared selector existed: a schema-2 execution
                # context implies fault coverage even when the scenario no longer says so.
                verifier_profile = VerifierProfile.FAULT_COVERAGE
            if is_v3_bundle:
                v3_events = tuple(event for event in events if type(event) is TraceEventV3)
                if len(v3_events) != len(events):
                    errors.append("schema-3 scenario contains a non-schema-3 trace event")
                    recomputed_findings = ()
                else:
                    recomputed_findings = run_verifiers_for_profile(
                        verifier_profile,
                        v3_events,
                        scenario,
                        gate_config,
                        shield_config=trace_shield_config,
                    )
            elif scenario.faults is not None:
                fault_events = tuple(
                    event for event in events if isinstance(event, TraceEventV2)
                )
                if len(fault_events) != len(events):
                    errors.append("fault scenario contains a legacy trace event")
                    recomputed_findings = ()
                else:
                    recomputed_findings = run_verifiers_for_profile(
                        verifier_profile,
                        fault_events,
                        scenario,
                        gate_config,
                        shield_config=trace_shield_config,
                    )
            else:
                legacy_events = tuple(
                    event
                    for event in events
                    if isinstance(event, TraceEvent) and not isinstance(event, TraceEventV2)
                )
                if len(legacy_events) != len(events):
                    errors.append("legacy scenario contains a schema-2 trace event")
                    recomputed_findings = ()
                else:
                    recomputed_findings = run_verifiers_for_profile(
                        verifier_profile,
                        legacy_events,
                        scenario,
                        gate_config,
                        shield_config=trace_shield_config,
                    )
            recomputed_verdict = apply_release_gate(
                recomputed_findings,
                gate_config,
                adapter_name=context.adapter.name,
                expected_profile=verifier_profile,
                evidence_schema_version=context.evidence_schema_version,
            )
            if metrics is not None and metrics != recomputed_metrics:
                errors.append("metrics.json does not match metrics recomputed from stored events")
            if is_v3_bundle:
                expected_findings = FindingsDocumentV3(findings=recomputed_findings)
            elif scenario.faults is not None:
                expected_findings = FindingsDocumentV2(findings=recomputed_findings)
            else:
                expected_findings = FindingsDocument(findings=recomputed_findings)
            if findings_document is not None and findings_document != expected_findings:
                errors.append("findings.json does not match verifiers rerun from stored events")
            if stored_verdict is not None and stored_verdict != recomputed_verdict:
                errors.append("verdict.json does not match the recomputed release gate")
        except (ArithmeticError, ValidationError, ValueError) as exc:
            errors.append(
                "stored evidence recomputation failed: "
                f"unsupported derived value ({type(exc).__name__})"
            )

    if errors:
        return _inspection_result(
            _invalid(
                path,
                errors,
                first_mismatch_sequence=first_mismatch_sequence,
                trace_digest=trace_digest,
            ),
            None,
            capture,
            observed_bundle_digest=observed_bundle_digest,
            computed_bundle_digest=computed_bundle_digest,
            observed_trace_digest=observed_trace_digest,
            computed_trace_digest=trace_digest,
            safe_manifest_identity=safe_manifest_identity,
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
    assert verifier_profile is not None
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
    return _inspection_result(
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
            verifier_profile=verifier_profile,
        ),
        capture=capture,
        observed_bundle_digest=observed_bundle_digest,
        computed_bundle_digest=computed_bundle_digest,
        observed_trace_digest=observed_trace_digest,
        computed_trace_digest=trace_digest,
        safe_manifest_identity=safe_manifest_identity,
    )


def inspect_artifact(artifact_path: Path) -> ArtifactInspection:
    """Capture and verify an artifact once, returning a comparison-safe snapshot."""
    path = Path(os.path.abspath(os.fspath(artifact_path.expanduser())))
    return _inspect_captured_artifact(path, _read_exact_files(path)).inspection


def _validated_relative_selection(selected_relative_path: str) -> tuple[str, ...] | None:
    if (
        not isinstance(selected_relative_path, str)
        or not selected_relative_path
        or selected_relative_path.startswith("/")
        or "\x00" in selected_relative_path
        or "\\" in selected_relative_path
    ):
        return None
    components = tuple(selected_relative_path.split("/"))
    if any(component in {"", ".", ".."} for component in components):
        return None
    return components


def _open_artifact_under_root(
    artifact_root: Path,
    selected_relative_path: str,
) -> (
    tuple[
        Path,
        int,
        int,
        tuple[int, int, int, int, int, int],
        tuple[tuple[str, tuple[int, int, int, int, int, int]], ...],
    ]
    | tuple[Path, None, None, None, ()]
):
    root = Path(os.path.abspath(os.fspath(artifact_root.expanduser())))
    components = _validated_relative_selection(selected_relative_path)
    if components is None:
        return root, None, None, None, ()
    if not _descriptor_capture_is_supported():
        return root.joinpath(*components), None, None, None, ()
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory_flags |= getattr(os, "O_CLOEXEC", 0)
    try:
        directory_fd = os.open(root, directory_flags)
    except _DESCRIPTOR_ERRORS:
        return root.joinpath(*components), None, None, None, ()
    root_fd = directory_fd
    try:
        root_identity = _directory_identity(os.fstat(root_fd))
    except _DESCRIPTOR_ERRORS:
        _close_descriptor(root_fd)
        return root.joinpath(*components), None, None, None, ()
    identities: list[tuple[str, tuple[int, int, int, int, int, int]]] = []
    try:
        for component in components:
            next_fd = os.open(component, directory_flags, dir_fd=directory_fd)
            try:
                metadata = os.fstat(next_fd)
            except _DESCRIPTOR_ERRORS:
                _close_descriptor(next_fd)
                raise
            identities.append((component, _directory_identity(metadata)))
            if directory_fd != root_fd:
                _close_descriptor(directory_fd)
            directory_fd = next_fd
    except _DESCRIPTOR_ERRORS:
        if directory_fd != root_fd:
            _close_descriptor(directory_fd)
        _close_descriptor(root_fd)
        return root.joinpath(*components), None, None, None, ()
    return root.joinpath(*components), root_fd, directory_fd, root_identity, tuple(identities)


def _directory_chain_is_current(
    root_fd: int,
    components: tuple[str, ...],
    identities: tuple[tuple[str, tuple[int, int, int, int, int, int]], ...],
) -> bool:
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory_flags |= getattr(os, "O_CLOEXEC", 0)
    current_fd = root_fd
    opened_fds: list[int] = []
    try:
        for component, (name, expected) in zip(components, identities, strict=True):
            if name != component:
                return False
            next_fd = os.open(component, directory_flags, dir_fd=current_fd)
            opened_fds.append(next_fd)
            if _directory_identity(os.fstat(next_fd)) != expected:
                return False
            current_fd = next_fd
        return True
    except _DESCRIPTOR_ERRORS:
        return False
    finally:
        for directory_fd in reversed(opened_fds):
            _close_descriptor(directory_fd)


def _root_directory_is_current(
    root_fd: int,
    root: Path,
    expected_identity: tuple[int, int, int, int, int, int],
) -> bool:
    if not _retained_directory_identity_is_current(root_fd, expected_identity):
        return False
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory_flags |= getattr(os, "O_CLOEXEC", 0)
    try:
        current_fd = os.open(root, directory_flags)
    except _DESCRIPTOR_ERRORS:
        return False
    try:
        try:
            return _directory_identity(os.fstat(current_fd)) == expected_identity
        except _DESCRIPTOR_ERRORS:
            return False
    finally:
        _close_descriptor(current_fd)


def _retained_directory_identity_is_current(
    directory_fd: int,
    expected_identity: tuple[int, int, int, int, int, int],
) -> bool:
    try:
        return _directory_identity(os.fstat(directory_fd)) == expected_identity
    except _DESCRIPTOR_ERRORS:
        return False


def _inspect_artifact_under_root_capture(
    artifact_root: Path,
    selected_relative_path: str,
) -> _InspectionCapture:
    """Capture one lexical selection below an already configured real artifact root."""
    path, root_fd, selected_fd, root_identity, identities = _open_artifact_under_root(
        artifact_root, selected_relative_path
    )
    if root_fd is None or selected_fd is None or root_identity is None:
        return _inspect_captured_artifact(
            path,
            _empty_capture(
                [
                    "artifact root and selected path must be existing real directories "
                    "without symlink traversal"
                ]
            ),
        )
    try:
        components = _validated_relative_selection(selected_relative_path)
        assert components is not None
        try:
            capture = _capture_exact_files(selected_fd)
        finally:
            _close_descriptor(selected_fd)
        root_path = path.parents[len(components) - 1]
        binding_is_current = _root_directory_is_current(
            root_fd, root_path, root_identity
        ) and _directory_chain_is_current(root_fd, components, identities)
        if binding_is_current:
            binding_is_current = _retained_directory_identity_is_current(
                root_fd, root_identity
            )
        if not binding_is_current:
            capture = _ArtifactCapture(
                capture._payloads,
                capture.captured_files,
                (*capture.errors, "artifact directory component changed during verification"),
            )
        return _inspect_captured_artifact(path, capture)
    finally:
        _close_descriptor(root_fd)


def inspect_artifact_under_root(
    artifact_root: Path,
    selected_relative_path: str,
) -> ArtifactInspection:
    """Capture a lexical artifact selection below an existing non-symlink root."""
    return _inspect_artifact_under_root_capture(
        artifact_root, selected_relative_path
    ).inspection


def verify_artifact(artifact_path: Path) -> ArtifactVerification:
    """Recompute a complete evidence decision from stored bytes without simulator execution."""
    return inspect_artifact(artifact_path).verification
