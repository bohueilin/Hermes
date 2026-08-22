"""Strict, bounded gate configuration with no executable operators."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from hermes.evidence.canonical import canonical_json_bytes
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_GATE_CONFIG_BYTES = 1_048_576


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)


class HardCriteria(_StrictModel):
    max_collision_count: Literal[0]
    max_abs_lateral_offset_m: Annotated[float, Field(gt=0.0, le=10.0)]
    max_offroad_duration_s: Literal[0.0]
    min_route_completion_pct: Annotated[float, Field(ge=0.0, le=100.0)]
    missing_required_evidence: Literal["HOLD", "INVALID_EVIDENCE"]


class SoftCriteria(_StrictModel):
    max_abs_acceleration_mps2: Annotated[float, Field(gt=0.0, le=30.0)]
    max_abs_jerk_mps3: Annotated[float, Field(gt=0.0, le=500.0)]


class AdasCriteria(_StrictModel):
    """Oracle thresholds for the ADAS dimensions, introduced by gate-config schema 2.0.

    These are deliberately the *gate's* thresholds, not the controller's. If the evaluator
    reused the controller's configured trigger points it would only ever confirm that the
    controller did what it was configured to do. Judging a run means asking an independent
    question: given the closing geometry the trace records, should something have happened,
    and did it happen soon enough?
    """

    #: A threat is oracle-labelled once required deceleration reaches this fraction of the
    #: scenario's braking authority. Set below the controller's own partial-brake fraction
    #: so a controller that intervenes exactly at its threshold is still judged in time.
    threat_authority_fraction: Annotated[float, Field(gt=0.0, le=1.0)] = 0.3
    #: Fraction of braking authority the required deceleration may already consume at the
    #: first brake command.
    #:
    #: Physically grounded rather than tuned: at 1.0 the criterion is "braking began while
    #: stopping was still achievable with the brakes this vehicle has". A controller that
    #: first brakes when a_req already exceeds its authority waited past the point of
    #: avoidance, whether or not it happened to get away with it. Expressing it this way
    #: also makes it speed-independent, which a fixed TTC threshold is not.
    onset_authority_fraction: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    #: Residual impact speed permitted where avoidance is kinematically infeasible.
    max_residual_impact_speed_mps: Annotated[float, Field(ge=0.0, le=30.0)] = 0.0
    #: Braking commands allowed in an oracle-labelled threat-free scenario.
    max_false_intervention_steps: Annotated[int, Field(ge=0, le=1_000)] = 0
    #: Standoff used when the oracle recomputes required deceleration from the trace.
    oracle_standoff_m: Annotated[float, Field(ge=0.0, le=20.0)] = 2.0


class GateConfig(_StrictModel):
    schema_version: Literal["1.0", "2.0"]
    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    version: Annotated[str, Field(min_length=1, max_length=32)]
    label: Literal["illustrative_prototype_thresholds_not_for_real_vehicle_use"]
    hard: HardCriteria
    soft: SoftCriteria
    adas: AdasCriteria | None = None

    @model_validator(mode="after")
    def require_adas_criteria_only_at_schema_2(self) -> GateConfig:
        if self.schema_version == "1.0" and self.adas is not None:
            raise ValueError("gate-config schema_version 1.0 cannot define adas criteria")
        if self.schema_version == "2.0" and self.adas is None:
            raise ValueError("gate-config schema_version 2.0 requires adas criteria")
        return self


class GateConfigError(ValueError):
    """Actionable gate-configuration parsing or validation failure."""


def parse_gate_config_yaml(text: str) -> GateConfig:
    """Parse one already-bounded UTF-8 gate-configuration snapshot."""
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise GateConfigError(f"gate configuration YAML is malformed: {exc}") from exc
    try:
        return GateConfig.model_validate(payload)
    except ValidationError as exc:
        raise GateConfigError(f"gate configuration validation failed: {exc}") from exc


def load_gate_config(path: Path) -> GateConfig:
    source = path.expanduser().resolve()
    try:
        size = source.stat().st_size
    except OSError as exc:
        raise GateConfigError(f"cannot read gate configuration {source}: {exc}") from exc
    if size > MAX_GATE_CONFIG_BYTES:
        raise GateConfigError(
            f"gate configuration exceeds maximum size of {MAX_GATE_CONFIG_BYTES} bytes: {size}"
        )
    try:
        text = source.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise GateConfigError(f"gate configuration is not valid UTF-8: {exc}") from exc
    except StrictYamlError as exc:
        raise GateConfigError(f"gate configuration YAML is malformed: {exc}") from exc
    except OSError as exc:
        raise GateConfigError(f"cannot read gate configuration {source}: {exc}") from exc
    return parse_gate_config_yaml(text)


#: Fields introduced by gate-config schema 2.0.
#:
#: gate_config_digest hashes model_dump(), and that digest is bound into every trace event's
#: run context and re-derived during verification. A schema-2.0 field reaching the payload of
#: a schema-1.0 configuration therefore changes its digest and invalidates every bundle ever
#: produced with it - observed as "gate configuration digest does not match trace context".
#: This mirrors the same rule for scenarios in hermes.scenarios.loader.
_SCHEMA_2_ONLY_FIELDS = ("adas",)


def _resolved_gate_config_payload(config: GateConfig) -> dict[str, object]:
    """Return schema-aware content without changing established schema-1.0 identities."""
    resolved = config.model_dump(mode="json")
    if config.schema_version != "2.0":
        for field_name in _SCHEMA_2_ONLY_FIELDS:
            resolved.pop(field_name)
    return resolved


def gate_config_digest(config: GateConfig) -> str:
    return hashlib.sha256(
        canonical_json_bytes(_resolved_gate_config_payload(config))
    ).hexdigest()


def resolved_gate_config_yaml(config: GateConfig) -> str:
    return yaml.safe_dump(
        _resolved_gate_config_payload(config), allow_unicode=True, sort_keys=True
    )
