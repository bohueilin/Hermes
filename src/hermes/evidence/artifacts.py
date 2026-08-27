"""Exact artifact format, safe staging, and atomic no-overwrite publication."""

from __future__ import annotations

import ctypes
import errno
import os
import platform
import re
import shutil
import sys
import tempfile
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from hermes import __version__
from hermes.domain.models import (
    ArtifactManifest,
    ArtifactManifestV2,
    ArtifactManifestV3,
    ExecutionContext,
    ExecutionContextV2,
    ExecutionContextV3,
    Finding,
    GateResult,
    RunMetrics,
    RunMetricsV2,
    RunMetricsV3,
    ScenarioDefinition,
    TraceEvent,
    TraceEventV2,
    TraceEventV3,
)
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.schema_registry import (
    ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA,
    EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA,
    FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA,
    RUN_CONTEXT_BY_EVIDENCE_SCHEMA,
    RUN_METRICS_BY_EVIDENCE_SCHEMA,
    TRACE_EVENT_BY_EVIDENCE_SCHEMA,
)
from hermes.evidence.trace import events_jsonl_bytes
from hermes.gates.config import GateConfig, resolved_gate_config_yaml
from hermes.scenarios.loader import resolved_scenario_yaml

REQUIRED_ARTIFACT_FILES = (
    "manifest.json",
    "execution-context.json",
    "scenario.resolved.yaml",
    "gate-config.resolved.yaml",
    "events.jsonl",
    "metrics.json",
    "findings.json",
    "verdict.json",
    "trace.sha256",
    "bundle.sha256",
)
COMPANION_DIGEST_FILES = tuple(
    name for name in REQUIRED_ARTIFACT_FILES if name not in {"manifest.json", "bundle.sha256"}
)
RUN_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
INTEGRITY_LIMITATION = (
    "Local SHA-256 chaining is tamper-evident, not independently authenticated; a party able "
    "to rewrite the complete bundle can recompute every local digest."
)
BUNDLE_DOMAIN = "hermes.bundle.v1"


class ArtifactError(RuntimeError):
    """Artifact destination, staging, serialization, or publication failed."""


class ArtifactExistsError(ArtifactError):
    """A final artifact or active writer already owns the run ID."""


def validate_run_id(run_id: str) -> None:
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise ArtifactError(
            "run ID must be 1-64 lowercase ASCII letters/digits with internal hyphens only"
        )


def _validated_artifact_root(artifact_root: Path) -> Path:
    expanded = artifact_root.expanduser()
    if expanded.is_symlink():
        raise ArtifactError(f"artifact root must not be a symlink: {expanded}")
    try:
        root = expanded.resolve(strict=True)
    except OSError as exc:
        raise ArtifactError(f"cannot resolve artifact root {expanded}: {exc}") from exc
    if not root.is_dir():
        raise ArtifactError(f"artifact root must be an existing real directory: {root}")
    return root


def validate_artifact_destination(artifact_root: Path, run_id: str) -> Path:
    validate_run_id(run_id)
    root = _validated_artifact_root(artifact_root)
    destination = root / run_id
    if os.path.lexists(destination):
        raise ArtifactExistsError(f"artifact destination already exists: {destination}")
    lock_path = root / f".{run_id}.lock"
    if os.path.lexists(lock_path):
        raise ArtifactExistsError(f"an artifact writer already owns run ID {run_id}")
    return destination


def _raise_rename_error(error_number: int, destination: Path) -> None:
    if error_number in {errno.EEXIST, errno.ENOTEMPTY}:
        raise ArtifactExistsError(f"artifact destination already exists: {destination}")
    message = os.strerror(error_number)
    raise ArtifactError(f"atomic no-replace artifact publication failed: {message}")


def _atomic_rename_no_replace(source: Path, destination: Path) -> None:
    """Rename a directory atomically while refusing any existing destination."""
    libc = ctypes.CDLL(None, use_errno=True)
    source_bytes = os.fsencode(source)
    destination_bytes = os.fsencode(destination)

    if sys.platform == "darwin":
        renamex_np = getattr(libc, "renamex_np", None)
        if renamex_np is None:
            raise ArtifactError("atomic no-replace rename is unavailable on this Darwin host")
        renamex_np.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
        renamex_np.restype = ctypes.c_int
        if renamex_np(source_bytes, destination_bytes, 0x00000004) != 0:
            _raise_rename_error(ctypes.get_errno(), destination)
        return

    if sys.platform.startswith("linux"):
        renameat2 = getattr(libc, "renameat2", None)
        if renameat2 is None:
            raise ArtifactError("atomic no-replace renameat2 is unavailable on this Linux host")
        renameat2.argtypes = [
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_uint,
        ]
        renameat2.restype = ctypes.c_int
        if renameat2(-100, source_bytes, -100, destination_bytes, 0x00000001) != 0:
            _raise_rename_error(ctypes.get_errno(), destination)
        return

    if os.name == "nt":
        try:
            os.rename(source, destination)
        except FileExistsError as exc:
            raise ArtifactExistsError(
                f"artifact destination already exists: {destination}"
            ) from exc
        except OSError as exc:
            raise ArtifactError(
                f"atomic no-replace artifact publication failed: {exc}"
            ) from exc
        return

    raise ArtifactError(
        f"atomic no-replace directory rename is unsupported on platform {sys.platform}"
    )


def config_digest(config: Any) -> str:
    return sha256_hex(canonical_json_bytes(config))


def bundle_digest(files: dict[str, bytes]) -> str:
    """Bind manifest bytes and sorted companion byte identities without recursion."""
    entries = [
        {"name": name, "size_bytes": len(payload), "sha256": sha256_hex(payload)}
        for name, payload in sorted(files.items())
    ]
    return sha256_hex(canonical_json_bytes({"domain": BUNDLE_DOMAIN, "files": entries}))


def _json_file(value: Any) -> bytes:
    return canonical_json_bytes(value) + b"\n"


def write_bundle(
    directory: Path,
    *,
    run_id: str,
    scenario: ScenarioDefinition,
    gate_config: GateConfig,
    execution_context: ExecutionContext | ExecutionContextV2 | ExecutionContextV3,
    events: tuple[TraceEvent | TraceEventV2 | TraceEventV3, ...],
    metrics: RunMetrics | RunMetricsV2 | RunMetricsV3,
    findings: tuple[Finding, ...],
    verdict: GateResult,
    repository_commit: str | None,
    repository_dirty: bool | None,
    repository_provenance_reason: str | None,
    simulator_name: str | None = None,
    simulator_version: str | None = None,
    simulator_commit: str | None = None,
) -> ArtifactManifest | ArtifactManifestV2 | ArtifactManifestV3:
    """Write a complete deterministic payload, manifest inventory, and detached bundle root."""
    version = execution_context.evidence_schema_version
    expected_context_type = EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA.get(version)
    expected_run_context_type = RUN_CONTEXT_BY_EVIDENCE_SCHEMA.get(version)
    expected_event_type = TRACE_EVENT_BY_EVIDENCE_SCHEMA.get(version)
    expected_metrics_type = RUN_METRICS_BY_EVIDENCE_SCHEMA.get(version)
    findings_type = FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA.get(version)
    manifest_type = ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA.get(version)
    if (
        expected_context_type is None
        or expected_run_context_type is None
        or expected_event_type is None
        or expected_metrics_type is None
        or findings_type is None
        or manifest_type is None
    ):
        raise ArtifactError(f"unsupported evidence schema for artifact writing: {version}")
    if type(execution_context) is not expected_context_type:
        raise ArtifactError(
            f"execution context must be the exact schema-{version[0]} model"
        )
    if type(execution_context.run_context) is not expected_run_context_type:
        raise ArtifactError(f"run context must be the exact schema-{version[0]} model")
    if type(metrics) is not expected_metrics_type:
        raise ArtifactError(f"metrics must use the exact schema-{version[0]} metrics model")
    if not events:
        raise ArtifactError("artifact writing requires at least one trace event")
    if any(type(event) is not expected_event_type for event in events):
        raise ArtifactError(f"events must use the exact schema-{version[0]} event model")

    trace_digest = events[-1].current_hash
    payloads: dict[str, bytes] = {
        "execution-context.json": _json_file(execution_context.model_dump(mode="json")),
        "scenario.resolved.yaml": resolved_scenario_yaml(scenario).encode("utf-8"),
        "gate-config.resolved.yaml": resolved_gate_config_yaml(gate_config).encode("utf-8"),
        "events.jsonl": events_jsonl_bytes(events),
        "metrics.json": _json_file(metrics.model_dump(mode="json")),
        "findings.json": _json_file(
            findings_type(findings=findings).model_dump(mode="json")
        ),
        "verdict.json": _json_file(verdict.model_dump(mode="json")),
        "trace.sha256": f"{trace_digest}\n".encode(),
    }
    for name, payload in payloads.items():
        (directory / name).write_bytes(payload)

    context = execution_context.run_context
    manifest_values = dict(
        hermes_version=__version__,
        run_id=run_id,
        created_at_utc=datetime.now(UTC),
        repository_commit=repository_commit,
        repository_dirty=repository_dirty,
        repository_provenance_reason=repository_provenance_reason,
        adapter_name=execution_context.adapter.name,
        adapter_version=execution_context.adapter.version,
        adapter_config_digest=execution_context.adapter.config_digest,
        simulator_name=simulator_name,
        simulator_version=simulator_version,
        simulator_commit=simulator_commit,
        scenario_name=scenario.name,
        scenario_version=scenario.version,
        scenario_schema_version=scenario.schema_version,
        scenario_digest=context.scenario_digest,
        policy_name=execution_context.policy.name,
        policy_version=execution_context.policy.version,
        policy_config_digest=execution_context.policy.config_digest,
        shield_name=execution_context.shield.name,
        shield_version=execution_context.shield.version,
        shield_config_digest=execution_context.shield.config_digest,
        gate_name=gate_config.name,
        gate_version=gate_config.version,
        gate_config_digest=context.gate_config_digest,
        verifier_suite_digest=context.verifier_suite_digest,
        seed=context.seed,
        control_frequency_hz=context.control_frequency_hz,
        horizon_steps=context.horizon_steps,
        python_version=platform.python_version(),
        platform=platform.platform(),
        architecture=platform.machine(),
        trace_digest=trace_digest,
        required_files=REQUIRED_ARTIFACT_FILES,
        file_digests={name: sha256_hex(payloads[name]) for name in COMPANION_DIGEST_FILES},
        integrity_limitation=INTEGRITY_LIMITATION,
    )
    fault_manifest_values: dict[str, object] = {}
    if type(execution_context) is ExecutionContextV2 or (
        type(execution_context) is ExecutionContextV3
        and execution_context.faults is not None
    ):
        assert execution_context.faults is not None
        fault_manifest_values = {
            "fault_name": execution_context.faults.name,
            "fault_version": execution_context.faults.version,
            "fault_config_digest": execution_context.faults.config_digest,
        }
    manifest = manifest_type(**manifest_values, **fault_manifest_values)
    manifest_bytes = _json_file(manifest.model_dump(mode="json"))
    (directory / "manifest.json").write_bytes(manifest_bytes)
    bundle_files = {"manifest.json": manifest_bytes, **payloads}
    (directory / "bundle.sha256").write_text(
        bundle_digest(bundle_files) + "\n",
        encoding="ascii",
    )
    return manifest


class ArtifactStager:
    """Own one temporary directory and publish it exactly once without overwrite."""

    def __init__(self, artifact_root: Path, run_id: str) -> None:
        self.root = _validated_artifact_root(artifact_root)
        self.run_id = run_id
        self.destination = validate_artifact_destination(self.root, run_id)
        self.lock_path = self.root / f".{run_id}.lock"
        self.staging_path: Path | None = None
        self._lock_fd: int | None = None
        self._published = False

    def __enter__(self) -> ArtifactStager:
        try:
            self._lock_fd = os.open(
                self.lock_path,
                os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                0o600,
            )
        except FileExistsError as exc:
            raise ArtifactExistsError(
                f"an artifact writer already owns run ID {self.run_id}"
            ) from exc
        try:
            self.staging_path = Path(
                tempfile.mkdtemp(prefix=f".{self.run_id}.tmp-", dir=self.root)
            )
        except Exception:
            self._release_lock()
            raise
        return self

    def publish(self) -> Path:
        if self.staging_path is None:
            raise ArtifactError("artifact stager is not active")
        if os.path.lexists(self.destination):
            raise ArtifactExistsError(
                f"artifact destination already exists: {self.destination}"
            )
        _atomic_rename_no_replace(self.staging_path, self.destination)
        self._published = True
        return self.destination

    def _release_lock(self) -> None:
        if self._lock_fd is not None:
            os.close(self._lock_fd)
            self._lock_fd = None
        with suppress(FileNotFoundError):
            self.lock_path.unlink()

    def __exit__(self, exc_type, exc, traceback) -> None:
        del exc_type, exc, traceback
        if not self._published and self.staging_path is not None and self.staging_path.exists():
            shutil.rmtree(self.staging_path)
        self._release_lock()
