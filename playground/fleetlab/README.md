# FleetLab Playground

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
script) and `_headers` repeats it for hosts that read that file. Putting the folder online is an owner action, never part
of a build.

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
| `src/model` | knobs and presets, routes, world, engine, metrics, invariants, experiments, reference panels |
| `src/runtime` | the engine host, with a worker and a time-sliced main-thread fallback |
| `src/ui` | interface copy, store, map, playback, charts, knob panel, inspector, Experiment and Learn |
| `tools` | the offline packer and its checker |
| `test` | node tests; the Python tests live in `tests/unit/test_fleet_playground_*.py` |

The playground imports nothing from `src/hermes/`, and nothing in `src/hermes/` refers to the playground.
