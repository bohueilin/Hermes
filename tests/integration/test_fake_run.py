from __future__ import annotations

import builtins
from pathlib import Path

import pytest

import hermes.evidence.artifacts as artifact_module
import hermes.runtime.orchestrator as orchestrator_module
from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.domain.enums import AuthenticityStatus, IntegrityStatus, Verdict
from hermes.evidence.artifacts import (
    REQUIRED_ARTIFACT_FILES,
    ArtifactError,
    ArtifactExistsError,
    ArtifactStager,
)
from hermes.evidence.verification import verify_artifact
from hermes.policies.baseline import BaselinePolicy
from hermes.runtime.orchestrator import (
    RunConfigurationError,
    RunOperationalError,
    execute_fake_run,
)


@pytest.mark.parametrize(
    "scenario_name, expected_verdict",
    [
        ("fake_nominal.yaml", Verdict.PASS),
        ("fake_collision.yaml", Verdict.HOLD),
        ("fake_boundary.yaml", Verdict.HOLD),
        ("fake_soft_degradation.yaml", Verdict.CONDITIONAL),
    ],
)
def test_phase1_scenarios_publish_self_verified_artifacts(
    repository_root: Path,
    tmp_path: Path,
    scenario_name: str,
    expected_verdict: Verdict,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    run_id = scenario_name.removesuffix(".yaml").replace("_", "-")

    outcome = execute_fake_run(
        scenario_path=repository_root / "scenarios" / scenario_name,
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=artifacts,
        repository_root=repository_root,
    )
    verification = verify_artifact(outcome.artifact_path)

    assert outcome.verdict is expected_verdict
    assert set(path.name for path in outcome.artifact_path.iterdir()) == set(
        REQUIRED_ARTIFACT_FILES
    )
    assert verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert verification.authenticity is AuthenticityStatus.NOT_AUTHENTICATED
    assert verification.verdict is expected_verdict


def test_different_run_ids_have_identical_deterministic_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    paths = []
    for run_id in ("repeat-one", "repeat-two"):
        outcome = execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id=run_id,
            artifact_root=artifacts,
            repository_root=repository_root,
        )
        paths.append(outcome.artifact_path)

    for filename in (
        "execution-context.json",
        "events.jsonl",
        "metrics.json",
        "findings.json",
        "verdict.json",
        "trace.sha256",
    ):
        assert (paths[0] / filename).read_bytes() == (paths[1] / filename).read_bytes()


@pytest.mark.parametrize(
    "run_id",
    ["../escape", "two/levels", ".hidden", "UPPER", "trailing-", "a" * 65, "bad id"],
)
def test_run_rejects_unsafe_run_ids_before_execution(
    repository_root: Path,
    tmp_path: Path,
    run_id: str,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()

    with pytest.raises(RunConfigurationError, match="run ID"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id=run_id,
            artifact_root=artifacts,
            repository_root=repository_root,
        )

    assert list(artifacts.iterdir()) == []


def test_run_refuses_existing_destination_without_modifying_it(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    existing = artifacts / "existing-run"
    existing.mkdir(parents=True)
    marker = existing / "keep.txt"
    marker.write_text("preserve\n", encoding="utf-8")

    with pytest.raises(RunConfigurationError, match="already exists"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id="existing-run",
            artifact_root=artifacts,
            repository_root=repository_root,
        )

    assert marker.read_text(encoding="utf-8") == "preserve\n"


def test_adapter_exception_closes_once_and_publishes_nothing(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()

    class ExplodingAdapter(FakeSimulatorAdapter):
        def __init__(self) -> None:
            super().__init__()
            self.close_count = 0

        def step(self, action):
            del action
            raise RuntimeError("synthetic adapter failure")

        def close(self) -> None:
            self.close_count += 1
            super().close()

    adapter = ExplodingAdapter()
    with pytest.raises(RunOperationalError, match="synthetic adapter failure"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id="adapter-error",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=lambda: adapter,
        )

    assert adapter.close_count == 1
    assert list(artifacts.iterdir()) == []


def test_policy_and_close_exceptions_publish_nothing_and_close_once(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()

    class TrackingAdapter(FakeSimulatorAdapter):
        def __init__(self) -> None:
            super().__init__()
            self.close_count = 0

        def close(self) -> None:
            self.close_count += 1
            super().close()

    class ExplodingPolicy(BaselinePolicy):
        def act(self, observation):
            del observation
            raise RuntimeError("synthetic policy failure")

    adapter = TrackingAdapter()
    with pytest.raises(RunOperationalError, match="synthetic policy failure"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id="policy-error",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=lambda: adapter,
            policy_factory=ExplodingPolicy,
        )

    assert adapter.close_count == 1
    assert list(artifacts.iterdir()) == []

    class CloseExplodingAdapter(FakeSimulatorAdapter):
        def __init__(self) -> None:
            super().__init__()
            self.close_count = 0

        def close(self) -> None:
            self.close_count += 1
            raise RuntimeError("synthetic close failure")

    close_adapter = CloseExplodingAdapter()
    with pytest.raises(RunOperationalError, match="synthetic close failure"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id="close-error",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=lambda: close_adapter,
        )

    assert close_adapter.close_count == 1
    assert list(artifacts.iterdir()) == []


def test_publication_failure_cleans_owned_temp_and_never_publishes(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()

    def fail_write(*args, **kwargs):
        del args, kwargs
        raise OSError("synthetic disk failure")

    monkeypatch.setattr(orchestrator_module, "write_bundle", fail_write)
    with pytest.raises(RunOperationalError, match="synthetic disk failure"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id="write-error",
            artifact_root=artifacts,
            repository_root=repository_root,
        )

    assert list(artifacts.iterdir()) == []


def test_explicitly_unavailable_required_progress_fails_closed_as_valid_hold(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    scenario_path = tmp_path / "unavailable-progress.yaml"
    scenario_path.write_text(
        (repository_root / "scenarios" / "fake_nominal.yaml")
        .read_text(encoding="utf-8")
        .replace("name: fake_nominal", "name: unavailable_progress")
        .replace("hazards: {}", "hazards:\n  unavailable_progress: true"),
        encoding="utf-8",
    )

    outcome = execute_fake_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id="unavailable-progress",
        artifact_root=artifacts,
        repository_root=repository_root,
    )
    verification = verify_artifact(outcome.artifact_path)

    assert outcome.verdict is Verdict.HOLD
    assert verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert verification.verdict is Verdict.HOLD
    assert "NOT_AVAILABLE" in (outcome.artifact_path / "findings.json").read_text(
        encoding="utf-8"
    )


def test_dangling_destination_symlink_is_rejected_and_preserved(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    destination = artifacts / "dangling-run"
    destination.symlink_to(tmp_path / "missing-target", target_is_directory=True)

    with pytest.raises(RunConfigurationError, match="already exists"):
        execute_fake_run(
            scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
            gate_config_path=repository_root / "config" / "gates.phase1.yaml",
            seed=7,
            run_id="dangling-run",
            artifact_root=artifacts,
            repository_root=repository_root,
        )

    assert destination.is_symlink()


def test_publication_uses_atomic_no_replace_at_the_rename_boundary(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    destination = artifacts / "publication-race"
    original_lexists = artifact_module.os.path.lexists

    with ArtifactStager(artifacts, "publication-race") as stager:
        destination.mkdir()
        competing_inode = destination.stat().st_ino
        monkeypatch.setattr(
            artifact_module.os.path,
            "lexists",
            lambda path: False
            if Path(path) == destination
            else original_lexists(path),
        )

        with pytest.raises(ArtifactExistsError, match="already exists"):
            stager.publish()

    assert destination.is_dir()
    assert destination.stat().st_ino == competing_inode


def test_artifact_root_symlink_is_rejected_before_resolution(tmp_path: Path) -> None:
    real_root = tmp_path / "real-artifacts"
    real_root.mkdir()
    linked_root = tmp_path / "linked-artifacts"
    linked_root.symlink_to(real_root, target_is_directory=True)

    with pytest.raises(ArtifactError, match="symlink"):
        ArtifactStager(linked_root, "must-not-escape")

    assert list(real_root.iterdir()) == []


def test_fake_run_and_stored_verification_never_import_metadrive(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch,
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    original_import = builtins.__import__

    def guarded_import(name, *args, **kwargs):
        if name.startswith(("metadrive", "panda3d")):
            raise AssertionError(f"forbidden Phase 1 import: {name}")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", guarded_import)
    outcome = execute_fake_run(
        scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id="no-metadrive",
        artifact_root=artifacts,
        repository_root=repository_root,
    )

    assert verify_artifact(outcome.artifact_path).verdict is Verdict.PASS
