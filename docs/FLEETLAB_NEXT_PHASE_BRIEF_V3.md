# FleetLab — handoff for the next product and simulation brainstorm

## Current continuation — SF completion and model readiness

Read [the SF completion status](FLEETLAB_SF_COMPLETION_STATUS_2026-09-29.md) first.
It supersedes older next-action statuses below. The memory amendment was accepted
and implemented. Its 24 preflight arms passed, but the approved evaluation retry
stopped after one of 144 arms at 4.0466 GB; no primary estimate is available.
Static fleet continuity and fractional-edge verification are now integrated in a
new model, with 223 City Python tests and a fixed 400-search SF routing diagnostic.
[The 30 September checkpoint](FLEETLAB_SF_CONTINUITY_VALIDATION_2026-09-30.md) records
the evidence and limits. Conditional importer/temporal integration, connectors,
full fleet resource qualification, independent map/device/visitor evidence and
measured vehicle inputs remain open. Austin is next after SF acceptance. San Mateo
remains a prepared California source probe; no new city result is introduced. The Model lab update is live at <https://fleetlab.pages.dev/city-explorer/#models>.
Publication verification is recorded in [the release record](FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md).
The entire SF checklist is not complete: remaining engineering tasks and external
evidence requirements are separated in the current completion status.

## Latest handoff — San Francisco clarity and fleet insights, 29 September 2026

City Explorer is now a separate tab in [FleetLab](https://fleetlab.pages.dev/),
starting with [San Francisco](https://fleetlab.pages.dev/city-explorer/).
The existing Overview concept film, Fleet day, Street lab, Four-area experiments,
Scale lab, 59 Learning catalog lessons, Product approach and guided walkthrough
are preserved. The new homepage card and catalog entry lead into the recorded
city study, with explicit return links. Complete map sources and notices are
[downloadable](https://fleetlab.pages.dev/city-explorer/sources/).

The initial public City release includes the existing twelve paired depot
repeats, five stress cases, full eight-hour replay, configuration-specific
red depot markers, vehicle story suggestions, trip/service/empty-mile summaries,
viewer-entered fares, and explicitly unavailable unmodeled safety metrics.
The live enhancement adds a readable atlas control layout, an owner contact at
FleetLab's footer, and a fleet-wide summary before individual replay. The summary
covers the complete selected recording: completed trips, median/mean/range,
weighted empty-mile fraction, trip-count distribution and depot queue time as a
share of all vehicle-hours. The 100 IDs share one generic vehicle model; they
illustrate different assignments and shared-resource experiences, not 100 vehicle
classes or independent replications. All twelve seeds remain separate paired
replicates. See the release record for publication and validation status.

It does not include new power-study results. That historical release preceded the accepted memory revision; see the current continuation above for the retained incomplete evaluation.

Next ideation should preserve the additive architecture and prioritize SF map
continuity/qualification, physical-device and independent participant evidence,
and the controlled power study before claiming city conclusions or expanding.
Use the release record and presenter guide for actual validation and limits.

Prepared 29 September 2026. Read this together with `FLEETLAB_CITY_PRESENTER_GUIDE.md`, `FLEETLAB_SF_MAP_RESEARCH_V3.md`, `FLEETLAB_VEHICLE_CONCEPTS.md` and `FLEETLAB_CITY_LAUNCH_PREPARATION.md`. This is a project record and proposal input, not permission to publish or change experimental contracts.

## What exists now

FleetLab has a public legacy teaching site at https://fleetlab.pages.dev/ with 59 lessons across several explicit model families. A separate City Explorer now provides sourced San Francisco road geometry, a recorded paired depot experiment, a vehicle replay studio, and a guided product entry. The explorer is integrated as an additional tab in the live FleetLab site; existing teaching sections remain available.

The SF experiment uses 100 homogeneous generic EVs (30 kWh initial energy and a 48 kWh charging target; nominal 60 kWh capacity bounds verifier energy but does not control runner charging/dispatch), 1,200 synthetic requests and an eight-hour shift, 07:00–15:00. It compares one fictional depot with two fictional depots at the same total charging and turnaround capacity. Twelve paired evaluation repeats use seeds 1001–1012; a seed fixes random inputs, rather than naming a distinct driving scenario. Five separate sensitivity cases retain adverse results. Geographic and operational qualification still limit the interpretation.

The replay explains full-shift trips, empty travel, depot queues, charging and turnaround. It offers four transparently selected vehicle stories plus the full list. Play loads the selected trace, and Replay restarts it at the end. Street names, zoom controls, red depot squares and traveled route geometry improve inspection. Operational events include the full horizon. Unsupported crash, remote-guidance and minimum-risk metrics remain unavailable. Revenue stays unavailable until a visitor enters all fare assumptions; it counts completed passenger service only and never claims an operator fare or profit estimate.

Across the twelve pairs, the two-depot candidate's diagnostic mean completion change is +1.111 percentage points (95% paired interval +0.701 to +1.549), below the predeclared +2-point practical threshold. Empty distance per completed trip falls about 11.001%; boarded-wait p90 falls about 29.408 seconds. These are synthetic model results with incomplete map qualification, not a recommendation for SF. Lower-demand sensitivity is adverse to the candidate; the low-energy case records two `no_reachable_depot` violations in each layout. It must not be described as a `reserve_breach` result.

The new start page gives visitors a three-step path: map coverage → controlled comparison → one vehicle's day. It frames different questions for Engineering, Product, Operations, Fleet Management, Sales and Depot Partnerships. It includes original vehicle illustrations and an interactive gallery separating the recorded generic EV from public Ojai and Zoox design references. The bidirectional sketch changes an illustrative heading; it does not simulate a maneuver.

## What improved in the map candidate

SF v2 supports bounded, exact multi-road turn-restriction sequences and stricter conditional/malformed-record accounting. Unsupported eligible length falls from 1.936% to 1.322%; primary roads fall from 10.944% to 1.461%. Trunk and living-street classes still exceed the unchanged 5% limit. The candidate restores 411 roads while newly blocking 201 records revealed by stricter parsing.

All captured source IDs are accounted for. Independent route validation, A*/Dijkstra comparisons, schema bounds and cross-file checks bind the displayed road geometry and qualification claims to the captured graph. The original SF v1 roads, graph, coverage and recorded evidence remain unchanged. Candidate fleet execution is explicitly blocked until restriction history across trip legs is qualified.

Three official district layers were compared; merely selecting the newer endpoint does not resolve the missing geometry. The candidate exposes 108 gap segments totaling 13.161 km, with map inspection and source links. Keep them UNASSIGNED until official reconciliation or a documented scope policy is adopted. Do not conceal gaps, relax thresholds or relabel old results as qualified.

## What the 100 vehicles teach — presentation narrative

Start with the whole fleet in Replay, then inspect one vehicle as an explanation.
For repeat 01 / seed 1001, the existing one-depot recording completes 627 trips;
the two-depot recording completes 629. Median trips are 4 and 4.5 respectively.
The fractional median is the midpoint of the two middle vehicles, not half a trip.
Empty travel is 42.7% versus 40.5% of total fleet distance. Depot queues consume
394.5 versus 394.0 combined vehicle-hours out of 800 (100 vehicles × 8 hours),
about 49.3% in either layout. At 15:00, 69 versus 68 vehicles are waiting for a
charging port. These are summaries of one recorded pair, not a city-wide finding.

The lesson is that location and resource availability must be examined together.
A vehicle with few completed trips can be waiting for a shared resource; its ID
is not a capability score. “All other states” on the time chart includes empty
travel, boarding, charging and turnaround, so it must not be called passenger
utilization. Use the notebook's complete paired results and sensitivities for
broader interpretation. Do not pool 100 interacting vehicles as 100 independent
experiment replicates.

Engineering should ask whether the result and resource ledger reproduce. Product
should compare completion, passenger waits and district outcomes. Operations and
Fleet Management should investigate queues and charging access. Depot Partnerships
should compare site location together with ports, power and service slots. Sales
should keep viewer-entered gross-fare assumptions separate from a revenue or
profit forecast. Safety, regulatory approval and physical deployment remain
outside this operational model's evidence.

## San Francisco completion checklist before another city

| Priority / work | Current boundary | Concrete next work and acceptance evidence |
|---|---|---|
| P0 — Route continuity | Candidate SF v2 restores some roads; recorded results still use SF v1. | Implement the reviewed cross-leg restriction-history contract only under the approved plan. Demonstrate forbidden turns stay forbidden across pickup, passenger and depot leg boundaries; exercise both route algorithms and independent route review. Never relabel old runs as v2. |
| P0 — Map semantics | Some conditional/ambiguous restrictions remain unsupported; trunk and living-street classes exceed the unchanged 5% threshold. | Resolve source-backed cases in the review queue with exact IDs and tests; retain unsupported classifications where source meaning remains ambiguous. Independent map reviewer records findings and residual limits. |
| P0 — District scope | 108 candidate gap segments / 13.161 km remain UNASSIGNED after comparison of official layers. | Obtain official reconciliation or decide and version an explicit geographic scope policy. Recalculate affected accounting without silently moving roads into districts. |
| P1 — Devices and accessibility | Automated viewport checks are available. Pixel 10 Pro XL is connected, but Android reports the device locked and screen captures are black; physical validation was not completed. See the release record. | Complete physical touch/zoom/select/playback checks, landscape and enlarged text, keyboard-only and screen-reader review. Record device/browser/steps, failures and evidence. A device screenshot is not participant comprehension evidence. |
| P1 — Visitor comprehension | No independent participant study has been completed. | Ask five visitors to explain seed versus scenario, 100 vehicle IDs versus 12 independent repeats, one-versus-two-depot resource controls, queue-hour denominator, and why synthetic results do not establish safety. Record misinterpretations and revise the flow. |
| P1 — Next controlled experiment | Power-study memory/execution amendment is a proposal; main evaluation is not performed. | Decide the amendment before execution. Preserve the frozen protocol, seed population and stop conditions; report all configurations and adverse results. Approval to publish this website is not approval to change the study protocol. |
| P1 — Operational calibration | Demand, dispatch, energy and generic turnaround are synthetic. | Identify a lawful measured input source or maintain explicit synthetic assumptions. Version charging curves, service times, request distribution and uncertainty before operational forecasts. No invented Waymo/Zoox parameters. |
| P2 — Fidelity chosen for a question | Road map and operational replay are not a driving-policy simulator or digital twin. | Use SUMO for interacting traffic, MetaDrive for bounded driving scenarios, MuJoCo for contact/actuators; qualify any adapter and inputs. 3D/world-model imagery can aid explanation but cannot establish physical validity. |
| Expansion gate | A source inventory is not comprehensive validated driving access. | Document an SF acceptance decision and residual risks, then choose one bounded municipality and one transferable experiment. Each new city needs source/license, routing, geographic scope and scenario validation. |

This release improves presentation of existing evidence. It neither closes map
qualification nor supplies the independent human evaluation or calibrated data.
The original site and offline teaching artifact remain part of the product.

## How to think about the next phases

| Phase | Decision to answer | Model and evidence needed before implementation |
|---|---|---|
| Finish SF | Which remaining map semantics materially affect depot/trip comparisons? | Resolve restriction exceptions, district scope, independent map inspection and history across trip legs; rerun versioned paired experiments. |
| Vehicle classes | Does a measured vehicle class change depot, service or shift outcomes? | Versioned energy/charging curves, boarding and accessibility dwell, service task times and dimensions. Generic, Ojai and Zoox cannot be assigned invented operator specifications. |
| Curb and depot maneuvers | Does direction flexibility change a pickup or circulation decision? | Site geometry, permitted maneuvers, heading/orientation model, dwell and exposure definitions. Use an appropriate traffic or motion model where the question depends on maneuvers. |
| More California cities | Which distinct municipality/service scope should be modeled next? | California is a state, not one city pack. Choose explicit city boundaries and scenarios before collecting data. Operator coverage, dataset coverage and FleetLab scope remain different concepts. |
| Austin | Can the city-pack and experiment contracts transfer? | Road/source audit, local access semantics, calibrated or explicitly synthetic demand, site assumptions and new paired runs. |
| Las Vegas | How do pickup locations and demand peaks affect service? | Define curb/pickup semantics separately before drawing conclusions from tourist or airport demand. No airport service is currently modeled. |
| Japan, beginning with a bounded Tokyo probe | Can Japanese road, ward, access and coordinate conventions be represented correctly? | Source/license checks, left-driving and local restriction semantics, ward-boundary audit and a small validation probe. Japan is not one city pack. |
| Other operator markets | Is there a decision worth testing in a specific city? | Recheck dated official market information, then select independently justified FleetLab geography and experiment scope. Operator availability does not grant data, depot knowledge or simulation validity. |

For tool selection, see the research note. GeoLibre is useful for optional GIS review; keep MapLibre for the lightweight browser. Use SUMO when traffic interaction is the question, MetaDrive for suitable driving-scenario experiments, and MuJoCo for contact/actuator questions. World-model imagery can support ideation, but visual realism is not experimental validity. None of these additions should substitute for qualifying the map or measuring vehicle/depot inputs.

## Prompt to give the next brainstorming partner

> Help develop FleetLab's next research and product phase. First distinguish implemented behavior, verified evidence, synthetic assumptions and unresolved gates using this handoff and linked project documents. Propose three bounded next experiments, each with a user/department decision, smallest sufficient simulator fidelity, required input data and rights, baseline/candidate change, paired-run design, success and harm thresholds, UI learning outcome and explicit stop conditions. Prioritize finishing SF before claiming comprehensive city coverage. Evaluate vehicle classes and bidirectional operation without inventing operator parameters or treating the current concept gallery as simulation. Recommend one experiment and explain which alternatives should wait. Do not publish, run paid services or connect to physical vehicles as part of brainstorming.

## Recommendation

Use the new entry and recorded SF replay for a clear, bounded presentation. Finish map qualification and one measured operational experiment before adding more city cards or pursuing visual fidelity for its own sake.

## Top risks + mitigations

Keep diagnostic simulations separate from operator prediction and safety authority. Keep candidate and recorded map identities separate. Close device and participant checks with actual observations, rather than treating viewport emulation as human validation. Publish only a reviewed compatible viewer/data bundle with verified route headers and a rehearsed rollback.

## Next 3 actions

1. Review the SF restriction and district-gap queues and settle the cross-leg routing contract.
2. Complete target-device/accessibility checks and a five-person comprehension session using the presenter guide.
3. Decide the power-study execution amendment and the smallest useful calibration input before adding another city.
