from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

import hermes.review as review_api
import hermes.review.facade as facade_module
from hermes.cli import app
from hermes.review import (
    ComparisonEnvelope,
    ReviewEnvelope,
    ReviewUnavailableError,
    ReviewUnavailableReason,
    canonical_envelope_bytes,
)

runner = CliRunner()

_INVALID_SELECTIONS = (
    "",
    ".",
    "../handoff-phase5-demo",
    "handoff-phase5-demo/",
    "nested//handoff-phase5-demo",
    "nested\\handoff-phase5-demo",
    "/tmp/handoff-phase5-demo",
    "artifacts/handoff-phase5-demo",
)


def _review_args(root: Path, selection: str, output_format: str) -> list[str]:
    return [
        "review-artifact",
        selection,
        "--artifact-root",
        str(root),
        "--format",
        output_format,
    ]


def _compare_args(
    root: Path,
    baseline: str,
    candidate: str,
    output_format: str,
) -> list[str]:
    return [
        "review-compare",
        baseline,
        candidate,
        "--artifact-root",
        str(root),
        "--format",
        output_format,
    ]


@pytest.mark.parametrize(
    ("selection", "expected_gate"),
    [
        ("handoff-phase5-demo", "PASS"),
        ("handoff-p1-conditional", "CONDITIONAL"),
        ("handoff-p1-collision", "HOLD"),
    ],
)
def test_review_artifact_json_is_exact_public_facade_bytes_and_operation_exit_zero(
    repository_root: Path,
    selection: str,
    expected_gate: str,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.review_artifact(root, selection)

    result = runner.invoke(app, _review_args(root, selection, "json"))

    assert result.exit_code == 0
    assert result.output.encode("utf-8") == canonical_envelope_bytes(envelope) + b"\n"
    assert json.loads(result.output)["gate"]["verdict"] == expected_gate


def test_review_artifact_invalid_json_is_exact_quarantined_envelope_and_exit_30(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.review_artifact(root, "phase1-tampered")

    result = runner.invoke(
        app,
        _review_args(root, "phase1-tampered", "json"),
    )

    assert result.exit_code == 30
    assert result.output.encode("utf-8") == canonical_envelope_bytes(envelope) + b"\n"
    payload = json.loads(result.output)
    assert payload["verification"]["integrity"] == "INVALID_EVIDENCE"
    assert payload["gate"]["verdict"] == "INVALID_EVIDENCE"
    assert payload["verification"]["stored_claims_quarantined"] is True
    assert payload["findings"] == []
    assert payload["metrics"] == []
    assert payload["timeline"]["event_count"] == 0
    assert payload["provenance"]["recorded"]["status"] == "QUARANTINED"
    assert result.output.count("\n") == 1


@pytest.mark.parametrize(
    ("selection", "quarantined"),
    [("phase1-tampered", "True"), ("missing-selection", "False")],
)
def test_review_artifact_invalid_text_names_quarantine_and_missing_values(
    repository_root: Path,
    selection: str,
    quarantined: str,
) -> None:
    result = runner.invoke(
        app,
        _review_args(repository_root / "artifacts", selection, "text"),
    )

    assert result.exit_code == 30
    assert f"Stored claims quarantined: {quarantined}" in result.output
    assert "Evidence integrity: INVALID_EVIDENCE" in result.output
    if selection == "missing-selection":
        assert "Manifest run ID: NOT_AVAILABLE" in result.output
        assert "Created at: NOT_AVAILABLE" in result.output
        assert "Simulation range: NOT_AVAILABLE -> NOT_AVAILABLE" in result.output
        assert "Manifest run ID: None" not in result.output


def test_review_artifact_text_exposes_identity_independent_trust_and_evidence(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"

    result = runner.invoke(
        app,
        _review_args(root, "handoff-p1-conditional", "text"),
    )

    assert result.exit_code == 0
    required_text = (
        "SIMULATION-ONLY PROTOTYPE",
        "Selected artifact: handoff-p1-conditional",
        "Manifest run ID: handoff-p1-conditional",
        "Gate verdict: CONDITIONAL",
        "Evidence integrity: INTERNALLY_CONSISTENT",
        "Authenticity: NOT_AUTHENTICATED",
        "Authorization: NOT_EVALUATED",
        "Deployment permission: NONE",
        "Scope: SIMULATION_ONLY",
        "Authoritative status: NOT_DEFINED",
        "Evidence sufficiency",
        "Findings",
        "Metrics",
        "Timeline",
        "Recorded provenance: ACCEPTED",
        "Residual limitations",
    )
    assert all(text in result.output for text in required_text)
    assert "approved" not in result.output.lower()
    assert "road-ready" not in result.output.lower()


@pytest.mark.parametrize(
    "selection",
    _INVALID_SELECTIONS,
)
def test_review_cli_rejects_nonexact_or_root_prefixed_selection(
    repository_root: Path,
    selection: str,
) -> None:
    result = runner.invoke(
        app,
        _review_args(repository_root / "artifacts", selection, "json"),
    )

    assert result.exit_code == 40
    payload = json.loads(result.output)
    assert payload["error"] == "CONFIGURATION_ERROR"
    assert payload["exit_code"] == 40
    assert result.output.count("\n") == 1


@pytest.mark.parametrize("invalid_selection", _INVALID_SELECTIONS)
@pytest.mark.parametrize("invalid_side", ["BASELINE", "CANDIDATE"])
def test_review_compare_rejects_nonexact_selection_on_either_side_before_comparison(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    invalid_selection: str,
    invalid_side: str,
) -> None:
    def forbidden_compare(*args: object) -> object:
        raise AssertionError(f"invalid selection reached comparison core: {args!r}")

    monkeypatch.setattr(facade_module, "compare_artifacts", forbidden_compare)
    root = repository_root / "artifacts"
    baseline = (
        invalid_selection if invalid_side == "BASELINE" else "handoff-phase5-demo"
    )
    candidate = (
        invalid_selection if invalid_side == "CANDIDATE" else "handoff-phase5-demo"
    )

    result = runner.invoke(
        app,
        _compare_args(root, baseline, candidate, "json"),
    )

    assert result.exit_code == 40
    payload = json.loads(result.output)
    assert payload["error"] == "CONFIGURATION_ERROR"
    assert payload["exit_code"] == 40
    assert result.output.count("\n") == 1


@pytest.mark.parametrize("command", ["review-artifact", "review-compare"])
@pytest.mark.parametrize("root_case", ["MISSING", "SYMLINK"])
def test_review_commands_reject_missing_or_symlink_artifact_root(
    tmp_path: Path,
    command: str,
    root_case: str,
) -> None:
    missing = tmp_path / "missing-root"
    if root_case == "MISSING":
        root = missing
    else:
        target = tmp_path / "real-root"
        target.mkdir()
        root = tmp_path / "linked-root"
        root.symlink_to(target, target_is_directory=True)
    arguments = (
        _review_args(root, "handoff-phase5-demo", "json")
        if command == "review-artifact"
        else _compare_args(
            root,
            "handoff-phase5-demo",
            "handoff-p1-conditional",
            "json",
        )
    )

    result = runner.invoke(app, arguments)

    assert result.exit_code == 40
    payload = json.loads(result.output)
    assert payload["error"] == "CONFIGURATION_ERROR"
    assert payload["exit_code"] == 40
    assert result.output.count("\n") == 1


def test_review_artifact_source_schema_invalid_is_invalid_evidence_not_unavailable(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    source = repository_root / "artifacts" / "handoff-phase5-demo"
    root = tmp_path / "artifacts"
    target = root / "unsupported-source-schema"
    target.mkdir(parents=True)
    for item in source.iterdir():
        (target / item.name).write_bytes(item.read_bytes())
    manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
    manifest["evidence_schema_version"] = "9.0"
    (target / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        _review_args(root, "unsupported-source-schema", "json"),
    )

    assert result.exit_code == 30
    payload = json.loads(result.output)
    assert payload["verification"]["integrity"] == "INVALID_EVIDENCE"
    assert payload["gate"]["verdict"] == "INVALID_EVIDENCE"
    assert payload["findings"] == []


def test_review_artifact_core_consistent_gate_invalid_is_operation_exit_zero(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.review_artifact(root, "handoff-phase5-demo")
    synthetic = envelope.model_copy(
        update={"gate": envelope.gate.model_copy(update={"verdict": "INVALID_EVIDENCE"})}
    )
    monkeypatch.setattr(review_api, "review_artifact", lambda root, selection: synthetic)

    result = runner.invoke(
        app,
        _review_args(root, "handoff-phase5-demo", "json"),
    )

    assert result.exit_code == 0
    assert json.loads(result.output)["gate"]["verdict"] == "INVALID_EVIDENCE"
    assert json.loads(result.output)["verification"]["integrity"] == ("INTERNALLY_CONSISTENT")


def test_review_artifact_typed_unavailable_is_review_unavailable_exit_40(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unavailable(root: Path, selection: str) -> ReviewEnvelope:
        raise ReviewUnavailableError(
            ReviewUnavailableReason.UNSUPPORTED_REVIEW_SHAPE,
            "synthetic unsupported projection",
        )

    monkeypatch.setattr(review_api, "review_artifact", unavailable)

    result = runner.invoke(
        app,
        _review_args(repository_root / "artifacts", "handoff-phase5-demo", "json"),
    )

    assert result.exit_code == 40
    assert json.loads(result.output) == {
        "details": {"reason": "UNSUPPORTED_REVIEW_SHAPE"},
        "error": "REVIEW_UNAVAILABLE",
        "exit_code": 40,
        "message": "synthetic unsupported projection",
    }


def test_review_artifact_unexpected_exception_is_one_operational_error_document(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(root: Path, selection: str) -> ReviewEnvelope:
        raise RuntimeError("synthetic review failure")

    monkeypatch.setattr(review_api, "review_artifact", explode)

    result = runner.invoke(
        app,
        _review_args(repository_root / "artifacts", "handoff-phase5-demo", "json"),
    )

    assert result.exit_code == 40
    payload = json.loads(result.output)
    assert payload["error"] == "OPERATIONAL_ERROR"
    assert payload["exit_code"] == 40
    assert "RuntimeError: synthetic review failure" in payload["message"]
    assert result.output.count("\n") == 1


def test_review_compare_json_is_exact_public_facade_bytes(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.compare_review_artifacts(
        root,
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )
    assert isinstance(envelope, ComparisonEnvelope)

    result = runner.invoke(
        app,
        _compare_args(
            root,
            "handoff-p3-lead-baseline",
            "handoff-p3-lead-shielded",
            "json",
        ),
    )

    assert result.exit_code == 0
    assert result.output.encode("utf-8") == canonical_envelope_bytes(envelope) + b"\n"


def test_review_compare_text_exposes_both_sides_partitions_and_chart_values(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"

    result = runner.invoke(
        app,
        _compare_args(
            root,
            "handoff-p3-lead-baseline",
            "handoff-p3-lead-shielded",
            "text",
        ),
    )

    assert result.exit_code == 0
    required_text = (
        "Baseline artifact: handoff-p3-lead-baseline",
        "Candidate artifact: handoff-p3-lead-shielded",
        "Baseline gate: CONDITIONAL",
        "Candidate gate: CONDITIONAL",
        "Compatibility: COMPATIBLE",
        "Verdict delta",
        "Hard-failure delta",
        "Evidence-availability summary delta",
        "Improvements",
        "Regressions",
        "Unchanged outcomes",
        "Not comparable",
        "Availability details",
        "Chart series",
        "minimum_ttc_s",
        "route_completion_pct",
        "shield_interventions",
        "Authenticity: NOT_AUTHENTICATED",
        "Deployment permission: NONE",
    )
    assert all(text in result.output for text in required_text)
    assert "winner" not in result.output.lower()
    assert "safety score" not in result.output.lower()


def test_review_compare_invalid_side_is_baseline_first_one_error_document(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"

    baseline_invalid = runner.invoke(
        app,
        _compare_args(root, "phase1-tampered", "handoff-phase5-demo", "json"),
    )
    candidate_invalid = runner.invoke(
        app,
        _compare_args(root, "handoff-phase5-demo", "phase1-tampered", "json"),
    )
    both_invalid = runner.invoke(
        app,
        _compare_args(root, "phase1-tampered", "phase1-tampered", "json"),
    )

    for result, side in (
        (baseline_invalid, "BASELINE"),
        (candidate_invalid, "CANDIDATE"),
        (both_invalid, "BASELINE"),
    ):
        assert result.exit_code == 30
        payload = json.loads(result.output)
        assert payload["error"] == "INVALID_EVIDENCE"
        assert payload["details"]["side"] == side
        review = payload["details"]["review"]
        assert review["verification"]["integrity"] == "INVALID_EVIDENCE"
        assert review["findings"] == []
        assert result.output.count("\n") == 1


@pytest.mark.parametrize(
    ("baseline", "candidate", "expected_side"),
    [
        ("phase1-tampered", "handoff-phase5-demo", "BASELINE"),
        ("handoff-phase5-demo", "phase1-tampered", "CANDIDATE"),
        ("phase1-tampered", "phase1-tampered", "BASELINE"),
    ],
)
def test_review_compare_invalid_text_identifies_side_before_quarantined_review(
    repository_root: Path,
    baseline: str,
    candidate: str,
    expected_side: str,
) -> None:
    result = runner.invoke(
        app,
        _compare_args(repository_root / "artifacts", baseline, candidate, "text"),
    )

    assert result.exit_code == 30
    assert f"Invalid comparison side: {expected_side}" in result.output
    assert "Evidence integrity: INVALID_EVIDENCE" in result.output


def test_review_compare_incompatible_is_reason_only_error_exit_40(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"

    result = runner.invoke(
        app,
        _compare_args(
            root,
            "handoff-p3-lead-baseline",
            "handoff-p3-cutin-baseline",
            "json",
        ),
    )

    assert result.exit_code == 40
    payload = json.loads(result.output)
    assert payload["error"] == "INCOMPATIBLE_EVIDENCE"
    comparison = payload["details"]["comparison"]
    assert comparison["compatibility"]["status"] == "INCOMPATIBLE"
    assert comparison["verdict_delta"] is None
    assert comparison["hard_failure_delta"] is None
    assert comparison["availability_summary_delta"] is None
    assert comparison["improvements"] == []
    assert comparison["regressions"] == []
    assert comparison["chart_series"] == []
    assert result.output.count("\n") == 1


def test_review_text_neutralizes_all_c0_c1_controls_and_ansi_from_artifact_text(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.review_artifact(root, "handoff-phase5-demo")
    manifest_identity = envelope.artifact.manifest_identity.model_copy(
        update={
            "run_id": "payload\x00\t\n\r\x1b[31m\x7f\x85\x9b漢字",
        }
    )
    artifact = envelope.artifact.model_copy(update={"manifest_identity": manifest_identity})
    injected = envelope.model_copy(update={"artifact": artifact})
    monkeypatch.setattr(review_api, "review_artifact", lambda root, selection: injected)

    result = runner.invoke(
        app,
        _review_args(root, "handoff-phase5-demo", "text"),
    )

    assert result.exit_code == 0
    assert "payload\\u0000\\u0009\\u000A\\u000D\\u001B[31m\\u007F\\u0085\\u009B漢字" in (
        result.output
    )
    assert "\x1b" not in result.output
    for character in result.output:
        codepoint = ord(character)
        assert character == "\n" or not (codepoint <= 0x1F or 0x7F <= codepoint <= 0x9F)


def test_review_text_uses_uppercase_four_digit_escapes_in_nested_records(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.review_artifact(root, "handoff-phase5-demo")
    finding = envelope.findings[0].model_copy(
        update={"explanation": "nested\x00\t\n\r\x1b\x7f\x85\x9b漢"}
    )
    injected = envelope.model_copy(
        update={"findings": (finding, *envelope.findings[1:])}
    )
    monkeypatch.setattr(review_api, "review_artifact", lambda root, selection: injected)

    result = runner.invoke(
        app,
        _review_args(root, "handoff-phase5-demo", "text"),
    )

    assert result.exit_code == 0
    assert (
        "nested\\u0000\\u0009\\u000A\\u000D\\u001B\\u007F\\u0085\\u009B漢"
        in result.output
    )
    assert "nested\\u0000\\t\\n\\r\\u001b" not in result.output


def test_review_text_preserves_literal_backslash_escape_sequences(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = repository_root / "artifacts"
    envelope = review_api.review_artifact(root, "handoff-phase5-demo")
    finding = envelope.findings[0].model_copy(
        update={"explanation": r"literal\b\t\n\f\r\u001b"}
    )
    injected = envelope.model_copy(
        update={"findings": (finding, *envelope.findings[1:])}
    )
    monkeypatch.setattr(review_api, "review_artifact", lambda root, selection: injected)

    result = runner.invoke(
        app,
        _review_args(root, "handoff-phase5-demo", "text"),
    )

    assert result.exit_code == 0
    assert r"literal\\b\\t\\n\\f\\r\\u001b" in result.output
    assert r"literal\\u0008" not in result.output


def test_review_cli_rejects_unsupported_format_before_review(
    repository_root: Path,
) -> None:
    result = runner.invoke(
        app,
        _review_args(repository_root / "artifacts", "handoff-phase5-demo", "yaml"),
    )

    assert result.exit_code == 40
    assert "[CONFIGURATION_ERROR]" in result.output
    assert "unsupported format 'yaml'" in result.output
