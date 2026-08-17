from __future__ import annotations

import os
from pathlib import Path

import pytest
from typer.main import get_command
from typer.testing import CliRunner

import hermes.adequacy.api as adequacy_api
from hermes.adequacy.models import (
    LOCAL_HISTORY_LIMITATION,
    AdequacyAssessment,
    AdequacyCriterion,
    AdequacyStatus,
    ArtifactDiagnostic,
    CapturedSourceIdentity,
    CriterionExactValue,
    CriterionStatus,
    EvaluationAdequacyEnvelope,
    EvidenceReference,
    Interpretation,
    ObservationDisposition,
    RegistrationEvidence,
    RegistrationStatus,
    RequestedPlanSelections,
    SideIdentity,
    SideReviewState,
    canonical_adequacy_json_bytes,
    interpretation_for,
)
from hermes.cli import app
from hermes.cli_errors import CliErrorCode, cli_error_payload
from hermes.evidence.canonical import canonical_json_bytes

runner = CliRunner()

_DIGEST_A = "a" * 64
_DIGEST_B = "b" * 64
_COMMIT_A = "a" * 40
_COMMIT_B = "b" * 40
_AUTHORITY_STATEMENT = (
    "Assessment authority: stored simulation evidence and declared criteria only. "
    "Exit 0 means completed assessment, not passed gate or deployment permission. "
    "It does not establish real-world safety, authenticated registration, approval, "
    "authorization, or release."
)


def _args(
    *,
    output_format: str = "json",
    repository_root: str = "/repository",
    artifact_root: str = "/artifacts",
    plan_root: str = "/plans",
    baseline: str = "baseline",
    candidate: str = "candidate",
    protocol: str = "protocol.yaml",
    ledger: str = "ledger.jsonl",
    pair: str = "pair.yaml",
) -> list[str]:
    return [
        "assess-adequacy",
        baseline,
        candidate,
        "--repository-root",
        repository_root,
        "--artifact-root",
        artifact_root,
        "--plan-root",
        plan_root,
        "--protocol",
        protocol,
        "--discovery-ledger",
        ledger,
        "--pair-plan",
        pair,
        "--format",
        output_format,
    ]


def _identity(role: str, *, parsed: bool = True) -> SideIdentity:
    return SideIdentity(
        role=role,
        requested_relative_locator=role.lower(),
        observed_run_id=f"run-{role.lower()}" if parsed else None,
        observed_evidence_schema_version="1.0" if parsed else None,
        observed_scenario_schema_version="2.0" if parsed else None,
        observed_bundle_digest_sha256=_DIGEST_A if parsed else None,
        computed_bundle_digest_sha256=_DIGEST_A if parsed else None,
        observed_trace_digest_sha256=_DIGEST_B if parsed else None,
        computed_trace_digest_sha256=_DIGEST_B if parsed else None,
    )


def _side(
    role: str,
    *,
    integrity: str = "INTERNALLY_CONSISTENT",
    diagnostics: tuple[ArtifactDiagnostic, ...] = (),
) -> SideReviewState:
    parsed = integrity != "UNVERIFIED"
    gate = {
        "INTERNALLY_CONSISTENT": "CONDITIONAL",
        "INVALID_EVIDENCE": "INVALID_EVIDENCE",
        "UNVERIFIED": None,
    }[integrity]
    return SideReviewState(
        identity=_identity(role, parsed=parsed),
        gate_verdict=gate,
        integrity=integrity,
        authenticity="NOT_AUTHENTICATED",
        authorization="NOT_EVALUATED",
        deployment_permission="NONE",
        scope="SIMULATION_ONLY",
        authoritative_status="NOT_DEFINED",
        diagnostics=diagnostics,
    )


def _exact(value: float) -> CriterionExactValue:
    return CriterionExactValue(
        machine_value=value,
        canonical_value=str(value),
        display_value=f"{value:.1f}",
        unit="s",
    )


def _criterion(
    criterion_id: str,
    status: CriterionStatus,
    *,
    sequence: int,
) -> AdequacyCriterion:
    unavailable = status is CriterionStatus.NOT_AVAILABLE
    return AdequacyCriterion(
        criterion_id=criterion_id,
        status=status,
        definition_category="ASSUMPTION",
        definition="Frozen declared lead-TTC criterion.",
        threshold=_exact(2.0),
        observation_category="NOT_AVAILABLE" if unavailable else "COMPUTED",
        observation=None if unavailable else _exact(1.5),
        evidence_category="NOT_AVAILABLE" if unavailable else "OBSERVED",
        rationale=(
            "Required configuration was unavailable."
            if unavailable
            else "Stored observations satisfy the frozen comparison."
        ),
        references=(
            EvidenceReference(
                side="CANDIDATE",
                source_file="events.jsonl",
                sequence=sequence,
                json_pointer="/observation_summary/front_distance_m",
            ),
        ),
        unavailable_reason=(
            "Required configuration was unavailable." if unavailable else None
        ),
    )


def _completed_envelope(
    status: AdequacyStatus = AdequacyStatus.ADEQUATE,
    *,
    diagnostics: tuple[ArtifactDiagnostic, ...] = (),
    limitations: tuple[str, ...] = ("Simulation only.",),
) -> EvaluationAdequacyEnvelope:
    controlling_status = {
        AdequacyStatus.ADEQUATE: CriterionStatus.PASS,
        AdequacyStatus.INADEQUATE: CriterionStatus.FAIL,
        AdequacyStatus.NOT_AVAILABLE: CriterionStatus.NOT_AVAILABLE,
    }[status]
    baseline_diagnostics = tuple(
        item for item in diagnostics if item.side == "BASELINE"
    )
    candidate_diagnostics = tuple(
        item for item in diagnostics if item.side == "CANDIDATE"
    )
    registration_status = RegistrationStatus.LOCAL_HISTORY_ORDERING_VERIFIED
    assessment = AdequacyAssessment(
        status=status,
        observation_disposition=(
            ObservationDisposition.EVIDENCE_NOT_AVAILABLE
            if status is AdequacyStatus.NOT_AVAILABLE
            else ObservationDisposition.TARGET_INTERVENTION_RECORDED
        ),
        criteria=(
            _criterion("target_condition_exposure", controlling_status, sequence=7),
            _criterion("candidate_target_event_count", CriterionStatus.PASS, sequence=8),
        ),
    )
    return EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        requested_plan_selections=RequestedPlanSelections(
            protocol_relative_path="protocol.yaml",
            discovery_ledger_relative_path="ledger.jsonl",
            pair_plan_relative_path="pair.yaml",
        ),
        baseline=_side("BASELINE", diagnostics=baseline_diagnostics),
        candidate=_side("CANDIDATE", diagnostics=candidate_diagnostics),
        compatibility="COMPATIBLE",
        compatibility_reasons=(),
        plan_evaluation="EVALUATED",
        plan_evaluation_reason=None,
        protocol_source=CapturedSourceIdentity(
            relative_path="protocol.yaml",
            byte_digest_sha256=_DIGEST_A,
            semantic_digest_sha256=_DIGEST_B,
        ),
        discovery_ledger_source=CapturedSourceIdentity(
            relative_path="ledger.jsonl",
            byte_digest_sha256=_DIGEST_A,
            semantic_digest_sha256=_DIGEST_B,
        ),
        pair_plan_source=CapturedSourceIdentity(
            relative_path="pair.yaml",
            byte_digest_sha256=_DIGEST_A,
            semantic_digest_sha256=_DIGEST_B,
        ),
        assessment=assessment,
        registration=RegistrationEvidence(
            status=registration_status,
            authenticity="NOT_AUTHENTICATED",
            limitation=LOCAL_HISTORY_LIMITATION,
            protocol_commit=_COMMIT_A,
            pair_plan_commit=_COMMIT_B,
        ),
        interpretation=interpretation_for(status, registration_status),
        diagnostics=diagnostics,
        limitations=limitations,
    )


def _not_evaluated_envelope(
    reason: str,
    *,
    invalid_side: str | None = None,
) -> EvaluationAdequacyEnvelope:
    if invalid_side is not None:
        diagnostic = ArtifactDiagnostic(
            side=invalid_side,
            code="BUNDLE_DIGEST_MISMATCH",
            message="Stored evidence failed verification.",
        )
        if invalid_side == "BASELINE":
            baseline = _side(
                "BASELINE",
                integrity="INVALID_EVIDENCE",
                diagnostics=(diagnostic,),
            )
            candidate = _side("CANDIDATE", integrity="UNVERIFIED")
        else:
            baseline = _side("BASELINE")
            candidate = _side(
                "CANDIDATE",
                integrity="INVALID_EVIDENCE",
                diagnostics=(diagnostic,),
            )
        compatibility = "NOT_EVALUATED"
        reasons: tuple[str, ...] = ()
        limitations = ("Stored claims quarantined.",)
        diagnostics = (diagnostic,)
    else:
        baseline = _side("BASELINE")
        candidate = _side("CANDIDATE")
        compatibility = "INCOMPATIBLE"
        reasons = ("challenge kind differs",)
        limitations = ("No comparison claim is available.",)
        diagnostics = ()
    return EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version="0.1.0",
        requested_plan_selections=RequestedPlanSelections(
            protocol_relative_path="protocol.yaml",
            discovery_ledger_relative_path="ledger.jsonl",
            pair_plan_relative_path="pair.yaml",
        ),
        baseline=baseline,
        candidate=candidate,
        compatibility=compatibility,
        compatibility_reasons=reasons,
        plan_evaluation="PLAN_NOT_EVALUATED",
        plan_evaluation_reason=reason,
        protocol_source=None,
        discovery_ledger_source=None,
        pair_plan_source=None,
        assessment=None,
        registration=None,
        interpretation=Interpretation.NO_INTERPRETATION,
        diagnostics=diagnostics,
        limitations=limitations,
    )


def test_assess_adequacy_parser_has_exact_two_arguments_and_seven_named_options() -> None:
    command = get_command(app).commands["assess-adequacy"]
    arguments = [
        parameter
        for parameter in command.params
        if parameter.param_type_name == "argument"
    ]
    options = [
        parameter
        for parameter in command.params
        if parameter.param_type_name == "option"
    ]

    assert [parameter.name for parameter in arguments] == [
        "baseline_selection",
        "candidate_selection",
    ]
    assert {option.opts[0] for option in options} == {
        "--repository-root",
        "--artifact-root",
        "--plan-root",
        "--protocol",
        "--discovery-ledger",
        "--pair-plan",
        "--format",
    }
    assert len(options) == 7


def test_assess_adequacy_forwards_exact_selections_and_only_abspath_normalizes_roots(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    envelope = _completed_envelope()
    captured: dict[str, object] = {}

    def assess(*args: object) -> EvaluationAdequacyEnvelope:
        captured["args"] = args
        return envelope

    def bomb(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("forbidden filesystem or canonicalization operation")

    monkeypatch.setattr(adequacy_api, "assess_review_pair_adequacy", assess)
    monkeypatch.chdir(tmp_path)
    selections = (
        "baseline-é",
        "candidate-中",
        "plans/protocol-é.yaml",
        "plans/ledger-中.jsonl",
        "plans/pair-β.yaml",
    )
    with monkeypatch.context() as boundary:
        for name in (
            "resolve",
            "absolute",
            "stat",
            "lstat",
            "exists",
            "is_dir",
            "is_file",
            "iterdir",
            "glob",
            "rglob",
            "open",
            "read_text",
            "read_bytes",
        ):
            boundary.setattr(Path, name, bomb)
        boundary.setattr(os.path, "realpath", bomb)
        result = runner.invoke(
            app,
            _args(
                repository_root="repo/../repo",
                artifact_root="./stored",
                plan_root="plans/../plans",
                baseline=selections[0],
                candidate=selections[1],
                protocol=selections[2],
                ledger=selections[3],
                pair=selections[4],
            ),
        )

    assert result.exit_code == 0, result.output
    assert captured["args"] == (
        Path(os.path.abspath("repo/../repo")),
        Path(os.path.abspath("./stored")),
        selections[0],
        selections[1],
        Path(os.path.abspath("plans/../plans")),
        selections[2],
        selections[3],
        selections[4],
    )
    assert result.output.encode("utf-8") == canonical_adequacy_json_bytes(envelope) + b"\n"


@pytest.mark.parametrize(
    "status",
    [AdequacyStatus.ADEQUATE, AdequacyStatus.INADEQUATE, AdequacyStatus.NOT_AVAILABLE],
)
def test_assess_adequacy_completed_json_is_exact_canonical_envelope_and_exit_zero(
    status: AdequacyStatus,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    envelope = _completed_envelope(status)
    monkeypatch.setattr(
        adequacy_api,
        "assess_review_pair_adequacy",
        lambda *_args: envelope,
    )

    result = runner.invoke(app, _args())

    assert result.exit_code == 0
    assert result.output.encode("utf-8") == canonical_adequacy_json_bytes(envelope) + b"\n"
    assert result.output.count("\n") == 1


@pytest.mark.parametrize("side", ["BASELINE", "CANDIDATE"])
def test_assess_adequacy_invalid_side_emits_one_exact_envelope_and_exit_30(
    side: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    envelope = _not_evaluated_envelope("INVALID_EVIDENCE", invalid_side=side)
    monkeypatch.setattr(
        adequacy_api,
        "assess_review_pair_adequacy",
        lambda *_args: envelope,
    )

    result = runner.invoke(app, _args())

    assert result.exit_code == 30
    assert result.output.encode("utf-8") == canonical_adequacy_json_bytes(envelope) + b"\n"
    assert result.output.count("\n") == 1


def test_assess_adequacy_incompatible_emits_one_exact_envelope_and_exit_40(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    envelope = _not_evaluated_envelope("INCOMPATIBLE_EVIDENCE")
    monkeypatch.setattr(
        adequacy_api,
        "assess_review_pair_adequacy",
        lambda *_args: envelope,
    )

    result = runner.invoke(app, _args())

    assert result.exit_code == 40
    assert result.output.encode("utf-8") == canonical_adequacy_json_bytes(envelope) + b"\n"
    assert result.output.count("\n") == 1


@pytest.mark.parametrize(
    ("kind", "expected_code"),
    [
        (adequacy_api.AdequacyServiceErrorKind.INVALID_REQUEST, CliErrorCode.CONFIGURATION_ERROR),
        (adequacy_api.AdequacyServiceErrorKind.INVALID_PLAN, CliErrorCode.CONFIGURATION_ERROR),
        (
            adequacy_api.AdequacyServiceErrorKind.UNSUPPORTED_EVIDENCE_SHAPE,
            CliErrorCode.OPERATIONAL_ERROR,
        ),
        (
            adequacy_api.AdequacyServiceErrorKind.OPERATIONAL_FAILURE,
            CliErrorCode.OPERATIONAL_ERROR,
        ),
    ],
)
def test_assess_adequacy_service_errors_are_one_canonical_safe_document_and_exit_40(
    kind: adequacy_api.AdequacyServiceErrorKind,
    expected_code: CliErrorCode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error = adequacy_api.AdequacyServiceError(kind, "Safe adequacy failure.")

    def fail(*_args: object) -> EvaluationAdequacyEnvelope:
        raise error

    monkeypatch.setattr(adequacy_api, "assess_review_pair_adequacy", fail)

    result = runner.invoke(app, _args())

    expected = canonical_json_bytes(
        cli_error_payload(expected_code, error.safe_message, 40)
    ) + b"\n"
    assert result.exit_code == 40
    assert result.output.encode("utf-8") == expected
    assert result.output.count("\n") == 1


def test_assess_adequacy_invalid_format_stops_before_service_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def bomb(*_args: object) -> EvaluationAdequacyEnvelope:
        raise AssertionError("service must not run for an invalid format")

    monkeypatch.setattr(adequacy_api, "assess_review_pair_adequacy", bomb)

    result = runner.invoke(app, _args(output_format="yaml"))

    assert result.exit_code == 40
    assert "CONFIGURATION_ERROR" in result.output
    assert "unsupported format 'yaml'" in result.output
    assert "service must not run" not in result.output


def test_assess_adequacy_text_renders_all_planes_ordered_criteria_and_inert_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    diagnostics = (
        ArtifactDiagnostic(side="BASELINE", code="BOUNDARY_1024", message="x" * 1_024),
        ArtifactDiagnostic(side="CANDIDATE", code="BOUNDARY_1025", message="y" * 1_025),
    )
    envelope = _completed_envelope(
        diagnostics=diagnostics,
        limitations=("line\n\u202eend", LOCAL_HISTORY_LIMITATION),
    )
    monkeypatch.setattr(
        adequacy_api,
        "assess_review_pair_adequacy",
        lambda *_args: envelope,
    )

    result = runner.invoke(app, _args(output_format="text"))

    assert result.exit_code == 0
    required = (
        _AUTHORITY_STATEMENT,
        "Baseline identity:",
        "Baseline integrity: INTERNALLY_CONSISTENT",
        "Baseline gate verdict: CONDITIONAL",
        "Baseline authenticity: NOT_AUTHENTICATED",
        "Baseline authorization: NOT_EVALUATED",
        "Baseline deployment permission: NONE",
        "Baseline scope: SIMULATION_ONLY",
        "Baseline authoritative status: NOT_DEFINED",
        "Candidate identity:",
        "Candidate integrity: INTERNALLY_CONSISTENT",
        "Compatibility: COMPATIBLE",
        "Plan evaluation: EVALUATED",
        "Adequacy status: ADEQUATE",
        "Observation disposition: TARGET_INTERVENTION_RECORDED",
        "Registration status: LOCAL_HISTORY_ORDERING_VERIFIED",
        "Registration authenticity: NOT_AUTHENTICATED",
        f"Registration limitation: {LOCAL_HISTORY_LIMITATION}",
        "Interpretation: DECLARED_QUESTION_ONLY",
        '"criterion_id":"target_condition_exposure"',
        '"criterion_id":"candidate_target_event_count"',
        '"machine_value":2.0',
        '"canonical_value":"2.0"',
        '"display_value":"2.0"',
        '"sequence":7',
        "Protocol source:",
        "Discovery ledger source:",
        "Pair plan source:",
        "Diagnostics:",
        "Limitations:",
    )
    assert all(item in result.output for item in required)
    assert result.output.index('"criterion_id":"target_condition_exposure"') < result.output.index(
        '"criterion_id":"candidate_target_event_count"'
    )
    assert '"message":"' + "x" * 1_024 + '"' in result.output
    assert (
        '"message":{"displayed_text":"'
        + "y" * 1_024
        + '","original_length":1025,"truncated":true}'
    ) in result.output
    assert "line\\u000A\\u202Eend" in result.output
    assert "\u202e" not in result.output
    for overclaim in (
        "gate passed",
        "registration authenticated",
        "approved for deployment",
        "authorized for release",
        "establishes real-world safety",
    ):
        assert overclaim not in result.output.lower()


@pytest.mark.parametrize(
    ("envelope", "expected"),
    [
        (
            _not_evaluated_envelope("INVALID_EVIDENCE", invalid_side="BASELINE"),
            (
                "Baseline integrity: INVALID_EVIDENCE",
                "Candidate integrity: UNVERIFIED",
                "Plan evaluation reason: INVALID_EVIDENCE",
                "Adequacy assessment: NOT_EVALUATED",
            ),
        ),
        (
            _not_evaluated_envelope("INCOMPATIBLE_EVIDENCE"),
            (
                "Compatibility: INCOMPATIBLE",
                "Compatibility reason: challenge kind differs",
                "Plan evaluation reason: INCOMPATIBLE_EVIDENCE",
                "Adequacy assessment: NOT_EVALUATED",
            ),
        ),
    ],
)
def test_assess_adequacy_text_preserves_not_evaluated_states(
    envelope: EvaluationAdequacyEnvelope,
    expected: tuple[str, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        adequacy_api,
        "assess_review_pair_adequacy",
        lambda *_args: envelope,
    )

    result = runner.invoke(app, _args(output_format="text"))

    assert result.exit_code in {30, 40}
    assert all(item in result.output for item in expected)
    assert result.output.count(_AUTHORITY_STATEMENT) == 1
