# SF temporal fleet resource qualification

30 September 2026. **Engineering diagnostic only; not a power-study evaluation,
comparison estimate, city acceptance, or operational recommendation.**

The fixed case uses 100 generic vehicles, 1,200 requests and an eight-hour logical
shift. It reuses the historical seed-1001 baseline input tape without generating
or selecting new demand. Each diagnostic freezes the exact source hashes before
execution. The limits remain 4,000,000,000 resident bytes and 1,800 seconds per
phase; execution/serialization and independent verification use fresh processes.

## Fixed identity

- Model: `fleetlab.graph-resource-temporal/3.0.0`.
- Pack digest: `426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3`.
- Input digest: `08d22af08117855473c5db3cbb67edce9f0791045d3cf9a273140b7b787a83b0`.
- Input lineage: `build/fleetlab-city/runs/sf-depots-v1/seed-1001-baseline/inputs.json`.
- Shift: 29 September 2026, 07:00–15:00 America/Los_Angeles.
- Fictional depot A, node `2327650830`: eight ports, four service slots,
  200 grid kW and 50 kW per port; historical generic energy/dwell inputs retained.
- No parameter calibration, altered request population, implicit reversal,
  connector, waiting permission or relaxed route-search cap.

## Preserved interrupted engineering probes

These were deliberately interrupted after diagnosing specific correctness or
performance issues. None is a successful full-fleet run, a memory-limit failure,
or a retry of the frozen scientific evaluation. Each directory preserves its
freeze, log, `NOT_COMPLETED` report and explicit stop decision. All before/after
source-hash checks passed.

| Probe | Queries | Seconds | Peak resident bytes | Reason for interruption |
|---|---:|---:|---:|---|
| r1 | 2,567 | 189.306 | 1,640,775,680 | Repeated static-history search across departures |
| r2 | 13,085 | 371.983 | 1,708,163,072 | Repeated pickup exploration for structurally terminal arrivals |
| r3 | 16,137 | 428.697 | 1,683,537,920 | Independent review reproduced stable-label/initial-state collision |
| r4 | 13,391 | 390.406 | 1,600,307,200 | Profile identified redundant reverse-potential reconstruction |

Evidence directories use
`build/fleetlab-city/validation/sf-temporal-fleet-20260930-rN/`.

The 100-query profile spent 16.246 of 16.738 measured query seconds constructing
the same unrestricted reverse distances 79 times. Bounded immutable reuse reduced
the full profiled query block from 16.852 to 0.607 seconds with identical statuses
and costs. This narrow profile motivates the optimization; it is not a fleet
speedup claim. Both profiles are retained under
`build/fleetlab-city/validation/temporal-performance-review-20260930/`.

## Preserved r5 work-budget stop

Revision r5 is frozen at
`7739665488544f428f34e3b9c7a2ece0e716bab7f1a62dee4eb946a9c5ce0151`
and ran the identical case with the reviewed potential cache. It stopped after
**103,527 queries**: 60,815 ROUTE, 42,711 NO_MODELED_CONTINUATION and one
UNSUPPORTED_CONTEXT. The last pickup query was `1712572432 → 315705409` at
07:32:30 local, with no incoming edge. The unchanged 2,000,000-work limit stopped
the search after 309.522 seconds of fleet execution; peak resident memory was
**1,798,733,824 bytes**. All sources remained unchanged. No full run was serialized,
so independent full-fleet verification did not run.

Inspection found a destination behind permanent motor-vehicle gates. The relaxed
distance topology had ignored permanent node access as well as timed rules,
causing unnecessary time-label expansion for an inaccessible destination.
Retaining a most-specific base denial is safe because the supported conditional
grammar only adds denials; it never opens a permanently prohibited node. A new
regression first failed the work limit, then returned explicit no continuation.
A more-specific `motorcar=yes` control remains reachable. The source road inventory
and actual permission checks are unchanged.

Full-fleet resource qualification remains incomplete until the fixed case finishes
execution, serialization and independent verification within the declared limits.

Revision r6 freezes that correction at
`c8962670e723bf9e8b6960d82d3b954e58bca7b9922cc74d3fd74b1189b561be`.
The input tape, generic fleet, depot, eight-hour horizon and all resource limits
are unchanged. Execution is running; independent verification must follow in a
fresh process only if a complete run is produced.

## Scientific-study boundary

All twelve scientific source files remain byte-identical to commit `7cf32c5`.
The separately frozen power study's one approved fresh-process retry remains
consumed: one evaluation arm was retained, then the 4 GB stop fired, leaving 143
arms NOT_RUN. These engineering probes neither resume that study nor supply its
missing primary estimate. Any further scientific execution requires its own
concrete, reviewed amendment and authorization.

SF acceptance remains HOLD. District reconciliation, explicit connectors,
versioned public export, independent map review and physical-device/visitor
evidence remain separate obligations.
