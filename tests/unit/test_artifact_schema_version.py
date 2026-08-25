from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

import pytest

from hermes.domain.enums import IntegrityStatus, Verdict
from hermes.evidence.artifacts import bundle_digest
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.verification import verify_artifact
from hermes.runtime.orchestrator import RunOutcome


def _write_canonical(path: Path, payload: object) -> None:
    path.write_bytes(canonical_json_bytes(payload) + b"\n")


def _refresh_envelope(bundle: Path) -> None:
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for filename in manifest["file_digests"]:
        manifest["file_digests"][filename] = sha256_hex((bundle / filename).read_bytes())
    _write_canonical(manifest_path, manifest)
    payloads = {
        path.name: path.read_bytes()
        for path in bundle.iterdir()
        if path.name != "bundle.sha256"
    }
    (bundle / "bundle.sha256").write_text(
        bundle_digest(payloads) + "\n",
        encoding="ascii",
    )


def test_schema_version_is_explicit_and_supported_in_valid_v1_artifact(
    fake_artifact_factory: Callable[..., RunOutcome],
) -> None:
    bundle = fake_artifact_factory().artifact_path

    for filename in (
        "manifest.json",
        "execution-context.json",
        "metrics.json",
        "findings.json",
    ):
        payload = json.loads((bundle / filename).read_text(encoding="utf-8"))
        assert payload["evidence_schema_version"] == "1.0"
    events = [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert all(event["evidence_schema_version"] == "1.0" for event in events)
    assert all(event["run_context"]["evidence_schema_version"] == "1.0" for event in events)
    assert verify_artifact(bundle).integrity is IntegrityStatus.INTERNALLY_CONSISTENT


@pytest.mark.parametrize(
    "filename",
    ("manifest.json", "execution-context.json", "metrics.json", "findings.json"),
)
@pytest.mark.parametrize("replacement", [None, "9.9"])
def test_missing_or_unsupported_document_schema_is_rejected_after_envelope_rehash(
    fake_artifact_factory: Callable[..., RunOutcome],
    filename: str,
    replacement: str | None,
) -> None:
    bundle = fake_artifact_factory().artifact_path
    path = bundle / filename
    payload = json.loads(path.read_text(encoding="utf-8"))
    if replacement is None:
        payload.pop("evidence_schema_version")
    else:
        payload["evidence_schema_version"] = replacement
    _write_canonical(path, payload)
    _refresh_envelope(bundle)

    result = verify_artifact(bundle)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    errors = " ".join(result.errors)
    assert filename in errors
    assert "evidence_schema_version" in errors


def test_nested_execution_context_schema_is_required_and_must_match_parent(
    fake_artifact_factory: Callable[..., RunOutcome],
) -> None:
    missing = fake_artifact_factory().artifact_path
    missing_path = missing / "execution-context.json"
    missing_payload = json.loads(missing_path.read_text(encoding="utf-8"))
    missing_payload["run_context"].pop("evidence_schema_version")
    _write_canonical(missing_path, missing_payload)
    _refresh_envelope(missing)

    mismatch = fake_artifact_factory().artifact_path
    mismatch_path = mismatch / "execution-context.json"
    mismatch_payload = json.loads(mismatch_path.read_text(encoding="utf-8"))
    mismatch_payload["run_context"]["evidence_schema_version"] = "2.0"
    _write_canonical(mismatch_path, mismatch_payload)
    _refresh_envelope(mismatch)

    assert "run_context is missing" in " ".join(verify_artifact(missing).errors)
    assert "differs from its parent" in " ".join(verify_artifact(mismatch).errors)


@pytest.mark.parametrize("mutation", ["missing", "mismatch"])
def test_event_and_nested_run_context_schema_are_explicitly_checked(
    fake_artifact_factory: Callable[..., RunOutcome],
    mutation: str,
) -> None:
    bundle = fake_artifact_factory().artifact_path
    events_path = bundle / "events.jsonl"
    events = [json.loads(line) for line in events_path.read_text(encoding="utf-8").splitlines()]
    if mutation == "missing":
        events[0].pop("evidence_schema_version")
    else:
        events[0]["run_context"]["evidence_schema_version"] = "2.0"
    events_path.write_bytes(
        b"".join(canonical_json_bytes(event) + b"\n" for event in events)
    )
    _refresh_envelope(bundle)

    result = verify_artifact(bundle)

    assert result.verdict is Verdict.INVALID_EVIDENCE
    errors = " ".join(result.errors)
    assert "events.jsonl line 1" in errors
    assert "evidence schema" in errors or "evidence_schema" in errors


def test_schema_v2_nested_versions_cannot_be_omitted_or_substituted(
    fake_artifact_factory: Callable[..., RunOutcome],
    repository_root: Path,
) -> None:
    missing = fake_artifact_factory(
        scenario_path=repository_root / "scenarios" / "fake_fault_injection.yaml",
        run_id="schema-v2-missing",
    ).artifact_path
    context_path = missing / "execution-context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))
    context["run_context"].pop("evidence_schema_version")
    _write_canonical(context_path, context)
    _refresh_envelope(missing)

    substituted = fake_artifact_factory(
        scenario_path=repository_root / "scenarios" / "fake_fault_injection.yaml",
        run_id="schema-v2-substituted",
    ).artifact_path
    events_path = substituted / "events.jsonl"
    events = [
        json.loads(line)
        for line in events_path.read_text(encoding="utf-8").splitlines()
    ]
    events[0]["run_context"]["evidence_schema_version"] = "9.9"
    events_path.write_bytes(
        b"".join(canonical_json_bytes(event) + b"\n" for event in events)
    )
    _refresh_envelope(substituted)

    missing_result = verify_artifact(missing)
    substituted_result = verify_artifact(substituted)

    assert missing_result.verdict is Verdict.INVALID_EVIDENCE
    assert "run_context is missing" in " ".join(missing_result.errors)
    assert substituted_result.verdict is Verdict.INVALID_EVIDENCE
    assert "differs from the event" in " ".join(substituted_result.errors)
