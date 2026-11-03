# FleetLab targeted design fixes — October 14, 2026

Scope: the owner's approved **FLEETLAB_CODEX_DESIGN_FIXES_ROUND3.md**, §§0–10. These are presentation and accessibility changes to existing educational lessons. No new lesson, model input, simulation algorithm or numerical result was introduced.

## Publication status

**Live, pushed and verified.** [Depot flow lab](https://fleetlab.pages.dev/#/depot-flow-lab?lesson=two-vehicles) · [Rebalancing](https://fleetlab.pages.dev/network-flows/rebalancing/).

- Runtime source: `c92dcd1f34f96342d9f0b8c424ad4f19a6c56a0a`, pushed to `bohueilin/Hermes`, `codex/fleetlab-city-sf`.
- Production: `94c48b5b-0500-4805-a984-e551d2fa0bcb`, [immutable release](https://94c48b5b.fleetlab.pages.dev).
- Preview: `627db2a4-3cbf-4b7d-91d1-a12f2463ee61`, [immutable preview](https://627db2a4.fleetlab.pages.dev).
- Preview and final stable production each match **10,133/10,133 served files and 68/68 header checks**. Production immutable smoke: **97/97**; prior production smoke: **94/94**.
- Final stable verification: `2026-10-15T04:47:57.929349+00:00` (October 14, America/Los_Angeles). Receipt: `docs/releases/fleetlab-current.json`.
- Prior production [769ad332](https://769ad332.fleetlab.pages.dev) remains reachable. These checks establish observed byte consistency, not authenticity or operational authority.

## Section-by-section disposition

| Section | Disposition | Implementation / evidence |
|---|---|---|
| §0, P0 video | Verified working; reported defect not reproduced | Investigated before other implementation. Both rebalancing videos serve HTTP 200 with video/mp4, decode as H.264/yuv420p, advance in the browser and support visible pause/resume. Muted, looping, inline playback and posters remain. The second player loads when its chapter opens. No speculative media replacement or deletion. The audit failure's cause is not established. |
| §1, Fleet day | Done | Readable accessibility values track the displayed numeric inputs, including while typing. Disabled staffing, policy, lifecycle and busy calculation buttons explain their actual prerequisites. D-03 appears in Staffing: workers versus bays with its caption and alt text. A staffing comparison was executed in the browser. |
| §2, Depot flow | Done | D-01 appears before the controls and is visible above the fold at tested desktop/phone sizes. First-use copy says shared internet link and expands Gbps. Existing lesson tabs are more prominent. The base hash URL normalizes with replaceState to `#/depot-flow-lab?lesson=two-vehicles`; explicit crossed-priorities links remain distinct. Re-entering the same lesson retains its result. |
| §3, Crossed priorities | Done | D-02 sits beside the setup copy. The diagram updates when the lesson changes without duplication. Chart legend is shorter; onward links state the question taught by Scheduling or capacity? and One update, four vehicles. |
| §4, Rebalancing | Done, with §0 qualification | Plain loading and manual-checking copy. Four zone groups show median/p95 bars for Reactive and Forecast on a common scale, next to the existing table. All 16 values match accepted records. Missing values remain unavailable rather than zero. The table and bars fit on desktop and stack on phones. |
| §5, Dispatch | Done | Closest-first and Planned together are public names; Request scenario replaces Workload. Explicit operations takeaway explains missed pickups and empty travel. Internal policy identifiers, information limits, fixtures and numerical outcomes stay unchanged. Animated side-by-side remains deferred. |
| §6, Delivery order | Done | Copy distinguishes the default First come order from pending edits. Plain-language comparison progress. Browser test confirms reordering preserves displayed outcomes until Compare accepts the order. Per-vehicle wait bars remain deferred. |
| §7, Experiments | Done | Start here marks the walkthrough. Four-area rationale and mode help explain the learning purpose. Paired-comparison controls explain invalid/busy states. The default paired test is enabled; the audit's disabled default was not reproduced. Live status announces the actual mode. Preparation honestly states that it replaces the current experiment with the walkthrough example. |
| §8, Global wording | Done within §10 fence | Results verified retains an explicit model-consistency-only qualification. Smallest meaningful difference explains the fraction/percentage-point unit. Run the paired comparison replaces Freeze and run. Protected capacity/software-delivery implementation copy is intentionally excluded because §10 is more specific. |
| §9, Diagrams | Done | All three original supplied WebPs are copied byte-for-byte into the hosted artwork inventory, with exact supplied alt text and `Concept illustration · not simulation output`. No embedded labels, transformations or generated replacements. |
| §10, Fences | Preserved | No model/runtime, capacity or software-delivery lesson implementation changes. Existing animations, logo, analytics and site sections remain. No deferred animation/bar work or new city/lesson started. |

### Could not implement literally / interpretations

- The reported video defect could not be reproduced. Playback was verified; a root cause or repair is not claimed.
- Reported long floats occurred in native accessibility output, while DOM values were already `1.6` and `0.02`. The fix exposes those readable values through `aria-valuetext`, including during edits. It does not round stored configuration or evidence.
- Hash routes share one HTML shell, so canonicalization uses a canonical hash destination and browser history replacement rather than an HTTP redirect or a global canonical tag that would collapse every lesson.
- The global word-swap request does not override the explicit prohibition on changing the capacity/software-delivery lessons.
- Device-size browser checks do not establish physical Pixel or human-comprehension qualification.

### Invented / additional decisions

No scientific assumptions, inputs, results, lesson or artwork content were invented. Routine presentation details were chosen within scope: shared-scale native meter bars, responsive grid, muted/gold policy colors consistent with the existing cards, prerequisite-specific messages and semantic HTML figures. Added source ownership for the three supplied hosted diagrams; they do not add unavailable image requests to the offline artifact.

## Budget amendment approved by owner

The owner explicitly approved **only** an 8 KiB increase to original teaching-source-and-tools bytes: **3,145,728 → 3,153,920**. The request followed a measured 4,270-byte preliminary overage; subsequent reviewed fixes changed the final total. Runtime/emitted text, offline, metadata, source archive and route limits remain unchanged. The earlier metadata ceiling remains 40 KiB. This is recorded in the R1 contract amendment.

The diagrams total **413,874 bytes** in a separately enumerated, three-file hosted artwork group capped at 512 KiB. Their source fingerprints are in `apps/fleetlab-city/hosted/diagram-assets.json`. Existing ownership counters retain their meaning; no teaching source was moved to escape a counter.

## Verification and review

- Failing regression tests preceded the new accepted-ledger bars, disabled-reason and route behavior; they passed after implementation.
- A fresh read-only review found an inaccurate promise that walkthrough preparation preserves the current experiment, and accessibility values that lagged while typing. Both were reproduced with failing tests, corrected, and verified: **47/47** focused tests pass. Preparation behavior itself was not changed.
- Reviewer found no critical issue; accepted-ledger null handling, diagram rebuild behavior and protected source boundaries were inspected. Reviewer did not establish media root cause, physical-device or human validation.
- Local browser checks cover desktop 1280 px and phone widths 390/320 px: canonical navigation, diagram placement, comparison controls, accepted result bars, pending-order handling, dispatch scenario switching and walkthrough announcement. Zero page-level horizontal overflow in tested views.
- City Python suite: **345 passed**, including the release-inventory regression using the project's city venv. An initial run used the Hermes environment and failed for absent city/scipy dependencies; that is preserved as a negative environment check, not a product regression.
- Hermes Python: **1,661 passed, 56 skipped**. Ruff passed. Doctor: 17 PASS, one expected dirty-worktree WARN, one optional NOT_AVAILABLE. No simulator execution or physical-system access was added.
- Full teaching JavaScript suite: **2,408 passed, 8 skipped, 1 todo (2,417 total), zero failures**. City JavaScript: **95/95 passed**. Approved source budget is enforced; the pre-approval overage failures remain recorded. Final source-bound/release counts follow below.

Private validation artifacts: `build/fleetlab-city/validation/design-round3-20261014/`. Screenshots include `depot-desktop.png` and `zone-waits-desktop.png`. Owner's unrelated untracked assets and design documents remain untouched.

## Recommendation

Use these changes to make the existing lessons easier to enter and explain. Keep simulator-fidelity and SF qualification claims separate from presentation polish.

## Top risks + mitigations

- Illustration mistaken for evidence: explicit captions, exact accepted-record numerical graphics and preserved synthetic-model notices.
- Pending choices mistaken for updated results: outcomes change only after acceptance; clearer pending and loading explanations.
- Original-source headroom remains narrow: retain all enforced counters and require a separate packaging plan before more lessons.
- Browser verification mistaken for operational qualification: SF remains HOLD; independent map/source, physical-device and human-comprehension review remain open.

## Next 3 actions

1. Use the live entry diagrams and zone bars to review the existing lessons with a first-time visitor.
2. Record which explanations remain confusing, especially shared-link waiting, dispatch opportunity cost and the zone-wait trade-off.
3. Review deferred dispatch animation and delivery-order wait bars separately; do not silently include them in this release.

## Release inventory follow-up

The first immutable integration build correctly rejected four newly changed UI modules omitted from its historical allowlist: `labels.js`, `advanced-operations-view.js`, `experiment.js`, and `app.js`. Added exactly those four reviewed UI paths to the flow-update inventory. A failing regression preceded the amendment; it also asserts that non-flow updates and unrelated model changes remain rejected. No guard was bypassed or broadened to arbitrary files. Final integration, package and upload checks passed before publication.

## Final source-bound package evidence

Runtime source: `c92dcd1f34f96342d9f0b8c424ad4f19a6c56a0a`, branch `codex/fleetlab-city-sf`, pushed to `bohueilin/Hermes`. The clean release checkout reproduced and verified **10,134 staged files**. Full source capture, module/source parity, integration reconstruction, offline and upload guards passed. All 25 checked capacity/software-delivery implementation files are byte-identical to prior production. Their release identity sidecars regenerate for the new commit.

| Counter | Measured bytes | Enforced ceiling |
|---|---:|---:|
| Original teaching source + tools | 3,150,945 | 3,153,920 (approved amendment) |
| Legacy emitted text | 2,615,640 | 2,621,440 |
| Integrated emitted text | 3,090,057 | 3,145,728 |
| Offline file | 2,566,403 | 2,571,440 |
| Package metadata | 37,008 | 40,960 |
| NF03 final dependency closure | 507,800 | 524,288 |
| NF04 final dependency closure | 170,622 | 524,288 |
| Hosted diagrams | 413,874 | 524,288, exactly 3 files |

The initial preview upload transferred all changed assets, then failed during finalization with a network fetch error. A read-only Cloudflare deployment listing confirmed no new deployment before retrying the same immutable stage. No failed upload is counted as publication evidence.

The first stable-domain readback overlapped publication propagation and saw 62 mismatches; two diagram header checks temporarily returned 404. The immutable production URL already matched 97/97 files. The stable URL subsequently matched 97/97 smoke files and 68/68 headers; the subsequent full stable readback matched all 10,133 served files. This records observed rollout timing, not permanent cross-generation cache pinning.

## Final completion boundary

All implementation and release work in this brief is complete. No scientific/model gaps were filled with invented values. The §0 failure was not reproduced; verified playback is the result. Independent human comprehension, physical-device qualification and SF map/source qualification are not established by this design release. No R2/R7 or new-city work was started.
