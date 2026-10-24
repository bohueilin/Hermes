# FleetLab depot lab — engineering note (builder decisions)

**2026-10-24 · implementation companion to the frozen contract · no new authority.**

The controlling contract is the [D1/D12 annex](FLEETLAB_DEPOT_READINESS_FREEZE_CANDIDATE_2026-10-24.md)
plus the [reconciliation](FLEETLAB_DEPOT_READINESS_RECONCILIATION_2026-10-24.md) §§6–8 and §11. This note
records only the details the contract leaves to the builder (labelled **BD-nn**) so that the engine and the
independent verifier can be written separately against the same written rules. Where this note and the
contract disagree, the contract wins and this note is corrected. Nothing here is test evidence.

Terminology: *contract* = the two controlling documents; *engine* = `src/model/depot-lab/{state,policy,
allocation,engine,ledger}.js`; *verifier* = `src/model/depot-lab-verify/*`; *contract modules* =
`src/model/depot-lab/{rational,units,canonical,identity,schema,profiles,task-graph,presets,registry,compare}.js`.

## 1. Module map and import boundary

| Path (under `playground/fleetlab/`) | Role | May import |
|---|---|---|
| `src/model/depot-lab/rational.js` | exact BigInt rationals and guards | nothing |
| `src/model/depot-lab/units.js` | unit constants, SOC energy, band arithmetic | `rational.js` |
| `src/model/depot-lab/canonical.js` | strict bounded JSON parse, JCS text, byte length | `src/core/canon.js` |
| `src/model/depot-lab/identity.js` | framed SHA-256, five digests, typed references | `canonical.js`, `src/core/sha256.js` |
| `src/model/depot-lab/profiles.js` | frozen policy body P, ranks, overlap matrix, reference effort, proficiency table, versions | `units.js` |
| `src/model/depot-lab/schema.js` | `validateScenario`, issues | `canonical.js`, `profiles.js`, `units.js` |
| `src/model/depot-lab/task-graph.js` | `compileScenario` (task catalog) | `profiles.js`, `units.js`, `identity.js` |
| `src/model/depot-lab/presets.js` | fourteen configurations and editor templates | `profiles.js`, `units.js` |
| `src/model/depot-lab/{state,policy,allocation,engine,ledger}.js` | engine | contract modules |
| `src/model/depot-lab-verify/*.js` | independent verifier and projection | contract modules **except** engine files |
| `src/model/depot-lab/registry.js` | registered terms | `profiles.js` |
| `src/model/depot-lab/compare.js` | compatibility and component-wise classification over verified envelopes | `canonical.js`, `identity.js`, `schema.js`, `registry.js`, `rational.js` |
| `src/runtime/depot-lab-{job,worker,session}.js` | bounded execution and session | engine, verifier, compare, contract modules |
| `src/ui/depot-lab-*.js` | presentation | session, `presets.js`, `schema.js`, `registry.js`, `units.js`, `rational.js`, leaf `src/ui/dom.js` |

Hard rules (import-boundary tests enforce them):

1. The verifier imports no engine file (`state`, `policy`, `allocation`, `engine`, `ledger`) and no UI/runtime
   file. It re-derives eligibility, policy choices, allocations, credits, reasons and metrics itself.
2. The engine imports no verifier file.
3. UI files import no engine, verifier, allocation or policy file. They render `VerificationEnvelope` /
   `ComparisonEnvelope` projections received from the session and validate drafts with `schema.js`.
4. No module touches the DOM, clocks, randomness, storage or network except UI (DOM) and runtime (worker
   messaging). `Date`, `Math.random`, `performance` never enter model code.
5. **BD-01 shared contract modules.** `task-graph.js` (static expansion of the frozen grammar) is a contract
   module shared by engine and verifier, like the schema. It encodes the D12-02 edges and the 32-task guard;
   it contains no time, resource or eligibility logic. Separate tests pin its output against the written
   D12-02 rules so a grammar error cannot hide behind shared use.

## 2. Exact numbers — `rational.js`, `units.js`

`rational.js` exports immutable reduced rationals `{n: bigint, d: bigint}` (d > 0, gcd 1, zero = 0/1) and:
`Q(n, d=1n)`, `parseRational("p/q")` (rejects non-canonical strings), `formatRational(r)` → `"p/q"`,
`add, sub, mul, div, cmp, eq, isZero, min, max, floorDiv(r) → bigint, ceilDiv(r) → bigint, fromInt`,
plus `RationalGuardError {code:'INCOMPLETE_RESOURCE_LIMIT', reason:'RATIONAL_GUARD', operand_bits}`.
Every operation normalizes and checks: each serialized component ≤ 256 decimal digits; every intermediate
bit length ≤ 8,192 (checked on operands **before** multiplying: `bits(a)+bits(b) > 8192` refuses). No Number
division, epsilon or float anywhere in engine or verifier. Ticks/counts may be JS safe integers; bytes,
mJ and rational numerators are BigInt inside arithmetic and safe integers at the JSON boundary.

`units.js`: `MJ_PER_W_TICK = 1000n`, `BYTES_PER_MBPS_TICK = 125000n`, `PACK_MJ = 216000000000n`,
`MJ_PER_SOC_PCT = 2160000000n`, `socEnergy(pct)`, band helpers from the vehicle profile
(`bandAt(energyMj, profile)` returns the band whose half-open `[from, until)` contains the energy, with the
exact-edge rule "at an exact edge use the higher-SOC band"), `nextBandEdge(energyMj, profile)`,
`requiredChargeMj(initialPct, targetPct) = max(0, (target−initial)×2.16e9)`, `uncontendedDcChargeTicks`
(oracle helper for tests and minimum-duration disclosure; never the engine's credit path).

## 3. Canonical JSON — `canonical.js`

* `parseStrict(text, {maxBytes, maxDepth=32})` → `{ok, value?, issues}`. Byte-size gate first (UTF-8 bytes of
  the decoded string, exact, before any parse). Then a hand-written tokenizer: rejects duplicate keys,
  nesting > 32, lone surrogates, `-0`, non-integer numbers (fraction/exponent), integers outside the safe
  range, keys `__proto__`/`constructor`/`prototype`, and trailing content. Objects are created with a null
  prototype then copied to plain objects. Unicode is not normalized.
* `jcs(value)` → canonical text. It reuses `src/core/canon.js` `canonicalJson` after asserting the restricted
  domain (plain objects, arrays without holes, strings without lone surrogates, safe integers, booleans,
  null). Tests prove equality with an independent RFC 8785 serializer on that domain.
* `utf8Length(text)` exact; `canonicalBytes(value)` = `TextEncoder` bytes of `jcs(value)`.

## 4. Identity — `identity.js`

`frame(domain, value)` = `UTF8(domain) || 0x00 || u64be(len(J)) || J` with `J = UTF8(jcs(value))`;
`H(domain, value)` = lowercase hex SHA-256 via `src/core/sha256.js` `sha256(bytes)`.
Five digests exactly as C1.2: `workloadDigest(S)`, `policyDigest()` (over the frozen P of §6),
`scenarioDigest(S)`, `runDigest({scenario_digest, engine_version, verifier_version, ledger})`,
`comparisonDigest({...})`.

**BD-02 harness binding.** Internal analytical/checkpoint runs (§9) bind
`scenario_digest = H("fleetlab.depot.harness-scenario.v1", {public_scenario_digest, harness})` so a harness
ledger can never verify as a public run. The public verifier path refuses any harness argument.

**BD-03 typed references** (C1.4 plus the following synthetic namespaces, all disjoint):
`site:supply`, `network:wan_down`, `network:wan_up`, `network:pool`, `cache:read`, `cache:depot`,
`client:<visit>`, `storage:<visit>`, `service:maps|software|uploads`, `zone:<zone>`, `logs:<visit>`
(the vehicle's log backlog as an upload object), `lane:NN` (two digits, 01..20), `vendor:bay:01`,
`vendor:worker:01`, `task:cache:<object>:fetch|check`, `flow:cache:<object>:fetch`.
Other references: `visit:`, `position:`, `port:`, `worker:`, `object:`, `task:<visit>:<template>`,
`flow:<visit>:<template>`, `action:TTTTTT:MM:OOOOOO`, `group:TTTTTT:MM:OOOOOO` (zero-padded tick 6 digits,
microstep 2, ordinal 6). `refs.visit(id)` etc. constructors live in `identity.js`.

**BD-04 versions.** `ENGINE_VERSION = 'depot-lab-engine.1.0.0'`, `VERIFIER_VERSION =
'depot-lab-verifier.1.0.0'`, `PROJECTION_VERSION = 'depot_projection_v1'`, `METRIC_VERSION =
'depot_metrics_v1'`, `OBSERVATION_VERSION = 'depot_observation_v1'` live in `profiles.js`; the verifier
checks the ledger header equals them. A module cannot read its own git commit at runtime (static hosting, no
build rewrite); exact source binding is the route release sidecar (source commit + per-file SHA-256). A
behavior change requires a version bump; tests pin the constants.

## 5. Scenario validation — `schema.js`

`validateScenario(raw, {origin: 'editor'|'import'})` → `{ok, scenario?, issues: [{code, path, value, bound}]}`.
`raw` may be text (import: parsed with `parseStrict`, maxBytes 524,288) or an object (editor). Editor origin
materializes defaults (`target_soc_pct` 80, cabin window 0, visit `task_windows` []) **before** validation;
import origin never fills a missing field. Shape follows C1.3 exactly (closed objects, enums, integer
ranges, max lengths, consts). Semantic rules follow C1.3 "Mandatory semantic validation" exactly, plus:

* worker qualification rows: exactly one per attended class; `solo_duration_ticks` equals
  `PROFICIENCY[class][proficiency]` (§6); `may_supervise` requires `independent`.
* availability intervals: nonempty, nonoverlapping (after sorting by start), within `[0, H)`.
* `vendor.availability` same rules; vendor `bay_count`/`worker_count` may be 0.
* every id unique in its collection; `site.ports[].position_id` resolves to a **charging** position; at most
  one port per position; `network.cache.initial_object_ids` ⊆ content objects and empty unless `warm`;
  warm objects fit capacity; `off` requires capacity irrelevant (usable capacity 0).
* visit: `arrival_tick < A`, `due_tick` null or ≥ arrival; at most one installed and one required object per
  kind; installed + log residency ≤ 50 GB; task-window templates unique.
* the catalog compiles (§7) with ≤ 32 tasks per visit.

Normalization (C1.1): sorts `positions`, `ports`, `workers`, `content_objects`, `visits` by ASCII id; sorts
set-valued id arrays and zones; sorts qualification rows by `task_class`; sorts intervals by
`(start_tick,end_tick)`. The returned `scenario` is a new frozen object; input is never mutated.

## 6. Frozen profile — `profiles.js`

* `POLICY_BODY` = the C1.4 `P` object, expanded literally (ids, rank rule strings, the 17×17 matrix as rows
  of `A`/`X` in the class order `MV IN CB DG RP CN CH UP DL UL CK AC PC AK FI VT VS`, exogenous ranks
  `{shift_end:0, shift_start:1, arrival:2}`, and the 28 template names in rank order).
* `TEMPLATE_RANK` (0..27, C1.4 order) and `TEMPLATE_CLASS`: admit MV, intake IN, to_garage MV, diagnosis DG,
  repair RP, vendor_departure MV, vendor_outbound VT, vendor_service VS, vendor_return VT, vendor_reentry MV,
  to_cleaning MV, cabin CB, map_download DL, map_check CK, software_download DL, software_check CK,
  to_charging MV, connect CN, charge CH, map_activation AC, map_postcheck PC, software_activation AC,
  software_postcheck PC, upload UL, acknowledgment AK, inspection FI, unplug UP, egress MV.
* `ATTENTION_CLASS`: move templates → `move`; intake, cabin, diagnosis, inspection, connect, unplug →
  same name; repair → `mechanical_repair` or `specialist_repair` by fault.
* `PROFICIENCY` (seconds, developing/practiced/advanced): intake 180/120/90; cabin 900/600/480; diagnosis
  1680/1200/1020; mechanical_repair 4800/3600/3300; specialist_repair 7200/5400/4800; inspection 420/300/240;
  connect 180/120/105; unplug 150/120/90; move 120/120/120.
* `REFERENCE_EFFORT` `practiced_reference_v1`: intake 120, cabin 600, diagnosis 1200, mechanical_repair 3600,
  specialist_repair 5400, inspection 300, connect 120, unplug 120, move 120, check 60, activation 600,
  postcheck 60 (acknowledgment 0; charge/transfer in mJ/bytes).
* `VEHICLE_PROFILE` (the C1.3 const) and `ROLE_TEMPLATES` (cleaner, technician, mover, lead; D12-01).

## 7. Task catalog — `task-graph.js`

`compileScenario(scenario, {harness}={})` → frozen `{visits: [VisitPlan], cacheTasks: [Task], byId: Map}`.
Visits are ordered by ASCII id. `Task = {id, visit|null, template, rank, cls, kind, mandatory, prereqs: [id],
anyPrereqs: [id] (cache fetch only), earliestStart, attention|null, move: {to: zone|'outside'|null,
withPort: bool}|null, data: {object, direction:'down'|'up', bytes, endpoint, cacheRoute: bool}|null,
timed: ticks|null, reference: {class, seconds}|null}`.

`kind` ∈ `move` (attended, mover + lane), `attended` (worker only), `transit` (timed, no resource),
`vendor` (timed, vendor bay + worker), `timed` (unattended fixed duration: checks, activation, postcheck,
cache check), `charge` (energy flow), `data` (byte flow), `zero` (acknowledgment).

**Route decision before diagnosis (D1-09):** fault none → no repair; mechanical + (basic|specialist) →
on-site `to_garage, diagnosis, repair`; specialist_electrical + specialist → on-site; otherwise (none level,
or specialist_electrical with basic) → vendor `vendor_departure, vendor_outbound, vendor_service,
vendor_return, vendor_reentry` (vendor disabled still emits these tasks; they wait).

**Energy:** `need = requiredChargeMj(initial, target)`; if `need > 0` emit `to_charging, connect, charge,
unplug`; otherwise none (Q24 bypass).

**Content:** for each required object id not in `installed_object_ids`: `<kind>_download` (bytes = size;
omitted when size is 0 — BD-05), `<kind>_check`, `<kind>_activation`, `<kind>_postcheck`. Cache route
(`cache.state` cold or warm) is used for downloads; if the object is not in the warm initial set the depot
cache tasks `task:cache:<obj>:fetch` (data, WAN only) and `task:cache:<obj>:check` (timed 60) exist once per
object needed by at least one visit.

**Upload:** if `initial_log_bytes > 0`: `upload` (data up, mandatory = `upload_required`) and
`acknowledgment` (zero, same mandatory flag).

**Edges** (all mandatory unless stated). Let `last(stage)` be the final task of the latest preceding route
stage that exists (admit < intake < repair-or-vendor < cabin < charge):

| Task | Prerequisites |
|---|---|
| admit | none (ready at arrival) |
| intake | admit |
| to_garage / vendor_departure | intake |
| diagnosis → repair | to_garage → diagnosis |
| vendor_outbound → service → return → reentry | chain |
| to_cleaning | last(repair/vendor_reentry/intake); earliest start = effective cabin window |
| cabin | to_cleaning; earliest start = effective cabin window |
| to_charging | last(cabin/repair/vendor_reentry/intake) |
| connect → charge | to_charging → connect |
| `<k>_download` | intake; plus `task:cache:<obj>:check` when cache-routed and not warm-initial |
| `<k>_check` | `<k>_download` (or intake when the download is omitted) |
| map_activation | map_check; charge (if present) |
| map_postcheck | map_activation |
| software_activation | software_check; charge (if present); map_postcheck (if map required) |
| software_postcheck | software_activation |
| upload | intake |
| acknowledgment | upload |
| inspection | the terminal route task (charge, else cabin, else repair/vendor_reentry, else intake); every `*_postcheck`; mandatory acknowledgment |
| unplug | inspection |
| egress | inspection; unplug (if present) |
| `task:cache:<obj>:fetch` | **any-of** intake of a visit with a cache-routed download of `<obj>` |
| `task:cache:<obj>:check` | the fetch |

Effective cabin window = `max(task_windows.cabin_earliest_start_tick, visit window for cabin or to_cleaning)`;
other per-visit task windows apply to their own template. The terminal zone is the zone of the terminal route
task (charging/cleaning/garage/waiting). Optional upload/acknowledgment are never prerequisites.

Duration of attended tasks depends on the chosen worker(s) at start (§8.4); timed tasks use the content
object `check_ticks`/`activation_ticks`/`postcheck_ticks`, vendor fields or 60 s for the cache check.

## 8. Engine semantics

### 8.1 State
Per visit: `location ∈ {outside, moving, position:<id>, offsite, released}`, owned positions (origin and
reserved destination may both be owned during a move), connected port, energy (mJ), per task state
`UNREADY|READY|RUNNING|PAUSED|COMPLETE|CANCELLED`, `readyTick`, start tick, chosen workers, end tick (timed),
flow interval (`anchor`, `rate`, `remainderAtAnchor`, `creditedTotal`), storage residency/reservations,
content state per object, log bytes. Units: owner per position/port/lane/worker/vendor unit (owner = task id).
Cache: reserved bytes, object states. Workers: availability union intervals.

### 8.2 Event key, phases and microsteps (C2.2)
Key `(tick, microstep, phase, class_rank, stable_key)`; `seq` contiguous from 0.
**BD-06:** microstep 0 carries phases 0–1; microstep 1 carries phases 2–6. A further closure round runs only
if a phase-4/5 change makes a phase-2 transition possible; in this profile none can (every started task has
positive duration), so microstep ≤ 1 always; the verifier asserts no phase-2 transition is pending at the end
of each tick. `class_rank` is 0 except phase 1 (0 shift end, 1 shift start, 2 arrival).
`stable_key = EEEEEE:KIND:GG:CCCCC` where `EEEEEE` is a per-(tick, microstep) event ordinal increasing in
processing order across phases, `GG` the group ordinal inside the event, `CCCCC` the chunk index.
`group_id = group:TTTTTT:MM:OOOOOO` with a per-(tick, microstep) group counter.

Event ticks (BD-07): arrivals, attended/timed completions, flow completion or band-edge ticks, worker and
vendor availability boundaries (only where availability actually changes), task-window ticks, due ticks
(no records unless state changes) and H. Time jumps to the next event tick; nothing is processed between.

### 8.3 Per-tick processing and records
**Phase 0 (microstep 0):** (a) one PROGRESS group (chunked ≤ 64, sorted by flow id) for every flow whose
interval closes at this tick because it reaches its target or a band edge; (b) for each task completing now
(attended/timed/transit/vendor with `start+duration = tick`, flows that reached target), in ascending task-id
order: `TASK_TRANSITION COMPLETE` (action_id = its start action) → `RESOURCE_DELTA` releasing units (worker(s),
lane, vendor units; for moves also the **origin** position; for unplug the port; the move's destination
position/port changes `RESERVE→ACQUIRE` in the same delta; connect changes the port `RESERVE→ACQUIRE`) →
`CONTENT_TRANSITION`s (download → `OBJECT_COMPLETE`; check → `CHECK_COMPLETE`; activation →
`ACTIVATION_COMPLETE`; postcheck → `POSTCHECK_COMPLETE`; cache fetch/check on owner `cache:depot`; upload
→ `OBJECT_COMPLETE` on `logs:<v>`). Egress completion makes the visit released and, for every unfinished
optional upload of that visit, emits `TASK_TRANSITION CANCEL` + `CONTENT_TRANSITION RECEIVED_PROVISIONAL`
(bytes credited so far) (D12-02). Band-edge closures change no task state.

**Phase 1 (microstep 0):** `SHIFT_CHANGE` (rank 0 ends, rank 1 starts, by worker id; vendor worker id
`vendor:worker:01` included when the vendor is enabled with a worker), then `ARRIVAL` (rank 2, by visit id).

**Phase 2 (microstep 1):** `WINDOW_OPEN` for every arrived visit's incomplete task whose earliest start equals
this tick (sorted by task id); readiness updates (no record; visible through observation facts); then in
task-topological order zero-duration closures: an `acknowledgment` whose upload is complete emits
`TASK_TRANSITION START` and `COMPLETE` with a derived action id, then `CONTENT_TRANSITION
DURABLE_ACKNOWLEDGED` and `RECLAIMED` (bytes = log bytes; default retention reclaims acknowledged logs).

**Phase 3:** one `OBSERVATION` group when any projected fact changed since the previous complete observation
(the first is a full snapshot with `base_observation_seq = null`). Facts are sorted by `(entity_id, field)` and
chunked ≤ 64. `observation_seq` referenced by decisions = the seq of the **last** record of the group. When no
fact changed, no record; decisions then reference the previous complete observation.

**Phase 4 (not at H):** the policy worklist (§8.4). For each evaluated task in rank order, either an accepted
action group `POLICY_DECISION(accepted=true, reasons=[])` → `TASK_TRANSITION PAUSE` for each conflicting
running transfer of the same vehicle (ascending task id) → `RESOURCE_DELTA` (when units change) →
`CONTENT_TRANSITION RESERVED` (download storage or cache capacity) → `TASK_TRANSITION START|RESUME`; or a
rejected `POLICY_DECISION(accepted=false, reasons=[...])` **only when its reason-code set differs from the
code set of the last rejection recorded for that task since it last became READY/PAUSED** (BD-08). All
records of one evaluated task share `action_id`.

**Phase 5 (not at H):** recompute both allocation domains (§8.6). For each active flow whose rate or path
changes, or which is newly started/resumed, close its old interval (if any) and open a new one. Emit one
PROGRESS group for every interval closed **by reallocation, pause or cancel at this tick** (sorted by flow id),
then one `ALLOCATION_DELTA` group listing every active flow whose `(rate, resource_path, tight_resource_ids)`
changed or that is new (sorted by flow id). Flows that complete, pause or cancel leave the active set without
an allocation entry (their task transition is the removal).

**Phase 6:** nothing before H. At H: one PROGRESS report group for every still-active flow (reporting span,
anchor unchanged, `quantization_slack = undrawn_final_tick = 0/1`), `CONTENT_TRANSITION
RECEIVED_PROVISIONAL` for every unfinished upload/download with credited bytes > 0 (sorted by owner/object),
`BLOCKAGE` records (§8.8), then one `HORIZON` group (arrays chunked in parallel; `derived_state_digest`
§8.7).

At H, phases 4 and 5 do not run (no positive-duration start at H). Completions at H count.

### 8.4 Fixed policy `fcfs_eligible_fair_resources_v1`
Worklist = tasks in `READY` or `PAUSED` (transfers only), sorted by
`(readyTick, rank, ownerKey, taskId)` where `ownerKey` is `''` for cache tasks (sorts first) else the raw
visit id. Each task is evaluated once in that order against the state **including every transition accepted
earlier in this microstep**; feasible → accept and apply immediately; infeasible → reasons. One pass is
maximal (feasibility only decreases within a microstep).

Feasibility of task τ of vehicle v at tick t (< H), in this order of condition families (all failing
families are reported, §8.5):

1. **Window:** `t ≥ earliestStart(τ)`.
2. **Overlap:** for every RUNNING task ρ of v: `M[cls τ][cls ρ] = A`; if `X` and ρ is a running `data` task
   (DL/UL) while τ is not data, ρ will be paused; otherwise τ waits. A data task is not startable/resumable
   while any running task of v conflicts with it. Cache tasks have no vehicle overlap.
3. **Location:** moves need v stationary at the origin (admit/vendor_reentry: v `outside`/`offsite`
   returned, i.e. the return transit complete); attended service needs v at a position in its zone (intake:
   waiting; cabin: cleaning; diagnosis/repair: garage; connect/unplug: its charging position; inspection: its
   terminal position after the terminal route task completed); data tasks need v at a position whose zone is
   in `covered_zones`; timed vehicle tasks need v at a depot position. Moving/offsite states are already
   excluded by overlap (MV/VT/VS rows are X).
4. **Service endpoint** (downloads incl. cache-served, cache fetch, activation use maps/software by object
   kind; upload uses uploads): requires `reachable` and `valid`.
5. **Workers** (attended and move): options are solo independent workers (ascending id), then supervised
   pairs `(trainee supervised_only, supervisor independent ∧ may_supervise)` ascending by
   `(trainee id, supervisor id)` (BD-09). Duration: solo = worker's `solo_duration_ticks`; pair = max of both.
   An option is feasible when every member is unowned, available at t and `[t, t+d)` lies inside one maximal
   union of its availability intervals. Choose the first feasible option.
6. **Lane** (moves): lowest-id unowned lane.
7. **Destination:** admit/vendor_reentry → lowest-id enabled unowned waiting position; to_garage → garage;
   to_cleaning → cleaning; to_charging → first port in order *DC ports ascending id, then AC ports ascending
   id* that is enabled, unowned, and whose position is enabled and unowned (the position comes with it).
8. **Vendor** (vendor_service): enabled, `bay_count = worker_count = 1`, both unowned, `[t, t+service)` inside
   one maximal vendor availability interval.
9. **Stock:** download: `residency + reserved + size ≤ 50 GB` (else wait); cache fetch:
   `cache reserved + size ≤ capacity` (off ⇒ no cache task exists).
10. **Cache route:** a cache-routed download requires its cache object checked (prerequisite).

A transfer RESUME re-checks 1–4 only (its storage reservation persists). Charge needs no admission gate
(allocation may be zero).

### 8.5 Reason sets (BD-10)
Reasons are an array sorted in the Q15 order `PREREQUISITE, HELD_UNITS, ABSENT_INCOMPATIBLE_UNQUALIFIED,
DIVISIBLE_CAPACITY_TIGHT, INSUFFICIENT_SHIFT, UNREACHABLE_SERVICE, DENIED_ENTITLEMENT,
UNKNOWN_MANDATORY_STATE, SCHEDULED_WINDOW, FULL_STOCK_CACHE, STATIC_OUT_OF_SERVICE, OVERLAP_EXCLUSION,
FINISHED_BUT_BLOCKED, DECLARED_RULE_DEFERRAL`, at most one entry per code, each with sorted unique
`resource_ids` and `holder_visit_ids`. Decision reasons come only from families 1–10:

| Family failure | Code | resource_ids | holders |
|---|---|---|---|
| window not open | SCHEDULED_WINDOW | `[]` | `[]` |
| conflicting running non-pausable task(s) | OVERLAP_EXCLUSION | conflicting task ids | `[visit:v]` |
| zone not covered (data) | ABSENT_INCOMPATIBLE_UNQUALIFIED | `[zone:<z>]` | `[]` |
| endpoint unknown / denied / unreachable | UNKNOWN_MANDATORY_STATE / DENIED_ENTITLEMENT / UNREACHABLE_SERVICE (all that apply) | `[service:<s>]` | `[]` |
| no worker option exists at all | ABSENT_INCOMPATIBLE_UNQUALIFIED | `[]` | `[]` |
| some option member owned | HELD_UNITS | owned members of all options | owners' visits |
| some unowned option member unavailable now or shift does not fit | INSUFFICIENT_SHIFT | those members | `[]` |
| `lane_count = 0` | ABSENT_INCOMPATIBLE_UNQUALIFIED | `[]` | `[]` |
| all lanes owned | HELD_UNITS | lanes | owners' visits |
| zone has no positions / no ports | ABSENT_INCOMPATIBLE_UNQUALIFIED | `[zone:<z>]` | `[]` |
| zone positions (or candidate ports) exist but none enabled | STATIC_OUT_OF_SERVICE | the disabled positions/ports | `[]` |
| all enabled candidates owned | HELD_UNITS | owned positions (and ports) | owners' visits |
| vendor disabled | STATIC_OUT_OF_SERVICE | `[vendor:bay:01]` | `[]` |
| vendor bay/worker count 0 | ABSENT_INCOMPATIBLE_UNQUALIFIED | `[vendor:bay:01]` / `[vendor:worker:01]` | `[]` |
| vendor unit owned | HELD_UNITS | owned vendor units | owners' visits |
| vendor availability does not fit | INSUFFICIENT_SHIFT | `[vendor:worker:01]` | `[]` |
| storage / cache capacity short | FULL_STOCK_CACHE | `[storage:<v>]` / `[cache:depot]` | `[]` |

Owner of a unit held by a cache task is reported with no holder visit. HELD_UNITS merges all held units across
families. `FINISHED_BUT_BLOCKED`, `DIVISIBLE_CAPACITY_TIGHT` and `PREREQUISITE` appear only in the
verifier's visit-level accounting (§10.4), never in decisions; `DECLARED_RULE_DEFERRAL` is unused in v1.

### 8.6 Divisible allocation and credit (C2.1)
Two independent max-min problems with weight 1.

* **Charging**, unit mJ/tick: flow `flow:<v>:charge`, path `[port:<id>, site:supply]` (sorted), capacities
  port `rating_w×1000`, site `(supply_w − background_w)×1000`; own cap = vehicle acceptance at the current
  energy (DC band cap or AC cap) ×1000. Disabled resources never carry flows.
* **Network**, unit bytes/tick: vehicle direct download `[client:<v>, network:pool, network:wan_down]`;
  cache-served download `[cache:read, client:<v>, network:pool]`; upload `[client:<v>, network:pool,
  network:wan_up]`; cache fetch `[network:wan_down]`. No own cap. Capacities from `network.*_bytes_per_tick`;
  each `client:<v>` has `client_bytes_per_tick`.

Progressive filling with exact rationals; zero-capacity resources freeze their flows at `0/1`; ties freeze
together. `tight_resource_ids` (BD-11) = sorted `{r ∈ path : final residual(r) = 0} ∪ {flow id if rate =
own cap}`. The verifier checks feasibility plus the bottleneck characterization (every flow is at its own cap
or crosses a saturated resource on which its rate is maximal), which identifies the unique max-min solution.

Credit per interval (anchor `a`, rate `p/q`, remainder `R` = min(target remainder, distance to the next band
edge for DC charging)): cumulative credit at t is `min(floor(p(t−a)/q), R)`; completion/edge tick
`c = a + ceil(R·q/p)` for `p > 0`. Closure at a target/edge: credited `R`, `undrawn_final_tick = p(c−a)/q − R`,
slack 0. Closure by reallocation/pause/cancel at t: credited `floor(p(t−a)/q)`, `quantization_slack =
p(t−a)/q − credited`, undrawn 0. Unchanged flows keep their anchor through unrelated events (no record).
PROGRESS fields: `from_tick = to_tick of the previous report of this interval or a`, `anchor_credited_before`
/`after` cumulative within the interval, `credited = after − before`.

**Sub-quantum guard:** when a flow has `p > 0`, positive remainder and `t < H`, and
`min(floor(p(H−a)/q), R) − credited_after = 0`, the run ends `INCOMPLETE_RESOURCE_LIMIT` with reason
`SUB_QUANTUM_POSITIVE_SHARE` and operands. Zero rate is ordinary blocked work.

### 8.7 Observation projection `depot_observation_v1` (BD-12)
Facts the fixed policy reads; divisible progress (energy, bytes) is deliberately **not** republished because
the policy's choices do not depend on it (it remains reconstructible from PROGRESS/ALLOCATION records):

| entity | fields |
|---|---|
| `worker:<id>`, `vendor:worker:01` | `worker_available`, `resource_owner_task_id` |
| `lane:NN`, `port:<id>`, `vendor:bay:01` | `resource_owner_task_id` |
| `position:<id>` | `position_owner_task_id` |
| `service:<s>` | `endpoint_reachable` (bool), `entitlement` |
| `object:<id>` | `size_bytes` |
| `visit:<id>` (arrived only) | `arrived`, `arrival_tick`, `due_tick`, `location_id` |
| `task:<v>:<template>` (arrived visits), cache tasks | `task_state`, `prerequisite_ready_tick` (null until ready), `mandatory`; data tasks also `content_state` (`null` or a D1-10 state name) |

Owner values are task ids or null; a position's owner is the task that reserved it (inbound move or admit;
harness placements use the completed admit task id). `state_digest` (BD-13) is a hash chain:
`H("fleetlab.depot.observation-state.v1", {previous: previous state_digest | null, facts: <the complete sorted
fact list of this group>})`. `HORIZON.derived_state_digest = H("fleetlab.depot.horizon-state.v1",
{observation: last state_digest, released, unreleased})`.

### 8.8 Blockage records at H (BD-14)
In phase 6 at H, for every unreleased, arrived visit whose **frontier** task (first unfinished mandatory task,
by rank then id, whose prerequisites are complete; release operations after inspection) is READY/PAUSED and
whose current reason set contains `HELD_UNITS`, build the wait-for edge visit → holder visits over the complete
candidate unit set of that task. Run C3 at `t = H`: no enabling event exists after H, so STALL never appears
in a public run. Cyclic closed components (all alternatives internally held) → one `DEADLOCK_DECLARED` record
per component; every other such visit → one `TERMINAL_BLOCKAGE_BEFORE_H` record with
`terminal_holder_id = lowest holder visit id`, `member_visit_ids = [v]`, `held_resource_ids` = held candidate
units, `unmet_alternatives` = one entry per frontier task (its candidate units and holders),
`enabling_event_seq = enabling_event_key = next_tick = null`. Records sorted by first member id. The forward
public route makes circular deadlock unreachable; A40 exercises the C3 function on synthetic graphs.

### 8.9 Guards and terminal status
Writer checks before appending each atomic group: records ≤ 100,000; each record ≤ 16,384 JCS bytes; whole
envelope (header with the longest terminal status, brackets, commas) ≤ 33,554,432 bytes; ≤ 64 entries per
vector chunk. Microstep > 64 → `MICROSTEP_LIMIT`. Rational guard → `RATIONAL_GUARD`. Overflow ends the run
with `terminal_status = INCOMPLETE_RESOURCE_LIMIT`, the last complete prefix and `{guard, detail}`. Cancel →
`CANCELLED`. Only `COMPLETE` ledgers may verify as `VERIFIED`.

## 9. Internal harness (tests only, BD-15)
`harness = {vehicle_profile?: {...C1.3 shape...}, initial: {<visit id>: {position, completed: [template],
connected_port?, content?: {<object id>: 'object_complete'}}}}`. Initial visits must arrive at 0; their listed
templates are COMPLETE at t=0 with `readyTick 0`; the placement position is owned by the completed admit (or
the last completed inbound move); a connected port is ACQUIRED by the completed to_charging. A
`content: object_complete` entry means bytes fully received (download COMPLETE, storage resident). The harness
is not part of `fleetlab.depot.scenario.v1`, is refused by import/share and binds the scenario digest (BD-02).

## 10. Verifier

### 10.1 Interface
`verifyDepotRun(scenario, ledger, {harness}?)` → `VerificationEnvelope` (§10.5). It never runs the engine.

### 10.2 Checks, in record order, fail-fast with precedence
Envelope/binding (header digests, versions, terminal status) → per record: shape (C1.5 schema), `seq`,
strictly increasing key, chunk-group completeness/consistency, record and running byte guards, canonical
rationals → semantic replay. At one action, the order is input/order integrity → duplicate/exclusive
ownership → lifecycle/prerequisite → allocation/policy → terminal metrics. Missing expected completions are
checked at the end of each tick (after all of the tick's records), so a later same-tick record that already
violates lifecycle reports that more specific violation first.

### 10.3 Violation codes
`ENVELOPE_INVALID, BINDING_MISMATCH, VERSION_MISMATCH, RECORD_SCHEMA_INVALID, SEQ_INVALID, RECORD_ORDER_INVALID,
CHUNK_GROUP_INVALID, RECORD_SIZE_LIMIT, NONCANONICAL_RATIONAL, UNKNOWN_REFERENCE, DOUBLE_RESOURCE_ACQUISITION_SAME_TICK
(unit already owned by an action of the same tick), RESOURCE_ALREADY_OWNED, RESOURCE_NOT_OWNED,
RESOURCE_BUNDLE_MISMATCH, TASK_STATE_INVALID, PREREQUISITE_UNSATISFIED, UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE
(check/activation/postcheck/content-transition order), UNAUTHORIZED_CACHE_EVICTION_OR_BYPASS (any cache
eviction/reclaim or a vehicle download bypassing a cache route), WINDOW_VIOLATION, OVERLAP_VIOLATION,
LOCATION_VIOLATION, WORKER_INELIGIBLE, SHIFT_VIOLATION, START_AT_HORIZON, COMPLETION_TIME_MISMATCH,
MISSING_COMPLETION, DUPLICATE_COMPLETION, OBSERVATION_MISMATCH, OBSERVATION_REFERENCE_INVALID,
ALLOCATION_INFEASIBLE, ALLOCATION_NOT_MAX_MIN, ALLOCATION_DELTA_INCOMPLETE, PROGRESS_MISMATCH,
POLICY_NONCONFORMANCE, POLICY_MISSED_FEASIBLE_START, REASON_MISMATCH, RELEASE_CONDITION_UNMET,
BLOCKAGE_MISMATCH, UNPROVEN_DEADLOCK, PREMATURE_DEADLOCK_DURING_ACTIVE_STALL, INCOMPLETE_HORIZON_ACCOUNTING,
TERMINAL_STATUS_MISMATCH, ENTITLEMENT_VIOLATION, STOCK_VIOLATION`.

### 10.4 Reconstruction and projection metrics
The verifier keeps its own state from records and, at every phase-4 microstep, computes its own worklist,
feasibility, choices and reason sets (compares accepted order and recorded rejections), and at every phase 5
its own allocation characterization and credit closures. It derives (all exact):

* per visit: arrival, due, `work_complete_at` (inspection completion), `released_at` (egress completion),
  observed seconds `e−a`, overdue `max(0, e−d)` for non-null due ≤ H, due status (past due / not yet due /
  no due), primary state at H with precedence **offsite > moving > servicing > work_complete_not_released >
  queued_outside > blocked_waiting**, active-at-H rows (template, class, start, exact remaining obligation,
  `minimum_duration_exceeded_time_left_at_start` with lower bound or NOT_AVAILABLE), location intervals, task
  timeline, frontier-reason intervals, data-state quantities per object (received_provisional,
  object_complete, durable_acknowledged, reclaimed, never summed with counters);
* visit-level wait accounting: an interval is **servicing** if any mandatory task progresses (attended or
  timed running, or a flow with positive rate); otherwise its frontier reason set (decision-family reasons of
  the frontier task, plus `PREREQUISITE` when no frontier task exists, `DIVISIBLE_CAPACITY_TIGHT` for a running
  zero-rate mandatory flow, `FINISHED_BUT_BLOCKED` when inspection is complete and a release operation waits),
  with the primary code chosen by the Q15 accounting order `UNKNOWN_MANDATORY_STATE/ABSENT_INCOMPATIBLE_UNQUALIFIED,
  STATIC_OUT_OF_SERVICE, DENIED_ENTITLEMENT, UNREACHABLE_SERVICE, PREREQUISITE, SCHEDULED_WINDOW/INSUFFICIENT_SHIFT/
  OVERLAP_EXCLUSION, FULL_STOCK_CACHE, HELD_UNITS/DIVISIBLE_CAPACITY_TIGHT/FINISHED_BUT_BLOCKED,
  DECLARED_RULE_DEFERRAL`;
* port 10-class partition over `[0, H)`: unavailable, free, unconnected_position_blocked,
  reserved_inbound_connect, connected_drawing, connected_zero_draw, at_target_lifecycle_running (charge
  complete and any mandatory content task of the vehicle progressing), at_target_waiting, inspection,
  unplug_handling;
* position 8-class partition: unavailable, free, inbound_exit_handling (reserved for an inbound move, connect,
  or an outbound move/unplug from it), zone_native_service_active (intake in waiting, cabin in cleaning,
  positive-rate charge in charging, diagnosis/repair in garage), retained_other_work (any other mandatory task
  of the occupant progressing), inspection, finished_but_blocked (inspection complete, release not started or
  waiting), waiting_no_progress; plus `port_released_position_held` seconds;
* resource ownership/attention fractions with installed/enabled denominators, energy credited, useful bytes
  by direction, the V vector (C1.6) with `practiced_reference_v1` classes present in the arm.

### 10.5 `VerificationEnvelope`
`{schema:'fleetlab.depot.verification.v1', status:'VERIFIED'|'INVALID'|'INCOMPLETE_RESOURCE_LIMIT'|'CANCELLED',
consistency:'INTERNALLY_CONSISTENT'|'INVALID_EVIDENCE'|'NOT_AVAILABLE', primary_violation:{code, seq, tick,
detail}|null, digests:{scenario, workload, policy, run|null}, versions:{engine, verifier, projection, metric},
trust:{authenticity:'NOT_AUTHENTICATED', authorization:'NOT_EVALUATED', deployment_permission:'NONE',
evidence:'NOT_EVIDENCE'}, ledger:{records, bytes, terminal_status, guard|null}, projection|null}`.
`projection` exists only for `VERIFIED`; INVALID quarantines every metric, narration and chart.

## 11. Comparison — `compare.js`
`checkPairCompatibility(baselineScenario, candidateScenario)` (both already validated) → `{compatible,
treatment:{intervention_count, fields:[pointer], leaves:[{pointer, old, new}]}, issues}`; authoritative
pointers are exactly the C1.2 table; any other difference, or a non-validating arm, is incompatible before any
run starts. `compareDepotRuns(baseEnv, candEnv, treatment)` accepts only two `VERIFIED` envelopes whose
compatibility holds and returns `ComparisonEnvelope {schema:'fleetlab.depot.comparison.v1', classification:
'improvement'|'worse'|'tie'|'mixed'|'NOT_AVAILABLE', components:[{id, direction, baseline, candidate, delta,
relation}], digest, treatment}`. Classification is component-wise (C1.6); missing/incompatible → NOT_AVAILABLE.

## 12. Engine API, ledger record contents and source-folder decision

* `createDepotRun(scenario, {harness}?)` → cursor; `stepDepotRun(cursor, {maxTicks})` processes at most `maxTicks`
  event ticks and returns `{done:false, tick, records}` or `{done:true, ledger, terminal_status, guard}`.
  `cancelDepotRun(cursor)` makes the next step return `CANCELLED`. The caller's budget never changes results.
* `ledger` is the C1.5 envelope object (records are plain objects); its canonical text is `jcs(ledger)`. The
  engine's running byte count must equal `utf8Length(jcs(ledger))` exactly (tested).
* RESOURCE_DELTA `changes` are sorted by `resource_id`; `owner_task_id` is the owning task (positions: the
  inbound move/admit that reserved them; ports: the `to_charging` that reserved them; workers, lanes, vendor
  units: the task using them). A move start RESERVEs the destination (and port) and ACQUIREs worker(s) and lane;
  its completion RELEASEs worker(s), lane and the origin position and ACQUIREs the destination. Connect completion
  ACQUIREs the port; unplug completion RELEASEs it.
* CONTENT_TRANSITION owners: `visit:<v>` or `cache:depot`; objects `object:<id>` or `logs:<v>`. Download start
  RESERVED (size); completion OBJECT_COMPLETE; checks/activation/postcheck their completion events (bytes = size);
  upload completion OBJECT_COMPLETE (log bytes); acknowledgment DURABLE_ACKNOWLEDGED then RECLAIMED (log bytes);
  RECEIVED_PROVISIONAL for partial bytes at optional-upload cancel or at H.
* **BD-16 source folder.** The hosted route is emitted at `depot-readiness/` but its source page lives in
  `playground/fleetlab/depot-lab/{index.html,visual.css}`: `hostedRoutePackage` maps only `visual.css`, so a
  source folder named like its emitted folder compares a raw page with the rendered page. This is the
  file-map change the reconciliation §11.3 permits ("update this map and its import-boundary tests together").

## 13. Verified projection `depot_projection_v1` (UI contract)

Only `VERIFIED` envelopes carry `projection`. All exact quantities are integers (safe) or rational strings
`"p/q"`; the UI formats but never recomputes. Shape:

```text
projection = {
 version, horizon_tick, arrival_window_tick, target_soc_pct,
 visits: [{ id, arrival_tick, due_tick, released_at|null, work_complete_at|null, observed_s, overdue_s,
   censored, due_status: 'past_due'|'not_yet_due'|'no_due', on_time: bool|null,
   state_at_h: 'released'|'offsite'|'moving'|'servicing'|'work_complete_not_released'|'queued_outside'|'blocked_waiting',
   route: 'none'|'onsite'|'vendor', terminal_zone,
   tasks: [{template, mandatory, state_at_h, start|null, end|null, workers:[id], position|null, port|null}],
   location: [[from, to, loc]],                  // loc: 'outside'|'moving'|'offsite'|'released'|<position id>
   waits: [[from, to, primary_code]],            // nonservice intervals only (servicing excluded)
   wait_seconds: {code: s},
   frontier_at_h: {task|null, reasons:[{code, resource_ids, holder_visit_ids}]},
   active_at_h: [{template, cls, start, remaining:{unit, value}, could_not_finish:true,
                  minimum_duration_exceeded_time_left_at_start: true|false|null, lower_bound_ticks|null}],
   remaining: {reference: {class: "p/q"}, energy_mj: int, bytes: int},
   energy: {initial_mj, target_mj, credited_mj},
   data: [{object, direction, mandatory, bytes, credited, state}] }],
 resources: {
   ports: [{id, kind, position, rating_w, enabled, partition: {class: ticks}, owned_ticks}],
   positions: [{id, zone, enabled, partition: {class: ticks}, port_released_position_held_s, owned_ticks}],
   workers: [{id, available_s, busy_s, attention: "p/q"|null}], lanes: [{id, busy_s}],
   vendor: {bay_busy_s, worker_busy_s}, site: {supply_w, peak_draw_w: "p/q", energy_credited_mj, tight_s},
   network: {useful_bytes_down, useful_bytes_up, tight_s: {resource: s}} },
 intervals: {                                    // schematic replay at a cursor tick
   positions: [[position, from, to, visit, class]], ports: [[port, from, to, visit, class]] },
 events: [[tick, visit|null, template, 'START'|'COMPLETE'|'PAUSE'|'RESUME'|'CANCEL']],
 metrics: {term_id: exact value},                // keys are registry term ids
 vector: {classes: [class], components: [{id, direction:'up'|'down', value}]},
 blockage: [{classification, member_visit_ids, held_resource_ids, terminal_holder_id}] }
```

`ComparisonEnvelope` (§11) adds per-component `{id, direction, baseline, candidate, delta, relation:
'better'|'worse'|'equal'}` and the treatment `{intervention_count, fields, leaves}`.

## 14. Runtime: job, worker, session (Task 7)

* **Job** (`depot-lab-job.js`, pure, runs in the worker or in tests): `runDepotJob(request, {onProgress, maxTicks})`
  validates each arm with `validateScenario(text, {origin:'import'})`, checks pair compatibility **before any
  run**, runs baseline then candidate with `stepDepotRun`, verifies each with `verifyDepotRun`, compares with
  `compareDepotRuns`, and returns `{type:'result', id, generation, scenario_digests, envelopes, comparison,
  ledger_texts}`. Refusals return `{type:'refused', id, generation, reason, issues}` with zero model starts.
* **Worker** (`depot-lab-worker.js`): binds `self.onmessage` only under a `WorkerGlobalScope` guard; messages
  `{type:'run', id, generation, arms:{baseline, candidate|null}}`; posts `progress {id, generation, stage:
  'checking_setup'|'running_baseline'|'running_candidate'|'checking_results', done, total}` and the job reply.
  Shape-checks every inbound message before reading fields.
* **Session** (`depot-lab-session.js`): `createDepotSession({workerFactory, onChange})` →
  `{get, edit(fn, {scope:'both'|'candidate'}), selectPreset(id), run('baseline'|'pair'), cancel(), dispose(),
  importText(text), exportText(), shareFragment(), openFragment(fragment)}`. One fresh worker per run;
  `cancel` terminates it (immediate) and records `cancelled`. Every edit bumps `generation`, recomputes draft
  digests and validation, marks any current result stale (kept only as labelled history) and never starts a
  run. A reply is accepted only when `id`, `generation` and both scenario digests equal the pending request and
  the current draft; anything else is discarded as stale (A42) without touching current state. No browser
  persistence. Results are deep-frozen.

## 15. Share, import and export (A41)

Envelope `fleetlab.depot.share.v1` = `{schema, arms:{baseline, candidate|null}, presentation:{reading_level,
preset|null, cursor|null, selection|null}, expected:{baseline_run_digest|null, candidate_run_digest|null},
honesty:[the three strings]}`; canonical JCS, UTF-8, base64url (no padding) in the fragment `#share=<payload>`.
Gates in order, each with **zero model starts** on refusal: payload ≤ 32,768 base64url characters (transport);
decoded UTF-8 ≤ 524,288 bytes (whole envelope, before parsing); strict parse (duplicate keys, depth, tokens);
closed shape; each arm `validateScenario(..., {origin:'import'})`; pair compatibility. Opening a share never
runs: the visitor presses Run; the session reruns and verifies; matching digests show the result, a mismatch
shows **Could not reproduce** with no narration. Oversized links are refused with an offer to export the
configuration as a local file. Export (`fleetlab-depot-configuration.json`) is the same envelope as text and
always carries the honesty strings; a verified-result summary export adds exact metrics and digests.

## 16. UI requirements digest (Task 8)

Source page `playground/fleetlab/depot-lab/index.html` (+ `visual.css`, light scheme, no media, no decorator
ids/classes listed in the architecture digest such as `#chapter-copy`, `#staffing-help`, `.flow-hero`,
`.capacity-hero`, `#main > .hero`). One shared draft/run/cursor/selection for both reading levels; WAI tabs with
manual activation (arrows move focus, Enter/Space activate); static `role="status"` and `role="alert"` nodes in
HTML (never an `aria-live` literal in a copy module); page entry, preset selection, tab change and edits never
run. Required: guided questions (in-scope learning questions 1 to 3, question 4 shown Not available in this
version, question 5 a later stage) and an equally visible Build your own; all seven families' controls,
the shared target SOC (60/80/90/100 shortcuts plus integer input 20 to 100) and vehicle/position ranges 1 to 200
usable at 390 px; two counters (Differences from baseline; Edits since last run) and the bundle disclosure
("1 intervention · 2 authoritative fields"); run states draft/running/cancelled/incomplete/stale/invalid/
verified/could not reproduce/refused/incompatible as text; every V component and companion in both views;
native SVG schematic plus equivalent lists, holder trail and partitions; exact-value inspection; replay only on
user request and stopped by `prefers-reduced-motion`, `html[data-motion=reduce]`,
`html[data-visitor-motion=paused]` or `document.hidden`; three honesty strings verbatim in both views and every
copied/exported/shared summary. Copy avoids em/en dashes (except the exact honesty string), the words predict,
forecast, live, real-time, monitoring, and the label-tuple literals.

## 17. Copy-rule exceptions (BD-17)

check-dist gains one route-scoped exact-string exception: the first honesty sentence may contain its em dash
only in depot-lab copy modules and the depot page; any other dash still fails. The scope label shown to
visitors comes from the existing `FLOW_TRUST` constant so the label-tuple literal is never spelled. The
integrated site's site-wide page analytics is not applied to `/depot-readiness/` in this build (the owner's
"no telemetry" instruction); the release review must confirm or reverse that exclusion.

## 18. Metric keys and vector component ids (registry ↔ verifier ↔ UI)

`projection.metrics` keys (each must be a registry `term_id`): `requirement.energy.target_soc_pct`,
`release.on_time_count`, `release.due_count`, `release.unfinished_due_count`, `release.released_count`,
`release.unreleased_count`, `visit.work_complete_count`, `visit.censored_count`, `visit.overdue_s` (sum over all
arrivals), `visit.turnaround_observed_s` (sum over all arrivals, censored at H), `work.remaining_reference_seconds`
(object by class, `"p/q"`), `energy.remaining_required_mj`, `data.remaining_required_bytes`,
`data.optional_unfinished_bytes`, `charge.energy_credited_mj`, `charge.peak_site_draw_w` (`"p/q"` W, the S§13.1
peak-power row), `network.useful_bytes_down`, `network.useful_bytes_up`, `resource.attention_fraction`
(`"p/q"` or null when no worker time is available), `wait.reason_seconds` (object by code).

Vector component ids, in presentation order: `on_time_count` (up), `overdue_seconds` (down),
`observed_visit_seconds` (down), `unreleased_count` (down), `remaining_reference_seconds:<class>` (down, one per
class with positive reference effort present in either arm, sorted by class id), `remaining_required_kWh` (down;
value is the exact integer mJ, displayed as kWh), `remaining_required_bytes` (down).

## 19. Decisions recorded during the build (binding for engine, verifier and UI)

Corrections to earlier sections: (a) §8.3: a move completion ACQUIREs only the destination **position**; the
port is ACQUIRED at connect completion (§12 governs). (b) §7: the effective cabin window is
`max(global, visit cabin window)` for both `cabin` and `to_cleaning`; a visit window on `to_cleaning` raises only
`to_cleaning` (C1.3). (c) §8.6: only DC charging clips at band edges; AC acceptance is band-independent (D1-04
"the 11-kW AC vehicle cap is unchanged across these bands"), so an AC session is one interval to target and the
frozen 11,782-s AC charge / 13,102-s hold hold exactly (measured).

**Ledger keys and grouping (engine BD-E1–E4, E16).** Every record group gets its own event ordinal: `EEEEEE` is the
per-(tick, microstep) group counter and `GG` is always `00`; `CCCCC` is the chunk index; `group_id` uses the same
counter. Suppressed work consumes no ordinal. An action id's ordinal is that of its first group (the decision or
the acknowledgment START). COMPLETE references the original START action; RESUME gets a new action id; START,
RESUME and PAUSE carry the decision's `observation_seq`; COMPLETE, CANCEL and acknowledgment START/COMPLETE carry
null. Each logical step is guard-checked and appended whole. Chunks are filled greedily up to 64 entries and close
early if the record (measured with `chunk_count` 100000, `chunk_index`/`seq` 99999) would exceed 16,384 bytes; a
single entry that cannot fit refuses with guard `RECORD_BYTES`. Guard names: `RECORD_COUNT`, `RECORD_BYTES`,
`LEDGER_BYTES`, `VECTOR_LIMIT`, `SUB_QUANTUM_POSITIVE_SHARE`, `RATIONAL_GUARD`, `MICROSTEP_LIMIT`; test-only
`guardOverrides` keys `maxRecords`, `maxRecordBytes`, `maxLedgerBytes`, `maxChunkEntries` may only lower limits.

**Parallel-slice chunking (BD-E12, revised by the integrator).** A POLICY_DECISION whose reason vectors exceed 64
ids, a BLOCKAGE whose member/held/alternative vectors exceed 64, a HORIZON, an OBSERVATION, a PROGRESS or an
ALLOCATION_DELTA is one chunk group: chunk k carries the k-th slice (possibly empty) of every vector field;
scalars repeat; every reason (same codes, same order) and every unmet alternative (same visit/task) appears in
every chunk with its sliced inner vectors. Reassembly concatenates slices in chunk order. Only more than 64
unmet-alternative entries (unreachable through public routes) still refuse with `VECTOR_LIMIT`. Example: 200
visits arriving at once into 100 waiting positions completes (156 chunked decisions).

**Phase and event details (BD-E5–E8, E11, E13–E14, E17).** At H phases 0, 1, 2, 3 and 6 run. Availability before
the run counts as false: every start of a maximal availability union (including tick 0) and every end at or
before H is a SHIFT_CHANGE; within a rank changes sort by typed id (`vendor:worker:01` before `worker:*`); vendor
units exist only when the vendor is enabled with that count 1. WINDOW_OPEN is emitted only for windows > 0, for
arrived visits' incomplete tasks; every such tick is an event tick. The location family is skipped while any
running task of the vehicle is MV/VT/VS (overlap excludes it); a stationary off-site vehicle (between vendor legs)
fails data/timed/attended work with ABSENT_INCOMPATIBLE_UNQUALIFIED and `[]`; an uncovered position reports
`[zone:<z>]`. Sub-quantum is checked for every interval opened in phase 5. At egress completion every READY or
PAUSED optional upload gets CANCEL, plus RECEIVED_PROVISIONAL only when credited bytes > 0 (same rule at H, cache
fetches included). Cache-task facts are visible from the first snapshot; phase-4 changes appear at the next event
tick's phase 3. Harness-completed tasks have ready tick 0; a cache task becomes READY once any of its intake
prerequisites is complete for an arrived visit.

**Reasons and allocation (BD-E9, E10).** Vendor: disabled → STATIC_OUT_OF_SERVICE `[vendor:bay:01]`; a zero count →
ABSENT naming the missing unit(s); only when enabled with both units: owned → HELD_UNITS, else an availability
misfit → INSUFFICIENT_SHIFT `[vendor:worker:01]`. For `to_charging`, STATIC lists the disabled ports and the
disabled positions of candidate ports. A band-edge closure reopens the interval at the edge tick; a flow appears
in ALLOCATION_DELTA only if `(rate, path, tight)` changed; a tight-set change alone lists the flow but keeps its
anchor; tight ids are all saturated path resources plus the flow id when its own cap binds.

**Blockage at H (BD-E15).** Frontier = mandatory READY, RUNNING and PAUSED tasks sorted by (rank, id). A visit is
included only if its first frontier task is READY or PAUSED and its reason set at t = H contains HELD_UNITS; one
unmet-alternative entry per READY/PAUSED frontier task with HELD_UNITS; holders exclude the member itself. A
deadlock is a strongly connected component of 2 or more whose holders all lie inside it (`terminal_holder_id`
null); everything else is TERMINAL_BLOCKAGE_BEFORE_H with the lowest holder id.

**Supervision.** Solo independent options precede pairs, and a pair needs an independent supervisor who could do the
task alone within the same fit, so the fixed policy never selects a pair: supervised-only additions are a
structural null, exactly as D1-09 discloses (TN).

**Contract layer (contract-test builder).** Parser depth counts containers only (32 admitted, 33 refused);
`validateScenario` refuses non-plain object input before reading it (`NOT_PLAIN_DATA`); `compileScenario`
`reference` is a list of `[class, seconds]` pairs; acknowledgment, transit, data, charge and cache tasks carry no
reference work; vendor service carries diagnosis plus the fault's repair class.

**Comparison, runtime, share, format (runtime builder BD-18–26).** Leaf pointers address ID-keyed members by id
(`/site/ports/DC03`, `/visits/01/arrival_tick`, `/workers/<id>/qualifications/<class>`), added/removed members are
one leaf with null old/new, RFC 6901 escaping, sorted by pointer string. A compatible pair has
`intervention_count` 1 when any authoritative field differs (else 0) and `fields.length` is the field counter (Q8:
"1 intervention · 2 authoritative fields"). A reference class absent from one verified arm counts as exact `0/1`
there; the verifier emits `vector.classes` as the complete list of classes present in that arm. The job verifies a
fresh parse of the retained canonical ledger text, never engine objects; replies add `{type:'failed'}`; default
`maxTicks` 4,096. The session starts idle with the default baseline, adds `setPresentation` (no generation change,
no run), receives the share codec by injection, keeps at most four stale history entries without ledger texts,
and never cancels a pending run on edit (its late result goes to history). Share base64url is strict; the payload
may carry the `#share=` key or not; refusal codes `TRANSPORT_LIMIT`, `SHARE_ENCODING`, `INCOMPLETE_RESOURCE_LIMIT`,
parser codes, `SHARE_SHAPE`, `INVALID_SETUP`, `INCOMPATIBLE`. Measured: every pair preset's link is 39,314 to
42,623 characters, so **pairs share only through the configuration file** (the 32,768-character transport limit
and the two-full-scenario envelope are both frozen); baseline-only links fit (about 20,000 characters) except
S200. Formatting truncates toward zero, prints "< 1 min" for a positive value under a minute, never "0 min".

**Registry (registry builder BD-R1–R14).** registry.js imports `FLOW_TRUST` from `src/model/depot-flow-contract.js`
(a 3,047-byte leaf) so the scope label is never spelled; rows carry the D1-11 fields plus `pointer`, `treatment`,
`direction`, `value`; ids: metric keys as §18, vector component ids verbatim, `reason.<CODE>`, `<group>.<value>`,
`trust.<axis>`; `charge.peak_site_draw_w` is charging-only (background excluded and listed as a companion);
`visit.due_status.past_due` means due ≤ H regardless of release; `release.unfinished_due_count` counts
due-population visits without a verified release by H; SOURCES are plain-text citations with N02 tagged
"recruiting material; work categories only" and N06 "UK spectrum context only".

## 20. Verification-stage decisions and the first-slice checkpoint

* **Vendor hold (review F3, integrator decision).** A disabled vendor (STATIC_OUT_OF_SERVICE `[vendor:bay:01]`) or
  a zero vendor count (ABSENT naming the unit) is an explicit hold **before** `vendor_departure` as well as at
  `vendor_service` (D1-09 "disabled vendor means explicit hold"); the car keeps its depot position and the hold is
  visible. Both reasons are reported when both hold (review F5). Dynamic vendor waits (bay held, availability
  misfit) stay at service. Engine and verifier apply the same written rule; ABSENT follows the configured counts,
  not the enabled flag.
* **Zero-byte cancel (verifier DEF-1).** A cancelled optional upload that never received a byte keeps
  `content_state` null and emits no RECEIVED_PROVISIONAL.
* **Zero-length transfer episodes (review F2).** A transfer started or resumed earlier in a pass may be paused by a
  later-ranked conflicting start in the same pass; it opens no interval and keeps its storage reservation. This
  is the literal rank order, not an oscillation (C2.2): the pause follows a real conflict-state change.
* **H reporting (review F4).** Phase 6 reports every active flow **with an open interval**; a DC flow whose band
  edge falls exactly on H was already closed in phase 0 and has no H item.
* **Verifier conventions (BD-V1–V10).** Structural pass over every record before semantic replay; within an
  action group integrity → ownership → location → bundle → reservation → lifecycle → claimed units → policy;
  observation findings are deferred to the end of the tick; CANCEL at egress carries the egress START action and a
  null observation; `content_state` is the last data-state transition; C3 graph input `{t,H,visits:[{id,owns,
  alternatives}],events:[{key,tick,visit,releases}]}`; a rational guard during verification returns
  INCOMPLETE_RESOURCE_LIMIT. When no mandatory frontier task exists, the visit-level reason follows the earliest
  incomplete predecessor to its source or window (D1-12), correcting §10.4's shorthand.
* **First internal slice checkpoint (reconciliation §11.5 Task 6), measured on the working tree with the scratch
  measurement script (raw bytes = emitted bytes for route modules, which are emitted unchanged):** runtime raw
  source 307,243 / 524,288 (domain/contracts 105,419 / 131,072; verifier 87,042 / 131,072; registry/configs
  57,195 / 65,536; presentation 37,897 / 131,072; worker/session 19,690 / 65,536). Route module closure 32 modules,
  315,798 bytes (depot-owned 296,485; shared leaves `core/sha256.js`, `core/canon.js`, `model/depot-flow-contract.js`,
  `ui/dom.js` 19,313); with the 73,889-byte hosted brand set, `_headers` and route files the closure stays near
  0.40 MiB of the 786,432-byte cap. No ceiling fails; expansion of the remaining UI is permitted under §7.

## 21. Non-anticipativity of event ticks and cache visibility (A27, hardening D1/D2)

BD-07 is revised: the event-tick set is arrivals; worker and vendor availability changes; attended/timed
completions; flow completion and band-edge ticks; a visit's task-window ticks and due tick **only when strictly
later than that visit's own arrival**; and H. A future visit therefore contributes no tick before it arrives.
Depot cache-task facts are published only when the first visit whose intake can trigger that fetch arrives, not in
the tick-0 snapshot. The verifier owns the event-tick set: it walks its own computed ticks, replays every phase at
a silent event tick (so a missing time-dependent rejection fails `REASON_MISMATCH`), replays records found at any
other tick first (so a fabricated record still reports its own semantic code, as A38/A39 require) and then refuses
the extra tick with `RECORD_ORDER_INVALID`. The site-wide hosted transform gains `tagFree`, used only for the depot
page: no analytics tag or placeholder, and a privacy line that names only the hosting provider.
