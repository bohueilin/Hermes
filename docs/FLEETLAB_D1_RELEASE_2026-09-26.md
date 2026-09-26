# FleetLab D1 release record

Date: September 26, 2026. Authority: `docs/plans/2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md`.
Scope: presentation-only D1 and a separate documentation-only N2 S0 addendum. No N2 implementation, execution seam, registration, data acquisition, dependency or protected-model changes.

## Preflight and baseline

- Base: `b1c12b6a11e25fb7a7dabc9392f94368aee88740`; branch created from it: `codex/fleetlab-d1-result-first`.
- Entry branch: `codex/fleetlab-regional-power`. Only untracked entry: owner's `FleetLab-ChatGPT-review-and-next-phase.md`, preserved and never staged.
- Node `v22.22.0`; activated `hermes-dev` reports Python `3.11.15`. With checkout `PYTHONPATH`, Hermes resolves to this worktree's `src/hermes/__init__.py`; the shared editable install was not modified.
- Cloudflare authentication verified with pinned Wrangler 4.135.0. No credential handling or installation.
- Full serial performance-enabled Node baseline: **1,792 tests, 1,791 pass, 0 fail/cancel/skip, 1 existing TODO**, 138,120.705667 ms. No difference from the brief's expected counts.
- Baseline static package: **89 files, 3,181,153 bytes**. Offline: **2,543,655 bytes**. Both package checks passed.
- Added D1 model-parity test passed **2/2 on unchanged production source**: Bay 95/176/4/9 = 284; Austin moderate 77/391/11/1 = 480, with seed/condition/policy checks.
- Logs live under ignored `artifacts/fleetlab-d1/`; they are not published.

## Decision and interface log

- The current owner brief authorizes exactly its commits, Pages deployment and fast-forward pushes, replacing the older no-remote rule for these steps only. Its scoped B.4 gates replace AGENTS section 18. No package installation or environment change is permitted.
- Execution uses the supplied worktree and requested branch. The brief's release record plus an ignored progress ledger replace skill-generated workspaces that might alter `.gitignore`.
- Independent work: N2 document; Austin presentation; Street/film motion; Fleet day/studio integration. Only the coordinator stages, commits and deploys.
- Shared presentation interface: `modelHeader(name, geography, version)` returns a paragraph and an updater. It never computes model versions or metrics. Consumers pass authoritative values.
- Per-panel sharing uses existing setup encoding unchanged. Austin/Launch expose their heading and a share slot; Fleet day exposes its Result summary slot. This is presentation plumbing, not a new route or model.
- N2 v1 is immutable; its expected SHA-256 is `c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`.

## Route and state inventory, captured before implementation

States below name the existing render and the D1 change. A dash would conceal an unavailable state, so static/non-applicable states are explicit.

| Route or panel | Ready | Running | Completed | Stale | Canceled | Invalid | Unavailable | Empty population |
|---|---|---|---|---|---|---|---|---|
| Overview (`overview`) | Concept film/depot explanation; D1 labels four-area links | No simulator run state | No run result | No run state | Film pauses off-page | Route errors use quarantine page | Film poster/status fallback | Not applicable |
| Fleet day (`fleet-day`) | Question/settings/map; D1 adds empty Result summary and identity | Existing status/buttons; D1 summary remains tied to prior run | Cards/details; D1 adds top partition, focus, paused replay | Prior result/context preserved; D1 identity stays result-bound | Navigation pauses; pending invalidation cannot autoplay; no new cancel mechanism | Existing alert, no accepted new result | No prior result/last-run setup gives explicit absence | All zero partition; no invented primary or success |
| Austin (Fleet day panel) | Synthetic graph/config; D1 identity/share inside panel | Existing status/cancel | Exact run and paired tables; D1 adds readable analysis and resource context | Stored results retained and marked previous settings | Existing cancellation with last-completed retained | Existing error/invalid comparison; no accepted analysis | Single seed descriptive; missing guardrail explicitly not evaluable | Existing unavailable required metric path, never success |
| Launch (Fleet day panel) | Template/config; D1 adds h2/identity/share | Existing pending status | One-seed commissioning comparison with result version | **Discard on edit** remains; show current template/version | Pending invalidation discards incomplete output | Named setup checks or invalid comparison | Existing explicit no-compatible-comparison text | Existing null fractions/population counts |
| Street lab (`street-lab`) | Preset/settings/network; D1 identity | Existing status | Existing result section; D1 focus and paused replay | Prior run retained with stale warning; identity remains run-bound | Navigation pauses; no new execution cancel seam | Existing validation/status | Existing comparison/setup absence | Zero counts; unavailable duration populations |
| Four-area workbench (`experiments`) | Declared capacity example/spec; D1 name/identity | Existing experiment progress | Existing verdict/guardrails/paired view, spec version | Existing verdict-stale context; retain result identity | Existing experiment cancellation | Existing invalid input/evidence panel | Existing unavailable metric state | Existing instrument semantics, unchanged |
| Four-area workspace (`regional`) | Sandbox; D1 name/identity | Existing runtime status | Existing recorded replay/inspection | Existing stale-run state | Existing runtime cancellation | Existing runtime/error state | No recorded run view | Existing zero demand accounting |
| Guided walkthrough (`walkthrough`) | Prepare/chapter controls; D1 four-area identity | Existing Prepare runs | Existing prepared chapters/readouts | Existing presenter state | Existing runtime/presenter cancellation | Existing preparation failure | Not prepared readouts | Not a distinct population; inherits prepared model |
| Learning catalog (`catalog`) | 56 lessons/search/filter; D1 four-area labels | No simulator state | Filtered cards | Not applicable | Not applicable | Invalid lesson routes quarantined | No matching lessons message | Zero matching cards, not simulation success |
| Product approach (`approach`) | Editorial content; D1 non-affiliation line | No simulator state | No run result | Not applicable | Not applicable | Invalid route handled separately | Not applicable | Not applicable |
| Route error | Explicit recovery link | Never executes | Remains error until recovery | Does not relabel hidden outputs | All players paused | Named invalid/mismatched link | No accepted setup | Not applicable |

Existing global boundary strip is retired in favor of accurate per-model headers, including the error path. No route is added. Other experiments remain on Fleet day, after collapsed learning content, Austin before Launch. Comparisons retain their separate existing semantics and become secondary actions.

## Setup-link compatibility inventory

| Setup model | Existing route/page | D1 control and focus | Serialization contract |
|---|---|---|---|
| `fleet-day` | `fleet-day` / `simulation` | Result summary sharing; summary heading | Same complete config/options/version envelope; no autorun |
| `launch-rehearsal` | `fleet-day` / `simulation` | Launch's own sharing; open panel and focus new h2 | Same template/config/delay and snapshots; no autorun |
| `regional-power` | `fleet-day` / `simulation` | Austin's own sharing; open panel and focus h2 | Same region/power/config/options and snapshots; no autorun |
| `street-lab` | `street-lab` / `streets` | Existing Street sharing and page heading | Same config/versions; no autorun |
| `regional` | `experiments` or `regional` | Existing sharing renamed Four-area experiments; workspace heading | Same sandbox/experiment mode/config/options; no autorun |

All 56 lesson IDs remain unchanged. Compatibility tests retain roundtrip behavior and add baseline encoding fingerprints for the five default setups. Route paths, page IDs and setup model IDs do not change.

## Motion and action inventory

- Bay, Street and film receive the store's effective preference (override first, system otherwise), while injectable factory options remain.
- Existing in-app motion controls live in the four-area application's footer. The studio hides that entire root outside workbench/workspace/walkthrough, so they are **not directly reachable from Fleet day, Street or Overview**. D1 propagates the chosen preference; moving/duplicating the control is outside this brief.
- Bay and Street runs remain paused. Reduced-motion Play advances whole minutes without interpolation. Film never autoplays when the effective preference is reduced; explicit Play remains a deliberate action.
- Fleet day's top Run is the single primary-styled action. Settings Run and comparisons use secondary style. Panel actions were already secondary.

## Byte tally

Limit: D1 growth **at most 11,264 bytes**, hence final offline size at most **2,554,919 bytes**, below the unchanged global 2,621,440-byte cap. Measurements are from the non-minifying packer. Independent presentation edits are integrated at measured checkpoints; source-byte changes are not substituted for package measurements.

| Checkpoint | Offline bytes | Cumulative change | Result |
|---|---:|---:|---|
| Unchanged baseline | 2,543,655 | 0 | PASS |
| Integrated D1 | 2,551,858 | +8,203 | PASS |
| Street focus review fix | 2,551,878 | +8,223 | PASS; 3,041 bytes below D1 limit |

Per-item source tally (the packer does not minify): model identity helper +524; Fleet day layout/partition/motion/actions +1,268; Launch identity/sharing +626; studio integration/relabels +1,439; routes +9; catalog +3; Austin verdict/identity/resources +3,448; Street focus/identity/motion +456; film motion +253 bytes. Source subtotal +8,026; packed module wrappers and encoding overhead +197; measured offline delta +8,223. No styles, media, fonts or dependencies changed. The final static package has 90 files / 3,189,179 bytes, including the new shared UI module.

## Test rewrite log

No tests deleted. Four existing expectations changed deliberately:

| Test | Change and reason |
|---|---|
| operations-lab: explicit run starts playback | Run now stays paused; explicit Play is required before pause/activity assertions. |
| street-lab: street replay is explicit... | Run stays paused; explicit Play still verifies cancellation on an edit. |
| street-sharing: shared settings cancel replay... | Explicit Play establishes the moving state before the existing load/pause assertions. |
| simulation-catalog: every registered regional preset... | Filter uses the authorized display name Four-area experiments; preset inventory assertion remains exact. |

Hero test setup now forwards the optional injected preference; existing behavioral assertions are preserved. Root red tests preceded presentation changes. Austin: initial 19 failures became passing behavior; a later same-policy wording test failed then passed. Street/film: initial 8 failures in 34 tests, then 34 passed. Independent review identified focus-induced Street scrolling; the added focus-options regression failed, then passed (9/9 Street tests) after `preventScroll:true`. No unrelated failures were waived.

## Validation, privacy and publication

Pre-deployment gates:

- `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs`: **1,827 tests / 245 suites; 1,826 pass, 0 fail/cancel/skip, 1 existing TODO**, 170,366.368625 ms. Baseline was 1,791 pass; 35 added passing tests. No isolated performance retry needed.
- Both `pack.mjs` / `check-dist.mjs` commands passed for static and offline output. Measurements above include the independent-review fix.
- Activated Python 3.11.15 and repeated the correct-worktree import check immediately before gates. `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py`: **89 passed in 5.31 s**. `PYTHONPATH="$PWD/src" python -m ruff check --no-cache .`: **all checks passed**.
- Independent D1 review: READY after the Street focus fix; no remaining actionable correctness finding. `git diff --check` passed.
- An additional non-PERF suite started by a delegate completed during integration: 1,809 pass, 2 expected performance skips, 1 TODO, no failures. It is not the release gate; the serial PERF result above supersedes it.

All pre-deployment gates and browser checks are complete. Part A is committed as `76439c617f6d647b7ad441834a37199f2ec68454`; D1 publication and post-deployment records are the next authorized steps. No deployment claim is made by this source-checkpoint record.

No new status document is introduced: this is the explicitly requested release record. Ongoing status remains in `HERMES_SOURCE_OF_TRUTH.md`.

### Browser evidence before deployment

Used the real Codex in-app browser over local HTTP, for native `playground/fleetlab/`, packed `dist/site/`, and the offline HTML. No fake-DOM result is presented as browser evidence.

| Check | Native | Packed |
|---|---|---|
| 1280×720 keyboard Run | PASS: focus Result summary; y=43 before/after; heading top415.67/bottom448.22 | Same observed result |
| Default partition and pause | 95 completed /176 unserved /4 waiting /9 in progress =284; Play button | Same |
| Street keyboard Run | Focus Result summary; y=149 unchanged; explicit Play works | Same |
| All five setup-model links | Generated through UI; own surface focused; no run on loading | Same payloads; fresh reloads confirmed no results/autorun |
| Austin 60% shift | 480/77/391/11/1 horizon row | Same |
| Austin 12-seed comparison | +0.19 points; 95% interval −0.24 to +0.62; UNCHANGED; unfinished visits +0.33, allowance0 → HOLD | Same |
| Effective reduced motion | On selected in Four-area control; Street clocks advance only at whole minutes (16:00→16:15); Fleet07:00→07:12; film paused with no source download | Street16:00→16:19; Fleet07:00→07:15; explicit playback required |
| 400×812 keyboard Run | Focus summary; y=192 before/after; heading495.55–528.09 visible | Same |
| Console errors | None | None |

The browser initially scrolls while placing keyboard focus on Run (43px desktop,192px mobile); **activation and result completion cause no further scroll**. Heading and partition are visible without a user scroll. The native and packed implementations share identical layout measurements. The offline HTML over HTTP also produced the default partition, focused summary, paused replay and no console errors at1280×720.

The supported browser interface exposes viewport controls but no system-media emulation. Browser reduced-motion testing therefore used the actual in-app override, the authoritative effective preference; automated tests separately cover system-on/override-off and system-off/override-on. This is a disclosed test-method deviation, not a claim of OS media emulation. No separate browser, physical mobile device, assistive technology or direct `file:` loading was tested. Viewport overrides were reset after checks.

### Privacy and deviations

Privacy scans are reviewed before each commit and push. No new credentials, private owner data or absolute home-directory paths are permitted in the publication diff. Exact dispositions will be added below.

D1 items landed in parallel and were measured at integration checkpoints rather than repacking after each isolated source edit; the source tally above attributes every item and final packed size remains within budget. One extra non-PERF suite ran during integration; the required serial PERF suite is the acceptance record. The reduced-motion browser method is disclosed above. No authority, dependency, model behavior or release scope was expanded.


Part A staged privacy scan: **zero pattern hits and zero added credential-token mentions**. V2 first line, 19 fixture groups, required owner/F/G/R coverage and computed key/arithmetic values were checked; v1 hash matched. An independent bounded contract review found the F2 population/window wording and G3 executed-distance window issues, both corrected. V2 SHA-256: `da7b80690711116dc7a11874db4199468f2581ab6c5e87d4251698ead48d383d`. The ignored probe `node artifacts/fleetlab-n2-s0/fixture-values.mjs` was re-run; no N2 simulation was executed.

D1 source staged privacy scan: **zero pattern hits**. Added `token` matches are benign: Launch invalidation and destruction counters; Austin invalidation, pending-result comparison and destruction counters; and this privacy documentation. Each is an existing local cancellation/generation mechanism or explanatory prose, not an authentication value. No unapproved hit remains.
