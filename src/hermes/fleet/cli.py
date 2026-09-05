"""The `hermes fleet` surface: author, run, and inspect simulation experiments."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from hermes.cli_errors import CliErrorCode, render_cli_error
from hermes.fleet.authoring import (
    SpecAuthoringError,
    load_decision_record,
    load_experiment_spec,
    render_experiment_template,
)
from hermes.fleet.contracts import (
    ExperimentSpec,
    FleetScenarioConfig,
    Guardrail,
    PrimaryMetric,
)
from hermes.fleet.experiment import FleetExperimentError, render_record, run_experiment
from hermes.fleet.metrics import METRIC_REGISTRY_VERSION, definitions, resolve

fleet_app = typer.Typer(
    no_args_is_help=True,
    help="Fleet/operations experimentation (SIMULATION_ONLY; synthetic; screening only).",
)

metrics_app = typer.Typer(
    no_args_is_help=True,
    help="Inspect the registered FleetLab metric contract.",
)
fleet_app.add_typer(metrics_app, name="metrics")

experiment_app = typer.Typer(
    no_args_is_help=True,
    help="Author and run preregistered FleetLab experiment specs.",
)
fleet_app.add_typer(experiment_app, name="experiment")

_BANNER = (
    "SIMULATION-ONLY PROTOTYPE - synthetic fleet, not calibrated to any real operation; "
    "a screening input, never a launch decision."
)


@metrics_app.command("list")
def list_metrics() -> None:
    """Print the registered metric contract in registration order."""
    registered_definitions = definitions()
    typer.echo(
        "Metric registry "
        f"{METRIC_REGISTRY_VERSION} - {len(registered_definitions)} metrics "
        "- simulation only; synthetic; not a forecast"
    )
    for definition in registered_definitions:
        lines = [
            definition.name,
            f"  unit: {definition.unit}",
            f"  direction: {definition.direction.value}",
            f"  aggregation: {definition.aggregation.value}",
            f"  population: {definition.population}",
            f"  availability: {definition.availability.value}",
        ]
        if definition.absent_when is not None:
            lines.append(f"  absent when: {definition.absent_when}")
        lines.append(
            "  surfaces: " + ", ".join(surface.value for surface in definition.surfaces)
        )
        if definition.alias_of is not None:
            lines.append(f"  alias of {definition.alias_of}")
        if definition.descriptive_rank is not None:
            lines.append(f"  descriptive rank {definition.descriptive_rank}")
        typer.echo("\n".join(lines))


def fleet_005_spec() -> ExperimentSpec:
    """FLEET-005: cleaning/service duration +25% - offboard change vs commercial proxies.

    Every number below is illustrative and declared before any run; the demo's claim rests
    on the paired deltas, never on the absolute levels of an uncalibrated model.
    """
    zones = ("downtown", "airport", "residential")
    travel = {
        "downtown->airport": 900,
        "airport->downtown": 900,
        "downtown->residential": 480,
        "residential->downtown": 480,
        "airport->residential": 720,
        "residential->airport": 720,
    }
    scenario = FleetScenarioConfig(
        name="fleet_005_longer_turnaround",
        horizon_s=6 * 3600,
        zones=zones,
        travel_time_s=travel,
        vehicle_count=40,
        demand_per_zone_per_hour=24,
        max_wait_s=1200,
        trips_between_service=6,
        service_bays=6,
        service_duration_s=1800,
        in_zone_pickup_s=240,
        travel_sigma=0.25,
    )
    return ExperimentSpec(
        experiment_id="fleet-005-turnaround",
        decision_owner="AUTHOR_SELF_TEST",
        question=(
            "Does a 25% longer depot service turnaround degrade rider wait p90 beyond the "
            "declared equivalence margin?"
        ),
        scenario=scenario,
        variation_axis="parameter:service_duration_s",
        baseline_value=1800,
        candidate_value=2250,
        primary_metric=PrimaryMetric(
            name="wait.p90_s",
            unit="s",
            direction="lower_is_better",
            equivalence_margin=30.0,
        ),
        guardrails=(
            Guardrail(metric="unserved.fraction", max_harm=0.02, direction="lower_is_better"),
        ),
        seeds=tuple(range(101, 111)),
    )


def _raise_experiment_error(error: Exception) -> None:
    code = (
        CliErrorCode.CONFIGURATION_ERROR
        if isinstance(error, (SpecAuthoringError, FleetExperimentError))
        else CliErrorCode.OPERATIONAL_ERROR
    )
    render_cli_error(code, str(error), 40)
    raise typer.Exit(code=40)


@fleet_app.command("view")
def fleet_view(
    host: Annotated[
        str,
        typer.Option(help="Numeric loopback address for the read-only local view."),
    ] = "127.0.0.1",
    port: Annotated[
        int,
        typer.Option(help="Loopback TCP port for the read-only local view."),
    ] = 8502,
    no_browser: Annotated[
        bool,
        typer.Option(help="Do not open a browser for the static synthetic-run view."),
    ] = False,
) -> None:
    """Render one finished synthetic run in a read-only, loopback-only local view."""
    try:
        from hermes.fleet.operator_view import launch_operator_view

        status = launch_operator_view(host=host, port=port, no_browser=no_browser)
        if status != 0:
            raise RuntimeError(f"operator view exited with status {status}")
    except ValueError as exc:
        render_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc), 40)
        raise typer.Exit(code=40) from exc
    except Exception as exc:
        render_cli_error(CliErrorCode.OPERATIONAL_ERROR, str(exc), 40)
        raise typer.Exit(code=40) from exc


@experiment_app.command("template")
def experiment_template() -> None:
    """Print a complete FLEET-005 YAML template to standard output."""
    try:
        typer.echo(render_experiment_template(fleet_005_spec()), nl=False)
    except Exception as exc:
        _raise_experiment_error(exc)


@experiment_app.command("validate")
def experiment_validate(spec_path: Path) -> None:
    """Validate a FleetLab experiment spec without running it."""
    try:
        spec = load_experiment_spec(spec_path)
        primary = resolve(spec.primary_metric.name)
        typer.echo(_BANNER)
        typer.echo(f"VALID {spec.experiment_id}")
        typer.echo(f"Spec digest: {spec.spec_digest()}")
        typer.echo(f"Seed set digest: {spec.seed_set_digest()}")
        typer.echo(
            f"Axis: {spec.variation_axis} ({spec.baseline_value:g} -> "
            f"{spec.candidate_value:g})"
        )
        typer.echo(
            f"Primary: {primary.name} ({primary.unit}, {primary.direction.value}, "
            f"margin {spec.primary_metric.equivalence_margin:g})"
        )
        for guardrail in spec.guardrails:
            definition = resolve(guardrail.metric)
            typer.echo(
                f"Guardrail: {definition.name} ({definition.unit}, "
                f"{definition.direction.value}, max_harm {guardrail.max_harm:g})"
            )
    except Exception as exc:
        _raise_experiment_error(exc)


@experiment_app.command("run")
def experiment_run(
    spec_path: Path,
    out_dir: Annotated[
        Path,
        typer.Option(
            "--out-dir",
            help=(
                "Where the decision record is written; exit status reflects the tool, "
                "not the candidate."
            ),
        ),
    ] = Path("experiments"),
) -> None:
    """Run a validated spec; candidate validity is reported in the decision record."""
    try:
        spec = load_experiment_spec(spec_path)
        typer.echo(_BANNER)
        record = run_experiment(spec, out_dir=out_dir)
        typer.echo(render_record(record))
        destination = out_dir / record.experiment_id / "decision-record.json"
        typer.echo(f"Decision record: {destination}")
        typer.echo(f"Record digest:   {record.record_digest()}")
    except Exception as exc:
        _raise_experiment_error(exc)


@experiment_app.command("inspect")
def experiment_inspect(record_path: Path) -> None:
    """Validate and render a stored FleetLab decision record."""
    try:
        record = load_decision_record(record_path)
        typer.echo(render_record(record))
        typer.echo(f"Record digest:   {record.record_digest()}")
    except Exception as exc:
        _raise_experiment_error(exc)


@fleet_app.command("demo")
def demo(
    out_dir: Annotated[
        Path,
        typer.Option("--out-dir", help="Where the decision record is written."),
    ] = Path("experiments"),
) -> None:
    """Run the preregistered FLEET-005 experiment and print its decision record."""
    typer.echo(_BANNER)
    record = run_experiment(fleet_005_spec(), out_dir=out_dir)
    typer.echo(render_record(record))
    typer.echo(f"Decision record: {out_dir / record.experiment_id / 'decision-record.json'}")
    typer.echo(f"Record digest:   {record.record_digest()}")
