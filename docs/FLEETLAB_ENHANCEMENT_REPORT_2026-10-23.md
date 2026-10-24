# FleetLab enhancement round — October 23, 2026

The presentation enhancements, six approved media assets, scoped share images and D-1–D-8 are implemented or verified locally. The owner explicitly approved the proposed media allocation, then chose **“Use A2; hold V1 for a rerender.”** Fleet day therefore uses FL-A2 as its still hero. FL-V1 remains outside the product build.

All three supplied videos were compressed below 1,200,000 bytes and stripped of audio. V2/V3 are installed with poster-first, lazy, viewport/global/reduced-motion handling. Their full ten-second sequences retain visible loop joins; seamless trimming could not be established as written. No publication occurred.

## 1. Per-item report

“Done” below means implemented and verified in the local development build, not published. “Could not implement as written” identifies a specific remaining constraint. The approved scope is the enhancement spec; the earlier defect-only scope was superseded.

| Item | Status | Result |
|---|---|---|
| FL-A1 | **Done** | Home People band uses A1 as the V3 poster; About uses A1 beside the named users. Exact role copy, alt and concept fence are retained. |
| FL-A2 | **Done** | Fleet day hero and Home/Fleet day OG/Twitter image. Exact §2.2 alt, caption and concept fence. The owner selected this still and held V1. |
| FL-A3 | **Done** | Decision notebook head, before the comparison/table, with the mandatory §2.3 caption and fence verbatim; City OG/Twitter image. |
| FL-A4 | **Done** | Capacity hero with exact caption, alt and fence. The existing resource schematic remains present. Optional hub reuse was not needed. |
| FL-V1 | **Could not implement as written — owner-held** | Compressed to 766,594 bytes; reviewed in situ and captured at verified playback times. Owner chose HOLD for rerender after seeing ghosting and the dark endpoint. No product placement. |
| FL-V2 | **Done; seamless trim could not be implemented as written** | Compressed to 577,249 bytes and placed beside the distance-without-a-rider schematic. Exact heading/caption/alt/fence; full-frame derived poster; global motion controls apply. |
| FL-V3 | **Done; seamless trim could not be implemented as written** | Compressed to 502,747 bytes in the Home People band, with FL-A1 poster and the exact full band copy. Global motion controls apply. |
| E-1 | **Done** | Existing pod-car mark survives asynchronous startup and SPA remounts. Hosted header/footer and existing favicon use the pod identity. No replacement logo asset. |
| S-1 | **Done** | Existing first-person sentence moved directly below the unchanged “Explore the work between the rides.” headline. Both strings preserved verbatim. |
| S-3 | **Done** | “The 15-minute tour” on Home and About, ordered Walkthrough → Dispatch lesson → City Explorer notebook. Retained the About synthetic-example qualification verbatim. |
| S-4 | **Done** | Designed `/network-flows/` hub with five-stop journey strip, responsive layout, existing question headlines/descriptions, and explicit limits. Optional FL-A4 reuse was not needed. |
| E-4-scoped | **Done** | Home and physical Fleet day share entry use A2; City uses A3. Fleet day/City descriptions and nine-entry sitemap are present. Hash routes cannot return distinct server-side metadata; the physical Fleet day entry is the share destination. |
| D-1 | **Done** | `/network-flows/` serves the designed hub instead of the branded 404. |
| D-2 | **Done** | `/network-flows/ota-sharing/` serves a static redirect plus accessible fallback link to `/network-flows/software-delivery/`. Verified browser arrival. |
| D-3 | **Done** | Logo decoration now runs after asynchronous mounts and remounts, with idempotence. Repeated catalog/navigation coverage passes. |
| D-4 | **Done — verified already correct** | The reported ambiguity was not reproduced in current public/local Home and About. Exactly one destination has `aria-current="page"` and its active treatment; Explore is unhighlighted on those routes. No speculative CSS change. |
| D-5 | **Done** | Removed the second consecutive film eyebrow. Retained the existing section heading. |
| D-6 | **Done** | `#/scale` resolves to the existing Scale lab; supported query parameters retain their existing validation. Browser shows the density ladder without a link error. |
| D-7 | **Done** | Singular “1 more trip” / “1 fewer trip” in the presentation formatter and both frozen-viewer surfaces: paired table and selected-pair replay narrative. Numbers and the one-repeat qualification are unchanged. |
| D-8 | **Done** | Fleet day and City descriptions are present in physical HTML. `sitemap.xml` lists nine physical entry URLs; no fragment routes or retired alias. The Fleet day entry retains its existing redirect and canonical reference to `/#/fleet-day`. |

### Invented or adapted, disclosed

- **Invented editorial copy:** hub eyebrow “NETWORK FLOWS · FIVE CONNECTED QUESTIONS”; lead “Follow the work from depot capacity to the next rider. Each lesson asks one question, compares choices and keeps the trade-offs visible.”; journey connectors “Find the constraint”, “Share the work”, “Choose the order”, “Position the fleet”, “Meet the rider”; limits heading “Read the limits with the result.” The hub headline, lesson questions/descriptions, and honesty statements reuse existing copy.
- **Invented metadata descriptions:** Fleet day: “Run a synthetic fleet day, change fleet and depot capacity, and inspect service, energy and queues together. Simulation only; no operational authority.” City: “Explore sourced San Francisco streets and inspect recorded synthetic depot experiments, paired results and map qualification gaps. No operational authority.” Hub: “Five questions about getting a fleet ready: shared capacity, software delivery, delivery order, empty travel and dispatch. Synthetic teaching models with explicit limits.” Home's existing descriptions remain verbatim.
- **Derived asset:** a full-frame FL-V2 poster at 2.000 seconds, JPEG, 118,144 bytes, because no V2 poster was supplied. It is installed and counted in the approved media allocation; its rider remains visible.
- **Adapted review delivery:** a loopback-only server injects FL-A2/FL-V1 into Fleet day's pre-run area and adds clearly labeled frame-review controls. It is excluded from source/upload allowlists and the product budget; it is not a substitute for production placement.
- No new lesson, model, fixture, numerical study, Story/Lab mode, verdict card, atlas plate, D-06 placement, or fabricated result.

## 2. Budget headroom before and after

All figures are exact bytes. The original four artwork groups were measured before placement and had zero free file slots; the initial delivery therefore deferred the new assets. After review, the owner approved precisely three changes: a new **8-file / 4 MiB** enhancement-media allocation, **17 MiB** aggregate non-City ceiling, and **544 KiB** capacity text closure. All other limits and existing artwork allocations remain unchanged.

| Artwork group | Used before → after | Fixed byte ceiling | Free bytes before → after | Files used / ceiling | Free slots before → after |
|---|---:|---:|---:|---:|---:|
| Diagram media | 510,436 → 510,436 | 524,288 | 13,852 → 13,852 | 4 / 4 | 0 → 0 |
| Brand media | 623,114 → 623,114 | 2,097,152 | 1,474,038 → 1,474,038 | 7 / 7 | 0 → 0 |
| Tile media | 1,990,494 → 1,990,494 | 2,097,152 | 106,658 → 106,658 | 19 / 19 | 0 → 0 |
| Rebalancing media | 1,983,799 → 1,983,799 | 2,097,152 | 113,353 → 113,353 | 4 / 4 | 0 → 0 |

| Approved new allocation | Used before → after | Ceiling | Free before → after | Files used / ceiling |
|---|---:|---:|---:|---:|
| Enhancement media | 0 → 2,685,422 | 4,194,304 | 4,194,304 → **1,508,882** | **7 / 8** |

The seven installed files are A1–A4, V2, V3 and the derived V2 poster. V1 is excluded by the owner's decision. Its compressed 766,594 bytes would fit the reserved eighth slot, but this is headroom only, not permission to use that version.

| Additional constrained surface | Ceiling before → approved | Used before → after | Free before → after |
|---|---:|---:|---:|
| Raw teaching source/tools | 3,153,920 unchanged | 3,140,931 → 3,141,737 | 12,989 → 12,183 |
| Legacy teaching text | 2,621,440 unchanged | 2,603,650 → 2,603,672 | 17,790 → 17,768 |
| Offline edition | 2,571,440 unchanged | 2,564,068 → 2,564,099 | 7,372 → 7,341 |
| Package metadata | 40,960 unchanged | 37,684 → 37,626 | 3,276 → 3,334 |
| Integrated emitted text | 3,145,728 unchanged | 3,115,617 → 3,141,489 | 30,111 → **4,239** |
| Capacity dependency closure (NF-03) | 524,288 → **557,056** | 523,841 → 537,301 | 447 → **19,755** |
| Aggregate non-City generation | 14,360,576 → **17,825,792** | 12,879,001 → 15,600,377 | 1,481,575 → **2,225,415** |

The before column uses original limits; after uses only the explicitly approved changes. Under the new ceilings, pre-placement NF-03 headroom was 33,215 bytes and aggregate headroom was 4,946,791 bytes. This distinguishes added capacity from media consumption.

Before measurements combine current-source raw/legacy/offline checks with the retained verified integration baseline; pre-existing runtime/deployment edits were already present. After measurements use production accounting/transform APIs with explicit **DEVELOPMENT_MEASUREMENT_NOT_RELEASE_BOUND** metadata. This is a development projection, not an exact-commit release receipt. Rebuild and remeasure an authorized source-bound release before publication. No release guard was weakened.

An early, pre-approval implementation exceeded the former capacity closure by 26 bytes. Leading-indentation removal in two shared modules recovered room without changing JavaScript tokens, line boundaries or comments; equivalence checks passed. The later explicit approval supersedes that old limit only where recorded above.

Evidence: `baseline-budget.json`, `approved-budget-comparison.json`, `media-development-budget.json` and `whitespace-check.json` under `build/fleetlab-city/validation/enhancement-20261023/`. The approved media group is included in package source ownership, hash validation, route closures and aggregate accounting.

## 3. Compression and motion

| Video | Input bytes | Compressed bytes | Reduction | Output |
|---|---:|---:|---:|---|
| FL-V1 | 2,603,623 | **766,594** | 70.56% | 1440 × 608, 10 s; held |
| FL-V2 | 2,395,171 | **577,249** | 75.90% | 1280 × 720, 10 s |
| FL-V3 | 1,850,063 | **502,747** | 72.83% | 1248 × 704, 10 s |

All outputs: H.264, 24 fps, yuv420p, CRF 28, slow preset, fast-start metadata, **zero audio streams**. Each is below the strict decimal limit of 1,200,000 bytes. Originals are preserved; output hashes and stream evidence are in `media/compression.json`. Combined compressed video size: 1,846,590 bytes.

**Could not implement the seamless trim as written:** no shorter seamless segment preserving each full teaching sequence was established. All ten seconds were retained. V1 has an obvious restart discontinuity; V2's start/end positions and rider occupancy differ; V3 has a modest gesture jump. None is certified seamless. V2/V3 are installed with this disclosed limitation; V1 is held.

The installed V2/V3 controller starts with the poster, assigns the video source only when the media visual enters the viewport and motion is permitted, and enforces muted/loop/playsinline with no eager autoplay attribute. Leaving the viewport, hiding the page/route, global Pause visual motion, or reduced motion returns to the poster. Captions remain HTML and readable. Rejected or stale play promises also return to the poster.

Browser checks confirmed both videos initially had no `src`, played only after entering view, and returned to their posters under the global control. All videos present on the rebalancing page were paused by that control. Eleven focused motion tests cover reduced-motion state and changes, viewport visibility, hidden/detached routes, remounts and play races. An OS-level reduced-motion browser emulation was unavailable; this behavior is covered by controller tests and source inspection rather than a claimed OS screenshot.

## 4. FL-V1 owner flag

**Owner decision: HOLD for a rerender; use A2.** At 4.00 s the moon is doubled and the scene ghosts. At 9.958 s the left portion is nearly black; restarting to dawn is conspicuous. Compression does not resolve these source defects.

The local server was corrected to support byte-range requests before the screenshots below were taken. Requested and actual media times were checked; the earlier frame-zero captures were replaced. Eight full/ranged/error HTTP cases pass. The overlay includes the exact §2.2 caption, alt text and concept fence; labels are HTML, with no media lettering added.

- [Review-only Fleet day placement](http://127.0.0.1:4191/#/fleet-day) — use “Show transition · 4.00 s” and “Show endpoint · 9.96 s”.
- Screenshots: `screenshots/fl-v1-transition-desktop.png` and `screenshots/fl-v1-endpoint-desktop.png` under the validation directory.
- Budget approval is recorded, but the owner explicitly rejected this V1 version for product placement. A rerender should remove the transition ghosts/doubled moon and dark endpoint, retain a usable loop, and undergo the same compression and in-situ review. No rerender has been generated in this task. The review overlay cannot be uploaded as a release.

## 5. Live local verification and mobile checks

These URLs serve the current development preview on this computer. The public site was not changed. The source-bound packaging guard intentionally rejects uncommitted source; it was not bypassed to produce an upload-ready bundle. The preview reuses the frozen City evidence and verifies scientific files remain byte-identical; no studies were regenerated.

| Surface | Live local URL | Result |
|---|---|---|
| Home | <http://127.0.0.1:4190/#/home> | **390 × 844 checked**: founder under unchanged H1, tour, pod mark and new People band with full copy; V3 playback and A1 paused fallback checked; no page overflow. `media-home-390.png`, `media-home-people-390.png`, `media-home-people-paused-390.png`. |
| Fleet day | <http://127.0.0.1:4190/#/fleet-day> | **390 × 844 checked**: A2, full caption, pre-run controls and qualifications readable; no page overflow. `media-fleet-day-390.png`. |
| New hub | <http://127.0.0.1:4190/network-flows/> | **390 × 844 and desktop checked**: all five questions and links, journey sequence, limits; no page overflow. `media-network-hub-390.png`; prior `network-hub-journey-390.png` and `network-hub-desktop.png`. |
| About | <http://127.0.0.1:4190/#/approach> | 390 px checked: A1, exact tour and retained qualification, pod mark, only About active. `media-about-390.png`. |
| City notebook | <http://127.0.0.1:4190/city-explorer/#compare> | 390 px checked: A3 and its full mandatory caption/fence precede the comparison, 12 rows and corrected singular grammar retained; table scrolling stays local. `media-notebook-390.png`. |
| City replay | <http://127.0.0.1:4190/city-explorer/#replay> | Selecting pair 10 / seed 1010 displays “1 more trip” in the replay narrative and preserves the qualification. |
| Fleet day share entry | <http://127.0.0.1:4190/network-flows/fleet-day/> | Physical HTML has the new description and A2 OG/Twitter image. City entry uses A3. |
| Capacity | <http://127.0.0.1:4190/network-flows/capacity/> | A4 hero and exact caption; existing schematic retained. 390 px checked, no page overflow. `media-capacity-390.png`. |
| Rebalancing | <http://127.0.0.1:4190/network-flows/rebalancing/> | V2 beside the distance-without-a-rider figure on desktop, stacked at 390 px. Caption and original qualifications retained; viewport/global pause verified. `media-deadhead-desktop.png`, `media-deadhead-390.png`. |
| Retired alias | <http://127.0.0.1:4190/network-flows/ota-sharing/> | Arrives at the software-delivery lesson. |
| Scale alias | <http://127.0.0.1:4190/#/scale> | Existing density ladder opens without the link-error state. |
| Sitemap | <http://127.0.0.1:4190/sitemap.xml> | HTTP 200; nine physical entry URLs. |

Home, Fleet day, hub, About, notebook, capacity and rebalancing each measured `innerWidth=390`, `scrollWidth=375` (the remaining width is the browser scrollbar), with no page-level horizontal overflow. Notebook tables intentionally retain local horizontal scrolling. Fourteen new HTTP readbacks passed; all seven installed media hashes match the manifest and requested social-image tags are present. Browser console inspection returned no warnings/errors. New screenshots and seven DOM observations are in `screenshots/media-*`; prior defect/alias evidence is retained alongside them.

## 6. Validation, source ownership and handoff

| Command/check | Result |
|---|---|
| `python -m pip install -e ".[dev,workbench]"` in hermes-dev | Pass |
| `python -m pytest -q` in hermes-dev | **1,661 passed, 56 skipped** |
| `node --test apps/fleetlab-city/test/*.test.mjs` | **139 passed**, 0 failed |
| `node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs` | **2,433 passed**, 0 failed, 8 skipped, 1 existing TODO |
| City Python integration tests | **35 passed** |
| Focused capacity-site tests | **10 passed** |
| `python -m ruff check .` | Pass |
| Activated hermes-dev `python -m hermes doctor` | **17 PASS, 1 WARN** (dirty tree), **1 optional NOT_AVAILABLE** |
| `git diff --check` | Pass |
| Independent change review | Replay narrative grammar finding fixed in the first wave; media-wave review found no actionable defects. 20 focused media/motion/packaging tests passed; browser validation followed |

Regression tests cover delayed/remounted branding, founder/tour copy, aliases, singular grammar on both frozen-viewer surfaces, metadata, hub/redirect/sitemap inclusion, exact-caption placements, lazy/global/reduced motion, source ownership, and the three explicitly approved budget changes. The new static files are explicitly included in integration, source offers, ownership verification, and aggregate accounting. This is not an uncounted side directory.

Negative results retained: six new placement tests and new packaging/motion tests failed before implementation and passed afterward; the expected new presentation tests failed before implementation; the replay regression reproduced the missed second surface before its fix. The first full Hermes run had 1,660 pass / 1 fail / 56 skip because the required editable install generated ignored `src/hermes_autonomy.egg-info/PKG-INFO`, whose copied README violated the source-boundary scan. That generated directory was preserved in ignored validation scratch; focused boundary tests and the final full run passed. No source-boundary rule was weakened. Initial unactivated doctor warnings were resolved by invoking the activated environment; the dirty-tree warning remains expected.

Git remains on `codex/fleetlab-city-sf`, HEAD `6c1e3900dbc30426eb3e5a70cc42599849075f69`, with uncommitted edits. Existing TLS/runtime/deployment changes, owner specs and supplied assets were preserved. No staging, commit, push, PR, remote modification, merge, deployment, or publication. The historical Phase 6 instructions do not expand this explicit FleetLab scope; no review envelope, gate, verifier, evidence bundle, safety permission, or simulator adapter changed.

## Recommendation

Keep A2 as Fleet day's hero and V1 held for a rerender, as selected by the owner. Review the installed six media assets and presentation changes in the local preview. No additional media-placement decision is pending.

## Top risks + mitigations

- **Tight integrated text headroom:** 4,239 bytes remain under the unchanged ceiling. Rebuild and remeasure from the final authorized commit before a release.
- **Visible loop joins:** V2/V3 keep complete ten-second teaching sequences; do not describe them as seamless. V1 remains excluded until a corrected version is reviewed.
- **Preview is not a release:** source-binding and staging guards remain in place; publication requires the normal separately authorized workflow.

## Next 3 actions

1. Review the local A2 hero, People band, notebook, capacity and rebalancing placements.
2. Rerender V1 when desired, then inspect its transitions and loop before replacing the still.
3. Separately authorize a source-bound release and publication workflow when ready.
