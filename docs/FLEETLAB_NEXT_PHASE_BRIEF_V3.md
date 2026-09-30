# FleetLab — handoff for the next product and simulation brainstorm

Prepared 29 September 2026. Read this together with `FLEETLAB_CITY_PRESENTER_GUIDE.md`, `FLEETLAB_SF_MAP_RESEARCH_V3.md`, `FLEETLAB_VEHICLE_CONCEPTS.md` and `FLEETLAB_CITY_LAUNCH_PREPARATION.md`. This is a project record and proposal input, not permission to publish or change experimental contracts.

## What exists now

FleetLab has a public legacy teaching site at https://fleetlab.pages.dev/ with 59 lessons across several explicit model families. A separate City Explorer now provides sourced San Francisco road geometry, a recorded paired depot experiment, a vehicle replay studio, and a guided product entry. The new explorer is a local review build; its live-site integration is staged separately.

The SF experiment uses 100 homogeneous generic 60 kWh EVs, 1,200 synthetic requests and an eight-hour shift, 07:00–15:00. It compares one fictional depot with two fictional depots at the same total charging and turnaround capacity. Twelve paired evaluation repeats use seeds 1001–1012; a seed fixes random inputs, rather than naming a distinct driving scenario. Five separate sensitivity cases retain adverse results. Geographic and operational qualification still limit the interpretation.

The replay explains full-shift trips, empty travel, depot queues, charging and turnaround. It offers four transparently selected vehicle stories plus the full list. Play loads the selected trace, and Replay restarts it at the end. Street names, zoom controls, red depot squares and traveled route geometry improve inspection. Operational events include the full horizon. Unsupported crash, remote-guidance and minimum-risk metrics remain unavailable. Revenue stays unavailable until a visitor enters all fare assumptions; it counts completed passenger service only and never claims an operator fare or profit estimate.

Across the twelve pairs, the two-depot candidate's diagnostic mean completion change is +1.111 percentage points (95% paired interval +0.701 to +1.549), below the predeclared +2-point practical threshold. Empty distance per completed trip falls about 11.001%; boarded-wait p90 falls about 29.408 seconds. These are synthetic model results with incomplete map qualification, not a recommendation for SF. Lower-demand sensitivity is adverse to the candidate; the low-energy case breaches the reserve rule in both layouts.

The new start page gives visitors a three-step path: map coverage → controlled comparison → one vehicle's day. It frames different questions for Engineering, Product, Operations, Fleet Management, Sales and Depot Partnerships. It includes original vehicle illustrations and an interactive gallery separating the recorded generic EV from public Ojai and Zoox design references. The bidirectional sketch changes an illustrative heading; it does not simulate a maneuver.

## What improved in the map candidate

SF v2 supports bounded, exact multi-road turn-restriction sequences and stricter conditional/malformed-record accounting. Unsupported eligible length falls from 1.936% to 1.322%; primary roads fall from 10.944% to 1.461%. Trunk and living-street classes still exceed the unchanged 5% limit. The candidate restores 411 roads while newly blocking 201 records revealed by stricter parsing.

All captured source IDs are accounted for. Independent route validation, A*/Dijkstra comparisons, schema bounds and cross-file checks bind the displayed road geometry and qualification claims to the captured graph. The original SF v1 roads, graph, coverage and recorded evidence remain unchanged. Candidate fleet execution is explicitly blocked until restriction history across trip legs is qualified.

Three official district layers were compared; merely selecting the newer endpoint does not resolve the missing geometry. The candidate exposes 108 gap segments totaling 13.161 km, with map inspection and source links. Keep them UNASSIGNED until official reconciliation or a documented scope policy is adopted. Do not conceal gaps, relax thresholds or relabel old results as qualified.

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
3. Review the concrete launch stage, header/navigation diffs and rollback; choose the next bounded simulation experiment.
