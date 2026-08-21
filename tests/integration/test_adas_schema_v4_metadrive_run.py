"""End-to-end schema-4.0 runs against the real simulator.

Every other test in this repository is simulator-free: `tests/integration/test_metadrive_run.py`
drives the adapter through a hand-written environment double. That leaves the real
MetaDrive path with no coverage at all, which is where Phase 8's ADAS work lives.

These tests carry the `metadrive` marker declared in ``pyproject.toml`` — previously
declared but applied to nothing — so `pytest -m "not metadrive"`, the selection CI runs,
still skips them on machines without a vendored simulator.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from hermes.domain.enums import IntegrityStatus, Verdict

pytestmark = pytest.mark.metadrive


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _schema_4_lead_brake(repository_root: Path, tmp_path: Path) -> Path:
    """A schema-4.0 copy of the committed lead-brake scenario."""
    source = repository_root / "scenarios" / "metadrive_lead_vehicle_hard_brake.yaml"
    text = source.read_text(encoding="utf-8")
    text = text.replace('schema_version: "2.0"', 'schema_version: "4.0"')
    text = text.replace("name: lead_vehicle_hard_brake", "name: adas_v4_lead_hard_brake")
    text += "tags:\n  - aeb\n  - longitudinal\n"
    destination = tmp_path / "adas_v4_lead_hard_brake.yaml"
    destination.write_text(text, encoding="utf-8")
    return destination


def test_schema_4_challenge_scenario_publishes_verified_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """A schema-4.0 challenge scenario must produce a self-verified bundle.

    This is the combination that failed before the trace-layer version gates were widened:
    the adapter emits challenge observation fields, and the exact-equality field-set check
    rejected them for any scenario version other than 2.0.
    """
    _requires_metadrive(repository_root)
    from hermes.evidence.verification import verify_artifact
    from hermes.runtime.orchestrator import execute_metadrive_run

    scenario_path = _schema_4_lead_brake(repository_root, tmp_path)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    outcome = execute_metadrive_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.phase2.yaml",
        seed=7,
        run_id="adas-v4-lead-brake",
        artifact_root=artifact_root,
        repository_root=repository_root,
    )
    result = verify_artifact(artifact_root / "adas-v4-lead-brake")

    assert outcome.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert result.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert result.verdict is not Verdict.INVALID_EVIDENCE


def test_schema_4_run_is_bitwise_repeatable(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """N = 2 repeats of the determinism contract, on the real simulator.

    The full contract is N = 3 identical repeats; two are run here because each is a real
    physics episode. Cross-platform identity is an explicit non-goal, so this asserts
    same-host reproducibility only.
    """
    _requires_metadrive(repository_root)
    from hermes.runtime.orchestrator import execute_metadrive_run

    scenario_path = _schema_4_lead_brake(repository_root, tmp_path)
    digests: list[str] = []
    for index in range(2):
        artifact_root = tmp_path / f"repeat-{index}"
        artifact_root.mkdir()
        outcome = execute_metadrive_run(
            scenario_path=scenario_path,
            gate_config_path=repository_root / "config" / "gates.phase2.yaml",
            seed=7,
            run_id="adas-v4-repeat",
            artifact_root=artifact_root,
            repository_root=repository_root,
        )
        digests.append(outcome.verification.trace_digest)
        events = (artifact_root / "adas-v4-repeat" / "events.jsonl").read_bytes()
        (tmp_path / f"events-{index}.jsonl").write_bytes(events)

    assert digests[0] == digests[1]
    assert (tmp_path / "events-0.jsonl").read_bytes() == (
        tmp_path / "events-1.jsonl"
    ).read_bytes()
    shutil.rmtree(tmp_path / "repeat-0")
