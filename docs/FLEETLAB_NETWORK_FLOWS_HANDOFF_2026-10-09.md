# FleetLab Network Flows handoff

**Date: October 9th, 2026. Owner: Bo-Huei Lin.**

This continues the October 8 NF-01 release and implements the first round of the October 9 design additions: Stages 0, 0.5a, 0.5b, 1 and 2. The owner explicitly authorized implementation, validation, Git push and educational website publication. This does not authorize any operational or physical deployment.

**Release status at source freeze:** implemented and locally validated; publication receipt will be filled after preview and production readback. Do not infer publication from this source-freeze paragraph.

Open the two lessons under the existing **Depot flow lab** destination:

- [Two vehicles, one uplink](https://fleetlab.pages.dev/#/depot-flow-lab?lesson=two-vehicles)
- [Four visits, crossed priorities](https://fleetlab.pages.dev/#/depot-flow-lab?lesson=crossed-priorities)

## What is preserved from October 8

FleetLab still includes Overview and its concept film, Fleet day, Street lab, Four-area experiments, Scale lab, Learning catalog, Product approach and SF City Explorer. These are complementary learning models, with separate assumptions. The hosted header has nine destinations; the offline edition has eight. Two Depot flow lessons share one destination. The catalog now contains 61 lessons.

NF-01 remains the same bounded event-driven model and independent verifier. Its model, policy, metric, record and verifier versions remain 1.0.0; the original 10 kWh fixture and current 6 kWh fixture remain tested. The central scope-literal exception stays confined to the existing contract module. Guesses are now page state rather than part of the exported wrapper; scientific records are unchanged.

The current SF City release remains `c56bda6b509105c5bee778980c01d13028401bc03fc8b49b4948f65c6f18f63f`; the sanitized compatible rollback remains `e3318a76588a740311c902ad305cfaa99381c052b5d1963cfd444fc08c177591`. No map data, scientific arm, threshold, vehicle profile, source offer or human qualification result was changed. SF qualification remains **HOLD**. Austin and other new cities were not started.

## What visitors can now learn

**First lesson:** a full battery does not imply readiness. Upload completion and the local post-upload step also matter. The default model makes FIFO ready at minutes A12/B13, equal share A13/B4 and deadline priority A13/B3. Changing B to 45 GB exposes conflicting objectives: FIFO misses one departure with 13 late minutes; deadline priority misses two with 6 late minutes. At a 20 kW charger and 1 Gbps uplink, A's minute-18 charging completion masks upload-order changes.

**Second lesson:** short uploads and urgent departures are different priorities. A/B/C/D upload 60/7.5/45/15 decimal GB, are due at minutes 10/15/22/6, arrive at zero and already meet their battery targets. One 1 Gbps payload link is shared; every visit has an independent two-minute local step. All rules use a 25-minute observation horizon.

| Rule | Ready minutes A / B / C / D | Missed departures | Total late minutes |
|---|---|---:|---:|
| First come, first served | 10 / 11 / 17 / 19 | 1 | 13 |
| Equal uplink share | 19 / 6 / 17 / 9 | 2 | 12 |
| Departure deadline first | 12 / 13 / 19 / 4 | 1 | 2 |
| Shortest upload first | 19 / 3 / 11 / 5 | 1 | 9 |

These literal schedules pass at both one-second and quarter-second service steps. This is a check of this constructed fixture, not general time-step adequacy or fleet performance. The independent verifier reconstructs every accepted service slot, policy, completion, deadline and metric. Whole-byte remainders rotate among the currently eligible visits; unused grants remain accounted for. Tests catch both lowest-ID and global-ring remainder mutants.

A and D require 75 GB uploaded by minute 8, but only 60 GB can pass through the link by then. Their shared work cannot meet both departures. Finishing A last implies at least two late minutes; finishing D last implies at least six. Deadline priority reaches two here. The page derives this display from the bound and verified result, and withdraws the impossibility statement when a changed bound no longer establishes it. This is not a general optimal scheduling claim.

## Experience and implementation

- Rules and assumptions appear before Run. Clear lesson links, readable body text, a 20 px introduction, deterministic evidence chips, model/version details and a scoped glossary explain the page before a result exists.
- Run computes a complete verified comparison. **Play is explicit** and reveals its recorded service. Outcomes remain fixed. One master cursor drives charging, upload, local-step and readiness marks; deadlines stay visible.
- Speeds are 10×, 20× and 40×, with 20× initially selected. Guided stops default on. Reduced motion advances one event per second. Hidden tabs, routes, input changes, reruns, table selection and preference changes pause playback; nothing resumes automatically.
- Exact event buttons, a one-second range, keyboard minute/page steps, static tables, task histories and an event ledger remain available without animation. Announcements occur on discrete actions, with previous-run context when results are stale.
- Phones show stacked outcome cards. NF-01 retains all groups in a roughly 336 px timeline; NF-02 offers one rule at a time because its all-rule figure is taller. Selected vehicles use outlines and label emphasis, not diminished contrast elsewhere.
- One-control next-test questions depend on the actual setup and recently tried settings. Optional guesses reset after completion and never enter exports. Returning to the completed inputs restores the initial question.
- A previous-run comparison appears only for one changed input with final, compatible results. Two-input changes create a new reference without a misleading change explanation. Cancelled, invalid and stale attempts cannot masquerade as new comparisons.
- A separate `depot-flow-projection/1.0.0` presents immutable records; it is not a sixth model version. Independent integration/event-fold oracles, literal boundary snapshots, published-source byte fixtures and deliberate mutants test its meaning.
- NF-02 uses separate `depot-cohort-*` contract, engine and verifier modules. Ordinary static imports include both lessons in both editions. No new fetch path, dynamic import, dependency, runtime service, CSP permission or telemetry was added.

## October 9 audit decisions

The supplied review is advisory design input. Its statements were checked against code, executable schedules and browser behavior. AI review does not satisfy independent human qualification.

| ID | Decision and outcome |
|---|---|
| I01 | Accepted: guarded single run, focus-preserving busy state, result focus only when appropriate, cancel return, stale status, enabled-but-inactive event boundaries. |
| I02 | Accepted: persistent discrete live announcements, named regions, grouped events, no per-frame speech, stale context. |
| I03 | Accepted: exact upload/energy/local-step/readiness projection; minute 11 distinguishes a running local step from readiness. |
| I04 | Accepted: visible optional-guess label, no-guess default, human labels, result feedback, reset and export exclusion. |
| I05 | Accepted presentation changes: readable model/trust details, grouped checks, event ledger and on-demand JSON. The proposed verifier-rule wording change is deferred to a versioned verifier change; NF-01 1.0.0 is preserved. |
| I06 | Accepted: all depot UI/model modules receive copy scans; coverage and planted forbidden-copy tests prevent silent omissions. |
| I07 | Accepted: existing chart infrastructure, shared time axis, rate thickness, separate waiting/local-step/ready/deadline marks, tables and token colors. |
| I08 | Accepted: result-derived counts, per-vehicle tradeoffs, charging explanation, next test and operations takeaway. The derived headline itself is the result heading, keeping focus and the answer together. |
| I09 | Accepted: two-column setup with rules before Run, one-column narrow layout, shared width and corrected hosted introduction typography. |
| I10 | Accepted: explicit End-of-run outcomes, sticky desktop rule column, stacked phone outcomes and bounds. |
| I11 | Accepted: remove the redundant header badge; keep all disclosures. Nine links fit at 1366/1440; Explore uses a three-column hosted grid below 1280. |
| I12 | Accepted: Fleet day bridge text distinguishes fixed-duration sequential work from this parallel resource model. |
| A01 | Accepted: controlled reveal of verified records; no automatic playback or simulation reruns during playback. |
| A02 | Accepted: record-derived guided moments, default stops and tested captions. |
| A03 | Deferred with NF-03: the capacity decision page needs its fixed workload and protocol; no fabricated 36-cell results. |
| A04 | Accepted: previous-run comparison with one-change/final-result conditions. |
| A05 | Accepted: shared chips/glossary helpers; deterministic label and scoped terms including service step and shared capacity bound. |
| A06 | Accepted: second lesson identity, accessible chooser, catalog entry, count-free descriptive copy, improved pre-JavaScript intro. |
| A07 | Accepted: rotating remainder tests plus both specified mutants at both quanta. |
| A08 | Accepted: input-dependent optional questions; direct suggested edits and restored inputs have regression coverage. |
| C01 | Use the existing static graph for both editions. No new hosted-only build machinery. |
| C02 | Explicit transport, common app motion preference, native button keys, fixed speeds and no automatic resume. |
| C03 | Independent arithmetic/event-fold oracle and published-byte fixtures avoid projection-to-projection tautologies. |
| C04 | Static, calculated capacity table and proportional bar; consistent rule order; claims disappear when the bound does not establish them. |
| C05 | Projection identity remains outside model records and version keys. |
| C06 | Plain visitor copy; no employer/hiring positioning in new lesson modules. Existing global non-affiliation footer retained. |
| C07 | One-change suggestions are questions, not promises of improvement; matched no-effect controls retained. |
| C08 | All NF-01 groups stay visible; NF-02 phone selection controls the taller figure. |
| C09 | Preserve both raw-code caps and at least 50,000 bytes offline reserve. Aggregate build measurements are below; intermediate stage estimates were not presented as measured artifacts. |
| C10 | Verify the fixture's shared bound and all 24 serial permutations; restrict the two-minute conclusion to these visits. |
| C11 | Retain the proposed fluid capacity preview as future NF-03 design input, not an executed study. |
| C12 | Retain inclusive buffer-reservation semantics and optional B deadline as future NF-09 protocol decisions. |
| C13 | Extend exact integration and copy allowlists; version the release label to `depot-flow-nf01-nf02`. |
| C14 | Retain cumulative effort framing and estimate-isolation tests for the later stress study. No staffing estimate is a delivery guarantee. |

## Review findings resolved

Independent reviews reproduced and verified fixes for: incorrect B/C deadline copy; a bound display ignoring its calculated values; heading focus lost when changing lessons; guess mode chosen from result existence rather than changed inputs; and a forged successful comparison replacing the accepted result before validation. Validation now occurs before accepted state changes, and a rejected candidate retains the previous good record.

Browser testing additionally exposed inline lesson links whose wrapped hit boxes overlapped. The chooser now uses distinct flex items with 48 px targets. The current desktop and phone layouts were inspected again after correction.

## Validation and build budget

Fresh complete gates during this release:

- Teaching Node suite: 2,032 passed, 8 skipped, 1 existing TODO; no failures (2,041 tests).
- City Node: 63 passed; City Python: 321 passed.
- Hermes: 1,662 passed, 55 existing skips, with the required boundary base and this checkout's Python source.
- Ruff and diff whitespace checks passed. Doctor: 16 PASS, two environment/dirty-checkout WARN, one optional display NOT_AVAILABLE.
- Both distributions pass policy, URL, forbidden-token, copy, scope-label and size checks. No ceiling was raised.
- Locked deployment dependency audit: zero reported vulnerabilities; all 38 registry signatures verified, 22 attestations verified. Map renderer dependency audit: zero reported vulnerabilities. These are dated observations.

Final source-freeze build: offline **2,543,663 bytes**, hosted code **2,372,649 bytes**, cap **2,621,440 bytes**. Offline reserve: **77,777 bytes**. Relative to October 8, each code edition adds **72,932 bytes**. Hosted media are separately budgeted. NF-02 records retain exact slots; the readable allocation table compresses only contiguous equal allocations and keeps interval-reference spans.

Browser checks: default and counterexample lessons, exact guided stop at minute 3, unchanged end outcomes while playing, four-rule execution, 375/768/1024/1366/1440 widths, collapsed/expanded hosted navigation, readable hosted introduction, and zero observed console errors in inspected routes. File-origin browsing was blocked by the browser tool's protocol policy; no workaround was attempted. Packed-code tests cover the offline artifact, but a fresh physical file-open browser check is **not claimed**. ADB showed no connected device. Actual Pixel, VoiceOver/TalkBack listening, independent human usability and cross-engine device coverage remain unverified.

## Release receipt

Pending publication/readback at this source checkpoint. The canonical receipt is `docs/releases/fleetlab-current.json`; the final handoff update will record the actual immutable deployment and checked file count.

## Remaining work and SF boundary

This completes the first implementation round, not every proposed future network study. Next protocol work is NF-03: a fixed 12-visit workload, common horizon, service objectives, work classes and the 36-cell scheduling/uplink/charging study. Then test estimate error with explicit information isolation; consider a solver reference only after defining its formulation, tolerances, incumbent, bound and gap. NF-09 destination acknowledgment and finite-buffer work requires its own reservation semantics and failure/censoring contract. No such results are claimed here.

SF still needs independent source/map observations, device/accessibility observations and visitor comprehension evidence. Automated code, browser and AI reviews cannot replace those. No new SF power-study arms, scientific qualification, production-fleet calibration, authenticated evidence or regulatory/safety claims were added.

## Recommendation

Use the first lesson to teach readiness dependencies and the second to distinguish urgency, job size and objectives. Keep SF HOLD and the future capacity protocol explicit.

## Top risks + mitigations

- Overgeneralizing constructed visits: visible assumptions, exact fixture bounds, no general winner or fleet benefit.
- Mistaking playback for continuous physical simulation: recorded service only, fixed outcomes, clear motion controls and static alternatives.
- Publication regression: exact module allowlist, preserved City assets and full preview/production readback before success is reported.
- Missing human/device evidence: report it as open; do not infer it from automated checks.

## Next 3 actions

1. Demonstrate both lessons and the B45GB counterexample; use the event cursor to explain the waits.
2. Collect the separately required SF map/source, accessibility and visitor observations when available.
3. Design NF-03's workload and objective contract before building the capacity study. No Austin work is included.
