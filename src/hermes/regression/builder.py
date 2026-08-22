"""Turning a failed run into a proposed regression scenario.

The derivation is deliberately dull and inspectable. It reads the geometry the trace records
at the failing event and proposes a scenario that *starts* there — a sharper reproduction of
the same failure that reaches the interesting moment immediately instead of driving up to it.

Two things it will not do:

* It will not draft when the suite already covers the conditions. The flywheel exists to
  close coverage gaps, and a duplicate scenario costs simulation time forever while telling a
  reviewer nothing new.
* It will not weaken what it derives from. The requirement floor is applied to the proposal
  before anyone is asked to approve it, so a draft that quietly drops an expectation is
  rejected by the validator rather than by a human reading a plausible YAML diff.

Nothing here is an agent. This is the deterministic tool an agent calls, and it produces the
same draft for the same evidence whoever invokes it.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import yaml

from hermes.domain.models import ScenarioDefinition
from hermes.regression.floor import enforce_floor
from hermes.regression.models import (
    CoverageAssessment,
    DraftProvenance,
    DraftState,
    FloorViolation,
    RegressionDraft,
)

#: Two scenarios count as covering the same conditions when their starting geometry agrees
#: within these tolerances. Loose enough that near-identical proposals are recognised as
#: duplicates, tight enough that a genuinely sharper case still reads as new coverage.
_GAP_TOLERANCE_M = 5.0
_SPEED_TOLERANCE_MPS = 2.0


class RegressionDraftError(ValueError):
    """Actionable failure while assessing coverage or drafting a regression scenario."""


def _scenario_signature(scenario: ScenarioDefinition) -> tuple[object, ...]:
    challenge = scenario.challenge
    expectation = (
        scenario.adas.expected_aeb.kind
        if scenario.adas is not None and scenario.adas.expected_aeb is not None
        else None
    )
    return (
        None if challenge is None else challenge.kind,
        expectation,
        None if challenge is None else getattr(challenge, "initial_gap_m", None),
        scenario.initial_state.speed_mps,
    )


def assess_coverage(
    *,
    candidate: ScenarioDefinition,
    suite: tuple[ScenarioDefinition, ...],
) -> CoverageAssessment:
    """Decide whether the canonical suite already exercises these conditions."""
    kind, expectation, gap, speed = _scenario_signature(candidate)
    for existing in suite:
        other_kind, other_expectation, other_gap, other_speed = _scenario_signature(existing)
        if (kind, expectation) != (other_kind, other_expectation):
            continue
        if gap is not None and other_gap is not None:
            if abs(gap - other_gap) > _GAP_TOLERANCE_M:
                continue
        elif gap != other_gap:
            continue
        if abs(speed - other_speed) > _SPEED_TOLERANCE_MPS:
            continue
        return CoverageAssessment(
            covered=True,
            matching_scenario=existing.name,
            reason=(
                f"{existing.name} already exercises a {kind or 'lead-free'} scenario within "
                f"{_GAP_TOLERANCE_M} m and {_SPEED_TOLERANCE_MPS} m/s of these conditions"
            ),
        )
    return CoverageAssessment(
        covered=False,
        reason="no committed scenario exercises these starting conditions",
    )


def _failure_geometry(
    events: list[dict],
    sequence: int | None,
) -> tuple[float | None, float | None]:
    """Gap and ego speed at the failing event, or (None, None) when unavailable."""
    if sequence is None or sequence >= len(events):
        return None, None
    event = events[sequence]
    gap = event.get("observation_summary", {}).get("front_distance_m")
    speed = event.get("vehicle_state", {}).get("speed_mps")
    gap = float(gap) if isinstance(gap, (int, float)) and not isinstance(gap, bool) else None
    speed = (
        float(speed) if isinstance(speed, (int, float)) and not isinstance(speed, bool) else None
    )
    return gap, speed


def derive_scenario_payload(
    source: ScenarioDefinition,
    *,
    observed_gap_m: float | None,
    observed_ego_speed_mps: float | None,
    scenario_name: str,
    trigger_finding_id: str,
) -> dict:
    """Build the proposed scenario as a plain payload, starting at the failure geometry.

    Everything not derived from the observation is copied from the source, so the diff a
    reviewer reads is exactly the starting conditions and the identity - not an opaque
    regeneration that happens to resemble the original.
    """
    payload = source.model_dump(mode="json")
    payload["name"] = scenario_name
    payload["version"] = "1.0"
    payload["description"] = (
        f"Regression case derived from a {trigger_finding_id} failure on "
        f"{source.name}; starts at the observed failure geometry."
    )[:500]
    payload["tags"] = sorted({*source.tags, "regression"})

    if observed_ego_speed_mps is not None:
        payload["initial_state"]["speed_mps"] = round(
            min(50.0, max(0.0, observed_ego_speed_mps)), 3
        )
    if payload.get("challenge") is not None and observed_gap_m is not None:
        # Clamped to the schema's own bounds rather than trusted from the trace: a gap of
        # zero is a collision, not a scenario, and the loader would reject it later anyway.
        payload["challenge"]["initial_gap_m"] = round(
            min(200.0, max(1.0, observed_gap_m)), 3
        )
        # The threat is present from the start now, so the scripted trigger fires promptly.
        payload["challenge"]["trigger_step"] = 1
    return payload


def scenario_yaml_bytes(payload: dict) -> bytes:
    """Serialize a proposal deterministically, so its digest is stable."""
    return yaml.safe_dump(payload, sort_keys=True, allow_unicode=True).encode("utf-8")


def build_regression_draft(
    *,
    repository_root: Path,
    artifact_root: Path,
    run_id: str,
    draft_root: Path,
    suite: tuple[ScenarioDefinition, ...],
) -> tuple[RegressionDraft, Path, CoverageAssessment, tuple[FloorViolation, ...]]:
    """Draft a regression scenario from a failed run.

    Returns the draft record, the path its scenario was written to, the coverage assessment,
    and any requirement-floor violations. A draft with violations is written as ``DRAFT``
    rather than ``VALIDATED`` and is not promotable.
    """
    from hermes.scenarios.loader import parse_scenario_yaml, scenario_digest

    bundle = artifact_root / run_id
    if not bundle.is_dir():
        raise RegressionDraftError(f"unknown run: {run_id}")

    findings_document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    findings = (
        findings_document["findings"]
        if isinstance(findings_document, dict)
        else findings_document
    )
    failing = [item for item in findings if item["status"] == "FAIL"]
    if not failing:
        raise RegressionDraftError(
            f"run {run_id} has no failing finding; there is nothing to regress against"
        )
    # Prefer an ADAS failure: a comfort or progress failure is a symptom, and drafting a
    # regression case for it would pin the symptom rather than the behaviour that caused it.
    trigger = next(
        (item for item in failing if item["finding_id"].startswith("adas.")), failing[0]
    )

    source = parse_scenario_yaml(
        (bundle / "scenario.resolved.yaml").read_text(encoding="utf-8")
    )
    events = [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    sequences = trigger.get("event_sequences") or []
    sequence = sequences[0] if sequences else None
    gap, speed = _failure_geometry(events, sequence)

    short = hashlib.sha256(
        f"{run_id}:{trigger['finding_id']}:{sequence}".encode()
    ).hexdigest()[:8]
    scenario_name = f"{source.name}_regression_{short}"[:64]
    payload = derive_scenario_payload(
        source,
        observed_gap_m=gap,
        observed_ego_speed_mps=speed,
        scenario_name=scenario_name,
        trigger_finding_id=trigger["finding_id"],
    )
    content = scenario_yaml_bytes(payload)

    try:
        proposed = parse_scenario_yaml(content.decode("utf-8"))
    except Exception as exc:  # the loader raises its own typed error
        raise RegressionDraftError(f"derived scenario failed validation: {exc}") from exc

    coverage = assess_coverage(candidate=proposed, suite=suite)
    violations = enforce_floor(source, proposed)

    draft_id = f"regression-{short}"
    draft = RegressionDraft(
        draft_id=draft_id,
        state=DraftState.DRAFT if violations else DraftState.VALIDATED,
        scenario_name=proposed.name,
        scenario_content_digest=hashlib.sha256(content).hexdigest(),
        provenance=DraftProvenance(
            source_run_id=run_id,
            source_bundle_digest=(bundle / "bundle.sha256")
            .read_text(encoding="utf-8")
            .strip()
            .split()[0],
            source_scenario_name=source.name,
            source_scenario_digest=scenario_digest(source),
            trigger_finding_id=trigger["finding_id"],
            trigger_event_sequence=sequence,
            observed_gap_m=gap,
            observed_ego_speed_mps=speed,
        ),
        rationale=(
            f"{trigger['finding_id']} failed on {source.name} at sequence {sequence}. "
            f"This case starts at the observed geometry so the failure is reached "
            f"immediately rather than driven up to."
        )[:1000],
    )

    destination = draft_root / draft_id
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "scenario.yaml").write_bytes(content)
    (destination / "draft.json").write_text(
        json.dumps(draft.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    if violations:
        (destination / "floor-violations.json").write_text(
            json.dumps(
                [violation.model_dump(mode="json") for violation in violations],
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
    return draft, destination / "scenario.yaml", coverage, violations


def load_draft(draft_dir: Path) -> RegressionDraft:
    """Load a draft record, refusing one whose scenario bytes no longer match its digest."""
    record = json.loads((draft_dir / "draft.json").read_text(encoding="utf-8"))
    draft = RegressionDraft.model_validate(record)
    content = (draft_dir / "scenario.yaml").read_bytes()
    if hashlib.sha256(content).hexdigest() != draft.scenario_content_digest:
        raise RegressionDraftError(
            f"draft {draft.draft_id} has been edited since it was recorded; "
            "its digest no longer matches its scenario"
        )
    return draft


def committed_suite(repository_root: Path) -> tuple[ScenarioDefinition, ...]:
    """Every committed scenario, for coverage assessment."""
    from hermes.scenarios.loader import ScenarioLoadError, load_scenario

    scenarios: list[ScenarioDefinition] = []
    for path in sorted((repository_root / "scenarios").rglob("*.yaml")):
        if path.name.endswith(".example.yaml"):
            continue
        try:
            scenarios.append(load_scenario(path))
        except ScenarioLoadError:
            continue
    return tuple(scenarios)
