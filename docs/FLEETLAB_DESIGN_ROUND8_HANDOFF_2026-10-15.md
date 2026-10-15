# FleetLab Round 8 handoff — October 15, 2026

## Scope and decision

Implemented the Round 8 audit §8 P0/P1 presentation work. P2 stays queued. No new lessons, model logic, fixtures, numerical studies, media assets or budget increases. The two rejected Round 6 rewrites remain excluded. Source commit: `5c41e64` (full identity in the publication receipt).

## Item-by-item decisions

| Item | Status | Implementation or evidence |
|---|---|---|
| P0-1 Home/overview | Done | `#/home` is canonical. Saved `#/overview` links redirect through `history.replaceState`, preserving hosted/offline navigation. The former route was the single Home renderer, not separately maintained duplicate content. |
| P0-2 truncation | Could not implement as written: defect not reproduced | Live Home's complete teaser ends “what each experiment teaches us.” Inspected all 18 fleet-day lessons at 1280 and 390 px, including the five Round 6 reports: complete source/DOM text, no clipping or active line clamp. No speculative site-wide CSS removal or fabricated repair. Keep this report unconfirmed until a concrete browser/viewport/element reproduction exists. |
| P0-3 D2 accessible note | Could not implement as written: defect not reproduced | The live accessible name is “D2 first wave”; its normal button has tabIndex 0. The quoted developer note is absent from source and DOM. No invented accessibility fix. |
| P1-1 internal arrows | Done | Authored internal arrows use →. The hosted decorator also normalizes dynamic legacy city controls without changing their listeners or immutable scientific files. External citation arrows remain ↗. |
| P1-2 workspace distinction | Done | Each page explains one-window settings/replay versus baseline/candidate comparison across paired seeds. Both retain their existing capabilities; no unsupported beginner/expert distinction or merge. |
| P1-3 verdict reveal | Done | The old reveal finished below the viewport. Actual gate visibility now triggers a calm, staggered highlight and 8 px entrance, with 0/.3/.6/.9 s delays. Values and gate statuses stay exact; no fabricated counter or status flipping. Pause/reduced-motion supported. Recorded temporal evidence provided below. |
| P1-4 catalog heading | Done | Topic title explicitly ends “· lesson library”; count remains a separate status. Clear filters restores “The complete learning library.” The reviewer caught the reset regression; a failing test reproduced it and the fix passed. Card descriptions were complete; the reported ellipsis defect was not reproduced. |
| P1-5 depot label collision | Done | Fixed the actual cascade: broad prose font-size and `text-wrap: pretty` overrides enlarged and wrapped compact map readouts; a later padding override added another 2 px. Readouts retain 12 px/no-wrap/2 px padding. Verified all four depot labels at desktop/phone widths on steps 1, 4 and 5 without overlap. No coordinate/model changes. |
| P1-6 repeated Run 1 | Done: verified existing behavior | Fresh two-vehicle comparisons displayed Run 1 then Run 2. Existing counter works; no needless production change. |
| P1-7 small copy fixes | Done, with one unconfirmed subclaim | Added the paired-repeat definition; sources CTA describes a page; symbology explains car/cube counts and non-street positions. The quoted “run nothing yet” text was absent; existing no-run copy is grammatical. No invented grammar repair. |
| P1-8 motion perceptibility | Done | Catalog rain/glow/drift and dispatch artwork sheen strengthened modestly and captured as continuous browser viewport recordings. Pause captures confirm they stop; reduced-motion disables verdict animation. Concept effects do not supply model outcomes or advance playback. |

**Invented scientific inputs/results: none.** The audit asks for several plain-language explanations without prescribing exact replacement prose. Those are authored from inspected model semantics, not guessed behavior. P1-3 uses a visibility-triggered highlight rather than artificial changing result values. Existing bounded lessons may reconstruct/check their declared default comparison on mount; this release adds no computation or automatic replay to ambient animation.

## Validation and evidence

- Teaching Node: **2,418 pass**, 8 skipped, 1 TODO.
- Hosted Node: **99 pass**.
- City Python: **345 pass**.
- Hermes regression: **1,661 pass**, 56 skipped.
- Ruff and Git whitespace checks pass.
- Doctor with this checkout explicitly on `PYTHONPATH`: **17 PASS, 1 dirty-tree WARN, 1 optional display NOT_AVAILABLE** before commit. Initial unqualified doctor resolved an older editable checkout and is not used as this checkout's evidence.
- Independent final review completed; catalog Clear title fix verified RED/GREEN and followed by the full suites.
- Desktop 1280×900 and phone-sized 390×900 browser checks. These are viewport checks, not physical Pixel qualification or human-comprehension review.

Local evidence root: `build/fleetlab-city/validation/design-round8-20261015/`.

Motion files (continuous real browser viewport capture, actual elapsed frame timestamps, roughly 12–16 fps; no generated or interpolated frames):

- `verdict-final-motion.mp4`: Step 7, scroll the gate chain into view; 96 frames, 6.946 s.
- `catalog-final-motion.mp4`: visible card effects; 124 frames, 9.894 s.
- `catalog-final-paused.mp4`: paused comparison; 37 frames, 2.943 s.
- `dispatch-motion.mp4`: concept sheen with simulation clock unchanged; 167 frames, 10.982 s.
- `dispatch-paused.mp4`: paused comparison; 39 frames, 2.971 s.

`recordings.json` records capture metadata. `browser-validation.json`, `fleet-text-layout.json` and `map-bounds-final.json` record the DOM/layout checks. Earlier recordings and intermediate failed checks remain as diagnostics, not final acceptance evidence. Validation media is local and is not added to the public website payload.

The first integrated build failed from insufficient local disk while copying artifacts. Removed only obsolete, reproducible Round 5/6 temporary build copies; retained their manifests/package receipts, current Round 7 release and canonical scientific inputs. A repeat launcher then stopped at an already-existing package directory. Continued from the already-verified package and city presentation outputs; no release verifier or budget limit was weakened. The first header-check invocation used the system Python, which lacks `datetime.UTC`; it produced no result file. The project Python rerun supplies the accepted header evidence.

## Source trim and release

Removed **7,802 bytes** of redundant stylesheet implementation commentary, retaining the class inventory and test-used section markers. This trim changes no selectors or declarations; the separate readout fixes above are intentional runtime edits. No budget ceiling changed.

| Measure | Bytes | Limit | Headroom |
|---|---:|---:|---:|
| Original teaching source + tools | 3,138,195 | 3,153,920 | 15,725 |
| Offline edition | 2,562,044 | 2,571,440 | 9,396 |
| Package metadata | 37,473 | 40,960 | 3,487 |
| Integrated emitted text | 3,097,784 | 3,145,728 | 47,944 |
| Integrated NF-03 dependency closure | 518,106 | 524,288 | 6,182 |

Teaching source is 7,411 bytes smaller net; captured teaching + integration original-source growth fell 5,441 bytes. Media growth is zero. Package proof and the independent source-bound upload guard pass for all 10,139 staged files. Published and read back successfully:

- Source commit: `5c41e647804a46c42e35ee81521daf9579c713dd`; pushed to `github/codex/fleetlab-city-sf`.
- Live: https://fleetlab.pages.dev/#/home
- Immutable production: https://37ae8cf5.fleetlab.pages.dev
- Production ID: `37ae8cf5-401b-4243-bb9a-f71fd045b83f`.
- Preview ID: `f74c3e8b-3c15-49e1-9675-f9861657d057`.
- Current city presentation: `city-explorer/releases/c348707ba27a018c`; scientific base remains `c56bda6b509105c5`.
- Rollback: prior production `9b401aed-b992-44be-aa43-f623267bef7c`; previous city generation remains staged.
- Full preview and stable production readback: **10,138 / 10,138** served files matched on each, no transport retries required. The 10,139th staged file is the hosting `_headers` configuration, checked through observed response headers instead.
- Headers: **71 / 71** on preview and stable production. Immutable production and prior production smoke: **102 / 102** each.
- Live browser: overview redirects to Home; complete teaser and internal CTA arrow visible; selected catalog title/count clearly separated. Preview also checked phone teaser, Clear filters, paired-repeat definition and sources CTA.
- Receipt: `docs/releases/fleetlab-current.json`; full validation/readback files stay local under the evidence root above.
- Public website publication is not vehicle/policy release authority. SF scientific qualification remains HOLD; independent source/map, physical-device and human-comprehension reviews remain unestablished.

## Recommendation, top risks and next 3 actions

Recommendation: use this bounded presentation release for educational demos, with the limitations visible.

Top risks: the unconfirmed truncation/accessibility reports need reproducible observations, not speculative patches; browser viewport testing does not establish real-device usability; internally consistent synthetic studies do not establish SF road-map qualification or real-world fleet safety.

Next 3 actions:
1. Review the new motion recordings and supply an exact reproduction if truncation or the D2 note appears again.
2. Complete physical Pixel and independent human-comprehension/map review when available; those gates remain open.
3. Obtain design feedback for the queued P2 charts, map coverage, status strip, model arrow, replay invitation, D-06 and editorial work before implementation.
