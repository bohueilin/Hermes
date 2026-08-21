"""Bounded YAML loading and canonical scenario identity."""

from __future__ import annotations

import hashlib
from pathlib import Path

import yaml
from pydantic import ValidationError

from hermes.domain.models import ScenarioDefinition
from hermes.evidence.canonical import canonical_json_bytes
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_SCENARIO_BYTES = 1_048_576


class ScenarioLoadError(ValueError):
    """Actionable scenario parsing or validation failure."""


def _canonical_json_bytes(value: object) -> bytes:
    """Canonicalize scenario content with the repository's single serializer.

    This delegates to ``hermes.evidence.canonical`` rather than calling ``json.dumps``
    directly so that scenario identity obeys the same float rules as every other digest.
    A local copy without that normalization made ``scenario_digest`` sensitive to the sign
    of zero, splitting one scenario into two identities.
    """
    try:
        return canonical_json_bytes(value)
    except (TypeError, ValueError) as exc:
        raise ScenarioLoadError(f"scenario cannot be canonicalized: {exc}") from exc


#: Fields introduced by scenario schema 4.0.
#:
#: ``scenario_digest`` hashes ``model_dump()``, and the digest is recomputed during
#: re-verification and compared against the value stored in every bundle's run context.
#: A field that reaches the payload of an older scenario would therefore change that
#: scenario's identity and invalidate previously published evidence. Every schema-4.0
#: addition must be listed here.
_SCHEMA_4_ONLY_FIELDS = ("tags", "odd", "adas", "requirements")


def _resolved_scenario_payload(scenario: ScenarioDefinition) -> dict[str, object]:
    """Return schema-aware content without changing established v1 identities."""
    resolved = scenario.model_dump(mode="json")
    if scenario.schema_version == "1.0":
        resolved.pop("challenge")
    if scenario.schema_version in {"1.0", "2.0"}:
        resolved.pop("faults")
    if scenario.schema_version != "4.0":
        for field_name in _SCHEMA_4_ONLY_FIELDS:
            resolved.pop(field_name)
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
