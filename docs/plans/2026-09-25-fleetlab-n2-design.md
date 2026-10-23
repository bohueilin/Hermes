# FleetLab N2: finite pickup resources and event preparation

**Status: DRAFT for owner review — design only; no N2 implementation authorized or claimed.**

**Updated:** September 25, 2026 Pacific / September 26, 2026 UTC.
**Decision:** Build one Las Vegas-inspired synthetic experiment with two event releases, one shared pickup hub, finite boarding berths and a finite approach queue. Compare reactive availability with published-forecast preparation. First establish the pickup/population contract and responsive execution seam.

## 1. Purpose, baseline and authority

Help a reviewer answer: **Does preparing vehicles for overlapping demand improve service when boarding capacity is finite, and where does it displace harm?** Success means a reproducible explanation of the constraint, including null, mixed and adverse outcomes. A favorable policy result is not a delivery requirement.

This draft uses the owner's `FleetLab_Regional_Simulation_Design_and_Codex_Brief_09-24.md`, especially LV-01 and the model/validation contracts, as a proposal. It narrows that catalog to one mechanism. It does not adopt external factual or data-rights claims from the attachment.

Current N1 application release: `345b427cdddeb6e8946542c66786d3acbaacaa5c`, pushed to `codex/fleetlab-regional-power` and `feat/fleetlab-playground`. The publication task verified Production `6265159a-a13e-4ca7-9f9c-4acde9bcf6e7` at [FleetLab Playground](https://fleetlab-playground.pages.dev), with all 88 public payloads matching the release package. Source inspection began from base `4b7a2768d93891fab95383d4c20cf828f56b2557` plus the same N0/N1 working implementation, then publication completed separately. N2 remains this draft only. Repository package identity remains `hermes-autonomy` 0.1.0 / `hermes`.

Recorded N1 results in [source of truth §7.5](../../HERMES_SOURCE_OF_TRUTH.md#75-fleetlab-playground-teaching-model-not-evidence), [regional mechanics](../FLEETLAB_REGIONAL_POWER.md), and the inspected local `artifacts/fleetlab-regional-power/demo/observed-results.json`:

| Austin condition | Completion result | Existing recommendation | Binding mean-harm guardrail |
|---|---|---|---|
| Full power | UNCHANGED | NO_RECOMMENDATION | None |
| 60% power | UNCHANGED | HOLD | Unfinished visits +0.3333333333333333; allowed 0 |
| 20% power | UNCHANGED | NO_RECOMMENDATION | None |
| Outage/recovery | UNCHANGED | HOLD | Terminal energy 5.392090651592032 kWh; allowed 5 |

All four used evaluation seeds 1001–1012 and completion margin 0.02. None establishes that practical primary improvement. These seeds are already observed and cannot become fresh N2 validation by relabeling them. All-request within-target pickup remains unavailable in N1.

The publication task's fresh serial Node run with opt-in performance enabled recorded **1,791 passes, zero failures/skips and one existing TODO** (1,792 total), with 89 scoped Python passes. The earlier standard run recorded 1,779 passes; full Python retains disclosed fixture-related failures. These are N1 validation records, not N2 acceptance. N1 browser measurements include 62–83 ms synchronous arms at 120 vehicles. Its offline artifact is 2,543,655 bytes against 2,621,440, leaving **77,785 bytes**. These constraints shape the design.

Boundary: `NOT_EVIDENCE`; semantic scope `SIMULATION_ONLY` (existing browser serialization `simulation-only`); deployment permission `NONE`. Digests establish identity, not authentication. Locations, traffic assumptions, event releases, access rules and berths are fictional. No commercial airport rights, affiliation, calibrated city forecast, physical deployment or safety claim. No Python evidence core, verifier, gate, workbench or bundle-contract changes.

## 2. Options and recommendation

| Path | Value | Cost / limit | Decision |
|---|---|---|---|
| **A. Bounded N2 curb experiment** | Tests whether forecast preparation helps when arrivals cannot board immediately; reuses lifecycle and paired statistics | Requires explicit service events, finite reservations and execution checkpoints | **Recommend**, after the contract prerequisites below |
| B. More Austin power sweeps | Deepens understanding of the existing energy/backlog tradeoff with little architecture work | Does not answer finite pickup capacity; repeated favorable-seed selection would weaken inference | Retain as a separate learning exercise, with fresh registered evaluation |
| C. Multi-region traffic, weather and launch platform | Wider operating questions | Several new causal mechanisms, calendars, calibration and package/performance costs | Defer; no general simulator rewrite |

One shared hub deliberately isolates boarding and approach constraints. Two event releases represent independently generated parties walking to that hub. They are not claims about any actual Las Vegas venue layout. Multiple constrained hubs and routing between pickup points require a later design.

## 3. Current implementation and proposed seams

All source paths below are relative to `playground/fleetlab/`; proposed modules do not exist yet.

| Existing seam | Inspected behavior | N2 change |
|---|---|---|
| `src/model/region-package.js` | Pinned Austin constant; regional validation rejects airport and launch; graph routes use explicit meter→kilometer conversion | Add a closed registry resolving exact region/graph references; preserve Austin bytes and behavior; add one separately pinned Vegas schematic |
| `src/model/airport-demand.js` | SFO-only single wave; keyed demand separate from `forecastTarget`; pickup means arrival before boarding | Preserve v1; extract reusable keyed-wave/forecast primitives with parity tests; add `event-demand.js` for two published waves at a fictional hub |
| `src/model/bay-operations.js` | Owns demand, dispatch, travel, boarding, visits and minute loop; currently sets `picked_up_minute` on arrival | Add opt-in event/curb hooks and explicit boarding-start events; retain one lifecycle and one energy ledger |
| `src/model/bay-systems.js` | Allocation, invariants, resource accounting, airport cohorts and result extensions | Consume curb accounting; expose service populations through proposed `pickup-metrics.js`; keep presentation out of accounting |
| `src/model/bay-experiment-contract.js` | Freezes one treatment, validates pairs, replays first pair, then calls `pairedMetricSteps` | Add versioned N2 treatment/metric contract and complete region/condition identity; reuse existing statistics and mean-harm interpretation |
| `src/model/launch-contract.js`, `launch-rehearsal.js` | Separate commissioning/readiness and arrival-based all-request pickup contract | Remain separate; do not import launch metrics or mutate M4 meaning to fill N2 gaps |
| `src/ui/regional-power-view.js`, `operations-lab.js` | Native DOM; snapshots and yields between synchronous arms | Add compact `regional-curb-view.js`; shared schematic/table helpers only where they reduce duplication; cancellable in-arm execution |
| `src/ui/setup-codec.js`, `setup-sharing.js`, `studio.js` | Strict model/version sharing, current/last-run/last-experiment snapshots, no autorun | Add explicit `regional-curb` setup support and route integration; preserve older envelopes |

Proposed dependency flow:

```text
pinned region + validated external demand/condition/forecast tapes
    → existing Bay lifecycle + curb resource state + existing depot systems
    → recorded events/populations/intervals → N2 compatibility adapter
    → shared paired instrument → native read-only result projections
```

`curb-resources.js` owns exclusive approach/berth reservations and interval accounting. It neither selects vehicles nor reads future demand. `event-demand.js` owns exogenous releases and publications. Policy helpers receive only their declared current view. UI code selects and renders recorded inputs/results; it computes no alternative outcome or recommendation.

## 4. Region, condition and resource contracts

**Region.** Proposed `nv-las-vegas-demo`, graph `nv-las-vegas-schematic-1.0.0`, selected through an exact `region-package-1.0.0` reference. Preserve the schema only if the registry addition does not change existing interpretation; any changed interpretation requires a new version. Hash full graph and package/source manifest separately.

Initial fictional local-meter nodes: west `(0,4000)`, north `(4000,8000)`, central `(4000,4000)`, east `(8000,4000)`, shared hub `(4000,0)`. Edges: west–central, north–central, central–east, central–hub, east–hub. Fixed depots are west and east. All pairs use declared undirected shortest paths; disconnected or unknown routes reject, with no straight-line substitution. Node IDs and stable tie order are pinned. No geographic coordinates, imported roads or map fetch.

Provenance records geometry, demand, walking, dwell, vehicle and service assumptions separately as synthetic; include units, transformation version, source ID/date, missing measurements and package destination. Use elapsed integer minutes; `America/Los_Angeles` is a display label only, with no date/DST conversion.

**Demand/forecast.** Proposed `event-demand-1.0.0` contains exactly two stable event IDs, one known hub, release minute, spread, party count, conversion probability and walking minutes. One request is one party under the existing capacity assumption; never count a party as a passenger count. Forecast records contain their own ID, publication, exclusive expiry, predicted ready-wave minute and predicted request count. They are separate inputs, not derived from realized parties. Key random draws by seed, event ID, party ID and channel; array insertion or scheduler order cannot change a realization.

Use integer elapsed times bounded by 1,440 minutes, at most 1,000 potential parties across both events, conversion in `[0,1]`, and `0 < I ≤ H ≤ 1,440`. Retain existing configuration bounds and the 10,000,000 request-minute / 1,500,000 comparison vehicle-minute replay budgets, with a conservative bound including both event cohorts. Reject over-budget configurations before building tapes. Forecasts require publication before exclusive expiry and valid bounded counts/times.

**Curb.** Proposed `curb-resources-1.0.0` identifies one hub, named berths, approach slots, staging slots, target minutes, additional dwell and dated fictional access-rule ID. Suggested bounds: 1–8 installed berths, 1–24 approach slots, 0–24 staging slots, additional dwell 0–30 min, target 1–60 min. Usability tapes allow zero usable berths. No arbitrary free text or remote resource references.

**Condition tape.** Proposed `curb-condition-1.0.0`: at most 48 contiguous half-open integer-minute segments exactly covering `[0,H)`, each listing usable berth IDs from the installed inventory. Unknown IDs/fields/versions, duplicates, gaps, overlaps, nonfinite values and mixed region references reject before execution. Approach and staging capacities remain fixed in N2. A closure blocks new boarding on affected berths; already boarding parties finish and release the berth. Label this **drain-on-close**, not evacuation or a safety procedure.

Admission and staging cannot confer berth permission. At all times: one owner per slot; one vehicle/request assignment; a car cannot occupy approach, staging and berth simultaneously; inbound approach reservations plus queued vehicles cannot exceed approach capacity; occupied berths cannot exceed installed count. Closed-but-draining berths remain explicitly occupied, with no new admission until usable.

Initial compatibility whitelist: Vegas + event + curb + existing readiness/charging with constant power and fresh, healthy resource configuration. Reject `airport`, `launch`, site-power stresses and Street coupling in this N2 version. Austin's supported combinations remain unchanged. Combined power/curb failure is a separate future experiment, not an accidental nested option.

## 5. Lifecycle, overflow and horizon rules

1. At minute `t`, settle work performed in `[t-1,t)`, including arrivals, completed boarding and released slots. Record arrivals even at `H`.
2. Apply berth usability for `[t,t+1)` and publish forecasts whose publication is now visible. Expiry is exclusive: `published ≤ t < expires`.
3. Introduce requests whose ready-at-hub time is `t`; expire unassigned requests at the existing assignment-patience boundary before dispatch. Preserve the current boundary behavior explicitly.
4. For `t < H`, admit arrived approach vehicles FIFO by arrival minute, reservation sequence, then stable vehicle ID, into usable free berths. Start boarding and record its event.
5. Dispatch waiting requests using the existing FIFO/nearest-energy-feasible rule. A hub assignment first reserves an approach slot; full approach storage leaves the request waiting and records `APPROACH_FULL`. An available vehicle elsewhere is not sent into an unreserved queue. Newly arrived zero-distance assignments may join the same deterministic admission pass after prior queued vehicles.
6. Forecast preparation follows dispatch, as in the existing airport flow. Reserve staging before repositioning. A staged car assigned to a hub request exchanges staging for an approach reservation atomically; a successful non-hub assignment releases staging when its pickup travel starts. Staging never bypasses the approach queue or consumes a berth.
7. Allocate depot work/power under existing rules, record state, then advance `[t,t+1)`. At `H`, finish elapsed transitions and classify cohorts; no new assignment, berth admission, preparation or interval energy.

Overflow is **refused approach admission with passenger waiting**, not invisible off-map vehicle storage or a dropped request. Report both unique blocked requests and blocked request-minutes; repeated blocked attempts are not distinct lost requests. Unassigned requests may abandon only through the existing assignment-patience rule and remain in the denominator. Assigned approach/boarding waits have no new abandonment mechanism in N2; disclose this limitation.

Approach queue and berth idle time draw no additional energy in this slice; this is an explicit missing auxiliary-load mechanism, not zero real-world HVAC cost. Travel and preparation consume the existing battery-side energy and preserve passenger-trip plus depot-return reserve checks. Required depot work, reservations and unfinished charge targets cannot disappear.

All initial vehicles are placed at the fictional depot nodes, deterministically across the fleet; none starts at the hub with uncounted occupancy. Background origins/destinations and event destinations use the four ordinary nodes; the hub is an event-only pickup node, never a passenger drop-off. This prevents unconstrained idle supply accumulating at the hub through another path. Staging capacity counts inbound and arrived vehicles. Forecast expiry stops new preparation; previously staged vehicles remain until assigned or the run ends, and remain available to existing feasible dispatch. No automatic teleportation, recall or optimum cleanup policy is added.

## 6. Prerequisite: honest pickup and population definitions

Existing `picked_up_minute` denotes **vehicle arrival**. Preserve that field's meaning in legacy and N2 outputs; label it accordingly in N2. Add nullable `arrived_pickup_zone_minute`, `boarding_started_minute`, `departed_minute` and existing completion time, with required ordering checks. N2 service pickup is **boarding start after resource admission**, not arrival or end of dwell. Non-hub requests also receive boarding-start events, so an all-request metric is actually supported.

Use proposed `pickup-metrics-1.0.0`; no inferred timestamps, absent→zero coercion or silent reuse of `airport_within_target_fraction`. The new metric's label includes “boarding started.” Existing arrival-based max-wait remains in the historical guardrails and is displayed with its original definition.

| Population / metric | Exact N2 rule |
|---|---|
| Eligible requests `N` | Every background or converted event-party request with `created_minute < I`; `I ≤ H`; preserve immutable request IDs and explicit `source_kind` / `event_id` |
| Request creation | Background creation is its generated minute; event creation is release + sampled spread + declared walking delay, when ready at the hub; retain release/walk fields separately |
| Completion primary | Existing whole-run completed by `H` / `N`, null if `N=0`; margin remains 0.02 |
| Boarding within target | Boarding start exists and `boarding_started − created ≤ T` |
| Boarding late | Boarding start exists and delay `> T` |
| Boarding missed | No boarding start, and unserved or `created + T ≤ H` |
| Boarding pending | No boarding start, not unserved, and `created + T > H` |
| All-request within-target fraction | Within target / `N`; late, missed and pending stay in the denominator; null if `N=0` |
| Observed boarding wait | Boarding start − creation, or `H − creation` if not started, including unserved; this is censored observation, not predicted eventual wait |
| Non-event service | Explicit `source_kind=background`, independent of hub location; completion and boarding fractions use the full background cohort |
| Event service | Separate each event and their union; empty event cohorts are explicitly unavailable |
| Excluded potential parties | Converted parties ready at/after `I`, plus nonconverted parties, are separately reconciled; neither is silently added to service success nor counted as an eligible request |

Require `within + late + missed + pending = N`, and independent lifecycle conservation across completed, unserved, waiting, assigned/traveling, approach-queued, boarding and passenger-trip states. Existing aggregate `in_progress_trips` includes the new approach-queued state, with exact subcounts exposed. Queue minutes include unfinished waits to `H`; terminal inventory includes all waiting vehicles, reservations, staged cars and required depot work.

Walking precedes the service clock; show it separately and expose release-to-boarding delay as descriptive. N2 does not optimize walking, make accessibility claims or improve apparent service by changing that clock between arms.

## 7. Treatment and experimental discipline

Only treatment: `events.policy = reactive → forecast`, proposed treatment ID `event_forecast`. Both arms receive identical complete region, fleet, demand realization, boarding requirements, condition tape and forecast publication tape. Only the candidate acts on the visible forecast. Reactive dispatch still observes current demand/resources. Forecast helper inputs exclude future requests, random state, unpublished publications, realized wave parameters and future berth closures. Mutation tests must show future-only input changes cannot alter earlier decisions.

For two published waves at one hub, reuse the existing `forecastTarget` idea over currently valid publications whose preparation windows have opened; desired prepared supply is the sum of visible predicted request counts capped by staging capacity. Pin aggregation and stable selection order. Do not replenish based on an omniscient count of future arrivals. False/stale forecasts are valid adverse conditions, not invalid evidence.

Freeze before evaluation: graph/package/condition/forecast hashes, event and pickup metric versions, policy parameters, initial population, `I/H/T`, primary and guardrails, bootstrap options, seed lists, and condition matrix. Pair validation compares complete immutable exogenous rows, including event source, walking and dwell fields; a short demand signature alone is insufficient. Replay both first-seed arms and independently check event/population/resource/energy invariants before statistics.

Keep the existing primary and four guardrails unchanged: max arrival wait harm ≤5 min; unfinished visits ≤0; terminal energy harm ≤5 kWh; rejected actions ≤0. Proposed N2 adds separate mean-harm guardrails: all-request boarding-within-target fraction loss ≤0.02, background completion fraction loss ≤0.02, and approach-blocked-request fraction increase ≤0.02. These are illustrative prototype limits requiring owner review; never combine them into a score or offset them with primary gains. Event-only pickup remains descriptive to permit a zero-realization false-forecast control.

Recommended seed protocol: tuning 2001–2012; reserve evaluation 3001–3012 after checking no prior N2 use. Treat 1001–1012 as historical regression examples only. Seed freshness is procedural, not authenticated. Register all conditions before evaluation, inspect all results, and report every cell. If outcomes inform a policy change, version it and use a new reserved seed set; do not repeatedly select on 3001–3012. More seeds require an explicit uncertainty/precision reason, not a search for significance. One seed remains descriptive; unavailable required cohorts block analysis.

Suggested **synthetic starting assumptions**, to freeze after development-only checks: 40 cars, 2 depots, `H=240`, `I=180`, `T=10`, background 20 requests/hour, clear conditions, constant charging, 2 berths, 4 approach slots, 6 staging slots. Each event has 40 potential parties, conversion 0.7, spread 10 min and walk 5 min. Overlapping releases at 90/95; separate control at 60/130. Forecasts publish 30 min before their predicted ready-wave minute and expire 30 min after it; predicted count 28 each; preparation lead 30. Additional hub dwell 2 min plus existing rounded vehicle boarding time. All other exact values come from a frozen, exported config, never evolving UI defaults.

| Registered condition | Isolated change / intended discrimination |
|---|---|
| Separated releases | Release times 60/130; tests whether a shared capacity peak is absent |
| Overlapping releases | 90/95; reference contention case |
| Longer boarding | Overlap plus additional dwell 6 instead of 2 min; tests berth service limit |
| False second forecast | Overlap forecast unchanged; second event conversion zero; exposes wasted preparation and displaced service |
| Berth loss/recovery | Overlap; berth-2 unavailable during `[85,125)` with drain-on-close semantics |
| No preparation | Same-policy control and, separately, zero staging capacity; exact expected null effects |

The first five cells each use the same registered 12 paired seeds; report them as five condition-specific estimates, not one universal winner or a validated continuous response surface. Paired run deltas are the replication unit, not requests. Preserve 2,000 bootstrap resamples and existing interval semantics; limited seed coverage does not establish real-world confidence.

## 8. Responsiveness and cancellation

N1's 62–83 ms arm stalls already exceed a 50 ms long-task threshold. Adding queue bookkeeping while retaining only between-arm yields is not acceptable by default. Prefer a cooperative execution seam before a Worker: it fits the current static/offline packer and avoids duplicating the engine or adding a new CSP capability.

Refactor the single Bay loop into a deterministic step iterator with a synchronous drain wrapper preserving `simulateBayAreaOperations`. The browser runner yields at minute boundaries within a measured 8 ms scheduling target; model state, random draws and ordering never depend on wall time. Demand construction and final metric/export preparation must also be measured and, if needed, sliced. A single over-budget minute requires finer deterministic checkpoints or a lower validated workload cap, not a fake yield after the long work.

Use a run token/abort signal checked at every checkpoint. Input edits, cancel, navigation and destruction invalidate pending work. Do not save a partial result as last-completed or export a partial comparison as valid. Retain a previous completed result with its exact stale label. Repeatability must be byte-identical across synchronous, differently chunked and canceled-then-restarted execution, excluding timing diagnostics.

Measure at 40 and 120 vehicles with the full 12-seed condition on a recorded browser/host: cold/warm start, longest main-thread task, scheduling-chunk distribution, peak retained heap, total wall time, and **input event timestamp→visible canceled status**, including event-dispatch delay. Targets: no simulation task >50 ms, p95 cancel response ≤100 ms and max ≤200 ms over at least 20 deterministic cancellation offsets. These are proposed local acceptance budgets, not measured N2 claims.

If cooperative execution cannot meet those budgets within bounded inputs, stop the UI release and present either a reduced input bound or a separately reviewed Worker design. A Worker must preserve one producer, cancellation, static/offline parity and existing CSP; no automatic `blob:`/network relaxation or dependency adoption.

## 9. Review experience and interoperability

Keep the six main views and add the Vegas question beside Austin inside Fleet day. Before Run, show synthetic graph, exact condition, fixed/treatment inputs, `I/H/T`, clock definition and resource capacities. Use a simple schematic and existing DOM/table language; no new framework, map/media asset or decorative city claim.

Recorded review shows policy, versions/seed, complete service populations, arrivals versus boarding starts, berth occupancy/usability, reserved inbound/queued approach capacity, staging, overflow, preparation distance/energy, displaced background service, unfinished tasks and terminal energy. Explain blockers from recorded events. One selected request links release→walk→creation→assignment→arrival→queue→boarding→departure; null stages say “Not available” or “Not reached.” Exact machine values remain inspectable beside formatted values.

Comparison shows primary, each guardrail, and descriptive event/curb metrics separately. Distinguish valid adverse outcomes from invalid accounting, incompatible inputs, canceled runs and unavailable cohorts. Invalid or incompatible comparisons render no confidence chart or accepted recommendation. Editing settings must not relabel old results; loading setup never runs.

Proposed versioning: new `regional-curb` setup model under existing `fleetlab-setup-v1` only if its envelope shape is unchanged; exact N2 model/metric/source identities are mandatory. N2 composite model identity includes event, curb and condition versions, and its result uses `bay-systems-metrics-2.0.0` plus `pickup-metrics-1.0.0`; non-N2 runs retain metric v1. Preserve legacy setup bytes, schemas, hashes and behavior. N2 paired exports use `fleetlab-bay-paired-experiment` format version **2**, with a strict v2 reader; retain v1 handling unchanged. Unsupported versions reject instead of guessing or migrating.

Export complete frozen inputs, provenance once, condition/publication tapes, aggregate/per-seed populations, primary/guardrails, rejected actions and terminal inventories. Single-run export includes causal event records; compact paired export retains replayable configs/seeds and required summaries. Bind graph and full package/source digests, not graph alone. No browser result becomes a Hermes evidence bundle. Preserve 32,768-character setup and 65,536-byte decode limits; fail explicitly with complete JSON download rather than truncation.

The offline budget stays **2,621,440 bytes**. Track byte delta after every work package; share small helpers and avoid repeated provenance/UI literals where compatible. Preserve all 56 lessons, static/offline routes, no-autorun sharing, CSP and no unexpected network access. If the budget is exceeded, narrow/refactor N2 or seek a separate architecture decision; never silently raise the limit or remove existing lessons.

## 10. Work packages and acceptance gates

| Package | Deliverable | Exit evidence before dependent work |
|---|---|---|
| WP0: freeze contracts | Owner-reviewed pickup timing, finite queue semantics, version/compatibility table and experiment registration | Hand-worked traces for same-minute arrival, full approach, closed/draining berth and terminal boundary; no ambiguous denominators |
| WP1: execution seam | Single deterministic iterator, sync wrapper and cancellable browser runner | Legacy Bay/Austin/airport/launch parity; chunk-schedule replay; cancellation/race tests; initial timing and byte budget |
| WP2: region + resources | Vegas registry entry, keyed two-event demand, forecast view and curb resource state | Pure unit tests plus lifecycle invariants; identical exogenous tape between arms; no future-input leakage |
| WP3: metrics + comparison | Explicit boarding events/populations and N2 v2 adapter | Independent recomputation; zero/late/pending cohorts; malformed/mismatched input rejection; null treatment; adverse-policy guardrail checks |
| WP4: review + sharing | Compact view, exact snapshots, v2 export, strict setup support | Browser keyboard/narrow-width review; stale/cancel/no-autorun checks; static/offline package checks and measured responsiveness |
| WP5: registered evaluation | All frozen condition runs, reproducibility script and observed-results record | Complete positive/null/negative results, no seed selection; handoff/source-of-truth updated with actual commands, versions, digests and limits |

Required model cases: zero demand; zero staging; one berth/one approach slot; equal-time FIFO ties; closed-at-start and close-at-admission boundaries; closure with an occupied berth; recovery; all berths unavailable; false/expired/unpublished forecast; overlapping waves; request exactly at `I`; pickup exactly at target; completion exactly at `H`; arrival at `H` without boarding admission; unfinished approach/depot work; and invalid reservations that grant no capacity. Check conservation each minute and recompute totals from records.

Required compatibility cases: legacy Austin constant-cap replay; legacy SFO airport and launch snapshots; foreign graph/provenance/version; changed non-treatment initial populations, dwell, demand or conditions; cross-model extension combinations; empty required metric population; hostile strings/unknown keys; tampered frozen digest; setup limits; and no simulator import into protected review paths.

Verification at implementation time: focused new Node tests, full standard Node suite, isolated relevant opt-in performance suites, scoped Python website parity/boundary tests, Ruff, static and offline `pack.mjs`/`check-dist.mjs`, `git diff --check`, and repository-required Python/doctor gates using the correct checkout environment. Record exact commands/counts/source SHA and every skip/failure. Retained Python fixture failures remain disclosed and cannot be erased or fabricated to manufacture acceptance.

Browser acceptance must cover native source, packed static and offline-over-HTTP, 1280×720 and 400 px widths, keyboard focus/status, current/last-run/last-experiment restoration, cancellation during both arms/bootstrap/final projection and navigation. Direct-file support, additional browsers, physical devices and assistive technologies are claimed only if actually tested.

Model adequacy acceptance is limited to discriminating the intended mechanism: a hand-computable berth-limited fixture must show capacity bounds, long dwell must occupy a berth longer, and no-slot/full-closure cases cannot create service. Monotonic fleet-wide gains or a favorable forecast effect are not assumed. A small reviewer task study should test whether people identify the changed policy, bottleneck, displaced population and simulation limit; report observed counts before claiming usability improvement.

## 11. Open decisions and recommended defaults

| Decision for owner review | Recommended default | Why it matters |
|---|---|---|
| One hub or multiple venues' pickup systems? | Two events feeding one shared fictional hub | Isolates the berth/approach mechanism; avoids a new multizone routing optimizer |
| Service pickup event? | Boarding start after berth admission | Arrival alone hides the queue; boarding completion conflates access and dwell |
| Promote pickup to primary? | Keep completion primary; add boarding guardrail and descriptive detail | Prevents changing the decision criterion after N1 results; any new primary needs a separate registered contract |
| Full approach behavior? | Refuse assignment, retain request in queue | Finite storage without disappearing demand or invented overflow roads |
| Closure behavior? | Drain current boarding; block new use | Deterministic bounded semantics without an evacuation model |
| New guardrail limits and seed registration? | Prototype limits and fresh protocol in §7, reviewed before evaluation | Defines what harm is tolerated and limits repeated selection |
| Worker now? | Cooperative checkpoints first; measured escalation | Addresses observed stalls while protecting offline/CSP and size constraints |

These defaults make the draft concrete; they are not approval of N2 implementation. Implementation planning follows review of this artifact. Publishing the existing N1 release does not approve N2 or turn browser outputs into evidence.

## 12. Deferred scope and stop conditions

Defer multiple constrained hubs, dynamic passenger rerouting/accessibility, post-assignment abandonment, queue spillback into roads, Street-to-Fleet coupling, combined power/weather stresses, thermal/auxiliary physics, pricing, new optimizer/RL/LLM policy, Massachusetts/Japan, DST calendars, live maps/traffic/events, data acquisition, Waymo/nuPlan conversion, authentication, backend, cloud ingestion and real vehicle/charger connections.

Stop the affected slice if arrival and boarding cannot be distinguished; populations or reservations do not conserve; paired external tapes differ; legacy version semantics change; policies access future realizations; mandatory work disappears; unavailable evidence is rendered as success; responsive execution or package limits cannot be met; public data/access permissions become necessary; or the feature requires protected Python evidence/workbench changes. Document the blocker and continue independent safe design/test work. Remote publication is governed separately by explicit owner instruction.

## Recommendation

Approve N2 only as this bounded resource-and-service experiment, with WP0 pickup/population contracts and WP1 responsiveness preceding visible feature expansion. Preserve the existing completion decision and accept an inconclusive or adverse result as useful learning.

## Top risks + mitigations

- **A queue becomes an invisible success:** separate arrival/boarding events; retain all requests and terminal reservations; independently recompute service partitions.
- **Forecast benefit hides displaced service or unfinished work:** retain existing primary/guardrails, add explicit boarding/background/overflow guardrails, publish every registered condition.
- **A toy region is mistaken for operating permission:** synthetic field provenance, fictional access/berth rules and persistent `NOT_EVIDENCE` / simulation-only / permission `NONE` boundaries.
- **Added mechanics freeze the browser or exceed the bundle:** measured checkpoints, full input-to-cancel timing, conservative workload limits and unchanged byte budget.
- **A useful refactor breaks old contracts:** opt-in versions, synchronous replay parity, strict cross-version rejection and static/offline/lesson regression checks.

## Next 3 actions

1. Review the seven defaults in §11 and freeze pickup, overflow, closure and guardrail semantics with small hand-worked traces.
2. Write the implementation plan for WP1–WP3, including deterministic checkpoints, resource invariants and legacy parity fixtures, before starting N2 code.
3. Reserve and register fresh evaluation seeds and the complete condition matrix; then build WP4–WP5 only after model, responsiveness and package gates pass.
