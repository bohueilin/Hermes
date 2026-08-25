"""Loading an ADAS controller configuration from a committed file.

Making the controller's tunables a file rather than a constructor argument is what turns
"an ADAS function" into something a developer can discover, configure and integrate without
touching Hermes source - and it is what gives baseline-versus-candidate a declared variation
axis, since the file's content is exactly what ``policy_config_digest`` binds.

It is also what makes deliberately defective controllers expressible as data, so a suite can
prove the evaluation catches them.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import ValidationError

from hermes.adas.interfaces import AdasControllerConfig
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_CONTROLLER_CONFIG_BYTES = 1_048_576


class AdasConfigError(ValueError):
    """Actionable ADAS controller-configuration parsing or validation failure."""


def parse_adas_config_yaml(text: str) -> AdasControllerConfig:
    """Parse one already-bounded UTF-8 controller-configuration snapshot."""
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise AdasConfigError(f"ADAS controller configuration is malformed: {exc}") from exc
    try:
        return AdasControllerConfig.model_validate(payload)
    except ValidationError as exc:
        raise AdasConfigError(f"ADAS controller configuration is invalid: {exc}") from exc


def load_adas_config(path: Path) -> AdasControllerConfig:
    """Load a bounded, strict ADAS controller configuration."""
    source = path.expanduser()
    try:
        raw = source.read_bytes()
    except OSError as exc:
        raise AdasConfigError(f"cannot read ADAS controller configuration: {exc}") from exc
    if len(raw) > MAX_CONTROLLER_CONFIG_BYTES:
        raise AdasConfigError("ADAS controller configuration exceeds the supported size")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise AdasConfigError(
            f"ADAS controller configuration is not valid UTF-8: {exc}"
        ) from exc
    return parse_adas_config_yaml(text)
