# FleetLab SF vehicle design learning module

29 September 2026. This module is an educational gallery for a city explorer, not a change to the SF experiment or recorded evidence. It helps Engineering, Product, Operations, Fleet Management, Sales and Depot Partnerships ask what a vehicle-class experiment would require. The question determines the simulator fidelity.

## What the current experiment contains

The checked-in `apps/fleetlab-city/experiments/sf-depots-v1.json` specifies `fleet_size: 100`, `capacity_kwh: 60.0`, and model `fleetlab.graph-resource/1.0.0`. Both depot arms use the same homogeneous generic EV assumptions. Recorded vehicle replay is graph/resource behavior and held position samples, without an operator-specific vehicle, physical dynamics, four wheel steering, curb interaction, occupied reversal or a driving policy. The gallery never relabels a recorded generic EV as an Ojai or Zoox vehicle.

## Public design references, and what they do not establish

| Reference | Sourced product description | FleetLab use | Absent from FleetLab evidence |
|---|---|---|---|
| [Waymo, “Welcoming our first riders trips in the Ojai”](https://community.waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/) (28 May 2026) | Waymo describes elevator-like doors, a low step, flat floor, rider controls, accessibility features, and charging conveniences. | Prompts questions about boarding and accessibility dwell, rider experience and depot service. The artwork is an original concept illustration, not Ojai hardware. | Dimensions, energy capacity, charging curve, operator task times, route capability, safety outcomes. No bidirectional design is attributed to Ojai. |
| [Zoox, “Know Your Ride”](https://zoox.com/know-your-ride) (accessed 29 Sep 2026; page has no displayed publication date) | Zoox describes a no-fixed-front/back bidirectional design, four wheel steering, automatic doors and curbside pickup intent. | Prompts questions about pickup orientation, curb placement, depot circulation and what a maneuver model must represent. The artwork and heading switch are conceptual illustrations. | Vehicle dimensions, maneuver envelope, permitted road access, direction-specific time or energy, pickup effectiveness, safety outcomes. |

The source pages describe each company's products; they do not supply calibrated inputs or validation for the FleetLab SF model. No logos or third-party imagery are embedded. Source links open only when a visitor chooses them; the module makes no provider request to render.

## Candidate experiment after data collection

First choose one decision: for example, whether a measured vehicle class changes the relative outcome of the one-depot and two-depot options. Preserve the same road pack, demand seeds, service rules and total resource budget in paired runs. Add versioned vehicle-class inputs only when they are obtained and validated: usable energy and consumption distributions, charging curve and connector/site compatibility, boarding and accessible pickup dwell distributions, turnaround tasks, physical dimensions, and service constraints. Report completed service, wait, empty travel, depot queue, energy and per-zone effects with the existing qualification gates.

Bidirectional capability poses a different question. If the decision depends only on a measured difference in pickup or depot dwell, a graph/resource model with a calibrated service-time distribution may suffice. If it depends on heading, curb access, turns, reversing or four wheel steering, a qualified traffic or motion model and site-level geometry are necessary. Establish legal access and operational permission separately. Any schematic heading switch in the web module is reversible display state only; it has no simulation output, no vehicle command and no road authorization.

## Acceptance boundary

- The current baseline always reads “100 generic 60 kWh EVs” and keeps existing replay identities.
- Source traits appear as sourced references; proposed inputs and impacts appear as questions or requirements.
- The direction sketch explicitly separates fixed orientation from changed travel heading and labels itself an illustration.
- The module has no network dependencies, data mutation, telemetry, driving interface or connection to simulation execution.
- A vehicle-class result must not be presented as measured until inputs, model fidelity, validation, reproducibility and qualification are documented.

No public release or operator-specific vehicle performance claim follows from this module.
