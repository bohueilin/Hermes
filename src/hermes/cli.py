"""Command-line interface for Hermes."""

from collections import Counter
from functools import partial
from pathlib import Path
from typing import Annotated, Any, NoReturn

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text
from typer.core import TyperGroup, _click

from hermes.cli_errors import CliErrorCode, render_cli_error
from hermes.comparison.compare import compare_artifacts
from hermes.doctor import (
    CheckResult,
    CheckStatus,
    collect_doctor_checks,
    discover_hermes_repository_root,
)
from hermes.domain.enums import Verdict
from hermes.domain.models import ArtifactVerification
from hermes.evidence.canonical import canonical_json_bytes
from hermes.evidence.verification import inspect_artifact
from hermes.evidence.verification import verify_artifact as verify_stored_artifact
from hermes.runtime.orchestrator import (
    RunConfigurationError,
    RunOperationalError,
    execute_fake_run,
    execute_metadrive_run,
    run_metadrive_smoke,
)
from hermes.shields.config import ShieldConfigError, load_shield_config
from hermes.shields.deterministic import DeterministicSafetyShield
from hermes.shields.noop import NoOpShield

EXIT_CODES = {
    Verdict.PASS: 0,
    Verdict.CONDITIONAL: 10,
    Verdict.HOLD: 20,
    Verdict.INVALID_EVIDENCE: 30,
}
SCOPE_BANNER = (
    "SIMULATION-ONLY PROTOTYPE — illustrative thresholds; not road-safety, certification, "
    "compliance, or deployment evidence."
)


class HermesTyperGroup(TyperGroup):
    """Map Click/Typer usage failures into the Hermes operational contract."""

    def main(self, *args: Any, **kwargs: Any) -> Any:
        standalone_mode = kwargs.pop("standalone_mode", True)
        try:
            result = super().main(*args, standalone_mode=False, **kwargs)
        except _click.exceptions.UsageError as exc:
            render_cli_error(
                CliErrorCode.USAGE_ERROR,
                exc.format_message(),
                40,
            )
            if standalone_mode:
                raise SystemExit(40) from exc
            return 40
        except _click.exceptions.ClickException as exc:
            render_cli_error(
                CliErrorCode.USAGE_ERROR,
                exc.format_message(),
                40,
            )
            if standalone_mode:
                raise SystemExit(40) from exc
            return 40
        if standalone_mode:
            raise SystemExit(result if isinstance(result, int) else 0)
        return result


app = typer.Typer(
    name="hermes",
    help="Hermes SIMULATION-ONLY autonomy evidence tooling.",
    no_args_is_help=True,
    cls=HermesTyperGroup,
)


@app.callback()
def main() -> None:
    """Run Hermes commands."""


def render_doctor_checks(checks: list[CheckResult], console: Console | None = None) -> None:
    """Render doctor results without changing their truth status."""
    output = console or Console(highlight=False)
    table = Table(title="Hermes Phase 0 environment doctor")
    table.add_column("Status", no_wrap=True)
    table.add_column("Check", style="bold")
    table.add_column("Observed result", overflow="fold")

    status_styles = {
        CheckStatus.PASS: "bold green",
        CheckStatus.WARN: "bold yellow",
        CheckStatus.FAIL: "bold red",
        CheckStatus.NOT_AVAILABLE: "bold magenta",
    }
    for check in checks:
        table.add_row(
            Text(check.status.value, style=status_styles[check.status]),
            Text(check.name, style="bold"),
            Text(check.details),
        )

    output.print(table)
    for check in checks:
        if check.remediation:
            action = Text(f"Action — {check.name}: ", style="bold")
            action.append(check.remediation, style="not bold")
            output.print(action)

    counts = Counter(check.status for check in checks)
    output.print(
        "Summary: "
        + ", ".join(
            f"{counts[status]} {status.value}"
            for status in CheckStatus
            if counts[status]
        )
    )


@app.command()
def doctor() -> None:
    """Inspect the Phase 0 development environment without launching the simulator."""
    checks = collect_doctor_checks()
    render_doctor_checks(checks)
    if any(check.status is CheckStatus.FAIL for check in checks):
        raise typer.Exit(code=1)


def _phase_console() -> Console:
    return Console(highlight=False, markup=False, soft_wrap=True)


def _raise_cli_error(
    code: CliErrorCode,
    message: str,
    *,
    exit_code: int = 40,
    details: dict[str, Any] | None = None,
    json_output: bool = False,
) -> NoReturn:
    render_cli_error(
        code,
        message,
        exit_code,
        details=details,
        json_output=json_output,
        console=_phase_console(),
    )
    raise typer.Exit(code=exit_code)


def _render_artifact_verification(result: ArtifactVerification) -> None:
    console = _phase_console()
    console.print(SCOPE_BANNER)
    console.print(f"Artifact integrity: {result.integrity.value}")
    console.print(f"Authenticity: {result.authenticity.value}")
    console.print(f"Verdict: {result.verdict.value}")
    console.print(f"Artifact: {result.artifact_path}")
    if result.trace_digest:
        console.print(f"Trace digest: {result.trace_digest}")
    if result.first_mismatch_sequence is not None:
        console.print(f"First mismatched event sequence: {result.first_mismatch_sequence}")
    for rationale in result.rationale:
        console.print(f"Rationale: {rationale}")
    if result.supporting_finding_ids:
        console.print("Supporting findings: " + ", ".join(result.supporting_finding_ids))
    for limitation in result.residual_limitations:
        console.print(f"Limitation: {limitation}")
    for error in result.errors:
        console.print(f"Verification error: {error}", style="red")


@app.command("run")
def run_command(
    simulator: Annotated[
        str, typer.Option("--simulator", help="Simulator adapter: fake or metadrive.")
    ],
    scenario: Annotated[Path, typer.Option("--scenario", help="Strict scenario YAML path.")],
    policy: Annotated[
        str, typer.Option("--policy", help="Candidate policy: baseline or metadrive-idm.")
    ],
    seed: Annotated[int, typer.Option("--seed", help="Signed 32-bit deterministic seed.")],
    run_id: Annotated[str, typer.Option("--run-id", help="Unique lowercase artifact slug.")],
    gate_config: Annotated[
        Path | None,
        typer.Option("--gate-config", help="Strict illustrative release-gate YAML."),
    ] = None,
    headless: Annotated[
        bool,
        typer.Option("--headless", help="Require physics-only MetaDrive execution."),
    ] = False,
    shield: Annotated[
        str,
        typer.Option("--shield", help="Runtime shield: noop or deterministic."),
    ] = "noop",
    shield_config: Annotated[
        Path | None,
        typer.Option("--shield-config", help="Versioned deterministic shield YAML."),
    ] = None,
) -> None:
    """Run one bounded simulation-only scenario and publish verified evidence."""
    console = _phase_console()
    if simulator not in {"fake", "metadrive"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported simulator {simulator!r}",
        )
    expected_policy = "baseline" if simulator == "fake" else "metadrive-idm"
    if policy != expected_policy:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"simulator {simulator!r} requires policy {expected_policy!r}",
        )
    if simulator == "metadrive" and not headless:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "MetaDrive execution requires --headless",
        )
    if shield not in {"noop", "deterministic"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported shield {shield!r}",
        )
    if shield == "noop" and shield_config is not None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "--shield-config requires deterministic shield",
        )
    repository_root = discover_hermes_repository_root()
    if repository_root is None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "Hermes repository root is unavailable",
        )
    default_gate = "gates.phase1.yaml" if simulator == "fake" else "gates.phase2.yaml"
    resolved_gate = gate_config or repository_root / "config" / default_gate
    resolved_artifacts = repository_root / "artifacts"
    shield_factory = NoOpShield
    if shield == "deterministic":
        resolved_shield = shield_config or repository_root / "config" / "shield.phase3.yaml"
        try:
            deterministic_config = load_shield_config(resolved_shield)
        except ShieldConfigError as exc:
            _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))
        shield_factory = partial(DeterministicSafetyShield, deterministic_config)
    try:
        runner = execute_fake_run if simulator == "fake" else execute_metadrive_run
        outcome = runner(
            scenario_path=scenario,
            gate_config_path=resolved_gate,
            seed=seed,
            run_id=run_id,
            artifact_root=resolved_artifacts,
            repository_root=repository_root,
            shield_factory=shield_factory,
        )
    except RunConfigurationError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))
    except RunOperationalError as exc:
        _raise_cli_error(CliErrorCode.OPERATIONAL_ERROR, str(exc))
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"{type(exc).__name__}: {exc}",
        )

    _render_artifact_verification(outcome.verification)
    if simulator == "fake":
        console.print(
            "Adapter: fake (deterministic architectural test double, not vehicle physics)"
        )
    else:
        console.print("Adapter: metadrive (headless MetaDrive 0.4.3 vehicle physics)")
    exit_code = EXIT_CODES[outcome.verdict]
    if exit_code:
        raise typer.Exit(code=exit_code)


@app.command("sim-smoke")
def sim_smoke_command(
    headless: Annotated[
        bool,
        typer.Option("--headless", help="Require physics-only MetaDrive execution."),
    ] = False,
) -> None:
    """Probe MetaDrive reset/IDM/step/close without publishing release evidence."""
    console = _phase_console()
    if not headless:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "MetaDrive smoke requires --headless",
        )
    repository_root = discover_hermes_repository_root()
    if repository_root is None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "Hermes repository root is unavailable",
        )
    try:
        outcome = run_metadrive_smoke(
            scenario_path=repository_root / "scenarios" / "metadrive_nominal.yaml",
            seed=7,
            repository_root=repository_root,
        )
    except RunConfigurationError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))
    except RunOperationalError as exc:
        _raise_cli_error(CliErrorCode.OPERATIONAL_ERROR, str(exc))
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"{type(exc).__name__}: {exc}",
        )

    console.print(SCOPE_BANNER)
    console.print("Smoke status: OK")
    console.print(
        f"Simulator: {outcome.simulator_name} {outcome.simulator_version} "
        f"({outcome.simulator_commit})"
    )
    console.print(f"Headless steps completed: {outcome.steps_completed}")


@app.command("verify-artifact")
def verify_artifact_command(
    artifact_dir: Annotated[
        Path, typer.Argument(help="Stored evidence-bundle directory.")
    ],
) -> None:
    """Verify stored evidence and recompute its verdict without rerunning a simulator."""
    try:
        result = verify_stored_artifact(artifact_dir)
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"artifact verifier crashed: {type(exc).__name__}: {exc}",
        )
    _render_artifact_verification(result)
    if result.verdict is Verdict.INVALID_EVIDENCE:
        _raise_cli_error(
            CliErrorCode.INVALID_EVIDENCE,
            "Stored artifact failed integrity verification.",
            exit_code=30,
        )
    exit_code = EXIT_CODES[result.verdict]
    if exit_code:
        raise typer.Exit(code=exit_code)


@app.command("compare")
def compare_command(
    baseline_dir: Annotated[Path, typer.Argument(help="Baseline evidence bundle.")],
    candidate_dir: Annotated[Path, typer.Argument(help="Candidate evidence bundle.")],
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: table or json."),
    ] = "table",
) -> None:
    """Compare two independently verified, compatible stored evidence bundles."""
    console = _phase_console()
    if output_format not in {"table", "json"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported format {output_format!r}",
        )
    try:
        baseline = inspect_artifact(baseline_dir)
        candidate = inspect_artifact(candidate_dir)
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"artifact inspection crashed: {type(exc).__name__}: {exc}",
        )

    invalid = [
        inspection
        for inspection in (baseline, candidate)
        if inspection.snapshot is None
    ]
    if invalid:
        details = {
            "artifacts": [
                inspection.verification.model_dump(mode="json")
                for inspection in invalid
            ]
        }
        if output_format == "json":
            _raise_cli_error(
                CliErrorCode.INVALID_EVIDENCE,
                "One or more stored artifacts failed verification.",
                exit_code=30,
                details=details,
                json_output=True,
            )
        else:
            render_cli_error(
                CliErrorCode.INVALID_EVIDENCE,
                "One or more stored artifacts failed verification.",
                30,
                details=details,
                console=console,
            )
            for inspection in invalid:
                _render_artifact_verification(inspection.verification)
        raise typer.Exit(code=30)

    assert baseline.snapshot is not None
    assert candidate.snapshot is not None
    comparison = compare_artifacts(baseline.snapshot, candidate.snapshot)
    if output_format == "json":
        typer.echo(
            canonical_json_bytes(comparison.model_dump(mode="json")).decode("utf-8")
        )
    else:
        console.print(SCOPE_BANNER)
        console.print(
            "Comparable: "
            + ("YES" if comparison.compatibility.comparable else "NO")
        )
        for reason in comparison.compatibility.reasons:
            console.print(f"Incompatibility: {reason}", style="red")
        for warning in comparison.compatibility.warnings:
            console.print(f"Warning: {warning}", style="yellow")
        if comparison.compatibility.comparable:
            table = Table(title="Stored evidence comparison")
            table.add_column("Dimension")
            table.add_column("Status")
            table.add_column("Baseline", overflow="fold")
            table.add_column("Candidate", overflow="fold")
            table.add_column("Explanation", overflow="fold")
            for dimension in comparison.dimensions:
                table.add_row(
                    dimension.name,
                    dimension.status.value,
                    str(dimension.baseline_value),
                    str(dimension.candidate_value),
                    dimension.explanation,
                )
            console.print(table)
    if not comparison.compatibility.comparable:
        _raise_cli_error(
            CliErrorCode.INCOMPATIBLE_EVIDENCE,
            "Stored artifacts are not comparable.",
        )


if __name__ == "__main__":
    app()
