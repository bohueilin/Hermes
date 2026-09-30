# SF temporal routing integration — v3

30 September 2026. The conditional importer, temporal router, fleet adapter and
independent verifier are implemented locally under new pack/run/model identities.
Historical packs, fleet recordings and the stopped power protocol remain
unchanged. This is an engineering checkpoint, not a deployment or an SF
acceptance decision. SF acceptance remains **HOLD**.

## Contract

Use a separately identified temporal pack and fleet model. Preserve raw tags,
relation member order, source identities and original accounting denominators.
The first supported increment covers exact restrictive node-via turn conditions
and daily/weekday access conditions for an ordinary passenger car, without PSV
privileges. Unsupported expressions, mode overrides or ambiguous topology stay
explicitly blocked. Neither parsing nor an inactive condition grants permission.

Evaluate node turn restrictions at the outgoing edge's actual entry time. Access
must remain available for the complete modeled edge-occupancy interval [entry,
exit); a closure at exit does not overlap occupancy. This conservative occupancy
policy is a declared model assumption, not a statement of road law. No automatic
waiting, reversal, connector, or grandfathering through closures is introduced.
Node access is checked at both ends of an edge, including arrival at the final
destination. A node gate closing exactly at arrival therefore blocks that
passage even when the preceding way's occupancy interval has ended. More
specific active conditional or base access overrides less specific modes;
unknown directional/mode tags block the affected source way.

Travel time is represented in integer milliseconds, rounding each assumed
free-flow edge duration upward by less than one millisecond. Retain original
source duration and the transformation. The versioned fleet retains its existing
one-second resource clock; leg arrivals occur at its next whole-second event.
The temporal run uses the exact millisecond edge-entry offsets within each leg.

Time-aware search retains distinct arrival-time labels before the last schedule
change within the feasible journey bound. An earlier arrival does not generally
dominate a later one in a network that disallows waiting. At or after that final
boundary, the remaining network is static: the earlier arrival with the same
incoming edge and retained restriction prefix safely dominates. Any suffix of a
later route can then be traversed earlier without crossing another rule change.
This includes a rule change exactly at the bound; it must not be rounded away.

An exact static-history relaxation first finds the shortest route while ignoring
only temporal constraints, using the requested A* or Dijkstra algorithm. If every
edge of that route passes its actual temporal traversal checks, it attains both
the relaxed lower bound and a feasible upper bound, proving optimality. It can
then return directly. A failed temporal check continues into the full search.

A further bounded preliminary search supplies only a feasible cost upper bound,
never a public route or a proof of no route. A reverse shortest-path potential ignores
restrictions, so it is an admissible lower bound for both algorithms. The exact
search proves the minimum within those bounds. A* and Dijkstra share costs and
admissibility; budgets remain 250,000 states and 2,000,000 work units per query.
The preliminary searches share that work budget. Exhaustion means unavailable,
never an unconstrained fallback. No all-pairs table is constructed. A journey
beyond the declared horizon is not reported as a global proof of disconnection.

Departure time, horizon, scenario, map, incoming history, timezone, modeled class
and algorithm bind cache identity. Independent replay reconstructs actual edge
entry/exit clocks and retained history; forged producer evaluations cannot
supply permission. Static v1/v2 consumers must reject a temporal pack.

Pack schema: `fleetlab.city-temporal-pack/3.0.0`; run schema:
`fleetlab.city-temporal-run/3.0.0`; model:
`fleetlab.graph-resource-temporal/3.0.0`. The internal static projection shares
the existing event/resource accounting without rewriting old scientific sources.
The complete temporal pack digest, not only that projection, binds the run.

## Implemented validation

The 27 temporal tests cover all 18 captured Lombard records, named via nodes and
directed edges, 07:00/10:00/15:00/19:00 boundaries, overnight access, specificity,
closing mid-edge, final-node passage, malformed/duplicate source records,
unsupported modes and ambiguous approaches. Literal route fixtures require a
later arrival at the same incoming edge and an opening exactly at the journey
horizon. A branching fixture checks safe label collapse after the final boundary
without dropping the pre-boundary labels. All were exercised with both algorithms
where route search is involved.

Fleet fixtures preserve history through zero-length trips, service stops and
partial final edges. Independent verification rejects forged producer clocks,
omitted conditional rules and a producer that bypasses the temporal turn check.
Its predicate evaluator reads retained expressions and reconstructed event times;
it does not instantiate the temporal router or call its permission function.

An independent implementation review identified missing-rule acceptance,
unhandled directional/mode overrides and ambiguous incoming approaches. Each
finding was reproduced in a failing test and fixed. Subsequent node-access and
routing-bound optimizations were validated by focused regression tests and the
SF diagnostics below; they were not part of that review snapshot.

Final local suite: **250 City Python tests passed**, including the 27 temporal
tests. The shared accounting extraction also passed **1,661 root Python tests /
56 skips** and **49 City Node tests**. Ruff and whitespace checks passed. Doctor
reported 16 PASS, two environment/dirty-checkout warnings and one optional
NOT_AVAILABLE. No browser UI changed in this checkpoint.

## Captured SF candidate

The final local compile preserves all **69,027** source candidate IDs and the
original **2,172,216.6215587733 m** eligible-length denominator. It contains
261,455 nodes, 186,930 directed edges, 2,179 static turn rules, 175 timed node
turn rules and 32 way-access schedules. Nodes also retain access/gate records.

| Source coverage | Prior static candidate | Temporal candidate |
|---|---:|---:|
| Unsupported eligible length | 28,716.656916948465 m | 21,439.247753288102 m |
| Unsupported fraction | 1.3219978445953294% | 0.986975587080417% |
| Trunk unsupported fraction | 9.372569320769145% | 3.1065976562400652% |
| Living-street unsupported fraction | 21.5952694694466% | 0% |

All class fractions now meet the unchanged 5% source-coverage threshold. This
does **not** qualify the map: district coverage is still unavailable and the
aggregate routing-support result remains false. The compile restores 165 ways
but also newly blocks 141 previously included ways because their access details
were ignored or are unsupported. Both populations and reasons are retained;
the improvement is not achieved by dropping candidates or changing denominators.

Compilation used 2,280,636,416 peak resident bytes in 12.112 seconds. Evidence:
`build/fleetlab-city/validation/sf-temporal-20260930/r5/compile-report.json`.

| Identity | Digest |
|---|---|
| Captured XML SHA-256 | `8744a2e1fc36719f0ba0b9040664bd62b4d9df2719e65c2d14007c214e6a31e7` |
| Prior complete static pack | `2d4f21c7148c6d2fb4393f36d750be576b2aa4e44810d10a482f4dbdf74ff67d` |
| New temporal pack | `426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3` |
| Existing fixed OD requirements | `b32ab2e295c67c22a820b65b4a9a8fab4b347a2ea3ed230e252b4fabc98d98d8` |

The old requirements supply a fixed engineering OD sample only. Their human
review obligations bind the old pack and cannot be silently transferred to this
candidate. A new review package and actual observations are still required.

## Preserved adverse diagnostics

Early searches exhausted the existing state limit near conditional-rule changes.
The last pre-fix wider probe stopped on its 11th OD context at 09:59 local, route
`65283028 → 5295219562`; both algorithms returned `UNSUPPORTED_CONTEXT`. This was
not a proof of no route and not a memory stop. Its report remains at
`r6/shift-routing.json`, SHA-256
`167f1bc358a00e21dce4c75d32107d7ee4927ff93a751fa7ab759e61a0db7ff0`.

The diagnostic found a 701.038-second unrestricted lower bound and a feasible
725.796-second route, with only one intervening change at 10:00. Keeping every
arrival time after that change caused needless combinatorial growth. The
stable-suffix rule above fixes the cause without coarsening time, adding waiting,
altering the OD sample or increasing budgets. The new branching regression failed
before the fix and passed afterward. Earlier revisions and failed logs remain
under the same validation root.

The next probe completed both 100-OD sets at 09:59 and 10:59, then stopped on the
seventh 14:59 case's return (`2820059979 → 3997967144`, actual return departure
15:14:01). It retained 207/300 OD contexts at `r7/shift-routing.json`. Investigation
found that the 1,064.795-second static optimum was also temporally valid; global
schedule changes on other roads nevertheless caused needless time labels. The
static-optimum certificate now bypasses expansion only after all its actual
traversal checks pass. A separate regression reproduced this failure before the
change. The full sample is rechecked after each fix; neither failure was removed.

## Latest full-SF routing check — still incomplete

The final `r8/shift-routing.json` checks the same 100 fixed OD pairs at 09:59,
10:59 and 14:59 local, with A*/Dijkstra outbound routes and retained-history
returns after rounded arrival plus 30 seconds of dwell. The first two sets
completed. The third stopped on its 48th context, leaving 52 contexts NOT_RUN.

| Latest observed result | Value |
|---|---:|
| OD contexts attempted / planned | 248 / 300 |
| Route searches performed | 976 |
| ROUTE results | 908 |
| NO_MODELED_CONTINUATION results | 66 |
| UNSUPPORTED_CONTEXT results | 2 |
| Peak resident bytes | 1,774,665,728 |
| Elapsed seconds | 287.413 |

The remaining failure is return `65391872 → 65314192`, departing at 15:15:31
local after its 14:59 outbound trip. Both algorithms exceeded the unchanged
250,000-state search limit. Their matching failure is not proof of no route or
a passing qualification result. No memory limit was exceeded. The report's
overall `pass` is **false**; SHA-256:
`d9b008e6c0a77699f4c4de2db6d6f1931d4f7a4880c638e34240036dd40c2fca`.

A targeted diagnostic found a feasible 959.852-second return versus the
913.589-second static relaxation. The static path has four prohibited node/edge
passages around 15:18:47, so the static-optimum certificate correctly declines it.
The only schedule change inside the feasible bound is 15:30. This narrows the
next investigation; it does not prove that the change is irrelevant to all paths.

The next optimization must prove which schedule changes can affect a feasible
route through the current state. Merely raising caps, discarding later arrivals,
coarsening time, allowing waiting or removing difficult OD pairs would change
the model or hide the failure. Until resolved, full temporal routing and fleet
resource qualification remain incomplete. The earlier morning-only 200-search
pass and successful one-vehicle smoke do not override this adverse result.

## Actual fleet smoke check

A fixed, synthetic, 15-minute, one-vehicle/one-request SF smoke check completed its
passenger trip. A fictional diagnostic-only service point is at its destination;
this is not an experimental depot configuration or operational recommendation.
Execution and verification ran in separate fresh processes. The independent
verifier checked 409 entered edges, 409 planned temporal entries and retained
history of at most 10 edges (the required source bound). It reported internally
consistent evidence and no findings; map qualification remains NOT_EVALUATED.

| Phase | Peak resident bytes | Elapsed seconds |
|---|---:|---:|
| Execution | 1,819,754,496 | 6.453 |
| Independent verification | 1,464,598,528 | 7.297 |

Run digest: `071eb291f18d627611880a3c9a5175d74597dd89dd74ac50c6535ec7bf8e8533`.
It is unchanged across the routing optimizations. Final evidence is in
`build/fleetlab-city/validation/sf-temporal-20260930/r8/`:

- `smoke-execute-report.json` SHA-256:
  `26371da866596ad34ce06ce506a947e4f9b00daba168344c0de762f8490d7782`.
- `smoke-verify-report.json` SHA-256:
  `8c5b04de654b9396cbc6aa9d05b113b533a4a927e887841fcc99e44b918ce6bb`.

Each phase captures all City library source hashes and checks they did not change
during execution. This establishes a small real-graph integration check, not
100-vehicle/eight-hour qualification or a completed comparison study.

## Remaining acceptance work

Finish full-fleet resource qualification, the explicit connector contract and
versioned bundle/export integration. Resolve district scope and generate the new
candidate's review requirements. Obtain actual independent map observations,
physical-device/accessibility checks and visitor-comprehension evidence. Preserve
`recommendation_eligible: false`, `NOT_AUTHENTICATED`, `SIMULATION_ONLY` and
deployment authority `NONE` for these engineering records.

No power-study evaluation was executed or resumed by this work. All 12 frozen
scientific source files are unchanged. The one approved fresh-process retry
remains consumed; its stopped result and 143 NOT_RUN arms remain intact.

## Reproduction and release boundary

Commands used for the software gates:

```sh
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
(cd apps/fleetlab-city && npm test)
PYTHONPATH="$PWD/src" /Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m pytest -q
/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m ruff check .
PYTHONPATH="$PWD/src" /Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m hermes doctor
git diff --check
```

The validation root retains each diagnostic script, captured source hashes,
reports and stdout/stderr. The smoke execution and verification are distinct
invocations of `r8/fleet-smoke.py execute` and `r8/fleet-smoke.py verify` using
the City virtual environment. Generated full-map evidence is not committed into
the source tree; the small attributed Lombard source fixture is committed for
portable regression tests.

The public site still serves release `a9f05880`, with the original recordings and
all original teaching sections. These local modules are not in that viewer or its
source offer. Do not redeploy its old stage and describe it as the new temporal
candidate. Public integration needs a compatible versioned bundle, explicit
candidate status, fresh preview/production readback and a preserved rollback.

## Source references

The OSM [conditional restriction rules](https://wiki.openstreetmap.org/wiki/Conditional_restrictions)
describe mode specificity and conditional overrides; [access](https://wiki.openstreetmap.org/wiki/Key:access)
and [restriction relations](https://wiki.openstreetmap.org/wiki/Relation:restriction)
define the relevant source tags and members. These document OSM interpretation,
not physical road permission. Exact captured XML remains the source for this map.
