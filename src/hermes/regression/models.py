"""Typed records for the failure-to-regression flywheel.

A draft is a *proposal*, and everything about its shape is chosen so that it stays one until
a human decides otherwise. It carries where it came from, what failure provoked it, and a
digest of the exact scenario bytes it proposes — so an approval can bind to those bytes and
nothing else, and so a reviewer can trace the proposal back to the evidence that motivated it
without trusting the proposal's own account of itself.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Field, field_validator

from hermes.domain.models import FiniteFloat, HermesModel


class DraftState(StrEnum):
    """Lifecycle of a proposed regression scenario (PRD §0-A.8.2).

    The states are deliberately not a workflow the agent can advance on its own. An agent
    moves a draft from DRAFT to VALIDATED by passing the deterministic validator; only a
    recorded human decision moves it to APPROVED or REJECTED, and only the tool layer moves
    an approved draft to PROMOTED.
    """

    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROMOTED = "PROMOTED"


class DraftProvenance(HermesModel):
    """Where a draft came from, recorded so the proposal need not be taken on trust."""

    source_run_id: Annotated[str, Field(min_length=1, max_length=64)]
    source_bundle_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    source_scenario_name: Annotated[str, Field(min_length=1, max_length=64)]
    source_scenario_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    trigger_finding_id: Annotated[str, Field(min_length=1, max_length=64)]
    trigger_event_sequence: Annotated[int, Field(ge=0)] | None = None
    #: Geometry observed at the triggering event, and the basis for the derived scenario.
    observed_gap_m: Annotated[FiniteFloat, Field(ge=0.0)] | None = None
    observed_ego_speed_mps: Annotated[FiniteFloat, Field(ge=0.0)] | None = None


class RegressionDraft(HermesModel):
    """One proposed addition to the canonical regression suite."""

    schema_version: Literal["1.0"] = "1.0"
    draft_id: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    state: DraftState
    scenario_name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
    #: Digest of the proposed scenario's exact bytes. An approval binds to this, so any edit
    #: after approval invalidates the approval rather than silently shipping something else.
    scenario_content_digest: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    provenance: DraftProvenance
    rationale: Annotated[str, Field(min_length=1, max_length=1_000)]

    @field_validator("state", mode="before")
    @classmethod
    def normalize_serialized_state(cls, value: object) -> object:
        # HermesModel is strict, so a state reloaded from draft.json arrives as a plain
        # string and would otherwise be rejected. Coerce only exact known members.
        return DraftState(value) if isinstance(value, str) else value

    @property
    def is_promotable(self) -> bool:
        """Only a validated or approved draft may be considered for promotion.

        Promotion still requires a matching approval record; this only excludes drafts that
        have not passed the validator or have already been promoted or rejected.
        """
        return self.state in {DraftState.VALIDATED, DraftState.APPROVED}


class CoverageAssessment(HermesModel):
    """Whether the canonical suite already exercises a failure's conditions.

    The flywheel's job is to close coverage gaps, not to grow the suite. A proposal that
    duplicates existing coverage costs simulation time forever and tells a reviewer nothing,
    so the curator step answers this before anything is drafted.
    """

    covered: bool
    matching_scenario: Annotated[str, Field(min_length=1, max_length=64)] | None = None
    reason: Annotated[str, Field(min_length=1, max_length=300)]


class FloorViolation(HermesModel):
    """One way a draft would weaken the coverage it derives from."""

    rule: Annotated[str, Field(min_length=1, max_length=64)]
    detail: Annotated[str, Field(min_length=1, max_length=300)]
