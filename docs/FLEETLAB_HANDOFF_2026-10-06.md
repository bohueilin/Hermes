# FleetLab handoff — October 6th, 2026

**Owner:** Bo-Huei Lin. **Audience:** ChatGPT web, Claude/Fable, Muse, Gemini, human reviewers and the next implementer.

**Scope:** improve and close the supported Claude design findings for San Francisco while preserving the complete FleetLab product. **Do not start Austin or another City Explorer city.** This file includes the entire October 5 handoff as a clearly marked historical appendix; no separate October 5 attachment is needed to understand the prior work.

**Latest status:** the supported October 6 design fixes are implemented, tested, pushed and live. The non-human work for this accepted SF release is complete. Formal SF acceptance remains **HOLD** for the human/source requirements carried forward below. A polished, live educational site is not a qualified map, an operator recommendation, a safety assessment or permission to deploy a vehicle or policy.

## 1. What changed on October 6

- Event Seek and shift segments now bring the map, exact cursor clock and vehicle status into view. Keyboard focus follows the result.
- Inspect pair lands on its selected repeat/configuration and names the currently displayed layout before describing the comparison. The adverse results remain visible.
- Scope & sources is a sixth City tab with a selected state; opening model limits reveals the destination instead of retaining the old scroll depth.
- The +1.11 pp completion tile gives the existing +2 pp practical-margin interpretation more prominence. No statistical method, threshold, map eligibility or experiment outcome changed.
- Home and City Explorer define open map qualification and link its checks. The ledger explicitly distinguishes recorded SF v1 from candidate-map review.
- On phones, the event table fits exact time, event and Seek. All 56 events remain; the redundant elapsed column is hidden only on small screens.
- Facts explain exact operational event time versus held 15-second position/sample state locally. At 09:36:29, the vehicle can be queued while its 09:36:15 drawn sample still says turnaround.
- Plain-language trust explanations preserve separate internal consistency, authenticity, authorization, deployment permission and simulation scope.
- The aggregate fleet introduction explains that 100 interacting vehicles are not 100 independent observations. The original statistical sample is twelve paired seeds.
- Captions and explanatory text are larger and darker. Overview/film, Fleet day, Street lab, experiments, Scale lab, 59 lessons and the unchanged offline edition remain available.

The [October 6 audit decisions](FLEETLAB_SF_AUDIT_CLOSURE_2026-10-06.md) give an accepted/adapted/rejected decision for each Claude finding and carry forward every October 5 Muse/Gemini decision. The AI auditor's workflow and agent count are not independent human qualification.

## 2. Current product links and a short walkthrough

- [FleetLab home](https://fleetlab.pages.dev/#/overview)
- [SF City Explorer](https://fleetlab.pages.dev/city-explorer/)
- [Decision notebook](https://fleetlab.pages.dev/city-explorer/#compare): read completion beside the practical margin, then inspect repeat 9. It improves completed count but has a longer boarded-wait p90 in that repeat.
- [Replay studio](https://fleetlab.pages.dev/city-explorer/#replay): select original repeat 1001, A, EV-001; inspect its aggregate context, then Seek the 09:36:29 charging-queue event. Compare exact clock with the held sample; no trip or source record was rewritten.
- [Scope & sources](https://fleetlab.pages.dev/city-explorer/#limits): inspect the recorded-map ledger, then return to [the atlas](https://fleetlab.pages.dev/city-explorer/#atlas) for candidate maps and remaining review obligations.
- [Launch rehearsal — Region B](https://fleetlab.pages.dev/#/fleet-day?lesson=region-launch): the existing launch-readiness teaching example, separate from SF acceptance. Detailed steps and October 5 observed results are in the carried-forward section 1 below.

## 3. Remaining work and what no longer needs another handoff

No new AI audit is required to finish this implementation pass. Section 6B in the October 5 material is an **optional AI map/source claim-triage prompt**, not the next mandatory prompt. This combined handoff supplies previous context if an optional reviewer is invited later. Local paths do not transfer their source files; obligation-level review still needs the relevant frozen evidence package.

The remaining SF acceptance requirements are unchanged: source rights/version clarification; independent capable map/GIS observations and conflict resolution; human accessibility/device tasks not covered by automated checks; five independent visitor sessions with scoring; and the owner's recorded acceptance decision. The reviewer tools, obligations and templates are already prepared. AI design audits count as zero qualifying human observations.

The stopped 200/400 kW power study, r3 proposal, calibrated vehicle classes and physical curb/depot maneuvers remain deferred under the accepted October 4 scope. They were not silently completed or restarted. No new SF evaluation arms ran. Austin and other City Explorer cities remain **NOT_STARTED**; the older Austin teaching example in the main site remains preserved content.

## 4. October 6 validation and publication

Publication is verified. The supported October 6 implementation is **tested, pushed and live**; SF acceptance remains HOLD.

| Item | Verified value |
|---|---|
| Live site | [FleetLab](https://fleetlab.pages.dev/) |
| Immutable production | [October 6 release](https://c722398b.fleetlab.pages.dev) |
| Immutable City viewer | [City Explorer](https://c722398b.fleetlab.pages.dev/city-explorer/releases/4e414aa544653f71/) |
| Production deployment | `c722398b-e5d4-4414-9080-1d7f8b1b584d` |
| Preview deployment | `785d5d6f-95ea-4829-a989-0e7fd4d551c8` |
| Published code commit | `9d3563817f37ff7f737a0f102566a6cb1a7e5de4` on `github/codex/fleetlab-city-sf` |
| Viewer release SHA-256 | `4e414aa544653f71b0f0c5e9a42e740e553d79bc9f8e43e8da78348883fc2b56` |
| Retained rollback viewer | `f6ebc583cb5e08f237c0756f1387856eaf41358abb9103bdc2200c74328f6e80`; staged, rollback not performed |
| Combined stage | `build/fleetlab-city/launch-integration-v12/site` |
| Package inventory | 10,040 files / 1,619,335,128 bytes; `_headers` is configuration |
| Full preview readback | **10,039 / 10,039** served files matched; headers passed |
| Full production readback | **10,039 / 10,039** served files matched at `fleetlab.pages.dev`; headers passed |
| Production readback SHA-256 | `46a4a0893767734742b26a77b77502d03a59dc69aa4f73e89d303df38acc7210` |
| Integration manifest SHA-256 | `5dd1a08f45f3564eb292ef9a7e5e1aad463cc959996c593f48a6cf1386727f70` |
| Publication record | `build/fleetlab-city/launch-integration-v12/review/publication-2026-10-06.json` |
| Publication record SHA-256 | `c60c16dff16d59556f4d559b32d7c2519ace0bb1be3e3f68bddca68086b4de51` |

Validation: **312 City Python tests**, **60 Node tests**, **1,661 Hermes tests / 56 skipped**, Ruff, diff checks, immutable distribution validation, complete package preservation and preview/production HTTP checks passed. Doctor: 17 PASS, one working-tree WARN, one optional display NOT_AVAILABLE. No dependencies were installed or upgraded. The final CSS-only corrections were checked in the browser and the Node suite rerun; no core changes followed the full Python suites.

All **4,886 non-catalog data files**, **13 protected review inputs**, frozen scientific modules, comparison core, **96 original site assets**, offline bytes and the two dated October 5 documents remain unchanged. The viewer contains **4,961 files including release.json / 768,138,996 bytes**, a 5,083-byte increase from the previous viewer. Catalog-only semantic difference is measured exporter peak RSS. Qualified-map `public_release_ready` remains false. No new evaluation arms or human observations were created.

Browser checks reproduced the original seek/limits failures, then verified exact-event seeks, full 56-event retention to 15:00, repeat 9/layout context, sixth-tab selection, playback restart, keyboard event activation and slider End. At 375 px, event table and container both measure 267 px. All six City sections and seven preserved main-site destinations had no page overflow or rendered text below 12 px in the inspected states. The actual Street lab Run action still produced a completed synthetic result. The preview retained 59 catalog cards, the film/control and owner contact. Computed City muted contrast is 4.94–5.62:1 on the audited panels; corrected Street captions are 5.29–5.94:1 on their audited backgrounds. These checks are bounded technical evidence, not a blanket accessibility certification.

The final production browser check confirms exact 09:36:29 Seek, visible status, 56 events, the fitted phone table and correct Scope & sources navigation. Stable City URL selects `city-explorer/releases/4e414aa544653f71`. Root legacy assets retain their existing cache policy; an already-open tab may need a reload or the immutable production link to show fresh presentation. Data is bound to the new immutable viewer path.

Local evidence: `build/fleetlab-city/validation/sf-design-20261006/` contains test logs, red/green evidence, screenshots, browser measurements, audit input identities, contrast results, deployment logs and complete readbacks. The first local test run exposed a method-extraction test boundary after adding a method; rearranging the method placement restored its intended contract. The new welcome-legend assertion caught a wrong host selector before publication. The fresh code review's extra contrast findings were corrected and verified. An unpublished intermediate combined stage v11 was superseded by v12 for final lead-text hierarchy; no failed preview or production release was published in this pass.

The source-offer manifest remains `71872c6f571c644dbc2fbfee4bb308e3ed2f7406c7a54ecb3f70ab0e2e4fc817`. Offline HTML remains `169388571013337332b33aad79d7e4576e6490f07ec70322ced188dfd0c8c130`, served from its canonical extensionless download URL with an attachment filename. Full file and header checks passed. The earlier `file://` tool restriction remains; no fresh saved-file launch is claimed.


**Device boundary:** ADB reported no connected devices during this pass. October 5 physical-Pixel results are retained below as historical evidence, not repeated or promoted to a new pass. October 6 browser checks cover desktop 1024×768, phone 375×812 and narrow 240×720 reflow. Narrow viewport emulation is not true browser 200% zoom. No new pinch, rotation, TalkBack/VoiceOver speech, human visitor session or saved-file launch pass is claimed.

**Recommendation:** use the improved SF learning site and this combined handoff; complete the named human/source acceptance tasks when ready.

**Top risks + mitigations:** good presentation mistaken for qualification → keep HOLD and source review visible; positive diagnostic delta mistaken for practical success → show the margin beside it; sampled pose mistaken for exact motion → explain both clocks at the facts; old browser cache → identify immutable releases.

**Next 3 actions:** (1) share this handoff and the audit decisions if design feedback is useful; (2) collect the remaining human/source evidence; (3) record SF acceptance before authorizing another City Explorer city.

## Appendix A — complete October 5 handoff (historical, unchanged)

Everything below is the October 5 document verbatim. References to “latest”, “final”, “current”, or “complete” inside this appendix describe that dated release and its scope; the October 6 sections above describe this release. Older source/protocol failures and negative evidence remain part of the record.

---

# FleetLab handoff — October 5th, 2026

**Owner:** Bo-Huei Lin. **Audience:** ChatGPT web, Claude, Muse, Gemini, human design reviewers, map/source reviewers and the next implementer.

**Current scope:** finish the San Francisco educational experience and acceptance. Preserve the original FleetLab product. **Do not start Austin or another City Explorer city.** The site is live; formal SF acceptance is still **HOLD**. A deployed static educational website is not a qualified map, operator recommendation, safety assessment or permission to deploy a vehicle.

**Latest outcome — SF non-human work: COMPLETE within the accepted October 4 scope.** The supported Muse/Gemini findings are implemented, tested, pushed and live. Formal SF acceptance remains **HOLD** for the human/source requirements below. Austin and other cities are **NOT_STARTED**. No further AI audit or handoff preparation is required for this release. Section 11 records the final publication; section 9 preserves the earlier v11 history.

This handoff supersedes older next-action statements where they conflict with the accepted October 4 scope. Historical protocols, failed runs, adverse results and source snapshots remain unchanged. The [October 4 handoff](FLEETLAB_HANDOFF_2026-10-04.md) retains the detailed earlier history and resource analysis; the [canonical acceptance matrix](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md) names every remaining gate.

## 1. Open the product and launch-readiness examples

- [FleetLab home / Overview](https://fleetlab.pages.dev/#/overview): original animated concept and product navigation.
- [City Explorer — San Francisco](https://fleetlab.pages.dev/city-explorer/#welcome).
- [City atlas](https://fleetlab.pages.dev/city-explorer/#atlas), [Replay studio](https://fleetlab.pages.dev/city-explorer/#replay), [Decision notebook](https://fleetlab.pages.dev/city-explorer/#compare), [Model lab](https://fleetlab.pages.dev/city-explorer/#models).
- [Launch rehearsal — Region B](https://fleetlab.pages.dev/#/fleet-day?lesson=region-launch).
- [Staffing readiness](https://fleetlab.pages.dev/#/fleet-day?lesson=staffing-readiness), [charging deadlines](https://fleetlab.pages.dev/#/fleet-day?lesson=deadline-charging), [resource freshness](https://fleetlab.pages.dev/#/fleet-day?lesson=resource-freshness), [fleet intake](https://fleetlab.pages.dev/#/scale-lab?lesson=fleet-intake).

The launch dashboard already exists within **Fleet day**. Open the Region B lesson, expand **Other experiments on this page → Launch rehearsal: configure a region and test commissioning**, then press **3. Validate setup** and **Rehearse commissioning delay**. Expand **Delayed: infrastructure and checks** to inspect installed/commissioned resources, task outcomes and named checks. The Learning catalog also links **Rehearse commissioning in Region B**. A new duplicate dashboard would split this learning flow unnecessarily.

Rehearsed in the actual live UI on October 5: fictional Region B, seed 42, 240 minutes, 24 cars, 179 requests, five installed ports at two depots, comparing immediate with 90-minute-delayed commissioning. Completed trips were **34 → 29**, pickups within target **24 → 24**, late pickups **11 → 6**, missed pickups **139 → 144**, and pending pickup outcomes **5 → 5**. Fewer late pickups does not mean improved service when more requests are missed. Queue time was **3,512 → 3,961 task-minutes**. These are one synthetic fixture, not a paired statistical study or SF commissioning forecast.

The setup showed two pending setup tasks; initially installed ports were not commissioned. Terminal accepted mock actions completed those tasks. The named check **REQUIRED_WORK_MAX_WAIT failed** in the displayed delayed result. Do not summarize the exercise as “launch approved.” Installed capacity, commissioned capacity, site power, work readiness and outcome checks answer different questions. These mock actions do not command real infrastructure.

The existing root site includes an older Austin teaching example. It is preserved content, not new Austin City Explorer development. The City Explorer city-pack roadmap remains paused at SF.

## 2. What has been delivered

| Area | Delivered behavior and boundary |
|---|---|
| Product integration | City Explorer is an additional tab. Overview/animation, Fleet day, Street lab, experiments, Scale lab, 59-lesson catalog, Approach, offline edition and owner contact `bohueilin@gmail.com` remain. |
| Visual design | Warm ivory, teal, lavender and amber; larger descriptive text, clearer learning flow, department-oriented walkthrough, responsive cards and explicit unavailable states. |
| Atlas | Vector street detail and zoom, named-road inspection, flat fallback, red fictional-depot markers, distinct recorded v1 / earlier v2 / temporal v3 candidates, source/coverage/qualification explanations. The atlas selector does not replace the map underlying recorded results. |
| Fleet understanding | Aggregate trip distribution and queue budget explain the 100 vehicles before optional individual selection; suggested vehicle stories guide exploration. IDs share one generic model. |
| Replay | Direct Play loads the selected recording; full eight-hour timeline, pause, seek, terminal state and restart. Exact operational event time is separate from held 15-second pose samples. Gaps stop playback; no continuous route is invented. |
| Trip summary | Completed trips, distance, empty miles, depot visits, charging/turnaround counts, time budget and shift-ending explanation. Cleaning/update/fix are not separately modeled. |
| Revenue and safety | Viewer enters fare assumptions; revenue stays unavailable until provided. Injury-crash, remote-guidance and minimum-risk-maneuver rates are unavailable, not zero. No operator fare or safety claim. |
| Decision learning | Twelve paired repeats, original +2 pp practical margin beside the result/interval, adverse sensitivities, missing power estimate, evidence limits and distinct map gate. |
| Model learning | Anonymous vehicle-trait and curb/depot lessons; Ojai/Zoox are design references, not calibrated operator vehicles or physical maneuver simulation. |
| Engineering evidence | Versioned packs, stored runs, common verifier/decision contracts, temporal-routing fixtures and one bounded temporal engineering case. Verification means internal consistency under the installed implementation, not independent authenticity. |
| Review preparation | Frozen requirement/checkpoint identities, 60 assignment batches, source-owner clarification draft, device worksheet, five-visitor protocol and executive demo guide. No observations or approvals fabricated. |

The architecture remains **versioned city pack → separate simulation runner → precomputed results → browser viewer**. The public static site does not run the research engine or a 168-arm study.

## 3. What the SF experiment actually teaches

The original study has 12 paired seeds, **1001–1012**, each with 100 generic EVs and 1,200 synthetic requests over **07:00–15:00**. A seed reproduces input randomness; it is not a named driving scenario. Both configurations in each pair receive the same inputs.

One depot A has eight charging ports, 200 kW site power and four turnaround slots. Two depots A+B split the same totals into 4+4 ports, 100+100 kW and 2+2 slots. The question is how location/resource distribution changes modeled service with total resources held constant.

- Completion gain: **+1.11 percentage points**, paired 95% interval approximately **+0.70 to +1.55 pp**. The whole interval is below the declared **+2 pp practical margin**.
- Empty distance per completed trip: approximately **−11%**, paired interval **−12.33% to −9.53%**.
- Boarded-rider p90 wait delta: approximately **−29.41 seconds**, interval **−48.53 to −11.03 seconds**. This is conditional on boarding, not an all-request wait claim.
- An adverse lower-demand sensitivity completes **581 versus 569** trips; its single seed is separate from the twelve-pair interval.
- Seed 1001 / A: **627** completed trips; median per car **4**, mean **6.27**, range **2–15**. Queues consume **394.5 / 800 vehicle-hours = 49.3%**. Other time includes empty travel, charging and service; it is not all passenger service.
- EV-001 / A completes four trips, drives 29.85 miles, has 25.5% empty distance and ends the shift charging. At **09:36:29**, the exact event says waiting for a charging port, while the held **09:36:15** pose still says turnaround. Both are correctly labeled.

The replication unit is the paired seed, not each of the 100 interacting cars. Favorable metrics do not by themselves establish practical benefit, map qualification, real-world safety or a depot recommendation for Waymo.

For a ten-minute departmental demo, use [the executive walkthrough](FLEETLAB_SF_EXECUTIVE_WALKTHROUGH_2026-10-05.md). Keep that coached presentation separate from the uncoached visitor study.

| Department | Intended takeaway |
|---|---|
| Engineering | Inspect source identity, model limits, exact events and verifier evidence before trusting a conclusion. |
| Product | Compare improvement with a declared practical margin; retain adverse cases and all-request outcomes. |
| Operations | Follow shared queue bottlenecks from fleet aggregates into a vehicle timeline. |
| Fleet management | Fleet size is not usable capacity; energy, charging ports, power and time constrain availability. |
| Sales | Use customer-entered assumptions and completed-trip exposure; no unsupported revenue promise. |
| Depot partnerships | Location, utility power and turnaround resources interact; site-specific evidence is still needed. |

## 4. October 5 connected Pixel work and changes

The connected **Pixel 10 Pro XL / Android 17 / Chrome 154.0.8037.92** was exercised on actual hardware through ADB. Atlas map switching, street zoom/inspection, orientation, vehicle selection, direct playback/pause/end/restart for A, exact event seek, trip summary and fleet aggregates were inspected. This is stronger than emulation but does not substitute human finger usability or actual screen-reader speech.

Actual Chrome **200% page zoom** exposed navigation overflow, overlapping map-layer/fit controls and a clipped depot select. We corrected wrapping, narrow grid minimums, the decorative capacity layout, map-control placement and select width. Short atlas labels **A · one** and **A + B · two** preserve depot identity at large zoom; loaded replay options retain their configuration/power labels. The final select and controls were visually rechecked on the phone. No scientific inputs, recorded outcomes or map geometry changed.

All five views were checked at 240×844, 390×844, 844×390 and 1440×900: no document horizontal overflow and all navigation buttons within the viewport. Scrollable data tables remain intentional local regions. See [the connected-device record](FLEETLAB_SF_DEVICE_ACCEPTANCE_2026-10-05.md) for exact failures, partial checks, exclusions and remaining rows. After that packaged worksheet was captured, the deployed v11 preview was also tested on the Pixel: A+B selection displayed both red depot squares; direct Play advanced to 07:27:59, Pause held, the end seek reached 15:00:00, and Play restarted to 07:13:35. The desktop preview also passed slider End and restart. Evidence: `39-preview-play-ab.png`, `40-preview-end-ab.png`, `41-preview-restart-ab.png`, `preview-browser.json`. This closes the automated A+B sequence left open in the packaged worksheet; human pinch, focus traversal and assistive speech remain open. No TalkBack spoken-output session or independent visitor session is claimed. Phone font scale and portrait settings were restored to their initial values, both tested origin zoom levels reset, and Chrome’s temporary zoom-menu option switched off.

## 5. Where independent source/map observations come from

**Ask Claude, Muse and Gemini to visit the site for design critique and map-claim triage.** Their findings can identify confusing claims and suspicious source relationships. Three AI reviews are not three independent human map observations, and browsing a map is not review of every frozen routing obligation. Give each reviewer a different role and preserve disagreement rather than voting it away.

For qualifying observations, recruit a **human familiar with OSM routing/access/restriction semantics** and a **GIS reviewer familiar with projection, boundary clipping and source provenance**. One person can have both skills, but obligations requiring an independent resolver need another eligible human identity. A general first-time site visitor is not automatically a capable map reviewer.

Practical starting point: [OpenStreetMap US Slack](https://openstreetmap.us/get-involved/slack/) lists `#local-california`, `#routing`, `#tagging`, `#borders`, `#accessibility` and `#jobs`. Its [community page](https://openstreetmap.us/get-involved/) also describes local groups and mapping events. Ask whether someone can review a bounded paid or volunteer pilot; availability is not guaranteed and no hiring or message has been sent. Use the source owner/official dataset channel for source-version and reuse questions, not a model's opinion about a license.

A **25-way / 10-OD pilot** is a sensible way to confirm reviewer competence and estimate effort. It does **not** reduce the frozen acceptance roster. Send only the relevant batch, captures and instructions first; do not ask a volunteer vaguely to “approve the entire SF map.”

The separate [source-owner clarification draft](FLEETLAB_SF_SOURCE_CLARIFICATION_DRAFT_2026-09-30.md) is ready for the owner to send. It asks for exact redistribution/attribution terms, the authoritative adopted version corresponding to the captured full district service, and intended bridge/border scope. It remains **UNSENT**. Empty license fields establish neither permission nor prohibition. No unresolved full district GeoJSON was added to the public site.

### Current frozen workload and identities

| Item | Current status |
|---|---|
| Temporal workspace | `build/fleetlab-city/reviews/sf-temporal-v3-review-r2/` |
| Temporal obligations | **2,160**: 200 stratified ways, 100 OD cases, 1,860 other merged obligations; zero human observations/resolutions |
| Administrative proposal | `build/fleetlab-city/research/administrative-scope-20260930/proposal-r2/`; **56** obligations: 49 residual ways, five membership changes, rights and adoption |
| Assignment batches | `build/fleetlab-city/validation/sf-acceptance-20261004/review-batches/`; 60 batches, unassigned |
| Canonical requirements digest | `4d43fb2d932b01da27d16055774dfe1b6de141ce342e1a74d9f0248b689c5ac8` |
| Requirements file SHA-256 | `259ee01c8e49891e8617641b2d2adc8b4f7b969272663469e0c96fc958666b1d` |
| Retained history checkpoint | `b1f184bdf132ebd64074333a6036ce747ac33816b5f310822c6b34f90b548ffb` |
| Candidate pack digest | `8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198` |
| Batch-index SHA-256 | `5852cd4f72d2cdfdd9e041f38e76567648a41df0351b7ba63abae3c9d9ede490` |

All counts and identities refer to frozen local inputs, not whatever today's live source returns. Queue/sample overlap was merged: do not add the 1,868 source-queue entries to the sample count and call the sum new observations. Review every reason attached to an obligation. Prescribed OD departure checks are **09:59, 10:59 and 14:59, America/Los_Angeles, September 29, 2026**, with conditions evaluated at traversal time and retained-history return legs including stops. Do not substitute easier endpoints.

The fuller administrative overlay has **49 residual ways / 441.926295 m**, distinct from the older 108-gap inventory. Five membership changes touch 60 requests and four initial vehicles; 55 requests change the both-endpoints-inside predicate. Original 220 pool nodes, 1,200 requests and 100 vehicles remain. Adopting a different population would require a new scenario, not revised old denominators.

**Tooling correction:** `tools/map-review.py validate` is bound to historical v2 and correctly rejects v3 requirements as a different candidate/source snapshot. Do not copy that CLI invocation as a working v3 ingestion recipe. The shared `citylib/map_review_v1.py` validator is installed; current v3 publication uses it through `temporal_export_v1.py` in `build-viewer --temporal-candidate`. Real returns should become a new append-only history with captured evidence and a separately recorded checkpoint, then pass the existing validator. No frozen requirements should be edited to create a pass. Reviewer identities remain declared, not authenticated.

## 6. Copy/paste prompts for external feedback

### A. Claude, Muse or Gemini: first-visit design and comprehension audit

For a clean first impression, send the prompt and site URL **without this handoff first**. Attach the handoff only after that first-pass response; a reviewer cannot unlearn answers it has already read.

> Visit https://fleetlab.pages.dev/ and its additional City Explorer tab. First explore for five minutes **before reading the explanatory sections of the attached handoff**. Record your initial interpretation and confusing moments. Then read the handoff and distinguish first impressions from informed critique.
>
> Audit as a visitor from Engineering, Product, Operations, Fleet Management, Sales and Depot Partnerships. Preserve the original Overview animation, Fleet day, Street lab, catalog, offline edition and the additional City Explorer structure. Concentrate on San Francisco; do not propose implementing Austin yet.
>
> Test the path from fleet result → suggested vehicle → exact event → model limit. Can a visitor explain seeds versus scenarios, 100 interacting generic vehicles versus independent repeats, one versus two depots with equal total resources, the +1.11 pp result/interval versus +2 pp margin, held 15-second positions versus exact event time, unavailable fares/safety metrics, and why SF map qualification remains open? Inspect phone layout and 200% zoom if your tools support them; otherwise mark NOT_TESTED.
>
> Return at most ten prioritized findings with exact URL/tab, steps, observed text or screenshot, user misunderstanding, severity, a concrete proposed correction and a way to verify it. Separate observed behavior, inference and aesthetic preference. Recommend what to keep as well as what to change. Do not invent visitor quotes, device tests, inaccessible page contents or safety/operator claims. This is AI design feedback, not an independent human qualification or permission to modify the site.

### B. AI reviewer: map/source claim triage — optional, not a next-step requirement

**October 5 clarification:** this prompt is available for a later map-specific AI critique; you do not need to send it to Muse or Gemini to close the current non-human work. Their supplied audits have been evaluated and the supported changes implemented. Fable can wait. If you use 6B later, include this handoff for context and the relevant frozen batch/captures for individual obligations. A local path in Markdown does not transfer files. No additional handoff preparation is required now.

> Review City Explorer → City atlas and the map sections of the October 5 handoff. Act as a skeptical technical assistant preparing work for a human GIS/OSM reviewer. Separate visual map quality, source accounting, routing support, temporal semantics, administrative scope, provenance/reuse rights and real-world legality.
>
> Use official source pages and stable feature IDs when available. For each issue give the exact claim/obligation ID, candidate/source version, URL, captured evidence, observation time, observed fact versus inference, missing information and proposed human check. If the frozen batch/capture is not attached, request that specific input and mark it NOT_REVIEWED; a local path in Markdown does not give you file access. Current live source revisions are supplementary, not replacements for frozen snapshots.
>
> Do not mark human-observation gates complete, claim an AI is the independent human resolver, silently change endpoints or source versions, infer reuse permission from an empty license field, or recommend hiding unsupported roads to improve percentages. Identify contradictions without resolving them by majority vote. Return a prioritized triage memo and no fabricated observations. Do not redistribute unresolved full district geometry.

### C. Recruit a human map reviewer: bounded pilot

> I maintain FleetLab, a public educational fleet simulation with an SF map candidate. I am looking for someone experienced in OSM direction/access/restriction and conditional-routing semantics to inspect a frozen pilot of 25 ways and 10 OD cases. This is source/model consistency review, not road-safety certification or approval for a vehicle.
>
> I can provide the exact candidate/source digests, captured tags/revisions, stable IDs, prescribed departures, graph paths or explicit unavailability, and each obligation's merged reasons. Please tell me your relevant experience, availability and whether you prefer a paid or volunteer engagement before committing. The full roster is larger; the pilot is for scoping and does not close acceptance.
>
> For each assigned obligation, record what you inspected, source capture/version, timestamp/timezone, interpretation, supporting evidence, ambiguity and proposed action. Do not replace the prescribed endpoints or erase conflicts. Some obligations require a separate eligible resolver after your observation. Please identify anything you cannot determine rather than guessing.

No message has been sent. A companion GIS assignment should explicitly cover the 49 residual segments, five changed membership nodes, coordinate/projection accounting, exact official layer version and administrative policy implications. Source reuse/adoption needs evidence from the appropriate source authority, not just a geometric inspection.

### D. Human observation return template

```text
Batch and obligation ID(s):
Reviewer identifier / role / relevant competence:
Human inspection or automation-assisted method (be exact):
Date/time/timezone:
Candidate pack / graph / requirements identities:
Source URL, feature/relation ID, source revision and capture digest:
Exact claim and all merged reasons inspected:
Steps / prescribed OD departure and traversal-time interpretation:
Observed evidence (bounded text capture or referenced supplied capture):
Interpretation and rationale:
Source confirmed / source conflict / unresolved / not reviewed:
Uncertainty and missing evidence:
Proposed action (separate from approval):
Conflicting observation IDs, if known:
```

This is a human-friendly intake form, not a replacement for the installed runtime JSON schema. Retain original returns; transcribe into append-only evidence with source captures and manifests. The verifier checks contract consistency. An eligible resolver must reference the complete conflict set; neither a later timestamp nor an AI summary erases disagreement.

### E. Invite five independent visitors

> Please explore FleetLab's City Explorer for five minutes without reading the handoff or presenter guide. Then describe, in your own words, what it concludes about depots, what a seed is, what the 100 vehicles represent, what stays constant between layouts, and what the results establish about real SF service or safety. Try selecting a repeat and vehicle, playing a trace, finding limitations, and returning to FleetLab. Tell me where you got stuck. With your consent I will record anonymous answers and any assistance required; this is a formative product review.

Use the [visitor protocol](FLEETLAB_SF_VALIDATION_SESSION.md). Ask its open question before later threshold prompts. Two scorers independently label answers correct/partial/incorrect/unclear, quote evidence and reconcile visibly. Do not send the answer rubric before the session. An AI role-play or this agent's inspection does not count as P1–P5.

## 7. What remains, with owner and completion evidence

| Work | Owner / current availability | What closes it |
|---|---|---|
| Temporal human source review | Capable OSM/routing reviewer and eligible independent resolver; unassigned | Actual observations for all frozen obligations, captured evidence, conflict resolution and valid append-only history; derived gate result |
| Full district provenance/reuse/adoption | Source steward, rights reviewer, GIS reviewer and scope owner; pending | Dataset-specific version/terms evidence plus recorded policy decision; inspect residuals/membership effects. Until then keep full geometry local. |
| Human device/accessibility | Owner or tester; earlier Pixel observations plus a bounded production smoke check after reconnect | Complete remaining pinch/A+B/rotation/keyboard/TalkBack/desktop-reader rows, record actual announcements and fix/retest issues |
| Visitor learning | Five independent visitors, two scorers; unassigned | Uncoached responses, both original score sets, disagreements and follow-up; not an automatic n=5 launch pass |
| Educational SF acceptance | Bo-Huei | Explicit dated decision bound to release, evidence, limitations and residual-risk ownership |

These dependencies cannot honestly be manufactured by more coding. Collecting external feedback can proceed now on the deployed educational site while acceptance remains HOLD. No additional aesthetic feature is a substitute for these observations.

## 8. Deferred work and fidelity choices

Under the accepted October 4 scope, original-v1 power/location study completion, calibrated named vehicle classes and physical curb/depot maneuvers are **deferred**, not completed. The stopped evaluation ran **1 of 144 arms**; 143 are NOT_RUN and the primary estimate is unavailable. r3, the 251-arm budget and the proposed resource spike have not been approved/frozen/executed. This turn creates no full-SF arm or evaluation tape.

The **4,000,000,000-byte** ceiling is a chosen research contract, not a documented SF production-node requirement. Static hosting, browser memory and research runner memory are separate. A 64 GiB host does not authorize changing a frozen budget. The earlier 26.206-second probe included capture, routing diagnostics, stored-recording verification and recapture; it was not 26 seconds of worker startup and ran no engine. The October 4 handoff retains the assumptions behind approximately 66.83–85.05 minutes for hypothetical sequential r3 versus 36.93 minutes for a warm-runner estimate. Those are planning estimates, not benchmarks or approval.

Use the least expensive fidelity that answers a declared question. Current fleet/discrete-event simulation addresses queues, resources and service trade-offs. A future MetaDrive adapter could investigate traffic/driving-policy scenarios; MuJoCo fits contact/actuator/physical-system questions. A 3D or world-model rendering can improve explanation but cannot retroactively validate routing, vehicle behavior or safety. Do not add MuJoCo, CARLA, ROS, operator-specific dynamics or a new simulator merely to make the site look more realistic. A separately scoped decision, data contract and validation plan must justify that work. No simulator was installed or newly integrated in this turn.

After explicit SF educational acceptance, revisit city prioritization and data/license availability. **Austin, Las Vegas, other California cities, Japan and other Waymo locations are future scope; do not begin now.** Future service-area/operator claims must use then-current primary sources.

## 9. Earlier October 5 release, tests and reproducibility — v11 history

**LIVE AND VERIFIED.** Final production readback at **2026-10-05 22:16:07 UTC** matched **10,037 / 10,037 served payloads** and effective headers. Preview also matched 10,037 / 10,037. Scoped root/viewer/rollback/source headers passed; range requests returned correct complete 200 responses, so no partial-range behavior is claimed. The live notebook, preserved Overview, launch rehearsal and Pixel atlas were inspected.

| Release identity | Actual value |
|---|---|
| Current viewer | `3fceee0e7246b9247df3d154b2c18b87e32bde700e3e26d59fde6afcf89a1cba` |
| Stable viewer | https://fleetlab.pages.dev/city-explorer/ |
| Immutable viewer | https://43375d97.fleetlab.pages.dev/city-explorer/releases/3fceee0e7246b924/ |
| Production deployment | `43375d97-a733-4811-aa1d-0e4bbff4d138` |
| Preview deployment | `1de6f018-2725-4df8-a49a-668bb4d6e569` |
| Published source commit | `1d91e9ddca4f5ad0969933f032a78f6935b5635f` — pushed to `github/codex/fleetlab-city-sf` |
| Build base | `3fad60189cc7697a2de02b668aec3e65aa31e424` plus the exact subsequently committed patch |
| Combined stage | `build/fleetlab-city/launch-integration-v7/site`; 10,038 files / 1,616,865,661 bytes; `_headers` is configuration, not a served payload |
| Integration manifest SHA-256 | `5e5abe8bd09658b7e9802cb2d2a44ad9a5bf708e64ad5fbc5417aec6e79decae` |
| Final production readback SHA-256 | `123d36aad9927b49d18b3693bb66548ee4026d37945ac43850b34c4cb2771364` |
| Publication record | `build/fleetlab-city/launch-integration-v7/review/publication-2026-10-05.json` |
| Publication record SHA-256 | `f0586749a8fdefa4c669b9bb8dc2766032b7031059947e734b15f3b628cf55da` |
| Retained compatible rollback | v10 `4a2fd0ce412c1b0ba14a73776ccbd11ece909de86ba661c3847290aceb192590`; prior production `96dc3971-23dc-493e-8b2a-bd86b7c210ee`; rollback not performed |

Validation: **312 City Python tests**, **59 Node tests**, **1,661 Hermes tests passed / 56 skipped**, Ruff and diff checks passed. Doctor with the correct environment reports **17 PASS, 1 WARN for dirty working tree, 1 optional display NOT_AVAILABLE**. Its initial invocation also warned about inherited Conda base metadata; both outputs are retained. No dependency version was changed.

All 4,886 non-catalog data files, 13 protected review inputs, original scientific modules, comparison core, 96 protected root assets and the offline digest were preserved. The catalog's only semantic change is the newly measured export peak RSS. Viewer inventory is 4,961 files including `release.json`, 768,130,628 bytes. Initial compressed transfer is 1,906,848 bytes; largest file 22,272,149 bytes; largest compressed pair 9,869,801 bytes. Package budgets pass; its map-qualified `public_release_ready` flag remains false. Static educational publication was separately authorized.

Negative release evidence is retained: the first submission failed with `fetch failed` and created no deployment. It also used `main`; inspection identified the configured production branch as `feat/fleetlab-playground`, and the successful retry used that branch with identical staged bytes. The first production hosting check received home-page fallback at the new viewer URL. The first full audit matched **9,909 / 10,037**; all 128 mismatches were the exact 1,489-byte home-page fallback. A later hosting check and a fresh complete readback passed without changing or redeploying bytes. The pattern is consistent with deployment propagation; no provider-internal cause is established. This website submission retry is unrelated to a scientific study retry.

Source-offer manifest remains `71872c6f571c644dbc2fbfee4bb308e3ed2f7406c7a54ecb3f70ab0e2e4fc817`; offline SHA-256 remains `169388571013337332b33aad79d7e4576e6490f07ec70322ced188dfd0c8c130`. The packaged device worksheet records the pre-publication cutoff; the additional A+B and live-production checks above are in this final handoff and hashed device evidence. No frozen published bundle was rewritten to add later observations.

Local repository: `/Users/bohueilin/Documents/GitHub/Hermes-fleetlab`; branch `codex/fleetlab-city-sf`; remote `github` → `bohueilin/Hermes`. Starting HEAD `3fad601`. Relevant source: `apps/fleetlab-city/web/` and `citylib/readiness_package_v1.py` (notes inventory only). Generated validation: `build/fleetlab-city/validation/pixel-sf-20261005/`. Generated evidence, runtime credentials and unrelated owner files are excluded from Git.

Commands used include City Python unit tests, Node tests, full Hermes pytest, Ruff, Hermes doctor, `git diff --check`, read-only `build-viewer --temporal-candidate`, `check-dist`, note-link validation, preserved-data/root/offline hash comparisons, real browser inspection and physical Pixel observations. Build packaging reads existing recordings; fixture tests do not authorize a new SF scientific campaign. Full publication includes preview checks, production payload readback and scoped hosting headers, with a compatible retained rollback bundle.

A website release does not change the SF HOLD, authenticate review authors or grant deployment authority for a physical system.

**Recommendation:** close the accepted non-human SF implementation pass after the verified audit-closure release below. No further AI audit is required; retain the explicit human/source acceptance gates.

**Top risks + mitigations:** polished visuals mistaken for validated autonomy → explicit model/gate limits; AI reviews mistaken for independent humans → separate methods and identities; source drift or unresolved rights → frozen captures and official clarification; favorable averages hiding mixed outcomes → retain adverse cases and practical margin; scope expansion → honor the recorded deferrals.

**Next 3 actions:** (1) keep this handoff and the verified live release; (2) complete source/map and remaining human sessions when ready; (3) record the SF acceptance decision before considering another city.

## 10. Muse/Gemini audit closure — latest October 5 pass

The supported feedback is implemented. Muse's entry-point, lab-navigation, replay-limit, offline-discovery and unset-fare findings led to five bounded improvements:

1. SF entry now says the experiment results are recorded/precomputed; changing a selector does not launch a city run. The separate Model lab remains interactive.
2. A four-card homepage chooser explains Fleet day, Street lab, Four-area experiments and Scale lab in plain questions, with direct links. Original Overview film and 59 lessons remain.
3. The footer downloads the unchanged 2.4 MB offline teaching edition. It explicitly excludes the hosted film and City Explorer recordings; no cross-model synchronization is implied.
4. A visible replay limits panel sits after the full event history and links to Scope & sources. It distinguishes exact operational events, held 15-second positions and unmodeled traffic/physics/sensors.
5. Unset fares now invite the viewer to enter three rates. Invalid rates, unavailable recorded exposure and explicit zero are separate states. No invented fare defaults.

Muse's suggested-vehicle explanation was already present. The purported “Same riders” glossary truncation was not reproduced: the full paragraph is visible at 390px with equal client/scroll heights and no clamp.

Gemini's assertions about 100 chargers, 50/50 hubs, a 0.42–1.80 pp interval, interpolated positions, 10 Hz incident telemetry, road-congestion feedback, 98.4% lane qualification, AV-084 cross-model trace navigation and a synchronized v4.18.2 batch engine are unsupported or conflict with source and stored results. They were not implemented. The correct evidence remains eight ports / 4+4, 0.70–1.55 pp, held poses, generic resource queues and qualification HOLD. The nearby replay limits and offline scope address the useful comprehension goals without inventing telemetry. The existing practical-margin explanation remains; an extra interval graphic is optional, not an unresolved defect.

A complete finding-by-finding rationale is in [the audit decision record](FLEETLAB_SF_AUDIT_CLOSURE_2026-10-05.md). This handoff is sufficient for the owner's next conversation; the longer record is optional supporting detail.

**No further AI review or handoff round is required.** Section 6B is optional map/source claim triage. If used later, send this handoff plus the particular frozen batch and captures needed for its claims. Fable can be done later without holding up this release. AI outputs do not fill human observation rows.

The new controls were checked in the browser at 240×844, 390×844, 844×390 and 1440×900. All five City views and the homepage reflowed without document overflow. Mobile Explore showed all eight destinations. All four new chooser links reached their intended models after route rendering. Fare checks covered blank, zero, negative, positive and cleared inputs, and the replay-limit button opened the scope view with its heading focused. Narrow viewport checks are not a fresh physical-phone 200% zoom test. `adb devices -l` initially returned no device. The Pixel later reconnected: Android 17, Chrome 154.0.8037.92, 1080×2404 and unchanged font scale 1.0. Automated hardware checks confirmed all eight menu destinations within the screen, all four readable guide cards, Street lab link navigation, the recorded-study notice at Replay entry, all three limits sections, and the limits button opening Scope & sources. That walkthrough exposed the guide’s imprecise “teaching grid” wording; the final copy says “sourced streets,” matching Street lab’s own model note. These observations are bound to the same immutable v12 City viewer; no physical zoom, human pinch, reader speech or independent visitor pass is inferred. No phone settings were changed. The earlier connected Pixel evidence also remains valid for its tested release and scope. New evidence: `build/fleetlab-city/validation/sf-review-closure-20261005/pixel-evidence.json`.

Offline validation: the preserved HTML boots over local HTTP with its seven original teaching destinations. A direct saved-file launch was blocked by the browser tool’s `file://` URL policy; no workaround was attempted and no fresh saved-file launch pass is claimed. Package and production checks verify the exact preserved bytes and download headers.

The initial corrected combined package was `build/fleetlab-city/launch-integration-v9/site`; its first preview stage v8 is retained as failed evidence for the missing canonical-download attachment header. The corrected preview at `https://58fed1cc.fleetlab.pages.dev` matched **10,039 / 10,039** served files and effective headers. The immutable City viewer is `f6ebc583cb5e08f237c0756f1387856eaf41358abb9103bdc2200c74328f6e80`; the download fix changed only hosted integration/header packaging, so this viewer did not need rebuilding.

The first preview at `https://2faeb439.fleetlab.pages.dev` matched 10,038 / 10,039; its failed path was the named HTML URL returning a 308 redirect. Inspection showed that the extensionless 200 response lacked the attachment header. The corrected link uses `/downloads/fleetlab-offline`, saves as `fleetlab-offline.html`, and sets the attachment header on both forms. Final hosting verification compares the full 2,424,861-byte canonical response with the exact preserved file.

Latest production identities and verified closure status follow.

Audit input identities (the full supplied reports remain local; do not confuse their assertions with verified findings):

- Muse: 8,951 bytes; SHA-256 `5afe0a41c15495e3d6d0d46f214aff2f461f2fb250f590c7e6f1e492fc028822`.
- Gemini: 23,163 bytes; SHA-256 `2938fdc734dbe2436137130160cbdfa44f218373a7e06ab3741fe8107e8e3d31`.

## 11. Final publication and non-human completion

**LIVE AND VERIFIED. Accepted non-human SF implementation: COMPLETE. Formal SF acceptance: HOLD.** This is the final release for this audit pass, including the Pixel-discovered Street lab wording correction. Both final preview and stable production returned **10,039 / 10,039 matching served payloads**, with effective hosting and download headers verified. Final production readback completed at **2026-10-06T05:05:16.164256+00:00** (October 5 evening in America/Los_Angeles).

| Identity | Final value |
|---|---|
| Stable site | [Open link](https://fleetlab.pages.dev/) |
| Stable City Explorer | [Open link](https://fleetlab.pages.dev/city-explorer/) |
| Immutable final site | [Open link](https://ecd93414.fleetlab.pages.dev) |
| Immutable City viewer | [Open link](https://ecd93414.fleetlab.pages.dev/city-explorer/releases/f6ebc583cb5e08f2/) |
| Viewer SHA-256 | `f6ebc583cb5e08f237c0756f1387856eaf41358abb9103bdc2200c74328f6e80` |
| Final production deployment | `ecd93414-d845-4e98-8b55-7ae3494a0183` |
| Final preview deployment | `8dca35cd-b72d-47cc-98b3-96bb3fd65ad6` |
| Published code commit | `61a964cd28fda7ded15375fef7bb55b4284a6132 — pushed to github/codex/fleetlab-city-sf` |
| Final combined stage | `build/fleetlab-city/launch-integration-v10/site` |
| Staged inventory | `10,040 files / 1,619,307,926 bytes; _headers is host configuration` |
| Integration manifest SHA-256 | `1e70b8555a5b1181136317c07530cc825f5bd2a90c491ec9bc8f6326b6315ad8` |
| Final production readback SHA-256 | `489fd162daf7aaf535e7565c18cc2ad5c2ecb8722bab37984828f1849daff700` |
| Publication record | `build/fleetlab-city/launch-integration-v10/review/publication-2026-10-05.json` |
| Publication record SHA-256 | `793dc6aba3e33d830f9fde6db363f2788519c18e5fe5f4b6d5ac9a5cbb4545bc` |
| Retained rollback viewer | `3fceee0e7246b9247df3d154b2c18b87e32bde700e3e26d59fde6afcf89a1cba; rollback not performed` |
| Exact offline download SHA-256 | `169388571013337332b33aad79d7e4576e6490f07ec70322ced188dfd0c8c130` |

Validation passed: **312 City Python tests**, **60 viewer/hosted Node tests**, **1,661 Hermes tests / 56 skipped**, Ruff, diff checks, immutable distribution checks, note links, preservation checks, browser QA, bounded connected-Pixel smoke checks, and final preview/production readback. The later download-header correction reran City and Node suites; the final one-line description correction reran Node. No Hermes core code changed after its full suite. Doctor reports 17 PASS, one working-tree WARN and one optional display NOT_AVAILABLE. No dependency was installed or upgraded for this pass.

All **4,886 non-catalog data files**, **13 protected review inputs**, frozen scientific modules, comparison core, **96 protected original root assets** and offline bytes are unchanged. The final City viewer has 4,961 files including its manifest, 768,133,913 bytes; initial compressed view is 1,907,551 bytes. The catalog differs only in measured export peak RSS. `public_release_ready` remains false for qualified-map release; separately authorized educational website publication is complete. No new full-SF arm, evaluation tape, map observation or source-owner message was created.

The initial failed preview header/readback is retained. The first corrected package (v9 / production `9f9f010d`) also passed a complete production readback. Final v10 differs from v9 only in `integration.mjs`, replacing “teaching grid” with “sourced streets”; final preview and production were nevertheless read back completely. The same v12 City viewer remained immutable throughout these hosted-only corrections.

An already-open stable-origin browser retained the preceding guide wording in its asset cache. The stable site's HTTP module and the immutable production module both matched the final file; a fresh immutable-origin browser showed the corrected copy. Original root assets retain their existing 600-second cache policy. Use the immutable final-site link above if an open tab temporarily shows older wording. This did not affect the recorded-data identity.

The saved-file launch limitation remains explicit: the tool blocks `file://` browsing. The unchanged standalone HTML was tested over local HTTP, its canonical hosted response and filename/header were checked, and its exact bytes matched in production. No fresh local-file launch pass, full accessibility certification, human finger usability, screen-reader speech or independent visitor result is claimed.

The evidence directory is `build/fleetlab-city/validation/sf-review-closure-20261005/`. It retains initial failures, package checks, screenshots, Pixel XML observations, exact audit-input digests, frozen-input comparisons, test logs, deployment logs and readbacks. These generated artifacts and credentials are excluded from Git; the implementation, audit decision record and handoff are committed. Unrelated owner files are preserved. The temporary local QA server was stopped and the task's temporary device XML removed.

**Recommendation:** consider the accepted non-human SF work closed. Use the live educational experience and this handoff; another AI review is optional.

**Top risks + mitigations:** website publication mistaken for SF qualification → retain the separate HOLD; unsupported AI observations → retain verified finding dispositions; old tabs showing old wording → immutable deployment link and explicit release identity; incomplete human evidence → named remaining roles and frozen acceptance requirements.

**Next 3 actions:** (1) keep/share this single updated handoff when convenient; (2) collect source/map, human accessibility and visitor evidence when ready; (3) record SF acceptance before authorizing Austin or another city. No further coding or AI handoff round is required for this release.
