# FleetLab R1 — proposed synthetic model contract

**Date:** October 14, 2026
**Status:** OWNER APPROVED — October 14, 2026. Numerical implementation, testing, GitHub push and static-site publication explicitly authorized in chat. The owner separately requested R3/R2/R7 contracts for review before their implementation.
**Route:** `/network-flows/rebalancing/`
**Lesson:** “Where should the empty cars go?”

The owner requested this contract before implementing numerical results and then explicitly approved it. Historical proposal wording below records the reviewed decisions; approval does not make the synthetic inputs measured data. The supplied build spec governs the lesson; this document makes its missing numerical assumptions concrete for approval. None of the proposed constants, demand records or algorithms below is measured operator data, a research-paper replication or an accepted FleetLab result. No policy has been run for this contract.

## 1. Decisions already made versus proposals

**Already specified:** 24 vehicles; four zones; 120-minute observation; reactive versus forecast rebalancing on the same workload; per-interval learner moves; empty vehicle-kilometers, unserved requests, zone pickup median/p95 and end balance; six chapters; code-built counted visuals; independently checked ledger; NF05/NF06 concept loops; no R2/R3/R7.

**Owner clarification:** introduce **Ready / idle** alongside **COD** and **VOR**. The two original definitions do not cover a dispatchable vehicle that is not moving. Ready / idle is not counted as VOR or COD. Keep “off the drive network, not off the pavement” on first VOR use. These are FleetLab teaching definitions, not a claim that every AV operator uses these acronyms.

**New proposals requiring review:** all geometry, travel times, request generation, initial allocation, forecast quality, queue and expiry rules, dispatch rules, policy tie-breaks, sampling and metric denominators below. The exact draft identifier would be `r1-four-zones-v1`; it must not be labeled frozen until approved.

## 2. Question and scope

Ask: how do reactive and forecast empty-repositioning rules change coverage, waiting and empty distance when vehicles and requests are unevenly located?

Use a deterministic, discrete-event resource model. No physical road map, traffic interaction, collision model, charging, depot capacity, vehicle failure, cost model, pooling, online learning or routing optimizer. All vehicles are homogeneous. Passenger journeys change a vehicle's zone, so a decision has consequences beyond the next request.

**Learning claim is conditional.** Demand asymmetry is the intended mechanism, not a prewritten empirical verdict. The result page may state a shortfall and its coverage cost only from accepted records. It must not announce that forecast always wins, that one policy is globally optimal, or that this experiment establishes a unique binding constraint. A different demand arrangement is a separate future experiment, not an unnoticed fixture edit.

## 3. Geometry, clock and fleet

Proposed coordinates in kilometers: A=(0,0), B=(2,0), C=(0,2), D=(2,2). Distance is Manhattan distance. No intermediate zone stop or pickup occurs on an edge.

| From / to | A | B | C | D |
|---|---:|---:|---:|---:|
| A | 0 | 2 | 2 | 4 |
| B | 2 | 0 | 4 | 2 |
| C | 2 | 4 | 0 | 2 |
| D | 4 | 2 | 2 | 0 |

- Model clock: integer seconds, 0 through 7,200 inclusive. Observation covers arrivals in `[0,7200)`.
- Decisions: every 600 seconds at t=0,600,…,6600. Twelve decision intervals, each ten minutes.
- Interzone passenger and empty travel: 120 seconds per kilometer; adjacent zones take 240 seconds, diagonal zones 480 seconds.
- Local pickup: exactly 60 seconds and 200 empty meters, once a vehicle is assigned in the rider's origin zone. This small local movement is an explicit approximation, not an inferred street route.
- Passenger boarding is instantaneous at pickup; no additional service time. Passenger trip starts at pickup and follows the matrix above. No same-zone demand in the baseline.
- Distances are stored in integer meters. Display kilometers with the exact meter value available on inspection.
- Initial Ready / idle allocation: A: vehicles 01–08 (8), B: 09–16 (8), C: 17–18 (2), D: 19–24 (6). IDs use the existing `ev-001`…`ev-024` format. No initial trips or pending requests.
- VOR is supported by the vocabulary and verifier but has no scheduled occurrences in this rebalancing-only fixture. Do not add arbitrary maintenance just to make its counter nonzero.

## 4. Exact demand and forecast tape

Each table cell is the number of requests originating in that zone during the interval. Destination mappings alternate by the row's mapping letter. Every request is one passenger party requiring one vehicle; there is no pooling.

| Interval | Start minute | A | B | C | D | Destination mapping |
|---|---:|---:|---:|---:|---:|---|
| 0 | 0 | 3 | 3 | 1 | 2 | X |
| 1 | 10 | 2 | 2 | 9 | 1 | X |
| 2 | 20 | 2 | 2 | 9 | 1 | X |
| 3 | 30 | 1 | 7 | 2 | 4 | Y |
| 4 | 40 | 1 | 7 | 2 | 4 | Y |
| 5 | 50 | 6 | 2 | 2 | 4 | X |
| 6 | 60 | 6 | 2 | 2 | 4 | X |
| 7 | 70 | 2 | 1 | 3 | 8 | Y |
| 8 | 80 | 2 | 1 | 3 | 8 | Y |
| 9 | 90 | 7 | 3 | 2 | 2 | X |
| 10 | 100 | 7 | 3 | 2 | 2 | X |
| 11 | 110 | 2 | 5 | 5 | 2 | Y |

- X destinations: A→B, B→A, C→D, D→C.
- Y destinations: A→C, B→D, C→A, D→B.
- For N requests in one origin cell, j=0…N−1 arrives at `interval_start_s + 60 + floor(480*j/N)`. This places arrivals from minute 1 up to just before minute 9. Empty cells emit no records.
- Request IDs encode interval, origin and ordinal: `r-00-A-00`, etc. Sorting uses those fixed-width IDs after timestamp.
- Pickup deadline is arrival+360 seconds, inclusive. Expiry and horizon rules below apply to pending and assigned requests.
- The future implementation materializes and freezes the expanded request list; algorithms consume that list, not a runtime demand generator or random seed.

**Forecast information:** at decision i, forecast for the *next* interval is the count vector in row i+1. The final decision has no next interval and displays forecast “Not available — observation ends”; the forecast policy makes no new moves at i=11. These are perfect next-interval origin-count forecasts. They reveal neither exact future arrival times nor future destinations to either policy. This is a deliberately favorable forecast assumption, not a trained forecast or production accuracy estimate. The reactive arm receives the same recorded forecast metadata for display but its policy does not read it.

At t=0, C has 2 ready vehicles and next-interval C demand is 9, matching the illustrative shortfall in the brief. Future shortfalls must be computed, not hard-coded. “Will need 9 cars” overstates simultaneous need when vehicles can be reused; proposed UI wording: **“Next interval: 9 requests forecast in C; 2 vehicles ready now.”** The reserve policy below uses one ready vehicle per forecast request as a simple target, not a feasibility theorem.

## 5. Vehicle and request states

Vehicle activities:

| Activity | Teaching status | Position and eligibility |
|---|---|---|
| idle | Ready / idle | At a zone; eligible for local assignment or repositioning |
| pickup | COD | Reserved local movement in the request's origin; unavailable for another request |
| passenger_trip | COD | In transit from origin to destination |
| rebalancing | COD | Empty interzone travel; no rerouting or dispatch until arrival |
| unavailable | VOR | At a zone, unavailable; excluded from policy supply (not used by baseline) |

At every instant, Ready / idle + COD + VOR = 24. Each vehicle has exactly one activity. An in-transit vehicle is counted in a separate transit total and never counted as physically present in both zones. The inspector exposes activity, last zone, destination, activity start/end and associated request or move ID.

Request states: pending, assigned, picked_up, completed, expired. At horizon, also report pending-within-deadline, assigned-not-yet-picked-up and picked-up-not-completed separately. A served request means pickup occurred within the observation and deadline; completed trips are a different count. A request may be served without being completed at t=7200.

## 6. Deterministic event ordering and shared dispatch

For each timestamp, apply these phases exactly once in order:

1. Complete scheduled empty moves, pickups and passenger trips, sorted by vehicle ID. Pickup transitions a request to picked_up and starts its passenger trip. Trip/empty-move arrivals return the vehicle to Ready / idle.
2. Admit newly arriving requests, sorted by request ID.
3. Assign pending requests to Ready / idle vehicles **in the same zone only**: sort requests by arrival then ID; select the lowest vehicle ID. Assignment is allowed only if t+60≤pickup deadline and t+60≤7200. A vehicle can receive only one assignment. This shared dispatch rule is identical in both arms.
4. Expire any remaining unpicked request whose deadline equals this timestamp. Assignment in step 3 cannot rescue a request if its 60-second pickup would be late. A scheduled pickup exactly on its deadline already succeeded in step 1.
5. At decision boundaries, compute policy moves or validate the learner's complete batch against the resulting Ready / idle fleet. Dispatch has priority over empty repositioning. Accept all moves simultaneously; newly arriving vehicles from a different accepted move cannot be reused in the same batch.
6. Record a post-decision snapshot and event-state digest.

No immediate cancellation, preemption or en-route reassignment. All requests' deadline timestamps and all travel completions are scheduled explicitly. Tie-breaks do not depend on object iteration order, browser timing or policy name.

## 7. Reactive and forecast policy rules

Both are transparent heuristics, not min-cost flow solvers. Do not describe either as optimal. Both may send only Ready / idle vehicles and use the same movement selection rule.

**Reactive target:** for each zone at decision time t>0, the number of requests whose expiry timestamp e satisfies **t−600 < e ≤ t**. An expiry at the decision boundary is included: phase 4 runs before phase 5. An expiry at the previous boundary is excluded, preventing double counting. At t=0, all targets are zero. The policy has no future-demand input and makes no move until at least one request has expired. “Reactive” means this precise delayed rule; it does not stand for every reactive dispatch policy in the literature.

**Forecast target:** next-interval forecast origin-request counts. No moves at the last decision when that forecast is unavailable. Current in-flight vehicles are not credited to ready supply; this conservative simplification stays visible in the assumptions.

**Movement rule for either target vector T:**

1. Snapshot ready counts R at this decision. Receiving deficit is `max(0,T[z]−R[z])`.
2. Donor supply is `max(0,R[z]−max(1,T[z]))`, leaving at least one Ready / idle vehicle in a donating zone. A zone with zero initial ready vehicles does not magically acquire a reserve.
3. For each vehicle moved, pick the remaining receiver with the largest deficit; ties A,B,C,D. Among donors with supply, choose minimum distance to that receiver; ties A,B,C,D. Select the donor's lowest remaining vehicle ID.
4. Decrement donor supply and receiver deficit in the planning workspace. Stop when no deficit or no supply remains. Issue the whole batch simultaneously from the original snapshot. Every move fits within the following ten-minute interval because maximum travel is eight minutes.

Because targets differ, donor reserves can differ. This is part of the policy comparison and must be disclosed, not described as solely a timing switch. If a purer timing-only experiment is wanted, revise this contract before freezing it.

## 8. Learner controls and accepted results

- Separate the recorded two-policy comparison from the learner's exploratory run. Default comparison does not change when editing a move.
- Learner can select origin, destination and an integer count; add/remove moves in a pending batch; then **Apply moves & advance interval**. Existing chapter labels and route names stay as specified. Button copy is an implementation proposal, not a new lesson title.
- Only current Ready / idle supply is allocatable. Same-zone, negative, fractional, nonfinite, unknown-zone and aggregate-overallocated batches are rejected as a whole; show the error beside the batch and leave accepted state unchanged.
- Pending assignments made by the shared dispatcher are unavailable for moving. A learner may deliberately leave a zone with no ready vehicles; do not silently retain the policy's one-car reserve in manual mode. Warn with the actual resulting count and accept a valid deliberate choice.
- Canonicalize a manual batch by merging identical origin/destination pairs, discarding zero-count pairs, then sorting by origin A–D and destination A–D. Validate integer counts 0…24 and aggregate origin supply before selecting any vehicle; reject more than twelve distinct directed interzone pairs. Within that canonical order, allocate the lowest remaining Ready / idle vehicle ID at the origin. Equivalent reorderings of the same batch produce the same moves and identity; record this canonical batch, not widget insertion order.
- An empty batch advances with no moves. Reset returns to the same frozen initial state. No undo edits history; reset and replay a changed plan under a new run identity.
- The policy selector selects a checked reactive or forecast record for viewing; it does not rewrite a manual run or run an undisclosed optimization. Recorded playback and step-by-step manual simulation are explicitly labeled separately.
- Chapter navigation and vehicle selection are view-only. They cannot mutate input or accepted outputs. No numerical animation autoplays merely because a concept video does.

## 9. Metrics and horizon accounting

All results are computed from accepted event records, with **Synthetic scenario · not operational data** beside each result region.

- **Empty vehicle-kilometers:** empty meters traversed by pickup and rebalancing / 1,000. Show those components separately; exclude passenger distance. A started leg extending past the horizon contributes proportional traversed distance, with exact rational numerator/denominator stored; do not round intermediate values.
- **Unserved requests:** expired before or at t=7200 without pickup. Show pending or assigned at the horizon separately, never silently count them as served, expired or zero. Total admitted = expired + pending + assigned + picked_up + completed at horizon.
- **Pickup wait per origin zone:** pickup time minus request arrival, in seconds; population is pickups within the observation and deadline. Report sample count, median and p95. Median is middle value or mean of two middle values. p95 is nearest-rank sorted value at `ceil(.95*n)−1`. No pickups → unavailable, not 0. These exclude unserved requests; place unserved counts next to waits to prevent survivorship misreading.
- **Service rate:** pickups within observation / all admitted requests. Always expose both counts. This is an operations fraction, not jobs per second.
- **End balance:** Ready / idle, local-pickup and VOR counts by zone, plus interzone in-transit vehicles and destinations. Do not imply all 24 are parked. Sum all physical categories to 24.
- **Deadhead ratio, if displayed:** total empty meters / (empty+passenger meters), consistent distance units; denominator zero → unavailable. The glossary can describe miles, but the R1 label uses km consistently. Do not claim a ratio from empty distance alone.
- **Readiness glossary:** operable-and-ready duration / scheduled duration. Do not show a readiness score in R1 until “ready” treatment during an active passenger trip is specified; this requested glossary entry is not a new metric mandate.
- No revenue, safety, operator KPI, economic score or weighted winner. Compare each requested output on the same axis extent for both arms; zero-baseline bars; exact values remain inspectable.

**Horizon:** process events through t=7200, including arrivals of existing legs and deadlines exactly at the endpoint, but admit no requests at or after it and issue no rebalancing decision there. Preserve unfinished trips/moves and unexpired requests. No hidden drain beyond 120 minutes. Do not discard the last interval to make a policy look better.

## 10. Ledger, identity and verification

Proposed implementation layers: frozen workload → deterministic model → immutable run record → independent replay verifier → accepted presentation. The UI never repairs a failed record or computes substitute metrics. No cryptographic authenticity or deployment authority is claimed.

- Frozen input includes contract/version, all constants, coordinates, directed distance/time matrices, initial vehicle records, expanded requests and released forecast tape.
- Input SHA-256 covers canonical JSON: UTF-8, no whitespace, lexicographically sorted object keys, arrays in declared order, finite safe integer inputs only. No timestamp, machine path or runtime duration participates in numerical identity.
- Policy ID/version and manual decision list are separate from common input identity. Both recorded arms must match the **same full normalized input**, not merely separately valid checksums.
- Ordered events carry a unique increasing sequence, timestamp, kind, vehicle/request/move references and pre/post resource effects. Hash the canonical event list and recomputed metrics. Exclude only the enclosing digest field from each digest; do not omit fields ad hoc.
- Boundary ledger: the initial state at t=0 after phases 1–4 but before the first decision, followed by states at t=600,1200,…,7200 after phases 1–4 and before any new decision at that timestamp. Each of these 13 boundaries has four zone rows: **52 rows per arm**, not the capacity lesson's unrelated 36-row layout. Initial interval counters are zero for this no-arrivals-at-zero workload. Each later row's interval counters include events with **t−600 < event_time ≤ t**; events at the right boundary are counted exactly once. Post-decision snapshots at t=0…6600 are separately addressable and labeled as such; there is no decision at t=7200.
- Rows include physical zone counts by status/activity, outbound/inbound moves, realized arrivals/pickups/expiries during the preceding interval, next-interval forecast availability, cumulative distance and a hash binding the full boundary vehicle state. Global transit totals are separate from zone counts.
- Independent verifier reconstructs vehicle occupancy, request lifecycle, legal travel times/distances, admissible allocations and metrics from input/events. It does not call the model implementation to bless its own output. Reconstruct policy choice from the policy definition separately.
- Any event, metric, input, identity, sequence, row coverage or vehicle-conservation mismatch rejects the record. Suppress its outcome charts and “verdict”; show the reason. A valid digest alone does not accept a record.
- Study verification checks exactly one reactive and one forecast arm, exact common-input equality, expected policy versions, complete row coverage and deterministic ordering. Manual records are not substituted into that study.

## 11. Required verification before a recorded lesson exists

Test analytically solvable tiny fixtures separately from the proposed 24-vehicle workload: no requests/no moves; one pickup/trip; deadline equality; expiry exactly on a decision boundary (included once in the current reactive target and interval row); manual batch reordering/duplicate-pair normalization; no available vehicles; two simultaneous requests/one vehicle; simultaneous trip arrival and request; diagonal movement; multiple outbound requests exceeding supply; no completed pickups in a zone; unfinished work at horizon; zero-distance denominator; and all vehicles moved away manually.

Adversarial checks: duplicated/missing vehicle, fabricated movement, teleportation, event reordering, wrong cumulative distance, metric rounding across a threshold, substituted valid arm from a different workload with recomputed hashes, missing ledger interval/zone, stale result after pending input change, malformed/nonfinite controls and oversized requests/events.

Acceptance requires reproducibility, 24-vehicle conservation, exact request accounting, verifier acceptance of genuine records, rejection of mutations, common-input study binding, browser/worker parity, UI-ledger identity and no state mutation on playback or chapter changes. Outcome direction is **not** an acceptance assertion: a forecast arm with higher distance or worse service remains a valid trade-off if the record is valid. If the intended lesson is not supported, report it and seek a versioned fixture revision rather than tune silently.

## 12. Scaffolding and language decisions

The six supplied chapters remain: The map; The price of coverage; Reactive; Forecast; The verdict; Try it. Until this contract is accepted and checked recordings exist, the local page says **“Model contract awaiting review — no simulation has run.”** It does not use the supplied past-tense “recorded study” kicker or invented KPI values. After acceptance, the recorded comparison gets the exact kicker; manual mode says it is an interactive synthetic run.

R1 follows software delivery and links onward to the existing “Who gets the depot link first?” Delivery order lesson. No new route/title is invented. Shared logo changes are the explicit §7 exception to §9's existing-lesson freeze; existing numerical models and content otherwise remain unchanged.

The glossary first-use links include Ready / idle, COD, VOR, deadhead ratio, service rate and readiness. “One word, several ratios” distinguishes fleet/link/charger utilization, bits/s versus trips/h versus veh/h, operations fraction versus queueing jobs/time, and resource-specific capacity. In R1, “rebalancing” means empty interzone repositioning; pickup approach is separately counted empty travel.

## 13. Research anchors and media

- [Jacobsen, Kulcsár and Lindman, arXiv:2508.19933v3](https://arxiv.org/abs/2508.19933v3): preprint first submitted 2025, revised April 2026. The primary abstract reports **up to** 36% lower median wait and 27% lower rebalancing distance against its named baselines. These are the authors' external simulation results for joint dispatch/rebalancing/charging; not FleetLab results and not an expected effect size for this toy model. Primary abstract checked October 14, 2026.
- [Yang, Liu and Du, supplied Sustainability link](https://www.mdpi.com/2071-1050/18/19/9768): publisher HTML/PDF retrieval returned 429 and the DOI could not be retrieved in this session. The supplied 22,247-km claim is **not independently verified here** and will not appear as an established number in the preview. Supply the paper or a verifiable primary source before that numerical anchor ships. This is an access limitation, not a finding that the paper is false.

NF05 and NF06 each contain a 10-second 1280×720 video and an audio stream. Preserve originals; use silent, optimized H.264 derivatives and poster frames for the local preview. Each player has visible Play/Pause, inline playback, reduced-motion handling and the exact concept caption. The motion is not synchronized to simulation and does not depict 24 measured cars. NF07/NF08 are out of scope.

The selected `FleetLogo.png` was visually inspected and is text-free. Use that mark with an HTML FleetLab wordmark, responsive derivatives, favicon and touch icon. Do not substitute a new generated design.

## 14. Packaging proposal before implementation approval

Keep all existing counters and limits intact. R1 should be a hosted-only route with an explicit source owner, complete dependency closure, separately pinned media and a source-bound release sidecar. Do not import it into the legacy offline bundle, which has little remaining headroom. The new mark can reduce existing logo bytes; optimized loops must be measured, not charged at their original 11.6 MB size if those originals are not shipped.

Only 579 bytes remain under the existing 32 KiB package-metadata limit at the published baseline. The new logo-only development measurement is 32,130 bytes (638 bytes of headroom); this excludes the unapproved R1 route and is not a release-bound proof. A complete new route and media inventory may exceed it even if runtime payload fits. Before accepting R1 for publication, produce an exact manifest measurement and either fit honestly or review an explicit metadata-budget/schema amendment. No limit is raised in this review checkpoint. The separate review-only page must remain outside the production upload allowlist until source capture and ownership are implemented.

## Recommendation

Review the frozen workload, event ordering and policy definitions together. Approve or amend this contract before numerical implementation. The main judgment call is whether the transparent reserve heuristics and perfect count forecast teach the intended mechanism without implying production optimization.

## Top risks + mitigations

1. Policy results assembled from incompatible workloads: require full normalized common-input binding and independent ledger reconstruction.
2. Wait looks better because riders are lost: show unserved, pending and picked-up populations beside each wait percentile.
3. Intended conclusion is hard-coded: derive every shortfall and trade-off from accepted records; allow a neutral or worse outcome.
4. Forecast advantage is mistaken for ML capability: label perfect next-interval count information and deterministic heuristic rules.
5. Presentation preview is mistaken for a verified simulator: conspicuous pending state; no synthetic output, study digest or winner before accepted evidence exists.

## Next 3 actions

1. Owner reviews this proposed contract, especially sections 4, 6–9 and the framing changes in section 12.
2. Implement model, independent verifier and analytically checkable fixtures after acceptance; inspect results before recording any teaching verdict.
3. Build the counted visual/ledger interface, measure the complete package, then perform a separate release review. No R2/R3/R7 work in this round.

## October 14 implementation amendment — approved

Owner explicitly approved raising only `package_metadata_bytes` from 32 KiB (32,768 bytes) to 40 KiB (40,960 bytes), after the first complete route inventory measured 34,469 bytes. All other runtime, source, media and offline ceilings remain unchanged. The final source-bound measurement supersedes the preliminary byte count. Owner also authorized R3, R2 and R7 contract drafts for review; their numerical implementation is not yet approved.

## October 14 design-round-3 source amendment — approved

The owner explicitly approved an 8 KiB increase only to `raw_source_and_tools_bytes`, from 3,145,728 to 3,153,920 bytes, after reviewing the measured design-fix overage. Runtime/emitted text, offline, package metadata, source archive and route limits retain their previous values. The prior metadata-only approval above is historical; this narrowly supersedes its source-ceiling restriction. Supplied hosted concept diagrams remain outside offline teaching payloads, with an explicit three-file 512 KiB artwork inventory. No source is moved between owners to evade a counter.
