from __future__ import annotations

import ast
import builtins
import hashlib
import inspect
import json
import os
import shutil
import subprocess
import sys
from dataclasses import fields
from pathlib import Path

import pytest

import hermes.review as public_review
import hermes.review.facade as facade_module
from hermes.evidence.artifacts import bundle_digest
from hermes.evidence.canonical import canonical_json_bytes
from hermes.review import (
    ReviewCacheKey,
    canonical_envelope_bytes,
    review_artifact,
    validate_artifact_root,
)
from hermes.review.models import ReviewUnavailableError, ReviewUnavailableReason


def _root_with_bundle(
    repository_root: Path,
    tmp_path: Path,
    source_name: str = "handoff-phase5-demo",
    selected_name: str = "candidate",
) -> tuple[Path, Path]:
    root = tmp_path / "allowed-artifacts"
    root.mkdir()
    selected = root / selected_name
    shutil.copytree(repository_root / "artifacts" / source_name, selected)
    return root, selected


def _coherently_refresh_bundle(bundle: Path) -> None:
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["created_at_utc"] = "2026-08-12T00:00:00Z"
    for file_name in manifest["file_digests"]:
        manifest["file_digests"][file_name] = hashlib.sha256(
            (bundle / file_name).read_bytes()
        ).hexdigest()
    manifest_path.write_bytes(canonical_json_bytes(manifest) + b"\n")
    payloads = {
        path.name: path.read_bytes()
        for path in bundle.iterdir()
        if path.name != "bundle.sha256"
    }
    (bundle / "bundle.sha256").write_text(
        bundle_digest(payloads) + "\n",
        encoding="ascii",
    )


@pytest.mark.parametrize(
    "selection",
    (
        "",
        ".",
        "/candidate",
        "candidate/",
        "candidate//x",
        "candidate/../x",
        "a/./b",
        r"a\b",
        "bad\x00path",
    ),
)
def test_facade_rejects_nonlexical_selection_before_capture(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    selection: str,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)

    def bomb(*args, **kwargs):
        del args, kwargs
        raise AssertionError("invalid selection reached capture")

    monkeypatch.setattr(facade_module, "_inspect_artifact_under_root_capture", bomb)

    with pytest.raises(ValueError, match="relative"):
        review_artifact(root, selection)


def test_facade_rejects_symlink_or_non_directory_root(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)
    link = tmp_path / "root-link"
    link.symlink_to(root, target_is_directory=True)
    regular = tmp_path / "regular"
    regular.write_text("not a root", encoding="utf-8")

    with pytest.raises(ValueError, match="real non-symlink directory"):
        review_artifact(link, "candidate")
    with pytest.raises(ValueError, match="real non-symlink directory"):
        review_artifact(regular, "candidate")


def test_public_root_validator_returns_only_explicit_absolute_real_directory(
    tmp_path: Path,
) -> None:
    root = tmp_path / "root"
    root.mkdir()
    link = tmp_path / "link"
    link.symlink_to(root, target_is_directory=True)
    file = tmp_path / "file"
    file.write_text("x", encoding="utf-8")

    assert validate_artifact_root(root) == root.absolute()
    with pytest.raises(ValueError, match="real non-symlink directory"):
        validate_artifact_root(link)
    with pytest.raises(ValueError, match="real non-symlink directory"):
        validate_artifact_root(file)
    with pytest.raises(ValueError, match="real non-symlink directory"):
        validate_artifact_root(tmp_path / "missing")
    assert inspect.signature(validate_artifact_root).parameters[
        "artifact_root"
    ].default is inspect.Parameter.empty
    assert inspect.signature(review_artifact).parameters[
        "artifact_root"
    ].default is inspect.Parameter.empty


def test_review_modules_have_one_way_authority_imports_and_no_runtime_actions(
    repository_root: Path,
) -> None:
    forbidden_modules = (
        "hermes.adapters",
        "hermes.policies",
        "hermes.runtime",
        "hermes.shields",
        "hermes.faults",
        "hermes.verifiers",
        "metadrive",
    )
    forbidden_calls = {
        "apply_release_gate",
        "compute_metrics",
        "inspect_artifact",
        "inspect_artifact_under_root",
        "verify_artifact",
        "run_phase1_verifiers",
        "run_phase4_verifiers",
        "parse_gate_config_yaml",
        "parse_scenario_yaml",
    }
    for path in (
        repository_root / "src/hermes/review/facade.py",
        repository_root / "src/hermes/review/projection.py",
    ):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        imported: list[str] = []
        calls: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module is not None:
                imported.append(node.module)
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    calls.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    calls.add(node.func.attr)
        assert not any(
            module == forbidden or module.startswith(f"{forbidden}.")
            for module in imported
            for forbidden in forbidden_modules
        )
        assert calls.isdisjoint(forbidden_calls)


def test_public_review_import_does_not_load_runtime_or_simulator_modules(
    repository_root: Path,
) -> None:
    script = """
import sys

import hermes.review

forbidden = (
    "hermes.adapters",
    "hermes.policies",
    "hermes.runtime",
    "metadrive",
)
loaded = sorted(
    name
    for name in sys.modules
    if any(name == prefix or name.startswith(prefix + ".") for prefix in forbidden)
)
if loaded:
    raise SystemExit("forbidden review imports: " + ", ".join(loaded))
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=repository_root,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr or result.stdout


def test_root_prefixed_selection_alias_is_rejected_before_capture(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)

    def bomb(*args, **kwargs):
        del args, kwargs
        raise AssertionError("root-prefixed alias reached capture")

    monkeypatch.setattr(facade_module, "_inspect_artifact_under_root_capture", bomb)
    with pytest.raises(ValueError, match="prefixed"):
        review_artifact(root, f"{root.name}/candidate")


def test_private_capture_identity_copies_exact_descriptor_fields(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)
    capture = facade_module._inspect_artifact_under_root_capture(root, "candidate")

    copied = facade_module._capture_identity(capture)

    assert len(copied.files) == len(capture.captured_files) == 10
    for projected, source in zip(copied.files, capture.captured_files, strict=True):
        device, inode, mode, size_bytes, mtime_ns, ctime_ns = source.metadata_identity
        assert source.size_bytes == size_bytes
        assert (
            projected.file_name,
            projected.device,
            projected.inode,
            projected.mode,
            projected.size_bytes,
            projected.mtime_ns,
            projected.ctime_ns,
            projected.observed_sha256,
        ) == (
            source.file_name,
            device,
            inode,
            mode,
            size_bytes,
            mtime_ns,
            ctime_ns,
            source.observed_sha256,
        )


def test_facade_full_recaptures_then_uses_exact_private_session_and_cache_identity(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, bundle = _root_with_bundle(repository_root, tmp_path)
    service = facade_module._ReviewFacade()
    captures = 0
    projections = 0
    real_capture = facade_module._inspect_artifact_under_root_capture
    real_project = facade_module.project_review_envelope

    def count_capture(*args, **kwargs):
        nonlocal captures
        captures += 1
        return real_capture(*args, **kwargs)

    def count_projection(*args, **kwargs):
        nonlocal projections
        projections += 1
        return real_project(*args, **kwargs)

    monkeypatch.setattr(facade_module, "_inspect_artifact_under_root_capture", count_capture)
    monkeypatch.setattr(facade_module, "project_review_envelope", count_projection)

    first = service.review_artifact(root, "candidate")
    second = service.review_artifact(root, "candidate")

    assert captures == 2
    assert projections == 1
    assert canonical_envelope_bytes(first) == canonical_envelope_bytes(second)
    assert len(service._cache) == 1
    key = next(iter(service._cache))
    assert fields(key) == fields(ReviewCacheKey)
    assert key.as_tuple() == (
        first.artifact.computed_bundle_digest.value,
        "1.0",
        first.tool.hermes_version,
        "candidate",
    )

    os.utime(bundle / "events.jsonl", None)
    touched = service.review_artifact(root, "candidate")

    assert captures == 3
    assert projections == 2
    assert canonical_envelope_bytes(first) == canonical_envelope_bytes(touched)


def test_private_review_result_retains_exact_current_capture_once(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)
    service = facade_module._ReviewFacade()
    captures = 0
    real_capture = facade_module._inspect_artifact_under_root_capture

    def count_capture(*args, **kwargs):
        nonlocal captures
        captures += 1
        return real_capture(*args, **kwargs)

    monkeypatch.setattr(facade_module, "_inspect_artifact_under_root_capture", count_capture)

    first = service._review_result(root, "candidate")
    second = service._review_result(root, "candidate")

    assert captures == 2
    assert first.capture is not second.capture
    assert first.capture.inspection.snapshot is not None
    assert second.capture.inspection.snapshot is not None
    assert first.cache_key is not None
    assert second.cache_key == first.cache_key
    assert canonical_envelope_bytes(first.envelope) == canonical_envelope_bytes(
        second.envelope
    )
    assert not hasattr(public_review, "_ReviewedArtifact")


def test_same_bytes_replacement_other_locator_and_invalid_evidence_do_not_stale_share(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, bundle = _root_with_bundle(repository_root, tmp_path)
    other = root / "other"
    shutil.copytree(bundle, other)
    service = facade_module._ReviewFacade()
    projections = 0
    real_project = facade_module.project_review_envelope

    def count_projection(*args, **kwargs):
        nonlocal projections
        projections += 1
        return real_project(*args, **kwargs)

    monkeypatch.setattr(facade_module, "project_review_envelope", count_projection)

    first = service.review_artifact(root, "candidate")
    moved = service.review_artifact(root, "other")
    assert first.artifact.computed_bundle_digest.value == (
        moved.artifact.computed_bundle_digest.value
    )
    assert first.artifact.locator != moved.artifact.locator
    assert len(service._cache) == 2

    original = (bundle / "events.jsonl").read_bytes()
    replacement = bundle / "replacement"
    replacement.write_bytes(original)
    os.replace(replacement, bundle / "events.jsonl")
    replaced = service.review_artifact(root, "candidate")
    assert canonical_envelope_bytes(first) == canonical_envelope_bytes(replaced)
    assert projections == 3

    invalid_root = tmp_path / "invalid-root"
    invalid_root.mkdir()
    shutil.copytree(repository_root / "artifacts" / "phase1-tampered", invalid_root / "bad")
    before = len(service._cache)
    service.review_artifact(invalid_root, "bad")
    service.review_artifact(invalid_root, "bad")
    assert len(service._cache) == before
    assert projections == 5


def test_changed_artifact_bytes_never_return_prior_cached_envelope(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, bundle = _root_with_bundle(repository_root, tmp_path)
    service = facade_module._ReviewFacade()
    accepted = service.review_artifact(root, "candidate")

    events = bundle / "events.jsonl"
    changed = events.read_bytes().replace(b'"sequence":0', b'"sequence":9', 1)
    assert changed != events.read_bytes()
    events.write_bytes(changed)

    current = service.review_artifact(root, "candidate")

    assert accepted.verification.integrity == "INTERNALLY_CONSISTENT"
    assert current.verification.integrity == "INVALID_EVIDENCE"
    assert canonical_envelope_bytes(current) != canonical_envelope_bytes(accepted)
    assert current.findings == ()


def test_coherent_rewrite_remains_unauthenticated_and_grants_no_permission(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, bundle = _root_with_bundle(repository_root, tmp_path)
    before = review_artifact(root, "candidate")
    _coherently_refresh_bundle(bundle)

    after = review_artifact(root, "candidate")

    assert after.verification.integrity == "INTERNALLY_CONSISTENT"
    assert after.artifact.computed_bundle_digest.value != (
        before.artifact.computed_bundle_digest.value
    )
    trust = {record.dimension: record.value for record in after.trust.records}
    assert trust == {
        "authenticity": "NOT_AUTHENTICATED",
        "authorization": "NOT_EVALUATED",
        "deployment_permission": "NONE",
        "scope": "SIMULATION_ONLY",
        "authoritative_status": "NOT_DEFINED",
    }


def test_identical_selection_across_roots_has_independent_active_session(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    (tmp_path / "one").mkdir()
    (tmp_path / "two").mkdir()
    root_one, _ = _root_with_bundle(repository_root, tmp_path / "one")
    root_two, _ = _root_with_bundle(repository_root, tmp_path / "two")
    service = facade_module._ReviewFacade()
    projections = 0
    real_project = facade_module.project_review_envelope

    def count_projection(*args, **kwargs):
        nonlocal projections
        projections += 1
        return real_project(*args, **kwargs)

    monkeypatch.setattr(facade_module, "project_review_envelope", count_projection)

    first = service.review_artifact(root_one, "candidate")
    second = service.review_artifact(root_two, "candidate")

    assert canonical_envelope_bytes(first) == canonical_envelope_bytes(second)
    assert projections == 2
    assert set(service._active) == {
        (root_one.absolute(), "candidate"),
        (root_two.absolute(), "candidate"),
    }
    assert service._active[(root_one.absolute(), "candidate")].root != (
        service._active[(root_two.absolute(), "candidate")].root
    )


def test_facade_capture_is_the_only_artifact_content_read(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)

    def forbid_path_read(*args, **kwargs):
        del args, kwargs
        raise AssertionError("facade reopened artifact content by path")

    monkeypatch.setattr(builtins, "open", forbid_path_read)
    monkeypatch.setattr(Path, "open", forbid_path_read)
    monkeypatch.setattr(Path, "read_bytes", forbid_path_read)
    monkeypatch.setattr(Path, "read_text", forbid_path_read)

    envelope = facade_module._ReviewFacade().review_artifact(root, "candidate")

    assert envelope.verification.integrity == "INTERNALLY_CONSISTENT"


def test_review_unavailable_shape_is_never_cached_or_activated(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)
    service = facade_module._ReviewFacade()

    def unavailable(*args, **kwargs):
        del args, kwargs
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "synthetic core-valid shape exceeds projection budget",
        )

    monkeypatch.setattr(facade_module, "project_review_envelope", unavailable)

    with pytest.raises(ReviewUnavailableError) as raised:
        service.review_artifact(root, "candidate")

    assert raised.value.reason is ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE
    assert service._cache == {}
    assert service._active == {}


def test_public_envelope_serialization_excludes_private_filesystem_and_session_state(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root, _ = _root_with_bundle(repository_root, tmp_path)

    payload = json.loads(canonical_envelope_bytes(review_artifact(root, "candidate")))
    forbidden = {
        "device",
        "inode",
        "mode",
        "mtime_ns",
        "ctime_ns",
        "metadata_identity",
        "captured_files",
        "session",
        "cache",
        "artifact_path",
        "absolute_path",
    }

    def keys(value) -> set[str]:
        if isinstance(value, dict):
            return set(value) | set().union(*(keys(item) for item in value.values()))
        if isinstance(value, list):
            return set().union(*(keys(item) for item in value)) if value else set()
        return set()

    assert keys(payload).isdisjoint(forbidden)
    assert str(root) not in canonical_envelope_bytes(review_artifact(root, "candidate")).decode()
