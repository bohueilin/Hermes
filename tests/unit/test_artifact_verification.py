from __future__ import annotations

import hashlib
import json
import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from pathlib import Path

import pytest

from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.evidence.verification import verify_artifact
from hermes.runtime.orchestrator import execute_fake_run
from hermes.shields.config import load_shield_config
from hermes.shields.deterministic import DeterministicSafetyShield


def _nominal_bundle(repository_root: Path, tmp_path: Path) -> Path:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    return execute_fake_run(
        scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id="nominal-source",
        artifact_root=artifacts,
        repository_root=repository_root,
    ).artifact_path


def _copy_bundle(source: Path, tmp_path: Path, name: str) -> Path:
    target = tmp_path / name
    shutil.copytree(source, target)
    return target


def _shield_bundle(repository_root: Path, tmp_path: Path) -> Path:
    artifacts = tmp_path / "shield-artifacts"
    artifacts.mkdir()
    config = load_shield_config(repository_root / "config" / "shield.phase3.yaml")
    return execute_fake_run(
        scenario_path=repository_root / "scenarios" / "fake_nominal.yaml",
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id="shield-source",
        artifact_root=artifacts,
        repository_root=repository_root,
        shield_factory=lambda: DeterministicSafetyShield(config),
    ).artifact_path


def _canonical(value) -> bytes:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _refresh_envelope(bundle: Path) -> None:
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for filename in manifest["file_digests"]:
        manifest["file_digests"][filename] = _sha((bundle / filename).read_bytes())
    manifest_path.write_bytes(_canonical(manifest) + b"\n")
    files = {
        path.name: path.read_bytes()
        for path in bundle.iterdir()
        if path.name != "bundle.sha256"
    }
    entries = [
        {"name": name, "size_bytes": len(payload), "sha256": _sha(payload)}
        for name, payload in sorted(files.items())
    ]
    detached = _sha(_canonical({"domain": "hermes.bundle.v1", "files": entries}))
    (bundle / "bundle.sha256").write_text(detached + "\n", encoding="ascii")


def _rehash_events(bundle: Path, events: list[dict]) -> None:
    previous = "0" * 64
    for event in events:
        event["previous_hash"] = previous
        material = dict(event)
        material.pop("current_hash", None)
        event["current_hash"] = _sha(_canonical(material))
        previous = event["current_hash"]
    (bundle / "events.jsonl").write_bytes(
        b"".join(_canonical(event) + b"\n" for event in events)
    )
    (bundle / "trace.sha256").write_text(previous + "\n", encoding="ascii")
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["trace_digest"] = previous
    manifest_path.write_bytes(_canonical(manifest) + b"\n")
    _refresh_envelope(bundle)


def test_modified_action_reports_first_hash_mismatch_sequence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "tampered-action")
    lines = (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    event = json.loads(lines[0])
    event["executed_action"] = {"steering": 0.0, "throttle": 0.0, "brake": 0.5}
    lines[0] = json.dumps(event, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    (tampered / "events.jsonl").write_text("\n".join(lines) + "\n", encoding="utf-8")

    result = verify_artifact(tampered)

    assert result.integrity is IntegrityStatus.INVALID
    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert result.first_mismatch_sequence == 0
    assert "current hash mismatch at sequence 0" in " ".join(result.errors)


@pytest.mark.parametrize(
    "filename, mutation",
    [
        ("scenario.resolved.yaml", "\n# modified\n"),
        ("gate-config.resolved.yaml", "\n# modified\n"),
        ("metrics.json", " \n"),
        ("findings.json", " \n"),
        ("verdict.json", " \n"),
        ("trace.sha256", "0"),
        ("execution-context.json", " \n"),
    ],
)
def test_any_modified_stored_decision_input_or_output_is_invalid(
    repository_root: Path,
    tmp_path: Path,
    filename: str,
    mutation: str,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, f"tampered-{filename.split('.')[0]}")
    path = tampered / filename
    path.write_text(path.read_text(encoding="utf-8") + mutation, encoding="utf-8")

    result = verify_artifact(tampered)

    assert result.integrity is IntegrityStatus.INVALID
    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert any(filename in error for error in result.errors)


def test_missing_truncated_and_duplicate_events_are_invalid(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    missing = _copy_bundle(source, tmp_path, "missing-events")
    (missing / "events.jsonl").unlink()
    truncated = _copy_bundle(source, tmp_path, "truncated-events")
    lines = (truncated / "events.jsonl").read_text(encoding="utf-8").splitlines()
    (truncated / "events.jsonl").write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")
    duplicate = _copy_bundle(source, tmp_path, "duplicate-events")
    (duplicate / "events.jsonl").write_text(
        "\n".join([lines[0], lines[0], *lines[1:]]) + "\n",
        encoding="utf-8",
    )

    assert verify_artifact(missing).verdict is Verdict.INVALID_EVIDENCE
    assert verify_artifact(truncated).verdict is Verdict.INVALID_EVIDENCE
    duplicate_result = verify_artifact(duplicate)
    assert duplicate_result.verdict is Verdict.INVALID_EVIDENCE
    assert duplicate_result.first_mismatch_sequence == 1


def test_manifest_only_tamper_and_unlisted_file_are_invalid(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    manifest_tamper = _copy_bundle(source, tmp_path, "manifest-tamper")
    manifest = json.loads((manifest_tamper / "manifest.json").read_text(encoding="utf-8"))
    manifest["policy_version"] = "forged"
    (manifest_tamper / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )
    extra_file = _copy_bundle(source, tmp_path, "extra-file")
    (extra_file / "unlisted.bak").write_text("extra\n", encoding="utf-8")

    manifest_result = verify_artifact(manifest_tamper)
    extra_result = verify_artifact(extra_file)

    assert manifest_result.verdict is Verdict.INVALID_EVIDENCE
    assert "bundle.sha256" in " ".join(manifest_result.errors)
    assert extra_result.verdict is Verdict.INVALID_EVIDENCE
    assert "unexpected" in " ".join(extra_result.errors)


def test_fifo_artifact_entry_returns_invalid_without_blocking(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "fifo-entry")
    fifo = tampered / "metrics.json"
    fifo.unlink()
    os.mkfifo(fifo)

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(verify_artifact, tampered)
        try:
            result = future.result(timeout=0.5)
        except FutureTimeoutError:
            writer = os.open(fifo, os.O_WRONLY | os.O_NONBLOCK)
            os.close(writer)
            future.result(timeout=1.0)
            pytest.fail("artifact verification blocked while opening a FIFO")

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "regular non-symlink file" in " ".join(result.errors)


def test_verification_never_calls_adapter_or_simulator(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)

    def bomb(*args, **kwargs):
        raise AssertionError("stored verification attempted simulator execution")

    monkeypatch.setattr(FakeSimulatorAdapter, "reset", bomb)
    monkeypatch.setattr(FakeSimulatorAdapter, "step", bomb)

    result = verify_artifact(source)

    assert result.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert result.verdict is Verdict.PASS


def test_verification_uses_nofollow_descriptor_snapshot_without_path_reopen(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)

    def forbid_path_read(*args, **kwargs):
        del args, kwargs
        raise AssertionError("artifact content was reopened by pathname")

    monkeypatch.setattr(Path, "read_bytes", forbid_path_read)
    monkeypatch.setattr(Path, "read_text", forbid_path_read)

    result = verify_artifact(source)

    assert result.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert result.verdict is Verdict.PASS


def test_deeply_nested_malformed_json_returns_invalid_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "deep-json")
    (tampered / "metrics.json").write_bytes(b"[" * 2_000 + b"]" * 2_000 + b"\n")
    _refresh_envelope(tampered)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "metrics.json is malformed JSON" in " ".join(result.errors)


@pytest.mark.parametrize(
    "filename, mutate",
    [
        ("metrics.json", lambda payload: payload.__setitem__("collision_count", 99)),
        (
            "findings.json",
            lambda payload: payload["findings"][0].__setitem__("message", "forged finding"),
        ),
        ("verdict.json", lambda payload: payload.__setitem__("verdict", "HOLD")),
    ],
)
def test_recomputed_metrics_findings_and_verdict_defeat_refreshed_outer_hashes(
    repository_root: Path,
    tmp_path: Path,
    filename: str,
    mutate,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, f"coherent-{filename}")
    path = tampered / filename
    payload = json.loads(path.read_text(encoding="utf-8"))
    mutate(payload)
    path.write_bytes(_canonical(payload) + b"\n")
    _refresh_envelope(tampered)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert any(f"{filename} does not match" in error for error in result.errors)


def test_scenario_gate_and_manifest_context_substitution_is_rejected_after_rehash(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    scenario_tamper = _copy_bundle(source, tmp_path, "coherent-scenario")
    scenario_path = scenario_tamper / "scenario.resolved.yaml"
    scenario_path.write_text(
        scenario_path.read_text(encoding="utf-8").replace(
            "destination_distance_m: 20.0", "destination_distance_m: 21.0"
        ),
        encoding="utf-8",
    )
    _refresh_envelope(scenario_tamper)

    gate_tamper = _copy_bundle(source, tmp_path, "coherent-gate")
    gate_path = gate_tamper / "gate-config.resolved.yaml"
    gate_path.write_text(
        gate_path.read_text(encoding="utf-8").replace(
            "max_abs_acceleration_mps2: 4.0", "max_abs_acceleration_mps2: 5.0"
        ),
        encoding="utf-8",
    )
    _refresh_envelope(gate_tamper)

    manifest_tamper = _copy_bundle(source, tmp_path, "coherent-manifest")
    manifest_path = manifest_tamper / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["policy_version"] = "forged"
    manifest_path.write_bytes(_canonical(manifest) + b"\n")
    _refresh_envelope(manifest_tamper)

    assert "scenario digest" in " ".join(verify_artifact(scenario_tamper).errors)
    assert "gate configuration digest" in " ".join(verify_artifact(gate_tamper).errors)
    assert "policy_version" in " ".join(verify_artifact(manifest_tamper).errors)


def test_component_context_cannot_diverge_from_hashed_run_context(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "component-context-substitution")
    context_path = tampered / "execution-context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))
    context["policy"]["config"]["target_speed_mps"] = 3.0
    substituted_digest = _sha(_canonical(context["policy"]["config"]))
    context["policy"]["config_digest"] = substituted_digest
    context_path.write_bytes(_canonical(context) + b"\n")
    manifest_path = tampered / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["policy_config_digest"] = substituted_digest
    manifest_path.write_bytes(_canonical(manifest) + b"\n")
    _refresh_envelope(tampered)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "policy component does not match hashed run context" in " ".join(
        result.errors
    )


def test_observation_summary_must_match_prior_executed_state(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "contradictory-observation")
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    events[1]["observation_summary"]["speed_mps"] = 999.0
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "observation summary speed_mps disagrees" in " ".join(result.errors)


def test_stored_shield_replay_rejects_coherently_rehashed_forged_override(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _shield_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "forged-shield-decision")
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    events[0]["executed_action"] = {
        "steering": events[0]["candidate_action"]["steering"],
        "throttle": 0.0,
        "brake": 1.0,
    }
    events[0]["override_reasons"] = ["SPEED_CAP"]
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "stored deterministic shield decision mismatch at sequence 0" in " ".join(
        result.errors
    )


def test_fake_latency_cannot_be_relabelled_as_measured_performance(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "forged-measured-latency")
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    for event in events:
        event["latency_source"] = "measured"
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "fake adapter latency_source must be simulated" in " ".join(result.errors)


def test_manifest_creation_time_must_be_utc(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "non-utc-manifest")
    manifest_path = tampered / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["created_at_utc"] = "2026-08-11T12:00:00-07:00"
    manifest_path.write_bytes(_canonical(manifest) + b"\n")
    _refresh_envelope(tampered)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "created_at_utc" in " ".join(result.errors)


def test_missing_safety_field_and_contradictory_fact_remain_invalid_after_full_rehash(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    missing = _copy_bundle(source, tmp_path, "coherent-missing-safety")
    missing_events = [
        json.loads(line)
        for line in (missing / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    del missing_events[0]["vehicle_state"]["collision_count"]
    _rehash_events(missing, missing_events)

    contradictory = _copy_bundle(source, tmp_path, "coherent-contradiction")
    contradictory_events = [
        json.loads(line)
        for line in (contradictory / "events.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
    ]
    contradictory_events[0]["vehicle_state"]["collision_count"] = 1
    _rehash_events(contradictory, contradictory_events)

    missing_result = verify_artifact(missing)
    contradictory_result = verify_artifact(contradictory)

    assert missing_result.verdict is Verdict.INVALID_EVIDENCE
    assert "collision_count" in " ".join(missing_result.errors)
    assert contradictory_result.verdict is Verdict.INVALID_EVIDENCE
    assert contradictory_result.first_mismatch_sequence == 0
    assert "collision facts disagree" in " ".join(contradictory_result.errors)


def test_terminal_event_truncation_is_invalid_even_when_all_outer_digests_are_refreshed(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "coherent-truncation")
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ][:-1]
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "final event" in " ".join(result.errors)


def test_early_horizon_claim_is_invalid_after_coherent_event_rehash(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "coherent-early-horizon")
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ][:1]
    events[0]["terminated"] = False
    events[0]["truncated"] = True
    events[0]["termination_reason"] = "HORIZON"
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "horizon termination occurred before configured horizon" in " ".join(
        result.errors
    )
