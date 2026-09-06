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


def test_every_produced_metric_is_registered_and_in_registration_order() -> None:
    from hermes.fleet.cli import fleet_005_spec
    from hermes.fleet.engine import run_fleet, run_metrics
    from hermes.fleet.metrics import METRIC_REGISTRY
    from hermes.fleet.world import build_tape

    spec = fleet_005_spec()
    tape = build_tape(spec.scenario, spec.seeds[0])
    metrics = run_metrics(run_fleet(spec.scenario, tape))

    assert set(metrics) <= set(METRIC_REGISTRY)
    assert list(metrics) == [name for name in METRIC_REGISTRY if name in metrics]


def test_every_always_metric_is_produced() -> None:
    from hermes.fleet.cli import fleet_005_spec
    from hermes.fleet.engine import run_fleet, run_metrics
    from hermes.fleet.metrics import Availability, definitions
    from hermes.fleet.world import build_tape

    spec = fleet_005_spec()
    metrics = run_metrics(run_fleet(spec.scenario, build_tape(spec.scenario, spec.seeds[0])))

    for definition in definitions():
        if definition.availability is Availability.ALWAYS:
            assert definition.name in metrics


def test_conditional_metrics_are_absent_for_their_declared_reason() -> None:
    from tests.unit.test_fleet_contracts_and_world import small_scenario

    from hermes.fleet.engine import run_fleet, run_metrics
    from hermes.fleet.metrics import Availability, definitions, resolve
    from hermes.fleet.world import build_tape

    scenario = small_scenario(trips_between_service=100)
    metrics = run_metrics(run_fleet(scenario, build_tape(scenario, 1)))
    depot_queue = resolve("depot.queue_p90_s")

    assert "depot.queue_p90_s" not in metrics
    assert depot_queue.availability is Availability.CONDITIONAL
    assert depot_queue.absent_when is not None
    for definition in definitions():
        if definition.availability is Availability.ALWAYS:
            assert definition.name in metrics


def test_declared_aliases_carry_equal_values() -> None:
    from hermes.fleet.cli import fleet_005_spec
    from hermes.fleet.engine import run_fleet, run_metrics
    from hermes.fleet.metrics import definitions
    from hermes.fleet.world import build_tape

    spec = fleet_005_spec()
    metrics = run_metrics(run_fleet(spec.scenario, build_tape(spec.scenario, spec.seeds[0])))

    for definition in definitions():
        if definition.alias_of is not None:
            assert metrics[definition.name] == metrics[definition.alias_of]


def test_resolving_an_unknown_name_lists_the_registered_names() -> None:
    from hermes.fleet.metrics import METRIC_REGISTRY, UnknownMetricError, resolve

    with pytest.raises(UnknownMetricError) as exc_info:
        resolve("wait.p95_s")

    message = str(exc_info.value)
    assert "wait.p95_s" in message
    assert "wait.p90_s" in message
    for name in METRIC_REGISTRY:
        assert name in message


def test_descriptive_names_are_pinned_to_the_recorded_order() -> None:
    from hermes.fleet.metrics import descriptive_metric_names

    assert descriptive_metric_names() == (
        "wait.p50_s",
        "requests.served",
        "requests.unserved",
        "fleet.utilization_fraction",
        "depot.queue_p90_s",
        "business_proxy.served_trips",
        "business_proxy.unserved_demand",
    )


def test_the_registry_is_immutable() -> None:
    from hermes.fleet.metrics import METRIC_REGISTRY

    with pytest.raises(TypeError):
        METRIC_REGISTRY["probe.extra_count"] = _definition()  # type: ignore[index]


def test_the_registry_fails_closed_on_a_bad_alias() -> None:
    from hermes.fleet.metrics import _build_registry

    target = _definition(
        name="requests.served",
        unit="requests",
        direction=MetricDirection.HIGHER_IS_BETTER,
        population="requests that reached COMPLETED",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        absent_when=None,
    )
    mismatched_alias = _definition(
        name="business_proxy.served_trips",
        unit="trips",
        direction=MetricDirection.HIGHER_IS_BETTER,
        population="same as requests.served",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        absent_when=None,
        alias_of="requests.served",
    )
    with pytest.raises(ValueError, match="requests.served.*business_proxy.served_trips"):
        _build_registry((target, mismatched_alias))

    first = _definition(
        name="requests.unserved",
        unit="requests",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="requests that reached UNSERVED",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        absent_when=None,
        descriptive_rank=10,
    )
    second = _definition(
        name="unserved.fraction",
        unit="fraction",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="unserved requests over all requests",
        aggregation=MetricAggregation.FRACTION,
        availability=Availability.ALWAYS,
        absent_when=None,
        descriptive_rank=10,
    )
    with pytest.raises(ValueError, match="requests.unserved.*unserved.fraction"):
        _build_registry((first, second))
