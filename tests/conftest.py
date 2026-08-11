from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from hermes.runtime.orchestrator import RunOutcome, execute_fake_run


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
