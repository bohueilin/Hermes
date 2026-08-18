"""Real-MetaDrive acceptance for the Phase 7 declared-question primary pair.

These nodes are explicitly selected with ``-m metadrive``. They must refuse to run
rather than silently substitute a fake adapter, so a green CI run can never be
mistaken for real-simulator acceptance.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest
import yaml

from hermes.adequacy.models import PairPlan, StudyProtocol
from hermes.evaluation_plans.materializer import serialize_scenario
from hermes.evaluation_plans.preflight import (
    ResolvedSimulatorIdentity,
    require_frozen_simulator_identity,
    resolve_installed_simulator_identity,
)
from hermes.scenarios.loader import load_scenario, scenario_digest
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_VERSION,
)

PLAN_ROOT = "evaluation-plans"
PROTOCOL = "lead_ttc_engagement.protocol.v5.yaml"
LEDGER = "lead_ttc_engagement.discovery.v5.jsonl"
PAIR_PLAN = "lead_ttc_engagement.pair.v5.yaml"
BASELINE_RUN_ID = "handoff-p7b-lead-baseline"
CANDIDATE_RUN_ID = "handoff-p7b-lead-candidate"
SELECTED_SCENARIO = "scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v2.yaml"


def _load(repository_root: Path, name: str, model: type) -> object:
    payload = yaml.safe_load((repository_root / PLAN_ROOT / name).read_text(encoding="utf-8"))
    return model.model_validate_json(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def _protocol(repository_root: Path) -> StudyProtocol:
    return _load(repository_root, PROTOCOL, StudyProtocol)  # type: ignore[return-value]


def _pair_plan(repository_root: Path) -> PairPlan:
    return _load(repository_root, PAIR_PLAN, PairPlan)  # type: ignore[return-value]


def _require_primary_pair(repository_root: Path) -> tuple[Path, Path]:
    baseline = repository_root / "artifacts" / BASELINE_RUN_ID
    candidate = repository_root / "artifacts" / CANDIDATE_RUN_ID
    if not baseline.exists() or not candidate.exists():
        pytest.skip(
            "the Phase 7 primary pair is an ignored local artifact; regenerate it with the "
            "commands frozen in PHASE7_IMPLEMENTATION_HANDOFF.md"
        )
    return baseline, candidate


def _events(directory: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in (directory / "events.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


@pytest.mark.metadrive
def test_phase7_real_metadrive_pin_is_the_frozen_protocol_expectation(
    repository_root: Path,
) -> None:
    """Refuse to accept anything unless the installed simulator is the pinned one."""
    identity = resolve_installed_simulator_identity(repository_root)
    assert identity == ResolvedSimulatorIdentity(
        name="metadrive",
        version=SUPPORTED_METADRIVE_VERSION,
        commit=SUPPORTED_METADRIVE_COMMIT,
    )
    require_frozen_simulator_identity(_protocol(repository_root), repository_root)


@pytest.mark.metadrive
def test_phase7_real_metadrive_primary_pair(repository_root: Path) -> None:
    """The retained primary pair is real pinned-MetaDrive evidence for the plan."""
    baseline_dir, candidate_dir = _require_primary_pair(repository_root)
    pair = _pair_plan(repository_root).expected_pair

    for role, directory in (("baseline", baseline_dir), ("candidate", candidate_dir)):
        manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
        assert manifest["simulator_name"] == "metadrive", role
        assert manifest["simulator_version"] == SUPPORTED_METADRIVE_VERSION, role
        assert manifest["simulator_commit"] == SUPPORTED_METADRIVE_COMMIT, role
        assert manifest["adapter_name"] == "metadrive", role
        assert manifest["repository_dirty"] is False, role
        commit = manifest["repository_commit"]
        assert isinstance(commit, str) and len(commit) == 40, role
        assert commit == commit.lower(), role
        assert manifest["scenario_digest"] == pair.scenario_digest_sha256, role
        assert manifest["adapter_config_digest"] == pair.adapter_config_digest_sha256, role
        assert manifest["seed"] == pair.seed, role
        assert manifest["horizon_steps"] == pair.horizon_steps, role

    baseline_manifest = json.loads((baseline_dir / "manifest.json").read_text(encoding="utf-8"))
    candidate_manifest = json.loads((candidate_dir / "manifest.json").read_text(encoding="utf-8"))
    assert baseline_manifest["run_id"] == pair.baseline_run_id
    assert candidate_manifest["run_id"] == pair.candidate_run_id
    assert baseline_manifest["repository_commit"] == candidate_manifest["repository_commit"]
    assert baseline_manifest["shield_name"] == "noop"
    assert candidate_manifest["shield_name"] == "deterministic"

    reasons = Counter(
        reason for event in _events(candidate_dir) for reason in event["override_reasons"]
    )
    assert reasons == Counter({"TTC_BELOW_THRESHOLD": 3}), (
        "the declared question requires target overrides and no confounding reason"
    )
    assert not Counter(
        reason for event in _events(baseline_dir) for reason in event["override_reasons"]
    )


@pytest.mark.metadrive
def test_phase7_selected_scenario_matches_its_predeclared_variant(
    repository_root: Path,
) -> None:
    """The tracked selected scenario is exactly the frozen variant, byte for byte."""
    protocol = _protocol(repository_root)
    pair = _pair_plan(repository_root).expected_pair
    variant = protocol.materializer.variant_by_id(pair.selected_materialized_variant_id)
    assert variant is not None

    tracked = repository_root / SELECTED_SCENARIO
    raw = tracked.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == variant.scenario_byte_digest_sha256
    scenario = load_scenario(tracked)
    assert scenario_digest(scenario) == variant.scenario_digest_sha256
    assert serialize_scenario(scenario) == raw

    declared = {item.parameter: item.value for item in variant.parameters}
    assert scenario.challenge.initial_gap_m == declared["initial_gap_m"]
    assert scenario.challenge.actor_speed_mps == declared["actor_speed_mps"]
    assert scenario.challenge.trigger_step == declared["trigger_step"]
    assert scenario.challenge.brake_duration_steps == declared["brake_duration_steps"]
    assert scenario.challenge.resume_throttle_command == declared["recovery_throttle"]
    assert scenario.challenge.behavior_realism_claim is False


@pytest.mark.metadrive
def test_phase7_primary_pair_assesses_adequate_and_control_stays_inadequate(
    repository_root: Path,
) -> None:
    """End-to-end CLI acceptance: the plan is adequate and the control is not."""
    _require_primary_pair(repository_root)

    def assess(baseline: str, candidate: str) -> tuple[int, dict]:
        completed = subprocess.run(
            [
                sys.executable, "-m", "hermes", "assess-adequacy", baseline, candidate,
                "--repository-root", ".", "--artifact-root", "artifacts",
                "--plan-root", PLAN_ROOT, "--protocol", PROTOCOL,
                "--discovery-ledger", LEDGER, "--pair-plan", PAIR_PLAN,
                "--format", "json",
            ],
            cwd=repository_root, capture_output=True, text=True, timeout=600,
        )
        return completed.returncode, json.loads(completed.stdout)

    code, envelope = assess(BASELINE_RUN_ID, CANDIDATE_RUN_ID)
    assert code == 0
    assessment = envelope["assessment"]
    assert assessment["status"] == "ADEQUATE"
    assert assessment["observation_disposition"] == "TARGET_INTERVENTION_RECORDED"
    assert envelope["interpretation"] == "DECLARED_QUESTION_ONLY"
    assert envelope["registration"]["status"] == "LOCAL_HISTORY_ORDERING_VERIFIED"
    assert {criterion["status"] for criterion in assessment["criteria"]} == {"PASS"}
    assert envelope["compatibility"] == "COMPATIBLE"

    code, envelope = assess("handoff-p3-lead-baseline", "handoff-p3-lead-shielded")
    assert code == 0
    assessment = envelope["assessment"]
    assert assessment["status"] == "INADEQUATE"
    assert assessment["observation_disposition"] == "TARGET_INTERVENTION_CONFOUNDED"
    assert envelope["interpretation"] == "DESCRIPTIVE_ONLY"
    assert envelope["registration"]["status"] == "REGISTRATION_NOT_ESTABLISHED"

    code, envelope = assess("phase1-tampered", CANDIDATE_RUN_ID)
    assert code == 30
    assert envelope["assessment"] is None


@pytest.mark.metadrive
def test_phase7_primary_baseline_reproduces_the_selected_discovery_observation(
    repository_root: Path,
) -> None:
    """A fresh primary baseline must reproduce the observation it was selected on."""
    baseline_dir, _ = _require_primary_pair(repository_root)
    pair = _pair_plan(repository_root).expected_pair
    ledger = [
        json.loads(line)
        for line in (repository_root / PLAN_ROOT / LEDGER)
        .read_text(encoding="utf-8")
        .splitlines()
        if line.strip()
    ]
    selected = next(
        entry
        for entry in ledger
        if entry["attempt_id"] == pair.selected_discovery_attempt_id
    )
    expected = selected["selection_evidence"]["observations"][0]

    samples: list[tuple[float, int]] = []
    for event in _events(baseline_dir):
        summary = event["observation_summary"]
        if summary.get("challenge_phase") != "BRAKING":
            continue
        distance = summary.get("front_distance_m")
        relative_speed = summary.get("front_relative_speed_mps")
        if distance is None or relative_speed is None or relative_speed >= 0.0:
            continue
        value = distance / -relative_speed
        if math.isfinite(value):
            samples.append((value, event["sequence"]))

    observed = min(samples, key=lambda item: (item[0], item[1]))
    assert observed[0] == expected["machine_value"]
    assert observed[1] == expected["sequence"]
