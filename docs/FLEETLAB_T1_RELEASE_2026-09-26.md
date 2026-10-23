# FleetLab teaching-frame implementation and review report

Date: September 26, 2026. Local implementation report. Teaching changes meet the scoped contract with the explicit walkthrough reading-length exception below; all final gates pass.

## Context for an independent reviewer

FleetLab is a browser-based learning site with three distinct models: Fleet day, Street lab and Four-area experiments. It has 56 existing lessons. Operational inputs are synthetic; existing geographic inputs and model assumptions differ by model. Outputs support learning and simulation-based comparisons, not conclusions about real-world safety, deployment permission or measured operator performance.

This work follows `docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md`, found in this worktree under that exact filename. The owner approved its ordered Tasks 1–3, the OD-2 package allocations, package T's 61,440-byte stop budget and 53,248-byte working target, and OD-T1, OD-T2 and OD-T4 through OD-T7. The baseline was `4ba5626cef5f6354c0ae77eabc636028fe794dc5`.

The work separates three deliverables: a revised N2 design, an offline packaging change, and a presentation-only teaching frame. N2 remains a design; this task does not implement its simulator, evaluation campaign, execution seam or new metrics. It does not acquire or incorporate Waymo Open Dataset data.

Local checkpoint commits are within this task's scope. No new push, deployment or PR is authorized. The published site remains the previous release at fleetlab.pages.dev; local implementation evidence must not be read as production readback. The owner's untracked review note is preserved and excluded from commits.

## Completed design revision: Task 1

The new `docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md` records 26 open-decision rows, 19 fixture contracts and all 50 requested corrections. Decisions 1, 2, 3, 4, 5, 6 and 19 are decided; the remaining 19 are still pending. Earlier v1/v2 documents and the original probe files remain unchanged.

Commits:

- `62547a8b9834f0eead16331873ac6a76a041efed`: initial v2.1 document and source-of-truth entry.
- `82df3b54d265c26bd3f8472e4dc12dca9ca636ef`: independent-review corrections to a transcribed code snippet, teaching-decision identifiers and a stale metric-alias clause.

The 901-line v2.1 document has SHA-256 `8bb68d09da0b6738b02cdf179a8993dfda4b00aa2cdce5cde23fef7fa33d75de`. Documentary checks cover decision/fixture/correction inventories, references, table structure, protected hashes and privacy. Three focused regression checks failed before the review correction and pass afterward. Probe output is reproducible; unchanged hand traces are explicitly distinguished from calculated fixture values. This is design evidence, not a run of the proposed N2 engine. Independent scoped re-review approved spec compliance and document quality.

## Completed packaging change: Task 2

Commit `8e04b498c71c92c3462eb2737af86df5b3f0620c`, on `codex/fleetlab-packer-comment-strip`, adds offline-only full-line comment removal. Default bundling and native hosted-site files are unchanged. No model, application source, dependency or package-size limit changed.

The build removes only complete comments whose first and last lines contain no code tokens. It preserves literals, protected comments and every line terminator. A lexical check compares exact tokens and line boundaries; both original and transformed module wrappers also compile. These checks are complementary: compilation alone cannot prove behavior equivalence. Templates are conservatively retained in full. Unsupported Unicode-set regular expressions fail closed; current modules do not use them.

| Measurement | Before | After |
|---|---:|---:|
| Offline package | 2,551,878 B | 2,257,953 B |
| Headroom under unchanged 2,621,440 B limit | 69,562 B | 363,487 B |
| Hosted files | 90 | 90 |
| Hosted payload | 3,189,179 B | 3,189,179 B |

Actual saving: **293,925 bytes**. Preserving line terminators and template contents leaves 6,551 more bytes than the audit's scratch result. The measured headroom supersedes that estimate. Reserving the other approved packages' 135,904 bytes and all 61,440 bytes of T leaves **166,143 bytes unassigned**.

Every hosted file matched. Inventory SHA-256: `cf355b9b5544354866e81681a82b8173cf4590bb7dccd86b42a6098cb7ff1603`. The inventory hashes relative-path-sorted rows of path, file SHA-256 and size, separated by NUL characters and a final newline. Both package checks reported zero problems.

Validation included 73 focused tests and the full serial performance-enabled suite: **1,859 tests, 1,858 passed, one existing TODO, zero failed/canceled/skipped** (146,546.324667 ms). No isolated performance retry was needed. Tests cover mixed-boundary comments, literals, nested templates, regular expressions, line endings, directives, automatic semicolon insertion, negative token checks, actual packed-worker parity and packed-page initialization.

The actual packed worker and native source produced identical complete payloads for seed 1001: 10,153 events, event-log SHA-256 `195dda932973010d390beb6a3eadeb8791ac621d84f9fc7b47c75c224ec84f47`, and world digest `7d0354dea41192299da66198631f9f28fcff0ed4ac81b8ffede82ee939585f10`. Metrics and series also matched. All 86 tracked application source files matched the Task 1 source. The lexer checked 107 renders of 84 unique modules and found no protected-comment matches; license metadata remained intact as literal data.

Independent review approved Task 2 with no findings. A separate browser smoke check of the actual offline file at 400×812 reproduced 95 completed, 176 unserved, 4 waiting and 9 in-progress requests, totaling 284. Result-summary focus and paused replay remained intact; browser warning/error logs were empty.

Local supporting evidence, ignored by Git, is under `artifacts/fleetlab-t1/`: `task2-focused-node.log`, `task2-full-node.log`, `task2-site-inventory.json` and `task2-browser.txt`.

## Task 3 baseline and scope decisions

Task 3 starts from accepted Task 2 commit `8e04b49` on `codex/fleetlab-t1-teaching-frame`. Its offline baseline is **2,257,953 bytes**. The target is at most **2,311,201 bytes**, and the hard stop is **2,319,393 bytes**, including CSS.

The independent scope probe compares every core/model/instrument file against that starting commit. It also compares all 56 lesson IDs, titles, targets, resolved patches, hotspots and full preset records with the pre-change snapshot. The snapshot SHA-256 is `cb290591f6a208974c269200a6da2d7a0002b2303d8ec540b821aba69c8d2f94`. Existing tests may change only in the three explicitly authorized files and only for the specified assertions. The final independent scope probe passed all 47 protected source files, all 56 resolved lesson records and 88 existing test files with only the three authorized exceptions; frozen design hashes also match.

Recorded interpretations resolve conflicts without expanding model scope:

- `ops-cases.test.mjs` remains unchanged. New teaching tests extend descriptive-value pin coverage instead of modifying its existing helper.
- Exact machine JSON inside closed Exact values disclosures is excluded from the human-copy vocabulary scan. Human-readable messages, labels and disclosure prose remain in scope. Machine records are preserved verbatim.
- OD-T7's walkthrough restriction takes precedence over a generic frame or word-count requirement. Only the approved intro changes and explicit global Exact values/Next-contrast work apply; no new beat or reordered chapter is introduced. Any remaining word-count failure must be reported as an exception.
- Existing Situation content and chooser/question ordering are retained. A meaningful nested disclosure can hide detailed explanation while preserving access and tested control order; browser review must assess the resulting flow.
- Selecting the first recorded ready-car event for the full-cycle lesson is a navigation default. It does not create or recompute a model metric.

The browser baseline explains the walkthrough exception: at 400×812, 164 visible prose words precede Prepare, including four map labels totaling 24 words. The approved intro adds 11 words; disclosing the 29-word identity line projects 146, still above 130. Final measurements, including the fake-DOM/no-canvas mode, must replace the projection. Baseline disabled Next contrast was approximately 1.007:1 and requires correction.

## Task 3 implementation, acceptance and final review

Task 3 is on `codex/fleetlab-t1-teaching-frame`, descended from the accepted Task 2 commit. Implementation and browser verification are complete. The first independent review found two presentation defects; both were fixed, regression-tested and approved on the immutable correction snapshot. Implementation commit: `caaf8f2d8f02b3df9e68a5a675fa488f99161d6d`. The record and source-of-truth/handoff updates were committed in `0497b9b7a0348d47e95beb1a241b7974b502fbb2`, followed by the aggregate-time unit clarification in `45efd43a2623cfd50f55c44607ec06075a9702a1`. The final review record is a documentation-only follow-up; the implementation is unchanged.

### Implementation and decisions

| Item | Result |
|---|---|
| T1.0 | Preserved the accepted Task 2 baseline. An already-started independent baseline run also completed: 1,858 pass, one existing TODO. |
| T1.1 | Added a UI-only display mapper for model-origin policy/error/assumption text; COPY_MODULES adds only teaching-frames.js and street-simulation.js. Model literals remain unchanged. |
| T1.2 | Added 56 lesson frames, all 21 surface keys, 18 glossary entries, canonical outcome/next-test wording, and a non-shipped grounding sidecar. |
| T1.3 | Catalog uses the three-part frame, question-family filter, model filter, search, deliberate start/next links and generated readable setup differences. The 56 source setups remain identical. |
| T1.4 | Lesson arrival retains the actual lesson title/setup, restores its lesson context, clears unrelated previous results and marks subsequent user edits. Region B focuses its opened launch panel. |
| T1.5 | Frames precede relevant Run controls. The four-area paired setup has a meaningful native “Review or change this paired test” disclosure; its original chooser and numbered sections retain order and content. The duplicate replay editor is hidden in paired mode. Source identity remains in workspace-intro. |
| T1.6 | Generated run readings consume recorded result fields, with exact records accessible separately. Fixed completed-trip wait label, empty-stage absence, visible staffing blocker rows, first recorded ready-car selection for full-cycle, Street queue label, weather state, disabled Next contrast and busy-state focus/enablement. |
| T1.7 | Twenty casebook readings appear only for matching frozen labels, validity, outcome and recommendation; all 60 pinned combinations are tested. Descriptive clauses for OPS-08/OPS-19 receive real three-set runtime checks. |
| T1.8 | Copy follows §11 precedence over Appendix B; numeric historical audit observations remain in the sidecar rather than unpinned static lessons. Canonical catalog/model/intro copy is used. |
| T1.9 | Full gates, browser evidence, scope verification and local commits recorded below. No remote release. |

The catalog derives paired seed counts from actual preset specs or the existing shared UI evaluation-seed defaults. It does not freeze an experiment merely to render a card. This also preserves offline initialization in the test VM, which intentionally lacks structuredClone.

The advanced presentation has protected tests that remove native details and still inspect precise tabular records. To satisfy both that contract and T1's visible-copy requirement, those records use an accessible native button with aria-expanded/aria-controls and a hidden content region titled Exact values. This is an operable disclosure, not a CSS-only hidden test fixture. Original raw JSON remains separately available in native details. The generated reading stays outside both. Existing four-area verdict charts/tables are in a native Exact values disclosure; original sections/classes/values and the exact-copy footer are preserved. Austin's existing test-pinned sentences are retained beneath its new generated line.

Busy controls use the same helper on entry and exit, including resetting aria-disabled. Keyboard focus on a four-area Freeze survives the render transition by moving to Cancel while computing, then the result heading. Reading a different lesson clears old result panels; changing an input within the same lesson retains the lesson frame with an explicit changed-setup note.

### Measured byte checkpoints

These are archived integrated checkpoints, not retrospective estimates of individual edits. Several items share an integration checkpoint because imports make previously dormant content part of the offline bundle. Baseline is 2,257,953 bytes; the cap stays 2,621,440.

| Checkpoint artifact | Offline bytes | Growth from Task 2 | Interpretation |
|---|---:|---:|---|
| t1-1.html | 2,260,014 | 2,061 | T1.1 mapper/skeleton |
| T1.2 unconnected content | 2,260,014 | 2,061 | Data not yet imported; not a zero-cost content claim |
| t1-3.html | 2,343,869 | 85,916 | First integrated catalog; exceeded stop and was not accepted |
| t1-3-trim.html | 2,317,107 | 59,154 | Deduplicated surface aliases/shared limits and compact frame representation |
| t1-3-final.html | 2,306,501 | 48,548 | Removed replaced legacy decision/card fields |
| t1-4-6.html | 2,312,344 | 54,391 | Arrival and first run/panel integration |
| t1-integrated.html | 2,314,215 | 56,262 | Paired result integration and responsive styling |
| t1-finalizing.html | 2,316,986 | 59,033 | Glossary/Exact values/content refinement |
| t1-panels.html | 2,317,335 | 59,382 | Named panel frames |
| t1-browser-d.html | 2,317,229 | 59,276 | Runtime copy/focus fixes and removal of unused legacy card fields |
| t1-browser-e.html | 2,318,117 | 60,164 | Runtime condition/copy/busy fixes |
| F offline | 2,318,454 | 60,501 | Final runtime/focus integration |
| G offline | 2,318,262 | 60,309 | Launch/Austin word-count trims |
| H review fix | 2,318,859 | 60,906 | Threshold integrity and edited-lesson tracking; depot/power takeaway trims |
| Committed source | 2,318,855 | 60,902 | Four whitespace bytes removed; no token change |

Final committed offline size is **2,318,855 bytes**, growth **60,902 bytes**: **538 bytes below the 61,440 stop**, **7,654 above the 53,248 target**, and **302,585 below the application cap**. Static site is 93 files / 3,249,227 bytes. Both offline and static-site packaging/check-dist pass (the first manual site check omitted --site and was corrected; this was command usage, not a package defect). After the reserved N2 allocations of 135,904 bytes, 166,681 bytes remain unassigned. The frozen design’s older headroom estimate is superseded by this measurement; its text is not changed. The 53,248-byte target has been exceeded at integrated checkpoints; the 61,440-byte hard stop remains binding. The trim order first removed redundant data and replaced prose, while retaining all approved casebook readings. No cap increase, new dependency or media addition occurred.

### Acceptance record

| # | Evidence and disposition |
|---|---|
| 1 | New catalog test checks exactly 56 frames, three populated parts, unique lesson learning text, no engine identifiers in human card copy, no malformed singular guardrail phrase. |
| 2 | New tests cover lesson/surface keys and caps, vocabulary, static verdict exclusions, direction/digit constraints on lesson takeaways, glossary caps and complete grounding entries. Canonical §11 surface wording retains precedence. |
| 3 | New arrival test mounts the actual app for all 56 IDs and checks exact lesson title, frame-before-relevant-Run order and Fleet day lesson selector context. Browser checks verify the four required first-screen examples and Region B heading focus. |
| 4 | Met with scoped walkthrough exception. Browser heading-to-Run counts: Fleet day/cleaning 117, Street Lombard 96, OPS-07 128, Four-area workspace 129, staffing 118, advanced 116, Austin 126, Launch 129. All eight preset fake-DOM counts from h1 to Run are 117/114/109/105/116/126/129/130 (balanced/charging/resources/airport/staffing/rain/depot/power). Pre-title eyebrow is outside this heading-based panel measurement. Walkthrough remains 146 fresh/153 inherited, as disclosed below. |
| 5 | Runtime fixtures cover Fleet day, all eight presets, staffing, Street compare, both launch templates, Austin, four advanced treatments, invalid paired output and real four-area paired results. Generated readings and no raw enum headings are checked; exact records remain inspectable. |
| 6 | Only three authorized pre-existing test files changed, with the narrow rewrites below. Final full-suite evidence is recorded below. Root's independent probe checks every other existing test against Task 2. |
| 7 | Final growth 60,902 bytes, below the 61,440 hard stop; target overrun and actual headroom disclosed above. Both packaging checks pass. |
| 8 | Human-copy scan includes shell routes/catalog/reference panels and real runtime fixtures above, plus closed disclosure prose. Only exact machine pre JSON in closed Exact values is excluded. Browser checks supplement fake-DOM coverage. |
| 9 | All 16 fold checks pass: four required lesson examples at 1280×800, 1280×720, 400×800 and 400×812. All eight routes at both mobile sizes have no horizontal overflow. Native and custom disclosures, edited context, async focus, controls and actual result values were checked. |
| 10 | Browser computed disabled Next foreground white on rgb(53,88,121), opacity 1: contrast 7.438:1; native disabled state remains true before Prepare. |
| 11 | For all 20 OPS cases and three pinned sets, invalid label, validity, outcome or recommendation suppresses the reading; missing required slots suppress it. Real OPS-07 browser run shows its matching checked reading. |

Walkthrough exception: OD-T7 explicitly limits this slice to intro copy plus global Exact values/Next contrast. The fresh initialized browser measured 146 visible prose words before Prepare; arriving with a previously selected OPS case measured 153 because the existing map label retains that context. Transient initialization messages add words until ready. Those readings include map absence labels and do not exclude prose to manufacture a pass. Changing beats, refusal sections, captions or the existing walkthrough layout is deferred. No new walkthrough frame or beat is mounted. Its protected tests remain unchanged.

### Test rewrites and verification

The only modified existing assertions are:

- simulation-catalog.test.mjs: replace the old five-field loop with nonempty frame fields; count, setup dispatch and UC-10 readable controls assertions remain.
- scenario-learning.test.mjs: replace the old decision fields/headings and raw guardrail identifier with frame/run-line wording; retain the no-winner/deploy/guarantee protection and invalid/descriptive cases.
- d1-presentation.test.mjs: replace the removed closed legacy learning block assertion with visible frame-before-result-summary and closed glossary checks; result-first order, 95/284, single primary and setup digests remain.

New tests failed before implementation, then passed after integration. The first integrated full run exposed missing formatter fallback/CSS declarations and the expected old copy assertions. A later full run had 1,871 tests, 1,868 pass, two failures and one TODO: offline catalog rendering eagerly froze a spec in a VM without structuredClone; and an experiment yield measured 18.78ms. The offline defect was fixed by using the existing shared UI seed defaults (packed-page suite then 3/3 pass). The mandated single isolated performance rerun passed at 7.47ms over 2,197 yields. No threshold changed. An intermediate 1,874-test run passed 1,873 with one TODO. G then recorded 1,872 pass, one timing failure (run_pair 10.87ms against 8ms) and one TODO; its exactly-one isolated retry passed at 5.71ms (window) and 5.82ms (pair). Final H full serial performance-enabled gate: **1,876 tests, 1,875 pass, zero failures/canceled/skipped, one existing TODO**, 162,822.320209ms. No timing retry was needed for H. After this run, only four trailing-whitespace bytes were removed from studio.js; a whitespace-insensitive comparison proved no token change, and both distributions were rebuilt/rechecked from the final source. The two strengthened real descriptive assertions and two review regressions are included in that final run.

Python parity/boundaries: final H **89 passed in 5.29s** with FLEET_PLAYGROUND_BASE=bca4ccd and the hermes-dev interpreter. Import verification resolved this worktree's src/hermes/__init__.py. Byte-for-byte source and runtime-lesson verification are independently owned by the controller; final H probe passed 47 protected core/model/instrument files, all 56 resolved lesson records and all 88 pre-existing test files subject to the three allowed exceptions. Earlier design versions and their hashes remained intact.

### Independent review and browser evidence

The initial immutable review found two P2 presentation defects: a 90-second margin displayed as 2 minutes, with near-boundary intervals implying the wrong relationship; and regional/Launch lesson frames that did not disclose edits. Both were reproduced by failing tests, then fixed. Minute output now falls back to exact signed seconds whenever rounding would change the side of zero or either margin; a 90-second margin displays 1.5 minutes. Regional frames track their baseline scenario/draft and show the actual edited seed count. Launch tracks its config/delay baseline and marks template or field edits. The scoped independent review approved both fixes, verified all four changed-file hashes and reran both regressions. The combined focused suite passed 17/17.

Numeric ruling: canonical fraction formatting retains three decimal places where §11.3 requires it; threshold integrity also permits exact seconds at a boundary. These explicit exceptions take precedence over generic two-decimal presentation. Exact records remain available. No threshold or outcome logic changed.

A fresh final whole-branch review covered `4ba5626..45efd43`, including the design, packer, teaching implementation and release report. It approved local acceptance with no Critical or Important findings. Four independently rerun checks passed: all 60 pinned readings, precise-table disclosure, threshold-side time formatting and edited-lesson context. The reviewer independently confirmed protected source/design hashes, package sizes and final test-log counts. Browser execution remained controller-owned, and the reviewer inspected its record; the full suite was not redundantly rerun. The walkthrough scope exception and working-target overrun remain explicitly accepted interpretations, while N2 engine correctness, real-world validity and remote release readiness remain outside this implementation’s evidence. The only optional copy correction was spacing in the handoff, now fixed.

Browser evidence is saved locally in artifacts/fleetlab-t1/browser-checks.json. Actual checks include Street Lombard 39/71, Austin 77/480 with 391 unserved and 120 zero-power vehicle-minutes, Region B completed trips 34 to 29, full-cycle 84/284 with the first recorded ready event selected, OPS-07’s label-matched reading, keyboard Freeze→Cancel→result focus, accessible Exact values toggling, and cleared native/ARIA busy states. The final H check confirms OPS-07 20→5 seeds updates its chip and changed-setup note; Region B→Peninsula shows the note. Browser logs contain no warnings/errors. Mobile Run window is reachable through the existing Knobs drawer. No full 56-route real-browser sweep, hosted deployment/readback or new data acquisition was performed; all 56 arrivals were exercised through the actual app in fake DOM. Controller owns browser and scope evidence; implementer did not duplicate those sessions. N2 implementation, walkthrough structure and Fleet day motion-control reachability remain outside this slice.

### Gate commands and scope

- `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs`
- `node playground/fleetlab/tools/pack.mjs --site dist/site` and `node playground/fleetlab/tools/check-dist.mjs --site dist/site`
- `node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html` and `node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html`
- `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py` in hermes-dev
- `git diff --check`, staged diff/check/stat and the brief’s staged privacy scan

The protected ops-cases.test.mjs stays unchanged despite the audit’s proposed assertPinned edit; its added descriptive checks live in the new teaching test instead. This follows the explicit scope ruling. Source literals/model errors are mapped only at the presentation boundary. No model, preset, patch, verdict, metric, pin, media or byte-cap contract changed.

### Privacy and scope

Staging uses explicit paths. artifacts/, dist/, scratch notes, caches and the owner's untracked note are excluded. Code staging: all 24 explicit paths reviewed; staged diff/check/stat passed and the required privacy pattern scan had zero hits. The four documentation paths and unit clarification passed the same staged checks and privacy scan with zero hits. The final review-record follow-up uses those checks and changes documentation only. No telemetry, credentials, new network service, runtime dependency, map/data acquisition or physical actuation was added. No push, deployment, PR or production readback occurred.

Recommendation: accept this as a local T1 teaching implementation after the recorded final gates, with no deployment authority. Treat the documented walkthrough word-cap exception and target-byte overrun as explicit review decisions, not invisible passes. Keep N2 v2.1 at design-only status.

Top risks and mitigations: explanations can be mistaken for operator evidence (synthetic/model-specific limits and explicit ops-test wording); a matched casebook label does not validate another rider draw (exact gate plus next-test advice); exact disclosures add interaction depth (native controls, preserved keyboard order, browser QA); package headroom is finite (measured route-A baseline, hard stop unchanged).

Next 3 actions for Claude or another reviewer:

1. Review the scoped walkthrough exception, inherited-context reading count and focus behavior; decide whether a separately approved T2 layout pass is warranted.
2. Review grounding and all three pinned reading sets, especially descriptive/static clauses in OPS-08/OPS-19 and the distinction between one rider draw and travel seeds.
3. Review final bytes against the 61,440 stop and remaining N2 allocations, then prioritize the T2 queue: lesson setup corrections/new pins, multi-rider-draw robustness, new mechanism metrics, source-literal cleanup, walkthrough structure and Fleet day motion-control reachability. Motion preference still lives in the four-area shell and is not directly reachable from Fleet day; adding that cross-model control is deferred.
