from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from hermes.cli import app
from hermes.evidence.canonical import canonical_json_bytes
from hermes.runtime.orchestrator import execute_fake_run
from hermes.shields.config import load_shield_config
from hermes.shields.deterministic import DeterministicSafetyShield

runner = CliRunner()


def _comparable_bundles(repository_root: Path, tmp_path: Path) -> tuple[Path, Path]:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    common = {
        "scenario_path": repository_root / "scenarios" / "fake_nominal.yaml",
        "gate_config_path": repository_root / "config" / "gates.phase1.yaml",
        "seed": 7,
        "artifact_root": artifacts,
        "repository_root": repository_root,
    }
    baseline = execute_fake_run(run_id="compare-baseline", **common).artifact_path
    config = load_shield_config(repository_root / "config" / "shield.phase3.yaml")
    candidate = execute_fake_run(
        run_id="compare-shielded",
        shield_factory=lambda: DeterministicSafetyShield(config),
        **common,
    ).artifact_path
    return baseline, candidate


def test_compare_command_emits_canonical_json_for_compatible_verified_artifacts(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    baseline, candidate = _comparable_bundles(repository_root, tmp_path)

    result = runner.invoke(
        app,
        ["compare", str(baseline), str(candidate), "--format", "json"],
    )

    assert result.exit_code == 0
    payload = json.loads(result.output)
    assert payload["compatibility"]["comparable"] is True
    assert payload["baseline_path"] == str(baseline)
    assert any(item["name"] == "shield_interventions" for item in payload["dimensions"])


def test_compare_command_maps_invalid_and_incompatible_artifacts_to_stable_exits(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    baseline, candidate = _comparable_bundles(repository_root, tmp_path)
    (candidate / "metrics.json").write_text("{}\n", encoding="utf-8")

    invalid = runner.invoke(app, ["compare", str(baseline), str(candidate)])
    invalid_json = runner.invoke(
        app,
        ["compare", str(baseline), str(candidate), "--format", "json"],
    )

    artifacts = tmp_path / "incompatible"
    artifacts.mkdir()
    collision = execute_fake_run(
        scenario_path=repository_root / "scenarios" / "fake_collision.yaml",
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id="collision",
        artifact_root=artifacts,
        repository_root=repository_root,
    ).artifact_path
    incompatible = runner.invoke(app, ["compare", str(baseline), str(collision)])
    incompatible_json = runner.invoke(
        app,
        ["compare", str(baseline), str(collision), "--format", "json"],
    )

    assert invalid.exit_code == 30
    assert "INVALID_EVIDENCE" in invalid.output
    assert invalid_json.exit_code == 30
    assert json.loads(invalid_json.output)["error"] == "INVALID_EVIDENCE"
    assert incompatible.exit_code == 40
    assert "scenario digest differs" in incompatible.output
    assert incompatible_json.exit_code == 40
    incompatible_payload = json.loads(incompatible_json.output)
    assert incompatible_json.output == (
        canonical_json_bytes(incompatible_payload).decode("utf-8") + "\n"
    )
    assert incompatible_payload["error"] == "INCOMPATIBLE_EVIDENCE"
    assert incompatible_payload["exit_code"] == 40
    assert incompatible_payload["details"]["comparison"]["compatibility"][
        "comparable"
    ] is False
    assert any(
        "scenario digest differs" in reason
        for reason in incompatible_payload["details"]["comparison"]["compatibility"][
            "reasons"
        ]
    )
