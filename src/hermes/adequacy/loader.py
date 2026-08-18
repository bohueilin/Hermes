"""Bounded descriptor-relative capture for Phase 7 evaluation plans."""

from __future__ import annotations

import hashlib
import json
import math
import os
import stat
from contextlib import suppress
from dataclasses import dataclass
from itertools import product
from pathlib import Path, PurePosixPath
from typing import Any

import yaml
from pydantic import ValidationError

from hermes.adequacy.models import (
    CapturedSourceIdentity,
    DiscoveryLedgerEntry,
    PairPlan,
    StudyProtocol,
    _canonical_json_data,
    canonical_adequacy_json_bytes,
)
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_PLAN_FILE_BYTES = 1 * 1024 * 1024
MAX_PLAN_TOTAL_BYTES = 3 * 1024 * 1024
MAX_PLAN_LINE_BYTES = 64 * 1024
MAX_DISCOVERY_ATTEMPTS = 1024
MAX_PLAN_STRING_SCALARS = 4096

_MAX_PLAN_DEPTH = 32
_MAX_PLAN_NODES = 100_000
_MAX_PLAN_INTEGER_ABS = 2**63 - 1
_MAX_PLAN_FLOAT_ABS = 1e12

_FileIdentity = tuple[int, int, int, int, int, int]


class InvalidPlanError(ValueError):
    """Plan selection, capture, parse, or cross-record validation failed."""


@dataclass(frozen=True, slots=True)
class CapturedEvaluationPlans:
    """Parsed plans plus immutable portable identities; never source bytes."""

    protocol: StudyProtocol
    ledger: tuple[DiscoveryLedgerEntry, ...]
    pair_plan: PairPlan
    sources: tuple[CapturedSourceIdentity, CapturedSourceIdentity, CapturedSourceIdentity]


@dataclass(frozen=True, slots=True)
class _EntryIdentity:
    parent_fd: int
    name: str
    opened_fd: int
    identity: _FileIdentity


@dataclass(frozen=True, slots=True)
class _CapturedPlanFile:
    payload: bytes
    size: int
    entries: tuple[_EntryIdentity, ...]


def validate_plan_root(plan_root: Path) -> Path:
    """Validate one existing non-symlink plan root without resolving symlinks."""

    try:
        root = Path(os.path.abspath(os.fspath(plan_root)))
        root_fd = _open_plan_root(root)
    except (OSError, TypeError, ValueError) as exc:
        raise InvalidPlanError("plan root is not a safe existing directory") from exc
    else:
        os.close(root_fd)
    return root


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
            try:
                os.close(descriptor)
            except BaseException:
                with suppress(OSError):
                    os.close(child)
                raise
            descriptor = child
        return descriptor
    except BaseException:
        with suppress(OSError):
            os.close(descriptor)
        raise


def _identity(metadata: os.stat_result) -> _FileIdentity:
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


def _capture_one(
    root_fd: int,
    selection: str,
    remaining_total: int,
    owned_fds: list[int],
) -> _CapturedPlanFile:
    descriptor = root_fd
    entry_checks: list[_EntryIdentity] = []
    try:
        parts = selection.split("/")
        for component in parts[:-1]:
            parent = descriptor
            descriptor = os.open(
                component,
                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
                dir_fd=descriptor,
            )
            owned_fds.append(descriptor)
            metadata = os.fstat(descriptor)
            if not stat.S_ISDIR(metadata.st_mode):
                raise InvalidPlanError("plan selection intermediate is not a directory")
            entry_checks.append(_EntryIdentity(parent, component, descriptor, _identity(metadata)))
        parent = descriptor
        descriptor = os.open(
            parts[-1],
            os.O_RDONLY
            | os.O_NONBLOCK
            | os.O_NOFOLLOW
            | getattr(os, "O_CLOEXEC", 0),
            dir_fd=descriptor,
        )
        owned_fds.append(descriptor)
        before = os.fstat(descriptor)
        entry_checks.append(_EntryIdentity(parent, parts[-1], descriptor, _identity(before)))
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
        _revalidate_entries(entry_checks)
        return _CapturedPlanFile(first, before.st_size, tuple(entry_checks))
    except InvalidPlanError:
        raise
    except OSError as exc:
        raise InvalidPlanError("cannot capture selected plan without following links") from exc


def _revalidate_entries(entries: list[_EntryIdentity] | tuple[_EntryIdentity, ...]) -> None:
    for entry in entries:
        descriptor_identity = _identity(os.fstat(entry.opened_fd))
        path_identity = _identity(
            os.stat(entry.name, dir_fd=entry.parent_fd, follow_symlinks=False)
        )
        if descriptor_identity != entry.identity or path_identity != entry.identity:
            raise InvalidPlanError("plan entry was replaced or changed during capture")


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON constant is unsupported: {value}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _validate_plan_value(
    value: object,
    *,
    depth: int = 0,
    node_count: list[int] | None = None,
) -> None:
    if node_count is None:
        node_count = [0]
    node_count[0] += 1
    if node_count[0] > _MAX_PLAN_NODES or depth > _MAX_PLAN_DEPTH:
        raise InvalidPlanError("plan structure exceeds bounded depth or node count")
    if isinstance(value, str):
        if len(value) > MAX_PLAN_STRING_SCALARS:
            raise InvalidPlanError("plan string scalar exceeds maximum length")
    elif value is None or isinstance(value, bool):
        return
    elif isinstance(value, int):
        if abs(value) > _MAX_PLAN_INTEGER_ABS:
            raise InvalidPlanError("plan integer scalar exceeds maximum magnitude")
    elif isinstance(value, float):
        if not math.isfinite(value) or abs(value) > _MAX_PLAN_FLOAT_ABS:
            raise InvalidPlanError("plan float scalar is nonfinite or exceeds maximum magnitude")
    elif isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise InvalidPlanError("plan object keys must be strings")
            _validate_plan_value(key, depth=depth + 1, node_count=node_count)
            _validate_plan_value(item, depth=depth + 1, node_count=node_count)
    elif isinstance(value, list):
        for item in value:
            _validate_plan_value(item, depth=depth + 1, node_count=node_count)
    else:
        raise InvalidPlanError("plan contains a non-JSON YAML value")


def _canonical_payload(value: object) -> bytes:
    return _canonical_json_data(value)


def _parse_yaml(data: bytes, name: str, model_type: type[StudyProtocol] | type[PairPlan]) -> Any:
    if data.startswith(b"\xef\xbb\xbf"):
        raise InvalidPlanError(f"{name} must not contain a UTF-8 BOM")
    try:
        text = data.decode("utf-8")
        for token in yaml.scan(text):
            if isinstance(
                token,
                (yaml.tokens.AliasToken, yaml.tokens.AnchorToken, yaml.tokens.TagToken),
            ):
                raise InvalidPlanError(f"{name} must not contain YAML aliases or tags")
        payload = load_strict_yaml(text)
        _validate_plan_value(payload)
        return model_type.model_validate_json(_canonical_payload(payload))
    except InvalidPlanError:
        raise
    except (
        UnicodeDecodeError,
        UnicodeEncodeError,
        StrictYamlError,
        ValidationError,
        TypeError,
        ValueError,
        OverflowError,
        RecursionError,
        yaml.YAMLError,
    ) as exc:
        raise InvalidPlanError(f"{name} is invalid") from exc


def _parse_ledger(data: bytes, name: str) -> tuple[DiscoveryLedgerEntry, ...]:
    if data.startswith(b"\xef\xbb\xbf") or not data.endswith(b"\n") or b"\r" in data:
        raise InvalidPlanError(f"{name} is not canonical JSONL")
    records: list[DiscoveryLedgerEntry] = []
    try:
        for line in data[:-1].split(b"\n"):
            if not line or len(line) > MAX_PLAN_LINE_BYTES:
                raise InvalidPlanError(f"{name} has an invalid line")
            payload = json.loads(
                line.decode("utf-8"),
                object_pairs_hook=_unique_object,
                parse_constant=_reject_constant,
            )
            if not isinstance(payload, dict):
                raise InvalidPlanError(f"{name} lines must be JSON objects")
            _validate_plan_value(payload)
            if _canonical_payload(payload) != line:
                raise InvalidPlanError(f"{name} is not canonical JSONL")
            records.append(DiscoveryLedgerEntry.model_validate_json(_canonical_payload(payload)))
    except (
        UnicodeDecodeError,
        UnicodeEncodeError,
        ValidationError,
        TypeError,
        ValueError,
        OverflowError,
        RecursionError,
        json.JSONDecodeError,
    ) as exc:
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
    return hashlib.sha256(canonical_adequacy_json_bytes(entry.selection_evidence)).hexdigest()


def _validate_discovery_grid(
    protocol: StudyProtocol, ledger: tuple[DiscoveryLedgerEntry, ...]
) -> None:
    dimensions = protocol.baseline_grid
    expected_attempts = math.prod(len(dimension.values) for dimension in dimensions)
    if expected_attempts != len(ledger) or expected_attempts > MAX_DISCOVERY_ATTEMPTS:
        raise InvalidPlanError("discovery ledger does not exhaust the declared Cartesian grid")
    if not protocol.selection_rule.tie_breakers or protocol.selection_rule.tie_breakers[0] != (
        "GRID_ORDER"
    ):
        raise InvalidPlanError("discovery selection does not declare grid order first")
    selected_indices: list[int] = []
    first_valid_index: int | None = None
    grid_values = (dimension.values for dimension in dimensions)
    for index, (entry, values) in enumerate(zip(ledger, product(*grid_values), strict=True)):
        expected_parameters = [
            {"parameter": dimension.parameter, "value": value}
            for dimension, value in zip(dimensions, values, strict=True)
        ]
        observed_parameters = [item.model_dump(mode="json") for item in entry.parameters]
        if _canonical_payload(observed_parameters) != _canonical_payload(expected_parameters):
            raise InvalidPlanError("discovery parameters do not follow the declared grid order")
        if entry.selection.rank != index + 1 or entry.selection.tie_breaker != "GRID_ORDER":
            raise InvalidPlanError("discovery selection rank or tie breaker is inconsistent")
        if entry.selection.status == "SELECTED":
            selected_indices.append(index)
        variant = protocol.materializer.variants[index]
        if (
            entry.materialized_variant_id != variant.variant_id
            or entry.scenario_byte_digest_sha256 != variant.scenario_byte_digest_sha256
            or entry.scenario_digest_sha256 != variant.scenario_digest_sha256
            or entry.adapter_config_digest_sha256 != variant.adapter_config_digest_sha256
        ):
            raise InvalidPlanError(
                "discovery attempt does not bind its predeclared materialized variant"
            )
        selection_inputs = _selection_rule_inputs(protocol, entry)
        derived_validity = _derive_and_validate_discovery_validity(
            protocol,
            entry,
            selection_inputs,
        )
        eligible = (
            selection_inputs["SELECTION_EVIDENCE_OBSERVED"]
            and selection_inputs["SELECTION_EVIDENCE_THRESHOLD_MATCHED"]
        )
        if (derived_validity or entry.selection.status == "SELECTED") and not eligible:
            raise InvalidPlanError(
                "valid or selected discovery attempt requires observed threshold-matched evidence"
            )
        if first_valid_index is None and derived_validity:
            first_valid_index = index
    if len(selected_indices) != 1 or selected_indices[0] != first_valid_index:
        raise InvalidPlanError("discovery selection is not the first valid grid attempt")


def _validate_component_identities(protocol: StudyProtocol, pair_plan: PairPlan) -> None:
    pair = pair_plan.expected_pair
    components = protocol.expected_components
    empty_config_digest = hashlib.sha256(_canonical_payload({})).hexdigest()
    if (
        pair.hermes_version != components.hermes_version
        or pair.policy_name != components.policy.name
        or pair.policy_version != components.policy.version
        or pair.policy_config_digest_sha256 != components.policy.config_digest_sha256
        or pair.adapter_name != components.adapter.name
        or pair.adapter_version != components.adapter.version
        or pair.simulator_name != components.simulator.name
        or pair.simulator_version != components.simulator.version
        or pair.simulator_commit != components.simulator.source_commit
        or pair.gate_name != components.gate.name
        or pair.gate_version != components.gate.version
        or pair.gate_config_digest_sha256 != components.gate.config_digest_sha256
        or pair.candidate_shield_name != protocol.candidate_shield.name
        or pair.candidate_shield_version != protocol.candidate_shield.version
        or pair.candidate_shield_config_digest_sha256
        != protocol.candidate_shield.config_digest_sha256
        or pair.baseline_shield_config_digest_sha256 != empty_config_digest
    ):
        raise InvalidPlanError("pair plan component identities contradict the protocol")


def _rule_matches(observed: object, operator: str, expected: object) -> bool:
    if operator == "EQ":
        return _canonical_payload(observed) == _canonical_payload(expected)
    if operator == "NE":
        return _canonical_payload(observed) != _canonical_payload(expected)
    if (
        isinstance(observed, bool)
        or isinstance(expected, bool)
        or not isinstance(observed, (int, float))
        or not isinstance(expected, (int, float))
    ):
        raise InvalidPlanError("ordered plan rule requires comparable numeric observations")
    if operator == "LTE":
        return observed <= expected
    if operator == "GTE":
        return observed >= expected
    raise InvalidPlanError("ordered plan rule has an unsupported operator")


def _selection_rule_inputs(
    protocol: StudyProtocol,
    entry: DiscoveryLedgerEntry,
) -> dict[str, bool]:
    definition = protocol.selection_evidence
    evidence = entry.selection_evidence
    available = evidence.status == "AVAILABLE"
    observed = evidence.outcome == "OBSERVED"
    threshold_matched = False
    if observed:
        observation = evidence.observations[0]
        if observation.sequence is None or (
            observation.sequence >= protocol.planned_execution.horizon_steps
        ):
            raise InvalidPlanError(
                "discovery selection evidence sequence is outside the planned horizon"
            )
        if (
            observation.observation_id != definition.observation_id
            or observation.unit != definition.unit
            or observation.operator != definition.operator
            or type(observation.machine_value) is not float
            or type(observation.threshold_machine_value) is not float
            or _canonical_payload(observation.threshold_machine_value)
            != _canonical_payload(protocol.criteria.policy_input_ttc_lte_s)
        ):
            raise InvalidPlanError("discovery selection evidence contradicts its definition")
        threshold_matched = (
            observation.machine_value <= protocol.criteria.policy_input_ttc_lte_s
        )
    return {
        "SELECTION_EVIDENCE_AVAILABLE": available,
        "SELECTION_EVIDENCE_OBSERVED": observed,
        "SELECTION_EVIDENCE_THRESHOLD_MATCHED": threshold_matched,
    }


def _derive_and_validate_discovery_validity(
    protocol: StudyProtocol,
    entry: DiscoveryLedgerEntry,
    selection_inputs: dict[str, bool],
) -> bool:
    observations: dict[str, object] = {"INTEGRITY": entry.verification_status}
    observations.update(selection_inputs)

    validity_matches: list[bool] = []
    for rule in protocol.valid_run_rules:
        if rule.observation not in observations:
            raise InvalidPlanError("valid-run rule observation is unavailable")
        validity_matches.append(
            _rule_matches(
                observations[rule.observation],
                rule.operator,
                rule.expected_value,
            )
        )

    matching_exclusions = []
    for rule in protocol.exclusion_rules:
        if rule.observation not in observations:
            raise InvalidPlanError("exclusion-rule observation is unavailable")
        if _rule_matches(
            observations[rule.observation],
            rule.operator,
            rule.excluded_value,
        ):
            matching_exclusions.append(rule)

    declared_exclusion_ids = {rule.rule_id for rule in protocol.exclusion_rules}
    if (
        entry.exclusion.disposition == "EXCLUDED"
        and entry.exclusion.rule_id not in declared_exclusion_ids
    ):
        raise InvalidPlanError("discovery exclusion rule is not declared by the protocol")

    first_exclusion = matching_exclusions[0] if matching_exclusions else None
    derived_validity = all(validity_matches) and first_exclusion is None
    if derived_validity:
        if (
            not entry.exclusion.valid_run
            or entry.exclusion.disposition != "INCLUDED"
            or entry.exclusion.rule_id != "NONE"
        ):
            raise InvalidPlanError("discovery validity contradicts ordered protocol rules")
    elif (
        first_exclusion is None
        or entry.exclusion.valid_run
        or entry.exclusion.disposition != "EXCLUDED"
        or entry.exclusion.rule_id != first_exclusion.rule_id
    ):
        raise InvalidPlanError("discovery exclusion contradicts ordered protocol rules")
    return derived_validity


def _validate_cross_record(
    protocol: StudyProtocol,
    ledger: tuple[DiscoveryLedgerEntry, ...],
    pair_plan: PairPlan,
    sources: tuple[CapturedSourceIdentity, CapturedSourceIdentity, CapturedSourceIdentity],
) -> None:
    protocol_source, ledger_source, _ = sources
    candidate_configuration_digest = hashlib.sha256(
        canonical_adequacy_json_bytes(protocol.candidate_shield.configuration)
    ).hexdigest()
    if (
        candidate_configuration_digest != protocol.candidate_shield.config_digest_sha256
        or protocol.criteria.policy_input_ttc_lte_s
        != protocol.candidate_shield.configuration.ttc_threshold_s
        or protocol.criteria.actuation_delay_compensation_s
        != protocol.candidate_shield.configuration.actuation_delay_compensation_s
    ):
        raise InvalidPlanError("candidate shield configuration contradicts protocol criteria")
    _validate_discovery_grid(protocol, ledger)
    _validate_component_identities(protocol, pair_plan)
    for entry in ledger:
        if (
            entry.protocol_byte_digest_sha256 != protocol_source.byte_digest_sha256
            or entry.protocol_semantic_digest_sha256 != protocol_source.semantic_digest_sha256
            or entry.selection_evidence_sha256 != _selection_digest(entry)
            or entry.registration_commit
            != pair_plan.expected_pair.implementation_base_commit
            or entry.environment.hermes_version != protocol.expected_components.hermes_version
        ):
            raise InvalidPlanError(
                "discovery ledger contradicts protocol, registration, or observations"
            )
    if (
        pair_plan.protocol_byte_digest_sha256 != protocol_source.byte_digest_sha256
        or pair_plan.protocol_semantic_digest_sha256 != protocol_source.semantic_digest_sha256
        or pair_plan.discovery_ledger_byte_digest_sha256 != ledger_source.byte_digest_sha256
        or pair_plan.discovery_ledger_semantic_digest_sha256 != ledger_source.semantic_digest_sha256
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
    selected_variant = protocol.materializer.variant_by_id(
        pair_plan.expected_pair.selected_materialized_variant_id
    )
    if selected_variant is None:
        raise InvalidPlanError("pair plan selects an undeclared materialized variant")
    if (
        entry.materialized_variant_id != selected_variant.variant_id
        or entry.scenario_byte_digest_sha256 != selected_variant.scenario_byte_digest_sha256
        or entry.adapter_config_digest_sha256 != selected_variant.adapter_config_digest_sha256
        or pair_plan.expected_pair.scenario_byte_digest_sha256
        != selected_variant.scenario_byte_digest_sha256
        or pair_plan.expected_pair.scenario_digest_sha256
        != selected_variant.scenario_digest_sha256
        or pair_plan.expected_pair.adapter_config_digest_sha256
        != selected_variant.adapter_config_digest_sha256
    ):
        raise InvalidPlanError(
            "pair plan selected variant identity contradicts the protocol or ledger"
        )


def capture_evaluation_plans(
    plan_root: Path,
    protocol_relative_path: str,
    discovery_ledger_relative_path: str,
    pair_plan_relative_path: str,
) -> CapturedEvaluationPlans:
    """Capture and validate exact protocol, ledger, and pair-plan files in that order."""

    try:
        root = Path(os.path.abspath(os.fspath(plan_root)))
        selections = tuple(
            _validate_selection(root, item)
            for item in (
                protocol_relative_path,
                discovery_ledger_relative_path,
                pair_plan_relative_path,
            )
        )
    except InvalidPlanError:
        raise
    except (OSError, TypeError, ValueError) as exc:
        raise InvalidPlanError("plan root or selection is invalid") from exc
    if len(set(selections)) != len(selections):
        raise InvalidPlanError("protocol, ledger, and pair plan selections must differ")
    root_fd: int | None = None
    owned_fds: list[int] = []
    try:
        root_fd = _open_plan_root(root)
        root_before = _identity(os.fstat(root_fd))
        root_path_before = _identity(os.stat(root, follow_symlinks=False))
        if root_path_before != root_before:
            raise InvalidPlanError("plan root changed during capture")
        captures: list[_CapturedPlanFile] = []
        total = 0
        for selection in selections:
            capture = _capture_one(
                root_fd,
                selection,
                MAX_PLAN_TOTAL_BYTES - total,
                owned_fds,
            )
            captures.append(capture)
            total += capture.size
        payloads = tuple(capture.payload for capture in captures)
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
        for capture in captures:
            _revalidate_entries(capture.entries)
        if _identity(os.fstat(root_fd)) != root_before:
            raise InvalidPlanError("plan root changed during capture")
        reopened_root_fd: int | None = None
        try:
            reopened_root_fd = _open_plan_root(root)
            if _identity(os.fstat(reopened_root_fd)) != root_before:
                raise InvalidPlanError("plan root changed during capture")
        except InvalidPlanError:
            raise
        except OSError as exc:
            raise InvalidPlanError("plan root changed during capture") from exc
        finally:
            if reopened_root_fd is not None:
                with suppress(OSError):
                    os.close(reopened_root_fd)
        return CapturedEvaluationPlans(protocol, ledger, pair_plan, sources)
    except InvalidPlanError:
        raise
    except (
        OSError,
        ValidationError,
        TypeError,
        UnicodeError,
        ValueError,
        OverflowError,
        RecursionError,
    ) as exc:
        raise InvalidPlanError("captured evaluation plan set is invalid") from exc
    finally:
        for descriptor in reversed(owned_fds):
            with suppress(OSError):
                os.close(descriptor)
        if root_fd is not None:
            with suppress(OSError):
                os.close(root_fd)
