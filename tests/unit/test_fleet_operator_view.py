"""Tests for the static, registry-driven FleetLab operator view."""

from __future__ import annotations

import ast
import importlib
import importlib.util
import subprocess
import sys
import textwrap
from pathlib import Path
from types import SimpleNamespace

import pytest
from tests.unit.test_fleet_analytical_fixture import _SCENARIO, _hand_written_tape
from tests.unit.test_fleet_contracts_and_world import small_scenario

import hermes.fleet.metrics as fleet_metrics
import hermes.fleet.operator_view as operator_view
from hermes.fleet.cli import fleet_005_spec
from hermes.fleet.contracts import REQUIRED_LABELS, CalibrationState
from hermes.fleet.engine import run_fleet, run_metrics
from hermes.fleet.experiment import run_experiment
from hermes.fleet.metrics import (
    METRIC_REGISTRY_VERSION,
    Surface,
    names_for_surface,
    resolve,
)
from hermes.fleet.operator_projection import demo_run, project_run, render_rows
from hermes.fleet.operator_view import build_streamlit_argv, main
from hermes.fleet.world import build_tape


def _projected_hand_written_run():
    scenario = small_scenario(**_SCENARIO)
    return project_run(
        scenario,
        CalibrationState.SYNTHETIC_UNCALIBRATED,
        run_metrics(run_fleet(scenario, _hand_written_tape())),
        seed=0,
        world_tape_digest="a" * 64,
    )


def test_every_displayed_unit_and_direction_comes_from_the_registry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    changed = resolve("wait.p90_s").model_copy(update={"unit": "furlongs"})
    monkeypatch.setattr(
        fleet_metrics,
        "METRIC_REGISTRY",
        {**fleet_metrics.METRIC_REGISTRY, "wait.p90_s": changed},
    )

    projection = _projected_hand_written_run()
    row = next(item for item in projection.rows if item.name == "wait.p90_s")

    assert row.unit == "furlongs"
    assert row.direction == changed.direction.value


def test_an_absent_metric_renders_its_declared_reason_never_zero_or_blank() -> None:
    scenario = small_scenario(trips_between_service=100)
    projection = project_run(
        scenario,
        CalibrationState.SYNTHETIC_UNCALIBRATED,
        run_metrics(run_fleet(scenario, build_tape(scenario, 0))),
        seed=0,
        world_tape_digest="a" * 64,
    )
    row = next(item for item in projection.rows if item.name == "depot.queue_p90_s")
    rendered = next(item for item in render_rows(projection) if item["Metric"] == row.name)

    assert row.status == "ABSENT"
    assert row.value is None
    assert row.absent_reason == resolve(row.name).absent_when
    assert rendered["Value"] == row.absent_reason
    assert rendered["Value"] not in {"0", "0.0", ""}
    assert rendered["Status"] == "ABSENT"


def test_a_zero_value_is_present_not_absent() -> None:
    row = next(
        item for item in _projected_hand_written_run().rows if item.name == "depot.queue_p90_s"
    )

    assert row.status == "PRESENT"
    assert row.value == 0.0
    assert row.absent_reason is None


def test_only_operator_surface_metrics_appear() -> None:
    projection = _projected_hand_written_run()

    assert tuple(row.name for row in projection.rows) == names_for_surface(Surface.OPERATOR)
    assert not any(row.name.startswith("business_proxy.") for row in projection.rows)


def test_a_missing_always_metric_is_an_error_not_a_blank_row() -> None:
    scenario = small_scenario(**_SCENARIO)
    metrics = run_metrics(run_fleet(scenario, _hand_written_tape()))
    metrics.pop("requests.total")

    with pytest.raises(ValueError, match="requests.total"):
        project_run(
            scenario,
            CalibrationState.SYNTHETIC_UNCALIBRATED,
            metrics,
            seed=0,
            world_tape_digest="a" * 64,
        )


def test_the_scenario_label_and_calibration_state_render() -> None:
    projection = _projected_hand_written_run()

    assert projection.scenario_label == (
        "synthetic_fleet_scenario_not_calibrated_to_any_real_operation"
    )
    assert projection.calibration_state is CalibrationState.SYNTHETIC_UNCALIBRATED
    assert projection.labels == REQUIRED_LABELS
    assert projection.metric_registry_version == METRIC_REGISTRY_VERSION


def test_the_demo_run_is_the_demo_baseline_arm() -> None:
    projection = demo_run()

    assert projection.world_tape_digest == run_experiment(fleet_005_spec()).world_tape_digest
    assert projection.seed == 101


def test_the_launcher_accepts_only_loopback_and_needs_streamlit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        operator_view.importlib.util,
        "find_spec",
        lambda name: SimpleNamespace(name=name) if name == "streamlit" else None,
    )
    for host in ("127.0.0.1", "127.7.8.9", "::1", "0:0:0:0:0:0:0:1"):
        argv = build_streamlit_argv(host=host, port=8502, no_browser=True)
        assert argv[0:4] == (sys.executable, "-m", "streamlit", "run")
        assert argv[4].endswith("operator_view.py")
        assert argv[-2:] == ("--browser.gatherUsageStats", "false")
    for host in ("0.0.0.0", "localhost", "example.com", "192.168.1.10", ""):
        with pytest.raises(ValueError, match="numeric loopback"):
            build_streamlit_argv(host=host, port=8502, no_browser=True)
    monkeypatch.setattr(operator_view.importlib.util, "find_spec", lambda name: None)
    with pytest.raises(ValueError, match=r"\.\[workbench\]"):
        build_streamlit_argv(host="127.0.0.1", port=8502, no_browser=True)


def test_the_view_is_static_and_read_only() -> None:
    paths = [
        Path(operator_view.__file__),
        Path(importlib.import_module("hermes.fleet.operator_projection").__file__),
    ]
    forbidden_modules = {"time", "datetime", "threading", "asyncio", "sched"}
    forbidden_calls = {
        "sleep",
        "rerun",
        "slider",
        "button",
        "autorefresh",
        "experimental_rerun",
        "markdown",
        "sidebar",
        "metric",
    }
    allowed_streamlit = {"set_page_config", "title", "caption", "dataframe", "text"}
    for path in paths:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                assert not any(
                    alias.name.split(".")[0] in forbidden_modules for alias in node.names
                )
            if isinstance(node, ast.ImportFrom):
                assert node.module not in forbidden_modules
            if isinstance(node, ast.Call):
                name = (
                    node.func.attr
                    if isinstance(node.func, ast.Attribute)
                    else node.func.id if isinstance(node.func, ast.Name) else ""
                )
                assert name not in forbidden_calls
                assert all(keyword.arg != "unsafe_allow_html" for keyword in node.keywords)
            if (
                isinstance(node, ast.Attribute)
                and isinstance(node.value, ast.Name)
                and node.value.id == "st"
            ):
                assert node.attr in allowed_streamlit
        if path.name == "operator_view.py":
            assert not any(
                isinstance(node, ast.Import)
                and any(alias.name == "streamlit" for alias in node.names)
                for node in tree.body
            )


def test_fleet_cli_and_package_never_import_the_view_at_module_level() -> None:
    prohibited = {
        "hermes.fleet.operator_view",
        "hermes.fleet.operator_projection",
        "hermes.workbench",
        "hermes.review",
        "streamlit",
    }
    root = Path(__file__).parents[2]
    for relative_path in ("src/hermes/fleet/__init__.py", "src/hermes/fleet/cli.py"):
        tree = ast.parse((root / relative_path).read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.Import):
                assert not any(alias.name in prohibited for alias in node.names)
            if isinstance(node, ast.ImportFrom):
                assert node.module not in prohibited


def test_main_renders_the_projection(monkeypatch: pytest.MonkeyPatch) -> None:
    st = pytest.importorskip("streamlit")
    calls: list[tuple[str, object]] = []
    projection = _projected_hand_written_run()
    monkeypatch.setattr(operator_view, "demo_run", lambda: projection)
    for name in ("set_page_config", "title", "caption", "dataframe", "text"):
        monkeypatch.setattr(
            st,
            name,
            lambda value=None, _name=name, **kwargs: calls.append((_name, value)),
        )

    main()

    assert [name for name, _ in calls] == [
        "set_page_config",
        "title",
        "caption",
        "dataframe",
        "text",
    ]
    assert calls[3] == ("dataframe", render_rows(projection))


def test_fleet_view_help_works_without_streamlit(tmp_path: Path) -> None:
    finder = tmp_path / "bomb_streamlit.py"
    finder.write_text(
        textwrap.dedent(
            """
            import importlib.abc
            import sys

            class Bomb(importlib.abc.MetaPathFinder):
                def find_spec(self, fullname, path=None, target=None):
                    if fullname == "streamlit" or fullname.startswith("streamlit."):
                        raise RuntimeError("streamlit import bomb")
                    return None

            sys.meta_path.insert(0, Bomb())
            """
        ),
        encoding="utf-8",
    )
    command = [
        sys.executable,
        "-c",
        "import bomb_streamlit; from hermes.cli import app; app()",
        "fleet",
        "view",
        "--help",
    ]
    environment = {
        **__import__("os").environ,
        "PYTHONPATH": f"{tmp_path}:{Path(__file__).parents[2] / 'src'}",
    }
    result = subprocess.run(
        command,
        cwd=Path(__file__).parents[2],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "read-only" in result.stdout.lower()
