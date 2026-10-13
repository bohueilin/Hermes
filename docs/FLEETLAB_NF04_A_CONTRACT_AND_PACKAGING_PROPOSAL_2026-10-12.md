# FleetLab NF04-A: frozen numerical contract and B-lite packaging decision

October 12, 2026 · Audit-amended contract `nf04-a-contract/1.0.0` · **Cold/repeated numerical contract frozen; packaging proof authorized; NF04-B not started or authorized by this freeze.**

The owner's current instruction authorizes the bounded NF04-A build, validation, Git push and educational-site publication. It does not authorize the NF04-B engine or a new scientific run. This revision resolves M1–M3 from the October 10 Revision 3 audit and selects M4's B-lite package-only proof. Analytical values remain calculations; this document does not assert that a package test, NF-04 execution or publication has passed.

Read with the [October 12 experience specification](FLEETLAB_NETWORK_FLOWS_NEXT_DESIGN_SPEC_2026-10-12.md) and [audit decisions](FLEETLAB_REV3_AUDIT_DECISIONS_2026-10-12.md). The [October 10 proposal](FLEETLAB_NF04_A_CONTRACT_AND_PACKAGING_PROPOSAL_2026-10-10.md) and its complete historical inventory remain unchanged.

## Scope, source identity and evidence status

| Item | Status / meaning |
| --- | --- |
| Current application baseline | `87733ad0b7dd73f65b1742aff4c9253c99e6f391`, Revision 3 NF-03. |
| Starting checkout | `9d47e4cbc8be63897d4d459a8b8a507c5ae3e29a`, branch `codex/fleetlab-city-sf`; changes since application baseline are documentation/receipts, not new teaching application code. |
| Historical measurement only | `1141b12160018216c3baf6875278fe0890762b15`, Revision 2; never substitute its 1,232 B margin for the current 117 B margin. |
| Numerical freeze | A1–A5 and bounds below govern the next cold-cache versus repeated-delivery slice. No production engine or accepted NF-04 record is created by prose. |
| Preload | Paired-window semantics and analytical fixtures specified below; preload UI and exploration deferred to a later extension. |
| Package proof | Authorized on current payloads and tiny declared fixtures. Its fresh source/emitted/closure/source-offer/retention receipt and failure results must be reported separately. |
| Publication | Authorized educational-site release, conditional on validation; actual source/deployment identities and readback belong in the completed release handoff. |
| Device/human evidence | V1, physical devices, accessibility and independent comprehension remain explicit acceptance work; historical browser observations are not new tests. |

All existing lessons, offline content, City/source offers and their authority boundaries remain in scope for preservation. SF remains **HOLD / BLOCKED_MAP_QUALIFICATION**; Austin and the held power study stay paused. Package/source consistency is not producer authentication, software-release authorization, real-world safety or deployment permission for vehicles.

## A1 — exact capped equal-share allocator and replay state

Frozen allocation policy ID: `nf04-capped-equal-share/1.0.0`. Apply it separately to WAN and local delivery. An allocator accepts integer bytes, never Gbit/s display values.

Each resource has an immutable **universe** of all transfer IDs that can occur in that arm, known from validated inputs. Sort IDs by ASCII code-unit order, never locale or input-array order. IDs are unique, 1–32 characters from `[A-Za-z0-9_-]`. The record persists the universe and `next_id`, a member of that universe. Initially `next_id` is the first ID. Empty universes are rejected for the two-resource model. The cursor is a position in this full universe, including currently ineligible, exhausted and not-yet-arrived transfers; it is not an index into a changing eligible array.

For boundary `t`, freeze eligible IDs after boundary closure. For each eligible transfer `i`, calculate `limit_i = min(remaining_bytes_i, cap_bytes_i_for_slot)`. Exclude zero limits from allocation, without deleting their IDs from the universe. With aggregate budget `B`, allocate as follows:

```text
grant[i] = 0 for every universe member
remaining_budget = B
active = eligible members with limit[i] > 0
while remaining_budget > 0 and active is not empty:
    q = floor(remaining_budget / count(active))
    if q > 0:
        # Compute this entire round against the same active set.
        add[i] = min(q, limit[i] - grant[i]) for each active i
        grant[i] += add[i]
        remaining_budget -= sum(add)
        remove every i with grant[i] == limit[i] from active
        # Equal base-share grants never move next_id.
    else:
        i = first active ID at or after next_id in cyclic universe order
        grant[i] += 1
        remaining_budget -= 1
        next_id = immediate cyclic successor of i in the full universe
        remove i from active if grant[i] == limit[i]
unused_bytes = remaining_budget
```

All `add` values are determined before any are applied. Thus a cap cannot depend on traversal order. Each positive-share round either removes a capped/exhausted transfer or leaves fewer bytes than active transfers; the remainder phase grants at most `N−1` individual bytes. With at most four simultaneous transfers per resource, this is bounded; never iterate once per available byte. Only a residual one-byte award advances the cursor. Idle slots, zero budget, base-share rounds and unused capacity preserve it. Leaving a resource does not reset the cursor; a later arrival searches from the persisted position. A retired transfer never becomes eligible again under the same ID; separate transfers need separate IDs.

The engine records input cursor, output cursor, eligible IDs, per-transfer remaining work/caps/grants, aggregate budget and unused bytes for every slot. The verifier separately implements the normative rule and derives eligibility from accepted prerequisites. It compares **every grant and both cursor values**, in addition to conservation. Sharing the engine allocator, a precomputed expected-grant table or its eligibility helper with the verifier is prohibited; shared schema constants and canonical digest encoding are acceptable. Independence here is implementation separation, not independent authenticity.

### Exact allocator fixtures

These are allocator-unit fixtures. A one-byte budget corresponds to a valid 4 B/s resource at 250 ms; arbitrary integer test budgets do not permit unsupported physical rates.

| Universe; eligible; starting cursor | Budget and limits | Exact grants in universe order; unused; ending cursor |
| --- | --- | --- |
| A, B; both; A | `B=10`, limits 1, 99 | 1, 9; 0; **A** (only base-share rounds) |
| A, B; both; A | `B=10`, limits 1, 4 | 1, 4; 5; **A** |
| A, B, C; all; A | `B=6`, limits 1, 99, 99 | 1, 3, 2; 0; **C** (base 1/2/2, residual to B) |
| A, B, C; all; C | Same | 1, 2, 3; 0; **A** (residual to C wraps) |
| A, B, C; all; B | `B=10`, limits 1, 2, 99 | 1, 2, 7; 0; **B** |
| A, B, C; B, C; B | `B=1`, A exhausted, B/C limits ≥ 1 | 0, 1, 0; 0; **C** |
| A, B; both; A | Ten consecutive slots, `B=1`, both have ≥ 10 bytes and cap ≥ 1 each slot | A, B, A, B, A, B, A, B, A, B; total 5/5; final **A** |
| A, B, C, D; A, B; A | `B=1` | 1, 0, 0, 0; 0; **B** |
| Same universe; A, C; B | Next slot `B=1` | 0, 0, 1, 0; 0; **D**; removed B is skipped |
| Same universe; none; D | Any `B=10`, 100 idle slots | 0, 0, 0, 0 each; 10 unused each; **D** persists |
| Same universe; A, B; D | Next slot `B=1` | 1, 0, 0, 0; 0; **B**, with no banked bytes |
| Same universe; B, D; B | Next slot `B=1` | 0, 1, 0, 0; 0; **C**; joining D does not reset priority |

Permute all input request/transfer arrays and the serialized eligible list: canonical output grants, cursor and record identity must remain identical. The verifier rejects a correct-total 9/1 replacement of a specified 5/5 ten-slot history, a mutated cursor even when this slot's totals match, a capped transfer exceeding its limit, and invented eligibility.

## A2 — integral rates at both supported quanta

**Frozen v1 restriction: integer useful rates representable at both supported quanta.** Aggregate rates and each transfer cap are integer useful bytes/second, divisible by four. Supported quanta are exactly 1,000 ms and 250 ms. Compute `slot_bytes = bytes_per_second × quantum_ms / 1,000` exactly after validation. It must be an integer at **both** quanta, even when a run selects only one. Zero is allowed. A zero aggregate rate means that resource has no available capacity; a zero individual cap means that transfer is capped at 0 B/s even when aggregate capacity is positive. These causes must remain distinct. Resolve a missing cap to the baseline declared aggregate rate before forming paired arms; keep that resolved cap fixed when varying only aggregate capacity. A cap may exceed aggregate capacity, but the allocator cannot exceed either budget. This also permits a zero-capacity resource with positive hardware caps. UI Gbit/s text converts through exact decimal/rational parsing; silently rounded binary floating-point conversion is rejected.

There is no fractional byte or cap remainder state in v1 (`fractional_carry = NOT_APPLICABLE`). Unused whole-byte budget is discarded every slot, including idle slots. Remaining work may be any supported integer byte value, so last-slot grants can be smaller than the cap. This removes Revision 2's candidate fractional-cap ambiguity without silently flooring it away. Positive rates below 4 B/s or not divisible by four are outside v1; an extension requires a new schema and independently specified aggregate **and per-transfer** carry lifecycle.

Required fixtures: 1 B/s cap rejected at 250 ms **and** 1,000 ms; 6 B/s rejected; 4 B/s at 250 ms yields four one-byte caps over one second when continuously eligible; the same flow with three idle slots can receive only one byte in the next slot. Default rates 125,000,000 and 250,000,000 B/s and slow local 31,250,000 B/s are representable at both quanta. Arbitrary output grants divided by Δ are useful rates, not new configured cap inputs.

## A3 — bounded closure, horizon and source availability

Time is integer milliseconds. The main window is `[0,H)`; any explicit prefetch window is `[P,0)` with aligned `P≤0`. `H` is a positive quantum multiple. Raw arrival/availability times are retained; eligibility is at the first boundary at or after the raw time. Raw deadlines are **not rounded**. A positive task duration is rounded upward to whole slots; zero stays zero. There is no mid-slot reassignment or downstream service.

At each accepted boundary, including `H`:

1. Apply preceding-slot grants and positive-duration task completions exactly once. Mark receipt and task outcome at this boundary, not at an inferred fractional time.
2. Apply due arrivals, repository availability and declared initial-inventory events once, using canonical event IDs; contradictory identity/state updates reject the input.
3. Run zero-duration prerequisite closure to a fixed point over the validated acyclic task graph. Each node may transition at most once to its terminal outcome; iterate in topological, then canonical-ID order. The input has at most 32 task nodes, so at most 32 terminal transitions can occur at one boundary. Reject cycles before execution and reject any record exceeding that bound.
4. Derive readiness and evaluate the inclusive raw deadline from the completed state. A completed check that fails blocks activation; that is a valid modeled outcome, not a record error.
5. Only if `t < H`, start eligible positive-duration tasks and allocate the next slot. At `H`, start no positive-time task and grant no positive bytes. Eligible zero-duration tasks have already closed in step 3. Mark every nonterminal request unfinished and preserve it in denominators.

Thus a check completing at `H` followed by zero-duration activation produces ready at `H`; positive activation leaves the request unfinished with `activation_started_at=null`. Receipt at `H` plus zero check and activation can also become ready. A failed zero check still prevents activation. An arrival exactly at `H` with positive bytes cannot receive them. A zero-duration task is not allowed to manufacture a positive-byte receipt. Completion at 2,000 ms meets target 2,000 but misses 1,999.

The required artifact has `(artifact_id, version, digest, size_bytes)` and a declared repository `available_at_ms`. All requests in this first slice require the same artifact; same ID/version/digest with conflicting size is invalid. WAN work cannot begin before availability; repeated downloads additionally wait for their individual arrivals. Cold-cache fetching starts when the first arrived request needs the available object. Only an explicit prefetch arm may fetch before arrival. A matching complete initial object is a declared inventory assumption; an unknown earlier transfer history remains **NOT_AVAILABLE**, not zero WAN work over all history. An obsolete object is retained in the prior-inventory ledger and retired before replacing the single cache object; it never satisfies a different identity. The model tracks synthetic byte quantities and identity strings; it does not possess or cryptographically verify a 12 GB software binary.

### M2 — specified preload extension; UI deferred

The first cold/repeated slice uses common `P=0` and the same repository availability in both arms. Preload exploration is a later UI extension; the paired-window rule below is settled now so that this extension cannot change the control's exogenous facts.

Each preload pair uses the same validated recording-window start P and repository availability in both arms. The default uses `P=available_at_ms=−96,000`. The cold control records zero grants before the first vehicle arrival; only the preload policy may fetch then. Both retain main service slots `[0,H)`, earlier service slots `[P,0)`, and full service slots `[P,H)`, with completion processing at ending boundaries. The common exogenous digest binds these identical times, requests, required identity, capacities, caps, tasks and deadlines; arm policy is separately identified.

Inventory at zero is derived from each arm's accepted earlier events when those events exist. A complete cache cannot be assumed if its earlier fetch remains unfinished. The preload fixture records fetch service over `[−96,0)` and commits that complete inventory once at zero. The completed bytes stay in the earlier ledger and are not charged again in the main window.

| Default paired quantity, H=2,400 s | Cold control | Preload intervention |
| --- | ---: | ---: |
| Recording start / repository available | −96 s / −96 s | −96 s / −96 s |
| Earlier-window WAN `[−96,0)` | 0 GB | 12 GB |
| Main-window WAN `[0,2,400)` | 12 GB | 0 GB |
| Full-window WAN `[−96,2,400)` | 12 GB | 12 GB |
| Earlier-window local delivery | 0 GB | 0 GB |
| Main-window local delivery | 48 GB | 48 GB |
| Full-window local delivery | 48 GB | 48 GB |
| Ready after arrival at zero | 378 s | 282 s |
| Elapsed to readiness from common P=−96 s | 474 s | 378 s |

These are analytical expectations, not executed records. “378 s from fetch start” describes the preload intervention; it is not the cold control's completion measured from common P. Declared pre-existing inventory without an available transfer history is a separate input mode: history is **NOT_AVAILABLE**, never measured full-history WAN=0.

## A4 — one accepted boundary, two temporal meanings

A quantitative snapshot is identified by `(record_digest, boundary_ms)`. **Cumulative bytes include all accepted work through boundary t; shown resource rates describe useful grants for the next interval `[t,t+Δ)`.** The inspector must name that interval. `rate_Bps = next_grant_bytes × 1,000 / Δ_ms`; the horizon has zero grants/rates and no next service interval. Prior-slot rates must not be retained to narrate the new task.

Seek snaps to the greatest accepted boundary at or before the requested raw cursor, clamped to the available window. Display the snapped timestamp; an exact event button selects that boundary. UI animation may interpolate position decoratively, but cumulative numbers, ready count, state and rate labels update only from accepted boundary projections. Full-run outcomes stay fixed and are labelled as such. Future-event information is not a current-state explanation.

| Cold fixture boundary | Cumulative WAN / local | Next interval useful rates | State explanation |
| ---: | --- | --- | --- |
| 0 s | 0 / 0 GB | WAN 1 Gbit/s; local 0 | Waiting for shared depot receipt |
| 96 s | 12 / 0 GB | WAN 0; local 2 Gbit/s total, 0.5 each | Receiving locally; 12 GB remains per vehicle |
| 288 s | 12 / 48 GB | Both 0 | Modeled checks start; 60 s remains |
| 348 s | 12 / 48 GB | Both 0 | Activating; 30 s remains |
| 378 s | 12 / 48 GB | Both 0 | Ready in this model |
| H=2,400 s | 12 / 48 GB | Both 0; no next interval | Terminal outcome; no active service |

At repeated-arm 480 s, WAN 48 GB and local 24 GB are complete through that boundary, each vehicle has received 6 GB locally, the next local allocation totals 2 Gbit/s, and checks/activation remain. At 378 s the repeated arm instead has WAN 47.25 GB, local 0 and WAN 1 Gbit/s active. Tests mutate the temporal side of these rates without changing cumulative bytes and require rejection by the projection/record contract checks.

## A5 — inspector and finite playback states

The fixed title is **“Why this state?”** Each accepted state supplies its own headline, quantity, cause and next prerequisite. A positive useful grant means the corresponding transfer is receiving. A zero grant requires a causal explanation from accepted prerequisites, remaining work, individual cap, aggregate capacity and allocation; it does not by itself prove contention. Artifact-derived strings remain escaped text.

| State | Required explanation |
| --- | --- |
| Not arrived | Arrival timestamp; no selected-request work or transfer rate. Shared traffic from other requests remains visible. |
| Waiting for repository/cache/WAN prerequisite | Name the missing identity or incomplete transfer, source availability time if known, and what becomes eligible next. |
| Waiting for resource or individually capped | Remaining bytes, zero current grant, individual cap, aggregate capacity and accepted allocation. Name a zero individual cap as “This transfer is capped at 0 B/s.” Name a zero aggregate rate as unavailable resource capacity. Competing IDs alone do not prove competition caused the wait. When multiple constraints bind, show their values without asserting a unique cause. |
| Receiving | Local/WAN stage, bytes received and remaining, useful rate for the named next interval, then required checks/activation. |
| Checking | Full declared and quantized check duration, elapsed/remaining time; selected-request transfer rates are 0. Shared resource bars still sum all accepted grants. Future success is not revealed as current completion. |
| Activating | Check already passed; activation elapsed/remaining; modeled readiness still pending; no selected-request active transfer. Shared traffic from other requests remains visible. |
| Ready | Exact ready time and raw target, on-time/late status; no claim of driving safety or software-release permission. |
| Failed | The check finished and failed at its declared boundary; activation blocked, ready time null; other requests continue. |
| Unfinished at horizon | Stage reached, remaining work, no completion time and no post-horizon rate; keep request in every required denominator. |
| Record rejected | Separate evidence-error panel; accepted playback withheld. Never show a fictitious vehicle fault or accepted success from rejected data. |

### M1 — selected request and shared resources

During checking or activation, the selected request has no active transfer. Shared WAN and local-delivery bars continue to show accepted aggregate grants for all requests. Checking, failed, ready or not-arrived state never zeroes shared resource traffic merely because that state belongs to the selected request.

For a reusable depot fetch, distinguish **“shared depot fetch is receiving”** from **“selected vehicle is waiting for the depot copy.”** Bytes do not animate into a vehicle until its own local receipt becomes eligible. The shared fetch is not counted as every vehicle's individual receipt.

Analytical staggered fixture: repeated 12 GB requests, V1 arrives at 0 s, V2 at 100 s, default useful rates, 60 s checks and 30 s activation.

| Snapshot / interval | Selected V1 | V2 | Shared-resource expectation |
| --- | --- | --- | --- |
| 0–96 s | WAN receipt | Not arrived | Only V1 uses WAN |
| 96–144 s | Local receipt | WAN starts at 100 s | WAN and local may work concurrently on different requests |
| 150 s | Checking until 204 s; own WAN/local rates 0 | WAN active until 196 s | Shared WAN 1 Gbit/s |
| 200 s | Still checking; own WAN/local rates 0 | Local active from 196–244 s | Shared local 2 Gbit/s |

Zero-cap fixture: one arrived transfer, available repository and positive aggregate capacity, with individual cap 0. It receives no service and the inspector names its 0 B/s cap. It must not invent a competing vehicle, congestion or a depot queue. Also test zero aggregate capacity with a positive individual cap, and both values zero; show all binding values.

Set the finite guide endpoint to the latest terminal outcome across both arms when every request is ready or failed; use `H` if any remains unfinished. A single valid failure does not force an infinite wait for all-ready. Repeated/cold default ends 666 s; cold-only four-vehicle check-failure example has three ready 378 s, V4 failed 348 s and all-ready=null, so a cold-only guide ends 378 s. A repeated/cold failure pair ends at the later arm's actual terminal event. There is no polling for an event that cannot occur.

Acceptance is atomic for both arms and their common scenario digest. A new input revision, newer Watch, route exit or Cancel invalidates the pending job token. A late old result is rejected even if internally valid. Keep the prior immutable accepted pair and playhead labelled **Previous setup**, with all previous metrics tied to that pair; never mix a new input label with old outcomes. Manual seek/selection/pause cancels editorial narration until explicit Resume restores its complete case, arm, vehicle and boundary snapshot. No interaction runs an engine merely to change the displayed arm or time.

## Frozen numerical and parsing bounds for v1

These limits serve this four-vehicle lesson, not a fleet-sizing control. The first slice sets P=0; negative P and obsolete inventory describe the specified later extension, not required first-slice UI controls. Reject over-limit input before allocating buffers. Device budgets below are limits to test, not measured performance.

| Field/resource | Frozen exact maximum or domain |
| --- | --- |
| Requests | 1–4, each with one required artifact |
| Required artifacts / obsolete inventory | Exactly 1 required identity; at most 1 obsolete cached identity |
| Transfer IDs | ≤ 4 WAN and ≤ 4 local IDs per arm; cache/prefetch uses one of the WAN IDs, not an additional unbounded stream |
| Task graph | ≤ 32 nodes, acyclic; no dynamically created IDs |
| Artifact size | Integer 1–64,000,000,000 bytes |
| Useful aggregate rates and transfer caps | Integer 0–1,000,000,000 B/s, divisible by 4; aggregate rates and per-transfer caps are independently bounded; a larger transfer cap cannot override the aggregate budget |
| Quantum | Exactly 250 or 1,000 ms |
| Horizon / prefetch | `0<H≤2,400,000 ms`; `−600,000≤P≤0`; both aligned |
| Arrivals / repository availability | Integer milliseconds within `[P,H]`; request arrivals within `[0,H]` |
| Raw deadline | Integer milliseconds within `[0,H]`, unrounded |
| Check / activation durations | Integer 0–2,400,000 ms before upward quantization; unfinished if beyond H |
| Slot count | ≤ 12,000 across prefetch+main at 250 ms; ≤ 12,001 boundaries |
| Positive transfer grants | ≤ 96,000 per arm (8 possible transfer IDs×12,000); no repeated per-byte events |
| Resource-slot entries / all record entries | ≤ 24,002 / ≤ 130,000 per arm, including boundary/task/inventory entries |
| Serialized input / record | UTF-8 ≤ 64 KiB input; ≤ 32 MiB per uncompressed canonical record; ≤ 64 MiB two-arm accepted pair |
| In-memory job concurrency | One active reconstruction/verification job; cancellation invalidates before replacement; peak heap/device timing still requires measurement |

### M3 — storage provision scales with validated input

Storage contention is outside v1. For N requests for an S-byte object, the repeated arm assumes sufficient non-reusable transit provision for **N×S bytes**; the cache arm assumes provision for **one S-byte valid object**, after obsolete inventory is retired. These are declared provisions, not measured occupancy, disk throughput, cost or an optimization objective. The arms do not have equal storage footprints.

Default N=4, S=12,000,000,000 bytes means 48 GB repeated provision and 12 GB cache provision. At the supported size maximum with N=4, the declarations are 256 GB and 64 GB. Neither fixture invents a storage bottleneck. No eviction engine, disk queue or storage-sizing control is introduced.

All integer products/sums must be checked with `Number.isSafeInteger`; reject rather than coerce non-finite/negative/unsafe values. The largest direct rate×quantum product is `10^12`; capacity over the entire 3,000 s window is ≤ `3×10^12` bytes; per-ledger delivered bytes are ≤ `4×64×10^9 = 256×10^9`. These are below `2^53−1`; computing time in integer ms avoids floating threshold drift. The serialized/event caps also apply to imported records, not just engine output. A valid run that cannot serialize within the cap yields a bounded resource error with no accepted partial record. Performance optimization may use exact run-length spans, but a changed record encoding needs its own schema and replay tests; it cannot silently omit idle cursor state.

## Analytical anchors and implementation acceptance still required

Decimal GB/Gbit/s, useful capacity, full-file forwarding, equal caps and independent parallel 60 s checks + 30 s activation give:

| Fixture | Hand calculation | All ready |
| --- | --- | ---: |
| Four, repeated | 48 GB/0.125 GB/s + 48 GB/0.25 GB/s + 90 s | 666 s |
| Four, cold | 12/0.125 + 48/0.25 + 90 | 378 s |
| Four, preloaded | 48/0.25 + 90; add 96 s earlier fetch for full window | 282 s after arrival; 378 s from fetch start |
| One, repeated or cold | 12/0.125 + 12/0.25 + 90 | 234 s both |
| Four, cold, local 0.25 Gbit/s | 96 + 48/0.03125 + 90 | 1,722 s |
| Four, repeated, local 0.25 Gbit/s | 384 + 48/0.03125 + 90 | 2,010 s |

The 96/384-second WAN and 192-second local waits happen to align at both quanta; this is not a convergence result. Additional acceptance must include off-boundary arrivals, non-divisible object bytes, all exact allocator fixtures, unsupported-rate rejection, staggered per-request forwarding, source unavailable before fetch, wrong inventory identity, check failure, horizon zero closure and positive-task refusal, raw deadline edges, unchanged fixed outcomes while seeking, stale/cancelled jobs, invalid-record refusal and finite failure/censoring endpoints. Compare primary/refinement completion deltas and changed deadline outcomes rather than demanding equality by assumption.

### Discriminating horizon and discretization fixtures

| Input | Required analytical expectation |
| --- | --- |
| One 4-byte object, WAN/local=4 B/s, Δ=1 s, H=2 s, zero checks/activation | WAN completes at 1 s; local completes and readiness closes at H. Raw deadline 2,000 ms is met; 1,999 ms is missed. |
| Same input with positive activation duration | Unfinished at H; activation does not start. |
| One 1-byte object, WAN/local=4 B/s, zero checks/activation, raw deadline 1 s, adequate H | At Δ=1 s readiness is 2 s; at Δ=250 ms readiness is 0.5 s. Deadline outcome changes. |
| Same aggregate grants with a changed per-flow allocation or cursor | Independent policy replay rejects the record even when conservation passes. |

Quantization delay can accumulate across prerequisites. Neither quantum-invariant results nor a universal single-slot error bound follows from the symmetric default. These acceptance requirements are not reports of passing NF-04 tests.

## A6 — bounded packaging decision and required proof

### Current and historical counts stay separate

The following counts are document-reported in the October 10 release handoff and historical proposal. The proof must remeasure the current source and its tools; raw-source growth cannot be inferred from emitted growth.

| Measure | Historical Revision 2, 1141b12 | Current Revision 3, 87733ad / starting 9d47e4c |
| --- | ---: | ---: |
| Counted hosted teaching text | 2,620,208 B | 2,621,323 B |
| Margin under unchanged 2,621,440 B legacy cap | 1,232 B | **117 B** |
| Offline HTML | 2,549,829 B | 2,549,837 B |
| Offline margin after required 50,000 B reserve | 21,611 B | 21,603 B |
| Raw source/build-tool text | 2,679,857 B | Fresh proof measurement required |
| NF-03 complete route closure | 488,377 B | Fresh proof measurement required |
| Integrated site | 1,619,534,486 B | 1,619,535,612 B |

The old 112-module inventory is retained in the October 10 appendix as historical evidence. Neither its raw-source count nor its closure proves that the current build fits. Use current-source manifests for the package-only receipt.

Current planning arithmetic, not a built NF-04 package: 2,621,323 B emitted baseline + 358,400 B route-local target + 32,768 B metadata allowance = 3,012,491 B, leaving 133,237 B under 3 MiB for genuinely added shared text and reserve. Under the unchanged legacy cap the same full local target would need at least 358,283 B recovery before metadata. Deduplication already exists and cannot fund that recovery again.

### Selected architecture: B-lite

| Choice | Disposition |
| --- | --- |
| A: recover all new-route bytes beneath today's 2.5 MiB gate | Fallback only after measured source-preserving reductions; no such recovery is claimed. |
| B: independently packaged routes with digest-path/pointer machinery | Deferred. Introduce only if the bounded B-lite proof cannot satisfy a named invariant. Independent deployment pipelines are outside this task. |
| **B-lite: existing deduplicated teaching build, one atomic integration, source offer and explicit accounting** | **Selected for the authorized package-only proof.** Keeps route closures and original source binding without a new route deployment system. |

The immutable Cloudflare deployment hostname is the generation namespace for reviewer reproduction. Within that hostname, the integration manifest owns exact route, shared, offline, receipt and source-offer bytes; relative imports resolve inside that immutable deployment. This replaces the prior proposal's independently packaged release-digest route paths and separate route pointers. The source offer itself uses an immutable digest path.

**Accepted B-lite tradeoff:** the stable production hostname selects one complete deployed integration, but an already open browser can fetch across a deployment change or reuse cached prior files. Atomic publication is not browser-session atomicity. This proof adds no runtime generation pinning. Complete byte/header readback checks consistency at the time of measurement; package mismatch checks do not prove every stable-host browser session stayed on one generation. Use the immutable deployment URL for reproducible review.

There is no separate route deployment, new mutable `/shared/latest` namespace or backend. A deployment hostname/digest establishes a byte identity to check, not authentic authorship. Prior verified deployment identities are retained for rollback; any old files physically copied into the new site are counted again.

### Gates: existing limits retained; prospective allowances explicit

The proof implements/checks these approved design ceilings. Passing them is a measured result still to be supplied, not a conclusion of this decision. Future NF-04 capacity is prospective; the new aggregate ceiling does not enlarge or relabel the existing legacy compatibility gate.

| Accounting gate | Maximum / target | Counting rule |
| --- | ---: | --- |
| Existing legacy hosted teaching text | **2,621,440 B, unchanged** | All existing hosted teaching text, including NF-03 sidecar. Discovery links/cards and existing shared metadata remain charged to their existing owner. |
| NF-03 complete route closure | **524,288 B** | Full transitive JS/data, shared CSS, route HTML/boot and route metadata, wherever stored. |
| Future NF-04 route-local target | 358,400 B | Engine/verifier/projection/UI/fixtures/CSS/HTML/boot when later authorized; no first-slice engine exists in this proof. |
| Future NF-04 complete route closure | 524,288 B | Full local + shared + route metadata. Planning 350+128+32 KiB leaves only 2 KiB; aim below the target. |
| Prospective aggregate emitted teaching text | **3,145,728 B** | Union of physical emitted teaching runtime/entry/metadata paths. A shared path counts once; duplicate physical paths count twice. |
| Unique original text-source/build-tool inputs | **3,145,728 B separately** | Original inputs, tools, fixtures and needed build metadata; minification cannot conceal source growth. |
| Retained source offer | **4,194,304 B compressed and 4,194,304 B extracted** | Both independently enforced. Preserve original text/build inputs; pinned binary media remain separately retained and counted. |
| Teaching emitted text + stored compressed source offer | **7,340,032 B** | Actual physical text and archive bytes, including duplicated preserved source. |
| Existing binary media | 4 MiB film; 200 KiB poster | Existing allowlist/format checks; no new NF-04 media. Text/JSON cannot be reclassified as media. |
| Complete offline HTML | **2,621,440 B with 50,000 B reserve, unchanged** | Preserve the complete edition and its existing lessons; NF-04 remains hosted-only. |
| Complete current teaching generation | **14,360,576 B** | All current physical teaching text, source offer, media and offline copies. Retained prior-generation files and City/source offers appear additionally in whole-site inventory. |

The complete-generation ceiling is 3 MiB text + 4 MiB source offer + 4 MiB film + 200 KiB poster + 2.5 MiB offline. These ceilings are not browser transfer measurements. Report compressed transfer, raw source, archive/extracted source, emitted text, route closures, media, offline and whole-site storage independently.

### Discovery fixture and physical ownership

The future Explore entry is measured as a tiny declared fixture; it is not published as a dead “Run” control. Its literal source delta, emitted delta, metadata/closure effect, owner and legacy-cap result must appear in the proof receipt. With only 117 B current margin, a card may require a separately verified reduction or a smaller accepted entry. Do not charge legacy growth to an NF-04 allowance. If that fixture cannot fit, report the exact deficit and keep the public discovery link gated; do not hide the failure.

Every current, new, shared and retained file has an owner: the legacy teaching build/sidecar, new teaching package receipt/source offer, offline artifact, City package/source offer, or final integration manifest. The integration owner covers its root index/boot/headers and stable routing changes. The proof must list any file excluded from one counter with the counter and authoritative manifest that include it. Duplicated physical paths are never deduplicated by identical content for storage totals.

### Required package-only receipt before NF04-B

1. **Current source and complete accounting.** Bind exact commit/tree and source state; inventory all runtime/build inputs, emitted files, shared dependencies, route closures, source offer, media, offline and integrated site. Explain current-generation versus physical retained-generation totals and old/new ownership. Fail unknown imports/fetches, absent/extra paths, symlinks, traversal and capture mutation.
2. **Reproducible source offer.** Retain original source/build/fixture inputs and required tool/version metadata with an immutable digest-bound archive. Pin separately retained media by path, size and digest; absent media prevents reproduction. Extract in scratch and reproduce the declared build. Both archive and extracted caps apply. Source/commit availability is checked; an unavailable/modified development build is not a release candidate.
3. **Source→payload binding.** Compare the frozen checkout to independent expected source and emitted manifests; use the declared deterministic transform. Bind HTML, boots, shared files, fixtures, closure roles, scientific identities, offline and integration selection. Avoid self-referential digest definitions. Recomputing hashes over changed output cannot make it acceptable.
4. **Deliberate mismatch rejection.** Exercise changed payload/shared/source/commit/closure/selection, missing and extra file, changed role, resealed mutated HTML and mixed releases with current payloads and tiny fixtures. Preserve existing NF-03 rejection tests; do not claim this proves a future NF-04 verifier.
5. **Immutable publication and rollback.** Build once from frozen source; validate preview bytes/headers before reusing the exact integration artifact for authorized production. Read back stable and immutable hosts and record the measurement time and session-binding limitation above. Restore a previously verified whole integration and its pinned shared/source files, without regenerating scientific records; validate rollback selection/readback.
6. **Preservation.** Retain complete offline content and reserve, all City/current/rollback/source-offer bytes, SF HOLD and Austin pause. Keep Q1/Q8/N2 open as described in the experience specification.

No fresh package receipt or mismatch/rollback test is asserted here. The release handoff must record actual commands, failures, measured counts and final outcome. A proof failure leaves the affected release/engine gate closed; it does not justify silently weakening a counter or changing topology.

## Recommendation

Use the frozen cold/repeated contract and selected B-lite design for the authorized package-only proof. Validate and publish only the bounded packaging release once its checks pass. NF04-B remains unstarted and needs a separate implementation decision after the proof is accepted.

## Top risks + mitigations

- Correct totals with wrong causal text → separate selected/request and shared grants; require staggered, zero-cap and multiple-binding fixtures.
- Free-looking preload or fixed storage labels → common P/availability and explicit window ledgers; declare N×S versus S provisions.
- Cap bypass through packaging → unchanged legacy/offline gates plus source, emitted, closure and physical-copy accounting.
- Consistent records mistaken for real authority → distinguish simulation, consistency, authenticity, authorization and deployment permission.

## Next 3 actions

1. Complete current-source B-lite proof, exact discovery fixture accounting and deliberate rejection/rollback evidence.
2. Record final source/package counts and authorized publication readback in the release handoff, preserving unperformed checks.
3. Separately authorize the first cold/repeated vertical slice; implement and validate its independent verifier, shared-clock bench, static chapters and six-beat guide before preload UI.
