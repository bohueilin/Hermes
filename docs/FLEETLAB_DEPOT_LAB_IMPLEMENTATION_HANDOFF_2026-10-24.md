# FleetLab Depot Readiness lab: implementation handoff

**Date: 2026-10-24. Owner: Bo-Huei Lin. Built by Claude (Opus 5.5 lead, builders, reviewers and verifiers).**

This implements the frozen depot readiness design, [`FLEETLAB_DEPOT_READINESS_FREEZE_CANDIDATE_2026-10-24.md`](FLEETLAB_DEPOT_READINESS_FREEZE_CANDIDATE_2026-10-24.md) (annex D1-01 to D1-13, D12-01 to D12-05, C1 to C4), under [`FLEETLAB_DEPOT_READINESS_RECONCILIATION_2026-10-24.md`](FLEETLAB_DEPOT_READINESS_RECONCILIATION_2026-10-24.md) (§7 budget, §8 decisions, §11 plan). The owner's build authorization (reconciliation §11.8) covered implementation, executable schemas, fixtures, tests, local previews, package accounting and local review artifacts. Build decisions are recorded in [`FLEETLAB_DEPOT_LAB_ENGINEERING_NOTE_2026-10-24.md`](FLEETLAB_DEPOT_LAB_ENGINEERING_NOTE_2026-10-24.md); §§19 to 22 are binding.

**Status: published on 2026-10-24 at <https://fleetlab.pages.dev/depot-readiness/> (production `72e45e9f`, source `a1b79cd`).** It was built, independently reviewed, fixed and validated locally in three checkpoint commits on `codex/fleetlab-depot-lab`. The owner then asked to publish without the separate release review, so that Muse can audit the live site. The owner ran both uploads with their own credential injector, and both were read back in full (§10). Nothing was pushed to GitHub and no pull request was opened. (Added 2026-10-25: the branch was pushed on 2026-10-24 at `f1d130e`, and the reconcile pull request from `codex/fleetlab-main-reconcile` brings it to `main`.) Sections 1 to 8 describe the build as reviewed. The release-records bullet in §1, the readiness line and item 7 in §9, and §10 reflect the publication.

## 1. Scope delivered and what is not done

Delivered, as frozen:

- **Route.** `/depot-readiness/`, hosted only. The source page lives in `playground/fleetlab/depot-lab/` (BD-16) and is emitted at `depot-readiness/{index.html, boot.js, visual.css, release.json}`.
- **Seven families.** Positions, AC/DC, Garage, Services, Wi-Fi, Staffing and Training each have a setup card ("Space", "AC/DC charging", "Garage", "Services", "Wi-Fi and data", "Staffing", "Training") and an A33 learning-path case. Three page-level guided questions map onto the presets.
- **Fourteen presets.** B, P, PS, D, DR, M, T2, S200, W, G, GN, TP, TN and ST, plus Build your own. All 27 preset arms are COMPLETE and VERIFIED; S200 is baseline only.
- **Target SOC.** `requirement.energy.target_soc_pct` is an integer from 20 to 100, default 80, with shortcuts 60/80/90/100 and numeric entry. It is shared across arms. The 1 to 200 and 20 to 100 ranges are available at 390 px.
- **Engine.** Deterministic, with exact BigInt rationals and the frozen policy `fcfs_eligible_fair_resources_v1`. It implements:
  - retained anchors and the 21.6 s/% first band;
  - serial activation and postcheck, with inspection while connected;
  - retained-origin ownership and same-tick conformance;
  - complete H accounting and AND-OR blockage closure.
- **Ledger.** Bounded at 100,000 records, 33,554,432 bytes, 16,384 bytes per record and 64 vector entries, with canonical chunking.
- **Independent verifier.** Boundary tests confirm it never imports the engine's allocation, eligibility or policy as an oracle. Its verified projection supplies registry-keyed metrics, reason sets and holder trails, resource partitions, the comparison vector and remaining work; the registry itself is a contract-side module.
- **Runtime.** A worker runs only after an explicit Run or Compare. Runs can be cancelled, and stale replies are rejected (A42). Import and export are bounded. Shared setups are reconstructed, and a digest mismatch shows "Could not reproduce".
- **UI.** Overview and Technical reading levels over one verified state, with an accessible schematic and its equivalent text list, the inspector, events and assumptions.
- **Hosted integration.** One added link on the five-question Network flows hub, package ownership and a local release build.

Honoured deferrals: no fleet adapters, policy comparison, optimization, costs, confidence intervals, replicate UI, dynamic faults or retry, status transport, backend, telemetry or operational integrations. A2 remains the Fleet day hero, V1 stays held, no media was added, and the other model identities are untouched (§8).

Not done or limited:

- **Pair links.** No pair can be shared as a link: every named pair is 39,312 to 42,623 base64url characters, over the frozen 32,768 limit. Pairs share by configuration file, which the page offers. Single-setup links work, and S200 at 116,290 characters is also export only.
- **Analytics.** The depot page renders tag-free: no analytics tag, and a privacy line that names only the hosting provider, through the new `tagFree` option of the hosted transform. The site-wide `/*` CSP header still allows Google origins for every page. The release review must confirm the analytics exclusion (BD-17).
- **Not tested:** screen-reader software, the OS reduced-motion toggle (the CSS media query is covered by fake-DOM tests), a physical phone, and browsers other than the Claude desktop app's Chromium pane.
- **A32 and A34** are later search and reference requirements under D1-13, not first scope.
- **Release records.** Updated after publication: `docs/releases/fleetlab-current.json`, the deployment runbook and `CODEX_HANDOFF.md` (§10).

## 2. Branch, revisions and changed files

| Item | Value |
|---|---|
| Branch | `codex/fleetlab-depot-lab` in the `Hermes-fleetlab` worktree |
| Base (live release source) | `d0df87f` |
| Checkpoint 1 | `3dedf679052df1aef8d1e7c681e525d81a219b0b`, the implementation |
| Checkpoint 2 | `8e48be6b50bf572794468c52a7fab5e9db319b16`, independent-review fixes |
| Checkpoint 3 | `a1b79cd137aa802c2bff1459843f550a5d70da83`, blockage-holder wording; source tree `5d890e38d3376b8870a8bcaa026bd0e61908f2da` |
| This handoff | committed on top of `a1b79cd`, documentation only |

From `d0df87f` to `a1b79cd`, 88 files changed: 68 added and 20 modified.

| Area | Files | Lines added / removed |
|---|---:|---:|
| `src/model/depot-lab/` (contracts, engine, ledger, registry, presets, compare) | 15 | +1,852 / 0 |
| `src/model/depot-lab-verify/` (independent verifier) | 6 | +1,129 / 0 |
| `src/runtime/depot-lab-{job,worker,session}.js` | 3 | +274 / 0 |
| `src/ui/depot-lab-*.js` (app, controls, inspector, view, evidence, share, format) | 7 | +909 / 0 |
| `depot-lab/{index.html, visual.css}` | 2 | +79 / 0 |
| Depot tests: 31 `depot-lab-*.test.mjs` files and 2 helpers | 33 | +5,584 / 0 |
| Existing teaching tests: `package-proof`, `software-delivery-package` | 2 | +32 / -10 |
| Teaching tools: `depot-lab-package.mjs` (new), `pack`, `check-dist`, `software-delivery-package`, `package-proof` | 5 | +94 / -27 |
| Hosted integration: `integrate-site.py`, `check-headers.py`, `integration-assets.mjs`, `site-transform.mjs`, `network-hub.{html,css}`, `sitemap.xml` | 7 | +101 / -16 |
| Hosted and City tests | 7 | +125 / -9 |
| `docs/FLEETLAB_DEPOT_LAB_ENGINEERING_NOTE_2026-10-24.md` | 1 | +885 / 0 |

Left untouched:

- The older `src/model/depot-readiness.js`.
- The historical Oct 23 spec, research and reviewer documents, the Muse proposal, the mockup and the three concept images. All are byte-identical (§8); the concept images were used as reference only and are not placed anywhere.
- Four tracked files that held uncommitted edits before this task. They were left as they were and never staged: `CODEX_HANDOFF.md`, `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`, `docs/FLEETLAB_ENHANCEMENT_REPORT_2026-10-23.md` and `docs/releases/fleetlab-current.json`.

## 3. Validation

Commands ran from the `Hermes-fleetlab` root on the committed tree `a1b79cd`, after the commit. Node commands used the pinned Node v22.23.4 (`build/fleetlab-city/toolchain`). The City Python test that packs at `--source-commit HEAD` spawns `node` from `PATH`, which here is v22.22.0.

| Gate | Command | Result |
|---|---|---|
| Teaching suite | `node --test playground/fleetlab/test/*.test.mjs` | 2,875 tests: 2,866 pass, 0 fail, 8 skipped (opt-in timing), 1 todo (400-px browser smoke) |
| Depot lab subset | `node --test playground/fleetlab/test/depot-lab-*.test.mjs` | 412 / 412 |
| Hosted suite | `node --test apps/fleetlab-city/test/*.test.mjs` | 234 / 234 |
| City Python, locked environment | `build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests -q` | 375 OK |
| Hermes playground parity and boundaries | `FLEET_PLAYGROUND_BASE=bca4ccd … pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py` | 91 passed |
| Hermes Python regression | `… pytest -q -m "not metadrive"` (hermes-dev, Python 3.11) | 1,664 passed, 55 deselected |
| Lint and whitespace | `ruff check .`; `git diff --check` | clean; clean |
| Source and emitted package | `apps/fleetlab-city/deploy/build-release.py --commit a1b79cd… --legacy … --out dist/fleetlab-depot-lab-20261024-a1b79cd`, in a clean detached worktree | "Local release verified; publication and hosted readback NOT_PERFORMED." The run covers pack, check-dist, package proof, hosted brand, integrate-site, `--check-integrated`, the local release record and stage verification. |

### Acceptance catalog (D1-13)

| Case | Outcome | Where |
|---|---|---|
| A21 to A24 analytical cases (one vehicle; unequal needs; two-port cap; fair-sharing regression) | Pass at the exact frozen ticks, energies and fractions | `depot-lab-engine-analytical`, `-allocation`, `-verify`, `-compare` |
| A25 planted violations | Pass; each mutation reports its own code | `depot-lab-negative`, `-review-verify` |
| A26 tie-free renaming and permutation | Pass | `depot-lab-acceptance` |
| A27 non-anticipativity (D1/D2 hardening) | Pass | `depot-lab-acceptance`, `-ticks` |
| A28 horizon sensitivity | Pass: verifies at both horizons; classification reported, not asserted | `depot-lab-acceptance` |
| A29 abandonment classifier (35 = 5 + 30 versus 715 min) | Pass: mixed | `depot-lab-compare` |
| A30 threshold display (1,199 / 1,200 / 1,201 against 1,200; "< 1 min") | Pass, with exact seconds in both reading levels | `depot-lab-format`, `-inspector` |
| A31 render parity | Pass: same nodes in both levels (fake DOM, current code); 36 outcome rows identical in the browser at `3dedf67` | `depot-lab-ui`; browser at `3dedf67` |
| A32, A34 | Deferred by D1-13 | — |
| A33 learning path, all seven families | Pass | `depot-lab-acceptance` |
| A35 Wi-Fi label identity; A36 compatibility and bundle counts | Pass | `depot-lab-compare`, `-verify-presets` |
| A37 to A39 manifests (same-tick acquisition, content lifecycle, cold cache) | Pass, for both the valid references and the mutations | `depot-lab-engine-analytical`, `-negative` |
| A40 blockage (closed subset, stall, terminal, escape, accounting) | Pass | `depot-lab-blockage` |
| A41 share and reconstruction | Pass. In the browser at `3dedf67`, run digest `f036ed60…` reproduced and a mutated claim read "Could not reproduce". The same digest reproduces in Node at the current code. | `depot-lab-share`; browser at `3dedf67` |
| A42 stale replies, including edit-back-to-earlier-digest | Pass | `depot-lab-session`; browser at `3dedf67` |
| A16 sequence (keyboard, 390 px, reduced motion) | Pass, except screen-reader software (not run) | fake DOM; browser at `3dedf67` and `8e48be6` |
| Target-SOC cases (band edges, initial at or above target, 20 to 100 integer gate) | Pass | `depot-lab-contract`, `-tasks`, `-controls` |
| Anchor cases (C2.1 oracle; 7 and 11 flows with prime denominators) | Pass | `depot-lab-contract`, `-acceptance` |
| D12-01 to D12-05 profile, matrix and presets | Pass | `depot-lab-presets`, `-identity`, `-tasks` |

The withdrawn S200 bound of 44,720 records / 15.6 MiB is not asserted anywhere; measured values are in §6.

## 4. Independent review and dispositions

An implementation review ran six lenses: boundaries, arithmetic, verifier bypass, copy and accessibility, packaging attribution, and runtime and security. Adversarial skeptics then checked each finding: **23 were confirmed and 16 refuted.**

Two further verification rounds re-ran every reproduction against the fixes, attacked each fix with variants, and hunted regressions:

- more than 14,500 honest CANCELLED and INCOMPLETE prefixes, plus about 16,000 last-tick tamperings;
- an agreement fuzz over 3,640 validated random scenarios (1,960 in round 1 and 1,680 in round 2), with no false INVALID;
- forgery sweeps over guard claims.

Each round's new problems were judged by skeptics too:

- the ones confirmed real were fixed;
- a few refuted ones were changed anyway as cheap hardening;
- the rest are dispositioned below.

Every fix has a regression test that fails on the earlier code. The binding rules are in note §22.

### Confirmed and fixed

| Finding | Severity | Fix |
|---|---|---|
| BYP-01 target-reached COMPLETE could be omitted or deferred | critical | COMPLETE is due at the closure tick, checked at end of tick (note 10.2 precedence) |
| BYP-02 closed interval re-credited at H and kept a max-min share | critical | The closed flow leaves both allocation domains; credit and energy invariants added |
| ARITH-01 DC band edge exactly at H marked INVALID | major | No new interval opens at H; phase 6 reports open intervals only |
| BND-02, ARITH-02, BYP-05, DL-RT-01 engine guard dropped; UI showed "Guard: Not available" | major | `ledger_guards` travels from the job to `verifyDepotRun({claimedGuard})`; `envelope.ledger.guard` and `digests.prefix` are filled |
| BND-03, COPY-01, DL-RT-02 shared or imported preset name narrated a different setup | major | The name is kept only when the scenario digests equal that preset's |
| ARITH-03 summary printed mJ under a kWh label | major | One unit map: mJ with kWh, bytes with GB, s, visits |
| COPY-03 Overview hid deadline status and exact ticks | major | Release-by status, plus exact seconds beside every release-by and release time in both levels |
| A11Y-01 port and staff refusals not associated or announced | major | `aria-describedby` on the pressed control; announced through the static `#error` role=alert |
| BYP-04, ARITH-06 INCOMPLETE and CANCELLED prefixes never replayed | minor (BYP-04 major in review) | Semantic prefix replay; CANCELLED replays whole ticks; guard claims are checked against the prefix |
| BYP-06 non-canonical chunk encodings verified | minor (major in review) | Only the writer's greedy, parallel chunking verifies; the measured bound applies to every vector record |
| BYP-07 PAUSE order in a group unchecked | minor | Strictly ascending task id |
| ARITH-07 owned fraction never computed; UI divided by H | minor | Per-unit `owned_fraction` and per-class `owned_summary` over installed, enabled and eligible unit time |
| COPY-02 static "no visit has a specialist fault" | minor (major in review) | Statement derived from the shown setup |
| COPY-04 narrative claimed each difference changed the outcome | minor (major in review) | "The candidate's declared changes, taken together, changed these outcomes…" beside the bundled caveat |
| TRUST-01 summary said "Status: verified" | minor | Registry label and definition, plus separate trust axes |
| DL-RT-06 link refusal offered an export that would also be refused | minor | Export is offered only when it would be accepted |
| DL-RT-07 `#share=` read only at load | minor | A same-tab navigation to a different fragment opens it; it never runs |
| BND-06 note: the blockage record's lowest direct holder was called "terminal holder" | minor (raised by the BND-06 skeptic) | Now reads "lowest direct holder …, which may itself be waiting"; "terminal holder" is kept for the end of the trail |

### New problems from the verification rounds

Confirmed and fixed:

| Id | Fix |
|---|---|
| NP-1 last tick of a prefix skipped; then an omitted phase-0 completion below a recorded one | CANCELLED replays whole ticks and records at H are refused. INCOMPLETE replays up to the refused step, and the omitted completion is MISSING_COMPLETION |
| FD-02 guard claims not tied to the replay | MICROSTEP_LIMIT is refused. SUB_QUANTUM, VECTOR_LIMIT and BLOCKAGE RECORD_BYTES must match the verifier's own replay; RATIONAL_GUARD must carry a rational.js message |
| BYP-06-R1 over-full chunk within real bytes but over the writer measure | Measured bound on every vector record |
| FD-01 missing-completion precedence; same-tick PAUSE threw | Deferred end-of-tick check; OVERLAP_VIOLATION |
| FDR2-01 null last record threw | Returns TERMINAL_STATUS_MISMATCH |
| SS-NEW-01 "Edited since loading" caveat keyed to a generation counter | Content-based caveat |
| SS-NEW-03, FD-03 Back after the skip link reopened the share and dropped edits | A return to the fragment already opened keeps the draft and result |
| SS-NEW-04 preset naming revalidated on every open | Memoized digests |
| CA-NEW-01 corrected field left its refusal in `#error` | Restored or hidden |
| CA-NEW-02 exact ticks conditional in Overview | Always shown (A30) |
| ARITH-07-N1 enabled port on a disabled position read "Not applicable" | "Out of service because position … is out of service" |
| NP-5, FD-04 note out of date for the new interface | Note §§4, 8.9, 10.1, 10.2, 10.5, 13 and 14 amended; §22 added |

Refuted, but changed anyway as hardening:

| Id | Change |
|---|---|
| FDR2-02 a completion owed at H reported after the horizon digest (still INVALID) | It now reports first |
| NP-4 prefix digest serialised the ledger twice | `Htext` over the canonical text already held, byte-identical |
| SS-NEW-02 Build your own survived an import of exact B (pre-existing) | External draft changes end own mode |

Refuted and left as is:

- **NP-2, NP-3:** forged guard claims and an unchecked worker `envelope.ledger.guard` are not reachable from engine output or a visitor; FD-02 later tightened the claims.
- **NP-6, AF-01:** ledgers written with lowered chunk overrides verify as CHUNK_GROUP_INVALID by design. A test pins this and §22 records it.
- **AF-02:** prefix verification costs more because the replay is required; it is measured in §6.
- **ARITH-03-N1:** "1 visits" stays, because `visits` is the declared unit.

### Refuted, with reason

| Finding | Why it is not a defect |
|---|---|
| BND-01 compare on incompatible envelopes | Reachable only by calling `compareDepotRuns` directly; the shipped path checks compatibility before any run |
| BND-04 verifier shares the compiled task DAG | `task-graph.js` is on the contract side (reconciliation §11.3); allocation, eligibility and policy are re-derived |
| BND-05 run digest binds version labels, not source revision | Decided in BD-04: a static module cannot embed its own commit, so exact source binding lives in the release sidecar (source commit and tree, and a per-file SHA-256 of every engine and verifier module) |
| BND-06 UI formats aggregates | Reconciliation §11.2 forbids allocators, eligibility, verifiers, classifiers and causal narrators, and the UI has none of them. The related wording issue is fixed above |
| ARITH-04 tight sets list saturated resources | D1-05 asks for exact active-constraint sets, so every zero-residual path resource is listed, not only the binding one |
| ARITH-05 sub-quantum guard and anchor reports only at interval changes | Annex C2.1, read literally, asks for a report and a guard check at unrelated intermediate events. Note §8.6 and §19 record two narrowings as builder decisions: an unchanged flow keeps its anchor with no record, and the sub-quantum guard is checked when an interval opens. Kept and listed for the release review (§9) |
| BYP-03 huge-denominator rates become INCOMPLETE | Annex C1 and C2.1: exceeding the 8,192-bit bound returns INCOMPLETE_RESOURCE_LIMIT in the engine or the verifier, never rounding; no projection is produced |
| COPY-05 "at least < 1 min" | Acceptable as written; it now reads in exact seconds anyway |
| COPY-06 heading "What the evidence shows" | NOT_EVIDENCE concerns real-world safety; the heading is about this model run |
| A11Y-02 "-15 min" buttons named "Back 15 minutes" | WCAG 2.5.3 requires the name to contain the visible text. "15 min" is contained in "Back 15 minutes" under an approximation of axe-core's normalisation; axe itself was not run |
| SHARE-01, DL-RT-04 pair links refused | The frozen 32,768-character limit, disclosed, with file export offered |
| PKG-01 sub-allocations without production gates | Reconciliation §7.2 keeps the existing ceilings as the gates and labels the split a planning allocation; the split is measured in §5 |
| PKG-02 depot test source over the 262,144 forecast | A forecast, not a cap; tests are not shipped and are not in the source offer (§5) |
| DL-RT-03 shared run-digest claims not surfaced for a baseline-only rerun | A41 compares a claim on the arms that rerun; a baseline-only run keeps the pair claim for a later pair run and never re-exports it |
| DL-RT-05 site-wide CSP allows Google for the depot page | The page carries no tag and its meta CSP excludes Google; the release review must confirm the exclusion (BD-17) |

Documented residuals (note §22):

1. The refused step of a count, byte or rational guard is never in the ledger (C1.5). Such a claim on a relabelled honest prefix is checked for consistency, not reproduced.
2. Apart from the phase-0 completion rule, the verifier cannot tell whether an INCOMPLETE cut tick was complete, so that tick's remaining end-of-tick checks are skipped.

Both residuals can only withhold results; neither can produce a projection.

## 5. Budgets

Before: the source-bound release at `d0df87f` (reconciliation §7.1). After: the source-bound build at `a1b79cd`, whose teaching receipt reports `BOUND_FILES_MATCH_COMMIT`.

| Surface | Before | After | Growth / allowance | Ceiling | Headroom |
|---|---:|---:|---:|---:|---:|
| Depot-owned emitted text (integrated; teaching 417,756) | 0 | 418,159 | — | 524,288 | 106,129 |
| Depot runtime raw source | 0 | 401,398 | — | 524,288 | 122,890 |
| Depot closure (integrated; teaching 437,479) | 0 | 513,471 | — | 786,432 | 272,961 |
| Final integrated emitted text | 3,144,138 | 3,569,285 | +425,147 / 655,360 | 3,801,088 | 231,803 |
| Raw teaching source and tools | 3,144,246 | 3,553,269 | +409,023 / 786,432 | 3,940,352 | 387,083 |
| Package metadata | 37,702 | 44,361 | +6,659 / 16,384 | 57,344 | 12,983 |
| Extracted source offer | 3,659,865 | 4,079,740 | +419,875 / 1,048,576 | 5,242,880 | 1,163,140 |
| Compressed source offer | 1,010,066 | 1,147,687 | +137,621 / 393,216 | 4,194,304 | 3,046,617 |
| Final non-City generation | 15,624,676 | 16,187,444 | +562,768 / 1,048,576 | 17,825,792 | 1,638,348 |
| Legacy teaching text | 2,605,087 | 2,605,087 | 0 / 4,096 | 2,621,440 | 16,353 |
| Final NF03 closure | 537,633 | 537,633 | 0 (bound 541,729) | 557,056 | 19,423 |
| Offline edition | 2,565,111 | 2,565,111 | 0; SHA-256 `313fa3f1…f58fa1` unchanged | 2,571,440 | 6,329 |
| `_headers` | 2,110 | 2,110 | No edits; only the per-release source-archive path line differs | — | — |
| Media (`enhancement-media` 7, `diagrams` 4, `site-media` 11, `tiles` 19, `media` 2) | 43 files | 43 files, byte-identical | 0 bytes / 0 files | unchanged | unchanged |

Raw-source planning split (reconciliation §7.2):

| Allocation | Measured | Limit | Free |
|---|---:|---:|---:|
| Domain and contracts | 99,260 | 131,072 | 31,812 |
| Independent verifier | 101,915 | 131,072 | 29,157 |
| Registry, configurations and runtime data | 64,560 | 65,536 | 976 |
| Presentation and accessibility (UI JavaScript, page, CSS) | 113,736 | 131,072 | 17,336 |
| Worker and session | 21,927 | 65,536 | 43,609 |
| **Runtime subtotal** | **401,398** | **524,288** | **122,890** |
| Packaging tools growth | 7,625 | 65,536 | 57,911 |
| Integration and link source growth | 4,639 | 32,768 | 28,129 |

The registry allocation is nearly full, with 976 bytes free. Further registry rows need a trim or an owner reallocation.

Depot test source is 512,293 bytes in 33 files (31 tests and 2 helpers), above the 262,144-byte forecast. Tests are not shipped. The source offer holds 219 teaching files and 57 integration source files (plus the license and validation policy), and none is a test. So the overrun consumes no ceiling.

Dependency ownership: 31 explicit depot modules, plus the shared leaves `core/sha256.js`, `core/canon.js`, `model/depot-flow-contract.js` and `ui/dom.js`. The shared leaves keep their owners and count in the depot closure. A depot dependency outside `DEPOT_MODULES` that no other route owns fails closed in the package check.

## 6. Runtime guards, performance and memory

Guards are the contract bounds plus two others:

- 100,000 records;
- 33,554,432 ledger bytes;
- 16,384 bytes per record;
- 64 vector entries;
- the rational guard (8,192 bits);
- the sub-quantum guard.

Measured at `8e48be6` with Node 22.23.4 on an Apple M4 Pro (14 cores, 64 GB). The engine and verifier are unchanged in `a1b79cd`, which changes one inspector string. Values are medians of 5 runs, with the maximum after the slash.

"Engine peak" is the heap peak sampled while the engine steps. "Arm heap" is the whole-arm Node heap delta, from a gc() baseline through serialisation, parsing and verification, garbage included. For the two `runDepotJob` rows the peak is the whole-job peak.

| Case | Engine | Verify | Total | Records | Ledger bytes | Engine peak / arm heap | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| B baseline | 20 / 21 ms | 79 / 79 ms | 111 / 111 ms | 2,581 | 1,221,035 | 9.0 / 28.7 MB | VERIFIED |
| B candidate | 18 / 20 ms | 75 / 77 ms | 104 / 109 ms | 2,602 | 1,229,610 | 15.6 / 35.1 MB | VERIFIED |
| B pair through `runDepotJob` | — | — | 215 / 220 ms | — | 2,450,645 | job peak 29.8 MB | VERIFIED / VERIFIED, improvement |
| S200 baseline | 204 / 220 ms | 1,339 / 1,346 ms | 1,693 / 1,714 ms | 17,506 | 15,067,724 | 37.7 / 243.6 MB | VERIFIED |
| S200 through `runDepotJob` | — | — | 1,723 / 1,738 ms | — | 15,067,724 | job peak 254.7 MB | VERIFIED |
| 200 at once into 100 waiting positions | 157 / 170 ms | 1,999 / 2,020 ms | 2,272 / 2,282 ms | 7,278 | 10,772,648 | 33.0 / 179.6 MB | VERIFIED |
| S200 with pool and client at 300 Mbps | 414 / 884 ms | 1,503 / 1,894 ms | 2,271 / 3,421 ms | 12,198 | 33,527,586 | 55.7 / 291.2 MB | INCOMPLETE_RESOURCE_LIMIT (LEDGER_BYTES) |

S200 releases 149 of 200 visits. Its 17,506 records and 15,067,724 bytes are measured values; the withdrawn 44,720 / 15.6 MiB bound is not asserted.

The 300 Mbps case is a real refusal, reachable from the UI. Its 33,584,273-byte claim exceeds the 33,554,432 cap, so it ends INCOMPLETE_RESOURCE_LIMIT with the guard named, a prefix digest and no numbers. Verifying it takes about 1.5 s because the prefix is replayed (§4).

In the session, cancel reaches the fake worker's terminate in 0.2 µs median, with an 11.3 µs maximum over 200 samples.

In the browser (Claude desktop Chromium pane, loopback stage at `8e48be6`):

| Measurement | Value |
|---|---:|
| B pair | 227 ms |
| S200 baseline | 1,483 ms |
| Main-thread heap after S200 (worker heap not observable from the page) | 52 MB |
| Cancel handler | 2.8 ms |

These are against 237 ms and 1,498 ms at `3dedf67`.

Limitations: one machine; Node heap figures are process deltas, not browser heap; no low-end device was measured.

## 7. Local review URLs and browser evidence

Stage: `dist/fleetlab-depot-lab-20261024-a1b79cd/stage/site`, in a clean detached worktree at `a1b79cd`. Serve it locally with `python3 -m http.server <port> --bind 127.0.0.1`. That server ignores `_headers`, so the page's meta CSP applies.

- `http://127.0.0.1:<port>/depot-readiness/`: the lab.
- `http://127.0.0.1:<port>/network-flows/`: the hub, with five journey stops plus "Deeper experiment, outside the five questions: What holds a car in the depot? →".

Digests at `a1b79cd`:

| Artifact | SHA-256 |
|---|---|
| Teaching receipt | `2343b43deb49af878082c275c413738fc4069a16fe5c1c937aa75e5aa9b437ea` |
| Depot sidecar | `906561243d3fc8c9cc29dfad9bc2ef1372f76dc1ac6d69f516f9de94f1d3fdd5` |
| Integration manifest | `69a5467a41f89d05e2e7de446e2a64763dbbab0d8d2daeec0156abe6649b6461` |
| Source offer | `026891364a1bc1615c544bdf22317b4d0e953f38b5d74c3d27672a6d1d69e472` |

The browser pass ran on the `8e48be6` stage, on port 4193. `a1b79cd` differs from it only in the blockage-record wording, which the inspector test covers. Findings:

- **390 × 844:** no horizontal overflow (scrollWidth 390 equals clientWidth). The 2 px preset-row overflow found at `3dedf67` is fixed.
- **Direct load:** idle draft, no console messages, no request outside the loopback origin. The depot page has no Google tag, a hosting-only privacy line, and the three honesty strings verbatim.
- **SOC 19:** sets `aria-invalid` and shows the field message. The static alert announces "Target battery SOC for depot release (default 80%): Enter a whole number from 20 to 100." Re-entering 80 clears it.
- **Run comparison:** "Internally consistent. The independent verifier found the run internally consistent; not authenticated or authorized."
  - Vehicle 23 in Overview: release-by 41,400 s; released 42,908 s; "Late by 25 min (1,508 s)".
  - Port DC01: share 70.9…% (3067/4320 exact), plus the per-class table over installed, enabled and eligible unit time.
- **Copy summary:** separate status and trust lines, units on every component, and the honesty strings.
- **Share links:**
  - The S200 link is refused with the export offer.
  - A same-tab `#share=` opens without running (0 workers), and a mismatched preset name is dropped.
  - Edit, skip link, then Back keeps the edit; a different fragment opens.
  - A baseline run of the opened setup verifies.
- **Technical tab:** activates with `aria-selected`.
- **1280 × 900:** schematic and inspector side by side.
- **Earlier pass at `3dedf67`:** arrow keys move tab focus without activating, and Enter activates. 36 outcome rows are identical across reading levels. Replay moves only on press, the hosted Pause stops it, and `data-motion=reduce` stops a running replay. Stale results read "From an older draft". The share digest reproduces, and a mutated claim reads "Could not reproduce".

## 8. Preserved surfaces

- **Home and hero:** A2 stays the Fleet day hero. `index.html`, `enhancement-media.mjs`, `enhancement-media.css` and `enhancement-motion.mjs` are byte-identical to the live-release stage.
- **V1:** stays held; the stage holds no V1 file.
- **Media:** none added, and all 43 media files are byte-identical.
- **Offline edition:** byte-identical (2,565,111 bytes, `313fa3f1…`).
- **`_headers`:** no edits; only the per-release source-archive path differs.
- **City rollback:** release `0bdffbfcff0e1bf9` is byte-identical.
- **City current payload:** 4,944 of 4,945 files are byte-identical, and only its `release.json` binding (source commit) differs. That binding gives the current City release a new id, `7542098a7b06ac1b`, replacing `40dcf835e0dc635b`. `city-explorer/index.html` and the switch module change to point at it, exactly as at every release.
- **Integration manifest:** its 33 modified-existing entries match the live release except `_headers`, and its 66 preserved entries are unchanged.
- **Network flows hub:** keeps its five stops.
- **Other routes:** model identities are unchanged. Each of the five other route sidecars (capacity, delivery-order, dispatch, rebalancing, software-delivery) re-binds the source commit and tree. Each also records new fingerprints for the three packaging tools this build changed (`check-dist.mjs`, `pack.mjs`, `software-delivery-package.mjs`), so each gets a new release digest. Their emitted route files are unchanged.
- **Supplied inputs:** all 17 match the SHA-256 values recorded at task start:
  - the historical depot documents;
  - the Muse proposal, the mockup and the three concept images;
  - the older `depot-readiness.js`;
  - the four pre-existing edited documents.

## 9. Remaining risks and readiness

Readiness: **published without the separate release review, at the owner's instruction (§10).** Every ceiling has headroom, every gate in §3 passes on the committed tree, and every confirmed review finding is fixed or explicitly dispositioned. The items below were written for a release reviewer; they now apply to the live site and remain open for the owner, Muse's live audit and Codex's review.

1. **Analytics exclusion.** Confirm the depot page's analytics exclusion (BD-17). Any narrowing of the CSP header for `/depot-readiness/` would have to change the `/*` baseline policy, under release authority. A restricting path-specific `_headers` block is not an option: the codebase forbids relying on path rules to restrict, because Pages matches raw paths. Reconciliation Task 10 also keeps `_headers` unchanged.
2. **Pair links.** Decide whether refusing pair links is acceptable for launch, or whether the 32,768-character transport limit should change later.
3. **Registry allocation.** Only 976 bytes are free.
4. **Guard claims.** Guard claims are checked for consistency, not reproduced (both residuals in §4).
5. **Untested.** The screen-reader, OS reduced-motion and physical-device passes have not been done.
6. **ARITH-05 decisions.** Confirm the two recorded decisions against the literal annex C2.1 wording:
   - an unchanged flow keeps its anchor through unrelated events, with no record;
   - the sub-quantum guard is checked when an interval opens.
7. **Release records.** Done after publication (§10).

## 10. Publication, 2026-10-24

On 2026-10-24 the owner said "just deploy live", so that Muse can audit the live site. The owner ran both uploads in their own Terminal through `apps/fleetlab-city/deploy/wrangler.mjs`. The token came from an owner-side Keychain injector, and the owner typed the production confirmation. No credential passed through the agent session. No GitHub push or pull request was made. (Added 2026-10-25: the branch was pushed on 2026-10-24 at `f1d130e`, and the reconcile pull request from `codex/fleetlab-main-reconcile` brings it to `main`.)

| Step | Result |
|---|---|
| Release candidate | Source `a1b79cd137aa802c2bff1459843f550a5d70da83`, from the clean detached worktree at that commit. The wrapper's stage check and preflight passed; the package holds 10,187 files and 1,629,563,452 bytes |
| Preview `241a9eec` (branch `codex-city-explorer`) | Full byte readback 10,186 / 10,186 served files; 100 / 100 header checks. Browser checks: the lab ran and verified under the real CSP (B pair, 713 ms), with no console errors, no outside requests and no analytics tag. At 390 px, no overflow. The hub has five stops plus the link. Fleet day shows A2 and no V1 |
| Production `72e45e9f` at <https://fleetlab.pages.dev> | Full byte readback 10,186 / 10,186; 100 / 100 header checks on the stable host and again on the immutable host; immutable six-path smoke 6 / 6. Live `publication.json` names source `a1b79cd`. The live lab verifies the B pair (445 ms) with no console errors or outside requests |
| Records | Full receipt `production-receipt.json` (SHA-256 `05c586fe…`) in the ignored `dist/` of the `a1b79cd` worktree. The compact record `docs/releases/fleetlab-current.json` carries a 128-path smoke subset, which matched the live site 128 / 128 |
| Rollback | Whole site: the previous production `85b02be2` (source `d0df87f`, the October 23 enhancement release), owner-operated from Cloudflare's Deployments page. City only: `0bdffbfcff0e1bf9`, staged in the package. Neither was rehearsed |

Notes for the next release:

- **Node version.** The wrapper refuses Node older than 22.23.4, and the machine's default `node` was 22.22.0. The pinned runtime is in the ignored `build/fleetlab-city/toolchain` of the main `Hermes-fleetlab` checkout, so call it by absolute path from a release worktree.
- **Account ID.** A Pages-scoped token cannot read `/memberships` (Cloudflare answered 403), so Wrangler cannot discover the account. Supply `CLOUDFLARE_ACCOUNT_ID`, which is not secret.
- **Uploader audit.** The uploader's install reported three vulnerabilities (2 moderate, 1 high), the same counts as the October 23 audit. No new audit log was taken, so it is not established that they are the same advisories. They affect the local upload tool, not visitor code.
