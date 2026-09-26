DRAFT v2.1 for owner review; design only; no N2 implementation authorized

# FleetLab N2: finite pickup resources and published-forecast preparation

**S0 / WP0 contract addendum, 2026-09-26.** This complete corrected design restates v2 and supersedes it only where a correction is TEXT or an owner decision is DECIDED. Pending boxes are proposals, not operative contract. It does not authorize implementation, experiment registration, an execution-seam refactor or publication. The [owner brief](2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md) §2 controls decisions except for DECIDED overrides in §0.1; [independent review](../FLEETLAB_PACKET_REVIEW_2026-09-26.md) §2 supplies the contract corrections and §3 supplies S1 recommendations. The [packet](../FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md) §7 supplies the earlier findings and traces. This document describes proposed behavior, not measured N2 results.

## 0. Implementer summary

Question: does preparation for overlapping event demand improve service under finite pickup capacity, and where does harm move? Treatment changes only events.policy; approach plus staging commitment is intentionally asymmetric. Build event-demand, curb resources, capture-independent accounting/checker, v2 adapter and record projections. Preserve legacy Bay/Austin/airport/launch, Python evidence, gate and workbench behavior.

| Step | Rule (at most 15 words) | Decision | Fixture |
|---|---|---|---|
| 1 | Settle elapsed travel, boarding, trips, visits and releases, including boundary H. | DL9 | §9.17 |
| 2 | Apply condition tape and expose time-valid publications. | R5, OD-7 | §9.16 |
| 3 | Add eligible demand; expire unassigned waiters before classification. | F5 | §9.5 |
| 4 | Admit arrived owners FIFO; mark each berth’s start use. | R6 | §9.6 |
| 5 + 5a | Classify all waiters curb-first; then recover only final eligible non-staged cars. | D-F1a/b | §9.1–§9.2 |
| 6 | Prepare nearest eligible cars to replenish current visible target. | OD-5, R1 | §9.3, §9.18 |
| 7 | Repeat admission without a second start per berth. | R6 | §9.6 |
| 8 | Allocate depot work, account and execute interval; H validates only. | R6 | §9.4, §9.17 |

Invariants: inbound+queued ≤ C_app; inbound+arrived staged ≤ C_stg; occupied ≤ installed berths; one holding per car; one boarding start per berth/minute; no dispatch, preparation or hub admission at H. Select cars by nearest feasible route, stable index ties; admit by (arrival_minute,reservation_seq). Fix B assigns types depot-major using integer products. Records: REQUEST, REQUEST_TRANSITION, VEHICLE_TRANSITION, OWNERSHIP_INTERVAL, DISPATCH_RUN, PREPARATION_START, FALLBACK_PASS, ENERGY_LEG, ENERGY_DELIVERY. Keep event/curb/pickup/accounting identities until OD-8/C-32 are decided.

Envelope: 16*Qmax+P+4*Qmax*H+12*V*(H+1)+48 ≤ 500,000, then measured X1 caps. OD-2 byte stops: X1=8,192; S2=65,536; S5=32,768; P2=12,288; R0=5,120; T=61,440 (target=53,248); floor=12,000. OD-1 route A must land and be re-measured separately.

Fixture index: §9.1–§9.5 F1–F5; §9.6 R6; §9.7–§9.12 G1–G6; §9.13 staged 5a; §9.14–§9.18 Packet(a)–(e); §9.19 R2. G2 is OPEN. Stop for budget failure, population/ownership mismatch, future-input leak, legacy mutation, missing required metrics, failed digest/check level or protected-path scope. Map: §1–§2 authority; §3–§5 mechanism; §6 metrics; §7 records; §8 identities; §9 fixtures; §10 S1; §11 build/UI; §12 verification; Appendix A conformance.

### 0.1 Owner decisions

Only DECIDED entries override the brief/v2. Neutral PENDING entries use class a for neutral presentation, not approval. Class c for C-32 remains separately pending because the owner register assigns it no OD number. S1 recommendations remain exclusively in §10.

[[OWNER DECISION OD-1 | budget route | A offline full-line stripping / B cuts / C limit / D shared worker | A; separate review, token equality | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-2 | work-package budgets | §4.6 single S5 / split S5 | X1 8192; S2 65536; S5 32768; P2 12288; R0 5120; floor 12000; T stop 61440 target 53248 | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-3 | G3 type order | depot-major fix B / old index order | fix B, rank j=1..V | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-4 | G3 arithmetic | integer product first / float share | integer ojai_share_pct | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-5 | preparation selection | nearest eligible / array order | nearest eligible, stable index ties | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-6 | checker split | runtime plus Node policy / full runtime | C-12 split | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-7 | condition tape scope | keep N2.0 / defer N2.1 | keep under route A | class c | status: PENDING]]

[[OWNER DECISION OD-8 | identities | merge pickup into `B2` / separate | merge pickup, retain event/curb/accounting | class c | status: PENDING]]

[[OWNER DECISION OD-9 | arrival at H | keep DL9 / uniform no boarding | keep DL9; S1 H−I ≥ T | class a (neutral) | status: PENDING]]

[[OWNER DECISION OD-10 | interface arm names | recommended labels / owner alternatives | Respond to requests; Stage from published crowd estimates | class a (neutral) | status: PENDING]]

[[OWNER DECISION OD-11 | F2 refusal role | saturation rule / current headroom | strict >0.02 if attainable; descriptive if saturated | class b | status: PENDING]]

[[OWNER DECISION OD-12 | F5 maximum role | descriptive / required guardrail | descriptive, retain key/label/attainer | class b | status: PENDING]]

[[OWNER DECISION OD-13 | terminal energy | descriptive / guardrail | after placebo; normalized preparation measure | class d | status: PENDING]]

[[OWNER DECISION OD-14 | unfinished visits | limit 0 / descriptive | state placebo false-HOLD rate before choice | class d | status: PENDING]]

[[OWNER DECISION OD-15 | charging policy | named non-counterexample / omission | extension required; structural-zero rejected_actions | class d | status: PENDING]]

[[OWNER DECISION OD-16 | informativeness factor | owner value before inspection | 1.5 suggested floor | class d | status: PENDING]]

[[OWNER DECISION OD-17 | cells and patience | redesign / retained cells | drop b=8 completion cell; redesign isolation; patience 12 or 20 | class d | status: PENDING]]

[[OWNER DECISION OD-18 | placebo and guardrail classes | register before treatment / omit | register both | class d | status: PENDING]]

[[OWNER DECISION OD-19 | work ordering | S1a before X1 and S5 after S4 / old order | S1a→X1→S2→S1b before treatment; S5 after S4 | class e | status: DECIDED 2026-09-26]]

[[OWNER DECISION OD-20 | time of day | disable both / keep modulation | disable demand and travel | class d | status: PENDING]]

[[OWNER DECISION OD-21 | short N2 identity line | yes / no | yes, low priority | class a (neutral) | status: PENDING]]

[[OWNER DECISION OD-22 | approach bound | fixed 1–120 / control exception | fixed 1–120 | class d | status: PENDING]]

[[OWNER DECISION OD-23 | trace and sharing scope | trace only / both / neither | trace per OD-1; sharing deferred | class a (neutral) | status: PENDING]]

[[OWNER DECISION OD-24 | default traced request | registered illustrative rule / manual only | first event request of cell, pre-registered | class a (neutral) | status: PENDING]]

[[OWNER DECISION OD-25 | required metric unavailable label | distinct blocked state / INVALID_EXPERIMENT | distinct; both block instrument | class c | status: PENDING]]

[[OWNER DECISION OD-26 | R1 visible clarification | lead gate / published-only dictionary | include opened preparation window | class b | status: PENDING]]

### 0.2 Changes from v2

| v2 lines | v2.1 section | Correction / class | Reason and replaced authority |
|---|---|---|---|
| 56, 457–465 | §2, §3, §9.9 | C-01/C-03 / e; OD-3/4 | Replaces brief §2 G3 index-major float-share type rule with depot-major integer products; placement unchanged. |
| 45, 123, 387, 537–542 | §1.2, §4, §9.3/9.9/9.18 | C-04 / e; OD-5 | Replaces brief §2 preparation array order with nearest eligible; fixtures re-derived. |
| 302–311 | §7 | C-12 / e; OD-6 | Replaces full runtime policy validation with declared runtime/test-time split. |
| 578, 611–618 | §11 | C-35 / e; OD-19 | Replaces v2 ordering with S1a/S1b and S5 after S4. |
| 586 | §11 | C-41 / a; OD-1/2 / e | Replaces obsolete combined budget; route A separate tooling and launch-decided package stops. |
| 183–207, 235 | §6 pending boxes | C-21 / b; OD-11/12/26 / b | Retains operative brief F2/F5/R1; exact replacements and deltas are proposals. |
| 78, 279, 287–300, 323–337 | §6–§9 pending boxes | C-19/C-31/C-32 / c; OD-7/8/25 | Retains condition, identities and distinct record kinds; no silent reversal. |
| 76–315 | §3–§8 | C-02/C-05–18/C-20/C-22–28/C-38/39/44 / a except C-18 d | Precision, explicit schemas, finite workload and shared record projection; no new gate semantics. |
| 343–545 | §9 | Fixtures / a except adopted G3/preparation / e | Complete entering states, source helpers, canonical accumulation and machine values. |
| 547–570 | §10 | P1-B/C-18/C-34/C-45/C-46 / d | Keeps registration recommendations outside operative contract. |
| 574–618 | §0, §11–§12, Appendix A | C-29/30/33/36/37/40/42/47–50 / a | UI prerequisites, readable standalone text and committed documentary verification. |

## 1. Purpose, authority and change log

The question is: **Does preparing vehicles for overlapping demand improve service when boarding capacity is finite, and where does it displace harm?** One Las Vegas-inspired fictional graph, two synthetic event cohorts and one shared constrained hub isolate that question. Reactive availability and published-forecast preparation differ only in `events.policy`. Null, mixed and adverse outcomes are useful results; a favorable forecast effect is not acceptance.

Source inspection for v2.1 uses baseline `4ba5626cef5f6354c0ae77eabc636028fe794dc5` on `codex/fleetlab-d1-result-first`; source references below are relative to `playground/fleetlab/` unless stated otherwise. No N2 modules exist at that baseline. The source inspection confirms the existing Bay lifecycle, charging/readiness accounting, pair adapter, keyed helper and region-routing behavior. The application source is unchanged from the review's `7dbb6cb`. Repository identity remains Hermes, distribution `hermes-autonomy` 0.1.0, import `hermes`.

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
| 93–101, overflow/preparation | Approach-refused terminology; staged cars in A but excluded from E; stronger preparation energy screen; replenished target; C_app+C_stg asymmetry (F1, F2, G1, G3, R1, R4). |
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
| DL2 | Review F4 has two requests created at 0; the owner brief requires distinct creation minutes outside G5. | Shift its resource window by +1: H=7, `r1` created 0, `r2` created 1, supply first available at 1. Expected ownership/refusal intervals shift by +1; their lengths and partial distance remain unchanged (§9.4). No negative creation minute. |
| DL3 | Review R6 creates three requests at 100, again conflicting with that owner fixture rule. | Use creations 97/98/99 and explicitly unavailable prior supply; preserve the minute-100 dispatch order and transition tuple (§9.6). |
| DL4 | Review F1 says “4 km edges”; the draft coordinates give east–hub length sqrt(32) km. `region-package.js:33` computes Euclidean edge lengths and `:36–42` computes shortest paths (ties use lexical node ID at `:37`); `bay-operations.js:122` rounds travel duration up. | F1 is explicitly an all-4-km **unit-test graph**, not the package geometry. Package fixtures F3/F4/G1 use sqrt(32). No silent route override. |
| DL5 | Packet R5 recommends fresh resource overrides; owner R5 instead omits `resources`. `resource-observations.js:3–4` defaults to delay/outage. | Omit the extension entirely; its metrics are unavailable / “not modeled”, never fabricated zero. |
| DL6 | Packet F2 uses hub denominator and feasible-vehicle-first attribution. Review and owner choose all N and curb-first. | Use the owner's guardrail and review's per-turn classification; no packet attribution rule survives. |
| DL7 | OD-5 supersedes brief §2 array preparation; dispatch still uses nearest-feasible selection and stable index ties. | Nearest eligible route distance to the hub governs preparation. Both §9.9 indexings execute 4 km; the former array reading executes 12 km and is ruled out. F3 injects unavailability through minute 0. |
| DL8 | V1 proposes extraction from airport RNG/forecast code. `airport-demand.js:23,34–36` has different randomness and inclusive expiry. | Add N2-versioned behavior without modifying airport v1 draws, inclusive expiry, output fields or bytes. |
| DL10 | OD-19 supersedes v2 §11 ordering. | S1a rules before X1; S1b after S2, before any forecast-arm run; S5 after S4 registered evaluation. |
| DL9 | V1 line 95 prohibits new **berth** admission at H; `bay-operations.js:159–161` settles non-hub arrival directly into boarding even at H. | Scope resolution: R6 admission is constrained-hub berth admission. Preserve inherited non-hub settlement, with no executed interval at H. No dispatch/preparation or hub admission at H. |

## 2. Owner decisions adopted

| ID | Binding N2 decision |
|---|---|
| D-F1a | Energy-recovery fallback 5a fires at the end of the dispatch pass. |
| D-F1b | Staged vehicles stay in A for the trigger and range bound but never enter E. They are never blocked or sent to a depot by 5a. The refusal-free differential set is legacy minus staged vehicles. No `DEPOT_VISIT_STARTED` ownership end reason. |
| F2 | `approach_refused_request_fraction` is required: unique eligible hub requests with ≥1 `APPROACH_FULL` minute / all eligible N; max increase 0.02. Apply pre-evaluation headroom rule. Ordinary curb refusals are not `rejected_actions`; invalid proposals or broken accepted-reservation invariants are `INVALID_SIMULATION`. |
| G3 | OD-3/OD-4: depots [west,east], car i at depots[(i−1) mod 2]. Rank all west cars by stable index then all east cars by stable index, j=1..V. With integer p=ojai_share_pct in [0,100], Ojai iff floor((j*p+99)/100)−floor(((j−1)*p+99)/100)=1. Integer products first. Total ceil(V*p/100); not prefix-stable. OD-5: nearest eligible preparation by hub route km, lowest stable index ties. |
| G5 | Same-minute request order uses `src/core/keyed.js` with `(seed,'n2-same-minute-order',source-kind literal,integer ordinals)`. Never use request ID strings. Parts are safe integers/fixed literals without `\|`; this channel is unique. |
| R2 | Required background boarding-within-target guardrail, max harm 0.02. Event gains cannot offset it. |
| R1 | Forecast preparation maintains replenished target `min(staging capacity,sum of visible counts)`; it is not a depletable budget. |
| R4 | Forecast arm can commit up to C_app+C_stg vehicles; this asymmetry is part of the treatment. Use C_app and C_stg for approach and staging capacities; A denotes only the available-vehicle set in rule 5a. |
| R5 | First N2 version omits `resources`; associated metrics say “not modeled”, never 0. |
| R6 | Two admission passes, before and after dispatch/preparation. At most one boarding start per berth/minute. b=0 is allowed. No admission, dispatch or preparation at H. |
| F5 | Terminal boarding status is exactly BOARDED, ABANDONED, CENSORED_ASSIGNED or CENSORED_UNASSIGNED. Preserve historical max-wait value under label “historical max arrival-or-horizon age”. |
| G6 | Events and background use keyed draws through `src/core/keyed.js`, distinct channels, and a registered cross-seed independence check. Legacy generation is unchanged. |

## 3. Frozen mechanism, inputs and identities

### 3.1 Region and allowed configuration

Proposed registry entry: `nv-las-vegas-demo`, graph `nv-las-vegas-schematic-1.0.0`, reference schema `region-package-1.0.0`. Nodes in stable order are west (0,4000), north (4000,8000), central (4000,4000), east (8000,4000), hub (4000,0), in local meters. Undirected edges are west–central, north–central, central–east, central–hub, east–hub. Edge distance is Euclidean meters / 1000; paths are shortest declared graph paths. Thus the first four edges are 4 km and east–hub is sqrt(32) km. Unknown/disconnected paths fail, never substitute a straight line. Route tie-breaking is lexical node-ID order as in the existing region helper. Depots are west and east, in that order.

Only the four ordinary nodes are background origins/destinations and event destinations. The hub is event-only pickup and never a drop-off. Initial cars are depot-only under G3; no uncounted initial hub supply. Provenance separately names synthetic geometry, demand, walking, dwell, access, vehicle and service assumptions; records units, source ID/date, transformation and unavailable measurements. `America/Los_Angeles` is display metadata; elapsed integer minutes have no date/DST computation.

Whitelist: Vegas + events + curb + existing fixed-capacity charging/readiness. Omit `resources`; disallow `airport`, `launch`, `site_power_profile`, Street coupling and foreign region packages. S1 freezes the exact charging/readiness settings and policy; no dynamic power/port observation or outage is implied. Mandatory depot work remains software when scheduled, cleaning, charge-to-target and upload. Queue, boarding and staging idleness add no auxiliary draw in this slice. That omission is not a statement about real standby/HVAC energy.

Nominal bounds below are intersected with the full Rmax inequality in §7; none independently guarantees admission. N2 uses integer `horizon_min=H` and `intake_min=I`; reject any config for which `Math.ceil(duration_hours*60)!==H`. Of integer horizons 1–1440, 27 fail a hours/minutes round-trip today; H=250 is one. N2 Ojai count is ceil(V*p/100), whereas legacy uses round (V=10, p=33 gives 4 versus 3).

Bounds: 1–120 cars; two fixed depots; `0<I≤H≤1440`; at most 1,000 potential event parties; at most two event IDs; integer spread/walk/release/forecast times 0–1440; conversion [0,1]; installed berths 1–8; approach capacity 1–24; staging capacity 0–24; additional dwell 0–30; target T 1–60. Existing profile bounds and operational validation remain. All request and publication IDs are bounded generated identifiers, not arbitrary user text. S1 may register the explicit control-only approach=40 exception; ordinary N2 inputs do not gain it implicitly.

Condition version `curb-condition-1.0.0`: at most 48 contiguous nonoverlapping half-open segments exactly cover [0,H), with unique usable berth IDs from inventory. Zero usable berths is valid. Unknown keys/versions/IDs, duplicates, gaps, overlaps, mixed region references and nonfinite values reject before execution. Approach/staging capacity is fixed. A closed occupied berth drains existing boarding; closure never cancels or shortens its b. No new admission until it is usable and free.

### 3.2 Demand and keyed order

Each event has a pinned event ordinal (event-1→0, event-2→1), party ordinals 1..count, release minute L, integer spread W, walk w and conversion p. A potential party converts iff its conversion draw <p. Ready/creation minute is `L+floor(spread_draw·(W+1))+w`; converted parties with creation ≥I remain in exclusion reconciliation. Event destination is [west,north,central,east][floor(u*4)]. No per-party dwell draw exists. Forecasts are separate exogenous inputs, not computed from realized demand.

Background generation preserves the declared synthetic rate/weather/time-of-day formula but uses a keyed count draw at each minute and keyed origin/destination draws by **background ordinal**, unaffected by event insertion or filtering. Rate r produces floor(r) plus one iff count_draw < fractional(r). Origin is uniform over the four ordinary nodes; a distinct destination uses weight `1/(2+route_km)^1.5` in stable node order. S1 must freeze whether time-of-day modulation is disabled; no evolving UI default may choose it.

Publication rows are `{id,event_id,published_min,expires_min,wave_min,predicted_count}`. Times are integers in [0,1440], predicted_count is an integer in [0,1000], publication precedes exclusive expiry, IDs are unique generated bounded identifiers and event references exist. Preparation lead is a single global integer `preparation_lead_min` in [0,1440], not per row. Visibility is published_min ≤ t < expires_min; the preparation window also requires t ≥ wave_min−lead. Publication need not equal realized release plus walking.

Background ordinals are 1-based in (minute, within-minute index) order over [0,I). IDs are pure functions of source_kind and immutable ordinals: `n2-background-${ordinal}` and `n2-event-${eventOrdinal}-${partyOrdinal}`; never a shared request counter. Weighted background destination uses stable options excluding origin, verbatim legacy subtract-accumulate procedure (`bay-operations.js:69–70`):

```js
let cursor=choice()*options.reduce((sum,p)=>sum+p.weight,0),to options.at(-1).id;
for(const option of options){cursor-=option.weight;if(cursor<=0){to option.id;break;}}
```

Here choice supplies the one keyed destination draw, not a legacy RNG stream.

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
4. **Admission pass A, t<H:** process arrived approach owners by `(arrival_minute,reservation_seq)`. For each, select the lowest-index usable, free berth with no boarding start yet at t. Transfer approach→berth atomically, record boarding and b, and mark this berth used-for-start at t. If b=0, depart/release immediately but keep that mark through pass B. Unusable/full berths cause waiting, not a rejected action.
5. **Dispatch, t<H, one whole pass:** snapshot the requests waiting at this step's start, in §3.2 order. Each gets exactly one outcome for [t,t+1), at its own turn. For a hub request check curb first: if inbound+queued≥approach capacity, emit APPROACH_FULL; evaluate feasibility only for descriptive `idle_feasible_vehicle`; reserve nothing, consume no car, and continue. Otherwise, if no available car remains, emit NO_AVAILABLE_VEHICLE. Otherwise use the existing energy screen below, choose the nearest passing car (lowest stable index ties), reserve approach for hub assignment, emit ASSIGNED and start pickup. No passing car means ENERGY_INFEASIBLE and continued waiting. Continue classifying after cars run out: full hub remains APPROACH_FULL, other requests NO_AVAILABLE_VEHICLE. A zero-distance hub assignment joins the arrived queue for pass B; it never bypasses pass A's earlier arrivals.

   **One energy screen:** `maximumRange(X)=max(0,max(v in X,(soc(v)−reserve(v))/(intensity(v)*weatherEnergy)))`, with the empty maximum 0. `rangeOK(r,X)` iff trip_km+nearest_return_km ≤ maximumRange(X)+1e−8 km. `pass(r,v)` iff soc(v)+1e−8 kWh ≥ (pickup_km+trip_km+nearest_return_km)*intensity(v)*weatherEnergy+reserve(v). `screen(r,v,X)=rangeOK(r,X) AND pass(r,v)`. At each turn X is the remaining available cars, including arrived staged cars. `idle_feasible_vehicle=exists v in X:screen(r,v,X)`. Dispatch selects only passing cars; recompute X and its maximum after each assignment. In 5a use final A: trigger iff A is nonempty and some final waiter fails screen for every v in A; E is exactly non-staged v in A failing screen for every final waiter. Keep both source tolerances and their distinct units.

5a. **Energy-recovery fallback, after the pass, before preparation:** A is the final available set, including arrived staged vehicles; R is the final waiting set. Re-evaluate the same range bound over A and per-vehicle screen. Fire iff t<H, A nonempty, and at least one r in R fails for every v in A. Apply in stable vehicle order to exactly `E={v in A: v is not staged AND v fails the screen for every r in R}`. Each E vehicle enters the persistent energy-blocked set and, if below target, attempts the existing nearest-depot/reachability/load-tie visit, settling zero-distance depot travel. A vehicle passing any waiting request is not in E. If E is empty the trigger can still be true. Staged cars remain in A and its range bound, but never E. Inbound preparation/pickup, queued, boarding, passenger-trip and at-depot cars are not available and are exempt.

   Fallback reads energy-screen results, not reason codes. An APPROACH_FULL request may trigger 5a if independently infeasible for all final A; refusal alone cannot. Since refusal can change later assignments, it can indirectly change final A and fallback actions. Report triggering request IDs, their dispatch reason and final-screen result, and separately count fallback block events/started visits in minutes with ≥1 refusal. Do not claim an absolute absence of indirect effects. Refusal-free differential testing compares the same final state against legacy `waiting.length` behavior, subtracting staged cars. Preserve all non-N2 replay bytes.

6. **Forecast preparation, after 5a, t<H:** desired stock is `min(C_stg,sum(count for currently visible publications with opened preparation windows))`. Inbound and arrived staged cars both count, regardless of which publication caused them. Choose the nearest eligible, available, non-staged car by route km to the hub; ties use lowest stable index. Skip ineligible cars. Recompute stock after each start and stop at desired stock. An available non-staged car at the hub is INVALID_SIMULATION. Reserve the lowest free staging slot **before** repositioning. G1 first deducts reposition energy to obtain predicted arrival SOC, then requires screen(r_d,v_arrival,{v_arrival}) for every declared hub destination d. This includes the coupled passenger-plus-nearest-return maximum and both legacy tolerances. Do not stage using only hub→depot return. Record all supporting publication IDs, visible counts and target at each preparation start. A target is replenished after assignment; cumulative starts can exceed forecast count. Expiry stops additions and removes nothing. Cars remain staged until assigned or H; no recall/teleport/5a depot escape. Hub assignment exchanges staging→approach atomically; non-hub assignment releases staging at pickup travel start.
7. **Admission pass B, t<H:** same FIFO and berth selection as pass A, using the same per-berth used-for-start marks. This allows an idle berth to admit a newly assigned zero-distance car at t but never a second start on a berth at t.
8. **Depot allocation, accounting and interval:** under the existing rules start eligible depot work only if t<H, allocate fixed-capacity charging, validate/record state, and execute [t,t+1). At H perform final validation and classification only, retaining all open reservations and unfinished work. No new dispatch outcome at H. Non-hub arrival settlement has no berth admission and retains its existing boundary behavior, specified in §5.1.

Approach is conservative reservation-based admission, not a road spillback model. Reservations held in transit can leave installed berths idle and block an already-staged car. Arrival-order admission permits an arrived later reservation before an earlier still-inbound reservation. Forecast preparation can commit approach capacity C_app plus staging C_stg; this treatment asymmetry is disclosed, not silently normalized away.

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

The no-admission-at-H rule is a **berth admission** rule, as in v1 line 95. Existing non-hub arrival settlement starts its unconstrained boarding at H (`bay-operations.js:159–161`), records BOARDED and consumes no [H,H+1) interval; hub arrival at H remains CENSORED_ASSIGNED. This cohort-asymmetric terminal distinction is retained pending OD-9; §9.17 pins both cases. This distinction preserves the existing non-hub lifecycle rather than inventing an unmodeled resource. `picked_up_minute` remains arrival, never renamed to mean boarding.

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
| PASSENGER_TRIP × completion | Travel elapsed | AVAILABLE or DEPOT_INBOUND (or the first queued service state after zero-distance settlement) | Request completion; visit/energy records | Existing trips/reserve trigger retained only at t<H |
| AVAILABLE × 5a | In E; below target and reachable depot | DEPOT_INBOUND / queued service | FALLBACK_PASS; existing visit; energy leg | Staged cars cannot take this transition |
| AVAILABLE × 5a unreachable / at target | In E, visit cannot start or not below target | Remains available, persistently counted blocked | FALLBACK_PASS with attempted/started distinction | No fabricated visit; blocked is cumulative unique-car count |
| DEPOT_INBOUND / service × elapsed transition | Existing stage/worker/port/energy requirements | Serial required work → ready → AVAILABLE | Existing visit/task/stage records + energy | Mandatory work cannot disappear; no incomplete release |
| Free usable berth × closure | Condition tape boundary | Free unusable berth | Condition tape / derived boundary | No new boarding |
| Occupied berth × closure/reopen | Condition tape boundary | Occupied draining / occupied usable | Tape + unchanged interval | Occupied counts against installed capacity, not usable capacity |
| Staging × forecast expiry | t=exclusive expiry | Target may fall; holdings unchanged | Forecast tape; terminal/interval records | Expiry cannot release or recall a car |
| Any holding × H | Still owned after settling | Remains open | End fields null, end_reason OPEN_AT_H | No synthetic release at H |

At every ordered transition: one holder per resource; each car occupies at most one of staging/approach/berth; each request at most one assigned car; inbound+queued≤approach; inbound+arrived staged≤staging; occupied≤installed berths. Atomic transfers close the old interval and open the new one at one transfer sequence boundary. A full resource is ordinary waiting; a proposal to a nonexistent/unusable resource or duplicate owner is invalid even if it grants no capacity.

## 6. Metric dictionary and decision contract

This is the complete N2 reporting contract. No UI-only score or inferred measurement is permitted. Each metric below has an exact population and empty-population rule. Counts/sums over a **modeled, empty** population are 0; that convention never makes an omitted mechanism 0. Null is serialized explicitly and displayed “Not available” (or “Not modeled” for an omitted mechanism). Missing, null, nonfinite or invalid required values block comparison before the shared instrument, which must never receive null as 0.

Version abbreviations: **P**=`pickup-metrics-1.0.0` (new); **`B2`**=`bay-systems-metrics-2.0.0` (N2 definitions, retaining stated legacy formulas); **D1**=`depot-readiness-metrics-1.0.0` (unchanged optional existing readiness). A dictionary family expands to every listed key; its stated population/null rule applies to each member. No unlisted N2 aggregate may be rendered or silently added to compact exports without dictionary/version review.

Let Q be all eligible requests with creation<I, N=|Q|, Qbg be those with source_kind=background, Qe the requests of event e, and Qevents their union. Completed means completion time≤H. Boarded means boarding start exists. For any cohort C, define W=boarded with start−creation≤T, L=boarded with delay>T, M=unboarded and (abandoned OR creation+T≤H), Pn=unboarded, not abandoned and creation+T>H. Exactly W+L+M+Pn=|C|. Terminal boarding statuses independently partition C: BOARDED (including completed trips), ABANDONED, CENSORED_ASSIGNED, CENSORED_UNASSIGNED. “Pending boarding outcome” is Pn; “Waiting for assignment” is lifecycle WAITING, not Pn.

### 6.1 Primary and required guardrails

Limits below are the owner-adopted design limits, to be reaffirmed before evaluation in S1. Harm is the mean across paired **seed-level** differences, candidate−baseline for lower-is-better and baseline−candidate for higher-is-better. Strict IEEE-double harm>limit is REGRESSED; machine equality is within, with no decimal rounding or rational-arithmetic substitution. Never offset one guardrail with another or a primary gain.

| Key / version / origin | Exact value and population | Null / unit | Role, direction, limit and request equivalent |
|---|---|---|---|
| `completion_fraction` / `B2` / legacy criterion, N2 estimand | Number of Q completed by H / N | Null if N=0; fraction | Primary higher-is-better; practical margin 0.02. At illustrative N≈116, 2.32 requests/seed; freeze actual N-specific equivalents. |
| `max_request_wait_min` / `B2` / legacy formula | max over Q of `(picked_up_minute ?? H)−created_minute` | Null if N=0; min | Guardrail lower-is-better, 5 min. Request equivalent not applicable: a maximum, not a request count. Label **historical max arrival-or-horizon age**. |
| `unfinished_visits` / `B2` / legacy | Count of all started depot visits with completion null at H; denominator 1 run | 0 if no visits; visits | Guardrail lower-is-better, 0 visits. Request equivalent not applicable. |
| `terminal_energy_kwh` / `B2` / legacy | Sum of battery energy at H over all starting cars; denominator 1 run | Required finite, fleet nonempty; kWh | Guardrail higher-is-better, 5 kWh. Request equivalent not applicable. |
| `rejected_actions` / `B2` / legacy numeric population, corrected text | Count of failed charging-power proposals plus candidate-port rejections where planner saw an eligible port but truth rejected it; denominator 1 run | 0 if modeled population has no rejection; actions | Guardrail lower-is-better, 0. With resources omitted, the candidate-port component is absent and contributes no records; this does not report omitted port metrics as zero. Curb refusals never count. |
| `boarding_within_target_fraction` / P / new | W(Q)/N; late, missed and pending stay in denominator | Null if N=0; fraction | Guardrail higher-is-better, 0.02; ≈2.32 requests at N≈116. |
| `background_completion_fraction` / P / new | Completed(Qbg)/\|Qbg\| | Null if \|Qbg\|=0; fraction | Guardrail higher-is-better, 0.02; ≈1.20 requests at \|Qbg\|≈60. |
| `background_boarding_within_target_fraction` / P / new | W(Qbg)/\|Qbg\|; full background population | Null if \|Qbg\|=0; fraction | Guardrail higher-is-better, 0.02; ≈1.20 background requests at 60. Required R2 protection. |
| `approach_refused_request_fraction` / P / new | Distinct q in Qevents with ≥1 APPROACH_FULL interval / N | Null if N=0, including if hub cohort also empty; if N>0 and no hub requests, 0; fraction | Guardrail lower-is-better, +0.02; ≈2.32 requests at N≈116, 1.76 at N=88. Ceiling \|Qevents\|/N. |

There are **eight guardrails**: four historical, all-request boarding, background completion, background boarding and approach refusal. The same integer loss can have a different fraction in different seeds; “2.32 requests” is an explanatory equivalent, not rounding permission or a replacement decision rule. For one seed at N=116, two extra refused requests give 2/116<0.02; three give 3/116>0.02. Freeze each seed/cell denominator and equivalent before reporting, with the applicable aggregate rule.

For every registered cell using the refusal guardrail, tuning-seed reactive headroom must be at least 0.02 below its ceiling. The S1 check must state its aggregation and pass rule before inspection. If it fails, the owner registers a minutes-based limit or descriptive status, with rationale, **before evaluation**; this document does not preselect that alternative. Exposure is not delay: a refused request might have no idle feasible car, and an eventual abandonment can follow refusal.

Historical maximum detail per arm/seed stores attaining request ID, terminal boarding status and lifecycle state; ties are earliest creation then stable ID. After abandonment, H−creation is an age penalty convention, not observed waiting. Assigned/not-arrived ages are right-censored arrival waits; unassigned-at-H ages are unresolved elapsed ages. V1 key, formula and 5-minute limit stay unchanged.

> **PENDING OWNER RE-DECISION OD-11** — replacement text: “For each registered cell, test saturation by comparing the reactive never-refused count with C_app × wave openings. Apply strict harm>0.02 to the pre-registered aggregate only when attainability is demonstrated; if saturated, make approach_refused_request_fraction descriptive. A minutes-based limit may replace it only after its own attainability check and explicit registration.” Operative F2 remains the fraction guardrail and v2 headroom rule above. Fixture deltas: F2 retains (1,4,2,1,0,0), N=5 and 0.4; F5 refusal counts, R6 and Packet(a) remain unchanged. Only a registered saturated comparison loses this guardrail’s ability to force HOLD; no campaign decision can be recomputed before registration.

> **PENDING OWNER RE-DECISION OD-12** — replacement text: “max_request_wait_min remains stored with the label historical max arrival-or-horizon age and its attaining request, but is descriptive rather than a required 5-minute guardrail.” Operative F5 keeps the 5-minute guardrail. Fixture deltas: F5 maximum=19 attained by A and all partitions are unchanged; comparisons regressed solely on this maximum would no longer HOLD. The R2 fixture remains HOLD.

> **PENDING OWNER RE-DECISION OD-26** — replacement text for R1 and desired_staging_stock_by_minute: “Visible includes an opened preparation window, t ≥ wave−lead. Desired stock=min(C_stg,sum of counts for published≤t<expires publications whose preparation window is open).” Step 6 already uses this gate; the operative dictionary retains the v2 published-only reading until owner clarification. Fixture deltas: §9.8 with lead=30 and publication=wave−30 is unchanged; F3, G1, G3, R6 and Packet(e) are unchanged. New boundary discriminator for a publication at t=0, wave=50, lead=30, count=1, C_stg=1, expires=80: dictionary target at t=10 changes 1→0; at t=20 both are 1. Flag this known dictionary/policy inconsistency for S1 resolution, never silently ship it.

### 6.2 New service, curb and policy diagnostics (all descriptive)

| Key / version | Exact numerator / denominator / population | Null rule; unit |
|---|---|---|
| `cohorts.{all,background,event_1,event_2,events}.requests` / P | Count of C / 1 cohort | 0 if empty; requests |
| `cohorts.C.{within_target,late,missed,pending}` / P | W,L,M,Pn counts in C / 1 cohort | Each 0 if empty; requests |
| `cohorts.C.{boarded,abandoned_status,censored_assigned,censored_unassigned}` / P | Four terminal boarding-status counts in C / 1 cohort | 0 if empty; requests; sum=\|C\| |
| `cohorts.{event_1,event_2,events}.completion_fraction` / P | Completed(C)/\|C\| | Null if empty; fraction. All/background use the required maps above; no duplicate fraction aliases. |
| `cohorts.{event_1,event_2,events}.boarding_within_target_fraction` / P | W(C)/\|C\| | Null if empty; fraction. All/background aliases equal guardrails; event-only values descriptive. |
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
| `dispatch_outcome_request_min.{ASSIGNED,NO_AVAILABLE_VEHICLE,ENERGY_INFEASIBLE}` / P | Count start-of-step-5 waiters with each outcome over t<H / 1 run | 0 if none; request-min; sum plus approach_refused_request_min equals all step-5 waiting request-minutes |
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
| `desired_staging_stock_by_minute` / P | min(C_stg,visible count sum) at each t<H / 1 minute | 0 if no active publication; vehicles; single-run detail only |
| `terminal_unused_staged_vehicles` / P | Staging inbound+arrived owners at H / 1 run | 0 if none; vehicles, not evidence that future service is impossible |
| `fallback_blocks_in_refusal_minutes`, `fallback_visits_in_refusal_minutes` / P | Number of E memberships / actually started 5a visits at t with ≥1 refusal, respectively / 1 run | 0 if none; block events / visits; distinguish from unique cumulative blocked-car count |

Single-run detail is produced by one pure model-side projection over §7 records, tested for exact equality with §6.2 totals. It adds dictionary keys `berth_draining_min` (occupied intersections with unusable intervals; 0 if none; berth-min), `approach_queue_min_by_request` (min(boarding??H,H)−arrival for hub arrivals; null otherwise; min), `approach_inbound_by_minute` and `approach_queued_by_minute` (ownership-derived integer counts at each post-pass boundary; 0 if none; vehicles). Their time sums equal the corresponding totals, including zero-duration ownership. UI never reimplements accounting.

### 6.3 Retained base and depot diagnostics (descriptive unless aliased above)

These formulas remain unchanged; N2 newly includes approach-queued requests in `in_progress_trips`. Each `B2` row is a legacy formula under the explicit N2 population. Ratios/means never use a hidden successful-only population.

| Key / version | Exact value / population and denominator | Null rule; unit |
|---|---|---|
| `fleet_size`, `depot_count` / `B2` | Frozen initial counts / 1 run | Required positive; cars / depots |
| `total_requests`, `completed_trips`, `unserved_requests`, `pending_requests`, `in_progress_trips` / `B2` | N; completed; abandoned; waiting; pickup+approach-queued+boarding+passenger-trip counts / 1 run | 0 if no requests; requests; partition sums N |
| `trips_per_vehicle` / `B2` | Completed trips / starting fleet size | Fleet cannot be empty; trips/car |
| `avg_wait_min_completed` / `B2` | Sum(arrival−creation) over completed requests / completed count | Null if no completed requests; min; **arrival-based completed-request wait** |
| `avg_trip_min_completed` / `B2` | Sum(completion−arrival) over completed requests / completed count | Null if no completed requests; min; **arrival-to-completion**, includes curb queue |
| `avg_depot_onsite_min`, `avg_depot_turnaround_min`, `avg_active_service_min` / `B2` | Completed-visit sums of completion−arrival, completion−start, active_service_min respectively / completed visits | Null if none; min |
| `completed_visits`, `censored_visits` / `B2` | Completed / unfinished started visits at H / 1 run | 0 if none; visits; censored alias=unfinished_visits |
| `max_queue` / `B2` | Maximum single depot-stage queued-car count over observed boundaries 0..H / 1 run | 0 if no queues; cars |
| `initial_energy_kwh`, `final_energy_kwh`, `energy_delivered_kwh`, `energy_consumed_kwh` / `B2` | Fleet sums of initial battery, terminal battery, delivered battery energy, executed travel energy / 1 run | Required finite; sums 0 only when actually zero; kWh; final aliases terminal_energy |
| `energy_balance_error_kwh` / `B2` | Initial + delivered − consumed − final / 1 run | Required finite; kWh; validity tolerance abs≤1e−6, not a policy guardrail |
| `distance_km` / `B2` | Sum executed distance of all travel purposes, including partial legs / 1 run | 0 if no travel; km |
| `energy_blocked_vehicle_count` / `B2` | Cardinality of persistent blocked-car set (5a plus unchanged reachability failures) / 1 run | 0 if none; cars; not refusal count and never decremented on recovery |
| `service_breakdown.stage.{completed_count,avg_active_min,avg_queue_min}` / `B2` | Stage rows in completed visits: count; sum active/count; sum(start−queued)/count | Count 0, means null if none; tasks / min / min; stage in software,cleaning,charging,upload |
| `by_vehicle_type.{vehicle_count,completed_trips,trips_per_vehicle,energy_consumed_kwh,energy_delivered_kwh,distance_km}` / `B2` | Same fleet measures restricted to starting vehicle type; trips/count for mean | Empty type: counts/sums 0, trips/vehicle null; units as corresponding fleet keys |
| `by_place.{total_requests,completed_trips,unserved_requests,pending_requests,in_progress_trips}` / `B2` | Same lifecycle partition restricted by pickup node / 1 place | 0 if no requests at place; requests |
| `charging.{visits,unfinished_visits}` / `B2` | All started / unfinished depot visits / 1 run | 0 if none; visits |
| `charging.{connected_vehicle_min,zero_power_vehicle_min,aged_job_minutes}` / `B2` | [0,H) charging-state car-min; subset with delivered power=0; queued/charging car-min with age≥frozen starvation threshold | 0 if none; vehicle-min |
| `charging.{queue_observed_min,active_observed_min}` / `B2` | Sum over charging-stage rows of (start??H)−queued; sum active minutes, including unfinished rows / 1 run | 0 if no charging rows; vehicle-min |
| `charging.unfinished_energy_kwh` / `B2` | Sum max(0,target−soc) for cars with unfinished visits at H / 1 run | 0 if none; kWh |
| `charging.{ready_by_deadline,missed_deadline,deadline_pending}` / `B2` | Visits completed≤declared deadline; completed late or unfinished with deadline≤H; all remaining started visits / 1 run | 0 if no visits; visits; deadline defined by frozen charging version/config |
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

HOLD follows any regressed required guardrail or regressed primary; IMPROVED with all required guardrails evaluable/within gives ADVANCE_TO_NEXT_TEST; INCONCLUSIVE maps to RUN_MORE_EXPERIMENTS; otherwise NO_RECOMMENDATION. A missing, null or nonfinite required metric blocks before the instrument, with no outcome, chart or recommendation. Pending OD-25, retain the v2 adapter INVALID_EXPERIMENT label; the proposal below changes only that state label. These are teaching experiment recommendations, never deployment permission. S1 must register whether any extension is allowed; the recommendation string alone does not authorize more seeds.

N2 retains completion as the decision criterion **under a new cohort and drain horizon**, not an identical N1 estimand. Never use N1 as an N2 baseline/trend. Show reactive headroom and detection limits beside unchanged/inconclusive results. “No recommendation” does not mean every service measure is unchanged. Report all guardrails and populations separately.

The exactly seven paired descriptives are `cohorts.events.boarding_within_target_fraction`, `cohorts.events.completion_fraction`, `approach_refused_request_min`, `preparation_starts`, `preparation_distance_km`, `terminal_unused_staged_vehicles`, and `berth_idle_usable_min`. Each cell’s frozen spec carries its registered pre-evaluation results; the surface prints them without recomputation. A descriptive unavailable in any arm/seed is excluded and shown “Not available”. Per-event deltas appear behind “Descriptive changes”; each guardrail’s seed-delta standard error appears beside its status (sample SD / sqrt(n), null for n<2). Event guardrails require registration before tuning.

Tie fixtures through the shipped instrument, n=12 identical seed pairs: N=100, timely 50→48 gives harm=0.020000000000000018 and REGRESSED. N=100, timely 2→0 gives harm=0.019999999999999997 and WITHIN. Both have mathematical harm 0.02; displayed rounding never overrides these machine decisions.

> **PENDING OWNER DECISION OD-25** — replacement text: “Required metric unavailable is a distinct comparison-blocked state, not INVALID_EXPERIMENT. Missing, null and nonfinite required values show no outcome, chart or recommendation and never reach the instrument.” Fixture delta: only unavailable-state labels change; all numerical fixtures and statistical decisions remain unchanged. The operative label remains INVALID_EXPERIMENT until decided.

## 7. Required accounting records, validation and retention

Accounting is required in every N2 single run, both arms of every seed, replay and control. `capture:false` suppresses frames and narrative only. Canonical accounting bytes are identical across capture modes; narrative curb/request/blocker text is rendered from records. Legacy non-N2 output remains byte-identical.

Proposed version: `n2-accounting-records-1.0.0`. A globally increasing safe-integer `seq` establishes transition order, including within-minute zero-length transfers. Final request rows reference their transition sequences. Stable resource order is approach-slot index, berth index, staging-slot index; sequence allocation follows §4, not wall time or rendering.

| Kind | Required fields and meaning |
|---|---|
| `REQUEST` plus immutable potential-party reconciliation | Stable IDs/ordinal tuple and all §3.3 exogenous fields; lifecycle_state; terminal_boarding_status; target_category; vehicle_id/type; nullable assigned_minute, picked_up_minute, arrived_pickup_zone_minute, boarding_started_minute, boarding_min, departed_minute, completed_minute, unserved_minute; pickup/passenger route/distance/duration outcomes; references to transition seq. No fabricated timestamp for an unreached stage. |
| `REQUEST_TRANSITION` / `VEHICLE_TRANSITION` | seq, minute, kind, identity, from_state, to_state, related request/vehicle/resource IDs, cause; nullable nonapplicable IDs. The completing vehicle transition carries post_trip_block=0, checked as an invariant; a nonzero block is invalid rather than unrecorded. Contains only bounded enum data, not narrative. |
| `OWNERSHIP_INTERVAL` | resource_kind (APPROACH/STAGING/BERTH), resource_id, vehicle_id, request_id (null for staging), start_minute, start_seq, nullable end_minute/end_seq, end_reason; staging interval also references its preparation start. |
| `DISPATCH_RUN` | seq, request_id, outcome, start_minute inclusive, end_minute exclusive, first/last turn sequence; maximal consecutive run of the same outcome. ASSIGNED is exactly one minute. APPROACH_FULL has run-length encoded `(start,end,idle_feasible_vehicle)` segments so a changing flag never loses a minute. |
| `PREPARATION_START` | seq, minute, vehicle_id, staging_slot, route, supporting publication IDs/counts, desired stock, before-stock, initial SOC, required energy and chosen destination-max bound. No realized future demand. |
| `FALLBACK_PASS` | seq, minute, final A/R identity lists; triggering requests with step-5 outcome and final-screen result; E; newly blocked IDs versus repeated memberships; visit attempts/started IDs; whether this minute had a refusal. Empty E with a true trigger is representable. |
| `ENERGY_LEG` | seq, vehicle_id, purpose (PICKUP/PASSENGER/PREPARATION/DEPOT), related request/visit, start/end (nullable if unfinished), route and full distance/duration, executed intervals/distance/consumption through H, start and last-accounted SOC. Includes partial legs. |
| `ENERGY_DELIVERY` and vehicle reconciliation | seq, vehicle/visit, accounted start/end, delivered battery kWh; starting and terminal SOC, battery and reserve; no duplicate booking of stage-delivered energy. Frozen visits/stage rows remain validation inputs. |

Ownership `end_reason` is exactly `{BERTH_ADMITTED,EXCHANGED_TO_APPROACH,NONHUB_TRAVEL_STARTED,BOARDING_COMPLETED,OPEN_AT_H}`. OPEN_AT_H requires both end fields null, and all other reasons require both finite and ordered. The set **excludes DEPOT_VISIT_STARTED**. A zero-minute interval has start_minute=end_minute with start_seq<end_seq; it is not dropped. Atomic exchanges share a transfer boundary (old end_seq=new start_seq). Holdings at H stay open rather than manufacturing [start,H) closure; length through H uses min(H,end??H).

### 7.1 Record production and state contract

A staging owner is any car holding a staging interval, inbound or arrived. A staged car is an arrived staging owner in STAGED_AVAILABLE; inbound preparation is unavailable. A denotes the final available set only; capacities are C_app and C_stg throughout.

Frozen vehicle states and legacy mapping: AVAILABLE→available, PICKUP_TRAVEL→pickup, BOARDING→boarding, PASSENGER_TRIP→passenger_trip, DEPOT_INBOUND→drive_to_depot, QUEUED_SOFTWARE→queued_software, SOFTWARE→software, QUEUED_CLEANING→queued_cleaning, CLEANING→cleaning, QUEUED_CHARGING→queued_charging, CHARGING→charging, QUEUED_UPLOAD→queued_upload, UPLOAD→upload, READY→ready. N2 adds PREPARATION_INBOUND (analogous movement to airport_reposition but distinct identity), STAGED_AVAILABLE (legacy available plus staging ownership), and APPROACH_QUEUED (new). No REQUIRED_DEPOT_VISIT state exists. Request lifecycle_state is WAITING, PICKUP_TRAVEL, APPROACH_QUEUED, BOARDING, PASSENGER_TRIP, COMPLETED or ABANDONED; target_category is WITHIN, LATE, MISSED or PENDING; terminal_boarding_status is the four-state F5 enum. The `B2` run partition remains completed/unserved/pending/in_progress.

| Record | Emission condition and sequence rule |
|---|---|
| REQUEST/reconciliation | One final row per immutable request/potential party; ordinal order, transition references preserved |
| REQUEST_TRANSITION / VEHICLE_TRANSITION | Every actual state change including depot queues, tasks, ready and release; §4 step order then stable vehicle/request order; zero-duration cascades settle immediately |
| OWNERSHIP_INTERVAL | Every acquire/transfer/release; lowest free approach or staging slot; atomic transfer shares end/start sequence |
| DISPATCH_RUN | Every examined waiter-minute; maximal same-outcome run with maximal idle-feasible flag segments; assignment is one minute |
| PREPARATION_START | Every accepted preparation, before travel, after slot acquire; includes all current supporting publications |
| FALLBACK_PASS | Exactly when the end-of-pass trigger is true, including empty E; sorted stable IDs in sets, visit attempts in stable vehicle order |
| ENERGY_LEG | Every movement start, including 0-km legs; zero leg has zero distance, duration, executed intervals and consumption, equal start/end timestamps, unchanged SOC |
| ENERGY_DELIVERY / reconciliation | Each charging interval and final per-car energy row; no duplicate stage-delivered energy |

For a zero-km ENERGY_LEG, zero applies to travel amounts, not identity, seq, absolute timestamps or battery SOC. Common record sequence follows §4; within an atomic action, transition and interval boundaries precede movement settlement. For each action allocate its transition seq first, reuse that causal boundary for atomic ownership ends/starts, then allocate its start-fact record, then ENERGY_LEG and immediate settlement transitions; skip nonapplicable records. Iterate multiple completions by stable vehicle index. Freeze these bytes in X1/S2 golden fixtures before registration.

> **PENDING OWNER DECISION C-32 (no OD number assigned in the owner’s 26-item register)** — replacement text: “Merge REQUEST_TRANSITION and VEHICLE_TRANSITION into one TRANSITION kind with an entity discriminator; replace ENERGY_DELIVERY with per-vehicle reconciliation; key maximal dispatch runs by (outcome,idle_feasible_vehicle); FALLBACK_PASS retains triggering requests, E, newly blocked IDs and visit attempts.” Until separately decided, the distinct v2 record kinds and flag segments above remain operative. Fixture delta: all accounting bytes, counts and digests change; F4 capture equality must be regenerated; scalar metric and lifecycle tuples do not change. No extra owner decision number is invented.

Every arm and seed receives runtime accounting checks, with test-time policy checks separately recorded under OD-6. Each result carries check_level (RUNTIME_ACCOUNTING or NODE_REGISTERED), checker version and registered-set identity. Browser-only runs outside the Node-checked registered set never show an accepted recommendation.

| Check | Runtime, every arm and seed | Test-time: fixtures, differentials, Node campaign harness |
|---|---|---|
| Reconciliation, three partitions, chronology, patience expiry | yes | none |
| One outcome per waiter-minute; maximal runs; totals | yes | none |
| APPROACH_FULL iff hub and occupancy ≥ capacity at its turn | yes; derive from ownership intervals/end reasons plus earlier assignments in §3.2 order; no new record | F2, R6 |
| NO_AVAILABLE_VEHICLE iff none available at its turn | yes, from vehicle states; DISPATCH_PASS optional | F2 |
| ENERGY_INFEASIBLE versus ASSIGNED; chosen car; idle_feasible_vehicle | engine-reported | F1, §9.14, G5; refusal-free legacy differential |
| 5a trigger and E membership | structure only: E ⊆ A, E ∩ staged = ∅, visits ⊆ E | F1/counterexample, §9.13–§9.14; refusal-free legacy-minus-staged differential |
| Preparation start: visible support, stock < desired, G1 energy | yes, PREPARATION_START fields and routes | none |
| Preparation completeness: enough starts; no eligible car skipped | engine-reported | G1, G3, F3, §9.18 |
| Ownership, capacities, FIFO, one start per berth/minute, drain | yes | §9.15–§9.16 |
| b rule; no dispatch/preparation/hub admission at H; staged persistence | yes | F3, §9.17 |
| Energy balance, summaries, digests | yes; canonical accumulation below | F4 capture equality |

Recompute request lifecycle_state, terminal_boarding_status and target_category independently from recorded times. Reconciliation retains all three partitions. Each car’s initial+delivered−consumed=terminal within 1e−6 kWh; per-car checks cannot be hidden by fleet cancellation. Match model/package/source/metric/record identities; missing or tampered records invalidate. Internal consistency is not model validity or authentication.

Canonical accumulation: each ENERGY_LEG accumulates executed distance and energy by minute, in the same operation order as `bay-operations.js:245–246`. Sum PREPARATION leg amounts in seq order, both distance and energy, retaining exact equality across engine, checker and fixture. Do not replace this with a global minute accumulator or full-leg arithmetic for partial legs.

Validation runs inside the proposed cancellable execution seam, including final hashing/serialization. Keep only one transient pair plus bounded checker state, then discard detailed arm records after validated scalar summaries and digests are retained. Replay the first seed's two arms and require exact canonical records, requests, visits and summaries; capture-mode equality is a separate test. The comparison keeps its replayed first-seed pair for display. Inspecting another seed re-runs it and draws only if both arms’ accounting digests match. The retained pair counts toward X1 peak-heap measurement. Single-run download retains records; compact paired export retains no per-minute series, animation frames, narratives or ownership rows.

**Declared design caps, not measurements:** let Qmax be total potential event parties plus the sum over intake minutes of ceil(maximum frozen background rate), P the potential-party count, V fleet size. Conservatively bound accounting elements, including nested run segments and fallback entries, by `Rmax=16·Qmax+P+4·Qmax·H+12·V·(H+1)+48`. Reject Rmax>500,000 before building a tape; the implementation must prove each kind is covered by this bound and enforce an actual-element counter as defense in depth. Suggested 40-car/240-minute/80-party/20-per-hour clear setup gives Qmax=260 and Rmax=369,568; this is a worst-case allocation bound, not a predicted record count. Lower validated workload bounds are acceptable through an explicit design revision; silent overflow/truncation is not.

Also enforce 1,500,000 comparison vehicle-minutes including two replay arms, with safe arithmetic. Serialized UTF-8 JSON caps: a compact positional single-run record encoding ≤1 MiB (1,048,576 bytes), with an explicit versioned field dictionary and lossless exact decoding; compact comparison ≤256 KiB (262,144 bytes). X1/S2 measures the encoding before accepting the workload. Full named-record exports are not silently squeezed into this cap; if positional encoding cannot fit, stop and separately decide a bounded full-record cap. A result exceeding a cap fails export/release acceptance explicitly, never truncates accounting. Record transient arm/checker memory and accumulated summaries separately; do not claim Rmax is a heap guarantee.

The accepted workload envelope is the inequality itself: `16*Qmax + P + 4*Qmax*H + 12*V*(H+1) + 48 <= 500000`, using safe integers, plus nominal bounds. V*(H+1) ≤ 41,666 and Qmax*H ≤ 125,000 are necessary only. At H=240, I=180, P=80, Qmax=260, maximum V=85; Rmax=499,708. V=86 fails. Large-fleet measurements use that explicit 85-car workload, not an inadmissible 120-car default. X1 must revise admission downward to a measured safe bound if necessary, or re-derive coefficients before changing record kinds. Incremental hashing uses `sha256Stream` plus sorted-key `jsonPieces`, preserving canonical bytes without a second giant string.

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

Composite model order is fixed: base Bay version, enabled existing readiness then charging versions, region reference version, event version, curb version, condition version, pickup metric version, accounting version. Separately store graph/package/source digests and `B2` metric identity. A composite string alone does not replace full immutable references.

Canonical N2 JSON uses the existing Bay canonical serializer's semantics (`bay-experiment-contract.js:11–22`): sorted plain-object keys; array order preserved; finite IEEE-754 shortest JSON number representation; explicit null; depth≤32; reject sparse arrays, undefined, nonfinite numbers and nonplain objects. SHA-256 is over UTF-8 canonical bytes. New graph digest covers the complete geometry object; package digest covers the complete resolved package including provenance and graph digest; source digest covers the exact provenance/source manifest; tape digests cover complete ordered immutable rows. Freeze digests in the spec. Never retrofit Austin's existing JSON-stringify-derived graph digest.

The canonical accounting digest covers `{version,model_version,metric_versions,package_digest,source_digest,seed,records,requests,visits}` with deterministic arrays and no frames, narratives or timing diagnostics. Store per-kind element counts, total count and digest for each arm of every seed. Compact v2 retains recomputed metric maps, scalar populations/terminal counts, historical-max attaining identity/status, counts/digests, validation result and exact seed. Full configs, tapes and provenance live once in the frozen spec; do not copy them into every seed. Retain replayable seeds/configs and raw machine values.

> **PENDING OWNER DECISION OD-8** — replacement text: “Merge pickup metric definitions into bay-systems-metrics-2.0.0; retain event-demand, curb-resources and n2-accounting-records identities.” Delta: version/composite/digest bytes change; no fixture values, populations, guardrails or lifecycle rules change. Until decided, the separate pickup identity above is operative.

> **PENDING OWNER DECISION OD-7** — replacement text for the deferral option: “Move the condition tape and its UI from N2.0 to N2.1; N2.0 has a constant usable-berth inventory.” Delta: §9.16 Packet(c) moves to N2.1; G4 uses an injected closure seam only for tests, not an N2.0 public configuration; S1 loss/recovery cells move too. Route A recommends retaining the tape, which is the operative v2 reading; no deferral is adopted.

## 9. Hand-traced acceptance fixtures

These are contract fixtures, not executed N2 results. Unless explicitly overridden, travel uses the §3 graph with start_hour=0, traffic_multiplier=1, weather=clear (all fixture minutes precede 420, so no travel ×1.25 window), energy-feasible cars, distinct creation minutes, patience longer than the window and `trips_between_visits=99`. Shared realization where a fixture does not override it: battery_kwh=80, reserve_soc_pct=10, charge_target_pct=80, energy_kwh_per_km=0.25. Fleet placement and type are injected unless labeled G3. The all-4-km unit graph enters only through a test-harness route seam; the public region validator rejects it. Unit-state injection is a declared test seam, with the complete entering state stated; it does not create an alternative public generator. IDs in expected tuples denote the frozen identities, not lexical ordering. Ranges [a,b) count b−a minute intervals. No fixture depends on G5 unless labeled G5.

### 9.1 F1: end-of-pass recovery, and its timing counterexample

Use a **unit graph with all five declared edges exactly 4 km**, depots west/east, energy intensity .25 kWh/km, reserve 8, target 64; no staging. At t=10, one inbound owner holds the single approach slot through this window. Newly available K at east has 10.5 kWh, B at central has 12, D at west has 8.5. Requests HubReq:hub→west, X:west→north, G:east→central were created at 7,8,9; before t=10 no supply was available. The required energies (including reserve) are:

| Request | K | B | D |
|---|---:|---:|---:|
| HubReq | 11 | 11 | 12 |
| X | 14 | 13 | 12 |
| G | 10 | 11 | 12 |

HubReq is APPROACH_FULL with flag true; X is ENERGY_INFEASIBLE; G assigns K (nearest). Final available set A={B,D}; HubReq passes B but X fails both. Trigger=true, E={D}; D starts a zero-distance west depot visit. Exact tuple `(assigned,blocked set,started visits)=(1,{D},1)`; B remains available. Counterreadings: unchanged legacy fallback `(1,{B,D},2)`; break on refusal, then legacy fallback `(0,{K,B,D},3)`; break with end-of-pass 5a `(0,{D},1)`; “some non-refused request waits, then legacy fallback” `(1,{B,D},2)`; suppress all fallback in any refusal minute `(1,{},0)`.

**Timing counterexample:** at t=10 use only B at central with 12 and D at west with 10.5; HubReq:hub→west created 8, G:central→west created 9. Full approach refuses HubReq while B could serve it; G then takes B (needs 9; D needs 10). Final D needs 12 for HubReq and fails. End-of-pass tuple `(1,{D},1)`; examination-time-only trigger gives `(1,{},0)`. Uncapped approach assigns HubReq to B, then G to D, giving `(2,{},0)`. This rules out the packet's absolute claim that refusal cannot indirectly alter fallback. No request reason is rewritten after its turn.

### 9.2 F2: whole-pass curb-first classification

Tape literals are `x`, `h1`, `b1`, `h2`, `b2`, N=5, I=120, H=140; `h1` and `h2` go hub→west, `b2` goes west→east. Inspect only [100,102), not earlier waiting history. One berth; approach=1 held by car Holder for eligible hub request `x`, created=97 and assigned=97, inbound until=103; staging=0; patience=12. Car A first becomes available at central at 100; all other cars unavailable. `h1` hub-created=98, `b1` central→north-created=99, `h2` hub-created=100, and `b2` background-created=101. Car A can serve every request at 100, takes `b1`, and remains busy beyond 102 (`trips_between_visits=99`; e.g. 2-minute boarding plus 4-minute trip).

| Minute / request turn | Outcome | idle_feasible_vehicle |
|---|---|---|
| 100 `h1` | APPROACH_FULL | true |
| 100 `b1` | ASSIGNED to A | Not applicable |
| 100 `h2` | APPROACH_FULL | false |
| 101 `h1` | APPROACH_FULL | false |
| 101 `h2` | APPROACH_FULL | false |
| 101 `b2` | NO_AVAILABLE_VEHICLE | Not applicable |

Exact window tuple `(assigned,refusal request-min,unique refused,no-vehicle request-min,energy-infeasible request-min,rejected delta)=(1,4,2,1,0,0)`; all six start-of-pass request-minutes classified. Full eligible N=5 includes the already-assigned request `x` and gives refusal fraction 2/5=.4. Request `x` is not a step-5 waiter in this window. Earlier refusal history may extend runs outside the inspected window; the table asserts exactly the window-restricted counts. The inspected fragment of `h1`'s refusal run is [100,102), with two flag segments; `h2`'s fragment is [100,102) false. Full-run records retain their maximal intervals beyond this inspection window.

Vehicle-first at-turn gives `(refusal minutes,unique,no-vehicle minutes)=(1,1,4)`; pre-pass snapshot gives `(2,2,3)`; after-pass attribution `(0,0,5)`. Counting attempts only omits downstream waiters; breaking prevents `b1` assignment. Unique counts alone cannot distinguish snapshot from correct behavior, so minutes are mandatory. A synthetic candidate−baseline `rejected_actions=1` would cause HOLD at limit=0; this fixture must add 0. Attempting an unknown berth or duplicate reservation is separately INVALID_SIMULATION, even when refused and no capacity granted.

### 9.3 F3: unequal profile dwell remains pair-compatible

Package graph; speed=60; `car-1` Ojai at west, profile boarding=4.2; `car-2` I-PACE at east, profile boarding=2; V=2, p=50 under G3 fix B. Complete entering-state seam: `car-2` is unavailable through minute 0, available at minute 1; no synthetic work/energy record. Both cars have enough energy; one berth, approach=1, staging=1, extra dwell=2; H=60, I=30, T=10. One eligible party `P` created=20, destination central. Forecast published=0, wave=20, exclusive expiry=50, count=1, lead=30. Nearest eligible preparation sends `car-1` west→hub at 0, arrival=8; baseline does not prepare.

| Arm | Assignment / arrival | Boarding / departure | Staging consequence |
|---|---|---|---|
| Forecast | `P`→`car-1` at 20 /20 | b=ceil(4.2)+2=7; [20,27); depart 27 | At 20 `car-1` exchanges staging→approach; preparation sends `car-2` east→hub, arriving=26. |
| Reactive | `P`→`car-2` at 20 /26 | b=ceil(2)+2=4; [26,30); depart 30 | No staging. |

Expected `(compatible,baseline b,candidate b)=(true,4,7)` with both per-run checks valid. Comparing realized car/duration/start falsely rejects; precomputing b=4 into the tape fails candidate recomputation 4≠7. Omitting ceil stores 6.2 and violates field equality even if integer stepping still departs=27. Without the injected minute-0 unavailability, nearest-first preparation sends `car-2` and erases this discriminator; the entering-state seam is essential under OD-5. This also exercises replenishment, packet(e), and pass-B same-minute admission.

### 9.4 F4: accounting survives capture=false

**Owner-precedence shift of the review fixture:** H=7, I=2, T=10; one berth, approach=1, staging=0; speed=100; b=3. `r1` created=0 and `r2` created=1 are distinct. Both cars are unavailable until minute=1, then one becomes available at each depot; this is a record-free entering-state test seam. Assert `r1` gets NO_AVAILABLE_VEHICLE at minute 0. West SOC is below target but energy-feasible; blocked={} and visits=0. I-PACE boarding=1, dwell=2 gives b=3. At 1 east car wins `r1` (sqrt(32) km, ceil(3.394…)=4 minutes); west car remains feasible and is never sent away solely for refusal. At 5 pass A admits `r1` before dispatch, releasing approach for `r2`.

Expected ownership tuples `(kind,car,request,start,end,end_reason)`:

- `(APPROACH,east,r1,1,5,BERTH_ADMITTED)`.
- `(BERTH,east,r1,5,null,OPEN_AT_H)`; b ends=8 after H.
- `(APPROACH,west,r2,5,null,OPEN_AT_H)`; 8-km/5-minute pickup due 10.

`r2` refusal run is [1,5), exactly 4 request-minutes. Its west pickup executes [5,7), distance `2·8/5=3.2 km`; east pickup executes sqrt(32) km. Expected `(within,late,missed,pending,completion,open holdings)=(1,0,0,1,0/2,2)`. Capture true/false canonical record bytes and digests must match.

Deleting the berth interval yields INVALID_EXPERIMENT, not vacuous success; logging-only accounting loses all intervals; closing both holdings at H loses terminal inventory; dispatch-before-admission makes refusal length 5 and moves west assignment to 6; completed-leg-only energy records west distance=0. The review's original window H=6, assignments 0/4 and arrival=4 is shifted by+1; no original same-minute creation tie is used.

### 9.5 F5: abandonment, censoring and the historical maximum

Package graph, speed=45, H=I=20, T=8, patience=3; approach=1, berths=1; one I-PACE at east, b=2+2=4, no staging. E hub→central created=0; A created=1; D created=16; B created=17; C created=18. E assigns=0, travels 8 minutes, boards=8, departs=12, completes central 18; no visit occurs. D then assigns=18, central→hub pickup takes 6 minutes, due 24. Other hub destinations are west (none is reached).

| Party | Exact terminal fields | Status / target category |
|---|---|---|
| E | assigned=0, arrival=8, boarding=8, departed 12, completed=18, unserved null | BOARDED / within; exact wait=8 |
| A | unserved=4; all assignment/service times null | ABANDONED / missed; abandonment wait=3 |
| D | assigned=18; arrival/boarding null at H | CENSORED_ASSIGNED / pending; right-censor age 4 |
| B | unserved=20=H; other times null | ABANDONED / missed; abandonment wait=3 |
| C | All assignment/service/unserved times null | CENSORED_UNASSIGNED / pending; unresolved age 2 |

Exact `(within,late,missed,pending)=(1,0,2,2)`, terminal status counts `(1,2,1,1)`, lifecycle `(completed,unserved,waiting,in_progress)=(1,2,1,1)`. Historical arrival-or-horizon ages are E age=8, A age=19, D age=4, B age=3, C age=2; maximum=19 attained by A, status ABANDONED. Boarding-wait distribution contains only E age=8. Calling A’s 19 observed waiting is false; replacing the historical metric with=8 changes its legacy formula; omitting expiry at H produces missed 1/pending 3. Pooling censor ages with exact waits loses status information even if its maximum happens to be 8.

### 9.6 R6: minute-100 trace and pass-B benefit

G3 fix B parameters: V=24, ojai_share_pct=20; Ojai cars are `car-1`, `car-8`, `car-11`, `car-18`, `car-21`. I-PACE boarding=4, Ojai boarding=0, additional_dwell_min=0, staging ≥ 1; `q40`, `q41`, `q42` go hub→west. Approach=4, berths `B1`/`B2`. At entering 100, `B1` holds `car-3` since=96 with b=4 ending=100; `B2` holds `car-7` since=98 with b=4 ending=102. `car-11` queued since=99 has reservation `r10` and b=0; `car-9` `r12` arrives=100; `car-5` `r13` arrives=104. `car-20`'s preparation arrives at 100, making it staged/available at step 1. `q40`/`q41`/`q42` are created=97/98/99; no feasible available supply existed earlier. A central `car-21` and a west preparation-eligible `car-22` become available 100. Forecast target=1 remains visible. For this trace `car-3`, `car-7`, `car-9` and `car-20` are I-PACE with b=4; `q41` pickup from central takes 4 minutes.

| Boundary | Exact effect / occupancy after it |
|---|---|
| Step 1 at 100 | `car-3` departs and frees `B1`; `car-9` joins `car-11`'s queue; approach owners={`car-11`,`car-9`,`car-5`}; `B2`={`car-7`}. |
| Pass A 100 | `car-11` boards/departs at 100 on `B1`; retain [100,100) berth interval; `B1` start mark used; approach={`car-9`,`car-5`}. |
| Dispatch 100 `q40` | `car-20` exchanges staging→approach `r14`; zero-distance arrival=100; owners={`car-9`,`car-5`,`car-20`}. |
| Dispatch 100 `q41` | `car-21` acquires `r15`, arrival due 104; owners={`car-9`,`car-5`,`car-20`,`car-21`}. |
| Dispatch 100 `q42` | APPROACH_FULL; flag=true because `car-22` is feasible; consumes nothing. |
| 5a/preparation 100 | No energy trigger from feasible `q42`; `car-22` starts one staging refill. |
| Pass B 100 | No berth can start: `B1` used, `B2` busy. Queue ordered `car-9` then `car-20`; inbound `car-5`/`car-21`. |
| Pass A 101 | Admit `car-9` to `B1`, b=4 [101,105); `car-20` remains queued. |
| Pass A 102 | `B2` frees and admits `car-20`, b=4 [102,106). |

Minute 100 tuple `(new boarding starts,assignments,refusals,approach inbound,approach queued,staging refill)=(1,2,1,2,2,1)`. Releasing-and-continuing would board `car-9` at 100 and violates one start per berth/minute. The distinct 97/98/99 creation times intentionally replace the review's three tied minute=100 creations without invoking G5.

**Pass-B benefit:** one party created=20, one staged car already at hub, a free usable berth, approach=1, b=0. At 20 dispatch transfers staging→approach; pass B boards/departs at 20 and records zero-length approach and berth intervals. Tuple `(assigned,arrival,boarding,departure)=(20,20,20,20)`. Omitting pass B boards=21; forbidding b=0 rejects a permitted input. No second request is needed, so there is no request-order ambiguity.

### 9.7 G1: preparation must afford a passenger trip

Package graph; I-PACE at west with=16 kWh, battery=84, reserve=15%=12.6, intensity=0.24; no waiting request after dispatch; target=1 and empty staging. Old screen requires `(8+sqrt(32))·.24+12.6=15.87764501987817` kWh and starts preparation. Correct screen takes max hub→destination+destination→depot =16 km (north), so requirement `(8+16)·.24+12.6=18.36` kWh. Correct tuple `(preparation starts,staging owners,SOC)=(0,0,16)`. A car at 18.36 passes at equality, arrives with=16.44, sufficient for north trip+return+reserve. A third point at 18.0 kWh yields (0,0,18.0). It rejects omitted destination→depot return (machine 16.439999999999998; display 16.44), destination average (16.779411254969542), and hub-return substitution (17.79764501987817). It does not reject decoupled maxima, which also gives 18.36 here. Numeric values were computed by the ignored fixture script cited in §9.12.

### 9.8 G2: cell tapes and stock timelines — OPEN pending S1

For these timeline examples lead=30 and H ≥ 165. The mechanism is fixed; **registration of cells/tapes remains OPEN pending S1**. The readings being ruled apart are explicit:

| Proposed cell / reading | Desired-stock timeline if release+walk is the wave | Competing reading / unresolved registration |
|---|---|---|
| Overlap, release=90/95, walk=5, count=28/28, C_stg=6; publish wave−30, expire wave+30 | Waves 95/100; publications [65,125),[70,130); target=6 over [65,130),0 otherwise | If “wave” is incorrectly taken as release, target=6 over [60,125). S1 must export exact wave/publication times. |
| Same overlap, `event2` conversion=0 but both forecasts unchanged | Exactly the same target [65,130); only realized `event2` requests disappear | Omitting forecast=2 instead changes target to [65,125), affecting only final=5 minutes. These are distinct interventions; conversion=0 is not forecast deletion. |
| Separated releases 60/130, walk=5, same publication offsets | Waves 65/135; target=6 on [35,95) and [105,165),0 between | Unchanged overlap forecast tapes would yield a different policy treatment. S1 must choose and name the complete tapes. |
| Dedicated false alarm recommendation | No `event1` forecast; `event2` conversion=0; separated timing gives target=6 [105,165) and no earlier preparation target | Reusing a true first forecast leaves residual stock; it is not the same false-alarm experiment. Start with empty staging and record it. |
| Same-policy / zero-staging controls | Same-policy identical; C_stg=0 makes desired stock 0 for every minute | Release condition, patience and exact tapes are still unregistered; do not select them after seeing an effect. |

These timelines are arithmetic examples, not an adopted condition matrix. Actual staged stock can persist above desired stock after expiry or between waves; target=0 does not mean inventory 0. S1 asserts target timelines before simulation and reports preparation starts by supporting publication afterward. Both possible readings are exposed, rather than pretending G2 has a frozen test tape.

### 9.9 G3: placement, integer shares and nearest eligible preparation

For V=40, p=50, fix B gives (`car-1`,Ojai,west), (`car-2`,Ojai,east), (`car-3`,I-PACE,west), (`car-4`,I-PACE,east), (`car-5`,Ojai,west), (`car-6`,Ojai,east). Assert 10 Ojai at each depot. Depot placement still alternates by index; type ranks are depot-major and are not prefix-stable. For V=2, p=50, `car-1` is Ojai and `car-2` I-PACE, preserving F3.

Integer counterexample: V=51, p=28, west ranks 25/26 give `car-49` I-PACE, `car-51` Ojai; east ranks 50/51 give `car-48` I-PACE, `car-50` Ojai. Floating ceil(j*0.28) swaps each pair. Both totals remain 15 Ojai, so assert the identities, not merely the total.

At t=10 injected car WCar is available west and CCar central; profiles identical, b=2, target=1, empty staging, speed=60, ample energy. Their indices are respectively (1,2), then (2,1) in a second independent snapshot. At t=18 a background west→central request is created. H=24; no other requests or supply. Nearest preparation sends CCar central→hub, 4 km, arrival=14, under both indexings. WCar takes the request at zero pickup distance and remains busy to H. The observable is the seq-ordered sum of executed PICKUP and PREPARATION ENERGY_LEG distance over [10,24); zero-km legs are emitted with zero numeric travel amounts under §7. Expected `(original indexing,reindexed,display-only rename)=(4,4,4)` km. The ruled-out array reading stages WCar from west and sends CCar 4 km for pickup, producing 12 km. A separate equal-distance central dispatch snapshot still chooses lowest stable index. These are policy/unit-state fixtures, not compatible treatment pairs.

### 9.10 G4: arrival averages differ from boarding wait

V=2, s=0.5; injected `car-2` I-PACE at east with boarding=4; the other car unavailable for the window. One request created=0; speed=60; arrival=6. Berth closed[0,12), usable from 12; approach=1; profile boarding=4, extra dwell=2, so b=6; destination west (8-km passenger leg). Exact tuple `(arrival,boarding,departure,completion)=(6,12,18,26)`. Let H=30,I=1,T=10. Legacy completed wait=6; legacy arrival-to-completion trip average=20; realized `trip_minutes`=6+8=14; approach queue=6; boarding wait=12 and target category LATE. Boarding fraction 0/1, completion 1/1. Reusing the arrival wait as boarding wait would claim within target; equating trip average with `trip_minutes` drops 6 queue minutes.

### 9.11 G5: keyed same-minute order, independent of ID spelling

Staging=0 and no visible publication. This is the only tied-creation dispatch fixture. At t=20 five hub requests are created together on an injected fixed tape: event/party tuples (0,1),(0,2),(0,3),(1,1),(1,2). Five feasible cars at central have equal pickup distance, stable indices 1..5; approach=4, no currently queued/inbound owners; berths closed for this minute so no pass-B release. All destinations are west. Seed 42. The ignored script calls the shipped `u64` helper with these exact parts:

| Ordered immutable tuple | Key | Exact u64 decimal |
|---|---|---:|
| (1,1) | `42\|n2-same-minute-order\|event\|1\|1` | 2669362755856042682 |
| (0,2) | `42\|n2-same-minute-order\|event\|0\|2` | 8183017667603177679 |
| (0,1) | `42\|n2-same-minute-order\|event\|0\|1` | 9171603845286686108 |
| (1,2) | `42\|n2-same-minute-order\|event\|1\|2` | 11790743780872775308 |
| (0,3) | `42\|n2-same-minute-order\|event\|0\|3` | 14517639462300572287 |

Expected assignments are (1,1)→`car-1`, (0,2)→`car-2`, (0,1)→`car-3`, (1,2)→`car-4`; (0,3) is APPROACH_FULL, flag=true from `car-5`. Tuple `(assigned,refused,rejected,remaining feasible cars at end of step 5)=(4,1,0,1)`. Rename request ID strings adversarially so lexical order reverses: these outcomes and ordinal-normalized records stay identical (the display ID fields themselves change). Reordering input arrays also changes nothing. Duplicate ordinal identity rejects; a fabricated equal draw uses the declared ordinal collision fallback. This rules out ID spelling, generation order and event-first lexical order as implicit policies.

### 9.12 G6: independent channels and stable exogenous identities

Computed with `node artifacts/fleetlab-n2-s0/fixture-values.mjs`, an **ignored, uncommitted arithmetic/key probe**, importing `src/core/keyed.js`; v2.1 rechecks in the new `fixture-values-v2.1.mjs` also use the shipped paired instrument. It is not N2 implementation or a seed-independence study. Seed 42, `event0` release=20, `event1` release=40, walk=5, spread=10, conversion=0.7; each event has three potential parties. Exact values from the shipped helper:

| Event/party | Conversion draw | Spread draw / integer | Destination draw | Eligible creation / destination |
|---|---:|---|---:|---|
| 0/1 | .2529533503111452 | .17345377570018172 /1 | .9293774357065558 | 26 /east |
| 0/2 | .4786067046225071 | .3134333021007478 /3 | .5515818598214537 | 28 /central |
| 0/3 | .084512879839167 | .7824973100796342 /8 | .7320282112341374 | 33 /central |
| 1/1 | .8402320332825184 | .8143402298446745 /8 | .18495461693964899 | Nonconverted; no request |
| 1/2 | .16424503992311656 | .8915959154255688 /9 | .9294191915541887 | 54 /east |
| 1/3 | .6991336403880268 | .9178879261016846 /10 | .3895256887190044 | 55 /north |

Use I=120, H=140. Event 1 conversion .7→0 removes its two requests but leaves every `event0` and background row byte-identical, including stable IDs; potential-party reconciliation changes only `event1` conversion disposition. Shifting `event1` release=40→75 moves its eligible creation 54/55 to 89/90 exactly+35, without changing conversion, destinations or the other rows. Do not wrap or shift the seed to simulate a release change.

For fixed background ordinals 1,2,3 with distinct injected creations 1,2,3, origin/destination draws are respectively `(.536830989876762,.1060402940493077)`, `(.529852885985747,.11639587441459298)`, `(.5837799324654043,.30511100217700005)`. Under the stated stable weighted mapping they all select central→west. This small coincidence makes no independence claim. Inserting/filtering/reordering event rows leaves all six draws unchanged. The probe enumerates 40 parties×2 events×4 channels +60 background ordinals×3 channels +180 minute-count keys = **680 distinct keys**, with no `|` inside a part.

Seed-42 background ordinal 4 has origin draw=0.8064631570596248 and destination draw=0.6054420692380518: east→central under weighted selection, versus east→north if incorrectly uniform. This discriminates the mappings that ordinals 1–3 cannot.

Required properties: event conversion/destination/spread channels are distinct; background generation has no event/global-array index input; same-minute-order draw is independent of all generation channels; a fixed input tape is unchanged by scheduling/capture/chunking; all legacy SFO v1 outputs remain byte-identical. A registered **cross-seed** independence check is still required in S1; key uniqueness and these mutation properties cannot substitute for it or validate sample independence.

### 9.13 Staged-vehicle 5a: owner D-F1b

Literal fixture config: horizon_min=20, intake_min=10, start_hour=0, traffic_multiplier=1, weather=clear, battery_kwh=80, reserve_soc_pct=10, charge_target_pct=80, energy_kwh_per_km=0.25, approach=1, staging=1, berths=1, patience=12, trips_between_visits=99. Use the F1 all-4-km graph through the test-only seam; inject S SOC=12.5 and D SOC=8.5. At t=10 staged S at hub has=12.5 kWh and an open staging interval; available D at west has=8.5. The only waiting request X, created=9, is W→N; no supply was available at 9. Staging was valid under G1: from the hub max passenger+return requires 12 kWh including reserve, below 12.5. X needs=14 from S and 12 from D; both fail. Final A includes S and D; maximumRange=(12.5−8)/.25=18 km; X lower bound 16 passes that bound but both per-car screens fail.

Exact `(trigger,final A,range,E,blocked set,started visits,staging owners)=(true,{S,D},18,{D},{D},1,{S})`. S stays staged with no interval end; D begins a zero-distance west visit. With only S in A, exact tuple is `(true,{S},18,{}, {},0,{S})`: a true trigger with empty E is valid. Removing S from A incorrectly changes the range/trigger (empty A in the single-car variant); including S in E sends it to a depot and invents an excluded DEPOT_VISIT_STARTED end reason. In this refusal-free state the differential selected set is exactly legacy `{S,D}` minus staged `{S}`.

### 9.14 Packet(a): full approach, useful background and below-target supply

F1 unit graph and shared energy realization. H=20, I=10, approach=1, staging=0, patience=12. No supply is available before t=2. Entering t=2, one inbound car owns the approach for an earlier assigned hub request; the owner remains inbound beyond this window. Car CCar at central has 12 kWh and spare ECar at east has 11.5 kWh. Hub request `h1` hub→west created=0 precedes background `b1` central→west created=1. At t=2 `h1` is APPROACH_FULL with flag=true. `b1` takes CCar (needed=9). Final A={ECar}; ECar can serve `h1` (needed=11), so no 5a trigger. Exact `(unique hub refused,refusal request-min in [2,3),background assigned,blocked,visits,rejected)=(1,1,1,0,0,0)`. The same tuple holds with the approach owner queued and all berths closed. Unchanged legacy line 204 blocks ECar and starts one visit: blocked=1, visits=1. A break or examination-time fallback gives assigned=0, blocked=2, visits=2. No off-map queue exists.

### 9.15 Packet(b): same-minute arrival, zero dwell and admission ties

Injected entering state, H=20: two hub requests `r1` and `r2`, created=8 and 9, are already assigned; their cars arrive together at 10 with approach reservation sequences 20 and 21 held respectively by `car-9` and `car-1`, deliberately opposing lexical label order. One usable berth, approach=2; b=0. Both arrivals settle before pass A. seq 20 boards/departs=10 with berth interval[10,10); seq 21 stays queued until=11, then boards/departs=11 with [11,11). Exact `(boarding minutes,starts at 10,queue minutes) = ([10,11],1,1)`. Per reservation `(seq,car,boarding,departure,queue)`: (20,`car-9`,10,10,0), (21,`car-1`,11,11,1). Swapping only vehicle display labels leaves reservation-order admission unchanged. Releasing-and-continuing gives [10,10] and violates R6; lexical vehicle ID before reservation sequence can reverse order. G5 separately tests tied **request creation**; these distinct creations test tied arrivals without a keyed dependency.

### 9.16 Packet(c): occupied berth closes and reopens

H=20, approach=2, additional_dwell_min=0, injected profiles boarding=5 for `r1` and boarding=2 for `r2`. One usable berth at 10. `r1` created=0, arrived/boards=10, b=5; `r2` created=1, arrived=11 and waits holding approach. Condition closes berth[12,14), reopens 14. The first interval stays[10,15), including draining occupancy[12,14); reopening 14 does not make it free. `r2` boards=15 with b=2, ends=17. Exact `(r1 end,r2 start,r2 queue,draining occupied min)=(15,15,4,2)`. Closing must not abort/restart b, release ownership early, evict `r1` or admit `r2` at 14. Berth usable=0 during closure, occupied=1; do not flag that valid drain as occupied>usable invalidity (installed count remains 1).

### 9.17 Packet(d): abandonment, horizon arrival, departure and completion

F5 supplies the full abandonment-versus-censoring trace, including expiry at H. Add independent single-request boundary fixtures, H=I=20 and T=8, with sufficient patience for each unassigned interval:

- Arrival exactly H: Z created=12 and assigned=12 at east, speed=45, hub arrival=20. Tuple `(arrival,boarding,status,target)=(20,null,CENSORED_ASSIGNED,MISSED)` because creation+T=H. Approach remains open; queue minutes=0 is an observed empty interval, not boarding success. A pass at H incorrectly boards Z.
- Previously started boarding ends H: Y created=10, boarding=16, b=4; at 20 departure is recorded and berth ends=20. Tuple `(boarding,departure,passenger intervals executed after departure,boarding status)=(16,20,0,BOARDED)`. It is within target; departure at H is allowed although new admission is not.
- Passenger trip ends H: K created=0, boards=10, b=2, departs=12, 8-minute passenger leg completes=20. Set K trips_between_visits=1. Completion 1/1; expected visits=0 (without the t<H gate, 1); no new required visit starts=20. Omitting terminal settlement loses this completion.
- Non-hub arrival exactly H: background west→north created=12, assigned=12 to an injected east-depot car, speed=60, I-PACE boarding=2, arrives=20=H. `(arrival,boarding,b,departure,status,target,executed boarding intervals)=(20,20,2,null,BOARDED,WITHIN,0)`. A hub request with the same times is CENSORED_ASSIGNED/MISSED.
- Creation exactly I: a converted event party ready 20 is excluded as converted_post_intake; no request row enters N. It cannot become a pending success at the horizon.

These independent cases have one creation each and distinguish three different boundary events; no tied request-order assumption is involved.

### 9.18 Packet(e): false/stale forecast replenishes after service

Package graph, speed=60, intensity=0.25, enough energy; boarding=2, dwell=0; staging=1, approach=1, berth=1, b=2, T=10, H=40. One forecast published=0, wave=10, expires=30 exclusively, count=1, lead=30; no second publication is active. `car-1` west, `car-2` east, `car-3` west (profiles identical for this trace). Event party `P1` created=10, `P2` created=20, both destination central; no other requests. No completed car returns to availability before the last preparation decision: `P1` departs=12, completes=16, then starts its existing required visit under the explicitly overridden `trips_between_visits=1`; visit duration is long enough that it remains unavailable through 20.

- t=0: desired=1, `car-2` starts east→hub sqrt(32) km, arrives=6; staging=1.
- t=10: `P1` takes `car-2` and boards=10 via pass B; staging exchange frees its slot. Same minute `car-1` prepares west→hub 8 km, arrives=18; target is replenished despite forecast count=1 already served.
- t=20: `P2` takes `car-1` and boards=20. `car-3` prepares west→hub 8 km, arrives=28. `P2`’s trip cannot complete before this preparation choice.
- t=30: forecast expires; desired=0; `car-3` remains staged. At H=40 it is still an open unused staging owner.

Exact `(forecast count,preparation starts,terminal staged,preparation km,preparation kWh)=(1,3,1,21.65685424949238,5.414213562373095)`; all three starts supported by the same publication. A depletable budget makes only 1 start; served-demand subtraction also changes behavior; expiry recall removes `car-3` incorrectly. Do not assert terminal unfinished_visits=0: both served cars can start required visits. Distance and energy use §7 canonical per-leg accumulation. This trace calls the forecast **stale in predictive content after service but still time-valid through 29**; an already-expired publication never authorizes a new start. It is a mechanics fixture, not S1's dedicated false-alarm cell. Arithmetic is quoted from the ignored fixture script.

### 9.19 R2: event gains cannot compensate for background timely harm

Constructed metric-map fixture, with 116 distinct eligible creation minutes in [0,180): background=60, event 56. Background within-target=50→40, event within-target=20→40; background completion 60→60, event completion 46→51. Other historical metrics and refusal counts are equal; all values are internally feasible cohort counts. Identical deltas across n=12 supplied fixture replications give completion delta 5/116, interval[5/116,5/116], above.02: IMPROVED. All-request timely service 70/116→80/116 improves, but background timely harm `(50−40)/60=1/6>.02`. Machine interval=[0.04310344827586199,0.04310344827586199], harm=0.16666666666666674. Fractions 5/116 and 1/6 are explanatory; decision strings are normative. Exact decision `(primary,background boarding guardrail,recommendation)=(IMPROVED,REGRESSED,HOLD)`. Omitting the required R2 guardrail could advance despite harm. This synthetic instrument fixture is not evidence about forecast performance or seed independence.

## 10. Open for S1: experiment registration, not implicit defaults

No evaluation seed is consumed or campaign registered by this document. The following owner decisions remain **Open for S1**, with the review's recommendation preserved. G2 is the only OPEN fixture family; concrete unit fixtures elsewhere intentionally choose local parameters and do not choose campaign settings.

| Open decision | Review recommendation / required S1 record |
|---|---|
| Patience | Choose one value explicitly and justify it in every cell tape. Existing default is 12 minutes; increasing it can saturate completion. Do not tune it to create a forecast gain. |
| All inherited parameters | Export a complete literal config, not a merge with evolving defaults. Name/justify time-of-day modulation (recommend disabled), traffic, speed, profiles, SOC thresholds, trips between visits, all depot capacities/durations, charging policy and readiness. Observed defaults below are context, not registration. |
| Tuning/evaluation seed blocks | Recommend 2501–2512 /3501–3512, instead of 2001–2012 /3001–3012 which are public four-area model seed sets. Freshness is model-scoped, procedural and unauthenticated. Record source search and inspection history; historical 1001–1012 are regression examples only. |
| Full condition matrix / G2 tapes | Freeze exact releases, ready-wave definitions, forecasts, patience, horizon and condition tape per cell. Proposed families: separated, overlapping, longer boarding, overlap with false second realization, berth loss/recovery, same-policy control, zero staging. Relabel overlap false-realization accurately. |
| Dedicated false-alarm cell | Recommend separated 60/130 timing, `event2` conversion=0, **no `event1` forecast**, initial staging empty. Register the full tape separately; do not assume the overlap false cell isolates wasted preparation. |
| Isolation cell / cells (OD-17, OD-22) | S1 recommendation: drop b=8 overlap from the completion primary; redesign isolation and screen patience=12 or 20. Recommend a single fixed approach bound 1–120 with no control-only exception, pending OD-22; the v2 1–24 contract/explicit control exception remains operative until decided. |
| Primary informativeness / positive controls (P1-B, S1-DEFERRED) | Before any forecast-arm run, for each registered cell and tuning seed, compute offline the tape-only curb-capacity bound B: completion with zero hub travel under the frozen tapes (events, background, publications and condition tape), the approach and berth capacities, the minimum b across profiles, patience, I, H and v2’s FIFO dispatch order, with background counted complete. B is a registration calculation, cross-checked against at least one hand trace; it never enters statistics and is not a second lifecycle. A cell is informative for the primary only if mean(B − reactive completion) exceeds the registered smallest detectable gain by the frozen factor OD-16; otherwise redesign the cell or register a separate primary before evaluation. The smallest detectable gain uses the paired seed-delta SD of the largest registered non-treatment contrast with frozen bootstrap options; report √2 × single-arm beside it. The positive control acts on the resource that binds in reactive diagnostics and must read IMPROVED. Show B beside every UNCHANGED or INCONCLUSIVE result. No forecast-arm result sets a threshold. Exact same-policy nulls remain required. Failed cells are redesigned or assigned a separately registered primary, never rescued by favorable-metric selection. |
| Refusal ceiling headroom | Apply F2's ≥.02 below \|Qevents\|/N rule on reactive tuning results, with frozen aggregation/pass rule. If failed, owner registers minutes-based limit or descriptive status before evaluation, with rationale. |
| Cross-seed independence | Register a well-mixed keyed-background/event independence check: exact seeds/sample size, origin/destination/count statistics, expected reference distribution, acceptance bounds and disposition. Different seed integers alone do not cure a weak RNG. No such check has been executed here. |
| Detectable effect / dispositions | Record tuning SD and smallest detectable gain; explain margin=.02 requires the whole interval above.02. Show headroom beside UNCHANGED and mark below-detectable effects uninformative. Keep null, mixed and adverse results. |
| INCONCLUSIVE extension | Decide no extension, or one preregistered extension with exact additional seeds, maximum≤40, stopping rule and combined-analysis method. Never add seeds merely because the first result is inconclusive; do not pool cells. |
| Reaffirm tolerances / nulls | Reaffirm all eight guardrail directions/limits, primary margin, exact per-cell/seed denominator and request equivalent, null rules, bootstrap options and all required-cohort checks. These are prototype value judgments, not operational standards. |
| Control execution and retention | Register exact control axes/tapes/seeds and campaign execution count. At 12 paired seeds a cell costs 24 evaluated arms+2 replay arms=26. Five cells 130; plus two controls 182; plus isolation 208; an additional false-alarm cell adds 26. These are arithmetic, not a frozen campaign. |
| Registration/inspection log | Commit/source identity; package/source/tape/model/metric/accounting digests; config; check rules/results; seed searches; dispositions; append-only results-inspection log. Distinguish correctness fixes from outcome-informed policy tuning; the latter requires new version and reserved block. |
| Walkthrough engine | Deferred to later P0 work. Decide which model teaches the walkthrough; S0/D1 does not relabel one engine's result as another. |

Additional S1-only recommendations, not §3–§7 contract:

| Open decision | Required S1 recommendation / registration |
|---|---|
| OD-11 / OD-12 | Resolve the class-b boxes in §6 before evaluation: refusal saturation/attainability and historical maximum role. |
| OD-13 terminal energy | Decide after placebo control; default descriptive plus a pre-registered normalized preparation-energy measure. Keep current guardrail until decided. |
| OD-14 unfinished visits | Reaffirm limit=0 with measured placebo false-HOLD rate, or make descriptive; no silent relaxation. |
| OD-15 charging / C-18 | Require charging with a named non-counterexample policy; treat rejected_actions as a structural-zero sanity guardrail matched to its digested extension count. Policy name is deferred; charging diagnostics must be null (“not modeled”) if extension omitted, never fabricated 0. |
| OD-16 factor | Owner selects before inspection; recommended floor=1.5 for P1-B informativeness. |
| OD-18 controls and guardrail classes | Register structural classes and reactive-versus-reactive placebo divergence before any forecast-arm run. |
| OD-20 time of day / C-10 | Recommend disabling both demand and travel modulation with a closed N2 literal. No such literal is adopted here. |
| OD-22 approach / C-34 | Recommend fixed 1–120 and dropping the control-only exception; pending S1. |
| Starvation | Minimum available cars; NO_AVAILABLE_VEHICLE and ENERGY_INFEASIBLE request-minutes; depot-occupied cars. |
| Horizon / OD-9 | Register H−I ≥ T, preserving DL9 boundary asymmetry. |
| Saturation / C-45 | Declare which diagnostics saturate in each cell; retain temporal-association labels. |
| Binding resource / C-46 | Report reactive berth utilization, inbound/queued approach share and idle-feasible refusal share per cell. |
| Allowed before evaluation | Tape-only bounds; reactive-only tuning; reactive-versus-reactive placebo and non-treatment positive controls; same-policy nulls; fixture/differential tests; cross-seed independence. No forecast-arm run before S1 rules freeze. |

Contingency protocol (C-33): refusal failure retains the current key `approach_refused_request_fraction`, its all-N normalization and strict mean-harm comparison until the owner decides OD-11. A proposed replacement is `approach_refused_request_min_per_eligible_request=approach_refused_request_min/N` (null if N=0), lower-is-better, strict mean harm above a pre-registered minutes/request limit. Demonstrate attainable headroom before choosing that limit; otherwise mark the fraction descriptive. No post-evaluation role swap. If P1-B or a positive control fails, retain `completion_fraction` as the failing registered criterion in the audit, redesign the cell’s binding resource/tape using reactive-only tuning, or separately register `boarding_within_target_fraction` (all-N; higher-is-better) as a new primary with its own margin, SD/bound/control checks. Freeze a new version and untouched evaluation block before treatment; never select the favorable observed metric.

Observed inherited values requiring an explicit S1 decision (`operations.js:14–19`, `bay-operations.js:15–16,49–50`, `vehicle-profiles.js`): start_hour=7; travel multiplier=1.25 at clock hours 07–10 and 16–19 (default minutes 0–179); traffic_multiplier=1; ojai_share_pct=50; Bay road speed=38 km/h; demand peak_multiplier=1.6; clear weather; initial/target/reserve SOC=65/85/15%; trips_between_visits=3; chargers=4 per depot at 50 kW; fixed site cap=120 kW; cleaning/software/upload bays=2/1/2; durations=8/12/6 min; software every 2 visits. Default I-PACE profile is battery=84 kWh, acceptance=100 kW, intensity=0.24 kWh/km, boarding=2, service multipliers=1/1/1; Ojai is 90/150/.27/2, cleaning/software/upload multipliers=1.25/1/1.2. These are teaching assumptions, not published vehicle performance. Existing readiness and charging extension literals also require exact export if enabled. `resources` omission and depot-only G3 placement are already decided, not optional inherited values.

Suggested synthetic starting parameters, still unregistered: fleet=40; depots=2; H=240; I=180; T=10; background=20/hour; berths=2; approach=4; staging=6; each event 40 parties, conversion=0.7, spread=10, walk=5; overlap releases 90/95 or separated 60/130; wave=release+walk recommendation; forecast count=28 each, publish wave−30, expire wave+30, lead=30; additional hub dwell=2 or longer-boarding cell 6. Expected N≈116 and background≈60 assume disabled demand peaks and no intake exclusions; actual per-seed denominators are measured from the frozen tape, never hard-coded 116/60.

## 11. Architecture, work packages and implementation acceptance

Required direction: frozen region/demand/condition/publication tapes → **one Bay lifecycle and energy ledger** with opt-in curb ownership → mandatory accounting and independent recomputation → strict v2 pair adapter → existing paired instrument → native recorded-result projections. `curb-resources.js` owns reservations/intervals, not vehicle selection or future inputs. `event-demand.js` owns exogenous rows/publications. Policy inputs contain only current demand/resources and currently visible forecasts, excluding future requests, unpublished records, future berth closures, realized wave parameters and RNG state. Future-only input mutation must not alter earlier decisions.

S0 is this design only. S1 registration and X1 execution seam each need separate approval; neither is implied by committing the document. OD-19 sequence is S1a registration rules before X1; X1 execution seam; S2 frozen model/accounting/adapter; S1b reactive tuning and frozen checks after S2, before any forecast-arm run; S3 experiment execution support; S4 registered evaluation; S5 presentation after S4. S1a and S1b are separate gates. X1 expresses §4 as named step functions sharing move, settle and startVisit; N2 supplies dispatch, 5a, preparation and admission steps selected once per run. The sync wrapper preserves `simulateBayAreaOperations`. Do not add a second engine or put statistical decisions in UI code.

The cooperative runner should yield at deterministic minute boundaries within a measured 8 ms scheduling target; wall time cannot affect draws or model state. Measure demand construction, largest minute, validation, bootstrap, canonical serialization and final DOM projection too. If a minute exceeds budget, add deterministic finer checkpoints or lower validated workload cap. At 40 and 85 vehicles under the §7 named workload measure cold/warm total, task/chunk distribution, peak retained heap and input-event timestamp→visible cancellation (including dispatch delay) over at least 20 deterministic offsets. Proposed local targets: no N2 simulation task>50 ms; p95 cancellation≤100 ms, maximum≤200 ms. These are unmeasured acceptance targets. N2.0 uses the cooperative main-thread runner. A Worker needs a separate packer and architecture/CSP decision, not automatic dependency/network adoption.

Edits, cancellation, navigation and destruction invalidate in-flight work at each checkpoint. No partial arm/comparison becomes completed or exportable as valid. Retain the last complete result under its exact stale inputs. Synchronous, differently chunked, capture-on/off and canceled-then-restarted runs reproduce identical canonical outputs excluding timing diagnostics.

The compact review is a closed panel between Austin and Launch inside Fleet day, with jump buttons near the Fleet day question. Use buttons, not #fragment links: the hash is the router. Before run, show question, synthetic graph, frozen/treatment inputs, exact versions/seed, I/H/T, clock definitions, finite capacities and assumptions. After run, show arrival versus boarding, all populations, berth usable/occupied/draining states, inbound versus queued approach, staged supply, refusals, preparation energy/distance, background displacement, unfinished depot work and terminal energy. Selected-request detail traces release→walk→creation→assignment→arrival→queue→boarding→departure→completion with explicit null stages. Render exact machine values on inspection; rounding cannot move an apparent result across a threshold. Compare primary, each guardrail and descriptive effects independently; invalid/incompatible/canceled/unavailable states are distinct and have no accepted chart/recommendation.

Keep native DOM, static/offline routing, no-autorun loading, CSP and no unexpected network requests. Register `regional-curb` in studio.js and setup-codec explicitly; change five-model test pins to include it while preserving all legacy bytes. N2 setup-link sharing remains deferred pending OD-23; JSON setup remains complete. Setup limits remain 32,768 characters / 65,536 decoded bytes; fail with a complete JSON alternative, never truncate.

Offline hard limit remains 2,621,440 bytes. Post-D1 measured offline size is 2,551,878 bytes (source `b99ab04`), leaving 69,562 bytes. Earlier model slices measured +29,898 (readiness), +32,759 (Austin regional power) and +58,753 (charging, resources and airport) packed bytes. By measured analogy N2 is estimated at 52.5 KB (low), 81.8 KB (likely) and 118.5 KB (high); S2 alone is likely about 59 KB. The review’s combined S2+S5 allocation of 28,672 bytes is superseded. OD-1 route A and OD-2 allocation are DECIDED, but N2 does not start until route A lands and the baseline is re-measured. A work package stops above its own budget; move deep checks to test-only and cut review scope before requesting more bytes; never remove required behavior silently.

| Package | Decided stop budget, bytes |
|---|---:|
| X1 main thread | 8,192 |
| S2 model/accounting/runtime checker/adapter | 65,536 |
| S5 review surface | 32,768 |
| P2 remainder including D1-deferred items | 12,288 |
| R0 | 5,120 |
| T teaching frame | 61,440 (target 53,248) |
| Unallocated floor | 12,000 |

The combined reservations including floor are 197,344 bytes; against the route-A measured scratch headroom 370,038 this leaves 172,694 bytes, subject to actual post-tooling measurement. Route A is a separate offline-only tooling change: remove a comment only if first and last lines hold no tokens, require pack-time token equality, retain `--site` and hard limit. Scratch measured saving=300,476 bytes; this document does not implement it.

S5 prerequisites: shared dictionary-driven verdict generator; direction-aware allowances and an always-present lead line; focus-safe busy pattern; jump buttons; exported chart helpers; replacement of the two leftover “regional” strings; rounded inline values with exact disclosure. Render the shared instrument decision, never infer a verdict in UI. Never disable the focused control: retain focus, guard duplicate activation and expose a separate cancel action; role=status announces phase changes only. Navigation/input edits cancel and stale the result; completion restores the initiating control and announces completed/canceled/invalid once.

The N2 view must enter COPY_MODULES (`tools/check-dist.mjs:40`) and receive a rendered-text copy test. Interface copy excludes “forecast” (`:67`), “win”, “score”, “beats” and “cost”; forecast remains only in identifiers, versions and exported keys. OD-10 arm names remain pending; neutral recommended labels are “Respond to requests” and “Stage from published crowd estimates”. A visible sentence distinguishes the airport wave: “This panel uses two event crowds and a shared finite curb; the airport wave uses a different demand and pickup model.” OD-21’s optional short identity line remains pending.

Keep the request trace under operative route-A scope; register its default request rule before tuning (OD-24), with explicit unavailable stages. OD-23’s sharing decision remains pending. Arrival averages retain their legacy labels beside boarding measures. After the timeline, always show “What this result does not show”: calibrated travel or demand; real vehicle or curb performance; authentication; commercial access; safety or deployment permission. Do not repeat modelHeader’s sentence. An optional registered-digest match may be added only after S4 under OD-19; it conveys reproduction, not authenticity. At most one N2 catalog lesson may open this panel without running; if added, explicitly change `test/navigation.test.mjs:14` from 56 to 57.

The launch also records OD-T=1/OD-T=2/OD-T=4/OD-T=5/OD-T=6/OD-T=7=Yes for the separately scoped teaching task: gated casebook readings; visible Fleet day frame before result summary; only teaching-frames and street-simulation additions to COPY_MODULES in T=1; canonical Four-area names; “What & why”, “How we simulate”, “Learning & ops takeaway”; walkthrough intro only, structural edits deferred. These do not authorize N2 code in this documentation task.


Implementation acceptance must include all §9 fixtures plus: zero demand; required empty background; one slot/berth; all berths closed; close exactly at admission; recovery; false/unpublished/expired forecasts; zero staging; boundary target equality; exact I/H; malformed/mixed-version tapes; unknown/duplicate/invalid reservations; missing/altered records; capture/chunk/replay equality; null-treatment identity except enumerated policy fields; complete exogenous equality versus allowed realized differences; package/provenance mismatch; strict v1/v2 readers; legacy Bay/Austin/airport/launch and setup bytes; resource-not-modeled display; null/late/pending cohorts; cross-seed check; and guardrail adverse cases. A positive result is not a required outcome.

Focused tests precede the appropriate full Node/performance, scoped Python website parity/boundary, Ruff, package and diff gates. Use the correct checkout's Python import path; do not manipulate retained fixtures or claim known baseline failures passed. Browser acceptance after implementation covers native, packed and offline-over-HTTP at 1280×720 and 400 px, keyboard/status/focus, stale/cancel/loading restoration, both arms/bootstrap/final projection and no autorun. Additional browsers/devices/assistive technologies and user comprehension improvements require actual observations, not fake-DOM inference.

Defer extra hubs, road spillback, accessibility/rerouting, post-assignment abandonment, Street coupling, combined power/weather stress, thermal/auxiliary physics, pricing, new optimization/RL/LLM policy, live maps/events, external data ingestion, cloud/backends and physical control. Stop the affected work if populations/ownership do not conserve, paired tapes differ, legacy contracts mutate, future input leaks, unavailable evidence becomes success, mandatory work vanishes, budgets fail or protected Python review/evidence paths would need changing. Document and continue independent safe work.

## 12. S0 verification and recommendation

S0 verification is documentary: source inspection, explicit owner-decision reconciliation, fixture arithmetic/key probes, v1 digest check and whitespace/privacy review. No N2 model, campaign, performance measurement or browser acceptance has run, and no N2 validity claim follows from the hand traces. The uncommitted probe is deliberately outside the tracked deliverable. The parent release task records the separate D1 baseline and gates; they are not N2 acceptance.

Executed on 2026-09-26: the new ignored `artifacts/fleetlab-n2-s0/fixture-values-v2.1.mjs` imports shipped keyed/statistical helpers and re-derives integer/type arithmetic, route/duration/energy fixtures and paired machine decisions. The original three S0 probe files remain untouched. Documentary gates check all 19 groups, 26 OD entries, 50 correction rows, pending-box classification, separators, privacy, immutable hashes and diff whitespace. These are documentary checks, not N2 model execution.

Committed verification anchor: [D1 release record](../FLEETLAB_D1_RELEASE_2026-09-26.md), plus HERMES_SOURCE_OF_TRUTH.md §7.5’s dated v2.1 entry. D1 acceptance is separate: 1,827 Node tests, 1,826 pass, one existing TODO; no N2 campaign claim. Current read-only baseline confirms offline 2,551,878 bytes, site 90 files / 3,189,179 bytes and clean distribution checks.

Immutable v1 SHA-256: `c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`; immutable v2 SHA-256: `da7b80690711116dc7a11874db4199468f2581ab6c5e87d4251698ead48d383d`. Source disagreements and explicit overrides are recorded in §0.2/§1.2. G2 remains OPEN; pending role/identity/state proposals cannot be inferred as approvals.

### Recommendation

Review v2.1 and resolve pending contract decisions; proceed with separately scoped route A tooling and S1a before X1. Hold N2 implementation until those approvals and prerequisites are satisfied. Preserve the possibility that the bounded experiment returns null, mixed or adverse results.

### Top risks + mitigations

- **Curb exposure becomes artificial energy failure or invisible demand loss:** whole-pass reasons, exact 5a set, staged exemption and conservation records.
- **Event gains conceal background harm:** required background boarding/completion guardrails, immutable denominators and non-compensatory decisions.
- **Recording/rounding conceals a boundary or missing fact:** capture-independent intervals, exact values, explicit nulls, every-arm validation and strict identities.
- **An uninformative experiment is mistaken for policy evidence:** S1 headroom/positive/null/independence checks, complete tapes, dispositions and inspection log.
- **A teaching result implies external validity:** visible synthetic assumptions, NOT_EVIDENCE, permission NONE and no calibration/deployment claim.

### Next 3 actions

1. Owner reviews v2.1 and S1 selects patience, inherited literals, condition/control tapes, seed blocks and check/disposition rules before evaluation.
2. Separately approve and validate X1 legacy parity, deterministic cancellation, retained-memory and package budgets before N2 model work.
3. After those gates, implement model/accounting tests before UI, then run every registered cell and report all results without selection.

## Appendix A. Correction conformance

Classes: a TEXT; b pending brief-§2 re-decision/clarification; c pending reversal; d S1-DEFERRED; e DECIDED. Each C-number has exactly one class. APPLIED means this documentation implements the correction, never that N2 code exists. Deferred recommendations are recorded but NOT APPLIED as operative contract. C-43 is the audit’s decision-informativeness umbrella, resolved through P1-B and §10; §10’s copy-ready list omitted its own separate bullet. C-32 has no allocated OD number, so the pending box names that correction rather than inventing a 27th OD.

Evidence paths in this appendix are repository-relative; V21 abbreviates `docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md`. “Audit” abbreviates `docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md`. Line references identify the actual contract/proposal, not this conformance row.

| Correction | Class | v2.1 section | Status | file:line evidence |
|---|---|---|---|---|
| C-01 | e | §2, §9.9 | APPLIED OD-4 | V21:617; Audit:218 |
| C-02 | a | §3.1 | APPLIED | V21:170; Audit:219 |
| C-03 | e | §2, §9.9 | APPLIED OD-3 | V21:615; Audit:220 |
| C-04 | e | §4, §9.3/9.9/9.18 | APPLIED OD-5 | V21:230; Audit:221 |
| C-05 | a | §4 | APPLIED | V21:224; Audit:222 |
| C-06 | a | §4 | APPLIED | V21:230; Audit:223 |
| C-07 | a | §4 | APPLIED | V21:230; Audit:224 |
| C-08 | a | §4 | APPLIED | V21:221; Audit:225 |
| C-09 | a | §5.1, §9.17 | APPLIED; OD-9 neutral PENDING | V21:685; Audit:226 |
| C-10 | a | §9, §10 | APPLIED fixture literals; OD-20 deferred | V21:503; Audit:227 |
| C-11 | a | §3.1 | APPLIED | V21:170; Audit:228 |
| C-12 | e | §7 | APPLIED OD-6 | V21:443; Audit:229 |
| C-13 | a | §7.1 | APPLIED | V21:422; Audit:230 |
| C-14 | a | §5, §7.1 | APPLIED | V21:426; Audit:231 |
| C-15 | a | §3.2 | APPLIED | V21:182; Audit:232 |
| C-16 | a | §7 | APPLIED | V21:461; Audit:233 |
| C-17 | a | §7 | APPLIED | V21:412; Audit:234 |
| C-18 | d | §10 | NOT APPLIED as contract; S1 recommendation recorded | V21:734; Audit:235 |
| C-19 | c | §6.4 | PENDING OD-25; common fail-closed rule restated | V21:401; Audit:236 |
| C-20 | a | §6.4 | APPLIED | V21:399; Audit:237 |
| C-21 | b | §6 | PENDING OD-26 | V21:314; Audit:238 |
| C-22 | a | §3.1, §7 | APPLIED | V21:469; Audit:239 |
| C-23 | a | §7 | APPLIED | V21:469; Audit:240 |
| C-24 | a | §7 | APPLIED | V21:467; Audit:241 |
| C-25 | a | §6.2 | APPLIED | V21:323; Audit:242 |
| C-26 | a | §6.4 | APPLIED | V21:397; Audit:243 |
| C-27 | a | §6.2 | APPLIED | V21:351; Audit:244 |
| C-28 | a | §7 | APPLIED | V21:463; Audit:245 |
| C-29 | a | §11 | APPLIED copy policy; OD-10 neutral PENDING | V21:781; Audit:246 |
| C-30 | a | §11 | APPLIED | V21:757; Audit:247 |
| C-31 | c | §8 | PENDING OD-8 | V21:497; Audit:248 |
| C-32 | c | §7.1 | PENDING unnumbered C-32; no record merge adopted | V21:441; Audit:249 |
| C-33 | a | §10 | APPLIED registration paths, no values chosen | V21:745; Audit:250 |
| C-34 | d | §10 | NOT APPLIED as contract; S1 recommendation recorded | V21:738; Audit:251 |
| C-35 | e | §1.2, §11 | APPLIED OD-19 | V21:755; Audit:252 |
| C-36 | a | §12 | APPLIED | V21:800; Audit:253 |
| C-37 | a | whole document | APPLIED separators and source IDs | V21:501; Audit:254 |
| C-38 | a | §6.3 | APPLIED | V21:372; Audit:255 |
| C-39 | a | §2, §7.1, §9 | APPLIED | V21:424; Audit:256 |
| C-40 | a | §0–§0.1 | APPLIED | V21:7; Audit:257 |
| C-41 | a | §11 | APPLIED; OD-1/OD-2 DECIDED | V21:765; Audit:258 |
| C-42 | a | §11 | APPLIED; neutral choices remain PENDING | V21:761; Audit:259 |
| C-43 | d | §10 | NOT APPLIED as contract; S1 recommendations recorded | V21:717; Audit:260 |
| C-44 | a | §1.2, §3.1 | APPLIED | V21:135; Audit:261 |
| C-45 | d | §10 | NOT APPLIED as contract; S1 recommendation recorded | V21:741; Audit:262 |
| C-46 | d | §10 | NOT APPLIED as contract; S1 recommendation recorded | V21:742; Audit:263 |
| C-47 | a | §6.4 | APPLIED | V21:397; Audit:264 |
| C-48 | a | §11 | APPLIED | V21:755; Audit:265 |
| C-49 | a | §11 | APPLIED | V21:783; Audit:266 |
| C-50 | a | §11 | APPLIED | V21:779; Audit:267 |
| P1-B | d | §10 | NOT APPLIED as contract; S1 recommendation recorded | V21:717 |
| Fixture §9.1 | a | §9.1 | APPLIED hand trace and stated seams; see probe scope §12 | V21:505 |
| Fixture §9.2 | a | §9.2 | APPLIED hand trace and stated seams; see probe scope §12 | V21:519 |
| Fixture §9.3 | e | §9.3 | APPLIED hand trace and stated seams; see probe scope §12 | V21:536 |
| Fixture §9.4 | a | §9.4 | APPLIED hand trace and stated seams; see probe scope §12 | V21:547 |
| Fixture §9.5 | a | §9.5 | APPLIED hand trace and stated seams; see probe scope §12 | V21:561 |
| Fixture §9.6 | e | §9.6 | APPLIED hand trace and stated seams; see probe scope §12 | V21:575 |
| Fixture §9.7 | a | §9.7 | APPLIED hand trace and stated seams; see probe scope §12 | V21:595 |
| Fixture §9.8 | d | §9.8 | OPEN pending S1 | V21:599 |
| Fixture §9.9 | e | §9.9 | APPLIED hand trace and stated seams; see probe scope §12 | V21:613 |
| Fixture §9.10 | a | §9.10 | APPLIED hand trace and stated seams; see probe scope §12 | V21:621 |
| Fixture §9.11 | a | §9.11 | APPLIED hand trace and stated seams; see probe scope §12 | V21:625 |
| Fixture §9.12 | a | §9.12 | APPLIED hand trace and stated seams; see probe scope §12 | V21:639 |
| Fixture §9.13 | a | §9.13 | APPLIED hand trace and stated seams; see probe scope §12 | V21:660 |
| Fixture §9.14 | a | §9.14 | APPLIED hand trace and stated seams; see probe scope §12 | V21:666 |
| Fixture §9.15 | a | §9.15 | APPLIED hand trace and stated seams; see probe scope §12 | V21:670 |
| Fixture §9.16 | a | §9.16 | APPLIED hand trace and stated seams; see probe scope §12 | V21:674 |
| Fixture §9.17 | a | §9.17 | APPLIED hand trace and stated seams; see probe scope §12 | V21:678 |
| Fixture §9.18 | e | §9.18 | APPLIED hand trace and stated seams; see probe scope §12 | V21:690 |
| Fixture §9.19 | a | §9.19 | APPLIED hand trace and stated seams; see probe scope §12 | V21:701 |
| Fixture preamble | a | §9 | APPLIED literals and unit-graph seam | V21:503 |
| Fixture IEEE ties | a | §6.4 | APPLIED shipped-instrument checks | V21:399 |
