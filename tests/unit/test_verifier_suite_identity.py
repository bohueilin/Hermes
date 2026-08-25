from __future__ import annotations

from pathlib import Path

import pytest

from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.adas.config import load_adas_config
from hermes.adas.policy import AdasLongitudinalPolicy
from hermes.evidence.artifacts import config_digest
from hermes.faults.deterministic import DeterministicFaultInjector
from hermes.gates.config import load_gate_config
from hermes.gates.release import VerifierProfile
from hermes.policies.baseline import BaselinePolicy
from hermes.runtime.orchestrator import _build_execution_context
from hermes.scenarios.loader import load_scenario
from hermes.shields.noop import NoOpShield
from hermes.verifiers import (
    PHASE1_VERIFIER_IDENTITIES,
    PHASE4_VERIFIER_IDENTITIES,
    verifier_identities_for_profile,
)
from hermes.verifiers.adas import ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES


def _identity_triplets(identities) -> tuple[tuple[str, str, str], ...]:
    return tuple(
        (identity.name, identity.version, identity.finding_id) for identity in identities
    )


@pytest.mark.parametrize("evidence_schema_version", ["1.0", "2.0"])
def test_legacy_schema_suite_selectors_keep_trace_integrity_v1_0(
    evidence_schema_version: str,
) -> None:
    identities = verifier_identities_for_profile(
        VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT,
        evidence_schema_version=evidence_schema_version,
    )

    assert identities[0].model_dump(mode="json") == {
        "name": "TraceIntegrityVerifier",
        "version": "1.0",
        "finding_id": "trace.integrity",
    }
    assert identities[-3].model_dump(mode="json") == {
        "name": "AdasBrakeOnsetVerifier",
        "version": "1.0",
        "finding_id": "adas.aeb.brake_onset_margin",
    }


@pytest.mark.parametrize(
    "profile",
    [
        VerifierProfile.ADAS_P0_LONGITUDINAL,
        VerifierProfile.ADAS_P0_LONGITUDINAL_FAULT,
    ],
)
def test_schema_v3_adas_suites_select_only_brake_onset_v1_1(profile: VerifierProfile) -> None:
    identities = verifier_identities_for_profile(
        profile,
        evidence_schema_version="3.0",
    )
    triplets = _identity_triplets(identities)

    assert ("TraceIntegrityVerifier", "1.1", "trace.integrity") in triplets
    assert (
        "AdasThreatResponseVerifier",
        "1.1",
        "adas.aeb.threat_response",
    ) in triplets
    assert (
        "AdasBrakeOnsetVerifier",
        "1.1",
        "adas.aeb.brake_onset_margin",
    ) in triplets
    assert (
        "AdasFalseInterventionVerifier",
        "1.0",
        "adas.aeb.no_false_intervention",
    ) in triplets
    assert (
        "AdasWarningTimingVerifier",
        "1.0",
        "adas.fcw.warning_timing",
    ) in triplets


@pytest.mark.parametrize(
    ("scenario_name", "policy_kind", "expected_identities"),
    [
        ("fake_nominal.yaml", "baseline", PHASE1_VERIFIER_IDENTITIES),
        ("fake_fault_injection.yaml", "baseline", PHASE4_VERIFIER_IDENTITIES),
        (
            "adas/aeb_stationary_lead.yaml",
            "adas",
            PHASE1_VERIFIER_IDENTITIES + ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES,
        ),
        (
            "adas/aeb_stationary_lead.yaml",
            "adas_fault",
            PHASE4_VERIFIER_IDENTITIES + ADAS_P0_LONGITUDINAL_VERIFIER_IDENTITIES,
        ),
    ],
)
def test_execution_context_binds_exact_executed_verifier_suite_order(
    repository_root: Path,
    scenario_name: str,
    policy_kind: str,
    expected_identities,
) -> None:
    """A changed profile composition must change the hashed context in the same order."""
    scenario = load_scenario(repository_root / "scenarios" / scenario_name)
    if policy_kind == "adas_fault":
        fault_source = load_scenario(
            repository_root / "scenarios" / "fake_fault_injection.yaml"
        )
        scenario = scenario.model_copy(update={"faults": fault_source.faults})

    policy = (
        BaselinePolicy()
        if policy_kind == "baseline"
        else AdasLongitudinalPolicy(
            load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
        )
    )
    shield = NoOpShield()
    fault_injector = (
        DeterministicFaultInjector(scenario.faults)
        if scenario.faults is not None
        else None
    )
    policy.reset(scenario, 7)
    shield.reset(scenario, 7)
    if fault_injector is not None:
        fault_injector.reset(scenario, 7)

    context = _build_execution_context(
        scenario=scenario,
        gate_config=load_gate_config(
            repository_root
            / "config"
            / ("gates.adas.yaml" if scenario.adas is not None else "gates.phase1.yaml")
        ),
        seed=7,
        adapter=FakeSimulatorAdapter(),
        policy=policy,
        shield=shield,
        fault_injector=fault_injector,
    )

    assert _identity_triplets(context.verifier_suite) == _identity_triplets(
        expected_identities
    )
    assert context.run_context.verifier_suite_digest == config_digest(
        [identity.model_dump(mode="json") for identity in expected_identities]
    )
