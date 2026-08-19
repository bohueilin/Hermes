"""Pure Cartesian-grid materializer for the Phase 7 declared-question protocol.

The materializer is an authoring-time compiler. It reads a repository-external
authoring draft plus one reviewed scenario template, renders every declared grid
variant deterministically, and emits a strict :class:`StudyProtocol` whose frozen
``variants`` table binds the exact bytes, scenario digest, and adapter-config
digest each variant will produce.

Freezing the complete table before discovery is what prevents cherry-picking: the
search space is cryptographically fixed, so a later run cannot quietly become a
different experiment.

Hard boundaries: no simulator import or launch, no network, no subprocess, no
mutation of tracked source. Rendering replaces only the five closed grid fields on
a fully validated template and revalidates the result.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Annotated, Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from hermes.adapters.metadrive_config import (
    ADAPTER_EVIDENCE_CONFIG_PROJECTION,
    metadrive_adapter_version,
    preview_metadrive_adapter_evidence_config,
)
from hermes.adequacy.models import (
    GRID_PARAMETER_ORDER,
    GRID_PARAMETER_SCENARIO_FIELDS,
    GridAssignment,
    GridDimension,
    MaterializedVariantBinding,
    MaterializerFieldMapping,
    MaterializerSpecification,
    MaterializerTemplate,
    StudyProtocol,
    canonical_adequacy_json_bytes,
    validate_grid_value,
)
from hermes.domain.models import ScenarioDefinition
from hermes.evidence.canonical import canonical_json_bytes
from hermes.scenarios.loader import resolved_scenario_yaml, scenario_digest

MAX_GRID_VARIANTS = 1024
OUTPUT_SERIALIZATION = "HERMES_RESOLVED_SCENARIO_YAML_UTF8_LF_V1"
PROTOCOL_SERIALIZATION = "HERMES_EVALUATION_PROTOCOL_YAML_UTF8_LF_V1"
MATERIALIZER_ALGORITHM = "STRICT_EXISTING_SCALAR_REPLACEMENT_V1"
MATERIALIZER_VERSION = "2.0"


class MaterializationError(ValueError):
    """A typed authoring failure that never reaches the portable assessment path."""


class _DraftModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)


class GridDimensionDraft(_DraftModel):
    parameter: Literal[
        "initial_gap_m",
        "actor_speed_mps",
        "trigger_step",
        "brake_duration_steps",
        "recovery_throttle",
    ]
    values: Annotated[tuple[int | float, ...], Field(min_length=1)]


class StudyProtocolAuthoringDraft(_DraftModel):
    """Private authoring input. Never a valid adequacy plan and never registered."""

    draft_schema_version: Literal["1.0"]
    template_repository_relative_path: str
    baseline_grid: Annotated[tuple[GridDimensionDraft, ...], Field(min_length=1)]
    protocol_body: dict[str, Any]

    @model_validator(mode="after")
    def require_complete_ordered_grid(self) -> StudyProtocolAuthoringDraft:
        parameters = tuple(dimension.parameter for dimension in self.baseline_grid)
        if parameters != GRID_PARAMETER_ORDER:
            raise MaterializationError(
                "authoring draft must declare every grid parameter exactly once in frozen order"
            )
        for dimension in self.baseline_grid:
            if len(set(dimension.values)) != len(dimension.values):
                raise MaterializationError(
                    f"grid parameter {dimension.parameter} repeats a value"
                )
            for value in dimension.values:
                validate_grid_value(dimension.parameter, value)
        return self


@dataclass(frozen=True, slots=True)
class MaterializedVariant:
    """One rendered grid point plus the exact bytes a discovery run will consume."""

    binding: MaterializedVariantBinding
    scenario: ScenarioDefinition
    scenario_bytes: bytes


@dataclass(frozen=True, slots=True)
class MaterializationResult:
    """The compiled protocol plus every rendered variant, ready for review."""

    protocol: StudyProtocol
    protocol_yaml_bytes: bytes
    protocol_byte_digest_sha256: str
    protocol_semantic_digest_sha256: str
    variants: tuple[MaterializedVariant, ...]


def serialize_scenario(scenario: ScenarioDefinition) -> bytes:
    """Serialize one resolved scenario through the single deterministic serializer."""
    text = resolved_scenario_yaml(scenario)
    if not text.endswith("\n"):
        text = f"{text}\n"
    if "\r" in text:
        raise MaterializationError("resolved scenario YAML must use LF line endings")
    return text.encode("utf-8")


def serialize_protocol(protocol: StudyProtocol) -> bytes:
    """Serialize the final protocol with the frozen plan-YAML contract."""
    # Decode with json, not yaml: canonical JSON prints small floats as `1e-05`, and
    # YAML 1.1 requires a dot in exponential floats, so yaml.safe_load would silently
    # turn them into strings - producing an unloadable protocol and a semantic digest
    # that cannot be reproduced.
    payload = json.loads(canonical_adequacy_json_bytes(protocol).decode("utf-8"))
    text = yaml.safe_dump(
        payload,
        allow_unicode=True,
        sort_keys=True,
        default_flow_style=False,
        indent=2,
        width=4096,
        line_break="\n",
        explicit_start=False,
        explicit_end=False,
    )
    if not text.endswith("\n"):
        text = f"{text}\n"
    if "\r" in text:
        raise MaterializationError("protocol YAML must use LF line endings")
    return text.encode("utf-8")


def _require_supported_template(template: ScenarioDefinition) -> None:
    if template.schema_version != "2.0":
        raise MaterializationError("template must use scenario schema 2.0")
    if template.adapter != "metadrive":
        raise MaterializationError("template must use the metadrive adapter")
    if template.challenge is None or template.challenge.kind != "lead_vehicle_hard_brake":
        raise MaterializationError("template must declare a lead_vehicle_hard_brake challenge")
    if template.faults is not None:
        raise MaterializationError("template must not declare a fault profile")


def render_variant(
    template: ScenarioDefinition,
    assignments: tuple[GridAssignment, ...],
) -> ScenarioDefinition:
    """Return a fully revalidated scenario with only the five closed fields replaced."""
    challenge_updates: dict[str, Any] = {}
    for assignment in assignments:
        field_path = GRID_PARAMETER_SCENARIO_FIELDS[assignment.parameter]
        prefix, _, field_name = field_path.partition(".")
        if prefix != "challenge" or not field_name:
            raise MaterializationError(f"unsupported scenario field {field_path}")
        assert template.challenge is not None
        if not hasattr(template.challenge, field_name):
            raise MaterializationError(
                f"template challenge has no existing field {field_name}"
            )
        challenge_updates[field_name] = assignment.value
    assert template.challenge is not None
    challenge = type(template.challenge).model_validate(
        {**template.challenge.model_dump(mode="python"), **challenge_updates}
    )
    return ScenarioDefinition.model_validate(
        {**template.model_dump(mode="python"), "challenge": challenge.model_dump(mode="python")}
    )


def materialize(
    draft: StudyProtocolAuthoringDraft,
    template_bytes: bytes,
    template: ScenarioDefinition,
    *,
    simulator_version: str,
    simulator_commit: str,
) -> MaterializationResult:
    """Compile one authoring draft and reviewed template into a frozen protocol."""
    _require_supported_template(template)
    if b"\r" in template_bytes:
        raise MaterializationError("template bytes must use LF line endings")

    dimensions = tuple(
        GridDimension(
            parameter=dimension.parameter,
            scenario_field=GRID_PARAMETER_SCENARIO_FIELDS[dimension.parameter],
            values=dimension.values,
        )
        for dimension in draft.baseline_grid
    )
    total = 1
    for dimension in dimensions:
        total *= len(dimension.values)
    if total > MAX_GRID_VARIANTS:
        raise MaterializationError(
            f"declared grid expands to {total} variants above the {MAX_GRID_VARIANTS} bound"
        )

    body = dict(draft.protocol_body)
    seed = body["planned_execution"]["seed"]

    combinations: list[tuple[GridAssignment, ...]] = [()]
    for dimension in dimensions:
        combinations = [
            (*prefix, GridAssignment(parameter=dimension.parameter, value=value))
            for prefix in combinations
            for value in dimension.values
        ]

    variants: list[MaterializedVariant] = []
    for index, assignments in enumerate(combinations):
        scenario = render_variant(template, assignments)
        scenario_bytes = serialize_scenario(scenario)
        adapter_config = preview_metadrive_adapter_evidence_config(
            scenario,
            seed,
            simulator_version,
            simulator_commit,
        )
        binding = MaterializedVariantBinding(
            grid_index=index,
            variant_id=f"grid-{index:04d}",
            parameters=assignments,
            scenario_byte_digest_sha256=hashlib.sha256(scenario_bytes).hexdigest(),
            scenario_digest_sha256=scenario_digest(scenario),
            adapter_config_digest_sha256=hashlib.sha256(
                canonical_json_bytes(adapter_config)
            ).hexdigest(),
        )
        variants.append(
            MaterializedVariant(
                binding=binding, scenario=scenario, scenario_bytes=scenario_bytes
            )
        )

    specification = MaterializerSpecification(
        version=MATERIALIZER_VERSION,
        algorithm=MATERIALIZER_ALGORITHM,
        output_serialization=OUTPUT_SERIALIZATION,
        protocol_serialization=PROTOCOL_SERIALIZATION,
        adapter_config_projection=ADAPTER_EVIDENCE_CONFIG_PROJECTION,
        template=MaterializerTemplate(
            repository_relative_path=draft.template_repository_relative_path,
            byte_digest_sha256=hashlib.sha256(template_bytes).hexdigest(),
            scenario_digest_sha256=scenario_digest(template),
        ),
        mappings=tuple(
            MaterializerFieldMapping(
                parameter=parameter,
                scenario_field=GRID_PARAMETER_SCENARIO_FIELDS[parameter],
            )
            for parameter in GRID_PARAMETER_ORDER
        ),
        variants=tuple(variant.binding for variant in variants),
    )

    expected_components = dict(body["expected_components"])
    adapter_expectation = dict(expected_components["adapter"])
    adapter_expectation["version"] = metadrive_adapter_version(template)
    expected_components["adapter"] = adapter_expectation

    # Validate through canonical JSON so the compiler accepts exactly what the
    # portable loader later accepts, rather than a looser in-memory shape.
    protocol = StudyProtocol.model_validate_json(
        canonical_json_bytes(
            {
                **body,
                "schema_version": "2.0",
                "baseline_grid": [
                    dimension.model_dump(mode="json") for dimension in dimensions
                ],
                "materializer": specification.model_dump(mode="json"),
                "expected_components": expected_components,
            }
        )
    )
    protocol_yaml = serialize_protocol(protocol)
    return MaterializationResult(
        protocol=protocol,
        protocol_yaml_bytes=protocol_yaml,
        protocol_byte_digest_sha256=hashlib.sha256(protocol_yaml).hexdigest(),
        protocol_semantic_digest_sha256=hashlib.sha256(
            canonical_adequacy_json_bytes(protocol)
        ).hexdigest(),
        variants=tuple(variants),
    )
