"""The measured steady-lead pair must extend the existing geometry oracle.

The challenge kind and verifier are shared.  Threat versus nominal behavior must come
from stored geometry, while actor speed remains constant under scripted replay.
``adas.fcw.warning_timing`` remains a geometry-coverage check, not proof of warning output.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from hermes.domain.enums import FindingStatus
from hermes.evidence.trace import _geometry_agrees

pytestmark = pytest.mark.metadrive

GATE = Path("config") / "gates.adas.yaml"
THREAT = Path("scenarios") / "adas" / "slow_lead_closing.yaml"
NOMINAL = Path("scenarios") / "adas" / "fcw_aeb_nominal_following.yaml"


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _run(repository_root: Path, artifact_root: Path, run_id: str, scenario: Path, config: str):
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


def test_oracle_separates_steady_pair_and_stores_constant_threat_actor_speed(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    threat_bundle = _run(repository_root, artifact_root, "steady-threat", THREAT, "baseline")
    nominal_bundle = _run(
        repository_root, artifact_root, "steady-nominal", NOMINAL, "baseline"
    )
    threat = _findings(threat_bundle)
    nominal = _findings(nominal_bundle)

    assert threat["adas.aeb.threat_response"]["measurement"]["value"] > 0
    assert nominal["adas.aeb.threat_response"]["measurement"]["value"] == 0
    assert threat["adas.aeb.threat_response"]["status"] == FindingStatus.PASS.value
    assert nominal["adas.aeb.no_false_intervention"]["status"] == FindingStatus.PASS.value

    for event in _events(threat_bundle):
        summary = event["observation_summary"]
        assert _geometry_agrees(summary["challenge_actor_speed_mps"], 10.0)
        assert _geometry_agrees(summary["result_challenge_actor_speed_mps"], 10.0)


def test_steady_pair_is_complementary_for_opposite_defects(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    actor_presence_on_threat = _run(
        repository_root,
        artifact_root,
        "steady-actor-presence-threat",
        THREAT,
        "defect_actor_presence_braking",
    )
    no_aeb_on_nominal = _run(
        repository_root,
        artifact_root,
        "steady-no-aeb-nominal",
        NOMINAL,
        "defect_no_aeb",
    )
    no_aeb_on_threat = _run(
        repository_root,
        artifact_root,
        "steady-no-aeb-threat",
        THREAT,
        "defect_no_aeb",
    )
    actor_presence_on_nominal = _run(
        repository_root,
        artifact_root,
        "steady-actor-presence-nominal",
        NOMINAL,
        "defect_actor_presence_braking",
    )

    assert _failing_hard_adas(actor_presence_on_threat) == set()
    assert _failing_hard_adas(no_aeb_on_nominal) == set()
    assert _failing_hard_adas(no_aeb_on_threat) == {"adas.aeb.threat_response"}
    assert _failing_hard_adas(actor_presence_on_nominal) == {
        "adas.aeb.no_false_intervention"
    }


def test_steady_threat_is_digest_deterministic_across_three_clean_runs(
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
            "steady-repeat",
            THREAT,
            "baseline",
        )
        manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        records.append(
            {
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
        )

    assert records[0] == records[1] == records[2]
