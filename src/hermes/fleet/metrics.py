"""Typed FleetLab metric definitions.

The registry is the contract every producer and consumer resolves through. Import direction is
``contracts -> metrics``; this module never imports FleetLab contracts.
"""

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from types import MappingProxyType
from typing import Annotated

from pydantic import Field, model_validator

from hermes.domain.models import HermesModel

METRIC_REGISTRY_VERSION: str = "0.1"


class MetricDirection(StrEnum):
    """How a higher paired delta should be interpreted for a metric."""

    LOWER_IS_BETTER = "lower_is_better"
    HIGHER_IS_BETTER = "higher_is_better"
    NEUTRAL = "neutral"


class MetricAggregation(StrEnum):
    """The declared aggregation for a metric value."""

    COUNT = "count"
    FRACTION = "fraction"
    MEAN = "mean"
    P50 = "p50"
    P90 = "p90"


class Availability(StrEnum):
    """Whether an otherwise valid run must contain the metric."""

    ALWAYS = "ALWAYS"
    CONDITIONAL = "CONDITIONAL"


class Surface(StrEnum):
    """A consumer surface allowed to display a metric."""

    EXPERIMENT = "EXPERIMENT"
    OPERATOR = "OPERATOR"


class MetricDefinition(HermesModel):
    """One versioned, typed metric contract shared by FleetLab consumers."""

    name: Annotated[
        str,
        Field(pattern=r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$", max_length=64),
    ]
    unit: Annotated[str, Field(min_length=1, max_length=16)]
    direction: MetricDirection
    population: Annotated[str, Field(min_length=1, max_length=200)]
    aggregation: MetricAggregation
    availability: Availability
    absent_when: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    surfaces: Annotated[tuple[Surface, ...], Field(min_length=1)]
    alias_of: Annotated[
        str,
        Field(pattern=r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$", max_length=64),
    ] | None = None
    descriptive_rank: Annotated[int, Field(ge=0)] | None = None

    @model_validator(mode="after")
    def validate_availability_and_alias(self) -> MetricDefinition:
        """Require declared absence semantics and reject aliases to themselves."""
        if self.availability is Availability.CONDITIONAL and self.absent_when is None:
            raise ValueError(
                "absent_when is required for CONDITIONAL metrics; fix it by stating when "
                "the metric is absent"
            )
        if self.availability is Availability.ALWAYS and self.absent_when is not None:
            raise ValueError(
                "absent_when is forbidden for ALWAYS metrics; fix it by removing the "
                "absence condition"
            )
        if self.alias_of == self.name:
            raise ValueError("alias_of must differ from name; fix it by naming another metric")
        return self


class UnknownMetricError(ValueError):
    """Raised when a FleetLab metric name has no registered definition."""

    def __init__(self, name: str) -> None:
        registry = globals().get("METRIC_REGISTRY", {})
        names = ", ".join(registry)
        super().__init__(
            f"'{name}' is not a registered fleet metric (registry {METRIC_REGISTRY_VERSION}). "
            f"Registered: {names}. Fix: use one of the registered names, or register the "
            "metric in hermes.fleet.metrics with its producer."
        )


def _build_registry(definitions: tuple[MetricDefinition, ...]) -> Mapping[str, MetricDefinition]:
    """Build an immutable registry, rejecting inconsistent aliases and ranks at import time."""
    registry: dict[str, MetricDefinition] = {}
    ranks: dict[int, MetricDefinition] = {}
    for definition in definitions:
        if definition.name in registry:
            raise ValueError(f"duplicate metric definitions for '{definition.name}'")
        registry[definition.name] = definition
        if definition.descriptive_rank is not None:
            prior = ranks.get(definition.descriptive_rank)
            if prior is not None:
                raise ValueError(
                    f"metrics '{prior.name}' and '{definition.name}' share descriptive_rank "
                    f"{definition.descriptive_rank}"
                )
            ranks[definition.descriptive_rank] = definition

    for definition in definitions:
        if definition.alias_of is None:
            continue
        target = registry.get(definition.alias_of)
        if target is None:
            raise ValueError(
                f"alias '{definition.name}' targets unregistered metric '{definition.alias_of}'"
            )
        if target.alias_of is not None:
            raise ValueError(
                f"alias '{definition.name}' must target a non-alias metric '{definition.alias_of}'"
            )
        for field_name in (
            "unit",
            "direction",
            "aggregation",
            "availability",
            "absent_when",
        ):
            if getattr(definition, field_name) != getattr(target, field_name):
                raise ValueError(
                    f"metric '{target.name}' disagrees with alias '{definition.name}' on "
                    f"{field_name}"
                )
    return MappingProxyType(registry)


_DEFINITIONS: tuple[MetricDefinition, ...] = (
    MetricDefinition(
        name="requests.total",
        unit="requests",
        direction=MetricDirection.NEUTRAL,
        population="every request on the demand trace within the horizon",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        # The tape is shared by both arms, so its paired delta is zero by construction.
        descriptive_rank=None,
    ),
    MetricDefinition(
        name="requests.served",
        unit="requests",
        direction=MetricDirection.HIGHER_IS_BETTER,
        population="requests that reached COMPLETED",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        descriptive_rank=20,
    ),
    MetricDefinition(
        name="requests.unserved",
        unit="requests",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="requests that reached UNSERVED (max-wait timeout)",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        descriptive_rank=30,
    ),
    MetricDefinition(
        name="unserved.fraction",
        unit="fraction",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="unserved requests over all requests; 0.0 when there are no requests",
        aggregation=MetricAggregation.FRACTION,
        availability=Availability.ALWAYS,
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        # Today's descriptive tuple never lists this metric.
        descriptive_rank=None,
    ),
    MetricDefinition(
        name="fleet.utilization_fraction",
        unit="fraction",
        # Over-utilization is a degradation; the model cannot support a direction.
        direction=MetricDirection.NEUTRAL,
        population=(
            "vehicle busy seconds (assignment to drop-off; service time excluded) over "
            "horizon times fleet size"
        ),
        aggregation=MetricAggregation.FRACTION,
        availability=Availability.ALWAYS,
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        descriptive_rank=40,
    ),
    MetricDefinition(
        name="business_proxy.served_trips",
        unit="requests",
        direction=MetricDirection.HIGHER_IS_BETTER,
        population="same as requests.served",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        # Business proxies are not service metrics for an operator surface.
        surfaces=(Surface.EXPERIMENT,),
        alias_of="requests.served",
        descriptive_rank=60,
    ),
    MetricDefinition(
        name="business_proxy.unserved_demand",
        unit="requests",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="same as requests.unserved",
        aggregation=MetricAggregation.COUNT,
        availability=Availability.ALWAYS,
        # Business proxies are not service metrics for an operator surface.
        surfaces=(Surface.EXPERIMENT,),
        alias_of="requests.unserved",
        descriptive_rank=70,
    ),
    MetricDefinition(
        name="wait.p50_s",
        unit="s",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="pickup minus request time over completed requests with a recorded pickup",
        aggregation=MetricAggregation.P50,
        availability=Availability.CONDITIONAL,
        absent_when="no request completed with a recorded pickup time",
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        descriptive_rank=10,
    ),
    MetricDefinition(
        name="wait.p90_s",
        unit="s",
        direction=MetricDirection.LOWER_IS_BETTER,
        population="same population as wait.p50_s",
        aggregation=MetricAggregation.P90,
        availability=Availability.CONDITIONAL,
        absent_when="no request completed with a recorded pickup time",
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        # Today's descriptive tuple never lists this metric.
        descriptive_rank=None,
    ),
    MetricDefinition(
        name="depot.queue_p90_s",
        unit="s",
        direction=MetricDirection.LOWER_IS_BETTER,
        population=(
            "seconds a vehicle waited between entering the service queue and a bay starting "
            "service"
        ),
        aggregation=MetricAggregation.P90,
        availability=Availability.CONDITIONAL,
        absent_when="no vehicle queued for a service bay",
        surfaces=(Surface.EXPERIMENT, Surface.OPERATOR),
        descriptive_rank=50,
    ),
)

METRIC_REGISTRY: Mapping[str, MetricDefinition] = _build_registry(_DEFINITIONS)


def resolve(name: str) -> MetricDefinition:
    """Return a registered definition, or fail with all usable registered names."""
    try:
        return METRIC_REGISTRY[name]
    except KeyError as exc:
        raise UnknownMetricError(name) from exc


def names_for_surface(surface: Surface) -> tuple[str, ...]:
    """Return registered metric names visible on a surface, in producer order."""
    return tuple(
        name for name, definition in METRIC_REGISTRY.items() if surface in definition.surfaces
    )


def descriptive_metric_names() -> tuple[str, ...]:
    """Return descriptive metric names in their independently declared record order."""
    ranked = [
        definition
        for definition in METRIC_REGISTRY.values()
        if definition.descriptive_rank is not None
    ]
    return tuple(
        definition.name for definition in sorted(ranked, key=lambda item: item.descriptive_rank)
    )


def definitions() -> tuple[MetricDefinition, ...]:
    """Return every metric definition in producer registration order."""
    return tuple(METRIC_REGISTRY.values())
