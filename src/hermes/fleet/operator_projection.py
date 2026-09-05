"""Pure projection for the static FleetLab operator surface."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Literal

from pydantic import model_validator

import hermes.fleet.metrics as fleet_metrics
from hermes.domain.models import FiniteFloat, HermesModel
from hermes.fleet.contracts import REQUIRED_LABELS, CalibrationState, FleetScenarioConfig
from hermes.fleet.engine import run_fleet, run_metrics
from hermes.fleet.experiment import apply_axis
from hermes.fleet.invariants import check_invariants
from hermes.fleet.metrics import METRIC_REGISTRY_VERSION, Availability, Surface
from hermes.fleet.world import build_tape, tape_digest


class OperatorRow(HermesModel):
    """One operator-visible metric, including declared absence semantics."""

    name: str
    unit: str
    direction: str
    population: str
    aggregation: str
    status: Literal["PRESENT", "ABSENT"]
    value: FiniteFloat | None
    absent_reason: str | None

    @model_validator(mode="after")
    def status_matches_value_and_reason(self) -> OperatorRow:
        if self.status == "PRESENT":
            if self.value is None or self.absent_reason is not None:
                raise ValueError("PRESENT rows require a value and no absent_reason")
        elif self.value is not None or not self.absent_reason:
            raise ValueError("ABSENT rows require no value and a declared absent_reason")
        return self


class OperatorProjection(HermesModel):
    """Static presentation model for one completed synthetic FleetLab run."""

    scenario_name: str
    scenario_label: str
    calibration_state: CalibrationState
    labels: tuple[str, ...]
    metric_registry_version: str
    world_tape_digest: str
    seed: int
    rows: tuple[OperatorRow, ...]


def project_run(
    scenario: FleetScenarioConfig,
    calibration_state: CalibrationState,
    metrics: Mapping[str, float],
    *,
    seed: int,
    world_tape_digest: str,
) -> OperatorProjection:
    """Project one completed run through the metric registry at call time."""

    rows: list[OperatorRow] = []
    for name in fleet_metrics.names_for_surface(Surface.OPERATOR):
        definition = fleet_metrics.resolve(name)
        if name not in metrics:
            if definition.availability is Availability.ALWAYS:
                raise ValueError(f"ALWAYS metric '{name}' is missing from completed run metrics")
            rows.append(
                OperatorRow(
                    name=name,
                    unit=definition.unit,
                    direction=definition.direction.value,
                    population=definition.population,
                    aggregation=definition.aggregation.value,
                    status="ABSENT",
                    value=None,
                    absent_reason=definition.absent_when,
                )
            )
            continue
        rows.append(
            OperatorRow(
                name=name,
                unit=definition.unit,
                direction=definition.direction.value,
                population=definition.population,
                aggregation=definition.aggregation.value,
                status="PRESENT",
                value=metrics[name],
                absent_reason=None,
            )
        )
    return OperatorProjection(
        scenario_name=scenario.name,
        scenario_label=scenario.label,
        calibration_state=calibration_state,
        labels=REQUIRED_LABELS,
        metric_registry_version=METRIC_REGISTRY_VERSION,
        world_tape_digest=world_tape_digest,
        seed=seed,
        rows=tuple(rows),
    )


def demo_run() -> OperatorProjection:
    """Return the completed baseline episode of the fixed FLEET-005 demo."""

    from hermes.fleet.cli import fleet_005_spec

    spec = fleet_005_spec()
    seed = spec.seeds[0]
    scenario = apply_axis(spec, spec.baseline_value)
    tape = build_tape(spec.scenario, seed)
    log = run_fleet(scenario, tape)
    violations = check_invariants(log)
    if violations:
        raise ValueError(f"cannot render a run with invariant violations: {violations[0]}")
    return project_run(
        scenario,
        spec.calibration_state,
        run_metrics(log),
        seed=seed,
        world_tape_digest=tape_digest(spec.scenario, spec.seeds),
    )


def render_rows(projection: OperatorProjection) -> list[dict[str, str]]:
    """Render projection rows without rounding values or concealing declared absence."""

    return [
        {
            "Metric": row.name,
            "Value": str(row.value) if row.status == "PRESENT" else row.absent_reason or "",
            "Unit": row.unit,
            "Direction": row.direction,
            "Population": row.population,
            "Aggregation": row.aggregation,
            "Status": row.status,
        }
        for row in projection.rows
    ]
