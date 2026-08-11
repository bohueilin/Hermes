"""Stable human and JSON error envelopes for the Hermes CLI."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

import typer
from rich.console import Console

from hermes.evidence.canonical import canonical_json_bytes


class CliErrorCode(StrEnum):
    """Machine-stable failure categories independent of wording changes."""

    USAGE_ERROR = "USAGE_ERROR"
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"
    OPERATIONAL_ERROR = "OPERATIONAL_ERROR"
    INVALID_EVIDENCE = "INVALID_EVIDENCE"
    INCOMPATIBLE_EVIDENCE = "INCOMPATIBLE_EVIDENCE"


_HUMAN_LABELS = {
    CliErrorCode.USAGE_ERROR: "Usage error",
    CliErrorCode.CONFIGURATION_ERROR: "Configuration error",
    CliErrorCode.OPERATIONAL_ERROR: "Operational error",
    CliErrorCode.INVALID_EVIDENCE: "Invalid evidence",
    CliErrorCode.INCOMPATIBLE_EVIDENCE: "Incompatible evidence",
}


def cli_error_payload(
    code: CliErrorCode,
    message: str,
    exit_code: int,
    *,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the canonical error fields shared by every output mode."""
    payload: dict[str, Any] = {
        "error": code.value,
        "message": message,
        "exit_code": exit_code,
    }
    if details is not None:
        payload["details"] = details
    return payload


def render_cli_error(
    code: CliErrorCode,
    message: str,
    exit_code: int,
    *,
    details: dict[str, Any] | None = None,
    json_output: bool = False,
    console: Console | None = None,
) -> None:
    """Render an error without changing its category, message, or exit code."""
    payload = cli_error_payload(code, message, exit_code, details=details)
    if json_output:
        typer.echo(canonical_json_bytes(payload).decode("utf-8"))
        return
    output = console or Console(highlight=False, markup=False, soft_wrap=True)
    output.print(
        f"[{code.value}] {_HUMAN_LABELS[code]}: {message}",
        style="red",
    )
    output.print(f"Exit code: {exit_code}")
