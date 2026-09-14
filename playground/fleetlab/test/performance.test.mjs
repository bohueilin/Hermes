// Performance (contract 10, design 5.9 and 9.5). Deterministic proxies on the reference preset always run: work
// counters within bounds declared here with their arithmetic. Wall-clock budgets run only with FLEET_PLAYGROUND_PERF=1.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bootstrapCi } from "../src/instrument/bootstrap.js";
import { runToEnd } from "../src/model/engine.js";
import { freezeSpec, runExperimentSpec } from "../src/model/experiment.js";
import { computeAll, computeSeries } from "../src/model/metrics.js";
import { seedSet } from "../src/model/presets.js";
import { applyAxis, defaultScenario } from "../src/model/schema.js";
import { buildWorld } from "../src/model/world.js";

const PERF = process.env.FLEET_PLAYGROUND_PERF === "1";

/** The design 5.9 reference preset: the Bay teaching map with 150 cars (SF 50, PEN 30, SJ 40, EB 30). */
function reference(sigma) {
  let s = defaultScenario();
  for (const [area, n] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
  s.sigma_permille = sigma;
  return s;
}

describe("deterministic work proxies on the reference preset (design 5.9)", () => {
  for (const sigma of [0, 150]) {
    test(`σ ${sigma / 1000}, seed 1001`, () => {
      const scenario = reference(sigma);
      const r = runToEnd(scenario, buildWorld(scenario, { seed: 1001 }), { seed: 1001, keepLogs: false });
      const c = r.counters;
      const R = r.requests.length;
      const V = r.visits.length;
      const C = r.cars.length;
      const D = r.depots.reduce((n, d) => n + d.diversions_s.length, 0);
      const assigned = r.requests.filter((q) => q.assigned_s !== null).length;

      // Requests: the window runs D1 05:00 to D2 10:00, 29 hours, of which 7 are peak (D1 7, 8, 16, 17, 18 and D2 7, 8).
      // Mean count: SF 7×60 + 22×15 = 750; PEN 7×20 + 22×8 = 316; SJ 7×35 + 22×10 = 465; EB 7×30 + 22×8 = 386; total 1,917.
      // A Poisson count this large has a standard deviation near sqrt(1917) ≈ 44; the bound allows about ±5 of them.
      assert.ok(R >= 1700 && R <= 2150, `requests ${R}`);

      // Heap pushes, by push site: each request pushes REQUEST_CREATED and WAIT_DEADLINE (2R), at most one
      // PICKUP_COMPLETED and one TRIP_COMPLETED (2R); each visit at most one INTAKE_COMPLETED and two SERVICE_COMPLETED
      // (3V); each depot leg one DEPOT_ARRIVED, at most V + C legs (a leg without a visit record is censored, one per
      // car at most), plus one per diversion (D); each car at most one REPOSITION_COMPLETED (C); and the recall, the
      // release and WINDOW_END (3). So pushes ≤ 4R + 4V + D + 2C + 3.
      assert.ok(c.heap_pushes <= 4 * R + 4 * V + D + 2 * C + 3, `pushes ${c.heap_pushes}, bound ${4 * R + 4 * V + D + 2 * C + 3}`);
      assert.ok(c.heap_pops <= c.heap_pushes, `pops ${c.heap_pops}`);
      // Every request pushes at least its creation and its deadline, and the three clock events exist.
      assert.ok(c.heap_pushes >= 2 * R + 3);

      // Dispatch scans only locations holding a dispatchable car: 4 area centres plus 4 depots, so at most 8 per
      // assignment (design 5.9), never one per car.
      assert.ok(c.dispatch_location_scans <= 8 * assigned, `scans ${c.dispatch_location_scans} for ${assigned} assignments`);
      assert.ok(c.dispatch_location_scans < C * assigned / 10, "far fewer than scanning every car");

      // A leg holds at most 4 segments (pull-out, access out, route or in-area, access in).
      assert.ok(c.segments <= 4 * c.legs, `segments ${c.segments} on ${c.legs} legs`);
      // Log entries: every pop logs at most one entry, and decisions add at most one assignment per request, one
      // diversion each, and per visit a stall claim and two task starts, plus the censoring entries (at most 2 per car).
      assert.ok(c.log_entries <= c.heap_pops + R + D + 3 * V + 2 * C, `log entries ${c.log_entries}`);
    });
  }
});

describe("wall-clock budgets of design 5.9 (FLEET_PLAYGROUND_PERF=1)", { skip: PERF ? false : "set FLEET_PLAYGROUND_PERF=1" }, () => {
  test("one Sandbox run of the reference preset, world to charts, at most 500 ms", () => {
    const scenario = reference(150);
    const t0 = performance.now();
    const r = runToEnd(scenario, buildWorld(scenario, { seed: 1002 }), { seed: 1002, keepLogs: true });
    computeAll(r);
    computeSeries(r, scenario);
    const ms = performance.now() - t0;
    assert.ok(ms <= 500, `${ms.toFixed(1)} ms`);
  });

  test("an experiment of 20 seeds × 2 arms on the reference preset, at most 10 s", () => {
    const base = reference(150);
    base.name = "reference_150";
    const { spec } = freezeSpec({
      question: "Does a 15 minute clean instead of a 20 minute clean change rider wait p90?",
      scenario: base,
      axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 900 },
      primary: { metric: "wait.p90_s", scope: {}, direction: "lower_is_better", margin_units: 30 },
      guardrails: [{ metric: "unserved.fraction", scope: {}, direction: "lower_is_better", max_harm_units: 20000 }],
      seed_set: 1,
      seeds: seedSet(1, 20),
      resamples: 2000,
    });
    const t0 = performance.now();
    const out = runExperimentSpec(spec);
    const ms = performance.now() - t0;
    assert.equal(out.per_seed.length, 20);
    assert.ok(ms <= 10000, `${ms.toFixed(0)} ms`);
  });

  test("a bootstrap of 2,000 resamples over 20 deltas, at most 100 ms", () => {
    const deltas = Array.from({ length: 20 }, (_, i) => (i * 37) % 11 - 5 + i / 8);
    const t0 = performance.now();
    bootstrapCi(deltas, 2000, "ab".repeat(32));
    const ms = performance.now() - t0;
    assert.ok(ms <= 100, `${ms.toFixed(1)} ms`);
  });
});
