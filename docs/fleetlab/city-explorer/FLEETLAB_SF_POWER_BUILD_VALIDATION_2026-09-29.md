# SF power study and integration preparation — validation record

29 September 2026. In-progress record for the owner's approved SF build. Source is an uncommitted overlay on `codex/fleetlab-city-sf`, base `7e1da7cb72ca0e08fe46ead83db07adfce0e757e`. No commit, push, PR or public deployment has occurred in this work. Generated evidence is retained under `build/fleetlab-city/validation/power-v1/`.

## Current decision

The corrected viewer can be reviewed independently of the new experiment. The new power study is **held before evaluation**, following a resource-limit refusal. No evaluation arm or outcome exists. Do not publish preflight, toy tests or an incomplete population as the 144-arm result.

The website placement plan is in `FLEETLAB_WEBSITE_INTEGRATION_PLAN_2026-09-29.md`: top-level City Explorer plus an SF homepage card, same-tab `/city-explorer/`, with a separate static app and return link. The owner placement question remains pending; shared-site navigation is unchanged. Production switching remains outside this preparation step.

## Completed evidence

| Check | Observed result | Evidence |
|---|---|---|
| Original study reproduction | All 34 scientific run/input digests and aggregate comparison match; 286.413 s. Expected map-blocked exit retained. | `reproduction-result.json`, `reproduction.log` |
| Frozen scientific baseline | Ten existing scientific/core files match the task-start source snapshot. | `scientific-source-baseline.json` |
| New protocol checkpoint | All 28 input tapes frozen before execution; protocol digest `181da257329efec546b5df88d6b0ad7a666c0194b18e327546f82ea1961025fd`. | `FLEETLAB_POWER_STUDY_FROZEN_CHECKPOINT_2026-09-29.md` |
| New preflight | 24/24 valid, eligible arms, zero hard violations; 209.488 s; peak 2,383,495,168 bytes; 940,484,370 raw arm bytes. | `preflight-acceptance.json`, `preflight.log` |
| Independent preflight analysis | COMPLETE; 106.222 s. | Frozen `preflight-analysis.json` |
| Evaluation attempt | Refused during preflight recheck at the unchanged 4 GB limit. Evaluation directory absent; zero arms. | `evaluation-attempt-1.json`, `evaluation.log` |
| City regression after review fixes | 118 Python tests and 29 Node tests pass, including missing-dependency and selected-study identity regressions. | Task 2 review logs under `.superpowers/sdd/2026-09-29-sf-power-and-integration/` |
| Hermes parity/boundary regression | 89 pass. | `hermes-boundaries.log` |
| Broad Hermes baseline | 1,660 pass, 55 skipped, 2 fail. Both failures are absolute-checkout-path byte pins; replacing only that path in a diagnostic comparison reproduces their exact expected hashes. No assertions or core behavior changed. | `hermes-full-final-baseline.log`, `hermes-path-pin-diagnosis.json` |
| Doctor | 16 PASS, 2 WARN, 1 optional NOT_AVAILABLE; inherited environment label and dirty overlay warnings retained. | `hermes-doctor.log` |
| Map preparation | Source-linked priority queue and independently reviewed continuity/review-result contracts complete. Runtime qualification and human source dispositions remain unperformed. | `map-priority-queue.json`; two map design documents |

Missing retained Hermes fixtures were copied from existing local checkouts and byte-checked against the committed registry. Original fixture sources were untouched. These fixture repairs are local validation setup, not source changes or resolution of the remaining path-dependent tests.

## Scientific and presentation scope

The six-arm study crosses A-only, A+B and B-only with 200/400 kW, keeping fleet, demand tape, port and slot totals, energy controls, original map and sites fixed. All 144 evaluation summaries and only the first declared evaluation seed's six detailed replays are supported by the new exporter. The exporter requires a fresh complete analysis and binds every source arm; unit-test fixtures establish software behavior only.

Presentation corrections use actual `no_reachable_depot` violation codes, recorded energy and the 48 kWh charge target. The unused nominal 60 kWh field is explained in methodology. The lower-demand result is explicitly one seed. Viewer-entered fares and unavailable real-world safety metrics remain intact. Operator vehicle references remain educational artwork.

The M1 map documents define cross-leg route history and a separate immutable human-review result. No map gate was relaxed, no district gap hidden and no human review inferred. The recorded v1 and candidate v2 maps remain distinct and unqualified.

## Outstanding checks

- Concrete amended execution-lifetime proposal, resource evidence, and an explicit decision on a new frozen revision/additional preflight budget.
- New power-study package and browser observations after a complete evaluation exists; the corrected existing-study package and stage are complete below.
- Shared-site placement answer, then narrow hosted integration and integration QA.
- Final physical Pixel/touch/accessibility and participant checks; prior v2 device observations do not establish this new build.
- Source/redistribution review and hosted response/readback checks before any public switch.

No statistical finding grants map qualification, operator calibration, real-world safety, authenticity or deployment permission.

## Browser-QA finding and replacement build

The first corrected package, `dist/city-explorer-v4-corrections/` (release `94467e238c48fbb8a14d704d38e7307e6dbcc98e8c4c53b31193809338eeb8dc`), passed static integrity and transfer budgets. Direct browser testing then found a real playback failure: the app registered navigation clicks on every `[data-view]` element, including the body. Play's click bubbled to the body, re-showed the current view and immediately paused the recording. Two foreground clicks reproduced the failure with a valid trace and no console error. Evidence is `browser/play-click-failure.json`.

The source now registers only actual `button[data-view]` navigation controls. A regression exercises the real registration statement and browser-style bubbling: Play keeps running, ordinary controls do not pause, and navigation switches exactly once. Both focused tests and all 29 Node tests pass; independent review approved this change. The first package and `launch-stage-v4-corrections/` are retained as failed-browser-QA artifacts and must not be promoted. A fresh immutable `dist/city-explorer-v4-final/` replaces them after browser acceptance.

The unapplied memory amendment also passed independent review. Its diagnostic analysis/capture/routing-preparation peak is 3,153,264,640 bytes; deterministic output matches the stored preflight report. Active source, original protocol and tapes remain unchanged. The owner was asked to decide on the named replacement revision and 24 additional preflight arms; no approval is inferred from elapsed time.

## Final corrected existing-study package

`dist/city-explorer-v4-final/` has release SHA-256 `920887f3fb0841b066f26a996d8c9c157fc47c1e9f2cff0b70837c069c80f0a2` and is served at `http://127.0.0.1:4182/`. All static checks pass: 4,910 files; 1,866,855 bytes first-view gzip transfer; largest asset 22,272,149 bytes; largest paired replay 9,869,801 compressed bytes. No power evaluation is included. Compared with the failed browser build, only `app.mjs` and its gzip copy changed. All 2,400 original projected traces retain their prior content with three added presentation fields: energy, layout and total power. The original comparison remains byte-identical.

Actual browser observations: direct Play changes to Pause and advances time; keyboard End reaches 15:00 and Play restarts without reloading; A-only versus A+B shows exactly the matching depot markers; entered fares remain after configuration changes; 390-pixel and 820-pixel layouts have no page-level horizontal overflow; large result tables scroll within their containers; attribution is 12 px; candidate and recorded atlas states remain separate; the flat-map renderer visibly draws the recorded roads and depot markers. No console errors were observed. Screenshots and exact observations are in `browser/final-observations.json`. These observations are desktop browser checks, not physical touch, Safari, screen-reader or human-comprehension validation.

`build/fleetlab-city/launch-stage-v4-final/` contains 9,921 files, all 99 legacy files unchanged, the current release and compatible v3 rollback release. Root header and navigation changes remain proposals in `review/`; neither is silently applied. This new pair's hosted route readback and rollback rehearsal remain NOT_RUN. The older v3 rehearsal remains historical. `release_ready` is false and publication is NOT_PERFORMED.

Both existing hosted/offline distribution checks pass, as do root Ruff and whitespace checks. Final source inventory is `source-overlay-final.json`: 79 application/config/asset files, excluding dependencies and caches; ten baseline scientific files and all twelve original frozen source hashes remain unchanged. No local commit is claimed.

The full serial legacy Node/performance suite finished after heavy jobs and browser animation stopped: **1,972 PASS, zero failures, one existing TODO**, 281.223641 seconds. Exact command: `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs`; exit 0; log `legacy-node-final.log`. This resolves the current timing check without weakening budgets or changing legacy code. It does not erase older failed attempts or the two separately documented Hermes path-pin failures.
