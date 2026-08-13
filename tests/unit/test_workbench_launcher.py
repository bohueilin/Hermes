from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

import hermes.workbench.launcher as launcher
from hermes.workbench import launch_workbench


def _streamlit_available(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        launcher.importlib.util,
        "find_spec",
        lambda name: SimpleNamespace(name=name) if name == "streamlit" else None,
    )


@pytest.mark.parametrize(
    ("host", "expected"),
    [
        ("127.0.0.1", "127.0.0.1"),
        ("127.7.8.9", "127.7.8.9"),
        ("::1", "::1"),
        ("0:0:0:0:0:0:0:1", "::1"),
        ("::ffff:127.0.0.1", "::ffff:127.0.0.1"),
    ],
)
def test_loopback_validator_accepts_only_numeric_loopback_literals(
    host: str,
    expected: str,
) -> None:
    assert launcher._validate_loopback_host(host) == expected


@pytest.mark.parametrize(
    "host",
    [
        "0.0.0.0",
        "::",
        "localhost",
        "example.com",
        "192.168.1.10",
        "169.254.1.1",
        "8.8.8.8",
        "2001:4860:4860::8888",
        "::ffff:192.168.1.10",
        "127.0.0.1/8",
        " 127.0.0.1",
        "127.0.0.1 ",
        "127.1",
        "",
    ],
)
def test_loopback_validator_rejects_every_nonliteral_or_nonloopback_host(
    host: str,
) -> None:
    with pytest.raises(ValueError, match="numeric loopback"):
        launcher._validate_loopback_host(host)


@pytest.mark.parametrize("port", [1, 8501, 65535])
def test_port_validator_accepts_closed_integer_range(port: int) -> None:
    assert launcher._validate_port(port) == port


@pytest.mark.parametrize("port", [True, False, 0, -1, 65536, 1.0, "8501", None])
def test_port_validator_rejects_bool_noninteger_and_out_of_range(
    port: object,
) -> None:
    with pytest.raises(ValueError, match="1 through 65535"):
        launcher._validate_port(port)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("no_browser", "headless"),
    [(False, "false"), (True, "true")],
)
def test_launcher_builds_one_frozen_streamlit_command_after_validation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    no_browser: bool,
    headless: str,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    _streamlit_available(monkeypatch)
    calls: list[tuple[str, ...]] = []

    result = launch_workbench(
        root,
        host="127.7.8.9",
        port=43210,
        no_browser=no_browser,
        _process_runner=lambda argv: calls.append(argv) or 17,
    )

    app_path = Path(launcher.__file__).with_name("app.py").resolve(strict=True)
    assert result == 17
    assert calls == [
        (
            sys.executable,
            "-m",
            "streamlit",
            "run",
            str(app_path),
            "--server.address",
            "127.7.8.9",
            "--server.port",
            "43210",
            "--server.headless",
            headless,
            "--browser.gatherUsageStats",
            "false",
            "--",
            "--artifact-root",
            str(root.resolve()),
        )
    ]


@pytest.mark.parametrize(
    ("host", "port"),
    [("0.0.0.0", 8501), ("localhost", 8501), ("127.0.0.1", 0)],
)
def test_launcher_rejects_bind_configuration_before_process_creation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    host: str,
    port: int,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    _streamlit_available(monkeypatch)
    calls: list[tuple[str, ...]] = []

    with pytest.raises(ValueError):
        launch_workbench(
            root,
            host=host,
            port=port,
            _process_runner=lambda argv: calls.append(argv) or 0,
        )

    assert calls == []


@pytest.mark.parametrize("root_case", ["MISSING", "FILE", "SYMLINK"])
def test_launcher_rejects_invalid_artifact_root_before_process_creation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    root_case: str,
) -> None:
    real_root = tmp_path / "real-artifacts"
    real_root.mkdir()
    if root_case == "MISSING":
        root = tmp_path / "missing"
    elif root_case == "FILE":
        root = tmp_path / "file"
        root.write_text("not a directory", encoding="utf-8")
    else:
        root = tmp_path / "linked-artifacts"
        root.symlink_to(real_root, target_is_directory=True)
    _streamlit_available(monkeypatch)
    calls: list[tuple[str, ...]] = []

    with pytest.raises(ValueError):
        launch_workbench(root, _process_runner=lambda argv: calls.append(argv) or 0)

    assert calls == []


def test_launcher_rejects_missing_optional_dependency_before_process_creation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    monkeypatch.setattr(launcher.importlib.util, "find_spec", lambda name: None)
    calls: list[tuple[str, ...]] = []

    with pytest.raises(ValueError, match=r"\.\[workbench\]"):
        launch_workbench(root, _process_runner=lambda argv: calls.append(argv) or 0)

    assert calls == []


def test_launcher_rejects_missing_installed_app_before_dependency_probe_or_process(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    monkeypatch.setattr(launcher, "__file__", str(tmp_path / "launcher.py"))
    probes: list[str] = []
    monkeypatch.setattr(
        launcher.importlib.util,
        "find_spec",
        lambda name: probes.append(name) or SimpleNamespace(name=name),
    )
    calls: list[tuple[str, ...]] = []

    with pytest.raises(ValueError, match="application is unavailable"):
        launch_workbench(root, _process_runner=lambda argv: calls.append(argv) or 0)

    assert probes == []
    assert calls == []


def test_launcher_rejects_symlink_installed_app_before_process_creation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    package = tmp_path / "package"
    package.mkdir()
    (package / "launcher.py").write_text("", encoding="utf-8")
    target = tmp_path / "real-app.py"
    target.write_text("", encoding="utf-8")
    (package / "app.py").symlink_to(target)
    monkeypatch.setattr(launcher, "__file__", str(package / "launcher.py"))
    _streamlit_available(monkeypatch)
    calls: list[tuple[str, ...]] = []

    with pytest.raises(ValueError, match="application is unavailable"):
        launch_workbench(root, _process_runner=lambda argv: calls.append(argv) or 0)

    assert calls == []


def test_default_process_runner_uses_argument_list_without_shell(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed: list[tuple[list[str], bool]] = []

    def fake_run(argv: list[str], *, check: bool) -> SimpleNamespace:
        observed.append((argv, check))
        return SimpleNamespace(returncode=23)

    monkeypatch.setattr(launcher.subprocess, "run", fake_run)

    assert launcher._run_process(("python", "-m", "streamlit")) == 23
    assert observed == [(["python", "-m", "streamlit"], False)]
