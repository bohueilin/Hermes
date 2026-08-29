"""The moving mirrored tuple must separate threat from adjacent-lane nominal geometry.

The scenario numbers match ``slow_lead_closing`` while lane placement alone removes the
front pair.  Actor presence remains measured through the overtake crossing, and
``adas.fcw.warning_timing`` remains geometry coverage rather than warning-output proof.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from hermes.domain.enums import FindingStatus
from hermes.evidence.trace import _geometry_agrees
from hermes.scenarios.loader import load_scenario

pytestmark = pytest.mark.metadrive

GATE = Path("config") / "gates.adas.yaml"
THREAT = Path("scenarios") / "adas" / "slow_lead_closing.yaml"
NOMINAL = Path("scenarios") / "adas" / "adjacent_lane_pass.yaml"


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _run(
    repository_root: Path,
    artifact_root: Path,
    run_id: str,
    scenario: Path,
    config: str,
) -> Path:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    controller = load_adas_config(repository_root / "config" / "adas" / f"{config}.yaml")
    execute_metadrive_run(
        scenario_path=repository_root / scenario,
        gate_config_path=repository_root / GATE,
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(controller),
    )
    return artifact_root / run_id


def _findings(bundle: Path) -> dict[str, dict]:
    document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    items = document["findings"] if isinstance(document, dict) else document
    return {item["finding_id"]: item for item in items}


def _failing_hard_adas(bundle: Path) -> set[str]:
    return {
        finding_id
        for finding_id, item in _findings(bundle).items()
        if finding_id.startswith("adas.")
        and item["hard_invariant"]
        and item["status"] == FindingStatus.FAIL.value
    }


def _events(bundle: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]


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


def test_oracle_separates_the_moving_mirrored_tuple_by_lane_placement(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    nominal_bundle = _run(
        repository_root, artifact_root, "adjacent-pass-nominal", NOMINAL, "baseline"
    )
    threat_bundle = _run(
        repository_root, artifact_root, "adjacent-pass-threat", THREAT, "baseline"
    )
    nominal_findings = _findings(nominal_bundle)
    threat_findings = _findings(threat_bundle)

    nominal = load_scenario(repository_root / NOMINAL)
    threat = load_scenario(repository_root / THREAT)
    assert nominal.control == threat.control
    assert nominal.initial_state == threat.initial_state
    assert nominal.road == threat.road
    assert nominal.challenge is not None
    assert threat.challenge is not None
    assert nominal.challenge.actor_speed_mps == threat.challenge.actor_speed_mps == 10.0
    assert nominal.challenge.initial_gap_m == threat.challenge.initial_gap_m == 32.0
    assert nominal.challenge.initial_lane_delta == 1
    assert threat.challenge.initial_lane_delta == 0

    assert nominal_findings["adas.aeb.threat_response"]["measurement"]["value"] == 0
    assert (
        nominal_findings["adas.aeb.no_false_intervention"]["status"]
        == FindingStatus.PASS.value
    )
    assert threat_findings["adas.aeb.threat_response"]["measurement"]["value"] > 0


def test_adjacent_pass_is_complementary_for_opposite_defects(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    actor_presence = _run(
        repository_root,
        artifact_root,
        "adjacent-pass-actor-presence",
        NOMINAL,
        "defect_actor_presence_braking",
    )
    no_aeb = _run(
        repository_root,
        artifact_root,
        "adjacent-pass-no-aeb",
        NOMINAL,
        "defect_no_aeb",
    )

    assert _failing_hard_adas(actor_presence) == {
        "adas.aeb.no_false_intervention"
    }
    assert _failing_hard_adas(no_aeb) == set()


def test_adjacent_pass_stores_no_front_pair_through_the_overtake_crossing(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    bundle = _run(
        repository_root, artifact_root, "adjacent-pass-crossing", NOMINAL, "baseline"
    )
    events = _events(bundle)

    front_keys = (
        "front_distance_m",
        "front_relative_speed_mps",
        "result_front_distance_m",
        "result_front_relative_speed_mps",
    )
    for event in events:
        summary = event["observation_summary"]
        for key in front_keys:
            assert summary[key] is None
        assert _geometry_agrees(summary["challenge_actor_speed_mps"], 10.0)
        assert _geometry_agrees(summary["result_challenge_actor_speed_mps"], 10.0)

    scenario = load_scenario(repository_root / NOMINAL)
    assert scenario.challenge is not None
    first_summary = events[0]["observation_summary"]
    assert events[0]["sequence"] == 0
    assert _geometry_agrees(
        first_summary["challenge_actor_lateral_offset_m"],
        -scenario.challenge.initial_lane_delta * 3.5,
    )
    assert first_summary["challenge_actor_longitudinal_m"] > 0
    negative_sequences = [
        event["sequence"]
        for event in events
        if event["observation_summary"]["challenge_actor_longitudinal_m"] < 0
    ]
    assert negative_sequences
    assert min(negative_sequences) > events[0]["sequence"]


def test_adjacent_pass_is_digest_deterministic_across_three_clean_runs(
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
            "adjacent-pass-repeat",
            NOMINAL,
            "baseline",
        )
        records.append(_digest_record(bundle))

    assert records[0] == records[1] == records[2]
