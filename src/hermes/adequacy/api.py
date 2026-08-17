"""Production composition service for stored-evidence adequacy assessment."""

from __future__ import annotations

import importlib
import os
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import Literal
from unicodedata import category as unicode_category

from hermes import __version__
from hermes.adequacy import models as _models
from hermes.adequacy.assessment import _assess_captured_pair

_LIMITATIONS = (
    "Simulation-only stored evidence does not establish real-world safety or "
    "deployment permission.",
    "Local artifact and Git history observations are not authenticated.",
)
_BOUNDARY_FAILURE = object()


class AdequacyServiceErrorKind(StrEnum):
    INVALID_REQUEST = "INVALID_REQUEST"
    INVALID_PLAN = "INVALID_PLAN"
    UNSUPPORTED_EVIDENCE_SHAPE = "UNSUPPORTED_EVIDENCE_SHAPE"
    OPERATIONAL_FAILURE = "OPERATIONAL_FAILURE"


class AdequacyServiceError(RuntimeError):
    """One safe public failure type for every non-envelope service failure."""

    exit_code = 40

    def __init__(self, kind: AdequacyServiceErrorKind, safe_message: str) -> None:
        if not isinstance(kind, AdequacyServiceErrorKind):
            raise TypeError("kind must be an AdequacyServiceErrorKind")
        if not isinstance(safe_message, str) or not safe_message or len(safe_message) > 1024:
            raise ValueError("safe_message must contain between 1 and 1024 input scalars")
        self.kind = kind
        self.safe_message = safe_message
        super().__init__(safe_message)


class _InvalidPlanBoundary(RuntimeError):
    pass


class _RegistrationBoundaryFailure(RuntimeError):
    pass


class _UnsupportedEvidenceShape(RuntimeError):
    pass


def _has_control(value: str) -> bool:
    return any(unicode_category(character) in {"Cc", "Cf"} for character in value)


def _screen_root(value: object) -> Path:
    if not isinstance(value, Path):
        raise ValueError("root must be a pathlib Path")
    raw = os.fspath(value)
    if (
        not isinstance(raw, str)
        or not raw
        or raw.startswith("//")
        or _has_control(raw)
        or not value.is_absolute()
        or os.path.normpath(raw) != raw
    ):
        raise ValueError("root must have canonical absolute lexical spelling")
    return value


def _screen_selection(value: object, root: Path) -> str:
    if (
        not isinstance(value, str)
        or not value
        or _has_control(value)
        or value.startswith("/")
        or value.endswith("/")
        or "//" in value
        or "\\" in value
    ):
        raise ValueError("selection must have exact relative lexical spelling")
    path = PurePosixPath(value)
    if (
        str(path) != value
        or not path.parts
        or any(part in {"", ".", ".."} for part in path.parts)
        or path.parts[0] == root.name
    ):
        raise ValueError("selection must have exact relative lexical spelling")
    return value


def _screen_request(
    repository_root: object,
    artifact_root: object,
    baseline_relative_path: object,
    candidate_relative_path: object,
    plan_root: object,
    protocol_relative_path: object,
    discovery_ledger_relative_path: object,
    pair_plan_relative_path: object,
) -> tuple[Path, Path, str, str, Path, _models.RequestedPlanSelections]:
    repository = _screen_root(repository_root)
    artifacts = _screen_root(artifact_root)
    plans = _screen_root(plan_root)
    baseline = _screen_selection(baseline_relative_path, artifacts)
    candidate = _screen_selection(candidate_relative_path, artifacts)
    requested = _models.RequestedPlanSelections(
        protocol_relative_path=_screen_selection(protocol_relative_path, plans),
        discovery_ledger_relative_path=_screen_selection(
            discovery_ledger_relative_path, plans
        ),
        pair_plan_relative_path=_screen_selection(pair_plan_relative_path, plans),
    )
    return repository, artifacts, baseline, candidate, plans, requested


def _capture_review_pair(
    artifact_root: Path,
    baseline_relative_path: str,
    candidate_relative_path: str,
) -> object:
    facade = importlib.import_module("hermes.review.facade")
    return facade._ReviewFacade()._review_pair(
        artifact_root,
        baseline_relative_path,
        candidate_relative_path,
    )


def _capture_plans(
    plan_root: Path,
    protocol_relative_path: str,
    discovery_ledger_relative_path: str,
    pair_plan_relative_path: str,
) -> object:
    loader = importlib.import_module("hermes.adequacy.loader")
    result: object = _BOUNDARY_FAILURE
    try:
        result = loader.capture_evaluation_plans(
            plan_root,
            protocol_relative_path,
            discovery_ledger_relative_path,
            pair_plan_relative_path,
        )
    except loader.InvalidPlanError:
        result = _BOUNDARY_FAILURE
    if result is _BOUNDARY_FAILURE:
        raise _InvalidPlanBoundary
    return result


def _inspect_registration(
    repository_root: Path,
    plans: object,
    baseline_repository_commit: str | None,
    candidate_repository_commit: str | None,
) -> _models.RegistrationEvidence:
    provenance = importlib.import_module("hermes.provenance.git")
    result: _models.RegistrationEvidence | object = _BOUNDARY_FAILURE
    try:
        result = provenance.RegistrationGitInspector().inspect(
            repository_root,
            plans,
            baseline_repository_commit=baseline_repository_commit,
            candidate_repository_commit=candidate_repository_commit,
        )
    except provenance.RegistrationGitOperationalError:
        result = _BOUNDARY_FAILURE
    if result is _BOUNDARY_FAILURE:
        raise _RegistrationBoundaryFailure
    return result


def _digest_value(value: object) -> str | None:
    return None if value is None else value.value


def _side_review_state(
    reviewed: object,
    role: _models.Role,
    requested_relative_locator: str,
) -> _models.SideReviewState:
    envelope = reviewed.envelope
    artifact = envelope.artifact
    manifest = artifact.manifest_identity
    trust = {record.dimension: record.value for record in envelope.trust.records}
    diagnostics = tuple(
        _models.ArtifactDiagnostic(
            side=role,
            code=item.code,
            message=item.text,
        )
        for item in envelope.diagnostics
    )
    return _models.SideReviewState(
        identity=_models.SideIdentity(
            role=role,
            requested_relative_locator=requested_relative_locator,
            observed_run_id=manifest.run_id,
            observed_evidence_schema_version=manifest.evidence_schema_version,
            observed_scenario_schema_version=manifest.scenario_schema_version,
            observed_bundle_digest_sha256=_digest_value(artifact.observed_bundle_digest),
            computed_bundle_digest_sha256=_digest_value(artifact.computed_bundle_digest),
            observed_trace_digest_sha256=_digest_value(artifact.observed_trace_digest),
            computed_trace_digest_sha256=_digest_value(artifact.computed_trace_digest),
        ),
        gate_verdict=envelope.gate.verdict,
        integrity=envelope.verification.integrity,
        authenticity=trust["authenticity"],
        authorization=trust["authorization"],
        deployment_permission=trust["deployment_permission"],
        scope=trust["scope"],
        authoritative_status=trust["authoritative_status"],
        diagnostics=diagnostics,
    )


def _unverified_side(
    role: _models.Role,
    requested_relative_locator: str,
) -> _models.SideReviewState:
    return _models.SideReviewState(
        identity=_models.SideIdentity(
            role=role,
            requested_relative_locator=requested_relative_locator,
            observed_run_id=None,
            observed_evidence_schema_version=None,
            observed_scenario_schema_version=None,
            observed_bundle_digest_sha256=None,
            computed_bundle_digest_sha256=None,
            observed_trace_digest_sha256=None,
            computed_trace_digest_sha256=None,
        ),
        gate_verdict=None,
        integrity="UNVERIFIED",
        authenticity="NOT_AUTHENTICATED",
        authorization="NOT_EVALUATED",
        deployment_permission="NONE",
        scope="SIMULATION_ONLY",
        authoritative_status="NOT_DEFINED",
        diagnostics=(),
    )


def _not_evaluated_envelope(
    *,
    requested: _models.RequestedPlanSelections,
    baseline: _models.SideReviewState,
    candidate: _models.SideReviewState,
    compatibility: _models.Compatibility,
    compatibility_reasons: tuple[str, ...],
    reason: Literal["INVALID_EVIDENCE", "INCOMPATIBLE_EVIDENCE"],
) -> _models.EvaluationAdequacyEnvelope:
    return _models.EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version=__version__,
        requested_plan_selections=requested,
        baseline=baseline,
        candidate=candidate,
        compatibility=compatibility,
        compatibility_reasons=compatibility_reasons,
        plan_evaluation="PLAN_NOT_EVALUATED",
        plan_evaluation_reason=reason,
        protocol_source=None,
        discovery_ledger_source=None,
        pair_plan_source=None,
        assessment=None,
        registration=None,
        interpretation=_models.Interpretation.NO_INTERPRETATION,
        diagnostics=baseline.diagnostics + candidate.diagnostics,
        limitations=_LIMITATIONS,
    )


def _action(value: object) -> _models.ActionCommand:
    return _models.ActionCommand(
        steering=value.steering,
        throttle=value.throttle,
        brake=value.brake,
    )


def _mapped_phase(snapshot: object, summary: dict[str, object]) -> object:
    challenge = snapshot.scenario.challenge
    if challenge is None:
        return None
    phase: object = _BOUNDARY_FAILURE
    try:
        phase = summary["challenge_phase"]
    except KeyError:
        phase = _BOUNDARY_FAILURE
    if phase is _BOUNDARY_FAILURE:
        raise _UnsupportedEvidenceShape
    if challenge.kind == "lead_vehicle_hard_brake":
        allowed = {"PRE_TRIGGER", "BRAKING", "RECOVERY"}
    elif challenge.kind == "cut_in_near_field":
        allowed = {"PRE_TRIGGER", "CUT_IN", "POST_CUT_IN"}
    else:
        raise _UnsupportedEvidenceShape
    if phase not in allowed:
        raise _UnsupportedEvidenceShape
    return phase


def _map_verified_snapshot(
    snapshot: object,
    role: _models.Role,
    *,
    bundle_digest_sha256: str,
    trace_digest_sha256: str,
) -> _models.CapturedArtifactSide:
    """Reduce one already verified snapshot without rereading or plan coercion."""

    mapping_failed = False
    try:
        manifest = snapshot.manifest
        context = snapshot.context
        if (
            manifest.evidence_schema_version != "1.0"
            or context.evidence_schema_version != "1.0"
            or any(event.evidence_schema_version != "1.0" for event in snapshot.events)
        ):
            raise _UnsupportedEvidenceShape
        events = []
        for stored in snapshot.events:
            summary = stored.observation_summary
            events.append(
                _models.AssessmentEvent(
                    sequence=stored.sequence,
                    challenge_phase=_mapped_phase(snapshot, summary),
                    front_distance_m=summary.get("front_distance_m"),
                    front_relative_speed_mps=summary.get("front_relative_speed_mps"),
                    speed_mps=summary["speed_mps"],
                    lateral_offset_m=summary["lateral_offset_m"],
                    observation_age_s=summary["observation_age_s"],
                    candidate_action=_action(stored.candidate_action),
                    executed_action=_action(stored.executed_action),
                    override_reasons=tuple(stored.override_reasons),
                )
            )
        raw_configuration = context.shield.config
        configuration = (
            None
            if not raw_configuration
            else _models.CapturedShieldConfiguration.model_validate(raw_configuration)
        )
        scanner = _models.AssessmentSide(
            role=role,
            boundary_tolerance_m=snapshot.scenario.road.boundary_tolerance_m,
            shield=_models.CapturedShield(
                name=manifest.shield_name,
                version=manifest.shield_version,
                config_digest=manifest.shield_config_digest,
                configuration=configuration,
            ),
            events=tuple(events),
        )
        return _models.CapturedArtifactSide(
            role=role,
            run_id=manifest.run_id,
            evidence_schema_version="1.0",
            bundle_digest_sha256=bundle_digest_sha256,
            trace_digest_sha256=trace_digest_sha256,
            repository=_models.CapturedRepositoryProvenance(
                commit=manifest.repository_commit,
                dirty=manifest.repository_dirty,
                reason=manifest.repository_provenance_reason,
            ),
            hermes_version=manifest.hermes_version,
            scenario=_models.CapturedScenario(
                schema_version=manifest.scenario_schema_version,
                digest=manifest.scenario_digest,
                challenge_kind=(
                    None
                    if snapshot.scenario.challenge is None
                    else snapshot.scenario.challenge.kind
                ),
                boundary_tolerance_m=snapshot.scenario.road.boundary_tolerance_m,
            ),
            policy=_models.CapturedComponentIdentity(
                name=manifest.policy_name,
                version=manifest.policy_version,
                config_digest=manifest.policy_config_digest,
            ),
            adapter=_models.CapturedComponentIdentity(
                name=manifest.adapter_name,
                version=manifest.adapter_version,
                config_digest=manifest.adapter_config_digest,
            ),
            simulator=_models.CapturedSimulatorIdentity(
                name=manifest.simulator_name,
                version=manifest.simulator_version,
                source_commit=manifest.simulator_commit,
            ),
            gate=_models.CapturedComponentIdentity(
                name=manifest.gate_name,
                version=manifest.gate_version,
                config_digest=manifest.gate_config_digest,
            ),
            execution=_models.CapturedExecutionIdentity(
                seed=manifest.seed,
                control_frequency_hz=manifest.control_frequency_hz,
                horizon_steps=manifest.horizon_steps,
            ),
            scanner=scanner,
        )
    except _UnsupportedEvidenceShape:
        mapping_failed = True
    except (AttributeError, KeyError, TypeError, ValueError, ArithmeticError):
        mapping_failed = True
    if mapping_failed:
        raise _UnsupportedEvidenceShape
    raise RuntimeError("snapshot mapping completed without a result")  # pragma: no cover


def _evaluated_envelope(
    *,
    requested: _models.RequestedPlanSelections,
    baseline: _models.SideReviewState,
    candidate: _models.SideReviewState,
    plans: object,
    assessment: _models.AdequacyAssessment,
    registration: _models.RegistrationEvidence,
) -> _models.EvaluationAdequacyEnvelope:
    protocol_source, ledger_source, pair_source = plans.sources
    return _models.EvaluationAdequacyEnvelope(
        schema_version="1.0",
        hermes_version=__version__,
        requested_plan_selections=requested,
        baseline=baseline,
        candidate=candidate,
        compatibility="COMPATIBLE",
        compatibility_reasons=(),
        plan_evaluation="EVALUATED",
        plan_evaluation_reason=None,
        protocol_source=protocol_source,
        discovery_ledger_source=ledger_source,
        pair_plan_source=pair_source,
        assessment=assessment,
        registration=registration,
        interpretation=_models.interpretation_for(assessment.status, registration.status),
        diagnostics=baseline.diagnostics + candidate.diagnostics,
        limitations=_LIMITATIONS,
    )


def assess_review_pair_adequacy(
    repository_root: Path,
    artifact_root: Path,
    baseline_relative_path: str,
    candidate_relative_path: str,
    plan_root: Path,
    protocol_relative_path: str,
    discovery_ledger_relative_path: str,
    pair_plan_relative_path: str,
) -> _models.EvaluationAdequacyEnvelope:
    """Assess one exact current stored pair under one captured declared plan."""

    screened: object = _BOUNDARY_FAILURE
    try:
        screened = _screen_request(
            repository_root,
            artifact_root,
            baseline_relative_path,
            candidate_relative_path,
            plan_root,
            protocol_relative_path,
            discovery_ledger_relative_path,
            pair_plan_relative_path,
        )
    except (TypeError, ValueError):
        screened = _BOUNDARY_FAILURE
    if screened is _BOUNDARY_FAILURE:
        raise AdequacyServiceError(
            AdequacyServiceErrorKind.INVALID_REQUEST,
            "Adequacy request syntax is invalid.",
        )
    repository, artifacts, baseline_selection, candidate_selection, plans_root, requested = screened

    review_failed = False
    try:
        pair = _capture_review_pair(artifacts, baseline_selection, candidate_selection)
        baseline_state = _side_review_state(
            pair.baseline,
            "BASELINE",
            baseline_selection,
        )
        if baseline_state.integrity == "INVALID_EVIDENCE":
            return _not_evaluated_envelope(
                requested=requested,
                baseline=baseline_state,
                candidate=_unverified_side("CANDIDATE", candidate_selection),
                compatibility="NOT_EVALUATED",
                compatibility_reasons=(),
                reason="INVALID_EVIDENCE",
            )
        if pair.candidate is None:
            raise RuntimeError("valid baseline is missing candidate review")
        candidate_state = _side_review_state(
            pair.candidate,
            "CANDIDATE",
            candidate_selection,
        )
        if candidate_state.integrity == "INVALID_EVIDENCE":
            return _not_evaluated_envelope(
                requested=requested,
                baseline=baseline_state,
                candidate=candidate_state,
                compatibility="NOT_EVALUATED",
                compatibility_reasons=(),
                reason="INVALID_EVIDENCE",
            )
        if pair.comparison is None:
            raise RuntimeError("valid pair is missing comparison")
        compatibility = pair.comparison.compatibility
        if not compatibility.comparable:
            return _not_evaluated_envelope(
                requested=requested,
                baseline=baseline_state,
                candidate=candidate_state,
                compatibility="INCOMPATIBLE",
                compatibility_reasons=tuple(compatibility.reasons),
                reason="INCOMPATIBLE_EVIDENCE",
            )
    except Exception:
        review_failed = True
    if review_failed:
        raise AdequacyServiceError(
            AdequacyServiceErrorKind.OPERATIONAL_FAILURE,
            "Stored evidence review could not be completed safely.",
        )

    plan_failure: AdequacyServiceErrorKind | None = None
    try:
        plans = _capture_plans(
            plans_root,
            requested.protocol_relative_path,
            requested.discovery_ledger_relative_path,
            requested.pair_plan_relative_path,
        )
    except _InvalidPlanBoundary:
        plan_failure = AdequacyServiceErrorKind.INVALID_PLAN
    except Exception:
        plan_failure = AdequacyServiceErrorKind.OPERATIONAL_FAILURE
    if plan_failure is AdequacyServiceErrorKind.INVALID_PLAN:
        raise AdequacyServiceError(
            plan_failure,
            "Evaluation plans are invalid or could not be captured safely.",
        )
    if plan_failure is AdequacyServiceErrorKind.OPERATIONAL_FAILURE:
        raise AdequacyServiceError(
            plan_failure,
            "Evaluation plan capture could not be completed safely.",
        )

    mapping_failure: AdequacyServiceErrorKind | None = None
    try:
        baseline_snapshot = pair.baseline.capture.inspection.snapshot
        candidate_snapshot = pair.candidate.capture.inspection.snapshot
        if baseline_snapshot is None or candidate_snapshot is None:
            raise _UnsupportedEvidenceShape
        baseline_facts = _map_verified_snapshot(
            baseline_snapshot,
            "BASELINE",
            bundle_digest_sha256=(
                baseline_state.identity.computed_bundle_digest_sha256 or ""
            ),
            trace_digest_sha256=(
                baseline_state.identity.computed_trace_digest_sha256 or ""
            ),
        )
        candidate_facts = _map_verified_snapshot(
            candidate_snapshot,
            "CANDIDATE",
            bundle_digest_sha256=(
                candidate_state.identity.computed_bundle_digest_sha256 or ""
            ),
            trace_digest_sha256=(
                candidate_state.identity.computed_trace_digest_sha256 or ""
            ),
        )
    except _UnsupportedEvidenceShape:
        mapping_failure = AdequacyServiceErrorKind.UNSUPPORTED_EVIDENCE_SHAPE
    except Exception:
        mapping_failure = AdequacyServiceErrorKind.OPERATIONAL_FAILURE
    if mapping_failure is AdequacyServiceErrorKind.UNSUPPORTED_EVIDENCE_SHAPE:
        raise AdequacyServiceError(
            mapping_failure,
            "Stored evidence uses a shape unsupported by adequacy schema 1.0.",
        )
    if mapping_failure is AdequacyServiceErrorKind.OPERATIONAL_FAILURE:
        raise AdequacyServiceError(
            mapping_failure,
            "Stored evidence could not be reduced safely.",
        )

    registration_failed = False
    try:
        registration = _inspect_registration(
            repository,
            plans,
            baseline_facts.repository.commit,
            candidate_facts.repository.commit,
        )
    except _RegistrationBoundaryFailure:
        registration_failed = True
    except Exception:
        registration_failed = True
    if registration_failed:
        raise AdequacyServiceError(
            AdequacyServiceErrorKind.OPERATIONAL_FAILURE,
            "Local registration inspection could not be completed safely.",
        )

    assessment_failed = False
    try:
        assessment = _assess_captured_pair(
            plans.protocol,
            plans.ledger,
            plans.pair_plan,
            baseline_facts,
            candidate_facts,
        )
        return _evaluated_envelope(
            requested=requested,
            baseline=baseline_state,
            candidate=candidate_state,
            plans=plans,
            assessment=assessment,
            registration=registration,
        )
    except Exception:
        assessment_failed = True
    if assessment_failed:
        raise AdequacyServiceError(
            AdequacyServiceErrorKind.OPERATIONAL_FAILURE,
            "Adequacy assessment could not be completed safely.",
        )
    raise RuntimeError("adequacy assessment completed without a result")  # pragma: no cover


__all__ = (
    "AdequacyServiceError",
    "AdequacyServiceErrorKind",
    "assess_review_pair_adequacy",
)
