"""Comparing two controllers without weakening the fail-closed contract.

Comparison refuses any pair whose identity or configuration digests differ, because a metric
delta between them cannot be attributed to anything. That is correct, and it also makes the
single most useful comparison - this controller against that controller - impossible.

A declared variation axis resolves it by inverting who states the assumption: the caller
names the independent variable in advance, and every other digest must still match exactly.
These tests pin that the relaxation is exactly that narrow, and that the default is unchanged.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from hermes.comparison.compare import VariationAxis, compare_artifacts
from hermes.evidence.verification import inspect_artifact


def _snapshot(repository_root: Path, run_id: str):
    inspection = inspect_artifact(repository_root / "artifacts" / run_id)
    assert inspection.snapshot is not None, f"{run_id} did not verify"
    return inspection.snapshot


@pytest.fixture
def different_scenarios(repository_root: Path):
    """Two bundles run on different scenarios - incomparable for a reason no axis covers.

    Note the shield is deliberately *not* one of the compatibility checks: comparing a
    shielded run against an unshielded one is the Phase 3 comparison the repository was
    built to do. The scenario digest is the check that genuinely cannot be relaxed.
    """
    return (
        _snapshot(repository_root, "handoff-p3-lead-baseline"),
        _snapshot(repository_root, "handoff-p3-cutin-baseline"),
    )


def test_the_default_is_unchanged_and_fully_fail_closed(different_scenarios) -> None:
    """No declared axis means the original behaviour, byte for byte."""
    baseline, candidate = different_scenarios

    comparison = compare_artifacts(baseline, candidate)

    assert comparison.compatibility.declared_variation_axis is VariationAxis.NONE
    assert comparison.compatibility.varied == ()
    assert comparison.compatibility.comparable is False
    assert comparison.compatibility.reasons


def test_a_declared_axis_does_not_excuse_an_undeclared_difference(
    different_scenarios,
) -> None:
    """The relaxation is narrow: declaring policy does not relax the scenario check.

    This is the property that keeps the contract meaningful. If declaring one axis quietly
    relaxed the others, the caller's declaration would be a password rather than a claim.
    """
    baseline, candidate = different_scenarios

    comparison = compare_artifacts(baseline, candidate, VariationAxis.POLICY)

    assert comparison.compatibility.comparable is False
    assert any("scenario" in reason for reason in comparison.compatibility.reasons)


def test_comparing_a_bundle_with_itself_is_comparable_under_any_axis(
    repository_root: Path,
) -> None:
    snapshot = _snapshot(repository_root, "handoff-phase5-demo")

    strict = compare_artifacts(snapshot, snapshot)
    declared = compare_artifacts(snapshot, snapshot, VariationAxis.POLICY)

    assert strict.compatibility.comparable
    assert declared.compatibility.comparable


def test_a_declared_axis_that_did_not_vary_is_surfaced_as_a_warning(
    repository_root: Path,
) -> None:
    """Believing you compared two controllers when you compared one is worth saying."""
    snapshot = _snapshot(repository_root, "handoff-phase5-demo")

    comparison = compare_artifacts(snapshot, snapshot, VariationAxis.POLICY)

    assert any(
        "did not vary" in warning for warning in comparison.compatibility.warnings
    ), comparison.compatibility.warnings


def test_the_axis_vocabulary_is_closed() -> None:
    """A caller cannot invent an axis; the permitted relaxations are enumerated."""
    assert {axis.value for axis in VariationAxis} == {"none", "policy"}


def test_every_non_policy_identity_check_stays_mandatory() -> None:
    """Guards the exemption list against quietly growing."""
    from hermes.comparison.compare import _AXIS_EXEMPT_CHECKS

    assert _AXIS_EXEMPT_CHECKS[VariationAxis.NONE] == frozenset()
    assert _AXIS_EXEMPT_CHECKS[VariationAxis.POLICY] == frozenset(
        {"policy name", "policy version", "policy configuration digest"}
    )
