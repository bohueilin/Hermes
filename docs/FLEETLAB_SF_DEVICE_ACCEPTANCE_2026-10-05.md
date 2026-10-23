# SF connected-device observations — October 5th, 2026

**PARTIAL. Physical Pixel automation performed; human accessibility and visitor acceptance remain open.** This supersedes the connection status, not the historical observations, in the [October 4 worksheet](FLEETLAB_SF_DEVICE_ACCEPTANCE_2026-10-04.md).

## Identity and method

Tester: Codex, automated interaction and visual inspection on physical hardware. Pixel 10 Pro XL, Android 17 / SDK 37, Chrome 154.0.8037.92; physical resolution 1080 × 2404, density 390. Initial OS font scale 1.0, portrait; America/Los_Angeles. Device serial and unrelated personal content are excluded.

Baseline was the public v10 viewer, release SHA-256 `4a2fd0ce412c1b0ba14a73776ccbd11ece909de86ba661c3847290aceb192590`, served at `/city-explorer/releases/4a2fd0ce412c1b0b/`. The stable entry selected that release. Corrections were tested in a local HTTP QA clone of those bytes with the current `web/style.css` and `web/index.html` overlaid, accessed on the phone through ADB reverse port 4185. That clone is a test overlay, not an immutable release. Final published identities and readback belong in the dated handoff/release evidence.

ADB injected taps, swipes and orientation settings; UIAutomator captured visible accessibility labels, and direct device screenshots were visually inspected. This is physical-device evidence, but it is not a human-finger usability test, real physical rotation, pinch gesture or spoken TalkBack evaluation. The Mac mirror became stale; it was not used to establish the subsequent observations. Screenshots were captured directly with ADB instead.

## Observed results

| Check | Actual observation | Status / scope |
|---|---|---|
| Atlas navigation | Start → City atlas; v1, earlier v2 and time-aware v3 selectors respond. Candidate maps correctly retain limitations and do not change replay data. | PASS, injected touches on hardware |
| Street detail | Plus/minus and pan; 500-foot scale and named 16th Street / 3rd Street / Nelson Rising Lane; tapped road inspector says snapshot geometry, access not verified. | PASS for those controls; real pinch NOT_RUN |
| Depot/attribution layout | Separate map, legend, fictional-depot control and attribution. One-depot A recording shows its red square. | PASS for inspected A state; full A+B playback sequence still needs worksheet completion |
| Vehicle selection | Featured EV-009 selection and return to EV-001; fleet aggregate remains a whole-recording summary. | Hardware interaction captured; not 100 independently qualified vehicle types |
| Play/Pause/end/restart | Direct Play advanced without Reload; Pause stopped; end seek showed 15:00; Play restarted. | PASS for original seed 1001 / A / EV-001 |
| Exact event seek | 09:36:29 Waiting for a charging port; held position sample 09:36:15 / Generic turnaround, energy 19.02 kWh. | PASS, distinct event versus pose times |
| Whole-shift details | 56 operational history rows span 07:00–15:00; omitted energy/checkpoint rows explicitly disclosed. EV-001 has 4 completed trips, 29.85 miles, 25.5% empty distance and ends charging. Unmodeled safety and unset revenue remain unavailable. | PASS for inspected recording, not every trace |
| Fleet summary | 627 completions; median 4 / mean 6.27 / range 2–15; 42.7% empty distance; 394.5 / 800 vehicle-hours queued. | PASS, visual inspection |
| Landscape | Injected orientation changed atlas layout; controls remained usable; returned to portrait. | PASS for atlas; physical rotation/replay landscape remains human follow-up |
| Enlarged text | OS font scale 2.0 inspected and returned to 1.0; Chrome page zoom 200% exposed navigation overflow, map-button collision and depot-select clipping. | Initial FAIL, retained evidence |
| Corrected 200% layout | Navigation wraps; map-layer buttons stack without reset/zoom collision; depot option now shows `A + B · two` in full. +1.11 pp / interval / +2 pp threshold remain readable. | PASS for inspected corrected states; not a comprehensive accessibility certification |
| Desktop reflow | Five views at 240×844, 390×844, 844×390, 1440×900; no document horizontal overflow; all navigation buttons within viewport. | PASS, browser viewport checks, distinct from physical hardware |
| Keyboard and assistive speech | No new complete desktop keyboard traversal or actual TalkBack/desktop-reader spoken-output session captured. | NOT_RUN this session; do not infer from the accessibility tree |
| Independent visitors | No P1–P5 responses or independent scorer records supplied. | NOT_RUN |

## Reproduced defects and corrections

The navigation flex row could not wrap. Single-column grids used a min-content floor that forced narrow pages wider; a decorative capacity diagram remained horizontal. At 200% zoom, the map segmented control shrank beneath its fit button; the native depot select extended outside its card, and its long option hid the depot B suffix.

Corrections allow navigation wrapping, use `minmax(0, 1fr)` where needed, stack the capacity diagram and map-layer controls at very narrow widths, allow long headings to wrap, constrain the select, and shorten **both** atlas/replay option labels while preserving A versus A+B meaning. No map, trace, metric, experiment, qualification rule or rendering fidelity changes.

Repeatable browser regression: open each of `#welcome`, `#atlas`, `#replay`, `#models`, `#compare` at the four recorded sizes; confirm `documentElement.scrollWidth === clientWidth`, navigation bounds, visible map-control separation and select contents. Scrollable data tables are intentionally local regions. Phone retest must use actual Chrome 200% zoom, not only a narrow emulated viewport.

## Evidence and exclusions

Local generated evidence: `build/fleetlab-city/validation/pixel-sf-20261005/`. Key files: `08-map-road-inspection.png`, `11-atlas-landscape.png`, `18-play-a-advanced.png`, `19-paused-a.png`, `20-end-a.png`, `21-restarted-a.png`, `26-event-seek.xml`, `27-exact-event-state.png`, `29-public-zoom-200-setting.png`, `33-threshold-200.png`, `35-map-controls-200.png`, `36-map-controls-200-fixed.png`, `37-depots-200-fixed.png` (intermediate, option still truncated), `38-depots-200-final.png`, `navigation-red.json`, `reflow-green.json`.

`31-notebook-200.png` was an unknown `#notebook` hash falling back to Start; it demonstrates the navigation failure, not Decision notebook. `17-playing-a.png` is an unsuccessful first tap, not playback evidence. The early mirror image was stale. A transient unrelated-app screenshot was deleted and is excluded. Evidence filename alone never establishes a pass. No personal notifications, account pages or unrelated device content are intended as review artifacts.

## Remaining human session

Use the [full worksheet](FLEETLAB_SF_DEVICE_ACCEPTANCE_2026-10-04.md) on the final immutable release: actual pinch and finger targeting; A+B play/pause/end/restart; portrait/landscape during replay; 200% state/sample/revenue checks; keyboard focus/slider traversal; **actual announced words** with TalkBack and a desktop reader. Record errors and assistance rather than converting untested items into a pass. This can be done by the owner or an accessibility tester; map-semantic independence is a separate requirement.

**Recommendation:** retain the hardware results and corrected layout, then complete the short human accessibility session.

**Top risks + mitigations:** automated taps mistaken for human usability → explicit method labels; screenshots mistaken for spoken output → record actual reader announcements; live site changes → bind each follow-up to immutable release SHA.

**Next 3 actions:** test the remaining interaction rows; capture and resolve accessibility issues; attach results to the owner's SF acceptance decision.
