# HISTORICAL RECORD - Phase 7A authoring driver, unreviewed and untested.
# Committed for inspection only. See README.md in this directory. Do not run.
"""Freeze the Phase 7 pair plan from the completed v4 discovery ledger."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path("/Users/bohueilin/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation")
sys.path.insert(0, str(ROOT / "src"))

from hermes import __version__ as HERMES_VERSION  # noqa: E402
from hermes.adequacy.models import (  # noqa: E402
    PairPlan,
    StudyProtocol,
    canonical_adequacy_json_bytes,
)

WORK = Path(__file__).parent / "discovery-work"


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


protocol_path = ROOT / "evaluation-plans" / "lead_ttc_engagement.protocol.v4.yaml"
protocol_bytes = protocol_path.read_bytes()
protocol = StudyProtocol.model_validate_json(
    json.dumps(yaml.safe_load(protocol_bytes.decode()), separators=(",", ":"), sort_keys=True)
)
ledger_bytes = (WORK / "lead_ttc_engagement.discovery.v4.jsonl").read_bytes()
entries = [json.loads(line) for line in ledger_bytes.decode().splitlines() if line.strip()]
selected = [entry for entry in entries if entry["selection"]["status"] == "SELECTED"]
if len(selected) != 1:
    raise SystemExit(f"expected exactly one selected attempt, found {len(selected)}")
entry = selected[0]
variant = protocol.materializer.variant_by_id(entry["materialized_variant_id"])
assert variant is not None

registration_commit = subprocess.run(
    ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
).stdout.strip()
if entry["registration_commit"] != registration_commit:
    raise SystemExit("ledger registration commit is not the current HEAD")

components = protocol.expected_components
empty_digest = sha(canonical({}))
pair = {
    "schema_version": "2.0",
    "pair_plan_id": "lead_ttc_engagement_pair_v4",
    "protocol_byte_digest_sha256": sha(protocol_bytes),
    "protocol_semantic_digest_sha256": sha(canonical_adequacy_json_bytes(protocol)),
    "discovery_ledger_byte_digest_sha256": sha(ledger_bytes),
    "discovery_ledger_semantic_digest_sha256": sha(canonical(entries)),
    "expected_pair": {
        "baseline_run_id": "handoff-p7-lead-baseline",
        "candidate_run_id": "handoff-p7-lead-candidate",
        "selected_discovery_attempt_id": entry["attempt_id"],
        "selected_discovery_selection_evidence_sha256": entry["selection_evidence_sha256"],
        "selected_materialized_variant_id": variant.variant_id,
        "scenario_byte_digest_sha256": variant.scenario_byte_digest_sha256,
        "scenario_digest_sha256": variant.scenario_digest_sha256,
        "challenge_kind": protocol.planned_execution.challenge_kind,
        "seed": protocol.planned_execution.seed,
        "control_frequency_hz": protocol.planned_execution.control_frequency_hz,
        "horizon_steps": protocol.planned_execution.horizon_steps,
        "hermes_version": HERMES_VERSION,
        "implementation_base_commit": registration_commit,
        "require_repository_dirty": False,
        "policy_name": components.policy.name,
        "policy_version": components.policy.version,
        "policy_config_digest_sha256": components.policy.config_digest_sha256,
        "adapter_name": components.adapter.name,
        "adapter_version": components.adapter.version,
        "adapter_config_digest_sha256": variant.adapter_config_digest_sha256,
        "simulator_name": components.simulator.name,
        "simulator_version": components.simulator.version,
        "simulator_commit": components.simulator.source_commit,
        "gate_name": components.gate.name,
        "gate_version": components.gate.version,
        "gate_config_digest_sha256": components.gate.config_digest_sha256,
        "baseline_shield_name": "noop",
        "baseline_shield_version": "1.0",
        "baseline_shield_config_digest_sha256": empty_digest,
        "candidate_shield_name": protocol.candidate_shield.name,
        "candidate_shield_version": protocol.candidate_shield.version,
        "candidate_shield_config_digest_sha256": protocol.candidate_shield.config_digest_sha256,
    },
    "selected_scenario_relative_path": (
        "scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v1.yaml"
    ),
}

PairPlan.model_validate_json(json.dumps(pair))
pair_yaml = yaml.safe_dump(
    pair,
    allow_unicode=True,
    sort_keys=True,
    default_flow_style=False,
    indent=2,
    width=4096,
    line_break="\n",
)
(WORK / "lead_ttc_engagement.pair.v4.yaml").write_text(pair_yaml, encoding="utf-8")
selected_scenario = WORK / f"{variant.variant_id}.yaml"
(WORK / "selected_scenario.yaml").write_bytes(selected_scenario.read_bytes())
print(f"selected attempt : {entry['attempt_id']} / {variant.variant_id}")
parameter_text = ", ".join(
    "{0}={1}".format(item["parameter"], item["value"]) for item in entry["parameters"]
)
print("parameters       : " + parameter_text)
print(f"observed min TTC : {entry['selection_evidence']['observations'][0]['machine_value']}")
print(f"scenario byte sha: {variant.scenario_byte_digest_sha256}")
print(f"adapter cfg sha  : {variant.adapter_config_digest_sha256}")
print(f"pair plan written: {len(pair_yaml)} chars")
