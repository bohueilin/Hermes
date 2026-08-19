# HISTORICAL RECORD - Phase 7A authoring driver, unreviewed and untested.
# Committed for inspection only. See README.md in this directory. Do not run.
"""Repository-external authoring compiler run for the Phase 7 lead-TTC protocol.

The grid is motivated only by evidence that already existed before this protocol:
the retained lead pair (actor 8.0 m/s, matching the 8.0 m/s policy target) never
closes, while the retained cut-in baseline (actor 4.0 m/s) does reach a 1.82 s
policy-input TTC. The grid therefore varies the actor speed downward and the gap
downward. No discovery run informed it, and no candidate outcome can.
"""

import hashlib
import json
from pathlib import Path

from hermes.adequacy.models import canonical_adequacy_json_bytes
from hermes.evaluation_plans.materializer import (
    StudyProtocolAuthoringDraft,
    materialize,
)
from hermes.evidence.canonical import canonical_json_bytes
from hermes.scenarios.loader import load_scenario
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_VERSION,
)

ROOT = Path("/Users/bohueilin/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation")
TEMPLATE = ROOT / "evaluation-plans" / "templates" / "lead_ttc_engagement.template.yaml"
SHIELD = ROOT / "config" / "shield.phase7.lead_ttc.yaml"
GATE = ROOT / "config" / "gates.phase2.yaml"

import yaml

shield_configuration = yaml.safe_load(SHIELD.read_text(encoding="utf-8"))
shield_digest = hashlib.sha256(canonical_json_bytes(shield_configuration)).hexdigest()
gate_digest = hashlib.sha256(
    canonical_json_bytes(yaml.safe_load(GATE.read_text(encoding="utf-8")))
).hexdigest()
policy_digest = hashlib.sha256(canonical_json_bytes({})).hexdigest()

SELECTION_EVIDENCE = {
    "schema_version": "1.0",
    "observation_id": "minimum_policy_input_ttc_s",
    "event_domain": "BRAKING_POLICY_INPUT_EVENTS",
    "required_signals": "FRONT_DISTANCE_AND_RELATIVE_SPEED",
    "closing_condition": "FRONT_RELATIVE_SPEED_LT_ZERO",
    "value_expression": "FRONT_DISTANCE_DIVIDED_BY_NEGATED_RELATIVE_SPEED",
    "aggregation": "MINIMUM",
    "sequence_tie_breaker": "EARLIEST_SEQUENCE",
    "unit": "s",
    "operator": "LTE",
    "threshold_source": "criteria.policy_input_ttc_lte_s",
    "source_file": "events.jsonl",
    "source_json_pointers": [
        "/sequence",
        "/observation_summary/challenge_phase",
        "/observation_summary/front_distance_m",
        "/observation_summary/front_relative_speed_mps",
    ],
}

BODY = {
    "protocol_id": "lead_ttc_engagement",
    "protocol_version": "1.0",
    "label": "illustrative_simulation_only_declared_question",
    "scope": "SIMULATION_ONLY",
    "claim_type": "LEAD_TTC_INTERVENTION_ENGAGEMENT",
    "criteria": {
        "required_phase": "BRAKING",
        "minimum_phase_samples_per_arm": 10,
        "policy_input_ttc_lte_s": 2.0,
        "candidate_required_override_reason": "TTC_BELOW_THRESHOLD",
        "minimum_target_override_events": 1,
        "prohibit_non_target_reasons_through_first_target_response": True,
        "minimum_post_response_decision_steps": 1,
        "actuation_delay_compensation_s": 0.0,
    },
    "selection_evidence": SELECTION_EVIDENCE,
    "selection_rule": {
        "rule_id": "FIRST_VALID_BY_GRID_ORDER",
        "metric": "POLICY_INPUT_TTC_BAND_ENTRY",
        "direction": "FIRST_MATCH",
        "tie_breakers": ["GRID_ORDER", "ATTEMPT_ID"],
    },
    "valid_run_rules": [
        {
            "rule_id": "INTERNALLY_CONSISTENT",
            "observation": "INTEGRITY",
            "operator": "EQ",
            "expected_value": "INTERNALLY_CONSISTENT",
        },
        {
            "rule_id": "SELECTION_EVIDENCE_AVAILABLE",
            "observation": "SELECTION_EVIDENCE_AVAILABLE",
            "operator": "EQ",
            "expected_value": True,
        },
        {
            "rule_id": "SELECTION_EVIDENCE_OBSERVED",
            "observation": "SELECTION_EVIDENCE_OBSERVED",
            "operator": "EQ",
            "expected_value": True,
        },
        {
            "rule_id": "SELECTION_EVIDENCE_THRESHOLD_MATCHED",
            "observation": "SELECTION_EVIDENCE_THRESHOLD_MATCHED",
            "operator": "EQ",
            "expected_value": True,
        },
    ],
    "exclusion_rules": [
        {
            "rule_id": "INVALID_EVIDENCE",
            "observation": "INTEGRITY",
            "operator": "EQ",
            "excluded_value": "INVALID_EVIDENCE",
        },
        {
            "rule_id": "SELECTION_EVIDENCE_NOT_AVAILABLE",
            "observation": "SELECTION_EVIDENCE_AVAILABLE",
            "operator": "EQ",
            "excluded_value": False,
        },
        {
            "rule_id": "SELECTION_EVIDENCE_NOT_OBSERVED",
            "observation": "SELECTION_EVIDENCE_OBSERVED",
            "operator": "EQ",
            "excluded_value": False,
        },
        {
            "rule_id": "SELECTION_EVIDENCE_THRESHOLD_NOT_MATCHED",
            "observation": "SELECTION_EVIDENCE_THRESHOLD_MATCHED",
            "operator": "EQ",
            "excluded_value": False,
        },
    ],
    "candidate_shield": {
        "name": "deterministic",
        "version": "1.0",
        "configuration": shield_configuration,
        "config_digest_sha256": shield_digest,
    },
    "expected_components": {
        "hermes_version": "0.1.0",
        "policy": {
            "component": "POLICY",
            "name": "metadrive-idm",
            "version": "1.0",
            "config_digest_scope": "FIXED",
            "config_digest_sha256": policy_digest,
            "source_commit": None,
        },
        "adapter": {
            "component": "ADAPTER",
            "name": "metadrive",
            "version": "1.1",
            "config_digest_scope": "MATERIALIZED_VARIANT",
            "config_digest_sha256": None,
            "source_commit": None,
        },
        "simulator": {
            "component": "SIMULATOR",
            "name": "metadrive",
            "version": SUPPORTED_METADRIVE_VERSION,
            "config_digest_scope": "NOT_APPLICABLE",
            "config_digest_sha256": None,
            "source_commit": SUPPORTED_METADRIVE_COMMIT,
        },
        "gate": {
            "component": "GATE",
            "name": "phase2",
            "version": "1.0",
            "config_digest_scope": "FIXED",
            "config_digest_sha256": gate_digest,
            "source_commit": None,
        },
    },
    "planned_execution": {
        "seed": 7,
        "control_frequency_hz": 10,
        "horizon_steps": 300,
        "challenge_kind": "lead_vehicle_hard_brake",
    },
    "registration": {
        "repository_relative_path": "evaluation-plans/lead_ttc_engagement.protocol.v3.yaml"
    },
}

# Version 3 grid. Motivated only by the committed v1 and v2 discovery ledgers:
#   - v2 showed the observed minimum falls monotonically as the initial gap opens
#     at actor speed 8.0 with trigger 80 (12 m -> 6.94 s, 30 m -> 3.11 s), because
#     a wider gap lets the ego reach and hold its 8.0 m/s target;
#   - v2 showed trigger 140 is uniformly worse than 80; and
#   - v2 showed brake duration has no effect at all, every 30/60 pair being
#     identical, so the minimum always falls inside the first 30 braking steps.
# v3 therefore fixes actor speed at 8.0 and brake duration at 30, and extends the
# gap and trigger ranges in the direction the v2 ledger already shows.
GRID = (
    ("initial_gap_m", (40.0, 50.0, 60.0, 80.0, 100.0)),
    ("actor_speed_mps", (8.0,)),
    ("trigger_step", (60, 80, 100)),
    ("brake_duration_steps", (30,)),
    ("recovery_throttle", (0.0,)),
)

draft = StudyProtocolAuthoringDraft(
    draft_schema_version="1.0",
    template_repository_relative_path="evaluation-plans/templates/lead_ttc_engagement.template.yaml",
    baseline_grid=tuple({"parameter": p, "values": v} for p, v in GRID),
    protocol_body=BODY,
)

template_bytes = TEMPLATE.read_bytes()
template = load_scenario(TEMPLATE)
result = materialize(
    draft,
    template_bytes,
    template,
    simulator_version=SUPPORTED_METADRIVE_VERSION,
    simulator_commit=SUPPORTED_METADRIVE_COMMIT,
)

out = Path(__file__).parent / "out"
out.mkdir(exist_ok=True)
(out / "lead_ttc_engagement.protocol.v3.yaml").write_bytes(result.protocol_yaml_bytes)
variants_dir = out / "variants"
variants_dir.mkdir(exist_ok=True)
for variant in result.variants:
    (variants_dir / f"{variant.binding.variant_id}.yaml").write_bytes(variant.scenario_bytes)

print(f"variants: {len(result.variants)}")
print(f"protocol byte digest    : {result.protocol_byte_digest_sha256}")
print(f"protocol semantic digest: {result.protocol_semantic_digest_sha256}")
for variant in result.variants[:3]:
    values = {i.parameter: i.value for i in variant.binding.parameters}
    print(f"  {variant.binding.variant_id} {values} adapter={variant.binding.adapter_config_digest_sha256[:12]}")
print("  ...")
