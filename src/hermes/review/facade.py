"""Root-contained, fresh-capture orchestration for Phase 6 artifact review."""

from __future__ import annotations

import os
import stat
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from hermes import __version__
from hermes.evidence.verification import _inspect_artifact_under_root_capture
from hermes.review.models import ReviewCacheKey, ReviewEnvelope
from hermes.review.projection import project_review_envelope


@dataclass(frozen=True, slots=True)
class _CaptureFileIdentity:
    file_name: str
    device: int
    inode: int
    mode: int
    size_bytes: int
    mtime_ns: int
    ctime_ns: int
    observed_sha256: str


@dataclass(frozen=True, slots=True)
class _CaptureIdentity:
    files: tuple[_CaptureFileIdentity, ...]


@dataclass(frozen=True, slots=True)
class _ActiveSession:
    root: Path
    selection: str
    identity: _CaptureIdentity
    cache_key: ReviewCacheKey | None


@dataclass(frozen=True, slots=True)
class _ReviewedArtifact:
    """Private current-capture handoff for comparison orchestration."""

    capture: object
    envelope: ReviewEnvelope
    cache_key: ReviewCacheKey | None


def validate_artifact_root(artifact_root: Path) -> Path:
    """Return one absolute real, existing, non-symlink artifact root."""

    try:
        raw = os.fspath(artifact_root)
    except TypeError as exc:
        raise ValueError("artifact root must be a real non-symlink directory") from exc
    if not raw or "\x00" in raw:
        raise ValueError("artifact root must be a real non-symlink directory")
    path = Path(os.path.abspath(raw))
    try:
        metadata = os.lstat(path)
    except OSError as exc:
        raise ValueError("artifact root must be a real non-symlink directory") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise ValueError("artifact root must be a real non-symlink directory")
    canonical = Path(os.path.realpath(path))
    if canonical != path:
        raise ValueError("artifact root must be a real non-symlink directory")
    return canonical


def _validate_selection(root: Path, selected_relative_path: str) -> str:
    if (
        not isinstance(selected_relative_path, str)
        or not selected_relative_path
        or selected_relative_path == "."
        or selected_relative_path.startswith("/")
        or selected_relative_path.endswith("/")
        or "//" in selected_relative_path
        or "\\" in selected_relative_path
        or "\x00" in selected_relative_path
    ):
        raise ValueError("artifact selection must be a lexical relative path")
    parts = PurePosixPath(selected_relative_path).parts
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("artifact selection must be a lexical relative path")
    if str(PurePosixPath(selected_relative_path)) != selected_relative_path:
        raise ValueError("artifact selection must be a lexical relative path")
    root_name = root.name
    if parts[0] == root_name:
        raise ValueError("artifact selection must be relative to, not prefixed by, its root")
    return selected_relative_path


def _capture_identity(capture: object) -> _CaptureIdentity:
    files: list[_CaptureFileIdentity] = []
    for captured in capture.captured_files:
        identity = captured.metadata_identity
        if len(identity) != 6 or identity[3] != captured.size_bytes:
            raise ValueError("captured descriptor identity is internally inconsistent")
        device, inode, mode, size_bytes, mtime_ns, ctime_ns = identity
        if any(value < 0 for value in identity):
            raise ValueError("captured descriptor identity must be non-negative")
        files.append(
            _CaptureFileIdentity(
                file_name=captured.file_name,
                device=device,
                inode=inode,
                mode=mode,
                size_bytes=size_bytes,
                mtime_ns=mtime_ns,
                ctime_ns=ctime_ns,
                observed_sha256=captured.observed_sha256,
            )
        )
    return _CaptureIdentity(files=tuple(files))


class _ReviewFacade:
    """Process-local cache that never substitutes for a fresh stored verification."""

    def __init__(self) -> None:
        self._cache: dict[ReviewCacheKey, ReviewEnvelope] = {}
        self._active: dict[tuple[Path, str], _ActiveSession] = {}

    def review_artifact(
        self,
        artifact_root: Path,
        selected_relative_path: str,
    ) -> ReviewEnvelope:
        return self._review_result(artifact_root, selected_relative_path).envelope

    def _review_result(
        self,
        artifact_root: Path,
        selected_relative_path: str,
    ) -> _ReviewedArtifact:
        """Return the current fresh capture and its portable projection."""

        root = validate_artifact_root(artifact_root)
        selection = _validate_selection(root, selected_relative_path)
        capture = _inspect_artifact_under_root_capture(root, selection)
        identity = _capture_identity(capture)
        inspection = capture.inspection
        cache_key: ReviewCacheKey | None = None
        if (
            inspection.snapshot is not None
            and inspection.computed_bundle_digest is not None
        ):
            cache_key = ReviewCacheKey(
                computed_bundle_digest_sha256=inspection.computed_bundle_digest,
                review_schema_version="1.0",
                hermes_version=__version__,
                selected_relative_path=selection,
            )
        session_key = (root, selection)
        previous = self._active.get(session_key)
        may_reuse = (
            cache_key is not None
            and previous is not None
            and previous.root == root
            and previous.selection == selection
            and previous.identity == identity
            and previous.cache_key == cache_key
        )
        if may_reuse and cache_key in self._cache:
            return _ReviewedArtifact(
                capture=capture,
                envelope=self._cache[cache_key],
                cache_key=cache_key,
            )
        envelope = project_review_envelope(
            capture,
            selected_relative_path=selection,
            hermes_version=__version__,
        )
        self._active[session_key] = _ActiveSession(
            root=root,
            selection=selection,
            identity=identity,
            cache_key=cache_key,
        )
        if cache_key is not None:
            self._cache[cache_key] = envelope
        return _ReviewedArtifact(
            capture=capture,
            envelope=envelope,
            cache_key=cache_key,
        )


_DEFAULT_FACADE = _ReviewFacade()


def review_artifact(
    artifact_root: Path,
    selected_relative_path: str,
) -> ReviewEnvelope:
    """Fresh-capture one exact lexical selection below an allowed root."""

    return _DEFAULT_FACADE.review_artifact(artifact_root, selected_relative_path)
