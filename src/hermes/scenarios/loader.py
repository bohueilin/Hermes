"""Bounded YAML loading and canonical scenario identity."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import yaml
from pydantic import ValidationError

from hermes.domain.models import ScenarioDefinition
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_SCENARIO_BYTES = 1_048_576


class ScenarioLoadError(ValueError):
    """Actionable scenario parsing or validation failure."""


def _canonical_json_bytes(value: object) -> bytes:
    try:
        text = json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    except (TypeError, ValueError) as exc:
        raise ScenarioLoadError(f"scenario cannot be canonicalized: {exc}") from exc
    return text.encode("utf-8")


def _resolved_scenario_payload(scenario: ScenarioDefinition) -> dict[str, object]:
    """Return schema-aware content without changing established v1 identities."""
    resolved = scenario.model_dump(mode="json")
    if scenario.schema_version == "1.0":
        resolved.pop("challenge")
    if scenario.schema_version in {"1.0", "2.0"}:
        resolved.pop("faults")
    return resolved


def scenario_digest(scenario: ScenarioDefinition) -> str:
    """Return the SHA-256 identity of fully resolved scenario content."""
    resolved = _resolved_scenario_payload(scenario)
    return hashlib.sha256(_canonical_json_bytes(resolved)).hexdigest()


def parse_scenario_yaml(text: str) -> ScenarioDefinition:
    """Parse one already-bounded UTF-8 scenario snapshot."""
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise ScenarioLoadError(f"scenario YAML is malformed: {exc}") from exc
    try:
        return ScenarioDefinition.model_validate(payload)
    except ValidationError as exc:
        raise ScenarioLoadError(f"scenario validation failed: {exc}") from exc


def load_scenario(path: Path) -> ScenarioDefinition:
    """Load a bounded, strict scenario YAML document."""
    source = path.expanduser().resolve()
    try:
        size = source.stat().st_size
    except OSError as exc:
        raise ScenarioLoadError(f"cannot read scenario {source}: {exc}") from exc
    if size > MAX_SCENARIO_BYTES:
        raise ScenarioLoadError(
            f"scenario exceeds maximum size of {MAX_SCENARIO_BYTES} bytes: {size}"
        )
    try:
        text = source.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ScenarioLoadError(f"scenario is not valid UTF-8: {exc}") from exc
    except StrictYamlError as exc:
        raise ScenarioLoadError(f"scenario YAML is malformed: {exc}") from exc
    except OSError as exc:
        raise ScenarioLoadError(f"cannot read scenario {source}: {exc}") from exc
    return parse_scenario_yaml(text)


def resolved_scenario_yaml(scenario: ScenarioDefinition) -> str:
    """Serialize all explicit and defaulted scenario values deterministically."""
    return yaml.safe_dump(
        _resolved_scenario_payload(scenario),
        allow_unicode=True,
        sort_keys=True,
    )
