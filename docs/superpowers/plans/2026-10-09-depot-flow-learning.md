# Depot flow learning Implementation Plan

> **For agentic workers:** Use the parallel-agent skill for disjoint components, then native integration and a fresh whole-change review. User has explicitly requested implementation and publication; no repeat permission gate.

**Goal:** Ship understandable, accessible, verified NF-01 playback and the NF-02 four-visit lesson while preserving the integrated site.
**Architecture:** Immutable model records feed a separate projection and the existing chart system. NF-02 has a separate numerical contract/engine/verifier; UI selects explicit lesson state. No new network or runtime dependency.
**Tech Stack:** Existing JavaScript modules, Node tests/fake DOM, static HTML/CSS/SVG, Python integration and readback tools.
**Spec:** `docs/superpowers/specs/2026-10-09-depot-flow-learning.md`.

## Global constraints

- Preserve NF-01 versions/fixtures and SF bytes. Only guess storage leaves the export wrapper.
- Both edition ceilings: 2,621,440 raw packed bytes. NF-02 offline reserve: at least 50,000 bytes. No fetch/dynamic import/CSP relaxation.
- No new cities, telemetry, solver, scientific cohort campaign or human-qualification claim.
- Native button keys; app motion preference; one loop; no automatic play or resume.

## Review focus

- A superseded or cancelled run cannot inherit success or steal focus.
- Same-time completion, partial service and interval-boundary grants must agree with independent arithmetic.
- Bad allocations, corrupted records and unexpected own-property keys fail closed.
- Guess, playback, selection and previous-run state never alter exported scientific records.
- Shared header/packer changes cannot remove content or bypass exact source preservation.

### Task 1: Read-only projection and learning explanations

Files: new `src/ui/depot-flow-view.js`, `test/depot-flow-view.test.mjs`, test-only oracle/fixtures. Own only these files.
Interfaces: `inspectState(record,t_s)`, `guidedMoments(result)`, `eventSentence(result,t_s)`; communicate concrete shapes before UI integration.
- [ ] Add failing literal minute-3/5/11 tests and whole/half-second independent integral/event-fold sweeps.
- [ ] Implement pure projection, event sentences and result-derived moments; reject unverified/corrupt comparisons before captions.
- [ ] Test default stops `[0,180,300,360,600,720,780]`, 45 GB and 20 kW; mutation and export invariance.
- [ ] Run `node --test playground/fleetlab/test/depot-flow-view.test.mjs` and report exact API/results.

### Task 2: Separate four-visit model and independent verifier

Files: new `src/model/depot-cohort-contract.js`, `depot-cohort.js`, `depot-cohort-verify.js`, `test/depot-cohort.test.mjs`. No NF-01 edits.
Interfaces: `cohortScenario({time_quantum_ms=1000})`, `simulateCohort(scenario,rule,runtime)`, `verifyCohort(record)`, `cohortComparisonSteps(options,runtime)`, `runCohortComparison(options,runtime)`; result arms match NF-01's verified UI shape where possible.
- [ ] Write literal four-rule golden schedules at both quanta, completion equality/censoring and forged allocation tests.
- [ ] Implement slot service with rotating eligible-ring remainders and bounded validation; separate verifier recomputes every accepted slot and policy.
- [ ] Test lowest-ID/global-ring mutants, invalid keys/rates, zero work/capacity, cancel, no hidden drop, all 24 serial permutations and shared bound arithmetic.
- [ ] Run `node --test playground/fleetlab/test/depot-cohort.test.mjs` and record runtime/size.

### Task 3: Shared chart and controlled presentation transport

Files: `src/ui/charts.js`; new `src/ui/depot-flow-player.js`; dedicated chart/player tests. No lab or style edits.
Interfaces: chart `flowLanesCharts(options)` exposes element, cursor/reveal control and cleanup; player receives event times/moments/horizon, injectable scheduler, reduced-motion callback, render/announce hooks.
- [ ] Write failing cursor/ready/deadline geometry and fake-scheduler pause/seek/hidden/destroy tests.
- [ ] Extend existing chart utilities without changing sibling outputs; token encodings, compact all-rule NF-01 chart and selectable NF-02 groups.
- [ ] Implement linear explicit playback, one-second reduced-event mode, clamped gaps, exact guided stops and no auto-resume.
- [ ] Verify zero rest frames, immutable outcomes/export and untouched chart regressions.

### Task 4: Lesson experience and integration

Files: `depot-flow-lab.js`, stylesheet, teaching frames, catalog, Studio, operations bridges, hosted integration, focused UI/copy tests and exact package allowlists.
- [ ] Add failing focus/stale/guess export, phone semantic outcomes, copy coverage and second-lesson route tests.
- [ ] Implement I01-I12 and A04/A05/A08, wire the pure projection/chart/player and NF-02 chooser/bound.
- [ ] Add one-change next-test questions, previous-run comparison and result-derived explanations; keep controls stable and semantics named.
- [ ] Update exact changed/added inventories, copy guards and size ratchet. Verify both editions and all preserved City payloads.

### Task 5: Review, full gates and live release

- [ ] Run teaching Node, City Node/Python, Hermes with `PYTHONPATH` and `FLEET_PLAYGROUND_BASE=bca4ccd`, Ruff, doctor and diff checks.
- [ ] Inspect real browser desktop/phone, defaults, counterexamples, pause/reduced motion/keyboard, deep links, original pages and offline operation.
- [ ] Fresh scoped review; fix important findings with regression tests; record unavailable human/device coverage.
- [ ] Commit reviewed source; rebuild integrated package with exact commit; push; publish preview; compare every served file/header; publish production and repeat.
- [ ] Write `docs/FLEETLAB_NETWORK_FLOWS_HANDOFF_2026-10-09.md`, decisions by I/A/C identifier, release receipt and remaining scoped phases. Push documentation.
