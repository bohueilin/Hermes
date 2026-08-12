from __future__ import annotations

import hashlib
import json
import os
import shutil
from collections.abc import Mapping, Sequence
from dataclasses import asdict, fields, is_dataclass
from pathlib import Path
from typing import get_type_hints

import pytest
from pydantic import BaseModel

import hermes.evidence.verification as verification_module
from hermes.domain.enums import IntegrityStatus
from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES, bundle_digest
from hermes.evidence.verification import (
    inspect_artifact,
    inspect_artifact_under_root,
    verify_artifact,
)


def _capturable_bundle(repository_root: Path, tmp_path: Path) -> tuple[Path, Path]:
    root = tmp_path / "allowed-artifacts"
    root.mkdir()
    source = repository_root / "artifacts" / "handoff-phase5-demo"
    bundle = root / "nominal"
    shutil.copytree(source, bundle)
    return root, bundle


def test_root_contained_capture_returns_canonical_inventory_and_digest_roots(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)

    capture = verification_module._inspect_artifact_under_root_capture(root, "nominal")
    inspection = capture.inspection

    assert inspection.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert inspection.snapshot is not None
    assert tuple(item.file_name for item in inspection.source_inventory) == (
        REQUIRED_ARTIFACT_FILES
    )
    for item, descriptor_state in zip(
        inspection.source_inventory, capture.captured_files, strict=True
    ):
        payload = (bundle / item.file_name).read_bytes()
        assert item.size_bytes == len(payload)
        assert item.observed_sha256 == hashlib.sha256(payload).hexdigest()
        assert item.file_name == descriptor_state.file_name
        assert item.size_bytes == descriptor_state.size_bytes
        assert item.observed_sha256 == descriptor_state.observed_sha256
        assert len(descriptor_state.metadata_identity) == 6
    captured_payloads = {
        item.file_name: (bundle / item.file_name).read_bytes()
        for item in inspection.source_inventory
    }
    assert inspection.observed_bundle_digest == (bundle / "bundle.sha256").read_text(
        encoding="ascii"
    ).strip()
    assert inspection.computed_bundle_digest == bundle_digest(
        {
            name: payload
            for name, payload in captured_payloads.items()
            if name != "bundle.sha256"
        }
    )
    assert inspection.observed_trace_digest == (bundle / "trace.sha256").read_text(
        encoding="ascii"
    ).strip()
    assert inspection.computed_trace_digest == inspection.snapshot.manifest.trace_digest
    assert inspection.stored_claim_files == (
        "metrics.json",
        "findings.json",
        "verdict.json",
    )


@pytest.mark.parametrize(
    "selection",
    ("", ".", "/nominal", "nominal/", "nominal//child", "nominal/../other", r"nominal\\x"),
)
def test_root_contained_capture_rejects_non_lexical_selection_before_accepting_claims(
    repository_root: Path,
    tmp_path: Path,
    selection: str,
) -> None:
    root, _ = _capturable_bundle(repository_root, tmp_path)

    inspection = inspect_artifact_under_root(root, selection)

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert inspection.source_inventory == ()
    assert inspection.observed_bundle_digest is None
    assert inspection.computed_bundle_digest is None


def test_root_contained_capture_rejects_symlink_root_selected_directory_and_intermediate_directory(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)
    root_link = tmp_path / "root-link"
    root_link.symlink_to(root, target_is_directory=True)
    selected_link = root / "selected-link"
    selected_link.symlink_to(bundle, target_is_directory=True)
    outer = root / "outer"
    outer.mkdir()
    nested = outer / "nested"
    shutil.copytree(bundle, nested)
    intermediate_link = root / "middle"
    intermediate_link.symlink_to(outer, target_is_directory=True)

    inspections = (
        inspect_artifact_under_root(root_link, "nominal"),
        inspect_artifact_under_root(root, "selected-link"),
        inspect_artifact_under_root(root, "middle/nested"),
    )

    assert all(item.verification.integrity is IntegrityStatus.INVALID for item in inspections)
    assert all(item.snapshot is None for item in inspections)
    assert all(item.source_inventory == () for item in inspections)


def test_invalid_capture_lists_only_stably_captured_files_without_fabricating_roots(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)
    (bundle / "verdict.json").unlink()

    inspection = inspect_artifact_under_root(root, "nominal")

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert "verdict.json" not in {item.file_name for item in inspection.source_inventory}
    assert inspection.computed_bundle_digest is None
    assert inspection.computed_trace_digest is None


@pytest.mark.parametrize("stored_claim", (None, b"not-a-digest\n"))
def test_complete_digest_inputs_preserve_computed_root_when_stored_bundle_claim_is_unavailable(
    repository_root: Path,
    tmp_path: Path,
    stored_claim: bytes | None,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)
    expected = bundle_digest(
        {
            name: (bundle / name).read_bytes()
            for name in REQUIRED_ARTIFACT_FILES
            if name != "bundle.sha256"
        }
    )
    if stored_claim is None:
        (bundle / "bundle.sha256").unlink()
    else:
        (bundle / "bundle.sha256").write_bytes(stored_claim)

    inspection = inspect_artifact_under_root(root, "nominal")

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.observed_bundle_digest is None
    assert inspection.computed_bundle_digest == expected


def test_public_inspection_never_exposes_descriptor_identity(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, _ = _capturable_bundle(repository_root, tmp_path)
    inspection = inspect_artifact_under_root(root, "nominal")
    public_fields = {
        verification_module.ArtifactInspection: {
            "verification",
            "snapshot",
            "source_inventory",
            "observed_bundle_digest",
            "computed_bundle_digest",
            "observed_trace_digest",
            "computed_trace_digest",
            "stored_claim_files",
        },
        verification_module.ArtifactFileInventory: {
            "file_name",
            "size_bytes",
            "observed_sha256",
        },
        verification_module.VerifiedArtifactSnapshot: {
            "path",
            "manifest",
            "context",
            "scenario",
            "gate_config",
            "events",
            "metrics",
            "findings",
            "verdict",
        },
    }
    forbidden = {
        "device",
        "inode",
        "mode",
        "mtime_ns",
        "ctime_ns",
        "metadata_identity",
        "captured_files",
        "_captured_files",
        "_CapturedFileState",
    }
    def walk(value) -> set[str]:
        assert not type(value).__name__.startswith("_")
        if isinstance(value, BaseModel):
            return walk(value.model_dump(mode="python"))
        if is_dataclass(value) and not isinstance(value, type):
            return set().union(*(walk(getattr(value, item.name)) for item in fields(value)))
        if isinstance(value, Mapping):
            return set(value) | set().union(*(walk(item) for item in value.values()))
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            return set().union(*(walk(item) for item in value)) if value else set()
        return set()

    assert all(
        {item.name for item in fields(model)} == allowed
        for model, allowed in public_fields.items()
    )
    assert all(
        all("_CapturedFileState" not in str(hint) for hint in get_type_hints(model).values())
        for model in public_fields
    )
    assert walk(inspection).isdisjoint(forbidden)
    assert walk(asdict(inspection)).isdisjoint(forbidden)
    assert walk(json.loads(json.dumps(asdict(inspection), default=str))).isdisjoint(forbidden)
    assert "_CapturedFileState" not in verification_module.__dict__.get("__all__", ())


@pytest.mark.parametrize(
    "failure", ("component_open", "component_fstat", "fd_listdir", "root_reopen")
)
def test_root_capture_fails_closed_and_closes_fds_for_unsupported_descriptor_primitives(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    root, _ = _capturable_bundle(repository_root, tmp_path)
    original_open = verification_module.os.open
    original_close = verification_module.os.close
    original_listdir = verification_module.os.listdir
    original_fstat = verification_module.os.fstat
    opened: set[int] = set()
    opened_count = 0
    closed_count = 0

    def tracked_open(*args, **kwargs):
        nonlocal opened_count
        if failure == "component_open" and kwargs.get("dir_fd") is not None:
            raise NotImplementedError("component-relative open unavailable")
        if failure == "root_reopen" and kwargs.get("dir_fd") is None and opened_count >= 2:
            raise NotImplementedError("root reopen unavailable")
        descriptor = original_open(*args, **kwargs)
        opened.add(descriptor)
        opened_count += 1
        return descriptor

    def tracked_close(descriptor: int) -> None:
        nonlocal closed_count
        if descriptor in opened:
            opened.remove(descriptor)
            closed_count += 1
        original_close(descriptor)

    def unsupported_fd_listdir(path):
        if failure == "fd_listdir" and isinstance(path, int):
            raise NotImplementedError("fd listdir unavailable")
        return original_listdir(path)

    def unsupported_component_fstat(descriptor: int):
        if failure == "component_fstat" and descriptor in opened and opened_count >= 2:
            raise NotImplementedError("component fstat unavailable")
        return original_fstat(descriptor)

    monkeypatch.setattr(verification_module.os, "open", tracked_open)
    monkeypatch.setattr(verification_module.os, "close", tracked_close)
    monkeypatch.setattr(verification_module.os, "listdir", unsupported_fd_listdir)
    monkeypatch.setattr(verification_module.os, "fstat", unsupported_component_fstat)
    monkeypatch.setattr(verification_module, "_descriptor_capture_is_supported", lambda: True)

    inspection = inspect_artifact_under_root(root, "nominal")

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert opened == set()
    assert opened_count >= 1
    assert closed_count == opened_count


def test_root_capture_rejects_missing_descriptor_capabilities_without_path_fallback(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, _ = _capturable_bundle(repository_root, tmp_path)
    monkeypatch.setattr(
        verification_module, "_descriptor_capture_is_supported", lambda: False
    )

    inspection = inspect_artifact_under_root(root, "nominal")

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert inspection.source_inventory == ()
    assert inspection.verification.errors == (
        "artifact root and selected path must be existing real directories "
        "without symlink traversal",
    )


def test_root_contained_capture_detects_mutation_without_reopening_artifact_paths(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)
    original_read_descriptor = verification_module._read_descriptor
    events_payload = (bundle / "events.jsonl").read_bytes()
    mutated = False

    def mutate_after_first_events_read(file_descriptor: int, byte_limit: int) -> bytes:
        nonlocal mutated
        payload = original_read_descriptor(file_descriptor, byte_limit)
        if payload == events_payload and not mutated:
            mutated = True
            (bundle / "events.jsonl").write_bytes(payload + b"\n")
        return payload

    def forbid_path_read(*args, **kwargs):
        del args, kwargs
        raise AssertionError("artifact content was reopened by pathname")

    monkeypatch.setattr(verification_module, "_read_descriptor", mutate_after_first_events_read)
    monkeypatch.setattr(Path, "read_bytes", forbid_path_read)
    monkeypatch.setattr(Path, "read_text", forbid_path_read)

    inspection = inspect_artifact_under_root(root, "nominal")

    assert mutated
    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None


def test_legacy_inspection_remains_available_after_root_contained_capture_added(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _, bundle = _capturable_bundle(repository_root, tmp_path)

    inspection = inspect_artifact(bundle)

    assert inspection.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT


def test_legacy_verify_and_root_contained_inspection_remain_parity_for_valid_and_invalid(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)

    legacy = inspect_artifact(bundle)
    rooted = inspect_artifact_under_root(root, "nominal")

    assert legacy.verification == rooted.verification
    assert verify_artifact(bundle) == rooted.verification

    (bundle / "verdict.json").unlink()
    invalid_legacy = inspect_artifact(bundle)
    invalid_rooted = inspect_artifact_under_root(root, "nominal")

    assert invalid_legacy.verification == invalid_rooted.verification
    assert verify_artifact(bundle) == invalid_rooted.verification
    assert invalid_rooted.snapshot is None


@pytest.mark.parametrize("swap_target", ("nominal", "outer"))
@pytest.mark.parametrize("replacement", ("directory", "symlink"))
def test_root_contained_capture_rejects_directory_swap_after_descriptor_traversal(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    swap_target: str,
    replacement: str,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)
    selection = "nominal"
    if swap_target == "outer":
        outer = root / "outer"
        outer.mkdir()
        shutil.move(str(bundle), outer / "nominal")
        selection = "outer/nominal"
    target = root / swap_target
    original_capture = verification_module._capture_exact_files
    swapped = False

    def swap_after_open(directory_fd: int):
        nonlocal swapped
        if not swapped:
            moved = root / f"{swap_target}-moved"
            target.rename(moved)
            if replacement == "directory":
                shutil.copytree(moved, target)
            else:
                target.symlink_to(moved, target_is_directory=True)
            swapped = True
        return original_capture(directory_fd)

    monkeypatch.setattr(verification_module, "_capture_exact_files", swap_after_open)

    inspection = inspect_artifact_under_root(root, selection)

    assert swapped
    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert "directory component changed" in " ".join(inspection.verification.errors)


@pytest.mark.parametrize("replacement", ("clone", "rename_back"))
def test_root_contained_capture_rejects_configured_root_replacement_after_open(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    replacement: str,
) -> None:
    root, _ = _capturable_bundle(repository_root, tmp_path)
    original_capture = verification_module._capture_exact_files
    changed = False

    def replace_root_after_open(directory_fd: int):
        nonlocal changed
        if not changed:
            moved = tmp_path / "allowed-artifacts-moved"
            root.rename(moved)
            if replacement == "clone":
                shutil.copytree(moved, root)
            else:
                moved.rename(root)
            changed = True
        return original_capture(directory_fd)

    monkeypatch.setattr(verification_module, "_capture_exact_files", replace_root_after_open)

    inspection = inspect_artifact_under_root(root, "nominal")

    assert changed
    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert "directory component changed" in " ".join(inspection.verification.errors)


def test_bounded_descriptor_read_rejects_growth_without_unbounded_completion(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "growing.bin"
    source.write_bytes(b"x" * 4)
    reader = os.open(source, os.O_RDONLY)
    writer = os.open(source, os.O_WRONLY | os.O_APPEND)
    original_read = verification_module.os.read
    grew = False

    def grow_before_read(file_descriptor: int, byte_count: int) -> bytes:
        nonlocal grew
        if file_descriptor == reader and not grew:
            os.write(writer, b"y")
            grew = True
        return original_read(file_descriptor, byte_count)

    monkeypatch.setattr(verification_module.os, "read", grow_before_read)
    try:
        with pytest.raises(verification_module._ArtifactReadLimitExceeded):
            verification_module._read_descriptor(reader, 4)
    finally:
        os.close(writer)
        os.close(reader)

    assert grew


def test_root_capture_marks_growing_file_invalid_without_snapshot(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, bundle = _capturable_bundle(repository_root, tmp_path)
    original_read = verification_module.os.read
    trace_file = bundle / "trace.sha256"
    trace_inode = trace_file.stat().st_ino
    grew = False

    def grow_trace_on_first_bounded_read(file_descriptor: int, byte_count: int) -> bytes:
        nonlocal grew
        if (
            verification_module.os.fstat(file_descriptor).st_ino == trace_inode
            and not grew
        ):
            with trace_file.open("ab") as stream:
                stream.write(b"x")
            grew = True
        return original_read(file_descriptor, byte_count)

    monkeypatch.setattr(verification_module.os, "read", grow_trace_on_first_bounded_read)

    inspection = inspect_artifact_under_root(root, "nominal")

    assert grew
    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
    assert "bundle.sha256" not in {
        item.file_name for item in inspection.source_inventory
    }
    assert "trace.sha256 changed while artifact snapshot was captured" in " ".join(
        inspection.verification.errors
    )


def test_capture_resource_limits_keep_exact_and_plus_one_semantics(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle = tmp_path / "bounded"
    bundle.mkdir()
    monkeypatch.setattr(verification_module, "MAX_ARTIFACT_FILE_BYTES", 10)
    monkeypatch.setattr(verification_module, "MAX_ARTIFACT_TOTAL_BYTES", 30)
    for name in REQUIRED_ARTIFACT_FILES:
        (bundle / name).write_bytes(b"abc")

    exact_capture = verification_module._read_exact_files(bundle)
    assert not any("exceeds maximum" in error for error in exact_capture.errors)

    (bundle / "manifest.json").write_bytes(b"abcd")
    plus_one_capture = verification_module._read_exact_files(bundle)
    assert any(
        "artifact exceeds maximum total size of 30 bytes" in error
        for error in plus_one_capture.errors
    )

    (bundle / "manifest.json").write_bytes(b"x" * 11)
    file_plus_one_capture = verification_module._read_exact_files(bundle)
    assert any(
        "manifest.json exceeds maximum size of 10 bytes"
        in error
        for error in file_plus_one_capture.errors
    )


def test_partial_first_read_errors_reserve_the_total_capture_budget(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle = tmp_path / "partial-read-errors"
    bundle.mkdir()
    for name in REQUIRED_ARTIFACT_FILES:
        (bundle / name).write_bytes(b"abc")
    monkeypatch.setattr(verification_module, "MAX_ARTIFACT_FILE_BYTES", 3)
    monkeypatch.setattr(verification_module, "MAX_ARTIFACT_TOTAL_BYTES", 5)
    returned_first_pass_bytes = 0

    def partial_then_error(file_descriptor: int, byte_limit: int) -> bytes:
        nonlocal returned_first_pass_bytes
        del file_descriptor, byte_limit
        returned_first_pass_bytes += 2
        raise OSError("injected partial read failure")

    monkeypatch.setattr(verification_module, "_read_descriptor", partial_then_error)

    capture = verification_module._read_exact_files(bundle)

    assert returned_first_pass_bytes <= 5
    assert capture._payloads == ()
    assert any("cannot read stable snapshot" in error for error in capture.errors)
    assert any(
        "artifact exceeds maximum total size of 5 bytes" in error
        for error in capture.errors
    )


def test_event_parser_resource_limits_keep_exact_and_plus_one_semantics() -> None:
    max_events = verification_module.MAX_EVENT_COUNT
    max_line_bytes = verification_module.MAX_EVENT_LINE_BYTES

    with pytest.raises(ValueError, match="missing required evidence_schema_version"):
        verification_module._parse_events(b"{}\n" * max_events)
    with pytest.raises(ValueError, match=f"exceeds maximum event count of {max_events}"):
        verification_module._parse_events(b"{}\n" * (max_events + 1))
    with pytest.raises(ValueError, match="malformed JSON"):
        verification_module._parse_events(b" " * max_line_bytes + b"\n")
    with pytest.raises(
        ValueError, match=f"exceeds {max_line_bytes} bytes"
    ):
        verification_module._parse_events(b" " * (max_line_bytes + 1) + b"\n")


@pytest.mark.parametrize("selection", ("bad\x00path", None, 7))
def test_root_contained_capture_rejects_nul_and_non_string_selection(
    repository_root: Path,
    tmp_path: Path,
    selection: object,
) -> None:
    root, _ = _capturable_bundle(repository_root, tmp_path)

    inspection = inspect_artifact_under_root(root, selection)  # type: ignore[arg-type]

    assert inspection.verification.integrity is IntegrityStatus.INVALID
    assert inspection.snapshot is None
