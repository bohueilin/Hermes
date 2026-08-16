"""Bounded descriptor-relative capture for Phase 7 evaluation plans."""

from __future__ import annotations

import hashlib
import json
import os
import stat
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import yaml
from pydantic import ValidationError

from hermes.adequacy.models import (
    CapturedSourceIdentity,
    DiscoveryLedgerEntry,
    PairPlan,
    StudyProtocol,
    canonical_adequacy_json_bytes,
)
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_PLAN_FILE_BYTES = 1 * 1024 * 1024
MAX_PLAN_TOTAL_BYTES = 3 * 1024 * 1024
MAX_PLAN_LINE_BYTES = 64 * 1024
MAX_DISCOVERY_ATTEMPTS = 1024
MAX_PLAN_STRING_SCALARS = 4096


class InvalidPlanError(ValueError):
    """Plan selection, capture, parse, or cross-record validation failed."""


@dataclass(frozen=True, slots=True)
class CapturedEvaluationPlans:
    """Parsed plans plus immutable portable identities; never source bytes."""

    protocol: StudyProtocol
    ledger: tuple[DiscoveryLedgerEntry, ...]
    pair_plan: PairPlan
    sources: tuple[CapturedSourceIdentity, CapturedSourceIdentity, CapturedSourceIdentity]


def validate_plan_root(plan_root: Path) -> Path:
    """Validate one existing non-symlink plan root without resolving symlinks."""

    try:
        root_fd = _open_plan_root(plan_root)
    except (OSError, ValueError) as exc:
        raise InvalidPlanError("plan root is not a safe existing directory") from exc
    else:
        os.close(root_fd)
    return Path(os.path.abspath(os.fspath(plan_root)))


def _validate_selection(root: Path, selection: str) -> str:
    if (
        not isinstance(selection, str)
        or not selection
        or selection == "."
        or selection.startswith("/")
        or selection.endswith("/")
        or "//" in selection
        or "\\" in selection
        or "\x00" in selection
    ):
        raise InvalidPlanError("plan selection must be an exact lexical relative path")
    parts = PurePosixPath(selection).parts
    if (
        not parts
        or any(part in {"", ".", ".."} for part in parts)
        or str(PurePosixPath(selection)) != selection
        or parts[0] == root.name
    ):
        raise InvalidPlanError("plan selection must be an exact lexical relative path")
    return selection


def _open_plan_root(plan_root: Path) -> int:
    raw_path = os.path.abspath(os.fspath(plan_root))
    if not os.path.isabs(raw_path):  # pragma: no cover - abspath always produces absolute paths
        raise OSError("plan root must be absolute after normalization")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    descriptor = os.open("/", flags)
    try:
        for component in Path(raw_path).parts[1:]:
            child = os.open(component, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def _identity(metadata: os.stat_result) -> tuple[int, int, int, int, int, int]:
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_mode,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
    )


def _read_exact(file_descriptor: int, expected_size: int) -> bytes:
    os.lseek(file_descriptor, 0, os.SEEK_SET)
    chunks: list[bytes] = []
    remaining = expected_size
    while remaining:
        chunk = os.read(file_descriptor, min(remaining, 64 * 1024))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _capture_one(root_fd: int, selection: str, remaining_total: int) -> tuple[bytes, int]:
    descriptor = root_fd
    opened: list[int] = []
    entry_checks: list[tuple[int, str, tuple[int, int, int, int, int, int]]] = []
    try:
        parts = selection.split("/")
        for component in parts[:-1]:
            parent = descriptor
            descriptor = os.open(
                component,
                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
                dir_fd=descriptor,
            )
            opened.append(descriptor)
            metadata = os.fstat(descriptor)
            if not stat.S_ISDIR(metadata.st_mode):
                raise InvalidPlanError("plan selection intermediate is not a directory")
            entry_checks.append((parent, component, _identity(metadata)))
        parent = descriptor
        descriptor = os.open(
            parts[-1],
            os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
            dir_fd=descriptor,
        )
        opened.append(descriptor)
        before = os.fstat(descriptor)
        entry_checks.append((parent, parts[-1], _identity(before)))
        if not stat.S_ISREG(before.st_mode):
            raise InvalidPlanError("plan selection must be a regular file")
        if before.st_size > MAX_PLAN_FILE_BYTES:
            raise InvalidPlanError("plan file exceeds maximum size")
        if before.st_size > remaining_total:
            raise InvalidPlanError("plans exceed maximum total size")
        first = _read_exact(descriptor, before.st_size)
        second = _read_exact(descriptor, before.st_size)
        after = os.fstat(descriptor)
        if len(first) != before.st_size or first != second or _identity(before) != _identity(after):
            raise InvalidPlanError("plan file changed during capture")
        for parent_fd, name, expected in entry_checks:
            if _identity(os.stat(name, dir_fd=parent_fd, follow_symlinks=False)) != expected:
                raise InvalidPlanError("plan entry was replaced during capture")
        return first, before.st_size
    except InvalidPlanError:
        raise
    except OSError as exc:
        raise InvalidPlanError("cannot capture selected plan without following links") from exc
    finally:
        for item in reversed(opened):
            with suppress(OSError):
                os.close(item)


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON constant is unsupported: {value}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _validate_string_bounds(value: object) -> None:
    if isinstance(value, str):
        if len(value) > MAX_PLAN_STRING_SCALARS:
            raise InvalidPlanError("plan string scalar exceeds maximum length")
    elif isinstance(value, dict):
        for key, item in value.items():
            _validate_string_bounds(key)
            _validate_string_bounds(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            _validate_string_bounds(item)


def _canonical_payload(value: object) -> bytes:
    return json.dumps(
        value, allow_nan=False, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")


def _parse_yaml(data: bytes, name: str, model_type: type[StudyProtocol] | type[PairPlan]) -> Any:
    if data.startswith(b"\xef\xbb\xbf"):
        raise InvalidPlanError(f"{name} must not contain a UTF-8 BOM")
    try:
        text = data.decode("utf-8")
        for token in yaml.scan(text):
            if isinstance(token, yaml.tokens.TagToken):
                raise InvalidPlanError(f"{name} must not contain YAML tags")
        payload = load_strict_yaml(text)
        _validate_string_bounds(payload)
        return model_type.model_validate_json(_canonical_payload(payload))
    except (
        UnicodeDecodeError,
        StrictYamlError,
        ValidationError,
        ValueError,
        yaml.YAMLError,
    ) as exc:
        raise InvalidPlanError(f"{name} is invalid") from exc


def _parse_ledger(data: bytes, name: str) -> tuple[DiscoveryLedgerEntry, ...]:
    if data.startswith(b"\xef\xbb\xbf") or not data.endswith(b"\n"):
        raise InvalidPlanError(f"{name} is not canonical JSONL")
    records: list[DiscoveryLedgerEntry] = []
    try:
        for line in data.splitlines():
            if not line or len(line) > MAX_PLAN_LINE_BYTES:
                raise InvalidPlanError(f"{name} has an invalid line")
            payload = json.loads(
                line.decode("utf-8"),
                object_pairs_hook=_unique_object,
                parse_constant=_reject_constant,
            )
            if not isinstance(payload, dict):
                raise InvalidPlanError(f"{name} lines must be JSON objects")
            _validate_string_bounds(payload)
            if _canonical_payload(payload) != line:
                raise InvalidPlanError(f"{name} is not canonical JSONL")
            records.append(DiscoveryLedgerEntry.model_validate_json(_canonical_payload(payload)))
    except (UnicodeDecodeError, ValidationError, ValueError, json.JSONDecodeError) as exc:
        if isinstance(exc, InvalidPlanError):
            raise
        raise InvalidPlanError(f"{name} is invalid") from exc
    if not records or len(records) > MAX_DISCOVERY_ATTEMPTS:
        raise InvalidPlanError(f"{name} has an invalid attempt count")
    if tuple(record.attempt_index for record in records) != tuple(range(len(records))):
        raise InvalidPlanError(f"{name} attempt indices are not deterministic")
    if len({record.attempt_id for record in records}) != len(records):
        raise InvalidPlanError(f"{name} attempt IDs are not unique")
    return tuple(records)


def _semantic_digest_model(model: StudyProtocol | PairPlan) -> str:
    return hashlib.sha256(canonical_adequacy_json_bytes(model)).hexdigest()


def _semantic_digest_ledger(records: tuple[DiscoveryLedgerEntry, ...]) -> str:
    payload = [record.model_dump(mode="json") for record in records]
    return hashlib.sha256(_canonical_payload(payload)).hexdigest()


def _selection_digest(entry: DiscoveryLedgerEntry) -> str:
    payload = [item.model_dump(mode="json") for item in entry.selection_observations]
    return hashlib.sha256(_canonical_payload(payload)).hexdigest()


def _validate_cross_record(
    protocol: StudyProtocol,
    ledger: tuple[DiscoveryLedgerEntry, ...],
    pair_plan: PairPlan,
    sources: tuple[CapturedSourceIdentity, CapturedSourceIdentity, CapturedSourceIdentity],
) -> None:
    protocol_source, ledger_source, _ = sources
    for entry in ledger:
        if (
            entry.protocol_byte_digest_sha256 != protocol_source.byte_digest_sha256
            or entry.protocol_semantic_digest_sha256 != protocol_source.semantic_digest_sha256
            or entry.selection_evidence_sha256 != _selection_digest(entry)
        ):
            raise InvalidPlanError("discovery ledger contradicts captured protocol or observations")
    if (
        pair_plan.protocol_byte_digest_sha256 != protocol_source.byte_digest_sha256
        or pair_plan.protocol_semantic_digest_sha256 != protocol_source.semantic_digest_sha256
        or pair_plan.discovery_ledger_byte_digest_sha256 != ledger_source.byte_digest_sha256
        or pair_plan.discovery_ledger_semantic_digest_sha256 != ledger_source.semantic_digest_sha256
        or pair_plan.expected_pair.candidate_shield_config_digest_sha256
        != protocol.candidate_shield.config_digest_sha256
        or pair_plan.expected_pair.challenge_kind != protocol.planned_execution.challenge_kind
        or pair_plan.expected_pair.seed != protocol.planned_execution.seed
        or pair_plan.expected_pair.control_frequency_hz
        != protocol.planned_execution.control_frequency_hz
        or pair_plan.expected_pair.horizon_steps != protocol.planned_execution.horizon_steps
    ):
        raise InvalidPlanError("pair plan contradicts captured protocol or ledger")
    selected = [
        entry
        for entry in ledger
        if entry.attempt_id == pair_plan.expected_pair.selected_discovery_attempt_id
    ]
    if len(selected) != 1:
        raise InvalidPlanError("pair plan selected discovery attempt is unavailable")
    entry = selected[0]
    if (
        entry.selection.status != "SELECTED"
        or entry.selection_evidence_sha256
        != pair_plan.expected_pair.selected_discovery_selection_evidence_sha256
        or entry.scenario_digest_sha256 != pair_plan.expected_pair.scenario_digest_sha256
    ):
        raise InvalidPlanError("pair plan selected discovery evidence contradicts ledger")


def capture_evaluation_plans(
    plan_root: Path,
    protocol_relative_path: str,
    discovery_ledger_relative_path: str,
    pair_plan_relative_path: str,
) -> CapturedEvaluationPlans:
    """Capture and validate exact protocol, ledger, and pair-plan files in that order."""

    root = validate_plan_root(plan_root)
    selections = tuple(
        _validate_selection(root, item)
        for item in (
            protocol_relative_path,
            discovery_ledger_relative_path,
            pair_plan_relative_path,
        )
    )
    if len(set(selections)) != len(selections):
        raise InvalidPlanError("protocol, ledger, and pair plan selections must differ")
    try:
        root_fd = _open_plan_root(root)
        root_before = _identity(os.fstat(root_fd))
        root_path_before = _identity(os.stat(root, follow_symlinks=False))
        if root_path_before != root_before:
            raise InvalidPlanError("plan root changed during capture")
        payloads: list[bytes] = []
        total = 0
        for selection in selections:
            payload, size = _capture_one(root_fd, selection, MAX_PLAN_TOTAL_BYTES - total)
            payloads.append(payload)
            total += size
        if (
            _identity(os.fstat(root_fd)) != root_before
            or _identity(os.stat(root, follow_symlinks=False)) != root_path_before
        ):
            raise InvalidPlanError("plan root changed during capture")
    except InvalidPlanError:
        raise
    except (OSError, ValueError) as exc:
        raise InvalidPlanError("plan root changed during capture") from exc
    finally:
        if "root_fd" in locals():
            with suppress(OSError):
                os.close(root_fd)
    try:
        protocol = _parse_yaml(payloads[0], selections[0], StudyProtocol)
        ledger = _parse_ledger(payloads[1], selections[1])
        pair_plan = _parse_yaml(payloads[2], selections[2], PairPlan)
        sources = (
            CapturedSourceIdentity(
                relative_path=selections[0],
                byte_digest_sha256=hashlib.sha256(payloads[0]).hexdigest(),
                semantic_digest_sha256=_semantic_digest_model(protocol),
            ),
            CapturedSourceIdentity(
                relative_path=selections[1],
                byte_digest_sha256=hashlib.sha256(payloads[1]).hexdigest(),
                semantic_digest_sha256=_semantic_digest_ledger(ledger),
            ),
            CapturedSourceIdentity(
                relative_path=selections[2],
                byte_digest_sha256=hashlib.sha256(payloads[2]).hexdigest(),
                semantic_digest_sha256=_semantic_digest_model(pair_plan),
            ),
        )
        _validate_cross_record(protocol, ledger, pair_plan, sources)
        return CapturedEvaluationPlans(protocol, ledger, pair_plan, sources)
    except InvalidPlanError:
        raise
    except (ValidationError, ValueError) as exc:
        raise InvalidPlanError("captured evaluation plan set is invalid") from exc
