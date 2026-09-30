# FleetLab City Explorer — presentation and next-phase guide

Prepared 2026-09-29. Scope: San Francisco City Explorer as an additional experience in the FleetLab website. This is an independent synthetic experiment, not a Waymo system or operator-performance forecast.

## Open the integrated presentation

Start at [FleetLab Overview](https://fleetlab.pages.dev/). The concept film, Fleet day, Street lab, Scale lab and Learning catalog are retained. Explain: “FleetLab offers quick interactive teaching models and a deeper recorded city study.” Then choose **City Explorer**, or use the San Francisco card. Inside [City Explorer](https://fleetlab.pages.dev/city-explorer/#welcome): “FleetLab helps us choose the next operational
experiment. First inspect the map, then compare a controlled change, then explain one vehicle's
day.” The three cards lead into that sequence. The central comparison keeps the same 100 EVs
and total resources while changing depot locations.

The vehicle gallery introduces a future question, not a configuration already used in the
recorded runs. “Ojai and Zoox suggest different passenger, service and maneuver questions.
We would need measured inputs and the right model before estimating their effect.” The Zoox
direction sketch illustrates orientation only. It does not demonstrate a bidirectional maneuver.

In the atlas, distinguish **recorded SF v1** from **candidate SF v2**. The candidate improves
restriction support and exposes district gaps for review. Replay and notebook results still
come from v1. Do not introduce the candidate as a newly qualified simulation map.

The FleetLab brand and **Back to FleetLab** return to Overview. **Start here** stays inside the City Explorer. The separate catalog entry clearly identifies the recorded city case rather than adding it to the 59 runnable lessons. On mobile or tablet, open **Explore** to find City Explorer.

## A two-minute demonstration

1. **City atlas:** “We have a sourced San Francisco road network, with explicit routing gaps. Zoom into street names; the red squares are fictional depots.” Select A versus A + B. Source roads, supported routing, and the experiment’s scenario points answer different coverage questions.
2. **Decision notebook:** “Would distributing the same charging and turnaround resources across two sites help this synthetic fleet?” Baseline A has 8 ports, 200 kW and 4 turnaround slots. Candidate A + B has 4 + 4 ports, 100 + 100 kW and 2 + 2 slots. Every pair uses identical requests and initial vehicle states; only depot configuration changes. Read all twelve repeats and the five separate sensitivity cases.
3. **Replay studio:** “This is an eight-hour working day, 07:00–15:00, not a fifteen-minute trip.” Start with EV-001, repeat 01. Play or seek to its charging queue. The shift timeline explains how the day is divided. Switch configurations while preserving the vehicle ID.
4. **Trip summary:** completed pickup-and-drop-off trips, miles, empty-mile share, depot arrivals and service counts describe the entire recorded shift. Fare inputs are explicit visitor assumptions. Safety metrics remain unavailable because the model does not measure them.
5. Close with the next decision: “Which data or model qualification would let us test this operational hypothesis more credibly?”

## Seeds, pairs, and scenarios

A **random seed** fixes the pseudo-random inputs used to generate synthetic arrivals and vehicle starting positions. It is common simulation terminology, not a taxonomy of autonomous-driving scenarios. FleetLab seeds 1001–1012 identify twelve repeats of the same experiment. Changing a seed samples another set of inputs; it does not mean changing from a pedestrian scenario to a collision-avoidance scenario.

An **experiment pair** is two runs with one shared input tape: baseline one-depot configuration versus candidate two-depot configuration. Pairing helps distinguish a depot effect from differences in which requests happened to arrive. A single pair is a diagnostic example; the aggregate paired analysis and adverse sensitivity cases matter for the overall conclusion. The selected model remains FleetLab’s graph/resource simulator, not SUMO or a driving-policy simulator.

Official background: [SUMO randomness and reproducibility](https://eclipse.dev/sumo/docs/Simulation/Randomness.html).

## Why 100 vehicles? How are they different?

All 100 vehicles use the same generic energy and linear-consumption assumptions: 30 kWh initially, charging toward a 48 kWh target in the main study. The specification carries a nominal 60 kWh capacity field, but the current engine does not use that field to model battery capacity. Vehicle IDs identify individual resource histories, not different car brands, autonomy systems or hardware variants. Their starting positions and dispatch assignments differ, so their trips, energy and queues differ.

The viewer offers reproducible inspection choices: first ID, most completed trips, longest total queue, and middle vehicle ranked by completed trips. Ties use vehicle ID; duplicates are removed. The same rule is used in each configuration. These are examples for investigation, not representative claims about every vehicle. “Browse all 100 EVs” retains full access without requiring a first-time visitor to choose blindly. Keep a vehicle ID selected across configurations to compare its paired histories; the suggested IDs themselves can differ by configuration.

## EV-001, repeat 01 (seed 1001): why it stays at the depot

**Baseline, one depot:** EV-001 starts turnaround at depot **A** at **09:30:29** and ends it at **09:36:29**, also at **A**. It then waits for charging until **14:32:34**. At the 15:00 horizon it is still charging, at approximately 30.455 kWh. The model’s charging target is 48 kWh, so it has not returned to dispatch. It completed four passenger trips earlier in the shift.

**Candidate, two depots:** turnaround occurs at **A**, 09:30:03–09:36:03. The vehicle remains queued for charging at A until the recording ends at 15:00. Adding a second location does not give this vehicle access to a free port at its chosen depot: per-site resources are split, and the simulator does not reposition queued vehicles dynamically between depots.

For these inspected traces, the turnaround did **not** start at A and finish at B. The prior display exposed only six recent events and omitted state transitions, concealing the queue and making the history misleading. The enhanced view retains all operational/state events and the terminal run-end event. Energy checkpoints and charging-power allocation records remain in the source bundle; their totals are projected into the summary rather than flooding the human-readable event list.

The long wait is a result of the declared capacity and charging policy. It warrants a follow-up experiment on charging targets, return policy, queues and resource placement; it is not a claim about real fleets.

## Read each requested metric correctly

| Metric | Population / meaning | Boundary |
|---|---|---|
| Completed trips (PUDO) | Requests with both recorded pickup and completed drop-off | Pickups, drop-offs and unfinished assigned/aboard requests shown separately |
| Total miles | All vehicle travel through the recording horizon | Includes partial unfinished legs; converted from exact stored meters |
| Estimated trip revenue | Completed trips × entered base fare + their passenger miles × entered mileage fare + their passenger minutes × entered time fare | Unavailable until all three nonnegative rates are entered; hypothetical USD gross fares, not profit or calibrated operator revenue |
| Depot arrivals / unique depots | Completed return legs / distinct fictional sites visited | A service change is not another visit |
| Charging / turnaround | Sessions started and completed, separately | Generic turnaround does not assert cleaning, repair or software work |
| Empty / deadhead miles | Miles without passengers divided by all vehicle miles | Includes travel to pickups and depots; unavailable for a zero-mile denominator |
| Any-injury crash rate / MM | Not modeled | No collision model, suitable injury records or validated exposure |
| Remote guidance frequency / MM | Not modeled | No remote-guidance event model |
| Minimum risk maneuvers | Not modeled | No driving policy or MRM taxonomy in this simulator |
| Safety & regulatory gate | Not evaluated | Simulation only; no deployment permission |

MM means one million vehicle miles. Missing metrics must never be displayed as zero. Internal consistency, authenticity, authorization and deployment permission remain separate. A richer renderer does not turn this resource model into a safety simulator.

## What each team should take away

- **Engineering:** input pairing, reproducibility and independently checked resource/event ledgers make failures inspectable. Source-map semantics and routing gaps still limit interpretation.
- **Product:** completion and passenger wait need to be read together, across repeats and neighborhoods. A better average can coexist with worse local outcomes.
- **Operations:** stationary vehicles may be waiting for scarce resources. The timeline makes queue duration visible and suggests a targeted queue/charging policy experiment.
- **Fleet management:** availability depends on where energy and service capacity are accessible. Identical fleet hardware does not produce identical vehicle histories.
- **Sales:** visitors can explore fare assumptions transparently. This is not proof of market demand, net economics or contracted revenue.
- **Depot partnerships:** site location, ports, power and service slots interact. Reduced empty miles alone do not establish site feasibility; actual demand, access, power and commercial terms remain inputs for later work.

## Presenting the charging-power study

**Current availability:** this study has no evaluation results and is not included in the current review viewer. The original 24-arm preflight passed, but evaluation stopped before its first arm at the memory limit. A reviewed lifetime correction and named-revision proposal await the owner's decision. The following is the planned presentation framework, not a report of completed findings.

Start with the question: **“Does spreading resources across two depots help differently when charging power is scarce?”** There are six configurations: A, A+B and B, each at 200 and 400 kW total power. All have eight charging ports and four turnaround slots; the two-depot layout splits those resources equally. Fleet, demand, initial energy, charge target, map and dispatch policy stay fixed. B-only checks the importance of location and remains a secondary comparison.

Each of the 24 new evaluation repeats uses one shared input tape across all six configurations. Explain the primary in two steps: first measure the A+B versus A completion difference at each power level, then compare those two differences. That interaction asks whether power changes the layout effect. It is not simply the improvement from doubling power, and it does not choose whichever reference depot gives the best result.

The 95% paired interval is compared with the predeclared ±1 percentage-point practical band. An interval entirely above +1 or below −1 is materially positive or negative under this model; entirely inside the band is bounded small; other intervals remain unresolved. Excluding zero is reported separately. Map, model and calibration errors are outside that interval. Invalid or missing runs make the primary unavailable; no repeat is silently dropped.

Follow the result into fleet time and site queues: passenger service, empty travel, charging, turnaround and the two kinds of queues. “Available capacity minus delivered energy” is a whole-shift accounting quantity; it does not prove that a particular queued vehicle could have used that power. Wait among boarded passengers is conditional on who boarded, so read it beside completion and unfinished-request counts. Include UNASSIGNED district outcomes.

In a completed package, browser replay will be limited to all six configurations of the **first evaluation repeat declared by that exact frozen protocol**. Original v1 reserved seed 7302001 but produced no evaluation recording. A named revision must declare its own identity and schedule before execution. The completed package must include all 144 arm summaries, with full raw traces retained locally. One replay explains a mechanism; it does not represent the whole statistical result.

## Dated copy corrections — 29 September 2026

The lower-initial-energy sensitivity records two `no_reachable_depot` violations per arm. Earlier viewer wording incorrectly called these reserve violations. Corrected copy names the recorded failure; it does not change the run or verifier. The lower-demand sensitivity is one repeat with a −1.5 percentage-point completion difference, not a general conclusion about lower demand.

The unused nominal-capacity field is now distinguished from recorded energy and the charging target. Historical scientific bundles are preserved. Cross-leg restriction-history limitations apply to the recorded v1 model as well as the reason candidate v2 fleet execution remains blocked.

## Maps and GeoLibre

The enhanced viewer provides vector zoom through level 20, visible zoom buttons, pan/pinch interaction, local street-name rendering and road inspection. Replay shows traveled road geometry and a held vehicle position at 15-second samples; it does not invent continuous recorded motion. Only the selected layout’s active depots appear in replay. The flat renderer is an explicit alternative and automatic fallback after a graphics-context loss.

Closer zoom improves inspection, not source positional accuracy or legal access. This pack contains roads and administrative geometry, not buildings, lane-level geometry, aerial imagery, terrain or live traffic. No Google Maps imagery is copied or scraped.

[GeoLibre](https://github.com/opengeos/GeoLibre) is an MIT-licensed GIS application using MapLibre, React, Tauri and spatial-data tools. **Assessment:** it could serve as a separate authoring/inspection workbench, especially when reviewing additional GIS datasets. It is not necessary as the runtime for this focused viewer, which already uses MapLibre. Replacing the viewer would not by itself add accurate roads, lane geometry or a better simulator. No GeoLibre dependency was adopted in this pass.

## What still blocks stronger conclusions

- Recorded SF v1 remains above the frozen 5% per-class limits in primary, trunk and living-street classes. Candidate SF v2 reduces primary unsupported length to 1.461%; trunk and living-street gates remain open. The candidate is blocked from fleet execution pending restriction history across trip legs. See `FLEETLAB_SF_MAP_RESEARCH_V3.md` for the current source queue.
- Roads outside trimmed official district polygons remain explicitly UNASSIGNED; select a documented boundary policy before neighborhood claims.
- Independent semantic map review and a five-person usability study are distinct from automated checks. Neither may be inferred from a successful build or a single device test.
- Prior legacy timing failures are a separate regression concern. Preventing sleep helps uninterrupted execution; it does not eliminate CPU contention or establish that timing checks pass.
- More realistic 3D vehicles and environments are a separate fidelity choice. MetaDrive is relevant to traffic/driving-policy experiments; MuJoCo is relevant to contact/actuator mechanics. Neither is required to answer the current depot resource question. Qualify SF and its evidence before expanding cities or claiming full driving simulation.

## Recommendation

Use this version to review the SF experiment’s readability and operational logic. Keep the recommendation gate open until map qualification is resolved. Treat the next experiment as charging/depot policy investigation, preserving shared inputs and declared parameters.

## Top risks and mitigations

1. **Visual polish mistaken for validation:** retain visible model/source limits and separate trust states.
2. **A memorable vehicle mistaken for the whole fleet:** expose selection rules, all vehicles, all twelve pairs and adverse stress cases.
3. **Uncalibrated economics or safety claims:** explicit fare assumptions; unavailable safety metrics; no operator or road-readiness claims.

## Next three actions

1. Review EV-001’s charging wait and the paired lesson table with operational stakeholders; define the next falsifiable policy question.
2. Finish SF restriction and district qualification using documented independent map review.
3. Run the device/accessibility and human-comprehension checklist in the validation record before a presentation or broader release.

## All twelve repeats: presentation notes

Same 1,200 created requests per run. Wait is p90 among boarded passengers; empty miles are normalized per completed trip. Deltas are candidate minus baseline. These observations are diagnostic; they are not twelve independent recommendations.

| Repeat (seed) | Completed, A → A+B | Empty mi / completed trip Δ | Wait p90 Δ (s) | What to discuss |
|---|---:|---:|---:|---|
| 01 (1001) | 627 → 629 | -0.288 | -35.4 | 2 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 02 (1002) | 594 → 601 | -0.563 | -53.4 | 7 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 03 (1003) | 612 → 640 | -0.346 | -70.2 | 28 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 04 (1004) | 611 → 637 | -0.305 | -26.6 | 26 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 05 (1005) | 632 → 639 | -0.499 | -36.4 | 7 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 06 (1006) | 617 → 641 | -0.519 | -86.4 | 24 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 07 (1007) | 619 → 628 | -0.250 | -13.4 | 9 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 08 (1008) | 594 → 602 | -0.607 | -55.6 | 8 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 09 (1009) | 601 → 616 | -0.518 | +30.8 | 15 more trips; longer wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 10 (1010) | 598 → 599 | -0.459 | -23.2 | 1 more trip; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 11 (1011) | 627 → 643 | -0.481 | +22.4 | 16 more trips; longer wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |
| 12 (1012) | 609 → 626 | -0.459 | -5.5 | 17 more trips; shorter wait. Less empty travel per completion; inspect queue distribution and zone outcomes. |

## Fleet-wide reading before one vehicle — September 29 enhancement

In Replay, begin with “100 vehicles. One shared system.” The ID identifies a
vehicle in the same generic operational model, not a hardware type or a driving
policy. The aggregate includes every vehicle, including any with zero completed
trips. Changing a vehicle keeps the same whole-fleet totals; changing the repeat
or configuration changes the population being summarized.

For seed 1001: one depot completes 627 trips; two depots complete 629. Empty-mile
share falls from 42.7% to 40.5%, while depot queues still consume about 49.3% of
800 combined vehicle-hours. That is the prompt to investigate resource queues,
not proof that a depot plan is right for San Francisco. The median can be 4.5
because it averages the two middle trip counts in an even population. Inspect a
queue-heavy vehicle to explain the fleet pattern, then use the full notebook's
12 paired repeats and five separate sensitivities before generalizing.

Do not call the non-queued time “productive time”: it includes charging,
turnaround, empty driving, boarding and availability. Do not use 100 interacting
vehicles as 100 independent experiment samples. Revenue remains unavailable
until the visitor supplies all three fare assumptions. Owner contact appears in
the hosted FleetLab footer as a native email link; no form or data collection is
added.
