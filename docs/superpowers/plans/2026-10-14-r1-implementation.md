# R1 approved implementation and follow-on contracts

Owner approved the October 14 R1 model contract and explicitly authorized GitHub push and live publication. Owner subsequently requested R3/R2/R7 model contracts for review before their numerical implementation. Existing isolated worktree: codex/fleetlab-city-sf, baseline fc8bd332.

Use native execution, focused red/green tests, one final independent review, source-bound deployment and public byte/header readback. Current user authorization overrides AGENTS.md §19 for this static teaching-site release; physical deployment authority remains NONE. No further procedural approval is required for R1 implementation. A specific scientific or package-contract amendment remains explicit if needed.

## Task 1 — numerical contract and model

- Freeze the approved contract without changing its workload. Add bounded normalization, canonical digests, frozen input and canonical manual batches in `src/model/rebalancing-contract.js`.
- Write tests before implementation: exact workload, one-trip accounting, deadline equality, empty populations, horizon truncation, stranded zones, canonical manual batch identity, invalid controls and two-policy determinism.
- Implement integer-second event processing in `src/model/rebalancing.js`: completions → admissions → local dispatch → expiry → predecision boundary → policy/manual moves → postdecision snapshot. Preserve all 24 vehicles and every admitted request.
- Metrics derive from actual events/legs with rational distance and explicit availability. Output policy, normalized input, stop time, canonical decisions, events, boundary/decision snapshots, metrics and record digest.

## Task 2 — independent verification and study

- Implement `src/model/rebalancing-verify.js` without importing the producer. Independently replay mandatory events, shared dispatch and policy choices; reconstruct populations, distances, snapshots and metrics; compare full normalized inputs and digests.
- Negative tests mutate each evidence family, remove events/rows, substitute a valid foreign-workload arm with regenerated hashes, change stop time, violate tie order and conservation. No invalid record can supply UI outcomes.
- Record reviewed default expectations in `src/model/rebalancing-study.js`. Worker reconstructs both records, independently verifies them and compares pinned input/event/record identities before accepting the study.

## Task 3 — package ownership before UI

- Register the hosted-only R1 page, dependency closure, release sidecar, source inventory and four concept assets. Keep offline imports/bytes unchanged.
- Extend existing physical ownership and Python integration allowlists; keep shared core modules charged to their existing owner. Retain aggregate counters, independently count full R1 closure and pinned concept bytes.
- Measure actual package before full UI. No hidden budget increase; document any measured amendment for owner decision.

## Task 4 — counted learning interface

- Reuse the approved six-chapter structure and chosen logo. Render only accepted worker records. Build four-zone counted displays, common-scale policy comparisons, explicit unserved/pending populations, selectable vehicle state, full 52-row-per-arm ledger and digest disclosures.
- Recorded playback is view-only, ten-minute snapshots with explicit pre/postdecision labels. Concept films are separate. Honor reduced motion, pause, hidden-page and error behavior.
- Manual batches remain pending until Apply moves & advance interval. Canonicalize/validate whole batch; keep accepted output on rejection. Allow deliberate zero-ready zones. Reset the manual run independently of the recorded comparison.
- Change software-delivery's next link to R1, preserve R1→Delivery order, expose the lesson in hosted Explore only when its complete generation is accepted.

## Task 5 — sequential next contracts

- Draft complete R3 dispatch, then R2 charging, then R7 sharing contracts with declared synthetic workloads, algorithms, metrics, failure cases and interpretation limits.
- Respect supplied routes/titles. No numerical implementation or deployment of those lessons before owner review; no predetermined paper effect sizes or winner.

## Task 6 — verification and release

- Run focused tests, four existing suites, Ruff, Doctor, diff checks, source/package proof and desktop/phone UI validation. Save exact outcomes and independent review decisions.
- Explicitly stage intended sources/approved media only; preserve unrelated owner files. Commit after gates, build immutable source-bound generation, review upload guard, push current branch without force, preview then production deploy, compare served files/headers.
- Update dated implementation handoff, live receipt and CODEX_HANDOFF. Provide three next contracts for review.

## Review focus

1. Boundary expiry belongs to exactly one reactive interval and ledger row.
2. Every displayed outcome is bound to an accepted record and exact shared workload.
3. Manual over-allocation/stale responses cannot overwrite accepted outcomes.
4. Independent verifier detects omission as well as inconsistent supplied events.
5. Package/source capture includes all R1 originals and media; old offline/scientific payloads remain exact.
