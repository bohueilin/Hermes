"""Loopback-only Streamlit wrapper for one static FleetLab operator projection."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from hermes.fleet.operator_projection import demo_run, render_rows
from hermes.workbench.launcher import _validate_loopback_host, _validate_port

ProcessRunner = Callable[[tuple[str, ...]], int]


def build_streamlit_argv(*, host: str, port: int, no_browser: bool) -> tuple[str, ...]:
    """Validate a local-only launch and form the fixed Streamlit child command."""

    validated_host = _validate_loopback_host(host)
    validated_port = _validate_port(port)
    if importlib.util.find_spec("streamlit") is None:
        raise ValueError("Streamlit is unavailable; install Hermes with the .[workbench] extra")
    return (
        sys.executable,
        "-m",
        "streamlit",
        "run",
        str(Path(__file__).resolve()),
        "--server.address",
        validated_host,
        "--server.port",
        str(validated_port),
        "--server.headless",
        "true" if no_browser else "false",
        "--browser.gatherUsageStats",
        "false",
    )


def launch_operator_view(
    *,
    host: str = "127.0.0.1",
    port: int = 8502,
    no_browser: bool = False,
    runner: ProcessRunner = subprocess.call,
) -> int:
    """Start the optional local view after all launch boundaries have been validated."""

    return runner(build_streamlit_argv(host=host, port=port, no_browser=no_browser))


def main() -> None:
    """Render one finished synthetic run; this page has no live controls or time axis."""

    import streamlit as st

    projection = demo_run()
    st.set_page_config(page_title="Hermes FleetLab operator view")
    st.title("FleetLab operator view")
    st.caption(
        " | ".join(projection.labels)
        + " | "
        + projection.scenario_label
        + " | "
        + projection.calibration_state.value
        + " | registry "
        + projection.metric_registry_version
        + " | tape "
        + projection.world_tape_digest[:12]
        + " | seed "
        + str(projection.seed)
    )
    st.dataframe(render_rows(projection))
    st.text("One finished synthetic run; this is not a live view.")


if __name__ == "__main__":
    main()
