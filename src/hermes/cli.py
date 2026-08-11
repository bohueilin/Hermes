"""Command-line interface for Hermes."""

from collections import Counter

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text

from hermes.doctor import CheckResult, CheckStatus, collect_doctor_checks

app = typer.Typer(
    name="hermes",
    help="Hermes simulation-only autonomy evidence tooling.",
    no_args_is_help=True,
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


if __name__ == "__main__":
    app()
