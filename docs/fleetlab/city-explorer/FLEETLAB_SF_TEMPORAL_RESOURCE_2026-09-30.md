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

## Completed r6 execution and corrected independent verification

Revision r6 freezes that correction at
`c8962670e723bf9e8b6960d82d3b954e58bca7b9922cc74d3fd74b1189b561be`.
The input tape, generic fleet, depot, eight-hour horizon and all resource limits
are unchanged. **The fixed full-fleet case now completes execution, serialization
and independent verification within both limits.** This is a bounded engineering
qualification of this case and these source versions, not map or city acceptance.

| Phase | Result | Seconds | Peak resident bytes |
|---|---|---:|---:|
| r6 execution and serialization | COMPLETE | 1,300.761 | 2,169,552,896 |
| Original independent verifier 3.0.0 | INVALID; 12 findings preserved | 105.090 | 2,046,918,656 |
| Same stored run, corrected verifier 3.0.1 | INTERNALLY_CONSISTENT; zero findings | 107.093 | 2,060,730,368 |

Execution performed 519,579 route queries: 278,088 ROUTE and 241,491
NO_MODELED_CONTINUATION, with zero UNSUPPORTED_CONTEXT. The recording contains
58,374 events, 192,000 poses and 1,484 legs. Its immutable run digest is
`14347ca06e6fd67ca507c6aaed221a26efbb2957a411bf5b26e23fd419f501e1`.

The original verifier correctly withheld acceptance when its reconstruction
disagreed. Investigation identified two numerical defects in verification:

- Twenty-one partial final positions had matching edge IDs and completed paths,
  but differently associated float subtraction/addition differed by roughly
  10⁻¹² seconds. The verifier had required identical binary floats. The revised
  check retains exact topology and field keys, and permits at most one nanosecond
  of numerical error in elapsed time and in fraction expressed as time. It rejects
  nonfinite, boolean, out-of-range and materially changed values.
- All eleven pose findings occurred at exact millisecond edge boundaries. Float
  accumulation placed the boundary just after the sample and chose the preceding
  edge's heading. A separate temporal interval reducer now accumulates validated
  integer milliseconds. Other accounting checks and tolerances remain unchanged.
  The frozen historical reducer is untouched.

Two hand-checkable regressions failed before the corrections and passed after.
Forged heading, state, energy, edge and fractional-motion values still fail.
An independent review found no important issues. All 262 City Python tests and
1,661 root tests / 56 skips pass; Ruff and whitespace checks pass.

**No simulation was repeated and no recording was repaired.** A fresh process
read the original run under `fleetlab.city-temporal-event-verifier/3.0.1`, with
`fleetlab.fleet-continuity-verifier/2.0.1`. It checked 426,081 entered edges and
430,130 planned temporal edge entries, retaining at most ten history edges.
The source and artifact hash checks passed. The initial invalid report remains
in r6; the new result is in the separate directory
`build/fleetlab-city/validation/sf-temporal-fleet-20260930-r6-verifier-3.0.1/`.

| Record | SHA-256 |
|---|---|
| Original execution report | `7a9ea250b80ee431b5028498346aca795fa7de831b097297e93b37536be55abb` |
| Original invalid verification phase report | `e444d51809c598dda1e2bd60b73d6dd36e2e83b1b5b66dffa85a49e7104710dc` |
| Corrected verification freeze digest | `264332a44c4a11b8b62a340777679691f35d21a425b38e1ca7295f473925d46c` |
| Corrected verification phase report | `e516bf4e0cd83669ed54652a002b3d9c901f65489706bef1370099cddf82e3e9` |
| Corrected verifier result | `654bfb4d4a0345749f4ed199ff691f56b0fad025fefdfe4458f7a462c39c2bf0` |

Descriptively, this engineering case records 634 completed requests, 506 unserved,
13 in progress, six assigned and 41 waiting at the horizon; no simulator violation
events were recorded. These are not paired estimates, operator predictions or
real-world safety evidence. Neither the outcomes nor this one successful case
authorize resuming the stopped scientific study.

An optional no-static-exit fast path was investigated while execution ran. Its
six-work-unit fixture and expected failure are retained as a proposed test patch
under `temporal-performance-review-20260930/`, outside the installed test suite.
The optimization was deferred once the full case met its actual resource limits;
the qualified producer/router source was not changed for it.

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
