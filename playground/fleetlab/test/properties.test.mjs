// Properties over 200 generated valid scenarios (design 9.5): conservation, the fleet-state partition, zero demand
// serves no one, and with σ 0 and no congestion every route choice follows free-flow time. Scenarios come from keyed
// draws (never Math.random), so the 200 cases are the same on every machine.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { u32 } from "../src/core/keyed.js";
import { runToEnd } from "../src/model/engine.js";
import { runViolations } from "../src/model/invariants.js";
import { computeMetric, computeSeries } from "../src/model/metrics.js";
import { defaultScenario, validateScenario } from "../src/model/schema.js";
import { buildWorld } from "../src/model/world.js";

const PERF = process.env.FLEET_PLAYGROUND_PERF === "1";
const CASES = 200;
const HOUR = 3600;

/** A keyed integer from lo to hi inclusive: floor(u32 × span / 2^32) stays below 2^53, so it is exact. */
const draw = (i, part, lo, hi) => lo + Math.floor((u32("fleetlab-playground-properties", i, part) * (hi - lo + 1)) / 4294967296);

/** Kind of case i: 0 and 3 general, 1 zero demand, 2 free flow at σ 0. */
const kindOf = (i) => ["general", "zero_demand", "free_flow", "general"][i % 4];

function generate(i) {
  const kind = kindOf(i);
  const s = defaultScenario();
  s.name = `prop_${i}`;
  const hours = draw(i, "hours", 4, 10);
  // Zero demand: peak windows at hours 0 and 1, off-peak 0, and a window inside hours 2 to 24 of day 1, so no hour of
  // the window has a rate above 0 in either shape.
  const startH = kind === "zero_demand" ? draw(i, "start", 2, 24 - hours) : draw(i, "start", 0, 20);
  const start = startH * HOUR;
  const end = start + hours * HOUR;
  s.window = { start_s: start, end_s: end };
  s.warmup_end_s = start + draw(i, "warmup", 0, HOUR);
  s.placement_snapshot_s = start + draw(i, "snapshot", 0, hours * HOUR);
  s.bucket_s = [900, 1800, 3600][draw(i, "bucket", 0, 2)];
  let cars = 0;
  for (const area of s.areas) {
    area.cars = draw(i, `cars.${area.id}`, 0, 10);
    cars += area.cars;
    area.in_area_s = draw(i, `in_area.${area.id}`, 120, 900);
    area.peak_per_h = draw(i, `peak.${area.id}`, 1, 30);
    area.offpeak_per_h = kind === "zero_demand" ? 0 : draw(i, `offpeak.${area.id}`, 0, area.peak_per_h);
  }
  if (cars === 0) s.areas[0].cars = 1;
  for (const route of s.routes) route.free_flow_s = draw(i, `route.${route.id}`, 300, 5400);
  if (kind === "zero_demand") {
    s.peaks = [{ start_h: 0, end_h: 1 }, { start_h: 1, end_h: 2 }];
  } else {
    const mStart = draw(i, "morning", 5, 9);
    const mEnd = mStart + draw(i, "morning.len", 1, 3);
    const eStart = draw(i, "evening", Math.max(mEnd, 12), 18);
    s.peaks = [{ start_h: mStart, end_h: mEnd }, { start_h: eStart, end_h: Math.min(24, eStart + draw(i, "evening.len", 1, 4)) }];
  }
  s.demand_shape = draw(i, "shape", 0, 1) === 0 ? "flat" : "peaked";
  if (kind === "free_flow") {
    for (const table of [s.congestion.HIGHWAY, s.congestion.LOCAL]) for (const key of Object.keys(table)) table[key].fill(1000);
    s.congestion.IN_AREA.fill(1000);
    s.sigma_permille = 0;
  } else {
    s.sigma_permille = 50 * draw(i, "sigma", 0, 10);
  }
  for (const depot of s.depots) {
    depot.parking = draw(i, `parking.${depot.id}`, 5, 40);
    depot.cleaning_bays = draw(i, `clean.${depot.id}`, 1, 4);
    depot.service_bays = draw(i, `service.${depot.id}`, 0, 2);
  }
  s.clean_s = draw(i, "clean_s", 300, 1800);
  s.service_s = draw(i, "service_s", 600, 3600);
  s.intake_s = draw(i, "intake_s", 60, 300);
  s.pull_out_s = draw(i, "pull_out_s", 60, 300);
  s.trips_between_visits = draw(i, "trips", 1, 8);
  s.service_every_visits = s.depots.every((d) => d.service_bays === 0) ? 0 : draw(i, "every", 0, 3);
  s.policies.depot_assignment = ["home_depot", "nearest_depot", "nearest_depot_with_capacity"][draw(i, "assignment", 0, 2)];
  s.policies.recall_s = start + draw(i, "recall", 0, hours * HOUR - 2);
  s.policies.release_s = draw(i, "release.on", 0, 2) === 0 ? null : s.policies.recall_s + draw(i, "release", 1, end - 1 - s.policies.recall_s);
  s.patience_s = draw(i, "patience", 60, 1800);
  return s;
}

describe(`properties over ${CASES} generated scenarios (design 9.5)`, () => {
  const t0 = performance.now();
  const cases = [];
  for (let i = 0; i < CASES; i += 1) {
    const scenario = generate(i);
    const check = validateScenario(scenario);
    assert.deepEqual(check.errors, [], `case ${i} is valid`);
    const seed = 5001 + i;
    const result = runToEnd(scenario, buildWorld(scenario, { seed }), { seed, keepLogs: i % 5 === 0 });
    cases.push({ i, kind: kindOf(i), scenario, result, series: i % 4 === 3 ? computeSeries(result) : null });
  }
  const elapsed = performance.now() - t0;

  test("every generated scenario runs with no invariant violation", () => {
    for (const { i, result } of cases) assert.deepEqual(runViolations(result), [], `case ${i}`);
  });

  test("conservation: every request ends COMPLETED or UNSERVED, and the two counts sum to the total", () => {
    for (const { i, scenario, result } of cases) {
      const served = result.requests.filter((r) => r.state === "COMPLETED").length;
      const unserved = result.requests.filter((r) => r.state === "UNSERVED").length;
      assert.equal(served + unserved, result.requests.length, `case ${i}`);
      for (const r of result.requests) {
        assert.ok(r.time_s >= scenario.window.start_s && r.time_s < scenario.window.end_s, `case ${i} ${r.id} created in the window`);
        if (r.state === "COMPLETED") assert.ok(r.time_s <= r.pickup_s && r.pickup_s <= r.dropoff_s, `case ${i} ${r.id} times ordered`);
      }
    }
  });

  test("fleet-state partition: each car's intervals tile the window, and the stack sums to the fleet", () => {
    for (const { i, scenario, result, series } of cases) {
      const { start_s, end_s } = scenario.window;
      const cars = scenario.areas.reduce((n, a) => n + a.cars, 0);
      assert.equal(Object.keys(result.intervals).length, cars, `case ${i} tracks every car`);
      let fleetSeconds = 0;
      for (const [car, list] of Object.entries(result.intervals)) {
        assert.equal(list[0].t0, start_s, `case ${i} ${car} starts at the window start`);
        for (let k = 1; k < list.length; k += 1) assert.equal(list[k].t0, list[k - 1].t1, `case ${i} ${car} interval ${k} is contiguous`);
        let clipped = 0;
        for (const iv of list) clipped += Math.max(0, Math.min(iv.t1, end_s) - Math.max(iv.t0, start_s));
        assert.equal(clipped, end_s - start_s, `case ${i} ${car} covers the window`);
        fleetSeconds += clipped;
      }
      assert.equal(fleetSeconds, cars * (end_s - start_s));
      if (series !== null) {
        const { starts_s, families } = series.fleet_state;
        starts_s.forEach((t, b) => {
          const width = Math.min(t + scenario.bucket_s, end_s) - t;
          const sum = Object.values(families).reduce((n, list) => n + list[b], 0);
          assert.equal(sum, cars * width, `case ${i} bucket ${b}`);
        });
      }
    }
  });

  test("no depot stays unchanged with every stall held and no ready car longer than the longest intake, clean or service", () => {
    // Without fixture holds such a state changes within that time: an intake or a task in progress ends, and otherwise
    // every stall holder is queued for a task whose bays are free (the freed-bay rule) or all hold blocked cars (the
    // hand-off). A lot that stays full of queued cars with a blocked car in their only bay is a lock-up.
    let fullLots = 0;
    for (const { i, scenario, result } of cases) {
      const bound = Math.max(scenario.intake_s, scenario.clean_s, scenario.service_s);
      for (const d of result.depots) {
        const rows = d.series;
        for (let a = 0; a < rows.length;) {
          let b = a + 1;
          while (b < rows.length && rows[b].every((v, k) => k === 0 || v === rows[a][k])) b += 1;
          if (rows[a][1] === d.parking && rows[a][7] === 0) {
            fullLots += 1;
            const span = (b < rows.length ? rows[b][0] : result.drain_end_s) - rows[a][0];
            assert.ok(span <= bound, `case ${i} ${d.id} unchanged for ${span} s from ${JSON.stringify(rows[a])}`);
          }
          a = b;
        }
      }
    }
    assert.ok(fullLots > 0, "some generated depot fills its lot with no ready car");
  });

  test("zero demand serves no one", () => {
    const zero = cases.filter((c) => c.kind === "zero_demand");
    assert.equal(zero.length, CASES / 4);
    for (const { i, result } of zero) {
      assert.deepEqual(result.requests, [], `case ${i}`);
      assert.deepEqual(computeMetric(result, { metric: "requests.served", scope: {} }), { value: 0 });
      assert.deepEqual(computeMetric(result, { metric: "unserved.fraction", scope: {} }), { value: 0 });
      assert.ok("absent" in computeMetric(result, { metric: "wait.p90_s", scope: {} }), `case ${i} wait is absent, never 0`);
      for (const list of Object.values(result.intervals)) {
        assert.ok(list.every((iv) => iv.state !== "ENROUTE_PICKUP" && iv.state !== "ON_TRIP"), `case ${i} no car serves a rider`);
      }
    }
  });

  test("with σ 0 and no congestion, highway or local follows free-flow time (a tie goes to the highway)", () => {
    const chosen = { HIGHWAY: 0, LOCAL: 0 };
    for (const { i, scenario, result } of cases.filter((c) => c.kind === "free_flow")) {
      const byPair = {};
      for (const r of scenario.routes) (byPair[[r.a, r.b].sort().join("|")] ??= []).push(r);
      const inArea = Object.fromEntries(scenario.areas.map((a) => [a.id, a.in_area_s]));
      for (const list of Object.values(result.intervals)) {
        for (const iv of list) {
          if (iv.censored) continue; // a leg censored at the drain end T_d has its last segment cut at T_d (design 5.7)
          for (const seg of iv.segments ?? []) {
            if (seg.kind === "ROUTE") {
              const [from, to] = seg.dir.split(">");
              const pair = byPair[[from, to].sort().join("|")];
              const hw = pair.find((r) => r.cls === "HIGHWAY");
              const lo = pair.find((r) => r.cls === "LOCAL");
              const want = lo.free_flow_s < hw.free_flow_s ? lo : hw;
              assert.equal(seg.key, want.id, `case ${i} ${seg.dir} at ${seg.t0}`);
              assert.equal(seg.t1 - seg.t0, want.free_flow_s, `case ${i} ${seg.key} takes its free-flow seconds`);
              chosen[want.cls] += 1;
            } else if (seg.kind === "IN_AREA") {
              assert.equal(seg.t1 - seg.t0, inArea[seg.key.slice(3)], `case ${i} ${seg.key}`);
            } else if (seg.kind === "ACCESS") {
              assert.equal(seg.t1 - seg.t0, scenario.depot_access_s, `case ${i} ${seg.key}`);
            }
          }
        }
      }
    }
    assert.ok(chosen.HIGHWAY > 0 && chosen.LOCAL > 0, `both classes are exercised: ${JSON.stringify(chosen)}`);
  });

  test(`the ${CASES} cases run under 10 s (checked with FLEET_PLAYGROUND_PERF=1)`, { skip: PERF ? false : "set FLEET_PLAYGROUND_PERF=1" }, () => {
    assert.ok(elapsed < 10000, `${Math.round(elapsed)} ms`);
  });
});
