"""The review surface must render ADAS evidence, and must not drift from the gate.

The review layer holds several deliberately closed registries — finding labels, thresholds,
consequences, profile orders, requiredness, and schema/profile pairings. That closure is a
feature: a bundle whose shape the reviewer does not understand is refused rather than
half-rendered. It also means every one of them had to be extended for ADAS, and any one left
behind takes the whole review path down.

These tests pin two things: that the extensions are internally consistent with the gate that
produces the evidence, and that the review path actually survives an ADAS bundle end to end.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from hermes.gates.release import (
    EVIDENCE_REQUIREMENTS_BY_PROFILE,
    EXPECTED_FINDINGS_BY_PROFILE,
    VerifierProfile,
)
from hermes.review.models import (
    EMITTED_FINDING_ORDER_BY_PROFILE,
    FINDING_ORDER_BY_PROFILE,
    REQUIREDNESS_BY_PROFILE,
)


@pytest.mark.parametrize("profile", list(VerifierProfile))
def test_review_finding_order_matches_gate_profiles(profile: VerifierProfile) -> None:
    """The review core restates the gate's profile order; it must not drift from it.

    Restating rather than importing keeps the review core's contract frozen and inspectable,
    but a restatement that silently disagrees with the gate would render evidence in an order
    that does not match what was evaluated. This is the guard that makes the restatement safe.
    """
    gate_requirements = EVIDENCE_REQUIREMENTS_BY_PROFILE[profile]

    expected_order = tuple(item.finding_id for item in gate_requirements.requirements)
    expected_requiredness = tuple(
        item.requiredness.value for item in gate_requirements.requirements
    )

    assert FINDING_ORDER_BY_PROFILE[profile.value] == expected_order
    assert REQUIREDNESS_BY_PROFILE[profile.value] == expected_requiredness


@pytest.mark.parametrize("profile", list(VerifierProfile))
def test_review_emitted_findings_match_what_the_gate_expects(
    profile: VerifierProfile,
) -> None:
    """The findings a profile emits are exactly the ones the gate enumerates for it."""
    gate_findings = set(EXPECTED_FINDINGS_BY_PROFILE[profile])

    assert set(EMITTED_FINDING_ORDER_BY_PROFILE[profile.value]) == gate_findings


@pytest.mark.parametrize("profile", list(VerifierProfile))
def test_every_gate_profile_is_renderable(profile: VerifierProfile) -> None:
    """A profile the gate can select but the reviewer cannot render is a broken bundle.

    Adding a verifier profile without extending the review registries produces evidence that
    passes the gate and then cannot be reviewed. This fails at the moment the profile is
    added rather than the first time someone opens a bundle.
    """
    assert profile.value in FINDING_ORDER_BY_PROFILE
    assert profile.value in REQUIREDNESS_BY_PROFILE
    assert profile.value in EMITTED_FINDING_ORDER_BY_PROFILE


def test_every_adas_finding_has_a_review_label() -> None:
    """A missing label used to take down the whole review with a KeyError."""
    from hermes.review.projection import _FINDING_LABELS, _finding_label

    adas_findings = {
        finding_id
        for findings in EXPECTED_FINDINGS_BY_PROFILE.values()
        for finding_id in findings
        if finding_id.startswith("adas.")
    }

    assert adas_findings
    for finding_id in adas_findings:
        assert finding_id in _FINDING_LABELS, finding_id
        assert _finding_label(finding_id) != finding_id


def test_an_unknown_finding_label_degrades_instead_of_crashing() -> None:
    """Rendering a raw identifier is ugly; refusing to render the bundle is worse."""
    from hermes.review.projection import _finding_label

    assert _finding_label("something.unregistered") == "something.unregistered"


@pytest.mark.metadrive
def test_an_adas_bundle_produces_a_review_envelope(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """End to end: run an ADAS scenario, then review the bundle it produced."""
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.review.facade import review_artifact
    from hermes.runtime.orchestrator import execute_metadrive_run

    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    config = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
    execute_metadrive_run(
        scenario_path=repository_root / "scenarios" / "adas" / "aeb_lead_hard_brake.yaml",
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id="adas-review",
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(config),
    )

    envelope = review_artifact(artifact_root, "adas-review")

    finding_ids = [finding.finding_id for finding in envelope.findings]
    assert "adas.aeb.threat_response" in finding_ids
    assert "adas.aeb.no_false_intervention" in finding_ids
    assert envelope.evidence_sufficiency.profile_name == "adas_p0_longitudinal"
    for finding in envelope.findings:
        if finding.finding_id.startswith("adas."):
            assert finding.label != finding.finding_id, "ADAS findings need a human label"
            assert finding.threshold is not None
            assert finding.consequence is not None
