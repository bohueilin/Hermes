"""Command-line interface for Hermes."""

from collections import Counter
from pathlib import Path
from typing import Annotated, Any

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text
from typer.core import TyperGroup

from hermes.doctor import (
    CheckResult,
    CheckStatus,
    collect_doctor_checks,
    discover_hermes_repository_root,
)
from hermes.domain.enums import Verdict
from hermes.domain.models import ArtifactVerification
from hermes.evidence.verification import verify_artifact as verify_stored_artifact
from hermes.runtime.orchestrator import (
    RunConfigurationError,
    RunOperationalError,
    execute_fake_run,
)

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
        try:
            return super().main(*args, **kwargs)
        except SystemExit as exc:
            if exc.code == 2:
                raise SystemExit(40) from exc
            raise


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
        str, typer.Option("--simulator", help="Simulator adapter; Phase 1: fake.")
    ],
    scenario: Annotated[Path, typer.Option("--scenario", help="Strict scenario YAML path.")],
    policy: Annotated[
        str, typer.Option("--policy", help="Candidate policy; Phase 1: baseline.")
    ],
    seed: Annotated[int, typer.Option("--seed", help="Signed 32-bit deterministic seed.")],
    run_id: Annotated[str, typer.Option("--run-id", help="Unique lowercase artifact slug.")],
    gate_config: Annotated[
        Path | None,
        typer.Option("--gate-config", help="Strict illustrative release-gate YAML."),
    ] = None,
) -> None:
    """Run one bounded simulation-only scenario and publish verified evidence."""
    console = _phase_console()
    if simulator != "fake":
        console.print(
            f"Configuration error: unsupported simulator {simulator!r}; Phase 1 supports fake"
        )
        raise typer.Exit(code=40)
    if policy != "baseline":
        console.print(
            f"Configuration error: unsupported policy {policy!r}; Phase 1 supports baseline"
        )
        raise typer.Exit(code=40)
    repository_root = discover_hermes_repository_root()
    if repository_root is None:
        console.print("Configuration error: Hermes repository root is unavailable")
        raise typer.Exit(code=40)
    resolved_gate = gate_config or repository_root / "config" / "gates.phase1.yaml"
    resolved_artifacts = repository_root / "artifacts"
    try:
        outcome = execute_fake_run(
            scenario_path=scenario,
            gate_config_path=resolved_gate,
            seed=seed,
            run_id=run_id,
            artifact_root=resolved_artifacts,
            repository_root=repository_root,
        )
    except RunConfigurationError as exc:
        console.print(f"Configuration error: {exc}", style="red")
        raise typer.Exit(code=40) from exc
    except RunOperationalError as exc:
        console.print(f"Operational error: {exc}", style="red")
        raise typer.Exit(code=40) from exc
    except Exception as exc:
        console.print(f"Operational error: {type(exc).__name__}: {exc}", style="red")
        raise typer.Exit(code=40) from exc

    _render_artifact_verification(outcome.verification)
    console.print("Adapter: fake (deterministic architectural test double, not vehicle physics)")
    exit_code = EXIT_CODES[outcome.verdict]
    if exit_code:
        raise typer.Exit(code=exit_code)


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
        _phase_console().print(
            f"Operational error: artifact verifier crashed: {type(exc).__name__}: {exc}",
            style="red",
        )
        raise typer.Exit(code=40) from exc
    _render_artifact_verification(result)
    exit_code = EXIT_CODES[result.verdict]
    if exit_code:
        raise typer.Exit(code=exit_code)


if __name__ == "__main__":
    app()
