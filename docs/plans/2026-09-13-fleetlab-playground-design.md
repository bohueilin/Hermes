# FleetLab Playground: design for audit

**Status:** audited (approve with required changes; every required change is applied); build authorized on 2026-09-13. **Date:** 2026-09-13.
**Base:** `main` at `bca4ccd` (FleetLab Stages 1 and 2 merged).
**Readers:** the owner, the design auditor, and the implementer who builds it after approval.

## 0. How to read this document

- **Normative words.** MUST and MUST NOT are requirements the audit checks and the build is gated
  on. SHOULD marks a default that may change with a recorded reason.
- **Evidence labels.** *Measured* means a command in Appendix A produced the number on this
  machine, with the exact spec or code it ran. *Exploratory* means measured from a local spec that is
  not a committed decision record; the spec is reproduced in Appendix A. *From code* means read from
  the repository at `bca4ccd`, cited by file. *Expected by reasoning* means nobody has run it.
- **First build** is the slice in §10.1. *Later* means designed here, not built first.
- **Owner decisions** are numbered D-01 to D-12 (§11). The owner accepted every recommended default on 2026-09-13,
  with D-03 strengthened after the design audit.
- **Where things live.** This document is `docs/plans/2026-09-13-fleetlab-playground-design.md`. The code is in
  `playground/fleetlab/`, the parity fixtures in `tests/fixtures/fleet_playground/`, and the explicitly invoked fixture
  regenerator in `tools/fleet_playground/`. Appendix A.9 carries the two-zone probe spec in full. No phase edits
  `src/hermes/`.
- **Section map.** §1 product and honesty boundary; §2 world knobs; §3 depot visit and the worked
  example; §4 use cases; §5 simulation model; §6 Experiment-mode parity with FleetLab; §7 interaction
  design; §8 visual system; §9 architecture and testing; §10 first build and phases; §11 owner
  decisions; §12 audit checklist; §13 risks; §14 FleetLab defects found while designing; Appendix A
  measurements; Appendix B how the design was reconciled.

## 1. What this is, and what it is not

### 1.1 The job

FleetLab Playground is a static web page that works offline. A product manager sets the knobs of a
stylized Bay Area fleet (cars per area, depots per area, peak and off-peak demand, highway and local
routes, what a depot does to get a car ready), watches one simulated day play out, and runs a
preregistered paired A/B that returns FleetLab's verdict vocabulary.

- **Primary user:** a product manager building intuition for fleet and depot operations.
- **Secondary use:** a five-minute live walkthrough with another person.
- **Done looks like:** with the page open, the user can show why "home depot or nearest depot?"
  depends on tomorrow's first peak and tonight's depot capacity, and can show a verdict that says so
  without overclaiming.

### 1.2 A small simulator inside a rigorous instrument

| | FleetLab (evidence engine) | FleetLab Playground (teaching engine) |
|---|---|---|
| Language and location | Python, `src/hermes/fleet/` | JavaScript with zero dependencies, `playground/fleetlab/` |
| World | one shared fleet placed round-robin; a car due for service is serviced in place where its trip ended, from one shared pool of bays; flat demand; one travel time per zone pair; no trips inside a zone | four fixed areas; depots with locations and parking; a highway route and a local route between every pair of areas; congestion by hour and direction; peak and off-peak demand with commute direction; a depot visit (clean, then service when due); depot assignment and morning release rules |
| Spec grammar | one `parameter:` axis over a numeric scenario field; whole-run metrics | the same, plus `policy:` axes, named values, per-area and per-depot values, and metrics scoped to an area, depot or time window, all marked *teaching-model grammar* |
| Output | a digest-bound decision record that replays bit for bit | a teaching run (an animated day, charts, a verdict card); never a decision record |
| Verdict rules | paired seeds, bootstrap interval over paired deltas, equivalence margin, non-compensatory guardrails | the same rules, value-identical, proven by shared vectors (§6) |
| Authority | a screening input to a next test | none; a learning surface |

**Shared:** the verdict rules, the metric declaration shape (unit, direction, population, aggregation,
availability, absence condition), the outcome and recommendation words, and the honesty stance.
**Intentionally different, and stated on screen:** the world, the grammar extensions, the random draws,
every digest, and every metric whose definition differs from FleetLab's (it carries a different name).

### 1.3 Honesty boundary

- **H-1** Every screen carries a teaching-model strip that cannot be dismissed.
- **H-2** No real map, tiles, coordinates, traffic feed or operator data. Area names come from a fixed
  allowlist (San Francisco, Peninsula, San Jose, East Bay). Routes carry fictional ids (`H1` to `H6`,
  `L1` to `L6`); depots are named by area only (`SF-1`, `SJ-1`); no venues, neighbourhoods or real
  road numbers.
- **H-3** Traffic and demand profiles are declared inputs, written as "profile you set". The words
  *predict*, *forecast*, *expected traffic*, *live*, *real-time* and *monitoring* MUST NOT appear in
  interface copy, negated or not. Interface copy is every string a person can read or hear: visible text,
  `aria-label` and `title` values, screen-reader announcements and the packed file's `<title>`. Attribute and
  property names (such as `aria-live`) and code identifiers are not copy. The `check-dist` token scan applies
  this rule to whole words, ignoring case.
- **H-4** A playground run is a *teaching run*. It MUST NOT be written, exported or labelled as a
  FleetLab decision record; its exports MUST fail FleetLab's `DecisionRecord` and `ExperimentSpec`
  validation; a spec hash displays as `playground-spec:` plus 8 characters, never as a bare 64-character
  digest.
- **H-5** Absence is never rendered as zero, blank or a dash; it reads `not available: <reason>`.
- **H-6** No score, winner, gauge, leaderboard, "best configuration", revenue or cost; no *wins*, *beats*
  or *better option* in copy. Trade-offs are written as "lower X, higher Y".
- **H-7** Every verdict shows its limitations, and every chart carries a "model limits" chip listing the
  simplifications in §5.8 that apply to it.
- **H-8** The five `REQUIRED_LABELS` constants in `contracts.py` are never displayed or retyped. One of
  them names a specific operator, which a public teaching page must not repeat. A boundary test imports
  that tuple and asserts that none of its strings appears in any playground file, so the test never
  spells the name either.
- **H-9** A lesson caption states a direction ("lower", "higher", "unchanged") only when a pinned
  fixture test asserts that direction on the preset; otherwise the caption reads "run it and see".
- **H-10** Anything shown from one replay says so; anything computed across replications says so; the
  two are never mixed in one number (§7.4).

**Exact copy for the first build**

| Where | String |
|---|---|
| Top strip (not dismissable) | `Teaching model: a sketch of Bay Area place names with invented numbers. Not evidence about any real fleet.` |
| Top strip, phone | `Teaching model` (tap opens the popover) |
| Popover | "This is a teaching model. The map is a simplified sketch that uses Bay Area place names, and every number (demand, traffic, depot times) is invented to show how fleets and depots behave. It is not calibrated to any real operation, it says nothing about what will happen, and nothing here can approve a change to a real fleet." |
| Route shield | `H2 · 55 min` (fictional id, free-flow minutes) |
| Traffic label | `Evening slowdown you set: highways away from SF ×1.6, toward SF ×1.2, 16:00 to 19:00` (names each direction whenever the profile differs by direction) |
| Route tooltip | `Leaving now, D1 18:30: 77 min (55 min free-flow, slowed by your traffic profile)` (the planned time for a departure at the cursor, from the §5.2.1 routine; shown for H2 toward SF in the UC-07 preset) |
| Verdict chip, inside the verdict box | `Teaching run, not a decision record` |
| Verdict footer (not collapsible) | `The rules match FleetLab's instrument; the world does not.` |
| Absent value | `not available: no rider was picked up in this hour` |
| Axis FleetLab cannot run | `Teaching-model axis: FleetLab cannot run this` |
| FLEET-005 reference panel | `Measured in FleetLab: FLEET-005, a committed decision record. Quoted here, not run here.` |
| Two-zone probe panel | `Exploratory FleetLab run, not a committed decision record. Its spec is in the design document, Appendix A.9.` |
| Car fork caption | `Two full runs on the same world. Every other car also differs between A and B.` |

### 1.4 Rejected, with reasons

| Rejected | Reason |
|---|---|
| Real basemap or street tiles | Implies calibrated geography and routing the model does not have; PRD §48 excludes city-map fidelity. |
| Live or real data feeds | Breaks the honesty boundary and creates privacy exposure. |
| Points, streaks, badges, leaderboards, "best configuration" | Rewards pushing a number; guardrails are non-compensatory, so any ranking is a hidden composite score. |
| A single score or fleet-health gauge | PRD §49: lower wait with more unserved riders is not an unqualified win. |
| Colour-flooded verdict cards | They encode the verdict in colour alone and read as a scoreboard. |
| A rendered 3D city, vehicle models, baked frames, textures or sprite sheets | Still rejected, and rejected again in 2026-09-16's build. Device budget spent on fidelity the question does not need; occlusion hurts counting and accessibility; every asset would be a `data:` URI against the 2 MB cap and would need a build step the zero-dependency rule forbids; and a rendered city reads as a real place, which H-2 forbids. A hero still made outside the page and never in `dist/` is the one legitimate use. |
| A camera the visitor can move, perspective, lighting, a sky, a day-and-night tint | A moving camera invites reading the picture as a place. The model has no daylight, so a tint would be a lighting simulation it does not run: the canvas is the same grey at 03:00 as at 15:00, and the overnight is named by the two knobs that bound it, the recall and the release. |
| A language model in the page or the loop | A sampled model is not a pure function of scenario and seed, so the first token it produced would void the pinned verdicts and the parity proof; a 4-bit 2B model is about 1.5 GB against a 2 MB cap, and `connect-src 'none'` leaves no way to fetch one. |
| An imported world model or traffic simulator | A dependency; a second source of truth for position that would disagree with the interval log every number reads; it cannot run offline; and it breaks §5.9's "playback never runs the model" at the root. Richer travel belongs in the teaching model as a declared, seeded rule with fixtures, never in the drawing layer. |
| WebGL for the isometric picture | Measured three times cheaper in JavaScript than Canvas 2D, and that saving is 0.1 ms of an 8 ms budget bought with a second renderer, a context-loss path during a screen share and a line pass for the 1 px ink edge (the prototype measured both). |
| Animating Experiment statistics during playback | Makes all-seed numbers look tied to the one replay being watched. |
| Re-running an experiment when a knob changes | Breaks preregistration: the spec is frozen before results are seen. |
| Exporting teaching runs as decision records, or exporting FleetLab specs | A decision record is evidence-path and digest-bound; almost no first-build scenario fits FleetLab's grammar anyway (D-04). |
| Revenue or cost panels | PRD §16.6: do not fabricate revenue. |
| Guided-tour modals on first load | They block the live walkthrough; one dismissible reading card and the Learn cases do the job. |
| A Streamlit page over the Python engine | Every interaction reruns a script, playback cannot be smooth, and it blurs the evidence-path workbench boundary (§9.1). |
| Python in the browser | A runtime download of 10 MB or more, slower runs, a CDN dependency, and a Python whose `sum()` differs from FleetLab's pinned 3.11 (§6, T-2). |
| A new visual identity | The Hermes public identity already exists; extend it rather than fork it (§8). |
| Multi-regime experiments and the MIXED outcome | FleetLab's instrument is single-regime; a second window runs as a separate experiment. |
| Charging and state of charge (first build) | Not among the six seed variables; adds an energy model, four invariants and several metrics (D-02). |
| Depot staff and shifts (first build) | Bays and parking already carry the throughput lesson; staff adds rosters, a resource and more metrics (D-06). |
| Editable geography, a fifth area, distances on screen (first build) | Four fixed areas and minutes only keep fixtures hand-derivable (D-07). |
| URL deep links, a full-page inspector, JSON import (first build) | The single-file build has no routing; revisit later. |

**Accepted instead, and built on 2026-09-16: a procedural isometric schematic.** The map region can draw the same four
areas as a Canvas 2D isometric picture, generated at run time from the interval log and the schematic's own centres,
with no asset, no dependency, no build step and no WebGL. It is a schematic stood up, not a place: platforms are flat
squares at the areas' own centres with no texture, shoreline, street or building; roads are ribbons; a car on a route
is a shaded box pointing along its ribbon; cars standing in an area stay a tally of cubes, five cars each, whose place
on the platform means nothing; a depot is a white block. Nothing is lit and no camera moves. Where several cars share
a leg exactly, one body carries a written count, grouped in model space so the count is a fact of the log and not of
the screen. The picture draws no word: every label, number and name is DOM over the canvas, where the copy scans and a
screen reader can read it. The limits chip says all of this before a run as well as during one (§5.8, §7.3, §8.2). The
flat SVG schematic stays: it is what the tests build by default, what a browser with no 2D context gets with the reason
written, and one toggle away in the map header.

## 2. The world knobs

Every number is **illustrative**. Knob ids are stable references for the audit and the build. The
engine stores integers (seconds, metres, per-mille, parts per million; §5.4). The interface shows
minutes and never shows a distance (D-07).

### 2.1 The owner's seed variables

| Seed | The owner's words | Knobs | Where it shows | Use cases |
|---|---|---|---|---|
| 1 | Total cars available in a zone | `SUP-1` cars per area at the start of the day (input); `fleet.available_fraction` by area and hour (output) | fleet group of the knob panel; area yards on the map; "Available cars by area" chart | UC-01, UC-02, UC-04 |
| 2 | Total number of depots in a zone | `DEP-1` depots per area, with `DEP-2` parking, `DEP-3` cleaning bays and `DEP-5` service bays per depot | depot tiles on the map; depot inspector | UC-08, UC-09, UC-10 |
| 3 | Peak-hour demand | `DEM-1` peak requests per area per hour; `DEM-3` peak windows | demand strip under the scrubber | UC-04 |
| 4 | Off-peak demand | `DEM-2` off-peak requests per area per hour | demand strip | UC-04 |
| 5 | Highway versus local | `RD-1` a highway route and a local route per area pair; `RD-3` congestion by hour, road class and direction | route shields and chevrons; route tooltip | UC-05, UC-07 |
| 6 | A car moving from one depot to another, and what the ops center does to get it ready | `POL-2` depot assignment; `POL-4` morning release to the home area; the depot visit (`DEP-2` to `DEP-9`) | depot inspector; car inspector timeline; both depots' boards on one clock | UC-07, UC-08, UC-10 |

### 2.2 Supply

| Id | Knob | What it controls in the model | Unit | Default (range) | First build |
|---|---|---|---|---|---|
| SUP-1 | Cars per area at start | How supply is spread when the day opens; replaces FleetLab's round-robin placement | cars per area | SF 40, PEN 24, SJ 32, EB 24 = 120 (0-200 each; total 1-500) | yes |
| SUP-2 | Home area and home depot per car | A car's **home area** is the area it starts in under SUP-1, which is also its id prefix; the morning release returns cars there. Its **home depot** is the depot it visits under `home_depot`: the depot nearest its home area by free-flow time including depot access; cars share tied depots in turn, in vehicle-id order, starting with the lowest depot id. Shown, not edited | area id; depot id | derived (SF-017 is the 17th SF car, so SF-1) | yes |
| SUP-3 | Operating window, staggered launch, out-of-service rate, special vehicles | Fleet availability refinements | various | none | later |

**Calibration of the default (build, 2026-09-14).** The audited default of 90 cars was never run at fleet scale before
the build. Run in the built engine it gave 23% of requests unserved and a wait p90 of 60 min, mostly because the
recall then stayed pending all night (D-12). With the recall acting once, a sweep of 90 to 165 cars at the proportions
SF:PEN:SJ:EB = 5:3:4:3, demand unchanged, chose 120: on seeds 1001 to 1005 at sigma 0 the busiest peak hour's wait p90 is
1,134 s, the worst hour loses 8.2% of its requests, the day 2 07:00 to 10:00 window loses none, and the placement gap at
the day 2 06:00 snapshot is 7. Two targets are accepted exceptions: unserved is 0.50% (9 of 1,795), below the 1% floor,
and the longest overnight bay wait is 15,022 s at SF-2, which shares its home cars equally with SF-1 but has half its
bays; every car is ready before the morning release. At 105 cars the busiest peak hour's wait p90 is 2,400 s. The envelope
is pinned by `test/presets.test.mjs`.

### 2.3 Depots

| Id | Knob | What it controls in the model | Unit | Default (range) | First build |
|---|---|---|---|---|---|
| DEP-1 | Depots per area | Where cars go to be cleaned and serviced. An area may have none; its cars use the nearest depot. A map with no depot is an error. | depots per area | SF 2 (SF-1, SF-2), PEN 0, SJ 1 (SJ-1), EB 1 (EB-1) (0-2) | yes |
| DEP-2 | Parking per depot | Cars a depot can hold while queued or ready (PRD §8.4 `parking_capacity`) | stalls | SF-1 60, SF-2 30, SJ-1 30, EB-1 30 (5-150) | yes |
| DEP-3 | Cleaning bays per depot | Parallel cleaning (PRD §8.4 `cleaning_bay_count`) | bays | SF-1 4, SF-2 2, SJ-1 3, EB-1 2 (1-12) | yes |
| DEP-4 | Clean time | Minutes a car occupies a cleaning bay | min | 20 (5-60) | yes |
| DEP-5 | Service bays per depot | Parallel servicing (PRD §8.4 `service_bay_count`) | bays | SF-1 2, SF-2 1, SJ-1 1, EB-1 1 (0-6) | yes |
| DEP-6 | Service time | Minutes a car occupies a service bay | min | 45 (10-240) | yes |
| DEP-7 | Trips between depot visits | The visit trigger, named as in FleetLab (`trips_between_service`) | trips | 10 (1-100) | yes |
| DEP-8 | Service every N visits | Which visits include the service stage; 0 means never | visits | 3 (0-10) | yes |
| DEP-9 | Intake and pull-out time | Minutes to check in on arrival and to leave the yard | min | 3 and 2 (1-10) | yes |
| DEP-10 | Operating hours | When intake runs; first-build depots are open 24 hours | clock | 24 h | later |
| DEP-11 | Staff and shifts by skill | Cleaners and technicians as a limiting resource | people per shift | none | later (D-06) |
| DEP-12 | Guest cap, inspection, quality check, launch limit, deep clean, maintenance | Pipeline refinements | various | none | later |
| DEP-13 | Chargers per depot | Charging capacity (PRD §8.5) | chargers | none | later (D-02) |

A knob that holds one value per depot (DEP-2, DEP-3, DEP-5) can be a single Experiment axis whose two
values are named layouts, as long as the layouts differ only in that knob (UC-10).

### 2.4 Demand

| Id | Knob | What it controls in the model | Unit | Default (range) | First build |
|---|---|---|---|---|---|
| DEM-1 | Peak requests per area | Request rate inside the peak windows | requests per hour | SF 60, PEN 20, SJ 35, EB 30 (1-120; at least the off-peak value) | yes |
| DEM-2 | Off-peak requests per area | Request rate outside the peak windows; 0 is allowed and tagged "outside FleetLab's range" | requests per hour | SF 15, PEN 8, SJ 10, EB 8 (0-120) | yes |
| DEM-3 | Peak windows | Morning and evening peaks, applied on both simulated days (PRD §10.1 hourly buckets) | clock | 07:00-09:00 and 16:00-19:00 | yes |
| DEM-4 | Destination mix | Where riders go from each area, in three periods (morning peak, evening peak, other), including trips inside the same area | integer weights | morning peak toward SF; evening peak away from SF; stylized | yes |
| DEM-5 | Demand shape | A named shape usable as one axis value: `peaked` (DEM-1 to DEM-3 as set) or `flat` (the same total over the window, spread evenly) | enum | `peaked` | yes |
| DEM-6 | Demand that varies by replication | Each seed gets its own demand draw (`PER_REPLICATION`) instead of one fixed trace | enum | fixed trace | later |
| DEM-7 | Airport node, event surge, planning profile | Demand refinements | various | none | later |

### 2.5 Routes and traffic

| Id | Knob | What it controls in the model | Unit | Default (range) | First build |
|---|---|---|---|---|---|
| RD-1 | Routes per area pair | Each pair of areas has one highway route and one local route, each with declared free-flow minutes; a car takes whichever is faster when it leaves | min | §2.9 (5-240) | yes |
| RD-2 | In-area trip and pickup time | Minutes for a trip or pickup inside one area | min | SF 6, PEN 8, SJ 8, EB 7 (1-30) | yes |
| RD-3 | Congestion by hour, class and direction | The slowdown you declare, for each road class, direction and hour of both days. An axis names a part as `<class>.<period>`: class `highway` or `local`; period `morning` (07:00-09:00), `evening` (16:00-19:00) or `late` (19:00-20:00); an axis value sets that part in both directions | × travel time | highways ×1.6 in the peak direction in each peak (toward SF 07:00-09:00, away from SF 16:00-19:00) and ×1.2 against it (a pair without SF has no peak direction and takes ×1.2 both ways in both peaks); ×1.3 on highways 19:00-20:00; local ×1.3 in both peaks; ×1.0 otherwise (1.0-3.0) | yes |
| RD-4 | Congestion threshold | The multiplier at or above which a minute counts as a congested minute | × | 1.3 (1.1-2.0) | yes |
| RD-5 | Travel variation | Shared variation per route and quarter hour, plus variation per ride | σ on a grid 0 to 0.50 in steps of 0.05 | 0 in Learn cases; 0.15 in Experiment presets | yes |
| RD-6 | Route choice policy, per-class variation, incidents, offsets inside an area | Routing refinements | various | none | later |

### 2.6 Policies

| Id | Knob | What it controls in the model | Values | Default | First build |
|---|---|---|---|---|---|
| POL-1 | Dispatch | Which car serves a waiting rider | `nearest_idle` (idle cars and cars ready at a depot, by planned arrival time) | `nearest_idle` | yes |
| POL-2 | Depot assignment (PRD §13.4 "service/depot assignment") | Which depot a car heads to when a visit is due | `home_depot`, `nearest_depot`, `nearest_depot_with_capacity` | `home_depot` | yes |
| POL-3 | End-of-service recall | At this time every idle car heads to a depot under POL-2, and a car then on a pickup or trip follows when that trip completes before POL-4's time (or the window end when POL-4 is off); a car dispatched after this time is not recalled (D-12) | clock | day 2 00:30 | yes |
| POL-4 | Morning release to home area | At this time every ready car at a depot outside its home area drives to its home area | clock or off | day 2 05:45 | yes |
| POL-5 | Depot queue order | Order of service inside a depot | FIFO | FIFO | yes |
| POL-6 | Repositioning, scarcity-aware dispatch, maximum pickup time, release on ready | Policy refinements | various | none | later |

### 2.7 Riders and the clock

| Id | Knob | What it controls in the model | Unit | Default (range) | First build |
|---|---|---|---|---|---|
| RID-1 | Rider patience | A rider still waiting for a car to be assigned gives up after this long and counts as unserved. Once a car is assigned, the rider waits however long it takes, as in FleetLab. | min | 10 (1-60) | yes |
| RID-2 | Cancellation after assignment, suppressed demand | Rider refinements | various | none | later |
| CLK-1 | Simulated window | Start and length, crossing into the next morning so next-morning effects are observed | clock, hours | day 1 05:00 to day 2 10:00, 29 h (4-36 h) | yes |
| CLK-2 | Warm-up | Excluded from windowed metrics to remove the perfect start | clock | day 1 05:00-06:00 | yes |
| CLK-3 | Reporting bucket | Grain of by-hour views | min | 60 (15, 30, 60) | yes |
| CLK-4 | Placement snapshot | When `fleet.placement_gap` compares where cars are with where the day started | clock | day 2 06:00 | yes |

### 2.8 Instrument knobs (Experiment mode)

| Knob | Rule | Default |
|---|---|---|
| Question | one sentence, up to 300 characters | from the preset |
| Variation axis | exactly one: `parameter:<knob id>` with an optional qualifier naming an area, a depot, or one part of a multi-valued knob (`parameter:SUP-1.SJ`, `parameter:DEP-3.SF-1`, `parameter:RD-3.highway.evening`), or `policy:<policy id>` | the last knob changed in Sandbox |
| Baseline and candidate values | inside the knob's range, numeric or a declared named value; different from each other, except in the labelled null-check preset of UC-01 | the old and new value of that knob |
| Primary metric | a registered metric with a direction, an optional scope (§5.7), and an equivalence margin greater than zero in the metric's unit | from the preset |
| Guardrails | zero or more registered metrics with a maximum harm of zero or more. Presets use metrics that are always available where one exists; a conditional guardrail that turns out absent is shown as NOT EVALUABLE (§6, P-8) | `unserved.fraction` at 0.02 |
| Replications (paired seeds) | 10-100 (FleetLab accepts 10-200) | 20 |
| Seed set | seed set k holds seeds `1000 × k + 1` to `1000 × k + N` for N replications; every preset uses set 1, and Sandbox replays the first five seeds of set 1. `Use another seed set` moves to set k + 1 as a new frozen spec with its own digest, recorded in the session log (§6) | set 1 (seeds 1001 to 1020) |
| Bootstrap resamples | 1,000-100,000 | 2,000 |

Every axis, named value, suffix and scope beyond FleetLab's own grammar (one `parameter:` axis over a
numeric scenario field, whole-run metrics) is teaching-model grammar and is tagged on screen.

### 2.9 The default preset: "Bay teaching map"

| Area pair | Highway route | Local route |
|---|---|---|
| SF and PEN | H1, 25 min | L1, 55 min |
| SF and SJ | H2, 55 min | L2, 110 min |
| SF and EB | H3, 20 min | L3, 45 min |
| PEN and SJ | H4, 30 min | L4, 70 min |
| PEN and EB | H5, 40 min | L5, 80 min |
| SJ and EB | H6, 50 min | L6, 95 min |

Routes are symmetric in free-flow time; congestion is not. Every depot sits 5 minutes of local driving
from its area's centre. Routes carry time only, never a length (D-07); driving is measured in seconds.

**Destination weights (DEM-4), out of 100 per origin.** Morning peak: from SF, SF 70 and each other area 10; from PEN, SJ
or EB, SF 55, its own area 25 and each remaining area 10. Evening peak: from SF, SF 16 and each other area 28; from PEN, SJ
or EB, its own area 60, SF 10 and each remaining area 15. Other hours: its own area 55 and each other area 15.


## 3. The depot visit and the worked example

### 3.1 What sends a car to a depot

| Trigger | Knob | Default | First build |
|---|---|---|---|
| Trips since the last visit reach the limit (FleetLab's `trips_between_service`) | DEP-7 | 10 trips | yes |
| End-of-service recall | POL-3 | day 2 00:30 | yes |
| Soiled trip, fault, low charge, transfer order | none | none | later |

The destination is chosen by POL-2 when the trigger fires. The choice and its cause are logged, so the
car inspector can say why a car went where it went. FleetLab has no drive to a depot at all: it services
a car in place where its trip ended (§5.10).

### 3.2 The stages of a visit

| Stage | Holds | Default time | What it stands for in this model | First build |
|---|---|---|---|---|
| Drive to the depot (`TO_DEPOT`) | nothing | route time | the empty drive that the depot choice decides | yes |
| Intake (`INTAKE`) | a parking stall, from arrival | 3 min (DEP-9) | checking a car in | yes |
| Queue (`QUEUED_SERVICE`) | the stall | 0 to hours | waiting for a free bay | yes |
| Clean (`IN_SERVICE`, task `CLEAN`) | a cleaning bay; the stall is free while the car is in the bay | 20 min (DEP-4) | every visit cleans | yes |
| Service (`IN_SERVICE`, task `SERVICE`) | a service bay | 45 min (DEP-6) | every third visit also services (DEP-8) | yes |
| Ready (`READY_AT_DEPOT`) | a stall | until dispatched or released | a finished car that can be dispatched from the depot | yes |
| Pull-out | nothing | 2 min (DEP-9) | leaving the yard when dispatched or released | yes |
| Staffing, inspection, quality check, deep clean, charging, maintenance, launch limit, closing hours | various | none | refinements | later |

**A full lot.** A car that arrives when its depot has no free stall is diverted to the nearest depot with
one (`DEPOT_DIVERTED`, counted in `depot.diversions`). If no depot that can serve the visit has a stall free, it waits at the gate of the depot it was sent
to, in state `GATE_WAIT`, holding no stall; that wait counts toward time to ready (`depot.turnaround_*`), not toward
the bay wait.

**A car with nowhere to park.** A car that finishes in a bay when no stall is free stays in the bay, and
the next car waits for it (`depot.blocked_s`).

### 3.3 What the visit teaches

1. **Throughput is the minimum over bays and parking, not the bay count.** A depot with spare bays and a
   full lot processes no faster.
2. **Head-of-line blocking.** A finished car with nowhere to park keeps its bay.
3. **Cars from other areas compete with the depot's own cars** for stalls and bays, often during that
   depot's own return wave (`depot.parking_peak_fraction`, `depot.diversions`).
4. **Parked is not ready.** Intake, queue, clean and service come first (`depot.turnaround_p90_s`, shown
   as "time to ready").

### 3.4 What a move between areas costs in this model

| Cost | Driven by | Shown as | First build |
|---|---|---|---|
| Empty drive time | route; RD-1, RD-3 | `vehicle.empty_drive_fraction` | yes |
| Minutes in declared congestion | the congestion profile you set; RD-4 | `exposure.congested_empty_s` | yes |
| The receiving depot's parking and bays | DEP-2, DEP-3, DEP-5 at the arrival hour | `depot.bay_wait_p90_s`, `depot.parking_peak_fraction`, `depot.diversions` for that depot | yes |
| Next-morning position | where cars are when the snapshot is taken | `fleet.placement_gap`; `wait.p90_s` scoped to day 2 07:00-09:00 | yes |
| The morning release | POL-4 | `vehicle.empty_drive_fraction`; `exposure.congested_empty_s` for day 2 | yes |
| Energy | route energy | none | later (D-02) |

### 3.5 Worked example: SF-017 finishes a trip in San Jose at 18:30

Preset "Evening depot visit in San Jose" (UC-07). Car `SF-017` (home area SF, home depot `SF-1`, SUP-2) drops a
rider in San Jose on day 1 at 18:30, and the trip is its tenth since its last visit, so a visit is due (`purpose
SERVICE_DUE`). The table below is **expected by reasoning**. The build pins it with a **single-car fixture**
(§9.5): this preset's routes, traffic and depot times; SF-017 as the only moving car; the depot occupancy below
declared as fixture inputs (cars already queued, with their remaining times); and no request in SJ after 18:30,
so SF-017 is not dispatched from SJ-1 overnight. The fixture test derives every time by hand in its comments, and
every caption on screen is generated from that fixture (H-9). In the full preset other cars and riders act too:
SF-017 can be dispatched from SJ-1 after 19:20, which changes its night and morning, and the fork shows that. In the full
L3 preset at the 120-car default (seed 1001) the car due a visit in San Jose is SF-005, at D1 17:13; Learn pins that car,
and the single-car fixture keeps SF-017.

**Traffic you set for this preset:** highways ×1.6 in both directions 16:00-19:00 and ×1.3 19:00-20:00;
local routes ×1.3 16:00-19:00. **Depots in the fixture:** SF-1 has 60 stalls, 4 cleaning bays and enough cars already queued that a car
finishing intake at 19:55 waits 35 minutes for a bay; SJ-1 has 30 stalls (24 held at 19:00) and 3 cleaning bays,
and a car finishing intake at 18:40 waits 20 minutes. The visit is not a service visit.

| Step | A: `home_depot` (SF-1) | B: `nearest_depot` (SJ-1) |
|---|---|---|
| Drive | H2 at 18:30: 30 min at ×1.6 covers about 19 of its 55 free-flow minutes; the remaining 36 at ×1.3 take about 47 min, reaching SF at about 19:47; 5 min to the yard. About 82 min | 5 min to the yard at ×1.3: about 7 min |
| Intake done | about 19:55 | about 18:40 |
| Queue, then clean | 35 + 20 min: ready about 20:50 | 20 + 20 min: ready about 19:20 |
| Out of service | about 2 h 20 min | about 50 min |
| Empty minutes in declared congestion | about 77 | about 7 |
| Evening use | ready in SF from about 20:50, when SF demand is off-peak | dispatchable in SJ from about 19:20 |
| Parking it takes | one stall at SF-1 during SF-1's busiest return hour | one stall at SJ-1, leaving 5 free for SJ-1's own late returns |
| Next morning, first SF wave at 07:00 | already in SF | in the fixture it is still ready at SJ-1, so the morning release at 05:45 leaves after 2 min of pull-out and 5 min of depot access and takes H2 in free flow: in SF by about 06:47, no congested minutes |

**What the page must make visible, as trade-offs rather than a winner**
- For this one car, B gives **lower** out-of-service time and **fewer** congested empty minutes tonight,
  and a **higher** morning drive; at the day 2 06:00 snapshot the placement gap is **equal**, because the released car
  is on its way to SF and counts there, so the morning cost shows in `vehicle.empty_drive_fraction` and day 2 exposure,
  not in the gap.
- Across the fleet, the evening flow away from SF (DEM-4) ends many SF-home cars in the south. Under
  `nearest_depot`, SJ-1's lot fills; later cars divert north in congestion; and the SF morning wait can
  end **higher** than under `home_depot`, even though the first cars' congested minutes fell.
- `nearest_depot_with_capacity` separates distance from capacity: it sends a car to the nearest depot
  with a stall free when the car leaves.
- The directions above are captions only once the UC-07 fixture test asserts them (H-9). In Experiment mode
  this is UC-07.


## 4. Use cases

Every use case has one axis, a primary metric with an equivalence margin, and guardrails, as FleetLab's
instrument requires. Guardrails use metrics that are always available wherever one fits; a conditional
guardrail that turns out absent shows NOT EVALUABLE. Result labels: **Measured** (FLEET-005, a committed
FleetLab spec), **Exploratory** (the two-zone probe, reproducible from the spec in Appendix A, not a
committed record), and **Expected by reasoning** for everything else. On screen, a direction becomes a
caption only when a fixture test asserts it (H-9).

**First build.** Three guided Learn cases (UC-04, UC-09, UC-07) and seven Experiment presets without narration (UC-01, UC-02, UC-03, UC-05, UC-08a, UC-08b, UC-10), plus the
two preregistered L2 presets and two quoted FleetLab reference panels (FLEET-005, measured; the two-zone probe,
exploratory). Everything else is later. The operations casebook (§4.4), twenty more Experiment presets with every
verdict pinned, came after the first build.

### UC-01 Null check: does "no change" read as no change?
- **Experiment:** axis `parameter:DEP-7`, baseline 10, candidate 10 (the one preset allowed equal values).
  Primary `wait.p90_s`, margin 30 s. Guardrail `unserved.fraction`, 0.02.
- **Required result:** UNCHANGED, every paired delta exactly 0, an interval of zero width,
  NO_RECOMMENDATION. Anything else is a model error, not a finding.
- **Watch:** the fleet-state stack, which always sums to the fleet (P15).
- **Lesson:** confirm the instrument reads "no change" before trusting a change.
- **PRD:** FLEET-001. **First build:** Experiment preset. **Chart:** fleet-state stack.

### UC-02 How many cars does San Jose need?
- **Experiment:** axis `parameter:SUP-1.SJ`, baseline 16, candidate 24. Primary `wait.p90_s` scoped to SJ, day 1 07:00-09:00, margin 60 s. Guardrails `unserved.fraction`, 0.01; `unserved.fraction` scoped to SF,
  0.01.
- **Watch:** SJ available cars against SJ waiting riders, day 1 07:00-09:00.
- **Mechanism:** a queue near saturation; waits climb steeply as busy time approaches supply, then level off
  once cars are usually free.
- **Expected by reasoning:** 24 cars lower SJ's morning-peak wait against 16. **Measured** at the 120-car default
  (seed set 1): IMPROVED, ADVANCE_TO_NEXT_TEST, mean delta -743.0 s. In the evening peak San Jose had almost no free cars
  in either arm and the primary did not respond, so the preset reads the morning peak.
- **Lesson:** extra cars help most where supply is shortest. Seeing the knee of the curve needs a descriptive
  sweep, which is later; its chart would say "the knee of this toy model's curve, not a sizing recommendation" (H-6).
- **First build:** Experiment preset. **Chart:** Metric by hour, `wait.p90_s` scoped to SJ for each arm, above
  Available cars by area (SJ panel), on one time axis (§7.5).

### UC-03 Rider patience and the population trap
- **Experiment:** axis `parameter:RID-1`, baseline 20 min, candidate 5 min. Primary `wait.p90_s`, margin
  30 s. Guardrail `unserved.fraction`, 0.01.
- **Watch:** waiting riders giving up before a car is assigned; `wait.population_n` beside the wait value.
- **Mechanism:** wait percentiles count completed rides only, so impatient riders leave the population.
- **Expected by reasoning:** the primary reads IMPROVED; the guardrail regresses; HOLD. **Measured:** IMPROVED, HOLD
  (mean delta -572.8 s; unserved harm 0.0179 against 0.01). At 10 min against 0.02 the harm stayed within its limit.
- **Lesson:** read who a metric counts; that is why every primary has guardrails.
- **First build:** Experiment preset. **Chart:** Arm comparison (§7.5), two panels: `wait.p90_s` in minutes, and
  `wait.population_n`.

### UC-04 Peak and off-peak with the same fleet (Learn case L1)
- **Experiment:** axis `parameter:DEM-5`, baseline `flat`, candidate `peaked` (the same total requests over the
  window). Primary `wait.p90_s` scoped to day 1 16:00-19:00, margin 60 s. Guardrail `unserved.fraction`, 0.02.
- **Watch:** the At a depot band at 20:30 against the 17:00 hour: the peak pulls parked cars out of depots and visits
  land after it.
- **Mechanism:** visits come due fastest in the peak but land after it. Demand concentration carries most of the effect:
  with visits all but switched off (DEP-7 at 100) the verdict is still REGRESSED, and the delta falls from 3,479 s to
  2,220 s.
- **Learn preset:** the Bay teaching map with San Francisco off-peak requests lowered from 15 to 8 per hour (DEM-2.SF,
  the value PEN and EB use), so the demand strip shows a sharper peak; fleet, peak rates, peak windows and the peaked
  shape are unchanged.
- **Expected by reasoning:** the evening-peak window is higher, and the effect lasts past 19:00. A probe of the teaching
  model at sigma 0 also moved the whole-window wait, so no caption may say the whole window barely moves. **Measured:**
  REGRESSED, HOLD, mean delta +3,479 s, with the unserved guardrail regressed.
- **Lesson:** averages hide peaks, and trip-count servicing adds to a peak's cost after it.
- **PRD:** uses the §10.1 demand model. FleetLab cannot run this axis today: its demand axes are silently
  inert (§14, FL-1). **First build:** Learn case. **Chart:** the demand strip (requests per hour) above the fleet-state stack,
  whose At a depot band counts cars at depots, on one time axis (§7.5).

### UC-05 End-of-day highway slowdown
- **Experiment:** axis `parameter:RD-3.highway.evening`, baseline ×1.0, candidate ×1.6 (both directions,
  16:00-19:00). Primary `wait.p90_s` scoped to SJ, day 1 17:00-20:00, margin 60 s. Guardrails
  `unserved.fraction`, 0.01; `fleet.available_fraction`, 0.02.
- **Watch:** chevrons on H2 and H4 at 17:30; cars heading to SF-1 and when they are ready; the time-to-ready
  row among the descriptive deltas.
- **Mechanism:** congestion stretches empty drives to pickups and depots as well as trips, so cars return to
  service later.
- **Expected by reasoning:** time to ready rises clearly; with σ 0.15 the primary may be INCONCLUSIVE.
- **Lesson:** traffic costs availability through empty drives, and INCONCLUSIVE is an honest answer.
- **PRD:** P1 "travel-time slowdown". **First build:** Experiment preset (a route-choice policy is later).
  **Chart:** Metric by hour (§7.5), two panels on one time axis: `exposure.congested_empty_s` by hour, and
  `depot.turnaround_p90_s` by arrival hour.

### UC-06 Planned and realized traffic
- **Lesson:** the error in a declared plan, not only the traffic, decides who is served. **First build:**
  later (needs the planning profile, §5.2.3).

### UC-07 Home depot or nearest depot? (the worked example; Learn case L3)
- **Situation:** §3.5. The morning release at day 2 05:45 (POL-4) is part of the scenario in both arms.
- **Experiment:** axis `policy:depot_assignment`, baseline `home_depot`, candidate `nearest_depot`. Primary
  `wait.p90_s` scoped to SF, day 2 07:00-09:00, margin 60 s. Guardrails `exposure.congested_empty_s`, 0 s (any
  increase is harm); `depot.parking_peak_fraction` scoped to SJ-1, 0.10; `unserved.fraction`, 0.01.
- **Watch:** pin SF-005; at 17:14 open the fork, which shows two full runs on the same world (D-10) with the
  caption "every other car also differs between A and B"; 21:00, SJ-1's lot in B; day 2 05:45, the release;
  day 2 07:15, SF available cars in each lane; both depot boards on one clock (the depot move, seed 1006).
- **Mechanism:** the depot choice decides when the empty drive is paid (in congestion tonight, in free flow
  tomorrow) and which depot absorbs the work.
- **Expected by reasoning:** for the first cars, `nearest_depot` gives fewer congested minutes and earlier
  readiness; as SJ-1's lot fills, later cars divert north in congestion and the SF morning wait can end higher,
  which regresses the primary or the exposure guardrail and gives HOLD. A follow-up with
  `nearest_depot_with_capacity` separates capacity from distance. **Measured** at the 120-car default: `nearest_depot`
  lowers SF's day 2 07:00 to 09:00 wait p90 (seed set 1: mean delta -646.5 s, interval [-949.7, -341.8]; seed sets 2 and
  3 agree) with every guardrail within its limit, because under `home_depot` SF cars recalled overnight queue at SF-2's two
  cleaning bays. With 90 cars the same spec read REGRESSED, HOLD. The capacity trade-off above needs a busier SJ-1 than the
  default gives, and no Learn caption states either direction (H-9).
- **Lesson:** the right depot depends on tonight's depot capacity and the fleet's slack for tomorrow's first peak, not on
  tonight's distance.
- **PRD:** §13.4 service and depot assignment. **First build:** Learn case. **Chart:** a two-lane timeline for SF-005 (A above B) with a strip of SF available cars for day 2 06:00-09:00 on the same time axis.

### UC-08 Depot throughput
- **Measured anchor (FleetLab):** FLEET-005, committed as `config/fleet/fleet-005-turnaround.yaml`: 40 cars,
  3 zones, 24 requests per zone per hour, 6 service bays, service 1800 s to 2250 s, seeds 101-110, margin 30 s.
  REGRESSED: `wait.p90_s` mean delta +826.1 s, 95% interval [+735.9, +919.2]; `unserved.fraction` +0.057
  against 0.02; HOLD. The first build shows this record as a quoted, labelled reference panel. Running it end to
  end inside the playground needs all ten FleetLab worlds exported (D-03 option); the first build exports seed
  101 for parity.
- **Teaching-engine presets (Bay teaching map):** UC-08a, axis `parameter:DEP-3.SF-1` 4 to 6; UC-08b, axis
  `parameter:DEP-4` 20 min to 15 min. Each: primary `wait.p90_s`, margin 30 s; guardrail `unserved.fraction`, 0.02.
- **Watch:** the SF-1 board from day 2 00:30 to 05:45, where its bay wait moves; between 16:00 and 20:00 SF-1 is nearly
  idle, so the street primary cannot move.
- **Mechanism:** only the binding resource moves throughput; near saturation a small change to time per car has
  an outsized effect on the street.
- **Expected by reasoning:** when SF-1's lot is the limit, more bays change little and a shorter clean helps.
  **Measured:** UC-08a UNCHANGED (mean delta -3.4 s); UC-08b INCONCLUSIVE (-32.2 s). At the default no depot resource binds
  while riders need cars, so the lesson shows as "more bays change little", not as a binding resource on the street.
- **Lesson:** find the binding depot resource before adding capacity.
- **PRD:** FLEET-005, FLEET-004. **First build:** Experiment presets UC-08a and UC-08b (the staff arm is later, D-06).
  **Chart:** the SF-1 depot board (bays in use, stalls held) above Available cars by area (SF panel), on one time
  axis (§7.5).

### UC-09 Bays are not always the bottleneck (Learn case L2)
- **Exploratory anchor (FleetLab):** the two-zone probe in Appendix A: San Francisco and San Jose 3000 s apart,
  25 cars, 18 requests per zone per hour, rider patience 1200 s, service every 6 trips for 1800 s, bays 4 to 2,
  seeds 301-310, margin 60 s, guardrail `unserved.fraction` 0.02. Result, re-run on 2026-09-13 at `bca4ccd`
  with spec digest `e8f30fec61b7`: VALID; UNCHANGED, with every paired delta 0.0 and an interval of [0, 0];
  `unserved.fraction` delta 0.0; NO_RECOMMENDATION. Descriptively, `depot.queue_p90_s` rose from 146.3 s to
  2,628.2 s, while 97.3 of 229.0 requests per replication went unserved in both arms: the fleet was far too
  small for the demand, so cars, not bays, were scarce. Declaring the queue as a guardrail with a maximum harm of
  600 s would give HOLD, which follows from its +2,481.8 s delta.
- **The Learn case** runs the teaching engine's own version on the Bay teaching map, labelled "shaped like an
  exploratory FleetLab run; these numbers are the teaching model's own". **Experiment:** axis
  `parameter:DEP-3.SJ-1`, baseline 3, candidate 1, with SUP-1 SJ at 12 cars and trips between depot visits (DEP-7) at 5 in both arms, so SJ is short of cars
  and SJ-1 is visited inside the primary window. Primary `wait.p90_s` scoped to SJ, day 1 16:00-19:00, margin 60 s. Guardrail `unserved.fraction`, 0.02.
  A second preset is the same spec plus one guardrail, `depot.bay_wait_p90_s` scoped to SJ-1 with a maximum harm
  of 600 s. Both are preregistered and frozen before either runs; neither is edited after a result.
- **Expected by reasoning:** the first spec's primary stays near its margin while SJ-1's bay wait rises; the
  second spec can read HOLD on its added guardrail. On screen those words appear only as run results, or in a
  caption once a fixture test asserts them (H-9). **Measured:** L2a INCONCLUSIVE, RUN_MORE_EXPERIMENTS (mean delta
  +25.3 s, interval [-135.3, +209.2]); L2b INCONCLUSIVE, HOLD on its bay-wait guardrail.
- **Mechanism:** a constraint that does not bind does not show in the outcome.
- **Lesson:** a flat primary can mean another constraint binds, and what you preregister decides what counts.
- **Note:** the same FleetLab run reported a utilization of 1.1166, which is a metric defect (§14, FL-2), never a
  result.
- **PRD:** FLEET-004. **First build:** Learn case. **Chart:** the verdict's paired-delta strips for `wait.p90_s`
  (with its margin band) and `depot.bay_wait_p90_s` at SJ-1, side by side, each with its own axis (§7.5).

### UC-10 Pool the bays or spread them?
- **Experiment:** axis `parameter:DEP-3` as named layouts with the same total, baseline `SF-1: 6, SJ-1: 1`,
  candidate `SF-1: 4, SJ-1: 3`, with depot assignment `nearest_depot_with_capacity` in both arms. Primary
  `wait.p90_s`, margin 30 s. Guardrails `vehicle.empty_drive_fraction`, 0.02; `depot.parking_peak_fraction` scoped to SJ-1, 0.10; `depot.bay_wait_p90_s` scoped to
  SJ-1, 600 s.
- **Watch:** SJ-1's bay wait for arrivals from 16:00 to 18:00 in each arm, and SF-1's whole-run bay wait in layout B.
- **Mechanism:** bays set how fast a depot empties its lot. With one bay SJ-1's lot fills, and under
  `nearest_depot_with_capacity` later SJ cars drive to another depot; with three, more of them stay.
- **Expected by reasoning:** layout A gives SJ-1 a longer bay wait, a fuller lot and more empty driving to other
  depots; layout B moves that pressure to SF-1 during SF's own return wave. **Measured:** IMPROVED,
  ADVANCE_TO_NEXT_TEST (mean delta -193.0 s): one bay saturates SJ-1 overnight, and three move that pressure to SF-1.
- **Lesson:** splitting capacity trades pooling for proximity; check the smaller site's peak.
- **First build:** Experiment preset. **Chart:** Metric by hour, `depot.bay_wait_p90_s` for SF-1 and SJ-1 on
  shared axes (§7.5); the empty-drive fraction reads as its guardrail row.

### UC-11 to UC-16 (later)
| Use case | Lesson | Needs |
|---|---|---|
| UC-11 Charging and stranded cars | a safe battery rule can starve the street; charging is a capacity problem | D-02 |
| UC-12 End-of-day repositioning | empty driving now buys availability tomorrow, and timing matters as much as targets | repositioning policies |
| UC-13 An event lets out | a surge spreads wider than the event, because nearest-car dispatch borrows from neighbours | surge knob |
| UC-14 The shift-change gap | a short capacity dip builds a backlog that lands in the next peak | D-06 |
| UC-15 Soiled-vehicle rate | rare unscheduled removals matter once the resource they need is nearly full | soiled trips, deep clean |
| UC-16 Dispatch rule change | a greedy rule trades median riders against tail riders, and the guardrail decides | dispatch variants |

### 4.4 Operations casebook (OPS-01 to OPS-20)

Built on 2026-09-14 and 2026-09-15, after the first build. The casebook is twenty situations an operations lead meets, in
five themes of four cases each: San Francisco core operations, launching a new service area, rain, busy areas with many
people, and police activity and emergency response. Each case is an Experiment preset of kind `ops` (contract decision
41), built from one record in `src/model/ops-cases.js` exactly as the presets above are, with the record's copy attached.
The Experiment preset chooser lists the casebook as one group per theme, and for a casebook preset the setup sheet shows a
SITUATION block above its six blocks (§7.2). Every number in the casebook is invented, and every verdict is a teaching
result (H-1, H-4).

**The proxy discipline.** The model has no rain, crowds, police, incidents, venues or closures (§5.8). Each case is a
proxy built from the knobs of §2: a slowdown becomes a congestion scaling or a longer pickup time, an event becomes a
demand knob, cars held at scenes become fewer cars for the whole run, a closure becomes a longer route time. Each proxy
part on the page says what it stands for, how it is set (the knob and its value) and what it misses, and each case
carries an "Outside this model" list of what it cannot show. A proxy holds for the whole run, or for the named hours
where the knob is a congestion row, so most casebook worlds are harsher than the situation they stand for; the copy
says so where it matters (the rain world below).

**The slug rule.** A record's slug is its scenario name, and the scenario name keys the demand trace (§5.2.2), so every
baseline number belongs to its slug: two cases on the same map draw different request streams, and their baselines
differ a little. Renaming a slug moves its numbers, so slugs are frozen with their measured verdicts, and the test
asserts every slug against the pins. The launch cases were also run under two other names each, to see whether a
verdict depends on the draw; where it does, the lesson says so (OPS-08). Those runs are exploratory: their slugs are
not pinned, so the claim rests on the calibration record, not on a test.

**Seed sets and pins.** Every spec ran on seed sets 1 to 3 (20 paired seeds each, σ 0.15, 2,000 resamples).
`test/ops-cases.test.mjs` pins every spec verbatim, by its digest, and, for seed set 1, every verdict, mean delta,
interval and guardrail status and harm to `test/ops-cases.pins.json`, exactly, as the doubles the deterministic runs
give; seed sets 2 and 3 run under `FLEET_PLAYGROUND_PERF=1`, and a test requires all three sets to agree on outcome and
recommendation. What is pinned is what the tables below print: the outcome, the recommendation, the mean delta, the
interval and each guardrail's status and harm, and a test holds each rounded table number to its exact pinned double.
Every lesson direction (lower, higher, no clear change, and the guardrail statuses) is one of those pinned results and
holds on all three sets. The other figures quoted in the lessons, in "What did not show" and in the world paragraphs
(per-window or per-depot descriptive means, queue clear times, unfinished visits, lot occupancy, the launch world's
comparison) are calibration notes: measured by the calibration and review scripts on seed set 1 from the same frozen
specs, reproduced by the review, but held in no pin and asserted by no test. Two lesson claims rest on runs whose specs
are not pinned at all and say so: OPS-08's other demand draws and OPS-12's SF-2 contrast are **Exploratory** in the §4
sense. Both files are generated from the casebook's calibration records by a port script kept outside the repository,
which carries the spec, the measured blocks and the lesson text and nothing else, so a change to a record re-derives
the pins first.

**H-9 on the page.** The copy a casebook preset shows (title, situation, question, proxy parts, watch, outside the
model) never names a verdict or a direction; a test asserts that, with the H-3 and H-6 word rules and the dash rule.
The verdicts and the lessons are here, beside the pins, so a reader who runs a preset sees the numbers this section
quotes. A review re-ran every case from its recorded base and experiment and reproduced every measured block; a
cross-theme critique then replaced one case (OPS-19, whose earlier version duplicated the rain clean-time case) and
moved another onto the home depot rule (OPS-20), and a last pass rewrote the on-page copy so that each Watch line names
the primary against its margin and each guardrail against its maximum harm, with setup facts only.

**Shared worlds.** OPS-01 to OPS-04, OPS-13, OPS-14, OPS-16 and OPS-17 to OPS-20 run on the Bay teaching map as it ships (§2.9:
San Francisco 40 cars with 60 requests per hour in the 07:00 to 09:00 and 16:00 to 19:00 peaks and 15 off peak, SF-1 and
SF-2 as home depots for San Francisco and Peninsula cars, a depot visit every 10 trips, the recall at 00:30 on day 2 and
the release at 05:45, each acting once) under its home depot rule. The other nine share three worlds:

- **The launch world (OPS-05 to OPS-08).** East Bay stands in for a newly opened service area. San Francisco, Peninsula
  and San Jose stay as the map sets them; East Bay has 12 cars instead of 24 (SUP-1.EB 12), a 10 minute pickup and
  in-area trip time instead of 7, for pickups spread over a wider area (RD-2.EB 600), and EB-1 as a small temporary depot
  with 12 stalls, 1 cleaning bay and 1 service bay (DEP-2.EB-1 12, DEP-3.EB-1 1, DEP-5.EB-1 1); OPS-08 cuts the lot to 6
  stalls (DEP-2.EB-1 6) so that it overflows. East Bay demand stays at plan, 30 requests per hour in peaks and 8 outside
  them. As a calibration note (seed set 1, descriptive means, held in no pin), the launch world moves East Bay unserved
  from 5.6 to 9.0 percent, San Francisco unserved from 5.5 to 9.2 percent (nearest idle dispatch borrows San Francisco
  cars), whole run unserved from 5.3 to 8.8 percent, and East Bay wait p90 from day 1 07:00 to 09:00 from 1,097.7 s to
  2,466.7 s.
- **The rain world (OPS-09 to OPS-12).** On day 1 from 13:00 to 23:00 every highway, local and in-area congestion row is
  multiplied by 1.35, capped at ×3.0, so a ×1.6 evening highway becomes ×2.16 and a ×1.3 local peak becomes ×1.755.
  Pickups and in-area trips take 2 minutes longer in every area (RD-2: SF 480 s, PEN 600 s, SJ 600 s, EB 540 s) and
  San Francisco requests rise about 25 percent (DEM-1.SF 75 per hour in peaks, DEM-2.SF 19 off peak). The model cannot
  limit pickup time or demand to the rain hours, so those two changes last all day on both days and make the world
  harsher than the rain alone. OPS-09 leaves the pickup change out of its base and makes San Francisco pickup time its
  axis; OPS-12 adds 30 minute cleans (DEP-4 1800) to the base.
- **The event world (OPS-15, and the candidate arm of OPS-14).** San Francisco peak requests of 90 per hour instead of 60 (DEM-1.SF), a knob
  that applies to both peak windows on both days, with the map's default destination mix (84 of every 100 San Francisco
  evening peak trips leave San Francisco). In OPS-14 the event is the axis; in OPS-15 it is the base and the neighbouring
  area adds cars.

Every case has one axis, a primary with an equivalence margin and one to three guardrails each with a maximum harm, in
the grammar of §2.8; a scope reads as an area and a window of the map's clock. The tables and the lesson list below are
generated from the pins, never retyped; "agree" in the last column means seed sets 2 and 3 gave the same outcome and
recommendation as set 1, with their mean deltas in brackets.

#### San Francisco core operations

| Case | Axis (baseline, candidate) | Primary, margin | Guardrails, max harm | Measured, seed set 1 | Sets 2 and 3 |
|---|---|---|---|---|---|
| OPS-01 Evening crunch: more cars in San Francisco | `parameter:SUP-1.SF` 40, 52 | `wait.p90_s` (SF, day 1 16:00 to 19:00), 60 s | `depot.bay_wait_p90_s` (SF-2), 1800 s; `wait.p90_s` (SF, day 2 07:00 to 09:00), 120 s | IMPROVED, HOLD; mean delta -1565.6 s, interval [-1922.4 s, -1149.4 s]; depot.bay_wait_p90_s{depot=SF-2} REGRESSED | agree (-1753.0 s, -1913.2 s) |
| OPS-02 Late night recall: 00:30 or 02:00 | `parameter:POL-3` 88200, 93600 | `wait.p50_s` (SF, day 2 00:30 to 02:00), 60 s | `wait.p90_s` (SF, day 2 07:00 to 09:00), 120 s; `depot.bay_wait_p90_s` (SF-2), 1800 s | IMPROVED, ADVANCE_TO_NEXT_TEST; mean delta -357.9 s, interval [-429.2 s, -292.2 s]; every guardrail within | agree (-335.1 s, -301.0 s) |
| OPS-03 Defer depot visits through the evening peak | `parameter:DEP-7` 10, 15 | `unserved.fraction` (SF, day 1 16:00 to 19:00), 0.01 | `wait.p90_s` (SF, day 1 16:00 to 19:00), 120 s; `depot.bay_wait_p90_s` (SF-2), 1800 s; `wait.p90_s` (SF, day 2 07:00 to 09:00), 120 s | IMPROVED, ADVANCE_TO_NEXT_TEST; mean delta -0.0323, interval [-0.0424, -0.0222]; every guardrail within | agree (-0.0430, -0.0329) |
| OPS-04 Release cars to home areas earlier | `parameter:POL-4` 107100, 104400 | `wait.p90_s` (SF, day 2 07:00 to 09:00), 30 s | `wait.p90_s` (PEN, day 2 07:00 to 09:00), 120 s; `exposure.congested_empty_s` (day 2 05:00 to 10:00), 3600 s | INCONCLUSIVE, RUN_MORE_EXPERIMENTS; mean delta +63.7 s, interval [+22.6 s, +118.1 s]; every guardrail within | agree (+39.3 s, +50.8 s) |

#### Launching a new service area

| Case | Axis (baseline, candidate) | Primary, margin | Guardrails, max harm | Measured, seed set 1 | Sets 2 and 3 |
|---|---|---|---|---|---|
| OPS-05 Launch fleet size with a 12 stall depot | `parameter:SUP-1.EB` 12, 18 | `wait.p90_s` (EB, day 2 07:00 to 09:00), 60 s | `unserved.fraction` (EB), 0.01; `depot.diversions` (EB-1), 0.000002; `depot.bay_wait_p90_s` (EB-1), 1800 s | IMPROVED, HOLD; mean delta -412.5 s, interval [-641.4 s, -171.4 s]; depot.diversions{depot=EB-1} REGRESSED, depot.bay_wait_p90_s{depot=EB-1} REGRESSED | agree (-637.1 s, -396.0 s) |
| OPS-06 Launch demand above plan | `parameter:DEM-1.EB` 30, 45 | `wait.p90_s` (EB, day 1 07:00 to 09:00), 60 s | `unserved.fraction` (EB), 0.01; `unserved.fraction` (SF), 0.01 | REGRESSED, HOLD; mean delta +951.0 s, interval [+748.3 s, +1182.3 s]; unserved.fraction{area=EB} REGRESSED, unserved.fraction{area=SF} REGRESSED | agree (+941.5 s, +1042.4 s) |
| OPS-07 One cleaning bay or three at the launch depot | `parameter:DEP-3.EB-1` 1, 3 | `wait.p90_s` (EB, day 2 07:00 to 09:00), 60 s | `depot.bay_wait_p90_s` (EB-1), 600 s; `fleet.available_fraction` (EB, day 2 06:00 to 09:00), 0.02; `unserved.fraction` (EB), 0.01 | INCONCLUSIVE, RUN_MORE_EXPERIMENTS; mean delta +146.5 s, interval [-19.5 s, +321.8 s]; every guardrail within | agree (+14.3 s, +57.7 s) |
| OPS-08 Launch lot overflow: nearest depot with a free stall | `policy:depot_assignment` home_depot, nearest_depot_with_capacity | `wait.p90_s` (EB, day 2 07:00 to 09:00), 60 s | `exposure.congested_empty_s`, 18000 s; `depot.parking_peak_fraction` (SF-1), 0.1; `depot.bay_wait_p90_s` (SF-1), 600 s | INCONCLUSIVE, HOLD; mean delta +71.9 s, interval [-123.7 s, +257.2 s]; depot.parking_peak_fraction{depot=SF-1} REGRESSED, depot.bay_wait_p90_s{depot=SF-1} REGRESSED | agree (+108.6 s, +36.7 s) |

#### Rain

| Case | Axis (baseline, candidate) | Primary, margin | Guardrails, max harm | Measured, seed set 1 | Sets 2 and 3 |
|---|---|---|---|---|---|
| OPS-09 Rain: slower curbside pickups in San Francisco | `parameter:RD-2.SF` 360, 540 | `wait.p90_s` (SF, day 1 16:00 to 19:00), 60 s | `unserved.fraction`, 0.01; `unserved.fraction` (SF, day 1 16:00 to 19:00), 0.02 | INCONCLUSIVE, HOLD; mean delta -126.7 s, interval [-398.7 s, +138.6 s]; unserved.fraction REGRESSED | agree (-2.1 s, +180.9 s) |
| OPS-10 Rain: more cars for San Francisco | `parameter:SUP-1.SF` 40, 48 | `unserved.fraction`, 0.005 | `fleet.available_fraction` (day 2 06:00 to 07:00), 0.02; `depot.blocked_s` (SF-2), 0 s; `vehicle.empty_drive_fraction`, 0.02 | IMPROVED, ADVANCE_TO_NEXT_TEST; mean delta -0.0299, interval [-0.0323, -0.0269]; every guardrail within | agree (-0.0308, -0.0295) |
| OPS-11 Rain: wet interiors and 30 minute cleans | `parameter:DEP-4` 1200, 1800 | `wait.p90_s` (SF, day 2 07:00 to 09:00), 60 s | `unserved.fraction`, 0.01; `fleet.available_fraction` (day 2 06:00 to 07:00), 0.02; `depot.bay_wait_p90_s` (SF-2), 900 s | INCONCLUSIVE, HOLD; mean delta -1.3 s, interval [-328.1 s, +320.8 s]; fleet.available_fraction{window=108000-111600} REGRESSED, depot.bay_wait_p90_s{depot=SF-2} REGRESSED | agree (+173.4 s, -3.9 s) |
| OPS-12 Rain: add bays where the queue reaches riders | `parameter:DEP-3.SJ-1` 3, 5 | `wait.p90_s` (SF, day 2 07:00 to 09:00), 60 s | `unserved.fraction`, 0.01; `vehicle.empty_drive_fraction`, 0.02; `wait.p90_s` (SJ, day 2 07:00 to 09:00), 120 s | IMPROVED, ADVANCE_TO_NEXT_TEST; mean delta -550.8 s, interval [-777.1 s, -311.2 s]; every guardrail within | agree (-436.1 s, -392.2 s) |

#### Busy areas with many people

| Case | Axis (baseline, candidate) | Primary, margin | Guardrails, max harm | Measured, seed set 1 | Sets 2 and 3 |
|---|---|---|---|---|---|
| OPS-13 Crowded curbs slow every downtown pickup | `parameter:RD-2.SF` 360, 600 | `wait.p90_s` (SF, day 1 07:00 to 09:00), 60 s | `unserved.fraction` (SF), 0.01; `wait.p90_s` (SF, day 1 16:00 to 19:00), 120 s | REGRESSED, HOLD; mean delta +1037.5 s, interval [+897.8 s, +1166.3 s]; every guardrail within | agree (+1071.2 s, +1030.7 s) |
| OPS-14 An event lets out in San Francisco | `parameter:DEM-1.SF` 60, 90 | `unserved.fraction` (EB, day 1 16:00 to 19:00), 0.01 | `wait.p90_s` (EB, day 1 16:00 to 19:00), 120 s; `unserved.fraction` (SF, day 1 16:00 to 19:00), 0.02 | REGRESSED, HOLD; mean delta +0.1452, interval [+0.1210, +0.1699]; unserved.fraction{area=SF,window=57600-68400} REGRESSED | agree (+0.1425, +0.1661) |
| OPS-15 The neighbour adds cars for an event next door | `parameter:SUP-1.EB` 24, 32 | `unserved.fraction` (EB, day 1 16:00 to 19:00), 0.01 | `depot.bay_wait_p90_s` (EB-1), 1800 s; `depot.parking_peak_fraction` (EB-1), 0.1; `unserved.fraction` (SF, day 1 16:00 to 19:00), 0.01 | IMPROVED, HOLD; mean delta -0.0528, interval [-0.0725, -0.0337]; depot.bay_wait_p90_s{depot=EB-1} REGRESSED, depot.parking_peak_fraction{depot=EB-1} REGRESSED | agree (-0.0596, -0.0612) |
| OPS-16 Streets full of people in the evening peak | `parameter:RD-3.in_area.evening` 1300, 2000 | `unserved.fraction` (day 1 17:00 to 20:00), 0.01 | `wait.p90_s` (SF, day 1 17:00 to 20:00), 120 s; `exposure.congested_loaded_s` (day 1 17:00 to 20:00), 3600 s; `unserved.fraction`, 0.01 | REGRESSED, HOLD; mean delta +0.0576, interval [+0.0462, +0.0691]; exposure.congested_loaded_s{window=61200-72000} REGRESSED, unserved.fraction REGRESSED | agree (+0.0535, +0.0581) |

#### Police activity and emergency response

| Case | Axis (baseline, candidate) | Primary, margin | Guardrails, max harm | Measured, seed set 1 | Sets 2 and 3 |
|---|---|---|---|---|---|
| OPS-17 Highway closure between SF and the Peninsula | `parameter:RD-1.H1` 1500, 5400 | `wait.p90_s` (PEN, day 1 07:00 to 09:00), 60 s | `unserved.fraction` (PEN), 0.01; `exposure.congested_empty_s` (PEN), 18000 s; `depot.diversions` (SJ-1), 0 | REGRESSED, HOLD; mean delta +709.8 s, interval [+298.7 s, +1170.2 s]; unserved.fraction{area=PEN} REGRESSED, exposure.congested_empty_s{area=PEN} REGRESSED, depot.diversions{depot=SJ-1} REGRESSED | agree (+943.7 s, +915.1 s) |
| OPS-18 Cars held at incident scenes in San Francisco | `parameter:SUP-1.SF` 40, 34 | `wait.p90_s` (SF, day 2 07:00 to 09:00), 60 s | `unserved.fraction` (SF), 0.01; `wait.p90_s` (PEN, day 2 07:00 to 09:00), 300 s | REGRESSED, HOLD; mean delta +860.6 s, interval [+620.8 s, +1098.6 s]; wait.p90_s{area=PEN,window=111600-118800} REGRESSED | agree (+806.7 s, +692.0 s) |
| OPS-19 A service check every second depot visit | `parameter:DEP-8` 3, 2 | `wait.p90_s` (SF, day 2 07:00 to 09:00), 60 s | `unserved.fraction` (SF), 0.01; `fleet.available_fraction` (day 2 06:00 to 07:00), 0.02; `depot.censored_visits` (SF-2), 0.000001 | REGRESSED, HOLD; mean delta +841.0 s, interval [+605.0 s, +1059.5 s]; unserved.fraction{area=SF} REGRESSED, fleet.available_fraction{window=108000-111600} REGRESSED, depot.censored_visits{depot=SF-2} REGRESSED | agree (+833.3 s, +715.7 s) |
| OPS-20 A staging area on two thirds of the SF-1 lot | `parameter:DEP-2.SF-1` 60, 20 | `wait.p90_s` (SF, day 2 07:00 to 09:00), 60 s | `depot.diversions`, 0; `vehicle.empty_drive_fraction`, 0.01 | UNCHANGED, HOLD; mean delta -14.0 s, interval [-32.7 s, +3.5 s]; depot.diversions REGRESSED | agree (-17.9 s, -19.4 s) |

#### Lessons (measured on the frozen specs above; each direction holds on seed sets 1 to 3)

- **OPS-01.** Twelve more San Francisco cars give lower evening rider wait and higher overnight bay wait, turnaround and parking at SF-2, and since the next morning still improves, the HOLD rests on the 30 minute allowance granted to the overnight depot queue rather than on the street.
- **OPS-02.** A 02:00 recall gives lower late night wait for San Francisco riders and higher overnight bay wait at SF-2 as the later wave catches more cars, with no next morning change the runs can separate from noise.
- **OPS-03.** A visit every 15 trips gives a lower unserved share in the San Francisco evening peak and a higher whole run bay wait p90 at SF-2 that is in good part composition, because the near zero wait day visits that used to dilute the overnight tail are gone; so read depot percentiles by window and judge a change that serves more riders by the unserved share, not by the served rider wait alone.
- **OPS-04.** An earlier release gives lower ready stock at SF-1 and SF-2 before the peak and higher San Francisco morning wait by an amount the runs cannot size against a 30 s margin, while Peninsula wait does not change, so an earlier release is not earlier readiness.
- **OPS-05.** Lower East Bay rider wait p90 on the second morning and lower East Bay unserved, higher EB-1 bay wait and more cars turned away at EB-1: added launch cars also have to park and clean at a 12 stall, one bay depot, and those guardrails hold the change.
- **OPS-06.** Demand above plan on a 12 car launch fleet gives higher East Bay wait and unserved and higher San Francisco unserved too, because dispatch borrows San Francisco cars: a launch guardrail belongs in the neighbouring area as well.
- **OPS-07.** A one bay launch depot shows a long overnight queue on the depot board, but the queue clears before the morning release and cars ready earlier are dispatched away overnight, so 3 bays leave East Bay rider wait on the second morning INCONCLUSIVE on every seed set: check when a depot queue happens, and where ready cars go, before adding bays.
- **OPS-08.** A depot rule chosen for one launch lot moves the whole fleet: fewer cars turned away at EB-1, more East Bay cars cleaning and sleeping at SF-1 and SJ-1, higher SF-1 lot peak and bay wait as SF-2 empties, while East Bay rider wait on the second morning reads INCONCLUSIVE on every seed set, and REGRESSED on 1 of 2 other demand draws in exploratory runs under other slugs, which are not pinned.
- **OPS-09.** When the primary window is one the axis cannot reach, the verdict reads no clear change while the harm is displaced: in the rain world a slower San Francisco curb leaves the evening tail where cross area pickups put it, raises San Francisco day 1 morning unserved from 3.4 to 13.1 requests and whole run unserved in San Jose and the Peninsula from 40.2 to 47.9 and 28.0 to 32.6, and only the whole run unserved guardrail holds the change, lower sensitivity in the evening window, higher harm in the morning and in the neighbouring areas.
- **OPS-10.** In this model 8 more San Francisco cars give lower unserved and a fleet still ready at the 05:45 release, with a higher SF-2 overnight bay wait and a fuller SF-2 lot, and they add more than twice as many served rides in the rain world as in the dry map, but most of that extra comes from the higher San Francisco demand the proxy keeps outside the rain hours.
- **OPS-11.** Longer cleans spend the overnight slack before riders feel it: at 30 minutes the day 2 morning San Francisco wait reads no clear change on all three seed sets, while the SF-2 bay wait and the 06:00 readiness guardrails already regress.
- **OPS-12.** The depot with the longest queue is not always where bays help riders: in this model 2 more bays at SJ-1 lower San Francisco morning wait p90 on all three seed sets, because San Jose cars that finish their cleans hours earlier take overnight San Francisco trips and stand in San Francisco by 07:00, while the same 2 bays at SF-2 read no clear change in an exploratory contrast run that is not pinned.
- **OPS-13.** In this model a slower curb shows where trips stay inside the area: the San Francisco morning wait p90 rises by about 17 minutes on every seed set, while the evening tail, set by cars from other areas, stays inside its 2 minute guardrail.
- **OPS-14.** In this model a demand surge in one area spills into its neighbours through shared cars: East Bay leaves about 15 more of every 100 evening peak requests unserved while its wait p90 stays within 2 minutes, so the neighbour's unserved fraction shows the spillover and its wait tail does not.
- **OPS-15.** In this model cars added in a neighbouring area to protect it are borrowed into the event area: 8 more East Bay cars give lower unserved in both East Bay and San Francisco, and a higher overnight bay wait and a fuller lot at EB-1, the one depot that homes them.
- **OPS-16.** In this model a slowdown inside every area at once shows up as riders left unserved in all four areas, about 5 more of every 100 across the map from 17:00 to 20:00, and as more rider time in slow traffic, while the San Francisco evening wait tail, set by cars from other areas, gives no clear direction.
- **OPS-17.** Closing H1 raises Peninsula wait p90 in the day 1 morning peak by 709.8 to 943.7 s across the three seed sets, more than in the evening, because its cars have left for San Francisco and must come back on L1, and because depot homes follow route times it also sends Peninsula depot visits to SJ-1, lower SF-2 overnight bay wait, higher SJ-1 parking and diversions.
- **OPS-18.** Six cars held all run leave the day 1 morning unchanged, because San Francisco starts it with spare idle cars, but raise San Francisco wait p90 on the day 2 morning by 692.0 to 860.6 s across the three seed sets, when fewer spare cars are ready: lower fleet, higher next morning wait.
- **OPS-19.** In this model a service check every second depot visit instead of every third makes the single service bay at SF-2 the overnight bottleneck (its service bay wait p90 1,257.0 to 14,446.4 s while its cleaning bay wait stays near 8,403.8 s) and raises the San Francisco day 2 morning wait p90 by about 12 to 14 minutes on every seed set, higher depot time per car, lower fleet readiness at 06:00, so the depot guardrail must name the service queue, which a cleaning bay metric cannot see.
- **OPS-20.** Under the home depot rule a staging area on two thirds of SF-1 binds at the gate, not in rider wait: 1.6 to 1.9 cars per run are turned away from a lot at 99.0 percent of its 20 stalls and finish their night at SF-2, whose queue still ends before 07:00, so the day 2 morning wait reads unchanged on every seed set and only the diversions guardrail sees the change, lower SF-1 stall slack, higher SF-2 overnight queue.

**What did not show.** Six cases did not read IMPROVED or REGRESSED on their primary, and each shows something the
instrument says on purpose. OPS-04 (INCONCLUSIVE, RUN_MORE_EXPERIMENTS) is a real change too small for its margin: the
05:00 release moves ready cars out of SF-1 and SF-2, which count as available to San Francisco riders under nearest idle
dispatch, and the San Francisco morning wait rises on every seed set (+39.3 to +63.7 s) with every interval above zero
and across the 30 s margin; INCONCLUSIVE here is not "no effect" but an effect the margin cannot size, and the
direction is the lesson: an earlier release is not earlier readiness. OPS-07 (INCONCLUSIVE, RUN_MORE_EXPERIMENTS) is a
queue that is not a rider harm: with one bay the EB-1 queue clears at a mean of day 2 02:17 (01:07 with three), before
the release, and the cars readied earlier are dispatched to night riders, some out of East Bay, so the second morning's
East Bay wait does not separate from noise on any set and every guardrail stays within; ask when a queue happens and
where the ready cars go before adding bays. OPS-08 (INCONCLUSIVE, HOLD) is a HOLD from the guardrails alone: the
capacity-aware rule stops the turn-aways at the 6 stall lot (5.4 per run to 0.05) but sends East Bay cars to clean and
sleep at SF-1 and SJ-1, so SF-1's lot peak and bay wait regress while the East Bay primary reads INCONCLUSIVE on every
seed set and REGRESSED on one of two other demand draws (exploratory runs under other slugs, not pinned); the primary
said nothing, the receiving depot's guardrails decided, and the draw dependence is why the slug is part of the spec. OPS-09 (INCONCLUSIVE, HOLD) is a primary window the
axis cannot reach: in the rain world the San Francisco evening tail is set by cars sent in from other areas, so a slower
San Francisco curb leaves it where it was, while the harm lands on the day 1 morning unserved in San Francisco (3.4 to
13.1 requests) and on the neighbouring areas, and only the whole run unserved guardrail holds the change; choose a
primary the axis can move, and keep a whole run guardrail for the harm that moves elsewhere. OPS-11 (INCONCLUSIVE, HOLD)
is slack spent before riders feel it: 30 minute cleans land on the overnight queue (SF-2 bay wait p90 from 8,322.4 s to
13,936.2 s, and 5.7 SF-2 visits unfinished at the release instead of 0) and the 06:00 readiness guardrail regresses, but
the San Francisco morning wait reads no clear change on all three sets because San Francisco is short of cars at that
hour in both arms; the guardrails see what the primary cannot, and they are the HOLD. OPS-20 (UNCHANGED, HOLD) is a
change that binds at a gate, not on the street: cutting SF-1 to 20 stalls under the home depot rule turns 1.6 to 1.9
cars per run away from a lot at 99.0 percent of its stalls, and they finish their night at SF-2, whose queue still ends
before 07:00, so the morning wait reads UNCHANGED on every set and only the diversions guardrail, with a maximum harm of
0, sees the change; a change that lands on a resource and not on riders is reported by a guardrail, and a zero-harm
guardrail is what made this one visible.

**Model limits the casebook leans on.** Drawn from the cases' "Outside this model" lists. Each is a simplification of
§5.8 or §10.1 that a case depends on for its result, so a reader holds the lesson to the model, not to a real fleet.

- **Nothing switches on or off within a day except a congestion row.** Rain, crowds, a closure, an event, cars held at
  scenes and added cars hold for the whole run, or for the named hours of a named day where the knob is congestion. No
  slowdown builds and fades, no car is removed and returned partway through the day, no delay applies only while a crowd
  is present, and demand neither ramps over days nor falls back once the rain stops (OPS-01, 05, 06, 09, 10, 13, 16, 17,
  18).
- **Riders only wait or give up.** No cancellation after assignment, no riders who stop requesting after long waits or
  request more once waits are shorter, no shared rides, no walking to a meeting point or waiting under cover, no
  waitlists, pricing or promotions (OPS-01, 06, 09, 10, 14, 16, 17, 18).
- **Nothing repositions an idle car.** No rule moves a car back to its area, toward where morning requests start, or
  into an area ahead of a closure; nothing keeps cars inside a home area or caps pickup distance; the release sends cars
  to a home area, not to demand (OPS-01, 04, 05, 07, 10, 12, 15, 17, 18).
- **Depots have bays, stalls and times, not people or hours.** No crew, shifts, breaks, opening hours or closing-time
  surge; no charging, inspection, drying or supplies; no quick clean for a lightly used car; a service check is the full
  45 minute service; a car that fails a check stays in the fleet; no mobile crew on the street (OPS-01, 02, 03, 04, 05,
  07, 08, 11, 12, 15, 19).
- **Depot geography is route time.** Depot homes follow route times, so a closure moves depot visits as well as riders
  (OPS-17); there are no real depot locations at different distances, no overflow parking outside a depot, no stall
  reservations, and no dispatcher who knows a lot is full before the car reaches the gate; the capacity-aware rule
  counts free stalls, never free bays (OPS-08, 17, 20).
- **The recall and the release act once (D-12).** No second recall for cars sent out after the first, no night pool
  kept out, no car released as soon as it is ready, no staging that covers only part of the night (OPS-02, 04, 20).
- **Fleet changes are whole-run and whole-area.** A launch fleet does not grow over weeks, no car is held out for launch
  checks, no spare vehicle backfills a car held at a scene, and cars added for an event or a peak stay all day (OPS-01,
  05, 10, 15, 18).
- **Maintenance is by visit count.** A visit comes due by trips, never by distance, faults or cabin condition; a deferral
  rule cannot switch on only in the peak; a check cannot be limited to cars near an incident or to a few days (OPS-03,
  19).
- **No venue, streets or pedestrians.** An event is a demand knob on both peak windows of both days, a crowd is a slower
  in-area row or a longer pickup time everywhere in an area, and a closure is a longer route time with no detour traffic
  on other corridors and no reopening time (OPS-13, 14, 16, 17).

### 4.1 Learn cases

| Order | Case | Concept it teaches |
|---|---|---|
| L1 | UC-04 Peak and off-peak | time windows; averages hide peaks |
| L2 | UC-09 Bays are not always the bottleneck | which constraint binds; preregistration decides what counts |
| L3 | UC-07 Home depot or nearest depot | congestion, depot capacity, the morning release and the next peak together |

Each Learn case has a one-line question, a preset with a visible difference from the Bay teaching map, three to
five named moments on the timeline with two-sentence captions generated from the fixture, and a final "Test it
properly" action that opens Experiment with the axis filled in. The longer path (UC-01, UC-02, UC-03, UC-08,
UC-05, UC-10 before the capstone) is later.

### 4.2 The walkthrough: four chapters over one replay

Built on 2026-09-16 as `Present`, a layer over the three modes (§7.1). It replaces the hand-driven route this section
first described, which needed three presets, two mode switches and a detour that lost the verdict. The walk plays one
world: the operations casebook's OPS-01 evening crunch, animated at the first seed of the preset seed set, which is the
one replay every beat reads.

`Prepare` runs the window once and the experiment once, in this visitor's browser, through the runtime's ordinary
public calls, and shows what each took on this visitor's own clock. Until both land, `Next` is off and every figure in
the ledger reads `not available: nothing has run yet`. After that no beat runs the model again: a beat is a silent seek,
a pin, an open and a projection of what the run already computed.

| Chapter | Beats | What each beat shows |
|---|---|---|
| 1 Operations | the evening peak; the 18:00 hour; the recall; the watched depot at the recall plus 90 minutes; the morning after | riders waiting and cars carrying riders; riders who gave up in that hour beside the completed-ride wait p90 of the area the frozen spec measures; the cars the recall sent in one second and the cars driving to a depot; the queue across the four depots and the watched depot's stalls; the cars driving home, the cars ready, and the second the watched depot's bay queue cleared. Every one of these beats also carries the four-depot table `depot · held · queue · bays · ready` |
| 2 Analytics | two registers; the verdict | the metric registry, eight rows, each under both registers with its unit, direction, FleetLab status and population, `all rows` to open the rest, and the two charts by hour (the primary's area, the guardrail's depot); then the frozen spec in words and the verdict readout composed from the verdict card's own builders, with minutes beside seconds |
| 3 Simulation | how a frame is made; one world, two arms | the snapshot second against the second being drawn, whether the positions are interpolated (read from the frame, never from the option passed in), cars on a leg, events so far of the log's own total, the snapshot step, the engine path and what the run took; then the verdict's own watched seed, both arms read at one second at the depot the guardrail names |
| 4 Product sense | what this stands for; not on this page, and the next question | OPS-01's situation block verbatim (stands for, set as, misses, outside the model, watch) and what the run trades as lower one thing and higher another; then five refusals with their reasons, and the next casebook question by id, title and situation alone, with a button that opens it in Experiment |

Eleven beats behind one `Next` that keeps its own focus. A beat lands on its declared second and stays there: nothing
autoplays, and where a beat has somewhere to run to the ledger says `Press Play to watch to D1 18:00.` Playback runs at
300x while presenting, so a played beat of 15 or 30 simulated minutes takes 3 or 6 real seconds. Beat clocks are derived
from the scenario's own declared knobs (the peak windows, `recall_s`, `release_s`), never searched and never typed, so
moving a knob moves the beat with it, and a scenario with the release turned off retitles that beat instead of naming a
second the knobs never set. Every figure carries exactly one register chip, at most three a beat; the narration is
generated from the run in the second person and speaks once a beat; the rule line names the mechanism the beat shows and
the chip beside it names the model limit that mechanism owes (§5.8). `Leave the walkthrough`, or Escape from the rail,
puts the page back as it was with the run, the clock, the pinned car and the verdict kept.

A lone visitor meets the same walk through a reading card that stands above the picture before anything has run:
`A teaching model of a stylized Bay Area fleet. Every number is invented; the verdict rules are FleetLab's.` with a
button into the knobs, a button that enters the walk and runs `Prepare`, and a button that closes the card. The card is
a section, never a dialog, and a reload starts clean (§9.4, D-11).

### 4.3 What this model shows (not claims about real operations)

| A common first assumption | What this model shows | Run that shows it |
|---|---|---|
| More cars always fix wait. | Cars in the wrong area or parked at a depot add little. | UC-02, UC-07 |
| Depot throughput is the bay count. | Throughput is the minimum over bays and parking. | UC-08, UC-09 |
| The home depot is the safe choice. | At the default, the nearest depot readies cars sooner and lowers the next morning's wait; whether nearest backfires depends on how busy the small depot is. | UC-07 |
| The peak hour is the hard hour. | The trouble often follows the peak, when servicing synchronizes. | UC-04 |
| Size the fleet to average demand. | The peak shape matters. | UC-04 |
| A car at a depot is available. | Parked is not ready. | UC-08 |
| Highway congestion only slows riders. | It also slows every empty drive to pickups and depots. | UC-05 |
| A flat primary means harmless. | Another constraint may be binding. | UC-09 |


## 5. The simulation model

The Python instrument in `src/hermes/fleet/` stays the evidence engine. This section specifies the
teaching engine for the first build; *later* rows are designed so the first build does not paint itself
into a corner.

### 5.1 Entities

State is integers only: seconds, metres, per-mille and parts per million.

- **Area:** `id` (SF, PEN, SJ, EB), `label` from the allowlist, schematic position, `initial_cars`
  (SUP-1), in-area minutes (RD-2), demand profile.
- **Route:** `id` (`H1`-`H6`, `L1`-`L6`), the two areas it joins, `class` (HIGHWAY or LOCAL),
  `free_flow_s`, and a congestion table per direction and hour for both days (per-mille).
- **Depot:** `id` (`SF-1`, `SF-2`, `SJ-1`, `EB-1`), `area`, `access_s` (5 min of local driving),
  `parking`, `cleaning_bays`, `service_bays`, `clean_s`, `service_s`, `intake_s`, `pull_out_s`.
- **Vehicle:** `id` (`SF-017`: home area plus a zero-padded number, which also avoids string-order
  surprises), `state`, `location` (an area centre, a depot, or a leg `{route, direction, depart_s,
  arrive_s}`), `home_area` and `home_depot` (SUP-2), `trips_since_visit`, `visits`, `current_request`, `target_depot`,
  `task` (`CLEAN` or `SERVICE`). *Later:* state of charge.
- **Request:** `id` (`r-<area>-<k>`), `time_s`, `origin_area`, `dest_area`, `assigned_vehicle`,
  `pickup_s`, `dropoff_s`, `state`.
- **Visit:** one pass of a vehicle through a depot, with the time of arrival, intake end, queue end,
  each task start and end, ready, and release, or censored at the drain end `T_d` (§5.7).

### 5.2 The world

#### 5.2.1 Travel on two routes per pair

- **Route choice:** when a car leaves an area centre or a depot for another area, it takes whichever of
  the pair's two routes has the shorter planned time at the departure second; a tie goes to the highway.
- **Planned time:** the route's free-flow seconds are integrated through the declared hourly multipliers
  for its class and direction: while the car is inside an hour it progresses at `1 / multiplier`
  free-flow seconds per second, and the multiplier changes at the hour boundary. This keeps planned times
  first-in-first-out (leaving later never arrives earlier) and remains hand-derivable. Every division
  rounds half to even.
- **Depot access and in-area legs:** fixed local minutes (5 for a depot, RD-2 for an area), using RD-3's in-area row (one local multiplier per hour, by default ×1.3 in both
  peaks). A car leaving a depot drives pull-out, then depot access to the area centre, then its next leg (an
  in-area pickup or a route). A car bound for a depot drives its route to the area centre, then depot access. A
  diversion between two depots in one area drives access out and access in.
- **Realized time** = `round_half_even(planned × traffic_factor × ride_factor / 10^12)`, with both factors in parts per
  million and the product computed exactly (`BigInt`):
  - both factors are lognormal with median 1 and log-scale σ (RD-5): a factor is `MULT_TABLE_σ[u16(...)]`, one entry of a
    2^16-entry table of `round_half_even(10^6 × exp(σ × z_i))`, where `z_i` is the standard normal quantile at
    `(i + 0.5) / 2^16`; with σ 0 every factor is exactly 10^6. Pull-out and intake are fixed and take no factor, and each
    segment of a multi-segment leg (access, in-area, route) is realized separately from its own departure second;
  - `traffic_factor` is keyed `(seed, "traffic", route_id, direction, quarter_hour(depart_s))`: every car
    that starts the route in that direction in that quarter hour shares it, in both arms.
  - `ride_factor` is keyed `(seed, "ride", request_id)` and scales both legs a rider causes (the pickup and
    the trip), as FleetLab's per-request multiplier does. Empty legs a policy creates (to a depot, the
    morning release) get the traffic factor only, so a policy change cannot shift another leg's noise.
  - With σ above 0, realized times need not be first-in-first-out; this is declared.
- **No distance:** legs carry time only; `vehicle.empty_drive_fraction` is a share of driving seconds (§5.7), so no
  class speed is needed.

#### 5.2.2 Demand by thinning

- **Profile:** `lambda_a(h)` in requests per hour × 1000 for each area and hour of both days, built from
  DEM-1 to DEM-3. The flat shape of DEM-5 gives every hour `round_half_even(sum of the peaked lambda_a(h) over the
  window / hours)`, so its total differs from the peaked total by at most 0.0005 requests per hour of window.
- **Destinations:** `P(dest | origin, period)` as integer weights (DEM-4), including the origin area.
- **Envelope:** `lambda_max_a` is declared in the experiment as the maximum over both arms, and fixed.
- **Generation for area a:**
  1. Candidate k's gap in seconds is `round_half_even(EXP_TABLE[u16(key, "gap", a, k)] × 3600 / lambda_max_a)`,
     computed in integers (quotient, then the remainder decides the half), from an Exp(1) quantile table of 2^16
     entries stored as integer thousandths (tail truncated at 1 - 2^-16, about 11.1 times the mean; declared).
     `lambda_max_a` is also in thousandths, so the result is seconds; `t_k` is the running sum of gaps from the
     window start.
  2. Accept when `u32(key, "thin", a, k) × lambda_max_a < lambda_a(hour(t_k)) × 2^32`; every product stays
     below 2^53, so the comparison is exact in doubles.
  3. Destination: `Math.floor(u32(key, "dest", a, k) × W / 2^32)` over cumulative integer weights with total
     `W ≤ 2^20`, so the product stays below 2^53. Never JavaScript's `>>`, which is a 32-bit operator.
  4. Request id `r-<a>-<k>`, identical across arms.
- **Coupling:** both arms share the candidate stream (every `gap`, `thin` and `dest` draw, and `lambda_max_a`),
  and each arm accepts candidates against its own profile (P-1). When one arm's rate is at least the other's in
  every hour (a DEM-1 or DEM-2 axis), every request the lower arm accepts is also accepted by the higher arm at
  the same second with the same id: nested common random numbers. When neither profile dominates (the DEM-5
  `flat` against `peaked` axis of UC-04), the arms share candidates but not nesting. Either way a demand axis
  changes demand, unlike FleetLab today (§14, FL-1).
- **Key:** the scenario's name, so demand is one fixed trace across replications (FleetLab's behaviour) and
  the interval reflects travel variation only. Demand that varies by replication is later (DEM-6).

#### 5.2.3 Planning profile versus realized profile (later)

A separate declared `planning_profile` that policies see, while the engine and metrics use the realized
profile, labelled "planning input you declared". Not in the first build.

### 5.3 States and transitions

One vocabulary with FleetLab: its five vehicle states keep their names, and the teaching engine adds five.

| State | Meaning | In FleetLab | First build |
|---|---|---|---|
| `IDLE` | at an area centre, dispatchable | yes | yes |
| `ENROUTE_PICKUP` | driving empty to a rider | yes | yes |
| `ON_TRIP` | a rider aboard | yes | yes |
| `TO_DEPOT` | driving empty to `target_depot`; the leg carries `purpose` `SERVICE_DUE` or `RECALL` | no | yes |
| `INTAKE` | at a depot, holding a stall, being checked in for DEP-9's intake minutes | no | yes |
| `QUEUED_SERVICE` | at a depot, holding a stall, waiting for a bay | yes (with no depot location) | yes |
| `GATE_WAIT` | at a depot's gate, holding no stall, because no depot that can serve the visit had a free stall on arrival | no | yes |
| `IN_SERVICE` | in a bay; the event carries `task` `CLEAN` or `SERVICE`; `blocked` when its task is done and it cannot leave the bay | yes (one task) | yes |
| `READY_AT_DEPOT` | finished, holding a stall, dispatchable from the depot | no | yes |
| `REPOSITIONING` | driving empty to the home area under the morning release | no | yes |
| `OUT_OF_SERVICE` | closed depot or stranded | no | later |

Requests: `WAITING`, `ASSIGNED`, `COMPLETED`, `UNSERVED`, as in FleetLab. Pickup is an event, not a
state; playback derives it.

| From | To | Event | Guard |
|---|---|---|---|
| IDLE | ENROUTE_PICKUP | REQUEST_ASSIGNED | dispatch |
| READY_AT_DEPOT | ENROUTE_PICKUP | REQUEST_ASSIGNED | dispatch; the leg is pull-out, depot access, then the in-area pickup (§5.2.1) |
| ENROUTE_PICKUP | ON_TRIP | PICKUP_COMPLETED | none |
| ON_TRIP | IDLE | TRIP_COMPLETED | no visit due, and the car was not marked by the recall or its trip ends at or after the release |
| ON_TRIP | TO_DEPOT | TRIP_COMPLETED | visit due; depot assignment picks the depot (`purpose SERVICE_DUE`) |
| ON_TRIP | TO_DEPOT | TRIP_COMPLETED | no visit due, the car was marked by the recall, and its trip ends before the release (or the window end when the release is off); depot assignment picks the depot (`purpose RECALL`) |
| IDLE | TO_DEPOT | RECALL_ORDERED | end-of-service recall (`purpose RECALL`) |
| TO_DEPOT | TO_DEPOT | DEPOT_DIVERTED | on arrival the target lot is full and a depot that can serve the visit has a free stall; the nearest such depot becomes the target |
| TO_DEPOT | GATE_WAIT | DEPOT_ARRIVED | on arrival the target lot is full and no depot that can serve the visit has a free stall |
| TO_DEPOT | INTAKE | DEPOT_ARRIVED | on arrival the target depot has a free stall, and the car claims it |
| GATE_WAIT | INTAKE | STALL_CLAIMED | a stall at this depot frees and this car is first in line for it (the freed-stall rule below) |
| INTAKE | QUEUED_SERVICE | INTAKE_COMPLETED | DEP-9's intake minutes have run |
| QUEUED_SERVICE | IN_SERVICE (`CLEAN`) | SERVICE_STARTED (`task CLEAN`) | the clean is not done this visit and a cleaning bay is free |
| QUEUED_SERVICE | IN_SERVICE (`SERVICE`) | SERVICE_STARTED (`task SERVICE`) | the clean is done, service is due this visit, and a service bay is free |
| IN_SERVICE (`CLEAN`) | IN_SERVICE (`SERVICE`) | SERVICE_STARTED (`task SERVICE`) | service due this visit and a service bay free; the car moves bays without taking a stall |
| IN_SERVICE (`CLEAN`) | QUEUED_SERVICE | SERVICE_COMPLETED | service due this visit, no service bay free, and a stall free |
| IN_SERVICE (last task) | READY_AT_DEPOT | SERVICE_COMPLETED | a stall is free |
| IN_SERVICE (any task) | IN_SERVICE (`blocked`) | SERVICE_COMPLETED | the car cannot move on: no stall free, and for a clean with service due, no service bay free either; it keeps the bay and counts toward `depot.blocked_s` |
| IN_SERVICE (`blocked`) | IN_SERVICE (`SERVICE`) | SERVICE_STARTED (`task SERVICE`) | service still due and a service bay frees |
| IN_SERVICE (`blocked`) | QUEUED_SERVICE | STALL_CLAIMED | service still due, no service bay free, and a stall frees |
| IN_SERVICE (`blocked`) | READY_AT_DEPOT | STALL_CLAIMED | no task left and a stall frees |
| READY_AT_DEPOT | REPOSITIONING | MORNING_RELEASE | the car's depot is outside its home area (SUP-2) |
| REPOSITIONING | IDLE | REPOSITION_COMPLETED | none |

**Recall.** The recall acts once (D-12). At POL-3's time every `IDLE` car goes to a depot, and every car on a pickup or
a trip is marked; a marked car goes to a depot when that trip completes before POL-4's time (or the window end when the
release is off), and the mark clears at completion. Cars already bound for a depot, at a depot or in a bay keep their
course. Dispatch still takes `READY_AT_DEPOT` cars after the recall; such a car is not marked and ends `IDLE` where its trip
ends.

**A depot with no service bay** (DEP-5 = 0) never receives a visit that includes service: depot assignment and
diversion consider only depots with a service bay for such a visit, and log that cause. P19 rejects a scenario whose
DEP-8 is above 0 when no depot on the map has a service bay.

**A freed stall** goes first to a car blocked in a bay at that depot (the earliest finished, then vehicle id), then
to a car at its gate (the earliest arrival, then vehicle id).

**Hand-off.** When every stall of a depot is held, every bay for a task holds a car, one of those cars is blocked and
a car is queued for that task, no stall or bay can ever free. Both then move at the same second: the queued car gives up
its stall and starts the task, and the blocked car (the earliest finished, then vehicle id) takes the stall
(`STALL_CLAIMED`, then `SERVICE_STARTED`). Without this rule a depot could lock for good.

A car on a leg is never re-tasked mid-leg; this overstates the cost of the morning release, and its card says
so.

### 5.4 Determinism

1. **Keyed streams, never call order.** The key function is FleetLab's: SHA-256 over the parts joined by
   `|`, first 8 bytes big-endian. Parts are integers and ASCII strings only; floats never appear in keys.
   Purposes: `gap`, `thin`, `dest`, `traffic`, `ride`, `bootstrap`. Uniforms come from bit slices of `u64`, never floating division: `u16` is its top 16 bits and `u32` its
   top 32 bits.
2. **No transcendental maths on the state path.** Exp(1) and variation multipliers come from integer
   quantile tables of 2^16 entries, computed at load with integer and `BigInt` arithmetic only and checked against pinned
   digests, so every JavaScript engine builds identical tables. σ is restricted to the grid in RD-5,
   one table per value.
3. **Event order:** `(time_s, class, seq)`. Heap events and their classes: 0 completions and arrivals (`PICKUP_COMPLETED`, `TRIP_COMPLETED`,
   `DEPOT_ARRIVED`, `INTAKE_COMPLETED`, `SERVICE_COMPLETED`, `REPOSITION_COMPLETED`); 1 `REQUEST_CREATED`; 2
   `WAIT_DEADLINE`; 3 policy clock events (`RECALL_ORDERED`, `MORNING_RELEASE`); 4 `WINDOW_END`. Decision events
   (`REQUEST_ASSIGNED`, `REQUEST_UNSERVED`, `DEPOT_DIVERTED`, `STALL_CLAIMED`, `SERVICE_STARTED`) are logged by the handler that causes them, at the same second, and are never pushed.
   `WINDOW_END` starts the drain (§5.7); `VISIT_CENSORED` and `LEG_CENSORED` are logged at the drain end. Every entry
   appended to the event log, heap event or decision event, takes the next log ordinal `ord`, so the log's order is total.
   Invariant 11 checks both keys: heap pops strictly increase in `(time_s, class, seq)`, and log entries strictly increase
   in `ord` with non-decreasing `time_s`. A car freed at second t can serve a rider whose deadline is t.
   `seq` increments on every push. Handlers iterate in sorted-id order, never insertion or hash order.
4. **Arithmetic:** integer state; round half to even; floats only in metric aggregation and the bootstrap, in a
   fixed order (percentiles by FleetLab's interpolation; means summed left to right in ascending seed order).
5. **Arm isolation:** one world per seed is built, digested and frozen, then passed read-only to both arms. A
   test runs candidate-then-baseline and baseline-then-candidate and requires identical results. Task times are
   deterministic (they come from the knobs), so pairing stays exact.
6. **Replay:** the first seed of each arm runs twice; the event-log digests must match (PRD invariant 12).

### 5.5 Policies

A policy is a pure function `policy(view, params) -> actions`. The view holds the current time, vehicle views
(state, location or leg end, planned free-at time, home depot, trips since visit, visits), depot views (stalls
free, queue length, bays busy by task, cars inbound), the planned route table and the policy's own parameters. It
never holds the world tape, realized times, traffic or ride factors, random-number state, the other arm, any
metric, or the wall clock. The engine validates every action; an illegal action is `POLICY_ERROR` and voids the
run. Every decision is logged with its cause.

| Policy | First-build rule | Tie-break |
|---|---|---|
| Dispatch (POL-1) | the waiting rider oldest first; the car with the earliest planned arrival among `IDLE` and `READY_AT_DEPOT` cars | planned arrival, then vehicle id |
| Depot assignment (POL-2) | `home_depot`; `nearest_depot` by planned arrival; `nearest_depot_with_capacity`, the nearest depot whose free stalls minus cars already inbound is at least 1 when the car leaves | planned arrival, then depot id |
| End-of-service recall (POL-3) | at the declared time, every `IDLE` car goes `TO_DEPOT`; a car on a pickup or trip at that time finishes it and then goes, if it finishes before the release; a car dispatched later is not recalled (the recall rule of §5.3) | vehicle id |
| Morning release (POL-4) | at the declared time, every `READY_AT_DEPOT` car whose depot is outside its home area repositions home | vehicle id |
| Queue order (POL-5) | FIFO by intake time, for each bay type; not used by the legacy profile (§5.10) | vehicle id |

### 5.6 Invariants

PRD §17 numbering is kept for its twelve checks; checks the teaching engine adds carry a `P` prefix. Every
violation voids the run: in Experiment mode it is `INVALID_EXPERIMENT` with the reason, and in Sandbox the metrics
are withheld behind a model-error panel.

| Id | Check | First build |
|---|---|---|
| 1 | Vehicles tracked equal vehicles configured, at every event | yes |
| 2 | A vehicle never holds two requests; its assign-to-drop-off intervals do not overlap | yes |
| 3 | A request reaches at most one terminal state, and exactly one after the drain | yes |
| 4 | Charger occupancy within capacity | later (D-02) |
| 5 | Cleaning-bay and service-bay occupancy within capacity at every start | yes |
| 6, 7 | State of charge within bounds; no charging while serving | later (D-02) |
| 8 | A completed request has a pickup event, and drop-off ≥ pickup ≥ request time (checked on events, not on a scheduled time) | yes |
| 9 | Every state change is in the transition table, checked at every change | yes |
| 10 | Every event and policy action references an existing entity of the right type | yes |
| 11 | Heap pops strictly increase in `(time_s, class, seq)`; log entries strictly increase in `ord` with non-decreasing `time_s` (§5.4) | yes |
| 12 | The same world, policy and seed replay to an identical event digest | yes |
| Conservation | Request states partition the population (FleetLab's `I-conservation` check, kept) | yes |
| P13 | Cars holding a stall (`INTAKE`, `QUEUED_SERVICE` or `READY_AT_DEPOT`) never exceed a depot's parking; a car finished in a bay with no stall free stays in the bay without one | yes |
| P14 | A vehicle is in exactly one place, and each leg starts where the previous one ended | yes |
| P15 | For every vehicle, the clipped seconds across states sum exactly to the window length (the fleet-state chart depends on it) | yes |
| P16 | Every time-integral metric recomputed from the interval log equals its running total | yes |
| P17 | Visits started equal visits completed plus visits censored at the drain end `T_d`; every `TO_DEPOT` leg ends in exactly one arrival, diversion or censoring | yes |
| P18 | The world digest covers the candidate stream of P-1 (envelope, draws and factors), not the accepted requests, and is identical across arms for every seed, including under a demand axis; `lambda_a(h) ≤ lambda_max_a` in both arms | yes |
| P19 | When a scenario loads: profiles cover every hour of both days; multipliers within bounds; peak ≥ off-peak; every car has a home area and an existing home depot; the release time is later than the recall time; when DEP-8 is above 0, at least one depot has a service bay | yes (scenario rejected) |
| P20 | Dispatch takes a car from `READY_AT_DEPOT` only through the dispatch rule; a recall leg starts only from `IDLE` at the recall second or at the end of a marked trip before the release, and a marked trip never ends `IDLE` before the release; the morning release moves only cars outside their home area | yes |
| P21 | For every count or seconds metric that accepts `area` or `depot`, the values over every area, or every depot, sum to the unscoped value (§5.7) | yes |

### 5.7 Metrics and scopes

**Rules.** Requests are created only inside the window.

**Drain.** At the window end (`WINDOW_END`) the engine stops creating requests and discards policy clock events later than
the window, then keeps processing heap events in order, dispatch included. The drain end `T_d` is the second at which the
last request becomes terminal, or the window end when every request is already terminal then; it always exists, because
every waiting rider's deadline and every assigned rider's drop-off are already on the heap. The engine processes every
heap event with time at most `T_d`, then stops: each unfinished visit is censored at `T_d` (`VISIT_CENSORED`), each car
still on a leg has that leg censored at `T_d` (`LEG_CENSORED`), and later heap events are discarded. No request is ever
censored. Time integrals are clipped to the window, so the drain changes only request metrics (rides requested inside the
window finish) and visit metrics (visits finished by `T_d`).

Every time-integral is clipped to the window, with the warm-up excluded from
windowed values. Percentiles use FleetLab's linear interpolation at `(n - 1) × q`. Absence is never zero. The
playground registry is versioned on its own (`playground-metrics 0.1`), and every entry carries
`fleetlab_status: identical` or `playground_only`; a name that exists in FleetLab's registry MUST have an identical
population, or it is renamed.

**Scopes.** A metric reference is `{metric, scope: {area?, depot?, window?}}`. Each metric's Scopes column lists the only keys
it accepts; any other key is rejected when the spec is frozen (`invalid scope: <metric> does not accept <key>`). A window is
`[start, end)` on a named day and lies inside the simulated window.
- **Request metrics** (`requests.*`, `unserved.fraction`, `wait.*`): `area` is the request's origin; `window` tests its
  creation time.
- **Vehicle-time metrics** (`exposure.*`, `vehicle.empty_drive_fraction`, `fleet.available_fraction`): seconds are clipped to
  `window`. For `exposure.*`, `area` receives a leg's seconds by the area the leg departs from: a route leg belongs to its
  origin area, and depot access and in-area legs to their own area. For `fleet.available_fraction`, `area` is where the car
  stands, an area centre or a depot in that area.
- **Depot metrics** (`depot.*`): `depot` names one depot; `window` tests the visit's arrival time, and `depot.blocked_s` clips
  bay-seconds to it. Without `depot`, counts and seconds (`depot.censored_visits`, `depot.diversions`, `depot.blocked_s`) sum
  over depots, percentiles (`depot.bay_wait_p90_s`, `depot.turnaround_*`) pool every visit, and `depot.parking_peak_fraction`
  is rejected because it requires `depot`.
- **Whole-run metrics** (`fleet.placement_gap`) accept no scope.
- **Partition property:** for counts and seconds, the values over every area, or every depot, sum to the unscoped value (P21).

 An empty scope never changes a metric's absence column: counts
read 0, `unserved.fraction` reads 0.0, time integrals and `depot.parking_peak_fraction` read 0.0, and a percentile or
ratio is absent only when its own population is empty in scope. "Always available" in a preset means the absence
column reads "never". The Experiment spec stores the full reference, so a scoped primary is one
metric to the instrument.

| Metric | Unit | Direction | Population | Absent when | Scopes | FleetLab status |
|---|---|---|---|---|---|---|
| `requests.total`, `requests.served`, `requests.unserved` | requests | neutral, higher, lower | requests created in the window; reached COMPLETED; reached UNSERVED | never | area, window | identical |
| `unserved.fraction` | fraction | lower | unserved over all requests; 0.0 when there are none | never | area, window | identical |
| `wait.p50_s`, `wait.p90_s` | s | lower | pickup minus request time over completed requests | no completed request in scope | area, window | identical |
| `wait.population_n` | requests | neutral | completed requests the wait percentiles count | never | area, window | playground only |
| `vehicle.empty_drive_fraction` | fraction | lower | empty driving seconds (to a pickup, to a depot, repositioning, pull-out, depot access and in-area legs) over all driving seconds, clipped to the window; time-based, so no distance is invented | no driving seconds in scope | window | playground only (PRD §16.2's deadhead ratio is distance-based; this is not that metric) |
| `exposure.congested_empty_s`, `exposure.congested_loaded_s` | s, shown in minutes | lower | empty, or loaded, vehicle-seconds on any leg (a route, depot access or an in-area leg) whose declared multiplier is at least RD-4, inside the window; broken down by road class, with depot access and in-area legs counted as local | never | area, window | playground only |
| `fleet.available_fraction` | fraction | higher | `IDLE` vehicle-seconds in the area plus `READY_AT_DEPOT` vehicle-seconds at depots in the area, over the fleet's cars × window seconds (scoped to an area, the share of the whole fleet available there) | never | area, window (hourly for charts) | playground only (PRD §16.2 name) |
| `depot.bay_wait_p90_s` | s | lower | per started visit, seconds from intake end to the first task start, **zero waits included** | no visit started a task | depot, window | playground only. FleetLab's `depot.queue_p90_s` (drop-off to service start, every service start counted, though its wording says "no vehicle queued for a service bay") exists only in the legacy profile, for parity (§5.10) |
| `depot.turnaround_p50_s`, `depot.turnaround_p90_s` ("time to ready") | s | lower | arrival to `READY_AT_DEPOT` over every visit in scope | no visit in scope, or any visit in scope censored at `T_d`, shown as `not available: N visits unfinished at drain end` | depot, window | playground only (PRD §16.4 name) |
| `depot.turnaround_completed_p90_s` | s | neutral | arrival to `READY_AT_DEPOT` over visits in scope completed by `T_d`, labelled "completed visits only"; descriptive only, never a primary or a guardrail | no completed visit in scope | depot, window | playground only |
| `depot.censored_visits` | visits | lower | visits in scope unfinished at the drain end `T_d` | never | depot, window | playground only |
| `depot.parking_peak_fraction` | fraction | lower | the largest share of the depot's stalls held at once inside the window | never | depot (required), window | playground only |
| `depot.diversions` | arrivals | lower | cars turned away because the depot's lot was full, counted at the depot that turned them away | never | depot, window | playground only |
| `depot.blocked_s` | s | lower | bay-seconds held after a finished task with no stall free, clipped to the window | never | depot, window | playground only |
| `fleet.placement_gap` | cars | lower | half the sum over areas of the absolute difference between the cars located in the area at the snapshot (CLK-4) and the cars that area started with (SUP-1); a car at a depot counts in the depot's area, and a car on a leg in its destination area | never | none | playground only |

Not shown in the first build: FleetLab's `fleet.utilization_fraction` (its unclipped definition can exceed 1, §14),
FleetLab's business-proxy aliases, and every charging, staff, cancellation and suppressed-demand metric.

### 5.8 Where the toy model misleads, and the chip it gets

| Simplification | Bias | On-screen caveat |
|---|---|---|
| Area centres instead of streets | understates pickup time in large areas | "Areas are points: pickups inside an area take a fixed time." |
| Hourly congestion steps | artificial changes at hour boundaries | "Traffic changes on the hour, as you set it." |
| Fixed task times | queues wait less than they would with variable work times | "Every clean takes exactly the time you set." |
| Arrivals approximate a Poisson process inside an hour: gaps come from a tail-truncated exponential table and are rounded to whole seconds | no correlated surges; the far tail is cut off; two requests can share a second | "Requests arrive at random, rounded to the second; no crowds leave at once." |
| Wait counts completed rides only | wait can fall while unserved riders rise | the `unserved.fraction` guardrail in every preset; `wait.population_n` beside every wait |
| Riders give up only before a car is assigned | an assigned rider waits however long it takes | "Once a car is on its way, the rider waits." |
| A perfect start | the first hour looks too good | "The first hour is warm-up and is not counted." |
| No re-tasking mid-leg | overstates the cost of the morning release | "A car on its way home cannot be sent to a rider." |
| Nearest-car dispatch | exaggerates imbalance between areas | "Dispatch is a simple baseline, not a best practice." |
| No battery | cars never run low | "Battery not modelled: cars never run low." |
| No staff | bays are never short-handed | "Staff not modelled: a free bay always has someone to work it." |
| One seed animated | the replay looks like the result | the "This replay" and "Across N replications" registers (§7.4) |
| An interval over replications | measures simulation variation, not model error | "The interval says nothing about whether the model is right." |

**Rows added 2026-09-16**, the first three for the isometric picture and the rest for the walkthrough, where each is the
chip of the beat whose mechanism owes it. All of them are visible text with no tab stop, and the picture's three stand
before a run as well as during one, because they are about the model and not about a replay.

| Simplification | Bias | On-screen caveat |
|---|---|---|
| A third dimension over invented geometry | a tilted picture reads as a place, and a platform reads as a footprint | "An isometric sketch of invented geometry. Platforms are areas, not places; roads are ribbons, not streets." |
| One shaded box per car, moved between snapshots | a box reads as a vehicle type and its motion as a trajectory | "A car's shape and height are drawing conventions, not vehicle types. A car's position between events is an interpolation." |
| Bay cells drawn in a row on the depot block | a cell reads as a numbered bay with an identity the engine lacks | "Bays are not numbered in this model: cars fill them in the order their task started." (beside the existing fixed-task-time and no-staff rows) |
| The recall and the release are single events | a real operation staggers both; this one does not | "The recall and the release each act once, at the second you set." |
| Patience is a fixed limit | unserved arrives as a step inside one hour and nowhere else | "A rider waits exactly the patience you set, then goes unserved; once a car is on its way, the rider waits." |
| Nothing repositions an idle car | an empty area stays empty until the release sends cars home | "Nothing repositions an idle car; the release sends cars to a home area, not to demand." |
| Depot assignment counts stalls | a queued car is never sent to another depot's free bays | "Depot assignment counts free stalls, never free bays." |
| Seeds vary travel only | replications look independent when their demand is shared by design | "Seeds vary travel time; the request stream is the same in every seed of a scenario." |
| Playback interpolates between 5-minute snapshots | a smooth body reads as a tracked position | "A car's position between events is an interpolation." |
| Travel variation 0 in a preset | five replications agreeing to the digit read as a broken panel | "Travel variation is 0 in this preset, so every replication repeats the first." |

### 5.9 Performance

- **Reference preset:** the Bay teaching map scaled to 150 cars (SF 50, PEN 30, SJ 40, EB 30) over the 29-hour window. Budgets, laptop and phone: one
  Sandbox run ≤ 500 ms and ≤ 1.5 s; an experiment of 20 seeds × 2 arms ≤ 10 s and ≤ 45 s; a bootstrap of 2,000
  resamples over 20 deltas ≤ 100 ms; a frame ≤ 8 ms with 150 cars drawn. A 500-car run is recorded, not gated.
- **Structures:** a binary heap on parallel typed arrays; idle and ready cars bucketed by location so dispatch scans
  at most 8 locations in planned-arrival order instead of every car; route plans computed per departure second on
  demand and cached per quarter hour.
- **Threading:** a Web Worker when the host allows one (§9.4 says how the packed file starts it). The 8 ms slice rule
  holds once the quantile tables are built; the first experiment in a fresh page builds them in steps of up to about
  110 ms on a laptop; otherwise time-sliced execution on the main thread in slices
  of at most 8 ms. Both paths are tested.
- **Playback:** the engine records the vehicle interval log that P15 and P16 need, and playback interpolates positions
  from it, so playback never runs the model. Only the selected seed of each arm keeps its log; other runs keep
  metrics only.

### 5.10 The legacy profile and parity fixtures (D-03)

The teaching engine MUST be able to run FleetLab's own world. The **legacy profile** is: the zone-pair travel matrix
with no congestion and no route choice; destinations that never equal the origin; one per-request multiplier on both
the pickup and trip legs; a car due for service serviced **in place** at its drop-off zone from one shared pool of
`service_bays`, with no drive, returning `IDLE` where it stands; a car entering the service queue pushes its own `SERVICE_TRY_START`
heap event at its drop-off second, and every completed service pushes one for each queued car in string-sorted
vehicle-id order at the same second, so the first retry that finds a free bay takes it (the lowest id among waiting
cars, not the longest wait; POL-5 does not apply), and these retries consume sequence numbers (`engine.py` lines
206-235); service time excluded from busy time; flat demand;
nearest-idle dispatch with ties broken by vehicle id **compared as strings** (FleetLab's ids are `v-0` to `v-39`, so
`v-10` sorts before `v-2`); a single event-priority class ordered by push sequence; travel seconds as `max(1, round_half_even(base ×
multiplier))` (`engine.py` line 82); and FleetLab's metrics, including its unclipped `fleet.utilization_fraction`, computed for parity only and never
displayed.

FleetLab builds its world with `math.log`, `math.cos`, `math.sqrt`, `math.exp`, a big-integer division and `int()` truncation of arrival times,
which a browser does not reproduce bit for bit. The legacy profile therefore **consumes a world exported from Python**
instead of generating one. Parity is proven three ways:

1. **Instrument vectors** (§6): value-identical in `pytest` (Python 3.11 asserted) and `node --test`.
2. **Analytical reduction:** the hand-computed three-request world in `tests/unit/test_fleet_analytical_fixture.py`
   reproduces exactly (waits 120, 120, 740; wait p90 616.0; utilization 0.54; depot queue p90 0.0).
3. **One exported FLEET-005 world** (seed 101, both arms): the JavaScript engine reproduces FleetLab's canonical event log
   exactly, entry by entry (`[time_s, kind, entity_id]` in emission order, compared through a digest, with the first
   differing entry reported on failure), its per-kind event counts and its metrics.
4. **Collision fixtures:** a hand-written world in which vehicle ids collide under string order (`v-10` sorts before `v-2`)
   and several queued cars retry a freed bay at the same second, compared entry by entry.
5. **The precheck world** of P-3 for a world-fed axis, exported beside the paired world, so the difference is visible.

A pytest check fails when FleetLab's engine no longer matches a committed fixture and never rewrites it; a separate,
explicitly invoked script regenerates fixtures, in a commit that states why.


## 6. Experiment mode: exact parity with FleetLab

Experiment mode is the one part of the playground that must not be "inspired by" FleetLab.
It must compute the same verdict from the same inputs. The world model underneath is the
playground's own (richer, labelled a teaching model); the instrument on top is FleetLab's,
rule for rule. Source of truth for every rule below: `src/hermes/fleet/experiment.py` and
`src/hermes/fleet/world.py` at `main` `bca4ccd`.

### P-0 What parity covers
Parity covers how a verdict is computed from paired metric values. It does not cover grammar: FleetLab
runs only `parameter:` axes over a numeric scenario field, casts the value to the field's type, and has no
metric scopes (`experiment.py`, `apply_axis`). The playground's policy axes, named values, per-area values
and scopes are teaching-model grammar, tagged on screen and never exported (D-04). A playground metric
reference with a scope is one metric to the verdict rules, exactly as an unscoped FleetLab metric is.

### P-1 Paired replications on one exogenous stream
For each seed in the frozen seed set, both arms consume one exogenous stream generated from the **declared**
scenario, never from an arm's scenario, so the variation axis cannot leak into the world. The candidate differs
from the baseline only by the declared axis. (FleetLab: `tape = build_tape(spec.scenario, seed)`; its stream is
the accepted requests themselves, which is why its demand axes are inert, §14 FL-1.)

**Where the teaching engine departs, deliberately.** Its exogenous stream is the *candidate* stream: the declared
envelope `lambda_max_a`, every `gap`, `thin` and `dest` draw, and the `traffic` and `ride` factors. Each arm accepts
candidates against its own demand profile (§5.2.2). A non-demand axis therefore gives both arms identical accepted
requests, as in FleetLab, and a demand axis changes only acceptance. The legacy profile follows FleetLab's rule
unchanged.

### P-2 Keyed randomness, never call-order randomness
`u64(parts...) = first 8 bytes, big-endian, of SHA-256( parts joined by "|" as UTF-8 )`,
where each part is rendered as its decimal or string form (Python `str(part)`; JavaScript
`String(part)` matches for strings and integers). `unit(parts...) = (u64(parts...) + 1) / (2^64 + 2)`.
A JavaScript port needs a synchronous SHA-256 (Web Crypto is async); it must be exact, and
64-bit values must use `BigInt`, never `Number`.

### P-3 Determinism precheck
Run the baseline arm for `seeds[0]` twice; if the metric maps differ, the experiment is
`INVALID_EXPERIMENT` / `REPLICATION_MISMATCH` and no outcome is shown.

**Source detail.** FleetLab builds this precheck's world from the *baseline arm's* scenario (`experiment.py` line 216,
`build_tape(baseline_scenario, spec.seeds[0])`), while the paired loop builds every world from the declared scenario (line
230). The two differ only for an axis that feeds the world (FL-1, FL-11). The legacy profile mirrors this exactly, and a
parity fixture exports both worlds for a world-fed axis. The teaching engine departs deliberately: its precheck replays
the baseline arm on the same frozen candidate world the paired loop uses (P-1).

### P-4 Invariants void the run
Any invariant violation in any run of either arm → `INVALID_EXPERIMENT` /
`INVARIANT_VIOLATION`, with the first violation's text. No partial outcome, no deltas shown
as if valid.

### P-5 Paired comparison
For metric m: if m is absent from any replication of either arm → comparison unavailable.
Otherwise `delta_s = candidate_s - baseline_s`; report baseline mean, candidate mean, mean
delta, median delta (even count: mean of the two middle values).
If the **primary** comparison is unavailable → `INVALID_EXPERIMENT` / `NOT_COMPARABLE`.

### P-6 Bootstrap interval over paired deltas (never over requests)
`key = experiment digest` (FleetLab: `spec.spec_digest()`; a teaching run: its full spec digest, defined below), `R = bootstrap resamples`
(1,000-100,000; default 2,000), `n = number of paired deltas`.
For `i in 0..R-1`: `mean_i = (1/n) * sum_{j in 0..n-1} deltas[ u64(key, "bootstrap", i, j) mod n ]`.
Sort the R means ascending. `low = means[max(0, round(0.025*R) - 1)]`,
`high = means[min(R-1, round(0.975*R))]`.

**Rounding trap (measured).** FleetLab uses Python `round`, which rounds exact halves to the
even neighbour; JavaScript `Math.round` rounds them up. For `R` in 1,000-100,000 there are
**2,475** resample counts where `0.025*R` or `0.975*R` is an exact half in double
arithmetic and the two disagree, e.g. `R = 1020` → Python high index 994, `Math.round` 995;
`R = 1060` → Python low index 25, `Math.round` 26. The default `R = 2000` agrees (49, 1950).
The port must implement round-half-to-even on the double value, and the parity vectors
must include at least `R = 1020` and `R = 1060`.

### P-7 Outcome against the equivalence margin
Normalise so negative is better: if the primary is `higher_is_better`, `(low, high) := (-high, -low)`.
Then, in this order: `high < -margin` → **IMPROVED**; `low > margin` → **REGRESSED**;
`-margin <= low` and `high <= margin` → **UNCHANGED**; otherwise **INCONCLUSIVE**.
Strictness matters: a bound exactly at `-margin` is not IMPROVED; exactly at `+margin` is not
REGRESSED but can be UNCHANGED. UNCHANGED is a positive claim (whole interval inside the
region), never "the interval crosses zero".

### P-8 Guardrails (non-compensatory)
`harm = mean_delta` if the guardrail is `lower_is_better`, else `-mean_delta`.
`harm > max_harm` (strict) → that guardrail regressed. Guardrails use the mean delta, not the
interval. **A guardrail whose metric is unavailable is skipped by FleetLab today** (no
regression recorded), so a recommendation can advance while a guardrail went unevaluated
(§14, FL-3). The playground reproduces the recommendation exactly (D-05) and MUST render that
guardrail as `NOT EVALUABLE: metric absent in some replication` in the gate chain, beside the
recommendation, never as a pass. Presets prefer guardrails that are always available.

### P-9 Recommendation
Any guardrail regression → **HOLD**. Otherwise IMPROVED → **ADVANCE_TO_NEXT_TEST**;
REGRESSED → **HOLD**; INCONCLUSIVE → **RUN_MORE_EXPERIMENTS**; UNCHANGED → **NO_RECOMMENDATION**.
An invalid experiment always shows **NO_RECOMMENDATION** and no outcome.

### P-10 What the playground never emits
It never writes, exports or labels anything as a FleetLab decision record, never shows a
record digest in FleetLab's format, and never feeds `artifacts/` or `experiments/`. Its
export is a result summary copied to the clipboard, with `format: fleetlab-playground-result-summary`,
`evidence_status: NOT_EVIDENCE`, `decision_authority: NONE` and the playground model version; its spec hash displays as `playground-spec:` plus 8 characters. Its clipboard text rounds values for reading (seconds to
one decimal, fractions to four), and a nonzero value never reads as zero. It never carries the keys
`spec_digest`, `world_tape_digest` or `deployment_permission`, and a pytest check asserts that it fails
`DecisionRecord` and `ExperimentSpec` validation.

### Spec digest and seed sets (teaching runs)

A frozen teaching-run spec is serialized as canonical JSON: object keys sorted by code point (every key is ASCII), no
whitespace, UTF-8, strings as `JSON.stringify` writes them, and numbers only as safe integers in decimal. Every fractional
quantity is stored in integer engine units (seconds, per-mille, parts per million; a guardrail's 0.02 is `20000` parts per
million), so no float and no negative zero reaches the serializer, which rejects both along with any non-integer. The
serialized object holds the format and model versions, the full scenario (every knob), the variation axis with both values,
the primary metric reference with its direction and margin, every guardrail, the seed tuple, the resample count and the
question text. Its digest is the lowercase hexadecimal SHA-256 of those bytes. The bootstrap key is that full digest; the
interface shows `playground-spec:` plus its first 8 characters and never the full digest.

Seeds are never drawn at run time. Seed set k holds seeds `1000 × k + 1` to `1000 × k + N` (§2.8); every preset uses set 1.
`Use another seed set` creates a new frozen spec on set k + 1, which the session log lists beside the earlier one. Vectors
pin the canonical bytes and digests of two presets and of one preset on seed set 2.

### Cross-language traps (verified on this machine)
- **T-1 Rounding.** See P-6: 2,475 resample counts disagree between Python `round` and
  `Math.round`; indices must use round-half-to-even on the double value.
- **T-2 Summation.** `_compare` computes means with Python's built-in `sum()`. Python 3.11 adds
  left to right; Python 3.12 and later use a compensated sum. Measured:
  `sum([1e16, 1.0, -1e16])` is `0.0` on 3.11.15 and `1.0` on 3.13.5, and a JavaScript
  left-to-right loop gives `0`. FleetLab is protected only because `pyproject.toml` pins
  `requires-python = ">=3.11,<3.12"`. The port adds left to right; parity vectors are generated
  and checked under 3.11 with the version asserted; widening the pin would move FleetLab's own
  means and pinned digests (a landmine for the source of truth). The bootstrap loop itself uses
  `total += ...` and is unaffected.
- **T-3 Key parts.** Python `str(2.0)` is `2.0` and `str(1e-05)` is `1e-05`; JavaScript gives
  `2` and `0.00001`. Keyed-hash parts are restricted to strings and safe integers, enforced by an
  assertion in the port.
- **T-4 Unit draws.** Python computes `(u64 + 1) / (2^64 + 2)` as an exact, correctly rounded
  division; converting through a JavaScript `Number` can land one unit in the last place away.
  Unit and normal draws are therefore not claimed identical across languages. The bootstrap uses
  only integer modulo on a `BigInt` and is exact.
- **T-5 Percentiles.** FleetLab metric percentiles use linear interpolation at position
  `(n - 1) * q` over sorted values (`engine.py`, `percentile`). Any playground metric that shares
  a FleetLab name uses the same rule.
- **T-6 Digests.** Canonical JSON cannot be byte-identical across languages (float formatting,
  key order by code point versus UTF-16 unit), so no screen, export or test claims that a
  playground digest equals a FleetLab digest. Only values are compared.
- **T-7 Enums.** All five outcome values are mirrored, including `MIXED`, which is defined but
  unreachable in a single-regime experiment; the three invalidity reasons are mirrored verbatim.
  PRD §21's example labels an improved primary with a regressed guardrail "MIXED"; the code resolves
  that case to IMPROVED with HOLD. The playground follows the code and notes the difference.
- **T-8 World building.** FleetLab's world uses `math.log`, `math.cos` and `math.exp` (not correctly rounded, and different
  between platforms), `math.sqrt`, an exact big-integer division, `int()` truncation of arrival times,
  and one per-request travel multiplier for both legs. None of that is re-derived in JavaScript; the
  legacy profile consumes a world exported from Python (§5.10).

### Parity proof
One shared fixture file of vectors `(deltas, R, key, direction, margin, guardrails) →
(low, high, outcome, regressions, recommendation)`, generated from the Python functions and
checked by both `pytest` and `node --test`. Required vectors: the FLEET-005 primary deltas at
`R = 2000`; `R = 1020`; `R = 1060`; a bound exactly at `-margin`; a bound exactly at
`+margin`; `higher_is_better`; a guardrail harm exactly equal to `max_harm` (not a regression);
an absent guardrail metric; a single-delta set (`n = 1`, an edge case of the bootstrap function that no spec can reach); `R = 100000`; `n = 200`;
all-equal deltas; a negative-zero delta; and a delta set where a compensated sum and a
left-to-right sum differ (for example `[1e16, 1.0, -1e16]`).


## 7. Interaction design

### 7.1 Modes

| Mode | Job | Produces | Never |
|---|---|---|---|
| **Learn** | Walks one operational question through a fixed preset and three to five annotated moments on the timeline. | understanding, then "Test it properly" into Experiment | shows a verdict; hides a knob it changed |
| **Sandbox** | Free play on one simulated window: change knobs, run it, watch and scrub. | one animated replay, plus a light band across a few replications | claims a difference between two settings |
| **Experiment** | A preregistered paired A/B on one axis with the verdict rules. | a verdict card in FleetLab's words, marked as a teaching run | produces a decision record, a winner or a score |
| **Inspect** | The day of one car or one depot, as a drawer opened from any mode. | a timeline and a ledger for that entity | changes the scenario |

Top bar: `FleetLab Playground  Learn · Sandbox · Experiment  |  Present  |  D1 18:30 · replay 1 of 5 · seed 1001  |  Teaching model`.
There is no URL state in the first build.

**Present is a layer, never a fourth mode (built 2026-09-16).** The four modes above are unchanged. `Present` is a
pressed toggle after them that turns the page into a stage, a ledger and a rail and walks §4.2's four chapters; the mode
underneath carries and is restored untouched when the walk is left. It has its own store key (`present: {on, chapter,
beat, stop_s, prepared}`) with pure reducers, so where the walk stands is state like any other. Opening it starts at the
first beat of the first chapter; leaving it keeps `prepared`, because the two runs `Prepare` made are still in the store
and re-entering must not run them again. Nothing about it is persisted: a reload starts clean (§9.4, D-11). The walk's
keys (arrows, Home, End, 1 to 4, Space, Escape, `?`) are bound to the rail alone, so they change nothing the page does
elsewhere.

**What carries across.** From Learn to Sandbox: the preset, the clock and the selected entity. From Sandbox to
Experiment: the scenario becomes the baseline, and the last knob changed pre-fills the axis with its old and new
values. From a verdict to Inspect: choosing a seed opens that seed's world in both arms.

**Freeze rule.** Running an experiment freezes its spec. If Sandbox changes afterwards, the verdict shows
`Spec frozen at 14:02 (your clock). Sandbox has changed since (3 knobs). This verdict is about the frozen spec.` Editing the
setup marks the verdict out of date; nothing re-runs silently. A session log lists every run with its seed set and spec digest, so choosing another seed set stays
visible.

### 7.2 Layouts

Breakpoints: desktop 1280 px and wider, tablet 768-1279 px, phone below 768 px (designed at 400 px). The page
gutter is at least 16 px everywhere; wide tables and the depot board scroll inside their own containers.

**Sandbox, desktop**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Playground  Learn  [Sandbox]  Experiment  D1 18:30 · replay 1 of 5 · seed 1001      Teaching model│
├───────────────┬─────────────────────────────────────────────────────┬──────────────────────────┤
│ KNOBS  Reset  │ MAP (schematic)        [THIS REPLAY · seed 1001]    │ NOW · THIS REPLAY        │
│ Preset: Bay   │                                                     │ waiting riders      23   │
│ 3 changes     │   [SF]════H3 20════[EB]                             │ unserved this hour   4   │
│               │    ║ ▣SF-1 ▣SF-2      ▣EB-1                         │ SF-1 lot         41/60   │
│ ▸ Fleet       │   H1 25                                             │ SJ-1 lot         25/30   │
│ ▸ Depots      │    ║                                                │ cars on highways    31   │
│ ▾ Demand      │   [PEN]════H4 30════[SJ] ▣SJ-1                      │──────────────────────────│
│  off-peak /h  │                                                     │ ACROSS 5 REPLICATIONS    │
│  [ 10 ] 0-120 │   yards: bars per state · pinned car SF-017 drawn   │ wait p90   9.8 to 12.1 min│
│  peak /h      │   legend: rider work · empty drive · available ·    │ unserved   3.1 to 4.4 %  │
│  [ 35 ] 1-120 │           at depot                                  │ [Table]                  │
│ ▸ Routes      ├─────────────────────────────────────────────────────┴──────────────────────────┤
│ ▸ Rules       │ ◀◀ ▶ ▶▶  900×   [AM peak] [PM peak] [D2 first wave]    D1 05 ── 12 ── 18 ▲ D2 06 10│
│ ▸ Riders      │ demand ▁▂▅█▆▃▃▃▄▆█▇▄▂▁▁▂▅   traffic ░▒▓▒░░░░▒▓▓▒░░░░▒▓                         │
│ [Run window]  ├──────────────────┬──────────────────┬──────────────────┬─────────────────────────┤
│               │ Fleet state      │ Wait p90 by hour │ Depot bay wait   │ Available cars by area  │
└───────────────┴──────────────────┴──────────────────┴──────────────────┴─────────────────────────┘
```
The numbers in every wireframe are placeholders that show layout, not results. Columns: 280 px knobs, a
flexible map, a 260 px NOW panel; the chart row is 220 px and shares the clock cursor. **Tablet:** knobs become
a left drawer (`Knobs · 3 changes`), the NOW panel folds under the map, charts form a 2 × 2 grid. **Phone:** map,
then transport, then a segmented control (`Now | Charts | All replications`) showing one group at a time; knobs
open as a full-height sheet with a sticky `Run window` button.

**Presenting, 1280 px and wider (built 2026-09-16)**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Teaching model: a sketch of Bay Area place names with invented numbers. Not evidence about … │ strip
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ FleetLab Playground  Learn Sandbox Experiment  [Present]      D2 02:00 · replay 1 of 5        │ top bar
├───────────────────────────────────────────────────────┬──────────────────────────────────────┤
│ THIS REPLAY · seed 1001                    [Table]    │ 1 Operations                         │
│ OPS-01 Evening crunch: more cars in SF · 0 changes     │ SF-2 at 02:00          D2 02:00      │
│                                                       │ queued across the four depots        │
│        the isometric picture, or the flat one         │ 56                  THIS REPLAY      │
│                                                       │ SF-2 stalls held                     │
│ Traffic changes on the hour … An isometric sketch …   │ 25/30               THIS REPLAY      │
│ One body is one car on a route, or carries a count …  │ depot held queue bays ready          │
│ pick output: SF-017, on a trip  [Inspect] [Pin]       │ narration · rule · caveat chip       │
│ Teaching model                                        │ JUST HAPPENED · THIS REPLAY          │
├───────────────────────────────────────────────────────┴──────────────────────────────────────┤
│ [Play][Back][Next] 1 Operations 2 Analytics 3 Simulation 4 Product sense Step 4 of 5 300×     │ rail
│                    [Leave the walkthrough]  ▸ Keyboard shortcuts                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ footer: Every number here is illustrative. engine: worker  reduced motion                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Grid areas `strip / top / map ledger / rail / transport / footer`, columns `minmax(0, 1fr) minmax(360px, 480px)`. The
knobs, the side column (NOW and across replications), the chart row, the segmented control and the transport's control
row are `hidden` and `inert` while presenting, because their numbers are the ledger's numbers; the strips container
stays. The map region keeps its replay chip, its world line, its `Table` toggle, its honesty captions and its legend;
the `Isometric | Flat` group is hidden while presenting, because the rail is the only row of controls there and the
picture is not a thing to choose between (owner answer, 2026-09-16). The one beat that shows both arms of a verdict seed
hides the map region exactly as opening the fork from the verdict card does, and the rail says why in words.

DOM order is stage, ledger, rail, which is the order they are read and tabbed through: the presenting grid never moves a
region past another (§7.7). The ledger is itself a tab stop, because its own box is what scrolls and a beat with no
control inside it would otherwise put its overflow out of every keyboard's reach.

The stage is capped by the viewport height at the picture's own 640 by 500 ratio, against a constant
`--present-chrome: 412px` for everything above and below it: the strip, the top bar, the rail, the gaps, and the map
panel's own header, honesty captions, legend and pick output. Measured in a browser on this source, light theme, with
`document.hidden` true, so these are layout numbers and never frame numbers: the strip, the top bar, the rail and the
gaps take 161 px, and the map panel spends 57 px above the picture and 171 px at 1512 px or 188 px at 1280 px below it.
At 1512 x 982 the canvas is 730 x 570 (scale 1.14) and the rail's foot stands at 958 of 982; at 1280 x 800 it is
497 x 388 (scale 0.78) and the foot at 794 of 800. The smallest body face on screen, measured off the canvas's own
fills, is 5.65 px at 1512 x 982 and 3.85 px at 1280 x 800, which is why the advice is to present from a 14-inch display
at 100 percent zoom (§8.2).

Below 1280 px the presenting layout is one column in DOM and tab order: strip, top bar, stage, ledger, rail, transport,
footer. It works and it is not polished for a phone: the compact rail, two figures a beat and the phone form of the
reading card were planned as a later phase and are not built.

**Depot inspector (drawer, 560 px on desktop)**
```
┌ DEPOT SJ-1 · San Jose ─────────────────────────── THIS REPLAY · seed 1001 · D1 19:30 ── [Close] ┐
│ Stalls 22/30 · in bays 3 · 3 clean + 1 service bays · 24 h    Staff not modelled: a free bay     │
│                                                              always has someone to work it.      │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ NOW    Arriving 3 → Intake 1 → Queue 2 (oldest 11 min) → C1 SJ-022 clean 14/20 · C2 SJ-004 3/20 │
│        · C3 free → S1 SJ-011 service 40/45 → Ready 19                                              │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ BOARD  C1 ░░██░░███░░██░░░████░░       lot held ▁▂▃▅▆▇▇▆▄▃▂▁                                     │
│        C2 ░░░██░░░███░░░░░██░░░       queue    ▁▁▂▃▅▃▂▁                                           │
│        S1 ░████░░░░░░████░░░░░░       D1 05 ── 12 ── 18 ▲ D2 06 10                                 │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ LEDGER (this replay)          value           across 5 replications                               │
│ bay wait p90                  11 min          9 to 14 min                                          │
│ time to ready p90             not available: 2 visits unfinished at drain end                      │
│ diversions                    4               2 to 6                                               │
│ [Table]  [Open cars in the queue]                                                                  │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```
The lot figure counts cars holding a stall (in intake, queued or ready, P13); cars in bays are counted separately.
Phone: stages as a vertical list, then the board inside its own horizontal scroller, then the ledger.

**Experiment setup (one sheet)**
```
┌ EXPERIMENT · setup ──────────────────────────────────────────────── Teaching run, not a decision record ┐
│ 1 QUESTION    [Does sending cars to the nearest depot change SF morning wait?                  ]      │
│ 2 SCENARIO    Baseline = "Evening depot visit in San Jose" + 0 changes   [View differences]            │
│ 3 ONE CHANGE  axis [policy:depot_assignment ▾]  Teaching-model axis: FleetLab cannot run this          │
│               baseline [home_depot]   candidate [nearest_depot]                                          │
│ 4 PRIMARY     [wait.p90_s ▾] scope [SF] [D2 07:00 to 09:00]   lower is better · s                       │
│               equivalence margin ±[ 60 ] s   "differences smaller than this count as no change"         │
│ 5 GUARDRAILS  exposure.congested_empty_s max harm [0] s · always available                             │
│               depot.parking_peak_fraction scope [SJ-1] max harm [0.10] · always available               │
│               unserved.fraction max harm [0.01] · always available                                      │
│ 6 SEEDS       [20] paired replications · resamples [2000] · frozen when you run · about 6 s             │
│ CHECKS  one axis · margin above 0 · metrics registered · ranges valid · scopes valid                    │
│ [Freeze and run]                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Deviation from PRD §27 Page 1: the ten wizard steps collapse into six blocks on one sheet, because seeing the
whole preregistration at once is the lesson. On a phone the blocks become an accordion, and `Freeze and run` stays
disabled until every check passes.

The preset chooser groups its entries: the Experiment presets, the two L2 specs, and one group per casebook theme, headed
`Operations casebook: Rain` and so on (§4.4). For a casebook preset a SITUATION block sits above block 1: a lead line
saying the situation is played through the knobs as a proxy, every number invented and the verdict a teaching result;
the situation; each proxy part as *stands for*, *set as* and *misses*; an "Outside this model" list; and a Watch line
that names the primary against its margin and each guardrail against its maximum harm, with setup facts only. The block
never names a verdict or a direction (H-9).

**Verdict.** The layout below quotes FleetLab's measured FLEET-005 record through a public-safe projection (margin 30 s, the
single guardrail `unserved.fraction` at 0.02, seeds 101-110), to illustrate the card. A teaching run shows its own
numbers in the same layout.
```
┌ VERDICT ─────────────────────────────── Teaching run, not a decision record · spec frozen · 10 paired seeds ┐
│ GATES   Validity ──→ Guardrails ──→ Primary outcome ──→ Recommendation                                  │
│         VALID        1 REGRESSED     REGRESSED            HOLD                                          │
│                      decides         shown, not needed    "a guardrail was harmed; hold"                │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PRIMARY  wait.p90_s · candidate minus baseline per seed · left is better                                 │
│          95% interval                               [══════●══════]  +735.9 to +919.2 s                  │
│          seeds                                   •  ••• ••• •• •                                        │
│          ▒▒│▒▒ band ±30 s                                                                                │
│          −100   0  +100            +600       +800      +1000 s                                          │
│          The whole interval lies right of the band: REGRESSED.                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ GUARDRAILS            mean harm   max harm   status                                                      │
│ unserved.fraction     +0.057      0.02       REGRESSED  ▕━━━━━┃━━━━━━━━━━━━━━━━▏                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DESCRIPTIVE (no claim)  wait.p50_s +29.4 · requests.served −25.5 · requests.unserved +25.5 · [all rows]  │
│ LIMITATIONS  synthetic inputs · one regime · the interval measures simulation variation only · [all]     │
│ [Watch a typical seed (median delta)]   Watch the largest delta   [Back to setup]                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
The verdict chip sits inside the card's border, so a cropped screenshot keeps it. In the quoted FLEET-005 panel the
chip reads the FLEET-005 label of §1.3 instead. `[all rows]` lists every descriptive row in the record's order. The projection shows these values unmodified: validity,
outcome, recommendation, the primary's means, mean and median delta and interval, each guardrail's mean delta and maximum
harm, and each descriptive row's means and delta. It suppresses the record's label tuple (H-8), every digest (P-10), and the
values of `fleet.utilization_fraction` and the two business-proxy aliases, which are named with `not shown here: see the
differences panel` (§5.7, FL-2). The ASCII strip is not to scale; the built strip uses one linear axis. The descriptive delta rows make a
non-primary change visible (UC-09's flat primary beside a rising queue). The default action opens the seed with the
median primary delta; picking the largest shows `You picked the largest delta. It is not typical.` An invalid
experiment draws no strip, interval or outcome, only the reason and `Void evidence has no outcome. It says nothing
about the candidate.`

### 7.3 The map

- **Form:** a schematic in the manner of a transit diagram. Four areas are rounded-rectangle yards at fixed
  positions that loosely keep relative geography (SF north-west, EB north-east, PEN centre-west, SJ south).
- **Routes:** each pair has a highway (6 px casing, 2 px centre rule, a shield with its fictional id and free-flow
  minutes) and a local route (2 px line, labelled on hover or focus), drawn as parallel paths. Congestion shows as
  chevron density per 40 px (0 below ×1.2; 1 from ×1.2 to below the RD-4 threshold; 2 from the threshold to below
  ×2.0; 3 at ×2.0 or more, so every congested minute draws at least 2), the route tooltip of §1.3, and a neutral
  casing step; never a hue, never dashed. Chevrons are static: they change only when the clock crosses an hour. A
  highway shield stands beside its road rather than on it, with a 1 px leader back to the line, because a plate is
  opaque and cars paint below it: the placement scorer counts the pixels of drawn line a plate would cover, keeps
  plates clear of one another, and reads only the routes and the geometry, so a shield never moves when a run lands or
  the clock advances. It takes the centre of a drawn mark out from under a plate entirely on the wide map, and from
  37.2% of car-frames to 8.76% on the phone, where two short corridors have no room and keep their plates on the line.
- **Depots:** a square tile inside its area with its id and a three-part micro-bar (queued, in a bay, ready) above a
  lot fill. An area with no depot shows its yard only.
- **Cars:** each yard shows unit bars (one block per 5 cars, grouped by state family, labelled `1 block = 5 cars`).
  Individual glyphs for every car on a route; cars standing in an area are drawn as unit bars, because the model gives
  an area no inside geography. A car at a depot stays part of that tile's micro-bar for the same reason: a queue
  position is model state, a position inside an area is not. A glyph sits at the progress the interval log gives its
  car along the route's visible segment and points along that direction; only the four driving states reach it, so a
  route mark is only ever a triangle or a diamond in the two route hues of §8.2. The pinned car is always drawn
  individually with its glyph and a 2 px focus ring, and on a route it takes the same heading, so it covers its own
  mark rather than sitting unrotated on top of it. Marks paint above the yards and below the shields (nothing covers a
  shield id), carry no `tabindex` and are hidden from assistive technology: they rearrange numbers the table twin
  already carries per route and direction and add no fact of their own, so the schematic is still exactly one tab stop
  (§7.7). The legend carries both encodings at once, `1 block = 5 cars` beside `One mark is one car on a route. Cars
  inside an area are drawn as blocks of 5.`
- **The route fallback:** a route direction draws marks only where its visible length on this schematic is at least
  three units for every car it holds at that direction's busiest snapshot of the run; otherwise it keeps the flow band
  split into rider work and empty driving, and the map writes the reason in visible text under the schematic
  (`H1 Peninsula to San Francisco is short on this schematic, so the cars going that way are drawn as a band.`). Three
  units a car is a measured legibility floor, not a model number. The decision is made once per run and geometry from
  the run's own snapshots, so no direction changes encoding mid-playback, and it is made per direction rather than per
  route, because a corridor can band one way and draw marks the other, and a reason written for the whole route would
  then contradict half of what is drawn on it. A banded direction's band counts that direction's cars alone, so one
  quantity is never drawn twice. Measured: at the default preset the wide map bands one direction of H1, whose San
  Francisco to Peninsula corridor is 50 units against 104 on the phone, and the phone bands nothing; at the 150-car
  reference fleet of §5.9 the wide map bands both directions of H1 and the phone still bands nothing.
- **Model limits:** the map carries a limits chip with two of §5.8's caveats in that table's own words, `Traffic
  changes on the hour, as you set it.` and `Areas are points: pickups inside an area take a fixed time.` The first is
  owed because a car never re-plans mid-leg, so marks of different leg times share a stretch of road and read as
  driving behaviour the model does not have; the second is why the yards still show bars while the routes show cars.
  Both are visible text with no tab stop, and both stand before a run as well as during one, because they are about
  the model and not about a replay.
- **Corner stamp:** `Teaching model` in the map's lower-right corner.

**The isometric picture (built 2026-09-16), and the flat fallback.** The map region can draw the same second as a
Canvas 2D isometric schematic instead of the SVG one. Only one picture is on screen and only the visible one draws; the
hidden one is `hidden` and `inert`, so its stops leave the tab order and the map stays exactly one tab stop. Both read
the one frame model the page computes per frame (`frameModel`, decision 42) and share the chip, the world line, the
table twin, the tooltip, the crowded-route reasons, the limits chip and the legend, so the two can never disagree about
one second. `Isometric | Flat` sits in the map header outside the walkthrough. A browser whose canvas gives no 2D
context keeps the flat picture and the map writes the reason in visible text.

- **Projection and geometry.** A 2:1 dimetric projection (`sx = x - y`, `sy = (x + y) / 2 - z`), a fixed camera, no pan,
  zoom or rotate. Platform centres are the flat schematic's own area centres pulled back through the inverse
  projection, so the tilted picture is the same diagram stood up. Platforms are flat squares of half-side 49 units wide
  and 31 on the phone, filled in `--panel-alt` with a 1 px `--rule-strong` edge: no texture, no shoreline, no street,
  no building, and no raised slab that could hide a body.
- **Ribbons.** A highway is 7 units wide at offset -8 from the centre line, a local route 3.5 at +8, both flat on the
  ground and clipped at the platform edges. Congestion is the same encoding as the flat picture: chevron density per
  40 units of ribbon, cached per direction and level, plus a neutral step from `--rule-strong` to `--faint` on a
  congested half; never a hue, never dashed.
- **Bodies.** One box per car whose place is a route, at `placeCar`'s own fraction along its ribbon and pointing along
  it; three visible faces, each the family's hue shaded per face; a 1 px `--ink` edge on every body; a hollow top for
  `ENROUTE_PICKUP` and `REPOSITIONING` against a filled one for `ON_TRIP` and `TO_DEPOT`. Only those four states ever
  reach the picture, and only the two route hues (§8.2).
- **Cubes.** One cube stands for five cars standing in an area, in rows from the platform's back corner by family, for
  the same reason the flat picture draws unit bars: the model gives an area no inside geography. Where a cube stands on
  its platform means nothing, and the legend says so.
- **Depot blocks.** A white block at its platform's own corner, a second depot of the same area below the first. Its
  lot fill is a band climbing the two visible side faces at `stalls_held / parking`, with a 1 px `--ink` line along its
  top edge; its bay cells are one row along the top, the cleaning bays then the service bays, flat and panel-coloured
  when free and raised and filling when busy, the fill being elapsed over the task time you set, clamped to 1, with a
  blocked car's cell full and its reason written. The queue and ready bars stand at the back corners, capped at 12
  units, so the bar is a hint and the number under the block is the fact. This is where the map motion plan's Phase 3
  (bay cells) landed.
- **Coincidence.** Bodies are grouped per frame in model space by `(route, direction, fraction)` and then by state
  family: one body and one `×N` plate per family in a group, so a mixed group draws two bodies and never one in one
  hue, and the same clock at two canvas sizes gives the same counts. Grouping in model space is the honesty rule: a key
  coarser than the leg's own fraction invents coincidence the log does not hold. Measured on the default preset at the
  recall second, the recall puts whole convoys on one leg at one instant and five stacks of 22, 18, 9, 9 and 9 carry 67
  of the 85 cars on routes.
- **Riders.** Up to eight `--ink` rings along a platform's front edge, each arc the rider's elapsed time over the
  patience you set, with the true count always written beside them; an unserved rider is the word and the count in
  `--hold`, folded after ten simulated minutes, never on a ribbon.
- **Every word is DOM.** The canvas never calls `fillText` or `strokeText`. Area names, depot ids, route shields, the
  numbers under each block, the waiting and unserved texts, the count plates and the pinned car's plate are HTML in an
  overlay with `contain: layout paint`; static labels are placed once per geometry by a scorer that refuses any overlap
  of two 44 px targets and keeps the numbers tag inside the stage at both geometries, and per-frame elements move by
  `transform` behind a same-string guard, never by `left` or `top`. The overlay carries the map's 20 roving stops (4
  areas, 4 depots, 12 routes) with the same grammar as the flat picture; the canvas itself is `role="img"` with
  `tabindex="-1"` and writes its accessible name only when the picture is at rest. The replay chip, the world line, the
  `Table` toggle and the `Isometric | Flat` group stay in the map header as they were, and the corner stamp stays where
  it has always sat.
- **The route fallback.** The same rule as the flat picture's, applied to the isometric ribbon lengths: a direction
  whose corridor is shorter than three units for every car it holds at its busiest snapshot keeps a flat band and the
  map writes the reason. Measured: nothing bands on the wide picture at the default fleet or at §5.9's 150-car
  reference, and nothing bands on the phone, where the two short corridors are 77 units and hold at most 20 cars a
  direction. The isometric ribbons are longer than the flat ones in the corridors that band there, which is why the
  flat picture bands one direction of H1 wide and this one bands nothing.
- **Reduced motion and staleness.** Reduced motion is the frame the page already hands it (`interpolate: false`), so
  bodies land on the 5-minute grid with no second code path, and the same second drawn twice is call-for-call
  identical. A stale replay greys the picture through the same class the SVG uses.
- **Model limits.** Three more caveats join the map's chip whenever the isometric picture is on screen (§5.8), and the
  legend line swaps to `One body is one car on a route, or carries a count. One cube is 5 cars standing in an area.
  Where a cube stands on its platform means nothing. A car inside an area is a cube, not a body.`
- **The world line.** Under the replay chip, on every replay surface: the preset's name and its changed-knob count
  (`OPS-01 Evening crunch: more cars in San Francisco · 0 changes`). It comes from the run, not from the knobs, because
  a finished replay survives a preset switch and a chip that named a seed but not a world would let one world pass for
  another.

### 7.4 Time and the two registers

- **Run first, then replay.** `Run window` computes the whole event log; playback only replays it, seeking against
  snapshots every 5 simulated minutes, so scrubbing never runs the model.
- **Controls:** play and pause; speed 60×, 300×, 900× or 3600×; step 5 minutes or 1 hour; a scrubber spanning the whole
  window (CLK-1; `D1 05` to `D2 10` in every preset) with the warm-up (CLK-2) shaded inside it and labelled
  `warm-up, not counted`; jumps to `AM peak`, `PM peak` and `D2 first wave`; the clock in
  monospace, `D1 18:30`, never AM or PM.
- **Reduced motion** (the operating-system setting or the in-app toggle, which wins): no interpolation; cars jump
  between 5-minute snapshots; no autoplay; play advances one 5-minute step per second.
- **Two registers, used everywhere (H-10):**
  1. `THIS REPLAY` (a dark chip with the seed) and `ACROSS N REPLICATIONS` (an outlined chip with the count). Every
     number sits under exactly one of them.
  2. The map and every per-frame counter carry `THIS REPLAY`.
  3. Charts show both: the spread across replications as a light 10th-to-90th percentile band, and this replay as a
     2 px line, with the legend `band: 5 replications · line: the replay you are watching`.
  4. Verdict numbers never appear beside the map without their chip. Choosing a seed says
     `Now watching seed 1007 (7 of 20). The verdict came from all 20.`
  5. **The fork (D-10)** is two full runs on the same world with the pinned car highlighted in both, captioned
     `Two full runs on the same world. Every other car also differs between A and B.`

### 7.5 Charts

Chart titles and summaries name a metric in words ("wait p90", "bay wait p90 at SF-2") with windows on the clock; the
verdict card and setup sheet keep FleetLab's metric names with readable scopes. Every chart has a one-sentence summary
generated from its data, a `Table` view, a model-limits chip (§5.8), and the
shared cursor.

| Chart | Form | Reads |
|---|---|---|
| Fleet state | 100% stacked area by hour in state families | clipped state intervals (P15); sums to the fleet by construction |
| Metric by hour | one metric per panel: a step line for this replay over a band across replications; panels stack on one time axis, and panels of one metric share their y-axis | a registered metric scoped by hour: `wait.p90_s`; `exposure.congested_empty_s`; `depot.turnaround_p90_s` by arrival hour; `depot.bay_wait_p90_s`, one panel per depot. An hour where the metric is absent is a hatched gap with its reason |
| Demand strip and traffic strip | step lines under the scrubber: requests per hour for the selected area (the declared profile, and this replay's accepted requests), and the declared multiplier for the selected road class and direction | the profile you set; this replay |
| Arm comparison | one small panel per metric; baseline and candidate bars on that panel's own axis, each bar the seed mean with a 10th-to-90th percentile whisker | across N replications |

| Available cars by area | one small panel per area, shared axes | `fleet.available_fraction` scoped by area and hour |
| Car timeline | a lane of state segments; two lanes in a fork, with a strip of SF available cars on the same axis | the car's interval log |
| Depot board | bays as lanes of busy blocks, with lot held and queue length as step lines on the same axis; both depots of a move on one clock | the depot's visit log |
| Verdict | a paired-delta strip for each metric shown, each with its own axis and interval, the primary's with its margin band; guardrail bullet rows; descriptive delta rows | the verdict rules (§6) |

### 7.6 Knob panel

- **Groups:** Fleet, Depots, Demand, Routes and traffic, Rules, Riders and clock. Greyed groups say
  `Charging: not modelled (cars never run low)` and `Staff: not modelled`.
- **Units** sit beside every field; internal seconds display as minutes.
- **Ranges** are enforced visibly: steppers stop at a bound; a typed out-of-range value stays in the field, marked
  and explained, never silently clamped.
- **Differences from the preset:** a `3 changes` header lists each change with its own reset; a changed knob gets a
  2 px `--ink` rule on its left.
- **Stale results:** after any change, results stay visible but desaturated, labelled `Out of date: Run window`.
- **Invalid combinations** use four visible slots, as FleetLab's authoring errors do:
  ```
  Can't run this window
  WHAT FAILED   Depots on the map: 0
  WHY           Cars need at least one depot to be cleaned.
  HOW TO FIX    Add a depot in any area.
  WHICH KNOB    Depots › Depots per area          [Go to knob]
  ```
  Other checks: total cars above 500; peak below off-peak; overlapping peak windows; a congestion profile missing an
  hour; rider patience shorter than the in-area pickup time (a warning: most riders will give up first).

### 7.7 Accessibility and states

- **Keyboard:** tab order runs top bar, modes, knobs, `Run window`, map, transport, NOW panel, charts, footer. The map
  is one focusable region with roving focus: arrow keys move between areas, Enter moves into an area's depots and routes,
  Escape moves out, `I` opens Inspect. With the map, transport or timeline focused: Space plays or pauses, `,` and `.`
  step 5 minutes back and forward, Shift with `,` or `.` steps an hour, and `[` and `]` change speed. Arrow keys step
  time only when the transport or timeline has focus. Shortcuts never apply globally. `?` lists them. Focus is a
  2 px ring with a 2 px ground-coloured offset; touch targets are at least 44 px.
- **Screen readers:** the map has a table twin (per area: cars by state family, waiting riders, unserved in the last
  hour; per depot: stalls held, queue, in bays, ready; per route and direction: the planned time for a departure now and
  its chevron level), announced through a polite live region on pause, on step, and at most once
  per simulated hour during play. Chart summaries name their register. The verdict has a heading-structured text version
  in gate order.

| State | Treatment |
|---|---|
| Nothing run yet | the static map with routes and depots; "Set the window, then Run window. Nothing moves until you do." |
| Computing | progress by unit of work ("Replication 3 of 5", "Seed 7 of 20, both arms"), always cancellable; the previous result stays, desaturated |
| An invariant fails | "This run broke a model rule: a car was assigned two riders at once (invariant 2). The result is void and nothing is shown. This is a bug in the teaching model, not a consequence of your settings." with `Copy details` |
| Experiment invalid | the verdict's invalid treatment (§7.2) |
| Engine stopped | "The simulator stopped. Your knobs are kept." with `Retry` |
| A slow device | when frames average above 40 ms for 3 s: 5-minute stepping, with `Simplified drawing for this device` and `Use full drawing`; when an experiment is estimated above 60 s, suggest fewer seeds and say how the interval widens |

| Interaction | Target, laptop / phone |
|---|---|
| Knob edit to validation feedback | 100 ms / 100 ms |
| Legend focus, cursor move | 50 ms / 50 ms |
| Scrub seek | 50 ms / 120 ms |
| Frame rate at the reference preset | 60 fps / 30 fps |
| Run window, reference preset | 500 ms / 1.5 s (progress after 300 ms) |
| Experiment, 20 seeds × 2 arms | 10 s / 45 s, per-seed progress, cancellable |
| Mode switch with carried state | 200 ms, no recomputation |


## 8. Visual system

**Design read.** An operational teaching tool, scanned and operated rather than read top to bottom, extending the
existing Hermes public identity. **Dials.** Layout variance 3 (predictable panels; a tool, not a landing page).
Motion 4 (one justified continuous motion, the simulated clock moving cars; everything else is state feedback).
Density 8 (data-forward, summary before detail).

### 8.1 Tokens (Hermes identity, with three corrections)

The token names and values come from the published Hermes page. Three light-theme text steps fail WCAG AA for small
text as measured (Appendix A.3) and are corrected; dark values are unchanged.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#F7F8FA` | `#0F1319` | page |
| `--panel` | `#FFFFFF` | `#161B23` | map, charts, drawers |
| `--panel-alt` | `#EEF1F5` | `#1C222C` | table heads, rails |
| `--ink` | `#14181F` | `#E6EAF0` | text; 17.79:1 and 14.31:1 on panel |
| `--muted` | `#5C6673` | `#9BA5B4` | secondary text; 5.83:1 and 6.94:1 |
| `--faint` | `#8A93A0` | `#6E7885` | non-text only (gridlines, out-of-service marks); 3.11:1 and 3.86:1 |
| `--faint-text` (new) | `#666D77` | `#9BA5B4` | small labels that must be read; light 5.23:1 on panel, 4.92:1 on ground, 4.61:1 on panel-alt; dark 6.94:1, 7.48:1 and 6.42:1 |
| `--rule`, `--rule-strong` | `#DDE2E8`, `#C3CBD5` | `#262D38`, `#38414F` | hairlines, route casings |
| `--accent`, `--accent-soft` | `#1F5FD4`, `#E8EEFB` | `#7BA5F0`, `#1A2437` | selection, focus, the primary action only |
| `--pass` on `--pass-bg` | `#2C784C` on `#E4F0E9` (was `#2E7D4F`: 4.31:1, now 4.60:1) | `#6FBF8E` on `#16281E` (7.02:1) | IMPROVED, ADVANCE_TO_NEXT_TEST, VALID |
| `--cond` on `--cond-bg` | `#935F00` on `#F6EDDA` (was `#9C6500`: 4.22:1, now 4.65:1) | `#D9A441` on `#2B2314` (6.90:1) | INCONCLUSIVE, RUN_MORE_EXPERIMENTS, NOT EVALUABLE |
| `--hold` on `--hold-bg` | `#C0392B` on `#F8E6E3` (4.51:1) | `#E8776A` on `#2E1917` (5.74:1) | REGRESSED, HOLD, a regressed guardrail, unserved riders |
| `--invalid` on `--invalid-bg` | `#5C6673` on `#E7EAEE` (4.83:1) | `#9BA5B4` on `#1F252E` (6.19:1) | INVALID_EXPERIMENT |

UNCHANGED and NO_RECOMMENDATION take no status colour: `--ink` text on `--panel-alt` with a 1 px `--rule-strong` outline,
because an equivalence claim is neither good nor bad news. Status colours are reserved for verdict words, guardrails and
unserved riders, always beside a glyph and the literal word; they never colour a series, a car or an area.

**Type.** The offline build makes no network request (D-09), so it uses system stacks:
`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` for the interface (14 px in panels, 16 px in Learn text,
600 for titles) and `ui-monospace, "SF Mono", Menlo, Consolas, monospace` for the clock `D1 18:30`, ids (`SF-017`, `SJ-1`,
`C2`, `H2`), knob values, enum words and tabular columns with `tabular-nums`. The Hermes page's web fonts are an owner option
only if they are inlined under the content security policy (D-09).

### 8.2 Car state encoding (computed, not eyeballed)

Hues come from the documented reference palette in its fixed slot order and were validated against the Hermes panels
(`#FFFFFF`, `#161B23`); results in Appendix A.2. Shape carries the state; colour groups states into families and is never the
only cue.

| Family | Hue, light and dark | States and glyph | Contrast on panel, light and dark |
|---|---|---|---|
| Rider work | `#2a78d6`, `#3987e5` | `ENROUTE_PICKUP` hollow triangle pointing along its heading; `ON_TRIP` filled triangle | 4.42, 4.75 |
| Empty drive, not for a rider | `#eb6834`, `#d95926` | `TO_DEPOT` filled diamond; `REPOSITIONING` hollow diamond | 3.20, 4.45 |
| Available | `#1baf7a`, `#199e70` | `IDLE` filled circle with a 1 px `--ink` edge | 2.82, 5.07 |
| At a depot | `#eda100`, `#c98500` | never drawn on routes; in the depot tile and inspector `INTAKE` half-filled square, `QUEUED_SERVICE` and `GATE_WAIT` dashed-outline square (the inspector lane names which), `IN_SERVICE` filled square, `READY_AT_DEPOT` hollow circle, each with a 1 px `--ink` edge | 2.17, 5.63 |

- Anything drawn on routes uses only the first three hues: all-pairs validation passes (light worst CVD ΔE 9.2, normal-vision
  24.0; dark 9.4 and 20.9). A fourth hue among route marks fails the all-pairs normal-vision floor, which is why cars at a depot
  are drawn inside the depot tile.
- The fleet-state stack uses all four hues in the order Rider work, Empty drive, Available, At a depot: adjacent validation passes
  (light CVD 9.1, normal 22.9; dark 8.4, 19.8).
- Light-theme Available (2.82:1) and At a depot (2.17:1) fall under the 3:1 non-text minimum, so their glyphs always carry the 1 px
  `--ink` edge, and every chart direct-labels its bands or offers its table view.
- Glyphs are at least 10 px with a 2 px surface ring. States inside a family are told apart by shape on the map and by label and
  lane in the inspector, never by a new hue.
- That 10 px floor with its 2 px surface ring is a floor on each glyph, not a spacing rule between glyphs. Overlap between two
  route glyphs is meaningful and is not a layout failure: two cars at nearly the same point on a route genuinely are at nearly
  the same place, and a chain of overlapping marks is bunching on a slow leg. What decides whether a route direction draws marks
  at all is the measured legibility floor of §7.3 (a visible route of at least three units a car at that direction's
  peak), never this rule. As drawn, a route mark is 10.1 to 11.1 px at 400 px and 10.7 to 11.8 px at 1280 px, inside a surface
  ring of 18.1 to 19.3 px, so the floor is cleared at every width by the ring class the glyphs already carry.
- A route mark is drawn on `--panel`, the surface these hues are pinned against, but the route geometry is clipped at the yard
  boundary rather than short of it, so that holds for a mark's centre and not always for the whole mark. Measured over the whole
  run, default preset wide and phone: the glyph body overlaps a yard on 8.33% and 11.95% of drawn car-frames, the surface ring
  touches one on 12.13% and 17.52%, and the centre lies on a yard edge on about 0.7%, never strictly inside a yard (7.27% and
  11.99%, 10.43% and 17.61%, and about 0.8% at the 150-car reference). On `--panel-alt` rider work is 3.90 and empty drive 2.82,
  and the surface ring is 1.13:1, so it does not separate the mark there either. Both pairs are recorded in `test/a11y.test.mjs`
  beside the unit bars, which have always drawn on that surface; the drawing is not changed here and the gap is stated.

**The body, in the isometric picture (built 2026-09-16).** A body is a box of 10 by 7 by 4 plan units with pixel floors
of 12 px on its longest side and 8 px on its shortest, which bind below scale 1.2 and 1.15 and keep the box legible when
the stage is small. Shape still carries the state: hollow top for `ENROUTE_PICKUP` and `REPOSITIONING`, filled for
`ON_TRIP` and `TO_DEPOT`, in the same two route hues, with a 1 px `--ink` edge on every body. Colour is never the only
cue, and no fourth hue reaches a route.

- **Faces.** One hue per box, three visible faces. On the light theme the two side faces darken to 0.84 and 0.68 of the
  hue, where darkening can only raise the ratio against `--panel`; on the dark theme a darkened side would fall toward
  the ground, so sides lighten to 1.14 and 1.28, clamped. Measured on the tokens (top, +y side, +x side, against
  `--panel`, computed by the drawing's own arithmetic and pinned in `test/a11y.test.mjs`): rider work 4.42, 5.85, 7.85
  light and 4.75, 6.00, 7.16 dark; empty drive 3.20, 4.40, 6.14 light and 4.45, 5.64, 6.34 dark; available 2.82, 3.89,
  5.54 light and 5.07, 6.49, 8.15 dark; at a depot 2.17, 3.05, 4.47 light and 5.63, 7.26, 9.05 dark. The two route hues
  hold 3:1 on every face in both themes. The cube and block hues fall under 3:1 on some light faces and carry the 1 px
  `--ink` edge there, exactly as their flat glyphs do. A side face never sits below its own top face.
- **Extents on screen.** At scale 1.0 a body on the two steep corridors is about 8 by 12 px and on the flattened
  corridors about 15 by 9 px with a top face about 5 px tall. On the presenting stage the smallest body face measures
  5.65 px at 1512 x 982 and 3.85 px at 1280 x 800 (§7.2). On the flattened corridors the within-family difference
  (a hollow top against a filled one) is a thin band, so the state is also carried by the table twin and, while
  presenting, by the ledger's counts. The advice that follows from the measurement is to present from a 14-inch display
  at 100 percent zoom.
- **Overlap is meaningful here too.** Two bodies at nearly the same point genuinely are at nearly the same place. Exact
  coincidence is not drawn twice: the group carries a written count (§7.3). What decides whether a direction draws
  bodies at all is the same measured legibility floor, against the isometric ribbon's own length, never a rule about
  glyph spacing.
- **No hue is spelled in JavaScript.** The picture reads its tokens from the stylesheet at mount and again on a theme
  change, so colour stays in `styles.css` where `test/a11y.test.mjs` reads it, and every fill and stroke on the canvas
  is a token or a shaded face of one. A status colour on a car, an area or a series is still refused.

### 8.3 Other encodings

- **Depot board:** position encodes the bay (one lane per bay, `C1`, `S1`); fill encodes busy (solid) or waiting (outline); lot held
  and queue length are step lines in `--ink` and `--muted`.
- **Routes:** see §7.3; congestion is chevrons, a label and a neutral casing step, never a hue, never dashed.
- **Riders:** a waiting rider is a small `--ink` ring whose arc fills toward the patience limit and stops at assignment; an unserved
  rider is a cross in `--hold` with the count and the word "unserved", folded into the area tally after 10 simulated minutes. The cross stays in the area yard, never on a route, and
  its count and word always accompany it.
- **Absent values:** `not available: <reason>`; in charts, a hatched gap with the same text on focus.
- **Changed knob:** a 2 px `--ink` rule on the left of the field.
- **Charts:** 2 px lines; area washes at 10% opacity; a 2 px surface gap between stacked bands; markers of at least 8 px with a 2 px
  surface ring; solid 1 px gridlines one step off the surface; one y-axis per chart (two measures means two panels on one time axis);
  a legend for every multi-series chart; a crosshair tooltip on time series that never gates a value; a table view for every chart.

### 8.4 Motion

- Playback moves cars `linear`, the one continuous motion, because it depicts an ongoing process.
- That motion is written by the drawing and never by CSS. The car layer writes one composed `transform` per car per frame
  (`translate(x y) rotate(a)`, one attribute so a car is never caught half-moved), and only where the rounded value has changed,
  so a car that has not moved costs nothing. The layer adds no transition, animation, keyframe or `will-change` anywhere, which
  is what keeps `linear` true by construction: cars move because the clock moves, and nothing carries on after the frame that
  says to stop.
- Under reduced motion, cars step on the 5-minute snapshot grid through the interpolation the frame already carries
  (`frameAt(log, clock_s, {interpolate: false})`), which is the path the slow-device fallback of §7.7 already used. The map reads
  no reduced-motion flag of its own and has no second code path: the frame it is handed is already the still one, so position
  stays a pure function of the log and the clock and the same second drawn twice is identical, mark for mark.
- Interface transitions use `ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`: presses 100-160 ms, tooltips 125-200 ms, drawers 200-300 ms;
  `transform` and `opacity` only.
- Knob changes and scrubbing are frequent and keyboard-reachable, so they do not animate.
- No infinite attention motion: no pulsing depots, shimmering figures or looping idle cars.
- Reduced motion is written per element (§7.4), never as a global kill switch.
- **The isometric picture adds no motion of its own (2026-09-16).** A body moves because the clock moves, and the
  canvas redraws only when the model, the pinned car, the hues or the stage size has changed. There is no lighting and
  no tint to animate: the canvas is the same grey at 03:00 as at 15:00, and the overnight is the span between the
  recall second and the release second the knobs set, never a day-and-night cycle the model does not run. The overlay's plates
  move by `transform` behind a same-string guard under `contain: layout paint`, so a frame never touches the page's
  layout. No `transition`, `animation`, `keyframes` or `will-change` was added for it anywhere.
- **A beat change is instant (2026-09-16).** The walkthrough's ledger swaps and the clock cuts; nothing tweens across a
  jump, because a tween would pass through seconds the model never produced, and no figure ever counts up, for the same
  reason. Both reduced-motion blocks in `styles.css` stay exactly as they were, which `test/a11y.test.mjs` asserts
  selector for selector.

### 8.5 Never on this page

A dual-axis chart; a score, gauge, grade or "winner"; a real basemap or real road numbers; any word H-3 bans, negated or not; status colours on series, cars or areas; dashed gridlines; a tooltip as the only path to a value; a hue beyond
the validated sets; a label above every panel; numbered markers except the Learn order, which is a real sequence; em dashes or en
dashes in interface copy; filler verbs; pulsing or looping decoration.


## 9. Architecture and testing

### 9.1 Delivery options

| Criterion | **A. Static ES modules, zero dependencies** | B. Vite and TypeScript | C. Streamlit over the Python engine | D. Python in the browser |
|---|---|---|---|---|
| Interactivity | high: SVG map, canvas timeline, replay of a computed log | high | low: every interaction reruns the script; no smooth playback | medium: the model in WebAssembly, the interface still JavaScript |
| Determinism and tests | high: pure modules under `node --test` | high, but tests need extra packages | high for the model; the interface is hard to test | Python determinism, but a newer Python whose `sum()` differs from 3.11 |
| Drift from FleetLab | controlled by shared vectors and fixtures (§5.10, §6) | the same | none for FleetLab's world, but the richer world would enter the evidence engine before it is proven | low for FleetLab's world; the richer world still needs Python |
| Dependencies | none: no `package.json`, no lockfile | hundreds of transitive packages | a large tree, already an evidence-path extra | a 10-20 MB runtime from a CDN |
| Boundary risk | lowest: a separate top-level folder, enforced by text scans | build output, CI and ignore-file changes | high: collides with the workbench's evidence-path rules | fetches Python source into the page |
| Shareability | one self-contained HTML file, later a static page | needs more build plugins | needs a running server | a single file is impractical |

**Recommendation: A.** It is the only option that yields one offline file, adds no dependency, and leaves the evidence engine
untouched. Its weakness, a second implementation, becomes a checked contract: the verdict rules are value-identical and proven
by shared vectors, FleetLab's own world is reproduced by fixtures, and everything else is declared different on screen.
Development serves the source folder on loopback (`python3 -m http.server --bind 127.0.0.1`), because native modules do not
load from `file://`; a zero-dependency `tools/pack.mjs` inlines the modules into one HTML file that does.

### 9.2 Placement and boundaries

```
playground/fleetlab/
  README.md          what it is, how to open it, "teaching model, not evidence"
  index.html         development shell
  src/core/          sha256.js keyed.js stats.js (round_half_even, percentile, left-to-right sum)
  src/model/         schema.js presets.js ops-cases.js reference-panels.js routes.js world.js engine.js invariants.js metrics.js policies.js experiment.js
  src/legacy/        profile.js world-import.js
  src/instrument/    paired.js bootstrap.js outcome.js guardrails.js recommendation.js summary.js
  src/ui/            app.js store.js labels.js map.js playback.js charts.js inspector.js controls.js experiment.js a11y.js
  tools/             pack.mjs check-dist.mjs
  test/              *.test.mjs
tests/fixtures/fleet_playground/   instrument vectors, the analytical reduction, the exported FLEET-005 world (seed 101)
tests/unit/test_fleet_playground_parity.py
tests/unit/test_fleet_playground_boundaries.py
tools/fleet_playground/regenerate_fixtures.py   the explicitly invoked fixture regenerator (§5.10); writes only tests/fixtures/fleet_playground/
```

| Rule | Requirement | Enforced by |
|---|---|---|
| R1 | Nothing under `src/` references `playground` (import, string or path), and nothing under `src/` runs `node`. | pytest text scan |
| R2 | The playground holds no `.py` file, no `package.json`, no lockfile and no `node_modules`. | pytest file inventory |
| R3 | Playground code writes no file, except `tools/pack.mjs`, which writes only its build output outside the repository or to an ignored path and refuses `artifacts/` and `experiments/`. | node test on the pack script |
| R4 | `src/model`, `src/legacy` and `src/instrument` import only from `src/core` and each other, never `src/ui`, and use no `Math.random`, `Date`, `performance`, timers, `window`, `document`, `globalThis`, storage, `fetch` or `crypto.subtle`. | node import-graph and token scan |
| R5 | `src/ui` uses no `fetch`, sockets, beacons, dynamic `import(`, `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`; all text enters through `textContent`. | pytest and node token scans |
| R6 | No change to `pyproject.toml`, `.gitignore`, `Makefile`, CI or anything under `src/hermes/` before the CI phase, which is an owner decision. | pytest inventory against the base commit |
| R7 | The playground is never launched, linked or embedded by the `hermes` CLI, the workbench or `operator_view.py`. | pytest text scan |
| R8 | No playground file contains any string from `REQUIRED_LABELS`; the test imports the tuple, so it never spells the strings (H-8). | pytest |
| R9 | Exports fail `DecisionRecord` and `ExperimentSpec` validation and carry `evidence_status: NOT_EVIDENCE` (H-4). | pytest on a sample export |

### 9.3 Modules

- **core:** a synchronous SHA-256 checked against `node:crypto`; `u64(...parts)` as a `BigInt` with FleetLab's join rule and an
  assertion that parts are strings or safe integers; `round_half_even`; FleetLab's percentile interpolation; left-to-right sums.
- **model:** `schema.js` declares `playground-scenario 0.1` (every knob with type, range, default, unit and plain help text);
  `presets.js` holds the Bay teaching map, the three Learn presets, the Experiment presets, the quoted FLEET-005 reference and the exploratory two-zone probe panel (quoted from Appendix
  A.9), and builds the twenty operations casebook presets from the records in `ops-cases.js` (§4.4);
  `world.js` builds demand by thinning and the traffic and ride factors; `engine.js` runs the states of §5.3 and emits the event
  log, interval log and snapshots; `invariants.js` checks §5.6; `metrics.js` holds the registry and scopes of §5.7; `policies.js`
  holds §5.5.
- **legacy:** the legacy profile and the loader for worlds exported from Python (§5.10).
- **instrument:** paired runs, the bootstrap, outcome resolution, guardrails and recommendation (§6), and the result summary.
- **ui:** one immutable store with actions (testable without a page), every honesty string in `labels.js`, the map, playback,
  charts, inspector, knob panel, experiment sheet and verdict, and accessibility helpers.

### 9.4 Security and privacy

- **No network.** The packed file carries a content security policy of `default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; style-src 'unsafe-inline'; img-src data:;
  connect-src 'none'; form-action 'none'; base-uri 'none'`. A `check-dist` script fails on any external URL. The packed file
  inlines the engine worker's source as a string and starts it with
  `new Worker(URL.createObjectURL(new Blob([source], {type: "text/javascript"})))`, which is all `worker-src blob:` allows.
  When construction throws, or the worker sends no `ready` message within 1 s, the engine runs time-sliced on the main
  thread, and the session log records which path ran (`engine: worker` or `engine: main thread`). The development shell
  starts the same worker as a module from the source folder.
- **No telemetry,** analytics, error reporting or remote configuration.
- **Storage:** none in the first build (D-11): no `localStorage`, `sessionStorage`, IndexedDB or cookies, so a reload returns
  to the default preset and the system theme. No URL state. No import of files.
- **Disclosure** in a public repository: no operator, company, team or person names in code, presets, comments or commit
  messages; area names and route ids from allowlists (H-2); all numbers labelled illustrative; no claim of calibration, forecast or
  deployment relevance; nothing copied from files the repository ignores.
- **Publishing** the packed file anywhere is a separate owner action, never part of a build phase. A folder for a static
  host (`pack.mjs --site`) carries the stricter policy `default-src 'none'; script-src 'self'; worker-src 'self'; style-src
  'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'`, with no inline
  script, and a `_headers` file that repeats it with `frame-ancestors 'none'`; `check-dist --site` holds it to the same
  rules as the packed file. Putting that folder online is the same owner action.

### 9.5 Tests

| Suite | Content | Gate |
|---|---|---|
| core | SHA-256 against `node:crypto` on 1,000 strings; key-part assertion; `round_half_even` table; percentile and summation vectors; demand gap and destination vectors, including an exact half and a product near 2^53 | exact, under 1 s |
| model units | hand-derived fixtures: one car and one request; a single depot with a known queue; the single-car fixture of §3.5 with σ 0 and its arithmetic in comments; the morning release, including a Peninsula car whose home depot is in SF; a service visit re-queued at a one-service-bay depot; a recall that catches a car on a trip; a gate wait; the intake interval accounted as `INTAKE`; a drain in which ready cars fill a lot so a blocked visit and a gate visit cannot progress, both censored at `T_d`; empty-drive seconds on a leg with pull-out, access, route and in-area segments; every scope rule of §5.7, including a rejected scope | exact |
| invariants | every check of §5.6 on every preset for 5 seeds; seeded defects (a double assignment, a bay overfill, a lot overfill, a teleport, a transition outside the table) each caught by its own named check | every defect caught by its own check |
| determinism | the same scenario and seed give an identical event-log digest twice in one process, and again from the packed file; same-second ordering vectors (a completion, a request, a deadline and a policy clock event at one second, with the decision events they emit); the canonical spec bytes and digests of §6 | exact |
| pairing | both arms share the world digest for every seed; swapping arm order changes nothing; a demand axis changes the accepted requests between arms and nothing else in the world | exact |
| properties | 200 generated valid scenarios: conservation; the fleet-state partition; zero demand serves no one; with σ 0 and no congestion, highway and local choice follows free-flow time | 200 cases under 10 s |
| verdict parity | the instrument vectors of §6 in pytest (Python 3.11 asserted) and `node --test` | value-identical |
| legacy parity | the analytical reduction; the exported FLEET-005 world at seed 101 in both arms: canonical event log, event counts by kind and metrics exact; the collision fixtures; the P-3 precheck world | exact |
| captions | every Learn caption's direction asserted on its fixture (H-9) | exact |
| performance | deterministic proxies in CI (event counts within declared bounds); wall-clock budgets of §5.9 locally under a flag | recorded |
| interface, without a browser | store actions; label snapshots; `check-dist` (no external URL, policy present, forbidden-token scan, size under 2 MB) | exact |
| browser smoke | the packed file from `file://`: play, scrub, run a preset experiment, labels visible, which engine path ran, no console errors, zero network requests; uses a browser-automation install already on the machine, not a repository dependency | local only, recorded in the handoff |
| accessibility | every control labelled; focus order; the live region; every text token computed at 4.5:1 or more on every surface it may sit on, in both themes; reduced motion honoured; a keyboard-only pass in the browser smoke | CI part and local part |

### 9.6 Graduation to FleetLab (later, optional)

A mechanism proven here (located depots, two routes per pair, demand by thinning, depot assignment) reaches the evidence engine
only as a new FleetLab scenario schema version, written from a design note and never ported or transpiled from JavaScript, with a
producer-agreement fixture asserted by both test suites and a deliberate, recorded re-baseline of any pinned digest it moves.


## 10. First build and phases

### 10.1 The first-build slice

The smallest build that fully serves the six seed variables and the worked example.

| Area | In the first build |
|---|---|
| World | four fixed areas; two routes per pair (§2.9); congestion by class, direction and hour for both days; travel variation from the σ grid; cars per area; up to two depots per area with parking, cleaning bays and service bays; peak and off-peak demand with two peak windows and a destination mix; demand by thinning with a declared envelope; a fixed trace across replications; the window day 1 05:00 to day 2 10:00 |
| Rules | nearest-idle dispatch including ready cars; depot assignment (`home_depot`, `nearest_depot`, `nearest_depot_with_capacity`); the visit trigger and end-of-service recall; the morning release; FIFO queues; riders who give up only before assignment |
| Metrics | §5.7 in full, with FleetLab's utilization hidden |
| Invariants | §5.6 rows marked yes |
| Learn | L1 UC-04, L2 UC-09, L3 UC-07 |
| Experiment | presets UC-01, UC-02, UC-03, UC-05, UC-08a, UC-08b, UC-10 and the two L2 presets; one axis; scopes; guardrails with NOT EVALUABLE; frozen spec; session log; the quoted FLEET-005 reference panel and the exploratory two-zone probe panel, with their §1.3 labels; after the first build, the operations casebook of §4.4: twenty presets of kind `ops`, one chooser group per theme, each with a SITUATION block |
| Inspect | car and depot drawers |
| Views | §7.2 layouts; the map with unit bars, one mark for every car driving a route (with the banded fallback and the limits chip of §7.3) and the pinned car; the charts of §7.5; since 2026-09-16 the isometric picture of §7.3 with its depot blocks and bay cells, the flat schematic behind `Isometric | Flat` and as the no-context fallback, `Present` with §4.2's four chapters, the metric registry and the verdict readout, the refusals list and the reading card |
| Engineering | §9.2 placement and rules R1-R9; §9.5 suites; the packed file built locally, not committed (D-09) |
| Not in the first build | charging, staff, closing hours, inspection and quality stages, deep clean, soiled trips, disruptions, cancellations, suppressed demand, planning profiles, offsets inside an area, demand that varies by replication, variable task times, multi-regime experiments, sweeps of any kind, a fifth area, editable geography, individual glyphs for cars that are not driving a route (a car standing in an area or sitting at a depot has no place inside it to draw, §7.3), a day-long bar under the scrubber, URL state, import, FleetLab spec export, a CI step, graduation. Bay cells were in this row until 2026-09-16, when they arrived on the isometric picture's depot block (§7.3) rather than inside the flat depot tile |

**What the 2026-09-16 demo build did and did not do.** Two of four approved phases were built. Phase A is the isometric
world (§7.3, §8.2): the picture, its overlay, the depot block with its bay cells, coincidence in model space, the
pinned plate, picking, the world line, the new captions and the `Isometric | Flat` group. Phase B is the walkthrough
(§4.2, §7.1, §7.2): `Present` as a layer with its own store key, the four chapters and eleven beats, the ledger, the
rail, the ticker, the reading card, `Prepare`, the metric registry, the verdict readout composed from the verdict card's
own builders, the situation block and the refusals list. Phase C and Phase D were cut from this build on purpose and
none of their scaffolding was left behind.

- **Phase C, not built.** The verdict's candidate arm drawn in the world with an `A baseline | B candidate` toggle at
  one second (so beat 3.2 still hides the map region and carries both arms as two lines of numbers in the ledger); the
  day-long bar under the scrubber with the recall and the release ruled on it and the beats ticked (the map motion
  plan's Phase 4), so the day still has no strip and the walk reads clocks instead; a beat that runs another seed set
  to show that the verdict holds; and a place for the `Flat` toggle inside `Present`.
- **Phase D, not built.** The phone polish of the presenting layout: a compact rail, two figures a beat, the reading
  card's phone form, the 768 to 1279 arrangement, and the `Try it` lines that would hand a lone visitor from a chapter
  into Sandbox or Experiment. The layout below 1280 px stacks in one column and works; it is not tuned.

### 10.2 Phases

| Phase | Scope | Gate | Stop and hand back if |
|---|---|---|---|
| 0 Design audit | this document | every checklist item in §12 PASS or an owner-resolved decision | a CRITICAL finding stands |
| 1 Verdict core | `core/`, `instrument/`, the vectors, both boundary test files | vectors exact in both runtimes; boundary scans pass; the Python suite grows only by the new tests; no change under `src/hermes/` | any vector mismatch |
| 2 Legacy profile | `legacy/`, the analytical reduction, the exported FLEET-005 world at seed 101 | reduction exact; FLEET-005 event log, event counts and metrics exact; collision fixtures exact | any parity mismatch |
| 3 Teaching world | `model/`: routes, demand, depots, rules, metrics, invariants, presets | the worked-example fixture exact; every seeded defect caught; properties pass; performance proxies within bounds | the worked example needs a mechanism outside §10.1 |
| 4 Interface | map, playback, charts, inspector, knob panel, labels, accessibility, the pack script | interface tests and `check-dist` pass; the browser smoke recorded | an honesty label would need to hide behind a toggle |
| 5 Experiment and Learn | the setup sheet, verdict, session log, three Learn cases, seven Experiment presets, the two FleetLab reference panels | caption directions asserted; export rejection tests pass | a caption direction disagrees with its fixture |
| 6 CI step | add `node --test` to CI | CI green | owner decision; not started without it |

**Hard stops in every phase:** a parity mismatch; a boundary failure; any need for a dependency; any edit under `src/hermes/`;
wall-clock more than twice a budget; a label removed or hidden; a test deleted or loosened to pass.

## 11. Owner decisions

The owner answered on 2026-09-13: every recommended default below, D-03 as strengthened after the design audit, and
D-11. D-12 was decided during the build on 2026-09-14 on measured evidence and stays open to the owner's review.

| Id | Question | Recommended default | If the other answer is chosen |
|---|---|---|---|
| D-01 | Does the simulated window cross into the next morning? | Yes: day 1 05:00 to day 2 10:00, capped at 36 h. The morning consequence is observed. | A 24 h day turns the next-morning cost into a proxy (`fleet.placement_gap` only); the morning release, day 2 exposure and day 2 wait scopes disappear, and L3 loses half its lesson. |
| D-02 | Charging and state of charge in the first build? | No, shown as a greyed group and a chip: "Battery not modelled: cars never run low." | Adds charge state, chargers, energy per road class, invariants 4, 6 and 7, several metrics, and roughly a third more engine scope; the worked example gains arrival charge and charging time. |
| D-03 | How deep is parity with FleetLab? | Instrument vectors; the analytical reduction; one exported FLEET-005 world (seed 101, both arms) compared on its full canonical event log, event counts and metrics; collision fixtures for string-ordered ids and same-second bay retries; and the P-3 precheck world. Strengthened after the design audit. | Vectors only is cheaper but lets drift in the legacy profile go unseen. All ten FLEET-005 worlds, so the playground can run FLEET-005 end to end, is stronger and costs more upkeep. |
| D-04 | May the playground export anything FleetLab can run? | No. Exports are playground formats that fail FleetLab validation. | Export for legacy-profile scenarios only, with a pytest proving each export validates; it blurs the teaching and evidence boundary, and almost no first-build scenario qualifies. |
| D-05 | Fix FleetLab's defects (§14) before building Experiment mode, or mirror and disclose? | Mirror the verdict rules, disclose in the differences panel, and open separate evidence-path changes. The teaching engine is correct from the start (clipped time integrals, demand that changes, NOT EVALUABLE). | Fixing first delays this work behind evidence-path reviews; the utilization fix moves the pinned FLEET-005 digest (Appendix A.8) and needs a deliberate re-baseline. |
| D-06 | Depot staff in the first build? | No, with the chip "Staff not modelled: a free bay always has someone to work it." | Adds rosters, a staff resource, an invariant, staff metrics and UC-08's staff arm, about 15% more scope. |
| D-07 | Geography and units? | Four fixed areas (SF, PEN, SJ, EB), not editable; minutes everywhere; no distance on screen. | A fifth area (an airport node) is small; editable geography adds validation screens, connectivity checks and a much larger test space; showing distance needs one unit chosen everywhere. |
| D-08 | What sends a car to a depot? | Service due (FleetLab's trip count) plus a declared end-of-service recall time; the worked example uses service due at 18:30. | Service due only loses the end-of-day story; a recall time only loses continuity with FleetLab's knob. |
| D-09 | Distribution? | Source committed; the single-file build made locally, not committed; system fonts under a strict policy; publishing is a separate owner action. | Committing the build needs a byte-freshness test and puts generated code in a public repository; web fonts break the no-network policy unless inlined. |
| D-10 | What does "fork this car" mean? | Two full runs on the same world with the pinned car highlighted, captioned that every other car also differs. | A single-car calculator with the rest of the fleet frozen is easier to read but is arithmetic, not simulation, and cannot show the depot pressure other recalled cars cause. |
| D-11 | May the first build remember anything between visits? | No. A reload returns to the default preset and the system theme. | Remembering the last preset and theme needs two storage keys with schema validation, a reset control, and tests for blocked storage. |
| D-12 | Does the end-of-service recall stay pending until the release, or act once? | Once: idle cars go at the recall time, and cars then on a pickup or trip follow when it ends before the release; a car dispatched later stays in service. The pending recall sent every car dispatched overnight back for a full visit and jammed the depots (on the 90-car default: 23% unserved, 61 cars at depots at 06:00 on day 2). | A pending recall returns each overnight car to a depot after every trip, which needs a lighter overnight visit (for example no clean after a single trip) to avoid gridlock. |

## 12. Audit checklist

Answer each item PASS, FAIL or NEEDS-DECISION with a citation.

**Honesty and labelling**
1. The teaching-model strip is on every screen and cannot be dismissed (H-1).
2. No real map, road number, venue or neighbourhood appears; area names and route ids come from allowlists (H-2).
3. Banned words (predict, forecast, expected traffic, live, real-time, monitoring) appear nowhere in interface copy, negated or not, as H-3 defines copy (H-3).
4. Exports fail FleetLab validation, carry `NOT_EVIDENCE`, and show spec hashes as `playground-spec:` plus 8 characters (H-4, R9).
5. Absent values read `not available: <reason>`, never zero, blank or a dash (H-5).
6. No score, winner, gauge or ranking; trade-offs read as lower and higher (H-6).
7. Every chart has a model-limits chip; every verdict lists its limitations (H-7).
8. No string of `REQUIRED_LABELS` appears in any playground file, and the test does not spell them (H-8, R8).
9. Every caption direction is asserted by a fixture test (H-9).
10. Every number sits under exactly one register, this replay or across replications (H-10, §7.4).
11. The fork is captioned as two full runs in which every other car also differs (D-10).
12. The FLEET-005 panel is marked measured with its committed spec; the two-zone probe is marked exploratory with its spec in Appendix A.

**Model correctness**
13. The worked example's timeline is derived by hand in the fixture test's comments and the engine reproduces it exactly.
14. Route choice takes the faster planned route at departure, and planned times integrate across hour boundaries without breaking first-in-first-out.
15. A demand axis changes the accepted requests between arms while both arms share the candidate-world digest (P-1, P18).
16. Parking, bays, diversions and blocking behave as §3.2 states (5, P13, P17).
17. The fleet-state chart reads clipped state intervals and sums to the fleet (P15).
18. Every time integral is clipped to the window and matches recomputation from the interval log (P16).
19. Every state change is in the transition table (9).
20. Riders give up only before assignment, and the interface says so.
21. The legacy profile reproduces the analytical fixture and the exported FLEET-005 world exactly.

**Determinism**
22. Model and instrument code contain no `Math.random`, `Date`, timers or globals (R4).
23. The same scenario and seed give an identical event-log digest, including from the packed file.
24. Keyed-hash parts are strings or safe integers only, enforced by assertion.
25. Event order is `(time_s, class, seq)` with sorted-id iteration.

**Verdict parity**
26. Percentile indices use round-half-to-even and match Python for R = 1020, 1060, 2000 and 100000.
27. Means are summed left to right, and parity vectors are generated and checked under Python 3.11 with the version asserted.
28. The outcome branch order, the direction swap and the strict and inclusive comparisons match `_resolve_outcome`.
29. Guardrail harm uses the mean delta signed by direction, strictly greater than maximum harm.
30. The recommendation table is non-compensatory and identical.
31. All five outcomes are mirrored, MIXED unreachable, and the PRD §21 difference noted.
32. A primary unavailable in any replication gives `INVALID_EXPERIMENT` with `NOT_COMPARABLE`.
33. An unavailable guardrail shows NOT EVALUABLE beside the recommendation.
34. No claim of equal digests across languages appears anywhere.

**Interaction and accessibility**
35. The walkthroughs of §4.2 can be performed end to end.
36. Every control is reachable by keyboard, with visible focus.
37. The map and every chart have table views and generated summaries.
38. Colour is never the only cue: car state has shape, congestion has chevrons and labels, verdict words have glyphs.
39. Every text and background pair meets 4.5:1 in both themes; every sub-3:1 mark has an ink edge or a label.
40. Reduced motion switches playback to stepped snapshots.
41. The layout works at 400 px with no horizontal page scroll.
42. A running experiment freezes its spec and the session log is visible.
43. The default verdict action opens the median seed, not the extreme one.

**Performance**
44. The budgets of §5.9 are declared, and deterministic proxies run in the test suite.
45. Long runs show progress and can be cancelled.
46. The packed file is under 2 MB and opens offline from `file://`.

**Repository boundaries**
47. R1 to R9 are each enforced by a named test.
48. No change under `src/hermes/`, `pyproject.toml`, `.gitignore`, `Makefile` or CI before phase 6.
49. The pack script writes only its build output.

**Disclosure**
50. No operator, company, team or person name and no career framing in any file or commit message.
51. No real coordinates, tiles, fleet figures or demand figures.
52. The no-network scan passes and the content security policy is present.

**Scope**
53. Nothing listed as not in the first build (§10.1) is built.
54. No decision record is produced, and nothing writes to `artifacts/` or `experiments/`.
55. Every owner decision in §11 is answered before phase 1.

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Verdict drift between languages (rounding, summation, sort) | high without vectors | high | §6 vectors in both runtimes, with the known traps as explicit cases |
| FleetLab's Python pin is widened, silently changing its means and pinned digests | low | high | the 3.11 assertion in the parity test; a landmine note for the source of truth |
| The playground is mistaken for evidence (screenshots, exports) | medium | high | chips inside the verdict border, a map stamp, `NOT_EVIDENCE` exports, validation-rejection tests |
| A pre-written lesson contradicts what the model produces | medium | medium | captions generated from fixtures, directions asserted (H-9) |
| The richer world teaches intuitions that do not transfer | medium | medium | the model-limits chips, the differences panel, graduation only through a producer-agreement fixture |
| The hand-built interface grows into the "huge UI" PRD §48 warns about | medium | medium | the first-build slice, a fixed chart list, phase gates, no chart library |
| Performance tests flake in CI | medium | low | deterministic proxies in CI, wall-clock budgets behind a flag |
| The browser smoke cannot run in CI without a dependency | high | low | interface tests without a browser plus `check-dist` in CI; the smoke local and recorded |
| The host blocks workers | medium | low | time-sliced main-thread fallback, tested |
| A disclosure slip in a public repository | low | high | allowlists, the R8 label test, checklist items 50 to 52 |
| Seed shopping in Experiment mode | medium | medium | frozen spec, visible session log, seeds shown |
| FleetLab's defects are taught as normal behaviour | medium | medium | the teaching engine is built correctly; the differences panel names each defect; §14 opens separate fixes |

## 14. FleetLab defects found while designing

None of these is fixed by this work (D-05). Each is recorded so the evidence path can decide separately.

| Id | Defect | Evidence | Consequence | Suggested handling |
|---|---|---|---|---|
| FL-1 | A demand or horizon axis never reaches the world: every world is built from the declared scenario, so both arms get identical requests. | Measured (Appendix A.7): `parameter:demand_per_zone_per_hour` 12 to 36 gave VALID, UNCHANGED, every primary paired delta 0.0 and identical served counts; `parameter:horizon_s` 1800 to 3600 gave the same primary result and served counts, while `fleet.utilization_fraction` fell from 0.4539 to 0.227 because only its denominator reads the arm's horizon. `experiment.py` `tape = build_tape(spec.scenario, seed)`; `world.py` reads `demand_per_zone_per_hour` and `horizon_s` from that scenario. | A demand experiment reads "no effect" when the change was never applied: a silent false UNCHANGED. | Reject axes that feed the world, or build demand from each arm with a shared envelope. The fix changes no pinned record. |
| FL-2 | `fleet.utilization_fraction` is not clipped to the horizon. | Measured (Appendix A.8): in FLEET-005, 269 baseline and 373 candidate trips complete after the horizon; every seed's value would change (baseline mean 0.5634 unclipped against 0.5386 clipped). The two-zone probe reports 1.1166. | Values above 1; clipping moves the pinned FLEET-005 record digest. | A registry version bump with a deliberate, recorded re-baseline. |
| FL-3 | A guardrail whose metric is unavailable is skipped without a trace. | `experiment.py`: unavailable comparisons are filtered out before `_guardrail_regressions`. | A recommendation can advance while a guardrail went unevaluated. | Fail closed or record the guardrail as not evaluable. FLEET-005 is unaffected (its guardrail is always available). |
| FL-4 | Invariant I9 checks only final states, which are always legal values, so it cannot fail. | `invariants.py` | Illegal transitions go undetected. | Check every transition. |
| FL-5 | Invariant I10 checks only events named `REQUEST*` or `SERVICE*`. | `invariants.py` | Other events are unchecked. | Check every event kind. |
| FL-6 | Invariant I3/I8 is nearly vacuous because `pickup_time_s` is set at assignment, not at pickup. | `engine.py` dispatch sets `request.pickup_time_s = pickup_at` | A completed request without a real pickup event would pass. | Record pickup at the pickup event. |
| FL-7 | Means depend on the Python version: `sum()` is compensated from Python 3.12. | Measured (Appendix A.6); `pyproject.toml` pins `>=3.11,<3.12`. | Widening the pin silently changes means and digests. | Keep the pin; add a landmine note. |
| FL-8 | One `REQUIRED_LABELS` string names a specific operator. | `contracts.py:25-31` | Copying the labels onto a public surface would repeat that name. | Keep them off public surfaces; consider neutral wording in a future record schema. |
| FL-9 | PRD §21 labels an improved primary with a regressed guardrail "MIXED"; the code gives IMPROVED with HOLD. | PRD §21; `contracts.py`; `resolve_recommendation` | Two documents disagree. | Align the PRD with the code. |
| FL-10 | `depot.queue_p90_s` says it is absent when "no vehicle queued for a service bay", but it counts every service start, including zero waits. | `metrics.py`; `engine.py` appends a wait at every service start | The absence wording misleads. | Reword the absence condition. |
| FL-11 | A horizon axis that shortens an arm below the declared horizon crashes the experiment. The world is cut at the declared horizon, but the engine skips arrivals past the arm's horizon while their wait deadlines still fire, and the deadline handler removes a request that never joined the waiting list. Arrival times are also truncated with `int()`. | Measured (Appendix A.7): declared horizon 3600 s, `parameter:horizon_s` 3600 to 1800 raised `ValueError: list.remove(x): x not in list` at `engine.py` line 186 instead of returning a record. `engine.py` line 176 compares with the arm's horizon; `world.py` line 80 cuts at the declared one. | A spec that passes validation stops with an uncaught error. | Reject axes that feed the world, as for FL-1. Removing the guard would instead admit arrivals past the arm's horizon. Declare the truncation. |

## Appendix A. Measurements

Every command ran on 2026-09-13 on this machine against `main` at `bca4ccd`, with the project interpreter (Python 3.11.15) unless
stated.

**A.1 Tools.** Node 22.22.0 with `node:test` and `node:crypto`; no `package.json` in the repository; CI runs Python 3.11 only; a
browser-automation install exists in the user's package cache (not a repository dependency).

**A.2 Palette validation.** `node validate_palette.js "<hues>" --mode <light|dark> --surface <panel> [--pairs all]`:

| Palette | Pairs | Light (`#FFFFFF`) | Dark (`#161B23`) |
|---|---|---|---|
| `#2a78d6,#eb6834,#1baf7a,#eda100` (dark `#3987e5,#d95926,#199e70,#c98500`) | adjacent | PASS; worst CVD ΔE 9.1, normal 22.9; contrast WARN for `#1baf7a` 2.82 and `#eda100` 2.17 | PASS; CVD 8.4, normal 19.8 |
| the first three hues | all | PASS; CVD 9.2, normal 24.0; contrast WARN for `#1baf7a` 2.82 | PASS; CVD 9.4, normal 20.9 |

**A.3 Contrast** (WCAG relative luminance): the ratios in §8.1 and §8.2.

**A.4 Chip corrections:** the smallest darkening that reaches 4.6:1 on its own background: `#2E7D4F` to `#2C784C` (4.31 to 4.60),
`#9C6500` to `#935F00` (4.22 to 4.65); a readable small-label step `#666D77`, the first uniform
darkening of `#6E757F` that reaches 4.6:1 on `--panel-alt` (5.23 on `--panel`, 4.92 on `--ground`, 4.61 on `--panel-alt`;
`#6E757F` gave 4.65, 4.38 and 4.11).

**A.5 Rounding.** For R from 1,000 to 100,000 and q in {0.025, 0.975}, `round(q × R)` differs from `floor(q × R + 0.5)` for 2,475
values of R. R = 1020: indices (25, 994) against (25, 995). R = 1060: (25, 1034) against (26, 1034). R = 2000: (49, 1950) both.

**A.6 Summation.** `sum([1e16, 1.0, -1e16])`: 0.0 on Python 3.11.15; 1.0 on Python 3.13.5; a JavaScript left-to-right loop gives 0.

**A.7 FleetLab demand and horizon axes.** Using `small_spec()` and `small_scenario()` from
`tests/unit/test_fleet_contracts_and_world.py`: `parameter:demand_per_zone_per_hour` 12 to 36 gave
`VALID UNCHANGED NO_RECOMMENDATION`, distinct paired deltas `[0.0]`, interval (0.0, 0.0), `requests.served` 7.0 and 7.0,
`fleet.utilization_fraction` 0.4539 and 0.4539; `parameter:horizon_s` 1800 to 3600 gave the same outcome, deltas and
served counts, with `fleet.utilization_fraction` 0.4539 against 0.227. With `small_scenario(horizon_s=3600)` and
`parameter:horizon_s` 3600 to 1800, `run_experiment` raised `ValueError: list.remove(x): x not in list` from `engine.py`
line 186.

**A.8 Utilization clipping in FLEET-005.** Reconstructing each trip's busy interval from the event log for all ten seeds: baseline, 269
trips complete after the 21,600 s horizon (251 span it), mean utilization 0.563383 unclipped against 0.538583 clipped; candidate, 373 and
208, 0.546035 against 0.503613; every seed's value would change in both arms. The reconstruction equals FleetLab's own busy total for
every seed.

**A.9 The two-zone probe (exploratory).** The spec below is complete. It was run from a local file (SHA-256
`505866bffed01c74fa75368f5a2d3c27ec83f9ed2c71d119bb543777160403ea`), and this compact rendering parses to the same spec digest:

```yaml
schema_version: '0.1'
experiment_id: bay-area-bay-outage-probe
decision_owner: AUTHOR_SELF_TEST
question: If the shared depot loses half its service bays, does rider wait p90 across San Francisco and San Jose degrade beyond the declared margin?
scenario:
  schema_version: '0.1'
  name: bay_area_two_zone_probe
  label: synthetic_fleet_scenario_not_calibrated_to_any_real_operation
  horizon_s: 21600
  zones: [san_francisco, san_jose]
  travel_time_s: {san_francisco->san_jose: 3000, san_jose->san_francisco: 3000}
  vehicle_count: 25
  demand_per_zone_per_hour: 18
  max_wait_s: 1200
  trips_between_service: 6
  service_bays: 4
  service_duration_s: 1800
  in_zone_pickup_s: 300
  travel_sigma: 0.25
variation_axis: parameter:service_bays
baseline_value: 4.0
candidate_value: 2.0
primary_metric: {name: wait.p90_s, unit: s, direction: lower_is_better, equivalence_margin: 60.0}
guardrails: [{metric: unserved.fraction, max_harm: 0.02, direction: lower_is_better}]
seeds: [301, 302, 303, 304, 305, 306, 307, 308, 309, 310]
bootstrap_resamples: 2000
calibration_state: SYNTHETIC_UNCALIBRATED
```

`hermes fleet experiment run` with `PYTHONPATH="$PWD/src"`: spec digest `e8f30fec61b7`, world tape `a78ec1f43d99`; VALID; UNCHANGED; wait
p90 4487.7 s in both arms, distinct paired deltas `[0.0]`, interval (0.0, 0.0); `unserved.fraction` delta 0.0; `requests.served` 131.7 and
`requests.unserved` 97.3 per replication in both arms; `fleet.utilization_fraction` 1.1166 in both arms; `depot.queue_p90_s` 146.34 to
2,628.16 (mean delta +2,481.82); NO_RECOMMENDATION. The same spec digest and values as its first run on 2026-09-08. Not a committed
decision record.

**A.10 FLEET-005 (measured, committed).** `config/fleet/fleet-005-turnaround.yaml`; REGRESSED; `wait.p90_s` mean delta +826.1 s, 95%
interval [+735.9, +919.2]; `unserved.fraction` mean delta +0.057 against a maximum harm of 0.02; HOLD; `requests.served` 451.0 to 425.5;
record digest `a61950c0ad3b960db1d3c55ff2704ed4a0ab99268330ab2c15ff313bc340aa2f` (pinned by `test_the_fleet_005_demo_record_digest_is_pinned`).

## Appendix B. How the design was reconciled

The design came from five independent reviews of the same brief (fleet and depot operations, simulation modelling, use cases and
learning, interaction design, architecture and audit), a completeness critique of all five, and verification of every factual claim
against the repository. The conflicts that changed the design:

| Conflict | Resolution |
|---|---|
| Whether Experiment mode produces decision records | never (H-4) |
| Displaying `REQUIRED_LABELS` verbatim | never; neutral copy and a test (H-8) |
| Four sets of car-state names | FleetLab's five names plus four additions (§5.3) |
| Two numberings for invariants | PRD §17 numbering plus `P` checks (§5.6) |
| Metric names for deadhead, exposure, time to ready and imbalance | PRD §16 names where they exist; `fleet.placement_gap` for the morning question (§5.7) |
| A new palette and signage typefaces | the Hermes identity, with measured contrast corrections (§8) |
| A graph with per-minute travel tables | two declared routes per pair with integration across hour boundaries (§5.2.1) |
| Charging, staff, closing hours and a fifth area in the first build | out, with decisions D-02, D-06 and D-07 |
| A 24 h day or a 28 h day | day 1 05:00 to day 2 10:00 (D-01) |
| A bundled "nearest depot plus morning move" candidate | the morning release is part of both arms; one axis (UC-07) |
| Charts with two scales or a red flash | two panels on one axis; glyphs instead of flashes (§7.5, §8.5) |
| An invented guardrail row beside measured numbers in a mock | the FLEET-005 record's values, quoted unmodified through a public-safe projection (§7.2) |
| The two-zone probe called measured | exploratory, spec and re-run in Appendix A.9 |
| "Home depot wins when" captions | trade-offs as lower and higher, directions asserted by fixtures (H-6, H-9) |
| Whether FleetLab's demand axes work | they do not (FL-1, measured); the teaching engine shares candidates and accepts demand per arm (P-1) |
| Twenty-eight findings of a pre-audit review (five review lenses; each finding challenged by a separate refuter) | fixed in place: banned words in required copy (H-3); missing transitions, gate waits and recall (§5.3); a single-car fixture and access-leg exposure (§3.5, §5.7); demand units, coupling and parity (§5.2.2, P-1, P18); empty scopes and the bay-wait rename (§5.7); home area and depot ties (SUP-2); FleetLab's service-queue order (§5.10); the horizon-axis crash (FL-11); the L2 walkthrough, the probe panel, the chart list, UC-10, keys, the scrubber, the lot count, the seed range and one contrast token |
| Thirteen required changes from the design audit (approve with required changes) | an `INTAKE` state; a defined drain and censoring time; completed-only turnaround no longer called a bound; scope rules for every metric class; a time-based empty-drive share instead of invented distance; seed sets and a canonical spec digest; a log ordinal for decision events; FleetLab's precheck world source (P-3); a worker the content policy allows; full event-log parity (D-03); no storage (D-11); the arrival process and the FLEET-005 projection named precisely |
| The default preset, run at fleet scale in the built engine | the recall acts once (D-12); the default fleet recalibrated to 120 cars with two accepted exceptions (§2.2); presets UC-02, UC-03, UC-09 and UC-10 adjusted so their mechanisms show, and every use case records its measured verdict (§4) |
| The operations casebook: twenty situations the model has no entities for (rain, crowds, police, a new area) | proxies built from the knobs that say what they stand for and what they miss; slugs frozen with their measured verdicts because the scenario name keys the demand trace; on-page copy never names a direction (H-9); every seed set 1 verdict pinned, sets 2 and 3 behind a flag; a review re-ran every case, a cross-theme critique replaced one and moved another, and a copy pass rewrote the Watch lines (§4.4) |
| Whether a demo needs 3D, after the owner set it as a requirement rather than a means, and what a third dimension may honestly be here (a spike measured three renderers on the built page: Canvas 2D at 0.15 / 0.3 ms of JavaScript a frame at 150 cars against WebGL's 0.05 / 0.1 and the shipped SVG's 0.13 / 0.3, all far inside §5.9's 8 ms) | a procedural isometric schematic in Canvas 2D, generated from the interval log, replaces the rendered city the design had already rejected and keeps that rejection: flat platforms, a fixed camera, no lighting and no tint, cubes for cars that stand, a written count wherever bodies coincide exactly, and every word DOM over the canvas. WebGL was refused for 0.1 ms of an 8 ms budget bought with a second renderer and a context-loss path. The flat SVG schematic stays as the test default, the header toggle and the no-context fallback (§1.4, §7.3, §8.2, §8.4) |
| Whether a screen-share demo should be a script the owner performs across three modes or a surface the page owns | `Present`, a layer over the three modes with its own store key: `Prepare` runs the window and the experiment once in the visitor's browser, and every beat after that is a silent seek and a projection. Eleven beats in four chapters behind one `Next`, each landing still on a second the scenario's own knobs declare; the narration is generated from the run, scanned for direction words, and the four comparing lines are pinned on OPS-01 at seed 1001 (§4.2, §7.1, §7.2, H-9) |
| Whether the walkthrough may restate the verdict in its own words, and whether the ledger and the drawer may read a depot twice | neither: the readout is composed from the verdict card's own builders with minutes added beside seconds, and the four-depot table is the depot drawer's own reading, exported so the two cannot disagree about one depot at one second |
| How much of the fleet the map should draw individually, after a survey of the built page found it nearly still (over 600 consecutive frames at 900x, unit bars changed on 10.8% of area-frames and depot bars on 4 of 2,400 depot-frames; the pinned car was the only thing moving continuously) | cars driving a route become individual marks at the progress the interval log gives them; cars standing in an area stay unit bars and cars at a depot stay part of the depot tile, because the model gives neither a place inside it; a direction whose corridor is too short for its own busiest snapshot keeps its flow band and writes the reason in visible text; the map gains its first model-limits chip and a second legend line so the two encodings cannot contradict each other; no CSS transition, animation, keyframe or `will-change` is added anywhere, and reduced motion steps cars on the snapshot grid through the path that already existed (§7.3, §8.2, §8.4, §10.1) |
