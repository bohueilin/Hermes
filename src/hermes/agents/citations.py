"""Re-resolving a citation against the evidence it claims to come from.

A citation that is never checked is decoration. This resolver re-opens the bundle, walks the
locator, and compares the value found against the value the citation quotes - so "the agent
cited evidence" becomes a testable claim rather than a stylistic one.

Four ways a citation fails, all of them things that happen in practice:

* the run it names is not present,
* the bundle digest has moved, so the citation points at different evidence than it was
  written against,
* the locator dangles - the field or event sequence no longer exists,
* the value has drifted, which is the dangerous one: the citation still resolves, so it
  looks fine, while the number in the narrative no longer matches the number in the trace.
"""

from __future__ import annotations

import json
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Any

from pydantic import Field

from hermes.agents.contracts import Citation
from hermes.domain.models import HermesModel, JsonValue


class CitationStatus(StrEnum):
    RESOLVED = "RESOLVED"
    RUN_NOT_FOUND = "RUN_NOT_FOUND"
    BUNDLE_DIGEST_MISMATCH = "BUNDLE_DIGEST_MISMATCH"
    LOCATOR_DANGLING = "LOCATOR_DANGLING"
    VALUE_DRIFTED = "VALUE_DRIFTED"


class CitationCheck(HermesModel):
    """The outcome of re-resolving one citation."""

    citation: Citation
    status: CitationStatus
    resolved_value: JsonValue = None
    detail: Annotated[str, Field(min_length=1, max_length=300)]

    @property
    def valid(self) -> bool:
        return self.status is CitationStatus.RESOLVED


def _walk(payload: Any, pointer: str) -> tuple[bool, Any]:
    """Resolve a slash-delimited pointer, returning (found, value)."""
    current = payload
    for token in [part for part in pointer.split("/") if part]:
        if isinstance(current, dict):
            if token not in current:
                return False, None
            current = current[token]
        elif isinstance(current, list):
            if not token.isdigit() or int(token) >= len(current):
                return False, None
            current = current[int(token)]
        else:
            return False, None
    return True, current


def check_citation(citation: Citation, artifact_root: Path) -> CitationCheck:
    """Re-resolve one citation against stored evidence."""
    bundle = artifact_root / citation.run_id
    if not bundle.is_dir():
        return CitationCheck(
            citation=citation,
            status=CitationStatus.RUN_NOT_FOUND,
            detail=f"no bundle for run {citation.run_id}",
        )
    digest_file = bundle / "bundle.sha256"
    if not digest_file.is_file():
        return CitationCheck(
            citation=citation,
            status=CitationStatus.RUN_NOT_FOUND,
            detail="bundle.sha256 is absent",
        )
    observed_digest = digest_file.read_text(encoding="utf-8").strip().split()[0]
    if observed_digest != citation.bundle_digest:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.BUNDLE_DIGEST_MISMATCH,
            detail=(
                "the citation was written against a different bundle: "
                f"{citation.bundle_digest[:12]} vs {observed_digest[:12]}"
            ),
        )

    target = bundle / citation.artifact_file
    if not target.is_file():
        return CitationCheck(
            citation=citation,
            status=CitationStatus.LOCATOR_DANGLING,
            detail=f"{citation.artifact_file} is absent from the bundle",
        )

    if citation.locator.startswith("sequence:"):
        event_locator = citation.locator.split(":", 1)[1]
        wanted, separator, field_pointer = event_locator.partition("/")
        if not wanted.isdigit():
            return CitationCheck(
                citation=citation,
                status=CitationStatus.LOCATOR_DANGLING,
                detail=f"malformed sequence locator: {citation.locator}",
            )
        for line in target.read_text(encoding="utf-8").splitlines():
            event = json.loads(line)
            if event.get("sequence") == int(wanted):
                if not separator:
                    value = event["executed_action"]["brake"]
                else:
                    found, value = _walk(event, f"/{field_pointer}")
                    if not found:
                        return CitationCheck(
                            citation=citation,
                            status=CitationStatus.LOCATOR_DANGLING,
                            detail=(
                                f"{citation.locator} does not resolve in "
                                f"{citation.artifact_file}"
                            ),
                        )
                return _compare(citation, value)
        return CitationCheck(
            citation=citation,
            status=CitationStatus.LOCATOR_DANGLING,
            detail=f"no event at {citation.locator}",
        )

    payload = json.loads(target.read_text(encoding="utf-8"))
    found, value = _walk(payload, citation.locator)
    if not found:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.LOCATOR_DANGLING,
            detail=f"{citation.locator} does not resolve in {citation.artifact_file}",
        )
    return _compare(citation, value)


def _scalar(value: Any) -> JsonValue:
    """Keep only scalars in the check record; a whole sub-document is not a resolved value."""
    return value if isinstance(value, (str, int, float, bool, type(None))) else None


def _compare(citation: Citation, value: Any) -> CitationCheck:
    if value != citation.quoted_value:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.VALUE_DRIFTED,
            resolved_value=_scalar(value),
            detail=f"quoted {citation.quoted_value!r} but the evidence now reads {value!r}",
        )
    return CitationCheck(
        citation=citation,
        status=CitationStatus.RESOLVED,
        resolved_value=_scalar(value),
        detail="resolved and matched",
    )


def check_citations(
    citations: tuple[Citation, ...], artifact_root: Path
) -> tuple[CitationCheck, ...]:
    return tuple(check_citation(citation, artifact_root) for citation in citations)


def all_valid(checks: tuple[CitationCheck, ...]) -> bool:
    """Whether every citation resolved and matched.

    Fails closed on an empty set: a claim supported by no citations is not a cited claim.
    """
    return bool(checks) and all(check.valid for check in checks)
