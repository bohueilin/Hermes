# SF City Explorer UX v2 — implementation and validation

2026-09-29. This enhancement answers the owner's hands-on review of the City Atlas and Replay Studio. It changes presentation, replay controls, descriptive projections and validation tooling. The simulation engine, original input tapes, experiment specification, comparison gates and stored run bundles are unchanged.

## Inspect this version

- Canonical local preview: http://127.0.0.1:4173/#replay
- USB Pixel preview: http://127.0.0.1:4175/#replay (ADB reverse configured; USB connection required).
- Final package: `dist/city-explorer-v2-reviewed/`; earlier `dist/city-explorer-reviewed/` is retained.
- `dist/city-explorer-v2/` is a mutable QA prototype, not the release package. Its web files changed during inspection; its original release manifest must not be treated as current.
- Presenter guide: `docs/FLEETLAB_CITY_PRESENTER_GUIDE.md`.
- Actual logs/screenshots: `build/fleetlab-city/validation/ux-v2/`.
- Branch: `codex/fleetlab-city-sf`; base HEAD `7e1da7cb72ca0e08fe46ead83db07adfce0e757e` plus uncommitted source. No commit, push or public deployment in this enhancement pass.

## What changed

1. **Maps:** vector zoom to level 20, visible zoom/scale controls, local street labels, road-name inspection, route fitting, vehicle focus and interactive flat fallback. No external tile/font provider calls. Red square depots reflect the chosen configuration; replay includes source attribution. These improvements do not increase the positional accuracy or qualification of OSM roads.
2. **Readability:** small descriptions increased approximately two pixels, primary descriptions 15–18 px, mobile form inputs 16 px, adaptive cards and layouts. A mobile vehicle-facts crowding issue found in visual QA was corrected.
3. **Experiment explanation:** repeats named in plain language, seeds explained as reproducibility inputs, one controlled variable made explicit, all twelve paired lessons and all five separate stress cases exposed. Six audience perspectives frame discussion for Engineering, Product, Operations, Fleet Management, Sales and Depot Partnerships.
4. **Vehicle discovery:** four transparent selection rules replace the need to start with a 100-item list. All 100 IDs remain available under a disclosure. Changing the repeat, configuration or vehicle automatically loads its trace; overlapping requests cannot replace a newer selection.
5. **Replay:** Play restarts a loaded trace at the end. Clock time, elapsed shift and playback speed are separate. The full-shift route follows recorded traveled graph geometry; partial routes are clipped to traveled distance. Poses remain 15-second held samples with no invented interpolation.
6. **History:** all operational and state events plus the terminal event are retained. Queue intervals, activity totals and a complete timeline explain stationary vehicles. No latest-six-events truncation. The sidebar explains the current interval; summary totals cover the entire shift rather than changing while scrubbing.
7. **Summary:** completed pickup/drop-off trips, pickups, unfinished requests, total/empty miles, empty share, depot arrivals, unique sites, charging/turnaround starts and completions, charged energy and queue time. Cleaning, updates and repairs are not separately modeled. Safety/regulatory evaluation, injury crash rate, remote guidance and MRM remain unavailable.
8. **Revenue:** user-selected policy implemented: no estimate until all three fare rates are explicitly entered. Formula uses only completed-trip base fares, completed passenger miles and passenger time, before display rounding. USD gross-fare illustration only; no costs/profit/operator forecast, persistence or transmission.

The vehicle projection schema is `fleetlab.city-vehicle-view/1.1.0`; viewer compatibility is 1.1.0. Stored simulation/run schemas remain unchanged. The packager independently rechecks run verification, frozen inputs and the paired comparison before projecting vehicle summaries.

## Validation evidence

| Check | Observed result |
|---|---|
| New Python suite | 57 passing, including conservation, completed-versus-unfinished fare population, depot configuration, full horizon and deterministic selection fixtures |
| Node unit/controller suite | 11 passing, including replay restart, explicit fares, seed-selection overlap, gap handling and incompatible results |
| Fresh package verification | 34/34 recorded arms reverified during final packaging; comparison/protocol binding retained |
| Full projected-fleet audit | All **2,400** vehicle views checked across 24 fleet groups; completion, empty distance and queue totals match verified metrics; all timelines span eight hours; traveled route distance conserves; unavailable metrics remain null |
| Final release inventory | 4,886 files; all content hashes and size checks pass |
| Initial compressed transfer | 1,805,764 bytes, below 3 MiB; accounting, not a measured cold-load latency |
| Complete paired replay data | 9,546,202–9,848,483 compressed bytes including fleet indexes, below 20 MiB |
| Largest file / comparison | 22,272,149 bytes / 24,354 bytes; both under their ceilings |
| Legacy Python parity/boundaries | 89 passed in 5.14 seconds |
| Root Ruff / whitespace | Passed |
| Doctor | 16 PASS, 2 WARN (environment label, dirty tree), 1 optional NOT_AVAILABLE |
| Existing hosted/offline distributions | Both checkers pass; 99 files / 3,366,216 bytes hosted; 2,424,861 bytes offline |
| Legacy serial Node performance suite | **1,972 pass, 0 failures, 1 existing TODO**, 1,973 total; 279.94 seconds; unchanged thresholds |

## Actual browser observations

Inspected the painted Codex in-app Chromium UI at CSS viewports 1440×1000 and 412×915, with no page-wide overflow in the checked views. This is responsive desktop-browser validation, not an Android emulator or physical-device result.

- EV-001 baseline auto-loaded; 56 operational events, last event 15:00:00. Summary showed 4 completed trips, 29.85 total miles, 7.62 empty miles / 25.5%, one depot arrival, one charging session started but not completed.
- Seeking to End showed 15:00. Play restarted the same loaded recording and advanced to earlier shift time without a reload. Pause worked.
- Entering $3 base, $2/mile, $0/minute produced $56.47 illustrative gross fares. Clearing an input returned unavailable.
- Switching to candidate preserved EV-001, displayed A and B, and recorded 54 operational events through 15:00, ending in a charging queue at A.
- The map's vehicle-focus control rendered named streets; zoom buttons and scale were present. Flat map mode retained streets, route geometry and vehicle position, with pan/zoom controls.
- Rapid repeat changes followed by selecting EV-100 resolved to repeat 12 / seed 1012 / EV-100; the selected trace and summary agreed. The optional selector exposed all 100 IDs.
- Decision notebook retained all 12 pairs, 12 descriptive lessons, 5 sensitivities and the withheld city recommendation.
- Incompatible local fixture displayed its explicit reason and zero paired numeric rows. The missing-trace fixture displayed an explicit 404 / no-substitute message, disabled Play and cleared summary cards; no stale vehicle result remained.
- Normal inspected paths produced no browser console errors. Failure fixtures deliberately generate missing-resource errors.

Fresh independent read-only review found a pending-selection race in the notebook-to-replay action and missing attribution in replay. Both were corrected. The selection workflow has a new controller regression; replay visibly credits OpenStreetMap and DataSF.

## Physical device and human-validation boundary

The Pixel 10 Pro XL is USB-authorized. Device discovery identified Android 17. ADB reverse exposes the loopback preview without publishing or opening a LAN listener. The local open-source scrcpy helper was installed for testing; software-encoder mirroring produced video after the default display setup stalled.

**Physical interactive test remains pending unless a later addendum records actual results.** The Computer Use tool reports that macOS Accessibility and Screen Recording permissions are pending. USB access and caffeine do not grant those OS permissions. The owner was asked to complete the permission prompt or perform the explicitly listed Pixel checks manually. No physical-device pass, touch/pinch validation, TalkBack result or five-person comprehension result is claimed merely from USB/video connectivity.

Other unperformed checks: Safari/iOS and Windows devices, throttled cold-load latency, quantified frame/seek/selection percentiles, memory ceiling, hardware graphics-context-loss injection, OS reduced-motion preference and a five-person formative study. The explicit flat-mode path was exercised; automatic context-loss fallback is implemented but hardware failure injection was not performed.

## Recommendation

Use the improved local build for a guided SF product review. Keep map qualification and stronger operator conclusions blocked until the existing source/semantic issues are resolved. Review the presenter's questions rather than inferring production readiness from visual polish.

## Top risks and mitigations

- Source restrictions and district gaps: retain failed gates and UNASSIGNED outcomes; qualify importer semantics independently.
- Synthetic vehicle/revenue interpretation: transparent selection rules, entire paired results and explicit fare assumptions.
- Missing safety evidence: unavailable metrics and separated authenticity, authorization and deployment permission.
- Device/comprehension uncertainty: retain pending states until actual device and human observations are captured.

## Next three actions

1. Finish the Pixel checks or grant the pending OS permissions; check iPhone/Safari and accessibility next.
2. Run a small presentation/comprehension session using the presenter guide; record whether each audience can explain seeds, pairs, queues and model limits.
3. Resolve SF road-restriction/district qualification, then design the next charging/depot policy experiment before geographic expansion.

## Final readback and timing disposition

`FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs`
finished with 1,972 passing, zero failures and one existing TODO in 279.94 seconds. No legacy
threshold or test was changed. The previous intermittent failures remain historical evidence;
this successful serial run clears this run's regression gate, not a universal latency guarantee.
A pre-run process snapshot is retained; no other user's processes were terminated.

The original local URL was switched to `dist/city-explorer-v2-reviewed/` and read back in the
browser: EV-001 / baseline / repeat 01, depot A only, Play enabled, 07:00, revenue unavailable.
No console errors were reported on that final load. Both ports 4173 and 4175 serve this package.
Final web files match their source bytes. `final-projection-audit.json` contains the full-view
and release checks. Release manifest SHA-256:
`d3e6b1b58d37980f965f908a8f8ec6a8b70b66972ba6f719339a994fa56bc53f`.

Source overlay identity is recorded separately in
`build/fleetlab-city/validation/ux-v2/implementation-files.json`; the historical baseline
manifest was preserved as `previous-implementation-files.json`. The physical Pixel and
human-review items above remain pending; no owner result had arrived at this handoff.
