from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
import yaml

from hermes.adequacy.loader import (
    MAX_DISCOVERY_ATTEMPTS,
    MAX_PLAN_FILE_BYTES,
    MAX_PLAN_LINE_BYTES,
    MAX_PLAN_STRING_SCALARS,
    MAX_PLAN_TOTAL_BYTES,
    InvalidPlanError,
    capture_evaluation_plans,
)


def _sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def _protocol_payload() -> dict[str, object]:
    digest = "a" * 64
    return {
        "schema_version": "1.0",
        "protocol_id": "lead_ttc_engagement",
        "protocol_version": "1.0",
        "label": "illustrative_simulation_only_declared_question",
        "scope": "SIMULATION_ONLY",
        "claim_type": "LEAD_TTC_INTERVENTION_ENGAGEMENT",
        "criteria": {
            "required_phase": "BRAKING",
            "minimum_phase_samples_per_arm": 10,
            "policy_input_ttc_lte_s": 2.0,
            "candidate_required_override_reason": "TTC_BELOW_THRESHOLD",
            "minimum_target_override_events": 1,
            "prohibit_non_target_reasons_through_first_target_response": True,
            "minimum_post_response_decision_steps": 1,
            "actuation_delay_compensation_s": 0.0,
        },
        "baseline_grid": [
            {
                "parameter": "initial_gap_m",
                "scenario_field": "challenge.initial_gap_m",
                "values": [8.0],
            }
        ],
        "selection_rule": {
            "rule_id": "FIRST_VALID_BY_GRID_ORDER",
            "metric": "POLICY_INPUT_TTC_BAND_ENTRY",
            "direction": "FIRST_MATCH",
            "tie_breakers": ["GRID_ORDER", "ATTEMPT_ID"],
        },
        "valid_run_rules": [
            {
                "rule_id": "INTERNALLY_CONSISTENT",
                "observation": "INTEGRITY",
                "operator": "EQ",
                "expected_value": "INTERNALLY_CONSISTENT",
            }
        ],
        "exclusion_rules": [
            {
                "rule_id": "INVALID_EVIDENCE",
                "observation": "INTEGRITY",
                "operator": "EQ",
                "excluded_value": "INVALID_EVIDENCE",
            }
        ],
        "materializer": {
            "version": "1.0",
            "mappings": [
                {"parameter": "initial_gap_m", "scenario_field": "challenge.initial_gap_m"}
            ],
        },
        "candidate_shield": {
            "name": "deterministic",
            "version": "1.0",
            "config_digest_sha256": digest,
            "configuration": {
                "schema_version": "1.0",
                "name": "phase3_deterministic",
                "version": "1.0",
                "label": "illustrative_simulation_only_not_real_vehicle_limits",
                "ttc_threshold_s": 2.0,
                "speed_cap_mps": 50.0,
                "max_observation_age_s": 1.0,
                "boundary_margin_m": 0.25,
                "actuation_delay_compensation_s": 0.0,
                "emergency_stop_active": False,
                "full_brake_command": 1.0,
                "boundary_steering_command": 0.5,
            },
        },
        "expected_components": {
            "hermes_version": "0.1.0",
            "policy": {
                "component": "POLICY",
                "name": "metadrive-idm",
                "version": "1.0",
                "config_digest_sha256": digest,
                "source_commit": None,
            },
            "adapter": {
                "component": "ADAPTER",
                "name": "metadrive",
                "version": "1.1",
                "config_digest_sha256": digest,
                "source_commit": None,
            },
            "simulator": {
                "component": "SIMULATOR",
                "name": "metadrive",
                "version": "0.4.3",
                "config_digest_sha256": None,
                "source_commit": "85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
            },
            "gate": {
                "component": "GATE",
                "name": "phase2",
                "version": "1.0",
                "config_digest_sha256": digest,
                "source_commit": None,
            },
        },
        "planned_execution": {
            "seed": 7,
            "control_frequency_hz": 10,
            "horizon_steps": 300,
            "challenge_kind": "lead_vehicle_hard_brake",
        },
        "registration": {"repository_relative_path": "evaluation-plans/lead.protocol.v1.yaml"},
    }


def _write_valid_plans(root: Path) -> tuple[str, str, str]:
    protocol_selection = "lead.protocol.v1.yaml"
    ledger_selection = "lead.discovery.v1.jsonl"
    pair_selection = "lead.pair.v1.yaml"
    protocol_payload = _protocol_payload()
    protocol_bytes = yaml.safe_dump(protocol_payload, allow_unicode=True, sort_keys=False).encode()
    (root / protocol_selection).write_bytes(protocol_bytes)
    protocol_semantic = _sha(_canonical(protocol_payload))
    observation = {
        "observation_id": "minimum_policy_input_ttc_s",
        "machine_value": 1.5,
        "canonical_value": "1.5",
        "display_value": "1.5",
        "unit": "s",
        "operator": "LTE",
        "threshold_machine_value": 2.0,
        "sequence": 35,
    }
    selection_digest = _sha(_canonical([observation]))
    digest = "a" * 64
    commit = "a" * 40
    ledger = {
        "schema_version": "1.0",
        "attempt_index": 0,
        "attempt_id": "attempt-0001",
        "protocol_byte_digest_sha256": _sha(protocol_bytes),
        "protocol_semantic_digest_sha256": protocol_semantic,
        "registration_commit": commit,
        "parameters": [{"parameter": "initial_gap_m", "value": 8.0}],
        "command_argv": ["python", "-m", "hermes", "run"],
        "environment": {
            "hermes_version": "0.1.0",
            "python_version": "3.11.15",
            "platform": "macOS",
            "architecture": "arm64",
            "repository_commit": commit,
            "repository_dirty": False,
        },
        "run_id": "discovery-0001",
        "artifact_locator": "artifacts/discovery-0001",
        "scenario_byte_digest_sha256": digest,
        "scenario_digest_sha256": digest,
        "bundle_digest_sha256": digest,
        "trace_digest_sha256": digest,
        "verification_status": "INTERNALLY_CONSISTENT",
        "selection_observations": [observation],
        "selection_evidence_sha256": selection_digest,
        "exclusion": {
            "valid_run": True,
            "disposition": "INCLUDED",
            "rule_id": "NONE",
            "rationale": "valid",
        },
        "selection": {
            "status": "SELECTED",
            "rank": 1,
            "tie_breaker": "GRID_ORDER",
            "rationale": "first",
        },
    }
    ledger_bytes = _canonical(ledger) + b"\n"
    (root / ledger_selection).write_bytes(ledger_bytes)
    pair = {
        "schema_version": "1.0",
        "pair_plan_id": "lead_pair",
        "protocol_byte_digest_sha256": _sha(protocol_bytes),
        "protocol_semantic_digest_sha256": protocol_semantic,
        "discovery_ledger_byte_digest_sha256": _sha(ledger_bytes),
        "discovery_ledger_semantic_digest_sha256": _sha(_canonical([ledger])),
        "expected_pair": {
            "baseline_run_id": "handoff-p7-lead-baseline",
            "candidate_run_id": "handoff-p7-lead-candidate",
            "selected_discovery_attempt_id": "attempt-0001",
            "selected_discovery_selection_evidence_sha256": selection_digest,
            "scenario_digest_sha256": digest,
            "challenge_kind": "lead_vehicle_hard_brake",
            "seed": 7,
            "control_frequency_hz": 10,
            "horizon_steps": 300,
            "hermes_version": "0.1.0",
            "implementation_base_commit": commit,
            "require_repository_dirty": False,
            "policy_name": "metadrive-idm",
            "policy_version": "1.0",
            "policy_config_digest_sha256": digest,
            "adapter_name": "metadrive",
            "adapter_version": "1.1",
            "adapter_config_digest_sha256": digest,
            "simulator_name": "metadrive",
            "simulator_version": "0.4.3",
            "simulator_commit": "85e5dadc6c7436d324348f6e3d8f8e680c06b4db",
            "gate_name": "phase2",
            "gate_version": "1.0",
            "gate_config_digest_sha256": digest,
            "baseline_shield_name": "noop",
            "baseline_shield_version": "1.0",
            "baseline_shield_config_digest_sha256": digest,
            "candidate_shield_name": "deterministic",
            "candidate_shield_version": "1.0",
            "candidate_shield_config_digest_sha256": digest,
        },
        "selected_scenario_relative_path": "scenarios/lead.yaml",
    }
    (root / pair_selection).write_bytes(
        yaml.safe_dump(pair, allow_unicode=True, sort_keys=False).encode()
    )
    return protocol_selection, ledger_selection, pair_selection


def test_capture_plans_is_ordered_no_scan_and_returns_deterministic_identities(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    monkeypatch.setattr(
        "hermes.adequacy.loader.os.listdir", lambda *_: pytest.fail("directory scan")
    )
    first = capture_evaluation_plans(tmp_path, *selections)
    second = capture_evaluation_plans(tmp_path, *selections)
    assert tuple(source.relative_path for source in first.sources) == selections
    assert first == second
    assert first.protocol.protocol_id == "lead_ttc_engagement"
    assert first.ledger[0].attempt_id == "attempt-0001"
    assert first.pair_plan.expected_pair.selected_discovery_attempt_id == "attempt-0001"


@pytest.mark.parametrize(
    "selection", ["", ".", "/absolute", "plans/file", "a//b", "a\\b", "a\x00b", "a/../b"]
)
def test_capture_rejects_nonexact_selection(tmp_path: Path, selection: str) -> None:
    selections = _write_valid_plans(tmp_path)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, selection, selections[1], selections[2])


def test_capture_rejects_symlink_selection_and_cross_record_digest_mismatch(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    (tmp_path / "link.yaml").symlink_to(tmp_path / selections[0])
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, "link.yaml", selections[1], selections[2])
    pair_path = tmp_path / selections[2]
    pair_path.write_text(pair_path.read_text().replace("a" * 64, "b" * 64, 1), encoding="utf-8")
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_capture_rejects_symlink_root_and_intermediate_directory(tmp_path: Path) -> None:
    root = tmp_path / "plans"
    root.mkdir()
    selections = _write_valid_plans(root)
    root_link = tmp_path / "plans-link"
    root_link.symlink_to(root, target_is_directory=True)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(root_link, *selections)
    nested = root / "nested"
    nested.mkdir()
    (nested / "protocol.yaml").write_bytes((root / selections[0]).read_bytes())
    (root / "nested-link").symlink_to(nested, target_is_directory=True)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(root, "nested-link/protocol.yaml", selections[1], selections[2])


def test_capture_rejects_file_mutated_between_stable_reads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    import hermes.adequacy.loader as loader

    original = loader._read_exact
    calls = 0

    def mutate_after_first_read(descriptor: int, size: int) -> bytes:
        nonlocal calls
        calls += 1
        result = original(descriptor, size)
        if calls == 1:
            (tmp_path / selections[0]).write_bytes(result + b"# mutation\n")
        return result

    monkeypatch.setattr(loader, "_read_exact", mutate_after_first_read)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_public_capture_api_refuses_parsed_plan_or_source_byte_arguments(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    with pytest.raises(TypeError):
        capture_evaluation_plans(tmp_path, *selections, protocol={})  # type: ignore[call-arg]


@pytest.mark.parametrize(
    "attribute,limit",
    [
        ("file", MAX_PLAN_FILE_BYTES),
        ("total", MAX_PLAN_TOTAL_BYTES),
        ("line", MAX_PLAN_LINE_BYTES),
        ("attempt", MAX_DISCOVERY_ATTEMPTS),
        ("scalar", MAX_PLAN_STRING_SCALARS),
    ],
)
def test_plan_limits_are_enforced_at_boundary_plus_one(
    attribute: str, limit: int, tmp_path: Path
) -> None:
    selections = _write_valid_plans(tmp_path)
    if attribute == "file":
        (tmp_path / selections[0]).write_bytes(b"x" * (limit + 1))
    elif attribute == "total":
        for selection in selections:
            (tmp_path / selection).write_bytes(b"x" * (limit // 3 + 1))
    elif attribute == "line":
        (tmp_path / selections[1]).write_bytes(b"x" * (limit + 1) + b"\n")
    elif attribute == "attempt":
        (tmp_path / selections[1]).write_bytes(
            (tmp_path / selections[1]).read_bytes() * (limit + 1)
        )
    else:
        (tmp_path / selections[0]).write_text("x" * (limit + 1), encoding="utf-8")
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_capture_normalizes_duplicate_bom_and_noncanonical_jsonl_failures(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    (tmp_path / selections[0]).write_text(
        "schema_version: '1.0'\nschema_version: '1.0'\n", encoding="utf-8"
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)
    _write_valid_plans(tmp_path)
    (tmp_path / selections[1]).write_bytes(b"\xef\xbb\xbf{}\n")
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)
