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
node playground/fleetlab/tools/pack.mjs --site dist/site
```

```bash
node playground/fleetlab/tools/check-dist.mjs --site dist/site
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
  src/model/       schema.js presets.js ops-cases.js routes.js world.js policies.js engine.js metrics.js invariants.js experiment.js
  src/runtime/     worker.js host.js protocol.js
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
- `sha256Stream(): {update(text), hex()}` incremental SHA-256 over UTF-8 text, equal to `sha256Hex` of the joined text.
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
  sort ascending (stable, section 3 comparator); return the two indexed means. `bootstrapCiSteps` is the generator
  behind it, yielding after about every 4,096 hash draws and once before the sort.

`paired.js` (`computeVerdictSteps` is the generator behind `computeVerdict`, same arguments and result)
- `compareMetric(metric, role, baselineRuns, candidateRuns)`: returns `null` if any run lacks the metric (a missing
  key or `undefined`); else `{metric, role, baseline_mean, candidate_mean, paired_deltas, mean_delta,
  median_delta}` using `candidate - baseline` per index, `meanFleetLab`, `medianFleetLab`.
- `computeVerdict({primary, guardrails, descriptiveNames, baselineRuns, candidateRuns, resamples, key,
  precheckMatched, invariantViolation})` follows `run_experiment` and returns at the first failure, in this order:
  1. `precheckMatched === false`: `INVALID_EXPERIMENT` / `REPLICATION_MISMATCH`, detail
     `identical seed produced different metrics on replay`;
  2. `invariantViolation` is a string: `INVARIANT_VIOLATION`, detail exactly that string (the caller builds it as
     `` `seed ${seed}: ${violations[0]}` ``, section 6.6);
  3. the primary is unavailable: `NOT_COMPARABLE`, detail `` `primary metric ${primary.name} unavailable in some replication` ``.
  Every detail is cut to its first 300 code points (Python `detail[:300]`). Otherwise it returns the interval, the
  available guardrail results, the regressions, the available descriptive results in the given order (skipping the
  primary), the outcome, the recommendation and `guardrail_statuses`. An invalid verdict carries `outcome: null`,
  `recommendation: "NO_RECOMMENDATION"`, `primary: null`, and empty `guardrail_results`, `guardrail_regressions`,
  `descriptives` and `guardrail_statuses`.

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
- `summaryText(summary): string` for the clipboard. Its field labels are an export format, not interface copy, so they
  live in `summary.js` (section 12); they obey the banned-word and dash rules, and `check-dist` scans them. The text rounds for reading (a `_s` metric in seconds to
  one decimal, a fraction to four decimals, anything else to one), half to even on the exact decimal expansion, and a
  nonzero value that would round to zero prints its exact value with its sign; the summary object keeps exact doubles.

### 4.1 Instrument vector fixture

`tests/fixtures/fleet_playground/instrument_vectors.json`, written only by the regenerator, checked by both suites.
Floats are written by Python `json.dumps` (shortest round-trip repr), so JavaScript `JSON.parse` yields the same
doubles; `-0.0` is preserved. 64-bit integers are decimal strings.

```json
{
  "format": "fleet-playground-instrument-vectors",
  "format_version": 1,
  "python_version": "3.11",
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
guardrails where a later one regresses after the first stays within its limit. Every verdict number comes from calling
FleetLab's own functions (`_u64`, `_bootstrap_ci`, `_compare`, `_resolve_outcome`, `_guardrail_regressions`,
`resolve_recommendation`, `run_metrics`, `run_experiment`), never from a re-implementation. Three groups are stated
exceptions: `bootstrap_indices` evaluates the copied index expression (section 12 item 13); `percentile` rows come from
`run_metrics` on a hand-built `RunLog` whose completed requests have integer waits equal to `values` (q 0.5 reads
`wait.p50_s`, q 0.9 reads `wait.p90_s`); `sum_left_to_right` is Python 3.11's built-in `sum`, the call `_compare` makes.
Invalid verdicts are covered as well: an `invalid` group holds `run_experiment` records for `INVARIANT_VIOLATION`
(`dispatch_mode="defect_double_assign"`), `NOT_COMPARABLE` (a primary absent in some replication) and
`REPLICATION_MISMATCH` (the regenerator makes FleetLab's second precheck run return a different metric map), each with
its `invalidity_detail`; and a `detail_truncation` group holds strings longer than 300 code points, with non-ASCII text,
beside Python's `text[:300]`.

The pytest parity test asserts `sys.version_info[:2] == (3, 11)`, rebuilds every vector from FleetLab, and requires the
regenerator's serialization of the rebuilt payload to equal the committed file byte for byte. That keeps `-0.0` apart
from `0.0` and `1` apart from `1.0`, which Python `==` does not. It never writes. The node parity test loads the same
file and requires exact equality (`Object.is` for numbers).

## 5. Legacy profile (`src/legacy/`) and its fixtures

`world-import.js`: `importLegacyWorlds(json)` validates a legacy fixture file (section 5.1) and returns a map from world
name to `{name, scenario, tape, dispatchMode, expected}`, where `tape.demand` is an array of
`{request_id, time_s, origin, destination}` in the given order and `tape.travel_multiplier` maps id to double.

`profile.js` is a line-by-line port of `src/hermes/fleet/engine.py`, `run_metrics` and `check_invariants`:
- `runLegacyFleet(scenario, tape, {dispatchMode = "nearest"})` returns `{scenario, events, requests, vehicles,
  service_queue_waits_s, max_bays_in_use}` (the scenario is kept, as FleetLab's `RunLog` keeps it), requests and vehicles in Python insertion order. Vehicles `v-0 … v-(n-1)` are
  placed round-robin over `scenario.zones`; fields and updates follow `_Vehicle` and `_Request` exactly (zone at pickup
  and at drop-off, `busy_since_s`, `busy_total_s`, `trips_since_service`, `completed_trips`, and `pickup_time_s` set at
  assignment).
- Heap entries `[time_s, seq, kind, entity_id]` are ordered by `time_s`, then `seq`. `seq` increments on every push, in
  Python's push order: for each tape request in tape order, `REQUEST_CREATED` then `WAIT_DEADLINE`; then every push a
  handler makes, including `PICKUP_COMPLETED` before `TRIP_COMPLETED` at assignment, a car entering the service queue
  pushing its own `SERVICE_TRY_START`, and each completed service pushing one `SERVICE_TRY_START` per queued car in
  string-sorted id order.
- `travelSeconds(scenario, origin, dest, multiplier) = Math.max(1, roundHalfEven(base * multiplier))`, with base
  `in_zone_pickup_s` when origin and destination are the same zone.
- Dispatch loops while riders wait: the defect mode takes the smallest-id busy car once; otherwise the minimum over idle
  cars by `(travelSeconds(car.zone, origin), vehicle_id)` with string comparison. `waiting` is an array used as a queue.
- The arm-horizon guard on `REQUEST_CREATED` (`now_s > scenario.horizon_s`) is copied. When a `WAIT_DEADLINE` finds a
  `WAITING` request that is not in `waiting` (a skipped request, design FL-11), the port throws
  `Object.assign(new Error("list.remove(x): x not in list"), {name: "ValueError"})`, as FleetLab raises.
- `legacyMetrics(log)` returns FleetLab's metric map with the same keys present or absent and identical doubles.
- `legacyInvariants(log)` ports `check_invariants`, strings included.
- `canonicalEvents(log)` returns `[[t, kind, id], …]`; `eventsDigest(events)` is the SHA-256 of `JSON.stringify(events)`,
  which holds no floats, so both languages hash identical bytes.

### 5.1 Legacy fixture files

Every legacy fixture is written only by the regenerator and has one shape, a map of named worlds:

```json
{
  "format": "fleet-playground-legacy-worlds",
  "format_version": 1,
  "worlds": {
    "baseline": {
      "name": "fleet005-seed101-baseline",
      "origin": "FLEET-005 baseline arm from apply_axis; tape from the declared scenario at seed 101",
      "scenario": {"...": "the scenario passed to run_fleet, FleetScenarioConfig.model_dump(mode='json')"},
      "tape": {"seed": 101, "demand": [["r-0-0", 12, "downtown", "airport"]], "travel_multiplier": {"r-0-0": 1.03}},
      "dispatch_mode": "nearest",
      "expected": {
        "error": null,
        "events": [[12, "REQUEST_CREATED", "r-0-0"]],
        "events_digest": "hex",
        "event_counts": {"REQUEST_CREATED": 1},
        "metrics": {"requests.total": 1.0},
        "invariant_violations": []
      }
    }
  }
}
```

When FleetLab's run raises, `expected` is `{"error": "<exception type name>", "events": null, "events_digest": null,
"event_counts": null, "metrics": null, "invariant_violations": null}`.

Files:
- `legacy_fleet005_seed101.json`: worlds `baseline` and `candidate`, the arm scenarios from
  `apply_axis(fleet_005_spec(), value)` and the tape `build_tape(spec.scenario, 101)`.
- `legacy_analytical.json`: world `analytical`, the hand-written three-request world of
  `tests/unit/test_fleet_analytical_fixture.py`.
- `legacy_collision.json`: world `collision`, a hand-written tape with 12 vehicles in 2 zones so `v-10` and `v-11` sort
  before `v-2`, one service bay, and several cars queued when a service completes, so their retries share one second.
  The regenerator's comments explain the construction and assert that both collisions happen.
- `legacy_precheck_world_fed_axis.json`: worlds `precheck` and `paired`. The declared scenario is FLEET-005's with
  `horizon_s` 1800; the axis is `parameter:horizon_s` with baseline 3600. Both worlds run the 3600 s baseline arm:
  `precheck` on `build_tape(baseline_arm, 101)` (what `run_experiment` line 216 does), `paired` on
  `build_tape(declared, 101)` (line 230).
- `legacy_defect.json`: worlds run with `dispatch_mode="defect_double_assign"`, the only legacy fixtures allowed to
  hold invariant violations, so the ported checker is shown firing and the seeded-defect dispatch branch runs.
- `legacy_fl11_horizon_crash.json`: world `crash`, the declared scenario FLEET-005's with `horizon_s` 3600, tape
  `build_tape(declared, 101)`, run under the arm scenario with `horizon_s` 1800. Expected error `ValueError`.

The pytest parity test rebuilds every world and requires byte equality with each file. The node test runs
`runLegacyFleet` on every world and requires, for a normal world, identical `events` entry by entry (reporting the first
difference), `events_digest`, `event_counts`, `metrics` (`Object.is`) and `invariant_violations`; for an error world, a
thrown error whose `name` equals `expected.error`.

### 5.2 Reference panels

`tests/fixtures/fleet_playground/reference_panels.json`, written only by the regenerator:
`{format: "fleet-playground-reference-panels", format_version: 1, fleet005: P, probe: P}`. Each `P` is
`{experiment_id, question, variation_axis, baseline_value, candidate_value, replications, validity, invalidity_reason,
outcome, recommendation, primary: {metric, direction, equivalence_margin, baseline_mean, candidate_mean, mean_delta,
median_delta, ci_low, ci_high}, guardrails: [{metric, direction, max_harm, mean_delta, regressed}], descriptives:
[{metric, baseline_mean, candidate_mean, mean_delta}], suppressed: [metric names]}` with values copied unmodified from the
record (design §7.2 projection). `fleet005` projects `run_experiment(fleet_005_spec())`; `probe` projects `run_experiment`
on the Appendix A.9 spec, which the regenerator holds as a literal. Descriptives keep the record's order;
`fleet.utilization_fraction`, `business_proxy.served_trips` and `business_proxy.unserved_demand` appear only by name in
`suppressed`. There are no labels, digests or `deployment_permission`. The pytest rebuilds both panels, requires byte
equality, and asserts that the file contains no `REQUIRED_LABELS` string and no 64-character hexadecimal string.
`src/model/reference-panels.js` exports a literal `REFERENCE_PANELS` object that `src/model/presets.js` re-exports
(design §9.3), and a node test requires it to deep-equal the fixture.

## 6. Teaching model (`src/model/`)

### 6.1 Time base

Integer seconds from day 1 00:00. Day 2 00:00 is 86,400. Hour index `h = Math.floor(t / 3600)`, 0 to 47; hour of day
`h % 24`. Presets: window 18,000 (D1 05:00) to 122,400 (D2 10:00); warm-up end 21,600; recall 88,200 (D2 00:30); release
107,100 (D2 05:45); placement snapshot 108,000 (D2 06:00). Display as `D1 18:30`, never AM or PM.

### 6.2 Scenario object (`schema.js`)

All numbers are integers in engine units. `schema.js` exports `KNOBS` (every design §2 knob: id, label, unit shown,
engine unit, type, range, default, first-build flag, help text), `defaultScenario()`, `validateScenario(s)` returning
`{ok, errors: [{what, why, fix, knob}], warnings}` (design §7.6 four slots, P19), `cloneScenario`,
`applyAxis(scenario, axis, value)` and `describeDifferences(a, b)`.

```js
{
  format: "playground-scenario", version: "0.1", name: "bay_teaching_map",
  window: { start_s: 18000, end_s: 122400 }, warmup_end_s: 21600, bucket_s: 3600, placement_snapshot_s: 108000,
  areas: [ { id: "SF", cars: 40, in_area_s: 360, peak_per_h: 60, offpeak_per_h: 15 },
           { id: "PEN", cars: 24, in_area_s: 480, peak_per_h: 20, offpeak_per_h: 8 },
           { id: "SJ", cars: 32, in_area_s: 480, peak_per_h: 35, offpeak_per_h: 10 },
           { id: "EB", cars: 24, in_area_s: 420, peak_per_h: 30, offpeak_per_h: 8 } ],
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

`peaks` is exactly two windows in hours of day, `start_h` inclusive and `end_h` exclusive, `0 ≤ start_h < end_h ≤ 24`, the
first the morning peak and the second the evening peak, the first ending no later than the second starts. Hour `h` is a
peak hour when `start_h ≤ h % 24 < end_h` for either window. A candidate's destination period is `morning` inside the
first window, `evening` inside the second, and `other` otherwise.

`policies.release_s` is a safe integer or `null`, which means the release is off. The recall acts once at `recall_s`: it sends `IDLE` cars then and marks cars on a pickup or a
trip; a marked car goes to a depot when that trip completes before `release_s ?? window.end_s`. P19 checks `release_s > recall_s` only when it is not null. `validateScenario`
rejects a missing key and any value that is neither a safe integer nor null.

Default congestion (design RD-3), by hour of day on both days, per-mille:
- HIGHWAY, a pair that includes SF: hours 7 and 8, toward SF 1600 and away from SF 1200; hours 16, 17 and 18, away
  from SF 1600 and toward SF 1200; hour 19, 1300 both ways; otherwise 1000.
- HIGHWAY, a pair without SF: hours 7, 8, 16, 17, 18, 1200 both ways; hour 19, 1300; otherwise 1000.
- LOCAL, every pair, and IN_AREA: hours 7, 8, 16, 17, 18, 1300; otherwise 1000.
These hours are fixed and do not follow `peaks`.

Axis grammar (design §2.8): `parameter:SUP-1.<area>`; `parameter:DEP-2.<depot>`, `parameter:DEP-3.<depot>` and
`parameter:DEP-5.<depot>` for one depot, or `parameter:DEP-3` with named layouts (an object of depot id to bays that lists
every depot); `parameter:DEM-1.<area>` and `parameter:DEM-2.<area>`; `parameter:DEM-5` (`flat` or `peaked`);
`parameter:RD-3.<class>.<period>` with class `highway` (every direction of every HIGHWAY route), `local` (every direction
of every LOCAL route) or `in_area` (the `IN_AREA` row) and period `morning` (hours 7-8), `evening` (16-18) or `late` (19),
the per-mille value set on both days, where `local` never changes `IN_AREA`; `parameter:POL-4` with a clock integer or the
named value `off` (null); `policy:depot_assignment`; and `parameter:<knob id>` for every other first-build knob. SUP-2, DEP-1, DEM-3, DEM-4, RD-5 and CLK-1 to CLK-4 are
not axes: each is derived, structural, a measurement setting, or an input of the shared world where an axis would be
silently inert (design FL-1).

### 6.3 World (`routes.js`, `world.js`)

`routes.js`
- `plannedLegSeconds(scenario, segment, depart_s)` integrates free-flow time through hourly multipliers (design §5.2.1):
  remaining free-flow in micro-units `R = free_flow_s × 10^6`; inside hour `h` with multiplier `m` and `S` seconds to the
  hour end, `covered = floor(S × 10^9 / m)`; if `R ≤ covered`, elapsed there is `roundHalfEvenDiv(R × m, 10^9)` added to
  the whole seconds already spent, and the segment ends; else `R -= covered`, advance to the hour end. Hours past 47 use
  hour 47's multiplier. Check: H2 from 66,600 (18:30) at 1600 then 1300 gives 1800 + 2828 = 4628 s.
- A segment is `{kind: "PULL_OUT"}`, `{kind: "ROUTE", route_id, from, to}`, `{kind: "IN_AREA", area}` or
  `{kind: "ACCESS", depot, dir: "IN"|"OUT"}`. Access and in-area segments use `IN_AREA`; route segments use their class and
  direction. `PULL_OUT` lasts `pull_out_s` and takes no multiplier.
- `chooseRoute(scenario, from, to, depart_s)` compares the planned seconds of the pair's HIGHWAY and LOCAL routes leaving
  at `depart_s` and takes the smaller; a tie goes to HIGHWAY.
- `pathSegments(fromLocation, toLocation, purpose)` lists the segment kinds of a path. A location is `{area}` (its centre)
  or `{depot}`. Leaving a depot: `PULL_OUT`, `ACCESS OUT`, then an in-area segment (a pickup in the depot's area) or a
  route. Arriving at a depot: a route (from another area), then `ACCESS IN`. Depot to depot in one area: `ACCESS OUT`,
  `ACCESS IN`. A pickup or trip inside one area is one in-area segment of that area.
- `planPath(scenario, fromLocation, toLocation, depart_s)` chains planned seconds: each segment departs at the planned end
  of the previous one, and a route segment chooses its route at its own planned departure. Policies rank cars and depots
  only with `planPath` from the decision second (design §5.5: policies never see realized times).

`world.js`
- `buildWorld(scenario, {seed, lambdaMaxPermille})` returns a frozen world: the candidate stream per area and the factor
  accessors. The demand key is `scenario.name`. `lambdaMaxPermille[area]` defaults to the scenario's own hourly maximum;
  an experiment and every paired run pass the shared maximum over both arms.
- Lambda per area and hour: `peak_per_h × 1000` in a peak hour, else `offpeak_per_h × 1000`. `flat` replaces every hour of
  the window by the `roundHalfEvenDiv` mean of the peaked values over the window's whole hours (design §5.2.2). An area
  whose maximum is zero has no candidates.
- Candidates for area `a` (index `k` from 0): `gap_s = roundHalfEvenDiv(EXP_TABLE[u16(name, "gap", a, k)] × 3600,
  lambdaMax)`; `t_k = start_s + sum of gaps up to and including k`; stop when `t_k ≥ end_s`. Keep
  `thin = u32(name, "thin", a, k)` and `dest = u32(name, "dest", a, k)`.
- `acceptedRequests(world, scenario)` accepts candidate `k` when `thin × lambdaMax < lambda_a(hour(t_k)) × 2^32` (exact in
  doubles), picks the destination with `Math.floor(dest × W / 2^32)` over cumulative weights in area order for the
  candidate's destination period (section 6.2), and returns requests `{id: "r-<a>-<k>", time_s, origin, dest}` sorted by
  `(time_s, id)`.
- Factors: `trafficPpm(seed, segmentKey, dir, quarterHour)` = `MULT_TABLE_σ[u16(seed, "traffic", segmentKey, dir, qh)]`
  where `segmentKey` is the route id, `IN-<area>` or `ACC-<depot>`, `dir` is `"<from>><to>"`, `IN` or `OUT` (in-area uses
  `-`), and `qh = Math.floor(depart_s / 900)`. `ridePpm(seed, requestId)` = `MULT_TABLE_σ[u16(seed, "ride", id)]`.
- `warmTables(sigmaPermille)` builds and verifies both memoized tables for that sigma and returns `{sigma_permille}`.
- `realizedSeconds(planned_s, trafficPpm, ridePpm)` = `Number(roundHalfEvenDiv(BigInt(planned) × tf × rf, 10^12))`, with
  `ridePpm` 1,000,000 for a leg no rider causes.
- `worldDigest(world)` hashes canonical JSON of `{name, window, lambdaMax, candidates: per area [[t_k, thin, dest]],
  seed, sigma_permille, table_digests}` (design P18). Traffic and ride factors are fully determined by `seed`,
  `sigma_permille` and the pinned table digests, so they are covered without listing every value.

### 6.4 Engine (`policies.js`, `engine.js`)

`engine.js` exports `createRun(scenario, world, {seed, defect = null, keepLogs = true, fixture = null})`, where
`fixture` is the test hook documented at the top of `test/engine-fixtures.test.mjs` (injected cars, requests and depot
holds), returning a run object with
`step(maxEvents): boolean` (true when finished) and `result()`, plus `runToEnd(...)`. It is resumable so the runtime can
time-slice it.

States (design §5.3): `IDLE`, `ENROUTE_PICKUP`, `ON_TRIP`, `TO_DEPOT`, `INTAKE`, `GATE_WAIT`, `QUEUED_SERVICE`,
`IN_SERVICE` with task `CLEAN` or `SERVICE` and a `blocked` flag, `READY_AT_DEPOT`, `REPOSITIONING`. Every change goes
through one `transition(car, to, event, detail)` function that checks the design §5.3 table (invariant 9) and appends to
the interval log.

Vehicles: ids `<AREA>-<nnn>` numbered from 1 with three digits (`SF-001`), created in area order, then number. Each starts
`IDLE` at its home area centre at `window.start_s`. The home area is the starting area. Home depots are computed once when
the scenario loads: for each area, the set of depots minimizing planned seconds at free flow (every multiplier 1000) from
the area centre to the depot including `depot_access_s`; that area's cars, in ascending vehicle number with index `i` from
0, get the set's depots sorted by id at index `i % size`. The counter is per home area. Checks: defaults give SF-017 SF-1;
SF 30 and PEN 19 give SF-001 SF-1; SF 31 and PEN 18 give PEN-001 SF-1 and PEN-018 SF-2.

Heap: `[time_s, class, seq, kind, entity]` ordered by `time_s`, then `class`, then `seq`. Classes per design §5.4 item 3.
Every push increments `seq`. Every log entry gets `ord`. Handlers iterate entities in sorted-id order.

Rules the design fixes and this contract makes exact:
- Dispatch (POL-1): on `REQUEST_CREATED` and whenever a car becomes `IDLE` or `READY_AT_DEPOT`, serve waiting riders oldest
  first (`time_s`, then id). For each, candidate cars are `IDLE` and `READY_AT_DEPOT`, ranked by `planPath` arrival at the
  rider's area centre from the current second, then vehicle id; assign the best. Stop when no car or no rider remains.
- Legs: the pickup leg starts at the `REQUEST_ASSIGNED` second; the trip leg starts at the `PICKUP_COMPLETED` second; a
  depot leg starts when the car leaves; the release leg starts at `MORNING_RELEASE`. A leg's segments are realized in order
  when the leg starts: segment `i + 1` departs at the realized end of segment `i`; its planned seconds are
  `plannedLegSeconds` at that second, a route segment chooses its route at that second, and its traffic key uses
  `Math.floor(that second / 900)`. Non-fixed segments of the pickup and trip legs take `trafficPpm × ridePpm`; other legs
  take `trafficPpm` only. No leg is ever re-tasked and every input is exogenous, so computing the chain when the leg starts
  equals computing it segment by segment.
- A visit is due when `trips_since_visit ≥ trips_between_visits` after `TRIP_COMPLETED`. Visit number `n` counts visits
  started by the car from 1; the visit includes service when `service_every_visits > 0` and `n % service_every_visits === 0`.
  `trips_since_visit` resets to 0 when the visit completes (`READY_AT_DEPOT`).
- Depot assignment (POL-2), only among depots that can serve the visit (a service visit needs `service_bays > 0`):
  `home_depot` (falls back to `nearest_depot` when the home depot cannot serve it, logged); `nearest_depot` by `planPath`
  arrival, then depot id; `nearest_depot_with_capacity` the nearest whose `parking - stalls held - cars inbound ≥ 1` when
  the car leaves, falling back to `nearest_depot` when none qualifies (logged).
- Recall (POL-3, design D-12): when `RECALL_ORDERED` pops, every `IDLE` car leaves for a depot in sorted-id order and every
  `ENROUTE_PICKUP` or `ON_TRIP` car is marked. On `TRIP_COMPLETED` a marked car with no visit due goes `TO_DEPOT` with
  purpose `RECALL` when the second is before `release_s ?? window.end_s`, and otherwise goes `IDLE`; the mark clears there.
  A car dispatched after the recall is never marked.
- Release, gate, blocked cars, freed stalls, drain: design §5.3 and §5.7 exactly. When a bay frees, candidates in
  order: first a car blocked in a cleaning bay at that depot whose service is due (for a service bay), then queued cars in
  FIFO order of `INTAKE_COMPLETED` time, then vehicle id.
- Hand-off (design §5.3): when every stall of a depot is held, every bay for a task holds a car, one is blocked and a car
  is queued for that task, the queued car gives up its stall and starts the task while the blocked car takes the stall, at
  the same second (`STALL_CLAIMED`, then `SERVICE_STARTED`).
- Decision events carry their cause: `DEPOT_ASSIGNED` `{purpose, cause}` and `DEPOT_DIVERTED` `{to, cause}`, the cause
  suffixed `_service_bays_only` when skipping depots without a service bay changed the target.
- Event seconds are bounded by `MAX_EVENT_TIME_S` = 2^23 - 1, derived from the schema maxima (see `engine.js`).
- Segment bookkeeping: every realized segment records `{kind, key, dir, cls, t0, t1, loaded}` so metrics can clip and
  attribute seconds; the congested test uses the declared multiplier of the hour containing each realized second.
- Defects for tests (`defect` option): `double_assign`, `bay_overfill`, `lot_overfill`, `teleport`,
  `illegal_transition`. Each must be caught by its own named invariant (design §9.5).

`result()` returns `{scenario, window, scenario_digest, world_digest, seed, events, intervals, visits, requests, cars,
depots, drain_end_s, snapshots, invariant_violations, counters}`: `events` entries `{ord, t, kind, car?, req?, depot?,
detail?}`; `intervals` an object keyed by car id, each `[{state, t0, t1, location | segments, task?, blocked?,
request?}]`; `visits` `{car, depot, arrival_s, intake_end_s, first_task_s, clean_start_s, clean_end_s, service_start_s,
service_end_s, ready_s, censored}`; `depots` with their series and fixture `holds: [{resource, until_s}]`; `snapshots` the
fleet state every 300 simulated seconds from `window.start_s` to `drain_end_s` (per car: state, location or leg with
`done_permille`; per depot: stalls held, queue, bays busy by task, ready) for playback seeks. With `keepLogs` false the
events and snapshots are empty; intervals, visits, requests and depot series stay, because the metrics read them.

### 6.5 Metrics and invariants

`metrics.js`: `METRICS` registry (`playground-metrics 0.1`, design §5.7 every row: name, unit, direction, population,
absent_when, allowed scopes, fleetlab_status, descriptive flag); `validateMetricRef(ref)` (scope rules and rejected
scopes); `computeMetric(result, ref)` returning `{value}` or `{absent: reason}`; `computeAll(result, refs)`; and
`computeSeries(result, scenario)` returning the hourly values the design §7.5 charts need, keyed by chart id
(`fleet_state`, `wait_p90_by_hour`, `available_by_area`, `bay_wait_by_depot`, `turnaround_by_arrival_hour`,
`congested_empty_by_hour`, `demand_by_hour`, `traffic_by_hour`), each value a number or `{absent: reason}`. The default
measurement span is `[warmup_end_s, end_s)`; a scope window must lie inside it. Percentiles use `percentileFleetLab`.
Absence is never 0.

`invariants.js`: design §5.6 checks 1-3, 5, 8-12, Conservation and P13-P21, each returning strings `"<id>: detail"`. `checkRunSteps`, `runViolationsSteps`, `runDigestSteps` and
`checkReplaySteps` are generator variants for time-sliced callers that return exactly what their synchronous forms return. The
engine runs the per-change checks as it goes; `checkRun(result)` runs the rest. A violation voids the run.

### 6.6 Experiments (`experiment.js`)

The frozen spec is exactly this object and nothing else (design §6, Spec digest):

```js
{
  format: "fleetlab-playground-spec", format_version: 1,
  model_version: "playground-model 0.1", metrics_version: "playground-metrics 0.1",
  question: "…",
  scenario: { /* the full section 6.2 object after validateScenario */ },
  axis: { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" },
  primary: { metric: "wait.p90_s", scope: { area: "SF", window: { start_s: 111600, end_s: 118800 } },
             direction: "lower_is_better", margin_units: 60 },
  guardrails: [ { metric: "unserved.fraction", scope: {}, direction: "lower_is_better", max_harm_units: 10000 } ],
  seed_set: 1, seeds: [1001, 1002 /* … */], resamples: 2000
}
```

Axis values are a safe integer, a string, `null` (only for `parameter:POL-4` off) or a layout object. Scope keys a
reference does not use are omitted. `margin_units` and `max_harm_units` are safe integers in the metric's engine unit:
seconds for `_s` metrics, the count for counts, parts per million for fractions. Guardrails keep the user's order; seeds
ascend.

- `freezeSpec(draft)` validates (one axis, values in range and different except for the labelled null check of UC-01 (a draft whose checked scenario, axis,
  primary and guardrails canonically equal the UC-01 preset's; `isNullCheckDraft(draft)`),
  margin above 0, registered metrics with a direction, valid scopes, seeds 10-100, resamples 1,000-100,000) and returns
  `{spec, digest, label}`. A fraction typed in the draft is parsed from its decimal text into integer ppm without
  floating-point arithmetic (at most 6 decimal places; more is rejected).
- The instrument always receives thresholds as doubles computed once: `units / 1000000` for fractions (a single correctly
  rounded division, never `units * 1e-6`), and the integer itself for other units. `experiment.test.mjs` includes a
  guardrail at 15 ppm with harm exactly `15 / 1000000`, expected not regressed.
- `experimentSteps(spec)` is a generator yielding `{done, total, label}` and returning the run payload; `runExperimentSpec`
  drives it to the end. It yields its progress marker before and after every unit it cannot slice (the table builds
  for the spec's sigma, each world, `createRun`, `result()`, each whole-run check group, each metric computation) and
  inside the replay digests and the verdict bootstrap, so a main-thread host keeps steps within 8 ms once tables are warm. Order: build one world per seed from the declared scenario with the shared `lambdaMaxPermille`
  over both arms; the precheck runs the baseline arm on `seeds[0]`'s world twice and compares the metric maps; then seeds
  in spec order, baseline arm before candidate arm. It stops at the first run whose invariant check returns any
  violation, runs nothing later, and passes `` `seed ${seed}: ${violations[0]}` `` to `computeVerdict`. The key is the full
  digest.

## 7. Runtime (`src/runtime/`)

`worker.js` accepts:
- `{type: "run_window", id, scenario, seeds, logSeed, lambdaMaxPermille?}`;
- `{type: "run_pair", id, baseline, candidate, seed, lambdaMaxPermille}`, which builds one world with that envelope and
  runs both scenarios on it with logs (the fork, and opening a verdict seed with the frozen spec's shared envelope);
- `{type: "run_experiment", id, spec}`;
- `{type: "warm_tables", id, sigmaPermille}`, which builds the quantile tables before a run needs them (payload
  `{sigma_permille}`);
- `{type: "cancel", id}`.

It posts `{type: "ready"}` once after loading, then `{type: "progress", id, done, total, label}`,
`{type: "result", id, payload}` and `{type: "error", id, message}`. Payloads:
- `run_window`: `{runs: [{seed, world_digest, metrics, series, invariant_violations}], log: {seed, events, intervals,
  visits, requests, cars, depots, snapshots, drain_end_s}}`, with `log` only for `logSeed`;
- `run_pair`: `{world_digest, baseline: {metrics, series, log}, candidate: {metrics, series, log}}`;
- `run_experiment`: `{verdict, digest, label, lambdaMaxPermille, per_seed: [{seed, baseline_metrics, candidate_metrics}]}`.

`host.js` exports `createEngineHost({createWorker})`, returning `{path, ready, runWindow, runPair, runExperiment, warmTables, cancel}`, each
of the run functions returning a promise. It calls `createWorker()` and uses the worker when construction does not throw
and `ready` arrives within 1 s (design §9.4); otherwise it terminates any worker and drives the same generators on the main
thread in slices of at most 8 ms, measured with `performance.now()`. `path` is `"worker"` or `"main thread"`, and the store
records `engine: worker` or `engine: main thread` in each session log entry. `host.js` never touches `import.meta`; the page
passes the factory (section 9).

## 8. Interface (`src/ui/`)

- `store.js`: one immutable state object, `dispatch(action)`, `subscribe(fn)`, selectors. State keys: `mode`
  (`learn`, `sandbox`, `experiment`), `presetId`, `scenario`, `changes`, `run` (status, per-seed summaries, selected seed,
  log, progress), `clock_s`, `playing`, `speed`, `selection` (`{car}` or `{depot}` or null), `inspector`, `fork` (pair
  result and pinned car), `experiment` (draft, frozen spec, label, verdict, per-seed metrics, selected seed, session log),
  `reference` (the open reference panel), `learn` (case, moment), `reducedMotion` (system or override), `engine` (path).
  Every action is a pure reducer case, testable in Node without a page.
- `labels.js`: every interface string, including the exact copy of design §1.3, except preset copy: the titles and
  questions in `model/presets.js` and the casebook records in `model/ops-cases.js` (decision 41), which `check-dist`
  scans as copy. Only `instrument/summary.js` holds other text, for the export format (section 4).
- `app.js` exports `start({createWorker})` and builds the shell of design §7.2 with `dom.js` helpers; `map.js`,
  `playback.js`, `charts.js`, `inspector.js`, `controls.js`, `experiment.js`, `learn.js` and `a11y.js` each render one
  region from the store.
- Visual tokens and type: design §8 exactly, light and dark via `prefers-color-scheme` on `:root`, system font stacks.
- Accessibility and states: design §7.7. Layout: design §7.2 breakpoints, no horizontal page scroll at 400 px.

## 9. Tools

`pack.mjs` builds two bundles with one rewriter (modules in topological order, each wrapped in a function scope, `import`
and `export` rewritten to local bindings, no `eval`): the page bundle from `src/ui/app.js` and the worker bundle from
`src/runtime/worker.js`. The rewriter fails on any leftover `import`, `export` or `import.meta`. It writes one HTML file:
`index.html` with `<meta http-equiv="Content-Security-Policy" content="…">` holding the design §9.4 policy as the first
child of `<head>`, `styles.css` in one `<style>`, then one classic `<script>` that defines `FLEETLAB_WORKER_SOURCE` as a
string literal made with `JSON.stringify` and every `<` escaped as `\u003c` so the text `</script>` cannot occur, the page bundle, and
`start({createWorker: () => new Worker(URL.createObjectURL(new Blob([FLEETLAB_WORKER_SOURCE], {type: "text/javascript"})))})`.
The development shell `index.html` starts the app from an inline module script with
`createWorker: () => new Worker(new URL("./src/runtime/worker.js", import.meta.url), {type: "module"})`. The output path
must resolve outside the repository root (found by walking up to the directory that holds `.git`) or inside `<root>/dist/`;
anything else, including the repository's `artifacts/` and `experiments/`, exits with status 2 before writing.
`pack.mjs` may use `node:fs`, `node:path`, `node:url` and `node:vm` (to compile, never run, each bundle). Because the
rewriter is text-based, source modules follow two rules it enforces: every exported declaration ends with a semicolon,
and a mutable export (`export let` or `export var`) is read only through a namespace import (`import * as NS`), since
named imports become one-time copies in the packed file.

`check-dist.mjs` fails on any `http:` or `https:` URL, a missing or different policy, a forbidden token, a banned word in
copy, an em or en dash in copy, a `REQUIRED_LABELS` string (from a list the test passes in, never spelled in the tool),
or a size over 2 MB. The one allowed `http:` string is the SVG namespace `http://www.w3.org/2000/svg`, used only as a
`createElementNS` argument or an `xmlns` attribute.

`pack.mjs --site <folder>` writes a folder for a static host instead of one file: every module the page or the worker
reaches, unchanged, at its `src/` path; `styles.css`; `index.html` as the development shell with the site policy
`default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
connect-src 'none'; form-action 'none'; base-uri 'none'` first in `<head>`, the stylesheet link and one module script;
`boot.js`, the shell's inline script as a file, so the policy can refuse inline code; and `_headers`, the policy again
with `frame-ancestors 'none'` and a few response headers in the format static hosts read. Nothing else reaches the folder
(no tests, tools, fixtures or the legacy profile, which only tests import). The folder obeys the same place rule as the
packed file, and a folder that already holds an entry the site does not name (a stale module, a symbolic link) is refused
before anything is written, so a leftover can never ride along to a host. `check-dist.mjs --site <folder>` applies the
packed file's rules to every file, requires the site policy, exactly the files the packer writes, one stylesheet link and
one module script in `index.html`, and `boot.js` and `_headers` verbatim; it may read a folder (`readdirSync`) but never
writes.

## 10. Tests

`playground/fleetlab/test/`: `core.test.mjs`, `tables.test.mjs`, `instrument-parity.test.mjs`, `summary.test.mjs`,
`legacy-parity.test.mjs`, `routes.test.mjs`, `world.test.mjs`, `engine-fixtures.test.mjs`, `invariants.test.mjs`,
`metrics.test.mjs`, `determinism.test.mjs`, `pairing.test.mjs`, `properties.test.mjs`, `performance.test.mjs`, `presets.test.mjs` (verdicts pinned per preset and the default's calibration envelope),
`ops-cases.test.mjs` (the operations casebook: every spec verbatim and every verdict pinned to `ops-cases.pins.json`),
`experiment.test.mjs`, `captions.test.mjs`, `runtime.test.mjs`, `store.test.mjs`, `labels.test.mjs`, `a11y.test.mjs`,
`boundaries.test.mjs`, `pack.test.mjs`, `packed.test.mjs`, and interface test files named after their module. Fixture
paths resolve from `import.meta.url` to the repository's
`tests/fixtures/fleet_playground/`. Hand-derived expectations carry their arithmetic in comments, never copied from a run.
- `world.test.mjs` holds the demand gap and destination vectors of design §9.5, hand-derived, including an exact half
  and a product near 2^53.
- `performance.test.mjs`: deterministic proxies on the design §5.9 reference preset (events, heap pushes, dispatch scans
  within bounds declared in the test); wall-clock budgets run only when `FLEET_PLAYGROUND_PERF=1`.
- `determinism.test.mjs`: the same scenario and seed twice in one process give one event-log digest; `packed.test.mjs`
  extracts the engine from the packed file and requires the same digest.
- `runtime.test.mjs`: with injected fakes, the worker path and the main-thread path give identical payloads for one scenario
  and seed; the fallback triggers on a throwing factory and on no `ready` within 1 s.
- `a11y.test.mjs`: every text token of design §8.1 on every surface it may sit on, in both themes, at 4.5:1 or more, read
  from `styles.css`; accessible names from `labels.js` on every control; the focus order of design §7.7; the live-region
  throttle; the reduced-motion reducer.
- Boundary rules: R3 is `pack.test.mjs`; R4 is `boundaries.test.mjs` (import graph and tokens); R5 is `boundaries.test.mjs`
  plus the pytest text scan. The text scans in `boundaries.test.mjs` also refuse a home-directory, temp-dir or scratch
  path in any playground or fixture file, in the slash spelling and in the dash-encoded spelling a temp directory gives
  it, and this machine's own home directory in both.

Python: `test_fleet_playground_parity.py` (instrument vectors from phase 1, legacy worlds from phase 2, reference panels
from phase 5) and `test_fleet_playground_boundaries.py` (R1, R2, R5 text part, R6, R7, R8, R9). R6 compares against the base commit named by the environment variable `FLEET_PLAYGROUND_BASE`. The section 1
gate command sets it to the design's base `bca4ccd`, and a test requires every boundaries pytest command in section 1 to
set it, so R6 runs at every phase gate. Without the variable, or with an unreachable commit (a shallow clone), it skips
with that reason, so later work on `main` after the playground phases never breaks it.

## 11. Phase gates

Phases, gates, stop conditions and hard stops are design §10.2, unchanged. One staging rule is added: a test case arrives
in the phase that creates its fixture (instrument vectors in phase 1, legacy worlds in phase 2, reference panels and the
final sample summary in phase 5) and is absent, not skipped, before then.

## 12. Decisions this contract makes where the design is silent

1. Congestion for pairs without SF (section 6.2); the in-area row; axis part hours fixed at 7-8, 16-18 and 19.
2. Destination weights are in the design §2.9; area order SF, PEN, SJ, EB everywhere.
3. Vehicle ids and initial placement at home area centres.
4. Planned-time integration in micro-units with a floor per hour and one final half-even rounding.
5. A leg's segments realized in a chain from their own departure seconds; pull-out and intake unscaled; access and in-area
   segments take the traffic factor, and the ride factor when a rider caused the leg.
6. Visit number and service cadence; the trip counter resets at `READY_AT_DEPOT`.
7. Fallbacks for `home_depot` without a needed service bay and for `nearest_depot_with_capacity` with no qualifying depot.
8. Bay priority for blocked cars before queued cars.
9. The metric measurement span excludes the warm-up; scope windows must lie inside it.
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
14. Every legacy fixture is a map of named worlds; the precheck world uses FLEET-005's scenario with a declared horizon of
    1800 s and a 3600 s baseline, and the crash world a declared horizon of 3600 s under an 1800 s arm, both at seed 101.
15. Invalid verdict order and detail strings follow `run_experiment`; details are cut to 300 code points.
16. The frozen spec object of section 6.6, with thresholds in integer units and fractions converted once as `units / 1000000`.
17. Peak windows are exactly two, start inclusive and end exclusive, and set the destination periods.
18. The morning release off is `release_s: null`.
19. The RD-3 axis has an `in_area` class; `local` never changes the in-area row.
20. Home depots use a per-area counter over ascending vehicle numbers.
21. The runtime protocol and payloads of section 7, including `run_pair` for two arms on one world and snapshots every
    300 simulated seconds.
22. `pack.mjs` builds separate page and worker bundles, the page passes a worker factory, and output goes outside the
    repository or under `dist/`.
23. Reference panels are a regenerator fixture (section 5.2) mirrored by a literal `REFERENCE_PANELS` in `reference-panels.js`, re-exported by `presets.js`.
24. The result summary's clipboard labels live in `instrument/summary.js` as an export format.
25. `legacy_defect.json` is the one legacy fixture with invariant violations. Exact-half travel rounding is covered by a
    hand-derived node test, because no FleetLab-derived world contains an exact half.
26. `src/runtime/protocol.js` holds the message names and payload checks shared by the host and the worker, so runtime
    tests load without the model. The store may add private bookkeeping keys (for example the clock of the last freeze)
    beyond section 8 when a reducer needs them; section 8 lists the keys other modules may read.
27. Source modules end exported declarations with semicolons and read mutable exports through namespace imports
    (section 9), and `check-dist` allows only the SVG namespace string as an `http:` text.
28. `validateScenario` always returns `{ok, errors, warnings}`; nine knobs are refused as axes (section 6.2).
29. `createRun` takes the fixture hook; `result()` carries `scenario`, `window`, intervals keyed by car id, depot holds and
    snapshot leg fractions in per-mille (section 6.4).
30. The depot hand-off rule, decision-event causes and the event-time bound (section 6.4, design §5.3).
31. `REFERENCE_PANELS` lives in `src/model/reference-panels.js` and `presets.js` re-exports it.
32. The demand vectors sit in `world.test.mjs`; the packed-file determinism check is `packed.test.mjs`.
33. The recall acts once (design D-12); P20 guards the marked-trip rule.
34. The default fleet is 120 cars (SF 40, PEN 24, SJ 32, EB 24); `presets.test.mjs` pins the calibration envelope and its two
    accepted exceptions (design §2.2).
35. Before any run the NOW and across-replications panels show one state line and no rows; a range whose values all format
    alike reads "in every replication".
36. Open the fork closes the inspector, shows the charts group, focuses and scrolls to the fork heading, and announces it.
37. An idle step warms the quantile tables for the scenario's sigma before the first run (`warm_tables`).
38. The depot tile and the pinned car glyph open their inspectors on click or tap; the depot inspector lists its cars with
    Inspect and Pin.
39. A nonzero mean, delta or harm never reads as zero on the verdict card, in the verdict charts or in the copied summary:
    when the declared decimals leave no nonzero digit, the text is the exact double in plain decimals with its sign
    (`format.nonzero` for the card and charts, section 4 for the summary).
40. A hosted folder (`pack.mjs --site`) is a second delivery beside the packed file, with a stricter policy (no inline
    script, everything from the site's own origin) and a `_headers` file; putting it online stays an owner action
    (design §9.4). `check-dist.mjs` may list a folder, never write.
41. The operations casebook (design section 4.4) is twenty presets of kind `ops`, one record each in
    `src/model/ops-cases.js` (id, theme, slug, title, situation, proxy, watch, outsideModel, base, experiment), built by
    `opsPreset` in `presets.js` exactly as an Experiment preset is, with the record's copy attached. A record's slug is
    its scenario name, and the scenario name keys the demand trace (section 6.3), so slugs are frozen with their measured
    verdicts: `test/ops-cases.test.mjs` pins every spec verbatim, by its digest, and every seed set 1 verdict, mean
    delta, interval and guardrail harm exactly, as doubles, to `test/ops-cases.pins.json` (seed sets 2 and 3 under
    `FLEET_PLAYGROUND_PERF=1`). A pin holds the spec, the three measured blocks (each with the rounded numbers the design
    tables print and the exact doubles they round from) and the lesson text, nothing else; calibration notes never leave
    the port. Casebook copy never names a verdict or a direction, and never cites another case's result (design H-9):
    lessons are in the design document beside the pins. `check-dist` scans the string literals of `presets.js` and
    `ops-cases.js` as copy. The interface lists the casebook in the Experiment preset chooser as one group per theme and
    shows a Situation block above the setup blocks for an `ops` preset; once the draft no longer matches the case's spec
    (the question aside) the block keeps the lead and the situation and says so in place of the proxy and watch lines.
