import os
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

import pytest

from hermes.fixtures import FixtureRegistryError, load_fixture_registry, missing_fixtures
from hermes.runtime.orchestrator import RunOutcome, execute_fake_run

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_REGISTRY = REPOSITORY_ROOT / "config" / "phase8-fixture-registry.yaml"
FIXTURE_DEPENDENT_TESTS = Path(__file__).with_name("fixture_dependent_tests.txt")
_FIXTURE_GUARD_SKIPPED = pytest.StashKey[int]()


def read_fixture_dependent_tests(path: Path = FIXTURE_DEPENDENT_TESTS) -> tuple[str, ...]:
    """Return the listed node IDs, ignoring comments and blank lines."""
    lines = path.read_text(encoding="utf-8").splitlines()
    return tuple(line for line in lines if line and not line.startswith("#"))


def all_registered_fixtures_absent(registry_path: Path, artifact_root: Path) -> bool:
    """Whether no registered evidence fixture is present, as on a fresh clone or CI."""
    registry = load_fixture_registry(registry_path)
    return len(missing_fixtures(registry, artifact_root)) == len(registry.fixtures)


def fixture_guard_active(
    environ: Mapping[str, str], registry_path: Path, artifact_root: Path
) -> bool:
    """Whether to skip the listed tests: only on CI, and only with no fixture present.

    Off CI a fixture-less worktree still fails loudly, and a partial set always fails.
    An unreadable registry leaves the guard off so the registry's own tests report it.
    """
    if environ.get("CI") != "true":
        return False
    try:
        return all_registered_fixtures_absent(registry_path, artifact_root)
    except FixtureRegistryError:
        return False


@pytest.hookimpl(trylast=True)
def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    # trylast: runs after -k, -m and --deselect, so the summary counts only selected tests.
    if not fixture_guard_active(os.environ, FIXTURE_REGISTRY, REPOSITORY_ROOT / "artifacts"):
        return
    listed = set(read_fixture_dependent_tests())
    skip = pytest.mark.skip(reason="registered evidence fixtures are absent from artifacts/")
    skipped = 0
    for item in items:
        if item.nodeid in listed:
            item.add_marker(skip)
            skipped += 1
    config.stash[_FIXTURE_GUARD_SKIPPED] = skipped


def pytest_terminal_summary(terminalreporter: Any, exitstatus: int, config: pytest.Config) -> None:
    skipped = config.stash.get(_FIXTURE_GUARD_SKIPPED, 0)
    if skipped:
        terminalreporter.write_line(
            f"fixture guard: skipped {skipped} fixture-dependent tests on CI; "
            "no registered fixture is present under artifacts/"
        )


@pytest.fixture
def repository_root() -> Path:
    return Path(__file__).resolve().parents[1]


@pytest.fixture
def fake_artifact_factory(
    repository_root: Path,
    tmp_path: Path,
) -> Callable[..., RunOutcome]:
    """Build isolated deterministic fake-adapter artifacts with stable defaults."""
    artifact_root = tmp_path / "fixture-artifacts"
    artifact_root.mkdir()
    next_id = 0

    def build(**overrides: Any) -> RunOutcome:
        nonlocal next_id
        next_id += 1
        options: dict[str, Any] = {
            "scenario_path": repository_root / "scenarios" / "fake_nominal.yaml",
            "gate_config_path": repository_root / "config" / "gates.phase1.yaml",
            "seed": 7,
            "run_id": f"fixture-{next_id}",
            "artifact_root": artifact_root,
            "repository_root": repository_root,
        }
        options.update(overrides)
        return execute_fake_run(**options)

    return build
