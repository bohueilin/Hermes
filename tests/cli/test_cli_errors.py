from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from hermes.cli import app
from hermes.runtime.orchestrator import RunOperationalError

runner = CliRunner()


def _base_run(repository_root: Path) -> list[str]:
    return [
        "run",
        "--simulator",
        "fake",
        "--scenario",
        str(repository_root / "scenarios" / "fake_nominal.yaml"),
        "--policy",
        "baseline",
        "--seed",
        "7",
        "--run-id",
        "cli-error-test",
    ]


def test_usage_error_has_stable_code_message_and_exit(
    repository_root: Path,
) -> None:
    args = _base_run(repository_root)
    del args[args.index("--seed") : args.index("--seed") + 2]

    result = runner.invoke(app, args)

    assert result.exit_code == 40
    assert "[USAGE_ERROR]" in result.output
    assert "Usage error:" in result.output
    assert "Exit code: 40" in result.output
    assert "Verdict: PASS" not in result.output


def test_configuration_error_has_stable_code_message_and_exit(
    repository_root: Path,
) -> None:
    args = _base_run(repository_root)
    args[args.index("fake")] = "unsupported"

    result = runner.invoke(app, args)

    assert result.exit_code == 40
    assert "[CONFIGURATION_ERROR]" in result.output
    assert "Configuration error:" in result.output
    assert "Exit code: 40" in result.output
    assert "Verdict: PASS" not in result.output


def test_operational_error_has_stable_code_message_and_exit(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = tmp_path / "repository"
    (repository / "artifacts").mkdir(parents=True)
    monkeypatch.setattr("hermes.cli.discover_hermes_repository_root", lambda: repository)

    def explode(**kwargs):
        del kwargs
        raise RunOperationalError("synthetic execution failure")

    monkeypatch.setattr("hermes.cli.execute_fake_run", explode)

    result = runner.invoke(app, _base_run(repository_root))

    assert result.exit_code == 40
    assert "[OPERATIONAL_ERROR]" in result.output
    assert "Operational error: synthetic execution failure" in result.output
    assert "Exit code: 40" in result.output
    assert "Verdict: PASS" not in result.output


def test_compare_json_invalid_evidence_uses_complete_canonical_error_envelope(
    tmp_path: Path,
) -> None:
    baseline = tmp_path / "missing-baseline"
    candidate = tmp_path / "missing-candidate"

    result = runner.invoke(
        app,
        ["compare", str(baseline), str(candidate), "--format", "json"],
    )

    assert result.exit_code == 30
    payload = json.loads(result.output)
    assert payload["error"] == "INVALID_EVIDENCE"
    assert payload["message"] == "One or more stored artifacts failed verification."
    assert payload["exit_code"] == 30
    assert len(payload["details"]["artifacts"]) == 2


def test_invalid_compare_format_is_structured_and_never_claims_pass(
    tmp_path: Path,
) -> None:
    result = runner.invoke(
        app,
        ["compare", str(tmp_path / "a"), str(tmp_path / "b"), "--format", "xml"],
    )

    assert result.exit_code == 40
    assert "[CONFIGURATION_ERROR]" in result.output
    assert "unsupported format 'xml'" in result.output
    assert "Verdict: PASS" not in result.output
