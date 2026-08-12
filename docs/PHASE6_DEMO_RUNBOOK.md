# Hermes Phase 6 Demo Runbook

## 1. Objective

Demonstrate that Hermes makes simulation evidence understandable without strengthening the claim beyond the verified core.

## 2. Preflight

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python -m pip install -e ".[dev,workbench]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
```

## 3. Launch

```bash
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Confirm:

- loopback only;
- no simulator launch;
- no external network;
- no upload or write action.

## 4. Demo 1 — valid nominal evidence

Artifact:

```text
artifacts/handoff-phase5-demo
```

Show:

```text
Gate verdict: PASS
Evidence integrity: INTERNALLY_CONSISTENT
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
```

Executive point:

> A PASS is a gate result from internally consistent simulation evidence, not a safety or deployment approval.

## 5. Demo 2 — hard invariant HOLD

Artifact:

```text
artifacts/handoff-p1-collision
```

Show:

- collision hard failure;
- first supporting event sequence;
- gate rationale;
- why progress cannot compensate;
- artifact remains internally consistent despite HOLD.

## 6. Demo 3 — tampered evidence

Artifact:

```text
artifacts/phase1-tampered
```

Show:

- `INVALID_EVIDENCE`;
- first mismatch;
- stored verdict quarantined;
- no trusted PASS;
- authenticity remains not authenticated.

Executive point:

> Invalid evidence is not a low score. It is evidence the gate refuses to accept.

## 7. Demo 4 — MetaDrive portability

Artifact:

```text
artifacts/handoff-p2-metadrive
```

Show the same review contract and provenance without simulator rerun.

Executive point:

> Hermes separates evidence semantics from simulator integration.

## 8. Demo 5 — mixed shield trade-off

Compare:

```text
artifacts/handoff-p3-lead-baseline
artifacts/handoff-p3-lead-shielded
```

Then cut-in pair.

Show:

- TTC improvement;
- route, acceleration, or jerk regression;
- unchanged verdict;
- speed-cap interventions;
- no fabricated TTC intervention;
- no winner score.

Executive point:

> Better on one leading indicator is not the same as overall advancement.

## 9. Demo 6 — fault coverage versus mission outcome

Artifact:

```text
artifacts/handoff-p4-fault
```

Show:

- all configured fault mechanisms covered;
- observation age and simulated latency;
- saturation events;
- mission progress failure;
- final HOLD.

Executive point:

> A test can execute the intended fault coverage correctly and still fail the advancement objective.

## 10. Demo 7 — provenance and limitations

Show:

- recorded commit, adapter, simulator, scenario, policy, shield, fault, and gate identity;
- bundle and trace roots;
- `NOT_AUTHENTICATED`;
- no policy or simulator reexecution;
- simulation-only and no deployment permission.

## 11. Close

> Hermes is not a dashboard that declares a simulated car safe. It is a review layer over reproducible evidence: it shows what was proposed, permitted, executed, observed, computed, unavailable, and still unproven.

## 12. Do not claim

- road safety;
- certification;
- Level 4;
- authenticated evidence;
- real deployment approval;
- realistic cut-in behavior;
- cross-platform bitwise determinism;
- remote CI execution unless actually observed.
