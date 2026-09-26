DRAFT v2 for owner review; design only; no N2 implementation authorized

# FleetLab N2: finite pickup resources and published-forecast preparation

**S0 / WP0 contract addendum, 2026-09-26.** This complete corrected design supersedes [draft v1](2026-09-25-fleetlab-n2-design.md) for future implementation. It does not authorize implementation, experiment registration, an execution-seam refactor or publication. The [owner brief](2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md) §2 controls decisions; [independent review](../FLEETLAB_PACKET_REVIEW_2026-09-26.md) §2 supplies the contract corrections and §3 supplies S1 recommendations. The [packet](../FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md) §7 supplies the earlier findings and traces. This document describes proposed behavior, not measured N2 results.

## 1. Purpose, authority and change log

The question is: **Does preparing vehicles for overlapping demand improve service when boarding capacity is finite, and where does it displace harm?** One Las Vegas-inspired fictional graph, two synthetic event cohorts and one shared constrained hub isolate that question. Reactive availability and published-forecast preparation differ only in `events.policy`. Null, mixed and adverse outcomes are useful results; a favorable forecast effect is not acceptance.

Source inspection uses baseline `b1c12b6a11e25fb7a7dabc9392f94368aee88740` on `codex/fleetlab-d1-result-first`; source references below are relative to `playground/fleetlab/` unless stated otherwise. No N2 modules exist at that baseline. The source inspection confirms the existing Bay lifecycle, charging/readiness accounting, pair adapter, keyed helper and region-routing behavior. The application source is unchanged from the review's `7dbb6cb`. Repository identity remains Hermes, distribution `hermes-autonomy` 0.1.0, import `hermes`.

FleetLab results remain `NOT_EVIDENCE`, scope `SIMULATION_ONLY` (browser serialization `simulation-only`), permission `NONE`. Hashes identify bytes; they do not authenticate a producer. Synthetic graph, vehicle, energy, traffic, event, access, service and berth assumptions establish neither real-world calibration nor safety, commercial access, certification, affiliation or deployment authority. No Python evidence core, gate, verifier, workbench or bundle contract changes belong here.

### 1.1 Changes from v1

Line numbers refer to the immutable 236-line v1. Every substantive changed section is listed; retained sections are restated below so implementation does not depend on reconstructing v1 plus amendments.

| v1 lines / section | Corrected contract and cause |
|---|---|
| 1–29, status/baseline | Superseding v2 status; current inspection anchor; historical N1 numbers remain historical, not N2 acceptance (R3, R8). |
| 43–65, proposed seams | Required capture-independent records, validation on every arm/seed, v2 adapter and no second lifecycle/statistical engine (F4, R7, R8). |
| 69–85, region/demand/curb | Exact graph interpretation, depot/type order, keyed event/background namespaces, resource omission and complete identities (G3, G5, G6, R4, R5, R8). |
| 75–79, keys and bounds | Stable integer ordinals; no ID-string randomness; record/serialization budgets; isolation-cell exception remains S1 registration (G2, G5, G6, R4, R7). |
| 89–95, minute order | Curb-first whole-pass classification; end-of-pass 5a; two admission passes; one berth start/minute; expiry at H (F1, F2, F5, G5, R6). |
| 93–101, overflow/preparation | Approach-refused terminology; staged cars in A but excluded from E; stronger preparation energy screen; replenished target; A+S asymmetry (F1, F2, G1, G3, R1, R4). |
| 105–126, populations/metrics | Arrival versus boarding; realized ceil duration; abandonment time; four terminal statuses; honest historical age label; background boarding guardrail and arrival-based averages (F2–F5, G4, R2, R3). |
| 130–138, pairing/registration | Exogenous fields versus outcomes; every-seed independent validation; eight non-compensatory guardrails; headroom and independence checks; proposed replacement seed blocks (F2–F4, G2, G6, R2, R3, R8). |
| 140–151, defaults/cells | Proposed values distinguished from registration; all inherited parameters explicit in S1; exact cell tapes unresolved, G2 OPEN; no false-alarm claim for overlap false-event cell (G1–G3, G6, R1–R8). |
| 155–163, execution | Retain cooperative single-producer proposal; add accounting validation, serialization and retained-memory scope (F4, R7). |
| 167–177, review/export/version | Honest arrival labels/statuses; exact values; strict v2 and accounting identities; scalar compact exports and resource “not modeled” (F2–F5, G4, R5, R7, R8). |
| 181–198, work packages/acceptance | S0 design, S1 registration and X1 execution require separate approval; full fixture set; invalid curb attempts invalidate; legacy parity unchanged (F1–F5, G1–G6, R6–R8). |
| 200–236, decisions/stops/next steps | Owner decisions below replace undecided defaults; S1 remains open for registration; retain bounded scope and limits (F1–F5, G1–G6, R1–R8). |

### 1.2 Decision log and source disagreements

| ID | Evidence | Resolution |
|---|---|---|
| DL1 | Review F1 parity paragraph includes every available vehicle; owner D-F1b exempts staged vehicles. `bay-operations.js:199,204` shows the legacy set. | N2 differential expectation is the legacy set **minus staged vehicles** in refusal-free minutes with waiting requests, from the same state. Staged vehicles remain in A and the range bound. |
| DL2 | Review F4 has two requests created at 0; the owner brief requires distinct creation minutes outside G5. | Shift its resource window by +1: H=7, r1 created 0, r2 created 1, supply first available at 1. Expected ownership/refusal intervals shift by +1; their lengths and partial distance remain unchanged (§9.4). No negative creation minute. |
| DL3 | Review R6 creates three requests at 100, again conflicting with that owner fixture rule. | Use creations 97/98/99 and explicitly unavailable prior supply; preserve the minute-100 dispatch order and transition tuple (§9.6). |
| DL4 | Review F1 says “4 km edges”; the draft coordinates give east–hub length sqrt(32) km. `region-package.js:41–42` computes Euclidean edge lengths; `bay-operations.js:122` rounds travel duration up. | F1 is explicitly an all-4-km **unit-test graph**, not the package geometry. Package fixtures F3/F4/G1 use sqrt(32). No silent route override. |
| DL5 | Packet R5 recommends fresh resource overrides; owner R5 instead omits `resources`. `resource-observations.js:3–4` defaults to delay/outage. | Omit the extension entirely; its metrics are unavailable / “not modeled”, never fabricated zero. |
| DL6 | Packet F2 uses hub denominator and feasible-vehicle-first attribution. Review and owner choose all N and curb-first. | Use the owner's guardrail and review's per-turn classification; no packet attribution rule survives. |
| DL7 | Review G3 calls its mutation “swapped IDs”, but the owner pins stable vehicle index and array preparation order; source dispatch uses array order, not lexical ID (`bay-operations.js:193–197,208–210`). | Distinguish display-only renaming (no effect) from reindexing/array-policy mutation (12 versus 4 empty km). Only the latter is the discriminating G3 variant (§9.9). |
| DL8 | V1 proposes extraction from airport RNG/forecast code. `airport-demand.js:23,34–36` has different randomness and inclusive expiry. | Add N2-versioned behavior without modifying airport v1 draws, inclusive expiry, output fields or bytes. |
| DL9 | V1 line95 prohibits new **berth** admission at H; `bay-operations.js:159–161` settles non-hub arrival directly into boarding even at H. | Scope resolution: R6 admission is constrained-hub berth admission. Preserve inherited non-hub settlement, with no executed interval at H. No dispatch/preparation or hub admission at H. |

## 2. Owner decisions adopted

| ID | Binding N2 decision |
|---|---|
| D-F1a | Energy-recovery fallback 5a fires at the end of the dispatch pass. |
| D-F1b | Staged vehicles stay in A for the trigger and range bound but never enter E. They are never blocked or sent to a depot by 5a. The refusal-free differential set is legacy minus staged vehicles. No `DEPOT_VISIT_STARTED` ownership end reason. |
| F2 | `approach_refused_request_fraction` is required: unique eligible hub requests with ≥1 `APPROACH_FULL` minute / all eligible N; max increase 0.02. Apply pre-evaluation headroom rule. Ordinary curb refusals are not `rejected_actions`; invalid proposals or broken accepted-reservation invariants are `INVALID_SIMULATION`. |
| G3 | Depots ordered [west,east]; car i at depots[(i−1) mod 2]. For Ojai share s in [0,1], car i is Ojai iff ceil(i·s)−ceil((i−1)·s)=1. At 50%, odd cars are Ojai. Nearest-feasible ties use lowest stable vehicle index; preparation uses array order. |
| G5 | Same-minute request order uses `src/core/keyed.js` with `(seed,'n2-same-minute-order',source-kind literal,integer ordinals)`. Never use request ID strings. Parts are safe integers/fixed literals without `|`; this channel is unique. |
| R2 | Required background boarding-within-target guardrail, max harm 0.02. Event gains cannot offset it. |
| R1 | Forecast preparation maintains replenished target `min(staging capacity,sum of visible counts)`; it is not a depletable budget. |
| R4 | Forecast arm can commit up to A+S vehicles; this asymmetry is part of the treatment. Here A and S are approach and staging capacities, distinct from the vehicle set A in rule 5a. |
| R5 | First N2 version omits `resources`; associated metrics say “not modeled”, never 0. |
| R6 | Two admission passes, before and after dispatch/preparation. At most one boarding start per berth/minute. b=0 is allowed. No admission, dispatch or preparation at H. |
| F5 | Terminal boarding status is exactly BOARDED, ABANDONED, CENSORED_ASSIGNED or CENSORED_UNASSIGNED. Preserve historical max-wait value under label “historical max arrival-or-horizon age”. |
| G6 | Events and background use keyed draws through `src/core/keyed.js`, distinct channels, and a registered cross-seed independence check. Legacy generation is unchanged. |

## 3. Frozen mechanism, inputs and identities

### 3.1 Region and allowed configuration

Proposed registry entry: `nv-las-vegas-demo`, graph `nv-las-vegas-schematic-1.0.0`, reference schema `region-package-1.0.0`. Nodes in stable order are west (0,4000), north (4000,8000), central (4000,4000), east (8000,4000), hub (4000,0), in local meters. Undirected edges are west–central, north–central, central–east, central–hub, east–hub. Edge distance is Euclidean meters / 1000; paths are shortest declared graph paths. Thus the first four edges are 4 km and east–hub is sqrt(32) km. Unknown/disconnected paths fail, never substitute a straight line. Route tie-breaking is stable node-ID order as in the existing region helper. Depots are west and east, in that order.

Only the four ordinary nodes are background origins/destinations and event destinations. The hub is event-only pickup and never a drop-off. Initial cars are depot-only under G3; no uncounted initial hub supply. Provenance separately names synthetic geometry, demand, walking, dwell, access, vehicle and service assumptions; records units, source ID/date, transformation and unavailable measurements. `America/Los_Angeles` is display metadata; elapsed integer minutes have no date/DST computation.

Whitelist: Vegas + events + curb + existing fixed-capacity charging/readiness. Omit `resources`; disallow `airport`, `launch`, `site_power_profile`, Street coupling and foreign region packages. S1 freezes the exact charging/readiness settings and policy; no dynamic power/port observation or outage is implied. Mandatory depot work remains software when scheduled, cleaning, charge-to-target and upload. Queue, boarding and staging idleness add no auxiliary draw in this slice. That omission is not a statement about real standby/HVAC energy.

Bounds: 1–120 cars; two fixed depots; `0<I≤H≤1440`; at most 1,000 potential event parties; at most two event IDs; integer spread/walk/release/forecast times 0–1440; conversion [0,1]; installed berths 1–8; approach capacity 1–24; staging capacity 0–24; additional dwell 0–30; target T 1–60. Existing profile bounds and operational validation remain. All request and publication IDs are bounded generated identifiers, not arbitrary user text. S1 may register the explicit control-only approach=40 exception; ordinary N2 inputs do not gain it implicitly.

Condition version `curb-condition-1.0.0`: at most 48 contiguous nonoverlapping half-open segments exactly cover [0,H), with unique usable berth IDs from inventory. Zero usable berths is valid. Unknown keys/versions/IDs, duplicates, gaps, overlaps, mixed region references and nonfinite values reject before execution. Approach/staging capacity is fixed. A closed occupied berth drains existing boarding; closure never cancels or shortens its b. No new admission until it is usable and free.

### 3.2 Demand and keyed order

Each event has a pinned event ordinal (event-1→0, event-2→1), party ordinals 1..count, release minute L, integer spread W, walk w and conversion p. A potential party converts iff its conversion draw <p. Ready/creation minute is `L+floor(spread_draw·(W+1))+w`; converted parties with creation ≥I remain in exclusion reconciliation. Event destination is uniform over [west,north,central,east]. No per-party dwell draw exists. Forecasts are separate exogenous inputs, not computed from realized demand.

Background generation preserves the declared synthetic rate/weather/time-of-day formula but uses a keyed count draw at each minute and keyed origin/destination draws by **background ordinal**, unaffected by event insertion or filtering. Rate r produces floor(r) plus one iff count_draw < fractional(r). Origin is uniform over the four ordinary nodes; a distinct destination uses weight `1/(2+route_km)^1.5` in stable node order. S1 must freeze whether time-of-day modulation is disabled; no evolving UI default may choose it.

Use `u32(...parts)/4294967296` for the following channels. `u64` is used only for ordering, without conversion through an imprecise Number.

| Draw | Key after seed |
|---|---|
| Event conversion | `'n2-event-conversion','event',eventOrdinal,partyOrdinal` |
| Event spread | `'n2-event-spread','event',eventOrdinal,partyOrdinal` |
| Event destination | `'n2-event-destination','event',eventOrdinal,partyOrdinal` |
| Background count | `'n2-background-count','background',minute` |
| Background origin | `'n2-background-origin','background',backgroundOrdinal` |
| Background destination | `'n2-background-destination','background',backgroundOrdinal` |
| Same-minute event order | `'n2-same-minute-order','event',eventOrdinal,partyOrdinal` |
| Same-minute background order | `'n2-same-minute-order','background',backgroundOrdinal` |

Request order is `(created_minute,u64 tie draw,source-kind rank,integer ordinals)`, ascending; collision fallback rank is background=0, event=1. Only an actual 64-bit tie uses that fallback. Request ID spelling never participates. Reject duplicate identity tuples, unsafe ordinals and literal parts containing `|` before calling the existing helper (the helper itself permits strings). Whole-tape pairing uses stable immutable identity order; display IDs remain compared exogenous fields. An ID-renaming fixture must inject a fixed tape so it does not regenerate demand.

### 3.3 Pair input versus outcome

Both arms share full region/package/source identities; complete resolved config except `events.policy`; seed; condition/publication tapes; initial fleet, placement and profiles; and every potential-party/background exogenous row. Compare `id`, `source_kind`, ordinal tuple, `event_id`, `release_minute`, `walk_minutes`, `created_minute`, `pickup_node`, `dropoff_node`, `trip_distance_km`, `trip_route_id`, converted flag and exclusion reason. An exogenous field is set by the tape builder and never written by the simulator. Background release/walk/event fields are explicitly null/not applicable.

Assigned car/type, assignment/arrival/boarding/departure/completion times, realized boarding duration, queues, energy, reservations and terminal statuses are outcomes. Never pair-compare, copy or precompute them across arms. Whole-config equality establishes common profiles and additional dwell. At boarding start, `b=ceil(profile[assigned_type].boarding_minutes)+(hub?curb.additional_dwell_min:0)`. Until then `boarding_min=null`. Hub berth interval is [start,start+b), including a retained zero-length interval when b=0. Each arm independently validates b, timestamps and ownership. Airport `pickup_dwell_min` and legacy v1 pair checks stay unchanged.

## 4. Pinned lifecycle and policies

For t=0..H, execute this sequence. A departure/arrival generated by settling zero-duration work is processed in that same deterministic boundary; finite transition bounds prevent loops. New positive-duration work started at H receives no interval execution or energy.

1. **Settle elapsed work:** complete work from [t−1,t), travel arrivals, boarding ends, trip/depot completions and slot releases. Record arrivals at H. Post-trip required-visit trigger remains the existing rule, gated by t<H. A previously started boarding may depart at H; a trip completed at H counts completed.
2. **Current exogenous view:** apply usable berths for [t,t+1) when t<H. Expose publications with `published≤t<expires`; preparation additionally requires `t≥wave−lead`. At H record terminal state only; there is no [H,H+1) condition or energy interval.
3. **Demand and expiry:** introduce eligible requests with creation t (<I). Expire still-unassigned requests if `t−created≥ceil(patience)`, including at H, before dispatch/classification. Record `unserved_minute=created+ceil(patience)`. Assigned requests never abandon in this version.
4. **Admission pass A, t<H:** process arrived approach owners by `(arrival_minute,reservation_seq,stable vehicle ID)`. For each, select the lowest-index usable, free berth with no boarding start yet at t. Transfer approach→berth atomically, record boarding and b, and mark this berth used-for-start at t. If b=0, depart/release immediately but keep that mark through pass B. Unusable/full berths cause waiting, not a rejected action.
5. **Dispatch, t<H, one whole pass:** snapshot the requests waiting at this step's start, in §3.2 order. Each gets exactly one outcome for [t,t+1), at its own turn. For a hub request check curb first: if inbound+queued≥approach capacity, emit APPROACH_FULL; evaluate feasibility only for descriptive `idle_feasible_vehicle`; reserve nothing, consume no car, and continue. Otherwise, if no available car remains, emit NO_AVAILABLE_VEHICLE. Otherwise use the existing energy screen below, choose the nearest passing car (lowest stable index ties), reserve approach for hub assignment, emit ASSIGNED and start pickup. No passing car means ENERGY_INFEASIBLE and continued waiting. Continue classifying after cars run out: full hub remains APPROACH_FULL, other requests NO_AVAILABLE_VEHICLE. A zero-distance hub assignment joins the arrived queue for pass B; it never bypasses pass A's earlier arrivals.

   **Energy screen:** for currently available set A, compute `maximumRange=max(0,(soc−reserve)/(profile_kWh_per_km·weatherEnergy))`. If `trip_km+nearest_return_km>maximumRange+1e−8`, the request fails for all cars. Otherwise v passes iff `soc(v)+1e−8≥(pickup_km+trip_km+nearest_return_km)·profile_kWh_per_km·weatherEnergy+reserve(v)`. Recompute the range bound after each assignment. Distances, reserve and existing tolerances retain their source meaning; no curb outcome changes energy arithmetic.

5a. **Energy-recovery fallback, after the pass, before preparation:** A is the final available set, including arrived staged vehicles; R is the final waiting set. Re-evaluate the same range bound over A and per-vehicle screen. Fire iff t<H, A nonempty, and at least one r in R fails for every v in A. Apply in stable vehicle order to exactly `E={v in A: v is not staged AND v fails the screen for every r in R}`. Each E vehicle enters the persistent energy-blocked set and, if below target, attempts the existing nearest-depot/reachability/load-tie visit, settling zero-distance depot travel. A vehicle passing any waiting request is not in E. If E is empty the trigger can still be true. Staged cars remain in A and its range bound, but never E. Inbound preparation/pickup, queued, boarding, passenger-trip and at-depot cars are not available and are exempt.

   Fallback reads energy-screen results, not reason codes. An APPROACH_FULL request may trigger 5a if independently infeasible for all final A; refusal alone cannot. Since refusal can change later assignments, it can indirectly change final A and fallback actions. Report triggering request IDs, their dispatch reason and final-screen result, and separately count fallback block events/started visits in minutes with ≥1 refusal. Do not claim an absolute absence of indirect effects. Refusal-free differential testing compares the same final state against legacy `waiting.length` behavior, subtracting staged cars. Preserve all non-N2 replay bytes.

6. **Forecast preparation, after 5a, t<H:** desired stock is `min(S,sum(count for currently visible publications with opened preparation windows))`. Inbound and arrived staged cars both count, regardless of which publication caused them. Walk available cars in array order; skip staged cars and cars already at the hub. Reserve the lowest free staging slot **before** repositioning. Eligibility requires energy for reposition plus, after arrival, `max over declared destinations d [hub→d + d→nearest depot]` plus reserve, with the existing 1e−8 tolerance. Do not stage using only hub→depot return. Record all supporting publication IDs, visible counts and target at each preparation start. A target is replenished after assignment; cumulative starts can exceed forecast count. Expiry stops additions and removes nothing. Cars remain staged until assigned or H; no recall/teleport/5a depot escape. Hub assignment exchanges staging→approach atomically; non-hub assignment releases staging at pickup travel start.
7. **Admission pass B, t<H:** same FIFO and berth selection as pass A, using the same per-berth used-for-start marks. This allows an idle berth to admit a newly assigned zero-distance car at t but never a second start on a berth at t.
8. **Depot allocation, accounting and interval:** under the existing rules start eligible depot work only if t<H, allocate fixed-capacity charging, validate/record state, and execute [t,t+1). At H perform final validation and classification only, retaining all open reservations and unfinished work. No new dispatch outcome at H. Non-hub arrival settlement has no berth admission and retains its existing boundary behavior, specified in §5.1.

Approach is conservative reservation-based admission, not a road spillback model. Reservations held in transit can leave installed berths idle and block an already-staged car. Arrival-order admission permits an arrived later reservation before an earlier still-inbound reservation. Forecast preparation can commit approach capacity A plus staging S; this treatment asymmetry is disclosed, not silently normalized away.

## 5. Transition and ownership tables

Records named here are defined in §7. Guards apply before effects; any missing required owner/record, duplicate owner, unknown resource or invalid transition makes the run INVALID_SIMULATION. The independent checker reports INVALID_EXPERIMENT if its records disagree with the run. No invalid result enters statistics.

### 5.1 Requests

| From × event | Guard | To / effect | Required record | Invariant |
|---|---|---|---|---|
| Potential party × conversion/creation | Immutable tape; converted and creation<I | WAITING at creation | Potential-party reconciliation; request row | One eligible request per converted eligible party; excluded parties never enter N |
| WAITING × expiry | Unassigned; age≥ceil(patience), t≤H | ABANDONED; unserved_minute=t | REQUEST_TRANSITION | Assignment, arrival, boarding, departure, completion all null |
| WAITING × curb refusal | Hub; approach full; t<H | WAITING | DISPATCH_RUN(APPROACH_FULL, flag segments) | No reservation, vehicle consumption or rejected action |
| WAITING × no vehicle/energy failure | Not curb-refused; t<H | WAITING | DISPATCH_RUN(NO_AVAILABLE_VEHICLE or ENERGY_INFEASIBLE) | One reason per request/minute, no hidden early exit |
| WAITING × assignment | Energy passes; hub needs free approach | PICKUP_TRAVEL; fix car/type and assignment | REQUEST_TRANSITION; ASSIGNED outcome; approach interval if hub | One car per request; one request per car; staging transfer atomic |
| PICKUP_TRAVEL × arrival, hub | Travel finishes at t≤H | APPROACH_QUEUED; picked_up=arrived_pickup_zone=t | REQUEST_TRANSITION | Existing approach owner retained; no implicit boarding |
| PICKUP_TRAVEL × arrival, non-hub | Travel finishes at t≤H | BOARDING immediately under existing arrival settlement | REQUEST_TRANSITION | No berth reservation/admission applies; boarding at H consumes no interval |
| APPROACH_QUEUED × berth admission | Arrived, t<H, FIFO, usable/free berth, unused start | BOARDING; fix b/start | REQUEST_TRANSITION; approach end; berth start | Exactly one berth interval per hub boarding start |
| BOARDING × b elapsed | t=start+b≤H | PASSENGER_TRIP; departed=t | REQUEST_TRANSITION; berth end if hub | b fixed at start; zero interval retained; closure cannot alter it |
| PASSENGER_TRIP × arrival | Travel ends t≤H | COMPLETED; completed=t | REQUEST_TRANSITION; energy leg | Completion at H counts; car clears request before required visit |
| Any nonterminal × H | Settle and expire first | Terminal snapshot; no artificial completion | Request row / terminal summary | Separate lifecycle state, target partition and boarding status |

The no-admission-at-H rule is a **berth admission** rule, as in v1 line95. Existing non-hub arrival settlement starts its unconstrained boarding at H (`bay-operations.js:159–161`), records BOARDED and consumes no [H,H+1) interval; hub arrival at H remains CENSORED_ASSIGNED. This explicit distinction preserves the existing non-hub lifecycle rather than inventing an unmodeled resource. `picked_up_minute` remains arrival, never renamed to mean boarding.

### 5.2 Vehicles, resources and forecast state

| From × event | Guard | Effect / next state | Required record | Invariant |
|---|---|---|---|---|
| AVAILABLE × preparation | Forecast target deficit; G1 energy; free staging | PREPARATION_INBOUND; staging acquired | PREPARATION_START + staging interval + energy leg | Staging counts inbound; target visible, not future realization |
| PREPARATION_INBOUND × arrival | Reposition complete | STAGED_AVAILABLE at hub | VEHICLE_TRANSITION | Same staging ownership, no double acquisition |
| AVAILABLE/STAGED_AVAILABLE × hub assignment | Dispatch passes; free approach | PICKUP_TRAVEL or APPROACH_QUEUED | Atomic staging→approach transfer when staged | Never concurrently hold staging and approach |
| AVAILABLE/STAGED_AVAILABLE × non-hub assignment | Dispatch passes | PICKUP_TRAVEL | Staging end NONHUB_TRAVEL_STARTED if held | Released at travel start, not eventual arrival |
| PICKUP_TRAVEL × hub arrival | Reservation exists | APPROACH_QUEUED | Arrival transition | Inbound→queued changes subcount, not total holding |
| APPROACH_QUEUED × admission | Pass A/B guards | BOARDING | Atomic approach→berth transfer | End BERTH_ADMITTED; one start per berth/minute |
| BOARDING × completion | b elapsed | PASSENGER_TRIP; free berth | Berth end BOARDING_COMPLETED | Zero-length holding allowed; start-use mark remains until next minute |
| PASSENGER_TRIP × completion | Travel elapsed | AVAILABLE or REQUIRED_DEPOT_VISIT | Request completion; visit/energy records | Existing trips/reserve trigger retained only at t<H |
| AVAILABLE × 5a | In E; below target and reachable depot | DEPOT_INBOUND / queued service | FALLBACK_PASS; existing visit; energy leg | Staged cars cannot take this transition |
| AVAILABLE × 5a unreachable / at target | In E, visit cannot start or not below target | Remains available, persistently counted blocked | FALLBACK_PASS with attempted/started distinction | No fabricated visit; blocked is cumulative unique-car count |
| DEPOT_INBOUND / service × elapsed transition | Existing stage/worker/port/energy requirements | Serial required work → ready → AVAILABLE | Existing visit/task/stage records + energy | Mandatory work cannot disappear; no incomplete release |
| Free usable berth × closure | Condition tape boundary | Free unusable berth | Condition tape / derived boundary | No new boarding |
| Occupied berth × closure/reopen | Condition tape boundary | Occupied draining / occupied usable | Tape + unchanged interval | Occupied counts against installed capacity, not usable capacity |
| Staging × forecast expiry | t=exclusive expiry | Target may fall; holdings unchanged | Forecast tape; terminal/interval records | Expiry cannot release or recall a car |
| Any holding × H | Still owned after settling | Remains open | End fields null, end_reason OPEN_AT_H | No synthetic release at H |

At every ordered transition: one holder per resource; each car occupies at most one of staging/approach/berth; each request at most one assigned car; inbound+queued≤approach; inbound+arrived staged≤staging; occupied≤installed berths. Atomic transfers close the old interval and open the new one at one transfer sequence boundary. A full resource is ordinary waiting; a proposal to a nonexistent/unusable resource or duplicate owner is invalid even if it grants no capacity.

## 6. Metric dictionary and decision contract

This is the complete N2 reporting contract. No UI-only score or inferred measurement is permitted. Each metric below has an exact population and empty-population rule. Counts/sums over a **modeled, empty** population are 0; that convention never makes an omitted mechanism 0. Null is serialized explicitly and displayed “Not available” (or “Not modeled” for an omitted mechanism). Missing, nonfinite or invalid required values block comparison before the shared instrument, which must never receive null as 0.

Version abbreviations: **P**=`pickup-metrics-1.0.0` (new); **B2**=`bay-systems-metrics-2.0.0` (N2 definitions, retaining stated legacy formulas); **D1**=`depot-readiness-metrics-1.0.0` (unchanged optional existing readiness). A dictionary family expands to every listed key; its stated population/null rule applies to each member. No unlisted N2 aggregate may be rendered or silently added to compact exports without dictionary/version review.

Let Q be all eligible requests with creation<I, N=|Q|, Qbg be those with source_kind=background, Qe the requests of event e, and Qevents their union. Completed means completion time≤H. Boarded means boarding start exists. For any cohort C, define W=boarded with start−creation≤T, L=boarded with delay>T, M=unboarded and (abandoned OR creation+T≤H), Pn=unboarded, not abandoned and creation+T>H. Exactly W+L+M+Pn=|C|. Terminal boarding statuses independently partition C: BOARDED (including completed trips), ABANDONED, CENSORED_ASSIGNED, CENSORED_UNASSIGNED. “Pending boarding outcome” is Pn; “Waiting for assignment” is lifecycle WAITING, not Pn.

### 6.1 Primary and required guardrails

Limits below are the owner-adopted design limits, to be reaffirmed before evaluation in S1. Harm is the mean across paired **seed-level** differences, candidate−baseline for lower-is-better and baseline−candidate for higher-is-better. Strict harm>limit is REGRESSED; equality is within. Never offset one guardrail with another or a primary gain.

| Key / version / origin | Exact value and population | Null / unit | Role, direction, limit and request equivalent |
|---|---|---|---|
| `completion_fraction` / B2 / legacy criterion, N2 estimand | Number of Q completed by H / N | Null if N=0; fraction | Primary higher-is-better; practical margin 0.02. At illustrative N≈116, 2.32 requests/seed; freeze actual N-specific equivalents. |
| `max_request_wait_min` / B2 / legacy formula | max over Q of `(picked_up_minute ?? H)−created_minute` | Null if N=0; min | Guardrail lower-is-better, 5 min. Request equivalent not applicable: a maximum, not a request count. Label **historical max arrival-or-horizon age**. |
| `unfinished_visits` / B2 / legacy | Count of all started depot visits with completion null at H; denominator 1 run | 0 if no visits; visits | Guardrail lower-is-better, 0 visits. Request equivalent not applicable. |
| `terminal_energy_kwh` / B2 / legacy | Sum of battery energy at H over all starting cars; denominator 1 run | Required finite, fleet nonempty; kWh | Guardrail higher-is-better, 5 kWh. Request equivalent not applicable. |
| `rejected_actions` / B2 / legacy numeric population, corrected text | Count of failed charging-power proposals plus candidate-port rejections where planner saw an eligible port but truth rejected it; denominator 1 run | 0 if modeled population has no rejection; actions | Guardrail lower-is-better, 0. With resources omitted, the candidate-port component is absent and contributes no records; this does not report omitted port metrics as zero. Curb refusals never count. |
| `boarding_within_target_fraction` / P / new | W(Q)/N; late, missed and pending stay in denominator | Null if N=0; fraction | Guardrail higher-is-better, 0.02; ≈2.32 requests at N≈116. |
| `background_completion_fraction` / P / new | Completed(Qbg)/|Qbg| | Null if |Qbg|=0; fraction | Guardrail higher-is-better, 0.02; ≈1.20 requests at |Qbg|≈60. |
| `background_boarding_within_target_fraction` / P / new | W(Qbg)/|Qbg|; full background population | Null if |Qbg|=0; fraction | Guardrail higher-is-better, 0.02; ≈1.20 background requests at 60. Required R2 protection. |
| `approach_refused_request_fraction` / P / new | Distinct q in Qevents with ≥1 APPROACH_FULL interval / N | Null if N=0, including if hub cohort also empty; if N>0 and no hub requests, 0; fraction | Guardrail lower-is-better, +0.02; ≈2.32 requests at N≈116, 1.76 at N=88. Ceiling |Qevents|/N. |

There are **eight guardrails**: four historical, all-request boarding, background completion, background boarding and approach refusal. The same integer loss can have a different fraction in different seeds; “2.32 requests” is an explanatory equivalent, not rounding permission or a replacement decision rule. For one seed at N=116, two extra refused requests give 2/116<0.02; three give 3/116>0.02. Freeze each seed/cell denominator and equivalent before reporting, with the applicable aggregate rule.

For every registered cell using the refusal guardrail, tuning-seed reactive headroom must be at least 0.02 below its ceiling. The S1 check must state its aggregation and pass rule before inspection. If it fails, the owner registers a minutes-based limit or descriptive status, with rationale, **before evaluation**; this document does not preselect that alternative. Exposure is not delay: a refused request might have no idle feasible car, and an eventual abandonment can follow refusal.

Historical maximum detail per arm/seed stores attaining request ID, terminal boarding status and lifecycle state; ties are earliest creation then stable ID. After abandonment, H−creation is an age penalty convention, not observed waiting. Assigned/not-arrived ages are right-censored arrival waits; unassigned-at-H ages are unresolved elapsed ages. V1 key, formula and 5-minute limit stay unchanged.

### 6.2 New service, curb and policy diagnostics (all descriptive)

| Key / version | Exact numerator / denominator / population | Null rule; unit |
|---|---|---|
| `cohorts.{all,background,event_1,event_2,events}.requests` / P | Count of C / 1 cohort | 0 if empty; requests |
| `cohorts.C.{within_target,late,missed,pending}` / P | W,L,M,Pn counts in C / 1 cohort | Each 0 if empty; requests |
| `cohorts.C.{completed,abandoned,waiting,pickup_travel,approach_queued,boarding,passenger_trip}` / P | Exact terminal lifecycle counts in C / 1 cohort | 0 if empty; requests; sum=|C| |
| `cohorts.C.{boarded,abandoned_status,censored_assigned,censored_unassigned}` / P | Four terminal boarding-status counts in C / 1 cohort | 0 if empty; requests; sum=|C| |
| `cohorts.C.completion_fraction` / P | Completed(C)/|C| | Null if empty; fraction. All/background aliases equal required maps above. |
| `cohorts.C.boarding_within_target_fraction` / P | W(C)/|C| | Null if empty; fraction. All/background aliases equal guardrails; event-only values descriptive. |
| `potential_parties.{event_1,event_2}.{total,converted_eligible,converted_post_intake,nonconverted}` / P | Count of each disjoint conversion/intake category; denominator 1 event | 0 if modeled event has no parties; parties; latter three sum to total |
| `boarding_wait_min_by_request` / P | Boarded: start−creation, denominator 1 request; accompanying status counts mandatory | Null for every unboarded request; min. Do not pool censoring or abandonment into this distribution. |
| `censored_assigned_age_min_by_request` / P | H−creation for CENSORED_ASSIGNED / 1 request | Null otherwise; min; right-censor bound ≥age, not predicted final wait |
| `censored_unassigned_age_min_by_request` / P | H−creation for CENSORED_UNASSIGNED / 1 request | Null otherwise; min; unresolved age, not a lower bound on eventual observed boarding wait |
| `abandonment_wait_min_by_request` / P | unserved−creation for ABANDONED / 1 request | Null otherwise; min; separate departure event, never pooled into boarding waits |
| `walking_min_by_request` / P | Declared walk for eligible event request / 1 request | Null for background/not applicable; min; not part of boarding service clock |
| `release_to_boarding_min_by_request` / P | Boarding start−release for boarded event requests / 1 request | Null without release or boarding; min |
| `boarding_min_by_request` / P | Realized ceil-profile + hub dwell / 1 boarded request | Null before boarding; min; 0 allowed |
| `approach_refused_requests` / P | Distinct eligible hub requests with any APPROACH_FULL / 1 run | 0 if none; requests |
| `approach_refused_request_min` / P | Sum lengths of APPROACH_FULL runs in [0,H) / 1 run | 0 if none; request-min |
| `approach_refused_idle_feasible_request_min` / P | Refusal minutes with idle_feasible_vehicle=true / 1 run | 0 if none; request-min; descriptive only |
| `dispatch_outcome_request_min.{ASSIGNED,APPROACH_FULL,NO_AVAILABLE_VEHICLE,ENERGY_INFEASIBLE}` / P | Count start-of-step-5 waiters with each outcome over t<H / 1 run | 0 if none; request-min; sum equals all step-5 waiting request-minutes |
| `abandoned_after_approach_refusal` / P | Count abandoned Qevents with at least one earlier refusal / 1 run | 0 if none; requests; temporal association, not causal attribution |
| `approach_queue_min` / P | Sum over hub assignments of `min(boarding_start??H,H)−arrival`, for arrivals≤H / 1 run | 0 if no arrivals; vehicle-min; excludes inbound travel, includes unfinished queue |
| `approach_inbound_min` / P | Sum `min(arrival??H,H)−assigned` over hub assignments / 1 run | 0 if none; vehicle-min |
| `berth_occupied_min` / P | Sum berth interval intersections with [0,H) / 1 run | 0 if none; berth-min; includes draining closed occupancy |
| `berth_usable_min` / P | Sum usable berth counts across [0,H) / 1 run | 0 if all closed; berth-min |
| `berth_idle_usable_min` / P | Usable and physically unoccupied berth-minutes in [0,H) / 1 run | 0 if none; berth-min; b=0 used-start minute can still be idle, not available for a second start |
| `terminal.{approach_inbound,approach_queued,berth_occupied,staging_inbound,staging_arrived}` / P | Count respective open ownership/state at H / 1 run | 0 if none; vehicles; exact ID inventories retained |
| `preparation_starts` / P | Count PREPARATION_START / 1 run | 0 if none; trips; not bounded by predicted count |
| `preparation_distance_km`, `preparation_energy_kwh` / P | Sum executed preparation-leg distance/energy through H, including partial legs / 1 run | 0 if no preparation; km / kWh respectively |
| `preparation_starts_by_publication` / P | Count starts listing publication p in supporting IDs / 1 publication | 0 if none; trips; multi-publication attribution may overlap, never sum as exclusive totals |
| `desired_staging_stock_by_minute` / P | min(S,visible count sum) at each t<H / 1 minute | 0 if no active publication; vehicles; single-run detail only |
| `terminal_unused_staged_vehicles` / P | Staging inbound+arrived owners at H / 1 run | 0 if none; vehicles, not evidence that future service is impossible |
| `fallback_blocks_in_refusal_minutes`, `fallback_visits_in_refusal_minutes` / P | Number of E memberships / actually started 5a visits at t with ≥1 refusal, respectively / 1 run | 0 if none; block events / visits; distinguish from unique cumulative blocked-car count |

### 6.3 Retained base and depot diagnostics (descriptive unless aliased above)

These formulas remain unchanged; N2 newly includes approach-queued requests in `in_progress_trips`. Each B2 row is a legacy formula under the explicit N2 population. Ratios/means never use a hidden successful-only population.

| Key / version | Exact value / population and denominator | Null rule; unit |
|---|---|---|
| `fleet_size`, `depot_count` / B2 | Frozen initial counts / 1 run | Required positive; cars / depots |
| `total_requests`, `completed_trips`, `unserved_requests`, `pending_requests`, `in_progress_trips` / B2 | N; completed; abandoned; waiting; pickup+approach-queued+boarding+passenger-trip counts / 1 run | 0 if no requests; requests; partition sums N |
| `trips_per_vehicle` / B2 | Completed trips / starting fleet size | Fleet cannot be empty; trips/car |
| `avg_wait_min_completed` / B2 | Sum(arrival−creation) over completed requests / completed count | Null if no completed requests; min; **arrival-based completed-request wait** |
| `avg_trip_min_completed` / B2 | Sum(completion−arrival) over completed requests / completed count | Null if no completed requests; min; **arrival-to-completion**, includes curb queue |
| `avg_depot_onsite_min`, `avg_depot_turnaround_min`, `avg_active_service_min` / B2 | Completed-visit sums of completion−arrival, completion−start, active_service_min respectively / completed visits | Null if none; min |
| `completed_visits`, `censored_visits` / B2 | Completed / unfinished started visits at H / 1 run | 0 if none; visits; censored alias=unfinished_visits |
| `max_queue` / B2 | Maximum single depot-stage queued-car count over observed boundaries 0..H / 1 run | 0 if no queues; cars |
| `initial_energy_kwh`, `final_energy_kwh`, `energy_delivered_kwh`, `energy_consumed_kwh` / B2 | Fleet sums of initial battery, terminal battery, delivered battery energy, executed travel energy / 1 run | Required finite; sums 0 only when actually zero; kWh; final aliases terminal_energy |
| `energy_balance_error_kwh` / B2 | Initial + delivered − consumed − final / 1 run | Required finite; kWh; validity tolerance abs≤1e−6, not a policy guardrail |
| `distance_km` / B2 | Sum executed distance of all travel purposes, including partial legs / 1 run | 0 if no travel; km |
| `energy_blocked_vehicle_count` / B2 | Cardinality of persistent blocked-car set (5a plus unchanged reachability failures) / 1 run | 0 if none; cars; not refusal count and never decremented on recovery |
| `service_breakdown.stage.{completed_count,avg_active_min,avg_queue_min}` / B2 | Stage rows in completed visits: count; sum active/count; sum(start−queued)/count | Count 0, means null if none; tasks / min / min; stage in software,cleaning,charging,upload |
| `by_vehicle_type.{vehicle_count,completed_trips,trips_per_vehicle,energy_consumed_kwh,energy_delivered_kwh,distance_km}` / B2 | Same fleet measures restricted to assigned vehicle type; trips/count for mean | Empty type: counts/sums 0, trips/vehicle null; units as corresponding fleet keys |
| `by_place.{total_requests,completed_trips,unserved_requests,pending_requests,in_progress_trips}` / B2 | Same lifecycle partition restricted by pickup node / 1 place | 0 if no requests at place; requests |
| `charging.{visits,unfinished_visits}` / B2 | All started / unfinished depot visits / 1 run | 0 if none; visits |
| `charging.{connected_vehicle_min,zero_power_vehicle_min,aged_job_minutes}` / B2 | [0,H) charging-state car-min; subset with delivered power=0; queued/charging car-min with age≥frozen starvation threshold | 0 if none; vehicle-min |
| `charging.{queue_observed_min,active_observed_min}` / B2 | Sum over charging-stage rows of (start??H)−queued; sum active minutes, including unfinished rows / 1 run | 0 if no charging rows; vehicle-min |
| `charging.unfinished_energy_kwh` / B2 | Sum max(0,target−soc) for cars with unfinished visits at H / 1 run | 0 if none; kWh |
| `charging.{ready_by_deadline,missed_deadline,deadline_pending}` / B2 | Visits completed≤declared deadline; completed late or unfinished with deadline≤H; all remaining started visits / 1 run | 0 if no visits; visits; deadline defined by frozen charging version/config |
| `readiness.{required_tasks,completed_tasks,queued_tasks,active_tasks,not_reached_tasks,unfinished_tasks}` / D1 | Counts of required tasks in all started visits, by exact state / 1 run | 0 if enabled and none; null/not modeled if readiness omitted; tasks |
| `readiness.oldest_unfinished_task_age_min`, `readiness.max_task_queue_min` / D1 | Max H−task creation over unfinished tasks; max accumulated task queue time over observed queued tasks | Null when respective population empty or readiness omitted; min |
| `readiness.{queue_observed_min,active_observed_min,onsite_observed_min}` / D1 | Required-task queue/active sums; visit onsite sum (completion??H)−arrival for arrived visits | 0 when enabled and none; null if omitted; task-min for first two, vehicle-min for onsite |
| `readiness.blocked_minutes.reason` / D1 | Queued-task minutes under exclusive recorded existing blocker reason / 1 run | 0 when enabled and none; null if omitted; task-min |
| `readiness.{completed_visit_mean_onsite_min,completed_visit_mean_active_min,completed_visit_mean_queue_min}` / D1 | Completed visits' onsite/active/onsite-minus-active sums / completed visits | Null if no completed visits or omitted; min |
| `readiness.{ready_by_deadline,deadline_visits,unfinished_visits,inbound_visits}` / D1 | Completed visits by readiness deadline H; all started visits; unfinished visits; visits not yet arrived / 1 run | 0 when enabled and none; null if omitted; visits |
| `resources.*` (no version active) | No observation/truth-port/recovery population modeled in first N2 version | Unavailable, display “not modeled”; never zero, excluded from required metric map |

Request `trip_minutes` remains b+passenger-drive duration, excluding curb queue; `avg_trip_min_completed` remains completion−arrival and therefore includes it. Do not assert they are equal in N2 (G4). Completed-only averages disclose the missing unfinished population. Optional readiness checks remain separate deterministic checks, not additional silent statistical guardrails.

### 6.4 Paired statistics and interpretation

Every seed contributes one paired run delta. Preserve shared bootstrap percentile interval semantics and proposed 2,000 resamples; S1 freezes exact options and digest key. With margin m=0.02: IMPROVED iff ci_low>m; REGRESSED iff ci_high<−m; UNCHANGED iff −m≤ci_low and ci_high≤m; otherwise INCONCLUSIVE. One seed is descriptive. Required empty cohorts, invalid records or incompatible identities yield no statistical chart or accepted recommendation.

HOLD follows any regressed required guardrail or regressed primary; IMPROVED with all required guardrails evaluable/within gives ADVANCE_TO_NEXT_TEST; INCONCLUSIVE maps to RUN_MORE_EXPERIMENTS; otherwise NO_RECOMMENDATION. These are teaching experiment recommendations, never deployment permission. S1 must register whether any extension is allowed; the recommendation string alone does not authorize more seeds.

N2 retains completion as the decision criterion **under a new cohort and drain horizon**, not an identical N1 estimand. Never use N1 as an N2 baseline/trend. Show reactive headroom and detection limits beside unchanged/inconclusive results. “No recommendation” does not mean every service measure is unchanged. Report all guardrails and populations separately.

## 7. Required accounting records, validation and retention

Accounting is required in every N2 single run, both arms of every seed, replay and control. `capture:false` suppresses frames and narrative only. Canonical accounting bytes are identical across capture modes; narrative curb/request/blocker text is rendered from records. Legacy non-N2 output remains byte-identical.

Proposed version: `n2-accounting-records-1.0.0`. A globally increasing safe-integer `seq` establishes transition order, including within-minute zero-length transfers. Final request rows reference their transition sequences. Stable resource order is approach-slot index, berth index, staging-slot index; sequence allocation follows §4, not wall time or rendering.

| Kind | Required fields and meaning |
|---|---|
| `REQUEST` plus immutable potential-party reconciliation | Stable IDs/ordinal tuple and all §3.3 exogenous fields; status; vehicle_id/type; nullable assigned_minute, picked_up_minute, arrived_pickup_zone_minute, boarding_started_minute, boarding_min, departed_minute, completed_minute, unserved_minute; pickup/passenger route/distance/duration outcomes; references to transition seq. No fabricated timestamp for an unreached stage. |
| `REQUEST_TRANSITION` / `VEHICLE_TRANSITION` | seq, minute, kind, identity, from_state, to_state, related request/vehicle/resource IDs, cause; nullable nonapplicable IDs. Contains only bounded enum data, not narrative. |
| `OWNERSHIP_INTERVAL` | resource_kind (APPROACH/STAGING/BERTH), resource_id, vehicle_id, request_id (null for staging), start_minute, start_seq, nullable end_minute/end_seq, end_reason; staging interval also references its preparation start. |
| `DISPATCH_RUN` | seq, request_id, outcome, start_minute inclusive, end_minute exclusive, first/last turn sequence; maximal consecutive run of the same outcome. ASSIGNED is exactly one minute. APPROACH_FULL has run-length encoded `(start,end,idle_feasible_vehicle)` segments so a changing flag never loses a minute. |
| `PREPARATION_START` | seq, minute, vehicle_id, staging_slot, route, supporting publication IDs/counts, desired stock, before-stock, initial SOC, required energy and chosen destination-max bound. No realized future demand. |
| `FALLBACK_PASS` | seq, minute, final A/R identity lists; triggering requests with step-5 outcome and final-screen result; E; newly blocked IDs versus repeated memberships; visit attempts/started IDs; whether this minute had a refusal. Empty E with a true trigger is representable. |
| `ENERGY_LEG` | seq, vehicle_id, purpose (PICKUP/PASSENGER/PREPARATION/DEPOT), related request/visit, start/end (nullable if unfinished), route and full distance/duration, executed intervals/distance/consumption through H, start and last-accounted SOC. Includes partial legs. |
| `ENERGY_DELIVERY` and vehicle reconciliation | seq, vehicle/visit, accounted start/end, delivered battery kWh; starting and terminal SOC, battery and reserve; no duplicate booking of stage-delivered energy. Frozen visits/stage rows remain validation inputs. |

Ownership `end_reason` is exactly `{BERTH_ADMITTED,EXCHANGED_TO_APPROACH,NONHUB_TRAVEL_STARTED,BOARDING_COMPLETED,OPEN_AT_H}`. OPEN_AT_H requires both end fields null, and all other reasons require both finite and ordered. The set **excludes DEPOT_VISIT_STARTED**. A zero-minute interval has start_minute=end_minute with start_seq<end_seq; it is not dropped. Atomic exchanges share a transfer boundary (old end_seq=new start_seq). Holdings at H stay open rather than manufacturing [start,H) closure; length through H uses min(H,end??H).

Before **every seed and both arms** enter statistics, a framework-independent checker reads only frozen tapes/config, request/accounting records and visits. It independently checks:

1. Complete potential-party and request reconciliation; unique immutable identities; chronological nullable fields; exact assignment-patience boundary; all three independent partitions (lifecycle, target, terminal boarding status).
2. Exactly one dispatch outcome per start-of-step-5 waiting request per t<H, none for expired or H requests; correct curb-first order, refusal flags and maximal-run reconstruction; exact unique/refusal-minute totals.
3. Exclusive ownership at sequence boundaries; capacities; no simultaneous staging/approach/berth; usable admission; FIFO order; one start per berth/minute; one approach interval per hub assignment and one berth interval per hub boarding start, including zero durations.
4. G1 preparation eligibility, visible publication support, replenished target, staged persistence, immutable b rule, drain-on-close and no new starts at H.
5. Completion/guardrails and all published summaries; terminal inventories; per-car energy equation initial+delivered−consumed=terminal within 1e−6 kWh, partial travel distance/energy and preserved reserve/required depot work. No fleet-level cancellation may hide a per-car imbalance.
6. Exact model/package/source/metric/record identities and replay digest. Tampering, missing records, inconsistent summaries or engine-invalid state produces INVALID_EXPERIMENT with no analysis. Internal consistency is not model validity or authentication.

Validation runs inside the proposed cancellable execution seam, including final hashing/serialization. Keep only one transient pair plus bounded checker state, then discard detailed arm records after validated scalar summaries and digests are retained. Replay the first seed's two arms and require exact canonical records, requests, visits and summaries; capture-mode equality is a separate test. Single-run download retains records; compact paired export retains no per-minute series, animation frames, narratives or ownership rows.

**Declared design caps, not measurements:** let Qmax be total potential event parties plus the sum over intake minutes of ceil(maximum frozen background rate), P the potential-party count, V fleet size. Conservatively bound accounting elements, including nested run segments and fallback entries, by `Rmax=16·Qmax+P+4·Qmax·H+12·V·(H+1)+48`. Reject Rmax>500,000 before building a tape; the implementation must prove each kind is covered by this bound and enforce an actual-element counter as defense in depth. Suggested 40-car/240-minute/80-party/20-per-hour clear setup gives Qmax=260 and Rmax=369,568; this is a worst-case allocation bound, not a predicted record count. Lower validated workload bounds are acceptable through an explicit design revision; silent overflow/truncation is not.

Also enforce 10,000,000 request-minutes and 1,500,000 comparison vehicle-minutes including two replay arms, with safe arithmetic. Serialized UTF-8 JSON caps: single run without frames ≤1 MiB (1,048,576 bytes); compact comparison ≤256 KiB (262,144 bytes). A result exceeding a cap fails export/release acceptance explicitly, never truncates accounting. Record transient arm/checker memory and accumulated summaries separately; do not claim Rmax is a heap guarantee.

## 8. Version, serialization and compatibility table

All identities below must be resolved and validated again at result consumption, not just setup import. Unsupported version combinations reject; no migration, inferred version or graph-only match.

| Identity | Proposed exact value / change | Legacy preservation |
|---|---|---|
| Bay lifecycle | `fleetlab-bay-operations-1.0.0` base plus opt-in composite extensions | Base literal and all non-N2 fields/behavior unchanged; N2 must not masquerade as base-only. |
| Region reference schema | `region-package-1.0.0` | Add a closed Vegas registry entry without changing Austin interpretation; a schema interpretation change would require a new version. |
| Region/graph | `nv-las-vegas-demo` / `nv-las-vegas-schematic-1.0.0` | Austin object, reference, provenance and serialization byte-identical. |
| Region provenance | `regional-sources-1.0.0` with new Vegas source manifest | Versioned provenance shape reused; new complete package/source digest; Austin source bytes/digests unchanged. |
| Events/policy | `event-demand-1.0.0` | Two-event reconciliation, keyed background/events, exclusive forecast expiry, G3 placement/type order and G5 order; airport-demand-1.0.0 generation, policy, inclusive expiry untouched. |
| Curb | `curb-resources-1.0.0` | New finite approach/staging/berth ownership, b rule, G1 eligibility, two admission passes and N2 5a; no legacy fallback change. |
| Curb condition | `curb-condition-1.0.0` | New bounded usable-berth tape/drain rule; no site-power profile change. |
| Pickup metrics | `pickup-metrics-1.0.0` | New populations, boarding service, refusals and statuses; no relabeling of old airport/launch arrivals as boarding. |
| Bay systems metrics | `bay-systems-metrics-2.0.0` for N2 | New definition text, N2 cohorts and new queue inclusion; every non-N2 result/export retains `bay-systems-metrics-1.0.0` and v1 dictionary bytes. |
| Accounting | `n2-accounting-records-1.0.0` | Required independent capture-invariant N2 records and digest; no new fields in legacy results. |
| Depot charging/readiness | Existing declared `depot-charging-1.0.0`, optional `depot-readiness-1.0.0` / `depot-readiness-metrics-1.0.0` | Freeze exact config; preserve current policy and mandatory-work semantics. `resources` has no N2 identity because omitted. |
| Pair format | `fleetlab-bay-paired-experiment`, `format_version:2` | Strict N2 v2 reader/adapter; retain v1 reader, exporter, replay canonical form and dictionary unchanged. |
| Setup envelope | `fleetlab-setup-v1`, new model `regional-curb` only if envelope shape unchanged | All five legacy share models, decoded configurations and URL bytes preserved. Otherwise seek separate envelope-version decision. |

Composite model order is fixed: base Bay version, enabled existing readiness then charging versions, region reference version, event version, curb version, condition version, pickup metric version, accounting version. Separately store graph/package/source digests and B2 metric identity. A composite string alone does not replace full immutable references.

Canonical N2 JSON uses the existing Bay canonical serializer's semantics (`bay-experiment-contract.js:11–22`): sorted plain-object keys; array order preserved; finite IEEE-754 shortest JSON number representation; explicit null; depth≤32; reject sparse arrays, undefined, nonfinite numbers and nonplain objects. SHA-256 is over UTF-8 canonical bytes. New graph digest covers the complete geometry object; package digest covers the complete resolved package including provenance and graph digest; source digest covers the exact provenance/source manifest; tape digests cover complete ordered immutable rows. Freeze digests in the spec. Never retrofit Austin's existing JSON-stringify-derived graph digest.

The canonical accounting digest covers `{version,model_version,metric_versions,package_digest,source_digest,seed,records,requests,visits}` with deterministic arrays and no frames, narratives or timing diagnostics. Store per-kind element counts, total count and digest for each arm of every seed. Compact v2 retains recomputed metric maps, scalar populations/terminal counts, historical-max attaining identity/status, counts/digests, validation result and exact seed. Full configs, tapes and provenance live once in the frozen spec; do not copy them into every seed. Retain replayable seeds/configs and raw machine values.

## 9. Hand-traced acceptance fixtures

These are contract fixtures, not executed N2 results. Unless explicitly overridden, travel uses the §3 graph, clear weather, traffic=1 with no time-of-day multiplier, energy-feasible cars, distinct creation minutes, patience longer than the window and `trips_between_visits=99`. Unit-state injection is a declared test seam, with the complete entering state stated; it does not create an alternative public generator. IDs in expected tuples denote the frozen identities, not lexical ordering. Ranges [a,b) count b−a minute intervals. No fixture depends on G5 unless labeled G5.

### 9.1 F1: end-of-pass recovery, and its timing counterexample

Use a **unit graph with all five declared edges exactly 4 km**, depots W/E, energy intensity .25 kWh/km, reserve 8, target 64; no staging. At t=10, one inbound owner holds the single approach slot through this window. Newly available K at E has 10.5 kWh, B at C has 12, D at W has 8.5. Requests H:hub→W, X:W→N, G:E→C were created at 7,8,9; before t=10 no supply was available. The required energies (including reserve) are:

| Request | K | B | D |
|---|---:|---:|---:|
| H | 11 | 11 | 12 |
| X | 14 | 13 | 12 |
| G | 10 | 11 | 12 |

H is APPROACH_FULL with flag true; X is ENERGY_INFEASIBLE; G assigns K (nearest). Final A={B,D}; H passes B but X fails both. Trigger=true, E={D}; D starts a zero-distance west depot visit. Exact tuple `(assigned,blocked set,started visits)=(1,{D},1)`; B remains available. Counterreadings: unchanged legacy fallback `(1,{B,D},2)`; break on refusal `(0,{K,B,D},3)`; “some non-refused request waits, then legacy fallback” `(1,{B,D},2)`; suppress all fallback in any refusal minute `(1,{},0)`.

**Timing counterexample:** at t=10 use only B at C with 12 and D at W with 10.5; H:hub→W created 8, G:C→W created 9. Full approach refuses H while B could serve it; G then takes B (needs 9; D needs 10). Final D needs 12 for H and fails. End-of-pass tuple `(1,{D},1)`; examination-time-only trigger gives `(1,{},0)`. Uncapped approach assigns H to B, then G to D, giving `(2,{},0)`. This rules out the packet's absolute claim that refusal cannot indirectly alter fallback. No request reason is rewritten after its turn.

### 9.2 F2: whole-pass curb-first classification

Inspect only [100,102), not earlier waiting history. One berth; approach=1 held by car X for eligible hub request x, created97 and assigned97, inbound until103; staging=0; patience=12. Car A first becomes available at central at100; all other cars unavailable. h1 hub-created98, b1 central→north-created99, h2 hub-created100, and b2 background-created101. Car A can serve every request at 100, takes b1, and remains busy beyond 102 (`trips_between_visits=99`; e.g. 2-minute boarding plus 4-minute trip).

| Minute / request turn | Outcome | idle_feasible_vehicle |
|---|---|---|
| 100 h1 | APPROACH_FULL | true |
| 100 b1 | ASSIGNED to A | Not applicable |
| 100 h2 | APPROACH_FULL | false |
| 101 h1 | APPROACH_FULL | false |
| 101 h2 | APPROACH_FULL | false |
| 101 b2 | NO_AVAILABLE_VEHICLE | Not applicable |

Exact window tuple `(assigned,refusal request-min,unique refused,no-vehicle request-min,energy-infeasible request-min,rejected delta)=(1,4,2,1,0,0)`; all six start-of-pass request-minutes classified. Full eligible N=5 includes the already-assigned request x and gives refusal fraction 2/5=.4. Request x is not a step-5 waiter in this window. Earlier refusal history may extend runs outside the inspected window; the table asserts exactly the window-restricted counts. The inspected fragment of h1's refusal run is [100,102), with two flag segments; h2's fragment is [100,102) false. Full-run records retain their maximal intervals beyond this inspection window.

Vehicle-first at-turn gives `(refusal minutes,unique,no-vehicle minutes)=(1,1,4)`; pre-pass snapshot gives `(2,2,3)`; after-pass attribution `(0,0,5)`. Counting attempts only omits downstream waiters; breaking prevents b1 assignment. Unique counts alone cannot distinguish snapshot from correct behavior, so minutes are mandatory. A synthetic candidate−baseline `rejected_actions=1` would cause HOLD at limit0; this fixture must add 0. Attempting an unknown berth or duplicate reservation is separately INVALID_SIMULATION, even when refused and no capacity granted.

### 9.3 F3: unequal profile dwell remains pair-compatible

Package graph; speed60; car-1 Ojai at west, profile boarding4.2; car-2 I-PACE at east, profile boarding2; enough energy; one berth, approach1, staging1, extra dwell2; H60, I30, T10. One eligible party P created20, destination central. Forecast published0, wave20, exclusive expiry50, count1, lead30. Candidate array preparation sends car-1 west→hub at0, arrival8; baseline does not prepare.

| Arm | Assignment / arrival | Boarding / departure | Staging consequence |
|---|---|---|---|
| Forecast | P→car-1 at20 /20 | b=ceil(4.2)+2=7; [20,27); depart27 | At20 car-1 exchanges staging→approach; preparation sends car-2 east→hub, arriving26. |
| Reactive | P→car-2 at20 /26 | b=ceil(2)+2=4; [26,30); depart30 | No staging. |

Expected `(compatible,baseline b,candidate b)=(true,4,7)` with both per-run checks valid. Comparing realized car/duration/start falsely rejects; precomputing b=4 into the tape fails candidate recomputation 4≠7. Omitting ceil stores6.2 and violates field equality even if integer stepping still departs27. Nearest-first preparation would send car-2 and erase the discriminator; G3 array order is essential. This also exercises replenishment, packet(e), and pass-B same-minute admission.

### 9.4 F4: accounting survives capture=false

**Owner-precedence shift of the review fixture:** H=7, I=2, T=10; one berth, approach1, staging0; speed100; b=3. r1 created0 and r2 created1 are distinct. Both cars are unavailable until minute1, then one becomes available at each depot; this is the entering-state test seam. At1 east car wins r1 (sqrt(32) km, ceil(3.394…)=4 minutes); west car remains feasible and is never sent away solely for refusal. At5 pass A admits r1 before dispatch, releasing approach for r2.

Expected ownership tuples `(kind,car,request,start,end,end_reason)`:

- `(APPROACH,east,r1,1,5,BERTH_ADMITTED)`.
- `(BERTH,east,r1,5,null,OPEN_AT_H)`; b ends8 after H.
- `(APPROACH,west,r2,5,null,OPEN_AT_H)`; 8-km/5-minute pickup due10.

r2 refusal run is [1,5), exactly4 request-minutes. Its west pickup executes [5,7), distance `2·8/5=3.2 km`; east pickup executes sqrt(32) km. Expected `(within,late,missed,pending,completion,open holdings)=(1,0,0,1,0/2,2)`. Capture true/false canonical record bytes and digests must match.

Deleting the berth interval yields INVALID_EXPERIMENT, not vacuous success; logging-only accounting loses all intervals; closing both holdings at H loses terminal inventory; dispatch-before-admission makes refusal length5 and moves west assignment to6; completed-leg-only energy records west distance0. The review's original window H=6, assignments0/4 and arrival4 is shifted by+1; no original same-minute creation tie is used.

### 9.5 F5: abandonment, censoring and the historical maximum

Package graph, speed45, H=I=20, T=8, patience3; one I-PACE at east, b=2+2=4, no staging. E hub→central created0; A created1; D created16; B created17; C created18. E assigns0, travels8 minutes, boards8, departs12, completes central18; no visit occurs. D then assigns18, central→hub pickup takes6 minutes, due24. Other hub destinations are west (none is reached).

| Party | Exact terminal fields | Status / target category |
|---|---|---|
| E | assigned0, arrival8, boarding8, departed12, completed18, unserved null | BOARDED / within; exact wait8 |
| A | unserved4; all assignment/service times null | ABANDONED / missed; abandonment wait3 |
| D | assigned18; arrival/boarding null at H | CENSORED_ASSIGNED / pending; right-censor age4 |
| B | unserved20=H; other times null | ABANDONED / missed; abandonment wait3 |
| C | All assignment/service/unserved times null | CENSORED_UNASSIGNED / pending; unresolved age2 |

Exact `(within,late,missed,pending)=(1,0,2,2)`, terminal status counts `(1,2,1,1)`, lifecycle `(completed,unserved,waiting,in_progress)=(1,2,1,1)`. Historical arrival-or-horizon ages are E8,A19,D4,B3,C2; maximum19 attained by A, status ABANDONED. Boarding-wait distribution contains only E8. Calling A's19 observed waiting is false; replacing the historical metric with8 changes its legacy formula; omitting expiry at H produces missed1/pending3. Pooling censor ages with exact waits loses status information even if its maximum happens to be8.

### 9.6 R6: minute-100 trace and pass-B benefit

Approach4, berths B1/B2. At entering100, B1 holds car-3 since96 with b4 ending100; B2 holds car-7 ending102. car-11 queued since99 has reservation r10 and b0; car-9 r12 arrives100; car-5 r13 arrives104. car-20's preparation arrives at100, making it staged/available at step1. q40/q41/q42 are created97/98/99; no feasible available supply existed earlier. A central car-21 and a west preparation-eligible car-22 become available100. Forecast target1 remains visible. For this trace car-9 and car-20 each have b2; q41 pickup from central takes4 minutes.

| Boundary | Exact effect / occupancy after it |
|---|---|
| Step1 at100 | car-3 departs and frees B1; car-9 joins car-11's queue; approach owners={11,9,5}; B2={7}. |
| Pass A100 | car-11 boards/departs at100 on B1; retain [100,100) berth interval; B1 start mark used; approach={9,5}. |
| Dispatch100 q40 | car-20 exchanges staging→approach r14; zero-distance arrival100; owners={9,5,20}. |
| Dispatch100 q41 | car-21 acquires r15, arrival due104; owners={9,5,20,21}. |
| Dispatch100 q42 | APPROACH_FULL; flag=true because car-22 is feasible; consumes nothing. |
| 5a/preparation100 | No energy trigger from feasible q42; car-22 starts one staging refill. |
| Pass B100 | No berth can start: B1 used, B2 busy. Queue ordered car-9 then car-20; inbound car-5/car-21. |
| Pass A101 | Admit car-9 to B1, b2 [101,103); car-20 remains queued. |
| Pass A102 | B2 frees and admits car-20, b2 [102,104). |

Minute100 tuple `(new boarding starts,assignments,refusals,approach inbound,approach queued,staging refill)=(1,2,1,2,2,1)`. Releasing-and-continuing would board car-9 at100 and violates one start per berth/minute. The distinct 97/98/99 creation times intentionally replace the review's three tied minute100 creations without invoking G5.

**Pass-B benefit:** one party created20, one staged car already at hub, a free usable berth, approach1, b0. At20 dispatch transfers staging→approach; pass B boards/departs at20 and records zero-length approach and berth intervals. Tuple `(assigned,arrival,boarding,departure)=(20,20,20,20)`. Omitting pass B boards21; forbidding b0 rejects a permitted input. No second request is needed, so there is no request-order ambiguity.

### 9.7 G1: preparation must afford a passenger trip

Package graph; I-PACE at west with16 kWh, battery84, reserve15%=12.6, intensity.24; no waiting request after dispatch; target1 and empty staging. Old screen requires `(8+sqrt(32))·.24+12.6=15.87764501987817` kWh and starts preparation. Correct screen takes max hub→destination+destination→depot =16 km (north), so requirement `(8+16)·.24+12.6=18.36` kWh. Correct tuple `(preparation starts,staging owners,SOC)=(0,0,16)`. A car at18.36 passes at equality, arrives with16.44, sufficient for north trip+return+reserve. This rules out leg+hub-return-only eligibility and hidden trip omissions. Numeric values were computed by the ignored fixture script cited in §9.12.

### 9.8 G2: cell tapes and stock timelines — OPEN pending S1

The mechanism is fixed; **registration of cells/tapes remains OPEN pending S1**. The readings being ruled apart are explicit:

| Proposed cell / reading | Desired-stock timeline if release+walk is the wave | Competing reading / unresolved registration |
|---|---|---|
| Overlap, release90/95, walk5, count28/28, S6; publish wave−30, expire wave+30 | Waves95/100; publications [65,125),[70,130); target6 over [65,130),0 otherwise | If “wave” is incorrectly taken as release, target6 over [60,125). S1 must export exact wave/publication times. |
| Same overlap, event2 conversion0 but both forecasts unchanged | Exactly the same target [65,130); only realized event2 requests disappear | Omitting forecast2 instead changes target to [65,125), affecting only final5 minutes. These are distinct interventions; conversion0 is not forecast deletion. |
| Separated releases60/130, walk5, same publication offsets | Waves65/135; target6 on [35,95) and [105,165),0 between | Unchanged overlap forecast tapes would yield a different policy treatment. S1 must choose and name the complete tapes. |
| Dedicated false alarm recommendation | No event1 forecast; event2 conversion0; separated timing gives target6 [105,165) and no earlier preparation target | Reusing a true first forecast leaves residual stock; it is not the same false-alarm experiment. Start with empty staging and record it. |
| Same-policy / zero-staging controls | Same-policy identical; S=0 makes desired stock0 for every minute | Release condition, patience and exact tapes are still unregistered; do not select them after seeing an effect. |

These timelines are arithmetic examples, not an adopted condition matrix. Actual staged stock can persist above desired stock after expiry or between waves; target0 does not mean inventory0. S1 asserts target timelines before simulation and reports preparation starts by supporting publication afterward. Both possible readings are exposed, rather than pretending G2 has a frozen test tape.

### 9.9 G3: placement, ties and array preparation policy

At s=.5, exact first-six initial tuples `(car,type,depot)` are `(1,Ojai,west),(2,I-PACE,east),(3,Ojai,west),(4,I-PACE,east),(5,Ojai,west),(6,I-PACE,east)`. At a later reachable snapshot, an otherwise identical west and east car are tied4 km from central: lowest stable index wins dispatch. A display-only request/car label rename never changes stable index.

**Discriminating array-order snapshot:** at t10 car-A is available west and car-B central (the latter arrived there after earlier work); equal feasible profiles, target1, empty staging, speed60. At18 one background request W→C is created. Observe executed empty distance over [10,24), with H24. No later preparation occurs: one staging owner remains throughout, already meeting target1; the assigned car is busy until at least24.

- Stable index A=1,B=2: A prepares W→hub,8 km, arriving18; B at C wins the request at W (4 km versus staged A's8). Executed empty distance over the fixture window=8+4=12 km.
- Deliberately reindex/reorder A=2,B=1: B prepares C→hub,4 km, arriving14; A at W takes the request at zero pickup distance. Executed empty distance over the fixture window=4+0=4 km.
- Rename display strings only while keeping stable indices/array: remains12 km.

The 12/4 variant is a frozen-policy/initial-state mutation, **not a compatible reactive/forecast pair**. It rules out nearest-first preparation masquerading as array order and highlights index sensitivity. It does not authorize changing G3 to select a favorable type. The owner rule, rather than lexical car-ID sorting, resolves the review's shorthand “swapped IDs”.

### 9.10 G4: arrival averages differ from boarding wait

One request created0, east car; speed60; arrival6. Berth closed[0,12), usable from12; approach1; profile boarding4, extra dwell2, so b6; destination west (8-km passenger leg). Exact tuple `(arrival,boarding,departure,completion)=(6,12,18,26)`. Let H30,I1,T10. Legacy completed wait=6; legacy arrival-to-completion trip average=20; realized `trip_minutes`=6+8=14; approach queue=6; boarding wait=12 and target category LATE. Boarding fraction0/1, completion1/1. Reusing the arrival wait as boarding wait would claim within target; equating trip average with `trip_minutes` drops6 queue minutes.

### 9.11 G5: keyed same-minute order, independent of ID spelling

This is the only tied-creation dispatch fixture. At t20 five hub requests are created together on an injected fixed tape: event/party tuples (0,1),(0,2),(0,3),(1,1),(1,2). Five feasible cars at central have equal pickup distance, stable indices1..5; approach4, no currently queued/inbound owners; berths closed for this minute so no pass-B release. All destinations are west. Seed42. The ignored script calls the shipped `u64` helper with these exact parts:

| Ordered immutable tuple | Key | Exact u64 decimal |
|---|---|---:|
| (1,1) | `42|n2-same-minute-order|event|1|1` | 2669362755856042682 |
| (0,2) | `42|n2-same-minute-order|event|0|2` | 8183017667603177679 |
| (0,1) | `42|n2-same-minute-order|event|0|1` | 9171603845286686108 |
| (1,2) | `42|n2-same-minute-order|event|1|2` | 11790743780872775308 |
| (0,3) | `42|n2-same-minute-order|event|0|3` | 14517639462300572287 |

Expected assignments are `(1,1)→car1,(0,2)→car2,(0,1)→car3,(1,2)→car4`; (0,3) is APPROACH_FULL, flag=true from car5. Tuple `(assigned,refused,rejected,remaining feasible cars)=(4,1,0,1)`. Rename request ID strings adversarially so lexical order reverses: these outcomes and ordinal-normalized records stay identical (the display ID fields themselves change). Reordering input arrays also changes nothing. Duplicate ordinal identity rejects; a fabricated equal draw uses the declared ordinal collision fallback. This rules out ID spelling, generation order and event-first lexical order as implicit policies.

### 9.12 G6: independent channels and stable exogenous identities

Computed with `node artifacts/fleetlab-n2-s0/fixture-values.mjs`, an **ignored, uncommitted arithmetic/key probe**, importing only `src/core/keyed.js`. It is not N2 implementation or a seed-independence study. Seed42, event0 release20, event1 release40, walk5, spread10, conversion.7; each event has three potential parties. Exact values from the shipped helper:

| Event/party | Conversion draw | Spread draw / integer | Destination draw | Eligible creation / destination |
|---|---:|---|---:|---|
| 0/1 | .2529533503111452 | .17345377570018172 /1 | .9293774357065558 | 26 /east |
| 0/2 | .4786067046225071 | .3134333021007478 /3 | .5515818598214537 | 28 /central |
| 0/3 | .084512879839167 | .7824973100796342 /8 | .7320282112341374 | 33 /central |
| 1/1 | .8402320332825184 | .8143402298446745 /8 | .18495461693964899 | Nonconverted; no request |
| 1/2 | .16424503992311656 | .8915959154255688 /9 | .9294191915541887 | 54 /east |
| 1/3 | .6991336403880268 | .9178879261016846 /10 | .3895256887190044 | 55 /north |

Use I=120, H=140. Event1 conversion .7→0 removes its two requests but leaves every event0 and background row byte-identical, including stable IDs; potential-party reconciliation changes only event1 conversion disposition. Shifting event1 release40→75 moves its eligible creation54/55 to89/90 exactly+35, without changing conversion, destinations or the other rows. Do not wrap or shift the seed to simulate a release change.

For fixed background ordinals1,2,3 with distinct injected creations1,2,3, origin/destination draws are respectively `(.536830989876762,.1060402940493077)`, `(.529852885985747,.11639587441459298)`, `(.5837799324654043,.30511100217700005)`. Under the stated stable weighted mapping they all select central→west. This small coincidence makes no independence claim. Inserting/filtering/reordering event rows leaves all six draws unchanged. The probe enumerates 40 parties×2 events×4 channels +60 background ordinals×3 channels +180 minute-count keys = **680 distinct keys**, with no `|` inside a part.

Required properties: event conversion/destination/spread channels are distinct; background generation has no event/global-array index input; same-minute-order draw is independent of all generation channels; a fixed input tape is unchanged by scheduling/capture/chunking; all legacy SFO v1 outputs remain byte-identical. A registered **cross-seed** independence check is still required in S1; key uniqueness and these mutation properties cannot substitute for it or validate sample independence.

### 9.13 Staged-vehicle 5a: owner D-F1b

Use the F1 all-4-km unit graph, intensity.25, reserve8, target64. At t10 staged S at hub has12.5 kWh and an open staging interval; available D at west has8.5. The only waiting request X, created9, is W→N; no supply was available at9. Staging was valid under G1: from the hub max passenger+return requires12 kWh including reserve, below12.5. X needs14 from S and12 from D; both fail. Final A includes S and D; maximumRange=(12.5−8)/.25=18 km; X lower bound16 passes that bound but both per-car screens fail.

Exact `(trigger,final A,range,E,blocked set,started visits,staging owners)=(true,{S,D},18,{D},{D},1,{S})`. S stays staged with no interval end; D begins a zero-distance west visit. With only S in A, exact tuple is `(true,{S},18,{}, {},0,{S})`: a true trigger with empty E is valid. Removing S from A incorrectly changes the range/trigger (empty A in the single-car variant); including S in E sends it to a depot and invents an excluded DEPOT_VISIT_STARTED end reason. In this refusal-free state the differential selected set is exactly legacy `{S,D}` minus staged `{S}`.

### 9.14 Packet(a): full approach, useful background and below-target supply

At t2 one inbound car holds approach1, a second car at central has12 kWh (reserve8,target64,intensity.25), and H hub→west created0 precedes B central→west created1. Unit graph from F1. H is APPROACH_FULL with flag true; B assigns the central car (needed9). Final A empty, 5a does not fire. Exact `(hub refused,background assigned,blocked,visits,rejected)=(1,1,0,0,0)`. With all berths closed and the owner physically queued instead of inbound, the tuple stays identical. A generic break starves B; routing a below-target but feasible car to a depot treats a resource refusal as energy failure. No vehicle enters an unreserved off-map queue.

### 9.15 Packet(b): same-minute arrival, zero dwell and admission ties

Two hub requests created8 and9 are already assigned; their cars arrive together at10 with approach reservation sequences20 and21. One usable berth, approach2; b0. Both arrivals settle before pass A. seq20 boards/departs10 with berth interval[10,10); seq21 stays queued until11, then boards/departs11 with [11,11). Exact `(boarding minutes,starts at10,queue minutes) = ([10,11],1,1)`. Swapping only vehicle display labels leaves reservation-order admission unchanged. Releasing-and-continuing gives [10,10] and violates R6; lexical vehicle ID before reservation sequence can reverse order. G5 separately tests tied **request creation**; these distinct creations test tied arrivals without a keyed dependency.

### 9.16 Packet(c): occupied berth closes and reopens

One usable berth at10. r1 created0, arrived/boards10, b5; r2 created1, arrived11 and waits holding approach. Condition closes berth[12,14), reopens14. The first interval stays[10,15), including draining occupancy[12,14); reopening14 does not make it free. r2 boards15 with b2, ends17. Exact `(r1 end,r2 start,r2 queue,draining occupied min)=(15,15,4,2)`. Closing must not abort/restart b, release ownership early, evict r1 or admit r2 at14. Berth usable=0 during closure, occupied=1; do not flag that valid drain as occupied>usable invalidity (installed count remains1).

### 9.17 Packet(d): abandonment, horizon arrival, departure and completion

F5 supplies the full abandonment-versus-censoring trace, including expiry at H. Add independent single-request boundary fixtures, H=I=20 and T8, with sufficient patience for each unassigned interval:

- Arrival exactly H: Z created12 and assigned12 at east, speed45, hub arrival20. Tuple `(arrival,boarding,status,target)=(20,null,CENSORED_ASSIGNED,MISSED)` because creation+T=H. Approach remains open; queue minutes0 is an observed empty interval, not boarding success. A pass at H incorrectly boards Z.
- Previously started boarding ends H: Y created10, boarding16, b4; at20 departure is recorded and berth ends20. Tuple `(boarding,departure,passenger intervals executed after departure,boarding status)=(16,20,0,BOARDED)`. It is within target; departure at H is allowed although new admission is not.
- Passenger trip ends H: K created0, boards10, b2, departs12, 8-minute passenger leg completes20. Completion1/1; no new required visit starts20. Omitting terminal settlement loses this completion.
- Creation exactly I: a converted event party ready20 is excluded as converted_post_intake; no request row enters N. It cannot become a pending success at the horizon.

These independent cases have one creation each and distinguish three different boundary events; no tied request-order assumption is involved.

### 9.18 Packet(e): false/stale forecast replenishes after service

Package graph, speed60, intensity.25, enough energy; staging1, approach1, berth1, b2, targetT10, H40. One forecast published0, wave10, expires30 exclusively, count1, lead30; no second publication is active. car1 west, car2 east, car3 west (profiles identical for this trace). Event party P1 created10, P2 created20, both destination central; no other requests. No completed car returns to availability before the last preparation decision: P1 departs12, completes16, then starts its existing required visit under the explicitly overridden `trips_between_visits=1`; visit duration is long enough that it remains unavailable through20.

- t0: desired1, car1 starts west→hub8 km, arrives8; staging1.
- t10: P1 takes car1 and boards10 via pass B; staging exchange frees its slot. Same minute car2 prepares east→hub sqrt(32) km, arrives16; target is replenished despite forecast count1 already served.
- t20: P2 takes car2 and boards20. car3 prepares west→hub8 km, arrives28. P2's trip cannot complete before this preparation choice.
- t30: forecast expires; desired0; car3 remains staged. At H40 it is still an open unused staging owner.

Exact `(forecast count,preparation starts,terminal staged,preparation km,preparation kWh)=(1,3,1,21.65685424949238,5.414213562373095)`; all three starts supported by the same publication. A depletable budget makes only1 start; served-demand subtraction also changes behavior; expiry recall removes car3 incorrectly. This trace calls the forecast **stale in predictive content after service but still time-valid through29**; an already-expired publication never authorizes a new start. It is a mechanics fixture, not S1's dedicated false-alarm cell. Arithmetic is quoted from the ignored fixture script.

### 9.19 R2: event gains cannot compensate for background timely harm

Constructed metric-map fixture, with 116 distinct eligible creation minutes in [0,180): background60, event56. Background within-target50→40, event within-target20→40; background completion60→60, event completion46→51. Other historical metrics and refusal counts are equal; all values are internally feasible cohort counts. Identical deltas across multiple supplied fixture replications give completion delta5/116, interval[5/116,5/116], above.02: IMPROVED. All-request timely service70/116→80/116 improves, but background timely harm `(50−40)/60=1/6>.02`. Exact decision `(primary,background boarding guardrail,recommendation)=(IMPROVED,REGRESSED,HOLD)`. Omitting the required R2 guardrail could advance despite harm. This synthetic instrument fixture is not evidence about forecast performance or seed independence.

## 10. Open for S1: experiment registration, not implicit defaults

No evaluation seed is consumed or campaign registered by this document. The following owner decisions remain **Open for S1**, with the review's recommendation preserved. G2 is the only OPEN fixture family; concrete unit fixtures elsewhere intentionally choose local parameters and do not choose campaign settings.

| Open decision | Review recommendation / required S1 record |
|---|---|
| Patience | Choose one value explicitly and justify it in every cell tape. Existing default is12 minutes; increasing it can saturate completion. Do not tune it to create a forecast gain. |
| All inherited parameters | Export a complete literal config, not a merge with evolving defaults. Name/justify time-of-day modulation (recommend disabled), traffic, speed, profiles, SOC thresholds, trips between visits, all depot capacities/durations, charging policy and readiness. Observed defaults below are context, not registration. |
| Tuning/evaluation seed blocks | Recommend2501–2512 /3501–3512, instead of2001–2012 /3001–3012 which are public four-area model seed sets. Freshness is model-scoped, procedural and unauthenticated. Record source search and inspection history; historical1001–1012 are regression examples only. |
| Full condition matrix / G2 tapes | Freeze exact releases, ready-wave definitions, forecasts, patience, horizon and condition tape per cell. Proposed families: separated, overlapping, longer boarding, overlap with false second realization, berth loss/recovery, same-policy control, zero staging. Relabel overlap false-realization accurately. |
| Dedicated false-alarm cell | Recommend separated60/130 timing, event2 conversion0, **no event1 forecast**, initial staging empty. Register the full tape separately; do not assume the overlap false cell isolates wasted preparation. |
| Isolation cell | Recommend approach=fleet size40 and assert zero APPROACH_FULL. Register a control-only exception to ordinary1–24 approach bound before evaluation. It isolates reservation-cap asymmetry; it is not an ordinary policy pair with unnoticed config drift. |
| Primary informativeness / positive controls | Before evaluation use tuning reactive headroom, exact nulls and a registered non-treatment positive control required to read IMPROVED; proposed control gain≥.05. Freeze check rules independent of forecast-arm outcomes. A failed cell requires documented pre-evaluation redesign or separately registered primary, not favorable-metric selection. |
| Refusal ceiling headroom | Apply F2's ≥.02 below |Qevents|/N rule on reactive tuning results, with frozen aggregation/pass rule. If failed, owner registers minutes-based limit or descriptive status before evaluation, with rationale. |
| Cross-seed independence | Register a well-mixed keyed-background/event independence check: exact seeds/sample size, origin/destination/count statistics, expected reference distribution, acceptance bounds and disposition. Different seed integers alone do not cure a weak RNG. No such check has been executed here. |
| Detectable effect / dispositions | Record tuning SD and smallest detectable gain; explain margin=.02 requires the whole interval above.02. Show headroom beside UNCHANGED and mark below-detectable effects uninformative. Keep null, mixed and adverse results. |
| INCONCLUSIVE extension | Decide no extension, or one preregistered extension with exact additional seeds, maximum≤40, stopping rule and combined-analysis method. Never add seeds merely because the first result is inconclusive; do not pool cells. |
| Reaffirm tolerances / nulls | Reaffirm all eight guardrail directions/limits, primary margin, exact per-cell/seed denominator and request equivalent, null rules, bootstrap options and all required-cohort checks. These are prototype value judgments, not operational standards. |
| Control execution and retention | Register exact control axes/tapes/seeds and campaign execution count. At12 paired seeds a cell costs24 evaluated arms+2 replay arms=26. Five cells130; plus two controls182; plus isolation208; an additional false-alarm cell adds26. These are arithmetic, not a frozen campaign. |
| Registration/inspection log | Commit/source identity; package/source/tape/model/metric/accounting digests; config; check rules/results; seed searches; dispositions; append-only results-inspection log. Distinguish correctness fixes from outcome-informed policy tuning; the latter requires new version and reserved block. |
| Walkthrough engine | Deferred to later P0 work. Decide which model teaches the walkthrough; S0/D1 does not relabel one engine's result as another. |

Observed inherited values requiring an explicit S1 decision (`operations.js:14–19`, `bay-operations.js:15–16,49–50`, `vehicle-profiles.js`): start_hour7; traffic_multiplier1; Bay road speed38 km/h; peak_multiplier1.6; clear weather; initial/target/reserve SOC65/85/15%; trips_between_visits3; chargers4 per depot at50 kW; fixed site cap120 kW; cleaning/software/upload bays2/1/2; durations8/12/6 min; software every2 visits. Default I-PACE profile is battery84 kWh, acceptance100 kW, intensity.24 kWh/km, boarding2, service multipliers1/1/1; Ojai is90/150/.27/2, cleaning/software/upload multipliers1.25/1/1.2. These are teaching assumptions, not published vehicle performance. Existing readiness and charging extension literals also require exact export if enabled. `resources` omission and depot-only G3 placement are already decided, not optional inherited values.

Suggested synthetic starting parameters, still unregistered: fleet40; depots2; H240; I180; T10; background20/hour; berths2; approach4; staging6; each event40 parties, conversion.7, spread10, walk5; overlap releases90/95 or separated60/130; wave=release+walk recommendation; forecast count28 each, publish wave−30, expire wave+30, lead30; additional hub dwell2 or longer-boarding cell6. Expected N≈116 and background≈60 assume disabled demand peaks and no intake exclusions; actual per-seed denominators are measured from the frozen tape, never hard-coded116/60.

## 11. Architecture, work packages and implementation acceptance

Required direction: frozen region/demand/condition/publication tapes → **one Bay lifecycle and energy ledger** with opt-in curb ownership → mandatory accounting and independent recomputation → strict v2 pair adapter → existing paired instrument → native recorded-result projections. `curb-resources.js` owns reservations/intervals, not vehicle selection or future inputs. `event-demand.js` owns exogenous rows/publications. Policy inputs contain only current demand/resources and currently visible forecasts, excluding future requests, unpublished records, future berth closures, realized wave parameters and RNG state. Future-only input mutation must not alter earlier decisions.

S0 is this design only. S1 registration and X1 execution seam each need separate approval; neither is implied by committing the document. After approval, proposed sequence is X1 single deterministic step iterator and sync wrapper preserving `simulateBayAreaOperations`; then frozen region/demand/resources; then independently checked metrics/v2 pairing; then compact UI/setup/export; registered evaluation last. Do not add a second engine or put statistical decisions in UI code.

The cooperative runner should yield at deterministic minute boundaries within a measured8 ms scheduling target; wall time cannot affect draws or model state. Measure demand construction, largest minute, validation, bootstrap, canonical serialization and final DOM projection too. If a minute exceeds budget, add deterministic finer checkpoints or lower validated workload cap. At40 and120 vehicles measure cold/warm total, task/chunk distribution, peak retained heap and input-event timestamp→visible cancellation (including dispatch delay) over at least20 deterministic offsets. Proposed local targets: no N2 simulation task>50 ms; p95 cancellation≤100 ms, maximum≤200 ms. These are unmeasured acceptance targets. A Worker needs a separate architecture/CSP review, not automatic dependency/network adoption.

Edits, cancellation, navigation and destruction invalidate in-flight work at each checkpoint. No partial arm/comparison becomes completed or exportable as valid. Retain the last complete result under its exact stale inputs. Synchronous, differently chunked, capture-on/off and canceled-then-restarted runs reproduce identical canonical outputs excluding timing diagnostics.

The compact review sits beside Austin inside Fleet day without a navigation redesign. Before run, show question, synthetic graph, frozen/treatment inputs, exact versions/seed, I/H/T, clock definitions, finite capacities and assumptions. After run, show arrival versus boarding, all populations, berth usable/occupied/draining states, inbound versus queued approach, staged supply, refusals, preparation energy/distance, background displacement, unfinished depot work and terminal energy. Selected-request detail traces release→walk→creation→assignment→arrival→queue→boarding→departure→completion with explicit null stages. Render exact machine values on inspection; rounding cannot move an apparent result across a threshold. Compare primary, each guardrail and descriptive effects independently; invalid/incompatible/canceled/unavailable states are distinct and have no accepted chart/recommendation.

Keep native DOM and existing main views,56 lesson IDs, static/offline routing, five legacy setup models, no-autorun loading, CSP and no unexpected network requests. Setup limits remain32,768 characters /65,536 decoded bytes; fail explicitly with a complete JSON alternative, never truncate. Offline hard limit remains2,621,440 bytes. Historical pre-D1 size2,543,655 leaves77,785 bytes; remeasure before any future implementation. Review planning allocations are X1≤8,192 bytes and combined model/review N2 additions≤28,672, with a12,000-byte unallocated floor across the complete roadmap. They are proposed stop budgets, not measured N2 size or authority to consume another track's allocation.

Implementation acceptance must include all §9 fixtures plus: zero demand; required empty background; one slot/berth; all berths closed; close exactly at admission; recovery; false/unpublished/expired forecasts; zero staging; boundary target equality; exact I/H; malformed/mixed-version tapes; unknown/duplicate/invalid reservations; missing/altered records; capture/chunk/replay equality; null-treatment identity except enumerated policy fields; complete exogenous equality versus allowed realized differences; package/provenance mismatch; strict v1/v2 readers; legacy Bay/Austin/airport/launch and setup bytes; resource-not-modeled display; null/late/pending cohorts; cross-seed check; and guardrail adverse cases. A positive result is not a required outcome.

Focused tests precede the appropriate full Node/performance, scoped Python website parity/boundary, Ruff, package and diff gates. Use the correct checkout's Python import path; do not manipulate retained fixtures or claim known baseline failures passed. Browser acceptance after implementation covers native, packed and offline-over-HTTP at1280×720 and400px, keyboard/status/focus, stale/cancel/loading restoration, both arms/bootstrap/final projection and no autorun. Additional browsers/devices/assistive technologies and user comprehension improvements require actual observations, not fake-DOM inference.

Defer extra hubs, road spillback, accessibility/rerouting, post-assignment abandonment, Street coupling, combined power/weather stress, thermal/auxiliary physics, pricing, new optimization/RL/LLM policy, live maps/events, external data ingestion, cloud/backends and physical control. Stop the affected work if populations/ownership do not conserve, paired tapes differ, legacy contracts mutate, future input leaks, unavailable evidence becomes success, mandatory work vanishes, budgets fail or protected Python review/evidence paths would need changing. Document and continue independent safe work.

## 12. S0 verification and recommendation

S0 verification is documentary: source inspection, explicit owner-decision reconciliation, fixture arithmetic/key probes, v1 digest check and whitespace/privacy review. No N2 model, campaign, performance measurement or browser acceptance has run, and no N2 validity claim follows from the hand traces. The uncommitted probe is deliberately outside the tracked deliverable. The parent release task records the separate D1 baseline and gates; they are not N2 acceptance.

Executed on 2026-09-26: the ignored Node key/arithmetic probe completed successfully; documentary assertions passed the exact first line, all19 fixture groups, F1–F5/G1–G6/R1–R8 coverage, quoted keyed values and record-bound arithmetic; direct content privacy/whitespace checks and `git diff --check` passed. A second review identified and corrected the F2 full-population denominator (including the existing inbound request: 2/5) and G3 executed-distance observation window (through24). The conservative record bound counts nested dispatch-flag and fallback entries separately; its500,000-element design cap is not a measured memory allowance.

Expected immutable v1 SHA-256: `c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`. Exact executed S0 verification commands and results are recorded in the task handoff; v1 is never edited. Source disagreements and owner-precedence fixture adjustments are explicit in §1.2. All fixture outcomes are pinned except G2, whose competing readings and S1 decision boundary are stated.

### Recommendation

Review this v2 contract and proceed next to S1 registration and a separately approved X1 execution seam. Hold N2 implementation until those approvals and prerequisites are satisfied. Preserve the possibility that the bounded experiment returns null, mixed or adverse results.

### Top risks + mitigations

- **Curb exposure becomes artificial energy failure or invisible demand loss:** whole-pass reasons, exact 5a set, staged exemption and conservation records.
- **Event gains conceal background harm:** required background boarding/completion guardrails, immutable denominators and non-compensatory decisions.
- **Recording/rounding conceals a boundary or missing fact:** capture-independent intervals, exact values, explicit nulls, every-arm validation and strict identities.
- **An uninformative experiment is mistaken for policy evidence:** S1 headroom/positive/null/independence checks, complete tapes, dispositions and inspection log.
- **A teaching result implies external validity:** visible synthetic assumptions, NOT_EVIDENCE, permission NONE and no calibration/deployment claim.

### Next 3 actions

1. Owner reviews v2 and S1 selects patience, inherited literals, condition/control tapes, seed blocks and check/disposition rules before evaluation.
2. Separately approve and validate X1 legacy parity, deterministic cancellation, retained-memory and package budgets before N2 model work.
3. After those gates, implement model/accounting tests before UI, then run every registered cell and report all results without selection.
