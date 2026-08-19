"""Non-selected discovery observations must be recomputed, not trusted.

Fable round-1 F-03: `FIRST_VALID_BY_GRID_ORDER` was enforced only as internal
consistency of numbers the author wrote into the ledger. Nothing ever resolved a
non-selected entry's artifacts, so an author who ran every variant privately could
report earlier grid points as not threshold-matched and select any point they liked
while still receiving `ADEQUATE`.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest

from hermes.adequacy.api import (
    _InvalidPlanBoundary,
    _verify_discovery_ledger,
    assess_review_pair_adequacy,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PLAN_ROOT = REPOSITORY_ROOT / "evaluation-plans"
ARTIFACT_ROOT = REPOSITORY_ROOT / "artifacts"
PROTOCOL = "lead_ttc_engagement.protocol.v5.yaml"
LEDGER = "lead_ttc_engagement.discovery.v5.jsonl"
PAIR_PLAN = "lead_ttc_engagement.pair.v5.yaml"
BASELINE = "handoff-p7b-lead-baseline"
CANDIDATE = "handoff-p7b-lead-candidate"


def _canonical(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")


def _require_local_evidence() -> None:
    missing = [
        str(path)
        for path in (
            PLAN_ROOT / PROTOCOL,
            PLAN_ROOT / LEDGER,
            PLAN_ROOT / PAIR_PLAN,
            ARTIFACT_ROOT / BASELINE,
            ARTIFACT_ROOT / CANDIDATE,
        )
        if not path.exists()
    ]
    if missing:
        pytest.skip(
            "Phase 7 evidence is an ignored local artifact; regenerate with the "
            f"commands in PHASE7_IMPLEMENTATION_HANDOFF.md (missing: {missing[0]})"
        )
    entries = [
        json.loads(line)
        for line in (PLAN_ROOT / LEDGER).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not all(
        (ARTIFACT_ROOT.parent / entry["artifact_locator"]).is_dir() for entry in entries
    ):
        pytest.skip("discovery artifacts are ignored local outputs and are absent")


def _assess(plan_root: Path) -> object:
    return assess_review_pair_adequacy(
        REPOSITORY_ROOT,
        ARTIFACT_ROOT,
        BASELINE,
        CANDIDATE,
        plan_root,
        PROTOCOL,
        LEDGER,
        PAIR_PLAN,
    )


def test_the_real_ledger_recomputes_against_its_artifacts() -> None:
    """Every committed v5 observation must reproduce from its own stored events."""
    _require_local_evidence()
    envelope = _assess(PLAN_ROOT)
    assert envelope.assessment is not None
    assert envelope.assessment.status.value == "ADEQUATE"


def test_falsified_non_selected_observation_is_caught_by_recomputation() -> None:
    """The ledger's own numbers are recomputed from the artifacts they name.

    Scoped honestly: end-to-end selection shopping also has to defeat the pair-plan
    identity and Git blob checks, so this is defence in depth rather than the only
    barrier. What it closes is the specific hole F-03 named - before this, no code
    path ever resolved a non-selected entry's artifacts, so its reported observation
    was accepted on the author's word alone.
    """
    _require_local_evidence()
    entries = [
        json.loads(line)
        for line in (PLAN_ROOT / LEDGER).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    plans = SimpleNamespace(
        ledger=tuple(
            SimpleNamespace(
                artifact_locator=entry["artifact_locator"],
                bundle_digest_sha256=entry["bundle_digest_sha256"],
                trace_digest_sha256=entry["trace_digest_sha256"],
                selection_evidence=SimpleNamespace(
                    observations=tuple(
                        SimpleNamespace(machine_value=observation["machine_value"])
                        for observation in entry["selection_evidence"]["observations"]
                    )
                ),
            )
            for entry in entries
        )
    )
    complete, verified, total = _verify_discovery_ledger(plans, ARTIFACT_ROOT)
    assert complete and verified == total == len(entries)

    tampered = deepcopy(plans)
    tampered.ledger[0].selection_evidence.observations[0].machine_value = 4.5
    with pytest.raises(_InvalidPlanBoundary):
        _verify_discovery_ledger(tampered, ARTIFACT_ROOT)

    wrong_digest = deepcopy(plans)
    wrong_digest.ledger[-1].trace_digest_sha256 = "f" * 64
    with pytest.raises(_InvalidPlanBoundary):
        _verify_discovery_ledger(wrong_digest, ARTIFACT_ROOT)


def test_absent_discovery_artifacts_are_reported_not_silently_skipped() -> None:
    """When artifacts are absent the caller must learn the observations are unverified."""
    plans = SimpleNamespace(
        ledger=(
            SimpleNamespace(
                artifact_locator="artifacts/does-not-exist",
                bundle_digest_sha256="a" * 64,
                trace_digest_sha256="b" * 64,
                selection_evidence=SimpleNamespace(observations=()),
            ),
        )
    )
    complete, verified, total = _verify_discovery_ledger(plans, ARTIFACT_ROOT)
    assert (complete, verified, total) == (False, 0, 1)
