"""Bounded, command-specific read-only Git registration inspection."""

from __future__ import annotations

import hashlib
import os
import re
import selectors
import shutil
import stat
import subprocess
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import TYPE_CHECKING, BinaryIO

from hermes.adequacy.models import (
    LOCAL_HISTORY_LIMITATION,
    RegistrationEvidence,
    RegistrationStatus,
)

if TYPE_CHECKING:
    from hermes.adequacy.loader import CapturedEvaluationPlans

GIT_OPERATION_TIMEOUT_S = 5.0
MAX_GIT_OPERATION_OUTPUT_BYTES = 1024 * 1024
GIT_TERMINATE_GRACE_S = 0.25

_READ_CHUNK_BYTES = 64 * 1024
_COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}$")
_ALLOWED_OPERATIONS = frozenset(
    {"rev-parse", "show", "rev-list", "diff-tree", "merge-base", "status"}
)
_COMMON_ARGUMENTS = (
    "--no-pager",
    "--no-optional-locks",
    "--literal-pathspecs",
    "-c",
    f"core.hooksPath={os.devnull}",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    "-c",
    "protocol.allow=never",
    "-c",
    "protocol.file.allow=never",
)
_FIXED_ENVIRONMENT = {
    "GIT_ALLOW_PROTOCOL": "",
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_NO_LAZY_FETCH": "1",
    "GIT_NO_REPLACE_OBJECTS": "1",
    "GIT_OPTIONAL_LOCKS": "0",
    "GIT_PROTOCOL_FROM_USER": "0",
    "GIT_TERMINAL_PROMPT": "0",
    "LANG": "C",
    "LC_ALL": "C",
}


class RegistrationGitOperationalError(RuntimeError):
    """Git could not be selected, executed, bounded, or parsed safely."""


@dataclass(frozen=True, slots=True)
class _GitCommandResult:
    returncode: int
    stdout: bytes
    stderr: bytes


@dataclass(frozen=True, slots=True)
class _RegistrationPaths:
    protocol: str
    ledger: str
    pair_plan: str
    selected_scenario: str

    def status_pathspec(self) -> tuple[str, str, str, str]:
        return self.protocol, self.ledger, self.pair_plan, self.selected_scenario


def _not_established() -> RegistrationEvidence:
    return RegistrationEvidence(
        status=RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
        authenticity="NOT_AUTHENTICATED",
        limitation=LOCAL_HISTORY_LIMITATION,
        protocol_commit=None,
        pair_plan_commit=None,
    )


def _verified(protocol_commit: str, pair_plan_commit: str) -> RegistrationEvidence:
    return RegistrationEvidence(
        status=RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED,
        authenticity="NOT_AUTHENTICATED",
        limitation=LOCAL_HISTORY_LIMITATION,
        protocol_commit=protocol_commit,
        pair_plan_commit=pair_plan_commit,
    )


def _canonical_repository_root(repository_root: Path) -> Path:
    try:
        raw = os.fspath(repository_root)
        if not isinstance(raw, str) or not raw or any(
            character in raw for character in ("\x00", "\n", "\r", "\t")
        ):
            raise ValueError("unsafe repository root")
        canonical_spelling = os.path.abspath(raw)
        if not os.path.isabs(raw) or raw != canonical_spelling:
            raise ValueError("unsafe repository root")
        root = Path(canonical_spelling)
        metadata = os.lstat(root)
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise ValueError("unsafe repository root")
        if Path(os.path.realpath(root)) != root:
            raise ValueError("unsafe repository root")
    except (OSError, TypeError, ValueError) as exc:
        raise RegistrationGitOperationalError(
            "repository root is not a canonical real directory"
        ) from exc
    return root


def _resolve_git_executable() -> Path:
    try:
        selected = shutil.which("git", path=os.defpath)
        if selected is None:
            raise OSError("Git executable is unavailable")
        executable = Path(selected).resolve(strict=True)
        metadata = os.stat(executable)
        if (
            not executable.is_absolute()
            or not stat.S_ISREG(metadata.st_mode)
            or not os.access(executable, os.X_OK)
            or any(character in str(executable) for character in ("\x00", "\n", "\r", "\t"))
        ):
            raise OSError("Git executable is unsafe")
    except (OSError, RuntimeError, ValueError) as exc:
        raise RegistrationGitOperationalError(
            "trusted Git executable is unavailable"
        ) from exc
    return executable


def _stop_process(process: subprocess.Popen[bytes]) -> None:
    with suppress(OSError, ProcessLookupError):
        process.terminate()
    try:
        process.wait(timeout=GIT_TERMINATE_GRACE_S)
    except (OSError, subprocess.TimeoutExpired):
        pass
    else:
        return
    try:
        process.kill()
    except ProcessLookupError:
        with suppress(OSError):
            process.wait()
        return
    except OSError:
        with suppress(OSError, subprocess.TimeoutExpired):
            process.wait(timeout=GIT_TERMINATE_GRACE_S)
        return
    try:
        process.wait(timeout=GIT_TERMINATE_GRACE_S)
    except subprocess.TimeoutExpired:
        with suppress(OSError):
            process.wait()
    except OSError:
        pass


def _register_pipe(
    selector: selectors.BaseSelector,
    pipe: BinaryIO,
    stream_name: str,
) -> None:
    os.set_blocking(pipe.fileno(), False)
    selector.register(pipe, selectors.EVENT_READ, stream_name)


def _read_bounded_process(
    process: subprocess.Popen[bytes],
) -> _GitCommandResult:
    if process.stdout is None or process.stderr is None:
        _stop_process(process)
        raise RegistrationGitOperationalError("Git process pipes are unavailable")
    try:
        selector = selectors.DefaultSelector()
    except (OSError, ValueError) as exc:
        _stop_process(process)
        with suppress(OSError):
            process.stdout.close()
        with suppress(OSError):
            process.stderr.close()
        raise RegistrationGitOperationalError(
            "Git output selector could not be initialized"
        ) from exc
    stdout = bytearray()
    stderr = bytearray()
    deadline = time.monotonic() + GIT_OPERATION_TIMEOUT_S
    try:
        _register_pipe(selector, process.stdout, "stdout")
        _register_pipe(selector, process.stderr, "stderr")
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0.0:
                _stop_process(process)
                raise RegistrationGitOperationalError("Git operation exceeded its deadline")
            for key, _event_mask in selector.select(remaining):
                total = len(stdout) + len(stderr)
                read_size = min(
                    _READ_CHUNK_BYTES,
                    MAX_GIT_OPERATION_OUTPUT_BYTES - total + 1,
                )
                try:
                    chunk = os.read(key.fileobj.fileno(), read_size)
                except BlockingIOError:
                    continue
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                target = stdout if key.data == "stdout" else stderr
                target.extend(chunk)
                if len(stdout) + len(stderr) > MAX_GIT_OPERATION_OUTPUT_BYTES:
                    _stop_process(process)
                    raise RegistrationGitOperationalError(
                        "Git operation exceeded its combined output limit"
                    )
        remaining = deadline - time.monotonic()
        if remaining <= 0.0:
            _stop_process(process)
            raise RegistrationGitOperationalError("Git operation exceeded its deadline")
        try:
            returncode = process.wait(timeout=remaining)
        except subprocess.TimeoutExpired as exc:
            _stop_process(process)
            raise RegistrationGitOperationalError(
                "Git operation exceeded its deadline"
            ) from exc
        if returncode < 0:
            raise RegistrationGitOperationalError("Git operation ended by signal")
        return _GitCommandResult(returncode, bytes(stdout), bytes(stderr))
    except RegistrationGitOperationalError:
        raise
    except (OSError, ValueError) as exc:
        _stop_process(process)
        raise RegistrationGitOperationalError("Git output could not be read safely") from exc
    finally:
        selector.close()
        with suppress(OSError):
            process.stdout.close()
        with suppress(OSError):
            process.stderr.close()


class _GitRunner:
    def __init__(self, executable: Path, repository_root: Path) -> None:
        self._executable = executable
        self._repository_root = repository_root

    def run(self, *operation: str) -> _GitCommandResult:
        if not operation or operation[0] not in _ALLOWED_OPERATIONS:
            raise RegistrationGitOperationalError("undeclared Git operation")
        argv = (str(self._executable), *_COMMON_ARGUMENTS, *operation)
        try:
            process = subprocess.Popen(
                argv,
                cwd=self._repository_root,
                env=dict(_FIXED_ENVIRONMENT),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
                close_fds=True,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise RegistrationGitOperationalError("Git operation could not start") from exc
        return _read_bounded_process(process)


def _safe_repository_path(value: str) -> PurePosixPath:
    if (
        not isinstance(value, str)
        or not value
        or value == "."
        or value.startswith("/")
        or value.endswith("/")
        or "//" in value
        or "\\" in value
        or any(character in value for character in ("\x00", "\n", "\r", "\t"))
    ):
        raise RegistrationGitOperationalError("unsafe repository-relative Git path")
    path = PurePosixPath(value)
    if (
        str(path) != value
        or any(part in {"", ".", ".."} or part.startswith("-") for part in path.parts)
    ):
        raise RegistrationGitOperationalError("unsafe repository-relative Git path")
    return path


def _derive_registration_paths(
    plans: CapturedEvaluationPlans,
) -> _RegistrationPaths | None:
    try:
        sources = plans.sources
        if len(sources) != 3:
            return None
        protocol_source, ledger_source, pair_source = sources
        declared_protocol = _safe_repository_path(
            plans.protocol.registration.repository_relative_path
        )
        captured_protocol = _safe_repository_path(protocol_source.relative_path)
        captured_ledger = _safe_repository_path(ledger_source.relative_path)
        captured_pair = _safe_repository_path(pair_source.relative_path)
        selected_scenario = _safe_repository_path(
            plans.pair_plan.selected_scenario_relative_path
        )
    except (AttributeError, TypeError) as exc:
        raise RegistrationGitOperationalError(
            "captured plans lack registration path identity"
        ) from exc
    declared_parts = declared_protocol.parts
    source_parts = captured_protocol.parts
    if (
        len(source_parts) >= len(declared_parts)
        or declared_parts[-len(source_parts) :] != source_parts
    ):
        return None
    prefix_parts = declared_parts[: -len(source_parts)]
    if not prefix_parts:
        return None
    prefix = PurePosixPath(*prefix_parts)
    derived_protocol = prefix / captured_protocol
    derived_ledger = prefix / captured_ledger
    derived_pair = prefix / captured_pair
    if derived_protocol != declared_protocol:
        return None
    paths = _RegistrationPaths(
        protocol=str(derived_protocol),
        ledger=str(derived_ledger),
        pair_plan=str(derived_pair),
        selected_scenario=str(selected_scenario),
    )
    if len(set(paths.status_pathspec())) != 4:
        return None
    for value in paths.status_pathspec():
        _safe_repository_path(value)
    return paths


def _decode_git_path(raw: bytes) -> str:
    try:
        value = raw.decode("utf-8", errors="strict")
    except UnicodeError as exc:
        raise RegistrationGitOperationalError("Git emitted a non-UTF-8 path") from exc
    _safe_repository_path(value)
    return value


def _nul_fields(payload: bytes, label: str) -> tuple[bytes, ...]:
    if not payload:
        return ()
    if not payload.endswith(b"\x00"):
        raise RegistrationGitOperationalError(f"malformed NUL-delimited {label}")
    fields = tuple(payload[:-1].split(b"\x00"))
    if any(not field for field in fields):
        raise RegistrationGitOperationalError(f"malformed NUL-delimited {label}")
    return fields


def _parse_diff_tree_output(payload: bytes) -> tuple[tuple[str, str], ...]:
    fields = _nul_fields(payload, "diff-tree output")
    if len(fields) % 2:
        raise RegistrationGitOperationalError("malformed diff-tree record arity")
    records: list[tuple[str, str]] = []
    for index in range(0, len(fields), 2):
        try:
            status = fields[index].decode("ascii", errors="strict")
        except UnicodeError as exc:
            raise RegistrationGitOperationalError("non-ASCII diff-tree status") from exc
        if status.startswith(("R", "C")):
            raise RegistrationGitOperationalError("rename/copy diff-tree status is unsupported")
        if status not in {"A", "M", "D", "T", "U"}:
            raise RegistrationGitOperationalError("unknown diff-tree status")
        records.append((status, _decode_git_path(fields[index + 1])))
    return tuple(records)


def _parse_status_output(payload: bytes) -> tuple[tuple[str, str], ...]:
    fields = _nul_fields(payload, "status output")
    records: list[tuple[str, str]] = []
    normal_status = frozenset({" ", "M", "A", "D", "T", "U"})
    for field in fields:
        if len(field) < 4 or field[2:3] != b" ":
            raise RegistrationGitOperationalError("malformed status record arity")
        try:
            status = field[:2].decode("ascii", errors="strict")
        except UnicodeError as exc:
            raise RegistrationGitOperationalError("non-ASCII status code") from exc
        if "R" in status or "C" in status:
            raise RegistrationGitOperationalError("rename/copy status is unsupported")
        if status not in {"??", "!!"} and (
            status == "  " or any(character not in normal_status for character in status)
        ):
            raise RegistrationGitOperationalError("unknown status code")
        records.append((status, _decode_git_path(field[3:])))
    return tuple(records)


def _command_succeeded(
    result: _GitCommandResult,
    operation: str,
    *,
    historical_returncodes: frozenset[int] = frozenset(),
) -> bool:
    if result.returncode in historical_returncodes:
        return False
    if result.returncode != 0:
        raise RegistrationGitOperationalError(
            f"Git {operation} failed with unexpected exit status {result.returncode}"
        )
    if result.stderr:
        raise RegistrationGitOperationalError(
            f"Git {operation} emitted unexpected diagnostic output"
        )
    return True


def _parse_repository_top_level(payload: bytes) -> Path:
    if not payload.endswith(b"\n") or payload.count(b"\n") != 1:
        raise RegistrationGitOperationalError("malformed rev-parse response")
    try:
        value = payload[:-1].decode("utf-8", errors="strict")
    except UnicodeError as exc:
        raise RegistrationGitOperationalError("non-UTF-8 rev-parse response") from exc
    if (
        not value
        or not value.startswith("/")
        or any(character in value for character in ("\x00", "\n", "\r", "\t"))
    ):
        raise RegistrationGitOperationalError("unsafe rev-parse response")
    try:
        canonical_spelling = os.path.abspath(value)
        real_path = os.path.realpath(value)
    except (OSError, ValueError) as exc:
        raise RegistrationGitOperationalError("unsafe rev-parse response") from exc
    if value != canonical_spelling or real_path != canonical_spelling:
        raise RegistrationGitOperationalError("noncanonical rev-parse response")
    return Path(canonical_spelling)


def _parse_parent_line(payload: bytes) -> tuple[str, tuple[str, ...]]:
    if not payload.endswith(b"\n") or payload.count(b"\n") != 1:
        raise RegistrationGitOperationalError("malformed rev-list response")
    try:
        fields = payload[:-1].decode("ascii", errors="strict").split(" ")
    except UnicodeError as exc:
        raise RegistrationGitOperationalError("non-ASCII rev-list response") from exc
    if not fields or any(not _COMMIT_PATTERN.fullmatch(field) for field in fields):
        raise RegistrationGitOperationalError("malformed rev-list commit identity")
    return fields[0], tuple(fields[1:])


def _blob_digest_matches(
    runner: _GitRunner,
    commit: str,
    path: str,
    expected_digest: str,
) -> bool:
    result = runner.run("show", f"{commit}:{path}")
    if not _command_succeeded(
        result,
        "show",
        historical_returncodes=frozenset({128}),
    ):
        return False
    return hashlib.sha256(result.stdout).hexdigest() == expected_digest


class RegistrationGitInspector:
    """Verify bounded local-history ordering without authenticating its origin."""

    def inspect(
        self,
        repository_root: Path,
        plans: CapturedEvaluationPlans,
        *,
        baseline_repository_commit: str,
        candidate_repository_commit: str,
    ) -> RegistrationEvidence:
        root = _canonical_repository_root(repository_root)
        paths = _derive_registration_paths(plans)
        if paths is None:
            return _not_established()
        if (
            not isinstance(baseline_repository_commit, str)
            or not isinstance(candidate_repository_commit, str)
            or not _COMMIT_PATTERN.fullmatch(baseline_repository_commit)
            or not _COMMIT_PATTERN.fullmatch(candidate_repository_commit)
            or baseline_repository_commit != candidate_repository_commit
        ):
            return _not_established()
        try:
            protocol_commit = plans.pair_plan.expected_pair.implementation_base_commit
            if not _COMMIT_PATTERN.fullmatch(protocol_commit):
                return _not_established()
            if any(
                entry.registration_commit != protocol_commit
                or entry.environment.repository_commit != protocol_commit
                for entry in plans.ledger
            ):
                return _not_established()
            selected = tuple(
                entry
                for entry in plans.ledger
                if entry.attempt_id
                == plans.pair_plan.expected_pair.selected_discovery_attempt_id
                and entry.selection.status == "SELECTED"
            )
            if len(selected) != 1:
                return _not_established()
            scenario_byte_digest = selected[0].scenario_byte_digest_sha256
            protocol_source, ledger_source, pair_source = plans.sources
        except (AttributeError, TypeError):
            return _not_established()
        pair_commit = baseline_repository_commit

        runner = _GitRunner(_resolve_git_executable(), root)
        top_level = runner.run("rev-parse", "--show-toplevel")
        if not _command_succeeded(
            top_level,
            "rev-parse",
            historical_returncodes=frozenset({128}),
        ):
            return _not_established()
        if _parse_repository_top_level(top_level.stdout) != root:
            return _not_established()
        for commit, path, digest in (
            (protocol_commit, paths.protocol, protocol_source.byte_digest_sha256),
            (pair_commit, paths.ledger, ledger_source.byte_digest_sha256),
            (pair_commit, paths.pair_plan, pair_source.byte_digest_sha256),
            (pair_commit, paths.selected_scenario, scenario_byte_digest),
        ):
            if not _blob_digest_matches(runner, commit, path, digest):
                return _not_established()

        parent_result = runner.run("rev-list", "--parents", "-n", "1", pair_commit)
        _command_succeeded(parent_result, "rev-list")
        observed_commit, parents = _parse_parent_line(parent_result.stdout)
        if observed_commit != pair_commit or parents != (protocol_commit,):
            return _not_established()

        diff_result = runner.run(
            "diff-tree",
            "--no-commit-id",
            "-r",
            "--name-status",
            "-z",
            protocol_commit,
            pair_commit,
        )
        _command_succeeded(diff_result, "diff-tree")
        diff_records = _parse_diff_tree_output(diff_result.stdout)
        expected_additions = {paths.ledger, paths.pair_plan, paths.selected_scenario}
        if (
            len(diff_records) != 3
            or any(status != "A" for status, _path in diff_records)
            or {path for _status, path in diff_records} != expected_additions
        ):
            return _not_established()

        ancestry = runner.run("merge-base", "--is-ancestor", protocol_commit, pair_commit)
        if not _command_succeeded(
            ancestry,
            "merge-base",
            historical_returncodes=frozenset({1}),
        ):
            return _not_established()
        if ancestry.stdout:
            raise RegistrationGitOperationalError("merge-base emitted unexpected output")

        status = runner.run(
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
            *paths.status_pathspec(),
        )
        _command_succeeded(status, "status")
        status_records = _parse_status_output(status.stdout)
        if status_records:
            return _not_established()
        return _verified(protocol_commit, pair_commit)
