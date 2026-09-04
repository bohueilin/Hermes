"""Typed FleetLab metric definitions.

The registry is the contract every producer and consumer resolves through. Import direction is
``contracts -> metrics``; this module never imports FleetLab contracts.
"""

from __future__ import annotations

from enum import StrEnum
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
