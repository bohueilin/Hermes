"""Strict, versioned configuration for the deterministic Phase 3 shield."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from hermes.evidence.canonical import canonical_json_bytes
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_SHIELD_CONFIG_BYTES = 1_048_576


class ShieldConfig(BaseModel):
    """Illustrative simulation-only thresholds; never real-vehicle limits."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, allow_inf_nan=False)

    schema_version: Literal["1.0"]
    name: Literal["phase3_deterministic"]
    version: Literal["1.0"]
    label: Literal["illustrative_simulation_only_not_real_vehicle_limits"]
    ttc_threshold_s: Annotated[float, Field(gt=0.0, le=30.0)]
    speed_cap_mps: Annotated[float, Field(gt=0.0, le=50.0)]
    max_observation_age_s: Annotated[float, Field(ge=0.0, le=10.0)]
    boundary_margin_m: Annotated[float, Field(gt=0.0, le=5.0)]
    actuation_delay_compensation_s: Annotated[float, Field(ge=0.0, le=5.0)]
    emergency_stop_active: bool
    full_brake_command: Literal[1.0]
    boundary_steering_command: Annotated[float, Field(gt=0.0, le=1.0)]


class ShieldConfigError(ValueError):
    """The shield configuration cannot be parsed or safely applied."""


def parse_shield_config_yaml(text: str) -> ShieldConfig:
    """Parse strict YAML without aliases, duplicate keys, or unknown fields."""
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise ShieldConfigError(f"shield configuration YAML is malformed: {exc}") from exc
    try:
        return ShieldConfig.model_validate(payload)
    except ValidationError as exc:
        raise ShieldConfigError(f"shield configuration validation failed: {exc}") from exc


def load_shield_config(path: Path) -> ShieldConfig:
    """Load one bounded UTF-8 shield configuration."""
    source = path.expanduser().resolve()
    try:
        size = source.stat().st_size
    except OSError as exc:
        raise ShieldConfigError(f"cannot read shield configuration {source}: {exc}") from exc
    if size > MAX_SHIELD_CONFIG_BYTES:
        raise ShieldConfigError(
            f"shield configuration exceeds maximum size of {MAX_SHIELD_CONFIG_BYTES} bytes: "
            f"{size}"
        )
    try:
        text = source.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ShieldConfigError(
            f"shield configuration is not valid UTF-8: {exc}"
        ) from exc
    except OSError as exc:
        raise ShieldConfigError(f"cannot read shield configuration {source}: {exc}") from exc
    return parse_shield_config_yaml(text)


def shield_config_digest(config: ShieldConfig) -> str:
    """Return the canonical identity used by tests and review tooling."""
    return hashlib.sha256(
        canonical_json_bytes(config.model_dump(mode="json"))
    ).hexdigest()


def resolved_shield_config_yaml(config: ShieldConfig) -> str:
    """Render the complete deterministic configuration for review."""
    return yaml.safe_dump(config.model_dump(mode="json"), allow_unicode=True, sort_keys=True)
