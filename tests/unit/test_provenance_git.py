from __future__ import annotations

import hashlib
import inspect
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path

import pytest

import hermes.provenance.git as git_module
from hermes.adequacy.loader import CapturedEvaluationPlans
from hermes.adequacy.models import (
    LOCAL_HISTORY_LIMITATION,
    CapturedSourceIdentity,
    DiscoveryEnvironment,
    DiscoveryLedgerEntry,
    ExpectedPair,
    PairPlan,
    RegistrationEvidence,
    RegistrationLocation,
    RegistrationStatus,
    SelectionResult,
    StudyProtocol,
)
from hermes.provenance.git import (
    GIT_OPERATION_TIMEOUT_S,
    MAX_GIT_OPERATION_OUTPUT_BYTES,
    RegistrationGitInspector,
    RegistrationGitOperationalError,
    _parse_diff_tree_output,
    _parse_parent_line,
    _parse_repository_top_level,
    _parse_status_output,
    _read_bounded_process,
)

_PROTOCOL_PATH = "evaluation-plans/lead.protocol.v1.yaml"
_LEDGER_PATH = "evaluation-plans/lead.discovery.v1.jsonl"
_PAIR_PATH = "evaluation-plans/lead.pair.v1.yaml"
_SCENARIO_PATH = "scenarios/lead.yaml"


def _sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _git(repository: Path, *arguments: str) -> bytes:
    executable = shutil.which("git")
    if executable is None:
        pytest.skip("Git is required for provenance boundary tests")
    result = subprocess.run(
        [executable, *arguments],
        cwd=repository,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode("utf-8", errors="replace")
    return result.stdout


def _write(repository: Path, relative_path: str, payload: bytes) -> None:
    path = repository / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


@dataclass(frozen=True, slots=True)
class _RegisteredRepository:
    root: Path
    plans: CapturedEvaluationPlans
    protocol_commit: str
    pair_commit: str
    pair_branch: str
    protocol_bytes: bytes
    ledger_bytes: bytes
    pair_bytes: bytes
    scenario_bytes: bytes


def _captured_plans(
    *,
    protocol_commit: str,
    protocol_bytes: bytes,
    ledger_bytes: bytes,
    pair_bytes: bytes,
    scenario_bytes: bytes,
    discovery_commit: str | None = None,
) -> CapturedEvaluationPlans:
    protocol = StudyProtocol.model_construct(
        registration=RegistrationLocation(repository_relative_path=_PROTOCOL_PATH)
    )
    ledger_entry = DiscoveryLedgerEntry.model_construct(
        attempt_id="attempt-0001",
        registration_commit=discovery_commit or protocol_commit,
        environment=DiscoveryEnvironment(
            hermes_version="0.1.0",
            python_version="3.11.15",
            platform="test",
            architecture="test",
            repository_commit=discovery_commit or protocol_commit,
            repository_dirty=False,
        ),
        scenario_byte_digest_sha256=_sha(scenario_bytes),
        selection=SelectionResult(
            status="SELECTED",
            rank=1,
            tie_breaker="GRID_ORDER",
            rationale="first valid attempt",
        ),
    )
    pair_plan = PairPlan.model_construct(
        expected_pair=ExpectedPair.model_construct(
            implementation_base_commit=protocol_commit,
            selected_discovery_attempt_id="attempt-0001",
        ),
        selected_scenario_relative_path=_SCENARIO_PATH,
    )
    return CapturedEvaluationPlans(
        protocol=protocol,
        ledger=(ledger_entry,),
        pair_plan=pair_plan,
        sources=(
            CapturedSourceIdentity(
                relative_path=Path(_PROTOCOL_PATH).name,
                byte_digest_sha256=_sha(protocol_bytes),
                semantic_digest_sha256="1" * 64,
            ),
            CapturedSourceIdentity(
                relative_path=Path(_LEDGER_PATH).name,
                byte_digest_sha256=_sha(ledger_bytes),
                semantic_digest_sha256="2" * 64,
            ),
            CapturedSourceIdentity(
                relative_path=Path(_PAIR_PATH).name,
                byte_digest_sha256=_sha(pair_bytes),
                semantic_digest_sha256="3" * 64,
            ),
        ),
    )


def _build_registered_repository(
    root: Path,
    *,
    protocol_tree_extras: dict[str, bytes] | None = None,
    pair_tree_extras: dict[str, bytes] | None = None,
) -> _RegisteredRepository:
    root.mkdir()
    _git(root, "init", "-q")
    _git(root, "config", "user.name", "Hermes Test")
    _git(root, "config", "user.email", "hermes-test@example.invalid")
    protocol_bytes = b"schema_version: '1.0'\nprotocol_id: lead_ttc_engagement\n"
    ledger_bytes = b'{"attempt_id":"attempt-0001","selection":"SELECTED"}\n'
    pair_bytes = b"schema_version: '1.0'\npair_plan_id: lead_pair\n"
    scenario_bytes = b"schema_version: '1.0'\nname: selected_lead\n"

    _write(root, _PROTOCOL_PATH, protocol_bytes)
    for relative_path, payload in (protocol_tree_extras or {}).items():
        _write(root, relative_path, payload)
    _git(root, "add", "--", ".")
    _git(root, "commit", "-q", "-m", "freeze protocol")
    protocol_commit = _git(root, "rev-parse", "HEAD").decode("ascii").strip()

    _write(root, _LEDGER_PATH, ledger_bytes)
    _write(root, _PAIR_PATH, pair_bytes)
    _write(root, _SCENARIO_PATH, scenario_bytes)
    for relative_path, payload in (pair_tree_extras or {}).items():
        _write(root, relative_path, payload)
    _git(root, "add", "--", ".")
    _git(root, "commit", "-q", "-m", "freeze pair plan")
    pair_commit = _git(root, "rev-parse", "HEAD").decode("ascii").strip()
    pair_branch = _git(root, "branch", "--show-current").decode("utf-8").strip()
    plans = _captured_plans(
        protocol_commit=protocol_commit,
        protocol_bytes=protocol_bytes,
        ledger_bytes=ledger_bytes,
        pair_bytes=pair_bytes,
        scenario_bytes=scenario_bytes,
    )
    return _RegisteredRepository(
        root=root,
        plans=plans,
        protocol_commit=protocol_commit,
        pair_commit=pair_commit,
        pair_branch=pair_branch,
        protocol_bytes=protocol_bytes,
        ledger_bytes=ledger_bytes,
        pair_bytes=pair_bytes,
        scenario_bytes=scenario_bytes,
    )


@pytest.fixture
def registered_repository(tmp_path: Path) -> _RegisteredRepository:
    return _build_registered_repository(tmp_path / "repository")


def _inspect(
    fixture: _RegisteredRepository,
    *,
    plans: CapturedEvaluationPlans | None = None,
    baseline_commit: str | None = None,
    candidate_commit: str | None = None,
) -> RegistrationEvidence:
    return RegistrationGitInspector().inspect(
        fixture.root,
        plans or fixture.plans,
        baseline_repository_commit=baseline_commit or fixture.pair_commit,
        candidate_repository_commit=candidate_commit or fixture.pair_commit,
    )


def _assert_not_established(evidence: RegistrationEvidence) -> None:
    assert evidence == RegistrationEvidence(
        status=RegistrationStatus.REGISTRATION_NOT_ESTABLISHED,
        authenticity="NOT_AUTHENTICATED",
        limitation=LOCAL_HISTORY_LIMITATION,
        protocol_commit=None,
        pair_plan_commit=None,
    )


def test_exact_protocol_then_direct_three_path_pair_commit_establishes_local_ordering(
    registered_repository: _RegisteredRepository,
) -> None:
    evidence = _inspect(registered_repository)

    assert evidence == RegistrationEvidence(
        status=RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED,
        authenticity="NOT_AUTHENTICATED",
        limitation=LOCAL_HISTORY_LIMITATION,
        protocol_commit=registered_repository.protocol_commit,
        pair_plan_commit=registered_repository.pair_commit,
    )
    assert evidence.authenticity == "NOT_AUTHENTICATED"
    assert evidence.limitation == "Rewritable local history; no external timestamp."


def test_inspector_signature_accepts_no_caller_supplied_repository_paths() -> None:
    assert tuple(inspect.signature(RegistrationGitInspector.inspect).parameters) == (
        "self",
        "repository_root",
        "plans",
        "baseline_repository_commit",
        "candidate_repository_commit",
    )


@pytest.mark.parametrize("mutation", ("no_suffix", "empty_prefix", "path_collision"))
def test_plan_paths_require_one_exact_nonempty_component_suffix_prefix(
    registered_repository: _RegisteredRepository,
    monkeypatch: pytest.MonkeyPatch,
    mutation: str,
) -> None:
    protocol_source, ledger_source, pair_source = registered_repository.plans.sources
    protocol = registered_repository.plans.protocol
    if mutation == "no_suffix":
        protocol_source = protocol_source.model_copy(update={"relative_path": "other.yaml"})
    elif mutation == "empty_prefix":
        protocol = protocol.model_copy(
            update={
                "registration": RegistrationLocation(
                    repository_relative_path=protocol_source.relative_path
                )
            }
        )
    else:
        ledger_source = ledger_source.model_copy(
            update={"relative_path": protocol_source.relative_path}
        )
    plans = replace(
        registered_repository.plans,
        protocol=protocol,
        sources=(protocol_source, ledger_source, pair_source),
    )

    def forbidden_resolver(*_args, **_kwargs):
        raise AssertionError("inconsistent derived paths reached Git resolution")

    monkeypatch.setattr(git_module.shutil, "which", forbidden_resolver)

    _assert_not_established(_inspect(registered_repository, plans=plans))


def test_nonexact_captured_repository_path_is_an_operational_error(
    registered_repository: _RegisteredRepository,
) -> None:
    protocol_source, ledger_source, pair_source = registered_repository.plans.sources
    unsafe_source = CapturedSourceIdentity.model_construct(
        relative_path=f"sub/../{protocol_source.relative_path}",
        byte_digest_sha256=protocol_source.byte_digest_sha256,
        semantic_digest_sha256=protocol_source.semantic_digest_sha256,
    )
    plans = replace(
        registered_repository.plans,
        sources=(unsafe_source, ledger_source, pair_source),
    )

    with pytest.raises(RegistrationGitOperationalError):
        _inspect(registered_repository, plans=plans)


def test_inspector_uses_one_resolved_executable_and_exact_read_only_process_contract(
    registered_repository: _RegisteredRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    resolved_git = str(Path(shutil.which("git") or "").resolve())
    resolver_calls: list[tuple[str, str | None]] = []
    process_calls: list[tuple[tuple[str, ...], dict[str, object]]] = []
    real_popen = subprocess.Popen

    def record_which(command: str, path: str | None = None) -> str:
        resolver_calls.append((command, path))
        return resolved_git

    def record_popen(argv, **kwargs):
        process_calls.append((tuple(argv), dict(kwargs)))
        return real_popen(argv, **kwargs)

    monkeypatch.setattr(git_module.shutil, "which", record_which)
    monkeypatch.setattr(git_module.subprocess, "Popen", record_popen)

    evidence = _inspect(registered_repository)

    assert evidence.status is RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED
    assert resolver_calls == [("git", os.defpath)]
    common = (
        resolved_git,
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
    expected_operations = (
        ("rev-parse", "--show-toplevel"),
        ("show", f"{registered_repository.protocol_commit}:{_PROTOCOL_PATH}"),
        ("show", f"{registered_repository.pair_commit}:{_LEDGER_PATH}"),
        ("show", f"{registered_repository.pair_commit}:{_PAIR_PATH}"),
        ("show", f"{registered_repository.pair_commit}:{_SCENARIO_PATH}"),
        (
            "rev-list",
            "--parents",
            "-n",
            "1",
            registered_repository.pair_commit,
        ),
        (
            "diff-tree",
            "--no-commit-id",
            "-r",
            "--name-status",
            "-z",
            registered_repository.protocol_commit,
            registered_repository.pair_commit,
        ),
        (
            "merge-base",
            "--is-ancestor",
            registered_repository.protocol_commit,
            registered_repository.pair_commit,
        ),
        (
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
            _PROTOCOL_PATH,
            _LEDGER_PATH,
            _PAIR_PATH,
            _SCENARIO_PATH,
        ),
    )
    assert tuple(argv[len(common) :] for argv, _kwargs in process_calls) == (
        expected_operations
    )
    expected_environment = {
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
    for argv, kwargs in process_calls:
        assert argv[: len(common)] == common
        assert kwargs == {
            "cwd": registered_repository.root,
            "env": expected_environment,
            "stdin": subprocess.DEVNULL,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "shell": False,
            "close_fds": True,
        }
    assert GIT_OPERATION_TIMEOUT_S == 5.0
    assert MAX_GIT_OPERATION_OUTPUT_BYTES == 1024 * 1024


def test_replace_refs_are_ignored_without_mutating_repository(
    registered_repository: _RegisteredRepository,
) -> None:
    _git(
        registered_repository.root,
        "replace",
        registered_repository.pair_commit,
        registered_repository.protocol_commit,
    )

    evidence = _inspect(registered_repository)

    assert evidence.status is RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED


def test_wrong_repository_missing_commits_paths_and_primary_mismatch_do_not_establish(
    registered_repository: _RegisteredRepository,
    tmp_path: Path,
) -> None:
    wrong_root = tmp_path / "wrong-repository"
    wrong_root.mkdir()
    _git(wrong_root, "init", "-q")
    wrong = replace(registered_repository, root=wrong_root)
    _assert_not_established(_inspect(wrong))

    _assert_not_established(
        _inspect(
            registered_repository,
            baseline_commit="f" * 40,
            candidate_commit="f" * 40,
        )
    )
    _assert_not_established(
        _inspect(
            registered_repository,
            baseline_commit=registered_repository.pair_commit,
            candidate_commit=registered_repository.protocol_commit,
        )
    )


def test_discovery_commit_string_and_file_content_mismatches_do_not_establish(
    registered_repository: _RegisteredRepository,
) -> None:
    mismatched_discovery = _captured_plans(
        protocol_commit=registered_repository.protocol_commit,
        protocol_bytes=registered_repository.protocol_bytes,
        ledger_bytes=registered_repository.ledger_bytes,
        pair_bytes=registered_repository.pair_bytes,
        scenario_bytes=registered_repository.scenario_bytes,
        discovery_commit=registered_repository.pair_commit,
    )
    _assert_not_established(_inspect(registered_repository, plans=mismatched_discovery))


@pytest.mark.parametrize("source_name", ("protocol", "ledger", "pair_plan", "scenario"))
def test_each_captured_file_content_mismatch_does_not_establish(
    registered_repository: _RegisteredRepository,
    source_name: str,
) -> None:
    protocol_source, ledger_source, pair_source = registered_repository.plans.sources
    if source_name == "scenario":
        selected = registered_repository.plans.ledger[0].model_copy(
            update={"scenario_byte_digest_sha256": "f" * 64}
        )
        mismatched = replace(registered_repository.plans, ledger=(selected,))
    else:
        source_index = {"protocol": 0, "ledger": 1, "pair_plan": 2}[source_name]
        sources = [protocol_source, ledger_source, pair_source]
        sources[source_index] = sources[source_index].model_copy(
            update={"byte_digest_sha256": "f" * 64}
        )
        mismatched = replace(registered_repository.plans, sources=tuple(sources))

    _assert_not_established(_inspect(registered_repository, plans=mismatched))


def test_missing_selected_path_does_not_establish(
    registered_repository: _RegisteredRepository,
) -> None:
    _git(registered_repository.root, "rm", "-q", "--", _SCENARIO_PATH)
    _git(registered_repository.root, "commit", "-q", "--amend", "--no-edit")
    pair_commit = _git(registered_repository.root, "rev-parse", "HEAD").decode().strip()
    fixture = replace(registered_repository, pair_commit=pair_commit)

    _assert_not_established(_inspect(fixture))


def test_protocol_commit_after_discovery_pair_does_not_establish(
    registered_repository: _RegisteredRepository,
) -> None:
    _git(
        registered_repository.root,
        "commit",
        "-q",
        "--allow-empty",
        "-m",
        "late protocol registration",
    )
    late_protocol_commit = (
        _git(registered_repository.root, "rev-parse", "HEAD").decode().strip()
    )
    plans = _captured_plans(
        protocol_commit=late_protocol_commit,
        protocol_bytes=registered_repository.protocol_bytes,
        ledger_bytes=registered_repository.ledger_bytes,
        pair_bytes=registered_repository.pair_bytes,
        scenario_bytes=registered_repository.scenario_bytes,
    )

    _assert_not_established(_inspect(registered_repository, plans=plans))


def test_divergent_or_multiple_parent_history_does_not_establish(
    registered_repository: _RegisteredRepository,
) -> None:
    root = registered_repository.root
    _git(root, "checkout", "-q", "--orphan", "divergent")
    _git(root, "rm", "-q", "-r", "-f", "--ignore-unmatch", ".")
    for path, payload in (
        (_PROTOCOL_PATH, registered_repository.protocol_bytes),
        (_LEDGER_PATH, registered_repository.ledger_bytes),
        (_PAIR_PATH, registered_repository.pair_bytes),
        (_SCENARIO_PATH, registered_repository.scenario_bytes),
    ):
        _write(root, path, payload)
    _git(root, "add", "--", ".")
    _git(root, "commit", "-q", "-m", "divergent root")
    divergent = _git(root, "rev-parse", "HEAD").decode("ascii").strip()
    _assert_not_established(
        _inspect(
            registered_repository,
            baseline_commit=divergent,
            candidate_commit=divergent,
        )
    )

    _git(root, "checkout", "-q", registered_repository.pair_branch)
    _git(root, "checkout", "-q", "-b", "side", registered_repository.protocol_commit)
    _write(root, "side.txt", b"side\n")
    _git(root, "add", "--", "side.txt")
    _git(root, "commit", "-q", "-m", "side commit")
    _git(root, "checkout", "-q", registered_repository.pair_branch)
    _git(root, "merge", "-q", "--no-ff", "side", "-m", "merge")
    merge_commit = _git(root, "rev-parse", "HEAD").decode("ascii").strip()
    _assert_not_established(
        _inspect(
            registered_repository,
            baseline_commit=merge_commit,
            candidate_commit=merge_commit,
        )
    )


def test_dirty_registration_path_and_unexpected_fourth_pair_path_do_not_establish(
    registered_repository: _RegisteredRepository,
    tmp_path: Path,
) -> None:
    _write(registered_repository.root, _PAIR_PATH, b"dirty pair plan\n")
    _assert_not_established(_inspect(registered_repository))

    extra = _build_registered_repository(
        tmp_path / "extra-path-repository",
        pair_tree_extras={"src/hermes/unexpected.py": b"unexpected = True\n"},
    )
    _assert_not_established(_inspect(extra))


def test_modified_instead_of_added_pair_path_does_not_establish(tmp_path: Path) -> None:
    fixture = _build_registered_repository(
        tmp_path / "modified-ledger-repository",
        protocol_tree_extras={_LEDGER_PATH: b"placeholder\n"},
    )

    _assert_not_established(_inspect(fixture))


@pytest.mark.parametrize(
    "payload",
    (
        b"R100\0old\0new\0",
        b"C100\0old\0new\0",
        b"X\0evaluation-plans/lead.yaml\0",
        b"A\0evaluation-plans/lead.yaml",
        b"A\0evaluation-plans/lead.yaml\0orphan\0",
        b"A\0bad\npath\0",
        b"A\0bad\tpath\0",
        b"A\0-leading-dash\0",
        b"A\0\xff\0",
    ),
)
def test_diff_tree_nul_parser_rejects_unsafe_or_malformed_records(payload: bytes) -> None:
    with pytest.raises(RegistrationGitOperationalError):
        _parse_diff_tree_output(payload)


@pytest.mark.parametrize(
    "payload",
    (
        b"R  renamed\0old\0",
        b"C  copied\0old\0",
        b"ZZ unknown\0",
        b"M short\0",
        b" M missing-terminator",
        b" M bad\npath\0",
        b" M bad\tpath\0",
        b"?? -leading-dash\0",
        b"?? \xff\0",
    ),
)
def test_status_nul_parser_rejects_unsafe_or_malformed_records(payload: bytes) -> None:
    with pytest.raises(RegistrationGitOperationalError):
        _parse_status_output(payload)


@pytest.mark.parametrize(
    "payload",
    (
        b"f" * 40,
        b"f" * 40 + b"\nextra\n",
        b"F" * 40 + b"\n",
        b"f" * 40 + b"  " + b"e" * 40 + b"\n",
        b"f" * 40 + b" not-a-commit\n",
    ),
)
def test_parent_parser_rejects_malformed_rev_list_response(payload: bytes) -> None:
    with pytest.raises(RegistrationGitOperationalError):
        _parse_parent_line(payload)


@pytest.mark.parametrize(
    "payload",
    (
        b"relative/repository\n",
        b"/tmp/../tmp\n",
        b"/tmp/repository\nextra\n",
        b"/tmp/\xff\n",
    ),
)
def test_top_level_parser_rejects_noncanonical_or_malformed_response(
    payload: bytes,
) -> None:
    with pytest.raises(RegistrationGitOperationalError):
        _parse_repository_top_level(payload)


def _write_fake_git(path: Path, body: str) -> Path:
    path.write_text(f"#!{sys.executable}\n{body}", encoding="utf-8")
    path.chmod(0o700)
    return path


def test_repository_root_requires_exact_absolute_canonical_spelling(
    registered_repository: _RegisteredRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(registered_repository.root.parent)
    inspector = RegistrationGitInspector()
    kwargs = {
        "baseline_repository_commit": registered_repository.pair_commit,
        "candidate_repository_commit": registered_repository.pair_commit,
    }
    with pytest.raises(RegistrationGitOperationalError):
        inspector.inspect(
            Path(registered_repository.root.name),
            registered_repository.plans,
            **kwargs,
        )
    with pytest.raises(RegistrationGitOperationalError):
        inspector.inspect(
            registered_repository.root / ".." / registered_repository.root.name,
            registered_repository.plans,
            **kwargs,
        )


def test_missing_executable_unsafe_root_and_malformed_response_are_operational_errors(
    registered_repository: _RegisteredRepository,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(git_module.shutil, "which", lambda *_args, **_kwargs: None)
    with pytest.raises(RegistrationGitOperationalError):
        _inspect(registered_repository)

    link = tmp_path / "repository-link"
    link.symlink_to(registered_repository.root, target_is_directory=True)
    with pytest.raises(RegistrationGitOperationalError):
        RegistrationGitInspector().inspect(
            link,
            registered_repository.plans,
            baseline_repository_commit=registered_repository.pair_commit,
            candidate_repository_commit=registered_repository.pair_commit,
        )

    malformed = _write_fake_git(
        tmp_path / "malformed-git",
        "import os\nos.write(1, b'not-a-canonical-root\\nextra\\n')\n",
    )
    monkeypatch.setattr(
        git_module.shutil,
        "which",
        lambda *_args, **_kwargs: str(malformed),
    )
    with pytest.raises(RegistrationGitOperationalError):
        _inspect(registered_repository)


def test_combined_streaming_cap_is_enforced_across_stdout_and_stderr(
    registered_repository: _RegisteredRepository,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    oversized = _write_fake_git(
        tmp_path / "oversized-git",
        "import os\nos.write(1, b'x' * 40)\nos.write(2, b'y' * 40)\n",
    )
    monkeypatch.setattr(
        git_module.shutil,
        "which",
        lambda *_args, **_kwargs: str(oversized),
    )
    monkeypatch.setattr(git_module, "MAX_GIT_OPERATION_OUTPUT_BYTES", 64)

    with pytest.raises(RegistrationGitOperationalError):
        _inspect(registered_repository)


def test_exact_combined_cap_streams_both_pipes_without_deadlock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bytes_per_stream = 64 * 1024
    monkeypatch.setattr(
        git_module,
        "MAX_GIT_OPERATION_OUTPUT_BYTES",
        2 * bytes_per_stream,
    )
    script = (
        "import os, threading\n"
        "def write_all(fd, value):\n"
        "    payload = value * 65536\n"
        "    while payload:\n"
        "        payload = payload[os.write(fd, payload):]\n"
        "threads = [\n"
        "    threading.Thread(target=write_all, args=(1, b'x')),\n"
        "    threading.Thread(target=write_all, args=(2, b'y')),\n"
        "]\n"
        "[thread.start() for thread in threads]\n"
        "[thread.join() for thread in threads]\n"
    )
    process = subprocess.Popen(
        [sys.executable, "-c", script],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        close_fds=True,
    )

    result = _read_bounded_process(process)

    assert result.returncode == 0
    assert result.stdout == b"x" * bytes_per_stream
    assert result.stderr == b"y" * bytes_per_stream


def test_process_launch_failure_is_normalized_to_the_typed_operational_error(
    registered_repository: _RegisteredRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    resolved_git = str(Path(shutil.which("git") or "").resolve())
    monkeypatch.setattr(
        git_module.shutil,
        "which",
        lambda *_args, **_kwargs: resolved_git,
    )

    def fail_to_start(*_args, **_kwargs):
        raise OSError("synthetic launch failure")

    monkeypatch.setattr(git_module.subprocess, "Popen", fail_to_start)

    with pytest.raises(RegistrationGitOperationalError):
        _inspect(registered_repository)


class _StuckProcess:
    def __init__(self) -> None:
        stdout_read, self._stdout_write = os.pipe()
        stderr_read, self._stderr_write = os.pipe()
        self.stdout = os.fdopen(stdout_read, "rb", buffering=0)
        self.stderr = os.fdopen(stderr_read, "rb", buffering=0)
        self.returncode: int | None = None
        self.events: list[str] = []

    def poll(self) -> int | None:
        return self.returncode

    def wait(self, timeout: float | None = None) -> int:
        if self.returncode is not None:
            return self.returncode
        raise subprocess.TimeoutExpired("git", timeout)

    def terminate(self) -> None:
        self.events.append("terminate")

    def kill(self) -> None:
        self.events.append("kill")
        self.returncode = -9
        os.close(self._stdout_write)
        os.close(self._stderr_write)


def test_selector_initialization_failure_stops_process_and_closes_pipes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    process = _StuckProcess()

    def fail_selector():
        raise OSError("synthetic selector failure")

    monkeypatch.setattr(git_module.selectors, "DefaultSelector", fail_selector)

    with pytest.raises(RegistrationGitOperationalError):
        _read_bounded_process(process)

    assert process.events == ["terminate", "kill"]
    assert process.stdout.closed
    assert process.stderr.closed


def test_deadline_terminates_then_kills_a_stuck_process(
    registered_repository: _RegisteredRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    process = _StuckProcess()
    resolved_git = str(Path(shutil.which("git") or "").resolve())
    monkeypatch.setattr(
        git_module.shutil,
        "which",
        lambda *_args, **_kwargs: resolved_git,
    )
    monkeypatch.setattr(git_module.subprocess, "Popen", lambda *_args, **_kwargs: process)
    monkeypatch.setattr(git_module, "GIT_OPERATION_TIMEOUT_S", 0.01)
    monkeypatch.setattr(git_module, "GIT_TERMINATE_GRACE_S", 0.01)

    with pytest.raises(RegistrationGitOperationalError):
        _inspect(registered_repository)

    assert process.events == ["terminate", "kill"]
    assert process.stdout.closed
    assert process.stderr.closed
