# FleetLab: a decision-centered product experience

Date: 2026-09-18. Baseline: `feat/fleetlab-playground` at `fb07b66`.
Status: authorized by the current request for a full local website redesign. Publication is excluded.

## Product decision

Lead with the operational question: **How do we get more vehicles ready for the next peak without moving the bottleneck elsewhere?**

The audience needs three levels of understanding: a 30-second explanation, a five-minute worked example, and a deeper inspection of model assumptions and paired experiments. The experience must support all three without asking a first-time visitor to learn the simulator's configuration grammar.

The core narrative is: rider demand creates work; vehicles accumulate service needs; depots have finite capacity; a policy changes where work goes; a controlled experiment shows trade-offs; a human decides what to test next. Simulation is a learning instrument, not proof of operational safety or an authorization system.

## Alternatives considered

| Direction | Benefit | Cost / limitation | Decision |
|---|---|---|---|
| Guided product studio with an interactive service-flow drawing | Explains decisions, then opens functioning experiments; works on phones and offline | Requires a distinct overview and workbench hierarchy | Select |
| Dense operations console as the entry | Fast for an experienced operator | Assumes context a first-time visitor does not have | Keep inside the studio |
| Cinematic 3D city / external simulator | Strong visual novelty | No additional answer to depot capacity, adds occlusion, assets and runtime complexity | Do not use for this question |

Blender is not installed in the inspected environment. More importantly, geometry fidelity is not the model fidelity this question lacks. Use code-native vector geometry to explain parking, cleaning, service and release. No model downloads or language model in the execution loop. Charging is a documented next model extension, not an animated claim of implemented physics.

## Information architecture

1. Overview: thesis, interactive depot anatomy, three decision pathways and scope.
2. Operations: the existing simulated day, region/depot inspection, temporal playback and state counts.
3. Depot experiments: an existing cleaning-capacity A/B, with the question and guardrails explained before configuration.
4. Product approach: users, hypotheses, measurable success, trade-offs, and a staged path toward a calibrated depot model.
5. Guided walkthrough: retain the existing reproducible four-chapter presenter, reachable with one clear action.

Navigation remains available when entering the workbench; returning to the overview pauses playback. Experiments do not start merely from navigation. A run uses the existing explicit run/freeze actions. Loading a decision pathway discloses that it loads an illustrative preset.

## First screen and visual system

- Warm white canvas, deep forest ink, restrained green accent, amber for constrained capacity.
- Strong editorial title, readable body text, generous separation, compact technical labels only when useful.
- A large axonometric service-flow schematic. It is an explanation, labeled as illustrative, never a snapshot of a run.
- Four keyboard-operable stages: arrive, clean, service, ready. Selecting a stage changes the explanation and highlights its part of the drawing. Counts in an illustration must not impersonate output metrics.
- The primary action opens the worked walkthrough. Secondary actions open a capacity experiment or the model approach.
- Show the teaching boundary once in a clear global strip; retain result-level limitations and exact measurement details.
- No autoplay, ambient audio, fake operational alerts, generic health score, or invented benefit percentages.
- Retain system/reduced-motion settings. Phone layouts stack by reading order. Focus rings and text labels do not depend on color.

## Workspace redesign

Restyle the existing workspace, including controls, map, playback, inspector, charts, experiments, tables and presentation layout. Name the surrounding workflow in operational terms while preserving metric names and verdict vocabulary. Use progressive disclosure for verbose map assumptions, with a short permanent map-scope caption and the complete original assumptions available on expansion.

The new shell receives a public app handle: store, playback, runWindow and present. It never reads files, evaluates a gate, recomputes a metric or creates its own simulator. Presets are loaded through `startFromPreset`; scenario and results remain owned by the existing store. Model, instrument, legacy, runtime and Python core are unchanged.

## Audience and decision mapping

| User | Decision | Current evidence | Next validation |
|---|---|---|---|
| Market operations lead | Where does capacity fall behind demand? | Region counts, unserved demand, rider wait, peak replay | Task-based comprehension and action selection with operators |
| Depot lead | Add bays, shorten a process, or change depot assignment? | Cleaning/service queues, depot choices, paired capacity experiments | Queue/service-time calibration, labor and charging constraints |
| Planning / infrastructure partner | What resources are needed before expansion? | Scenario authoring and controlled parameter changes | Demand envelope, state of charge, power limits, outages and site commissioning contracts |
| Product / engineering reviewer | Which recommendation is justified? | Paired seeds, metric populations, guardrails, deterministic replay | Validate surrogate assumptions and compare to held-out operational data |

## Truthful scope

Implemented: stylized four-area demand, road-class travel, congestion profiles, fleet supply, parking, cleaning/service queues, depot rules, recall/release, controlled paired experiments and replay.

Not implemented: charging, state of charge, grid limits, charging taper, labor shifts, calibrated travel, production feeds, operator task assignment, audited interventions, physical depot geometry, bring-up API and real-world deployment authority.

The current product is a **simulation-based fleet operations and depot experimentation prototype**. It is not yet a connected or calibrated digital twin, a mathematically optimal fleet planner, or evidence of direct ownership of a production fleet business.

## Acceptance

- The first screen states who it serves, the problem, the model boundary and the next action.
- Overview, product approach, operations and depot experiments all work without network services.
- Depot stage selection works with keyboard and touch and exposes its selected state.
- No simulation is run by the illustration, and no statistic is fabricated by the shell.
- Leaving the workspace pauses replay; experiment results keep their original provenance.
- Existing test suite, Python parity/boundary tests, packaging checks and lint pass.
- Verify source and packaged site in the browser at desktop and narrow-phone widths, including the walkthrough, a capacity experiment, assumptions disclosure and no page-wide overflow.
- Human usability results remain unavailable until people actually participate; heuristic review is not a usability study.

## Implementation sequence

1. Add the overview/depot illustration and product approach modules, using existing DOM helpers and static imports.
2. Mount a studio shell around the existing app. Keep standalone `start()` behavior for integration tests; the delivered entry explicitly enables the studio across source, offline and hosted builds.
3. Add the visual system to the existing stylesheet and refine map disclosure and presentation layout.
4. Verify meaningful navigation/provenance behaviors, run regression and package gates, inspect desktop and phone renders.
5. Write the comprehensive audit, roadmap, hiring-manager walkthrough and final local handoff with actual results.

## Decision log / instruction reconciliation

- The task starts in `Hermes-fleetlab` on a different branch. The requested branch already exists in the clean `Hermes-playground` worktree; changes belong there.
- The current request authorizes a redesign of the playground, not Phase 6 implementation or changes to its artifact review core. Historical Phase 6 freeze steps do not describe this task.
- Existing designs rejected a visual redesign and career framing; the current request explicitly changes the website design and its intended audience. Preserve product identity and factual boundaries. Keep personal/company facts out of the shipped app; document the role mapping in the local audit.
- Preserve the no-network, zero-dependency, escaped-text, deterministic-model and simulation-only boundaries. Do not publish, push or create a PR.
- Current authorization covers reversible local implementation and its design artifacts; no additional design-approval round is needed to do the requested work.
