# FleetLab Round 6 implementation handoff — October 15, 2026

Scope: P0 and P1 from `FLEETLAB_DESIGN_ROUND6_HUMAN_CENTERED_PROPOSAL_2026-10-15.md`, including its map spec and rewrite table. The owner's implementation request supersedes the audit's stale “review-only” sentence. Standing website publication authorization applies to this bounded FleetLab release; the historical Phase 6 local-only rule does not redefine that scope. No P2 editorial project, new lesson, model, fixture, numerical study or budget ceiling change is included. D-06 remains deferred.

Baseline: `b4ad093` on `codex/fleetlab-city-sf`; previous runtime `8e4dbafff7df02fa236da070fe9d00bda159b433`. Runtime commit: `ebc46c8cf0f61e13c27ef6b5b669b6b853b1e68d`. Publication evidence is recorded below. This handoff separates implementation, observed verification and unresolved audit diagnoses.

## Per-item decisions

| §7 item | Status | Implementation and limits |
|---|---|---|
| P0-1: six map labels | Done | Content-sized, single-line padded labels replace fixed width/height. Placement uses actual rendered dimensions, including the focused border, for viewport containment, collision checks and anchor leaders. Retained the 44 px minimum touch target. Six labels fit at default view on desktop and phone; rotation/zoom preserve anchor leaders. |
| P0-2: region-launch identity | Done | The lesson parameter drives the top title and teaching frame. The primary action opens/focuses the existing launch rehearsal; it does not run the unrelated default fleet model. Returning to ordinary Fleet day clears the lesson title. |
| P1-3: truncated paragraphs | Could not reproduce the reported diagnosis | Inspected all 18 Fleet day lessons at 1280 px and 390 px: full frame text, no paragraph clipping/ellipsis and no fixed-height/line-clamp cause found. No speculative CSS removal or sentence completion. The audit's quoted fragments are not stored source text. A concrete route/browser/viewport reproduction is still needed to establish a repair. |
| P1-4: definitions and four-count visual | Done | Defines completed, unserved, waiting and in progress before the first instruction. The stacked bar reads the accepted run's actual metrics. It only renders a partition when all four nonnegative integer counts sum to total requests. Missing, invalid, zero-request and stale results have distinct messages; no placeholder results. Visible count labels and swatches accompany the bar. |
| P1-5: primer template | Done | Removed the stray arrow and added literal spacing before “Visual primer” in the shared template. Fleet cycle opens by default. |
| P1-6: broken fleet-day path | Done | `/network-flows/fleet-day/` now serves a portable HTML meta redirect to `/#/fleet-day`, with canonical URL and accessible fallback link. This is not an HTTP 301/302. The source file, hosted transformation, integration inventory, proof and upload guard all bind the redirect; resealed tampering is rejected. |
| P1-7: rewrite table | Done for accurate/applicable rows; exceptions below | Exact requested prose is used where it describes the implementation. Dynamic storage quantities remain tied to the selected input. Two inaccurate rewrites are deliberately not shipped. |
| P1-8: smaller Fleet day frictions | Done for confirmed issues; empty-map cause unconfirmed | Added an HTML legend matching the renderer's actual activity colors and fictional depot symbol. Styled static metadata as plain labels; the comparison heading names its selected policy. Added explicit map refresh after route reveal. The alleged blank-map race was not reproduced, so this is defensive initialization, not a proven root-cause repair. Cars are absent before a run by design. Cleaning is clearly a bundled stress case; the existing two changes and numerical behavior stay unchanged. |

### §4.3 rewrite ledger

| Row | Decision |
|---|---|
| Overview trust sentence | Done, exact requested sentence. |
| Overview MAP QUALIFICATION OPEN eyebrow | Done: removed from the eyebrow; substantive map limitations remain accessible. |
| Catalog “contracts” list | Done: “teaching models,” with working destinations for staffing, charging, charger status, airport wave, launch rehearsal and the already-existing Austin power lab. No new Austin work or model. |
| Depot flow internal-consistency wording | Done, exact requested sentence in status and result summaries. |
| Depot flow computation 4.6 ms / seed 7 | Could not implement literally: this sentence and seed are absent from the inspected current surface. The existing verification disclosure is named “How this was checked.” No timing or seed was invented. |
| Crossed priorities | Done, exact requested sentence only for accepted results where shortest-upload-first actually has the maximum on-time count among the compared arms. |
| Experiments raw axis/config warning | Done: removed raw axis editing from the visitor form and uses the human knob label. Removed the obsolete claim that teaching-model axes cannot run. Current teaching-engine comparisons remain enabled when valid; actual validation failures keep the run action disabled with an unavailable-comparison reason. Validation and configuration internals remain intact. |
| Rebalancing VOR replacement | **Could not implement as written.** “In service” can mean passenger service, which belongs to COD, and R1 does not simulate charging or cleaning. Retained the accurate VOR boundary; no invented replacement. |
| Capacity equal-sharing replacement | **Could not implement as written.** Uploads share capacity simultaneously; they do not take turns in arrival order. Rotating whole-byte remainders do not make the scheduling policy sequential. Retained accurate existing text; no invented scheduler description. |
| Dispatch wait-time sentence | Done, exact requested sentence. |
| Software storage assumption | Done with input-bound numbers: exact 48 GB / 12 GB wording for the default; changing workload sizes changes the displayed assumptions. Hard-coding those numbers for every fixture/custom workload would be false. |
| Delivery-order objective | Done, exact requested sentence. |
| Fleet day four-count instruction | Done, exact requested sentence after definitions and real-run visual. |

**Invented:** no model inputs, numerical outputs, seeds, timing, scheduling semantics, illustrations or lesson. Required presentation choices include legend geometry, definition wording, responsive layout, unavailable/stale messages and the redirect's fallback text. These are UI choices documented above, not new simulation evidence. Exact approved sentences receive a narrowly scoped punctuation exception in copy checks; claim restrictions remain enforced.

## Validation

Evidence directory: `build/fleetlab-city/validation/design-round6-20261015/`.

- Meaningful red/green regressions cover measured label dimensions/anchor geometry, launch lesson identity and returning to ordinary Fleet day, and request partition rendering from the real simulator plus missing/invalid/zero/stale cases.
- Browser matrix: 18 lessons × desktop/phone, saved in `rendered-18-lessons.json`. Definitions and outcome bar have no horizontal overflow at 390 px. Native catalog setup navigation loads the existing Austin controls. The path redirect reaches Fleet day. No console errors observed in the inspected local pages.
- A fresh independent read-only review found no remaining actionable defects and independently ran 29 relevant tests. It identified a legend span-selector collision, which was fixed. Browser review found the persistent launch title on return, fixed with a regression.
- Early negative test logs are retained. Stale copy assertions were updated to the approved text; a test-only VM realm mismatch in offline parity was corrected to reconstruct JSON inside the VM, preserving production canonical-input checks. Accessibility tests retain the single-line exception specifically for measured map labels; no broad suppression.
- A release-helper invocation initially used the system Python 3.9 interpreter, which lacks `datetime.UTC`; no valid receipt was produced. The incomplete readback was stopped and the checks restarted with the existing Python 3.11.15 project environment. Negative logs remain; no application change was needed.
- No physical Pixel or independent human qualification is claimed. SF map, device and human gates remain separate and open.

Full teaching suite: **2,414 passed, 8 skipped, 1 TODO, 0 failures** (2,423 tests). Hosted Node: **96 passed**. City Python: **345 passed**. Hermes: **1,661 passed, 56 skipped**. Ruff passed. Doctor: **17 PASS, 1 expected dirty-checkout WARN, 1 optional NOT_AVAILABLE**. `git diff --check` passed. No changed paths under teaching `src/model` or `src/data`. Final source-bound package and publication results follow below.

## Source accounting

Removed an unused older 2D map renderer: **6,539 original bytes recovered** (6,821 → 282). Its only production consumer needed the retained shared color map; its two obsolete renderer tests were removed. The current 3D renderer's flat fallback, route positioning and selection remain covered. No code moved to another source owner or asset to evade a counter.

Final source-bound package:

| Counter | Actual bytes | Unchanged ceiling | Headroom |
|---|---:|---:|---:|
| Original teaching source/tools | 3,152,696 | 3,153,920 | 1,224 |
| Legacy emitted text | 2,618,152 | 2,621,440 | 3,288 |
| Integrated emitted text | 3,098,385 | 3,145,728 | 47,343 |
| Offline edition | 2,567,202 | 2,571,440 | 4,238 |
| Package metadata | 37,471 | 40,960 | 3,489 |
| Four concept diagrams | 510,436 | 524,288 | 13,852; 0 file slots |

Source-offer extracted bytes: 3,543,904; compressed: 973,879. Source-bound pack, offline/distribution checks, package proof, integration proof and upload guard passed; **10,138 staged files** including `_headers`. Media change: **0 bytes**. All ceilings remain unchanged. Original teaching-source headroom grows by 294 bytes versus the prior release; this does not fund the deferred P2 project.

Separate working-patch accounting before this handoff: teaching tree −242 bytes (−294 in counted original teaching source; remaining difference is architecture documentation), integration +980, tests +2,338, plan +1,926. Handoff/receipt documentation is additional repository growth and is not teaching-source headroom.

## Publication

- Live: https://fleetlab.pages.dev/#/fleet-day
- Runtime commit: `ebc46c8cf0f61e13c27ef6b5b669b6b853b1e68d`, pushed to `github/codex/fleetlab-city-sf`.
- Production: `7ce9ca8e-7dd4-4ec7-a990-99aad925d9ce` — https://7ce9ca8e.fleetlab.pages.dev.
- Preview: `9f10b94f-b2a7-467e-b49e-46e71b639325` — https://9f10b94f.fleetlab.pages.dev.
- Preview full readback: **10,137/10,137 served files**. Preview and stable-production hosting headers: **70/70 each**.
- Immutable production smoke: **101/101**. Prior immutable production smoke: **100/100**.
- First stable-production full pass: **10,095/10,137**. Forty-two new City Explorer record paths returned HTTP 404. Immediate targeted rechecks matched **42/42 on both stable and immutable production**, without any code change or redeployment. This is consistent with temporary propagation; the cause is not independently established. The initial negative receipt remains available.
- Final fresh stable-production full readback: **10,137/10,137 served files matched**, verified at `2026-10-15T17:49:37.595547+00:00`. No repair or second deployment was needed.
- Live browser verified the redirect, actual run partition and six contained map labels. Preview also verified all six labels at phone width, rotation/reset, launch controls and the accurate rewrite surfaces. No observed console warnings/errors. Temporary viewport settings restored.
- Local browser screenshots include `live-outcomes.png`, `preview-map.png`, and `outcomes-desktop.png`. They are UI evidence, not independent human qualification. The temporary local preview server is stopped and the clean release worktree is archived.
- Exact identities and file fingerprints are recorded in `docs/releases/fleetlab-current.json` after the final passing readback. Handoff/receipt documentation follows the runtime commit and does not change its deployed identity.

## Recommendation, risks and next actions

Recommendation: use this bounded P0/P1 release as the next visitor-feedback baseline. Keep the two rejected model-inaccurate rewrites out of production.

Top risks + mitigations: source/offline headroom remains tight; scope and measure future P2 work before implementation. Truncation and blank-map observations remain unconfirmed; request concrete reproduction steps instead of claiming them repaired. Synthetic consistency checks remain separate from real-world operational qualification.

Next 3 actions:
1. Review the corrected Fleet day lesson, labels and four-outcome explanation for comprehension.
2. Resolve the VOR/equal-sharing copy with accurate wording in a future editorial round; keep P2 and D-06 queued.
3. Continue independent map, physical-device and human review without treating this UI release as satisfying those gates.
