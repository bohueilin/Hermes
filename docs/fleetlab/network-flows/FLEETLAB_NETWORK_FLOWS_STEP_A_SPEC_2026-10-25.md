# FleetLab network flows, Step A: tests, tooling and baselines

**Date:** 2026-10-25. **Base:** `main` at `b15055c3bd5095aae4939ab8c16f387077f1b835` (PR #9 merged). Its site inputs are byte-identical to the live release `a1b79cd`.
**Branch:** `codex/fleetlab-network-flows-step-a`.
**Status:** written before any test edit; the tests and runners named here follow it.

Step A adds tests, test-side tooling and recorded baselines only, with **zero product change**. No byte that the site, the offline edition, the teaching package or the source offer carries may change. Step B (the five priority fixes to the network-flows lessons) starts only after these baselines are recorded and every bound passes at the base.

## 1. Rules for every Step A file

- **Placement.**
  - Node tests go in `apps/fleetlab-city/test/*.test.mjs` (City suite) or `playground/fleetlab/test/*.test.mjs` (Playground suite), as top-level files. Python tests go in `tests/unit/test_*.py`.
  - Helpers and runners are non-`.test.mjs` files in those test directories, following `apps/fleetlab-city/test/stage-fixture.mjs`.
  - No measuring, validating or runner code may live in `playground/fleetlab/{src,tools}`, `apps/fleetlab-city/{hosted,tools,deploy}`, a media root, or a lesson route directory. Those are captured into raw source, the integration source and the source offer, so code there would change product bytes or fail the frozen-legacy check. Measured at the base: an extra 1,000 B file in either test directory or in `tests/unit` changes no receipt count and leaves the offer SHA-256 unchanged.
- **Imports.** Use existing exports only, such as `measureIntegratedText`, `measureSiteOwnership`, `measurePackageProof`, `buildSite`, `buildHtml`, `ARTWORK_GROUPS`, `BRAND_MEDIA`, `BRAND_TEXT`, `renderPage`, `integratedRootFiles`, `visibleCopy` and `copyProblems`. No new export is added to a product module.
- **Public repository.** No absolute local path, user name or private material appears in any file. Local-only inputs are passed by argument or environment variable.
- **CI.** The three Node suites and pytest already run on every pull request (`.github/workflows/ci.yml`, `macos-26`, Node 22.23.4, CPython 3.11.15). A Step A test therefore gates as soon as it lands, and must pass on a fresh checkout with no `build/`, `dist/` or `artifacts/` inputs. A test that needs local-only inputs is a runner script, not a test.

## 2. Measurement facts the bounds depend on

These were measured at the base on 2026-10-25 with the official Node 22.23.4 build and CPython 3.11.15.

1. **Stage figures vs unit figures.** The stage figure is what `apps/fleetlab-city/deploy/build-release.py` writes to `stage/review/integration-manifest.json`. A unit test cannot rebuild everything the stage holds:
   - **The existing test pattern** (`enhancement-packaging.test.mjs:61-66`) omits 13 integration paths (48,341 B) and the receipt (44,361 B). That makes it 92,702 B low on emitted text.
   - **The extended map** adds the 12 reproducible integration files, built with the same transforms as `integration-assets.mjs:88-121`, plus the development receipt from `measurePackageProof`, placed in both the teaching and the integrated maps. That leaves a gap of exactly **1,859 B**: `publication.json` (1,800 B), which only the stage writes, plus the release receipt's 59 B over the development receipt.
   - **The closures are unaffected:** the six route closures and depot route-local are equal under the unit and stage measures.
2. **Dirty trees read low.**
   - On uncommitted edits to bound files, each `release.json` says `MODIFIED_SOURCE` instead of `BOUND_FILES_MATCH_COMMIT`. Each closure and the legacy figure then read 9 B low, and emitted text 54 B low.
   - Without git, the shortfall is 75 B per sidecar.
   - So unit bounds are upper bounds, never exact pins, except where stated.
3. **Commit-hash gzip variance (owner decision, 2026-10-25).**
   - The release source offer embeds the 40-character source commit and tree. Its gzip size therefore moves by a byte or so from commit to commit, even when no source changes.
   - At the base, the compressed offer is **1,147,688 B**; at `a1b79cd` it was 1,147,687 B.
   - Swapping the `a1b79cd` hashes into the base's extracted offer and recompressing with `gzipSync(level 9)` reproduces the `a1b79cd` file byte for byte. The extracted offers are identical in size (4,079,740 B) and differ only in those two strings.
   - The owner accepted the base's measured values as the BEFORE baselines (**non-City 16,187,445**, **compressed offer 1,147,688**) and kept the adopted absolute bounds.
   - Exact cross-commit comparison of these two figures is therefore not valid. Compare the extracted offer exactly, and non-City minus the compressed offer exactly.
4. **Zlib depends on the Node binary.**
   - The official Node 22.23.4 bundles zlib `1.3.1-e00f703`, and gives a development compressed offer of 1,147,629 B.
   - Homebrew's Node 22.22.0 links zlib 1.2.12, and gives 1,145,066 B.
   - Compressed figures are upper bounds, and their messages print `process.version` and `process.versions.zlib`.
5. **Node version-string length.** Several sidecars record the Node version string, so a runtime whose version string has a different length shifts legacy, emitted and extracted figures by that difference.

## 3. BEFORE baselines at the base, and the bounds

**Measures.** Stage values come from the stage check (section 4). Unit values come from the City and Playground suites.

**Tolerances.**
- **"≤"** is an upper bound.
- **"exact"** means equality at a clean commit.
- **"−9"** means the value may read up to 9 B low on uncommitted work.

| Measure | Measuring function | BEFORE (base) | Bound | Tolerance | Gate |
|---|---|---|---|---|---|
| Capacity (nf03) closure | `measureIntegratedText`, pattern map | 537,633 | ≤ 541,729 | ≤, −9 | City (existing `enhancement-packaging.test.mjs:69`, kept) and stage |
| Software delivery (nf04) closure | same | 221,334 | ≤ 225,430 | ≤, −9 | City (new) and stage |
| Delivery Order closure | same | 225,063 | ≤ 229,159 | ≤, −9 | City (new) and stage |
| Rebalancing (R1) closure | same | 196,347 | ≤ 200,443 | ≤, −9 | City (new) and stage |
| Dispatch (R3) closure | same | 152,391 | ≤ 156,487 | ≤, −9 | City (new) and stage |
| Depot closure | same | 513,471 | ≤ 515,519 | ≤, −9 | City (new) and stage |
| Depot route-local | same | 418,159 | unchanged | between 418,150 and 418,159 | City (new) and stage |
| Emitted text, stage | `integrate-site.py` (`integrated_text.emitted_text_bytes`) | 3,569,285 | ≤ 3,577,477 | ≤ | stage |
| Emitted text, unit | `measureIntegratedText`, extended map plus the development receipt | 3,567,426 | ≤ 3,575,618 (stage bound − 1,859) | ≤, −54 | City (new) |
| Integration text, stage | `integrated_text.integration_text_bytes` | 129,056 | ≤ 133,152 (owner number) | ≤ | stage |
| Integration text, unit | same, extended map | 127,256 | ≤ 131,352 (stage bound − 1,800) | ≤ | City (new) |
| Integration source | receipt `integration_source.bytes`, development equals release | 389,082 | ≤ 397,274 (owner number) | ≤ | Playground (new) and stage |
| Brand text sum, and the `BRAND_TEXT` list | `readFileSync` over the 8 files; list deep-equal, with Python `TEXT` parity | 73,889 | ≤ 75,937 | ≤ | City (new) |
| Legacy text | `measureSiteOwnership(buildSite(...))` | 2,605,087 | ≤ 2,607,968 (re-based by the C2 apply commit, parent d56409e, owner approval 2026-10-29, no allowance; was ≤ 2,607,135) | ≤, −9 | Playground (new) |
| Raw source and tools | `measurePackageProof`, development mode | 3,553,269 | ≤ 3,569,653 | ≤ | Playground (new) |
| Source offer, extracted | same, development / release | 4,079,681 / 4,079,740 | ≤ 4,104,257 / ≤ 4,104,316 | ≤ | Playground (development) and stage (release) |
| Source offer, compressed | same, development / release | 1,147,629 / 1,147,688 | ≤ 1,155,821 / ≤ 1,155,879 | ≤; zlib printed | Playground (development) and stage (release) |
| Package metadata | receipt, development / release | 44,302 / 44,361 | ≤ 45,326 / ≤ 45,385 | ≤ | Playground (development) and stage (release) |
| Non-City bytes | `integrate-site.py` `non_city_bytes` | 16,187,445 | ≤ 16,203,828 | ≤ | **stage only** |
| Offline edition | `buildHtml`; existing `package-proof.test.mjs:131-132` | 2,565,111 B, `313fa3f1a94ed0c40b05858c38a1bc9d5d2facc3b1cdff998ec783a6c9f58fa1` | exact: after mode 2,566,962 B, e49c0aba90eb35c342094ddbe9f0db07850eb8c080439e7c18c170637efb6bdd (re-pinned by the C2 apply commit, parent d56409e, 2026-10-29); before mode 2,565,111 B, 313fa3f1… | exact | existing, and stage |
| Artwork | `ARTWORK_GROUPS`, `BRAND_MEDIA`, plus bytes and SHA-256 on disk | 41 records, 7,793,265 B | exact; all five groups deep-equal | exact | City (new) |
| `.gitignore` | bytes, SHA-256, and `git check-ignore` on FL-V1 | 2,108 B, `582cda30b42d0e33024c3d6a41c5f2ce42a902c073540368b687961c498d6058` | exact | exact | pytest (new) |

**Artwork groups** (count / bytes): diagram 4 / 510,436; rebalancing 4 / 1,983,799; brand 7 / 623,114; tile 19 / 1,990,494; enhancement 7 / 2,685,422.

**As implemented** (`stepa-byte-bounds.test.mjs`, `stepa-baselines.test.mjs`), each check is at least as strict as the table:
- **Bites controls.** Every upper bound has an in-memory control. Growing the route's own file to exactly the bound passes, and one byte more fails.
- **Integration oracle.** `verifyIntegrationAssets` must reproduce all 12 integration files and agree with the unit sums.
- **Artwork digest.** A record-set SHA-256 over the artwork (`bcd79b15…`) catches a same-size re-encode with an updated record.
- **Release structure.** The Playground file checks it on a clean tree at `HEAD`, which is always the case on CI: the release receipt and the gunzipped release offer are each exactly 59 B longer than the development ones. On a dirty local tree it skips with a visible reason.

**Shared headroom.** Every brand byte is added to all six closures (`software-delivery-package.mjs:109`). The brand-sum headroom (2,048 B) therefore also consumes every closure's headroom.

**Budget note for the owner, measured.** JSON escaping inside the extracted offer averages **2.84%** for teaching text and **4.23%** for integration text, not the 1.5% assumed earlier. If raw source used its full +16,384 B allowance and the integration source its full +8,192 B, the extracted offer would grow by about 25,400 B. That exceeds its +24,576 B allowance (inferred from the averages). The extracted-offer bound, not raw source, is then the binding one.

## 4. Non-City stage check and its runner

**The procedure.** It works only on a **committed** candidate with a clean worktree:
1. `git worktree add --detach <wt> <commit>`, then confirm the worktree is clean and that `HEAD` equals the commit.
2. `mkdir <wt>/dist`.
3. With the official Node 22.23.4 first on `PATH` and the City environment's CPython 3.11.15, run `apps/fleetlab-city/deploy/build-release.py --commit <commit>` with the four local-only inputs. These live in an ignored local `build/fleetlab-city/` directory and must be preserved:
   - `--legacy delivery-order-20261013/preserved-legacy`
   - `--legacy-readback validation/integration/baseline-readback.json`
   - `--city-base visitor-preview-20261014/city-explorer/releases/c56bda6b509105c5`
   - `--city-source-offer source-offer-v8-temporal-final`
   - `--out <wt>/dist/stepa-<sha7>`

**The runner.** `apps/fleetlab-city/test/stage-check.mjs`, a non-test Node script, reads `build-inputs.json`, `stage/review/integration-manifest.json` and `stage/site/downloads/teaching-package.json`. It prints one JSON record.
- **Input digests.** It checks the four input digests: legacy `15b3d561…`, City base `4fa335d2…`, City source offer `1bf42853…` and readback `708659b4…`.
- **Mode `before`.** It requires:
  - emitted text, integration text, the six closures, route-local and artwork to equal the BEFORE values exactly;
  - the offline edition to match exactly;
  - the extracted offer to be exactly 4,079,740 B;
  - non-City minus the compressed offer to be exactly 15,039,757 B (16,187,445 − 1,147,688, which is invariant across commits).
- **Mode `after`.** It applies the bounds in section 3.
- **Self-test.** `stage-check.test.mjs` runs the runner's logic on synthetic records, so CI checks the runner without the inputs.

**BEFORE run at the base (2026-10-25).** The build succeeded in 50 s, under Node v22.23.4 and Python 3.11.15. All four input digests match. Integrated text and the offline edition are identical to the retained `a1b79cd` stage. Non-City is 16,187,445 B, explained in section 2.3. The runner passes all 32 checks on that stage in `before` mode, and in `after` mode.

## 5. A2 golden

New file `apps/fleetlab-city/test/a2-golden.test.mjs`, using the fixture of `enhancement-media.test.mjs:6-14` and `:37-40`. It asserts:
- the serialized Fleet day figure is 602 B, SHA-256 `aa3a9cd27182bc1a5d68c63cb5061280864502febd6c74c1a7cc141e289029ea`. The full string is also asserted, so a failure shows a readable diff.
- the figure is the next sibling after the `h1`, and the whole teaching frame serializes to the `h1`, the figure and the frame's paragraph, with no `video` anywhere in it;
- a second decorate leaves the frame unchanged, with exactly one `#enhancement-fleet-day`, and keeps the same figure and image nodes (a rebuilt node would restart the lazy load);
- the figure contains no `video`;
- `enhancement-media.css` is 3,057 B, `9e5c35ae84eca53c2210e6a2841412dfe98e3dfaaf4bf01dde1f3c987434c1b4`, pinned whole;
- the FL-A2 record and file are 431,948 B, `e5299c6fd31c5521b2f36d1a519c5f67abc1c3bae64b66fe5d6a4267f96a7522`.

It leaves `enhancement-packaging.test.mjs:19` and `:51-59`, and `enhancement-media.test.mjs:43`, unchanged.

## 6. Colour lock and grandfather list

**The rule (owner decision).** Amber and terracotta are never used for a new interactive state or warning. White chrome is allowed. **Every current warm use is grandfathered.**

**The test.** New file `apps/fleetlab-city/test/colour-lock.test.mjs`, with its committed baseline `apps/fleetlab-city/test/fixtures/warm-colour-baseline.json`.

**Scope.** Every shipped stylesheet, page and script of the network-flows site:
- `apps/fleetlab-city/hosted/*.css`;
- the playground `styles.css` and each lesson's `visual.css`;
- the hosted pages and scripts;
- `playground/fleetlab/src/**/*.js`.

A readdir check makes the scanned stylesheet list deep-equal what is on disk, so a new stylesheet cannot escape the scan. The City viewer (`apps/fleetlab-city/web`) is excluded, because it ships from the frozen City base.

**Detector.** Colour literals (hex, `rgb()`, `rgba()`, `hsl()`, `hsla()` and named colours) are parsed in:
- CSS declaration values, with comments blanked, recursing into at-rules;
- markup `style` attributes and `<style>` blocks;
- SVG paint attributes, with quoted or unquoted values. Every other markup attribute gets the hex and colour-function detectors, and inline `on*` handlers are scanned as JavaScript;
- JavaScript string literals. A colour name counts there only when the literal reads as a CSS value, or follows a paint property; prose such as "the orange route" is exempt. A URL-encoded `%23` hex, as in an SVG data URI, is decoded to `#`.

The scan covers 14 stylesheets, 13 pages and 195 scripts at the base, and 1,027 colour literals.

A literal counts as **warm** when its alpha is above 0, its chroma (max − min)/255 is at least 0.06, and its hue is in [12°, 60°). `color-mix()`, `oklch()`, `lab()`, `hwb()` and `color()` are unclassified and fail the test, so they are never silently allowed. Custom properties whose value is warm are warm tokens, and every `var()` use of one is tracked.

**Baseline.** At the base there are 91 warm literal hits (72 distinct) in 17 files, plus 10 warm-token uses. Keys carry no position: file, at-rule chain, selector list (with whitespace around commas and combinators dropped), property and literal. Positions appear only in failure messages.

**Assertion.** No addition is allowed: the current multiset minus the baseline must be empty. Removals are logged and allowed, so a later restyle does not churn the snapshot. Extending an existing warm rule's selector, for example adding a new state, changes its key and fails as an addition.

**Known limits.**
- **No identifier tracking in scripts.** A script key is only `file | literal`, and identifiers are not followed, so a new state that reuses an existing warm constant adds no literal and passes. A count freed by a removal can be reused in the same file. Because the owner's rule is to fail only on additions, script keys do not ratchet.
- **HTML character references.** A `#` written as `&#35;` is not decoded.
- **Named colours in non-paint markup attributes** are not detected.

None of these occurs at the base.

**Controls in the same file:**
- a new warm focus ring fails;
- `#c0392b` (red, hue 5.6°) passes;
- `hsl(30 60% 40%)` is warm;
- `color-mix()` throws;
- `var(--amber)` used in a new selector fails.

## 7. Hub-copy test

New file `apps/fleetlab-city/test/hub-copy.test.mjs`. It runs the copy rules of `check-dist.mjs` (`visibleCopy`, `copyProblems`) over `apps/fleetlab-city/hosted/network-hub.html`, which `check-dist` does not scan. `check-dist.mjs` itself is captured and is not edited.

The allowlist has exactly two entries:
1. **The em dash** in the live boundary sentence, kept verbatim: "Simplified simulations for learning — not evidence about real-world safety. Nothing here approves deploying a vehicle or policy." Exactly one use is allowed.
2. **The word "forecast"**, allowed at most once, and only inside hub card 04 (the Rebalancing list item). There are zero uses at the base; the redesign may add one. Its exact wording is not pinned, because it is not approved copy yet.

Everything else must pass `copyProblems` unchanged. `copyProblems` exempts four approved dash sentences on any path. So the hub test also counts every en and em dash across all hub copy items, and requires exactly one: the boundary sentence's. Negative controls:
- a second dash fails;
- "forecast" in any other card fails.

## 8. KNOWN_CAVEAT fixture

New file `apps/fleetlab-city/test/known-caveat.test.mjs`. It holds a hash-only fixture for the two candidate stills that stay on caveat until they are re-rendered:
- `NF26v3-empty-rebalancing-map.webp`, 183,778 B, `d29d59f589d906114286bc0fef1b58b6e1ed71901d038946305714e8fa539b33`;
- `NF26v3-shared-depot-copy.webp`, 129,956 B, `9196915e76a3cd7e3b9a3a684ae98ea4f648d55324ef29d14656460357211b3e`.

Neither file is in the repository, and no media is added. The test asserts that no `BRAND_MEDIA` record and no file under any artwork or media root has either hash. This catches byte-identical placement only; a re-encode is a design-review matter.

## 9. Viewport geometry tooling

New file `apps/fleetlab-city/test/viewport.test.mjs`. Its helpers are:
- `cdp-browser.mjs`, a dependency-free DevTools-protocol client over Node's built-in WebSocket, with signal-safe cleanup;
- `hosted-site-fixture.mjs`, the in-memory hosted site, served from `127.0.0.1` with the site's own `_headers` CSP;
- `viewport-measure.mjs`, holding the expected titles, the settle rule and the overflow measurement, which it shares with the section 10 runner.

**Pages and widths.** It covers 8 pages at 4 widths each: `/`, `/network-flows/`, the five lessons and `/depot-readiness/`, at 320, 390, 768 and 1280 px.

**Method.**
- Widths are set with `Emulation.setDeviceMetricsOverride` (`mobile` below 500 px), with scrollbars hidden.
- **Deviation from the earlier plan, with the reason.** The plan was a fixed-width iframe below 500 px. Device-metrics emulation gives the exact width without stripping `X-Frame-Options` and `frame-ancestors`, which an iframe would need. A vacuity guard proves the emulated width took effect.
- Each page settles when its scroll size and element count are unchanged for 600 ms, capped at 5 s.

**Assertions.**
- `documentElement.scrollWidth` is at most the requested width;
- `clientWidth` equals the requested width;
- each title matches the expected page;
- exactly 32 cells are measured;
- each failure lists the elements that overflow.

**Before-baseline.**
- The depot experiment overflows at 320 px: scroll width 355, caused by the 322 px "Depot content cache (diagnostic field)" select and its field.
- Two more recorded sources overflow in the same cell: the import and share block (`#share`), at 329 px on its own, and the fixed motion control, which sits at the right edge of the widened page.
- Repeated local runs on one Chrome build read 351 to 355 px.
- It is recorded as a known baseline exception. The test fails in any of these cases:
  - any other cell overflows;
  - this cell stops overflowing, or no longer overflows from that select;
  - its scroll width exceeds 355 by more than 8 px, an engine tolerance for font and rounding differences between Chrome builds;
  - an overflowing element lies outside the select's field, `#share` or the motion control.
- The list is pruned deliberately.
- Step A cannot fix it (zero product change).
- The other 31 cells do not overflow.

**Chrome.** The test reads Chrome's path from `FLEETLAB_CHROME`, or uses the macOS default path. If Chrome is absent and `CI=true`, or `FLEETLAB_REQUIRE_CHROME=1`, it **fails**; otherwise it skips with a visible reason. It also fails if Chrome is found but cannot launch. The runner image ships Google Chrome 155, so no CI workflow change is needed. Results print the Chrome version.

## 10. Browser evidence protocol and its runner

**The runner.** `apps/fleetlab-city/test/network-flows-evidence.mjs`, a non-test Node script, serves a built stage `site/` from `127.0.0.1` without its `_headers` (`headers_applied: false`) and drives Chrome over CDP. It writes `fleetlab.network-flows-browser-evidence/1.0.0` under the ignored `build/fleetlab-city/validation/network-flows-<sha7>/`. It is never committed.

**Header.**
- `source_commit`;
- `stage` (path, `integration_manifest_sha256`, `teaching_receipt_sha256`);
- `browser`;
- `server` (`headers_applied: false`);
- `scope`;
- `notRun`, which always lists `physical-phone`, and lists `hosted-headers` while `headers_applied` is false.

**Pages.** The hub, the five lessons and the depot experiment, at 320×700, 390×844, 768×1000 and 1280×900. For each page and size it records:
- the method;
- the title, the document status and the visibility state. Validation requires the expected title, status 200, visibility `visible`, and `clientWidth` equal to the width;
- `innerWidth`, `clientWidth`, `scrollWidth` and `pageOverflow`;
- the overflowing elements;
- console errors;
- external requests (Google hosts blocked);
- a screenshot (name, bytes, SHA-256).

**Network.** For Capacity and Dispatch at 390 and 1280 px with a cold cache:
- requests, with priority and initiator;
- requests before first contentful paint, plus FCP and LCP;
- whether FL-A4 got priority;
- whether the D-01 decoy was requested;
- the D-05 request count.

Dedicated workers are auto-attached, so the worker script's response and the worker's own requests are recorded. Each network cell records `quietReached` and `quietWaitMs`: the wait ends after 500 ms with no request in flight, capped at 10 s.

**Pause control.**
- r1-nf05 is at least 25% visible and confirmed playing;
- the control is pressed, then 1 s waited;
- the paused state, the time delta and the FL-V2 state are recorded.

**Fleet day at 390 px.** A2 is present, and there is no V1 element.

**Validator.** `network-flows-evidence.test.mjs` validates the record schema on a synthetic record in CI.

**Runs.**
- The runner is run once at the base (BEFORE) and again on the Step B candidate (AFTER).
- The physical-phone check runs on the release candidate only.

**BEFORE record at the base** (2026-10-25, Chrome 156.0.8078.47, the BEFORE stage served locally):
- **Overflow.** Of the 28 page-and-size cells, only the depot experiment at 320 px overflows (scroll width 355).
- **Errors and hosts.** Console errors: 0. The only external host attempted is `www.googletagmanager.com`, and it was blocked.
- **Capacity.**
  - FL-A4 is `loading="lazy"` with no priority. At 1280 px it is in the first viewport (top 282 px) and is the LCP element; at 390 px it sits below the fold (top 924 px).
  - The D-01 decoy is requested at both widths.
- **Dispatch.** D-05 is requested once at each width.
- **Pause control.** Pressing "Pause visual motion" pauses FL-V2, which returns to its poster. It does **not** pause r1-nf05: 1.007 s of playback passed in the 1 s wait.
- **Fleet day at 390 px.** A2 is present and loaded, and there are no V1 elements or requests.

## 11. Delivery Order truth table, confirmed against source

New file `playground/fleetlab/test/delivery-order-truth-table.test.mjs`. It pins the model's results as literals, using the repo's own `searchDeliveryOrders`, `runDeliveryOrder`, `createOrderProjection` and `verifyOrderStudy`. Figures read: on time out of 4 · total late time · worst late time · all ready.

| Scenario | First come | Best of 24 |
|---|---|---|
| Different targets (default) | 2/4 · 178 s · 138 s · 378 s | 4/4 · 0 s · 0 s · 378 s, V4→V3→V2→V1 (one best) |
| One impossible target | 1/4 · 192 s · 138 s · 378 s | 3/4 · 158 s · 158 s · 378 s, V4→V3→V2→V1 (one best) |
| Close targets | 2/4 · 4 s · 2 s · 378 s | 3/4 · 50 s · 50 s · 378 s, V1→V3→V2→V4 (one best) |
| Equal targets | 4/4 · 0 s · 0 s · 378 s | the same; all 24 orders tie |

It also asserts:
- an untouched order equals first come in all four scenarios;
- "Equal targets" is reachable only through "Inspect all 24 tied orders";
- the job's failure messages are exact.

**Corrections to the redesign plan, from source:**
1. **378 s is "All ready"**, the time the last vehicle becomes ready. It is the same for all 24 orders and is not a total.
2. **Best can worsen the worst lateness.** In the impossible case, the worst late time is 138 s under first come and 158 s under best. Copy that calls Best better must stay scoped to misses, then to total lateness.
3. **A fifth first-paint "pending" source.** First paint also has the "Reset pending order" button (`delivery-order-page.js:54`), beyond the four already listed.
4. **The pinned-test list.** `delivery-order-page.test.mjs:13` is a helper, not a test. `design-round4.test.mjs:26` also needs keeping.
5. **The pre-run scenario switch.** Today `selectCase` does not re-render the cards, and the cards read the default case when nothing is accepted. The redesign needs both changes.
6. **The status-line concatenation** omits a full stop after the verifier code. Its "retained" clause is false on a first-run failure.

## 12. Python `.gitignore` pin

New file `tests/unit/test_gitignore_pin.py`. It asserts `.gitignore` is exactly 2,108 B with SHA-256 `582cda30…6058`, and that `git check-ignore` reports FL-V1 (`apps/fleetlab-city/enhancement-media/FL-V1-one-fleet-day-film.mp4`) as ignored.

## 13. CI plan

- **Python.** CI runs ruff and pytest (`-m "not metadrive"`) on `macos-26` with CPython 3.11.15. The fixture guard skips the 228 fixture-dependent tests there, and only there.
- **Node.** CI runs the Playground, City and traffic suites on Node 22.23.4. The new Step A Node tests run in the existing City and Playground steps, so **no workflow edit and no R6 change** is needed.
- **Viewport test.** It uses the runner's preinstalled Chrome.
- **Still open.** Branch protection is not required yet; requiring the check is a separate owner settings action. The City Python suite remains outside CI.

## 14. Open items for the owner

1. The depot experiment's 320 px overflow is recorded as a baseline exception (section 9). Fixing it is not in the five priority fixes.
2. The card 04 "forecast" wording is not approved copy; the hub test allows the word without pinning wording.
3. The extracted-offer allowance is tighter than the raw-source allowance under measured JSON escaping (section 3).
