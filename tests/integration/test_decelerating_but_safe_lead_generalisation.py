"""A scripted decelerating lead must remain nominal over the stored seed-7 run.

The schedule expectation below is recomputed from authored literals and does not import
the adapter or trace-verifier scheduler.  ``expected_fcw: none`` is not warning-output
evidence; the oracle assertions cover stored geometry only.
"""

from __future__ import annotations

import hashlib
import json
from itertools import groupby
from pathlib import Path

import pytest

from hermes.domain.enums import FindingStatus, TerminationReason
from hermes.evidence.trace import _geometry_agrees

pytestmark = pytest.mark.metadrive

GATE = Path("config") / "gates.adas.yaml"
NOMINAL = Path("scenarios") / "adas" / "decelerating_but_safe_lead.yaml"


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _run(
    repository_root: Path,
    artifact_root: Path,
    run_id: str,
    config: str,
) -> Path:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    controller = load_adas_config(repository_root / "config" / "adas" / f"{config}.yaml")
    execute_metadrive_run(
        scenario_path=repository_root / NOMINAL,
        gate_config_path=repository_root / GATE,
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(controller),
    )
    return artifact_root / run_id


def _events(bundle: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]


def _findings(bundle: Path) -> dict[str, dict]:
    document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    items = document["findings"] if isinstance(document, dict) else document
    return {item["finding_id"]: item for item in items}


def _failing_hard(bundle: Path) -> set[str]:
    return {
        finding_id
        for finding_id, item in _findings(bundle).items()
        if item["hard_invariant"] and item["status"] == FindingStatus.FAIL.value
    }


def _failing_hard_adas(bundle: Path) -> set[str]:
    return {
        finding_id
        for finding_id in _failing_hard(bundle)
        if finding_id.startswith("adas.")
    }


def _digest_record(bundle: Path) -> dict[str, object]:
    manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
    return {
        "scenario_digest": manifest["scenario_digest"],
        "gate_config_digest": manifest["gate_config_digest"],
        "policy_config_digest": manifest["policy_config_digest"],
        "adapter_config_digest": manifest["adapter_config_digest"],
        "shield_config_digest": manifest["shield_config_digest"],
        "verifier_suite_digest": manifest["verifier_suite_digest"],
        "trace_digest": manifest["trace_digest"],
        "trace_sha256": (bundle / "trace.sha256").read_text().strip(),
        "events_file_sha256": hashlib.sha256(
            (bundle / "events.jsonl").read_bytes()
        ).hexdigest(),
        "metrics_file_sha256": hashlib.sha256(
            (bundle / "metrics.json").read_bytes()
        ).hexdigest(),
        "findings_file_sha256": hashlib.sha256(
            (bundle / "findings.json").read_bytes()
        ).hexdigest(),
        "verdict_file_sha256": hashlib.sha256(
            (bundle / "verdict.json").read_bytes()
        ).hexdigest(),
    }


def _local_actor_speed(sample_time_s: float) -> float:
    return max(15.0, 20.0 - 2.0 * max(0.0, sample_time_s - 1.0))


def _ordered_phases(events: list[dict], field_name: str) -> tuple[str, ...]:
    return tuple(
        phase
        for phase, _group in groupby(
            event["observation_summary"][field_name] for event in events
        )
    )


def test_decelerating_lead_is_nominal_for_the_baseline_over_the_stored_run(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    bundle = _run(repository_root, artifact_root, "decelerating-lead-baseline", "baseline")
    events = _events(bundle)
    findings = _findings(bundle)

    assert findings["adas.aeb.threat_response"]["measurement"]["value"] == 0
    assert (
        findings["adas.aeb.no_false_intervention"]["status"]
        == FindingStatus.PASS.value
    )
    assert sum(event["executed_action"]["brake"] > 0.0 for event in events) == 0
    assert events[-1]["termination_reason"] == TerminationReason.DESTINATION_REACHED.value


def test_decelerating_lead_stores_the_exact_literal_speed_and_phase_schedule(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    bundle = _run(repository_root, artifact_root, "decelerating-lead-schedule", "baseline")
    events = _events(bundle)

    for event in events:
        sequence = event["sequence"]
        summary = event["observation_summary"]
        assert _geometry_agrees(
            summary["challenge_actor_speed_mps"],
            _local_actor_speed(sequence * 0.1),
        )
        assert _geometry_agrees(
            summary["result_challenge_actor_speed_mps"],
            _local_actor_speed((sequence + 1) * 0.1),
        )

    assert [
        event["sequence"]
        for event in events
        if event["observation_summary"]["challenge_phase"] == "DECELERATING"
    ] == list(range(10, 35))
    assert [
        event["sequence"]
        for event in events
        if event["observation_summary"]["result_challenge_phase"] == "DECELERATING"
    ] == list(range(9, 34))
    assert _ordered_phases(events, "challenge_phase") == (
        "STEADY",
        "DECELERATING",
        "STEADY",
    )
    assert _ordered_phases(events, "result_challenge_phase") == (
        "STEADY",
        "DECELERATING",
        "STEADY",
    )


def test_decelerating_lead_pins_named_adas_diagonal_and_progress_failure(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    actor_presence = _run(
        repository_root,
        artifact_root,
        "decelerating-lead-actor-presence",
        "defect_actor_presence_braking",
    )
    no_aeb = _run(
        repository_root,
        artifact_root,
        "decelerating-lead-no-aeb",
        "defect_no_aeb",
    )

    actor_findings = _findings(actor_presence)
    assert _failing_hard(actor_presence) == {
        "progress.required",
        "adas.aeb.no_false_intervention",
    }
    assert _failing_hard_adas(actor_presence) == {"adas.aeb.no_false_intervention"}
    assert actor_findings["progress.required"]["measurement"] == {
        "availability": "AVAILABLE",
        "reason": None,
        "unit": "%",
        "value": 14.177567142144234,
    }
    assert _failing_hard(no_aeb) == set()
    assert _failing_hard_adas(no_aeb) == set()


def test_decelerating_lead_is_digest_deterministic_across_three_clean_runs(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    records: list[dict[str, object]] = []
    for index in range(3):
        artifact_root = tmp_path / f"repeat-{index}"
        artifact_root.mkdir()
        bundle = _run(
            repository_root,
            artifact_root,
            "decelerating-lead-repeat",
            "baseline",
        )
        records.append(_digest_record(bundle))

    assert records[0] == records[1] == records[2]
