"""The `hermes fleet` surface: run the FLEET-005 spike end to end.

Kept in its own module so the driving CLI gains exactly two lines. The demo constructs the
preregistered spec in code — spec-file authoring is the next increment, not this one.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from hermes.fleet.contracts import (
    ExperimentSpec,
    FleetScenarioConfig,
    Guardrail,
    PrimaryMetric,
)
from hermes.fleet.experiment import render_record, run_experiment
from hermes.fleet.metrics import METRIC_REGISTRY_VERSION, definitions

fleet_app = typer.Typer(
    no_args_is_help=True,
    help="Fleet/operations experimentation (SIMULATION_ONLY; synthetic; screening only).",
)

metrics_app = typer.Typer(
    no_args_is_help=True,
    help="Inspect the registered FleetLab metric contract.",
)
fleet_app.add_typer(metrics_app, name="metrics")

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
            "  surfaces: " + ", ".join(surface.value for surface in definition.surfaces),
        ]
        if definition.absent_when is not None:
            lines.append(f"  absent when: {definition.absent_when}")
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
