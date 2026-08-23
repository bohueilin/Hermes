"""Hermes FleetLab: fleet/operations experimentation (Phase 9, P0 spike).

A separate domain beside the driving lane. It reuses Hermes's evidence *principles* —
digest-bound identity, non-compensatory resolution, missing evidence never zero — and none of
the vehicle machinery: no SimulatorAdapter, no vehicle action schema, no trace events.

Everything here is SIMULATION_ONLY and SYNTHETIC_UNCALIBRATED. A FleetLab result is a
screening input to a next test, never a launch decision; ``deployment_permission`` is NONE.
"""

from hermes.fleet.contracts import (
    DecisionRecord,
    ExperimentOutcome,
    ExperimentSpec,
    ExperimentValidity,
    FleetRecommendation,
    InvalidityReason,
)
from hermes.fleet.experiment import run_experiment

__all__ = [
    "DecisionRecord",
    "ExperimentOutcome",
    "ExperimentSpec",
    "ExperimentValidity",
    "FleetRecommendation",
    "InvalidityReason",
    "run_experiment",
]
