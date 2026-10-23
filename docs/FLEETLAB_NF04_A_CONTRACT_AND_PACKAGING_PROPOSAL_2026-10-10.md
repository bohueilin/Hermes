# FleetLab NF04-A: contract and packaging proposal

October 10, 2026 · Revision 3 companion · **PROPOSED; not a contract freeze or implementation approval**

The current authorized work is the NF-03 presentation fixes and this NF04-A proposal. NF-04 has no engine, verifier, accepted execution record or release. This document resolves the design alternatives into one reviewable recommendation; approval of the numerical contract and packaging change remains an explicit prerequisite to NF04-B. No code, package cap or publishing rule changes are made here.

The [next design specification](FLEETLAB_NETWORK_FLOWS_NEXT_DESIGN_SPEC_2026-10-10.md) retains the experience, analytical storyboard and curriculum. The final Revision 2 review's A1–A6 amendments are answered below. Revision 2 remains available in Git at `35845f0`; its shipped application baseline is `1141b12160018216c3baf6875278fe0890762b15`. Measurements here isolate that baseline, rather than incorporating concurrent NF-03 edits. The Revision 3 release handoff must provide its final measurements separately.

## Status and evidence

| Evidence | What was actually established |
| --- | --- |
| Source inspection | Existing packer, module graph, comment lexer, source sidecar, byte caps and integration checks inspected. |
| Frozen baseline reconstruction | Archived `playground/fleetlab` from `1141b12`; used its own packer and Node v22.22.0. Reconstructed every emitted non-sidecar file, checked all listed source fingerprints against the retained published sidecar, and reproduced offline bytes/digest. No mismatch. |
| Published identity | Retained `dist/fleetlab-guided-oct10/release-root/network-flows/capacity/release.json` matches the SHA-256 and size in `docs/releases/fleetlab-current.json` **at `35845f0`**. That is a historical receipt; the file may advance with the new NF-03 release. |
| Frozen revision-2 live readback | **Not established by this NF04-A measurement.** The historical immutable sidecar URL was inaccessible to the web reader; a direct fetch returned HTTP 403. Local reconstruction does not substitute for fresh public readback. The separate revision-3 handoff records verification of the newly published NF-03 package. |
| Model expectations | Arithmetic and discrete examples below are contract examples, not executed NF-04 acceptance tests. |
| Human/device acceptance | Open. No human comprehension study, physical-phone acceptance or screen-reader result is claimed. |

## A1 — exact capped equal-share allocator and replay state

Proposed policy ID: `nf04-capped-equal-share/1.0.0`. Apply it separately to WAN and local delivery. An allocator accepts integer bytes, never Gbit/s display values.

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

**Recommend an explicit v1 restriction instead of fractional carry.** Aggregate rates and each transfer cap are integer useful bytes/second, divisible by four. Supported quanta are exactly 1,000 ms and 250 ms. Compute `slot_bytes = bytes_per_second × quantum_ms / 1,000` exactly after validation. It must be an integer at **both** quanta, even when a run selects only one. Zero is allowed and means unavailable capacity. Resolve a missing cap to the baseline declared aggregate rate before forming paired arms; keep that resolved cap fixed when varying only aggregate capacity. A cap may exceed aggregate capacity, but the allocator cannot exceed either budget. This also permits a zero-capacity resource with positive hardware caps. UI Gbit/s text converts through exact decimal/rational parsing; silently rounded binary floating-point conversion is rejected.

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

The preloaded analytical fixture explicitly makes the object available at −96 s, records fetch service over `[−96,0)`, and commits inventory at 0 once. Main-window WAN is 0; earlier WAN is 12 GB; full-window WAN is 12 GB. No completed fetch is charged again at 0. Compare the identical exogenous request/workload/availability inputs, while labelling the preload intervention and its changed initial inventory/accounting window.

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

The fixed title is **“Why this state?”** Each accepted state supplies its own headline, quantity, cause and next prerequisite. A positive useful grant means receiving; an eligible transfer with zero grant is waiting for the named resource. Artifact-derived strings remain escaped text.

| State | Required explanation |
| --- | --- |
| Not arrived | Arrival timestamp; no current work or rate. |
| Waiting for repository/cache/WAN prerequisite | Name the missing identity or incomplete transfer, source availability time if known, and what becomes eligible next. |
| Waiting for resource | Remaining bytes, zero current grant, resource capacity and competing transfer IDs; do not claim active receipt. |
| Receiving | Local/WAN stage, bytes received and remaining, useful rate for the named next interval, then required checks/activation. |
| Checking | Full declared and quantized check duration, elapsed/remaining time; network rates 0. Future success is not revealed as current completion. |
| Activating | Check already passed; activation elapsed/remaining; modeled readiness still pending. |
| Ready | Exact ready time and raw target, on-time/late status; no claim of driving safety or software-release permission. |
| Failed | The check finished and failed at its declared boundary; activation blocked, ready time null; other requests continue. |
| Unfinished at horizon | Stage reached, remaining work, no completion time and no post-horizon rate; keep request in every required denominator. |
| Record rejected | Separate evidence-error panel; accepted playback withheld. Never show a fictitious vehicle fault or accepted success from rejected data. |

Set the finite guide endpoint to the latest terminal outcome across both arms when every request is ready or failed; use `H` if any remains unfinished. A single valid failure does not force an infinite wait for all-ready. Repeated/cold default ends 666 s; cold-only four-vehicle check-failure example has three ready 378 s, V4 failed 348 s and all-ready=null, so a cold-only guide ends 378 s. A repeated/cold failure pair ends at the later arm's actual terminal event. There is no polling for an event that cannot occur.

Acceptance is atomic for both arms and their common scenario digest. A new input revision, newer Watch, route exit or Cancel invalidates the pending job token. A late old result is rejected even if internally valid. Keep the prior immutable accepted pair and playhead labelled **Previous setup**, with all previous metrics tied to that pair; never mix a new input label with old outcomes. Manual seek/selection/pause cancels editorial narration until explicit Resume restores its complete case, arm, vehicle and boundary snapshot. No interaction runs an engine merely to change the displayed arm or time.

## Numerical and parsing bounds proposed for v1

These limits serve this four-vehicle lesson, not a fleet-sizing control. Reject over-limit input before allocating buffers. Device budgets below are limits to test, not measured performance.

| Field/resource | Proposed exact maximum or domain |
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

All integer products/sums must be checked with `Number.isSafeInteger`; reject rather than coerce non-finite/negative/unsafe values. The largest direct rate×quantum product is `10^12`; capacity over the entire 3,000 s window is ≤ `3×10^12` bytes; per-ledger delivered bytes are ≤ `4×64×10^9 = 256×10^9`. These are below `2^53−1`; computing time in integer ms avoids floating threshold drift. The serialized/event caps also apply to imported records, not just engine output. A valid run that cannot serialize within the cap yields a bounded resource error with no accepted partial record. Performance optimization may use exact run-length spans, but a changed record encoding needs its own schema and replay tests; it cannot silently omit idle cursor state.

## Analytical anchors and acceptance work remaining

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

## A6 — measured complete graph and packaging choice

### Frozen baseline inventory

Reproduction used `git archive 1141b12160018216c3baf6875278fe0890762b15 playground/fleetlab` into private scratch, then the archived `moduleGraph`, `buildSite` and `buildHtml` exports. Because an archive has no Git identity, its newly generated development sidecar would have unavailable-source fields. For the reported historical byte total, the retained published sidecar was substituted **only after** its own receipt hash and all declared source/emitted fingerprints matched the frozen archive. Thus the 38,960 B sidecar is verified retained release evidence, not a newly generated source-bound release. No package was published by this measurement.

The existing `buildSite` already unions the transitive graphs from `src/ui/app.js`, `src/runtime/worker.js` and `src/ui/capacity-app.js`, keyed by module path. Nothing is counted once per import. These numbers include data/fixture modules reachable at runtime.

| Measured set at 1141b12 | Files | Uncompressed bytes |
| --- | ---: | ---: |
| Home/app module closure | 103 | 2,261,032 |
| Worker module closure | 23 | 364,028 |
| NF-03 capacity module closure | 18 | 317,272 |
| Unique combined module closure | 112 | 2,447,087 |
| App-only modules | 72 | 1,774,434 |
| App+worker, excluding capacity | 22 | 355,381 |
| App+capacity, excluding worker | 8 | 122,570 |
| All three entry graphs | 1 | 8,647 |
| Capacity-only modules | 9 | 186,055 |
| Styles, shells, boots, headers, sidecar | 8 | 173,121 |
| **Counted hosted text/code/source** | **120** | **2,620,208** |
| Binary film+poster (separate allowlist) | 2 | 1,112,617 |
| **Hosted teaching package total** | **122** | **3,732,825** |
| Offline HTML | 1 | 2,549,829 |

Worker adds **zero unique source bytes** beyond the app closure; capacity adds 186,055 module bytes. Summing the three module closures would overcount shared source by 495,245 bytes. Splitting them into independent packages does not erase shared bytes from any route's dependency report.

Existing hosted text cap 2,621,440 B leaves 1,232 B. Offline has 71,611 B total headroom and 21,611 B discretionary headroom after the 50,000 B reserve. The offline ceiling and reserve are unchanged. The 350 KiB NF-04 route-local target is 358,400 B of proposed work, not permitted extra bytes.

The capacity sidecar is 38,960 B, SHA-256 `857e9e50e075b2349614977809fa050fe6aebccf9b6ca8d2182e5ab72204d44b`; its logical release digest is `fa14c37aac567e5bdb2358b144e4affda91bf86982bf8c96087de46bac299ef5`. Rebuilt offline SHA-256 is `507803b4332b9c369551ddd72c9962d07a0448ec72653ea36b244ba3251bac4d`. These are byte consistency anchors, not authentication.

### Two concrete options

| Option | Measured implication | Recommendation |
| --- | --- | --- |
| **A. Deduplicate/consolidate under the current 2.5 MiB hosted cap** | Simple module deduplication recovers 0: the graph is already a union. Allowing the full 350 KiB local route requires at least 357,168 B recovery before any new manifest/shared bytes. The existing lexical scanner finds 261,527 B of all nonprotected JS comments across the unique graph—an optimistic upper bound even if all could safely disappear, still 95,641 B short. This is neither a valid transform nor a measured accepted reduction. CSS/semantic consolidation or a smaller route might fit, but no such saving has been demonstrated. | Keep as a fallback if a separately reviewed source-preserving prototype actually fits. Do not remove lessons/data, reclassify text as media, hide paths from inventory or weaken source checks to hit the cap. |
| **B. Independently source-bound hosted route packages with aggregate and per-route gates** | NF-03's full runtime closure including shared styles, its shell/boot/CSS and current sidecar is 488,377 B, fitting a 512 KiB closure cap with 35,911 B headroom. Legacy union 2,620,208 + NF-04 local 358,400 + proposed additional package/integration metadata allowance 32,768 = 3,011,376 B, leaving 134,352 B under a prospective 3 MiB aggregate text cap for genuinely new shared bytes/reserve. The raw text source/tool baseline is 2,679,857 B; with the same 358,400 B route and 32,768 B allowance it reaches 3,071,025 B, leaving only 74,703 B for new shared text/tool growth under the additional raw-source gate. These last figures are budgeting arithmetic, not a built NF-04 package. | **Recommend for review**, because measured existing deduplication cannot fund the route target. Implement and validate package support before NF04-B. Approval would explicitly revise the hosted gate; this document does not grant it. |

The comment estimate is deliberately limited: it counts even inline nonprotected comments and excludes whitespace/semantic refactors. It does not prove Option A impossible, or imply the existing offline comment transform supports source ESM. A direct attempt to use that transform on raw ESM was rejected by its classic-script compiler; no source was changed. Wholesale comment stripping is not a substitute for reproducible source-to-payload binding.

### Proposed Option B caps — none are active gates yet

| Accounting gate | Prospective maximum | What is counted |
| --- | ---: | --- |
| Legacy teaching package | 2,621,440 B | All existing hosted teaching text, including NF-03 and its sidecar, as a compatibility gate; no moving existing files out to create fictional headroom. Final NF-03 fix bytes must be measured. |
| NF-03 route complete closure | 524,288 B (512 KiB) | Every needed JS/data/CSS/HTML/boot plus route manifest, including full shared dependencies even when stored elsewhere. Existing baseline 488,377 B includes the current broad sidecar. |
| NF-04 route-local target | 358,400 B (350 KiB) | New route-owned engine/verifier/projection/UI, fixtures, local CSS/HTML/boot; count all of these regardless of extension. A target within the next hard closure cap, not an additive allowance. |
| NF-04 route complete closure | 524,288 B (512 KiB) | Route-local assets + complete shared dependencies + route metadata. Plan shared closure ≤ 128 KiB (existing reuse plus new dependencies) and metadata ≤ 32 KiB, leaving 2 KiB if local target is fully spent; the tighter aggregate raw-source headroom also limits genuinely new shared/tool bytes; measure actual values before accepting. Do not import the full legacy stylesheet/labels by default. |
| Aggregate hosted teaching text | 3,145,728 B (3 MiB) | Union of all physically emitted teaching runtime, route entry and metadata text. A shared physical file counts once in aggregate, and fully in every dependent route closure. Identical bytes copied to two paths count twice. Both unique original text-source/tool totals and emitted text totals are separately reported and each bounded by 3 MiB; minification cannot hide source growth. |
| Retained teaching source offer | 4,194,304 B (4 MiB), both archive bytes and extracted bytes | A separately listed immutable archive of original text source/build-tool/fixture inputs needed to rebuild the teaching release, with pinned separately retained binary media; runtime-original source also appears in source-equivalent totals. This is an explicit additional preservation budget, never a way to exclude runtime dependencies. |
| Combined teaching text + source offer | 7,340,032 B (7 MiB) | Actual teaching text + source-offer storage, including duplicated source copies; excludes only the separately counted binary film/poster and offline HTML. Report source offer separately even if obtained from an immutable archive rather than loaded by the browser. |
| Media | Existing 4 MiB film and 200 KiB poster limits | Unchanged allowlist and format checks. No new NF-04 media in the first slice. Report actual bytes separately; never classify JS/JSON/text as binary media. |
| Offline artifact | 2,621,440 B, with 50,000 B reserve | Existing complete artifact and all existing lessons. NF-04 remains hosted-only. |
| Complete current teaching generation | 14,360,576 B | Upper-bound sum of text (3 MiB), source offer (4 MiB), film (4 MiB), poster (200 KiB) and offline download (2.5 MiB). Include all physical copies. Retained previous generations and separately held City are additional and must appear in the whole-site inventory, never disappear from reported totals. |

The prospective text + source-offer ceiling is 7,340,032 B; adding both binary-media ceilings gives 11,739,136 B before the offline download. These are declared ceilings, not measured future package sizes.

The source offer cap is a proposed archival budget, **not measured as an existing deployed FleetLab source archive**. Raw listed source inputs/build tools are measured below; packaging that source offer and its exact reproducible tooling remains part of Option B's prerequisite. The source archive contains original text source/build inputs and manifests; its manifest pins the separately retained binary film/poster by immutable path, size and digest. Those binaries remain available under the media inventory and are counted there; an absent binary prevents a reproducible release even if the source archive passes its size gate. Current City/source offers, City current/rollback identities and their separately reported aggregate bytes are preserved unchanged. The existing integrated site receipt reports 1,619,534,486 B; that is not teaching-route weight. Every future integration must still inventory the entire site, including source offers and City, rather than present the 3 MiB teaching figure as the whole deployment.

### Source and release binding required before changing packaging

1. **Closed dependency inventory.** Resolve every static import/re-export, worker entry, stylesheet, script, runtime fixture/data fetch and asset URL from the approved entries. Unknown dynamic imports/fetches, remote code, absent files, cycles, symlinks, traversal, extra emitted files and files changed during capture fail the build. Framework/build dependencies, tool versions, source transform and any lockfile join the source manifest even if not runtime code. Keep full UTF-8 byte sizes and SHA-256 per path; the appendix inventories today's complete 112-module graph.
2. **Immutable identity and availability.** Emit routes under immutable release-digest paths, with a small stable route pointer bound by the integration manifest. Each route pins shared files by digest and path; never import a mutable `/shared/latest` or mutable root file. Retain the exact source/build inputs and original raw source in an immutable source offer available for inspection/rebuild, alongside commit/tree and source-state declarations. If the source offer is absent or source-commit availability cannot be checked, fail a release candidate; development may show explicit unavailable/modified-source status but is not releasable. Immutable path names alone do not authenticate a producer.
3. **Source→emitted binding.** Record canonical source/input/tool manifests and emitted-file manifests separately. A deterministic, versioned transform must reproduce shells and any transformed module bytes from the bound original source. Bind every generated boot, route manifest, scientific/input/record identity and shared-closure digest. Final builds require listed bound files to match the explicitly requested source commit; a resealed mutated payload or mismatched source/commit must fail. Keep canonical digest rules non-self-referential. The current integration-owned root index/boot/headers remain outside the teaching sidecar only because the integration manifest covers their final exact bytes; every excluded byte must have a named authoritative owner.
4. **Mutation tests.** Independently reject changed shared JS, transitive data fixture, HTML, CSS, worker, source offer, source fingerprint, closure inventory and route pointer; missing/extra file; same bytes with changed declared role; correct payload with wrong source commit; recomputed sidecar after mutated HTML; mixed route/shared releases; stale job digest. Resealing a manifest is not sufficient acceptance. Existing source-bound NF-03 rejection tests remain required.
5. **Preview/readback and rollback.** Build once from frozen approved source; retain that package, route/source manifests and prior compatible package. Run source and artifact validation, all existing offline/City gates and changed-route tests; verify every served path's bytes, content type and security headers on preview before reusing the same package for any authorized publication. The integration manifest binds route pointers, offline download, current City and rollback/source offers. Read back immutable routes and the stable pointer, reject mixed-release bytes, and report actual compressed transfer size separately from uncompressed limits. Rollback restores the previously verified pointer/integration package with its pinned shared/source files, then repeats complete readback; never regenerate prior scientific records. Package support does not authorize publication in this task.

A package-only proof must exercise these rules using the existing NF-03/legacy payload and tiny declared test fixtures before engine work. It must keep current production bytes and source sidecars readable, show exact aggregate/per-route counts under the **approved** gates, and prove deliberate mismatch rejection plus offline preservation. A route split that merely bypasses the old check fails NF04-A.

## Open decisions and exits

| Decision | Recommended concrete choice | Still required |
| --- | --- | --- |
| Allocator/cursor | A1 above; immutable universe and residual-only advancement | Review exact examples and approve policy/schema ID before coding. |
| Rate fractions | Multiple-of-four B/s restriction at both quanta; no carry | Approve restriction and its unsupported-input error text. |
| Boundary/projection | A3/A4 closure and next-interval rate semantics | Approve record schema fields and fixtures; neither engine nor UI may redefine them. |
| Resource limits | Four requests, one object, bounds above | Confirm cold-device feasibility when implemented; lower bounded limits or record encoding require review if needed. |
| Packaging | Option B, prospective cap table | Explicit approval of hosted aggregate/per-route/source-offer budgets, followed by package-only measured validation; no automatic cap increase. |
| Physical/human acceptance | Preserve open statuses | Execute changed-route phone/desktop/keyboard/preferences tests; independently perform review's H1–H3 tasks before claiming comprehension. |

**Recommendation:** review and approve or amend this NF04-A proposal; keep NF04-B blocked until the numerical contract and measured packaging prerequisite are accepted. Ship the separately authorized NF-03 presentation fixes under their existing gates. No NF-04 implementation, budget change, operator-infrastructure claim, driving-safety conclusion or release/deployment permission follows from this document.

**Top risks + mitigations:** ambiguous replay→exact grants/cursors and independently implemented checks; hidden earlier work→separate inventory/WAN/local/window ledgers; cap bypass→complete source and emitted closures plus aggregate/per-route gates; stale or attractive playback concealing errors→atomic accepted projection, explicit failed/unfinished/rejected states; device or comprehension overclaim→report only performed evidence.

**Next 3 actions:** (1) review the exact A1–A5 decisions and discriminating fixtures; (2) approve Option A or Option B with its actual byte gates, then validate the package-only proof and final NF-03 baseline; (3) only after those exits, authorize NF04-B engine/verifier work with the analytical and negative acceptance matrix.

## Appendix — complete frozen source/runtime inventory

The following table is generated from the existing packer's full transitive module graph at 1141b12. `A` =app, `W` =worker, `C` =capacity. A repeated role means shared use, not additional aggregate bytes. Exact hashes are retained in the bound published sidecar identified above; every one matched the archived source during this measurement.

| Module path | Bytes | Entry closures |
| --- | ---: | --- |
| `src/core/canon.js` | 2,334 | A, W |
| `src/core/keyed.js` | 2,430 | A, W |
| `src/core/sha256.js` | 8,647 | A, W, C |
| `src/core/stats.js` | 3,303 | A, W |
| `src/core/tables.js` | 10,510 | A, W |
| `src/data/bay-area-map.js` | 176,375 | A |
| `src/data/depot-capacity-study.js` | 83,594 | C |
| `src/data/sf-streets.js` | 328,545 | A |
| `src/instrument/bootstrap.js` | 2,484 | A, W |
| `src/instrument/guardrails.js` | 1,852 | A, W |
| `src/instrument/outcome.js` | 1,336 | A, W |
| `src/instrument/paired.js` | 5,526 | A, W |
| `src/instrument/recommendation.js` | 1,253 | A, W |
| `src/instrument/summary.js` | 9,698 | A |
| `src/model/airport-demand.js` | 4,177 | A |
| `src/model/bay-area.js` | 4,835 | A |
| `src/model/bay-experiment-contract.js` | 14,220 | A |
| `src/model/bay-operations.js` | 35,359 | A |
| `src/model/bay-systems.js` | 8,597 | A |
| `src/model/charging-allocation.js` | 3,249 | A |
| `src/model/depot-capacity-contract.js` | 8,808 | C |
| `src/model/depot-capacity-verify.js` | 12,818 | C |
| `src/model/depot-capacity.js` | 7,364 | C |
| `src/model/depot-cohort-contract.js` | 4,397 | A, C |
| `src/model/depot-cohort-verify.js` | 8,299 | A |
| `src/model/depot-cohort.js` | 6,113 | A |
| `src/model/depot-flow-contract.js` | 3,047 | A, C |
| `src/model/depot-flow-verify.js` | 7,036 | A |
| `src/model/depot-flow.js` | 5,695 | A |
| `src/model/depot-readiness.js` | 13,692 | A |
| `src/model/engine.js` | 40,956 | A, W |
| `src/model/experiment.js` | 31,167 | A, W |
| `src/model/invariants.js` | 34,082 | A, W |
| `src/model/launch-contract.js` | 14,850 | A |
| `src/model/launch-rehearsal.js` | 13,723 | A |
| `src/model/metrics.js` | 26,028 | A, W |
| `src/model/operations.js` | 21,194 | A |
| `src/model/ops-cases.js` | 71,982 | A, W |
| `src/model/policies.js` | 6,439 | A, W |
| `src/model/presets.js` | 15,682 | A, W |
| `src/model/reference-panels.js` | 4,088 | A, W |
| `src/model/region-package.js` | 4,899 | A |
| `src/model/regional-power.js` | 2,120 | A |
| `src/model/resource-observations.js` | 6,993 | A |
| `src/model/routes.js` | 8,468 | A, W |
| `src/model/scale-contract.js` | 5,228 | A |
| `src/model/scale-density.js` | 19,796 | A |
| `src/model/scale-intake.js` | 22,282 | A |
| `src/model/scale-response.js` | 24,612 | A |
| `src/model/schema.js` | 53,728 | A, W |
| `src/model/site-power.js` | 2,240 | A |
| `src/model/street-network.js` | 5,879 | A |
| `src/model/street-queue.js` | 4,561 | A |
| `src/model/street-simulation.js` | 13,920 | A |
| `src/model/vehicle-profiles.js` | 1,750 | A |
| `src/model/world.js` | 15,176 | A, W |
| `src/runtime/host.js` | 909 | A |
| `src/runtime/protocol.js` | 15,483 | A, W |
| `src/runtime/worker.js` | 1,074 | A, W |
| `src/ui/a11y.js` | 8,005 | A, C |
| `src/ui/advanced-operations-view.js` | 12,375 | A |
| `src/ui/analytics.js` | 8,545 | A |
| `src/ui/app.js` | 52,294 | A |
| `src/ui/capacity-app.js` | 826 | C |
| `src/ui/car-glyph.js` | 1,311 | A |
| `src/ui/charts.js` | 103,446 | A |
| `src/ui/controls.js` | 24,384 | A |
| `src/ui/depot-capacity-bench.js` | 10,645 | C |
| `src/ui/depot-capacity-guided.js` | 6,584 | C |
| `src/ui/depot-capacity-page.js` | 40,241 | C |
| `src/ui/depot-capacity-view.js` | 15,175 | C |
| `src/ui/depot-flow-lab.js` | 24,454 | A |
| `src/ui/depot-flow-player.js` | 5,512 | A, C |
| `src/ui/depot-flow-reading.js` | 13,525 | A |
| `src/ui/depot-flow-view.js` | 23,035 | A |
| `src/ui/depot-scene.js` | 7,561 | A |
| `src/ui/display-text.js` | 1,345 | A, C |
| `src/ui/dom.js` | 3,853 | A, C |
| `src/ui/experiment.js` | 82,758 | A |
| `src/ui/format.js` | 9,496 | A |
| `src/ui/hero-film.js` | 9,750 | A |
| `src/ui/hero-media.js` | 189 | A |
| `src/ui/inspector.js` | 15,208 | A |
| `src/ui/iso.js` | 70,601 | A |
| `src/ui/labels.js` | 95,887 | A, C |
| `src/ui/launch-view.js` | 15,990 | A |
| `src/ui/learn.js` | 11,014 | A |
| `src/ui/map.js` | 91,336 | A |
| `src/ui/model-identity.js` | 524 | A, C |
| `src/ui/operations-3d.js` | 14,495 | A |
| `src/ui/operations-lab.js` | 51,736 | A |
| `src/ui/operations-map.js` | 6,821 | A |
| `src/ui/playback.js` | 20,933 | A |
| `src/ui/present.js` | 60,356 | A |
| `src/ui/readiness-view.js` | 6,883 | A |
| `src/ui/regional-power-view.js` | 21,780 | A |
| `src/ui/regional-setup.js` | 4,396 | A |
| `src/ui/routes.js` | 2,508 | A |
| `src/ui/scale-lab.js` | 14,564 | A |
| `src/ui/scale-labs.js` | 476 | A |
| `src/ui/scenario-learning.js` | 532 | A |
| `src/ui/scene-3d.js` | 7,536 | A |
| `src/ui/setup-codec.js` | 17,507 | A |
| `src/ui/setup-sharing.js` | 4,315 | A |
| `src/ui/simulation-catalog.js` | 12,214 | A |
| `src/ui/store.js` | 31,111 | A |
| `src/ui/street-lab.js` | 26,287 | A |
| `src/ui/street-scene.js` | 11,820 | A |
| `src/ui/studio.js` | 28,515 | A |
| `src/ui/teaching-frames.js` | 59,259 | A |
| `src/ui/teaching-projection.js` | 1,104 | A |
| `src/ui/vehicle-portrait.js` | 1,168 | A |

Non-module emitted files (all eight text files are inside the current hosted cap):

| Path | Bytes | Classification |
| --- | ---: | --- |
| `styles.css` | 117,200 | text |
| `index.html` | 1,435 | text |
| `boot.js` | 171 | text |
| `network-flows/capacity/index.html` | 932 | text |
| `network-flows/capacity/boot.js` | 79 | text |
| `network-flows/capacity/visual.css` | 13,934 | text |
| `_headers` | 410 | text |
| `media/fleet-film-poster.webp` | 32,678 | media |
| `media/fleet-film.mp4` | 1,079,939 | media |
| `network-flows/capacity/release.json` | 38,960 | text |

Additional bound build-tool sources, retained in the source manifest rather than runtime imports:

| Path | Raw source bytes |
| --- | ---: |
| `tools/check-dist.mjs` | 32,552 |
| `tools/comment-strip.mjs` | 9,505 |
| `tools/media.mjs` | 2,114 |
| `tools/pack.mjs` | 41,253 |
| `tools/release-sidecar.mjs` | 12,944 |
| `tools/site-shell.mjs` | 1,169 |

The sidecar lists **124 bound source files / 3,792,474 raw bytes**, including binary media and build tools. Excluding its two binary media files gives **2,679,857 raw text source bytes**. That source-manifest total is distinct from the current hosted cap's emitted-text measure; it is not additional browser transfer weight. A new source offer must preserve these exact inputs and any new route/tool inputs within its proposed separate archival gate.
