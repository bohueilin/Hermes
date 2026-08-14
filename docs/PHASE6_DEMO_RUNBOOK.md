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

## 3B. Reviewer-comprehension navigation

The current workbench has three primary destinations:

```text
Review
  Select & Verify
  Overview
  Evidence
  Timeline
  Provenance
Compare
Evidence limitations
```

For every Review demo, enter the exact root-relative locator on `Select & Verify`, activate
`Verify selected artifact`, then keep the submitted locator visible while moving through Review.
On Overview, present artifact → gate → rationale → integrity/authority → required unavailable
evidence → limitations before technical hashes. Use Evidence's six ordered groups and Timeline's
`Decision evidence`, `Action accountability`, `Fault behavior`, and `All tracks` presets. A preset
or finding jump changes presentation only.

For comparison, submit blank-by-default baseline and candidate explicitly. Present compatibility
before deltas, then gate/hard failures/improvements/regressions/unchanged/not comparable/
availability/advancement interpretation. Never summarize the pair as a winner or safer candidate.

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

The later reviewer-comprehension implementation at `80439c5` recorded 746 full tests passing and a
15-attack automated Task 3 GO with no P0/P1 reproduced. That audit verified strict quarantine,
submitted-side identity, hard-failure visibility, presentation-only presets/jumps, no missing-as-
zero, no incompatible deltas, no winner language, stable references, and reachable keyed controls.
It did not establish rendered visual hierarchy, CSS focus, screen-reader behavior, contrast, 200%
reflow, or participant comprehension.

A subsequent in-app browser DOM walkthrough found that first Timeline mount showed the All-tracks
projection while its radio indicated Decision evidence. Commit `cbced6e` fixed the presentation
truth mismatch RED-first. The targeted test passed after failing first, 88 scoped and two independent
targeted tests passed, and fresh DOM inspection confirmed `All tracks` plus the exact 16-track
multiselect. The screenshot backend produced blank/non-visible images; do not use them as visual
evidence.

The walkthrough also found stale dynamic H2 permalinks after radio reruns. Commit `0fe3459` gives
all seven primary H2s explicit anchors. Its targeted regression failed then passed; 83 focused and
two independent targeted tests passed, with Ruff/diff clean. Fresh cross-section browser DOM
observed Overview `#overview`, Timeline `#timeline`, Compare `#compare`, and exception-text count 0.
The P2 is closed; no manual visual or accessibility status changes.

Final Task 4 validation at `0fe3459` with the documentation working tree recorded 756 full tests,
756 non-MetaDrive tests, and 506 focused Phase 6 tests. Both editable installs succeeded;
repository Ruff and diff/cached checks passed; doctor reported 17 PASS, one intended 15-entry
dirty-tree WARN, one optional DISPLAY `NOT_AVAILABLE`, and no FAIL. Six review and three comparison
CLI cases matched expected contracts, and all 100 canonical files across ten retained artifact
directories were byte-identical before and after. No simulator or policy was launched.

The browser document object model (DOM) retained-state walkthrough covered initial UNVERIFIED,
nominal PASS, collision HOLD, INVALID quarantine/no stored-PASS leak, Timeline/action
accountability, Provenance/limitations, compatible mixed comparison, incompatible fail-closed
comparison, and stable anchor hrefs without exception/leak. Pixel/manual visual quality, 200%
reflow, visible CSS focus, screen-reader behavior, contrast, accessibility audit, and human
comprehension remain `NOT YET OBSERVED`.

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

Use these separate records:

- `docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md` for rendered screenshots, keyboard, screen reader,
  focus/announcement, non-color/contrast, tables, and 200% zoom/reflow;
- `docs/PHASE6_USABILITY_TEST_PLAN.md` for Tasks 1–10 with 6–10 future participants; and
- `docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md` for one actual participant session.

Keep the closing statuses independent:

```text
Automated correctness: OBSERVED
Browser DOM structural walkthrough: OBSERVED for initial/PASS/HOLD/INVALID/Timeline/Provenance/
limitations/compatible/incompatible retained states, anchor hrefs, and no exception/leak
Manual visual review: NOT YET OBSERVED
Accessibility audit: NOT YET OBSERVED
Human comprehension: NOT YET OBSERVED
```
