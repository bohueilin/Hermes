"""Validated loopback-only launcher for the optional Streamlit workbench."""

from __future__ import annotations

import importlib.util
import ipaddress
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from hermes.review import validate_artifact_root

ProcessRunner = Callable[[tuple[str, ...]], int]


def _validate_loopback_host(host: str) -> str:
    """Return a canonical numeric loopback literal or fail closed."""

    if not isinstance(host, str):
        raise ValueError("workbench host must be a numeric loopback address")
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError("workbench host must be a numeric loopback address") from exc
    if not address.is_loopback:
        raise ValueError("workbench host must be a numeric loopback address")
    return str(address)


def _validate_port(port: int) -> int:
    """Return a valid explicit TCP port."""

    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError("workbench port must be an integer from 1 through 65535")
    return port


def _installed_app_path() -> Path:
    candidate = Path(__file__).with_name("app.py")
    if candidate.is_symlink():
        raise ValueError("workbench application is unavailable")
    try:
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ValueError("workbench application is unavailable") from exc
    if not resolved.is_file():
        raise ValueError("workbench application is unavailable")
    return resolved


def _build_streamlit_argv(
    artifact_root: Path,
    *,
    host: str,
    port: int,
    no_browser: bool,
) -> tuple[str, ...]:
    """Validate launch configuration and build the only supported child command."""

    validated_host = _validate_loopback_host(host)
    validated_port = _validate_port(port)
    validated_root = validate_artifact_root(artifact_root)
    app_path = _installed_app_path()
    if importlib.util.find_spec("streamlit") is None:
        raise ValueError(
            "Streamlit is unavailable; install Hermes with the .[workbench] extra"
        )
    return (
        sys.executable,
        "-m",
        "streamlit",
        "run",
        str(app_path),
        "--server.address",
        validated_host,
        "--server.port",
        str(validated_port),
        "--server.headless",
        "true" if no_browser else "false",
        "--browser.gatherUsageStats",
        "false",
        "--",
        "--artifact-root",
        str(validated_root),
    )


def _run_process(argv: tuple[str, ...]) -> int:
    return subprocess.run(list(argv), check=False).returncode


def launch_workbench(
    artifact_root: Path,
    *,
    host: str = "127.0.0.1",
    port: int = 8501,
    no_browser: bool = False,
    _process_runner: ProcessRunner | None = None,
) -> int:
    """Launch the read-only workbench after validating every local boundary."""

    argv = _build_streamlit_argv(
        artifact_root,
        host=host,
        port=port,
        no_browser=no_browser,
    )
    runner = _run_process if _process_runner is None else _process_runner
    return runner(argv)
