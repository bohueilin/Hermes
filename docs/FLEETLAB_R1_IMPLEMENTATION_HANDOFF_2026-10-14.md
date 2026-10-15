# FleetLab R1 implementation handoff — October 14, 2026

Status: implementation and release validation in progress. This file will be completed with source/deployment identities and readback after publication. Supersedes the R1 review-only checkpoint. R3/R2/R7 remain contract drafts, per the owner's explicit answer.

## Delivered scope

Build spec §3: hosted `/network-flows/rebalancing/`, “Where should the empty cars go?”, 24 cars/four zones/120-minute frozen study, reactive and perfect-next-count heuristics, six guided chapters, counted zone state/transit, per-vehicle full event trace, whole-run paired metrics and zone wait comparison, full52-zone-row ledger per arm, pending/manual allocation and independent reset.

Build spec §3.1: software-delivery forward link now points to R1; R1 continues to the existing delivery-order lesson. Hosted Explore and roadmap expose R1 only when the complete integrated generation declares its release marker.

Build spec §§5–7: Ready / idle, COD and VOR defined separately; no fabricated VOR events. Numerators and denominators explained. NF-05 hero and NF-06 decision vignette preserve the concept/output distinction. Muted, playsinline looping films have visible controls, reduced-motion/data-saver handling, visibility pause, poster fallback and explicit error retry. Owner-selected text-free FleetLogo mark replaces the image wordmark; HTML text, responsive derivatives, favicon/touch icon, headers, footer and offline panel retained. Existing homepage animation and teaching content remain.

## Actual results, not promised benefits

| Outcome | Reactive | Forecast |
|---|---:|---:|
| Requests admitted |163|163|
| Pickups within deadline/observation |137|151|
| Trips completed |132|145|
| Picked up, trip unfinished at120min |5|6|
| Expired/unserved requests |26|12|
| Empty kilometers |59.4|92.2|
| Pickup approach km |27.4|30.2|
| Repositioning km |32.0|62.0|
| Zone B p95 pickup wait, served only |60s|258s|

Forecast serves14more requests for32.8more empty km, while Zone B's tail wait worsens. No scalar winner, paper-effect target or fleet-optimum claim. The two rules also use different reserves: this is not only a timing switch.

Reactive record SHA-256: `43c92491189cdb64eea6c5483488374a00399e155f6b61475bce093d449ec17a`.
Forecast record SHA-256: `30543a2352d3e826e9f82ce61fe82d07b5e9cf01dc92b019582e1df4bf977f89`.

A bounded worker reconstructs the recorded arms. An independent verifier reconstructs mandatory events, complete ledgers, legal policy moves, exact request populations and rational distances without importing the producer. Common-input identity and pinned study digests gate acceptance. Manual edits do not change results until a matching checked response is accepted. Stale/corrupt responses and over-allocation are rejected; a batch in flight cannot be edited. Emptying a zone is allowed with a specific projected-zero warning.

## Deliberate amendments and gaps

- The owner approved the full R1 numerical contract before implementation; all invented workload/algorithm choices are recorded there. No further scientific parameters were invented during implementation.
- The owner approved40KiB package metadata after the initial inventory exceeded32KiB. All other ceilings remain unchanged; final measured counters appear below after the immutable build.
- Immutable study pins live under `src/model/` to retain the runtime dependency boundary. There is a narrow R1-only forecast terminology and exact research-navigation exception; remote asset/network restrictions remain.
- Only the two reviewed MP4 derivative paths are excepted from existing ignore rules. Original full-size videos and unrelated owner files remain unstaged.
- The requested paper effect for Yang/Liu/Du remains withheld because its primary source was not verified. The Jacobsen preprint is linked with its real version date and external-results boundary. No implied replication.
- R3/R2/R7 need owner review of the supplied complete contracts; no numerical implementation, chart results or public lesson routes for them yet.
- No physical Pixel test in this release; responsive browser checks do not establish hardware qualification. Independent human comprehension, SF map/source review and existing SF launch holds remain open. This teaching release grants no operational authority.

## Review decisions

One fresh independent final review found two R1 issues, both fixed with failing-then-passing tests: removal of a submitted pending row, and absent actual zero-ready-zone warning. It also corrected the R2 draft's power diagnostic to distinguish commanded allocation from actual draw. No deferred minor findings. Final source-bound integration and live behavior were outside that review and are separately checked below.

## Follow-on review packet

1. `FLEETLAB_R3_DISPATCH_MODEL_CONTRACT_2026-10-14.md`: exact current-batch matching versus greedy; no future request oracle.
2. `FLEETLAB_R2_CHARGING_MODEL_CONTRACT_2026-10-14.md`: six-car workload, exact taper integration, plug/site limits, tariff and deadlines.
3. `FLEETLAB_R7_OTA_SHARING_MODEL_CONTRACT_2026-10-14.md`:40-car chunk dissemination, explicit contacts, cloud/seeding/rescue and counterexample. Package delivery does not mean installation or fleet readiness.

Recommended review prompt: “Review these proposed synthetic model contracts before implementation. Identify ambiguous event ordering, objectives, invariants, input domains, metric denominators, unearned optimality/safety claims and missing counterexamples. Check whether a visitor could understand the decision and its costs. Do not substitute research percentages for expected results. Return only concrete amendments, distinguish blocking defects from optional extensions, and preserve build order R3→R2→R7.”

## Recommendation

Publish only the verified R1 teaching release. Review the three follow-on contracts before building their numerical outcomes.

## Top risks + mitigations

1. Optimistic forecast mistaken for production prediction: explicit perfect-count assumption and mixed results.
2. Inconsistent evidence displayed as results: independent coverage/common-input checks and synchronized accepted identities.
3. New lessons mistaken for AV qualification: persistent synthetic scope, missing-evidence labels and separate SF holds.

## Next 3 actions

1. Complete immutable build and publication readback for R1.
2. Owner reviews R3, R2 and R7 contracts together or sequentially.
3. After approval, implement R3 first with its bounded verifier and counted UI.

## Validation record

Commands actually executed in this workspace (logs under `build/fleetlab-city/validation/r1-build-20261014/`):

| Gate | Observed result |
|---|---|
| Focused R1 model/verifier/session/UI/package tests |34 passed after review fixes|
| Concept-loop player tests |8 passed, including actual-error explicit retry|
| City Node suite |93 passed; additional discovery test suite6 passed|
| City Python unittest discovery |343 passed (includes40KiB Python boundary regression)|
| Hermes pytest with `PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd` |1,662 passed,55 skipped|
| Ruff |passed|
| Hermes Doctor |17 PASS,1 WARN (working tree edits),1 optional NOT_AVAILABLE|
| Browser |1280px desktop,390px and320px responsive widths; no horizontal page overflow after fix; accepted/rejected manual batches, recorded arm switch, complete52-row ledger,24-vehicle conservation, keyboard endpoint and no console errors|
| Full teaching Node suite |2,372 passed,8 skipped,1 todo;0 failures|

Initial failures were resolved, not hidden: old fixtures omitted new owned media; runtime pins were moved to the permitted model layer; a local variable named `window` was renamed to avoid the model boundary guard; the filesystem reader retained its existing bounded API; exact two-path ignore additions were tested; source restoration now includes the R1 sidecar. One interim suite encountered a CSS mutation during reproduction while responsive QA was editing it; the final suite runs against stable application sources.

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
git diff --cached --check
```

The first immutable integration stopped before upload because the Python integrator retained the old32KiB receipt cap. Its mirrored cap is now40KiB; a regression test verifies40,960bytes reach source verification and40,961bytes are rejected. No other limit changed.
