from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from hermes.cli import app

runner = CliRunner()


def _redirect_repository_artifacts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Path:
    repository = tmp_path / "repository"
    artifacts = repository / "artifacts"
    artifacts.mkdir(parents=True)
    monkeypatch.setattr(
        "hermes.cli.discover_hermes_repository_root",
        lambda: repository,
    )
    return artifacts


@pytest.mark.parametrize(
    "scenario_name, expected_verdict, expected_exit",
    [
        ("fake_nominal.yaml", "PASS", 0),
        ("fake_collision.yaml", "HOLD", 20),
        ("fake_boundary.yaml", "HOLD", 20),
        ("fake_soft_degradation.yaml", "CONDITIONAL", 10),
    ],
)
def test_run_command_maps_verdicts_to_stable_exit_codes(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    scenario_name: str,
    expected_verdict: str,
    expected_exit: int,
) -> None:
    artifacts = _redirect_repository_artifacts(tmp_path, monkeypatch)
    run_id = scenario_name.removesuffix(".yaml").replace("_", "-")

    result = runner.invoke(
        app,
        [
            "run",
            "--simulator",
            "fake",
            "--scenario",
            str(repository_root / "scenarios" / scenario_name),
            "--policy",
            "baseline",
            "--seed",
            "7",
            "--run-id",
            run_id,
            "--gate-config",
            str(repository_root / "config" / "gates.phase1.yaml"),
        ],
    )

    assert result.exit_code == expected_exit
    assert f"Verdict: {expected_verdict}" in result.output
    assert "SIMULATION-ONLY PROTOTYPE" in result.output
    assert "Artifact integrity: INTERNALLY_CONSISTENT" in result.output
    assert (artifacts / run_id).is_dir()


def test_verify_command_reports_valid_hold_separately_from_integrity(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = _redirect_repository_artifacts(tmp_path, monkeypatch)
    run_result = runner.invoke(
        app,
        [
            "run",
            "--simulator",
            "fake",
            "--scenario",
            str(repository_root / "scenarios" / "fake_collision.yaml"),
            "--policy",
            "baseline",
            "--seed",
            "7",
            "--run-id",
            "verify-hold",
            "--gate-config",
            str(repository_root / "config" / "gates.phase1.yaml"),
        ],
    )

    verify_result = runner.invoke(app, ["verify-artifact", str(artifacts / "verify-hold")])

    assert run_result.exit_code == 20
    assert verify_result.exit_code == 20
    assert "Artifact integrity: INTERNALLY_CONSISTENT" in verify_result.output
    assert "Authenticity: NOT_AUTHENTICATED" in verify_result.output
    assert "Verdict: HOLD" in verify_result.output


def test_verify_command_maps_modified_action_to_invalid_evidence(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = _redirect_repository_artifacts(tmp_path, monkeypatch)
    runner.invoke(
        app,
        [
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
            "tamper-cli",
            "--gate-config",
            str(repository_root / "config" / "gates.phase1.yaml"),
        ],
    )
    events_path = artifacts / "tamper-cli" / "events.jsonl"
    lines = events_path.read_text(encoding="utf-8").splitlines()
    first = json.loads(lines[0])
    first["executed_action"] = {"steering": 0.0, "throttle": 0.0, "brake": 0.5}
    lines[0] = json.dumps(first, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    events_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    result = runner.invoke(app, ["verify-artifact", str(artifacts / "tamper-cli")])

    assert result.exit_code == 30
    assert "Artifact integrity: INVALID" in result.output
    assert "Verdict: INVALID_EVIDENCE" in result.output
    assert "First mismatched event sequence: 0" in result.output


def test_run_configuration_error_returns_40_and_never_prints_pass(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_repository_artifacts(tmp_path, monkeypatch)

    result = runner.invoke(
        app,
        [
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
            "../unsafe",
            "--gate-config",
            str(repository_root / "config" / "gates.phase1.yaml"),
        ],
    )

    assert result.exit_code == 40
    assert "Configuration error" in result.output
    assert "Verdict: PASS" not in result.output


def test_usage_errors_and_external_artifact_root_return_40(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_repository_artifacts(tmp_path, monkeypatch)
    base = [
        "run",
        "--simulator",
        "fake",
        "--scenario",
        str(repository_root / "scenarios" / "fake_nominal.yaml"),
        "--policy",
        "baseline",
        "--run-id",
        "usage-contract",
    ]
    outside = tmp_path / "outside"
    outside.mkdir()

    missing_seed = runner.invoke(app, base)
    invalid_seed = runner.invoke(app, [*base, "--seed", "not-an-integer"])
    missing_artifact = runner.invoke(app, ["verify-artifact"])
    external_root = runner.invoke(
        app,
        [*base, "--seed", "7", "--artifact-root", str(outside)],
    )

    for result in (missing_seed, invalid_seed, missing_artifact, external_root):
        assert result.exit_code == 40
        assert "Verdict: PASS" not in result.output
    assert list(outside.iterdir()) == []


def test_help_states_scope_commands_and_exit_contract() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    assert "SIMULATION-ONLY" in result.output
    assert "run" in result.output
    assert "verify-artifact" in result.output
    assert "doctor" in result.output
