# R2 shared-power charging — proposed model contract

Date: October 14, 2026. Status: DRAFT FOR OWNER REVIEW; no numerical simulator built. Sequence: R1 → R3 → R2 → R7. Proposed synthetic assumptions resolve build-spec §4. No real battery, tariff or departure calibration.

## Question and learning goal

Route `/network-flows/charging/`. Title: **Who charges first?** Learn the difference between charger slots, per-car charge acceptance, site power and departure deadlines. The earlier capacity lesson found a different constraint in its own fixture; this is a separate workload. Show whether the power ceiling binds from the accepted interval ledger, not a predetermined headline. Cost and readiness can conflict.

## Frozen workload v1

Six cars, one depot, two interchangeable plugs. Each has 60 kWh usable capacity. Arrivals are all t=0; IDs define FCFS ties. Observation: 120 minutes. Commands change at 5-minute boundaries (24 slots). Deadline is a forced departure, even if the target is missed. Arrival, deadline and price boundaries are exact integer seconds.

| Car | Initial energy (kWh) | Target energy (kWh) | Departure minute |
|---|---:|---:|---:|
| ev-001 | 24 | 42 | 90 |
| ev-002 | 30 | 48 | 120 |
| ev-003 | 36 | 48 | 30 |
| ev-004 | 24 | 42 | 60 |
| ev-005 | 42 | 54 | 90 |
| ev-006 | 36 | 48 | 120 |

Baseline ceiling: **30 kW** shared at all times; alternative controlled fixture: **60 kW**, with all other inputs identical. Two plugs each allow up to 30 kW. A vehicle accepts at most 30 kW below 48 kWh, then at most 10 kW at/above 48 kWh. No charging past its target. This stylized two-step curve is not an OEM charge curve. Battery/grid efficiency = 1 exactly; no auxiliary load, thermal model, degradation, travel or noncharging electricity load.

Illustrative tariff: 30 US cents/kWh during [0,60) minutes, 12 cents/kWh during [60,120]. No demand charge, fixed fee, taxes or actual utility plan. Energy cost per mile is unavailable because this lesson has no trip distance. Show exact cents before currency rounding.

## Actions and exact integration

At each boundary, choose up to two distinct present, unfinished cars, each allocated one plug and a power command in {10,20,30} kW. Zero means unplugged. Total commanded power ≤ ceiling; do not accept a command then silently scale it. Plug swaps are instantaneous at boundaries, an explicit favorable assumption. No command changes between boundaries.

Actual acceptance is min(command, curve cap) until target, then zero. Integrate exactly across an intra-slot 48-kWh crossing or target completion with rational seconds/energy; do not round charge to a slot or overfill. Unused power stays unused until the next decision, and completed cars hold their allocated plug until then. No silent within-slot redistribution. kWh = kW × seconds / 3,600. All event and aggregate values use reduced rationals.

At each boundary: accrue the preceding interval; process target completions and departures (meeting target exactly at departure succeeds); admit arrivals; choose allocations; snapshot. Departure removes the car from the depot and all future charging, with its energy and shortfall preserved. No new decision at minute120. Snapshot before and after decisions separately.

## Compared transparent heuristics

1. **FCFS:** sort unfinished present cars by arrival, ID. Select first two. Allocate to each in that order min(30 kW, remaining site cap); commands below10 would be zero, although default caps are multiples of10. Keep selecting anew each boundary, so a target-complete car exits priority at the next boundary.
2. **Deadline slack:** for each present unfinished car, compute minimum remaining charge time at its maximum acceptance curve (30 below48,10 above). Slack = departure − now − that time, in exact seconds. Sort ascending slack, then deadline, then ID. Select first two and allocate as for FCFS. This heuristic ignores future competition when computing slack; negative slack is not hidden.
3. **Wait for cheaper energy:** while the current tariff is30, retain only cars with slack ≤300 seconds; at tariff12 retain all unfinished cars. Then use deadline-slack ranking/allocation. This deliberately simple price heuristic can miss targets and is not an optimum.

Default paired view: FCFS vs deadline slack at30kW. Separate control changes the ceiling to60kW for both arms; records from different ceilings never masquerade as a matched policy pair. Price heuristic is an explicit third comparison. Manual scheduling is a 24-slot table; accept the entire remaining schedule only after plug/power/eligibility checks, then replay it. Pending edits never change accepted outcomes. All unspecified slots are zero power, disclosed before acceptance. After a car departs or reaches target, future positive commands for it invalidate the schedule; no silently discarded instructions.

## Metrics and interpretation

- Deadline-ready count / six departures; per-car shortfall in kWh, achieved target time or unavailable.
- Grid kWh delivered, exact electricity cents, cost per delivered kWh (unavailable for zero energy).
- Charge-queue wait: present unfinished seconds with no assigned plug; taper/zero-power time on a plug is separate.
- Plug occupation / (2 × observation seconds); productive charging seconds separately.
- Actual site energy / (ceiling × observation hours), and commanded vs actual power over time; numerator/denominator visible.
- Command-budget-saturated seconds: commanded allocation equals the ceiling, including capacity reserved but unused by tapering cars. Actual-site-power-saturated seconds: instantaneous actual draw equals the ceiling. Count those separately using exact segment boundaries. A waiting car does not make unused electricity physically saturated. Also show plug-limited seconds (both plugs occupied with an eligible unfinished car unselected) and acceptance-limited seconds (actual draw below command because of taper or target completion). These diagnostics can overlap and do not prove that adding power alone fixes deadlines.
- Charging VOR time: arrival until target complete or departure. Target-complete cars are Ready / idle while still present; after departure they are outside the depot population. COD is unavailable for these departed cars because no trip is modeled. Never mark them as driving without evidence.

A late car does not disappear from readiness or cost. Lower cost with missed departures is a mixed result. No economic or safety recommendation is inferred.

## Evidence, visuals and tests

Code-built power stack, two plug lanes, waiting cars and per-car SoC/deadline cards. Same axes across paired arms; NF-07 adjacent to the ceiling readout with standard silent controlled concept player, never driving the counts. Six chapters: question → energy needed → shared ceiling → deadlines → trade-off → try a schedule. Provide all25 predecision boundaries,24 allocations, exact power-change events, normalized inputs, record identities and ledger downloads only if bounded export is separately tested.

Producer-independent verifier integrates every charge segment, checks exact breakpoints, car/plug conservation, site cap, schedule legality, tariff accounting, readiness and required event coverage. Compare complete normalized inputs; only declared ceiling studies may differ in that one field. Tests: one-car analytical energy, taper crossing inside a slot, target exactly at departure, target before next boundary, all plugs empty, third plug rejection, cap violation, missing departure, rehashed foreign tariff, zero-energy unavailable ratio and stale accepted UI result. Analytical fixture: 46→49kWh at30kW takes 4 minutes to48 plus6 minutes to49 =10minutes, before any competing load. All main-fixture outcomes remain uncomputed until approval.

## Research, package and boundaries

[Jacobsen, Kulcsár and Lindman, arXiv:2508.19933v3](https://arxiv.org/abs/2508.19933v3) studies coordinated dispatch, charging and rebalancing under uncertainty. R2 isolates deterministic site scheduling; it does not reproduce that optimizer or validate a charge curve. Primary abstract checked October14. No paper percentage becomes a target.

Fences: `Synthetic scenario · not operational data`; `Concept illustration · not simulation output`. Shared vocabulary states numerator, denominator and units. No real charger control, utility billing, safety claim or physical deployment authority. Keep model state independent of R1/R3. Establish ownership, source capture, media hashes and measured budget before full UI; no further limit increases are pre-approved.

## Recommendation

Approve or amend the two-step acceptance curve, instantaneous plug swapping and exact definition of deadline slack. These choices govern the lesson more than visual fidelity.

## Top risks + mitigations

- Simplified battery curve mistaken for engineering advice: expose all assumptions beside the chart.
- Cheaper charging declared better despite missed departures: pair cost with deadline shortfall.
- Floating-point drift or hidden redistribution: rational segment integration and independent reconstruction.

## Next 3 actions

1. Review workload, actions and curve.
2. Implement tested model/verifier and inspect actual bottleneck evidence.
3. Build responsive counted visuals, validate and release after contract approval.
