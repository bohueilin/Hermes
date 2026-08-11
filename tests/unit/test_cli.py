from typer.testing import CliRunner

from hermes.cli import app
from hermes.doctor import CheckResult, CheckStatus

runner = CliRunner()


def test_cli_help_exposes_doctor_command() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    assert "doctor" in result.output


def test_doctor_renders_explicit_statuses_without_failing_on_warnings(monkeypatch) -> None:
    checks = [
        CheckResult("Python version", CheckStatus.PASS, "3.11.15"),
        CheckResult("Git dirty/clean status", CheckStatus.WARN, "working tree is dirty"),
        CheckResult("Git commit", CheckStatus.NOT_AVAILABLE, "repository has no commits"),
    ]
    monkeypatch.setattr("hermes.cli.collect_doctor_checks", lambda: checks)

    result = runner.invoke(app, ["doctor"])

    assert result.exit_code == 0
    assert "PASS" in result.output
    assert "WARN" in result.output
    assert "NOT_AVAILABLE" in result.output
    assert "repository has no commits" in result.output


def test_doctor_exits_nonzero_when_a_required_check_fails(monkeypatch) -> None:
    checks = [
        CheckResult(
            "MetaDrive import status",
            CheckStatus.FAIL,
            "metadrive could not be imported",
            "Install the verified local MetaDrive source.",
        )
    ]
    monkeypatch.setattr("hermes.cli.collect_doctor_checks", lambda: checks)

    result = runner.invoke(app, ["doctor"])

    assert result.exit_code == 1
    assert "FAIL" in result.output
    assert "Install the verified local MetaDrive source." in result.output


def test_doctor_renders_observed_values_literally_without_ellipsis(monkeypatch) -> None:
    literal_value = "[red]not markup[/red] " + "a" * 80
    monkeypatch.setattr(
        "hermes.cli.collect_doctor_checks",
        lambda: [CheckResult("Literal observation", CheckStatus.PASS, literal_value)],
    )

    result = runner.invoke(app, ["doctor"])

    assert result.exit_code == 0
    assert "[red]not markup[/red]" in result.output
    assert "…" not in result.output
