# FleetLab Playground

**[Open the public playground](https://fleetlab-playground.pages.dev/)** · Independent project by Bo-Huei Lin

For an interview walkthrough: **Overview → Fleet day → Run fleet day → Product approach**. For congestion: **Street lab → Bridge rush → Largest queue → Compare route policies**. Configure the experiment, inspect a car and a constraint, then explain the service trade-offs. The [Cloudflare guide](../../docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) records the exact publishing and optional custom-domain steps.

## Downtown street bottlenecks in 3D

The **Street lab** adds First Street, Harrison/Bryant, Stockton, Van Ness, the Embarcadero and Lombard to a directed OSM network with 2,343 road links. Follow individual AVs toward SFO or the East Bay, inspect finite road queues and upstream spillback, then compare free-flow and queue-aware routes using identical demand. Step five seconds, scrub the replay, follow an AV, or inspect a queued block and its front-car exit wait.

Sourced geography and supported one-way/turn rules are separate from synthetic traffic, signal timing, capacity, incidents and off-road pickup service. SFO and Oakland are modeled gateway handoffs, not authorized pickup zones. There is no live traffic feed or physical driving model. Street lab does not share the Fleet day energy/depot engine. See the [model guide and interview story](../../docs/FLEETLAB_STREET_LAB.md) and [directed OSM provenance](../../docs/FLEETLAB_STREET_MAP_DATA.md).

## Bay Area fleet day in 3D

Start with **Fleet day → Run fleet day**. Fleet day uses native WebGL cars and depots on a frozen OpenStreetMap road extract. Select any two or more of the 18 city/airport anchors, configure Jaguar I-PACE and Ojai profiles, then inspect service, energy and depot constraints. The static site and offline HTML contain the same simulation tools; no account, renderer dependency or runtime map download is needed. The hosted homepage also includes an optional original 3D concept film. The offline edition uses its embedded still image to keep the file small.

- **Geography:** all requested Bay Area places, with separate SFO and SJC airport selections. Sparse major-road paths are sourced; one-way, turn and access restrictions are absent. These are teaching routes, not navigation or a verified operator service area.
- **3D replay:** orbit, zoom, tilt, city focus, selected-car follow, label density, exact-minute and next-activity navigation. Flat view and the vehicle table remain available. Stationary display slots and enlarged vehicle/depot geometry do not change model coordinates.
- **Vehicle mix:** 0–100% Ojai with editable per-type modeled battery, charge acceptance, energy per kilometer, boarding and service-time factors. Ojai numerical defaults are illustrative; I-PACE retail nominal battery is distinct from modeled usable energy. Neither label changes road speed or party capacity.
- **Operations:** real route distance drives travel time and energy; synthetic time-of-day, weather and congestion modifiers are explicit. Finite software, cleaning, charging and upload resources constrain readiness. Power respects vehicle, port, site and charge-target limits.
- **Comparisons:** shared demand for fleet/depot and vehicle-mix trials. Results include completed, unserved and unfinished demand, per-type and per-pickup-place outcomes, completed depot time, active work and queues. A first sufficient tested depot count is not a global optimum.
- **Learning:** 50 examples and lessons: 12 Fleet day lessons, six Street lab cases and all 32 original regional presets.

The Bay model is `fleetlab-bay-operations-1.0.0`. The original synthetic `operations.js` and regional simulator/instrument/golden fixtures remain unchanged. Google Maps estimates remain a separate optional local companion and do not supply this OSM replay. No CARLA or physical driving integration is introduced.

Map attribution appears below the scene. **Download attributed map data** offers the complete compact derived database under ODbL in both packages. Source queries, hashes and reproduction script are in `tools/map-data/` at the repository root.

See the [Bay Area handoff](../../docs/FLEETLAB_BAY_AREA_3D_HANDOFF_2026-09-19.md), [simulation guide](../../docs/FLEETLAB_SIMULATION_GUIDE.md), [map provenance](../../docs/FLEETLAB_BAY_AREA_MAP_DATA.md), [vehicle assumptions](../../docs/FLEETLAB_VEHICLE_PROFILES.md), and [Google traffic/CARLA research](../../docs/FLEETLAB_GOOGLE_TRAFFIC_CARLA_RESEARCH.md). The [original audit](../../docs/FLEETLAB_DESIGN_AUDIT_2026-09-18.md) records the broader product redesign.

## The underlying regional teaching model

A teaching model, not evidence. FleetLab Playground is a static web page that works offline. You set the knobs of a
stylized Bay Area fleet (cars per area, depots with parking, cleaning bays and service bays, peak and off-peak demand,
highway and local routes with hourly congestion, depot assignment, the end-of-service recall and the morning release),
watch a simulated day and the next morning play out, and run a preregistered paired A/B whose verdict uses FleetLab's
rules: paired seeds, a bootstrap interval over paired deltas, an equivalence margin, non-compensatory guardrails, and
the words IMPROVED, REGRESSED, UNCHANGED, INCONCLUSIVE, ADVANCE_TO_NEXT_TEST, HOLD, RUN_MORE_EXPERIMENTS and
NO_RECOMMENDATION.

- The design is `docs/plans/2026-09-13-fleetlab-playground-design.md`. The build contract is `ARCHITECTURE.md`.
- The map uses Bay Area place names on a simplified sketch, and every number is invented. Nothing here is calibrated to
  any real operation, says what will happen, or can approve a change to a real fleet.
- A playground run is a teaching run. It is never a FleetLab decision record, and its result summary is marked
  `NOT_EVIDENCE`.
- The Experiment preset chooser also holds an operations casebook: twenty situations (San Francisco core operations, a
  newly opened service area, rain, busy areas with many people, police activity and emergency response), each played
  through the knobs as a proxy that says what it stands for and what it misses, with its measured verdict pinned in the
  tests and its lesson in the design document.

## The picture, the walkthrough and the reading card

**An isometric world.** The map region draws the four areas as an isometric schematic on a 2D canvas, generated at run
time from the interval log: no asset, no dependency, no build step, no WebGL. Platforms are flat squares at the areas'
own centres, roads are ribbons, a moving car has a shaded body, cabin and tires pointing along its ribbon, cars standing in an
area are cubes of five, and a depot is a block whose lot fill climbs its sides and whose bay cells fill as their tasks
run. Where several cars share a leg exactly, one body carries a written count. The canvas draws no word: every label,
number and name is HTML over it, which is what a screen reader reads and what the copy scans see. Nothing is lit, no
camera moves, and the picture is a sketch of invented geometry, which its caption says before a run as well as during
one. `Isometric | Flat` in the map header switches back to the SVG schematic, and a browser whose canvas gives no 2D
context keeps the flat one and says why.

**Present.** A layer over the three modes, not a fourth mode. It turns the page into a stage, a ledger and a rail and
walks four chapters over one replay of the casebook's OPS-01: Operations (the evening peak, the hour riders gave up in,
the recall, a depot at two in the morning, the release), Analytics (the metric registry in both registers with two
charts by hour, then the verdict readout and the spec that was frozen before the run), Simulation (which snapshot the
frame came from and whether the positions are interpolated, then both arms of the verdict's own watched seed) and
Product sense (what the case stands for and what it misses, what the run trades, five things this page refuses with
their reasons, and the next casebook question by title alone). `Prepare` runs the window once and the experiment once in
your own browser and says what each took on your clock; after that every beat is a seek and a projection of numbers the
run already produced. Eleven beats behind one `Next` that keeps its focus, each landing still on a second the scenario's
knobs declare, with `Play` in your hands. `Leave the walkthrough` puts the page back as it was.

**The reading card** stands above the picture before anything has run, with a button into the knobs and a button that
walks the day. It is a section, never a dialog, and a reload starts clean.

Two later phases were planned and are deliberately not built: the candidate arm drawn in the world with an `A | B`
toggle, a day-long bar under the scrubber, and the phone polish of the presenting layout. The design document says what
each holds.

## What it shares with FleetLab

| | FleetLab (`src/hermes/fleet/`) | FleetLab Playground |
|---|---|---|
| Verdict rules | the evidence engine | the same rules, value for value, proven by vectors both test suites check |
| World | one travel matrix, flat demand, service in place | four areas, two routes per pair, depots, congestion by hour and direction |
| Output | a digest-bound decision record | a teaching run with an animated replay and a verdict card |
| FleetLab's own world | | reproduced by the legacy profile, event log entry by entry |

## Open it

Development shell (native modules need a local server):

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory playground/fleetlab
```

Then open `http://127.0.0.1:8765/`.

One offline file (written under the ignored `dist/` folder):

```bash
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
```

```bash
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
```

The packed file carries a content security policy with no network access. It stores nothing between visits.

A folder for a static host (the page, its modules, the worker, the stylesheet and a `_headers` file; nothing else):

```bash
node playground/fleetlab/tools/pack.mjs --site dist/site
```

```bash
node playground/fleetlab/tools/check-dist.mjs --site dist/site
```

Upload the folder as it is. Its page carries a stricter policy than the packed file (`script-src 'self'`, no inline
script) and `_headers` repeats it for hosts that read that file. Publishing is a separate, explicitly authorized action; building alone never uploads anything.

## Test it

From the repository root:

```bash
node --test "playground/fleetlab/test/*.test.mjs"
```

```bash
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
```

The Python fixtures are rebuilt from FleetLab's own functions only by an explicit command, in a commit that says why:

```bash
PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python tools/fleet_playground/regenerate_fixtures.py --write --reason "why the fixtures change"
```

## Layout

| Folder | Holds |
|---|---|
| `src/core` | synchronous SHA-256, FleetLab's keyed draws, rounding and summation rules, canonical JSON, integer quantile tables |
| `src/instrument` | paired comparison, bootstrap interval, outcome, guardrails, recommendation, result summary |
| `src/legacy` | the port of FleetLab's engine, metrics and invariants |
| `src/model` | knobs and presets, the operations casebook records, routes, world, engine, metrics, invariants, experiments, reference panels |
| `src/runtime` | the engine host, with a worker and a time-sliced main-thread fallback |
| `src/ui` | interface copy, store, map (the flat schematic and the isometric picture), playback, charts, knob panel, inspector, Experiment, Learn and the Present walkthrough |
| `tools` | the offline packer and its checker |
| `test` | node tests; the Python tests live in `tests/unit/test_fleet_playground_*.py` |

The playground imports nothing from `src/hermes/`, and nothing in `src/hermes/` refers to the playground.
