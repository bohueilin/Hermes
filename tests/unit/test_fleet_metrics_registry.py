"""Tests for the typed FleetLab metric contract."""

from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from hermes.domain.models import HermesModel
from hermes.fleet.metrics import (
    Availability,
    MetricAggregation,
    MetricDefinition,
    MetricDirection,
    Surface,
)


def _definition(**overrides: object) -> MetricDefinition:
    payload: dict[str, object] = {
        "name": "wait.p90_s",
        "unit": "s",
        "direction": MetricDirection.LOWER_IS_BETTER,
        "population": "completed requests with a recorded pickup time",
        "aggregation": MetricAggregation.P90,
        "availability": Availability.CONDITIONAL,
        "absent_when": "no request completed with a recorded pickup time",
        "surfaces": (Surface.EXPERIMENT, Surface.OPERATOR),
    }
    payload.update(overrides)
    return MetricDefinition(**payload)


def test_a_conditional_definition_must_state_when_it_is_absent() -> None:
    with pytest.raises(ValidationError, match="absent_when"):
        _definition(absent_when=None)


def test_an_always_definition_must_not_state_an_absence_condition() -> None:
    with pytest.raises(ValidationError, match="absent_when"):
        _definition(
            availability=Availability.ALWAYS,
            absent_when="this metric is always present",
        )


def test_a_metric_name_must_be_namespaced() -> None:
    for name in ("wait", "Wait.p90_s", "wait.p90-s", "p90_s"):
        with pytest.raises(ValidationError, match="name"):
            _definition(name=name)


def test_a_definition_is_frozen_and_rejects_unknown_fields() -> None:
    definition = _definition()
    assert isinstance(definition, HermesModel)
    with pytest.raises(ValidationError):
        MetricDefinition(**definition.model_dump(), unknown_field="no")
    with pytest.raises(ValidationError):
        definition.unit = "ms"  # type: ignore[misc]


def test_metrics_module_imports_nothing_from_the_fleet_package() -> None:
    module_path = Path(__file__).parents[2] / "src/hermes/fleet/metrics.py"
    module = ast.parse(module_path.read_text(encoding="utf-8"))
    allowed_roots = {"pydantic", *sys.stdlib_module_names}

    for node in ast.walk(module):
        if isinstance(node, ast.Import):
            imported_names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            imported_names = [node.module]
        else:
            continue
        for name in imported_names:
            if name.startswith("hermes"):
                assert name == "hermes.domain.models"
            else:
                assert name.split(".")[0] in allowed_roots
