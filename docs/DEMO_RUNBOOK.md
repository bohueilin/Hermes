# Hermes Executive Demo Runbook

This runbook describes the intended demo sequence. Codex should update exact commands and results as implementation becomes available.

## Demo objective

Show that Hermes converts an autonomy experiment into a reproducible, independently verifiable advancement decision.

Do not frame the demo as proof of real-world driving safety.

## Setup

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
hermes doctor
```

## Demo 1 — Nominal evidence path

Run a nominal fake scenario.

Show:

- scenario and seed;
- candidate and executed actions;
- route progress;
- verifier findings;
- `PASS` verdict;
- artifact path;
- trace digest;
- independent verification without simulator rerun.

Executive point:

> A PASS is not a score printed by the simulator. It is a deterministic decision derived from versioned evidence and explicit gate rules.

## Demo 2 — Hard invariant precedence

Run the collision scenario.

Show:

- collision event sequence;
- critical finding;
- any route progress achieved;
- `HOLD` verdict;
- gate rationale.

Executive point:

> Mission progress cannot compensate for a collision. Hard invariants dominate aggregate performance.

Run the boundary scenario and make the same point for ODD/road constraints.

## Demo 3 — Conditional review

Run the soft-degradation scenario.

Show:

- hard invariants pass;
- mission succeeds;
- soft comfort/system threshold fails;
- `CONDITIONAL` verdict;
- residual limitation.

Executive point:

> Hermes distinguishes a hard stop from a reviewable degradation rather than collapsing everything into pass/fail. CONDITIONAL requires human disposition and grants no deployment permission.

## Demo 4 — Tamper evidence

Copy a nominal artifact and modify one executed action.

Run artifact verification.

Show:

- `INVALID_EVIDENCE`;
- first mismatched sequence;
- no simulator rerun.

State the limitation:

> The local hash chain detects modification but is not an independent trust anchor. A malicious author able to rewrite the full bundle can recompute hashes.

## Demo 5 — Determinism

Run the same nominal scenario with a different run ID.

Show identical:

- deterministic events;
- final event hash;
- trace digest;
- metrics;
- findings;
- verdict.

Show permitted differences such as creation timestamp and run ID.

Executive point:

> Reproducibility is a release feature, not only an engineering convenience.

## Demo 6 — MetaDrive adapter

Only include after Phase 2 passes.

Show:

- bounded headless MetaDrive run;
- accurate MetaDrive version and commit;
- same Hermes evidence schema;
- stored artifact verification without MetaDrive rerun;
- unsupported signals explicitly marked.

Executive point:

> The evidence and gate architecture survives a transition from a test double to a higher-fidelity closed-loop simulator.

## Demo 7 — Runtime shield

Only include after Phase 3 passes.

Before presenting this demo, run and independently verify both the baseline and shielded bundles.
Artifact publication never overwrites, so change the run IDs when repeating the demo.

```bash
hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase3-lead-baseline \
  --headless

hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase3-lead-shielded \
  --headless \
  --shield deterministic \
  --shield-config config/shield.phase3.yaml

hermes verify-artifact artifacts/phase3-lead-baseline
hermes verify-artifact artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded \
  --format json
```

Do not infer a result from the run ID. Capture the actual exit code, verdict, trace digest, metrics,
and comparison statuses after each command. Exit `30` means at least one input artifact is invalid;
exit `40` means the valid artifacts are incompatible or comparison encountered a
configuration/operational error. Do not present either case as a policy comparison.

Show:

- candidate and executed actions as separate fields, including unchanged events;
- exact ordered override reasons when the shield changed the action;
- collision and hard-failure results;
- minimum TTC or its explicit `NOT_AVAILABLE` reason;
- progress, acceleration, jerk, and policy-latency source;
- intervention event count and reason histogram as descriptive evidence; and
- every improved, regressed, unchanged, or non-comparable baseline/candidate dimension.

The shield's supported reason codes are:

```text
TTC_BELOW_THRESHOLD
SPEED_CAP
STALE_OBSERVATION
BOUNDARY_RISK
EMERGENCY_STOP
ACTUATION_DELAY_COMPENSATION
```

State that `config/shield.phase3.yaml` is versioned and illustrative. Stored artifact verification
replays each deterministic shield decision from trace-bound inputs without importing or rerunning
MetaDrive; it does not trust the recorded executed action or reason at face value.

Repeat the bounded baseline/shielded/verify/compare sequence with
`scenarios/metadrive_cut_in_near_field.yaml` and new `phase3-cutin-*` run IDs before declaring both
required scenarios covered. Explain the scenario mechanisms accurately:

- the lead actor receives a fixed schedule of native MetaDrive dynamic actions, including its
  configured hard-brake interval; and
- the cut-in is a `scripted_kinematic_replay` with `behavior_realism_claim: false`, not a native or
  realistic traffic-agent maneuver.

Front gap and relative speed come from the named actor's actual oriented geometry and velocity in
the simulator. A TTC sample exists only when the actor is ahead, laterally overlapping, and closing.
Simulator ground truth is not a claim about perception performance.

Executive point:

> Capability, permission, and verification are separate. An intervention can improve one dimension while creating another trade-off that remains visible.

## Closing narrative

> Hermes is the scenario-to-evidence control plane for autonomy development. The policy proposes behavior, the environment produces consequences, independent verifiers evaluate requirements, a gate decides advancement, and the trace supports review. The prototype is intentionally simulation-only. Any later ROS or closed-lab hardware work is deferred and requires a separate safety review.

## Demo safeguards

- Use only ignored local artifacts.
- Never claim certification or road readiness.
- Label thresholds illustrative.
- State simulator limitations.
- Do not omit regressions.
- Do not show a verdict whose artifact fails independent verification.
