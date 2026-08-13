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

Workbench and review-command selections are always relative to the configured root. With
`--artifact-root artifacts`, enter `handoff-phase5-demo`, not
`artifacts/handoff-phase5-demo`.

## 3A. CLI parity checks

These commands exercise the same public facade used by the workbench:

```bash
hermes review-artifact handoff-phase5-demo --artifact-root artifacts --format text
hermes review-artifact handoff-p1-conditional --artifact-root artifacts --format text
hermes review-artifact handoff-p1-collision --artifact-root artifacts --format text
hermes review-artifact phase1-tampered --artifact-root artifacts --format json
hermes review-compare handoff-p3-lead-baseline handoff-p3-lead-shielded \
  --artifact-root artifacts --format text
hermes review-compare handoff-phase5-demo handoff-p2-metadrive \
  --artifact-root artifacts --format json
```

Expected exits are 0 for the first three valid review operations and the compatible lead
comparison, 30 for `phase1-tampered`, and 40 for the incompatible Phase 5/MetaDrive comparison.
`CONDITIONAL` and `HOLD` are accepted gate outcomes for an internally consistent review, so the new
review command intentionally exits 0 for them.

## 4. Demo 1 — valid nominal evidence

Workbench selection relative to `artifacts`:

```text
handoff-phase5-demo
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

Workbench selection relative to `artifacts`:

```text
handoff-p1-collision
```

Show:

- collision hard failure;
- first supporting event sequence;
- gate rationale;
- why progress cannot compensate;
- artifact remains internally consistent despite HOLD.

## 6. Demo 3 — tampered evidence

Workbench selection relative to `artifacts`:

```text
phase1-tampered
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

Workbench selection relative to `artifacts`:

```text
handoff-p2-metadrive
```

Show the same review contract and provenance without simulator rerun.

Executive point:

> Hermes separates evidence semantics from simulator integration.

## 8. Demo 5 — mixed shield trade-off

Compare these two root-relative selections:

```text
handoff-p3-lead-baseline
handoff-p3-lead-shielded
```

Then compare `handoff-p3-cutin-baseline` with `handoff-p3-cutin-shielded`.

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

Workbench selection relative to `artifacts`:

```text
handoff-p4-fault
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

## 13. Automated implementation checkpoint

At checkpoint `90fb7d8`, the implementation/adversarial suite recorded:

- 720 complete tests passed;
- 720 tests passed under the non-MetaDrive selection;
- 488 focused Phase 6 adversarial tests passed;
- Ruff and `git diff --check` passed;
- retained PASS, CONDITIONAL, HOLD, INVALID_EVIDENCE, MetaDrive, fault, compatible mixed-tradeoff,
  and incompatible artifacts produced the expected facade results; and
- automated AppTests launched no simulator, policy, Streamlit server, browser, child process, or
  network connection and preserved every source-bundle byte.

The accepted Phase 6 P2 is process-lifetime cache/session growth after repeated explicit local
selections. Restart recovers memory; add a deterministic synchronized LRU before materially
increasing single-user artifact scale.

## 14. Human observation record

Automated validation is not a manual visual or comprehension result. When an actual reviewer runs
this demo, record the date, reviewer, exact selected paths and digests, whether they correctly
identified gate rationale/hard failures/unavailable evidence/mixed comparison effects, and whether
they correctly answered:

```text
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
```

Until that observation exists, report the human-comprehension gate as `NOT YET OBSERVED`; do not
infer it from AppTest output or fabricate a participant result.
