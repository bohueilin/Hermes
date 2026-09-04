"""Strict, bounded authoring and record-loading boundaries for FleetLab experiments."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from hermes.evidence.canonical import canonical_json_bytes
from hermes.fleet.contracts import DecisionRecord, ExperimentSpec
from hermes.fleet.metrics import METRIC_REGISTRY_VERSION
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_SPEC_BYTES = 1_048_576

_FIELD_PREFIX = re.compile(r"^([A-Za-z_][\w.\[\]]*): (.+)$", re.DOTALL)
_LINE_BREAK_ESCAPES = str.maketrans(
    {
        "\n": r"\n",
        "\r": r"\r",
        "\v": r"\v",
        "\f": r"\f",
        "\x1c": r"\x1c",
        "\x1d": r"\x1d",
        "\x1e": r"\x1e",
        "\x85": r"\x85",
        "\u2028": r"\u2028",
        "\u2029": r"\u2029",
    }
)


def _one_physical_line(value: str) -> str:
    """Escape every Unicode line boundary without changing the stored error attributes."""
    return value.translate(_LINE_BREAK_ESCAPES)


class SpecAuthoringError(ValueError):
    """Actionable, field-specific error at a FleetLab authoring boundary."""

    def __init__(
        self,
        *,
        what: str,
        why: str,
        fix: str,
        field: str,
        source: str,
    ) -> None:
        self.what = what
        self.why = why
        self.fix = fix
        self.field = field
        self.source = source
        super().__init__(str(self))

    def __str__(self) -> str:
        return "\n".join(
            (
                f"INVALID_EXPERIMENT_SPEC: {_one_physical_line(self.what)}",
                "WHAT FAILED:  experiment spec validation "
                f"({_one_physical_line(self.source)})",
                f"WHY:          {_one_physical_line(self.why)}",
                f"HOW TO FIX:   {_one_physical_line(self.fix)}",
                f"WHICH CONFIG FIELD:  {_one_physical_line(self.field)}",
            )
        )


def _field_path(location: tuple[Any, ...]) -> str:
    path = ""
    for part in location:
        if isinstance(part, int):
            path += f"[{part}]"
        elif path:
            path += f".{part}"
        else:
            path = str(part)
    return path or "<document>"


def _validation_parts(item: dict[str, Any]) -> tuple[str, str]:
    message = str(item["msg"])
    if message.startswith("Value error, "):
        message = message.removeprefix("Value error, ")
    prefixed = _FIELD_PREFIX.match(message)
    if prefixed is not None:
        return prefixed.groups()
    return _field_path(tuple(item["loc"])), message


def _validation_authoring_error(
    error: ValidationError,
    *,
    source: str,
    subject: str,
) -> SpecAuthoringError:
    errors = error.errors(include_url=False, include_context=False)
    field, detail = _validation_parts(errors[0])

    why, separator, fix = detail.partition(" Fix: ")
    if not separator:
        fix = f"correct {field} and validate the {subject} again"

    remaining_fields = [_validation_parts(item)[0] for item in errors[1:]]
    additional = (
        f" (additional invalid fields: {', '.join(remaining_fields)})"
        if remaining_fields
        else ""
    )
    return SpecAuthoringError(
        what=f"{field} {why}{additional}",
        why=why,
        fix=fix,
        field=field,
        source=source,
    )


def parse_experiment_spec_yaml(
    text: str,
    *,
    source: str = "<text>",
) -> ExperimentSpec:
    """Parse one already-bounded strict YAML document through Pydantic JSON mode."""
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise SpecAuthoringError(
            what="experiment spec YAML is malformed",
            why=str(exc),
            fix="use a mapping with unique string keys and no YAML anchors or aliases",
            field="<document>",
            source=source,
        ) from exc
    try:
        return ExperimentSpec.model_validate_json(canonical_json_bytes(payload))
    except ValidationError as exc:
        raise _validation_authoring_error(
            exc,
            source=source,
            subject="experiment spec",
        ) from exc
    except (TypeError, ValueError) as exc:
        raise SpecAuthoringError(
            what="experiment spec cannot be canonicalized",
            why=str(exc),
            fix="use finite JSON-compatible scalar, mapping, and sequence values",
            field="<document>",
            source=source,
        ) from exc


def _bounded_source(path: Path, *, subject: str) -> Path:
    given = str(path)
    try:
        source = path.expanduser().resolve()
    except (OSError, RuntimeError) as exc:
        raise SpecAuthoringError(
            what=f"cannot resolve {subject} {given}",
            why=str(exc),
            fix="provide a path that can be expanded and resolved",
            field="<document>",
            source=given,
        ) from exc
    try:
        size = source.stat().st_size
    except OSError as exc:
        raise SpecAuthoringError(
            what=f"cannot read {subject} {given}",
            why=str(exc),
            fix="provide an existing readable file",
            field="<document>",
            source=given,
        ) from exc
    if size > MAX_SPEC_BYTES:
        raise SpecAuthoringError(
            what=f"{subject} {given} exceeds the maximum size",
            why=f"the file is {size} bytes; the limit is {MAX_SPEC_BYTES} bytes",
            fix=f"reduce the file to at most {MAX_SPEC_BYTES} bytes",
            field="<document>",
            source=given,
        )
    return source


def load_experiment_spec(path: Path) -> ExperimentSpec:
    """Load one bounded UTF-8 experiment spec while preserving its given source name."""
    source = _bounded_source(path, subject="experiment spec")
    try:
        text = source.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise SpecAuthoringError(
            what=f"experiment spec {path} is not valid UTF-8",
            why=str(exc),
            fix="encode the experiment spec as UTF-8",
            field="<document>",
            source=str(path),
        ) from exc
    except OSError as exc:
        raise SpecAuthoringError(
            what=f"cannot read experiment spec {path}",
            why=str(exc),
            fix="provide an existing readable file",
            field="<document>",
            source=str(path),
        ) from exc
    return parse_experiment_spec_yaml(text, source=str(path))


def render_experiment_template(spec: ExperimentSpec) -> str:
    """Render a complete strict-YAML template from a validated experiment spec."""
    header = (
        "# Hermes FleetLab experiment template\n"
        f"# Metric registry: {METRIC_REGISTRY_VERSION}\n"
        "# Every field is a preregistered, synthetic, uncalibrated input; simulation only.\n"
    )
    return header + yaml.safe_dump(
        spec.model_dump(mode="json"),
        sort_keys=False,
        allow_unicode=True,
    )


def load_decision_record(path: Path) -> DecisionRecord:
    """Load and validate a bounded stored decision record without trusting its filename."""
    source = _bounded_source(path, subject="decision record")
    try:
        data = source.read_bytes()
    except OSError as exc:
        raise SpecAuthoringError(
            what=f"cannot read decision record {path}",
            why=str(exc),
            fix="provide an existing readable file",
            field="<document>",
            source=str(path),
        ) from exc
    try:
        return DecisionRecord.model_validate_json(data)
    except ValidationError as exc:
        error = _validation_authoring_error(
            exc,
            source=str(path),
            subject="decision record",
        )
        raise SpecAuthoringError(
            what=f"decision record {path} is invalid: {error.what}",
            why=error.why,
            fix=error.fix,
            field=error.field,
            source=str(path),
        ) from exc
