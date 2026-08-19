# HISTORICAL RECORD - Phase 7A authoring driver, unreviewed and untested.
# Committed for inspection only. See README.md in this directory. Do not run.
"""Generate the fresh Phase 7 primary pair at the clean pair-plan commit."""

import json
import math
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path("/Users/bohueilin/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation")
sys.path.insert(0, str(ROOT / "src"))

from hermes.adequacy.models import PairPlan, StudyProtocol  # noqa: E402
from hermes.evaluation_plans.preflight import (  # noqa: E402
    require_frozen_simulator_identity,
)

PYTHON = "/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python"
SCENARIO = "scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v2.yaml"
SHIELD = "config/shield.phase7.lead_ttc.v2.yaml"
GATE = "config/gates.phase2.yaml"

protocol = StudyProtocol.model_validate_json(
    json.dumps(
        yaml.safe_load(
            (ROOT / "evaluation-plans" / "lead_ttc_engagement.protocol.v5.yaml").read_text()
        ),
        separators=(",", ":"),
        sort_keys=True,
    )
)
pair_plan = PairPlan.model_validate_json(
    json.dumps(
        yaml.safe_load(
            (ROOT / "evaluation-plans" / "lead_ttc_engagement.pair.v5.yaml").read_text()
        ),
        separators=(",", ":"),
        sort_keys=True,
    )
)
pair = pair_plan.expected_pair

head = subprocess.run(
    ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
).stdout.strip()
status = subprocess.run(
    ["git", "status", "--porcelain", "--untracked-files=normal"],
    cwd=ROOT, capture_output=True, text=True, check=True,
).stdout.strip()
if status:
    raise SystemExit(f"primary runs require a clean tree; observed:\n{status}")

for run_id in (pair.baseline_run_id, pair.candidate_run_id):
    if (ROOT / "artifacts" / run_id).exists():
        raise SystemExit(f"{run_id} already exists; primary targets must be absent")

# P1-2 gate, re-asserted immediately before each primary run.
identity = require_frozen_simulator_identity(protocol, ROOT)
print(f"simulator preflight OK : {identity.version} @ {identity.commit[:12]}")
print(f"HEAD                   : {head}")
print(f"pair-plan base commit  : {pair.implementation_base_commit}")
print("both targets absent    : yes\n")


def run(run_id: str, shield: str, shield_config: str | None) -> dict:
    argv = [
        PYTHON, "-m", "hermes", "run",
        "--simulator", "metadrive",
        "--scenario", SCENARIO,
        "--policy", "metadrive-idm",
        "--seed", str(pair.seed),
        "--run-id", run_id,
        "--gate-config", GATE,
        "--headless",
        "--shield", shield,
    ]
    if shield_config:
        argv += ["--shield-config", shield_config]
    completed = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True)
    if completed.returncode not in (0, 10, 20, 30):
        raise SystemExit(f"{run_id} failed: {completed.returncode}\n{completed.stderr[-3000:]}")
    directory = ROOT / "artifacts" / run_id
    from hermes.evidence.verification import verify_artifact

    verification = verify_artifact(directory)
    manifest = json.loads((directory / "manifest.json").read_text())
    events = [
        json.loads(line)
        for line in (directory / "events.jsonl").read_text().splitlines()
        if line.strip()
    ]
    print(f"{run_id}")
    print(f"  exit {completed.returncode}  verdict {json.loads((directory/'verdict.json').read_text())['verdict']}")
    print(f"  integrity     : {verification.integrity.value}")
    print(f"  events        : {len(events)}")
    print(f"  repo commit   : {manifest['repository_commit']} dirty={manifest['repository_dirty']}")
    print(f"  scenario sha  : {manifest['scenario_digest']}")
    print(f"  adapter sha   : {manifest['adapter_config_digest']}")
    print(f"  trace sha     : {(directory / 'trace.sha256').read_text().strip()}")
    return {"manifest": manifest, "events": events, "verification": verification}


def braking_ttcs(events: list[dict]) -> list[tuple[float, int]]:
    out = []
    for event in events:
        summary = event["observation_summary"]
        if summary.get("challenge_phase") != "BRAKING":
            continue
        distance = summary.get("front_distance_m")
        relative_speed = summary.get("front_relative_speed_mps")
        if distance is None or relative_speed is None or relative_speed >= 0.0:
            continue
        value = distance / -relative_speed
        if math.isfinite(value):
            out.append((value, event["sequence"]))
    return out


baseline = run(pair.baseline_run_id, "noop", None)
samples = braking_ttcs(baseline["events"])
observed_min = min(samples, key=lambda item: (item[0], item[1]))
ledger = [
    json.loads(line)
    for line in (ROOT / "evaluation-plans" / "lead_ttc_engagement.discovery.v5.jsonl")
    .read_text()
    .splitlines()
    if line.strip()
]
selected = next(e for e in ledger if e["attempt_id"] == pair.selected_discovery_attempt_id)
expected = selected["selection_evidence"]["observations"][0]

print("\nselection reproduction check (P2-1)")
print(f"  discovery minimum : {expected['machine_value']!r} at sequence {expected['sequence']}")
print(f"  primary   minimum : {observed_min[0]!r} at sequence {observed_min[1]}")
reproduced = (
    observed_min[0] == expected["machine_value"] and observed_min[1] == expected["sequence"]
)
print(f"  EXACT REPRODUCTION: {reproduced}")
if not reproduced:
    raise SystemExit("primary baseline did not reproduce the selected discovery observation")

candidate = run(pair.candidate_run_id, "deterministic", SHIELD)

for role, result in (("baseline", baseline), ("candidate", candidate)):
    if result["manifest"]["repository_commit"] != head:
        raise SystemExit(f"{role} manifest does not record the pair-plan commit")
    if result["manifest"]["repository_dirty"]:
        raise SystemExit(f"{role} manifest records a dirty tree")
    if result["manifest"]["adapter_config_digest"] != pair.adapter_config_digest_sha256:
        raise SystemExit(f"{role} adapter digest contradicts the pair plan")
    if result["manifest"]["scenario_digest"] != pair.scenario_digest_sha256:
        raise SystemExit(f"{role} scenario digest contradicts the pair plan")

from collections import Counter  # noqa: E402

reasons = Counter(r for e in candidate["events"] for r in e["override_reasons"])
print(f"\ncandidate override reasons: {dict(reasons)}")
first_target = next(
    (
        e["sequence"]
        for e in candidate["events"]
        if "TTC_BELOW_THRESHOLD" in e["override_reasons"]
    ),
    None,
)
print(f"first TTC_BELOW_THRESHOLD sequence: {first_target}")
