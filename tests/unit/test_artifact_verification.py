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
from hermes.domain.models import (
    ArtifactManifest,
    ArtifactManifestV2,
    ExecutionContext,
    ExecutionContextV2,
    FindingsDocument,
    FindingsDocumentV2,
    RunContext,
    RunContextV2,
    RunMetrics,
    RunMetricsV2,
    TraceEvent,
    TraceEventV2,
)
from hermes.evidence.canonical import canonical_json_bytes
from hermes.evidence.verification import inspect_artifact, verify_artifact
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


def _fake_adas_bundle(repository_root: Path, tmp_path: Path) -> Path:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy

    scenario_path = tmp_path / "fake-adas.yaml"
    scenario_path.write_text(
        """\
schema_version: "4.0"
name: fake_adas_suite_probe
version: "1.0"
description: Simulator-neutral probe for stored ADAS verifier-suite binding.
adapter: fake
control:
  frequency_hz: 10
  horizon_steps: 40
  target_speed_mps: 8.0
  max_braking_mps2: 6.0
initial_state:
  speed_mps: 8.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 20.0
  boundary_tolerance_m: 1.5
hazards: {}
adas:
  enabled:
    - fcw
    - aeb
  expected_fcw:
    kind: none
  expected_aeb:
    kind: forbidden
""",
        encoding="utf-8",
    )
    artifacts = tmp_path / "fake-adas-artifacts"
    artifacts.mkdir()
    config = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
    return execute_fake_run(
        scenario_path=scenario_path,
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id="fake-adas-source",
        artifact_root=artifacts,
        repository_root=repository_root,
        policy_factory=lambda: AdasLongitudinalPolicy(config),
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


_LEGACY_MODEL_PINS = {
    "phase1-nominal": {
        "classes": (
            RunContext,
            ExecutionContext,
            TraceEvent,
            ArtifactManifest,
            RunMetrics,
            FindingsDocument,
        ),
        "model_sha256": (
            "38b8fb30407b4a6d39d7ceaac14e422b1b5205ea9c19b5b5ed277738ee13aee1",
            "02c3433cbf2ab5daa11936c74dea26c7739df85c8a56d20668fbafffae285193",
            "2b929163903dbca6f7a0ddb4226f4b72cc074095d8c8d9fae9502b9cc33f584f",
            "75e33257b3029b036ba48fb7de069f0b6bc5e28d63192b9d1a363bfde41a6edf",
            "0e1c6b37441a5fe66f3461343756d5e144a0e1d667802f97d7a77a7d976ab5ca",
            "f2aab191047fd3bfd94049ef84f33697af3a91b03e5a81de7780a7bb1691685d",
        ),
        "events_sha256": "50e5cf7a1a82dc9e3a2f5b2a2185093faac99884a54ba02c98a2f60e92941daa",
        "trace_digest": "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e",
    },
    "handoff-p4-fault": {
        "classes": (
            RunContextV2,
            ExecutionContextV2,
            TraceEventV2,
            ArtifactManifestV2,
            RunMetricsV2,
            FindingsDocumentV2,
        ),
        "model_sha256": (
            "83f7bac8329a43905be72c5bd5a6771970717f971bc29395c625b782bcdfcc17",
            "21994e4d1246bf0b9924abb4029183eb12927c0ce09985724e3866f80ddf9ba4",
            "ddb7c42c085b8d7611d2345dba7a12cfb3513a1ee0b407ba61218d0d589f68d5",
            "d09673bc707cd00c7a9e7643f330e143e9f429c1adff1daf9cdbf07397cdafe4",
            "ee3d524c4435f28c1cb26dc8e04b79070e54cb13e6928d7705616e2c908d42c7",
            "aa34437463085337b3b69ebf916fcdf850d2d60673da5d552721dfaffbf33838",
        ),
        "events_sha256": "335e76905dd53cf3ed53092295f304c8bee7a6196be6dfbdcfb87f4247bfadfc",
        "trace_digest": "c365813d9ebda590299830a68d1683e3d8f413bc7b4b43da13ea77c5678552af",
    },
}


@pytest.mark.parametrize("run_id", tuple(_LEGACY_MODEL_PINS))
def test_legacy_six_family_models_event_jsonl_and_trace_digest_are_pinned(
    repository_root: Path,
    run_id: str,
) -> None:
    bundle = repository_root / "artifacts" / run_id
    snapshot = inspect_artifact(bundle).snapshot
    assert snapshot is not None
    models = (
        snapshot.context.run_context,
        snapshot.context,
        snapshot.events[0],
        snapshot.manifest,
        snapshot.metrics,
        snapshot.findings,
    )
    expected = _LEGACY_MODEL_PINS[run_id]

    assert tuple(type(model) for model in models) == expected["classes"]
    assert tuple(
        _sha(canonical_json_bytes(model.model_dump(mode="json"))) for model in models
    ) == expected["model_sha256"]
    assert _sha((bundle / "events.jsonl").read_bytes()) == expected["events_sha256"]
    assert snapshot.manifest.trace_digest == expected["trace_digest"]
    assert (bundle / "trace.sha256").read_text(encoding="ascii").strip() == expected[
        "trace_digest"
    ]


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


def _rewrite_verifier_suite(bundle: Path, mutate) -> None:
    context_path = bundle / "execution-context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))
    mutate(context["verifier_suite"])
    suite_digest = _sha(_canonical(context["verifier_suite"]))
    context["run_context"]["verifier_suite_digest"] = suite_digest
    context_path.write_bytes(_canonical(context) + b"\n")

    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["verifier_suite_digest"] = suite_digest
    manifest_path.write_bytes(_canonical(manifest) + b"\n")

    events = [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    for event in events:
        event["run_context"]["verifier_suite_digest"] = suite_digest
    _rehash_events(bundle, events)


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


@pytest.mark.parametrize("mutation", ["omitted", "incorrect"])
def test_stored_adas_bundle_rejects_coherently_wrong_verifier_suite(
    repository_root: Path,
    tmp_path: Path,
    mutation: str,
) -> None:
    source = _fake_adas_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, f"adas-suite-{mutation}")

    if mutation == "omitted":
        _rewrite_verifier_suite(tampered, lambda suite: suite.__delitem__(slice(-4, None)))
    else:
        _rewrite_verifier_suite(
            tampered,
            lambda suite: suite[-1].__setitem__(
                "finding_id", "adas.fcw.substituted_identity"
            ),
        )

    result = verify_artifact(tampered)

    assert result.integrity is IntegrityStatus.INVALID
    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert "execution-context.json contains an unsupported verifier suite" in result.errors


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


@pytest.mark.parametrize(
    ("filename", "original", "malformed"),
    (
        (
            "scenario.resolved.yaml",
            "name: fake_nominal",
            "name: 2026-99-99",
        ),
        (
            "gate-config.resolved.yaml",
            "name: phase1",
            "name: " + "9" * 5_000,
        ),
    ),
    ids=("scenario-date-constructor", "gate-integer-constructor"),
)
def test_yaml_constructor_value_error_returns_bounded_invalid_evidence(
    repository_root: Path,
    tmp_path: Path,
    filename: str,
    original: str,
    malformed: str,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, f"constructor-error-{filename}")
    resolved_path = tampered / filename
    resolved_text = resolved_path.read_text(encoding="utf-8")
    assert original in resolved_text
    resolved_path.write_text(
        resolved_text.replace(original, malformed, 1),
        encoding="utf-8",
    )
    _refresh_envelope(tampered)

    result = verify_artifact(tampered)

    assert result.integrity is IntegrityStatus.INVALID
    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert any(error.startswith(f"{filename} is invalid:") for error in result.errors)
    assert all(len(error) <= 512 for error in result.errors)


def test_extreme_finite_acceleration_overflow_returns_bounded_invalid_evidence(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = _nominal_bundle(repository_root, tmp_path)
    tampered = _copy_bundle(source, tmp_path, "extreme-finite-acceleration")
    events = [
        json.loads(line)
        for line in (tampered / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    events[0]["vehicle_state"]["acceleration_mps2"] = 1e308
    events[1]["vehicle_state"]["acceleration_mps2"] = -1e308
    _rehash_events(tampered, events)

    result = verify_artifact(tampered)

    assert result.integrity is IntegrityStatus.INVALID
    assert result.verdict is Verdict.INVALID_EVIDENCE
    assert any(
        error.startswith("stored evidence recomputation failed:")
        for error in result.errors
    )
    assert all(len(error) <= 512 for error in result.errors)
