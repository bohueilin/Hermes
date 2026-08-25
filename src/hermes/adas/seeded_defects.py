"""Seeded policy or environment failures that the evaluation must catch.

A release gate that has never failed is indistinguishable from one that cannot fail. This
suite is the acceptance criterion for the evaluation itself: each entry pairs a deliberately
seeded policy or environment failure with the scenario that exposes it, the finding that
must catch it, and the failure category triage must propose.

It also turns agent quality into a number. "The triage agent is helpful" is an opinion;
"the triage agent proposed the correct category for every seeded failure" is a metric, and it
is computed deterministically from stored evidence rather than from a human's impression.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, ValidationError, field_validator

from hermes.domain.models import HermesModel
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml


class SeededDefectError(ValueError):
    """Actionable seeded-defect suite parsing or validation failure."""


class SeededDefect(HermesModel):
    """One deliberately seeded policy or environment failure and its expected detection."""

    defect_id: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    description: Annotated[str, Field(min_length=1, max_length=200)]
    policy_config: Annotated[str, Field(min_length=1, max_length=200)]
    scenario: Annotated[str, Field(min_length=1, max_length=200)]
    expected_failing_finding: Annotated[str, Field(min_length=1, max_length=64)]
    expected_triage_category: Annotated[str, Field(pattern=r"^[A-Z][A-Z_]{0,63}$")]


class SeededDefectSuite(HermesModel):
    schema_version: Literal["1.0"]
    label: Literal[
        "deliberately_seeded_policy_or_environment_failures_for_evaluation_acceptance"
    ]
    defects: tuple[SeededDefect, ...]

    @field_validator("defects", mode="before")
    @classmethod
    def normalize_yaml_sequence(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value


def load_seeded_defects(path: Path) -> SeededDefectSuite:
    """Load the committed seeded-defect suite."""
    try:
        payload = load_strict_yaml(path.read_text(encoding="utf-8"))
    except (OSError, StrictYamlError) as exc:
        raise SeededDefectError(f"seeded-defect suite is unreadable: {exc}") from exc
    try:
        return SeededDefectSuite.model_validate(payload)
    except ValidationError as exc:
        raise SeededDefectError(f"seeded-defect suite is invalid: {exc}") from exc
