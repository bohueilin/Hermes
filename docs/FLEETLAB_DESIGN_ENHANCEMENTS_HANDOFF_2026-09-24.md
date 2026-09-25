# FleetLab design enhancements: implementation and validation report

**Status:** Ready for local product review. Approved Packages A–B implemented; Package C checks completed where supported, with measurement and repository-fixture limitations below. **Not published or committed.**

**Authorization:** Bo-Huei's “go” approved the concrete local implementation in [the feedback audit](/Users/bohueilin/Downloads/ChatGPT6_fleetlab-design-review-feedback-audit.md). Muse's document remained review input, not execution instructions. This report supplements that audit and preserves its rejected/deferred recommendations.

**Worktree:** `/Users/bohueilin/Documents/GitHub/Hermes-depot-m1`
**Branch:** `codex/fleetlab-m2-m3`
**Starting and ending HEAD:** `cce9fe027a9509e30695c2c741a6c6a406292940`
**Implementation:** Uncommitted changes in the existing isolated website worktree. The task's original `Hermes-fleetlab` directory contains a different worktree and was not the website implementation target.

## 1. What changed

| Approved item | Implemented behavior | Validation |
|---|---|---|
| Addressable navigation | Native links for six main views plus regional workspace and walkthrough; hash routes, meaningful titles, history and direct entry | Browser back/forward and direct lesson entry; route tests |
| Complete lesson links | All 56 registered lessons have stable addresses; selecting a lesson restores its full setup and waits for Run | Complete settings compared in both catalog traversal directions; idle engine assertions |
| Accessible structure | Embedded branding is no longer a second H1; regional workspace has a main landmark; skip link and navigation focus | One visible H1/main in all six views at five widths; keyboard checks |
| Setup sharing | Explicit, model-specific current-input, completed-run and supported paired-experiment snapshots | Codec, handoff, integration and deterministic reproduction tests; fresh-tab browser checks |
| Clear result context | Model/version/seed/scope beside result groups, exact submitted settings and metrics in disclosures, Street download metadata | Submitted settings remain separate from current edits; exact details inspected at 320px |
| Product and author context | Hermes relationship explained in Product approach; restrained author colophon and useful footer links | Browser review |
| Precise visual/copy cues | Internal destinations use forward arrows; Run actions use a play cue; compact concept-illustration label sits inside the film; vehicle numbers remain assumptions | Phone screenshot and interaction checks; copy/distribution checks |
| Preserve visual design | Existing type, palette, maps, film, responsive navigation, model behavior and explanatory content retained | Existing suite and responsive inspection |

The public website is unchanged. The local site and offline package are review artifacts, not a new deployment.

## 2. Routes and setup contract

| View | Address fragment |
|---|---|
| Overview | `#/overview` |
| Fleet day, including launch rehearsal | `#/fleet-day` |
| Street lab | `#/street-lab` |
| Regional experiments | `#/experiments` |
| Learning catalog | `#/catalog` |
| Product approach | `#/approach` |
| Regional Learn/Sandbox | `#/regional` |
| Guided walkthrough | `#/walkthrough` |

Examples: `#/fleet-day?lesson=weather-day`, `#/street-lab?lesson=street-lombard`, `#/experiments?lesson=UC-08a`.

Setup links carry a canonical URL-safe payload under `?setup=`. The `fleetlab-setup-v1` envelope includes model, exact applicable versions, complete configuration and options. Fleet day supports nested readiness, charging, resource-observation and airport settings; launch rehearsal includes its region/site/task/resource/event configuration and commissioning delay. Regional experiments preserve axis values, populations/scopes, direction, thresholds, guardrails, seed set/count and resamples. Street includes the complete street configuration and network version. Bay geography is bound by the SHA-256 of the bundled source data; regional replay versions explicitly bind its five-replication seed contract.

Loading validates before handing settings to a view. It pauses playback, cancels pending work where needed, invalidates incompatible result state and does not compute a simulation. Computed results are never supplied by the URL. A malformed link, mismatched page/model, unknown lesson, unsupported version or incomplete input opens an explicit error view instead of silently substituting defaults.

The link limit is 32,768 encoded characters. Validated setup JSON is bounded to 64 KiB; when it fits that limit but exceeds the URL limit, the complete JSON remains downloadable. Nothing is truncated. A general file-import workflow is outside this package. Other limits cover nesting, array length, string length and total values; dangerous/unknown keys, accessors, sparse arrays, nonfinite numbers and ambiguous encodings reject.

Custom launch owners/labels/timezones, custom regional names/questions and unsupported region identities are refused explicitly. Supplied synthetic templates remain shareable. The UI explains that a link is a captured snapshot rather than a continuously updated URL. Ordinary input edits do not add browser history entries. File-based links require the recipient to possess the same offline HTML file.

## 3. Reproduction and stale-result evidence

| Check | Observed result |
|---|---|
| Default Fleet day: seed 42, 24 AVs | 95/284 completed; 176 unserved; 4 waiting; 9 assigned/in progress |
| Edit current fleet to 48 after that run | “Last completed run” serializes 24; “Current inputs” serializes 48 |
| Open the 48-AV link in a fresh tab | Controls show 48; output remains empty until explicit Run |
| Run the restored 48-AV setup | 197/284 completed; 66 unserved; 4 waiting; 17 assigned/in progress |
| Street Lombard lesson | 39/71 completed; 12 waiting; 20 in progress, under its separate model |
| Street last-run link opened in a fresh tab | Lombard configuration restored; no result fabricated or automatic run |
| Regional experiment sharing | Full current draft round trip; frozen-spec digest preserved by tests, including scoped metrics and nondefault seed/resample settings |
| Invalid shared payload | Dedicated error view, no simulation; explicit Overview recovery |
| Last run/experiment without a completed source | Clear refusal; no fallback to current inputs |

Existing result download/summary contracts remain separate. A setup or data digest is not authentication. Outputs remain simulation-only, `NOT_EVIDENCE`, with decision/deployment authority `NONE`. No evidence-core gate, verifier, trust-state or authorization contract was changed.

## 4. Review findings resolved

| Finding | Correction and evidence |
|---|---|
| Missing regional metric scope/direction could acquire defaults | Require explicit complete metric references before producer validation. Deleting a scoped L2b primary now rejects instead of widening its population. Negative encode/decode tests added. |
| Reopening a launch lesson could retain an earlier delay | Template selection restores the 90-minute default. Regression first observed `333 != 90`; now passes. All lesson settings compared across repeated visits. |
| Edited regional guardrail carried an inactive undefined field | Adapter removes only an explicitly undefined inactive threshold alternative when its active alternative exists. Exact text, units and frozen digest preserved; unrelated undefined data still rejects. |
| Fleet exact-results disclosure missed its overflow selector | Added its intended class. Expanded JSON remains within the 320px page and a bounded 380px-tall scroll area. |
| New share disclosure violated existing touch-target rule | Restored the existing 44px target. Skip-link stacking remains below the teaching strip. |
| Hero action became an anchor under a pointer-disabled text layer | Restored pointer interaction for the actual CTA class; browser click reaches Fleet day. |
| Concept label sat below the phone media | Moved it inside the film element; phone screenshot confirms it overlays the image without covering playback control. |

Independent follow-up review reported **no remaining important findings in its reviewed scope**; 10 focused checks and the two original reproductions passed. This was a code/design review, not a new exhaustive security assessment.

## 5. Validation ledger

Commands run from the website worktree. Node version: 22.22.0. Python environment: `hermes-dev`, Python 3.11.15.

| Command/check | Actual result |
|---|---|
| Baseline `node --test --test-reporter=spec --test-concurrency=1 playground/fleetlab/test/*.test.mjs` | 1,702 pass, 0 fail, 2 performance skips, 1 existing TODO; 98.018 s |
| Final `FLEET_PLAYGROUND_PERF=1 node --test --test-reporter=spec --test-concurrency=1 playground/fleetlab/test/*.test.mjs` | **1,778 pass**, 0 fail/cancel/skip, 1 existing TODO; 245 suites; 146.504 s |
| Final presentation follow-up: `node --test playground/fleetlab/test/{a11y,studio,hero-film,pack}.test.mjs` | **111 pass**, 0 fail/skip, 1 existing TODO; covers final label placement and hero-anchor correction |
| `python -m pip install -e ".[dev,workbench]"` in `hermes-dev` | Passed. Generated egg-info was moved out of `src/` into ignored validation artifacts before boundary checks. |
| `FLEET_PLAYGROUND_BASE=cce9fe027a9509e30695c2c741a6c6a406292940 conda run --no-capture-output -n hermes-dev python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py` | **89 passed**, including unchanged protected paths |
| `conda run --no-capture-output -n hermes-dev python -m pytest -q` | **Not green:** 1,433 pass, 186 fail, 42 errors, 56 skipped; 21.00 s. Missing retained evidence fixtures prevent the wider repository gate. |
| `conda run --no-capture-output -n hermes-dev python -m ruff check .` | Passed |
| `conda run --no-capture-output -n hermes-dev python -m hermes doctor` | 17 PASS, 1 WARN for intended uncommitted changes, 1 optional display NOT_AVAILABLE; no FAIL |
| Hosted and offline pack/check-dist commands | Passed; existing size, URL, content-security-policy, forbidden-token and copy rules retained |
| `git diff --check` | Passed |

Earlier intermediate runs exposed the touch-target/stacking and copy-check issues above; the final results supersede them. Installing editable metadata initially caused one extra source-boundary failure; the generated metadata was moved out of the scanned source tree and all 89 focused Python checks then passed.

The full Python suite expects artifact directories such as `artifacts/handoff-phase5-demo` that are absent from this linked worktree. The unchanged Python source and protected-path check support keeping this separate from the website implementation, but the full repository gate is **not reported as passing**. Evidence fixtures were not fabricated, migrated or regenerated to hide that limitation. No commit was made under the repository's full-gate rule.

Detailed logs and package digest inventory: `artifacts/fleetlab-design-enhancements/` (ignored, not staged). Principal logs: `final-node-verified.txt`, `final-presentation-checks.txt`, `playground-python-final.txt`, `full-pytest-final.txt`, `doctor-final.txt`, `review-fixes.txt`, `site-sha256.json`.

## 6. Browser and measurement coverage

- All six main views at actual viewport widths **320, 390, 768, 1024 and 1440**: no document horizontal overflow; one visible H1 and main landmark. Phone navigation remains two columns with targets at least 44px tall.
- Expanded Fleet day exact JSON and generated setup URL at 320px remain contained. Hero CTA, in-media label and phone layout visually inspected.
- Main navigation, browser back/forward, direct Street lesson entry, fresh-tab Fleet/Street setup loading, regional current setup loading and invalid-link recovery exercised.
- Keyboard Enter on navigation and skip link exercised; skip moves focus to the active main. Street map focus and zoom controls exercised. No console errors in the final inspected tab.
- Hosted package and single-file package served over loopback HTTP both execute. The single-file Street lesson reproduced the same 39/71 completed journeys.
- Direct `file://` testing was rejected by browser URL policy. No alternate browser, indirect execution or policy bypass was attempted. Native file-opening remains a user-side validation item.
- Existing reduced-motion, Save-Data, visibility, cancellation and poster-fallback tests pass. **Actual network requests under emulated reduced motion were not measured**: the available browser controls expose viewport/visibility, not media-preference emulation and network inspection.
- **No browser page-load/Lighthouse baseline, CPU/network-throttled run, VoiceOver/NVDA session, physical phone, Safari or Firefox validation.** Package size and existing engine performance budgets are measured; they are not substitutes for those missing measurements. Browser zoom was not independently emulated.

## 7. Review artifacts and reproducibility

Local preview: [FleetLab design review](http://127.0.0.1:8767/design-review-site/).

```bash
node playground/fleetlab/tools/pack.mjs --site dist/design-review-site
node playground/fleetlab/tools/check-dist.mjs --site dist/design-review-site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-design-review.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-design-review.html
python -m http.server 8767 --bind 127.0.0.1 --directory dist
```

| Artifact | Identity |
|---|---|
| Hosted preview | `dist/design-review-site/`; 85 files; 3,149,404 bytes including unchanged media |
| Offline preview | `dist/fleetlab-design-review.html`; 2,510,896 bytes |
| Offline SHA-256 | `c77b3a2700144469679677fc8148001d7ac0723921618a0df84571df29f1ebd4` |
| Sorted JSON hosted-file digest inventory SHA-256 | `fe4998b40ab683fff246733d9717bd3ae54b32282992f592a5a73bbd32b420f9` |

The offline package is 44,846 bytes larger than the audit's 2,466,050-byte baseline, about 1.8%. It remains under the existing 2.5 MiB budget. Media was not re-encoded and no runtime dependency was added.

## 8. Changed surfaces and boundaries

New UI modules: `routes.js`, `setup-codec.js`, `setup-sharing.js`, `regional-setup.js`. Updated studio/catalog navigation, Fleet day/launch/Street handoffs, embedded branding, styles and copy-module validation. Focused tests cover route validation, all lessons, current/submitted snapshots, import cancellation, version/key/resource/privacy rejection, threshold fidelity and landmarks.

No engine, policy, verifier, gate, simulator adapter, Python source, evidence artifact contract or dependency definition changed. No account, persistence, server-side saved run, telemetry, database, remote ingest, signing, promotion or hardware control was added. The separate Phase 6 workbench remains unchanged; ReviewEnvelope/ComparisonEnvelope and artifact comparison demonstrations are not applicable to this presentation package.

The existing isolated branch was retained under the current approved website scope; the historical Phase 6 branch name requirement was not used to overwrite newer work. No push, pull request, remote edit, publish or deployment occurred. No local commit or staging occurred. The prior published release record remains historical and unchanged.

## 9. Recommendations deliberately not taken

| Not implemented | Reason retained from the audit |
|---|---|
| Calling Ojai fictional | Incorrect framing; its operating numbers here are assumptions, not validated fleet specifications |
| Mobile menu redesign | Existing wrapping navigation works; new links preserve that behavior |
| Renderer/loading watchdog | No reproduced need; a fabricated timeout would create misleading state |
| Film replacement/re-encoding | Existing media budgets and preference-aware fallback behavior work |
| Clean-path SEO pages and unique social previews | Hash routing solves navigation/offline compatibility, not indexing or per-view social metadata |
| Broad token/visual rewrite | Would increase scope without evidence of a user benefit |
| Cloud saving, accounts, analytics or a general file importer | Separate privacy, architectural and product decisions |
| Stronger trust/deployment claims | Simulation results and self-contained setup links confer no operational authority |

## Recommendation

Review the local experience, especially the distinction between current inputs and completed-run inputs. The approved enhancements are ready for that review. Hold publication and any claim of a completely green repository until the separate release decision and fixture/environment gates are resolved.

## Top risks + mitigations

| Risk | Mitigation / residual limit |
|---|---|
| Configuration mistaken for a result | Explicit snapshot labels, no autorun, exact result disclosures, preserved model/scope boundaries |
| Version drift or damaged/partial links | Exact versions and strict bounded validation; explicit errors; complete JSON fallback for oversized valid links |
| Private text copied into a URL | Synthetic-text restrictions and visible warning; do not treat links as a channel for confidential data |
| Untested browser/device or performance behavior | State the unsupported measurements explicitly; complete them before a broader release claim |
| Missing repository evidence fixtures | Preserve and report failures; do not fabricate fixtures or claim full-gate completion |

## Next 3 actions

1. Review the local preview: navigate to a lesson, change a constraint, compare current versus last-run sharing, then reopen the link.
2. Restore the approved retained fixture set for the broader repository gate and complete native offline/browser/accessibility/performance checks in a suitable environment.
3. Make a separate release decision after review. Commit and publish only under the applicable gate and explicit authorization.
