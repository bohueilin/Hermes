from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from hermes.cli import app
from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.domain.models import ArtifactVerification
from hermes.runtime.orchestrator import RunOutcome, SimulatorSmokeOutcome

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
    assert "sim-smoke" in result.output


def test_metadrive_run_requires_headless_and_routes_supported_profile(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = _redirect_repository_artifacts(tmp_path, monkeypatch)
    calls: list[dict[str, object]] = []

    def execute(**kwargs):
        calls.append(kwargs)
        verification = ArtifactVerification(
            artifact_path=str(artifacts / "cli-metadrive"),
            integrity=IntegrityStatus.INTERNALLY_CONSISTENT,
            verdict=Verdict.PASS,
            trace_digest="a" * 64,
        )
        return RunOutcome(
            verdict=Verdict.PASS,
            artifact_path=artifacts / "cli-metadrive",
            trace_digest="a" * 64,
            verification=verification,
        )

    monkeypatch.setattr("hermes.cli.execute_metadrive_run", execute)
    base = [
        "run",
        "--simulator",
        "metadrive",
        "--scenario",
        str(repository_root / "scenarios" / "metadrive_nominal.yaml"),
        "--policy",
        "metadrive-idm",
        "--seed",
        "7",
        "--run-id",
        "cli-metadrive",
    ]

    missing_headless = runner.invoke(app, base)
    result = runner.invoke(app, [*base, "--headless"])

    assert missing_headless.exit_code == 40
    assert "requires --headless" in missing_headless.output
    assert result.exit_code == 0
    assert "Adapter: metadrive" in result.output
    assert calls and calls[0]["seed"] == 7
    assert calls[0]["artifact_root"] == artifacts
    assert calls[0]["gate_config_path"].name == "gates.phase2.yaml"


def test_run_routes_versioned_deterministic_shield_configuration(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = _redirect_repository_artifacts(tmp_path, monkeypatch)
    calls: list[dict[str, object]] = []

    def execute(**kwargs):
        calls.append(kwargs)
        verification = ArtifactVerification(
            artifact_path=str(artifacts / "shielded"),
            integrity=IntegrityStatus.INTERNALLY_CONSISTENT,
            verdict=Verdict.PASS,
            trace_digest="a" * 64,
        )
        return RunOutcome(
            verdict=Verdict.PASS,
            artifact_path=artifacts / "shielded",
            trace_digest="a" * 64,
            verification=verification,
        )

    monkeypatch.setattr("hermes.cli.execute_metadrive_run", execute)
    result = runner.invoke(
        app,
        [
            "run",
            "--simulator",
            "metadrive",
            "--scenario",
            str(repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"),
            "--policy",
            "metadrive-idm",
            "--shield",
            "deterministic",
            "--shield-config",
            str(repository_root / "config" / "shield.phase3.yaml"),
            "--seed",
            "7",
            "--run-id",
            "shielded",
            "--headless",
        ],
    )

    assert result.exit_code == 0
    shield = calls[0]["shield_factory"]()
    assert shield.name == "deterministic"
    assert shield.evidence_config["label"] == (
        "illustrative_simulation_only_not_real_vehicle_limits"
    )


def test_sim_smoke_is_operational_only_and_requires_headless(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_repository_artifacts(tmp_path, monkeypatch)
    calls: list[dict[str, object]] = []

    def smoke(**kwargs):
        calls.append(kwargs)
        return SimulatorSmokeOutcome(
            simulator_name="metadrive",
            simulator_version="0.4.3",
            simulator_commit="85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
            steps_completed=5,
        )

    monkeypatch.setattr("hermes.cli.run_metadrive_smoke", smoke)

    missing_headless = runner.invoke(app, ["sim-smoke"])
    result = runner.invoke(app, ["sim-smoke", "--headless"])

    assert missing_headless.exit_code == 40
    assert result.exit_code == 0
    assert "Smoke status: OK" in result.output
    assert "Verdict:" not in result.output
    assert "0.4.3" in result.output
    assert calls
