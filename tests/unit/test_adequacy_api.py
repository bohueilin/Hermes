from __future__ import annotations

import importlib
import inspect
import traceback
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest


def _api():
    return importlib.import_module("hermes.adequacy.api")


def _arguments(repository_root: Path) -> dict[str, object]:
    return {
        "repository_root": repository_root,
        "artifact_root": repository_root / "artifacts",
        "baseline_relative_path": "handoff-p3-lead-baseline",
        "candidate_relative_path": "handoff-p3-lead-shielded",
        "plan_root": repository_root / "evaluation-plans",
        "protocol_relative_path": "lead.protocol.v1.yaml",
        "discovery_ledger_relative_path": "lead.discovery.v1.jsonl",
        "pair_plan_relative_path": "lead.pair.v1.yaml",
    }


def _assert_opaque_service_error(
    error: Exception,
    *raw_fragments: str,
) -> None:
    _assert_detached_exception(error, *raw_fragments)
    assert 0 < len(str(error)) <= 1024


def _assert_detached_exception(
    error: Exception,
    *raw_fragments: str,
) -> None:
    rendered = "".join(traceback.format_exception(error, chain=True))
    assert error.__cause__ is None
    assert error.__context__ is None
    pending: list[BaseException] = [error]
    seen: set[int] = set()
    while pending:
        current = pending.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        for link in (current.__cause__, current.__context__):
            if link is not None:
                pending.append(link)
        for fragment in raw_fragments:
            assert fragment not in str(current)
    for fragment in raw_fragments:
        assert fragment not in rendered


def _install_synthetic_valid_flow(
    module: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    consistent = SimpleNamespace(
        verification=SimpleNamespace(integrity="INTERNALLY_CONSISTENT")
    )
    reviewed_baseline = SimpleNamespace(
        envelope=consistent,
        capture=SimpleNamespace(inspection=SimpleNamespace(snapshot="baseline-snapshot")),
    )
    reviewed_candidate = SimpleNamespace(
        envelope=consistent,
        capture=SimpleNamespace(inspection=SimpleNamespace(snapshot="candidate-snapshot")),
    )
    pair = SimpleNamespace(
        baseline=reviewed_baseline,
        candidate=reviewed_candidate,
        comparison=SimpleNamespace(
            compatibility=SimpleNamespace(comparable=True, reasons=())
        ),
    )
    plans = SimpleNamespace(
        protocol="protocol",
        ledger="ledger",
        pair_plan="pair-plan",
        sources="sources",
    )
    captured = SimpleNamespace(repository=SimpleNamespace(commit="a" * 40))

    monkeypatch.setattr(module, "_capture_review_pair", lambda *_args: pair)
    monkeypatch.setattr(
        module,
        "_side_review_state",
        lambda _reviewed, role, requested: module._unverified_side(role, requested),
    )
    monkeypatch.setattr(module, "_capture_plans", lambda *_args: plans)
    monkeypatch.setattr(module, "_map_verified_snapshot", lambda *_args, **_kwargs: captured)
    monkeypatch.setattr(module, "_inspect_registration", lambda *_args: object())
    monkeypatch.setattr(module, "_assess_captured_pair", lambda *_args: object())
    monkeypatch.setattr(module, "_evaluated_envelope", lambda **_kwargs: object())


def test_public_api_has_exact_signature_and_closed_error_taxonomy() -> None:
    module = _api()
    signature = inspect.signature(module.assess_review_pair_adequacy)
    assert tuple(signature.parameters) == (
        "repository_root",
        "artifact_root",
        "baseline_relative_path",
        "candidate_relative_path",
        "plan_root",
        "protocol_relative_path",
        "discovery_ledger_relative_path",
        "pair_plan_relative_path",
    )
    assert all(
        name not in signature.parameters
        for name in (
            "inspector",
            "registration",
            "plans",
            "capture",
            "snapshot",
            "result",
        )
    )
    assert tuple(item.value for item in module.AdequacyServiceErrorKind) == (
        "INVALID_REQUEST",
        "INVALID_PLAN",
        "UNSUPPORTED_EVIDENCE_SHAPE",
        "OPERATIONAL_FAILURE",
    )
    for kind in module.AdequacyServiceErrorKind:
        error = module.AdequacyServiceError(kind, "implementation-owned message")
        assert isinstance(error, RuntimeError)
        assert error.kind is kind
        assert error.safe_message == "implementation-owned message"
        assert error.exit_code == 40


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("repository_root", "."),
        ("artifact_root", Path("artifacts")),
        ("plan_root", Path("plans")),
        ("repository_root", Path("/tmp/noncanonical/../root")),
        ("repository_root", Path("//noncanonical-repository-root")),
        ("artifact_root", Path("//noncanonical-artifact-root")),
        ("plan_root", Path("//noncanonical-plan-root")),
        ("artifact_root", Path("/tmp/control\u200broot")),
        ("baseline_relative_path", ""),
        ("baseline_relative_path", "/absolute"),
        ("baseline_relative_path", "artifacts/prefixed"),
        ("candidate_relative_path", "nested//candidate"),
        ("candidate_relative_path", "nested/../candidate"),
        ("candidate_relative_path", "nested\\candidate"),
        ("protocol_relative_path", "evaluation-plans/protocol.yaml"),
        ("discovery_ledger_relative_path", "ledger\u0000.jsonl"),
        ("pair_plan_relative_path", "pair\u2060.yaml"),
    ),
)
def test_pure_request_screen_rejects_noncanonical_or_controlled_input_before_io(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: object,
) -> None:
    module = _api()
    calls: list[str] = []

    def forbidden_capture(*_args: object, **_kwargs: object) -> object:
        calls.append("capture")
        raise AssertionError("invalid syntax reached artifact capture")

    monkeypatch.setattr(module, "_capture_review_pair", forbidden_capture)
    arguments = _arguments(repository_root)
    arguments[field] = value
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**arguments)
    assert captured.value.kind is module.AdequacyServiceErrorKind.INVALID_REQUEST
    assert captured.value.exit_code == 40
    assert calls == []


def test_request_error_message_is_fixed_bounded_and_never_echoes_input(
    repository_root: Path,
) -> None:
    module = _api()
    secret = "SECRET-SELECTED-TEXT-\u2060" + "x" * 5000
    arguments = _arguments(repository_root)
    arguments["candidate_relative_path"] = secret
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**arguments)
    assert 0 < len(captured.value.safe_message) <= 1024
    assert "SECRET" not in captured.value.safe_message
    assert str(repository_root) not in captured.value.safe_message
    _assert_opaque_service_error(captured.value, "SECRET")


def test_raw_review_exception_is_opaque_in_the_public_error_chain(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    sentinel = "RAW-REVIEW-SENTINEL"
    raw_path = "/private/adequacy-raw-review-path"

    def explode(*_args: object) -> object:
        raise OSError(f"{sentinel}: {raw_path}")

    monkeypatch.setattr(module, "_capture_review_pair", explode)
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**_arguments(repository_root))

    assert captured.value.kind is module.AdequacyServiceErrorKind.OPERATIONAL_FAILURE
    _assert_opaque_service_error(captured.value, sentinel, raw_path)


@pytest.mark.parametrize(
    ("stage", "target", "exception_name", "expected_kind"),
    (
        ("request", "_screen_request", "VALUE", "INVALID_REQUEST"),
        ("review", "_capture_review_pair", "OS", "OPERATIONAL_FAILURE"),
        ("invalid-plan", "_capture_plans", "INVALID_PLAN", "INVALID_PLAN"),
        ("plan", "_capture_plans", "OS", "OPERATIONAL_FAILURE"),
        (
            "unsupported-shape",
            "_map_verified_snapshot",
            "UNSUPPORTED_SHAPE",
            "UNSUPPORTED_EVIDENCE_SHAPE",
        ),
        ("mapping", "_map_verified_snapshot", "OS", "OPERATIONAL_FAILURE"),
        (
            "registration-boundary",
            "_inspect_registration",
            "REGISTRATION_BOUNDARY",
            "OPERATIONAL_FAILURE",
        ),
        ("registration", "_inspect_registration", "OS", "OPERATIONAL_FAILURE"),
        ("assessment", "_assess_captured_pair", "OS", "OPERATIONAL_FAILURE"),
    ),
)
def test_every_public_normalization_branch_detaches_the_raw_exception_graph(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    stage: str,
    target: str,
    exception_name: str,
    expected_kind: str,
) -> None:
    module = _api()
    _install_synthetic_valid_flow(module, monkeypatch)
    sentinel = f"RAW-{stage.upper()}-SENTINEL"
    raw_path = f"/private/adequacy-{stage}-secret"
    exception_types = {
        "VALUE": ValueError,
        "OS": OSError,
        "INVALID_PLAN": module._InvalidPlanBoundary,
        "UNSUPPORTED_SHAPE": module._UnsupportedEvidenceShape,
        "REGISTRATION_BOUNDARY": module._RegistrationBoundaryFailure,
    }

    def explode(*_args: object, **_kwargs: object) -> object:
        raise exception_types[exception_name](f"{sentinel}: {raw_path}")

    monkeypatch.setattr(module, target, explode)
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**_arguments(repository_root))

    assert captured.value.kind.value == expected_kind
    _assert_opaque_service_error(captured.value, sentinel, raw_path)


def test_private_loader_wrapper_detaches_raw_parser_exception(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    loader = importlib.import_module("hermes.adequacy.loader")
    sentinel = "RAW-PRIVATE-LOADER-SENTINEL"

    def explode(*_args: object) -> object:
        raise loader.InvalidPlanError(sentinel)

    monkeypatch.setattr(loader, "capture_evaluation_plans", explode)
    with pytest.raises(module._InvalidPlanBoundary) as captured:
        module._capture_plans(
            repository_root,
            "protocol.yaml",
            "ledger.jsonl",
            "pair.yaml",
        )

    _assert_detached_exception(captured.value, sentinel)


def test_private_registration_wrapper_detaches_raw_git_exception(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    provenance = importlib.import_module("hermes.provenance.git")
    sentinel = "RAW-PRIVATE-GIT-SENTINEL"

    def explode(*_args: object, **_kwargs: object) -> object:
        raise provenance.RegistrationGitOperationalError(sentinel)

    monkeypatch.setattr(provenance.RegistrationGitInspector, "inspect", explode)
    with pytest.raises(module._RegistrationBoundaryFailure) as captured:
        module._inspect_registration(repository_root, object(), "a" * 40, "a" * 40)

    _assert_detached_exception(captured.value, sentinel)


def test_private_phase_wrapper_detaches_raw_mapping_exception() -> None:
    module = _api()
    phase_sentinel = "RAW-PRIVATE-PHASE-SENTINEL"

    class ExplodingSummary(dict[str, object]):
        def __getitem__(self, key: str) -> object:
            raise KeyError(f"{phase_sentinel}: {key}")

    snapshot = SimpleNamespace(
        scenario=SimpleNamespace(
            challenge=SimpleNamespace(kind="lead_vehicle_hard_brake")
        )
    )
    with pytest.raises(module._UnsupportedEvidenceShape) as phase_error:
        module._mapped_phase(snapshot, ExplodingSummary())
    _assert_detached_exception(phase_error.value, phase_sentinel)


def test_private_snapshot_wrapper_detaches_raw_mapping_exception() -> None:
    module = _api()
    map_sentinel = "RAW-PRIVATE-MAP-SENTINEL"

    class ExplodingSnapshot:
        @property
        def manifest(self) -> object:
            raise ValueError(map_sentinel)

    with pytest.raises(module._UnsupportedEvidenceShape) as map_error:
        module._map_verified_snapshot(
            ExplodingSnapshot(),
            "BASELINE",
            bundle_digest_sha256="a" * 64,
            trace_digest_sha256="b" * 64,
        )
    _assert_detached_exception(map_error.value, map_sentinel)


def test_invalid_baseline_returns_unvisited_candidate_and_never_reads_plans_or_git(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    calls: list[str] = []
    real_capture = module._capture_review_pair

    def record_capture(*args: object) -> object:
        calls.append("review-pair")
        return real_capture(*args)

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("invalid evidence reached plans or Git")

    monkeypatch.setattr(module, "_capture_review_pair", record_capture)
    monkeypatch.setattr(module, "_capture_plans", forbidden)
    monkeypatch.setattr(module, "_inspect_registration", forbidden)
    arguments = _arguments(repository_root)
    arguments["baseline_relative_path"] = "phase1-tampered"
    result = module.assess_review_pair_adequacy(**arguments)

    assert calls == ["review-pair"]
    assert result.baseline.integrity == "INVALID_EVIDENCE"
    assert result.candidate.integrity == "UNVERIFIED"
    assert result.candidate.identity.observed_run_id is None
    assert result.candidate.identity.observed_bundle_digest_sha256 is None
    assert result.plan_evaluation == "PLAN_NOT_EVALUATED"
    assert result.plan_evaluation_reason == "INVALID_EVIDENCE"
    assert result.compatibility == "NOT_EVALUATED"
    assert result.protocol_source is None
    assert result.assessment is None
    assert result.registration is None
    assert result.interpretation == "NO_INTERPRETATION"
    assert result.requested_plan_selections.model_dump() == {
        "protocol_relative_path": "lead.protocol.v1.yaml",
        "discovery_ledger_relative_path": "lead.discovery.v1.jsonl",
        "pair_plan_relative_path": "lead.pair.v1.yaml",
    }


def test_invalid_candidate_preserves_valid_baseline_and_stops_before_plans_or_git(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("invalid candidate reached plans or Git")

    monkeypatch.setattr(module, "_capture_plans", forbidden)
    monkeypatch.setattr(module, "_inspect_registration", forbidden)
    arguments = _arguments(repository_root)
    arguments["baseline_relative_path"] = "handoff-phase5-demo"
    arguments["candidate_relative_path"] = "phase1-tampered"
    result = module.assess_review_pair_adequacy(**arguments)

    assert result.baseline.integrity == "INTERNALLY_CONSISTENT"
    assert result.baseline.identity.observed_run_id == "handoff-phase5-demo"
    assert result.candidate.integrity == "INVALID_EVIDENCE"
    assert result.plan_evaluation_reason == "INVALID_EVIDENCE"
    assert result.diagnostics == (
        result.baseline.diagnostics + result.candidate.diagnostics
    )


def test_existing_incompatibility_wins_before_missing_plan_and_repository_roots(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("incompatible evidence reached plans or Git")

    monkeypatch.setattr(module, "_capture_plans", forbidden)
    monkeypatch.setattr(module, "_inspect_registration", forbidden)
    arguments = _arguments(repository_root)
    arguments["candidate_relative_path"] = "handoff-p3-cutin-baseline"
    arguments["plan_root"] = repository_root / "missing-plan-root"
    arguments["repository_root"] = repository_root / "missing-repository-root"
    result = module.assess_review_pair_adequacy(**arguments)

    assert result.baseline.integrity == "INTERNALLY_CONSISTENT"
    assert result.candidate.integrity == "INTERNALLY_CONSISTENT"
    assert result.compatibility == "INCOMPATIBLE"
    assert result.compatibility_reasons
    assert result.plan_evaluation_reason == "INCOMPATIBLE_EVIDENCE"
    assert result.assessment is None
    assert result.registration is None


def _reviewed_with_repository_commit(reviewed: object, commit: str | None) -> object:
    snapshot = reviewed.capture.inspection.snapshot
    assert snapshot is not None
    manifest_updates: dict[str, object] = {"repository_commit": commit}
    if commit is None:
        manifest_updates.update(
            repository_dirty=None,
            repository_provenance_reason="repository provenance unavailable",
        )
    modified_snapshot = replace(
        snapshot,
        manifest=snapshot.manifest.model_copy(update=manifest_updates),
    )
    modified_inspection = replace(
        reviewed.capture.inspection,
        snapshot=modified_snapshot,
    )
    return replace(
        reviewed,
        capture=replace(reviewed.capture, inspection=modified_inspection),
    )


@pytest.mark.parametrize(
    ("baseline_commit", "candidate_commit", "reason"),
    (
        (None, None, "repository commit is unavailable"),
        ("1" * 40, "2" * 40, "repository commit differs"),
    ),
)
def test_public_api_keeps_missing_or_unequal_commits_in_existing_incompatibility(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    baseline_commit: str | None,
    candidate_commit: str | None,
    reason: str,
) -> None:
    module = _api()
    facade = importlib.import_module("hermes.review.facade")
    service = facade._ReviewFacade()
    baseline = _reviewed_with_repository_commit(
        service._review_result(
            repository_root / "artifacts",
            "handoff-p3-lead-baseline",
        ),
        baseline_commit,
    )
    candidate = _reviewed_with_repository_commit(
        service._review_result(
            repository_root / "artifacts",
            "handoff-p3-lead-shielded",
        ),
        candidate_commit,
    )
    reviewed = iter((baseline, candidate))

    def selected_review(*_args: object) -> object:
        return next(reviewed)

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("repository incompatibility reached plans or Git")

    monkeypatch.setattr(facade._ReviewFacade, "_review_result", selected_review)
    monkeypatch.setattr(module, "_capture_plans", forbidden)
    monkeypatch.setattr(module, "_inspect_registration", forbidden)

    result = module.assess_review_pair_adequacy(**_arguments(repository_root))

    assert result.compatibility == "INCOMPATIBLE"
    assert result.plan_evaluation == "PLAN_NOT_EVALUATED"
    assert result.plan_evaluation_reason == "INCOMPATIBLE_EVIDENCE"
    assert any(reason in item for item in result.compatibility_reasons)
    assert result.assessment is None
    assert result.registration is None


def test_invalid_plan_is_normalized_before_git(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    loader = importlib.import_module("hermes.adequacy.loader")
    raw_path = "/private/adequacy-plan-secret"

    def invalid_plan(*_args: object) -> object:
        raise loader.InvalidPlanError(f"raw path {raw_path} and parser detail must not escape")

    def forbidden_git(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("invalid plan reached Git")

    monkeypatch.setattr(loader, "capture_evaluation_plans", invalid_plan)
    monkeypatch.setattr(module, "_inspect_registration", forbidden_git)
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**_arguments(repository_root))
    assert captured.value.kind is module.AdequacyServiceErrorKind.INVALID_PLAN
    assert "raw path" not in captured.value.safe_message
    assert str(repository_root) not in captured.value.safe_message
    _assert_opaque_service_error(captured.value, "raw path", raw_path)


def test_schema2_mapping_is_unsupported_after_plan_and_before_git(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    facade = importlib.import_module("hermes.review.facade")
    reviewed = facade._ReviewFacade()._review_pair(
        repository_root / "artifacts",
        "handoff-p4-fault",
        "handoff-p4-fault-repeat",
    )
    calls: list[str] = []

    def capture_pair(*_args: object) -> object:
        calls.append("pair")
        return reviewed

    def capture_plans(*_args: object) -> object:
        calls.append("plans")
        return SimpleNamespace()

    def forbidden_git(*_args: object, **_kwargs: object) -> object:
        calls.append("git")
        raise AssertionError("unsupported evidence reached Git")

    monkeypatch.setattr(module, "_capture_review_pair", capture_pair)
    monkeypatch.setattr(module, "_capture_plans", capture_plans)
    monkeypatch.setattr(module, "_inspect_registration", forbidden_git)
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**_arguments(repository_root))
    assert captured.value.kind is module.AdequacyServiceErrorKind.UNSUPPORTED_EVIDENCE_SHAPE
    assert calls == ["pair", "plans"]


@pytest.mark.parametrize(
    ("selection", "expected_kind", "expected_phases"),
    (
        ("handoff-phase5-demo", None, {None}),
        (
            "handoff-p3-cutin-baseline",
            "cut_in_near_field",
            {"PRE_TRIGGER", "CUT_IN", "POST_CUT_IN"},
        ),
        (
            "handoff-p3-lead-baseline",
            "lead_vehicle_hard_brake",
            {"PRE_TRIGGER", "BRAKING", "RECOVERY"},
        ),
    ),
)
def test_schema1_mapper_preserves_fake_cutin_and_lead_phase_domains(
    repository_root: Path,
    selection: str,
    expected_kind: str | None,
    expected_phases: set[str | None],
) -> None:
    module = _api()
    facade = importlib.import_module("hermes.review.facade")
    reviewed = facade._ReviewFacade()._review_result(
        repository_root / "artifacts", selection
    )
    snapshot = reviewed.capture.inspection.snapshot
    assert snapshot is not None
    side = module._map_verified_snapshot(
        snapshot,
        "BASELINE",
        bundle_digest_sha256=(
            reviewed.envelope.artifact.computed_bundle_digest.value
        ),
        trace_digest_sha256=(
            reviewed.envelope.artifact.computed_trace_digest.value
        ),
    )
    assert side.scenario.challenge_kind == expected_kind
    assert set(event.challenge_phase for event in side.scanner.events) <= expected_phases
    assert side.run_id == snapshot.manifest.run_id
    assert side.repository.commit == snapshot.manifest.repository_commit


def test_side_review_state_maps_every_safe_identity_root_and_trust_plane_exactly(
    repository_root: Path,
) -> None:
    module = _api()
    facade = importlib.import_module("hermes.review.facade")
    reviewed = facade._ReviewFacade()._review_result(
        repository_root / "artifacts",
        "phase1-tampered",
    )

    state = module._side_review_state(
        reviewed,
        "BASELINE",
        "phase1-tampered",
    )

    assert state.identity.observed_run_id == "phase1-nominal"
    assert state.identity.observed_evidence_schema_version == "1.0"
    assert state.identity.observed_scenario_schema_version == "1.0"
    assert (
        state.identity.observed_bundle_digest_sha256
        == "6eac41695c890dd08758bc6da95e8ae0092d9120057af4693fc64847017d97de"
    )
    assert (
        state.identity.computed_bundle_digest_sha256
        == "831f22ed419e4b13ce5d0a1aa3bc1444b2ca523d60edb8d4c75eaa7491e1d61e"
    )
    assert (
        state.identity.observed_trace_digest_sha256
        == "f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e"
    )
    assert state.identity.computed_trace_digest_sha256 is None
    assert state.gate_verdict == "INVALID_EVIDENCE"
    assert state.integrity == "INVALID_EVIDENCE"
    assert state.authenticity == "NOT_AUTHENTICATED"
    assert state.authorization == "NOT_EVALUATED"
    assert state.deployment_permission == "NONE"
    assert state.scope == "SIMULATION_ONLY"
    assert state.authoritative_status == "NOT_DEFINED"


def test_valid_operation_order_is_pair_plans_map_git_assessment_once(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    events: list[str] = []
    consistent = SimpleNamespace(verification=SimpleNamespace(integrity="INTERNALLY_CONSISTENT"))
    reviewed_baseline = SimpleNamespace(
        envelope=consistent,
        capture=SimpleNamespace(inspection=SimpleNamespace(snapshot="baseline-snapshot")),
    )
    reviewed_candidate = SimpleNamespace(
        envelope=consistent,
        capture=SimpleNamespace(inspection=SimpleNamespace(snapshot="candidate-snapshot")),
    )
    pair = SimpleNamespace(
        baseline=reviewed_baseline,
        candidate=reviewed_candidate,
        comparison=SimpleNamespace(
            compatibility=SimpleNamespace(comparable=True, reasons=())
        ),
    )
    plans = SimpleNamespace(
        protocol="protocol",
        ledger="ledger",
        pair_plan="pair-plan",
        sources="sources",
    )
    registration = object()
    assessment = object()
    final = object()
    baseline_facts = SimpleNamespace(
        label="BASELINE-facts",
        repository=SimpleNamespace(commit="shared-commit"),
    )
    candidate_facts = SimpleNamespace(
        label="CANDIDATE-facts",
        repository=SimpleNamespace(commit="shared-commit"),
    )

    def capture_pair(*_args: object) -> object:
        events.append("pair")
        return pair

    def review_state(reviewed: object, role: str, requested: str) -> object:
        events.append(f"state-{role.lower()}")
        return module._unverified_side(role, requested)

    def capture_plans(*_args: object) -> object:
        events.append("plans")
        return plans

    def map_snapshot(snapshot: object, role: str, **_digests: object) -> object:
        events.append(f"map-{role.lower()}")
        assert snapshot == f"{role.lower()}-snapshot"
        return baseline_facts if role == "BASELINE" else candidate_facts

    def inspect_registration(*args: object) -> object:
        events.append("git")
        assert args[1] is plans
        return registration

    def assess(*args: object) -> object:
        events.append("assess")
        assert args == (
            "protocol",
            "ledger",
            "pair-plan",
            baseline_facts,
            candidate_facts,
        )
        return assessment

    def compose(*args: object, **kwargs: object) -> object:
        events.append("envelope")
        assert kwargs["registration"] is registration
        assert kwargs["assessment"] is assessment
        return final

    monkeypatch.setattr(module, "_capture_review_pair", capture_pair)
    monkeypatch.setattr(module, "_side_review_state", review_state)
    monkeypatch.setattr(module, "_capture_plans", capture_plans)
    monkeypatch.setattr(module, "_map_verified_snapshot", map_snapshot)
    monkeypatch.setattr(module, "_inspect_registration", inspect_registration)
    monkeypatch.setattr(module, "_assess_captured_pair", assess)
    monkeypatch.setattr(module, "_evaluated_envelope", compose)
    result = module.assess_review_pair_adequacy(**_arguments(repository_root))

    assert result is final
    assert events == [
        "pair",
        "state-baseline",
        "state-candidate",
        "plans",
        "map-baseline",
        "map-candidate",
        "git",
        "assess",
        "envelope",
    ]


def test_raw_git_operational_error_is_normalized_without_output_leak(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _api()
    provenance = importlib.import_module("hermes.provenance.git")
    raw_path = "/private/adequacy-git-secret"

    def operational(*_args: object) -> object:
        raise provenance.RegistrationGitOperationalError(
            f"SECRET GIT STDERR and absolute path {raw_path}"
        )

    monkeypatch.setattr(module, "_capture_plans", lambda *_args: SimpleNamespace())
    monkeypatch.setattr(provenance.RegistrationGitInspector, "inspect", operational)
    with pytest.raises(module.AdequacyServiceError) as captured:
        module.assess_review_pair_adequacy(**_arguments(repository_root))
    assert captured.value.kind is module.AdequacyServiceErrorKind.OPERATIONAL_FAILURE
    assert "SECRET" not in captured.value.safe_message
    assert str(repository_root) not in captured.value.safe_message
    _assert_opaque_service_error(captured.value, "SECRET", raw_path)
