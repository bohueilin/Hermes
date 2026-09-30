# SF stop-continuity routing contract — design v1

29 September 2026. Approved next-phase workstream M1: design and static inspection. This document does not unlock the candidate runner, change the frozen maps, or declare current road legality. Runtime implementation belongs to a separately versioned model/verifier contract.

## Decision

A pickup, drop-off, queue or service stop does not erase the incoming road or an active restriction prefix. The next leg must continue from the recorded arrival state. An unavailable continuation is represented as unavailable; it is not permission to reverse or teleport.

The current v1 engine calls `Graph.route(start, end)` afresh for each leg. The candidate v2 router supports sequence history within a leg, while its fleet execution guard correctly rejects execution without an across-leg contract. That guard remains intact.

## Proposed state and interface

Each vehicle starts with `incoming_edge: null`, `restriction_prefix: []`, and a declared initial-node placement assumption. On arrival at an edge end, record the incoming edge and the minimal sufficient prefix of traversed edges needed by the frozen map's restriction profile. The prefix may never exceed that profile's validated bound; it is not an unlimited full path in the router cache.

Conceptual interface, for future implementation:

```text
route(start_node, destination_node, arrival_state, routing_context)
  → ROUTE(edges, cost, resulting_state)
  | NO_MODELED_CONTINUATION(reason, rejected_choices)
  | UNSUPPORTED_CONTEXT(reason)
```

`arrival_state` contains incoming edge, active prefix and any explicitly reviewed connector transition. `routing_context` names pack/profile, modeled vehicle access class and supported temporal context. `NO_MODELED_CONTINUATION` describes the declared graph/profile under that arrival context, not a legal conclusion about the physical street. A clock is not sufficient to evaluate arbitrary conditional OSM syntax: unsupported conditional semantics remain `UNSUPPORTED_CONTEXT` until the parser and date/time model are qualified.

All route selection, depot reachability and dispatch feasibility must use the same context. A context-free depot cache cannot be reused for two vehicles arriving from different edges. Cache identity includes map/profile digest, start/destination, relevant arrival state and temporal/access context. Prepared routing tables remain bounded: estimate at most 2 GB and measure process peak at most 4 GB; stop rather than discard history to fit memory.

## State transitions

| Boundary | Required behavior |
|---|---|
| Initial placement | Null incoming state permitted once, with explicit initialization assumption |
| Pickup / boarding / drop-off | Retain incoming edge and prefix across dwell |
| Idle or queue interval | Retain history; time alone is not a reset |
| Turnaround / charging | Retain history unless an explicit reviewed depot connector models a transition |
| Zero-length leg | Preserve state exactly; it must not erase an obligation |
| Partial leg at horizon | Store actual traversed prefix separately from the unexecuted planned suffix |
| Depot connector | Only a versioned connector present in the scenario may transition state; log connector identity, before/after state, provenance and declared model cost |
| No continuation | Record no-route/stranded diagnostic; do not fabricate an emergency maneuver |
| Changed source/profile | Reject cached state and incompatible comparison; do not relabel old traces |

No connector or reversal permission is inferred merely because the graph has one neighbor. A graph model can declare an abstract connector, but that declaration is a scenario assumption requiring review; it cannot claim physical maneuver feasibility or real-world legality. The first strict contract has no implicit resets and no invented maneuver-time value.

## Verification

The future verifier reconstructs actual per-vehicle edge traversal and boundary events independently of the router's prefix-state implementation. It checks adjacency, incoming state, applicable no/only restrictions, state retention, connector references and horizon truncation. It does not accept a producer's `legal: true` field as proof.

Required hand-checkable fixtures:

1. A prohibited three-edge sequence whose middle edge ends at a pickup stop: split and unsplit representations both fail.
2. An only-turn prefix that spans a zero-length leg and boarding interval: state survives and the wrong continuation fails.
3. A valid continuation across drop-off: same edge sequence/cost as the corresponding uninterrupted graph path, apart from declared dwell.
4. Two vehicles at one node with different incoming edges: route/cache results may differ and cannot cross-contaminate.
5. A dead end with no continuation permitted by the modeled graph/profile: explicit no-route, no automatic reversal.
6. An explicit reviewed depot connector: accepted only with matching pack/scenario identity; stale/missing connector rejected.
7. An unfinished leg: verifier inspects executed prefix only and never counts its planned suffix as driven.
8. A history/profile mismatch or resource overflow: reject execution with a diagnostic.

Old v1 bundles keep their historical verifier result. A compatibility report may show what information or paths conflict with the new contract; it cannot rewrite old evidence as if the state had been recorded under the new model.

## Static inspection evidence and limits

The existing read-only reconstruction found 12,724 departures toward the preceding node among 30,818 comparable nonempty leg boundaries in 24 main runs. That is a directional pattern, not a count of proven illegal maneuvers. Two frozen pool nodes lack a route to either depot under the current v1 router; the exact broader “four traps” allegation still needs its definition.

Reports: `build/fleetlab-city/validation/proposal-review-20260929/recorded-evidence.json` and `pool-routes.json`. A future static rerouting report must distinguish:

- an original path rejected under the declared new rule;
- an available alternative and its graph distance/time;
- no continuation under the declared modeled graph/profile and arrival context;
- missing source semantics or arrival state;
- zero-length and unfinished boundaries excluded from a stated denominator.

Holding dispatch fixed while rerouting does not estimate the resulting fleet outcome. Changed arrival times would affect subsequent assignments and queues, so a new fleet run under a new model is required for those conclusions. Aggregate time materiality cannot waive routing correctness.

## District and scenario scope

Retain the full captured source inventory, the candidate's 108 exact district gaps and UNASSIGNED reporting. The original scenario excludes cross-Bay/SFO service. Official city jurisdiction, district polygons, captured context roads and scenario service area are distinct layers. A boundary/pool change must state its rule before outcome inspection, keep the old denominator/report visible, quantify affected roads and requests, and produce new pack/scenario identities. Nearest-district distance is not an assignment rule.

## Exit to implementation

Proceed with a future continuity implementation only with the named model/profile/verifier versions, explicit connector policy, hand-checkable fixtures and memory plan written together. Candidate fleet execution remains blocked until that implementation and the separate source/class/district/human gates pass. Small operational effect, attractive rendering or a successful OD sample does not close these gates.
