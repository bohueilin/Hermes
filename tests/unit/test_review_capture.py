from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import asdict, fields
from pathlib import Path

import pytest

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
    public_models = (
        verification_module.ArtifactInspection,
        verification_module.ArtifactFileInventory,
        verification_module.VerifiedArtifactSnapshot,
    )
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
    serialized = asdict(inspection)

    def keys(value) -> set[str]:
        if isinstance(value, dict):
            return set(value) | set().union(*(keys(item) for item in value.values()))
        if isinstance(value, (list, tuple)):
            return set().union(*(keys(item) for item in value)) if value else set()
        return set()

    assert all(
        {item.name for item in fields(model)}.isdisjoint(forbidden)
        for model in public_models
    )
    assert keys(serialized).isdisjoint(forbidden)
    assert not any("_CapturedFileState" in repr(value) for value in (inspection, serialized))
    assert keys(json.loads(json.dumps(serialized, default=str))).isdisjoint(forbidden)
    assert "_CapturedFileState" not in verification_module.__dict__.get("__all__", ())


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
