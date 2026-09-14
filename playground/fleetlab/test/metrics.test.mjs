// Metrics of the teaching model (contract 6.5; design 5.7, 7.5, 9.5): the registry, scope rules and rejection
// messages, every metric on small hand-derived runs, absence reasons, clipping to the window, warm-up exclusion,
// censored turnaround and the completed-only descriptive, the placement gap, the P21 partition, the P15 fleet-state
// partition and computeSeries shapes for every chart id.
//
// Every expected number is derived by hand in the comments, never copied from a run. Sigma is 0 in every fixture, so
// realized = planned. Clock seconds: D1 05:00 = 18,000 (window start); D1 06:00 = 21,600 (warm-up end);
// D1 10:00 = 36,000; D1 17:00 = 61,200; D2 00:00 = 86,400; D2 00:30 = 88,200 (recall); D2 05:45 = 107,100 (release);
// D2 06:00 = 108,000 (placement snapshot); D2 10:00 = 122,400 (window end). The default span is [21,600, 122,400),
// 100,800 s. Hours 5, 9 to 15 and 24 to 30 carry multiplier 1000 in every row. Default times: pull-out 120, access 300,
// intake 180, clean 1200, service 2700, patience 600; in-area SF 360, PEN 480, EB 420; H1 1500.
// Percentiles: FleetLab interpolation at (n - 1) x q, confirmed in doubles where a product is not exact.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createRun, runToEnd } from "../src/model/engine.js";
import {
  ABSENT, computeAll, computeMetric, computeSeries, defaultRefs, METRICS, METRICS_VERSION, metricKey, SERIES_IDS,
  STATE_FAMILIES, validateMetricRef, visitsUnfinished,
} from "../src/model/metrics.js";
import { applyAxis, defaultScenario, validateScenario } from "../src/model/schema.js";
import { buildWorld } from "../src/model/world.js";

const FAR = 200000;

function runFixture(scenario, fixture, seed = 1001) {
  const verdict = validateScenario(scenario);
  assert.deepEqual({ ok: verdict.ok, errors: verdict.errors }, { ok: true, errors: [] });
  const run = createRun(scenario, buildWorld(scenario, { seed }), { seed, fixture });
  while (!run.step(100000));
  const result = run.result();
  assert.deepEqual(result.invariant_violations, []);
  return result;
}

const car = (id, home_area, home_depot, location, extra = {}) => ({
  id, home_area, home_depot, state: "IDLE", location, trips_since_visit: 0, visits: 0, ...extra,
});
const readyCar = (id, home_area, home_depot, depot) => car(id, home_area, home_depot, { depot }, { state: "READY_AT_DEPOT" });
const holds = (n, until_s) => Array.from({ length: n }, () => until_s);
const m = (result, metric, scope = {}) => computeMetric(result, { metric, scope });

// ---------------------------------------------------------------------------------------------------------------
// Fixture A: requests, waits, vehicle time, a service visit, the release and the placement gap
// ---------------------------------------------------------------------------------------------------------------
//
// Cars: PEN-001 (home PEN, home depot SF-1, visits 2, so its next visit is number 3 and includes service) IDLE at PEN;
// SF-001 (home SF, home depot SF-1) IDLE at SF.
// Requests (all in-area, hours 5 and 10 at 1000):
//   r-SF-9 at 19,000 (warm-up): SF-001 (360 against PEN-001's H1 1500); pickup 19,360 (wait 360); trip to 19,720.
//   r-SF-0 at 36,000: SF-001; pickup 36,360 (wait 360); trip to 36,720.
//   r-PEN-0 at 36,100: PEN-001 (SF-001 is busy); pickup 36,580 (wait 480); trip to 37,060.
//   r-SF-1 at 36,200: no free car; waiting, deadline 36,800.
//   r-SF-2 at 36,300: no free car; waiting, deadline 36,900.
//   36,720 SF-001 frees and takes the oldest rider r-SF-1: pickup 37,080 (wait 880); trip to 37,440.
//   36,900 r-SF-2 is still waiting: UNSERVED. Every request is terminal by 37,440, so T_d = 122,400.
// Trips: SF-001 3, PEN-001 1, so no visit is due before the recall.
// 88,200 recall (IDLE cars in id order):
//   PEN-001: H1 PEN>SF 88,200 to 89,700; ACCESS IN SF-1 to 90,000. INTAKE to 90,180; CLEAN 90,180 to 91,380; a
//     service bay is free: SERVICE 91,380 to 94,080; READY 94,080.
//   SF-001: ACCESS IN SF-1 88,200 to 88,500. INTAKE to 88,680; CLEAN 88,680 to 89,880; READY 89,880 to 122,400.
// 107,100 release: PEN-001 is ready outside PEN: PULL_OUT 120, ACCESS OUT 300, H1 SF>PEN 1500: 107,100 to 109,020; IDLE
//   at PEN to 122,400. SF-001 is home: no move.
//
// Request metrics over the default span (r-SF-9 is excluded by the warm-up):
//   all: total 4, served 3, unserved 1, fraction 1 / 4; waits [360, 480, 880]:
//     p50 position 1: 480; p90 position 1.8: 480 + 400 x 0.8 = 800; population 3.
//   SF: total 3, served 2, unserved 1, fraction 1 / 3; waits [360, 880]: p50 360 + 520 x 0.5 = 620;
//     p90 360 + 520 x 0.9 = 828; population 2.
//   PEN: total 1, served 1, unserved 0, fraction 0; p50 and p90 480; population 1.
//   SJ, EB: total 0, fraction 0, waits absent, population 0.
//   window [36,000, 36,200): r-SF-0 and r-PEN-0: waits [360, 480]: p90 360 + 120 x 0.9 = 468.
// Driving seconds in the span: empty pickups 360 + 480 + 360 = 1200; depot legs 300 (SF-001) + 1800 (PEN-001);
//   release 120 + 300 + 1500 = 1920; empty 1200 + 300 + 1800 + 1920 = 5220. Loaded trips 360 + 480 + 360 = 1200.
//   vehicle.empty_drive_fraction = 5220 / 6420.
//   window [36,000, 36,500): SF pickup 36,000 to 36,360 empty 360; SF trip 36,360 to 36,500 loaded 140; PEN pickup
//   36,100 to 36,500 empty 400: 760 / 900.
// Available seconds in the span (IDLE by area, READY by the depot's area):
//   SF-001: IDLE SF [21,600, 36,000) 14,400 and [37,440, 88,200) 50,760; READY SF-1 [89,880, 122,400) 32,520.
//   PEN-001: IDLE PEN [21,600, 36,100) 14,500, [37,060, 88,200) 51,140, [109,020, 122,400) 13,380;
//     READY SF-1 [94,080, 107,100) 13,020.
//   SF 14,400 + 50,760 + 32,520 + 13,020 = 110,700; PEN 14,500 + 51,140 + 13,380 = 79,020; all 189,720.
//   Denominator 2 cars x 100,800 = 201,600. Window [36,000, 36,720): PEN-001 IDLE 100 s over 2 x 720 = 1440.
// Visits at SF-1: SF-001 arrival 88,500, intake end 88,680, first task 88,680 (bay wait 0), ready 89,880
//   (turnaround 1380); PEN-001 arrival 90,000, intake end 90,180, first task 90,180 (bay wait 0), ready 94,080 (4080).
//   turnaround p50 1380 + 2700 x 0.5 = 2730; p90 1380 + 2700 x 0.9 = 3810. Window [89,000, 122,400): 4080 only.
// SF-1 stalls held at the end of each second: 88,500 1; 88,680 0; 89,880 1; 90,000 2; 90,180 1; 94,080 2; 107,100 1.
//   Peak 2 of 60 in the span; in [108,000, 122,400) the row of 107,100 holds: 1 of 60.
// Placement at 108,000: SF-001 ready at SF-1 (SF), PEN-001 on its release leg to PEN (PEN); at the start SF-001 in SF
//   and PEN-001 in PEN: gap 0. With the release off, PEN-001 is still ready at SF-1: SF 2 against 1, PEN 0 against 1:
//   (1 + 1) / 2 = 1.

const FIXTURE_A = {
  cars: [car("PEN-001", "PEN", "SF-1", { area: "PEN" }, { visits: 2 }), car("SF-001", "SF", "SF-1", { area: "SF" })],
  requests: [
    { id: "r-SF-9", time_s: 19000, origin: "SF", dest: "SF" },
    { id: "r-SF-0", time_s: 36000, origin: "SF", dest: "SF" },
    { id: "r-PEN-0", time_s: 36100, origin: "PEN", dest: "PEN" },
    { id: "r-SF-1", time_s: 36200, origin: "SF", dest: "SF" },
    { id: "r-SF-2", time_s: 36300, origin: "SF", dest: "SF" },
  ],
  depotOccupancy: {},
};

describe("registry (design 5.7)", () => {
  test("every row, in order, with its version", () => {
    assert.equal(METRICS_VERSION, "playground-metrics 0.1");
    assert.deepEqual(METRICS.map((r) => r.name), [
      "requests.total", "requests.served", "requests.unserved", "unserved.fraction", "wait.p50_s", "wait.p90_s",
      "wait.population_n", "vehicle.empty_drive_fraction", "exposure.congested_empty_s", "exposure.congested_loaded_s",
      "fleet.available_fraction", "depot.bay_wait_p90_s", "depot.turnaround_p50_s", "depot.turnaround_p90_s",
      "depot.turnaround_completed_p90_s", "depot.censored_visits", "depot.parking_peak_fraction", "depot.diversions",
      "depot.blocked_s", "fleet.placement_gap",
    ]);
  });

  test("directions, statuses, scopes and flags", () => {
    const by = Object.fromEntries(METRICS.map((r) => [r.name, r]));
    assert.deepEqual(METRICS.filter((r) => r.direction === null).map((r) => r.name), ["requests.total", "wait.population_n", "depot.turnaround_completed_p90_s"]);
    assert.deepEqual(METRICS.filter((r) => r.direction === "higher_is_better").map((r) => r.name), ["requests.served", "fleet.available_fraction"]);
    assert.deepEqual(METRICS.filter((r) => r.fleetlab_status === "identical").map((r) => r.name),
      ["requests.total", "requests.served", "requests.unserved", "unserved.fraction", "wait.p50_s", "wait.p90_s"]);
    assert.ok(METRICS.every((r) => ["identical", "playground_only"].includes(r.fleetlab_status)));
    assert.deepEqual(METRICS.filter((r) => r.descriptive_only).map((r) => r.name), ["depot.turnaround_completed_p90_s"]);
    assert.deepEqual(by["vehicle.empty_drive_fraction"].scopes, ["window"]);
    assert.deepEqual(by["fleet.placement_gap"].scopes, []);
    assert.deepEqual(by["depot.parking_peak_fraction"].requires, ["depot"]);
    assert.deepEqual(by["exposure.congested_empty_s"].scopes, ["area", "window"]);
    assert.deepEqual(by["depot.blocked_s"].scopes, ["depot", "window"]);
    assert.deepEqual(METRICS.filter((r) => r.partition).map((r) => r.name), [
      "requests.total", "requests.served", "requests.unserved", "wait.population_n", "exposure.congested_empty_s",
      "exposure.congested_loaded_s", "depot.censored_visits", "depot.diversions", "depot.blocked_s",
    ]);
    const units = Object.fromEntries(METRICS.map((r) => [r.name, r.engine_unit]));
    assert.equal(units["unserved.fraction"], "ppm");
    assert.equal(units["wait.p90_s"], "s");
    assert.equal(units["depot.diversions"], "count");
    assert.equal(by["depot.turnaround_p90_s"].absent_when.includes("censored"), true);
    assert.equal(by["wait.p90_s"].absent_when, ABSENT.noCompletedRequest);
  });

  test("absence reason text", () => {
    assert.equal(visitsUnfinished(1), "1 visit unfinished at drain end");
    assert.equal(visitsUnfinished(2), "2 visits unfinished at drain end");
    assert.equal(ABSENT.noVisitStarted, "no visit started a task");
  });
});

describe("scope rules and rejection messages (design 5.7)", () => {
  const scenario = defaultScenario();
  const reject = (ref, message, withScenario = scenario) => {
    const verdict = validateMetricRef(ref, withScenario);
    assert.equal(verdict.ok, false, JSON.stringify(ref));
    assert.deepEqual(verdict.errors, [message]);
  };

  test("keys a metric does not accept", () => {
    reject({ metric: "vehicle.empty_drive_fraction", scope: { area: "SF" } }, "invalid scope: vehicle.empty_drive_fraction does not accept area");
    reject({ metric: "fleet.placement_gap", scope: { window: { start_s: 36000, end_s: 39600 } } }, "invalid scope: fleet.placement_gap does not accept window");
    reject({ metric: "wait.p90_s", scope: { depot: "SF-1" } }, "invalid scope: wait.p90_s does not accept depot");
    reject({ metric: "depot.blocked_s", scope: { area: "SF" } }, "invalid scope: depot.blocked_s does not accept area");
    reject({ metric: "fleet.available_fraction", scope: { depot: "SF-1" } }, "invalid scope: fleet.available_fraction does not accept depot");
    reject({ metric: "requests.total", scope: { hour: 7 } }, "invalid scope: requests.total does not accept hour");
  });

  test("a required depot, unknown names, and windows outside the measurement span", () => {
    reject({ metric: "depot.parking_peak_fraction", scope: {} }, "invalid scope: depot.parking_peak_fraction requires depot");
    reject({ metric: "depot.parking_peak_fraction", scope: { window: { start_s: 36000, end_s: 39600 } } }, "invalid scope: depot.parking_peak_fraction requires depot");
    reject({ metric: "wait.p99_s", scope: {} }, "unknown metric: wait.p99_s");
    reject({ metric: "wait.p90_s", scope: { area: "XX" } }, "invalid scope: wait.p90_s area XX is not an area of this map");
    reject({ metric: "depot.diversions", scope: { depot: "SF-9" } }, "invalid scope: depot.diversions depot SF-9 is not a depot of this map");
    // The warm-up [18,000, 21,600) is outside the span; so is anything after the window end 122,400.
    reject({ metric: "wait.p90_s", scope: { window: { start_s: 18000, end_s: 25200 } } },
      "invalid scope: wait.p90_s window must lie inside the measurement span from 21600 to 122400");
    reject({ metric: "wait.p90_s", scope: { window: { start_s: 118800, end_s: 126000 } } },
      "invalid scope: wait.p90_s window must lie inside the measurement span from 21600 to 122400");
    reject({ metric: "wait.p90_s", scope: { window: { start_s: 39600, end_s: 39600 } } },
      "invalid scope: wait.p90_s window must be {start_s, end_s} in whole seconds with start before end");
    reject({ metric: "wait.p90_s", scope: { window: { start_s: 39600.5, end_s: 43200 } } },
      "invalid scope: wait.p90_s window must be {start_s, end_s} in whole seconds with start before end");
  });

  test("accepted references, with and without a scenario", () => {
    const ok = (ref, s = scenario) => assert.deepEqual(validateMetricRef(ref, s), { ok: true, errors: [] });
    ok({ metric: "wait.p90_s", scope: { area: "SF", window: { start_s: 111600, end_s: 118800 } } });
    ok({ metric: "depot.parking_peak_fraction", scope: { depot: "SJ-1" } });
    ok({ metric: "fleet.placement_gap", scope: {} });
    ok({ metric: "unserved.fraction" });
    // The span edges are inclusive of the warm-up end and the window end.
    ok({ metric: "requests.total", scope: { window: { start_s: 21600, end_s: 122400 } } });
    // Without a scenario only the shape is checked, so a warm-up window passes here and fails when computed.
    ok({ metric: "wait.p90_s", scope: { window: { start_s: 18000, end_s: 21600 } } }, null);
  });

  test("computeMetric throws the first rejection", () => {
    const result = runFixture(defaultScenario(), FIXTURE_A);
    assert.throws(() => m(result, "vehicle.empty_drive_fraction", { area: "SF" }), { name: "RangeError", message: "invalid scope: vehicle.empty_drive_fraction does not accept area" });
    assert.throws(() => m(result, "wait.p90_s", { window: { start_s: 18000, end_s: 21600 } }), RangeError);
  });

  test("metric keys", () => {
    assert.equal(metricKey({ metric: "wait.p90_s", scope: {} }), "wait.p90_s");
    assert.equal(metricKey({ metric: "wait.p90_s", scope: { window: { start_s: 111600, end_s: 118800 }, area: "SF" } }), "wait.p90_s{area=SF,window=111600-118800}");
    assert.equal(metricKey({ metric: "depot.parking_peak_fraction", scope: { depot: "SJ-1" } }), "depot.parking_peak_fraction{depot=SJ-1}");
  });
});

describe("fixture A: request, vehicle-time and depot metrics", () => {
  const scenario = defaultScenario();
  const result = runFixture(scenario, FIXTURE_A);

  test("the run matches the derivation", () => {
    const rec = (id) => {
      const r = result.requests.find((q) => q.id === id);
      return [r.state, r.pickup_s, r.dropoff_s];
    };
    assert.deepEqual(rec("r-SF-9"), ["COMPLETED", 19360, 19720]);
    assert.deepEqual(rec("r-SF-0"), ["COMPLETED", 36360, 36720]);
    assert.deepEqual(rec("r-PEN-0"), ["COMPLETED", 36580, 37060]);
    assert.deepEqual(rec("r-SF-1"), ["COMPLETED", 37080, 37440]);
    assert.deepEqual(rec("r-SF-2"), ["UNSERVED", null, null]);
    const pick = (v) => [v.car, v.depot, v.arrival_s, v.intake_end_s, v.first_task_s, v.service_start_s, v.ready_s, v.censored];
    assert.deepEqual(result.visits.map(pick).sort(), [
      ["PEN-001", "SF-1", 90000, 90180, 90180, 91380, 94080, false],
      ["SF-001", "SF-1", 88500, 88680, 88680, null, 89880, false],
    ]);
    assert.equal(result.drain_end_s, 122400);
  });

  test("request counts and the unserved fraction, by area; the warm-up request is excluded", () => {
    assert.deepEqual([m(result, "requests.total"), m(result, "requests.served"), m(result, "requests.unserved")], [{ value: 4 }, { value: 3 }, { value: 1 }]);
    assert.deepEqual(m(result, "unserved.fraction"), { value: 1 / 4 });
    assert.deepEqual(m(result, "unserved.fraction", { area: "SF" }), { value: 1 / 3 });
    assert.deepEqual(m(result, "unserved.fraction", { area: "PEN" }), { value: 0 });
    assert.deepEqual(m(result, "requests.total", { area: "SJ" }), { value: 0 });
    // No request in scope: counts read 0 and the fraction reads 0.0, never absent.
    assert.deepEqual(m(result, "unserved.fraction", { area: "SJ" }), { value: 0 });
  });

  test("wait percentiles and their population", () => {
    assert.deepEqual(m(result, "wait.p50_s"), { value: 480 });
    assert.deepEqual(m(result, "wait.p90_s"), { value: 800 });
    assert.deepEqual(m(result, "wait.population_n"), { value: 3 });
    assert.deepEqual(m(result, "wait.p50_s", { area: "SF" }), { value: 620 });
    assert.deepEqual(m(result, "wait.p90_s", { area: "SF" }), { value: 828 });
    assert.deepEqual(m(result, "wait.population_n", { area: "SF" }), { value: 2 });
    assert.deepEqual(m(result, "wait.p90_s", { area: "PEN" }), { value: 480 });
    assert.deepEqual(m(result, "wait.p90_s", { window: { start_s: 36000, end_s: 36200 } }), { value: 468 });
    assert.deepEqual(m(result, "wait.p90_s", { area: "SJ" }), { absent: "no completed request in scope" });
    assert.deepEqual(m(result, "wait.population_n", { area: "SJ" }), { value: 0 });
  });

  test("empty-drive fraction, clipped to the span and to a window", () => {
    assert.deepEqual(m(result, "vehicle.empty_drive_fraction"), { value: 5220 / 6420 });
    assert.deepEqual(m(result, "vehicle.empty_drive_fraction", { window: { start_s: 36000, end_s: 36500 } }), { value: 760 / 900 });
    // [40,000, 80,000): both cars stand idle, so no driving seconds.
    assert.deepEqual(m(result, "vehicle.empty_drive_fraction", { window: { start_s: 40000, end_s: 80000 } }), { absent: "no driving seconds in scope" });
  });

  test("available fraction by area, clipped to a window", () => {
    assert.deepEqual(m(result, "fleet.available_fraction"), { value: 189720 / 201600 });
    assert.deepEqual(m(result, "fleet.available_fraction", { area: "SF" }), { value: 110700 / 201600 });
    assert.deepEqual(m(result, "fleet.available_fraction", { area: "PEN" }), { value: 79020 / 201600 });
    assert.deepEqual(m(result, "fleet.available_fraction", { area: "SJ" }), { value: 0 });
    assert.deepEqual(m(result, "fleet.available_fraction", { window: { start_s: 36000, end_s: 36720 } }), { value: 100 / 1440 });
  });

  test("congested exposure reads 0 where every multiplier is 1000", () => {
    assert.deepEqual(m(result, "exposure.congested_empty_s"), { value: 0 });
    assert.deepEqual(m(result, "exposure.congested_loaded_s", { area: "SF" }), { value: 0 });
  });

  test("depot metrics at SF-1 and an empty depot", () => {
    const at = (metric, scope = {}) => m(result, metric, { depot: "SF-1", ...scope });
    assert.deepEqual(at("depot.bay_wait_p90_s"), { value: 0 });
    assert.deepEqual(at("depot.turnaround_p50_s"), { value: 2730 });
    assert.deepEqual(at("depot.turnaround_p90_s"), { value: 3810 });
    assert.deepEqual(at("depot.turnaround_completed_p90_s"), { value: 3810 });
    assert.deepEqual(at("depot.turnaround_p90_s", { window: { start_s: 89000, end_s: 122400 } }), { value: 4080 });
    assert.deepEqual(at("depot.censored_visits"), { value: 0 });
    assert.deepEqual(at("depot.diversions"), { value: 0 });
    assert.deepEqual(at("depot.blocked_s"), { value: 0 });
    assert.deepEqual(at("depot.parking_peak_fraction"), { value: 2 / 60 });
    assert.deepEqual(at("depot.parking_peak_fraction", { window: { start_s: 108000, end_s: 122400 } }), { value: 1 / 60 });
    const empty = (metric) => m(result, metric, { depot: "SF-2" });
    assert.deepEqual(empty("depot.bay_wait_p90_s"), { absent: "no visit started a task" });
    assert.deepEqual(empty("depot.turnaround_p90_s"), { absent: "no visit in scope" });
    assert.deepEqual(empty("depot.turnaround_completed_p90_s"), { absent: "no completed visit in scope" });
    assert.deepEqual([empty("depot.censored_visits"), empty("depot.parking_peak_fraction")], [{ value: 0 }, { value: 0 }]);
    // Unscoped percentiles pool every visit.
    assert.deepEqual(m(result, "depot.turnaround_p90_s"), { value: 3810 });
  });

  test("placement gap with the release on and off", () => {
    assert.deepEqual(m(result, "fleet.placement_gap"), { value: 0 });
    const off = runFixture(applyAxis(defaultScenario(), "parameter:POL-4", "off"), FIXTURE_A);
    assert.deepEqual(m(off, "fleet.placement_gap"), { value: 1 });
  });

  test("computeAll: default references and keys, and explicit references", () => {
    const all = computeAll(result);
    const refs = defaultRefs(scenario);
    assert.deepEqual(Object.keys(all), refs.map(metricKey));
    assert.ok(Object.keys(all).includes("depot.parking_peak_fraction{depot=SF-1}"));
    assert.ok(!Object.keys(all).includes("depot.parking_peak_fraction"));
    assert.equal(Object.keys(all).length, METRICS.length - 1 + scenario.depots.length);
    assert.deepEqual(all["wait.p90_s"], { value: 800 });
    const picked = computeAll(result, [{ metric: "wait.p90_s", scope: { area: "SF" } }, { metric: "wait.p90_s", scope: { area: "SJ" } }]);
    assert.deepEqual(picked, { "wait.p90_s{area=SF}": { value: 828 }, "wait.p90_s{area=SJ}": { absent: "no completed request in scope" } });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fixture C: a completed and a censored visit at one depot; turnaround absence and the completed-only descriptive
// ---------------------------------------------------------------------------------------------------------------
//
// Scenario: release off, then the recall moved to 121,000 (D2 09:36, hour 33, every multiplier 1000).
// EB-001 (trips 9) and EB-002, both home EB and home depot EB-1, IDLE at EB. r-EB-0 at 36,000, EB to EB.
//   36,000: both cars plan 420 s; the tie goes to EB-001. Pickup 36,420; trip 36,840; 10 trips: visit 1, clean only.
//   ACCESS IN EB-1 36,840 to 37,140; INTAKE to 37,320; CLEAN 37,320 to 38,520; READY to the end (1380 s turnaround).
//   121,000 recall: EB-002 is IDLE: ACCESS IN 121,000 to 121,300; INTAKE to 121,480; CLEAN from 121,480, due 122,680.
//   The only request is terminal at 36,840, so T_d = 122,400 and EB-002's visit is censored in its bay.
// EB-1: turnaround over both visits absent with 1 visit unfinished; completed-only p90 1380; censored 1; bay waits
//   [0, 0] give 0. Window [21,600, 100,000) holds only EB-001's visit: turnaround 1380, censored 0.
// Stalls held: 37,140 1; 37,320 0; 38,520 1; 121,300 2; 121,480 1. Peak 2 of 30 in the span, 1 of 30 before 100,000.

describe("fixture C: turnaround with a censored visit in scope", () => {
  let scenario = applyAxis(defaultScenario(), "parameter:POL-4", "off");
  scenario = applyAxis(scenario, "parameter:POL-3", 121000);
  const result = runFixture(scenario, {
    cars: [car("EB-001", "EB", "EB-1", { area: "EB" }, { trips_since_visit: 9 }), car("EB-002", "EB", "EB-1", { area: "EB" })],
    requests: [{ id: "r-EB-0", time_s: 36000, origin: "EB", dest: "EB" }],
    depotOccupancy: {},
  });

  test("the visits match the derivation", () => {
    const pick = (v) => [v.car, v.arrival_s, v.intake_end_s, v.first_task_s, v.ready_s, v.censored];
    assert.deepEqual(result.visits.map(pick), [["EB-001", 37140, 37320, 37320, 38520, false], ["EB-002", 121300, 121480, 121480, null, true]]);
    assert.equal(result.drain_end_s, 122400);
  });

  test("absent with the unfinished count; the completed-only descriptive reads the finished visit", () => {
    const at = (metric, scope = {}) => m(result, metric, { depot: "EB-1", ...scope });
    assert.deepEqual(at("depot.turnaround_p90_s"), { absent: "1 visit unfinished at drain end" });
    assert.deepEqual(at("depot.turnaround_p50_s"), { absent: "1 visit unfinished at drain end" });
    assert.deepEqual(m(result, "depot.turnaround_p90_s"), { absent: "1 visit unfinished at drain end" });
    assert.deepEqual(at("depot.turnaround_completed_p90_s"), { value: 1380 });
    assert.deepEqual(at("depot.censored_visits"), { value: 1 });
    assert.deepEqual(at("depot.bay_wait_p90_s"), { value: 0 });
    assert.deepEqual(at("depot.parking_peak_fraction"), { value: 2 / 30 });
    const early = { window: { start_s: 21600, end_s: 100000 } };
    assert.deepEqual(at("depot.turnaround_p90_s", early), { value: 1380 });
    assert.deepEqual(at("depot.censored_visits", early), { value: 0 });
    assert.deepEqual(at("depot.parking_peak_fraction", early), { value: 1 / 30 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fixture E: a gate visit that never starts a task; fixture F: a visit inside the warm-up
// ---------------------------------------------------------------------------------------------------------------
//
// E. Every lot is full for the whole run (SF-1 60 holds, SF-2, SJ-1 and EB-1 30 each). SF-004 (home SF-1) IDLE in SF.
//   88,200 recall: ACCESS IN SF-1 to 88,500; SF-1 full and no depot has a stall: GATE_WAIT to T_d = 122,400, censored.
//   SF-1: bay wait absent (no visit started a task); turnaround absent (1 visit unfinished); completed-only absent;
//   censored 1; parking peak 60 of 60; diversions 0.
// F. SF-001 (home SF-1, trips 9) IDLE in SF; r-SF-0 at 18,100 (warm-up). Pickup 18,460; trip 18,820; visit due:
//   ACCESS IN SF-1 to 19,120 (arrival in the warm-up); INTAKE to 19,300; CLEAN to 20,500; READY to the end (the recall
//   finds no IDLE car). Over the span: no request and no visit, although the run holds one of each.

describe("fixtures E and F: gate wait and warm-up exclusion", () => {
  test("E: a gate visit counts toward the turnaround population but starts no task", () => {
    const result = runFixture(defaultScenario(), {
      cars: [car("SF-004", "SF", "SF-1", { area: "SF" })],
      requests: [],
      depotOccupancy: {
        "EB-1": { stalls: holds(30, FAR) }, "SF-1": { stalls: holds(60, FAR) }, "SF-2": { stalls: holds(30, FAR) }, "SJ-1": { stalls: holds(30, FAR) },
      },
    });
    assert.deepEqual(result.visits.map((v) => [v.arrival_s, v.intake_end_s, v.first_task_s, v.censored]), [[88500, null, null, true]]);
    const at = (metric) => m(result, metric, { depot: "SF-1" });
    assert.deepEqual(at("depot.bay_wait_p90_s"), { absent: "no visit started a task" });
    assert.deepEqual(at("depot.turnaround_p90_s"), { absent: "1 visit unfinished at drain end" });
    assert.deepEqual(at("depot.turnaround_completed_p90_s"), { absent: "no completed visit in scope" });
    assert.deepEqual(at("depot.censored_visits"), { value: 1 });
    assert.deepEqual(at("depot.parking_peak_fraction"), { value: 1 });
    assert.deepEqual(at("depot.diversions"), { value: 0 });
    // No request at all: counts 0, fraction 0.0, waits absent.
    assert.deepEqual([m(result, "requests.total"), m(result, "unserved.fraction")], [{ value: 0 }, { value: 0 }]);
    assert.deepEqual(m(result, "wait.p50_s"), { absent: "no completed request in scope" });
  });

  test("F: a request and a visit inside the warm-up are excluded from the span", () => {
    const result = runFixture(defaultScenario(), {
      cars: [car("SF-001", "SF", "SF-1", { area: "SF" }, { trips_since_visit: 9 })],
      requests: [{ id: "r-SF-0", time_s: 18100, origin: "SF", dest: "SF" }],
      depotOccupancy: {},
    });
    assert.equal(result.requests.length, 1);
    assert.deepEqual(result.visits.map((v) => [v.arrival_s, v.ready_s]), [[19120, 20500]]);
    assert.deepEqual(m(result, "requests.total"), { value: 0 });
    assert.deepEqual(m(result, "wait.p90_s"), { absent: "no completed request in scope" });
    assert.deepEqual(m(result, "depot.turnaround_p90_s", { depot: "SF-1" }), { absent: "no visit in scope" });
    assert.deepEqual(m(result, "depot.bay_wait_p90_s"), { absent: "no visit started a task" });
    // Every driving second (18,100 to 19,120) sits in the warm-up.
    assert.deepEqual(m(result, "vehicle.empty_drive_fraction"), { absent: "no driving seconds in scope" });
    // Ready from 20,500, so available (at SF-1, in SF) for the whole span: 100,800 / (1 x 100,800).
    assert.deepEqual(m(result, "fleet.available_fraction", { area: "SF" }), { value: 1 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fixture B: series on the design 9.5 empty-drive fixture (engine-fixtures case 8)
// ---------------------------------------------------------------------------------------------------------------
//
// SF-001 (home SF-1) READY at SF-1; r-PEN-0 at 61,200 (D1 17:00), PEN to PEN. Pickup leg: PULL_OUT 61,200 to 61,320;
// ACCESS OUT SF-1 61,320 to 61,710 (IN_AREA 1300, congested, area SF, counted as LOCAL); H1 SF>PEN 61,710 to 64,110
// (HIGHWAY 1600, congested, area SF). Trip IN_AREA PEN 64,110 to 64,734 (loaded). IDLE at PEN to 88,200.
// Recall: H1 PEN>SF 88,200 to 89,700; ACCESS IN 89,700 to 90,000; INTAKE to 90,180; CLEAN to 91,380; READY to 122,400.
// Buckets of 3600 s from 18,000: index i starts at 18,000 + 3600 i; 29 buckets; index 0 is the warm-up.
//   Index 12 (61,200): rider work 2910 + 624 = 3534; available IDLE 64,734 to 64,800 = 66; sum 3600.
//     congested empty 390 + 2400 = 2790 (HIGHWAY 2400, LOCAL 390; SF 2790, PEN 0); wait p90 2910 (PEN only).
//   Index 0 (18,000): at a depot 3600. Index 19 (86,400): available 86,400 to 88,200 = 1800; empty drive 88,200 to
//     90,000 = 1800. Index 20 (90,000): INTAKE 180 + CLEAN 1200 + READY 91,380 to 93,600 2220 = 3600 at a depot.
// Declared traffic (contract 6.2 defaults): hour 17 (index 12) HIGHWAY SF>PEN 1600, PEN>SF 1200, LOCAL 1300, IN_AREA
//   1300; hour 7 (index 2) HIGHWAY PEN>SF 1600, SF>PEN 1200, SJ>EB 1200; hour 19 (index 14) HIGHWAY SF>SJ 1300, LOCAL
//   1000; hour 10 (index 5) every row 1000.
// Declared demand: SF hour 17 peak 60, hour 10 off-peak 15; PEN hour 7 peak 20. Flat SF: window hours 5 to 33, peak
//   hours 7, 8, 16, 17, 18, 31, 32: (7 x 60,000 + 22 x 15,000) / 29 = 750,000 / 29 = 25,862.07, half-even 25,862,
//   so 25.862 requests per hour in every bucket.

function isLeaf(v) {
  return typeof v === "number" ? Number.isFinite(v) : v !== null && typeof v === "object" && Object.keys(v).join() === "absent" && typeof v.absent === "string";
}

/** Asserts every array under `node` has `length` entries and every entry is a number or {absent: reason}. */
function assertAligned(node, length, path) {
  if (Array.isArray(node)) {
    assert.equal(node.length, length, path);
    node.forEach((v, i) => assert.ok(isLeaf(v), `${path}[${i}] is ${JSON.stringify(v)}`));
    return;
  }
  assert.ok(node !== null && typeof node === "object", path);
  for (const [k, v] of Object.entries(node)) {
    if (k === "fleet") assert.equal(typeof v, "number");
    else assertAligned(v, length, `${path}.${k}`);
  }
}

describe("computeSeries (design 7.5)", () => {
  const scenario = defaultScenario();
  const result = runFixture(scenario, {
    cars: [readyCar("SF-001", "SF", "SF-1", "SF-1")],
    requests: [{ id: "r-PEN-0", time_s: 61200, origin: "PEN", dest: "PEN" }],
    depotOccupancy: {},
  });
  const series = computeSeries(result, scenario);

  test("every chart id, with 29 aligned buckets of numbers or absences", () => {
    assert.deepEqual(Object.keys(series).sort(), [...SERIES_IDS].sort());
    for (const id of SERIES_IDS) {
      assert.equal(series[id].starts_s.length, 29, id);
      assert.equal(series[id].starts_s[12], 61200);
      assertAligned(series[id], 29, id);
    }
    assert.deepEqual(Object.keys(series.fleet_state.families), ["riderWork", "emptyDrive", "available", "atDepot"]);
    assert.deepEqual(Object.keys(series.wait_p90_by_hour.areas), ["SF", "PEN", "SJ", "EB"]);
    assert.deepEqual(Object.keys(series.bay_wait_by_depot.depots), ["SF-1", "SF-2", "SJ-1", "EB-1"]);
    assert.deepEqual(Object.keys(series.congested_empty_by_hour.classes), ["HIGHWAY", "LOCAL"]);
    assert.deepEqual(Object.keys(series.traffic_by_hour.HIGHWAY).length, 12);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(series))), JSON.stringify(series), "plain data only");
  });

  test("fleet state by family", () => {
    const f = series.fleet_state.families;
    assert.equal(series.fleet_state.fleet, 1);
    assert.deepEqual([f.riderWork[12], f.emptyDrive[12], f.available[12], f.atDepot[12]], [3534, 0, 66, 0]);
    assert.deepEqual([f.riderWork[0], f.emptyDrive[0], f.available[0], f.atDepot[0]], [0, 0, 0, 3600]);
    assert.deepEqual([f.available[19], f.emptyDrive[19]], [1800, 1800]);
    assert.equal(f.atDepot[20], 3600);
    assert.deepEqual([series.fleet_state.states.INTAKE[20], series.fleet_state.states.IN_SERVICE[20], series.fleet_state.states.READY_AT_DEPOT[20]], [180, 1200, 2220]);
    assert.deepEqual(Object.values(STATE_FAMILIES).flat().sort(), Object.keys(series.fleet_state.states).sort());
  });

  test("metric-by-hour series, with the warm-up bucket absent", () => {
    const warm = { absent: "warm-up, not counted" };
    const c = series.congested_empty_by_hour;
    assert.deepEqual([c.all[12], c.classes.HIGHWAY[12], c.classes.LOCAL[12], c.areas.SF[12], c.areas.PEN[12]], [2790, 2400, 390, 2790, 0]);
    assert.deepEqual([c.all[0], c.classes.LOCAL[0], c.all[19]], [warm, warm, 0]);
    const w = series.wait_p90_by_hour;
    assert.deepEqual([w.all[12], w.areas.PEN[12], w.areas.SF[12], w.all[0]], [2910, 2910, { absent: "no completed request in scope" }, warm]);
    // Available cars in index 12 by area: 66 s idle in PEN over 1 car x 3600 s.
    assert.deepEqual([series.available_by_area.areas.PEN[12], series.available_by_area.areas.SF[12], series.available_by_area.areas.SF[0]], [66 / 3600, 0, warm]);
    // The recall visit arrives at 90,000 (index 20): bay wait 0 (intake end 90,180, clean from 90,180); turnaround 1380.
    assert.deepEqual([series.bay_wait_by_depot.all[20], series.bay_wait_by_depot.depots["SF-1"][20]], [0, 0]);
    assert.deepEqual(series.bay_wait_by_depot.depots["SJ-1"][20], { absent: "no visit started a task" });
    assert.deepEqual([series.turnaround_by_arrival_hour.all[20], series.turnaround_by_arrival_hour.all[19]], [1380, { absent: "no visit in scope" }]);
  });

  test("each bucket equals computeMetric scoped to that bucket", () => {
    for (let i = 1; i < 29; i += 1) {
      const window = { start_s: 18000 + 3600 * i, end_s: 21600 + 3600 * i };
      const want = computeMetric(result, { metric: "exposure.congested_empty_s", scope: { window } });
      assert.equal(series.congested_empty_by_hour.all[i], want.value);
      const avail = computeMetric(result, { metric: "fleet.available_fraction", scope: { area: "PEN", window } });
      assert.equal(series.available_by_area.areas.PEN[i], avail.value);
    }
  });

  test("declared traffic and demand", () => {
    const tr = series.traffic_by_hour;
    assert.deepEqual([tr.HIGHWAY["SF>PEN"][12], tr.HIGHWAY["PEN>SF"][12], tr.LOCAL["SF>PEN"][12], tr.IN_AREA[12]], [1600, 1200, 1300, 1300]);
    assert.deepEqual([tr.HIGHWAY["PEN>SF"][2], tr.HIGHWAY["SF>PEN"][2], tr.HIGHWAY["SJ>EB"][2]], [1600, 1200, 1200]);
    assert.deepEqual([tr.HIGHWAY["SF>SJ"][14], tr.LOCAL["SF>SJ"][14], tr.IN_AREA[5]], [1300, 1000, 1000]);
    const d = series.demand_by_hour.areas;
    assert.deepEqual([d.SF.declared_per_h[12], d.SF.declared_per_h[5], d.PEN.declared_per_h[2]], [60, 15, 20]);
    assert.deepEqual([d.PEN.accepted[12], d.SF.accepted[12], d.PEN.accepted.reduce((a, b) => a + b, 0)], [1, 0, 1]);
    const flat = applyAxis(defaultScenario(), "parameter:DEM-5", "flat");
    const flatSeries = computeSeries(result, flat);
    assert.ok(flatSeries.demand_by_hour.areas.SF.declared_per_h.every((v) => v === 25.862));
  });

  test("a 15-minute bucket gives 116 aligned buckets", () => {
    const quarter = { ...scenario, bucket_s: 900 };
    assert.equal(validateScenario(quarter).ok, true);
    const s = computeSeries(result, quarter);
    for (const id of SERIES_IDS) assertAligned(s[id], 116, id);
    // D1 17:00 is bucket (61,200 - 18,000) / 900 = 48; the H1 part 61,710 to 62,100 is 390 congested seconds and the
    // access 61,320 to 61,710 another 390: 780 in [61,200, 62,100).
    assert.equal(s.congested_empty_by_hour.all[48], 780);
    assert.deepEqual(s.wait_p90_by_hour.all[3], { absent: "warm-up, not counted" });
    assert.deepEqual(s.wait_p90_by_hour.all[4], { absent: "no completed request in scope" });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Partitions on the reference preset (design 5.9): P21 for every count and seconds metric, P15 for the fleet-state stack
// ---------------------------------------------------------------------------------------------------------------

describe("partition properties on the reference preset", () => {
  let s = defaultScenario();
  for (const [area, n] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
  s.sigma_permille = 150;
  const result = runToEnd(s, buildWorld(s, { seed: 1004 }), { seed: 1004, keepLogs: false });

  test("P21: area and depot values sum to the unscoped value, in the span and in a window", () => {
    const windows = [undefined, { start_s: 57600, end_s: 72000 }];
    for (const row of METRICS.filter((r) => r.partition)) {
      const key = row.scopes.includes("area") ? "area" : "depot";
      const parts = key === "area" ? s.areas.map((a) => a.id) : s.depots.map((d) => d.id);
      for (const window of windows) {
        const extra = window ? { window } : {};
        const whole = computeMetric(result, { metric: row.name, scope: extra }).value;
        const sum = parts.reduce((n, id) => n + computeMetric(result, { metric: row.name, scope: { [key]: id, ...extra } }).value, 0);
        assert.equal(sum, whole, `${row.name} ${JSON.stringify(extra)}`);
      }
    }
    assert.ok(computeMetric(result, { metric: "requests.total", scope: {} }).value > 0);
    assert.ok(computeMetric(result, { metric: "exposure.congested_empty_s", scope: {} }).value > 0);
  });

  test("P15: every fleet-state bucket sums to the fleet times the bucket length", () => {
    const series = computeSeries(result, s);
    const f = series.fleet_state.families;
    series.fleet_state.starts_s.forEach((t, i) => {
      const sum = f.riderWork[i] + f.emptyDrive[i] + f.available[i] + f.atDepot[i];
      assert.equal(sum, 150 * 3600, `bucket ${t}`);
      const byState = Object.values(series.fleet_state.states).reduce((n, list) => n + list[i], 0);
      assert.equal(byState, sum);
    });
  });

  test("available fractions by area sum to the fleet value within a double's rounding", () => {
    const whole = computeMetric(result, { metric: "fleet.available_fraction", scope: {} }).value;
    const sum = s.areas.reduce((n, a) => n + computeMetric(result, { metric: "fleet.available_fraction", scope: { area: a.id } }).value, 0);
    assert.ok(Math.abs(sum - whole) < 1e-12);
    assert.ok(whole > 0 && whole < 1);
  });
});
