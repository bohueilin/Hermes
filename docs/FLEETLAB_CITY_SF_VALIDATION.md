# SF city slice — implementation and validation handoff

September 29, 2026. **Working local review build; engineering slice and release qualification remain INCOMPLETE.** The approved SF direction is implemented far enough to inspect real sourced roads and all recorded experiment results. Failed source-support gates and unperformed human/device/performance checks are not waived.

## What changed and how to inspect it

`apps/fleetlab-city/` contains a separate importer, directed router, graph/resource simulator, frozen experiment, verifiers, six JSON contracts, comparison engine, deterministic explanations, static viewer and loopback server. The visual direction is warm ivory, forest teal and restrained lavender: a welcoming atlas, decision notebook, and recorded vehicle studio. Original generic EV artwork conveys selection without pretending to model a real vehicle.

Start the reviewed package using the command in `apps/fleetlab-city/README.md`, then open `http://127.0.0.1:4173/`. Generated package: `dist/city-explorer-reviewed/`. Actual screenshots and browser observations: `build/fleetlab-city/validation/browser/`. Exact command output and retained red/green logs: `build/fleetlab-city/validation/`.

**Git identity:** baseline/tested HEAD `7e1da7cb72ca0e08fe46ead83db07adfce0e757e`, branch `codex/fleetlab-city-sf`, plus this uncommitted implementation. HEAD alone does not identify the new code. `build/fleetlab-city/validation/implementation-files.json` binds the source overlay; run and release manifests bind generated artifacts. Source overlay SHA-256: `1a9e5da39265391de12349a0d8c0b3f229d1dc04fd21888a356d00f7b9bd3bc5`. No new commit, push, PR or deployment was performed. The owner's unrelated `FleetLab-ChatGPT-review-and-next-phase.md` was preserved.

The approved brief permits relocating the isolated namespace. The legacy boundary test forbids Python and node_modules anywhere in `playground/`; the first interim test found this. The new app therefore lives under `apps/`. No protected root/legacy code or dependency/header/deployment contract was changed. Only additive project documentation accompanies the new app.

## Actual results

| Check | Result and limitation |
|---|---|
| New Python fixtures | 54 pass; corruption, source topology, source loss, resources, request accounting, partial runs, schema/hash refusal, rollback/Range and authoring fallback included |
| New Node fixtures | 6 pass; nulls, path/schema refusal, pose gaps, incompatible comparisons and stale asynchronous selection |
| Fresh large-run verification | **34/34 pass**, after independent-review hardening; 24 evaluation arms and 10 sensitivity arms |
| OD checks | 100/100 A* versus prepared Dijkstra checks pass on supported graph; unreachable outcomes retained; not independent road-semantic qualification |
| Repeat import | Graph, coverage, geometry, display roads and independent source inventory reproduce identical canonical digests |
| Repeat execution | Eight-hour seed-1001 baseline has identical semantic digest in the pinned local environment |
| City qualification | **FAIL/INCOMPLETE**: unsupported classes, official district gaps, independent semantic review NOT_RUN |
| SUMO audition | Microscopic grid, zero/100 background arrivals per hour; full SF controller/semantics NOT_QUALIFIED |
| Scoped legacy Python | **89 pass**, 7.13 seconds in final run |
| Full serial legacy Node with performance flag | Final: **1,969 pass, 3 timing failures, 1 existing TODO**, 355.57 s. Initial baseline: 1,972 pass, zero failures, 1 TODO, 283.53 s. See timing follow-up below |
| Ruff | Whole checkout checked; final output retained in `root-ruff-final.log` |
| Doctor | 16 PASS, 2 WARN (ambient Conda label and expected uncommitted work), 1 optional display NOT_AVAILABLE; no simulator launched by doctor |
| Legacy offline package | **2,424,861 bytes**, exact historical SHA-256 `169388571013337332b33aad79d7e4576e6490f07ec70322ced188dfd0c8c130`; checker passes |
| Legacy hosted package | **99 files / 3,366,216 bytes**, checker passes; reconstructed, not uploaded |
| Full root Python suite | Not rerun as a city qualification claim; inherited broader fixture failures are recorded in the existing handoff. The required scoped parity/boundary gate was run |

The final city pack accounts for **69,027 source ways**: 21,528 included, 46,957 excluded and 542 unsupported. Unsupported eligible length is 1.936%, under the overall 2% threshold; primary, trunk and living-street classes fail their 5% limits. Approximately 13.159 km remains outside official district polygons. The original frozen thresholds were retained. See the pack contract for hashes, rights, query and precise scope.

All 12 main pairs are visible. Diagnostic mean differences (candidate minus baseline) are:

| Metric | Mean | 95% paired interval |
|---|---:|---:|
| Completion | +1.111 percentage points | +0.701 to +1.549 pp |
| Empty km per completed trip | −11.001% relative | −12.330% to −9.526% |
| Boarded wait p90 | −29.408 seconds | −48.528 to −11.025 s |

Even before the map-qualification block, the completion interval does not reach the frozen +2-point practical margin. These are synthetic diagnostics, not an SF service forecast or evidence that two depots should be adopted.

| Separate sensitivity | One-depot completed | Two-depot completed | Observation |
|---|---:|---:|---|
| Lower demand | 581 / 800 | 569 / 800 | Candidate serves fewer; retain adverse direction |
| Higher demand | 629 / 1,800 | 645 / 1,800 | Internally consistent |
| Lower initial energy | 439 / 1,200 | 442 / 1,200 | Reserve breaches in both arms; support blocked |
| Higher initial energy | 718 / 1,200 | 754 / 1,200 | Internally consistent |
| Turnaround load | 568 / 1,200 | 583 / 1,200 | Internally consistent |

### Legacy timing follow-up

The final serial suite exceeded unchanged timing pins in three places: experiment-step gap 13.90 ms (8.08 ms process CPU), run-window gap 8.30 ms excluding series computation, and scale-response block 11.257 ms. Functional behavior was not changed. A separate CPU-heavy browser test workload was observed on the machine during this suite; that is a possible contributor, not a proven explanation for every failure. Failure logs are retained and timing thresholds were not relaxed. A separate rerun of performance/runtime files had 50 pass and 3 timing failures (12.65 ms experiment gap; 9.58/15.28 ms run-window/run-pair gaps). The scale-response timing case also failed separately. The machine remained under unrelated load. This timing gate is unresolved; no implementation or threshold was changed to conceal it. A quiet-machine rerun is required before release qualification.

## Measured runtime and package budgets

Machine: Apple arm64 Mac, 14 cores, 64 GiB RAM, macOS 26.5.2; Python 3.11.15, Node 22.22.0, npm 10.9.4. Python dependencies and wheel hashes are isolated in `requirements.lock.txt`; npm lock pins MapLibre GL JS 6.11.2. No root dependencies were added.

| Measurement | Observed |
|---|---:|
| Graph 100-vehicle / 60-minute benchmark | 1.341 s runner + 4.131 s router preparation; 1,570,717,696-byte process peak RSS; passes 5-minute/4-GiB target |
| 34 eight-hour arms | Maximum runner time 4.291 s; process peak RSS at most 2,419,392,512 bytes; passes 40-minute/4-GiB targets on this machine |
| SUMO grid 100 fleet vehicles, zero background | 1.852 s for one simulated hour; 100 maximum concurrent; zero teleports/pending insertion |
| SUMO grid, +100 arrivals/hour | 2.027 s; 200 maximum concurrent; zero teleports/pending insertion |
| SF netconvert | 32.77 s; unresolved mappings include 435 restriction-direction, 62 from-edge and 124 to-edge warnings; not a semantic pass |
| Full source road pack | Approximately 109 MiB, below 250 MiB |
| Reviewed viewer initial compressed transfer | **1,790,700 bytes**, below 3 MiB; byte accounting, not a throttled browser-time measurement |
| Each complete two-arm replay | 3,327,886–3,387,079 bytes compressed, below 20 MiB |
| Twelve-pair comparison | 24,354 bytes, below 1 MiB |
| Largest package file | 22,272,149 bytes, below the 25 MiB per-file packaging ceiling |
| Package inventory | 4,834 files including precompressed representations; approximately 345 MiB on disk |

RSS is process-wide high-water memory, not per-arm incremental allocation. Timing omits source import and downstream verification/packaging; each is a distinct command. SUMO grid speed does not establish SF controller fidelity. All byte gates are recorded separately from unmeasured browser latency gates.

## Browser and failure-state observations

Actual painted frames were inspected in the Codex in-app Chromium browser on this Mac at **1440×900, 768×1000 and 390×844**. No page-wide overflow was observed. Tables use their own labeled scrolling regions. Atlas source/scenario layers, comparison, scope, selected-vehicle playback, pause and keyboard End seeking to 15:00 worked. The flat renderer retained geography and tables. Normal paths produced no console errors/warnings.

The notebook displayed 12 pairs and five sensitivities, including low-energy reserve breaches. Local test fixtures displayed incompatible, invalid and incomplete results with explicit reasons, no paired numeric rows and unavailable metric fields. A missing replay returned 404, disabled playback, hid the car, and stated that no substitute run was loaded. Fixture data is explicitly labeled and is not included as an SF result in the review package.

`npm run test:browser` checks hashes/completeness of recorded browser observations; it does not impersonate a browser test runner. **NOT_RUN:** physical Safari/iOS/Android/Windows devices, five-person formative study, throttled cold-map time at 20 Mbps/50 ms, p95 frame/selection/seek timing, browser memory ceiling, OS reduced-motion preference enabled, and hardware WebGL failure injection. Reduced-motion CSS and an explicit flat renderer are implemented; that is not proof of these unperformed checks.

## Review findings and corrections

A fresh read-only reviewer reproduced five material integrity gaps. Charging counters could be forged without delivered power; completed requests could be disconnected from frozen endpoints; packaging could accept a stale comparison; occupancy categories could be fabricated; replay energy/state were not verified. Meaningful regressions first reproduced failures. An independent interval reducer now reconstructs resource-delivered energy, route/time/location, request endpoints, occupancy and pose annotations. Packaging freshly verifies captured runs and binds the frozen protocol, specification and comparison before projection. All 34 runs pass this strengthened verification.

Other retained failures include the initial namespace boundary rejection, initial absent implementation tests, zero-length-edge movement mismatch, and a verifier bug at zero-duration charge-release/dispatch transitions. The fixes have regressions; initial evidence was not deleted or rewritten. This review improves internal consistency, not authenticity or real-world validity.

## Release preparation, costs and outstanding gates

`dist/city-explorer-reviewed/release.json` records compatible schemas, content inventory and whole-bundle rollback unit; `network.json` permits only the same origin. `_headers` is a proposal scoped to `/city-explorer/*`. No existing live headers changed. Local server tests cover CSP, traversal/symlinks, byte ranges and corrupted-release/restore rehearsal. A future deployment must mount this package at that route, compare legacy bytes/headers, read back deployed assets/headers, and retain the previous compatible release for at least 30 days. No automatic production switch was made.

Actual task spend is **$0**: no paid CPU, provider calls, assets, GPU purchases or hosting upload. The local monthly record does not assert knowledge of unrelated account invoices. Template explanations work. Fireworks live transport, provider qualification, atomic reservations, stale-price controls and concurrent-call qualification remain optional/unimplemented; the CLI refuses paid execution and returns the template. No keys or account settings were accessed.

**Recommendation:** review this implementation locally as an explicit unqualified city prototype. Keep the SF-first direction; do not expand geography or publish a city recommendation until its source and semantic gates pass.

**Top risks and mitigations:** source/routing gaps → retain full inventory and block recommendations; simplified operational physics → expose model limits and qualify SUMO separately; evidence overclaim → separate execution, verification, eligibility and authenticity; visual/device uncertainty → complete measured browser and human checks before release.

**Next three actions:** (1) resolve unsupported restrictions and official district accounting with independent map inspection; (2) qualify the SUMO depot/controller semantics and rerun the frozen experiment if changing engine/model; (3) complete target-device, measured browser-performance and formative-user validation, rerun the unchanged legacy timing suite on a quiet machine, then review a concrete deployment/rollback diff. Austin and Tokyo import probes follow that foundation, not a premature multi-city claim.
