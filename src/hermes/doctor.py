"""Truthful, simulator-light environment checks for Hermes Phase 0."""

from __future__ import annotations

import importlib
import os
import platform
import re
import subprocess
import sys
import tempfile
import tomllib
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from importlib import metadata
from pathlib import Path
from types import ModuleType

SUPPORTED_METADRIVE_VERSION = "0.4.3"
METADRIVE_ASSET_SENTINELS = (
    Path("textures/grass1/GroundGrassGreen002_COL_1K.jpg"),
    Path("models/skybox.bam"),
    Path("shaders/terrain.vert.glsl"),
    Path("background/logo-color1.png"),
)


class CheckStatus(StrEnum):
    """Explicit result states emitted by the environment doctor."""

    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"
    NOT_AVAILABLE = "NOT_AVAILABLE"


@dataclass(frozen=True, slots=True)
class CheckResult:
    """One observed doctor result and an optional corrective action."""

    name: str
    status: CheckStatus
    details: str
    remediation: str = ""


def check_python_version(version_info: Sequence[int] | None = None) -> CheckResult:
    """Require the project target, Python 3.11, and report deviations."""
    observed = tuple(version_info or sys.version_info[:3])
    version_text = ".".join(str(part) for part in observed[:3])
    major_minor = observed[:2]
    if major_minor == (3, 11):
        return CheckResult("Python version", CheckStatus.PASS, version_text)
    return CheckResult(
        "Python version",
        CheckStatus.FAIL,
        f"{version_text}; Hermes requires Python 3.11",
        "Activate the hermes-dev Conda environment with Python 3.11.",
    )


def check_python_executable(executable: str | None = None) -> CheckResult:
    """Report the exact interpreter path and whether it is executable."""
    executable_path = Path(executable or sys.executable).expanduser().resolve()
    if executable_path.is_file() and os.access(executable_path, os.X_OK):
        return CheckResult("Python executable path", CheckStatus.PASS, str(executable_path))
    return CheckResult(
        "Python executable path",
        CheckStatus.FAIL,
        f"not executable: {executable_path}",
        "Activate a valid Python 3.11 environment and retry.",
    )


def check_active_environment(environ: Mapping[str, str] | None = None) -> CheckResult:
    """Identify Conda/venv activation and warn explicitly for Conda base."""
    environment = os.environ if environ is None else environ
    conda_name = environment.get("CONDA_DEFAULT_ENV")
    conda_prefix = environment.get("CONDA_PREFIX")
    virtual_env = environment.get("VIRTUAL_ENV")

    if conda_name:
        details = f"Conda environment {conda_name} ({conda_prefix or 'prefix unavailable'})"
        if conda_name == "base":
            return CheckResult(
                "Active Conda or virtual environment",
                CheckStatus.WARN,
                details,
                "Run `conda activate hermes-dev`; avoid installing Hermes into Conda base.",
            )
        return CheckResult("Active Conda or virtual environment", CheckStatus.PASS, details)
    if virtual_env:
        return CheckResult(
            "Active Conda or virtual environment",
            CheckStatus.PASS,
            f"virtual environment {Path(virtual_env).expanduser()}",
        )
    return CheckResult(
        "Active Conda or virtual environment",
        CheckStatus.WARN,
        "no active Conda or virtual environment was detected",
        "Run `conda activate hermes-dev` before installing or running Hermes.",
    )


def check_platform() -> list[CheckResult]:
    """Report the operating system and CPU architecture used by the checks."""
    operating_system = platform.platform()
    architecture = platform.machine()
    return [
        CheckResult(
            "Operating system",
            CheckStatus.PASS if operating_system else CheckStatus.NOT_AVAILABLE,
            operating_system or "platform information unavailable",
        ),
        CheckResult(
            "CPU architecture",
            CheckStatus.PASS if architecture else CheckStatus.NOT_AVAILABLE,
            architecture or "architecture information unavailable",
        ),
    ]


def _run_git(repository: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", *arguments],
            cwd=repository,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        return subprocess.CompletedProcess(["git", *arguments], 127, "", str(exc))


def discover_repository_root(start: Path | None = None) -> Path | None:
    """Find the containing Git repository, preferring the caller's working tree."""
    candidate = (start or Path.cwd()).expanduser().resolve()
    probe = _run_git(candidate, "rev-parse", "--show-toplevel")
    if probe.returncode == 0 and probe.stdout.strip():
        return Path(probe.stdout.strip()).resolve()
    return None


def _is_hermes_repository(repository_root: Path | None) -> bool:
    if repository_root is None:
        return False
    pyproject = repository_root / "pyproject.toml"
    try:
        project = tomllib.loads(pyproject.read_text(encoding="utf-8")).get("project", {})
    except (OSError, UnicodeDecodeError, tomllib.TOMLDecodeError):
        return False
    return project.get("name") == "hermes-autonomy"


def discover_hermes_repository_root(
    *,
    current_directory: Path | None = None,
    package_file: Path | None = None,
) -> Path | None:
    """Find Hermes itself, never an unrelated caller or nested simulator repository."""
    installed_file = (package_file or Path(__file__)).expanduser().resolve()
    package_candidate = installed_file.parents[2]
    package_repository = discover_repository_root(package_candidate)
    if _is_hermes_repository(package_repository):
        return package_repository

    caller_repository = discover_repository_root(current_directory or Path.cwd())
    return caller_repository if _is_hermes_repository(caller_repository) else None


def check_repository_root(repository_root: Path | None) -> CheckResult:
    """Report the resolved repository root without assuming a recommended path."""
    if repository_root is None:
        return CheckResult(
            "Repository root",
            CheckStatus.FAIL,
            "no containing Git repository found",
            "Run the command from the Hermes repository or reinstall it in editable mode.",
        )
    return CheckResult("Repository root", CheckStatus.PASS, str(repository_root))


def check_git_state(repository_root: Path | None) -> list[CheckResult]:
    """Report Git availability, exact commit, and dirty/clean state independently."""
    if repository_root is None:
        return [
            CheckResult(
                "Git repository status",
                CheckStatus.FAIL,
                "not inside a Git repository",
                "Initialize or enter the Hermes Git repository.",
            ),
            CheckResult("Git commit", CheckStatus.NOT_AVAILABLE, "repository unavailable"),
            CheckResult(
                "Git dirty/clean status",
                CheckStatus.NOT_AVAILABLE,
                "repository unavailable",
            ),
        ]

    repository_probe = _run_git(repository_root, "rev-parse", "--is-inside-work-tree")
    if repository_probe.returncode != 0 or repository_probe.stdout.strip() != "true":
        details = repository_probe.stderr.strip() or "not inside a Git work tree"
        return [
            CheckResult(
                "Git repository status",
                CheckStatus.FAIL,
                details,
                "Initialize or enter the Hermes Git repository.",
            ),
            CheckResult("Git commit", CheckStatus.NOT_AVAILABLE, "Git repository unavailable"),
            CheckResult(
                "Git dirty/clean status",
                CheckStatus.NOT_AVAILABLE,
                "Git repository unavailable",
            ),
        ]

    checks = [CheckResult("Git repository status", CheckStatus.PASS, "inside a Git work tree")]
    commit_probe = _run_git(repository_root, "rev-parse", "HEAD")
    if commit_probe.returncode == 0:
        checks.append(CheckResult("Git commit", CheckStatus.PASS, commit_probe.stdout.strip()))
    else:
        checks.append(
            CheckResult(
                "Git commit",
                CheckStatus.NOT_AVAILABLE,
                "repository has no commits",
                "Create the initial local commit after reviewing and validating Phase 0 files.",
            )
        )

    status_probe = _run_git(repository_root, "status", "--porcelain", "--untracked-files=normal")
    if status_probe.returncode != 0:
        checks.append(
            CheckResult(
                "Git dirty/clean status",
                CheckStatus.FAIL,
                status_probe.stderr.strip() or "unable to read Git status",
                "Run `git status` and resolve the reported repository error.",
            )
        )
    else:
        entries = [line for line in status_probe.stdout.splitlines() if line]
        if entries:
            untracked = any(line.startswith("??") for line in entries)
            suffix = "; includes untracked files" if untracked else ""
            checks.append(
                CheckResult(
                    "Git dirty/clean status",
                    CheckStatus.WARN,
                    f"working tree is dirty ({len(entries)} entries{suffix})",
                    "Review `git status` and commit only intended, validated files.",
                )
            )
        else:
            checks.append(
                CheckResult("Git dirty/clean status", CheckStatus.PASS, "working tree is clean")
            )
    return checks


def inspect_metadrive(
    import_module: Callable[[str], ModuleType] = importlib.import_module,
    distribution_version: Callable[[str], str] = metadata.version,
) -> list[CheckResult]:
    """Inspect MetaDrive metadata and assets without constructing an environment."""
    try:
        metadrive = import_module("metadrive")
    except Exception as exc:  # Import failures can originate in binary dependencies.
        error = f"{type(exc).__name__}: {exc}"
        return [
            CheckResult(
                "MetaDrive import status",
                CheckStatus.FAIL,
                error,
                "Install the verified local MetaDrive source into hermes-dev and retry.",
            ),
            CheckResult("MetaDrive version", CheckStatus.NOT_AVAILABLE, "import failed"),
            CheckResult("MetaDrive source path", CheckStatus.NOT_AVAILABLE, "import failed"),
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.NOT_AVAILABLE,
                "import failed",
            ),
        ]

    checks = [CheckResult("MetaDrive import status", CheckStatus.PASS, "import succeeded")]
    package_version: str | None = None
    version_lookup_error: str | None = None
    try:
        package_version = distribution_version("metadrive-simulator")
    except metadata.PackageNotFoundError:
        version_lookup_error = "distribution metadata unavailable"
    except Exception as exc:
        version_lookup_error = f"distribution lookup failed: {type(exc).__name__}: {exc}"

    source_version: str | None = None
    try:
        source_version = getattr(import_module("metadrive.version"), "VERSION", None)
    except Exception as exc:
        source_error = f"source version lookup failed: {type(exc).__name__}: {exc}"
        version_lookup_error = (
            f"{version_lookup_error}; {source_error}" if version_lookup_error else source_error
        )

    observed_versions = {
        label: observed
        for label, observed in (
            ("distribution", package_version),
            ("source", source_version),
        )
        if observed
    }
    unexpected = {
        label: observed
        for label, observed in observed_versions.items()
        if observed != SUPPORTED_METADRIVE_VERSION
    }
    if unexpected:
        details = ", ".join(f"{label}={value}" for label, value in unexpected.items())
        checks.append(
            CheckResult(
                "MetaDrive version",
                CheckStatus.FAIL,
                f"{details}; expected {SUPPORTED_METADRIVE_VERSION}",
                "Activate hermes-dev with the verified MetaDrive 0.4.3 installation.",
            )
        )
    elif len(observed_versions) == 2:
        checks.append(
            CheckResult(
                "MetaDrive version",
                CheckStatus.PASS,
                f"{SUPPORTED_METADRIVE_VERSION} (distribution and source agree)",
            )
        )
    elif observed_versions:
        label, observed = next(iter(observed_versions.items()))
        checks.append(
            CheckResult(
                "MetaDrive version",
                CheckStatus.FAIL,
                f"{label}={observed}; "
                f"{version_lookup_error or 'second version source unavailable'}",
                "Repair the editable MetaDrive installation so distribution and source versions "
                "can be compared.",
            )
        )
    else:
        checks.append(
            CheckResult(
                "MetaDrive version",
                CheckStatus.FAIL,
                version_lookup_error or "version metadata unavailable",
                "Repair the MetaDrive installation and expose metadrive.version.VERSION.",
            )
        )

    module_file = getattr(metadrive, "__file__", None)
    package_file = Path(module_file).expanduser().resolve() if module_file else None
    if package_file is None:
        checks.extend(
            [
                CheckResult(
                    "MetaDrive source path",
                    CheckStatus.NOT_AVAILABLE,
                    "module has no __file__ path",
                ),
                CheckResult(
                    "MetaDrive assets availability",
                    CheckStatus.NOT_AVAILABLE,
                    "source path unavailable",
                ),
            ]
        )
        return checks

    source_status = CheckStatus.PASS if package_file.exists() else CheckStatus.WARN
    checks.append(CheckResult("MetaDrive source path", source_status, str(package_file)))
    assets_path = package_file.parent / "assets"
    version_file = assets_path / "version.txt"
    try:
        asset_version = version_file.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError as exc:
        checks.append(
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.FAIL,
                f"asset version marker is not valid UTF-8: {exc}",
                "Replace the assets with the verified MetaDrive 0.4.3 asset bundle.",
            )
        )
        return checks
    except OSError as exc:
        checks.append(
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.FAIL,
                f"missing or unreadable {version_file}: {exc}",
                "Run `python -m metadrive.pull_asset` in hermes-dev.",
            )
        )
        return checks

    missing_sentinels = [
        sentinel
        for sentinel in METADRIVE_ASSET_SENTINELS
        if not (assets_path / sentinel).is_file()
        or (assets_path / sentinel).stat().st_size == 0
    ]
    if not asset_version:
        checks.append(
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.FAIL,
                f"MetaDrive asset version marker is empty at {version_file}",
                "Run `python -m metadrive.pull_asset --update` in hermes-dev.",
            )
        )
    elif missing_sentinels:
        checks.append(
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.FAIL,
                "MetaDrive basic asset predicate and representative sentinels failed; missing: "
                + ", ".join(str(path) for path in missing_sentinels),
                "Run `python -m metadrive.pull_asset --update` in hermes-dev.",
            )
        )
    elif asset_version != SUPPORTED_METADRIVE_VERSION:
        checks.append(
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.FAIL,
                f"asset version {asset_version} does not match MetaDrive "
                f"{SUPPORTED_METADRIVE_VERSION}",
                "Run `python -m metadrive.pull_asset --update` in hermes-dev.",
            )
        )
    else:
        checks.append(
            CheckResult(
                "MetaDrive assets availability",
                CheckStatus.PASS,
                f"MetaDrive {SUPPORTED_METADRIVE_VERSION} representative asset sentinels are "
                f"present at {assets_path}; asset integrity is not verified because MetaDrive "
                "provides no checksum manifest",
            )
        )
    return checks


def _git_commit(repository: Path | None) -> str | None:
    if repository is None:
        return None
    probe = _run_git(repository, "rev-parse", "HEAD")
    return probe.stdout.strip() if probe.returncode == 0 else None


def check_metadrive_source_repository(
    package_file: Path | None,
) -> tuple[list[CheckResult], str | None]:
    """Verify that imported MetaDrive is tracked at a clean, exact Git revision."""
    if package_file is None:
        return (
            [
                CheckResult(
                    "MetaDrive source commit",
                    CheckStatus.NOT_AVAILABLE,
                    "MetaDrive source path unavailable",
                ),
                CheckResult(
                    "MetaDrive source dirty/clean status",
                    CheckStatus.NOT_AVAILABLE,
                    "MetaDrive source path unavailable",
                ),
            ],
            None,
        )
    simulator_root = discover_repository_root(package_file.parent)
    if simulator_root is None:
        return (
            [
                CheckResult(
                    "MetaDrive source commit",
                    CheckStatus.NOT_AVAILABLE,
                    "the imported MetaDrive source is not inside a Git checkout",
                ),
                CheckResult(
                    "MetaDrive source dirty/clean status",
                    CheckStatus.NOT_AVAILABLE,
                    "the imported MetaDrive source is not inside a Git checkout",
                ),
            ],
            None,
        )

    try:
        relative_package_file = package_file.resolve().relative_to(simulator_root)
    except ValueError:
        relative_package_file = None
    tracked_probe = (
        _run_git(
            simulator_root,
            "ls-files",
            "--error-unmatch",
            "--",
            str(relative_package_file),
        )
        if relative_package_file is not None
        else None
    )
    if tracked_probe is None or tracked_probe.returncode != 0:
        return (
            [
                CheckResult(
                    "MetaDrive source commit",
                    CheckStatus.NOT_AVAILABLE,
                    f"imported package file is not tracked by {simulator_root}",
                ),
                CheckResult(
                    "MetaDrive source dirty/clean status",
                    CheckStatus.NOT_AVAILABLE,
                    "source revision cannot be attributed to the imported package",
                ),
            ],
            None,
        )

    simulator_commit = _git_commit(simulator_root)
    if simulator_commit is None:
        return (
            [
                CheckResult(
                    "MetaDrive source commit",
                    CheckStatus.NOT_AVAILABLE,
                    "the MetaDrive checkout has no commit",
                    "Record an immutable simulator revision before producing run evidence.",
                ),
                CheckResult(
                    "MetaDrive source dirty/clean status",
                    CheckStatus.NOT_AVAILABLE,
                    "the MetaDrive checkout has no commit",
                ),
            ],
            None,
        )

    checks = [CheckResult("MetaDrive source commit", CheckStatus.PASS, simulator_commit)]
    status_probe = _run_git(simulator_root, "status", "--porcelain", "--untracked-files=normal")
    if status_probe.returncode != 0:
        checks.append(
            CheckResult(
                "MetaDrive source dirty/clean status",
                CheckStatus.FAIL,
                status_probe.stderr.strip() or "unable to inspect MetaDrive Git status",
                "Repair the MetaDrive checkout before using it for reproducible evidence.",
            )
        )
    elif status_probe.stdout.strip():
        checks.append(
            CheckResult(
                "MetaDrive source dirty/clean status",
                CheckStatus.FAIL,
                "tracked or untracked source files differ from the recorded MetaDrive commit",
                "Restore or commit intended MetaDrive changes, then update the verified pin.",
            )
        )
    else:
        checks.append(
            CheckResult(
                "MetaDrive source dirty/clean status",
                CheckStatus.PASS,
                "source checkout is clean at the recorded MetaDrive commit",
            )
        )
    return checks, simulator_commit


def check_simulator_commit(
    repository_root: Path,
    simulator_revision: str | None,
) -> CheckResult:
    """Validate SIMULATOR_COMMIT and compare it with the imported source revision."""
    commit_file = repository_root / "SIMULATOR_COMMIT"
    try:
        recorded = commit_file.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError as exc:
        return CheckResult(
            "SIMULATOR_COMMIT",
            CheckStatus.FAIL,
            f"value is not valid UTF-8: {exc}",
            "Replace it with the full 40-character MetaDrive Git SHA in UTF-8 text.",
        )
    except OSError as exc:
        return CheckResult(
            "SIMULATOR_COMMIT",
            CheckStatus.FAIL,
            f"unavailable at {commit_file}: {exc}",
            "Write the verified MetaDrive Git SHA to SIMULATOR_COMMIT.",
        )

    if not re.fullmatch(r"[0-9a-fA-F]{40}", recorded):
        return CheckResult(
            "SIMULATOR_COMMIT",
            CheckStatus.FAIL,
            f"invalid value: {recorded!r}",
            "Replace it with the full 40-character MetaDrive Git SHA.",
        )
    if simulator_revision is None:
        return CheckResult(
            "SIMULATOR_COMMIT",
            CheckStatus.FAIL,
            f"recorded {recorded}; imported source revision could not be compared",
            "Install MetaDrive from a Git checkout or otherwise record immutable provenance.",
        )
    if recorded.lower() != simulator_revision.lower():
        return CheckResult(
            "SIMULATOR_COMMIT",
            CheckStatus.FAIL,
            f"recorded {recorded}; imported source is {simulator_revision}",
            "Update SIMULATOR_COMMIT only after verifying the intended MetaDrive revision.",
        )
    return CheckResult(
        "SIMULATOR_COMMIT",
        CheckStatus.PASS,
        f"{recorded} (matches imported source)",
    )


def check_artifacts_writability(repository_root: Path) -> CheckResult:
    """Verify artifacts/ exists and accepts a disposable file."""
    artifacts = repository_root / "artifacts"
    if not artifacts.is_dir():
        return CheckResult(
            "artifacts/ directory writability",
            CheckStatus.FAIL,
            f"directory does not exist: {artifacts}",
            "Create artifacts/ and keep only artifacts/.gitkeep under version control.",
        )
    try:
        with tempfile.NamedTemporaryFile(prefix=".hermes-doctor-", dir=artifacts) as probe:
            probe.write(b"hermes-doctor\n")
            probe.flush()
    except OSError as exc:
        return CheckResult(
            "artifacts/ directory writability",
            CheckStatus.FAIL,
            f"not writable: {exc}",
            f"Grant the current user write access to {artifacts}.",
        )
    return CheckResult("artifacts/ directory writability", CheckStatus.PASS, str(artifacts))


def _module_importable(name: str) -> bool:
    try:
        importlib.import_module(name)
    except Exception:
        return False
    return True


def _graphics_pipe_names() -> tuple[str, ...]:
    try:
        from panda3d.core import GraphicsPipeSelection

        pipe_types = GraphicsPipeSelection.getGlobalPtr().getPipeTypes()
        return tuple(pipe_type.getName() for pipe_type in pipe_types)
    except Exception:
        return ()


def check_headless_prerequisites(
    *,
    metadrive_available: bool,
    assets_available: bool,
    module_available: Callable[[str], bool] = _module_importable,
    graphics_pipes: Callable[[], Sequence[str]] = _graphics_pipe_names,
) -> CheckResult:
    """Check dependencies for the official offscreen test without starting MetaDrive."""
    missing: list[str] = []
    if not metadrive_available:
        missing.append("metadrive")
    if not assets_available:
        missing.append("metadrive assets")
    for module_name in (
        "panda3d",
        "panda3d.core",
        "panda3d.bullet",
        "metadrive.examples.verify_headless_installation",
    ):
        if not module_available(module_name):
            missing.append(module_name)
    pipe_names: tuple[str, ...] = ()
    if not missing:
        try:
            pipe_names = tuple(graphics_pipes())
        except Exception:
            pipe_names = ()
        if not pipe_names:
            missing.append("Panda3D graphics pipe")
    if missing:
        return CheckResult(
            "Headless/offscreen capability prerequisites",
            CheckStatus.FAIL,
            "missing prerequisites: " + ", ".join(missing),
            "Install the missing prerequisite, then run "
            "`python -m metadrive.examples.verify_headless_installation`.",
        )
    return CheckResult(
        "Headless/offscreen capability prerequisites",
        CheckStatus.PASS,
        "MetaDrive, representative assets, Panda3D native modules, and the official verification "
        f"module import successfully; graphics pipes: {', '.join(pipe_names)}; "
        "doctor does not launch the simulator",
    )


def check_display(environ: Mapping[str, str] | None = None) -> CheckResult:
    """Report an optional interactive display separately from offscreen support."""
    environment = os.environ if environ is None else environ
    display = environment.get("DISPLAY") or environment.get("WAYLAND_DISPLAY")
    if display:
        return CheckResult("Optional display availability", CheckStatus.PASS, display)
    return CheckResult(
        "Optional display availability",
        CheckStatus.NOT_AVAILABLE,
        "DISPLAY/WAYLAND_DISPLAY is unset; this is acceptable for offscreen/headless checks",
    )


def collect_doctor_checks() -> list[CheckResult]:
    """Collect all Phase 0 checks in a stable, human-readable order."""
    repository_root = discover_hermes_repository_root()
    checks = [
        check_python_version(),
        check_python_executable(),
        check_active_environment(),
        *check_platform(),
        check_repository_root(repository_root),
        *check_git_state(repository_root),
    ]

    metadrive_checks = inspect_metadrive()
    checks.extend(metadrive_checks)
    metadrive_by_name = {check.name: check for check in metadrive_checks}
    source_check = metadrive_by_name["MetaDrive source path"]
    package_file = (
        Path(source_check.details)
        if source_check.status in {CheckStatus.PASS, CheckStatus.WARN}
        else None
    )
    source_repository_checks, source_commit = check_metadrive_source_repository(package_file)
    checks.extend(source_repository_checks)

    if repository_root is None:
        checks.append(
            CheckResult(
                "SIMULATOR_COMMIT",
                CheckStatus.NOT_AVAILABLE,
                "repository root unavailable",
            )
        )
        checks.append(
            CheckResult(
                "artifacts/ directory writability",
                CheckStatus.NOT_AVAILABLE,
                "repository root unavailable",
            )
        )
    else:
        checks.append(check_simulator_commit(repository_root, source_commit))
        checks.append(check_artifacts_writability(repository_root))

    checks.append(check_display())
    checks.append(
        check_headless_prerequisites(
            metadrive_available=(
                metadrive_by_name["MetaDrive import status"].status is CheckStatus.PASS
            ),
            assets_available=(
                metadrive_by_name["MetaDrive assets availability"].status is CheckStatus.PASS
            ),
        )
    )
    return checks
