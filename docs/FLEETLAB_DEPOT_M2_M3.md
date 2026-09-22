# Fleet day: charging, resource uncertainty and airport preparation

Implemented September 22, 2026 in the existing static Playground. These are independent,
versioned opt-ins in Fleet day. Street lab, regional experiments and Python evidence
remain distinct systems. All outputs are synthetic teaching data, `NOT_EVIDENCE`, with
`deployment_permission: NONE`. Publishing the website does not grant operational authority.

## Local run and reproducible examples

From the repository root, with Node.js 22+ and Python 3 available:

```bash
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist/site
```

Open `http://127.0.0.1:8766/`. Choose **Fleet day**, then one of these situations:

| Situation | Separate paired treatment | What to inspect |
| --- | --- | --- |
| Optional model: charging | charging redistribution | Equal share versus capped redistribution, same ports/site power and FIFO queue rule |
| Optional model: charging | charging deadlines | Redistribution versus deadline priority, same declared deadlines and targets |
| Optional model: resources | resource freshness | Last-known observations versus fresh-only eligibility, same feed delay and outage |
| Optional model: airport | airport forecast | Reactive versus independently forecasted preparation, same realized demand |

Press **Run fleet day**, pause/scrub the recorded replay, and expand the depot resource
panel or **Airport staging** activity. The operator tables show unknown/stale observations,
current simulator truth, reservations and blocked reasons. Optional model results show
policy checks separately from simulator validity. Then choose the matching **Paired
treatment** and **Run paired policy experiment**. The comparison freezes both policies;
it does not silently treat the current policy as its baseline. The exact changed policy,
held inputs, seeds and margin are displayed. Editing settings invalidates old results and
cancels pending comparisons. Select the regular situation to restore historical semantics.

Default evaluation seeds are 1001–1012; declared tuning seeds are 42, 43 and 44. Tune with
single replays, freeze your choice, then evaluate once on a separate set. Exclusion is
checked, but the app cannot authenticate whether a person previously inspected a seed.
The default practical margin is **0.02 fraction units**, not two percent relative gain.
One evaluation seed gives descriptive tables only, with no interval or recommendation.
The null control uses the baseline policy in both arms and must produce identical results.

Exact machine-readable reproduction (each command uses the same defaults as the UI):

```bash
node playground/fleetlab/tools/demo-depot.mjs charging_redistribution > dist/charging-share.json
node playground/fleetlab/tools/demo-depot.mjs charging_deadlines > dist/charging-deadline.json
node playground/fleetlab/tools/demo-depot.mjs resource_freshness > dist/resource-freshness.json
node playground/fleetlab/tools/demo-depot.mjs airport_forecast > dist/airport-preparation.json
# A single seed is descriptive only:
node playground/fleetlab/tools/demo-depot.mjs airport_forecast 1001 > dist/airport-one-seed.json
```

No output file is part of the deployed package. The UI also downloads exact comparison
JSON; its digest identifies the frozen specification and is not authentication.

## Contracts and boundaries

Omitting every new key retains the original `fleetlab-bay-operations-1.0.0` result shape
and semantics. M1 remains `depot-readiness-1.0.0`. Enabled keys append their version to the
Bay model version in fixed order: readiness, charging, resources, airport.

| Configuration key | Version | Contract |
| --- | --- | --- |
| `charging` | `depot-charging-1.0.0` | Linear battery-side kW, efficiency 1, no auxiliary load/taper/loss; equal share, capped redistribution, or deadline priority |
| `resources` | `depot-resources-1.0.0` | Fictional identified ports, commissioning/health truth, sequenced delayed observations, exclusive reservations |
| `airport` | `airport-demand-1.0.0` | Synthetic SFO passenger pulse and independent published forecast, bounded preparation slots and dated fictional access rule |
| `extensions` result | `bay-systems-metrics-1.0.0` | Model-produced accounting, named checks and explicit population/availability rules |
| Paired specification/result | `fleetlab-bay-paired-experiment`, format 1 | One policy axis, disjoint seed sets, frozen non-treatment inputs, exact demand equality, repeatability precheck |

`charging-allocation.js`, `resource-observations.js` and `airport-demand.js` are bounded
helpers called from the existing Bay lifecycle. `bay-systems.js` records extension
accounting. `bay-experiment-contract.js` validates Bay runs before calling the shared
numeric adapter in existing `model/experiment.js`. The regional integer-only serializer
and instrument semantics are unchanged. Bay canonical JSON uses sorted plain-object
keys and finite IEEE-754 JSON numbers, then existing SHA-256. It is a separate contract.
No Bay map import enters the regional worker; the original offline size cap remains.

The new copy check permits four exact synthetic-forecast literals only in the new UI
module. Production prediction/telemetry claims remain banned; existing adversarial copy,
CSP, dependency and Python-label boundary expectations are retained.

## Charging and work semantics

Charging remains one stage in serial software → cleaning → charging → upload. Ports,
site power, vehicle acceptance, energy target and M1 mandatory release checks remain
finite. A proposal is checked before any battery mutation. The **overcommit power**
counterexample produces `POWER_PROPOSAL_FEASIBILITY: FAIL`, zero accepted delivery for
that proposal, and valid simulator state. Actual energy/cap/reserve violations would
instead produce `INVALID_SIMULATION` and prevent paired analysis.

Equal share leaves unused capped shares unused. Redistribution water-fills only the
remaining capped capacity. Deadline mode also orders queued charging jobs. Visit readiness
deadlines are visit-start + budget + stable vehicle-ID tier (0, 1 or 2 × spread); all serial
work must finish by that deadline. They are synthetic service targets, not SOC priority.
Jobs aged beyond the declared starvation threshold get oldest-queue priority. This
prevents perpetual priority bypass; it cannot guarantee deadlines or power under overload
or outage. Occupied plugs can receive zero power. No energy is integrated at terminal H.

## Resource uncertainty and recovery

Each site has explicit fictional port IDs. Planned ports are not installed; installed but
uncommissioned ports are not eligible execution capacity. Observations contain source,
resource ID, sequence, idempotency key, observed-at and received-at minutes, commissioning,
health and compatibility. Duplicate/out-of-order/malformed observations are rejected.
Freshness uses observed time, never arrival time. Unknown is unavailable.

Last-known planning may infer eligibility from stale observations. Fresh-only planning
requires age ≤ TTL. Both consult the local exclusive reservation ledger, and execution
checks current truth. A stale healthy proposal can be rejected without violating physics.
A retry by the same owner at the same site returns the held lease without acquiring twice.
Leases expire after the observation window; completion releases them earlier. A connected
outage retains ownership, delivers zero power, and resumes when truth is healthy. There
is no cable-recovery model or alternate-depot routing. Port recovery delay means the first
fresh healthy observation at/after outage end; missing ports remain unavailable in that
measure. Eligibility need not improve throughput; inspect unfinished work and guardrails.

## Airport preparation

Passenger realization is keyed by seed/passenger/channel, including conversion, ready
spread and destination, independent of scheduling or forecast inputs. The forecast contains
only a declared count/wave time and publication/expiry window. The planner never reads
future realized requests. Changing forecast count/timing can test inaccurate forecasts
while leaving demand unchanged. Background demand also stops at the explicit intake
cutoff, which is distinct from observation end.

Preparation uses existing routes and requires inbound plus nearest-depot return energy
and reserve. Its finite slots include inbound and staged vehicles, and release on rider
assignment. Initially available airport vehicles are a separate starting-supply assumption;
these preparation slots do not model a real airport curb. Foreknowledge does not create
vehicles or bypass depot tasks. Pickup target is measured at vehicle arrival, before the
separately configured boarding/airport dwell. Access rule `synthetic-access-2026-09-22`
is fictional and grants no airport permission.

## Metrics and interpretation

All run metrics come from the model; UI renders recorded values. H is the final observation
minute; energy/work intervals are [0,H). Requests created at intake cutoff are excluded.

- Primary: completed requests by H / **all requests** created before cutoff. Empty demand
  is unavailable, not zero success. Unserved, waiting, assigned/boarding/in-trip requests
  stay explicit. Completed-only averages keep their historical names and population.
- Charging queue minutes include unfinished queued work through H; active minutes count
  elapsed charging occupancy including zero power. Unfinished energy is the remaining
  charge target of all unfinished visits, including work that has not reached charging.
  Whole-fleet terminal battery energy is separately stored in `metrics.final_energy_kwh`.
- Readiness partitions every started visit into ready by deadline, missed deadline and
  pending deadline. Pending includes unfinished visits whose deadline is after H.
- Unknown/stale/false-ready/prediction-error resource measures are port-minutes in [0,H).
  False-ready means planner-eligible but execution truth unusable; prediction error means
  an available health/commissioning observation disagrees with current usable truth.
- Airport pickup cohort partitions all airport-origin requests into within target, missed
  and pending. Unserved or mature unpicked requests miss; unpicked requests with targets
  after H remain pending. Area timeline shows waiting/pickup demand, local available supply
  and their positive deficit. Terminal preparation slots/inbound movements stay counted.
- Required guardrails: maximum all-request observed wait (+5 min harm allowed), unfinished
  visits (+0), terminal fleet energy (−5 kWh), rejected actions (+0). With airport enabled,
  nonairport completion and airport within-target fractions may each fall at most 0.02.
  Unpicked wait is H minus creation, including unserved requests; it is an observed
  censoring measure, not a completed-only wait estimate.

The instrument receives one metric map per arm per seed. It bootstraps **paired run-level
deltas**, never treats cars/requests as independent samples. Every required guardrail must
be available before analysis; incompatible producer/version/configuration/demand/population
or invalid simulator state blocks comparison. Guardrails compare mean harm independently
of primary outcome. Small seed sets and synthetic assumptions limit interpretation even
when an interval is narrow. No browser recommendation changes evidence or release authority.

## Checks and deliberate controls

```bash
FLEET_PLAYGROUND_PERF=1 node --test playground/fleetlab/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 \
  python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
```

Boundary tests cover capped/target-limited allocation, starvation promotion, bad proposals,
unknown/stale/out-of-order observations, ownership/expiry, no power during outage, recovery,
planned/uncommissioned ports, forecast validity, identical demand, finite staging, cohort
censoring, missing data, tampered versions/specs, null treatments, stale UI and cancellation.
Two historical whole-result hashes remain pinned. Performance checks are enabled for the
release; the browser-only narrow-layout TODO is manually exercised. Direct file-URL opening
of the offline package remains blocked by browser policy; packing, security checks and its
worker parity test still run. No bypass of that browser restriction is used.

M4 region bring-up, second regions, concurrent work, optimized physical charging/taper,
tariffs, worker shifts, production feeds, physical simulation and real airport operations
remain out of scope. See the existing source of truth for observed release validation.
