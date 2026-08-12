from __future__ import annotations

import hashlib
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
    public_fields = {item.name for item in fields(verification_module.ArtifactInspection)}
    root, _ = _capturable_bundle(repository_root, tmp_path)
    inspection = inspect_artifact_under_root(root, "nominal")
    serialized = asdict(inspection)

    def keys(value) -> set[str]:
        if isinstance(value, dict):
            return set(value) | set().union(*(keys(item) for item in value.values()))
        if isinstance(value, (list, tuple)):
            return set().union(*(keys(item) for item in value)) if value else set()
        return set()

    assert public_fields.isdisjoint({"device", "inode", "mode", "mtime_ns", "ctime_ns"})
    assert keys(serialized).isdisjoint(
        {"device", "inode", "mode", "mtime_ns", "ctime_ns"}
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

    def mutate_after_first_events_read(file_descriptor: int) -> bytes:
        nonlocal mutated
        payload = original_read_descriptor(file_descriptor)
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
