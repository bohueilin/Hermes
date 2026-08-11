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

## Demo 3 — Conditional advancement

Run the soft-degradation scenario.

Show:

- hard invariants pass;
- mission succeeds;
- soft comfort/system threshold fails;
- `CONDITIONAL` verdict;
- residual limitation.

Executive point:

> Hermes distinguishes a hard stop from a reviewable degradation rather than collapsing everything into pass/fail.

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

> The evidence and gate architecture survives a transition from a test double to a real closed-loop simulator.

## Demo 7 — Runtime shield

Only include after Phase 3 passes.

Run baseline and shielded versions of a challenge scenario.

Show:

- candidate action;
- executed action;
- override reason;
- safety evidence change;
- comfort or progress regression, if any;
- baseline/candidate comparison.

Executive point:

> Capability, permission, and verification are separate. An intervention can improve one dimension while creating another trade-off that remains visible.

## Closing narrative

> Hermes is the scenario-to-evidence control plane for autonomy development. The policy proposes behavior, the environment produces consequences, independent verifiers evaluate requirements, a gate decides advancement, and the trace supports review. The prototype is intentionally simulation-only, but the contracts establish a path toward higher-fidelity simulators, ROS-based stacks, and hardware-aware validation.

## Demo safeguards

- Use only ignored local artifacts.
- Never claim certification or road readiness.
- Label thresholds illustrative.
- State simulator limitations.
- Do not omit regressions.
- Do not show a verdict whose artifact fails independent verification.
