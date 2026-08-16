from __future__ import annotations

import hashlib
import json
import os
from copy import deepcopy
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
    validate_plan_root,
)


def _sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def _protocol_payload() -> dict[str, object]:
    digest = "a" * 64
    payload: dict[str, object] = {
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
    candidate = payload["candidate_shield"]
    assert isinstance(candidate, dict)
    candidate["config_digest_sha256"] = _sha(_canonical(candidate["configuration"]))
    return payload


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
    candidate = protocol_payload["candidate_shield"]
    assert isinstance(candidate, dict)
    candidate_digest = candidate["config_digest_sha256"]
    assert isinstance(candidate_digest, str)
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
            "candidate_shield_config_digest_sha256": candidate_digest,
        },
        "selected_scenario_relative_path": "scenarios/lead.yaml",
    }
    (root / pair_selection).write_bytes(
        yaml.safe_dump(pair, allow_unicode=True, sort_keys=False).encode()
    )
    return protocol_selection, ledger_selection, pair_selection


def _load_plan_payloads(
    root: Path, selections: tuple[str, str, str]
) -> tuple[dict[str, object], list[dict[str, object]], dict[str, object]]:
    protocol = yaml.safe_load((root / selections[0]).read_text(encoding="utf-8"))
    ledger = [
        json.loads(line)
        for line in (root / selections[1]).read_text(encoding="utf-8").splitlines()
    ]
    pair = yaml.safe_load((root / selections[2]).read_text(encoding="utf-8"))
    assert isinstance(protocol, dict)
    assert isinstance(ledger, list)
    assert all(isinstance(item, dict) for item in ledger)
    assert isinstance(pair, dict)
    return protocol, ledger, pair


def _write_plan_payloads(
    root: Path,
    selections: tuple[str, str, str],
    protocol: dict[str, object],
    ledger: list[dict[str, object]],
    pair: dict[str, object],
    *,
    protocol_padding: int = 0,
    pair_padding: int = 0,
) -> None:
    protocol_bytes = yaml.safe_dump(protocol, allow_unicode=True, sort_keys=False).encode()
    if protocol_padding:
        protocol_bytes += b"#" + b"x" * (protocol_padding - 2) + b"\n"
    protocol_byte_digest = _sha(protocol_bytes)
    protocol_semantic_digest = _sha(_canonical(protocol))
    for entry in ledger:
        entry["protocol_byte_digest_sha256"] = protocol_byte_digest
        entry["protocol_semantic_digest_sha256"] = protocol_semantic_digest
        entry["selection_evidence_sha256"] = _sha(
            _canonical(entry["selection_observations"])
        )
    ledger_bytes = b"".join(_canonical(entry) + b"\n" for entry in ledger)
    pair["protocol_byte_digest_sha256"] = protocol_byte_digest
    pair["protocol_semantic_digest_sha256"] = protocol_semantic_digest
    pair["discovery_ledger_byte_digest_sha256"] = _sha(ledger_bytes)
    pair["discovery_ledger_semantic_digest_sha256"] = _sha(_canonical(ledger))
    selected = [entry for entry in ledger if entry["selection"]["status"] == "SELECTED"]
    if len(selected) == 1:
        selected_entry = selected[0]
        expected_pair = pair["expected_pair"]
        assert isinstance(expected_pair, dict)
        expected_pair["selected_discovery_attempt_id"] = selected_entry["attempt_id"]
        expected_pair["selected_discovery_selection_evidence_sha256"] = selected_entry[
            "selection_evidence_sha256"
        ]
        expected_pair["scenario_digest_sha256"] = selected_entry["scenario_digest_sha256"]
    pair_bytes = yaml.safe_dump(pair, allow_unicode=True, sort_keys=False).encode()
    if pair_padding:
        pair_bytes += b"#" + b"x" * (pair_padding - 2) + b"\n"
    (root / selections[0]).write_bytes(protocol_bytes)
    (root / selections[1]).write_bytes(ledger_bytes)
    (root / selections[2]).write_bytes(pair_bytes)


def _two_attempt_grid(
    root: Path, selections: tuple[str, str, str]
) -> tuple[dict[str, object], list[dict[str, object]], dict[str, object]]:
    protocol, ledger, pair = _load_plan_payloads(root, selections)
    baseline_grid = protocol["baseline_grid"]
    assert isinstance(baseline_grid, list)
    baseline_grid[0]["values"] = [8.0, 9.0]
    second = deepcopy(ledger[0])
    second["attempt_index"] = 1
    second["attempt_id"] = "attempt-0002"
    second["parameters"] = [{"parameter": "initial_gap_m", "value": 9.0}]
    second["run_id"] = "discovery-0002"
    second["artifact_locator"] = "artifacts/discovery-0002"
    second["selection"] = {
        "status": "NOT_SELECTED",
        "rank": 2,
        "tie_breaker": "GRID_ORDER",
        "rationale": "second",
    }
    ledger.append(second)
    return protocol, ledger, pair


def _many_attempt_grid(
    root: Path, selections: tuple[str, str, str], count: int
) -> tuple[dict[str, object], list[dict[str, object]], dict[str, object]]:
    protocol, original_ledger, pair = _load_plan_payloads(root, selections)
    baseline_grid = protocol["baseline_grid"]
    assert isinstance(baseline_grid, list)
    baseline_grid[0]["values"] = list(range(count))
    ledger: list[dict[str, object]] = []
    for index in range(count):
        entry = deepcopy(original_ledger[0])
        entry["attempt_index"] = index
        entry["attempt_id"] = f"attempt-{index:04d}"
        entry["parameters"] = [{"parameter": "initial_gap_m", "value": index}]
        entry["run_id"] = f"discovery-{index:04d}"
        entry["artifact_locator"] = f"artifacts/discovery-{index:04d}"
        entry["selection"] = {
            "status": "SELECTED" if index == 0 else "NOT_SELECTED",
            "rank": index + 1,
            "tie_breaker": "GRID_ORDER",
            "rationale": "first" if index == 0 else "later",
        }
        ledger.append(entry)
    return protocol, ledger, pair


def _grow_canonical_ledger_line(entry: dict[str, object], target_bytes: int) -> None:
    command = entry["command_argv"]
    assert isinstance(command, list)
    while len(_canonical(entry)) < target_bytes:
        needed = target_bytes - len(_canonical(entry))
        for index, item in enumerate(command):
            assert isinstance(item, str)
            capacity = MAX_PLAN_STRING_SCALARS - len(item)
            if capacity:
                command[index] = item + "x" * min(needed, capacity)
                break
        else:
            if needed < 4:
                last = command[-1]
                assert isinstance(last, str) and len(last) > 3
                command[-1] = last[: -(4 - needed)]
                continue
            command.append("x" * min(MAX_PLAN_STRING_SCALARS, needed - 3))
    assert len(_canonical(entry)) == target_bytes


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


def test_capture_rejects_actual_root_prefixed_selection_before_open(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    with pytest.raises(InvalidPlanError, match="exact lexical relative path"):
        capture_evaluation_plans(
            tmp_path,
            f"{tmp_path.name}/{selections[0]}",
            selections[1],
            selections[2],
        )


def test_validate_plan_root_normalizes_invalid_path_types() -> None:
    with pytest.raises(InvalidPlanError):
        validate_plan_root(object())  # type: ignore[arg-type]


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


def test_capture_rejects_previously_captured_file_replaced_during_parse(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    import hermes.adequacy.loader as loader

    original = loader._parse_yaml
    replaced = False

    def replace_then_parse(data: bytes, name: str, model_type: object) -> object:
        nonlocal replaced
        if not replaced:
            replaced = True
            replacement = tmp_path / "replacement.yaml"
            replacement.write_bytes((tmp_path / selections[0]).read_bytes())
            os.replace(replacement, tmp_path / selections[0])
        return original(data, name, model_type)  # type: ignore[arg-type]

    monkeypatch.setattr(loader, "_parse_yaml", replace_then_parse)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_capture_rejects_root_replaced_after_its_descriptor_is_opened(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "plans"
    root.mkdir()
    selections = _write_valid_plans(root)
    original_files = {selection: (root / selection).read_bytes() for selection in selections}
    import hermes.adequacy.loader as loader

    original = loader._open_plan_root
    opens = 0

    def replace_after_open(plan_root: Path) -> int:
        nonlocal opens
        descriptor = original(plan_root)
        opens += 1
        if opens == 1:
            root.rename(tmp_path / "old-plans")
            root.mkdir()
            for selection, payload in original_files.items():
                (root / selection).write_bytes(payload)
        return descriptor

    monkeypatch.setattr(loader, "_open_plan_root", replace_after_open)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(root, *selections)


def test_capture_rejects_intermediate_directory_swapped_during_parse(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    nested = tmp_path / "nested"
    nested.mkdir()
    nested_protocol = nested / "protocol.yaml"
    (tmp_path / selections[0]).replace(nested_protocol)
    nested_selections = ("nested/protocol.yaml", selections[1], selections[2])
    import hermes.adequacy.loader as loader

    original = loader._parse_yaml
    swapped = False

    def swap_then_parse(data: bytes, name: str, model_type: object) -> object:
        nonlocal swapped
        if not swapped:
            swapped = True
            nested.rename(tmp_path / "old-nested")
            nested.mkdir()
            nested_protocol.write_bytes((tmp_path / "old-nested/protocol.yaml").read_bytes())
        return original(data, name, model_type)  # type: ignore[arg-type]

    monkeypatch.setattr(loader, "_parse_yaml", swap_then_parse)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *nested_selections)


def test_capture_opens_selected_fifo_nonblocking_before_rejecting_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    (tmp_path / selections[0]).unlink()
    os.mkfifo(tmp_path / selections[0])
    import hermes.adequacy.loader as loader

    original = loader.os.open

    def require_nonblocking(path: object, flags: int, *args: object, **kwargs: object) -> int:
        if path == selections[0] and not flags & os.O_NONBLOCK:
            raise AssertionError("selected files must be opened O_NONBLOCK")
        return original(path, flags, *args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(loader.os, "open", require_nonblocking)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize("invalid_pair", [False, True])
def test_capture_closes_every_opened_descriptor_on_success_and_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, invalid_pair: bool
) -> None:
    selections = _write_valid_plans(tmp_path)
    if invalid_pair:
        pair_path = tmp_path / selections[2]
        pair_path.write_text(
            pair_path.read_text(encoding="utf-8") + "unknown_field: true\n",
            encoding="utf-8",
        )
    import hermes.adequacy.loader as loader

    original_open = loader.os.open
    original_close = loader.os.close
    opened: list[int] = []
    closed: list[int] = []

    def tracked_open(*args: object, **kwargs: object) -> int:
        descriptor = original_open(*args, **kwargs)  # type: ignore[arg-type]
        opened.append(descriptor)
        return descriptor

    def tracked_close(descriptor: int) -> None:
        closed.append(descriptor)
        original_close(descriptor)

    monkeypatch.setattr(loader.os, "open", tracked_open)
    monkeypatch.setattr(loader.os, "close", tracked_close)
    if invalid_pair:
        with pytest.raises(InvalidPlanError):
            capture_evaluation_plans(tmp_path, *selections)
    else:
        capture_evaluation_plans(tmp_path, *selections)
    assert sorted(opened) == sorted(closed)


def test_public_capture_api_refuses_parsed_plan_or_source_byte_arguments(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    with pytest.raises(TypeError):
        capture_evaluation_plans(tmp_path, *selections, protocol={})  # type: ignore[call-arg]


@pytest.mark.parametrize(
    "invalid_case",
    ["out_of_grid", "incomplete_grid", "cherry_pick", "rank", "tie_break", "multiple_selected"],
)
def test_discovery_ledger_must_be_the_exact_ordered_grid_and_first_valid_selection(
    tmp_path: Path, invalid_case: str
) -> None:
    selections = _write_valid_plans(tmp_path)
    if invalid_case == "out_of_grid":
        protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
        ledger[0]["parameters"] = [{"parameter": "initial_gap_m", "value": 9.0}]
    else:
        protocol, ledger, pair = _two_attempt_grid(tmp_path, selections)
        if invalid_case == "incomplete_grid":
            ledger.pop()
        elif invalid_case == "cherry_pick":
            ledger[0]["selection"]["status"] = "NOT_SELECTED"
            ledger[1]["selection"]["status"] = "SELECTED"
        elif invalid_case == "rank":
            ledger[0]["selection"]["rank"] = 2
        elif invalid_case == "tie_break":
            ledger[0]["selection"]["tie_breaker"] = "ATTEMPT_ID"
        else:
            ledger[1]["selection"]["status"] = "SELECTED"
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize(
    "contradiction",
    [
        "candidate_config_digest",
        "ttc_threshold",
        "hermes_identity",
        "policy_identity",
        "adapter_identity",
        "simulator_identity",
        "gate_identity",
        "registration_commit",
        "ledger_hermes_identity",
        "ledger_ttc_threshold",
    ],
)
def test_cross_record_rejects_rebound_but_semantically_contradictory_plans(
    tmp_path: Path, contradiction: str
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    expected_pair = pair["expected_pair"]
    assert isinstance(expected_pair, dict)
    if contradiction == "candidate_config_digest":
        candidate = protocol["candidate_shield"]
        assert isinstance(candidate, dict)
        configuration = candidate["configuration"]
        assert isinstance(configuration, dict)
        configuration["speed_cap_mps"] = 49.0
    elif contradiction == "ttc_threshold":
        criteria = protocol["criteria"]
        assert isinstance(criteria, dict)
        criteria["policy_input_ttc_lte_s"] = 1.9
    elif contradiction == "hermes_identity":
        expected_pair["hermes_version"] = "0.2.0"
    elif contradiction == "policy_identity":
        expected_pair["policy_name"] = "different-policy"
    elif contradiction == "adapter_identity":
        expected_pair["adapter_version"] = "2.0"
    elif contradiction == "simulator_identity":
        expected_pair["simulator_commit"] = "b" * 40
    elif contradiction == "gate_identity":
        expected_pair["gate_config_digest_sha256"] = "b" * 64
    elif contradiction == "registration_commit":
        expected_pair["implementation_base_commit"] = "b" * 40
    elif contradiction == "ledger_hermes_identity":
        environment = ledger[0]["environment"]
        assert isinstance(environment, dict)
        environment["hermes_version"] = "0.2.0"
    else:
        ledger[0]["selection_observations"][0]["threshold_machine_value"] = 1.9
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_yaml_implicit_date_is_normalized_to_invalid_plan_error(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol_path = tmp_path / selections[0]
    protocol_path.write_text(
        protocol_path.read_text(encoding="utf-8").replace(
            "expected_value: INTERNALLY_CONSISTENT", "expected_value: 2026-08-16"
        ),
        encoding="utf-8",
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize(
    "failure",
    [
        TypeError("bounded malformed value"),
        UnicodeEncodeError("utf-8", "x", 0, 1, "bounded malformed value"),
        RecursionError("bounded malformed value"),
    ],
)
def test_bounded_parse_failures_are_normalized(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: Exception
) -> None:
    selections = _write_valid_plans(tmp_path)

    def fail_canonical(_: object) -> bytes:
        raise failure

    monkeypatch.setattr("hermes.adequacy.loader._canonical_payload", fail_canonical)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize(
    "yaml_mutation",
    [
        "alias_probe: &probe [1]\nalias_copy: *probe\n",
        "tag_probe: !!str tagged\n",
    ],
)
def test_yaml_aliases_and_tags_are_rejected(tmp_path: Path, yaml_mutation: str) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol_path = tmp_path / selections[0]
    protocol_path.write_text(
        protocol_path.read_text(encoding="utf-8") + yaml_mutation,
        encoding="utf-8",
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_yaml_depth_guard_rejects_bounded_deep_input_before_model_validation(
    tmp_path: Path,
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol_path = tmp_path / selections[0]
    nested = "0"
    for _ in range(40):
        nested = f"[{nested}]"
    protocol_path.write_text(
        protocol_path.read_text(encoding="utf-8") + f"depth_probe: {nested}\n",
        encoding="utf-8",
    )
    with pytest.raises(InvalidPlanError, match="bounded depth"):
        capture_evaluation_plans(tmp_path, *selections)


def test_yaml_node_guard_isolated_from_file_and_scalar_limits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    monkeypatch.setattr("hermes.adequacy.loader._MAX_PLAN_NODES", 1)
    with pytest.raises(InvalidPlanError, match="node count"):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize(
    "invalid_case", ["unknown", "schema", "claim", "challenge", "role", "nonfinite_yaml"]
)
def test_unknown_and_unsupported_typed_plan_values_are_rejected(
    tmp_path: Path, invalid_case: str
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    if invalid_case == "unknown":
        protocol["unknown_field"] = True
    elif invalid_case == "schema":
        protocol["schema_version"] = "2.0"
    elif invalid_case == "claim":
        protocol["claim_type"] = "SAFETY_CLAIM"
    elif invalid_case == "challenge":
        planned = protocol["planned_execution"]
        assert isinstance(planned, dict)
        planned["challenge_kind"] = "cut_in"
    elif invalid_case == "role":
        expected = pair["expected_pair"]
        assert isinstance(expected, dict)
        expected["baseline_shield_name"] = "deterministic"
    else:
        protocol_path = tmp_path / selections[0]
        protocol_path.write_text(
            protocol_path.read_text(encoding="utf-8").replace(
                "expected_value: INTERNALLY_CONSISTENT", "expected_value: .inf"
            ),
            encoding="utf-8",
        )
        with pytest.raises(InvalidPlanError):
            capture_evaluation_plans(tmp_path, *selections)
        return
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_huge_json_integer_scalar_is_rejected(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    valid_rules = protocol["valid_run_rules"]
    assert isinstance(valid_rules, list)
    valid_rules[0]["expected_value"] = 2**64
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_jsonl_rejects_negative_zero_even_when_pair_digests_are_rebound(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    ledger[0]["selection_observations"][0]["threshold_machine_value"] = -0.0
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize("invalid_case", ["nonfinite", "noncanonical", "unknown"])
def test_jsonl_invalid_shape_is_rejected_after_pair_byte_digest_is_rebound(
    tmp_path: Path, invalid_case: str
) -> None:
    selections = _write_valid_plans(tmp_path)
    _, ledger, pair = _load_plan_payloads(tmp_path, selections)
    if invalid_case == "nonfinite":
        canonical = _canonical(ledger[0])
        ledger_bytes = canonical.replace(
            b'"threshold_machine_value":2.0', b'"threshold_machine_value":NaN'
        ) + b"\n"
    elif invalid_case == "noncanonical":
        ledger_bytes = json.dumps(ledger[0], ensure_ascii=False, sort_keys=True).encode() + b"\n"
    else:
        ledger[0]["unknown_field"] = True
        ledger_bytes = _canonical(ledger[0]) + b"\n"
    (tmp_path / selections[1]).write_bytes(ledger_bytes)
    pair["discovery_ledger_byte_digest_sha256"] = _sha(ledger_bytes)
    (tmp_path / selections[2]).write_text(
        yaml.safe_dump(pair, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_jsonl_duplicate_key_is_rejected_after_pair_byte_digest_is_rebound(
    tmp_path: Path,
) -> None:
    selections = _write_valid_plans(tmp_path)
    _, ledger, pair = _load_plan_payloads(tmp_path, selections)
    ledger_bytes = b'{"schema_version":"1.0",' + _canonical(ledger[0])[1:] + b"\n"
    (tmp_path / selections[1]).write_bytes(ledger_bytes)
    pair["discovery_ledger_byte_digest_sha256"] = _sha(ledger_bytes)
    (tmp_path / selections[2]).write_text(
        yaml.safe_dump(pair, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize("separator", [b"\r\n", b"\x0b"])
def test_jsonl_rejects_non_lf_record_separators_with_rebound_byte_digest(
    tmp_path: Path, separator: bytes
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _two_attempt_grid(tmp_path, selections)
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    canonical_lines = [_canonical(entry) for entry in ledger]
    ledger_bytes = separator.join(canonical_lines) + b"\n"
    (tmp_path / selections[1]).write_bytes(ledger_bytes)
    pair["discovery_ledger_byte_digest_sha256"] = _sha(ledger_bytes)
    (tmp_path / selections[2]).write_text(
        yaml.safe_dump(pair, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_resource_constants_are_frozen() -> None:
    assert MAX_PLAN_FILE_BYTES == 1 * 1024 * 1024
    assert MAX_PLAN_TOTAL_BYTES == 3 * 1024 * 1024
    assert MAX_PLAN_LINE_BYTES == 64 * 1024
    assert MAX_DISCOVERY_ATTEMPTS == 1024
    assert MAX_PLAN_STRING_SCALARS == 4096


def test_file_size_exact_boundary_is_accepted_and_plus_one_is_rejected(
    tmp_path: Path,
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    pair_size = len(yaml.safe_dump(pair, allow_unicode=True, sort_keys=False).encode())
    padding = MAX_PLAN_FILE_BYTES - pair_size
    _write_plan_payloads(
        tmp_path, selections, protocol, ledger, pair, pair_padding=padding
    )
    assert (tmp_path / selections[2]).stat().st_size == MAX_PLAN_FILE_BYTES
    capture_evaluation_plans(tmp_path, *selections)
    _write_plan_payloads(
        tmp_path, selections, protocol, ledger, pair, pair_padding=padding + 1
    )
    with pytest.raises(InvalidPlanError):
        capture_evaluation_plans(tmp_path, *selections)


def test_total_size_guard_isolated_exact_boundary_and_plus_one(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    selections = _write_valid_plans(tmp_path)
    total = sum((tmp_path / selection).stat().st_size for selection in selections)
    monkeypatch.setattr("hermes.adequacy.loader.MAX_PLAN_TOTAL_BYTES", total)
    capture_evaluation_plans(tmp_path, *selections)
    monkeypatch.setattr("hermes.adequacy.loader.MAX_PLAN_TOTAL_BYTES", total - 1)
    with pytest.raises(InvalidPlanError, match="maximum total size"):
        capture_evaluation_plans(tmp_path, *selections)


def test_frozen_total_size_exact_boundary_is_reachable_and_accepted(tmp_path: Path) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _many_attempt_grid(tmp_path, selections, 32)
    line_size = MAX_PLAN_FILE_BYTES // len(ledger) - 1
    for entry in ledger:
        _grow_canonical_ledger_line(entry, line_size)
    protocol_size = len(yaml.safe_dump(protocol, allow_unicode=True, sort_keys=False).encode())
    _write_plan_payloads(
        tmp_path,
        selections,
        protocol,
        ledger,
        pair,
        protocol_padding=MAX_PLAN_FILE_BYTES - protocol_size,
    )
    pair_size = (tmp_path / selections[2]).stat().st_size
    _write_plan_payloads(
        tmp_path,
        selections,
        protocol,
        ledger,
        pair,
        protocol_padding=MAX_PLAN_FILE_BYTES - protocol_size,
        pair_padding=MAX_PLAN_FILE_BYTES - pair_size,
    )
    sizes = tuple((tmp_path / selection).stat().st_size for selection in selections)
    assert sizes == (MAX_PLAN_FILE_BYTES,) * 3
    assert sum(sizes) == MAX_PLAN_TOTAL_BYTES
    capture_evaluation_plans(tmp_path, *selections)


def test_jsonl_line_exact_boundary_is_accepted_and_plus_one_is_rejected(
    tmp_path: Path,
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    _grow_canonical_ledger_line(ledger[0], MAX_PLAN_LINE_BYTES)
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    assert len((tmp_path / selections[1]).read_bytes()[:-1]) == MAX_PLAN_LINE_BYTES
    capture_evaluation_plans(tmp_path, *selections)
    _grow_canonical_ledger_line(ledger[0], MAX_PLAN_LINE_BYTES + 1)
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError, match="invalid line"):
        capture_evaluation_plans(tmp_path, *selections)


def test_attempt_count_exact_boundary_is_accepted_and_plus_one_is_rejected(
    tmp_path: Path,
) -> None:
    selections = _write_valid_plans(tmp_path)
    _, ledger, _ = _many_attempt_grid(tmp_path, selections, MAX_DISCOVERY_ATTEMPTS)
    import hermes.adequacy.loader as loader

    ledger_bytes = b"".join(_canonical(entry) + b"\n" for entry in ledger)
    assert len(loader._parse_ledger(ledger_bytes, selections[1])) == MAX_DISCOVERY_ATTEMPTS
    extra = deepcopy(ledger[-1])
    extra["attempt_index"] = MAX_DISCOVERY_ATTEMPTS
    extra["attempt_id"] = "attempt-1024"
    extra["run_id"] = "discovery-1024"
    extra["artifact_locator"] = "artifacts/discovery-1024"
    extra["selection"]["rank"] = MAX_DISCOVERY_ATTEMPTS + 1
    plus_one = ledger_bytes + _canonical(extra) + b"\n"
    with pytest.raises(InvalidPlanError, match="attempt count"):
        loader._parse_ledger(plus_one, selections[1])


def test_string_scalar_exact_boundary_is_accepted_and_plus_one_is_rejected(
    tmp_path: Path,
) -> None:
    selections = _write_valid_plans(tmp_path)
    protocol, ledger, pair = _load_plan_payloads(tmp_path, selections)
    ledger[0]["exclusion"]["rationale"] = "x" * MAX_PLAN_STRING_SCALARS
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    capture_evaluation_plans(tmp_path, *selections)
    ledger[0]["exclusion"]["rationale"] += "x"
    _write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError, match="string scalar"):
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
