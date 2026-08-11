"""Strict, bounded gate configuration with no executable operators."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

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


class GateConfig(_StrictModel):
    schema_version: Literal["1.0"]
    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    version: Annotated[str, Field(min_length=1, max_length=32)]
    label: Literal["illustrative_prototype_thresholds_not_for_real_vehicle_use"]
    hard: HardCriteria
    soft: SoftCriteria


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


def gate_config_digest(config: GateConfig) -> str:
    return hashlib.sha256(canonical_json_bytes(config.model_dump(mode="json"))).hexdigest()


def resolved_gate_config_yaml(config: GateConfig) -> str:
    return yaml.safe_dump(config.model_dump(mode="json"), allow_unicode=True, sort_keys=True)
