"""Approval records and the mutation boundary they guard.

The rule this module exists to enforce: **an agent may draft a canonical change, but only a
recorded human decision, bound to that draft's exact content digest, promotes it.**

Two properties make the boundary real rather than decorative:

* An approval is bound to a *content digest*, not to a draft name. Editing a draft after
  approval invalidates the approval, because the digest no longer matches. Approving "the
  cut-in regression" and silently shipping something else is the failure mode this closes.
* Enforcement lives in ``promote_regression`` in the tool layer, so it applies identically
  to a scripted agent, a live model, a desktop coding agent, or a person at the CLI.

**What this approves, and what it does not.** An approval record approves *a repository
change* - promoting a draft scenario into the canonical suite. It is not a gate verdict, not
evidence approval, and not deployment permission. Those remain the five separate trust-state
axes the review layer already keeps apart, and nothing here may be read as collapsing them.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import Field, ValidationError, field_validator, model_validator

from hermes.domain.models import HermesModel
from hermes.scenarios.yaml_loader import StrictYamlError, load_strict_yaml

MAX_REGISTRY_BYTES = 1_048_576


class ApprovalError(ValueError):
    """Actionable approval-registry parsing, validation, or enforcement failure."""


class DraftState(StrEnum):
    """Draft lifecycle from PRD §0-A.8.2."""

    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROMOTED = "PROMOTED"


class ApprovalDecision(StrEnum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ApprovalRecord(HermesModel):
    """One human decision about one exact draft.

    ``approver`` is recorded as an opaque identifier. Hermes does not authenticate it, and
    this record therefore establishes that *a decision was recorded*, not that a particular
    person made it - the same honesty the authenticity axis already applies to evidence.
    """

    draft_id: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_-]{0,63}$")]
    draft_content_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    approver: Annotated[str, Field(min_length=1, max_length=128)]
    timestamp_utc: Annotated[str, Field(min_length=1, max_length=64)]
    decision: ApprovalDecision
    rationale: Annotated[str, Field(min_length=1, max_length=1_000)]

    @field_validator("decision", mode="before")
    @classmethod
    def normalize_yaml_decision(cls, value: object) -> object:
        # HermesModel is strict, so an enum arrives from YAML as a plain string and would
        # otherwise be rejected on reload. Coerce only exact known members.
        return ApprovalDecision(value) if isinstance(value, str) else value

    @field_validator("timestamp_utc")
    @classmethod
    def require_utc_timestamp(cls, value: str) -> str:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("timestamp_utc must be an ISO-8601 instant") from exc
        if parsed.tzinfo is None:
            raise ValueError("timestamp_utc must carry a timezone")
        return value


class ApprovalRegistry(HermesModel):
    """The committed set of decisions, mirroring the Phase 7 digest-bound registry pattern."""

    schema_version: Literal["1.0"]
    label: Literal["repository_change_approvals_not_evidence_or_deployment_approval"]
    approvals: tuple[ApprovalRecord, ...] = ()

    @field_validator("approvals", mode="before")
    @classmethod
    def normalize_yaml_sequence(cls, value: object) -> object:
        return tuple(value) if isinstance(value, list) else value

    @model_validator(mode="after")
    def require_one_decision_per_digest(self) -> ApprovalRegistry:
        seen = [(record.draft_id, record.draft_content_digest) for record in self.approvals]
        if len(set(seen)) != len(seen):
            raise ValueError("a draft content digest may carry at most one decision")
        return self

    def decision_for(self, draft_id: str, content_digest: str) -> ApprovalRecord | None:
        for record in self.approvals:
            if record.draft_id == draft_id and record.draft_content_digest == content_digest:
                return record
        return None


def draft_content_digest(content: bytes) -> str:
    """Digest of a draft's exact bytes.

    Deliberately over the raw bytes rather than over a parsed form: an approval should be
    invalidated by any edit, including one that parses to the same object.
    """
    return hashlib.sha256(content).hexdigest()


def parse_approval_registry_yaml(text: str) -> ApprovalRegistry:
    try:
        payload = load_strict_yaml(text)
    except StrictYamlError as exc:
        raise ApprovalError(f"approval registry YAML is malformed: {exc}") from exc
    try:
        return ApprovalRegistry.model_validate(payload)
    except ValidationError as exc:
        raise ApprovalError(f"approval registry validation failed: {exc}") from exc


def load_approval_registry(path: Path) -> ApprovalRegistry:
    """Load the committed registry, treating absence as "nothing is approved"."""
    if not path.exists():
        return ApprovalRegistry(
            schema_version="1.0",
            label="repository_change_approvals_not_evidence_or_deployment_approval",
        )
    raw = path.read_bytes()
    if len(raw) > MAX_REGISTRY_BYTES:
        raise ApprovalError("approval registry exceeds the supported size")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ApprovalError(f"approval registry is not valid UTF-8: {exc}") from exc
    return parse_approval_registry_yaml(text)


def append_approval(path: Path, record: ApprovalRecord) -> ApprovalRegistry:
    """Record one decision, refusing to overwrite an existing one for the same digest."""
    registry = load_approval_registry(path)
    if registry.decision_for(record.draft_id, record.draft_content_digest) is not None:
        raise ApprovalError(
            f"draft {record.draft_id!r} already carries a decision for this content digest"
        )
    updated = registry.model_copy(
        update={"approvals": (*registry.approvals, record)}
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(updated.model_dump(mode="json"), sort_keys=True, allow_unicode=True),
        encoding="utf-8",
    )
    return updated


def authorize_promotion(
    registry: ApprovalRegistry,
    *,
    draft_id: str,
    content: bytes,
) -> ApprovalRecord:
    """Return the approval permitting this promotion, or refuse with a reason.

    Every refusal path is explicit. There is no branch in which a missing or stale approval
    results in the promotion proceeding.
    """
    digest = draft_content_digest(content)
    record = registry.decision_for(draft_id, digest)
    if record is None:
        raise ApprovalError(
            f"draft {draft_id!r} has no approval for content digest {digest[:12]}...; "
            "an edit after approval invalidates it"
        )
    if record.decision is not ApprovalDecision.APPROVED:
        raise ApprovalError(f"draft {draft_id!r} was {record.decision.value}, not approved")
    return record
