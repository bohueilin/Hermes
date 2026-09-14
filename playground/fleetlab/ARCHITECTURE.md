# FleetLab Playground: build contract

This file is the implementation contract for `playground/fleetlab/`. The design is
`docs/plans/2026-09-13-fleetlab-playground-design.md` (called "the design" below, cited by section).
Where the design decides something, the design wins. Where it is silent, this file decides, and every such
decision is listed in section 12 so a reviewer can find it.

Rules that apply to every file:

- Zero dependencies. No `package.json`, no lockfile, no `node_modules`, no CDN. Node 22 built-ins only in tests
  and tools (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`, `node:crypto` in tests only).
- Plain ES modules (`.js` in `src/`, `.mjs` in `test/` and `tools/`). No TypeScript, no build step for development.
- No personal names, company or operator names, home-directory paths or career framing in any file, comment,
  fixture or commit message. Area names come from the allowlist (San Francisco, Peninsula, San Jose, East Bay).
- No string from FleetLab's `REQUIRED_LABELS` tuple may appear in any playground or fixture file (design H-8).
- No em dashes or en dashes in interface copy (`src/ui/labels.js` and anything rendered).
- Interface copy never uses the words banned by design H-3, negated or not.

## 1. Commands

Run from the repository root.

```bash
node --test "playground/fleetlab/test/*.test.mjs"
```

```bash
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
```

```bash
PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -m "not metadrive"
```

```bash
python -m ruff check .
```

```bash
PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python tools/fleet_playground/regenerate_fixtures.py --write --reason "why the fixtures change"
```

```bash
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
```

```bash
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
```

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory playground/fleetlab
```

The Python interpreter is 3.11 (the repository pins `>=3.11,<3.12`). `dist/` is ignored by git.

## 2. Layout and import rules

```
playground/fleetlab/
  README.md  ARCHITECTURE.md  index.html  styles.css
  src/core/        sha256.js keyed.js stats.js canon.js tables.js
  src/instrument/  paired.js bootstrap.js outcome.js guardrails.js recommendation.js summary.js
  src/legacy/      world-import.js profile.js
  src/model/       schema.js presets.js routes.js world.js policies.js engine.js metrics.js invariants.js experiment.js
  src/runtime/     worker.js host.js
  src/ui/          app.js store.js labels.js format.js dom.js map.js playback.js charts.js inspector.js controls.js
                   experiment.js learn.js a11y.js
  tools/           pack.mjs check-dist.mjs
  test/            *.test.mjs
tests/fixtures/fleet_playground/   JSON fixtures (section 4, section 5)
tests/unit/test_fleet_playground_parity.py
tests/unit/test_fleet_playground_boundaries.py
tools/fleet_playground/regenerate_fixtures.py
```

Import direction (design R4, R5):

- `core` imports nothing outside `core`.
- `instrument`, `legacy`, `model` import only `core` and their own folder, plus `model/experiment.js` may import
  `instrument`. None of them imports `ui` or `runtime`.
- `runtime` imports `core`, `instrument`, `model`, `legacy`. `ui` imports everything except `legacy` internals
  and never reaches into another module's private state.
- `core`, `instrument`, `legacy`, `model` never use `Math.random`, `Date`, `performance`, timers, `window`,
  `document`, `globalThis`, storage, `fetch` or `crypto.subtle`.
- `ui` never uses `fetch`, sockets, beacons, dynamic `import(`, `eval`, `new Function`, `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `document.write`, `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`.
  All text enters through `textContent`, attributes through `setAttribute`.

Every exported function has a one-line JSDoc comment stating units. Numbers named `*_s` are integer seconds,
`*_permille` integer thousandths, `*_ppm` integer millionths.

## 3. Core (`src/core/`)

`sha256.js`
- `sha256(bytes: Uint8Array): Uint8Array` synchronous, FIPS 180-4.
- `sha256Hex(text: string): string` over UTF-8 bytes, lowercase hex.
- `prefixHasher(prefix: string): (suffix: string) => Uint8Array` caches the compression state after every whole
  64-byte block of the prefix, so hashing `prefix + suffix` repeats only the tail. Must equal `sha256` exactly.

`keyed.js` (FleetLab's key function, design P-2)
- `keyString(parts: Array<string|number>): string` joins with `|`. Throws `TypeError` unless every part is a string
  or a safe integer (`Number.isSafeInteger`), so floats never enter a key (design T-3).
- `u64(...parts): bigint` first 8 bytes of SHA-256 of the key string, big-endian.
- `u16(...parts): number` top 16 bits of `u64`. `u32(...parts): number` top 32 bits.
- `keyedU64Source(...prefixParts)` returns `(…rest) => bigint` using `prefixHasher` for speed; identical output.

`stats.js`
- `roundHalfEven(x: number): number` Python `round(x)` on a double: nearest integer, exact halves to even. Uses
  `Math.floor` and exact subtraction; never `Math.round`.
- `roundHalfEvenDiv(numerator: bigint, denominator: bigint): bigint` integer division rounded half to even
  (quotient, then compare twice the remainder with the denominator). Denominator positive.
- `sumLeftToRight(values: number[]): number` plain loop starting from `0` (Python 3.11 `sum`, design T-2).
- `meanFleetLab(values)` is `sumLeftToRight(values) / values.length`.
- `medianFleetLab(values)` sorts a copy ascending; odd count takes the middle, even count
  `(ordered[mid - 1] + ordered[mid]) / 2`, as `_compare` does.
- `percentileFleetLab(values, q)` sorts a copy ascending; `position = (n - 1) * q`; `low = Math.trunc(position)`;
  `high = min(low + 1, n - 1)`; returns `ordered[low] + (ordered[high] - ordered[low]) * (position - low)`.
  Throws on an empty array.
- Numeric sort uses a comparator that orders `-0` before `0` only if Python would; Python `sorted` keeps equal values
  in input order, so use a stable sort with `(a, b) => (a < b ? -1 : a > b ? 1 : 0)`.

`canon.js` (design §6, Spec digest)
- `canonicalJson(value): string` keys sorted by UTF-16 code unit order (all keys are ASCII, so this equals code point
  order), no whitespace, strings via `JSON.stringify`, numbers only as safe integers. Throws on a float, `-0`, `NaN`,
  `Infinity`, `undefined`, a function, or a non-plain object.
- `specDigest(spec): string` lowercase hex SHA-256 of `canonicalJson(spec)`.
- `specHashLabel(digest): string` returns `playground-spec:` plus the first 8 characters.

`tables.js` (design §5.4 item 2; exact integer and `BigInt` arithmetic only)
- `expTable(): Int32Array` of 65,536 entries, `EXP_TABLE[i] = round_half_even(1000 × -ln(1 - i / 65536))`.
- `multiplierTable(sigmaPermille): Int32Array` of 65,536 entries,
  `round_half_even(10^6 × exp(sigma × z_i))` with `z_i` the standard normal quantile at `(i + 0.5) / 65536`.
  `sigmaPermille` is one of 0, 50, …, 500. Sigma 0 gives every entry exactly 1,000,000.
- Implementation: fixed-point `BigInt` natural log (for example `ln(n) = ln(n - 1) + 2·atanh(1 / (2n - 1))` summed
  exactly), an exact normal quantile to at least 1e-12 absolute accuracy computed in fixed point, fixed-point `exp`.
  No `Math.log`, `Math.exp`, `Math.sqrt` or other float transcendental call on this path.
- `TABLE_DIGESTS` pins the SHA-256 of each table's little-endian bytes; `expTable()` and `multiplierTable()` verify
  against it on first build and throw if it differs. Tables are memoized per module instance.
- Budget: all eleven multiplier tables plus the exponential table in under 1.5 s in Node on a laptop; each table is
  built only when first requested.

## 4. Instrument (`src/instrument/`) and its Python vectors

These functions reproduce `src/hermes/fleet/experiment.py` value for value (design §6).

`bootstrap.js`
- `bootstrapIndices(resamples): [lowIndex, highIndex]` with `max(0, roundHalfEven(0.025 * R) - 1)` and
  `min(R - 1, roundHalfEven(0.975 * R))`.
- `bootstrapCi(deltas: number[], resamples: number, key: string): [low, high]`: for `i` in `0..R-1`, `total = 0`;
  for `j` in `0..n-1`, `total += deltas[Number(u64(key, "bootstrap", i, j) % BigInt(n))]`; `means.push(total / n)`;
  sort ascending (stable, section 3 comparator); return the two indexed means.

`paired.js`
- `compareMetric(metric, role, baselineRuns, candidateRuns)`: returns `null` if any run lacks the metric (a missing
  key or `undefined`); else `{metric, role, baseline_mean, candidate_mean, paired_deltas, mean_delta,
  median_delta}` using `candidate - baseline` per index, `meanFleetLab`, `medianFleetLab`.
- `computeVerdict({primary, guardrails, descriptiveNames, baselineRuns, candidateRuns, resamples, key,
  precheckMatched, invariantViolation})` follows `run_experiment` in order: precheck mismatch gives
  `INVALID_EXPERIMENT` / `REPLICATION_MISMATCH`; an invariant violation gives `INVARIANT_VIOLATION` with its text;
  an unavailable primary gives `NOT_COMPARABLE`; otherwise the interval, guardrail results (only those available),
  regressions, descriptive results (available ones, in the given order, skipping the primary), outcome and
  recommendation. It also returns `guardrail_statuses` from `guardrails.js`. Invalid verdicts carry `outcome: null`,
  `recommendation: "NO_RECOMMENDATION"`, and no primary.

`outcome.js`: `resolveOutcome({ci_low, ci_high}, {direction, equivalence_margin})` exactly as `_resolve_outcome`.
Exports `OUTCOMES = ["IMPROVED", "REGRESSED", "MIXED", "UNCHANGED", "INCONCLUSIVE"]` (MIXED defined, unreachable).

`guardrails.js`
- `guardrailRegressions(results, guardrails)` exactly as `_guardrail_regressions` (unavailable ones skipped).
- `guardrailStatuses(results, guardrails)` returns, in guardrail order, `{metric, status, harm, max_harm}` with status
  `REGRESSED`, `WITHIN` or `NOT_EVALUABLE` (design P-8). It never changes the recommendation.

`recommendation.js`: `resolveRecommendation(outcome, regressions)` exactly as `resolve_recommendation`; exports
`RECOMMENDATIONS`, `VALIDITY`, `INVALIDITY_REASONS` mirrored verbatim.

`summary.js` (design P-10, R9)
- `resultSummary(verdict, {specDigest, modelVersion, question, axis, baselineValue, candidateValue, seedSet})`
  returns a plain object with `format: "fleetlab-playground-result-summary"`, `format_version: 1`,
  `evidence_status: "NOT_EVIDENCE"`, `decision_authority: "NONE"`, `model_version`, `playground_spec` (the 8-character
  label), and the verdict's words and numbers. It never contains the keys `spec_digest`, `world_tape_digest`,
  `seed_set_digest`, `deployment_permission`, `labels` or `schema_version`, and never the full digest.
- `summaryText(summary): string` for the clipboard.

### 4.1 Instrument vector fixture

`tests/fixtures/fleet_playground/instrument_vectors.json`, written only by the regenerator, checked by both suites.
Floats are written by Python `json.dumps` (shortest round-trip repr), so JavaScript `JSON.parse` yields the same
doubles; `-0.0` is preserved. 64-bit integers are decimal strings.

```json
{
  "format": "fleet-playground-instrument-vectors",
  "format_version": 1,
  "python_version": "3.11.15",
  "u64": [{"parts": ["key", "bootstrap", 0, 1], "value": "123"}],
  "bootstrap_indices": [{"resamples": 1020, "low_index": 25, "high_index": 994}],
  "percentile": [{"values": [120, 120, 740], "q": 0.9, "value": 616.0}],
  "sum_left_to_right": [{"values": [1e16, 1.0, -1e16], "value": 0.0}],
  "compare": [{"metric": "m", "baseline_runs": [{"m": 1.0}], "candidate_runs": [{"m": 2.0}], "result": {}}],
  "bootstrap": [{"name": "fleet-005-primary", "deltas": [], "resamples": 2000, "key": "hex", "low": 0.0, "high": 0.0}],
  "outcome": [{"ci_low": -31.0, "ci_high": -30.0, "direction": "lower_is_better", "margin": 30.0, "outcome": "INCONCLUSIVE"}],
  "guardrails": [{"results": [{"metric": "m", "mean_delta": 0.02}], "guardrails": [{"metric": "m", "max_harm": 0.02, "direction": "lower_is_better"}], "regressions": []}],
  "recommendation": [{"outcome": "IMPROVED", "regressions": ["m"], "recommendation": "HOLD"}],
  "end_to_end": [{"name": "…", "deltas": [], "resamples": 2000, "key": "hex", "direction": "lower_is_better", "margin": 30.0, "guardrails": [], "guardrail_results": [], "baseline_runs": [{"primary": 0.0}], "candidate_runs": [{"primary": 0.0}], "low": 0.0, "high": 0.0, "outcome": "…", "regressions": [], "recommendation": "…"}],
  "verdict": [{"name": "fleet-005", "primary": {"name": "wait.p90_s", "direction": "lower_is_better", "equivalence_margin": 30.0}, "guardrails": [], "descriptive_names": [], "resamples": 2000, "key": "hex", "baseline_runs": [], "candidate_runs": [], "record": {"validity": "VALID", "outcome": "…", "recommendation": "…", "primary": {}, "guardrail_results": [], "guardrail_regressions": [], "descriptives": []}}]
}
```

Required cases (design §6 Parity proof): the FLEET-005 primary deltas at R = 2000 with FLEET-005's real spec digest as
the key; R = 1020 and R = 1060, each with at least one bootstrap row whose interval differs from the one
round-half-up indices would select (checked by rebuilding the sorted resample means); R = 100000 with n = 20; n = 200 at R = 2000; a single delta (n = 1, an edge case of the
function); all-equal deltas; a negative-zero delta; the compensated-sum case `[1e16, 1.0, -1e16]`; a bound exactly at
`-margin`; a bound exactly at `+margin`; `higher_is_better`; a guardrail harm exactly equal to `max_harm`; an absent
guardrail metric; every recommendation row; percentiles from `run_metrics` for q 0.5 and 0.9 on odd, even, single and
tied inputs; at least 50 `u64` vectors including integer parts and non-ASCII text; end-to-end rows carrying the
per-seed runs they were computed from, so `computeVerdict` is checked against the row's regressions and recommendation;
a `verdict` group holding FLEET-005's per-seed runs and `run_experiment` record (validity, outcome, recommendation,
primary, guardrail results, guardrail regressions, descriptives) and a FLEET-005 variant with three available
guardrails where a later one regresses after the first stays within its limit. Every number comes from calling
FleetLab's own functions (`_u64`, `_bootstrap_ci`, `_compare`, `_resolve_outcome`, `_guardrail_regressions`,
`resolve_recommendation`, `run_metrics`, `run_experiment`), never from a re-implementation, with the one exception in
section 12 item 13.

The pytest parity test asserts Python is 3.11, rebuilds every vector from FleetLab and requires exact equality with the
committed file. It never writes. The node parity test loads the same file and requires exact equality (`Object.is`
for `-0`).

## 5. Legacy profile (`src/legacy/`) and its fixtures

`world-import.js`: `importLegacyWorld(json)` validates and returns `{scenario, tape}` where `tape.demand` is an array
of `{request_id, time_s, origin, destination}` in the given order and `tape.travel_multiplier` maps id to double.

`profile.js` is a line-by-line port of `src/hermes/fleet/engine.py` and `run_metrics`:
- `runLegacyFleet(scenario, tape, {dispatchMode = "nearest"})` returns `{events, requests, vehicles,
  service_queue_waits_s, max_bays_in_use}`. Vehicles `v-0 … v-(n-1)` placed round-robin over `scenario.zones`.
- Heap entries `[time_s, seq, kind, entity_id]` ordered by `time_s` then `seq`; `seq` increments on every push, in the
  same push order as Python (for each tape request in tape order: `REQUEST_CREATED` then `WAIT_DEADLINE`).
- `travelSeconds(scenario, origin, dest, multiplier) = Math.max(1, roundHalfEven(base * multiplier))`.
- Dispatch minimum by `(travelSeconds, vehicle_id)` with string comparison of ids; `waiting` is an array used as a queue.
- The arm-horizon guard on `REQUEST_CREATED` and the `SERVICE_TRY_START` retries in string-sorted id order are copied
  exactly, including the crash FleetLab has when a skipped request's deadline fires (the port throws the same kind of
  error; a test documents it as FL-11).
- `legacyMetrics(log)` returns FleetLab's metric map with the same keys present or absent.
- `legacyInvariants(log)` ports `check_invariants`, strings included.
- `canonicalEvents(log)` returns `[[t, kind, id], …]`; `eventsDigest(events)` is SHA-256 of
  `JSON.stringify(events)` (no floats inside, so both languages hash identical bytes).

### 5.1 Legacy world fixtures

One file per world in `tests/fixtures/fleet_playground/`:

```json
{
  "format": "fleet-playground-legacy-world",
  "format_version": 1,
  "name": "fleet005-seed101-baseline",
  "scenario": {"...": "FleetScenarioConfig.model_dump(mode='json')"},
  "tape": {"seed": 101, "demand": [["r-0-0", 12, "downtown", "airport"]], "travel_multiplier": {"r-0-0": 1.03}},
  "dispatch_mode": "nearest",
  "expected": {
    "events": [[12, "REQUEST_CREATED", "r-0-0"]],
    "events_digest": "hex",
    "event_counts": {"REQUEST_CREATED": 1},
    "metrics": {"requests.total": 1.0},
    "invariant_violations": [],
    "error": null
  }
}
```

Worlds: `legacy_fleet005_seed101_baseline.json`, `legacy_fleet005_seed101_candidate.json` (arm scenarios from
`apply_axis`, tape from the declared scenario), `legacy_analytical.json` (the hand-written three-request world of
`tests/unit/test_fleet_analytical_fixture.py`), `legacy_collision.json` (12 vehicles so `v-10` and `v-11` sort before
`v-2`, one service bay, several cars queued so a completed service retries them at one second), and
`legacy_precheck_world_fed_axis.json`, which holds two worlds for `parameter:horizon_s` with a declared horizon of 1800 s
and a baseline of 3600 s: the precheck world built from the baseline arm and the paired world built from the declared
scenario, each with its expected events and metrics for the baseline arm. A world whose FleetLab run raises stores
`"error": "<ExceptionType>"` and no events.

## 6. Teaching model (`src/model/`)

### 6.1 Time base

Integer seconds from day 1 00:00. Day 2 00:00 is 86,400. Hour index `h = Math.floor(t / 3600)`, 0 to 47; hour of day
`h % 24`. Presets: window 18,000 (D1 05:00) to 122,400 (D2 10:00); warm-up end 21,600; recall 88,200 (D2 00:30); release
107,100 (D2 05:45); placement snapshot 108,000 (D2 06:00). Display as `D1 18:30`, never AM or PM.

### 6.2 Scenario object (`schema.js`)

All integers in engine units. `schema.js` exports `KNOBS` (every design §2 knob: id, label, unit shown, engine unit,
type, range, default, first-build flag, help text), `defaultScenario()`, `validateScenario(s)` returning
`{ok: true}` or `{ok: false, errors: [{what, why, fix, knob}]}` (design §7.6 four slots, P19), `cloneScenario`,
`applyAxis(scenario, axis, value)` and `describeDifferences(a, b)`.

```js
{
  format: "playground-scenario", version: "0.1", name: "bay_teaching_map",
  window: { start_s: 18000, end_s: 122400 }, warmup_end_s: 21600, bucket_s: 3600, placement_snapshot_s: 108000,
  areas: [ { id: "SF", cars: 30, in_area_s: 360, peak_per_h: 60, offpeak_per_h: 15 },
           { id: "PEN", cars: 18, in_area_s: 480, peak_per_h: 20, offpeak_per_h: 8 },
           { id: "SJ", cars: 24, in_area_s: 480, peak_per_h: 35, offpeak_per_h: 10 },
           { id: "EB", cars: 18, in_area_s: 420, peak_per_h: 30, offpeak_per_h: 8 } ],
  routes: [ { id: "H1", a: "SF", b: "PEN", cls: "HIGHWAY", free_flow_s: 1500 },
            { id: "L1", a: "SF", b: "PEN", cls: "LOCAL", free_flow_s: 3300 } /* … H2-H6, L2-L6 per design §2.9 */ ],
  peaks: [ { start_h: 7, end_h: 9 }, { start_h: 16, end_h: 19 } ],
  demand_shape: "peaked",
  dest_weights: { morning: { SF: { SF: 70, PEN: 10, SJ: 10, EB: 10 } /* … */ }, evening: { /* … */ }, other: { /* … */ } },
  congestion: { HIGHWAY: { "SF>PEN": [/* 48 per-mille values */] /* every ordered pair */ },
                LOCAL: { /* every ordered pair */ }, IN_AREA: [/* 48 */] },
  congestion_threshold_permille: 1300, sigma_permille: 0,
  depots: [ { id: "SF-1", area: "SF", parking: 60, cleaning_bays: 4, service_bays: 2 },
            { id: "SF-2", area: "SF", parking: 30, cleaning_bays: 2, service_bays: 1 },
            { id: "SJ-1", area: "SJ", parking: 30, cleaning_bays: 3, service_bays: 1 },
            { id: "EB-1", area: "EB", parking: 30, cleaning_bays: 2, service_bays: 1 } ],
  depot_access_s: 300, intake_s: 180, pull_out_s: 120, clean_s: 1200, service_s: 2700,
  trips_between_visits: 10, service_every_visits: 3,
  policies: { dispatch: "nearest_idle", depot_assignment: "home_depot", recall_s: 88200, release_s: 107100, queue_order: "fifo" },
  patience_s: 600
}
```

Area order is always SF, PEN, SJ, EB. Route direction keys are `"<from>><to>"`.

Default congestion (design RD-3), by hour of day on both days, per-mille:
- HIGHWAY, a pair that includes SF: hours 7 and 8, toward SF 1600 and away from SF 1200; hours 16, 17 and 18, away
  from SF 1600 and toward SF 1200; hour 19, 1300 both ways; otherwise 1000.
- HIGHWAY, a pair without SF: hours 7, 8, 16, 17, 18, 1200 both ways; hour 19, 1300; otherwise 1000.
- LOCAL, every pair, and IN_AREA: hours 7, 8, 16, 17, 18, 1300; otherwise 1000.

Axis parts (design §2.8, RD-3): `parameter:RD-3.<class>.<period>` with class `highway` or `local` and period `morning`
(hours 7-8), `evening` (16-18) or `late` (19); the value is per-mille and sets every direction of that class in those hours
on both days. `parameter:SUP-1.<area>`, `parameter:DEP-3.<depot>`, named layouts for `parameter:DEP-3` (an object of depot
id to bays), `parameter:DEM-5` (`flat` or `peaked`), `policy:depot_assignment`. Every other knob axis is
`parameter:<knob id>`.

### 6.3 World (`routes.js`, `world.js`)

`routes.js`
- `plannedLegSeconds(scenario, segment, depart_s)` integrates free-flow time through hourly multipliers (design §5.2.1):
  remaining free-flow in micro-units `R = free_flow_s × 10^6`; inside hour `h` with multiplier `m` and `S` seconds to the
  hour end, `covered = floor(S × 10^9 / m)`; if `R ≤ covered`, elapsed there is `roundHalfEvenDiv(R × m, 10^9)` added to
  the whole seconds already spent, and the leg ends; else `R -= covered`, advance to the hour end. Hours past 47 use hour
  47's multiplier. Check: H2 from 66,600 (18:30) at 1600 then 1300 gives 1800 + 2828 = 4628 s.
- A segment is `{kind: "ROUTE", route_id, from, to}`, `{kind: "IN_AREA", area}` or `{kind: "ACCESS", depot, dir: "IN"|"OUT"}`.
  Access and in-area segments use `IN_AREA`; route segments use their class and direction.
- `chooseRoute(scenario, from, to, depart_s)` compares the planned seconds of the pair's HIGHWAY and LOCAL routes and
  takes the smaller; a tie goes to HIGHWAY.
- `planPath(scenario, fromLocation, toLocation, depart_s)` returns ordered segments with planned seconds. A location is
  `{area}` (its centre) or `{depot}`. Leaving a depot: `PULL_OUT` (fixed `pull_out_s`), `ACCESS OUT`, then either an
  in-area segment (a pickup in the same area) or a route. Arriving at a depot: route (if another area), then `ACCESS IN`.
  Depot to depot in one area: `ACCESS OUT`, `ACCESS IN`. A pickup in the car's own area is one in-area segment; a trip in
  one area is one in-area segment of the origin area.

`world.js`
- `buildWorld(scenario, {lambdaMaxPermille, seed})` returns a frozen object with `requests` per arm-independent candidate
  stream and factor accessors. Demand key is `scenario.name`.
- Lambda per area and hour: in a peak hour (hour of day inside any `peaks` window, both days) `peak_per_h × 1000`, else
  `offpeak_per_h × 1000`. `flat` replaces every hour of the window by
  `roundHalfEven`-rounded integer mean of the peaked values over the window's hours (design §5.2.2).
- `lambdaMaxPermille[area]` is declared by the caller (the maximum over both arms in an experiment, the scenario's own
  maximum in Sandbox). An area with zero maximum has no candidates.
- Candidates for area `a` (index `k` from 0): `gap_s = roundHalfEvenDiv(EXP_TABLE[u16(name, "gap", a, k)] × 3600, lambdaMax)`;
  `t_k = start_s + sum of gaps up to and including k`; stop when `t_k ≥ end_s`. Keep `thin = u32(name, "thin", a, k)` and
  `dest = u32(name, "dest", a, k)`.
- `acceptedRequests(world, scenario)` accepts candidate `k` when `thin × lambdaMax < lambda_a(hour(t_k)) × 2^32` (exact
  in doubles), picks the destination with `Math.floor(dest × W / 2^32)` over cumulative weights in area order for the
  candidate's period (`morning` hours 7-8, `evening` 16-18, `other`), and returns requests
  `{id: "r-<a>-<k>", time_s, origin, dest}` sorted by `(time_s, id)`.
- Factors: `trafficPpm(seed, segmentKey, dir, quarterHour)` = `MULT_TABLE_σ[u16(seed, "traffic", segmentKey, dir, qh)]`
  where `segmentKey` is the route id, `IN-<area>` or `ACC-<depot>`, `dir` is `"<from>><to>"`, `IN` or `OUT` (in-area
  uses `-`), and `qh = Math.floor(depart_s / 900)`. `ridePpm(seed, requestId)` = `MULT_TABLE_σ[u16(seed, "ride", id)]`.
- `realizedSeconds(planned_s, trafficPpm, ridePpm)` = `Number(roundHalfEvenDiv(BigInt(planned) × tf × rf, 10^12))`, with
  `ridePpm` 1,000,000 for legs no rider causes. Pull-out and intake are never scaled.
- `worldDigest(world)` hashes canonical JSON of `{name, window, lambdaMax, candidates: per area [[t_k, thin, dest]],
  seed, sigma_permille, table_digests}` (design P18). Traffic and ride factors are fully determined by `seed`,
  `sigma_permille` and the pinned table digests, so they are covered without listing every value.

### 6.4 Engine (`policies.js`, `engine.js`)

`engine.js` exports `createRun(scenario, world, {seed, lambdaMaxPermille, defect = null, keepLogs = true})` returning a
run object with `step(maxEvents): boolean` (true when finished) and `result()`; and `runToEnd(...)` for tests. It is
resumable so `runtime/host.js` can time-slice it.

States (design §5.3): `IDLE`, `ENROUTE_PICKUP`, `ON_TRIP`, `TO_DEPOT`, `INTAKE`, `GATE_WAIT`, `QUEUED_SERVICE`,
`IN_SERVICE` with task `CLEAN` or `SERVICE` and a `blocked` flag, `READY_AT_DEPOT`, `REPOSITIONING`. Every change goes
through one `transition(car, to, event, detail)` function that checks the design §5.3 table (invariant 9) and appends to
the interval log.

Vehicles: ids `<AREA>-<nnn>` from 1, three digits (`SF-001`), created in area order then number; each starts `IDLE` at its
home area centre at `window.start_s`. Home area is the starting area; home depot per design SUP-2 (nearest to the home
area by free-flow seconds including `depot_access_s`; tied depots shared in turn in vehicle-id order starting with the
lowest depot id; SF-017 gets SF-1).

Heap: `[time_s, class, seq, kind, entity]` ordered by `time_s`, then `class`, then `seq`. Classes per design §5.4 item 3.
Every push increments `seq`. Every log entry gets `ord`. Handlers iterate entities in sorted-id order.

Rules the design fixes and this contract makes exact:
- Dispatch (POL-1): on `REQUEST_CREATED` and whenever a car becomes `IDLE` or `READY_AT_DEPOT`, serve waiting riders oldest
  first (`time_s`, then id). For each, candidate cars are `IDLE` and `READY_AT_DEPOT`; rank by planned arrival at the
  rider's area centre (planned path from the car's location at the current second), then vehicle id; assign the best.
  Stop when no car or no rider remains. The pickup leg and the trip leg are planned and realized at assignment and
  departure; each non-fixed segment is realized from its own departure second with `trafficPpm × ridePpm`.
- A visit is due when `trips_since_visit ≥ trips_between_visits` after `TRIP_COMPLETED`. Visit number `n` counts visits
  started by the car from 1; the visit includes service when `service_every_visits > 0` and `n % service_every_visits === 0`.
  `trips_since_visit` resets to 0 when the visit completes (`READY_AT_DEPOT`).
- Depot assignment (POL-2), only among depots that can serve the visit (a service visit needs `service_bays > 0`):
  `home_depot` (falls back to `nearest_depot` when the home depot cannot serve it, logged); `nearest_depot` by planned
  arrival, then depot id; `nearest_depot_with_capacity` the nearest whose `parking - stalls held - cars inbound ≥ 1` at
  departure, falling back to `nearest_depot` when none qualifies (logged).
- Recall, release, gate, blocked cars, freed stalls, drain: design §5.3 and §5.7 exactly. When a bay frees, candidates in
  order: first a car blocked in a cleaning bay at that depot whose service is due (for a service bay), then queued cars in
  FIFO order of `INTAKE_COMPLETED` time, then vehicle id.
- Leg exposure bookkeeping: every segment records `{kind, key, dir, t0, t1, loaded, cls}` so metrics can clip and attribute
  seconds; the congested test uses the declared multiplier of the hour containing each realized second.
- Defects for tests (`defect` option): `double_assign`, `bay_overfill`, `lot_overfill`, `teleport`,
  `illegal_transition`. Each must be caught by its named invariant (design §9.5).

`result()` returns `{scenario_digest, world_digest, seed, events, intervals, visits, requests, cars, depots, drain_end_s,
invariant_violations, counters}`; `events` entries `{ord, t, kind, car?, req?, depot?, detail?}`; `intervals` per car
`[{state, t0, t1, location|segments, task?, blocked?, request?}]`; `visits` `{car, depot, arrival_s, intake_end_s,
first_task_s, clean_start_s, clean_end_s, service_start_s, service_end_s, ready_s, censored}`.

### 6.5 Metrics and invariants

`metrics.js`: `METRICS` registry (`playground-metrics 0.1`, design §5.7 every row: name, unit, direction, population,
absent_when, allowed scopes, fleetlab_status, descriptive flag); `computeMetric(result, ref)` returning
`{value}` or `{absent: reason}`; `computeAll(result, refs)`; `validateMetricRef(ref)` (scope rules, rejected scopes). The
default measurement span is `[warmup_end_s, end_s)`; a scope window must lie inside it. Percentiles use
`percentileFleetLab`. Absence is never 0.

`invariants.js`: design §5.6 checks 1-3, 5, 8-12, Conservation, P13-P21, each returning strings `"<id>: detail"`. Engine
calls the per-change checks as it runs; `checkRun(result)` runs the rest. A violation voids the run.

### 6.6 Experiments (`experiment.js`)

- `freezeSpec(draft)` validates (one axis, values in range, margin > 0, registered metrics, valid scopes, seeds 10-100,
  resamples 1,000-100,000) and returns `{spec, digest}` with the canonical form of design §6 (fractions in ppm).
- `runExperimentSpec(spec, {onProgress, shouldCancel})` builds one world per seed from the declared scenario with a shared
  `lambdaMaxPermille` over both arms, runs the precheck (baseline arm, `seeds[0]`, twice, same world), runs both arms per
  seed, checks invariants, computes metric maps, then calls `computeVerdict` with the full digest as key. It is a
  generator-friendly function so the host can slice it.
- Primary and guardrail metrics are compared as FleetLab compares numbers: fraction metrics in their natural double units
  (the ppm form is only for the digest).

## 7. Runtime (`src/runtime/`)

`worker.js` handles messages `{type: "run_window", scenario, seeds}` and `{type: "run_experiment", spec}` and
`{type: "cancel"}`; it posts `{type: "ready"}`, `{type: "progress", done, total, label}`, `{type: "result", payload}`,
`{type: "error", message}`. `host.js` exposes `createEngineHost()` with the same API on either path, starts the worker
(module worker in development, Blob worker in the packed file, design §9.4), falls back to time-sliced main-thread
execution in slices of at most 8 ms, and reports `path: "worker" | "main thread"`.

## 8. Interface (`src/ui/`)

- `store.js`: one immutable state object, `dispatch(action)`, `subscribe(fn)`, selectors. State keys: `mode`
  (`learn`, `sandbox`, `experiment`), `presetId`, `scenario`, `changes`, `run` (status, per-seed summaries, selected
  seed, progress), `clock_s`, `playing`, `speed`, `selection` (`{car}` or `{depot}` or null), `inspector`, `experiment`
  (draft, frozen spec, digest label, verdict, session log), `learn` (case, moment), `reducedMotion` (system or override),
  `engineHost` path. Every action is a pure reducer case, testable in Node without a page.
- `labels.js`: every interface string, including the exact copy of design §1.3. Nothing else contains user-visible copy.
- `app.js` builds the shell of design §7.2 with `dom.js` helpers; `map.js`, `playback.js`, `charts.js`, `inspector.js`,
  `controls.js`, `experiment.js`, `learn.js`, `a11y.js` each render one region from the store.
- Visual tokens and type: design §8 exactly, light and dark via `prefers-color-scheme` on `:root`, system font stacks.
- Accessibility and states: design §7.7. Layout: design §7.2 breakpoints; no horizontal page scroll at 400 px.

## 9. Tools

`pack.mjs` reads `index.html`, `styles.css` and the module graph from `src/ui/app.js`, inlines modules into one classic
script in dependency order (rewriting `import`/`export` without `eval`), inlines the worker source as a string, adds the
design §9.4 content security policy, and writes only the `--out` path, which must be outside the repository or under an
ignored path and never under `artifacts/` or `experiments/`. `check-dist.mjs` fails on any `http:`/`https:` URL, a missing
policy, a forbidden token, a banned word in copy, a `REQUIRED_LABELS` string (read from a list passed by the test, never
spelled in the tool), or a size over 2 MB.

## 10. Tests

`playground/fleetlab/test/`: `core.test.mjs`, `tables.test.mjs`, `instrument-parity.test.mjs`, `summary.test.mjs`,
`legacy-parity.test.mjs`, `routes.test.mjs`, `world.test.mjs`, `engine-fixtures.test.mjs`, `invariants.test.mjs`,
`metrics.test.mjs`, `determinism.test.mjs`, `pairing.test.mjs`, `properties.test.mjs`, `experiment.test.mjs`,
`captions.test.mjs`, `store.test.mjs`, `labels.test.mjs`, `boundaries.test.mjs`, `pack.test.mjs`. Fixture paths resolve
from `import.meta.url` to the repository's `tests/fixtures/fleet_playground/`. Hand-derived expectations carry their
arithmetic in comments, never copied from a run.

Python: `test_fleet_playground_parity.py` (instrument vectors, legacy worlds, reference projections, sample summary
rejection by `DecisionRecord` and `ExperimentSpec`), `test_fleet_playground_boundaries.py` (R1, R2, R5 text part, R6,
R7, R8, R9). R6 compares against the base commit named by the environment variable `FLEET_PLAYGROUND_BASE`. The section 1
gate command sets it to the design's base `bca4ccd`, and a test requires every boundaries pytest command in section 1 to
set it, so R6 runs at every phase gate. Without the variable, or with an unreachable commit (a shallow clone), it skips
with that reason, so later work on `main` after the playground phases never breaks it.

## 11. Phase gates

1. Verdict core: sections 3, 4; both parity suites green.
2. Legacy profile: section 5; event logs, counts, metrics exact.
3. Teaching model: section 6; worked example, fixtures, invariants, properties, performance proxies.
4. Interface and runtime: sections 7, 8, 9; interface tests, `check-dist`, browser smoke recorded.
5. Experiment and Learn: presets, verdict, session log, Learn cases, captions asserted, reference panels.

Hard stops: a parity mismatch, a boundary failure, a new dependency, any edit under `src/hermes/`, a deleted or loosened
test, a hidden honesty label.

## 12. Decisions this contract makes where the design is silent

1. Congestion for pairs without SF (section 6.2); the in-area row; axis part hours.
2. Destination weights are in the design §2.9; area order SF, PEN, SJ, EB everywhere.
3. Vehicle ids and initial placement at home area centres.
4. Planned-time integration in micro-units with floor per hour and one final half-even rounding.
5. Each segment of a leg realized separately; pull-out and intake unscaled; access and in-area legs take the traffic
   factor, and the ride factor when a rider caused the leg.
6. Visit number and service cadence; trip counter resets at `READY_AT_DEPOT`.
7. Fallbacks for `home_depot` without a needed service bay and for `nearest_depot_with_capacity` with no qualifying depot.
8. Bay priority for blocked cars before queued cars.
9. Metric measurement span excludes the warm-up; scope windows must lie inside it.
10. The world digest covers factors by their seed, sigma and table digests.
11. R6 reads its base from `FLEET_PLAYGROUND_BASE` rather than a hard-coded commit; the phase gate command sets it to
    `bca4ccd` (a test checks that), so R6 runs at every phase 1 to 5 gate and skips only outside the playground phases
    or in a shallow clone.
12. The sample result summary for R9 is a committed fixture compared by a node test; no playground code writes it. A
    missing file fails the R9 pytest rather than skipping it.
13. FleetLab has no function for the bootstrap index pair; it is written inline in `_bootstrap_ci`. The
    `bootstrap_indices` rows therefore evaluate one copy of that expression in the regenerator. The regenerator
    rebuilds the sorted resample means for every `bootstrap` row and raises unless `_bootstrap_ci`'s bounds sit at
    the copied indices, so a change to FleetLab's expression breaks regeneration instead of leaving stale rows.
