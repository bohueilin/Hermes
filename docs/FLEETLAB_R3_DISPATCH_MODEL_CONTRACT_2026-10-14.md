# R3 dispatch matching — proposed model contract

Date: October 14, 2026. Status: DRAFT FOR OWNER REVIEW; no numerical implementation or publication authorized by this document. Build after R1, before R2 and R7. This resolves missing inputs in build-spec §4; every number below is a proposed synthetic assumption, not operator data. Approval applies to the whole versioned contract, not a promised result.

## Question, scope and learning goal

Route `/network-flows/dispatch/`. Title: **Which car takes the next request?** Learn why choosing the closest vehicle separately for each rider can leave another rider without a feasible pickup. Compare greedy assignment with joint matching of currently pending requests. Here “lookahead” means examining alternative assignments in the current batch, not access to future requests. Label the policy **Lookahead across this batch**. No pooling, walking, traffic, charging, future-demand oracle or learned policy.

A four-vehicle grid is sufficient to expose opportunity cost. It is an assignment teaching model, not a replica of an AV dispatch system. Ready / idle is dispatchable; COD covers approach, pickup service and passenger travel. VOR has zero occurrences in this fixture.

## Frozen input v1

Coordinates are integer kilometers on a 0–4 square; distance is Manhattan. Travel takes 60 seconds per kilometer. Pickup service takes 30 seconds at the origin and has zero modeled distance. Pickup is counted when that service completes. Observation ends at 1,200 seconds, with no hidden drain.

| Vehicle | Initial coordinate |
|---|---|
| ev-001 | (0,0) |
| ev-002 | (2,0) |
| ev-003 | (0,4) |
| ev-004 | (4,4) |

All requests are single riders. Deadline is an absolute latest pickup-completion time, inclusive.

| Request | Arrival (s) | Origin | Destination | Deadline (s) |
|---|---:|---|---|---:|
| r-001 | 0 | (1,0) | (1,2) | 150 |
| r-002 | 0 | (0,0) | (0,2) | 60 |
| r-003 | 0 | (1,4) | (2,4) | 150 |
| r-004 | 0 | (4,3) | (4,1) | 150 |
| r-005 | 600 | (0,2) | (0,0) | 720 |
| r-006 | 600 | (1,2) | (3,2) | 780 |
| r-007 | 600 | (2,4) | (2,2) | 720 |
| r-008 | 600 | (4,1) | (4,4) | 780 |

All comparisons bind exactly this input, geometry, versions and horizon. Requests arrive only at 0 and 600. Dispatch runs at every 30-second boundary, including 0; current pending requests stay eligible until deadline expiry. Neither policy sees the second wave before t=600. Same-place approach has zero travel; zero-length passenger trips are excluded from the default but supported in analytical tests.

## Feasible actions and policies

A legal edge joins one Ready / idle car to one unassigned pending request if current time + approach travel + 30-second pickup service ≤ deadline and ≤ horizon. A car and request appear at most once per batch. Passenger completion need not fit the horizon; unfinished trips remain visible. No reassignment or interruption once accepted. No empty repositioning except approach to an accepted pickup.

**Greedy:** pending requests sorted arrival, then ID. For each request, choose the feasible remaining car with shortest approach distance, tie by vehicle ID. Skip a request with no feasible edge, and continue. Repeat at subsequent dispatch boundaries.

**Lookahead across this batch:** enumerate every feasible partial injective assignment of at most four cars to current pending requests (bounded to the eight-request contract). Choose lexicographically: (1) most requests assigned now, (2) least total approach meters, (3) least sum of absolute pickup-completion seconds, (4) smallest sorted `(request_id,vehicle_id)` list. Empty matching is legal. This is an exact optimum only for that declared instantaneous matching objective. It is not a full-horizon optimum and offers no general fleet-performance guarantee. Independent verification enumerates legal edges and completeness separately.

**Manual:** select request-car pairs and accept a batch at a dispatch boundary. Validate all pairs together; reject duplicate cars, duplicate riders, infeasible pickups or non-ready vehicles without changing accepted results. An empty batch waits 30 seconds. Apply and advance processes the accepted batch plus events through the next boundary, stopping before its dispatch. Automatic dispatch stays off in manual mode. Policy comparisons remain immutable and separate.

## Event ordering and accounting

At time t: complete approach/service/trips; admit requests; if a dispatch boundary, choose and apply the batch; expire still-unassigned requests whose deadline is t; snapshot. Zero-time approach advances to pickup service at the same timestamp, with explicit sequence numbers. Pickup exactly at deadline succeeds. Departures and arrivals retain a single car identity; no count exists simultaneously at both endpoints. Events at t=1,200 complete and expire but no new dispatch starts.

Request partition: pending + assigned-before-pickup + picked-up-unfinished + completed + expired = admitted. Served = picked-up-unfinished + completed. Empty meters include only approach actually traversed. Passenger meters are separate. Clip unfinished travel proportionally, using exact rational arithmetic. Pickup wait = pickup completion minus request arrival; median is arithmetic middle for even populations, p95 is nearest rank; zero pickups means unavailable. Service rate = served/admitted, unavailable when admitted is zero. Also report total completed trips, unserved, unfinished, per-rider waits and whole-fleet end balance. Never substitute completion for pickup.

## Visitor experience and evidence

Six short steps: question → feasible edges → greedy choice → batch lookahead → mixed result → try it. A code-built 4-car grid, request deadline cards, counted matching edges and paired wait/distance bars use accepted records only. Show the earliest missed deadline and the competing alternative. Do not title the verdict until computation and independent verification establish it. Include a neutral fixture in a disclosure: four co-located cars, four co-located requests, all deadlines 300, destinations (1,0), arrival zero; policies may tie.

Recorded playback is view-only; manual edits are pending until accepted. Identity includes normalized full input, policy/version, accepted actions, event order, stop time, ledger coverage and SHA-256. Full 41-boundary ledger (0..1,200 by 30s); selected-vehicle trace includes all events. Independent verifier reconstructs mandatory events and matching choices without calling the producer. A rehashed foreign-workload record, omitted event, invented optimum or stale worker reply must fail closed.

Tests: analytical two-car trap, exact deadline equality, simultaneous return/admission, equal-distance tie, no feasible car, empty batch, duplicate assignments, zero pickups, horizon clipping, reordered events, foreign input, complete candidate enumeration and stale UI result. The two-car trap is ev-001 (0,0), ev-002 (2,0), r-001 (1,0) deadline150 and r-002 (0,0) deadline60: inspect why a greedy tie can consume the only car able to meet the second deadline. Do not assume the full eight-request result from that example.

## Research and limits

[Jiang, Xu and Varakantham, arXiv:2503.08472v1](https://arxiv.org/abs/2503.08472v1), primary abstract checked October 14, describes ride-pooling with flexible pickup/drop-off locations and dynamic assignment. Its reported improvements concern a different model and datasets. R3 excludes those mechanisms and will not reuse the paper's percentages as expected outcomes. The patent framing from the background brief is context, not a numerical specification or proof of operator implementation.

Fences: `Synthetic scenario · not operational data`; any future concept image: `Concept illustration · not simulation output`. No generated imagery encodes counts. No physical deployment authority, safety claim or affiliation. Source/route ownership precedes payload; measure existing caps before proposing changes. Do not modify R1's model to reuse R3's different pickup assumptions.

## Recommendation

Approve the explicit current-batch meaning of lookahead and its lexicographic objective, or request a separate future-information study. Keep the first release bounded to this contract.

## Top risks + mitigations

- Local matching optimum mistaken for best fleet policy: disclose the time scope and show all outcomes.
- Riders vanish from wait statistics: preserve all five request populations beside waits.
- Cross-lesson assumptions silently merge: version each model independently; no shared mutable defaults.

## Next 3 actions

1. Owner reviews workload, objective and manual stepping.
2. Build model and independent enumerating verifier, then record actual results.
3. Build counted UI, run release gates and publish only after the contract is approved.
