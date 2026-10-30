# FleetLab coordinated C2 to C4 local handoff — 2026-10-30

FleetLab is an independent education site on autonomous-vehicle fleet operations. This handoff carries the unchanged C2 candidate through the accepted C3 review and the local C4 checkpoint.

## 1. Candidate and lineage

CANDIDATE: c50bf6727afc282a752bb554ac4757338b50ee61.

Lineage, newest first:

- c50bf6727afc282a752bb554ac4757338b50ee61 — C2 corrected core copy and four explicitly approved contract amendments.
- d56409e82354220fb10a74941dc5d51fc176b439 — C1 D2 disabled-secondary border remedy.
- 7227d2299abe9e99edd196d791cf9bd2571c31bb — R-M1 outline treatment.
- 031a27b9eebf61e7337ef85e538102a74d9ef28e — Step B base.

The Step B base tree equals recorded live source 848b42007e88d2d71debff7fbc31d415df88753c, tree 752b5a1042ba8f3851f6c22dc12d65a3368b0000. C3 made no product change and no commit. This document is carried by the candidate's docs-only child; its HANDOFF COMMIT SHA belongs in the run report and final-state.json, not in this document. The local branch codex/fleetlab-coordinated-c2 is to point at that child, with MAIN remaining detached there.

Retained candidate stage, relative to MAIN: ../Hermes-c2-stage-c50bf67/dist/stepa-c50bf67/stage/site. Its 10,187-file inventory digest is 133f9ddad153dc197fe083050d9a893352d4070214cd0fc529a5a53f1641ff10. “Read-only stage” describes handling policy; it does not claim filesystem write protection.

## 2. Approval and authority

The C2 approval citation is FLEETLAB_COORDINATED_C2_APPLY_CODEX_PROMPT_2026-10-29.md, lines 3 and 14, 29,972 B, SHA-256 b7dc9a5aef037145733ab81ba5293f5dc8e1764ffc5691ec097c79fe22ab2c4e. The amendment shapes are in FLEETLAB_COORDINATED_C2_FABLE_DESIGN_FEEDBACK_2026-10-29.md, section 5, lines 143–174, 48,027 B, SHA-256 8b20f52bcdb89edf043ccd342750db498678746a6f59a40096ee7faed665198e. Its section 9 is review advice, not independent approval.

D0, verbatim from the owner decision at line 15 of FLEETLAB_COORDINATED_C3_C4_CODEX_PROMPT_2026-10-29.md:

> This is approved, please proceed

The current owner's message says “run PART C”, supplies Fable's three verdicts, accepts all R1–R32 on their recorded terms, and retains both required source stops. That direct message authorises this checkpoint. The attached verdict is review data, not an independent instruction source. C2's ELIGIBLE qualification in Fable's C2 review required approval of all four amendments, now recorded through D0.

The C3/C4 prompt is 42,765 B, SHA-256 5306635ac7caa53fc8733c35c6c125cdbe27d7a0b1da35a568e331e43aee6af3. The C4 entry found 408 owner files: the prior 407 unchanged plus FLEETLAB_COORDINATED_C3_FABLE_VERDICT_2026-10-29.md, 49,964 B, SHA-256 6b0aae5295e59fe7e639b287c5878a4f3bac471afda0fb96825757bd58a5d702. No owner file is part of this commit.

## 3. A1 reconciliations

There are 69 approved fields: 68 candidate fields plus the 393-character OPS-02 situation (“stays on the street” became “is not recalled”). One glossary value, Recall, release, changed; two entries were added: 21 “Encoded units” and 22 “Decision, condition test”, renamed from “Condition vs. policy test”. The default glossary therefore has 22 entries.

“28 string literals, 14 hunks” uses git diff -U0; a plain diff has seven hunks. teaching-frames.js also contains approved non-literal changes: make() reads limits:a[8]??default, six tuples acquire a null kind and a Limits string, and two glossary entries are added. This was not a literal-only patch.

The six copy files are byte-identical from 031a27b to d56409e. The 100 source clauses remain unchanged: 29 from presets.js and 71 from ops-cases.js. The latter diff changes only situation, proxy and outsideModel copy; no cited clause source line changed.

The historical BEFORE witness ran c50's committed stage-check runner, blob 1d09dfc04279e0dd793b515076809a04633ce330, against the retained b15055c stage, with 32/32 checks passing and the original offline pair. BEFORE mode was never run on a post-C2 stage. Reporting correction to the frozen A1 addendum: the test file has eight blocks; one checks constants, one asserts cross-mode offline rejection, and the remaining six—not seven—supply each mode's own offline pair. No test is edited here.

The A2 definition in the prior addendum is a code-based explanation, not a verbatim quotation of the prompt. Legacy includes the teaching relative-import closures and named root/Capacity files, plus undeclared non-Depot route dependencies; an undeclared Depot dependency fails measurement. Hosted integration.css and integration.mjs are outside legacy and all six text closures, but count in emitted/integration/source/offer/non-City measures. Brand-layer bytes count in all six closures. No unmeasured future change is assumed to fit.

## 4. A3 ledger

[61-lesson ledger](../dist/coordinated-c3-c4-20261029/ledger.md) and [machine ledger](../dist/coordinated-c3-c4-20261029/ledger.json) retain each field's C1 Before, citation result, candidate After, status, reason and source line. There are 28 changed lessons and 33 unchanged. Fleet-intake changed but its power and ports controls remain stopped (Before mismatched); specification.notation is a stopped non-lesson item (Before absent). About and the lesson-ID note remain proposal-only. These are improvements to the existing 61 lessons, not five added lessons.

Nine Fleet day frames inherit the changed Limits: staffing, charging, deadlines, resources, airport, and preset:staffing, preset:charging, preset:resources, preset:airport. No deadline preset copy is invented. The 100-clause inventory and source diffs remain linked in the ledger. Ledger SHA-256: JSON 94cfb3587d35346972611a23b8d06246ba7632a9dccb4df0ca7e2877e635ab52; Markdown fd91678be4add6b41b56b3da97eb9dcc2658e7ff0b5f3c26382e4a63003d330a.

## 5. Files and diff per commit

The following is Git's per-file insertion/deletion record. C3 has no diff. C4 adds only this handoff; it changes no product, test, bound, pin or media.

### R-M1: six files, +20/−7

Commit 7227d2299abe9e99edd196d791cf9bd2571c31bb.

| Exact repository-relative path | Added | Removed |
|---|---:|---:|
| apps/fleetlab-city/test/disabled-state-parity.test.mjs | 10 | 7 |
| playground/fleetlab/capacity/visual.css | 2 | 0 |
| playground/fleetlab/delivery-order/visual.css | 2 | 0 |
| playground/fleetlab/dispatch/visual.css | 2 | 0 |
| playground/fleetlab/rebalancing/visual.css | 2 | 0 |
| playground/fleetlab/software-delivery/visual.css | 2 | 0 |

### C1 D2: six files, +6/−6

Commit d56409e82354220fb10a74941dc5d51fc176b439.

| Exact repository-relative path | Added | Removed |
|---|---:|---:|
| apps/fleetlab-city/test/disabled-state-parity.test.mjs | 1 | 1 |
| playground/fleetlab/capacity/visual.css | 1 | 1 |
| playground/fleetlab/delivery-order/visual.css | 1 | 1 |
| playground/fleetlab/dispatch/visual.css | 1 | 1 |
| playground/fleetlab/rebalancing/visual.css | 1 | 1 |
| playground/fleetlab/software-delivery/visual.css | 1 | 1 |

### C2: thirteen files, +105/−94

Commit c50bf6727afc282a752bb554ac4757338b50ee61.

| Exact repository-relative path | Added | Removed |
|---|---:|---:|
| apps/fleetlab-city/test/stage-check.mjs | 4 | 2 |
| apps/fleetlab-city/test/stage-check.test.mjs | 26 | 23 |
| apps/fleetlab-city/tools/integrate-site.py | 4 | 0 |
| docs/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md | 2 | 2 |
| playground/fleetlab/src/model/ops-cases.js | 10 | 10 |
| playground/fleetlab/src/model/scale-density.js | 4 | 4 |
| playground/fleetlab/src/model/scale-intake.js | 6 | 6 |
| playground/fleetlab/src/model/scale-response.js | 8 | 8 |
| playground/fleetlab/src/ui/simulation-catalog.js | 6 | 6 |
| playground/fleetlab/src/ui/teaching-frames.js | 28 | 26 |
| playground/fleetlab/test/package-proof.test.mjs | 4 | 4 |
| playground/fleetlab/test/stepa-baselines.test.mjs | 2 | 2 |
| playground/fleetlab/test/teaching-frames.test.mjs | 1 | 1 |

## 6. Cumulative candidate bytes and pins

These are accepted candidate measurements, not a new stage build. Every delta from c50bf67 is zero. Live-side identity is the locally recorded 848b420 source / ac431ba3 deployment, read with git show ac87b7a:HERMES_SOURCE_OF_TRUTH.md; no live readback occurred. Local github/main still resolves to ac87b7a2d6cd071adf527e84a57d84c000a5e2af (last fetched 2026-10-27).

The source-of-truth stage table is at lines 199–209, with line 30's 848b420 exceptions for compressed offer and non-City. Brand, legacy and raw-source live values come from the separate unit-measured list, lines 212–215, not that stage table. Candidate legacy/raw counters are teaching-ownership/source receipt measures; brand is the eight staged BRAND_TEXT files. The remaining rows use retained stage measurements. Full provenance: [H2 JSON](../dist/coordinated-c3-c4-20261029/h2-cumulative-final.json).

| Measure | Recorded live | Candidate | Delta live | Delta c50 | Current bound | Headroom |
|---|---:|---:|---:|---:|---:|---:|
| nf03_closure_bytes | 537,802 | 537,943 | +141 | 0 | 541,729 | 3,786 |
| nf04_closure_bytes | 220,926 | 221,062 | +136 | 0 | 225,430 | 4,368 |
| delivery_order_closure_bytes | 226,062 | 226,186 | +124 | 0 | 229,159 | 2,973 |
| r1_closure_bytes | 196,848 | 196,966 | +118 | 0 | 200,443 | 3,477 |
| r3_closure_bytes | 152,851 | 152,969 | +118 | 0 | 156,487 | 3,518 |
| emitted_text_bytes | 3,573,911 | 3,576,516 | +2,605 | 0 | 3,577,477 | 961 |
| package_metadata_bytes | 44,361 | 44,361 | +0 | 0 | 45,385 | 1,024 |
| depot_closure_bytes | 512,868 | 512,868 | +0 | 0 | 515,519 | 2,651 |
| depot_route_local_bytes | 418,159 | 418,159 | +0 | 0 | 418,159 | 0 |
| integration_text_bytes | 128,946 | 128,946 | +0 | 0 | 133,152 | 4,206 |
| integration_source_bytes | 388,890 | 389,169 | +279 | 0 | 397,274 | 8,105 |
| source_offer_extracted_bytes | 4,083,602 | 4,086,530 | +2,928 | 0 | 4,104,316 | 17,786 |
| source_offer_compressed_bytes | 1,149,116 | 1,150,237 | +1,121 | 0 | 1,155,879 | 5,642 |
| non_city_bytes | 16,193,499 | 16,199,076 | +5,577 | 0 | 16,203,828 | 4,752 |
| legacy_text_bytes | 2,605,859 | 2,607,968 | +2,109 | 0 | 2,607,968 | 0 |
| brand_text_bytes | 73,286 | 73,286 | +0 | 0 | 75,937 | 2,651 |
| raw_source_and_tools_bytes | 3,557,298 | 3,559,903 | +2,605 | 0 | 3,569,653 | 9,750 |

The current legacy bound is the approved C2 value 2,607,968 B, with no allowance. Historical live used 2,607,135 B, with 1,276 B headroom; this table does not retroactively apply the current bound to live. Emitted growth is +2,605 B = R-M1 +637 B + C2 +1,968 B. Legacy growth is +2,109 B; non-City +5,577 B; offline +1,851 B; integration source +279 B. The latter is the approved frozen-legacy allowlist/comment change, not a hosted visual change.

Offline candidate: 2,566,962 B, SHA-256 e49c0aba90eb35c342094ddbe9f0db07850eb8c080439e7c18c170637efb6bdd. Recorded live: 2,565,111 B, SHA-256 313fa3f1a94ed0c40b05858c38a1bc9d5d2facc3b1cdff998ec783a6c9f58fa1.

Artwork remains 41 records / 7,793,265 B, digest bcd79b1535cf12f0b3e8c6f42d3563109a1c5e34bdd5245276da2abf9de0f7e9. All 41 recorded live artwork records match the candidate. Depot route-local is exactly 418,159 B; the runner's 418,150–418,159 interval is sidecar tolerance, not headroom. No pin or bound changed in C3/C4.

## 7. Checks run and checks not run

Accepted evidence is reused. C2 precommit gates ran on d56409e plus the exact thirteen-file patch; subsequent committed checks and the clean stage bind that patch to c50bf67. Full argv, environment, exits and log hashes remain in the cited records.

| Check | C1 retained result | C2 retained result / record |
|---|---|---|
| Diff whitespace | Pass | Pass; coordinated-c2-apply-20261029/gates/precommit-summary.json |
| Disabled-state parity | Expected RED 10 pass/3 fail, then GREEN 13/0 | Included in City Node |
| City Node | 307 pass, zero fail | 307 pass, zero fail/skip/TODO |
| Playground Node | 2,943 pass, 9 skip, 1 TODO, zero fail of 2,953 | Same totals and skip identities |
| Traffic Node | 14 pass | 14 pass, zero fail/skip/TODO |
| pytest | 1,675 pass, 55 deselected | Same; zero fail/error/skip |
| Ruff | Pass | Pass |
| City Python | Precommit provenance error; postcommit 375 OK | Precommit and postcommit 375 OK |
| Focused bounds | Clean 16/16 | Precommit 15 pass/1 approved dirty-source skip; clean 16/16, no skip |
| Release builder | Exit 0, local only | Exit 0; stage/builder-result.json |
| Real-stage AFTER | 20/20 | 20/20; stage/stage-check-after.json |
| Exact pins | Pass at C1 pins | Pass at approved C2 pins; stage/staged-pins.json |
| Historical BEFORE | Not repeated for C1 here | 32/32 on retained b15055c; stage/historical-before-result.json |
| Fixtures | Retained evidence | All 130 files in 13 bundles unchanged from C1 and across pytest |
| Colour lock, hub copy, A2, viewport | City-suite pass; Depot 320 exception retained | Included in accepted City suite |

All abbreviated C2 records above are under dist/coordinated-c2-apply-20261029/. Its precommit-summary.json SHA-256 is cc6b3f3096df63c990dea0ce5e79c8eec1c8ded30f2860264ebf6e23348b3726. C1 sources: dist/coordinated-c1-20261028/C1_REPORT.md:108–127, node-gates.json, python-gates.json and city-python-postcommit-result.json.

Preserved negative attempts: C1's uncommitted bound CSS produced “provenance: bound source files differ from the requested source commit”; the unchanged test passed postcommit (city-python-precommit-diagnosis.json and city-python-postcommit-result.json). Earlier R-M1's in-repository TMPDIR caused SOURCE_COMMIT_UNAVAILABLE versus MODIFIED_SOURCE; the unchanged focused suite passed 32/32 using system temp. The hold remains in dist/amendment7-rm1/final-report.json and both attempts in ../Hermes-rm1-stage-7227d22/dist/amendment7-stage-evidence/{focused-packaging-result.json,focused-packaging-system-temp-result.json,initial-failure-diagnosis.json}. Later passes do not erase those attempts.

C3: 61 cards/routes per width per stage, 69/69 expected fields asserted in AFTER, stable count/order and Network Flows discovery. BEFORE recorded text without expected-value assertions. All four widths retain the same geometry flags (109/108/36/0); these are not 109 new defects. The map subset is 108/108/36/0 plus one Depot flow-rules flag at 320. Inherited-field verification records 864 observations across 15 pairs, zero failures. The raw main browser runs exited −15 BEFORE and 1 AFTER; preserved diagnosis explains cleanup and a mistaken harness assumption about workspace Limits. Targeted OPS supplementary review checks passed 24/24 per stage; catalog was checked once per width, review list in three states. Raw outcomes are not relabelled as successful exits. No C3 product edit or full gate rerun was needed.

H5 handoff gate passed before commit: node --test playground/fleetlab/test/stepa-baselines.test.mjs, 8 tests / 8 pass / 0 fail / 0 skip / 0 TODO; legacy_text_bytes 2607968; the +59 B release assertion passed. The 216 ignored site files and offline output were unchanged. The staged-content publication guard passed. Exact execution evidence: [H5 result](../dist/coordinated-c3-c4-20261029/h5-precommit-result.json), log SHA-256 f78608d55f12525169ff7f3653f298a3b5e79bfad47ade4ea98d12ee0c613fee. A committed-source confirmation is retained in the final run report; full accepted suites are not repeated.

| Check / action | Status and reason |
|---|---|
| CI=true fixture guard; macOS CI runner | NOT RUN. Qualified local gates are not CI execution. |
| Pre-push guard over unpublished commits | NOT RUN. No push authorised. The staged-content guard does not scan commit messages. |
| Physical phone | NOT RUN. Browser widths are not physical-device qualification. |
| Fresh C3/C4 full suites or real-stage rebuild | NOT RUN. No product change; accepted candidate gates reused; H5 is the only new test gate. |
| BEFORE mode on candidate | NOT RUN; forbidden. Historical witness concerns b15055c only. |
| About-specific no-script audit | NOT RUN; B2 DEFER, no About change. |
| Zoom, dark mode, keyboard review; post-run map fit; Held-run/result-table design review | NOT RUN / unverified in this review scope. |
| Fetch, push, PR, merge, deploy, publish, live readback, rollback | NOT RUN; not authorised. |
| Media placement; fixture copying/regeneration | NOT RUN; excluded. |

## 8. Four-width evidence and review limits

[Capture index](../dist/coordinated-c3-c4-20261029/captures.json) binds all 302 originals, routes, widths, hashes and eye flags. SHA-256 d1e45790697620d0a5da0c339977d7264beb013b46feef78bdbe21d38188bb40. [C3 report](../dist/coordinated-c3-c4-20261029/C3_REPORT.md), SHA-256 15cdcdb48fff71fd5131e36ec246ef20b49f532b9175029ba5fab925835f1a1e, retains the detailed DOM and visual findings.

| Width | BEFORE originals | AFTER originals | Eye-flagged originals | OPS-02 paired example hashes, BEFORE / AFTER |
|---|---:|---:|---:|---|
| 320 | 38 | 38 | 52 | [before](../dist/coordinated-c3-c4-20261029/browser/before/before-OPS-02-situation-320x700.png): 4ce8bf14018a6186cb9a536c96a21a4fdb345f8224d2cd0ec18dffe147d4185e / [after](../dist/coordinated-c3-c4-20261029/browser/after/after-OPS-02-situation-320x700.png): 8be30d5ef8267ae517e519facd7f5af021b94818674e1276c7b4853848036211 |
| 390 | 38 | 38 | 52 | [before](../dist/coordinated-c3-c4-20261029/browser/before/before-OPS-02-situation-390x844.png): befe63577fd4f76f1a79694bc80d684acf1de211c7b02280d89f053cdc910e5f / [after](../dist/coordinated-c3-c4-20261029/browser/after/after-OPS-02-situation-390x844.png): e3b2ad98a8b8abcfce961fda1555206c64a63c4304aab14ed1c3d1bca3146f13 |
| 768 | 37 | 37 | 50 | [before](../dist/coordinated-c3-c4-20261029/browser/before/before-OPS-02-situation-768x1000.png): 16cb2244722b9d459d3df06a50000b6575ea448e870ef774cf4fa5e6c5ee9c5a / [after](../dist/coordinated-c3-c4-20261029/browser/after/after-OPS-02-situation-768x1000.png): 8653f2d94e6cbafe076a33c75360f073ef4d8ad5fb5220c4de0efcdfde3cac94 |
| 1280 | 38 | 38 | 54 | [before](../dist/coordinated-c3-c4-20261029/browser/before/before-OPS-02-situation-1280x900.png): 5fd18068355719cc2556dd50fdae26e4933d022090d64846e220e33facec53c5 / [after](../dist/coordinated-c3-c4-20261029/browser/after/after-OPS-02-situation-1280x900.png): 984947b10a536cc97d17b2454165712af35308f486019bd3bf8d2618e567fd6b |

Codex's 208 eye flags mean images viewed, including 136 through 1:1 composites; they do not mean all pixels of every taller target or every changed field were visible. Codex captured 16 of 61 lessons; 33 of 69 fields have no captured element; one of nine inherited surfaces was sampled. The four vehicle-picker-full captures at 768/1280 in both phases show the setup panel and were not eye-flagged; they are not picker evidence. Text hidden by a pill is supported by DOM text, not by an unobscured pixel review.

Fable pre-screened all 302, opened 40 originals and made 28 judge PNGs (25 distinct) in six loopback re-serves, retained under dist/fable-c3-judge-20261029/. The review added chips, chooser, catalog, another glossary route and pre-run maps. It was not a complete eye pass of all 61 lessons. No C2-caused clipping, overflow, collision or hierarchy defect was found; roughly twenty new number/unit, time or hyphen splits and about ten removed splits are accepted polish.

Fable's V1–V12 reporting qualifications are preserved: the old 300-PNG summary is stale; final count is 302. The request rule supplied BlockedByClient, not an observed network-event reason. Two probe ports were omitted from the old serve index; the wrapper was not hash-bound per run. Node process checks do not independently prove Chrome termination. The judge observed one app-created checkpoint-ref/object exception after C3 final verification; it was not a product commit/branch and did not change MAIN. The claim that all evidence objects were under the run folder is therefore qualified. Earlier records remain immutable; C4 adds clarification rather than rewriting them.

## 9. Contrast

No styling changed in C2, C3 or C4; no new contrast measurement is claimed. The combined candidate retains C1's measured controls at dist/coordinated-c1-20261028/C1_REPORT.md:70–106 and browser/contrast-records.json: 274 instance records, consisting of 106 actual-browser observations and 168 labelled parity-model observations. Labels span 5.693:1–7.123:1. There were 93 logical-row passes and 13 without an enabled sibling (N/A); 86 stable-state hover/active probes showed no change.

Dispatch amber Add pair: label 5.693:1, border 1.055:1. Enabled Reset's 1.586:1 border is in another row and is not a same-row pass. Rebalancing busy Remove: label 6.289:1, border 1.166:1; its borderless-enabled/boxed-disabled family remains a residual. Fable's computed roughly 5.9:1 Limits-summary observation does not establish equal hierarchy or replace the retained contrast audit.

## 10. Residuals and costs

The owner accepts every Fable R1–R32 for this candidate on its recorded terms. Only R18/R19 are new with C2. Acceptance is not a completed correction or permission to implement one. Unless a figure below is explicitly identified, future patch, source-offer and aggregate costs are UNMEASURED; none is assumed to be zero. Legacy growth requires a measured amendment; any offline-bundled change requires the exact re-pin procedure.

| ID | Residual | Decision, dependency and cost |
|---|---|---|
| R1 | Fixed motion pill overlaps at all four widths | Accepted B8; first future move, Scope 2 step 4. Brand-layer cost affects all six closures; unmeasured. |
| R2 | I-/PACE at 1280 | Accepted B8. Legacy no-break markup needs offline re-pin; unmeasured. |
| R3 | Three-column Staffing panel at 768 | Accepted; second future move, hosted-only CSS; emitted/integration/offer/non-City cost unmeasured. |
| R4 | Long 1280 measure; glossary term weight | Accepted. Hosted width/style cost unmeasured; term markup may touch legacy. |
| R5 | Pre-run map-label clipping at 320/390; 768 in retained preview | Accepted. Post-run fit unverified; legacy map/CSS re-pin required. |
| R6 | Depot setup table at 320 | Accepted: 299 px in 282 px scroll container, 17 px hidden without cue. Route-local pin decision needed; unmeasured. |
| R7 | Truncated native selects, including Fleet day situation | Accepted. Legacy relabel/re-pin or title echo; unmeasured. |
| R8 | Unidentified dark 1280 column | Accepted, pre-existing. Cause not established; diagnose before costing. |
| R9 | OPS-18/20 Decision-test chips | Accepted B4. Kind change adds 1 legacy B each, changes Held-run text and requires offline re-pin. |
| R10 | Police chooser heading over OPS-17–20 | Accepted B5. Legacy label, labels.test.mjs exact contract and offline pin need separate approval even at net-zero bytes. |
| R11 | Lesson-only numbers in root policy How | Accepted; C2 fixed Limits only. Legacy correction/re-pin; unmeasured. |
| R12 | About intro and lesson-ID note | B2/B3 DEFER. Corrected About 441→533 B is +92 emitted/integration bytes; two source copies roughly +184 B, remaining costs unmeasured. ID proposal 215 raw UTF-8 B before insertion code; not integrated. |
| R13 | specification.notation; fleet-intake power/ports | Required source stops remain. Before absent/mismatched; no implementation, eventual cost unmeasured. Delivery PARTIAL. |
| R14 | Synthetic / Constructed / Invented / Fictional terms | B6 DEFER; offline re-pin either direction. Full cost unmeasured. |
| R15 | Guide police framing and retired grounding strings | B7 KEEP as dated history. Future history-only refresh 0 release B, but test-data edit separately authorised. |
| R16 | C1 Depot 320 exception; Remove family; Dispatch amber border | Accepted with retained 1.166:1 / 1.055:1 border findings. No fresh contrast or patch cost. |
| R17 | Network Flows Scope 2 steps 2–8/10; step 9/D1; parked media | Pending separate authority; step 9 excluded pending pin ruling. Media arithmetic below is not placement approval. |
| R18 | New C2 number/unit/time/hyphen splits | Accepted polish, not B1 defect. ASCII constraint remains; correction cost unmeasured. |
| R19 | New C2 wording (a–i below) | Accepted as not false and not a release risk. New strings need approval, offline re-pin and legacy-growth amendment if positive. |
| R20 | Limits summary lighter/smaller than siblings | Accepted, honesty-relevant. Hosted hierarchy remedy unmeasured. |
| R21 | Generic-only route Limits on 38/59 generic routes | Accepted, honesty-relevant: 32 Four-area plus 6 Street lab. Catalog-specific limits exist; route framing/re-pin correction unmeasured. |
| R22 | Raw set-as keys/encoded tokens | Accepted. Plain-value framing is legacy/re-pin; unmeasured. |
| R23 | Default-blue/purple links and mismatched lesson title | Accepted. Styling/copy remedy needs measurement and applicable re-pin. |
| R24 | Narrow outcome-legend columns and label placement | Accepted. Hosted/legacy correction unmeasured. |
| R25 | Scale sticky run bar covers viewport copy | Accepted. End-clearance remedy unmeasured. |
| R26 | Network Flows eyebrows, arrows, AND and numbering | Accepted under R17, separately authorised Scope 2 work. |
| R27 | Undefined hub NOT_EVIDENCE/NONE tokens | Accepted under R17; plain-language clarification unmeasured. |
| R28 | Wrapped Staffing meta-row divider | Accepted. Spacing correction unmeasured. |
| R29 | Street-first How uses unmarked button subject | Accepted. Legacy copy/re-pin; unmeasured. |
| R30 | 390 inline-link gap; one 1 Gbps | Accepted. Depot route-local correction/re-pin; unmeasured. |
| R31 | OPS-02 run-on | Accepted pre-existing; C2 changed final clause. Legacy rewrite/re-pin; unmeasured. |
| R32 | Existing number, ID and version splits | Accepted polish. Correction unmeasured. |

R19 preserves all nine subitems: (a) “software when scheduled”; (b) ambiguous “a directive removing them”; (c) undefined “one sweep each”; (d) D2 00:30 and inconsistent minute wording; (e) unmarked vehicle-mix button, unidentified SUV/minivan profiles, OEM, modeled/modelled; (f) lost fleet-intake pointer and unmarked density lead-ins; (g) Decision and Condition combined in one glossary entry; (h) “all run” and H4; (i) construction-or-utility versus construction-staging wording. No correction is made here.

Parked v5 media totals 98,338 raw B against 4,752 B non-City headroom: 93,586 B additive excess before overhead if added once without removals. This is not measured integration cost and MP4 bytes are not automatically text-closure increments. Artwork, offline and Depot route-local pins remain as above. No budget/pin approval is granted.

## 11. Verdicts and status

Judge: Fable, 2026-10-29, on the retained c50bf67 stage and inventory digest stated in section 1. The owner's PART C message supplies these verdicts verbatim:

> Craft: PASS WITH RESIDUALS. Comprehension: PASS WITH RESIDUALS. Honesty: PASS WITH RESIDUALS.

The owner accepts all R1–R32 and the B2/B3/B6 deferrals, keeps B7 history, and retains the B9 source stops. The local verdict file is linked as [Fable's full review](../FLEETLAB_COORDINATED_C3_FABLE_VERDICT_2026-10-29.md); it remains untracked.

Candidate release-eligibility under the accepted gate definition, with D0 confirmed: **ELIGIBLE**. Coordinated delivery: **PARTIAL**, because both required source-stop items remain stopped. These are distinct from publication permission.

### Codex self-assessment

Craft: PASS WITH RESIDUALS for C2 compatibility, including actual viewport pill overlap and polish limitations. Comprehension: PASS WITH RESIDUALS for the reviewed copy, retaining every R19 wording limitation. Honesty: PASS WITH RESIDUALS for bounded claims and explicit missing evidence, with R20/R21 still material. This is not the judge's verdict and does not claim all 61 lessons or every state were eye-reviewed.

## 12. Remaining owner decisions

B2 About intro, B3 lesson-ID note and B6 terminology are accepted deferrals, not work authorised here. B4/B5 remain accepted-as-built semantic residuals. B7 stays dated history. B8 corrections require their separate phase authority. B9 needs source-corrected Before strings and an implementation decision, or an explicit decision removing the items from the required set; silence does neither.

Publication sequencing versus pending Network Flows Scope 2 steps 2–8/10 (B13) remains an owner choice. Step 9/D1 stays excluded until its pin decision. The pill-first and hosted Staffing-second priorities are accepted future directions, not permission to implement them during C4. Any media budget change must be itemised and measured per affected bound and pin.

Push, PR, merge-commit integration, merged-commit reinspection, physical-phone check, proof package and publication each need their own instruction. A future publication message must name the exact merged commit and exact target, followed by live readback. Merging alone does not publish. Intended future fallback is recorded production ac431ba3 / source 848b420; the receipt's older site rollback 72e45e9f / a1b79cd and City-viewer generation 0bdffbfcff0e1bf9 are different identities. No rollback was rehearsed.

## 13. Reproducibility and local evidence

The candidate commit reproduces the thirteen-file C2 diff, deterministic offline build/pin, clean legacy count 2,607,968 and test sources. Gate logs, 130 ignored fixture files, Step A inputs/toolchain under build/, stage worktrees, retained b15055c stage, owner approvals and review files require retained local state. This handoff does not make those ignored/untracked artifacts available in a fresh clone.

[C2 addendum](../dist/coordinated-c3-c4-20261029/C2_APPLY_ADDENDUM.md) SHA-256 f6f628b3a921e6627635787273f84f558f73f2b036701dff1bc95dcf3c89e58e; [C3 report](../dist/coordinated-c3-c4-20261029/C3_REPORT.md) and capture index are bound above. C4 source bindings, entry inventory, H5 log/result, branch containment, owner comparison and final report are under dist/coordinated-c3-c4-20261029/. The old reports and evidence stay unchanged. Fresh hashes for pending-about-id-notes.json, whole-patch-review.md and feedback-application.json are C4 observations, not retroactive claims that old JSON bound them.

The new gate uses official Node 22.23.4 / zlib 1.3.1-e00f703, City CPython 3.11.15 and hermes-dev CPython 3.11.15, with the system TMPDIR outside Git, CI/TMP/TEMP/FLEET_PLAYGROUND_PERF unset, FLEET_PLAYGROUND_BASE=bca4ccd, FLEETLAB_REQUIRE_CHROME=1 and PYTHONDONTWRITEBYTECODE=1. No toolchain installation or dependency change occurs.

## 14. Boundary of this handoff

This is neither publication authority nor Network Flows Scope 2 completion. No push, pull request, merge, deployment, publication, live readback, product edit, media placement, bound change or pin change is part of C4. Any publication rebuilds and re-measures from the exact merged commit.

Simplified simulations for learning — not evidence about real-world safety. Nothing here approves deploying a vehicle or policy.
