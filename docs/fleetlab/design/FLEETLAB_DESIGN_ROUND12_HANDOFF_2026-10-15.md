# FleetLab Round 12 handoff — October 15, 2026

## Scope and status

**Status: implemented, tested, pushed, and published.** Source brief: `FLEETLAB_DESIGN_ROUND12_UNDERSTANDING_2026-10-15.md`, P1 only. Three presentation explainers, not new simulations, lessons, numerical studies, or evidence. P2 remains queued; every budget ceiling is unchanged. Existing animations, results, public field notes, and owner biography remain.

Baseline: branch `codex/fleetlab-city-sf`, repository HEAD `5d4136b`; prior live runtime `84ebba53ec0c131c32ed9683c548d67eed4c918f`, immutable production `https://185e946f.fleetlab.pages.dev`.

Final runtime source: `4c375a8b96595a82b82169234b968d7da38ea990`, pushed to `github/codex/fleetlab-city-sf`. The founder selector correction follows the explainer and serif implementation commits. The final hosted preview is `https://619f3e91.fleetlab.pages.dev`: 10,139/10,139 served-file matches and 73/73 hosting-header checks. Intermediate previews `baab2719` (before typography) and `89435fb1` (before the founder selector correction) also passed their checks but were never promoted to production. Their receipts are preserved separately.

## Item-by-item report

| Item | Status | Delivery / boundary |
|---|---|---|
| P1-1 / E1 paired seeds | Done — published and verified | Same-seed chip feeds two matching lanes; San Francisco supply changes 40→52 and +12 appears. Walkthrough chapter 3, “One world, two arms,” and Four-area experiments, including deep-linked lessons. |
| P1-1 / E2 guardrails | Done — published and verified | Primary bar grows; 39 min crosses a 30 min rail, turns red, and HOLD enters with a wash. Walkthrough verdict and Fleet-day teaching section, outside accepted-result readouts. |
| P1-1 / E3 deadhead | Done — published and verified | Ten equal-distance circuits, first four and half of the fifth empty; counters settle at 45/100 = 45%. Rebalancing hero, next to the separate public-reporting note. |
| P1-2 / typography | Done — published and verified | Owner chose serif display headlines. Georgia / Times New Roman is the shared display family; body, controls, data, and HTML wordmark retain sans-serif. |

Could not implement as written: none after the owner supplied the typography decision. The prototype HTML files were not provided in the repository; the written §2 choreography governs and was rebuilt as SVG/JS, without importing prototype code.

Invented model inputs, observations, scientific results, or owner claims: none. The permitted illustration uses a declared ten-unit scale per circuit, fixed presentation geometry, and animation timing; these are visual conventions, not simulated trips or new evidence.

## Meaning and provenance

Each panel visibly says **“Illustration · not simulation output.”** Static HTML captions and numerical explanations sit beside the animation and remain available without replay. All animated SVG content is hidden from assistive technology; the adjacent text is the equivalent. Status uses native `role="status"` semantics.

- E1’s 40→52 setting is the existing OPS-01 San Francisco supply change. Its exact requested slogan is followed by the narrower explanation: matching workload/travel draws, one supply change, pairing reduces noise without removing uncertainty. It does not claim all scenario inputs remain identical after changing supply.
- E2’s −26 min denotes an illustrative, rounded **mean change in wait p90**, not an average rider’s time saved. The published OPS-01 seed-set-1 pin contains approximately −26.1 min primary change, +39.4 min SF-2 bay-wait-p90 harm, and a 30 min allowance. The panel is explicitly an illustration, not the current run. Validity comes first; an improved primary result cannot override a breached predeclared guardrail. An invalid current result remains invalid beside this teaching example.
- E3’s 45% is illustrative distance, not a trip fraction, Waymo replay, or R1 result. Four complete empty circuits plus half a fifth produce 45 empty units out of 100 total. The exact requested tagline is accompanied by the model’s trade-off: better rider coverage may require more empty travel. The existing public-reporting field note retains its own separate label and sources.

No model/runtime imports exist in the explainer module. Replay does not dispatch a simulation or modify a study, verdict, snapshot clock, record, or evidence digest. R1 retains its existing startup reconstruction; Replay adds no worker message.

## Motion and accessibility

Initial state is the complete static illustration. Replay is an explicit user gesture. E1/E2 last 1.8 seconds; E3 has ten 1.6-second circuits, one 16-second sequence, rather than an endless loop. The circuit is the <2-second core loop required by the brief.

Pause/Resume uses the same local presentation clock. The site-wide motion pause stops active illustrations; resuming site motion does not automatically resume them. Reduced-motion preference or the existing application override immediately shows the final frame. Hiding the document, hiding/removing the route, navigation, and completion cancel frames and release active observers/listeners. Static text remains visible. Paused detached components release their observers as well.

The HOLD entrance/wash uses that same presentation progress, so it cannot continue independently after Pause. There are no libraries or additional media assets.

## Packaging and trim

The module is captured by root and R1 static import graphs, included in the copy scan and source offer, and excluded from NF-03’s JavaScript closure. CSS lives in the existing teaching stylesheet and R1 stylesheet; both copies are counted and tested for exact equality.

Formatting-only trims preserve exact lexical tokens, automatic-semicolon-insertion boundaries, and comments:

| Area | Before | After | Recovered |
|---|---:|---:|---:|
| `src/ui/depot-capacity-page.js` | 39,998 | 38,820 | 1,178 bytes |
| `src/ui/depot-capacity-view.js` | 15,936 | 15,530 | 406 bytes |
| Total | 55,934 | 54,350 | **1,584 bytes** |

The exact requested E1 sentence receives a narrow punctuation exception beside existing approved rewrite exceptions. All claim checks remain active. An unnecessary explicit `aria-live` attribute initially triggered the string-based copy scanner; removing it retains the implicit polite announcement of `role="status"` without a broad scanner exemption.

| Final integrated release measurement | Bytes | Unchanged ceiling | Headroom |
|---|---:|---:|---:|
| Original teaching source + tools | 3,140,931 | 3,153,920 | 12,989 |
| Offline edition | 2,564,068 | 2,571,440 | 7,372 |
| Package metadata | 37,684 | 40,960 | 3,276 |
| Integrated emitted text | 3,115,617 | 3,145,728 | 30,111 |
| Integrated NF-03 dependency closure | 523,841 | 524,288 | **447** |

The final combined build passes all source, offline, metadata, ownership, and closure gates. Its source-bound upload guard verifies **10,140 files** (10,139 served files plus hosting headers). `final-budget.json` contains the complete counters; no byte ceiling changed. The format-only trim offset source growth before adding the shared CSS. The two new test files total **14,474 bytes**, outside the original-source budget and separately reviewable. The final R1 integrated closure is 177,369 bytes. NF-03’s remaining 447 bytes requires trimming or an explicit future owner decision before further shared growth.


## Validation

Local evidence: `build/fleetlab-city/validation/design-round12-20261015/`.

- Full teaching suite: 2,433 pass, 8 existing skips, 1 existing TODO. Across teaching, hosted, City, and Hermes suites: **4,547 passing tests**. The final selector-only correction additionally passed 6 integration and 23 hosted focused checks; these are reruns, not added to the unique total.
- Hosted suite: 108 pass.
- City Python suite: 345 pass.
- Hermes: 1,661 pass, 56 existing skips.
- Ruff passes. Doctor: 17 PASS, 1 dirty-working-tree WARN, 1 optional NOT_AVAILABLE. `git diff --check` passes.
- New behavior coverage: paired progression, guardrail crossing, distance accounting, no autoplay, local/global pause, mid-flight reduced motion, hidden/detached/navigation cleanup; five placements; experiment deep links; invalid-result separation; no Replay-triggered compute; source ownership and matching styles.
- Desktop and 390×844 phone visual inspection of all three diagrams. Walkthrough Prepare, arms placement, verdict placement, and existing reduced-motion On control checked in the browser. Illustrations do not affect current-run values.
- Timestamped CUA screen captures encoded as video on immutable production: `paired-full-production.mp4` (11 frames / 3.058 s), `guardrails-native-production.mp4` (11 frames / 3.105 s), and `deadhead-full-production.mp4` (57 frames / 17.074 s). Native Replay clicks preserve full-panel framing; earlier locator-click takes auto-scrolled and are retained but excluded from full-panel evidence. Frame timing is observed, with no generated or interpolated frames. Reviewed intermediate frames show the parameter flip, guardrail crossing/HOLD, and hollow-to-filled car progression. Local recordings supplement these. `round12-live.png` and `serif-explainer-phone-production.png` show final display type. No console errors were observed in the final production browser pass.
- Initial negative results are retained in `teaching-tests-first.log`, `hosted-tests-first.log`, and `ruff-first.log`. Failures were the redundant accessibility attribute copy-scan conflict and one long Python inventory line; both corrected. A subsequent typography regression check rejected a third light `:root` block; the display token was moved into the existing palette roots and the focused accessibility/integration tests pass. The negative run is retained as `teaching-tests-typography-first.log`; the complete teaching suite subsequently passes. `wash-red.log` and `wash-tests.log` retain the staged-wash regression and correction. The independent release review caught one selector mismatch: founder/contact sections render IDs, so their display selectors were corrected from classes to IDs at no byte cost. Focused integration/hosted tests pass, and browser computed styles confirm serif founder/contact headings with sans body copy. No model changes resulted.

## Publication and rollback

- Live site: https://fleetlab.pages.dev/
- **Use this immutable URL for design review:** https://2fe5a724.fleetlab.pages.dev/#/experiments
- Runtime source: `4c375a8b96595a82b82169234b968d7da38ea990`.
- Production deployment: `2fe5a724-6818-4d9f-afa3-b787ef140c21`.
- Final preview: `619f3e91-1662-4a44-b6da-20696c20a7ff`.
- City presentation generation: `city-explorer/releases/24bb784975e88664`; scientific base remains `c56bda6b509105c5`.
- Stable production full readback: **10,139/10,139**; preview full readback: **10,139/10,139**; headers: **73/73** each.
- Immutable production smoke: **103/103**; the finalized receipt was independently exercised against the stable site, also **103/103**. Previous production `185e946f` remains available and its rollback smoke passed **102/102**.
- Receipt: `docs/releases/fleetlab-current.json`, including source, deployment, manifest/sidecar digests, path-to-expectation smoke inventory, and verification digests.
- All final hosting checks passed on their initial attempt. Intermediate previews were superseded for the approved typography and selector correction, not promoted.

Byte readback proves consistency with the built files and observed hosting at check time. It does not establish independent authenticity, browser-session generation pinning, real-world safety, or operational deployment authority. Stable-URL assets may be cached; reviewers should use the immutable URL above.

Actual final release commands (run from this repository except Wrangler, which used the clean tool-managed checkout of the same runtime commit):

```sh
zsh build/fleetlab-city/validation/design-round12-20261015/build-release.sh
node --test playground/fleetlab/test/round12-integration.test.mjs
node --test apps/fleetlab-city/test/hosted-brand.test.mjs apps/fleetlab-city/test/visitor-design.test.mjs
node apps/fleetlab-city/deploy/wrangler.mjs pages deploy /private/tmp/fleetlab-design-round12-20261015-release/integrated-release/site --project-name fleetlab --branch codex-city-explorer
node apps/fleetlab-city/deploy/wrangler.mjs pages deploy /private/tmp/fleetlab-design-round12-20261015-release/integrated-release/site --project-name fleetlab --branch feat/fleetlab-playground
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/readback.py --url https://fleetlab.pages.dev --site /private/tmp/fleetlab-design-round12-20261015-release/integrated-release/site --output build/fleetlab-city/validation/design-round12-20261015/production-readback.json
```

The validation directory preserves exact logs, budget counters, recordings, intermediate receipts, and browser observations. Generated files are not staged into Git. Owner-supplied untracked assets and documents are preserved.

## Typography decision and queued work

The owner explicitly chose “Unify display headlines on the existing serif; keep body text and data sans-serif.” Before this change, there was no shared display token: teaching/standalone lab headlines used sans and City Explorer used Georgia. The release introduces `--font-display` with Georgia, Times New Roman, serif in teaching and hosted presentation styles. It applies to page h1s, introductory/editorial section headlines, methodology panel titles, and rebalancing/dispatch chapter titles. Data-panel/table headings, body prose, SVG labels, controls, numerals, and the HTML wordmark retain their sans families. No font download or dependency is added. This was more than flipping a pre-existing token, so the cross-surface selectors are explicit and bounded.

P2 remains deferred: paired dot plot, pause-pill restyle, world strip, founder video, replay preview, mobile control collapse, sources audit, atlas overlay, limits strip, model-lab arrow, and D-06. No public copy describes the owner as seeking a role.

## Recommendation, risks, and next actions

Recommendation: use the shipped immutable release for the next design evaluation; keep P2 as a separately scoped round.

Top risks and mitigations: illustrative figures mistaken for evidence (visible labels, adjacent static qualifications, separate regions); motion left running (gesture-only start and lifecycle tests); package growth (explicit ownership, whitespace trim, unchanged gates); stale-alias review (immutable release URL and full readback).

Next 3 actions: review the three explainers on the immutable URL; collect feedback on understanding and typography; choose any next P2 scope with its source-budget plan before implementation.
