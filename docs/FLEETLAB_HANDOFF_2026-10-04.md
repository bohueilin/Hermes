# FleetLab project handoff — October 4th, 2026

**Later October 4 implementation update:** the owner adopted the SF acceptance
closure scope and authorized static deployment plus Git updates, while explicitly
deferring Austin. The [canonical acceptance record](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md)
and [release record](FLEETLAB_SF_CLARITY_RELEASE_2026-10-04.md) supersede the pending
scope/release decisions below. The historical product and resource analysis in
this handoff is retained. SF acceptance remains HOLD; no r3 or new study is approved.

**Owner:** Bo-Huei Lin. **Purpose:** continue product, engineering and simulation work with a new collaborator, including ChatGPT web, without losing the delivered website, prior evidence or unresolved decisions.

**Current objective:** finish San Francisco and its acceptance work, then bring Austin to completion. Las Vegas and other regions follow. This document consolidates the work so far and answers the owner's October 4 questions before any approval of `sf-power-isolated-v1-r3`.

**Status:** FleetLab and City Explorer are already published. SF acceptance remains **HOLD**. Austin City Explorer has not been built or qualified. The proposed r3 study is **not approved, implemented, frozen or executed**. Resuming discussion is not approval of that study or its 251-arm campaign ceiling.

This handoff supersedes older *current-status and next-action* statements where they conflict with the October 4 findings below. Historical protocols, reports, failures and published bundles remain unchanged. It does not retroactively change a stop rule, adopt a boundary or declare a gate passed.

## 1. Decisions before another power-study revision

### 1.1 Is 4 GB a production requirement?

**No documented SF production-hardware requirement establishes this limit.** It is a chosen research resource budget, subsequently accepted and frozen into the study. It provides a bounded operating envelope; it is not evidence of an operator's onboard computer, depot server, edge device or container capacity.

The implementation at `apps/fleetlab-city/citylib/power_protocol.py` checks **4,000,000,000 bytes** of process peak RSS and **2,000,000,000 bytes** of estimated route arrays. It reads `resource.getrusage(RUSAGE_SELF).ru_maxrss`. That is a maximum resident-size measurement, not a live allocation counter, container reservation or OS-enforced cap. The runner checks it at defined checkpoints, including after each arm; it can therefore record an over-limit arm before stopping. Python documents the distinction between measuring usage and setting resource limits in its [resource reference](https://docs.python.org/3/library/resource.html#resource.getrusage).

The 4 GB value is decimal: it is about 3.73 GiB. Changing it to 4 GiB would already change the frozen limit. The observed 4,046,569,472-byte failure exceeded the actual limit by 46,569,472 bytes, about 1.16%. This small overrun neither proves that a larger budget will accommodate 144 arms nor proves a leak. Peak RSS cannot reveal current live memory or isolate the cause by itself.

On October 4, a read-only host check found an **Apple M4 Pro, 14 logical CPUs and 68,719,476,736 bytes / 64 GiB of installed RAM**. Available filesystem space was approximately 72 GB. Installed RAM is not reserved or currently available memory. No target SF production-node specification or study-container allocation was established in the inspected project.

The deployed City Explorer serves precomputed recordings and static viewer assets from Cloudflare Pages. The Python research runner executes locally; the website does not run this 168-arm study. The research RSS budget, phone/browser memory budget and static-hosting asset limits are three separate constraints.

**Correction to the September 30 memo:** its categorical rejection of increasing memory was too strong. Increasing a resource budget openly in a new version can preserve the same scientific question. It would be wrong to modify r2 in place, erase its stop or silently claim that the old 4 GB contract passed. It is legitimate to retain r2 as failed and compare a transparently revised resource policy with process isolation.

### 1.2 Which execution design is justified?

| Option under discussion | Benefit | Cost / unresolved evidence | October 4 recommendation |
|---|---|---|---|
| Keep 4 GB and start a fresh process for every arm, as proposed in r3 | Resets process state between arms; clear per-arm resource attribution | Repeated capture, JSON parsing and router setup; new orchestration and analysis interfaces; no actual r3 worker benchmark yet | Use if 4 GB portability or process containment is a real requirement worth its cost |
| Right-size the research budget and keep a sequential warm runner, with preflight/final analysis in separate processes | Reuses the expensive graph/router; smaller orchestration change and less repeated work | Must measure retained-memory growth, analysis/export peaks and host pressure; larger capacity alone does not fix unbounded retention | **Preferred direction to evaluate for the present local research use** |
| Fresh process per complete seed block, if measurements justify it | Amortizes setup across six cells while bounding process lifetime | Another design that needs parity, failure handling and resource measurements | Fallback if a long warm stage grows but per-arm restart is unnecessarily expensive |

A possible **8,000,000,000-byte research ceiling** is a concrete discussion candidate on this host, not a selected value or validated requirement. Choose the final limit from measured peak, growth and explicit headroom, and record why it is adequate. Do not automatically escalate a failed run. Merely giving a hypothetical container more RAM would not bypass the current hard-coded 4 GB checker; a new versioned contract and compatible execution path would still be necessary.

For any choice, preserve the scientific controls, tapes, verification, final mutation checks and complete failure history. Check deterministic output parity with small fixtures. Keep preflight and final analysis separate from execution so their memory and time are observable. Measure both current memory and peak, alongside wall/CPU time, input/output bytes and available disk. Bound the total process tree if introducing subprocesses; a supervisor's own peak RSS does not measure its children.

The September 30 read-only probe supports the plausibility of process separation. It does **not** qualify the future engine path, prove the warm runner would leak, or establish 4 GB as a deployment requirement. The design should follow the actual resource requirement rather than treating a historical budget as immutable for all future studies.

### 1.3 What runtime should we expect?

**The 26.206-second probe was not 26 seconds of worker startup.** Its cumulative measurements were:

| Probe milestone | Cumulative seconds | Incremental meaning |
|---|---:|---|
| Capture frozen protocol, tapes and map | 7.118 | Full capture and validation |
| Prepare router | 10.807 | Additional 3.689 s |
| Fill all 48,400 pool route pairs | 17.315 | Additional 6.508 s; deliberately broad diagnostic work |
| Verify and serialize the retained evaluation recording | 20.893 | Additional 3.578 s |
| Verify and serialize the largest preflight recording | 25.473 | Additional 4.580 s |
| Final protected-file recapture | 26.206 | Additional 0.732 s |

No engine ran in that probe. Its entry points were guarded to raise. A fresh process also does not imply a cold filesystem cache: the OS can cache shared source bytes between processes, even though each Python process rebuilds its own objects.

The actual r2 preflight provides the closest execution timing evidence:

- 24 arms: **210.161 s / 3.503 min**, including initial setup.
- Per-arm engine mean: **4.809 s**.
- Per-arm execution + verification + write mean: **8.308 s**, observed range **7.461–9.138 s**.
- Separate 24-arm preflight analysis: **114.069 s / 1.901 min**.
- Approved evaluation retry: **130.022 s**, including its preflight recheck and setup, then only **one** 8.536-second arm before the resource stop. It is not a completed 144-arm runtime.

For an explicit planning comparison, use the same host, sequential execution, 168 new arms, one preflight analysis and one final analysis. Approximate final analysis as six times the observed 24-arm analysis. This deliberately includes fixed analysis overhead in the extrapolation and is not a fitted performance model.

```text
Execution per arm E = 8.308370 s
Cold capture + router S = 10.807428 s
Analysis allowance A = (1 + 144/24) × 114.069290 s = 798.485033 s

Per-arm isolation: 168 × (S + E) + A = 66.83 minutes
With the full 6.507504 s route-cache diagnostic allowance per arm:
                  168 × (S + E + 6.507504) + A = 85.05 minutes

Warm runner: 168 × E + two measured fixed stage-overhead allowances + A
            = 36.93 minutes
```

**Interpretation:** roughly **67–85 minutes** for isolated execution plus analysis, versus approximately **37 minutes** for a hypothetical memory-qualified warm workflow. The implied incremental allowance is about **30–48 minutes**, or 1.8–2.3 times the warm estimate. The high isolated estimate includes deliberately populating every possible route pair; the proposed worker does not have to do that. Conversely, new seeds may exercise more uncached work than old warm arms, and actual worker startup, final integrity checks and supervisor overhead remain unmeasured.

These are arithmetic planning cases, **not observed r3 runtimes, confidence bounds or a guarantee that all arms fit**. The actual r2 workflow failed. It has no completed-runtime baseline against which to claim an achieved speedup. Both estimates exclude protocol generation/freeze, implementation, tests/review, export, compression, website build, deployment/readback and human review. The approximately 22-minute temporal-fleet case below uses a different map/model and must not be multiplied into this v1 power-study estimate.

### 1.4 I/O and storage consequences

The observed r2 raw arm bundles average **39.094 MB**. At that rate, 168 arms add approximately **6.568 GB** of raw evidence; projecting the observed smallest/largest bundles gives **5.923–7.248 GB**. These are decimal bytes and are not a worst-case output bound. Additional analyses, package copies, compression and source offers need explicit space beyond that. Existing evidence must remain retained.

The original map pack totals **114.417 MB**. The current `capture_study` path reads it once through `make_protocol` and again for its returned capture. Reusing that path in 168 cold workers implies approximately **38.444 GB of logical map reads**, before final recaptures, tape/source checks and analysis. That is not necessarily 38.444 GB of physical SSD I/O: cached reads still incur parsing, hashing and object allocation. A future implementation may reduce redundant reads only if it preserves identity and mutation guarantees and is separately reviewed.

The proposed r3 workers are **sequential**, so they do not inherently contend with each other for disk. Background tasks, concurrent packaging, memory pressure or a slower/networked runner could still matter. We have no block-I/O or throughput trace proving that storage is or is not the bottleneck. Do not promise a contention-free run from disk capacity alone. Use local evidence storage, serialize workers, measure CPU/wall time and actual I/O, and keep build/export work out of the timed execution stage. No performance stress test or new simulation was run for this handoff.

### 1.5 What would a successful r3 actually unblock?

Its primary question is more specific than “is 400 kW better than 200 kW?”:

> Does the completion-rate benefit of splitting resources across depots A+B rather than keeping them at A change when total site power increases from 200 to 400 kW?

The primary estimand is `(AB400 − A400) − (AB200 − A200)` in completion percentage points, with B-only as a secondary location control. A complete compatible result supplies the fixed 24-block paired estimate and 95% Student-t interval under the original synthetic assumptions. It may still be inconclusive against the ±1-point practical band. Completion does not guarantee statistical precision or a preferred configuration.

| Milestone | Does successful r3 close it? |
|---|---|
| Complete the original-map power/location diagnostic and its notebook result | **Yes**, if all scheduled evidence and analysis pass; an inconclusive estimate is still a valid outcome |
| Publish FleetLab as an educational static website | **Already done**; publishing a subsequent result needs its own build/readback, not proof of vehicle safety |
| Qualify the current temporal SF road map and administrative scope | **No**; r3 deliberately uses the older v1 map/model |
| Complete physical-device, accessibility and visitor comprehension evidence | **No** |
| Calibrate named vehicles, real depot performance or curb maneuvers | **No** |
| Establish regulatory compliance, real-world safety or physical deployment permission | **No** |
| Finish all requested SF work and start Austin under the current sequence | **No, not by itself** |

The SF-before-Austin ordering comes from the owner's product sequence. There is no technical dependency requiring Austin's importer to consume a charging-power p-value. **Recommendation for alignment:** separate educational-site release, city-map acceptance, operational-study completion and higher-fidelity vehicle/maneuver work into named milestones. The old-map diagnostic should not automatically gate every future website release or Austin preparatory research. Changing that sequencing or accepting explicit SF deferrals is an owner decision; this handoff does not silently make it. Full SF completion remains unclaimed.

## 2. Product delivered and preserved

The product is an educational fleet-operations laboratory intended for a technically credible Waymo-facing presentation. Its recurring design objective is to let a visitor understand the decision, controlled change, observed result, uncertainty and limits before opening detailed evidence.

The earlier welcome/design and audit work improved the entry narrative, animation presentation, navigation, visual hierarchy, typography and warm ivory/green/amber visual language. City Explorer was integrated **additively** at `/city-explorer/`; it did not replace the established site.

Preserved content includes the Overview concept animation, Fleet day, Street lab, Four-area experiments, Scale lab, all **59 Learning catalog lessons**, Product approach, guided walkthrough and offline teaching artifact. The homepage/footer includes the requested `bohueilin@gmail.com` contact. Existing regional teaching material can mention Austin; that is not an Austin City Explorer road pack or city-qualified simulation.

City Explorer provides **Start here, City atlas, Decision notebook, Replay studio and Model lab**. The guided narrative moves from map coverage to a controlled comparison to one vehicle's day, with questions for Engineering, Product, Operations, Fleet Management, Sales and Depot Partnerships.

| Owner request | Delivered behavior | Remaining boundary |
|---|---|---|
| Welcome, visual quality and readable descriptions | Guided entry, original illustrations, larger small descriptions, primary descriptions around 15–18 px, mobile inputs 16 px, responsive layouts | Actual visitor comprehension still needs observation |
| Street-level zoom and resolution | Local vector roads, street labels, inspection, zoom up to level 20, scale controls, route/vehicle fitting, interactive flat fallback | Zoom does not improve source positional accuracy; no buildings/terrain or validated navigation claim |
| Fictional-depot layout issue | Controls separated from map overlays, mobile stacking/containment corrected | Later viewport results are documented; physical phone acceptance remains open |
| Understand seeds and experiment pairs | Plain-language repeats, reproducible input explanation, twelve paired results and five separate sensitivity cases | A seed is an input repeat, not a named driving scenario |
| Make 100 vehicles meaningful | Fleet-wide summary and distributions first; four transparently selected vehicle stories; full list under a disclosure | One generic vehicle model, not 100 different types or independent trials |
| Red depot squares | Markers derive from the actual recorded configuration, including one/two-depot selection and B-only support | Sites are fictional; newer atlas candidates are not recorded-scenario controls |
| Direct Play and complete timeline | Selection loads its trace; Play advances/restarts without manual reload; full 07:00–15:00 clock, terminal event, queue/state explanations and full event history | Fifteen-second held pose samples remain explicitly labeled; gaps stop playback |
| Comprehensive trip summary | Completed pickup/drop-off trips, pickups, unfinished work, total/empty miles, empty share, arrivals/unique depots, charging/turnaround counts, charged energy and queue time | Cleaning, updates and repairs are not separate modeled services |
| Revenue | Unavailable until all three viewer fare inputs are entered; uses completed passenger service only | Illustrative gross fare, not calibrated operator pricing, cost or profit |
| Safety metrics | Injury crash rate, remote guidance, MRM and safety/regulatory evaluation explicitly unavailable | No fabricated zeros or inference from operational metrics |

The original EV-001 confusion was addressed through trace loading, full-horizon events, consistent depot/configuration projection and explanations of stationary queue/service periods. It was not “fixed” by inventing passenger trips or moving a vehicle between samples.

## 3. What the recorded SF experiments actually establish

The original study uses **100 homogeneous generic EVs, 1,200 synthetic requests, an eight-hour shift and 220 demand/initial-position nodes**. Initial energy is 30 kWh and target charge 48 kWh. The nominal 60 kWh capacity field bounds verifier energy; it does not itself determine runner charging or dispatch. Depots are fictional and demand is synthetic.

Twelve paired seeds **1001–1012** compare A versus A+B with total resources held constant. Each seed supplies the same input tape to both arms. Five separate sensitivities retain adverse outcomes. All **34 original arms** were reproduced with matching scientific/input digests; this is internal reproducibility, not independent authenticity or operational calibration.

The retained diagnostic mean completion change is **+1.111 percentage points**, with a paired interval **+0.701 to +1.549**, below the original **+2-point practical threshold**. Empty distance per completed trip falls about **11.001%**; boarded-wait p90 falls about **29.408 seconds**. These values describe the original synthetic v1 model. The lower-demand sensitivity is adverse to A+B. The low-energy case records two `no_reachable_depot` violations in each layout; earlier `reserve_breach` wording was corrected.

For repeat 01 specifically, A completes **627** trips and A+B **629**. Median vehicle trips are 4 and 4.5; the fractional median is the midpoint of the middle observations. Empty travel is **42.7% versus 40.5%**. Depot queues consume **394.5 versus 394.0 combined vehicle-hours out of 800**, about 49.3%; **69 versus 68** vehicles are waiting for a charging port at 15:00. The remaining time includes empty travel, charging and other states; it is not all passenger utilization.

The principal learning is that location and service capacity interact. Vehicle IDs illustrate assignments and shared-resource experience, not ability rankings. Statistical replication is across paired seeds; the 100 interacting vehicles are not 100 independent experiment samples.

## 4. Map, routing, temporal rules and depot continuity work

Three versions remain distinguishable: the **original v1 recorded map**, a **static v2 candidate**, and the **time-aware v3 candidate**. Old results were not relabeled as if produced on a newer map.

The v2 candidate added bounded multi-road turn restrictions and stricter source accounting, reducing unsupported eligible length from approximately 1.936% to 1.322%. It restored 411 roads while newly blocking 201 records exposed by stricter parsing. It initially still failed trunk/living-street source budgets and had unresolved cross-stop continuity.

Subsequent versioned work implemented:

- Restriction history retained across pickup, drop-off, queues and depot service, including zero-length legs and fractional final edges. Stops do not erase turn obligations.
- Source-bound temporal import and daily/weekday/overnight rules checked at actual traversal time. Unsupported grammar remains blocked.
- Independently verified fleet traces with exact map/input/model identities and explicit no-continuation outcomes.
- Reviewed routing bounds and caches that retain valid later arrivals; permanent denied-node handling without ignoring more-specific permissions.
- A separate model 4 for **explicit source-road circulation connectors**, accounting for real traversed edges, time and energy. Twelve connector fixtures include a reproduced/fixed fabricated same-endpoint loop bypass. No SF site connector or private-yard maneuver has been qualified.

The complete temporal candidate accounts for **69,027 source ways**, **261,455 nodes**, **186,930 edges**, **2,179 static turn rules**, **175 timed turn rules** and **32 way-access schedules**. Unsupported eligible length is **0.9869755871%**; all road-class fractions meet the unchanged 5% threshold. This source-support result is not comprehensive validated driving access.

Static continuity validation completed 400 fixed route searches: 380 routes and 20 no-continuation results, with algorithm agreement. Temporal validation completed all 300 OD contexts: 1,182 searches, 1,098 routes and 84 no-continuation results, with matching status/cost and no unsupported searches. Earlier work-budget failures remain recorded.

The fixed temporal **100-vehicle / 1,200-request / eight-hour engineering case** then completed:

| Evidence | Result |
|---|---|
| r6 execution + serialization | 1,300.761 s; peak 2,169,552,896 bytes |
| Original independent verifier | INVALID, 12 findings retained |
| Corrected verifier 3.0.1 on the same stored run | 107.093 s; peak 2,060,730,368 bytes; zero findings |
| Execution inventory | 519,579 route queries; 58,374 events; 192,000 poses; 1,484 legs |

The original verification discrepancy was traced to float association at partial-edge positions and exact millisecond sample boundaries. Hand-checkable regressions and review supported a narrow correction: integer-millisecond accumulation for temporal intervals and a bounded one-nanosecond numerical allowance with exact topology/field checks. **The producer trace was neither modified nor rerun to obtain a pass.** Negative controls still reject materially forged motion. This successful engineering case is separate from the stopped power study and cannot qualify city operations.

The complete candidate bundle and source offer are now public. Its frozen temporal review workspace **r2** has **2,160 obligations**, including 200 stratified source-way samples and 100 OD cases. The earlier r1 workspace is retained as superseded after internal access-block IDs were corrected to real source identities. October 4 readback finds **zero observations and zero resolutions**. Automated fixtures do not fill human-review obligations.

## 5. Administrative geometry and source qualification

The district problem was partly a footprint mismatch. The public DataSF layer trims water areas; an official final-map application links to a fuller April 2022 geometry. Merely switching to a newer trimmed endpoint did not resolve the gaps.

A separate immutable administrative reporting contract now compares the complete source inventory against all eleven fuller district polygons. It clips each original source segment before EPSG:32610 projection, preserves backtracking multiplicity, and accounts separately for exclusive, shared and outside portions. It neither changes the graph nor silently reduces demand.

| Administrative proposal finding | Value |
|---|---:|
| Complete source inventory | 69,027 ways |
| Eligible inventory including outside context | 22,202 ways |
| Frozen graph denominator, unchanged | 2,172,216.6215587733 m |
| Projected eligible road portions inside original municipality | 2,157,301.7120086886 m |
| Remaining outside proposed districts | 441.92629517921876 m across 49 source ways |
| Node membership changes if adopted | 5: four inside→outside, one outside→inside |
| Historical records touching those five nodes | 60 requests and 4 initial vehicles |
| Requests changing both-endpoints-inside status | 55 |
| Full recorded population retained | 220 nodes, 1,200 requests, 100 vehicles |
| Additional administrative obligations | 56, with no actual observations |

Do not compare projected quantities as if they replaced the original spherical graph denominator. The earlier 108-gap / 13.161 km inventory remains unchanged in its own candidate. The newer full-inventory 49-way residual is broader than the earlier old-gap-only diagnostic and must be labeled accordingly.

Independent code review found and corrected three report-writing issues: lexical `..` containment, mutation during capture/recomputation, and a check-then-rename overwrite race. Six regressions failed before the fixes; 19 focused administrative tests then passed. Full build took 32.439 s at 1.609 GB peak; separate recomputation took 31.083 s at 1.662 GB. The same reporting implementation recomputes deterministically; that is not independent human geometry review.

Current proposal states remain **adoption PROPOSED**, **source terms NOT_ESTABLISHED**, **qualification HOLD**. The fuller ArcGIS item's inspected licensing metadata was empty. Licensed trimmed layers and a general city open-data policy did not establish a specific reuse basis for that full capture. This is an unresolved evidence gap, not a declaration that reuse is prohibited. The full administrative proposal remains local; the published source offer for the existing map is a separate record.

An [unsent clarification draft](FLEETLAB_SF_SOURCE_CLARIFICATION_DRAFT_2026-09-30.md) asks about the exact geometry's terms, adopted/current version and appropriate boundary source. No external message was sent. Owner instruction is required to send one. Actual source clarification, boundary-policy adoption and observations must precede any qualification claim.

## 6. Power-study history and the unapproved 251-arm proposal

| Stage | Recorded outcome | Count |
|---|---|---:|
| Historical baseline/candidate and sensitivities reproduced | Matching scientific evidence; adverse sensitivities retained | 34 arms |
| Original `sf-power-headroom-v1` preflight | Complete; evaluation attempt stopped during preflight recheck before an evaluation arm | 24 arms |
| `sf-power-headroom-v1-r2` preflight | Complete; peak 2,344,648,704 bytes; separate analysis complete | 24 arms |
| First r2 evaluation launcher | Redundant preliminary preflight analysis; stopped before an evaluation arm | 0 arms |
| One explicitly approved fresh-process retry | One valid arm retained; resource stop at 4,046,569,472 bytes | 1 arm |
| **Total recorded campaign arms** | Not all are recommendation-eligible; never pool them as one estimate | **83** |

The r2 frozen protocol is `9a738e81dec4c14b1b6e2a000cb1c4cf4833a005445e1b3e1e9caddb57ceaa3a`. It uses preflight seeds 7303001–7303004 and evaluation seeds 7304001–7304024. Its six configurations are A, A+B and B at **200/400 kW total**, always eight 50 kW ports and four total turnaround slots. All other scientific controls remain fixed. The retained arm is `7304001-a-200`; **143 evaluation arms were not run**. Its primary estimate remains unavailable.

The original one-retry approval was consumed; no new evaluation was authorized by later status checks. Earlier failures, unused tapes and incomplete reports remain retained.

The September 30 proposal declares a possible new study `sf-power-isolated-v1-r3`, 24 preflight arms on seeds **7305001–7305004**, then 144 evaluation arms on **7306001–7306024**. Proposed seeds were collision-checked but never frozen. It would add 168 arms to 83 recorded arms, yielding a **251-arm total campaign ceiling**, versus the previous 226. These are accounting ceilings, not a claim that 251 samples would contribute to the primary.

Its fresh-worker implementation and source hashes do not yet exist. A complete first-seed replay set across all six configurations was proposed for the browser, with summaries for all 144 evaluation arms and all raw evidence retained locally. This avoids exceeding hosting file/asset budgets by exporting every detailed vehicle replay. No selective substitution based on outcomes is allowed.

**October 4 disposition:** reconsider resource policy and execution granularity before approving that exact memo. The old stop is immutable; the future design is not. Any replacement proposal must identify its sources, controls, resource policy, schedule, prior failures and explicit budget. A different architecture should not silently inherit the `isolated` memo's approval or identity. No new arms, tapes, process-isolation production code or protocol freeze were created for this handoff.

## 7. Vehicle classes, curb maneuvers and simulator choices

The live vehicle gallery separates the recorded generic EV from dated public Ojai and Zoox design references. Original artwork and a bidirectional orientation sketch support discussion. They do not constitute calibrated vehicle simulations.

Model lab has **12 anonymous charging cases**: grid budgets 100/200/400/800 kW crossed with vehicle battery acceptance 20/40/80 kW, under explicit assumptions of eight 50 kW ports and 90% efficiency. It separates battery energy, grid energy, losses, recharge time and the binding constraint. It is an arithmetic service-block model, not a new fleet experiment. Three direction/permission fixtures explain that bidirectional capability does not confer permission to use a prohibited exit.

Named vehicle classes still need compatible usable energy, consumption, charging curves, dimensions, service/accessibility dwell and provenance. A historical manufacturer battery figure is not current usable capacity or a charge curve. Actual curb/depot maneuver claims need current site geometry, access permission, motion primitives, clearance/swept-path verification and an appropriate dynamics model. Historical drawing-derived curb data is insufficient as a current as-built survey.

The earlier research assessed these tools by question, not visual appeal:

| Tool / fidelity | Question it might support | Current status |
|---|---|---|
| Current graph/resource simulator | Depot layout, queues, power, trips and empty travel under explicit assumptions | Implemented; bounded synthetic evidence |
| MapLibre | Browser map display, labels and interaction | Used; source qualification remains separate |
| GeoLibre | Optional GIS inspection and workflow support | Evaluated as an aid, not adopted as a substitute for map semantics |
| SUMO | Traffic interaction and network-flow questions | Audition did not qualify the required depot/controller model; no production integration |
| MetaDrive | Bounded driving-policy/scenario questions | Potential future adapter, not integrated into City Explorer |
| MuJoCo | Contact, actuator and physical-system questions | Potential future use; not the solution to fleet-level depot statistics |
| 3D/world-model rendering | Explanation and scenario ideation | Deferred; realistic imagery cannot validate road access, dynamics or safety |

These summarize prior research and implementation status, not an October 4 audit of each tool's latest release. A future adoption needs a named question, suitable licensed inputs, validation and a bounded cost before adding a simulator dependency.

## 8. Publication, preservation, tests and known negative evidence

### Live release

- Stable website: <https://fleetlab.pages.dev/>.
- City Explorer: <https://fleetlab.pages.dev/city-explorer/>.
- Current production: **`e37b4a7b-c60d-4a42-b705-ec6c0bf730e2`**; immutable address <https://e37b4a7b.fleetlab.pages.dev/>.
- Preview: `db37ee8b-3e90-47d8-8b17-f5a869de47bd`.
- Published implementation commit: `cce2d723c225662b2808e57ef9ce8ced3b518c3a`.
- Current local HEAD at this handoff's start: **`4db9630`**, branch **`codex/fleetlab-city-sf`**. Subsequent administrative implementation/proposal notes are local and do not imply another website release.
- Combined immutable stage: `build/fleetlab-city/launch-integration-v4/site`.
- Retained rollback: prior production `a9f05880-a7c7-426f-b5ee-567a39cf0fce`, prior v3 stage, and compatible viewer `city-explorer/releases/7d062d3e51fab0d2/`.

The September 30 preview and production each passed **10,001/10,001 exact payload comparisons** plus effective header checks. The stage has 10,002 files / 10,001 served files and 1,590,225,823 bytes. All 96 protected original-root files and the offline artifact were unchanged. The complete source offer has eight archives / fourteen files, all below 25 MiB.

The public failed-verifier report omits only a private traceback, explicitly labels that projection and retains the original hash/reproduction limit. Original local evidence is intact. Hosted Range requests returned complete matching HTTP 200 bodies; no HTTP 206 support was claimed.

Publishing used the retained pinned Wrangler 4.135.0 with its documented serial upload transport patch. The prior Model lab preview encountered a socket failure after asset upload; a deployment listing confirmed no deployment before the authorized static retry. The later temporal preview/production needed no retry. Website-upload retries are unrelated to scientific rerun permissions. No Git push or PR accompanied the City/temporal publication; earlier repository history contains separate owner-authorized remote work.

**October 4 fresh smoke:** the homepage, City bootstrap and exact current versioned City HTML all match their retained production-stage bytes. This is three entry-page comparisons, not a fresh full 10,001-file readback, browser interaction audit or deployment. No site files were changed today.

### Verification record

| Scope and date | Retained evidence |
|---|---|
| Latest administrative implementation checkpoint, September 30 | **312 City Python passes; 54 City Node passes; 1,661 root Python passes / 56 skips; Ruff and whitespace pass** |
| Published temporal checkpoint, September 30 | 293 City Python; 54 City Node; 1,661 root Python / 56 skips; full release readbacks |
| Original full legacy performance follow-up | **1,972 pass, 0 failures, 1 existing TODO**, 279.94 s with unchanged timing thresholds |
| Later ordinary legacy Node run | 1,954 passes / 8 skips / 1 TODO; not a substitute for the explicit performance run |
| Responsive/browser validation | Checked 390/1024/1280 CSS-pixel layouts without page overflow; actual production Play reached 15:00 and stopped; Overview animation, navigation/contact, fares and depot modes observed |
| October 4 documentation audit | Recomputed timing/storage projections; 12/12 frozen r2 source hashes match; no r3 directory; current human review empty; three live entry pages match; Pixel absent from ADB |

The initial legacy timing failures remain historical evidence. A later quiet serial run passed without changing thresholds. Root comparison tests also had checkout-path byte-pin failures; these were corrected by first asserting exact paths and then using a stable logical artifact root for byte assertions. Production comparison behavior was not weakened.

Earlier source/parser failures, routing work-limit stops, invalid verifier findings, incomplete power stages, review-workspace corrections and upload failures remain retained. Do not summarize the project as “all experiments passed.” The tests above were run for their respective checkpoints; the full suites were **not rerun on October 4 for this documentation-only task**.

Physical Android testing remains incomplete. Earlier sessions obtained USB authorization and sometimes mirroring/unlocked visibility, but lock/foreground/permission interruptions prevented final evidence. October 4 `adb devices` again lists no connected device. Caffeine and disabled screen locking do not establish touch, TalkBack or comprehension results. Other unperformed checks include physical Safari/iOS/Windows, throttled cold load, quantified frame/seek/selection percentiles, browser-memory limits and hardware graphics-context-loss injection. Explicit flat mode was exercised; that does not prove every automatic failure path.

## 9. Remaining SF acceptance and Austin sequencing

| Workstream | Evidence required to close it | Current status |
|---|---|---|
| Administrative source/scope | Exact reuse basis, adopted boundary/version, disposition of 49 residual roads and five affected nodes; preserved population/denominators | Local proposal only; terms unresolved |
| Map semantics | Actual observations against current frozen candidate requirements, required 200-way/100-OD sample and exception/conflict resolutions | Zero observations; class thresholds alone are insufficient |
| Physical device/accessibility | Observable Pixel touch/zoom/select/Play, landscape/enlarged text, keyboard and screen-reader evidence bound to release | No final pass; device absent on October 4 |
| Visitor comprehension | Five independent sessions, open response first, written rubric, second scorer and recorded revisions | Worksheet ready; no participant responses |
| Power/location study | Select disclosed resource design/budget, then test/review/freeze/execute/analyze complete schedule or retain incomplete outcome | r2 stopped; r3 approval withheld pending this trade-off discussion |
| Named vehicle classes | Lawful, compatible measured parameters and versioned sensitivity/calibration evidence | Anonymous teaching model only |
| Curb/depot maneuvers | Current site geometry/permission, suitable physical model and verified motion/clearance | Teaching fixtures and source-road connector contract only |
| SF acceptance decision | Explicit scope, actual evidence, residual risks and any owner-approved deferrals | HOLD |
| Austin City Explorer | Own source/license/scope/routing contract, new frozen experiment, presentation and validation/deployment evidence | Not started |

The five-visitor worksheet is [FLEETLAB_SF_VALIDATION_SESSION.md](FLEETLAB_SF_VALIDATION_SESSION.md). Ask visitors to explain seeds, vehicle IDs, resource controls, queue-hour denominators and model limits before coaching. Two scorers preserve disagreements and supporting answers. Five participants provide formative product feedback, not statistical or safety certification. AI review and simulated personas are not participant evidence.

When the owner approves the appropriate SF acceptance/deferral decision, Austin should inherit the reusable contracts, not SF's qualification verdict. Define Austin municipal/service scope explicitly; qualify source access semantics and geography; declare fictional or measured depot/demand inputs; freeze new paired inputs; retain adverse outcomes; validate its actual devices/visitor flow; publish with the same compatible-bundle and readback discipline. Do not carry over a city conclusion or operator service boundary merely because the UI can load another map.

San Mateo municipality has a prepared California source probe; it is not San Mateo County and remains background work. Las Vegas follows Austin under the current goal. California and Japan require bounded cities/wards, not a single all-state/all-country pack. Tokyo/Japan would add left-driving/local-source semantics. Other Waymo markets require freshly sourced scope decisions; no market-expansion claim is made here.

## 10. Engineering handoff and evidence index

Repository root: `/Users/bohueilin/Documents/GitHub/Hermes-fleetlab`.
The shared repository's product/package remains Hermes; FleetLab is its separate educational application. Do not rename canonical Hermes interfaces. Work is in the existing isolated feature worktree, not the historical Phase 6 baseline.

Source layout:

- `apps/fleetlab-city/citylib/`: graph/resource model, versioned routing/continuity/temporal/connector logic, verification, protocols, packaging and administrative reporting.
- `apps/fleetlab-city/web/`: City Explorer presentation and interaction; it consumes recorded evidence.
- `apps/fleetlab-city/tools/`: build, verification, study and reporting CLIs. Do not invoke freeze/execute commands simply to inspect state.
- `apps/fleetlab-city/tests/` and `test/`: Python and JavaScript checks.
- `playground/fleetlab/`: retained established teaching product.
- `build/fleetlab-city/` and `dist/`: generated local evidence, immutable bundles, release stages and dependency runtimes; not source changes to stage blindly.

Validated runtimes recorded in the project: City Python at `build/fleetlab-city/venv/bin/python`; root Python/Ruff at `/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python`; City Node target `>=22 <23`. Check the installed environment before a future implementation. Applicable commands for code changes include:

```bash
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
npm --prefix apps/fleetlab-city test
PYTHONPATH="$PWD/src" /Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m pytest -q
/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m ruff check .
git diff --check
```

`npm run test:browser` validates recorded browser-evidence inventory; it is not a substitute for driving a browser or collecting real participant answers. Apply meaningful focused regressions first, then the required full gates for actual code changes.

Preserve the owner's untracked `.wrangler/` and `FleetLab-ChatGPT-review-and-next-phase.md`. Do not clean, overwrite, stage or expose credential content. No destructive Git operation, remote modification or new public action is needed for this handoff.

| Evidence / contract | Repository-relative location |
|---|---|
| Original accepted scope and scientific rationale | `docs/FLEETLAB_FINAL_PROPOSAL_2026-09-29.md` |
| Active implementation plan and chronological ledger | `docs/superpowers/plans/2026-09-29-sf-completion-and-model-readiness.md`; `.superpowers/sdd/2026-09-29-sf-completion-and-model-readiness/progress.md` |
| Original City and replay UX validation | `docs/FLEETLAB_CITY_SF_VALIDATION.md`; `docs/FLEETLAB_CITY_UX_V2_VALIDATION.md`; `docs/FLEETLAB_CITY_V3_VALIDATION.md` |
| Presenter guide and original learning narrative | `docs/FLEETLAB_CITY_PRESENTER_GUIDE.md`; `docs/FLEETLAB_NEXT_PHASE_BRIEF_V3.md` |
| Integration and publication history | `docs/FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md`; `docs/FLEETLAB_TEMPORAL_PUBLICATION_2026-09-30.md` |
| Static / temporal / connector implementation | `docs/FLEETLAB_SF_CONTINUITY_VALIDATION_2026-09-30.md`; `docs/FLEETLAB_TEMPORAL_INTEGRATION_V3.md`; `docs/FLEETLAB_DEPOT_CONNECTOR_CONTRACT_V1.md` |
| Completed temporal full-fleet resource case | `docs/FLEETLAB_SF_TEMPORAL_RESOURCE_2026-09-30.md`; `build/fleetlab-city/validation/sf-temporal-fleet-20260930-r6/`; sibling `sf-temporal-fleet-20260930-r6-verifier-3.0.1/` |
| Published candidate and current review history | `build/fleetlab-city/packs/sf-temporal-v3-r2/`; `build/fleetlab-city/reviews/sf-temporal-v3-review-r2/` |
| Administrative source/reporting contract | `docs/FLEETLAB_ADMINISTRATIVE_SCOPE_CONTRACT_V1.md`; `docs/FLEETLAB_SF_ADMINISTRATIVE_REPORT_2026-09-30.md`; `build/fleetlab-city/research/administrative-scope-20260930/proposal-r2/` |
| Original and stopped revised power studies | `build/fleetlab-city/studies/sf-power-headroom-v1/`; `build/fleetlab-city/studies/sf-power-headroom-v1-r2/` |
| Unapproved isolated-worker proposal / cold probe | `docs/FLEETLAB_POWER_PROCESS_ISOLATION_PROPOSAL_2026-09-30.md`; `build/fleetlab-city/research/power-isolation-20260930/cold-r1/report.json` |
| Current complete publication record | `build/fleetlab-city/launch-integration-v4/review/publication.json` |
| October 4 read-only audit and reproducible arithmetic | `build/fleetlab-city/validation/handoff-2026-10-04/capture.py`; `audit.json` |

Key identities (semantic/content identities unless explicitly labeled raw SHA-256):

| Item | Identity |
|---|---|
| Current viewer release | `14dc0191dd7684d0ea9807f8a4d68e018a8be58a2349440ce0b4a801c0af51ad` |
| Temporal candidate bundle | `8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198` |
| Temporal graph | `426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3` |
| Temporal review requirements | `4d43fb2d932b01da27d16055774dfe1b6de141ce342e1a74d9f0248b689c5ac8` |
| Temporal r6 run | `14347ca06e6fd67ca507c6aaed221a26efbb2957a411bf5b26e23fd419f501e1` |
| Administrative proposal manifest | `e12253efc6d9bc4868e646fe1ed8ff857be63d7dbbf3aa1fb9a8a523d497c79a` |
| Full district source raw SHA-256 | `085cde730a5bd725d6c87234a5326c1d22c4a0f20a9147c24c24c9b822fb3c26` |
| r2 power protocol | `9a738e81dec4c14b1b6e2a000cb1c4cf4833a005445e1b3e1e9caddb57ceaa3a` |
| Retained r2 evaluation run | `964bc2ebe3dedd6cdc9997d9d8d037ea07a5c03a1b5d89b6899b5d33c8ea41a9` |
| Read-only cold probe report raw SHA-256 | `d2412cb2700a07137ff984c5dc2442a3db021dd61ea887dd3df4d6d9cd72c1cc` |
| Publication record raw SHA-256 | `6e4bd5ef182f3518879796ecbe9fc3cb344649e4603234d81e74a1970eed2658` |

Important local checkpoints, newest first: `4db9630` resource proposal; `068fdd7` administrative reporting; `3aca81b` publication handoff; `cce2d72` temporal atlas/source offer; `6fc1357` temporal packaging/review; `f4d4abc` explicit connectors; `a89072c` temporal numerical verification; `9f0b3da` bounded routing; `cf964f6` temporal integration; `6797cc9` fleet continuity; `d2227e0` Model lab/review workflow; `7cf32c5` frozen r2 memory revision; `773f36b` atlas/fleet insight UX; `3236065` additive City integration.

## 11. Brief for the next collaborator

> Read this October 4 handoff first. Preserve the existing FleetLab product and its City Explorer tab. Separate published behavior, measured engineering evidence, synthetic statistical results, proposed work and missing external evidence. Address the owner's three questions before proposing any new study freeze: justify the actual research memory budget; compare measured and projected total runtime including analysis/I/O; and distinguish the power interaction question from SF acceptance and Austin sequencing. The previous one-time retry is consumed. The r3 design and 251-arm ceiling are unapproved. Do not run new evaluation seeds, alter old protocols, fabricate human observations, invent operator parameters, or treat realistic rendering as physical validation. Recommend the least complex architecture adequate for the actual requirement. Provide an explicit SF acceptance/deferral proposal before changing the current SF-before-Austin sequence. Keep missing safety, authenticity, regulatory and physical deployment evidence unavailable.

## Recommendation

Do **not** approve the September 30 isolation memo unchanged. First choose a justified research resource envelope and the least complex execution design that meets it. On the present 64 GiB host, evaluate a measured larger-budget warm workflow with analysis separated by phase before committing to 168 cold workers. Retain every stopped r2 artifact. Define the SF acceptance milestone independently from the optional additional insight of the old-map charging study, with any scope deferral explicitly accepted by the owner.

## Top risks + mitigations

1. **Engineering around an unjustified limit:** document the real target and headroom; distinguish local study, browser and hosting budgets.
2. **A faster run conceals scientific or resource changes:** use a new named contract, immutable source/input identities, deterministic parity checks, bounded execution and complete retained failures.
3. **Runtime estimates sound like measurements:** preserve the formulas and source reports; benchmark the actual selected path before committing to a completion time; include export/readback separately.
4. **One statistical result is mistaken for city readiness:** keep map/source, device, comprehension, calibration and physical authority separate in both UI and acceptance records.
5. **SF becomes an indefinite prerequisite:** present a concrete acceptance/deferral decision with owners and evidence, while preserving the user's requested sequence until changed explicitly.

## Next 3 actions

1. Align on the resource purpose and execution design; revise the proposal and campaign budget accordingly, without retroactively changing r2.
2. Close the independent SF source/map and device/visitor evidence, and decide explicit scope for named vehicles and physical maneuvers.
3. Validate and publish only the resulting supported changes, record SF acceptance or approved deferrals, then begin Austin under its own source, experiment and release contracts.
