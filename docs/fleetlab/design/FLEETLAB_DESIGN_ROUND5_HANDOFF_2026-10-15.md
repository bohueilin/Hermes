# FleetLab Round 5 implementation handoff — October 15, 2026

Scope: the October 14 Round 5 audit, §2 P3 copy/layout/UX batch and §4 source trim. The owner's follow-up explicitly defers D-06 to the P2-3 visualization round and retains D-01, D-02, D-03 and D-05. No budget ceiling was raised. No model, fixture, numerical study, new lesson or P2 visualization was changed or added.

Runtime source: `8e4dbafff7df02fa236da070fe9d00bda159b433`, branch `codex/fleetlab-city-sf`, baseline `ff85e9d`. The same source-bound build is now published and verified below. Earlier GitHub/live publication authorization remains applicable to this bounded website release; the historical Phase 6 local-only rule does not redefine this explicitly authorized website scope.

## Item-by-item audit decisions

“Done” means implemented and checked, not proof of visitor comprehension. “Could not implement as written” identifies an absent or unconfirmed diagnosis or an explicitly deferred item. The replacement copy and layout decisions below are presentation choices; no numerical content was invented.

| Audit item | Status | Implementation or decision |
|---|---|---|
| Capacity: missing concept hero | Could not implement in this scope | Explicit P2-10 candidate; deferred. The existing code-built fixed-input system preview remains. |
| Capacity: empty initial bench and duplicate cards | Done, with bounded interpretation | The initial status tells visitors to choose Watch comparison to check records and follow a vehicle. Published totals remain immediately visible. After acceptance the duplicate four-card summary collapses into a reversible disclosure. Explicit reconstruction remains user initiated; no additional automatic study run. |
| Capacity: cryptic whole-run copy | Done | “Results for the entire run” and an explanation that replay shows individual moments. The actual observation is 90 minutes; no duration was inferred from the audit. |
| Capacity: V2V/uplink/site-feed definitions | Done for actual fields | Uplink and site feed are defined inline. Full-study copy explicitly says vehicle-to-vehicle relay is not modeled. No V2V column exists in this version. |
| Dispatch: unexplained boundary phases | Done for actual states | Defines PRE_DISPATCH, POST_BOUNDARY and OBSERVATION_END beside the control. These are the actual states, rather than the audit's PRE_EVENT/POST_EVENT. |
| Dispatch: chapter-six notebook dead-end | Could not reproduce | The alleged notebook sentence/destination is absent in the current source and browser. No notebook link was invented. |
| Dispatch: disabled controls while checking | Done | A labeled indeterminate progress indicator accompanies checking. It clears on acceptance, verification error and worker-startup error. No invented remaining-time estimate. |
| Dispatch: repeated chapter 02 and stray roster count | Done | Restricted chapter listeners/current-step attributes to chapter buttons, preventing the containing lesson from being marked as a second chapter. Balance copy explicitly separates Ready / idle, COD and VOR counts. |
| Software delivery: hidden D04 artwork | Done | Opens the existing artwork disclosure by default on software delivery, keeping its existing caption and collapse option. Delivery order retains its previous placement. |
| Software delivery: cards overflow | Done | Bounded the comparison grid, allowed cells to shrink/wrap, and made full-width rows span both columns. Desktop, intermediate and phone checks show containment. |
| Software delivery: duplicate accessibility nodes | Could not reproduce | DOM and native accessibility inspection expose one local-delivery sentence and one ledger. No speculative node removal. |
| Software delivery: jargon before explanation | Done | Hero defines artifact, WAN, cold shared cache and delta, and says this model sends the whole file. |
| Delivery order: “Tied” and service-position jargon | Done | Uses “One best order among 24” when unique and explicit shared-best wording when tied. Renamed the assignment disclosure to “Which vehicle gets each place in the queue?” The existing full-order disclosure lists every tied best order. “Boundary state” was not found in this surface. |
| Delivery order: missing persistent per-vehicle results | Already present; no P2 addition | Verified all four result rows remain visible after Show best without selecting a vehicle. Grouped lateness bars remain P2-4. |
| Delivery order: intermittent missing initial values | Could not reproduce; related label cleanup done | DOM and native accessibility expose 2/4, 178 s, 138 s and 378 s on fresh load. Removed a generated mobile label from the hidden table header; retained the existing published-result hint and pending/accepted behavior. |
| Fleet day: staffing unlock path | Done | Added “Review staffing settings” beside the disabled comparison. It opens, scrolls to and focuses Depot work model without silently changing the setting. |
| Fleet day: model-label legend | Done for actual label; remaining labels not present | Explains M1 where selected. S1/M2/M3 are not exposed as model choices in this version. S1 elsewhere denotes a service bay, not an interchangeable model label. No unsupported legend. |
| Fleet day: empty pre-run result sections | Done within P3 | Clearer instructions and a direct “Go to fleet-day settings” action. Numeric sample panels and sweep artwork remain P2-6/P2-11. |
| Depot flow: first-use uplink | Done | Defines the internet upload link and gigabits per second before the glossary. |
| Depot flow: Optional guess empty button | Could not reproduce | Named “No guess” select verified; no unnamed button in DOM/native accessibility. No speculative replacement. |
| Depot flow: inconsistent due-time phrasing | Done | Setup and crossed-priorities text consistently use “due at minute …”. |
| Experiments: repeated pre-run unavailable table cells | Done | The hidden pre-run table contains one labeled schema example, “What a finished row looks like · format example, not a result,” with descriptive field names and no fabricated counts. Existing Table toggle reveals it. A completed run restores the actual accessible table. Meaningful absence messages elsewhere remain. |
| Experiments: walkthrough and lookup preparation | Done | Displays progress using real completed/total counts where available and an indeterminate indicator where only busy state is known. No guessed runtime. |
| Rebalancing: disabled loading controls | Done | Labeled indeterminate progress during computation/checking; clears on success or failure. Full-run copy is distinct from replay moments. |
| Catalog: clipped topic scroller | Done | All nine topics use a responsive three-column desktop/two-column phone grid. Launch & recall is reachable and correctly filters to ten lessons. |
| D-06 placement | Deferred by owner | No replacement or cap increase. The supplied 138,568-byte asset exceeds the 13,852 bytes remaining in the diagram group; all four file slots are occupied. Queue with P2-3 when the owner revisits that budget. |
| P2-1 through P2-12 | Deferred | No P2 visualization, generated hero, sample-result panel or new lesson shipped. |

**Invented:** no simulation parameters, outputs, algorithms, notebook destination, diagram, measured duration or new lesson. New prose, nonnumeric schema-example labels and layout choices are documented above. Unreproduced audit observations remain requests for a concrete reproduction, not claims of completed repairs.

## Source-trim report

Recovered bytes compare actual UTF-8 originals before/after each cleanup, including new imports and shared definitions. They are not minifier or compressed-download savings.

| Area | Bytes recovered | Why removal/reuse is safe |
|---|---:|---|
| Delivery-order packaging | 3,330 | Reuses the existing hosted-route package implementation already used by R1/R3. Preserves schema, scope, ownership, complete inventories, page transform, source identity and digest checks; the shared helper is explicitly captured. |
| Unused map-placement helper | 257 | Removed the private, unreferenced `bestPlacement` helper; active placement uses the existing scored/global solver. |
| Shared depot presentation helpers | 219 | Consolidated identical table/disclosure/button builders with imports included. No model or verifier moved into UI. |
| **Gross recovery** | **3,806** | |
| P3 source additions consuming recovery | **3,327** | Copy, progress/accessibility fixes and layout. |
| **Net original-source reduction** | **479** | 3,153,469 → 3,152,990 bytes. |

Audit also considered inline map data, fixtures and legacy modules. Map arrays/fixtures are required data and remain unchanged. The 23,982 bytes of legacy profile/world-import modules still support historical parity validation; lack of browser imports alone does not justify removal. No source was moved to another owner to evade counting, and no payload was hidden in assets.

Separate counters for runtime commit versus baseline: test tree **+1,108 bytes**; hosted integration source **+201 bytes**; plan documentation **+2,700 bytes**; whole committed patch **+3,530 bytes**. Media delta **0**. Later handoff/receipt documentation growth is separate. The earlier Round 4 −57,602-byte patch mostly reflected smaller artwork and was not equivalent to reusable teaching-source headroom.

### Final source-bound package

| Counter | Actual bytes | Unchanged ceiling | Headroom |
|---|---:|---:|---:|
| Original teaching source and tools | 3,152,990 | 3,153,920 | 930 |
| Legacy emitted text | 2,619,639 | 2,621,440 | 1,801 |
| Integrated emitted text | 3,098,661 | 3,145,728 | 47,067 |
| Offline edition | 2,568,613 | 2,571,440 | 2,827 |
| Package metadata | 37,471 | 40,960 | 3,489 |
| Four concept diagrams | 510,436 | 524,288 | 13,852; 0 file slots |

Source-offer extracted bytes: 3,543,134; compressed: 974,206. All original-source, emitted, route-closure, media, metadata and offline gates passed. **The trim does not fund P2-1…P2-4.** No ceiling increase is assumed or authorized for a future round.

## Validation and negative results

- Final teaching suite: **2,414 passed, 8 skipped, 1 TODO, 0 failures** (2,423 tests).
- Hosted Node: **96 passed**. City Python: **345 passed**. Hermes: **1,661 passed, 56 skipped**. Ruff passed. Doctor: **17 PASS, 1 expected dirty-checkout WARN, 1 optional NOT_AVAILABLE**.
- Regression checks first failed for chapter-container selection and missing progress cleanup on worker creation failure, then passed after fixes. Test copy expectations changed; numerical fixture expectations did not.
- Early runs retained expected failures from obsolete copy assertions, including one escaped pattern, and a distribution copy check that rejected an em dash. Those are corrected. `teaching-release-tests.log` is the final all-passing teaching run; the earlier `teaching-tests-final.log` has one stale failure and must not be cited as passing.
- Fresh independent read-only code review found no actionable defects; it independently ran 111 focused dispatch/map/capacity checks plus related depot, rebalancing, packaging, delivery, walkthrough and operations suites.
- Browser: software artwork visible; comparison contained on desktop, 735 px and 390 px; one local-delivery sentence. Capacity summary open before acceptance, closed after acceptance and reopenable. Dispatch chapter two clicks retain one current button; real state/count text verified. Delivery-order published and accepted values remain intact, all four rows persist, Show best does not autoplay. Staffing jump focuses the setting without changing it. Experiment preparation displays actual progress and restores results. All catalog topics are accessible and filter correctly.
- `git diff --check` passed. No changes under teaching `src/model` or `src/data`. No physical Pixel or independent human qualification claimed. SF map/device/human gates remain separate and open.
- Source-bound pack, offline check, package proof, hosted transformation, integration check and upload guard passed for the exact runtime commit; **10,137 staged files** including `_headers`.
- Initial preview full readback matched 10,133/10,136 files; three requests returned HTTP status 000 with no response body (transport failure). The initial negative receipt is retained; a fresh full pass then matched all 10,136 files before production publication, with no site change.
- The first stable-production pass returned 404 for six new City Explorer record paths (10,130/10,136 matched). Immediate targeted checks matched all six on both stable and immutable production without changing or redeploying files. This is consistent with temporary hosting propagation; the cause is not independently established. Initial negatives and targeted checks are retained; the subsequent fresh full pass matched all 10,136 files.
- A smoke-receipt preparation script initially guessed a nonexistent city `app.js` path. It was corrected to map the exact prior receipt inventory to the new release prefix; this was a local validation-helper error, not a website change. The custom 404 page retains an expected HTTP 404 status.

Primary gates: `node --test playground/fleetlab/test/*.test.mjs`; hosted Node tests; city unittest discovery; `PYTHONPATH="$PWD/src" conda run -n hermes-dev python -m pytest -q`; the same environment for `python -m ruff check .` and `python -m hermes doctor`; `git diff --check`. Exact release commands are in `build-release.sh` (source-bound pack → distribution checks → package proof → hosted transform → integration → integrated proof → upload guard).

Commands and full output are retained locally under `build/fleetlab-city/validation/design-round5-20261014/`, including `build-release.sh`, `release-build.log`, `teaching-release-tests.log`, `city-release-tests.log`, `city-python-final.log`, `pytest.log`, `ruff.log`, `doctor.log`, source accounting and browser screenshots. The source-bound candidate is `/private/tmp/fleetlab-design-round5-20261015-release/integrated-release/site`.

## Publication

- Live: https://fleetlab.pages.dev
- Runtime commit: `8e4dbafff7df02fa236da070fe9d00bda159b433`, pushed to `github/codex/fleetlab-city-sf`.
- Production deployment: `8dd48282-3c63-4347-bd31-a7159244ff2e` — https://8dd48282.fleetlab.pages.dev.
- Preview deployment: `5cab4e51-169d-48c9-8a2f-cfce5354b67d` — https://5cab4e51.fleetlab.pages.dev.
- Final fresh full preview and stable-production passes: **10,136/10,136 served files each**. **69/69 header checks each**.
- Immutable production smoke: **100/100**. Prior immutable production smoke: **100/100** at https://12e199f4.fleetlab.pages.dev. The six initially unavailable production paths also passed targeted checks on both current production URLs.
- Final stable verification: `2026-10-15T07:27:50.836182+00:00` (October 15 Pacific).
- Live browser confirmed new explanatory copy, open artwork, successful record acceptance and all nine catalog topics; no observed console warnings/errors. Temporary browser-size overrides restored.
- Exact fingerprints and identities: `docs/releases/fleetlab-current.json`. The source archive and each route sidecar bind to the runtime commit. Documentation follows separately and does not change the deployed source identity.
- Source and media ceilings unchanged. No live code repair or second deployment was needed for the temporary readback failures.


## Remaining work and recommendation

Recommendation: retain the bounded P3 release and use this audit decision table as the next feedback baseline. No new city or numerical lesson work is started.

Top risks + mitigations: source/offline headroom remains tight; review P2 scope and each enforced counter before implementation. Unreproduced accessibility observations need route, viewport and steps from the reviewer. Synthetic illustrations and internally checked records remain distinct from real operational qualification.

Next 3 actions:
1. Review the live P3 changes for visitor comprehension.
2. Agree the P2 scope and explicit budget decision; keep D-06 paired with P2-3.
3. Continue independent SF map, physical-device and human reviews without treating this website release as satisfying those gates.
