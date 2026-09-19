# FleetLab product, simulation and website design audit

Date: 2026-09-18. Audited branch: `feat/fleetlab-playground`, starting at `fb07b66`.

## Executive assessment

FleetLab is a credible **simulation-based fleet operations and depot experimentation prototype**. Its strongest feature is the connection between a local decision, a system-wide consequence, and an explicit next-test recommendation. Its weakest feature was the entry experience: the interface demanded knowledge of the model before explaining why an operator or product leader would use it.

For the supplied Fleet Operations tooling role, the project demonstrates operational problem framing, metrics, inspection workflows and analytical reasoning. It does not establish operator discovery, production tooling adoption, stakeholder execution or real market performance.

For the Fleet Optimization role, it demonstrates finite resources, depot queues, assignment alternatives, blocking and downstream effects. It does not yet demonstrate charging optimization, labor planning, an optimization solver, a calibrated digital twin, infrastructure economics or a depot bring-up API.

The right investment order is comprehension, metric clarity, experimental coverage, shared-resource fidelity, then integration. A more photorealistic city would not close those gaps. The redesign implemented during this audit makes the existing product legible while leaving the simulator and its experiment rules unchanged.

## Scope and evidence

- Read the requested source tree in its existing clean worktree. The task initially opened a different checkout on `feat/phase9-metric-contract` at `9daacef`; no changes were made there.
- Inspected the deployed site supplied by the owner in a browser, including the first screen and guided entry. A search fetch could not retrieve the site, but direct browser inspection succeeded.
- Reviewed the model, instrument, UI, runtime boundary, packaging, tests and historical design. An independent code reviewer checked simulation semantics and the redesign.
- Ran the JavaScript baseline: 1,475 passing, no failures, two skipped, one TODO. Ran Python parity/boundary checks: 89 passing. Final validation is recorded in the accompanying handoff.
- Researched public operator/partner material, simulation tools and interaction-design guidance. Public information is a source of design questions, not knowledge of an employer's internal systems.
- This is a source review and heuristic interface audit. No operator interviews, hiring-manager study, screen-reader session with a participant, adoption study or controlled usability experiment was conducted. Descriptions of visitor confusion are reasoned risks supported by the screen, not observed participant behavior.

## 1. Source-tree audit

### Architecture worth preserving

| Layer | Responsibility | Assessment |
|---|---|---|
| `src/core` | Keyed random draws, canonicalization, rounding, hashing, statistics | Supports reproducibility and numerical parity |
| `src/instrument` | Paired deltas, bootstrap interval, primary outcome, guardrails and recommendation | Explicit decision machinery; preserve its semantics |
| `src/model` | Fleet world, resource queues, policy alternatives, metrics, invariant checks, experiment execution | Appropriate low-cost fidelity for teaching operational trade-offs |
| `src/runtime` | Worker execution with a time-sliced fallback | Keeps computation separate from interaction |
| `src/ui` | Store, playback, map projection, charts, experiment view, inspector and presenter | Substantial working functionality; needed a clearer information hierarchy |
| `tools` | Offline and hosted packaging, CSP and content checks | Valuable self-contained demonstration and controlled dependency surface |
| Python Hermes core | Evidence-path implementation and parity reference | A distinct product boundary, not interchangeable with playground output |

There is no requirement to replace this stack with a framework to improve the design. Its zero-dependency, no-network distribution is useful for an interview and for repeatable evaluation. The redesign adds a presentation shell and conceptual SVG drawing, not a second model or a second gate.

### What the model actually does

The discrete-event model represents four stylized areas, two route classes per area pair, configured traffic factors, rider demand, vehicle supply, dispatch, finite depot parking, cleaning and service queues, depot assignment and diversion, recall, and morning release. It can replay a run and compare a declared parameter or policy change across paired seeds.

Ready vehicles at a depot can be dispatched. Morning release repositions eligible ready vehicles to their home area; it is not a universal permission gate for dispatch. A visual flow diagram must not imply that all ready vehicles are immobilized until release.

The scenario model explicitly defers charging, staff, operating hours, inspection, quality checks and launch constraints. A drawing of a roof or parking stall does not add physical geometry to the simulation.

Key source anchors: `src/model/schema.js:238`, `src/model/engine.js:454`, `src/model/engine.js:570`, `src/model/engine.js:630`, `src/model/policies.js:92`. These paths are relative to `playground/fleetlab/` throughout the audit.

### Findings and disposition

| Priority | Finding | Consequence | Disposition |
|---|---|---|---|
| P1 | Recommendation copy said no guardrail was harmed although unavailable guardrails are skipped by the inherited instrument | Could imply a stronger conclusion than the evaluated evidence permits | Fixed to say no **evaluated** guardrail exceeded its limit; existing unavailable notice retained |
| P1 | Presenter said the run “trades nothing” whenever no guardrail crossed its allowance | Smaller regressions and unmeasured harms can still exist | Fixed; directs the reader to deltas and unavailable results |
| P1 | Replication seeds vary travel/ride factors, while request arrivals and destinations are keyed by scenario name | Confidence intervals are conditional on one synthetic demand trace; changing the seed set does not sample different demand days | Disclosed in the redesigned entry and product approach; demand replication remains model work |
| P2 | Bay wait measures intake-to-first-task delay for visits that start a task | It omits the later service queue and never-started visits; not a complete depot-delay metric | Explain alongside turnaround and unfinished visits; add stage-level metrics next |
| P2 | Area-scoped available fraction divides area available vehicle-seconds by total fleet vehicle-seconds | A percentage can change when fleet size changes elsewhere | State the denominator in analysis; do not call it an area readiness rate |
| P2 | Rider patience expires before assignment; assigned riders wait for pickup | Wait is not a complete cancellation/SLA model | Keep completed population and unserved demand alongside wait |
| P2 | Full turnaround is unavailable if any scoped visit is unfinished | Honest handling of censoring can frustrate a visitor who expects one number | Preserve absence, explain the unfinished population, do not replace it with zero |
| P2 | Fixed service times and omitted labor/energy simplify depot resources substantially | Cannot support charging infrastructure or staffing claims | Explicit next-fidelity roadmap |
| P2 | Single-axis comparisons and heuristic policies are not a solver | No global optimum, feasible optimum or optimality gap is computed | Describe evaluation of alternatives; use “optimization” for the problem domain, not a claimed algorithmic result |

Source anchors: `src/instrument/paired.js:117`, `src/instrument/guardrails.js:19`, `src/model/world.js:152` and `:215`, `src/model/metrics.js:216`, `:232`, `:274`, `:282`, `src/model/experiment.js:194` and `:461`.

### Experimental adequacy

The experiment architecture has valuable controls: a frozen specification, common inputs between arms, paired deltas, declared equivalence margin, bootstrap uncertainty and non-compensatory guardrails. Independent reconstruction of capacity/conservation from vehicle states is stronger than relying on engine counters alone. Instrument vectors are tested against Python outputs.

However, reproducibility is not calibration. The confidence interval quantifies only modeled variation under the stated inputs. A large number of replications cannot recover omitted demand variability, missing queues, energy constraints or incorrect service-time distributions.

Next measurement contract:

| Quantity | Required population / denominator | Additional context |
|---|---|---|
| Rider wait | Completed pickups/rides as defined by the metric | Unserved, assigned-but-unfinished, request cohort and time window |
| Arrival-to-first-task delay | Visits that started a task | Never-started and censored visits |
| Cleaning/service queue delay | Visits entering each specific stage | Stage capacity, start/completion count and censoring |
| Depot throughput | Service-complete departures per explicit interval | Starting WIP, ending WIP, operating minutes and resource availability |
| Fleet readiness | Define ready-for-dispatch state and fleet denominator | Area, time and energy/readiness rules included in the definition |
| Energy readiness, proposed | Vehicles meeting declared charge target by departure deadline | Missed departures, charger failures, power cap and unmet energy |

Do not relabel an existing quantity with a broader name. New populations require new metric contracts and fixtures.

## 2. Website audit

### First impression and comprehension

The original first screen opened directly into “KNOBS,” Sandbox, Experiment and Present. It showed an isometric network before a business question, with several “not available” placeholders and long technical caveats. That is usable for the author who knows the controls, but it imposes substantial inference on an unfamiliar visitor.

The hierarchy was inverted: model grammar appeared before user intent; the diagram appeared before its meaning; absent metrics appeared before a run; and methodological detail appeared before the decision it supported. The system's rigor was visible, but its user value was not.

### Interface findings

| Priority | Observed design issue | Visitor risk | Redesign response |
|---|---|---|---|
| P1 | No explicit user/problem statement before controls | Visitor cannot describe what the tool helps decide | Operational thesis and three decision pathways |
| P1 | Empty state dominates the first screen | Looks unfinished before the demonstration starts | A complete overview that does not pretend results exist |
| P1 | Dense vocabulary: knobs, window, registers, axes, seeds | Visitor must learn implementation language | Scenario setup plus plain-language workspace introductions |
| P1 | No clear bridge from the project to product work | A reviewer may see coding depth without product judgment | Product approach page: users, hypothesis, evaluation and roadmap |
| P2 | Abstract regional/depot geometry is unexplained | Isometric shapes can be mistaken for physical fidelity | Separate conceptual depot anatomy and clear map-scope caption |
| P2 | Similar weight for primary action and many secondary controls | Unclear starting point | One guided-entry action, then progressive exploration |
| P2 | Long map caveats compete with the picture | Important meaning is lost in a wall of text | Short permanent caption plus expandable full assumptions |
| P2 | Experiment form is a long unstructured native-control stack | Setup feels technical and difficult to scan | Spaced sections, wider fields, desktop grid and phone disclosures |
| P2 | Replay and experiment output can be confused | One seed may be treated as the conclusion | Preserve “THIS REPLAY” and “ACROSS REPLICATIONS,” exact details and frozen-spec provenance |
| P2 | Small typography and color differences can hide limitations | Caveats become decorative | Improved contrast, readable labels, keyboard stage controls and retained text statuses |
| P2 | Mobile presenting layout was acknowledged as unfinished | A shared link may be unusable on the first device a reviewer uses | Responsive overview, approach, experiment and presenter checks |
| P2 | Navigation can overwrite a draft | Exploration invalidates work unexpectedly | Initialize capacity example once; make reset an explicit action |

### Implemented design

The new overview starts with “A better day starts at the depot” and an operational question: get vehicles ready for the next peak without moving the bottleneck elsewhere. The adjacent diagram explains arrival, cleaning, service and readiness. It is intentionally static until a reader selects a stage; its vehicles are illustrative, not outputs.

The four primary destinations are Overview, Fleet operations, Depot experiments and Product approach. The existing guided presenter remains the working demonstration. The capacity path loads the existing four-versus-six-bay scenario on first entry; subsequent navigation preserves current work.

The visual language uses a warm light background, forest green text and restrained resource colors. The workbench, tables, forms, charts and presenter share this language. The packed offline and hosted entry points both enable the same studio, rather than shipping a new landing page with an old tool behind it.

### Accessibility and responsiveness

Keep keyboard focus visible on controls, selected stage state exposed through `aria-pressed`, headings descriptive, and result statuses readable without color. Model assumptions remain available through a native disclosure. The illustration has an accessible description; the stage explanation has a status role. There is no autoplay, decorative spinning city or audio that starts without the visitor's action.

The workbench retains reduced-motion controls, tables for chart/map content, keyboard playback, invalid-result handling and exact metric detail. A source scan alone is not sufficient accessibility evidence; browser checks complement the regression suite. Human assistive-technology testing remains future validation.

## 3. Research synthesis

Research checked on 2026-09-18. The implications below are design judgments, not claims that the prototype implements these products.

| Primary/public source | Relevant observation | Implication for FleetLab |
|---|---|---|
| [Waymo's partner overview](https://www.waymo.com/about/) and [Moove's partnership announcement](https://www.prnewswire.com/news-releases/moove-partners-with-waymo-to-redefine-the-future-of-urban-mobility-302323196.html) | Fleet operations include partner responsibilities beyond driving; the announcement covers fleet operations and infrastructure | Show resource ownership and handoffs in a future operator workflow; avoid attributing internal workflows to Waymo |
| [HIVE fleet simulation framework](https://www.nrel.gov/transportation/hive) | Fleet behavior, charging infrastructure and service levels can be studied together at multiple scales | Preserve fleet/depot coupling; add energy constraints only with a clear research question |
| [EVI-EnSitePy](https://nrel.sitefinity.cloud/transportation/evi-ensitepy) | Models charging ports, vehicle charge acceptance, site power, queues and energy-management behavior | Charging fidelity means energy/resource constraints, not a charger icon or linear countdown |
| [Samsara maintenance integration guidance](https://developers.samsara.com/docs/maintenance-fault-monitoring-guide) | Maintenance tools connect faults, inspections and planned maintenance through APIs/webhooks | A convincing operations-tool roadmap needs tasks, resource events and integration contracts |
| [NN/g complex-application guidance](https://www.nngroup.com/articles/complex-application-design/) | Complex applications benefit from relevant disclosure, context and understandable interactions | Reveal the next decision before advanced configuration; keep context when drilling into evidence |

The EVI-EnSitePy page is current product documentation; the partnership announcement is historical context from December 2024. Neither establishes present internal Waymo architecture. HIVE's research overview was available through indexed content; a later direct fetch returned a server error.

### Tool choice

| Tool / technique | Suitable question | Decision for this redesign |
|---|---|---|
| Existing discrete-event simulator | Capacity, queues, dispatch/assignment, resource timing | Retain |
| SVG / existing Canvas 2D | Explain service stages and replay the model's own projections | Use |
| Blender | Physical layout/visibility walkthrough, illustrative rendering | Not needed for the current decision; not installed locally |
| Gemma or another language model | Optional narration or scenario-draft assistance with validation | No runtime model; no extra value for deterministic execution |
| Traffic simulator | Travel-time/network effects require better road fidelity | Separate calibration/fidelity decision, not a visual dependency |
| Detailed charging simulator | Port/power/vehicle energy limits matter to the decision | Evaluate in a future bounded energy-model phase |

## 4. Human-centered product design

### Jobs and workflows

| Persona | Trigger | Question | Useful next action | Evidence needed |
|---|---|---|---|---|
| Market lead | Peak demand or supply shortfall | Which areas lack usable vehicles, and for how long? | Compare supply/assignment options and communicate the trade-off | Timestamped availability, demand cohort, wait, unserved and empty travel |
| Depot lead | Queue grows or departures slip | Which resource blocks readiness? | Test capacity/process changes; escalate the actual constraint | Stage queues, WIP age, completions, resource status and unfinished visits |
| Infrastructure planner | Fleet growth or new site | What resources meet the demand envelope? | Compare scenarios and document assumptions for a planning review | Charging/cleaning/staff/power constraints, uncertainty and sensitivity |
| Fleet partner operator | Exception or failed handoff | What is affected, who owns it, and what is safe to do? | Acknowledge, assign, follow a playbook and verify recovery | Event provenance, permissions, proposed action, execution status and audit history |

The first two workflows have partial working support. Infrastructure and partner execution workflows are design targets, not implemented capabilities.

### Operations-tool extension, proposed

An actionable exception card should contain the affected resource, event time, freshness, operational impact, current owner, permitted next actions and a link to supporting events. Do not generate alert counts from decorative randomness. Separate observation, proposed intervention, permitted action, executed action and verified outcome.

A simulated operator task may be created and resolved in a future sandbox, but it must remain labeled as simulated. Production workflows would require permissions, reconciliation, integration reliability, audit history and explicit rollback/recovery design. Those are not provided by today's static site.

### Depot bring-up contract, proposed

Start with a versioned site/resource manifest and a dry-run validation operation. Proposed input fields include site ID, scenario time zone, resource IDs/types, capacity, schedules, energy constraints, service-stage routing and model version. Validation should reject missing references, impossible capacities, contradictory schedules and unsupported versions with actionable field errors.

Only then design external endpoints/SDKs, with idempotency, asynchronous job states, deterministic replay IDs, version compatibility and event provenance. Do not present an API card as evidence an API already exists.

## 5. Prioritized roadmap

| Sequence | Deliverable | Why this order | Exit criteria |
|---|---|---|---|
| A — implemented here | Decision-led website and guarded copy | Makes existing substance understandable | Working navigation, reviewable local packages, no model/metric drift |
| B — measurement | Stage-specific queue/throughput/readiness contracts and independent demand seeds | Prevents a prettier interface from making broader claims than the experiment supports | Hand-checkable fixtures, population/censoring definitions, separate demand and travel seed controls |
| C — resources | Synthetic battery/charging and staffing extension | Directly addresses the largest JD2 gap | Energy conservation, SOC bounds, power-cap enforcement, charger outage and queue tests, missed-departure metric |
| D — experimentation | Capacity sweeps and constrained alternatives | Moves beyond a single pair without inventing a universal score | Explicit objectives/constraints, feasible set, trade-off frontier, held-out stress cases |
| E — operator workflow | Simulated exception queue and depot commissioning contract | Demonstrates actionability and platform thinking for JD1/API scope | Traceable lifecycle, permission boundary, field errors, idempotency and recovery tests |
| F — validation | Approved data calibration and operator studies | Necessary before operational decision support or a calibrated-twin claim | Held-out error report, model-use envelope, task study, residual-risk owner |

For a first synthetic charging extension, constrain delivered energy by port power, vehicle acceptance and the shared site cap; integrate energy with consistent time units; keep state of charge within bounds; represent queues, outages and departure deadlines. Compare missed readiness, rider outcomes, peak demand and energy delivered separately. A charger-count increase may have little effect under a fixed site power cap. That is a strong next product case.

Do not add charging, staffing, a solver, a new map engine, a cloud service and operator accounts in one wave. Each would introduce different validity and integration questions.

## 6. Role positioning and hiring-manager walkthrough

### Evidence by role

| Role requirement | Direct evidence in this project | Transferable reasoning demonstrated | Genuine gap |
|---|---|---|---|
| Fleet Operations roadmap | Connected cases, explicit user questions, product approach and staged roadmap | Turning fragmented operational signals into a decision workflow | Real roadmap ownership and stakeholder execution are career evidence, not proven by this repository |
| Operational UX | Scenario/replay/inspection and experiment flows | Progressive disclosure, traceable explanations, exception design | Operator research and adoption outcomes |
| Metrics and insights | Population-aware metrics, seeded comparisons, uncertainty and guardrails | Translating data into a bounded next action | Real telemetry, market monitoring, integration reliability |
| Depot throughput | Finite bays, queues, blocking, assignment and downstream effects | Bottleneck diagnosis and resource trade-offs | Labor/energy/readiness fidelity |
| Digital twin | Repeatable synthetic operational model | Model adequacy and calibration plan | Connected observations, calibrated parameters and validated error envelope |
| New depot tooling/API | Versioned model/specification contracts and test harness | Schema, reproducibility and commissioning design | An implemented external API or depot rollout workflow |

Resume-safe project positioning: “Built a simulation-based fleet and depot experimentation prototype with reproducible A/B comparisons, operational metrics and explicit guardrails.” Use only if this accurately reflects your own role in the project. Do not convert it into claimed employment experience, production deployment or quantified real-fleet impact.

20-second narrative:

> I built FleetLab to explore how fleet supply, depot resources and operating rules affect service. The tool lets a reviewer inspect a day, change one decision and compare outcomes under explicit guardrails. The important product question is whether an intervention improves the whole system or just moves the bottleneck. It is a synthetic simulation, with a clear roadmap toward charging, calibration and operator workflows.

### Six-minute demonstration

| Time | Show | Explain |
|---|---|---|
| 0:00–0:40 | Overview and depot stages | Who makes the decision, why resources are coupled, and the synthetic boundary |
| 0:40–2:00 | Guided Operations chapter | The evening peak, waiting/unserved riders, recall, depot work and release |
| 2:00–3:10 | Analytics and verdict | OPS-01 improves evening wait but exceeds a depot-delay allowance; HOLD preserves the trade-off |
| 3:10–4:00 | Simulation chapter | One replay is explanatory; the comparison uses the frozen specification and paired travel variation |
| 4:00–5:00 | Depot capacity experiment | Four versus six bays can leave rider wait unchanged; ask where the actual bottleneck is |
| 5:00–6:00 | Product approach | User research, charging/shared resources, calibration, API and next-test sequence |

The casebook regression pins show OPS-01's synthetic evening wait mean delta of approximately −1,565.6 seconds and SF-2 depot-delay harm of approximately +2,364.4 seconds against a 1,800-second allowance. They are model outputs, not measured fleet performance. The capacity example run during browser QA produced UNCHANGED / NO_RECOMMENDATION, with a 95% interval approximately −10.2 to +0.4 seconds inside the ±30-second margin.

For JD1, spend more time on who notices a problem, what they need to inspect, and the action/ownership gap. For JD2, spend more time on bottlenecks, denominators, shared power/labor resources and the calibration plan. The project's strongest evidence is disciplined product reasoning, not a claim to already operate an autonomous fleet.

## 7. Human validation plan

Run two rounds with five participants each as an initial qualitative study, not a representative sample: people unfamiliar with the project first; fleet/depot/operations practitioners when available second. Proposed tasks:

1. In 30 seconds, explain what the product does and whether it uses real fleet data.
2. Find a depot constraint and explain which metric supports it.
3. Determine whether an improved primary metric should advance when a guardrail regresses.
4. Explain the difference between one replay, repeated travel variation and real operational evidence.
5. Change a scenario, leave the page, return, and identify whether results describe the current or frozen setup.
6. Name the information missing before using this to plan charging infrastructure.

Record task success, time, wrong conclusions, assistance required, confidence and a brief teach-back. Proposed acceptance targets: at least four of five correctly state the scope and find the next action; no participant interprets a recommendation as deployment permission; no participant mistakes unavailable evidence for a passing result. These are suggested research gates, not achieved results. Revise the design based on confusion, not aesthetic votes alone.

## Recommendation

Use the redesigned experience as a simulation/product case study. Lead with the connected decision and demonstrate a mixed or unchanged outcome. That shows stronger judgment than a visually impressive page that claims every intervention succeeds.

## Top risks and mitigations

- Overstated fidelity: keep synthetic scope and fixed-demand uncertainty visible; add calibration before making operational claims.
- Metric substitution: retain exact values, populations, denominators and censoring; add new metric contracts rather than renaming existing ones.
- Attractive but unusable UX: conduct task-based validation with unfamiliar visitors and operators; browser QA is necessary but not sufficient.
- Roadmap breadth: build independent demand variation and stage metrics before charging, then choose one bounded shared-resource extension.
- Verification overclaim: report playground gates separately from missing historical Python fixtures; do not claim the whole repository is green.

## Next three actions

1. Review the local site and rehearse the six-minute case, especially the HOLD and UNCHANGED outcomes.
2. Run the comprehension study and record the largest misunderstandings before publication.
3. Start a separate model-design wave for independent demand seeds, stage-level depot metrics and a bounded charging/readiness experiment.
