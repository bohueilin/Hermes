# HISTORICAL RECORD - Phase 7A authoring driver, unreviewed and untested.
# Committed for inspection only. See README.md in this directory. Do not run.
"""Baseline-only discovery over the frozen Phase 7 grid.

Runs every declared variant in grid order with the no-op shield, records each
attempt in an append-created ledger, and selects the first valid attempt under the
frozen rule. Candidate outcomes are never consulted; only the no-op baseline runs.
Every attempt is preserved, including failures.
"""

import hashlib
import json
import math
import platform
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path("/Users/bohueilin/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation")
sys.path.insert(0, str(ROOT / "src"))

from hermes import __version__ as HERMES_VERSION  # noqa: E402
from hermes.adequacy.models import StudyProtocol, canonical_adequacy_json_bytes  # noqa: E402
from hermes.evaluation_plans.materializer import serialize_scenario  # noqa: E402
from hermes.evaluation_plans.preflight import (  # noqa: E402
    require_frozen_simulator_identity,
)
from hermes.scenarios.loader import load_scenario  # noqa: E402

WORK = Path(__file__).parent / "discovery-work"
WORK.mkdir(exist_ok=True)
PROTOCOL_PATH = ROOT / "evaluation-plans" / "lead_ttc_engagement.protocol.v5.yaml"
TEMPLATE_PATH = ROOT / "evaluation-plans" / "templates" / "lead_ttc_engagement.template.yaml"
PYTHON = "/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python"


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


protocol_bytes = PROTOCOL_PATH.read_bytes()
protocol = StudyProtocol.model_validate_json(
    json.dumps(yaml.safe_load(protocol_bytes.decode()), separators=(",", ":"), sort_keys=True)
)
protocol_byte_digest = sha(protocol_bytes)
protocol_semantic_digest = sha(canonical_adequacy_json_bytes(protocol))

registration_commit = subprocess.run(
    ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
).stdout.strip()
status = subprocess.run(
    ["git", "status", "--porcelain", "--untracked-files=normal"],
    cwd=ROOT, capture_output=True, text=True, check=True,
).stdout.strip()
if status:
    raise SystemExit(f"discovery requires a clean tree; observed:\n{status}")

# P1-2 gate: resolve the installed simulator once, before any attempt writes a
# ledger entry. A drifted pin would make every predeclared adapter digest wrong.
identity = require_frozen_simulator_identity(protocol, ROOT)
print(f"simulator preflight OK: {identity.version} @ {identity.commit[:12]}")
print(f"registration commit   : {registration_commit}")
print(f"variants              : {len(protocol.materializer.variants)}\n")

template = load_scenario(TEMPLATE_PATH)
threshold = protocol.criteria.policy_input_ttc_lte_s
MISSING_REASON = (
    "A BRAKING policy-input event lacks paired front distance and relative speed."
)


def derive_selection_evidence(events: list[dict]) -> dict:
    """Frozen derivation: minimum policy-input TTC over BRAKING closing samples."""
    braking = [
        event
        for event in events
        if event["observation_summary"].get("challenge_phase") == "BRAKING"
    ]
    signal_missing = any(
        summary.get("front_distance_m") is None or summary.get("front_relative_speed_mps") is None
        for summary in (event["observation_summary"] for event in braking)
    )
    if signal_missing:
        return {
            "status": "NOT_AVAILABLE",
            "outcome": "REQUIRED_SIGNAL_MISSING",
            "observations": [],
            "unavailable_reason": MISSING_REASON,
        }
    samples = []
    for event in braking:
        summary = event["observation_summary"]
        distance = summary["front_distance_m"]
        relative_speed = summary["front_relative_speed_mps"]
        if relative_speed < 0.0:
            value = distance / -relative_speed
            if math.isfinite(value):
                samples.append((value, event["sequence"]))
    if not samples:
        return {
            "status": "AVAILABLE",
            "outcome": "NO_FINITE_CLOSING_TTC",
            "observations": [],
            "unavailable_reason": None,
        }
    value, sequence = min(samples, key=lambda item: (item[0], item[1]))
    canonical_value = json.dumps(value, allow_nan=False, separators=(",", ":"))
    return {
        "status": "AVAILABLE",
        "outcome": "OBSERVED",
        "observations": [
            {
                "observation_id": "minimum_policy_input_ttc_s",
                "machine_value": value,
                "canonical_value": canonical_value,
                "display_value": canonical_value,
                "unit": "s",
                "operator": "LTE",
                "threshold_machine_value": threshold,
                "sequence": sequence,
            }
        ],
        "unavailable_reason": None,
    }


entries = []
first_valid_index = None
summary_rows = []

for variant in protocol.materializer.variants:
    index = variant.grid_index
    values = {item.parameter: item.value for item in variant.parameters}
    scenario = load_scenario(TEMPLATE_PATH)
    payload = scenario.model_dump(mode="python")
    payload["challenge"].update(
        {
            "initial_gap_m": values["initial_gap_m"],
            "actor_speed_mps": values["actor_speed_mps"],
            "trigger_step": values["trigger_step"],
            "brake_duration_steps": values["brake_duration_steps"],
            "resume_throttle_command": values["recovery_throttle"],
        }
    )
    from hermes.domain.models import ScenarioDefinition

    rendered = ScenarioDefinition.model_validate(payload)
    scenario_bytes = serialize_scenario(rendered)
    if sha(scenario_bytes) != variant.scenario_byte_digest_sha256:
        raise SystemExit(f"{variant.variant_id}: rendered bytes contradict the frozen variant")
    scenario_path = WORK / f"{variant.variant_id}.yaml"
    scenario_path.write_bytes(scenario_bytes)

    run_id = f"p7-v5-discovery-{index:04d}"
    artifact_dir = ROOT / "artifacts" / run_id
    if artifact_dir.exists():
        raise SystemExit(f"{run_id} already exists; discovery never overwrites")
    argv = [
        PYTHON, "-m", "hermes", "run",
        "--simulator", "metadrive",
        "--scenario", str(scenario_path),
        "--policy", "metadrive-idm",
        "--seed", str(protocol.planned_execution.seed),
        "--run-id", run_id,
        "--gate-config", "config/gates.phase2.yaml",
        "--headless",
        "--shield", "noop",
    ]
    completed = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True)
    if completed.returncode not in (0, 10, 20, 30):
        raise SystemExit(f"{run_id} failed unexpectedly: {completed.returncode}\n{completed.stderr[-2000:]}")

    # Verify through the library rather than the CLI: the CLI renders human text.
    from hermes.evidence.verification import verify_artifact

    verification = verify_artifact(artifact_dir)
    verification_status = verification.integrity.value

    events = [
        json.loads(line)
        for line in (artifact_dir / "events.jsonl").read_text().splitlines()
        if line.strip()
    ]
    manifest = json.loads((artifact_dir / "manifest.json").read_text())
    evidence = derive_selection_evidence(events)

    observed = evidence["outcome"] == "OBSERVED"
    available = evidence["status"] == "AVAILABLE"
    matched = observed and evidence["observations"][0]["machine_value"] <= threshold
    valid = (
        verification_status == "INTERNALLY_CONSISTENT" and available and observed and matched
    )
    if valid and first_valid_index is None:
        first_valid_index = index

    if not valid:
        if verification_status != "INTERNALLY_CONSISTENT":
            rule_id, rationale = "INVALID_EVIDENCE", "stored verification failed"
        elif not available:
            rule_id, rationale = "SELECTION_EVIDENCE_NOT_AVAILABLE", MISSING_REASON
        elif not observed:
            rule_id, rationale = (
                "SELECTION_EVIDENCE_NOT_OBSERVED",
                "no finite closing policy-input TTC in the BRAKING phase",
            )
        else:
            rule_id, rationale = (
                "SELECTION_EVIDENCE_THRESHOLD_NOT_MATCHED",
                f"minimum policy-input TTC exceeds {threshold} s",
            )
        exclusion = {
            "valid_run": False,
            "disposition": "EXCLUDED",
            "rule_id": rule_id,
            "rationale": rationale,
        }
    else:
        exclusion = {
            "valid_run": True,
            "disposition": "INCLUDED",
            "rule_id": "NONE",
            "rationale": "all registered valid-run checks passed",
        }

    entry = {
        "schema_version": "2.0",
        "attempt_index": index,
        "attempt_id": f"attempt-{index:04d}",
        "protocol_byte_digest_sha256": protocol_byte_digest,
        "protocol_semantic_digest_sha256": protocol_semantic_digest,
        "registration_commit": registration_commit,
        "materialized_variant_id": variant.variant_id,
        "adapter_config_digest_sha256": variant.adapter_config_digest_sha256,
        "parameters": [item.model_dump(mode="json") for item in variant.parameters],
        "command_argv": ["python", "-m", "hermes", *argv[3:]],
        "environment": {
            "hermes_version": HERMES_VERSION,
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "architecture": platform.machine(),
            "repository_commit": registration_commit,
            "repository_dirty": False,
        },
        "run_id": run_id,
        "artifact_locator": f"artifacts/{run_id}",
        "scenario_byte_digest_sha256": variant.scenario_byte_digest_sha256,
        "scenario_digest_sha256": variant.scenario_digest_sha256,
        "bundle_digest_sha256": (artifact_dir / "bundle.sha256").read_text().strip(),
        "trace_digest_sha256": (artifact_dir / "trace.sha256").read_text().strip(),
        "verification_status": verification_status,
        "selection_evidence": evidence,
        "selection_evidence_sha256": sha(canonical(evidence)),
        "exclusion": exclusion,
        "selection": {
            "status": "PENDING",
            "rank": index + 1,
            "tie_breaker": "GRID_ORDER",
            "rationale": "pending",
        },
    }
    entries.append(entry)

    observed_ttc = (
        evidence["observations"][0]["machine_value"] if observed else None
    )
    recorded_adapter = manifest["adapter_config_digest"]
    if recorded_adapter != variant.adapter_config_digest_sha256:
        raise SystemExit(
            f"{run_id}: recorded adapter digest {recorded_adapter} contradicts predeclared "
            f"{variant.adapter_config_digest_sha256}"
        )
    summary_rows.append(
        (index, values, verification_status, evidence["outcome"], observed_ttc, valid)
    )
    flag = "VALID" if valid else "excluded"
    ttc_text = f"{observed_ttc!r}" if observed_ttc is not None else "-"
    print(
        f"  grid-{index:04d} gap={values['initial_gap_m']:<5} speed={values['actor_speed_mps']:<5} "
        f"brake={values['brake_duration_steps']:<3} minTTC={ttc_text:<22} {flag}"
    )

if first_valid_index is None:
    print("\nNO VALID ATTEMPT: the declared grid contains no baseline that enters the TTC band.")
else:
    print(f"\nselected: grid-{first_valid_index:04d} (first valid by grid order)")

for entry in entries:
    index = entry["attempt_index"]
    selected = first_valid_index is not None and index == first_valid_index
    entry["selection"] = {
        "status": "SELECTED" if selected else "NOT_SELECTED",
        "rank": index + 1,
        "tie_breaker": "GRID_ORDER",
        "rationale": (
            "first valid registered attempt"
            if selected
            else "not the first valid registered attempt"
        ),
    }

ledger_bytes = b"".join(canonical(entry) + b"\n" for entry in entries)
(WORK / "lead_ttc_engagement.discovery.v5.jsonl").write_bytes(ledger_bytes)
print(f"\nledger bytes    : {len(ledger_bytes)}")
print(f"ledger byte sha : {sha(ledger_bytes)}")
print(f"ledger sem  sha : {sha(canonical(entries))}")
