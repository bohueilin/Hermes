from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

import pytest

import hermes.adapters.metadrive as metadrive_module
from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.adapters.metadrive import MetaDriveAdapter
from hermes.review import review_artifact


@pytest.mark.parametrize(
    ("selection", "verdict", "schema", "finding_count", "metric_count"),
    (
        ("handoff-phase5-demo", "PASS", "1.0", 6, 13),
        ("handoff-p1-collision", "HOLD", "1.0", 6, 13),
        ("handoff-p1-boundary", "HOLD", "1.0", 6, 13),
        ("handoff-p1-conditional", "CONDITIONAL", "1.0", 6, 13),
        ("handoff-p2-metadrive", "PASS", "1.0", 6, 13),
        ("handoff-p4-fault", "HOLD", "2.0", 7, 19),
    ),
)
def test_retained_valid_artifacts_project_without_simulator_execution(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    selection: str,
    verdict: str,
    schema: str,
    finding_count: int,
    metric_count: int,
) -> None:
    root = tmp_path / "retained"
    root.mkdir()
    shutil.copytree(repository_root / "artifacts" / selection, root / selection)

    def bomb(*args, **kwargs):
        del args, kwargs
        raise AssertionError("stored review attempted simulator execution")

    monkeypatch.setattr(FakeSimulatorAdapter, "reset", bomb)
    monkeypatch.setattr(FakeSimulatorAdapter, "step", bomb)
    monkeypatch.setattr(MetaDriveAdapter, "reset", bomb)
    monkeypatch.setattr(MetaDriveAdapter, "step", bomb)
    monkeypatch.setattr(metadrive_module, "_load_dependencies", bomb)
    before = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (root / selection).iterdir()
    }

    envelope = review_artifact(root, selection)

    after = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (root / selection).iterdir()
    }
    assert before == after
    assert envelope.verification.integrity == "INTERNALLY_CONSISTENT"
    assert envelope.gate.verdict == verdict
    assert envelope.artifact.manifest_identity.evidence_schema_version == schema
    assert len(envelope.findings) == finding_count
    assert len(envelope.metrics) == metric_count
    assert envelope.timeline.event_count > 0
    assert len(envelope.timeline.tracks) == 16
    assert envelope.trust.records[0].value == "NOT_AUTHENTICATED"
    assert envelope.trust.records[1].value == "NOT_EVALUATED"
    assert envelope.trust.records[2].value == "NONE"
    assert envelope.trust.records[3].value == "SIMULATION_ONLY"


def test_retained_tampered_artifact_quarantines_stored_pass(repository_root: Path) -> None:
    envelope = review_artifact(repository_root / "artifacts", "phase1-tampered")

    assert envelope.verification.integrity == "INVALID_EVIDENCE"
    assert envelope.gate.verdict == "INVALID_EVIDENCE"
    assert envelope.gate.accepted_recomputation is False
    assert envelope.artifact.manifest_identity.run_id == "phase1-nominal"
    assert envelope.findings == ()
    assert envelope.metrics == ()
    assert envelope.provenance.recorded.status == "QUARANTINED"
