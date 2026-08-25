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
from pathlib import Path, PurePosixPath
from typing import Annotated, Any

from pydantic import Field

from hermes.agents.contracts import Citation
from hermes.domain.models import HermesModel, JsonValue
from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES
from hermes.evidence.verification import _inspect_artifact_under_root_capture


class CitationStatus(StrEnum):
    RESOLVED = "RESOLVED"
    RUN_NOT_FOUND = "RUN_NOT_FOUND"
    BUNDLE_DIGEST_MISMATCH = "BUNDLE_DIGEST_MISMATCH"
    LOCATOR_DANGLING = "LOCATOR_DANGLING"
    VALUE_DRIFTED = "VALUE_DRIFTED"
    UNSAFE_PATH = "UNSAFE_PATH"
    INVALID_EVIDENCE = "INVALID_EVIDENCE"


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
    """Strictly resolve one RFC 6901 JSON pointer, returning ``(found, value)``."""

    if not isinstance(pointer, str):
        return False, None
    if pointer == "":
        return True, payload
    if not pointer.startswith("/"):
        return False, None

    def decode(token: str) -> str | None:
        result: list[str] = []
        index = 0
        while index < len(token):
            character = token[index]
            if character != "~":
                result.append(character)
                index += 1
                continue
            if index + 1 >= len(token) or token[index + 1] not in "01":
                return None
            result.append("~" if token[index + 1] == "0" else "/")
            index += 2
        return "".join(result)

    current = payload
    for encoded in pointer[1:].split("/"):
        token = decode(encoded)
        if token is None:
            return False, None
        if isinstance(current, dict):
            if token not in current:
                return False, None
            current = current[token]
        elif isinstance(current, list):
            if (
                not token.isdigit()
                or (len(token) > 1 and token.startswith("0"))
                or int(token) >= len(current)
            ):
                return False, None
            current = current[int(token)]
        else:
            return False, None
    return True, current


def check_citation(citation: Citation, artifact_root: Path) -> CitationCheck:
    """Re-resolve one citation from one root-contained immutable capture."""

    selection = citation.run_id
    path = PurePosixPath(selection)
    if (
        not selection
        or path.is_absolute()
        or "\\" in selection
        or "\x00" in selection
        or selection.endswith("/")
        or "//" in selection
        or any(part in {"", ".", ".."} for part in path.parts)
        or str(path) != selection
    ):
        return CitationCheck(
            citation=citation,
            status=CitationStatus.UNSAFE_PATH,
            detail="citation run selection is not a lexical root-contained path",
        )
    if citation.artifact_file not in REQUIRED_ARTIFACT_FILES:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.UNSAFE_PATH,
            detail="citation artifact file is outside the exact bundle allowlist",
        )

    capture = _inspect_artifact_under_root_capture(artifact_root, selection)
    inspection = capture.inspection
    payloads = capture.payload_map()
    if not capture.captured_files:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.RUN_NOT_FOUND,
            detail=f"no safely captured bundle for run {citation.run_id}",
        )
    observed_digest = inspection.observed_bundle_digest
    if observed_digest is None:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.INVALID_EVIDENCE,
            detail="bundle digest is absent or malformed in the immutable capture",
        )
    if observed_digest != citation.bundle_digest:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.BUNDLE_DIGEST_MISMATCH,
            detail=(
                "the citation was written against a different bundle: "
                f"{citation.bundle_digest[:12]} vs {observed_digest[:12]}"
            ),
        )

    if inspection.snapshot is None:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.INVALID_EVIDENCE,
            detail="citation bundle did not pass independent stored verification",
        )
    target = payloads.get(citation.artifact_file)
    if target is None:
        return CitationCheck(
            citation=citation,
            status=CitationStatus.LOCATOR_DANGLING,
            detail=f"{citation.artifact_file} is absent from the immutable capture",
        )

    if citation.locator.startswith("sequence:"):
        if citation.artifact_file != "events.jsonl":
            return CitationCheck(
                citation=citation,
                status=CitationStatus.LOCATOR_DANGLING,
                detail="sequence locators are allowed only for events.jsonl",
            )
        event_locator = citation.locator.split(":", 1)[1]
        wanted, separator, field_pointer = event_locator.partition("/")
        if not wanted.isdigit():
            return CitationCheck(
                citation=citation,
                status=CitationStatus.LOCATOR_DANGLING,
                detail=f"malformed sequence locator: {citation.locator}",
            )
        try:
            events = tuple(json.loads(line) for line in target.splitlines())
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError, RecursionError):
            return CitationCheck(
                citation=citation,
                status=CitationStatus.INVALID_EVIDENCE,
                detail="captured events are malformed",
            )
        for event in events:
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

    try:
        payload = json.loads(target)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError, RecursionError):
        return CitationCheck(
            citation=citation,
            status=CitationStatus.LOCATOR_DANGLING,
            detail=f"{citation.artifact_file} does not support this JSON locator",
        )
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
