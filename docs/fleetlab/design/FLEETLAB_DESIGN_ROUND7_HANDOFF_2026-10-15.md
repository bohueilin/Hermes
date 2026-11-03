# FleetLab Round 7 implementation handoff — October 15, 2026

## Scope and decision

P0 + P1 from the October 15 Round 7 audit. P2 remains deferred. No new lessons, model logic, numerical fixtures, studies, or budget increases. The user explicitly approved concept-only artwork motion for the hero examples that conflict with the models. Existing overview animation and all lessons remain.

Baseline: `f569a66d77dcf2efa655d313f398532997ca8409` (previous runtime `ebc46c8cf0f61e13c27ef6b5b669b6b853b1e68d`). Branch: `codex/fleetlab-city-sf`. Publication uses the standing website push/live authorization; it grants no operational AV authority.

## Item-by-item decisions

| Item | Status | Implementation and evidence |
|---|---|---|
| P0-1 releases directory | Done | Added a source-bound HTML redirect at `/city-explorer/releases/` to the stable city entry, which selects the current release. Fallback link and future-release note included. Independent package/upload verifiers reproduce its exact source bytes; tampering is rejected. |
| P0-2 direct offline URL | Done: verified existing behavior | A direct GET before edits returned the offline file and matched its published SHA-256 (`ef6ef64176624a043118b803e550f5ab38cbe023eb17dfb791c2ba7b943f2a6b`). The reported 404 was not reproduced. No invented routing repair. Final live GET is checked again for the new artifact. |
| P0-3 four-count bar | Done: verified and reused | Before edits the live bar existed above Result summary: 77 completed / 199 unserved / 4 waiting / 4 in progress = 284. Moved its existing renderer into the focused Result summary; kept the definitions above. Did not build a second partition calculation. |
| P1-1 walkthrough | Done | Four chapter cards, eleven accessible numbered steps, finale linking to Explore, actual-area/depot spotlight, verdict reveal and plain-language metric definitions. Prepare status is prominent; leaving warns that reopening starts at beat one. Existing automatically opened inspector is placed below the story. User gesture remains required to prepare/play. All eleven phone steps checked without overflow or automatic playback. |
| P1-2 hero motion | Done with user-approved substitution; original numerical examples could not be implemented as written | All five named surfaces covered (audit says four): dispatch, rebalancing, software delivery, delivery order, capacity. Existing/supplied artwork receives a concept-only sheen, with explicit concept caption. No fabricated request timer, 12-vehicle software workload, 48-hour capacity study, result counters or automatic Gantt replay. Software model remains four vehicles; capacity remains 90 minutes. Existing rebalancing concept video keeps its player controls. Existing bounded lessons can reconstruct/check their declared default comparison on mount (observed on dispatch); Round 7 does not add, trigger or change that behavior. Fleet day and walkthrough execution, and all replay playback, retain their explicit controls. Thus the new ambient-motion guarantee is narrower than a claim that the entire pre-existing site performs zero computation on load. |
| P1-3 catalog | Done | Subtle rain, charger glow and artwork drift with hover treatment. Visual-only loops, offscreen pause, explicit Pause/Resume visual motion, OS and application reduced-motion support. No simulation starts. |
| P1-4 fleet-day delight | Done | Existing actual request partition animates on acceptance, with visible/accessible count parity. Stale results stay labeled and do not count up. Added a nonnumeric ghost bar and Run action. Legend supports focus/hover preview and click pinning, with unmatched cars dimmed in flat and 3D views. Conceptual fleet-cycle accents remain clearly untimed; selected-car work-cycle emphasis reads its actual current state. |
| P1-5 replay | Done; interpolation example could not be implemented as written | Moved the existing verified activity ribbon above its scrubber; retained the same interval buttons/listeners. Added a two-dot key explaining 15-second held positions and gaps. No new interpolated motion. Browser checked one ribbon, 21 intervals for selected trace, and a seek to 07:04:45 without starting playback. |
| P1-6 fleet-day small fixes | Done / unobserved defects retained as verification findings | Placeholder names all four outcomes. Accessible names track visible animated values, ending at the exact result. Existing landmark is “Every ride request at observation end”; “Completed request” and “Ninety-nine plus” were not reproduced, so no fictitious rename/fix is claimed. Map labels are inset and offset from pins; six-label tests cover placement. |

**Invented:** no model assumptions, numerical results or scientific claims. Presentation choices (sheen, numbered steps, focus spotlight, count-up easing and dot accents) implement the approved design scope. No full-screen auto-advancing story or automatic recall replay was added. Existing rail-scoped keyboard shortcuts remain; their scope was not silently expanded. P2 charts, atlas pins, new replay players and editorial rewrites remain deferred, as does D-06. The two rejected Round 6 rewrites remain excluded.

## Review and validation

One independent final read-only reviewer found two material issues: a pending run could mark the new bar fresh after settings changed, and the finale used an unavailable route. Both were reproduced with failing regressions, corrected, and the 59-test focused review suite passed. The stale regression targets the result bar, not the separate definitions region.

Full teaching suite: 2,416 passed, 8 skipped, 1 TODO, 0 failures (2,425 total). City Python: 345 tests passed using the established city virtual environment and unittest. Hermes: 1,661 passed, 56 skipped. Hosted Node: 99 passed. Ruff passes. Doctor: 17 PASS, one expected dirty-checkout WARN, one optional display NOT_AVAILABLE. Phone checks use a 390×844 browser viewport, not physical Pixel qualification. The existing SF qualification remains HOLD.

Negative checks are preserved in the validation folder: initial missing selectors/fixtures, an initial NF03 closure budget rejection, a source-capture test run overlapping an edit, a misplaced regression selector, city pytest attempts in environments lacking pytest/pyproj, two Python style violations, a private local path caught by the commit guard (removed from the public plan), and the integration builder rejecting four reviewed presentation files missing from its explicit allowlist. The allowlist was updated for those files with preservation tests; unrelated model files remain blocked. The first production attempt was blocked locally by Wrangler-generated cache in the release source directory; that cache was moved out without weakening the source guard. A later upload connection failure created no production deployment (confirmed against deployment list and stable release ID) before retrying the same frozen build. Fixed causes are distinguished from environment/setup failures; no test expectation was relaxed to accept unbound source or over-budget output.

## Source trim and limits

No ceiling raised. Removed 9,608 bytes of redundant walkthrough implementation commentary and 1,839 bytes of obsolete walkthrough CSS commentary before final small copy adjustments. Consolidated duplicate SVG creation and standard button helpers while preserving null/false attribute semantics. All runtime source stays in its original captured owners. Gross trim is not net release savings; final package measurements below account for the new presentation work. Test-tree growth and integration source are separate from the original-teaching-source counter.

## Release results

Runtime source commit: `8318e1d` (presentation implementation `bcf3d24`, inventory correction `95b123a`, then the selected-step contrast correction). Source-bound build and independent upload guard passed for **10,139 files**. Additional integration preservation tests: **33 passed**. GitHub runtime push completed. Final preview: `fafea3d4-fb01-4170-b005-19c8ee1d368c`. Final production: `9b401aed-b992-44be-aa43-f623267bef7c`, immutable URL https://9b401aed.fleetlab.pages.dev. Final preview readback: 10,138/10,138 files; preview and production headers: 71/71 each; immutable and stable smoke checks: 102/102 each. Final stable verification: **10,138/10,138 served files matched**, consisting of 10,137 first-pass matches plus one successful targeted retry of an HTTP 502 on an unchanged historical recording. The original scan and retry are preserved separately; the reconciled report records both hashes. This is per-file byte consistency, not an atomic browser-session guarantee.

| Final measured envelope | Bytes | Unchanged ceiling | Headroom |
|---|---:|---:|---:|
| Original teaching source and tools | 3,145,606 | 3,153,920 | 8,314 |
| Offline edition | 2,569,455 | 2,571,440 | 1,985 |
| Package metadata | 37,472 | 40,960 | 3,488 |
| Integrated emitted text | 3,103,220 | 3,145,728 | 42,508 |
| Integrated NF03 dependency closure | 523,968 | 524,288 | 320 |

Original teaching source is **7,090 bytes smaller** than Round 6 after the enhancements. Captured teaching-plus-integration growth is **+5,988 bytes** because integration source also grows. Offline output grows **2,253 bytes**. Test trees grow **5,943 bytes**; all tracked repository files through the first runtime commit (`95b123a`) grew **23,269 bytes**, including documentation. New media bytes: **0**. These are distinct counters, not interchangeable savings claims.

NF03 closure and offline headroom remain narrow: future presentation work needs trimming or a separate owner-approved budget decision. This release does not silently consume a larger ceiling.

## Recommendation, risks and next actions

Recommendation: ship this bounded presentation round after the release gates below pass, keeping synthetic-learning claims explicit. Remaining risks are limited payload headroom, browser/device differences and human comprehension; unchanged package gates, responsive/motion checks and independent human review address those separately.

Next three actions: verify the published release; gather focused human feedback on story/legend clarity; obtain a separate P2 design decision before building the deferred data visualizations. No Austin work or new scientific study is authorized by this round.

Final browser correction: the selected story step inherited a pale background from an older, more-specific selector. Increased the new selected-step selector specificity; fresh-browser computed colors now read white on `#276b57`. Focused accessibility/story suite: 95 passed, 1 existing TODO. Initial production readback saw 46 transient 404s for newly published city-generation paths; all 46 matched on subsequent targeted readback. The final contrast-corrected release passed per-file verification as detailed above.

Browser-cache limitation: the existing public `max-age=600` policy can keep old shared CSS in an already-open browser for up to ten minutes. Server-side stable byte readback and a fresh immutable production origin distinguish the deployed version from cached presentation. This round does not add generation-pinned browser sessions or change caching policy. Use a hard refresh or the immutable production URL for an immediate review.

Final offline artifact: **2,569,455 bytes**, SHA-256 `811877a4392f1c3d0010a4119bef353554622e03179fe944c85872afcf7e3218`; a direct stable-URL GET matched the published digest and final release selection. Final current city presentation: `city-explorer/releases/e2b7b57abc64902e`. Prior verified Round 6 immutable deployment remains available and passed 101/101 smoke checks. The intermediate Round 7 production deployment is explicitly recorded as superseded by the contrast correction.

Final evidence: `docs/releases/fleetlab-current.json`; local validation under `build/fleetlab-city/validation/design-round7-20261015/`, including full preview readback, initial stable scan, targeted retry, reconciled stable verification, 71-header checks, independent review disposition, budget measurements and browser screenshots. Physical Pixel qualification, independent map review and human comprehension remain unestablished by this release. No model files or numerical studies changed.
