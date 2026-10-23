# Standalone continuity and conditional predicates — implementation v1

29 September 2026 Pacific. This implements separately testable modules from the approved SF continuity design. It does not migrate the fleet engine, reimport SF, alter sf-v1/sf-v2, satisfy independent human map review, or unlock the candidate runner. Scope remains simulation only; authenticity is NOT_AUTHENTICATED and operational/deployment authority is NONE.

## Installed interfaces

`citylib.continuity_v1.ContinuityRouter(pack, scenario_digest=...)` captures the supported fields of an already compiled static `node-via/1.0.0` or `edge-sequence/2.0.0` graph into immutable mappings/tuples. Its `pack_digest` is the canonical digest of the complete supplied pack, not the older nodes/edges/turns-only graph digest. Its own profile is `fleetlab.stop-continuity/1.0.0`. Existing profile definitions and guards are unchanged.

```python
router = ContinuityRouter(pack, scenario_digest=frozen_scenario_digest)
context = router.context(aware_departure_datetime)
initial = router.initial(start_node)
first = router.route(start_node, pickup_node, initial, context, algorithm="astar")
# Only consume .arrival after first.status == "ROUTE".
second = router.route(pickup_node, dropoff_node, first.arrival, context)
```

`route(start, destination, arrival, context)` returns an immutable `RouteResult`:

- `ROUTE`: exact directed edge tuple, summed static seconds and resulting `ArrivalState`.
- `NO_MODELED_CONTINUATION`: no path in the declared graph under retained history, with up to 100 rejected edge/reason pairs.
- `UNSUPPORTED_CONTEXT`: identity/history/context mismatch, unknown node/algorithm, connector request, or exhausted search/work budget. Cost is unavailable, never zero success.

Arrival state records its node, full pack digest, continuity profile, incoming edge and longest sufficient restriction-prefix suffix. The suffix retains shorter overlapping prefixes and is bounded by the installed compiled profile, at most 257 edges. Zero-length routes preserve the exact state. An incoming edge cannot immediately reverse. A known restriction-start edge cannot carry an empty prefix. Pickup, boarding, drop-off, queueing and charging have no state-reset API.

An initial state explicitly declares `DECLARED_INITIAL_NODE_PLACEMENT`. The route interface does not know vehicle identity and cannot authenticate a caller's claimed prior history. The trace verifier enforces exactly one initialization per vehicle and detects subsequent history erasure. A forged arrival state is not proof that the vehicle actually arrived that way.

Both A* and Dijkstra operate on incoming-edge/prefix states. A* derives its optimistic maximum speed from each directed edge's geometric displacement divided by its stored cost, avoiding an assumption that `speed_mps` agrees with the cost. Cache identity includes full pack digest, source-bound arrival, complete scenario/time/vehicle context, source/destination and algorithm. The supported vehicle context is explicitly `passenger_car` with `America/Los_Angeles`; it does not grant PSV access. Only compiled static restrictions are consumed. Uncompiled conditional rules are refused.

## Independent executed-prefix verification

`verify_executed_prefix(pack, context, events)` returns an immutable `VerificationResult`: `INTERNALLY_CONSISTENT` or `INVALID_EVIDENCE`, issue strings and actual executed-edge count. It reconstructs separate full histories for interleaved vehicles and directly compares concatenated traversals with the compiled no/only sequences. It does not call the router transition function, the existing `SequenceMachine`, or accept a producer's `legal` field.

The verifier shares structural graph/profile validation and the compiled source graph with the router. This establishes independence from routing search/transition implementation, not independent source truth or authenticity.

Event records are:

- `initial`: `vehicle`, `node`, and the exact initial-placement assumption.
- `leg`: `vehicle`, `start`, actual `end`, `executed_edges`, `planned_edges`, Boolean `completed`, `incoming_before/after`, and `prefix_before/after` lists.
- `stop`: `vehicle`, unchanged `node`, and the same before/after incoming/prefix fields. A descriptive `reason` can name pickup, boarding, queueing or another dwell.

A leg's executed edges must be a prefix of its plan. A completed leg must execute the whole plan. An incomplete leg is terminal for that vehicle in this trace; the verifier checks its executed prefix and never treats the unexecuted suffix as driven. Unknown/disconnected executed edges, a moved stop, duplicate initialization, missing state fields, reset state and unsupported events fail validation. Empty traces are not accepted as evidence.

This contract represents completed edge traversals. It does not model fractional position within a partially executed final edge, reconcile travel/dwell timestamps, verify energy, or prove the completeness of an externally supplied trace. A future engine integration must define those additional contracts and bind the expected scenario/context to its immutable run envelope.

## Conditional predicate subset

`citylib.conditional_access_v1` is a separate predicate module with profile `fleetlab.conditional-predicate/1.0.0`:

```python
rule = parse_condition("no_left_turn @ (Mo-Fr 07:00-10:00,15:00-19:00)")
result = evaluate_condition(
    rule, aware_traversal_timestamp,
    vehicle_class="passenger_car", timezone_name="America/Los_Angeles",
)
```

It accepts one exact restrictive value-condition expression, daily or non-wrapping weekday ranges, one to four non-overlapping HH:MM windows, and midnight-wrapping windows. Values are `no`, `no_left_turn`, `no_right_turn`, `no_straight_on`, and `no_u_turn`. Intervals are half-open `[start,end)`; overnight hours belong to the preceding window-start weekday. The result exposes the raw expression, normalized local timestamp, active Boolean and restrictive value when active. An inactive result has `value=None`; it does not grant access.

The parser rejects permission-valued expressions, PSV exceptions, holidays, seasons, weather, lane syntax, combined expressions, multiple clauses, overlapping windows, equal endpoints, invalid times and unsupported grammar. It does not evaluate the broader access hierarchy or attach conditions to graph edges. A parsed object is revalidated against its raw expression before use, so changing its fields cannot bypass the subset.

Every evaluation requires an aware instant and the explicitly supported class/timezone. UTC and fixed-offset representations of the same instant agree. ZoneInfo local timestamps in nonexistent or ambiguous DST intervals are rejected; provide UTC or a fixed offset for an unambiguous instant. No condition is evaluated just once at shift start.

The ordinary existing SF shift crosses 10:00 and 11:00 conditions. The new predicate can evaluate those instants, but neither the existing importer nor the old/static continuity router consumes those decisions. Do not report the 26-road queue or routing-support gate as resolved by installing this module.

## Resource policy

No prepared all-pairs routing table is built. Defaults/hard ceilings are:

| Resource | Default | Hard ceiling |
|---|---:|---:|
| Discovered route states | 100,000 | 100,000 |
| Route cache entries | 4,096 | 4,096 |
| Total cached path-edge references | 100,000 | 200,000 |
| Route/verifier counted restriction work | 2,000,000 | 2,000,000 |
| Trace events | 100,000 | 100,000 |
| Executed trace edges | 1,000,000 | 1,000,000 |

Graph validation additionally bounds nodes at 250,000, directed edges at 500,000, restrictions at 10,000 and total proper-prefix tuple slots at 1,000,000. Budget overflow is explicit failure; history is never truncated to obtain a route. These are algorithm/data-structure bounds, not a measured SF memory qualification. No full SF execution or peak-memory benchmark occurred in this task. Existing global 2 GB table / 4 GB process acceptance requirements remain for future engine integration.

## Eight design fixtures and limitations

| Design fixture | Implemented behavior |
|---|---|
| Three-edge prohibition split at pickup | Split and unsplit executed traces both fail; producer `legal: true` is ignored |
| Only restriction across zero-length leg/boarding | State survives and wrong continuation fails |
| Valid drop-off continuation | Same directed path and summed static cost as unsplit route |
| Two vehicles at the same node | Different incoming histories produce separate valid route/cache outcomes |
| Dead end | Explicit no-route; no automatic reversal |
| Reviewed connector | All connector requests, including matching identities and nominal costs, fail closed in v1; successful connector execution is intentionally not implemented |
| Horizon truncation | Only executed prefix is counted; planned prohibited suffix is not treated as driven; later movement after incomplete leg fails |
| Wrong identity/history or resource overflow | Typed unsupported route or invalid trace with diagnostic |

Ruling: keep connectors unsupported — no approved connector identity/cost/physical-assumption contract exists; accepting a matching ID alone would invent maneuver authority. This means the positive connector acceptance branch of the design remains future work, while stale/missing/matching-but-unsupported connectors are tested now.

Ruling: keep predicate evaluation separate from static routing — temporal routing requires traversal timestamps, access precedence, occupancy-through-closure policy and time-aware route/cache/verifier semantics. Installing a clock predicate does not qualify those behaviors.

Ruling: new standalone pack identity uses the complete canonical supplied pack — it binds source/profile/geometry and avoids mixing this module's context with historical nodes/edges/turns-only digests. Existing digest fields are not changed.

## Validation

Owned tests were written before the two implementation modules. The first owned run failed 23 tests because the modules were absent. Additional hardening fixtures failed before missing state/work/cache bounds were added. Final focused suite: 29 passing. Ruff passes for both new modules and both new test files. An earlier full City unittest run passed 186 tests. The final shared-worktree run discovered 191 tests and failed three concurrent-worker model-lesson tests because their new teaching projection was not yet implemented: `test_complete_fixed_population_and_expected_charge_times`, `test_generation_deterministic_and_separate_from_sf_evidence`, and `test_tampered_ledger_or_omitted_case_rejected_even_after_redigest` in `test_model_lessons_v1.py`. These unrelated failures are retained rather than reported as a green suite. No SF fleet run was launched by this task.

Logs: `build/research/sf-completion-r3/standalone-red-owned.log`, `standalone-hardening-red.log`, `standalone-cache-red.log`, `standalone-final.log`, and `full-city-unittest-final.log`. An earlier broad `test_*_v1.py` discovery also encountered another concurrent agent's expected test-first failures; it is retained as `standalone-red.log` and is not the owned-test result.

## Recommendation

Use these modules as reviewed foundations for a separately versioned integration. Keep SF qualification and the candidate fleet guard held. Before migration, add source-derived temporal import fixtures, access precedence/exception semantics, actual traversal timestamps and partial-edge treatment, scenario-bound trace integrity, required connector review, and full SF performance qualification.

## Top risks and mitigations

- Treating predicate inactivity as access: return no active restriction value, and leave access policy integration explicitly unimplemented.
- Trusting producer arrival history: independently reconstruct complete per-vehicle traces and preserve the unauthenticated-source boundary.
- Expanding claimed readiness from unit tests: keep engine integration, human source/district review, peak-memory validation and operational authority distinct.

## Next three actions

1. Independently review these new modules and fixtures without changing frozen scientific files.
2. Specify and test temporal graph/access integration plus actual engine event recording under a new model/profile.
3. Run the full source/class/district/human/continuity qualification process before any candidate fleet execution.

## Fleet integration continuation — 30 September 2026

The existing completion instruction authorizes the reviewed cross-leg design's
implementation. The next installed model is
`fleetlab.graph-resource-continuity/2.0.0`, with run schema
`fleetlab.city-continuity-run/2.0.0`. It retains the original one-second resource,
energy and request clock but changes every route/dispatch/depot lookup to consume
the vehicle's actual incoming edge and restriction prefix. Forecast feasibility
chains pickup arrival, boarding dwell, passenger arrival and depot return rather
than granting each leg a new initial placement. Zero-length legs retain history.
Search-budget or unsupported-context results stop execution explicitly.

Each leg binds before/after arrival state and its departure instant to the exact
pack and scenario digest. Actual arrival applies the planned final history only
when the entire path completes. An unfinished horizon leg instead stores its
completed edge prefix plus the next edge's elapsed seconds/fraction. Entering a
fraction of an edge must obey the same turn rule as traversing the whole edge;
the planned unentered suffix is never counted as distance or actual history.

The versioned verifier retains the existing event/resource/energy ledger and
adds a separate reconstruction of per-vehicle history, route ownership,
departure/arrival times, recorded boundary states and partial-edge positions.
Source node/sequence rules are evaluated from actual concatenated edge entries,
not producer permission flags or the router transition function. Any old-model,
source/scenario mismatch, lost history, missing leg boundary or fraction mismatch
fails. Internal consistency remains distinct from map qualification.

This stage integrates compiled static rules only. Conditional importer/temporal
routing, explicit depot connectors, full SF fleet performance qualification and independent
map observations remain required follow-on work; the original candidate runner
is not unlocked. No stopped power-study evaluation is resumed by these tests.

Measured static routing and integrated fleet test evidence is recorded in
[FLEETLAB_SF_CONTINUITY_VALIDATION_2026-09-30.md](FLEETLAB_SF_CONTINUITY_VALIDATION_2026-09-30.md).
This continuation supersedes the earlier standalone-only status, without changing
the old module or study identity.

## Temporal integration continuation — 30 September 2026

[FLEETLAB_TEMPORAL_INTEGRATION_V3.md](FLEETLAB_TEMPORAL_INTEGRATION_V3.md) records
the subsequent local temporal importer, routing, fleet adapter and independent
verifier. Conditions use actual edge-entry/occupancy and node-passage times.
The new candidate accounts for every captured source way and improves class
coverage without changing old packs, runs or the frozen power-study sources.
This supersedes the temporal-integration status above, not the outstanding
connector, full-fleet resource, district or independent-evidence requirements.
