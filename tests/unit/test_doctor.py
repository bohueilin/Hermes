from __future__ import annotations

import subprocess
from pathlib import Path
from types import SimpleNamespace

import hermes.doctor as doctor_module
from hermes.doctor import (
    CheckStatus,
    check_active_environment,
    check_artifacts_writability,
    check_display,
    check_git_state,
    check_headless_prerequisites,
    check_python_version,
    check_simulator_commit,
    inspect_metadrive,
)


def _by_name(checks):
    return {check.name: check for check in checks}


def test_python_311_passes_and_older_python_fails() -> None:
    assert check_python_version((3, 11, 15)).status is CheckStatus.PASS

    older = check_python_version((3, 10, 14))
    newer = check_python_version((3, 12, 1))

    assert older.status is CheckStatus.FAIL
    assert newer.status is CheckStatus.FAIL
    assert "3.11" in older.remediation


def test_conda_base_environment_warns() -> None:
    result = check_active_environment(
        {
            "CONDA_DEFAULT_ENV": "base",
            "CONDA_PREFIX": "/opt/miniconda3",
        }
    )

    assert result.status is CheckStatus.WARN
    assert "base" in result.details
    assert "hermes-dev" in result.remediation


def test_named_conda_environment_passes() -> None:
    result = check_active_environment(
        {
            "CONDA_DEFAULT_ENV": "hermes-dev",
            "CONDA_PREFIX": "/opt/miniconda3/envs/hermes-dev",
        }
    )

    assert result.status is CheckStatus.PASS
    assert "hermes-dev" in result.details


def test_git_state_reports_no_commit_and_untracked_files_truthfully(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    (tmp_path / "untracked.txt").write_text("evidence\n", encoding="utf-8")

    checks = _by_name(check_git_state(tmp_path))

    assert checks["Git repository status"].status is CheckStatus.PASS
    assert checks["Git commit"].status is CheckStatus.NOT_AVAILABLE
    assert checks["Git dirty/clean status"].status is CheckStatus.WARN
    assert "untracked" in checks["Git dirty/clean status"].details


def test_hermes_repository_discovery_prefers_package_checkout_over_cwd(tmp_path: Path) -> None:
    hermes_root = tmp_path / "hermes"
    unrelated_root = tmp_path / "unrelated"
    hermes_root.mkdir()
    unrelated_root.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=hermes_root, check=True)
    subprocess.run(["git", "init", "-q"], cwd=unrelated_root, check=True)
    package_file = hermes_root / "src" / "hermes" / "doctor.py"
    package_file.parent.mkdir(parents=True)
    package_file.write_text("# package marker\n", encoding="utf-8")
    (hermes_root / "pyproject.toml").write_text(
        '[project]\nname = "hermes-autonomy"\n',
        encoding="utf-8",
    )

    resolved = doctor_module.discover_hermes_repository_root(
        current_directory=unrelated_root,
        package_file=package_file,
    )

    assert resolved == hermes_root.resolve()


def test_hermes_repository_discovery_rejects_malformed_pyproject(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    package_file = tmp_path / "src" / "hermes" / "doctor.py"
    package_file.parent.mkdir(parents=True)
    package_file.write_text("# package marker\n", encoding="utf-8")
    (tmp_path / "pyproject.toml").write_bytes(b"\xff\xfe")

    resolved = doctor_module.discover_hermes_repository_root(
        current_directory=tmp_path,
        package_file=package_file,
    )

    assert resolved is None


def test_simulator_commit_reports_match_mismatch_and_missing_file(tmp_path: Path) -> None:
    recorded = "a" * 40
    (tmp_path / "SIMULATOR_COMMIT").write_text(f"{recorded}\n", encoding="utf-8")

    matching = check_simulator_commit(tmp_path, simulator_revision=recorded)
    mismatching = check_simulator_commit(tmp_path, simulator_revision="b" * 40)
    missing = check_simulator_commit(tmp_path / "missing", simulator_revision=None)

    assert matching.status is CheckStatus.PASS
    assert recorded in matching.details
    assert mismatching.status is CheckStatus.FAIL
    assert missing.status is CheckStatus.FAIL


def test_malformed_simulator_commit_is_an_actionable_failure(tmp_path: Path) -> None:
    (tmp_path / "SIMULATOR_COMMIT").write_bytes(b"\xff\xfe")

    result = check_simulator_commit(tmp_path, simulator_revision="a" * 40)

    assert result.status is CheckStatus.FAIL
    assert "UTF-8" in result.details


def test_metadrive_source_repository_rejects_dirty_tracked_source(tmp_path: Path) -> None:
    simulator_root = tmp_path / "metadrive"
    package_file = simulator_root / "metadrive" / "__init__.py"
    package_file.parent.mkdir(parents=True)
    package_file.write_text("VERSION = '0.4.3'\n", encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=simulator_root, check=True)
    subprocess.run(["git", "add", "metadrive/__init__.py"], cwd=simulator_root, check=True)
    subprocess.run(
        [
            "git",
            "-c",
            "user.name=Hermes Test",
            "-c",
            "user.email=hermes-test@example.invalid",
            "commit",
            "-q",
            "-m",
            "initial",
        ],
        cwd=simulator_root,
        check=True,
    )

    clean_checks, revision = doctor_module.check_metadrive_source_repository(package_file)
    untracked_file = simulator_root / "metadrive" / "new_module.py"
    untracked_file.write_text("# untracked source\n", encoding="utf-8")
    untracked_checks, _ = doctor_module.check_metadrive_source_repository(package_file)
    untracked_file.unlink()
    package_file.write_text("VERSION = 'modified'\n", encoding="utf-8")
    dirty_checks, _ = doctor_module.check_metadrive_source_repository(package_file)

    assert revision is not None
    assert _by_name(clean_checks)["MetaDrive source commit"].status is CheckStatus.PASS
    assert (
        _by_name(clean_checks)["MetaDrive source dirty/clean status"].status
        is CheckStatus.PASS
    )
    assert (
        _by_name(untracked_checks)["MetaDrive source dirty/clean status"].status
        is CheckStatus.FAIL
    )
    assert (
        _by_name(dirty_checks)["MetaDrive source dirty/clean status"].status
        is CheckStatus.FAIL
    )


def test_artifacts_writability_requires_existing_directory_and_cleans_probe(
    tmp_path: Path,
) -> None:
    missing = check_artifacts_writability(tmp_path)
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()

    writable = check_artifacts_writability(tmp_path)

    assert missing.status is CheckStatus.FAIL
    assert writable.status is CheckStatus.PASS
    assert list(artifacts.iterdir()) == []


def test_metadrive_inspection_reports_real_package_facts_from_inputs(tmp_path: Path) -> None:
    package_dir = tmp_path / "metadrive"
    assets_dir = package_dir / "assets"
    grass_dir = assets_dir / "textures" / "grass1"
    grass_dir.mkdir(parents=True)
    (assets_dir / "version.txt").write_text("0.4.3\n", encoding="utf-8")
    (grass_dir / "GroundGrassGreen002_COL_1K.jpg").write_bytes(b"asset")
    for relative_path in (
        "models/skybox.bam",
        "shaders/terrain.vert.glsl",
        "background/logo-color1.png",
    ):
        sentinel = assets_dir / relative_path
        sentinel.parent.mkdir(parents=True, exist_ok=True)
        sentinel.write_bytes(b"asset")
    module = SimpleNamespace(__file__=str(package_dir / "__init__.py"))
    version_module = SimpleNamespace(VERSION="0.4.3")

    def import_module(name: str):
        return version_module if name == "metadrive.version" else module

    checks = _by_name(
        inspect_metadrive(
            import_module=import_module,
            distribution_version=lambda name: "0.4.3",
        )
    )

    assert checks["MetaDrive import status"].status is CheckStatus.PASS
    assert checks["MetaDrive version"].status is CheckStatus.PASS
    assert "0.4.3" in checks["MetaDrive version"].details
    assert checks["MetaDrive source path"].details == str(package_dir / "__init__.py")
    assert checks["MetaDrive assets availability"].status is CheckStatus.PASS


def test_metadrive_basic_asset_predicate_rejects_unrelated_payload(tmp_path: Path) -> None:
    package_dir = tmp_path / "metadrive"
    assets_dir = package_dir / "assets"
    assets_dir.mkdir(parents=True)
    (assets_dir / "version.txt").write_text("0.4.3\n", encoding="utf-8")
    (assets_dir / "unrelated.bin").write_bytes(b"asset")
    module = SimpleNamespace(__file__=str(package_dir / "__init__.py"))

    checks = _by_name(
        inspect_metadrive(
            import_module=lambda name: module,
            distribution_version=lambda name: "0.4.3",
        )
    )

    assert checks["MetaDrive assets availability"].status is CheckStatus.FAIL
    assert "basic asset predicate" in checks["MetaDrive assets availability"].details


def test_metadrive_asset_check_requires_representative_runtime_sentinels(
    tmp_path: Path,
) -> None:
    package_dir = tmp_path / "metadrive"
    grass_dir = package_dir / "assets" / "textures" / "grass1"
    grass_dir.mkdir(parents=True)
    (package_dir / "assets" / "version.txt").write_text("0.4.3\n", encoding="utf-8")
    (grass_dir / "GroundGrassGreen002_COL_1K.jpg").write_bytes(b"asset")
    package_module = SimpleNamespace(__file__=str(package_dir / "__init__.py"))
    source_version_module = SimpleNamespace(VERSION="0.4.3")

    def import_module(name: str):
        return source_version_module if name == "metadrive.version" else package_module

    checks = _by_name(
        inspect_metadrive(
            import_module=import_module,
            distribution_version=lambda name: "0.4.3",
        )
    )

    assert checks["MetaDrive assets availability"].status is CheckStatus.FAIL
    assert "representative sentinels" in checks["MetaDrive assets availability"].details


def test_metadrive_version_rejects_unverified_distribution_version(tmp_path: Path) -> None:
    package_dir = tmp_path / "metadrive"
    grass_dir = package_dir / "assets" / "textures" / "grass1"
    grass_dir.mkdir(parents=True)
    (package_dir / "assets" / "version.txt").write_text("0.4.3\n", encoding="utf-8")
    (grass_dir / "GroundGrassGreen002_COL_1K.jpg").write_bytes(b"asset")
    package_module = SimpleNamespace(__file__=str(package_dir / "__init__.py"))
    source_version_module = SimpleNamespace(VERSION="0.4.3")

    def import_module(name: str):
        return source_version_module if name == "metadrive.version" else package_module

    checks = _by_name(
        inspect_metadrive(
            import_module=import_module,
            distribution_version=lambda name: "9.9.9",
        )
    )

    assert checks["MetaDrive version"].status is CheckStatus.FAIL
    assert "expected 0.4.3" in checks["MetaDrive version"].details


def test_metadrive_version_requires_distribution_and_source_evidence(tmp_path: Path) -> None:
    package_dir = tmp_path / "metadrive"
    package_module = SimpleNamespace(__file__=str(package_dir / "__init__.py"))
    source_version_module = SimpleNamespace(VERSION="0.4.3")

    def import_module(name: str):
        return source_version_module if name == "metadrive.version" else package_module

    def missing_distribution(name: str) -> str:
        raise doctor_module.metadata.PackageNotFoundError(name)

    checks = _by_name(
        inspect_metadrive(
            import_module=import_module,
            distribution_version=missing_distribution,
        )
    )

    assert checks["MetaDrive version"].status is CheckStatus.FAIL
    assert "distribution metadata unavailable" in checks["MetaDrive version"].details


def test_metadrive_import_failure_is_not_reported_as_green() -> None:
    def missing_import(name: str):
        raise ModuleNotFoundError(name)

    checks = _by_name(
        inspect_metadrive(
            import_module=missing_import,
            distribution_version=lambda name: "0.4.3",
        )
    )

    assert checks["MetaDrive import status"].status is CheckStatus.FAIL
    assert checks["MetaDrive version"].status is CheckStatus.NOT_AVAILABLE
    assert checks["MetaDrive assets availability"].status is CheckStatus.NOT_AVAILABLE


def test_malformed_asset_version_is_an_actionable_failure(tmp_path: Path) -> None:
    package_dir = tmp_path / "metadrive"
    assets_dir = package_dir / "assets"
    assets_dir.mkdir(parents=True)
    (assets_dir / "version.txt").write_bytes(b"\xff\xfe")
    package_module = SimpleNamespace(__file__=str(package_dir / "__init__.py"))
    source_version_module = SimpleNamespace(VERSION="0.4.3")

    def import_module(name: str):
        return source_version_module if name == "metadrive.version" else package_module

    checks = _by_name(
        inspect_metadrive(
            import_module=import_module,
            distribution_version=lambda name: "0.4.3",
        )
    )

    assert checks["MetaDrive assets availability"].status is CheckStatus.FAIL
    assert "UTF-8" in checks["MetaDrive assets availability"].details


def test_headless_prerequisites_fail_when_a_required_module_is_missing() -> None:
    available = {
        "panda3d": False,
        "panda3d.core": True,
        "panda3d.bullet": True,
        "metadrive.examples.verify_headless_installation": True,
    }

    result = check_headless_prerequisites(
        metadrive_available=True,
        assets_available=True,
        module_available=lambda name: available[name],
    )

    assert result.status is CheckStatus.FAIL
    assert "panda3d" in result.details


def test_headless_prerequisites_require_panda_native_modules() -> None:
    available = {
        "panda3d": True,
        "panda3d.core": True,
        "panda3d.bullet": False,
        "metadrive.examples.verify_headless_installation": True,
    }

    result = check_headless_prerequisites(
        metadrive_available=True,
        assets_available=True,
        module_available=lambda name: available[name],
    )

    assert result.status is CheckStatus.FAIL
    assert "panda3d.bullet" in result.details


def test_headless_default_module_probe_requires_a_successful_import(monkeypatch) -> None:
    def failed_import(name: str):
        raise ImportError(f"cannot load {name}")

    monkeypatch.setattr(doctor_module.importlib, "import_module", failed_import)

    assert doctor_module._module_importable("panda3d.bullet") is False


def test_headless_prerequisites_require_a_registered_graphics_pipe() -> None:
    available = {
        "panda3d": True,
        "panda3d.core": True,
        "panda3d.bullet": True,
        "metadrive.examples.verify_headless_installation": True,
    }

    result = check_headless_prerequisites(
        metadrive_available=True,
        assets_available=True,
        module_available=lambda name: available[name],
        graphics_pipes=lambda: (),
    )

    assert result.status is CheckStatus.FAIL
    assert "graphics pipe" in result.details


def test_unset_display_is_not_available_but_not_a_headless_failure() -> None:
    result = check_display({})

    assert result.status is CheckStatus.NOT_AVAILABLE
    assert "offscreen" in result.details.lower()
